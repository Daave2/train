/**
 * Map Controller
 * Manages Leaflet map instance and interactions
 */

const MapController = (function () {
    let map = null;
    let routeLayers = [];
    let stationMarkers = [];
    let trainMarkers = [];

    // Map configuration
    const config = {
        defaultCenter: [54.0, -2.5], // UK center
        defaultZoom: 6,
        minZoom: 5,
        maxZoom: 18,
        // Bounds to restrict panning (UK area)
        maxBounds: [
            [49.5, -8.5], // SW
            [61.0, 2.5]   // NE
        ]
    };

    // Tile layers
    const tileLayers = {
        street: {
            url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            options: {
                attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }
        },
        railway: {
            url: 'https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png',
            options: {
                attribution: 'Map data: &copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> contributors | Map style: &copy; <a href="https://www.openrailwaymap.org">OpenRailwayMap</a>',
                maxZoom: 19
            }
        }
    };

    // Custom marker icons
    const icons = {
        origin: L.divIcon({
            className: 'station-marker origin-marker',
            html: '<div class="marker-inner"></div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        }),
        destination: L.divIcon({
            className: 'station-marker destination-marker',
            html: '<div class="marker-inner"></div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        }),
        interchange: L.divIcon({
            className: 'station-marker interchange-marker',
            html: '<div class="marker-inner"></div>',
            iconSize: [16, 16],
            iconAnchor: [8, 8]
        }),
        train: L.divIcon({
            className: 'train-marker',
            html: '<div class="train-marker-inner">🚆</div>',
            iconSize: [26, 26],
            iconAnchor: [13, 13]
        })
    };

    /**
     * Initialize the map
     */
    function init(containerId = 'map') {
        if (map) {
            console.warn('Map already initialized');
            return map;
        }

        // Create map instance
        map = L.map(containerId, {
            center: config.defaultCenter,
            zoom: config.defaultZoom,
            minZoom: config.minZoom,
            maxZoom: config.maxZoom,
            maxBounds: config.maxBounds,
            maxBoundsViscosity: 0.8,
            zoomControl: true
        });

        // Add base tile layer (OpenStreetMap)
        L.tileLayer(tileLayers.street.url, tileLayers.street.options).addTo(map);

        // Add railway overlay layer
        L.tileLayer(tileLayers.railway.url, {
            ...tileLayers.railway.options,
            opacity: 0.7
        }).addTo(map);

        // Add custom marker styles to page
        addMarkerStyles();

        return map;
    }

    /**
     * Add custom marker CSS styles
     */
    function addMarkerStyles() {
        const styleId = 'map-marker-styles';
        if (document.getElementById(styleId)) return;

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .station-marker {
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .station-marker .marker-inner {
                width: 100%;
                height: 100%;
                border-radius: 50%;
                border: 3px solid white;
                box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            }
            .origin-marker .marker-inner {
                background: #10b981;
            }
            .destination-marker .marker-inner {
                background: #ef4444;
            }
            .interchange-marker .marker-inner {
                background: #3b82f6;
                border-width: 2px;
            }
            .train-marker {
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .train-marker .train-marker-inner {
                width: 100%;
                height: 100%;
                border-radius: 50%;
                background: #0f172a;
                color: #fff;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 6px 12px rgba(15, 23, 42, 0.35);
                border: 2px solid #f8fafc;
                font-size: 14px;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Clear all routes from map
     */
    function clearRoutes() {
        routeLayers.forEach(layer => map.removeLayer(layer));
        routeLayers = [];
    }

    /**
     * Clear all markers from map
     */
    function clearMarkers() {
        stationMarkers.forEach(marker => map.removeLayer(marker));
        stationMarkers = [];
        trainMarkers.forEach(marker => map.removeLayer(marker));
        trainMarkers = [];
    }

    /**
     * Clear everything from map
     */
    function clearAll() {
        clearRoutes();
        clearMarkers();
    }

    /**
     * Add a station marker
     */
    function addStationMarker(station, type = 'interchange') {
        if (!map || !station) return null;

        const icon = icons[type] || icons.interchange;

        const marker = L.marker([station.lat, station.lng], { icon })
            .addTo(map)
            .bindPopup(`
                <div class="station-popup">
                    <div class="station-popup-name">${station.name}</div>
                    <div class="station-popup-code">${station.code}</div>
                </div>
            `);

        stationMarkers.push(marker);
        return marker;
    }

    /**
     * Add a train marker
     */
    function addTrainMarker(position, journey, progress) {
        if (!map || !position) return null;

        const percent = Math.round(progress * 100);
        const marker = L.marker([position[0], position[1]], { icon: icons.train })
            .addTo(map)
            .bindPopup(`
                <div class="station-popup">
                    <div class="station-popup-name">Train in progress</div>
                    <div class="station-popup-code">~${percent}% of journey complete</div>
                </div>
            `);

        trainMarkers.push(marker);
        return marker;
    }

    function getJourneyProgress(journey) {
        const dep = journey?.departureTime ? new Date(journey.departureTime) : null;
        const arr = journey?.arrivalTime ? new Date(journey.arrivalTime) : null;
        if (!dep || !arr || Number.isNaN(dep.getTime()) || Number.isNaN(arr.getTime())) return null;

        const now = new Date();
        if (now < dep || now > arr) return null;
        const totalMs = arr - dep;
        if (totalMs <= 0) return null;
        return (now - dep) / totalMs;
    }

    function getCoordinateAtProgress(coordinates, progress) {
        if (!coordinates || coordinates.length === 0) return null;
        if (progress <= 0) return coordinates[0];
        if (progress >= 1) return coordinates[coordinates.length - 1];

        const segmentLengths = [];
        let totalLength = 0;
        for (let i = 0; i < coordinates.length - 1; i++) {
            const length = calculateDistance(coordinates[i], coordinates[i + 1]);
            segmentLengths.push(length);
            totalLength += length;
        }

        const target = totalLength * progress;
        let traveled = 0;
        for (let i = 0; i < segmentLengths.length; i++) {
            const segmentLength = segmentLengths[i];
            if (traveled + segmentLength >= target) {
                const segmentProgress = (target - traveled) / segmentLength;
                const [startLat, startLng] = coordinates[i];
                const [endLat, endLng] = coordinates[i + 1];
                return [
                    startLat + (endLat - startLat) * segmentProgress,
                    startLng + (endLng - startLng) * segmentProgress
                ];
            }
            traveled += segmentLength;
        }

        return coordinates[coordinates.length - 1];
    }

    function calculateDistance(pointA, pointB) {
        const [lat1, lng1] = pointA;
        const [lat2, lng2] = pointB;
        const toRad = value => (value * Math.PI) / 180;
        const earthRadiusKm = 6371;
        const dLat = toRad(lat2 - lat1);
        const dLng = toRad(lng2 - lng1);
        const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLng / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return earthRadiusKm * c;
    }

    /**
     * Draw a route on the map
     * @param {Array} coordinates - Array of [lat, lng] pairs
     * @param {Object} options - Polyline options
     * @param {boolean} isPrimary - Whether this is the primary/selected route
     */
    function drawRoute(coordinates, options = {}, isPrimary = true) {
        if (!map || !coordinates || coordinates.length < 2) return null;

        const defaultOptions = isPrimary ? {
            color: '#2563eb',
            weight: 5,
            opacity: 0.9,
            lineCap: 'round',
            lineJoin: 'round'
        } : {
            color: '#94a3b8',
            weight: 3,
            opacity: 0.6,
            dashArray: '8, 8',
            lineCap: 'round',
            lineJoin: 'round'
        };

        const polyline = L.polyline(coordinates, { ...defaultOptions, ...options }).addTo(map);
        routeLayers.push(polyline);

        return polyline;
    }

    /**
     * Display a journey on the map
     * @param {Object} journey - Journey object with legs
     * @param {boolean} isPrimary - Whether this is the selected route
     */
    async function displayJourney(journey, isPrimary = true) {
        if (!journey || !journey.legs) return;

        // Collect all station coordinates for markers
        const stations = [];

        journey.legs.forEach((leg, index) => {
            if (index === 0) {
                stations.push({ ...leg.origin, type: 'origin' });
            }

            if (index < journey.legs.length - 1) {
                stations.push({ ...leg.destination, type: 'interchange' });
            } else {
                stations.push({ ...leg.destination, type: 'destination' });
            }
        });

        // Try to get real rail geometry
        let coordinates;
        try {
            if (window.RailGeometry) {
                coordinates = await RailGeometry.getJourneyGeometry(journey);
            }
        } catch (error) {
            console.warn('Failed to fetch rail geometry, using straight lines:', error);
        }

        // Fallback to straight lines if geometry fetch failed
        if (!coordinates || coordinates.length < 2) {
            coordinates = [];
            journey.legs.forEach((leg, index) => {
                if (index === 0) {
                    coordinates.push([leg.origin.lat, leg.origin.lng]);
                }
                coordinates.push([leg.destination.lat, leg.destination.lng]);
            });
        }

        // Draw the route
        const routeOptions = isPrimary ? {
            color: getOperatorColor(journey.legs[0]?.operator)
        } : {};

        drawRoute(coordinates, routeOptions, isPrimary);

        // Add markers only for primary route
        if (isPrimary) {
            stations.forEach(station => {
                addStationMarker(station, station.type);
            });

            const progress = getJourneyProgress(journey);
            if (progress !== null) {
                const position = getCoordinateAtProgress(coordinates, progress);
                addTrainMarker(position, journey, progress);
            }
        }
    }

    /**
     * Get train operator color
     */
    function getOperatorColor(operator) {
        const colors = {
            'TransPennine Express': '#00a6e6',
            'TPE': '#00a6e6',
            'Northern': '#262262',
            'NT': '#262262',
            'LNER': '#ce0e2d',
            'Avanti West Coast': '#004354',
            'AW': '#004354',
            'CrossCountry': '#660f21',
            'XC': '#660f21',
            'GWR': '#0a493e',
            'Great Western Railway': '#0a493e',
            'EMR': '#473727',
            'East Midlands Railway': '#473727'
        };
        return colors[operator] || '#2563eb';
    }

    /**
     * Fit map to show all markers/routes
     */
    function fitBounds(padding = 50) {
        if (!map) return;

        const allLayers = [...routeLayers, ...stationMarkers, ...trainMarkers];
        if (allLayers.length === 0) return;

        const group = L.featureGroup(allLayers);
        map.fitBounds(group.getBounds(), {
            padding: [padding, padding],
            maxZoom: 10
        });
    }

    /**
     * Focus on a specific area
     */
    function focusOn(lat, lng, zoom = 12) {
        if (!map) return;
        map.setView([lat, lng], zoom, { animate: true });
    }

    /**
     * Get map instance
     */
    function getMap() {
        return map;
    }

    // Public API
    return {
        init,
        clearRoutes,
        clearMarkers,
        clearAll,
        addStationMarker,
        drawRoute,
        displayJourney,
        fitBounds,
        focusOn,
        getMap,
        getOperatorColor
    };
})();

// Export
window.MapController = MapController;
