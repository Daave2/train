/**
 * Route Renderer
 * Advanced route visualization for journey options
 */

const RouteRenderer = (function () {

    /**
     * Render multiple journey options
     * Primary route is highlighted, alternatives are dimmed
     */
    async function renderJourneys(journeys, selectedIndex = 0) {
        if (!journeys || journeys.length === 0) return;

        MapController.clearAll();

        // Draw alternative routes first (so they're behind)
        for (let index = 0; index < journeys.length; index++) {
            if (index !== selectedIndex) {
                await MapController.displayJourney(journeys[index], false);
            }
        }

        // Draw selected route last (on top)
        if (journeys[selectedIndex]) {
            await MapController.displayJourney(journeys[selectedIndex], true);
        }

        MapController.fitBounds();
    }

    /**
     * Highlight a specific journey
     */
    function highlightJourney(journeys, index) {
        renderJourneys(journeys, index);
    }

    /**
     * Create animated train marker following a route
     * (Future enhancement)
     */
    function animateTrainOnRoute(coordinates, duration = 30000) {
        // Placeholder for future live train tracking
        console.log('Train animation not yet implemented');
    }

    /**
     * Generate a simplified route between two stations
     * Uses intermediate waypoints for realistic rail paths
     */
    function generateRouteCoordinates(origin, destination, viaStations = []) {
        const coordinates = [[origin.lat, origin.lng]];

        viaStations.forEach(station => {
            coordinates.push([station.lat, station.lng]);
        });

        coordinates.push([destination.lat, destination.lng]);

        return coordinates;
    }

    // Public API
    return {
        renderJourneys,
        highlightJourney,
        animateTrainOnRoute,
        generateRouteCoordinates
    };
})();

window.RouteRenderer = RouteRenderer;
