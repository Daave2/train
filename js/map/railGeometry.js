/**
 * Rail Geometry Service
 * Fetches true railway line geometry from OpenStreetMap via Overpass API
 */

const RailGeometry = (function () {
    // Overpass API endpoint
    const OVERPASS_API = 'https://overpass-api.de/api/interpreter';

    // Cache for geometry data
    const geometryCache = new Map();
    const CACHE_KEY = 'railmap-geometry-cache';
    const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

    // Initialize cache from localStorage
    function initCache() {
        try {
            const saved = localStorage.getItem(CACHE_KEY);
            if (saved) {
                const { data, timestamp } = JSON.parse(saved);
                if (Date.now() - timestamp < CACHE_DURATION) {
                    Object.entries(data).forEach(([key, value]) => {
                        geometryCache.set(key, value);
                    });
                    console.log(`Loaded ${geometryCache.size} cached rail geometries`);
                }
            }
        } catch (e) {
            console.warn('Failed to load geometry cache:', e);
        }
    }

    // Save cache to localStorage
    function saveCache() {
        try {
            const data = {};
            geometryCache.forEach((value, key) => {
                data[key] = value;
            });
            localStorage.setItem(CACHE_KEY, JSON.stringify({
                data,
                timestamp: Date.now()
            }));
        } catch (e) {
            console.warn('Failed to save geometry cache:', e);
        }
    }

    /**
     * Get railway geometry between two stations
     * @param {Object} origin - Origin station with lat, lng
     * @param {Object} destination - Destination station with lat, lng
     * @returns {Promise<Array>} Array of [lat, lng] coordinates
     */
    async function getRouteGeometry(origin, destination) {
        const cacheKey = `${origin.code}-${destination.code}`;

        // Check cache first
        if (geometryCache.has(cacheKey)) {
            console.log('Using cached geometry for', cacheKey);
            return geometryCache.get(cacheKey);
        }

        try {
            // Build bounding box with padding
            const padding = 0.1; // ~11km padding
            const minLat = Math.min(origin.lat, destination.lat) - padding;
            const maxLat = Math.max(origin.lat, destination.lat) + padding;
            const minLng = Math.min(origin.lng, destination.lng) - padding;
            const maxLng = Math.max(origin.lng, destination.lng) + padding;

            // Overpass query for main railway lines only (exclude sidings, yards, etc.)
            const query = `
                [out:json][timeout:25];
                (
                    way["railway"="rail"]["service"!~"siding|yard|crossover|spur"](${minLat},${minLng},${maxLat},${maxLng});
                );
                out geom;
            `;

            console.log('Fetching rail geometry from Overpass API...');
            const response = await fetch(OVERPASS_API, {
                method: 'POST',
                body: `data=${encodeURIComponent(query)}`,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            if (!response.ok) {
                throw new Error(`Overpass API error: ${response.status}`);
            }

            const data = await response.json();

            // Find the best path through the railway network
            const geometry = findBestPath(data.elements, origin, destination);

            // Cache the result
            if (geometry && geometry.length > 0) {
                geometryCache.set(cacheKey, geometry);
                saveCache();
            }

            return geometry;
        } catch (error) {
            console.error('Failed to fetch rail geometry:', error);
            // Return simple straight line as fallback
            return [[origin.lat, origin.lng], [destination.lat, destination.lng]];
        }
    }

    /**
     * Find the best path through railway ways
     * Uses graph-based approach that respects railway segment connectivity
     */
    function findBestPath(ways, origin, destination) {
        if (!ways || ways.length === 0) {
            return [[origin.lat, origin.lng], [destination.lat, destination.lng]];
        }

        // Build segments from ways
        const segments = ways
            .filter(w => w.geometry && w.geometry.length > 1)
            .map(w => ({
                id: w.id,
                coords: w.geometry.map(p => [p.lat, p.lon])
            }));

        if (segments.length === 0) {
            return [[origin.lat, origin.lng], [destination.lat, destination.lng]];
        }

        const originPoint = [origin.lat, origin.lng];
        const destPoint = [destination.lat, destination.lng];

        // Build a graph where nodes are segment endpoints and edges are the segments themselves
        const graph = buildRailwayGraph(segments);

        // Find the closest graph nodes to origin and destination
        const startNode = findClosestNode(graph.nodes, originPoint);
        const endNode = findClosestNode(graph.nodes, destPoint);

        if (!startNode || !endNode) {
            return [[origin.lat, origin.lng], [destination.lat, destination.lng]];
        }

        // Use Dijkstra to find shortest path through the railway network
        const nodePath = dijkstra(graph, startNode, endNode);

        let coordPath;
        if (!nodePath || nodePath.length < 2) {
            // Fallback: use greedy segment following
            coordPath = followSegmentsGreedy(segments, originPoint, destPoint);
        } else {
            // Convert node path to coordinate path
            coordPath = buildCoordPath(graph, nodePath, originPoint, destPoint);
        }

        // Validate path - ensure it doesn't backtrack excessively
        const validatedPath = validatePath(coordPath, originPoint, destPoint);

        return simplifyPath(validatedPath, 0.001); // ~100m threshold
    }

    /**
     * Validate path to ensure it makes progress toward destination
     * Falls back to straight line if path is erratic
     */
    function validatePath(path, origin, destination) {
        if (!path || path.length < 2) {
            return [origin, destination];
        }

        const totalDirectDist = distance(origin, destination);
        let pathLength = 0;

        for (let i = 1; i < path.length; i++) {
            pathLength += distance(path[i - 1], path[i]);
        }

        // If path is more than 3x the direct distance, it's probably erratic
        if (pathLength > totalDirectDist * 3) {
            console.warn('Path too long, falling back to straight line');
            return [origin, destination];
        }

        // Check for excessive backtracking
        let backtrackCount = 0;
        const distToDest = (p) => distance(p, destination);

        for (let i = 1; i < path.length; i++) {
            // If we're moving significantly away from destination, count as backtrack
            if (distToDest(path[i]) > distToDest(path[i - 1]) + 0.02) { // ~2km threshold
                backtrackCount++;
            }
        }

        // If backtracking more than 20% of the path, it's erratic
        if (backtrackCount > path.length * 0.2) {
            console.warn('Path has excessive backtracking, falling back to straight line');
            return [origin, destination];
        }

        return path;
    }

    /**
     * Build a graph from railway segments
     * Nodes are connection points, edges are segment paths
     */
    function buildRailwayGraph(segments) {
        const nodes = new Map(); // key -> { key, lat, lng, edges: [] }
        const SNAP_THRESHOLD = 0.001; // ~100m for connecting segments

        function getNodeKey(lat, lng) {
            // Round to create snapping
            const roundedLat = Math.round(lat / SNAP_THRESHOLD) * SNAP_THRESHOLD;
            const roundedLng = Math.round(lng / SNAP_THRESHOLD) * SNAP_THRESHOLD;
            return `${roundedLat.toFixed(4)},${roundedLng.toFixed(4)}`;
        }

        function getOrCreateNode(lat, lng) {
            const key = getNodeKey(lat, lng);
            if (!nodes.has(key)) {
                nodes.set(key, { key, lat, lng, edges: [] });
            }
            return nodes.get(key);
        }

        // Add each segment as an edge between its endpoints
        segments.forEach(segment => {
            const coords = segment.coords;
            if (coords.length < 2) return;

            const startCoord = coords[0];
            const endCoord = coords[coords.length - 1];

            const startNode = getOrCreateNode(startCoord[0], startCoord[1]);
            const endNode = getOrCreateNode(endCoord[0], endCoord[1]);

            // Calculate segment length
            let length = 0;
            for (let i = 1; i < coords.length; i++) {
                length += distance(coords[i - 1], coords[i]);
            }

            // Add bidirectional edges
            startNode.edges.push({
                to: endNode.key,
                coords: coords,
                length,
                segmentId: segment.id
            });
            endNode.edges.push({
                to: startNode.key,
                coords: [...coords].reverse(),
                length,
                segmentId: segment.id
            });
        });

        return { nodes };
    }

    /**
     * Find the closest node to a given point
     */
    function findClosestNode(nodes, point) {
        let closest = null;
        let minDist = Infinity;

        nodes.forEach(node => {
            const d = distance([node.lat, node.lng], point);
            if (d < minDist) {
                minDist = d;
                closest = node;
            }
        });

        return closest;
    }

    /**
     * Dijkstra's algorithm to find shortest path
     */
    function dijkstra(graph, startNode, endNode) {
        const distances = new Map();
        const previous = new Map();
        const visited = new Set();
        const queue = [];

        graph.nodes.forEach((node, key) => {
            distances.set(key, Infinity);
        });
        distances.set(startNode.key, 0);
        queue.push({ key: startNode.key, dist: 0 });

        while (queue.length > 0) {
            // Sort by distance and get closest
            queue.sort((a, b) => a.dist - b.dist);
            const current = queue.shift();

            if (visited.has(current.key)) continue;
            visited.add(current.key);

            if (current.key === endNode.key) break;

            const currentNode = graph.nodes.get(current.key);
            if (!currentNode) continue;

            currentNode.edges.forEach(edge => {
                if (visited.has(edge.to)) return;

                const newDist = distances.get(current.key) + edge.length;
                if (newDist < distances.get(edge.to)) {
                    distances.set(edge.to, newDist);
                    previous.set(edge.to, { from: current.key, edge });
                    queue.push({ key: edge.to, dist: newDist });
                }
            });
        }

        // Reconstruct path
        if (!previous.has(endNode.key) && startNode.key !== endNode.key) {
            return null;
        }

        const path = [];
        let current = endNode.key;
        while (current && current !== startNode.key) {
            path.unshift(current);
            const prev = previous.get(current);
            current = prev ? prev.from : null;
        }
        path.unshift(startNode.key);

        return path;
    }

    /**
     * Build coordinate path from node path
     */
    function buildCoordPath(graph, nodePath, origin, destination) {
        const coords = [origin];

        for (let i = 0; i < nodePath.length - 1; i++) {
            const currentNode = graph.nodes.get(nodePath[i]);
            const nextKey = nodePath[i + 1];

            // Find the edge connecting these nodes
            const edge = currentNode.edges.find(e => e.to === nextKey);
            if (edge) {
                // Add all intermediate coordinates (skip first to avoid duplicates)
                for (let j = 1; j < edge.coords.length; j++) {
                    coords.push(edge.coords[j]);
                }
            }
        }

        coords.push(destination);
        return coords;
    }

    /**
     * Fallback: follow segments in order based on proximity
     */
    function followSegments(segments, origin, destination) {
        // Filter to segments in corridor
        const corridorSegments = segments.filter(seg => {
            return seg.coords.some(coord => isInCorridor(coord, origin, destination, 0.15));
        });

        if (corridorSegments.length === 0) {
            return [origin, destination];
        }

        // Sort segments by distance of their midpoint to origin
        corridorSegments.sort((a, b) => {
            const midA = a.coords[Math.floor(a.coords.length / 2)];
            const midB = b.coords[Math.floor(b.coords.length / 2)];
            return distance(midA, origin) - distance(midB, origin);
        });

        // Concatenate segment coordinates in order
        const path = [origin];
        corridorSegments.forEach(seg => {
            // Determine if segment should be reversed
            const distToFirst = distance(path[path.length - 1], seg.coords[0]);
            const distToLast = distance(path[path.length - 1], seg.coords[seg.coords.length - 1]);

            const coords = distToLast < distToFirst ? [...seg.coords].reverse() : seg.coords;

            // Add coordinates (skip first if too close to last point in path)
            coords.forEach((coord, i) => {
                if (i === 0 && distance(path[path.length - 1], coord) < 0.002) return;
                path.push(coord);
            });
        });
        path.push(destination);

        return path;
    }

    /**
     * Greedy segment following - only add segments that are properly connected
     * This prevents erratic paths from disconnected track segments
     */
    function followSegmentsGreedy(segments, origin, destination) {
        // Filter to segments in corridor with tighter margin
        const corridorSegments = segments.filter(seg => {
            return seg.coords.some(coord => isInCorridor(coord, origin, destination, 0.1));
        });

        if (corridorSegments.length === 0) {
            return [origin, destination];
        }

        const path = [origin];
        const usedSegments = new Set();
        const CONNECTION_THRESHOLD = 0.005; // ~500m connection threshold
        let currentPos = origin;
        let distToDest = distance(currentPos, destination);

        // Greedy: always pick the closest connected segment that moves us toward destination
        while (usedSegments.size < corridorSegments.length) {
            let bestSegment = null;
            let bestEndpoint = null;
            let bestScore = Infinity;

            for (let i = 0; i < corridorSegments.length; i++) {
                if (usedSegments.has(i)) continue;

                const seg = corridorSegments[i];
                const firstPoint = seg.coords[0];
                const lastPoint = seg.coords[seg.coords.length - 1];

                // Check connection to current position
                const distToFirst = distance(currentPos, firstPoint);
                const distToLast = distance(currentPos, lastPoint);

                // Only consider segments that are reasonably connected
                const minDist = Math.min(distToFirst, distToLast);
                if (minDist > CONNECTION_THRESHOLD) continue;

                // Determine which end we'd use
                const useReversed = distToLast < distToFirst;
                const segEnd = useReversed ? firstPoint : lastPoint;

                // Score: prefer segments that move us closer to destination
                const newDistToDest = distance(segEnd, destination);
                const progress = distToDest - newDistToDest;

                // Only use segments that make progress toward destination
                if (progress < -0.02) continue; // Allow tiny backtracking (~2km)

                const score = minDist - progress * 2; // Prefer connected + progress

                if (score < bestScore) {
                    bestScore = score;
                    bestSegment = { index: i, seg, reversed: useReversed };
                    bestEndpoint = segEnd;
                }
            }

            if (!bestSegment) break;

            // Add this segment's coordinates
            usedSegments.add(bestSegment.index);
            const coords = bestSegment.reversed
                ? [...bestSegment.seg.coords].reverse()
                : bestSegment.seg.coords;

            coords.forEach((coord, i) => {
                // Skip first if close to last path point
                if (i === 0 && distance(path[path.length - 1], coord) < 0.002) return;
                path.push(coord);
            });

            currentPos = bestEndpoint;
            distToDest = distance(currentPos, destination);

            // Stop if we're close to destination
            if (distToDest < 0.01) break; // ~1km
        }

        path.push(destination);
        return path;
    }

    /**
     * Check if a point is within a corridor between two endpoints
     */
    function isInCorridor(point, start, end, margin) {
        const minLat = Math.min(start[0], end[0]) - margin;
        const maxLat = Math.max(start[0], end[0]) + margin;
        const minLng = Math.min(start[1], end[1]) - margin;
        const maxLng = Math.max(start[1], end[1]) + margin;

        return point[0] >= minLat && point[0] <= maxLat &&
            point[1] >= minLng && point[1] <= maxLng;
    }

    /**
     * Simplify a path by removing points too close to their neighbors
     * and removing sharp turns that indicate incorrect track switching
     */
    function simplifyPath(path, threshold) {
        if (path.length <= 2) return path;

        // First pass: remove points too close together
        let simplified = [path[0]];
        for (let i = 1; i < path.length - 1; i++) {
            if (distance(simplified[simplified.length - 1], path[i]) > threshold) {
                simplified.push(path[i]);
            }
        }
        simplified.push(path[path.length - 1]);

        // Second pass: remove sharp turns (>120 degrees) that indicate wrong track
        if (simplified.length > 2) {
            simplified = removeSharpTurns(simplified);
        }

        return simplified;
    }

    /**
     * Remove points that create sharp turns (likely wrong track connections)
     */
    function removeSharpTurns(path) {
        if (path.length <= 3) return path;

        const result = [path[0], path[1]];

        for (let i = 2; i < path.length; i++) {
            const prev = result[result.length - 2];
            const curr = result[result.length - 1];
            const next = path[i];

            const angle = calculateAngle(prev, curr, next);

            // If angle is too sharp (< 60 degrees = > 120 degree turn), skip the middle point
            if (angle < 60) {
                // Remove the current point and add the next directly
                result[result.length - 1] = next;
            } else {
                result.push(next);
            }
        }

        return result;
    }

    /**
     * Calculate angle at point B in triangle ABC (in degrees)
     */
    function calculateAngle(a, b, c) {
        const ab = [b[0] - a[0], b[1] - a[1]];
        const bc = [c[0] - b[0], c[1] - b[1]];

        const dotProduct = ab[0] * bc[0] + ab[1] * bc[1];
        const magAB = Math.sqrt(ab[0] * ab[0] + ab[1] * ab[1]);
        const magBC = Math.sqrt(bc[0] * bc[0] + bc[1] * bc[1]);

        if (magAB === 0 || magBC === 0) return 180;

        const cosAngle = dotProduct / (magAB * magBC);
        // Clamp to valid range for acos
        const clampedCos = Math.max(-1, Math.min(1, cosAngle));
        const angle = Math.acos(clampedCos) * (180 / Math.PI);

        return angle;
    }

    /**
     * Calculate distance between two lat/lng points
     */
    function distance(p1, p2) {
        const dLat = p2[0] - p1[0];
        const dLng = p2[1] - p1[1];
        return Math.sqrt(dLat * dLat + dLng * dLng);
    }

    /**
     * Get geometry for a multi-leg journey
     */
    async function getJourneyGeometry(journey) {
        if (!journey || !journey.legs || journey.legs.length === 0) {
            return [];
        }

        const allCoords = [];

        for (const leg of journey.legs) {
            const legGeometry = await getRouteGeometry(leg.origin, leg.destination);
            // Avoid duplicating connection points
            if (allCoords.length > 0 && legGeometry.length > 0) {
                legGeometry.shift(); // Remove first point as it duplicates last point of previous leg
            }
            allCoords.push(...legGeometry);
        }

        return allCoords;
    }

    // Initialize cache on load
    initCache();

    // Public API
    return {
        getRouteGeometry,
        getJourneyGeometry,
        clearCache: () => {
            geometryCache.clear();
            localStorage.removeItem(CACHE_KEY);
        }
    };
})();

window.RailGeometry = RailGeometry;
