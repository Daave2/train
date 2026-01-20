/**
 * RailGraph
 * Client-side pathfinding using ATOC Routing Guide data
 */

const RailGraph = (function () {
    let graph = null;
    let stationsLoaded = false;

    // Major hubs to prioritize as "split points"
    const MAJOR_HUBS = new Set([
        'YRK', 'BHM', 'LDS', 'MAN', 'PRE', 'SHF', 'CRE', 'EDB', 'NCL', 'LIV',
        'BRI', 'RDG', 'CBG', 'GLC', 'EUS', 'KGX', 'STP', 'PAD', 'VIC', 'LST',
        'WAT', 'WIJ', 'CLJ', 'DON', 'PBO', 'LEI', 'NOT', 'BNS'
    ]);

    async function init() {
        if (graph) return;

        try {
            const response = await fetch('js/data/stationGraph.json');
            if (!response.ok) throw new Error('Failed to load rail graph');
            graph = await response.json();
            stationsLoaded = true;
            console.log('Rail graph loaded:', Object.keys(graph).length, 'stations');
        } catch (e) {
            console.error('RailGraph init failed:', e);
        }
    }

    /**
     * Dijkstra's Algorithm to find shortest path between two stations
     * @param {string} startCode CRS code
     * @param {string} endCode CRS code
     * @returns {Array} List of CRS codes in path
     */
    function findPath(startCode, endCode) {
        if (!graph || !graph[startCode] || !graph[endCode]) return null;

        const distances = {};
        const previous = {};
        const queue = new PriorityQueue();

        // Initialize
        for (const station in graph) {
            distances[station] = Infinity;
            previous[station] = null;
        }

        distances[startCode] = 0;
        queue.enqueue(startCode, 0);

        while (!queue.isEmpty()) {
            const current = queue.dequeue().element;

            if (current === endCode) {
                // Reconstruct path
                const path = [];
                let u = endCode;
                while (u) {
                    path.unshift(u);
                    u = previous[u];
                }
                return path;
            }

            // Neighbors
            const neighbors = graph[current];
            if (!neighbors) continue;

            for (const neighbor in neighbors) {
                const weight = neighbors[neighbor];
                const alt = distances[current] + weight;

                if (alt < distances[neighbor]) {
                    distances[neighbor] = alt;
                    previous[neighbor] = current;
                    queue.enqueue(neighbor, alt);
                }
            }
        }

        return null; // No path found
    }

    /**
     * Find optimal via points for a long journey
     * Returns a list of potential interchange stations along the path
     */
    function findInterchanges(startCode, endCode) {
        const path = findPath(startCode, endCode);
        if (!path) return [];

        const interchanges = [];

        // Filter path for major hubs, but exclude start/end
        for (const station of path) {
            if (station === startCode || station === endCode) continue;

            if (MAJOR_HUBS.has(station)) {
                interchanges.push(station);
            }
        }

        // Simplification: We don't want 10 hubs. 
        // Just return unique major hubs found on the shortest path.
        // The API logic can then try to route via these.
        return [...new Set(interchanges)];
    }

    // Helper Priority Queue
    class PriorityQueue {
        constructor() {
            this.items = [];
        }

        enqueue(element, priority) {
            const queueElement = { element, priority };
            let added = false;
            for (let i = 0; i < this.items.length; i++) {
                if (queueElement.priority < this.items[i].priority) {
                    this.items.splice(i, 0, queueElement);
                    added = true;
                    break;
                }
            }
            if (!added) this.items.push(queueElement);
        }

        dequeue() {
            return this.items.shift();
        }

        isEmpty() {
            return this.items.length === 0;
        }
    }

    return {
        init,
        findPath,
        findInterchanges,
        isLoaded: () => stationsLoaded
    };
})();

// Export global for now
window.RailGraph = RailGraph;
