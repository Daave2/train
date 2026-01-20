/**
 * RailMap UK - Main Application
 */

(function () {
    'use strict';

    // Application state
    const state = {
        originStation: null,
        destinationStation: null,
        viaStation: null,
        journeys: [],
        selectedJourneyIndex: 0,
        isLoading: false
    };

    // DOM elements
    const elements = {};

    /**
     * Initialize the application
     */
    function init() {
        // Cache DOM elements
        cacheElements();

        // Initialize map
        MapController.init('map');

        // Initialize station search
        initStationSearch();

        // Set up event listeners
        setupEventListeners();

        // Set default date/time
        setDefaultDateTime();

        // Initialize theme
        initTheme();

        console.log('RailMap UK initialized');
    }

    /**
     * Cache DOM elements
     */
    function cacheElements() {
        elements.journeyForm = document.getElementById('journeyForm');
        elements.originInput = document.getElementById('origin');
        elements.destinationInput = document.getElementById('destination');
        elements.viaInput = document.getElementById('via');
        elements.dateInput = document.getElementById('date');
        elements.timeInput = document.getElementById('time');
        elements.swapButton = document.getElementById('swapStations');
        elements.nowButton = document.getElementById('nowButton');
        elements.addStopBtn = document.getElementById('addStopBtn');
        elements.removeStopBtn = document.getElementById('removeStopBtn');
        elements.viaGroup = document.getElementById('viaGroup');
        elements.searchButton = document.getElementById('searchButton');
        elements.resultsSection = document.getElementById('resultsSection');
        elements.resultsList = document.getElementById('resultsList');
        elements.resultsCount = document.getElementById('resultsCount');
        elements.loadingOverlay = document.getElementById('loadingOverlay');
        elements.themeToggle = document.getElementById('themeToggle');
        elements.disruptionBanner = document.getElementById('disruptionBanner');
        elements.disruptionClose = document.getElementById('disruptionClose');
    }

    /**
     * Initialize station search components
     */
    function initStationSearch() {
        // Origin search
        window.originSearch = StationSearch.init('origin', 'originDropdown', (station) => {
            state.originStation = station;
            console.log('Origin selected:', station.name);
        });

        // Destination search
        window.destinationSearch = StationSearch.init('destination', 'destinationDropdown', (station) => {
            state.destinationStation = station;
            console.log('Destination selected:', station.name);
        });

        // Via station search
        window.viaSearch = StationSearch.init('via', 'viaDropdown', (station) => {
            state.viaStation = station;
            console.log('Via selected:', station.name);
        });
    }

    /**
     * Set up event listeners
     */
    function setupEventListeners() {
        // Form submission
        elements.journeyForm.addEventListener('submit', handleSearch);

        // Swap stations
        elements.swapButton.addEventListener('click', swapStations);

        // Now button
        elements.nowButton.addEventListener('click', setCurrentTime);

        // Via station toggle
        elements.addStopBtn.addEventListener('click', showViaInput);
        elements.removeStopBtn.addEventListener('click', hideViaInput);

        // Theme toggle
        elements.themeToggle.addEventListener('click', toggleTheme);

        // Disruption banner close
        elements.disruptionClose.addEventListener('click', () => {
            elements.disruptionBanner.classList.remove('active');
        });
    }

    /**
     * Show via station input
     */
    function showViaInput() {
        elements.addStopBtn.classList.add('hidden');
        elements.viaGroup.classList.add('active');
        elements.viaInput.focus();
    }

    /**
     * Hide via station input
     */
    function hideViaInput() {
        elements.viaGroup.classList.remove('active');
        elements.addStopBtn.classList.remove('hidden');
        elements.viaInput.value = '';
        state.viaStation = null;
    }

    /**
     * Set default date and time
     */
    function setDefaultDateTime() {
        const now = new Date();

        // Set date to today
        elements.dateInput.value = now.toISOString().split('T')[0];

        // Round time to next 15 minutes
        const minutes = Math.ceil(now.getMinutes() / 15) * 15;
        now.setMinutes(minutes, 0, 0);
        elements.timeInput.value = now.toTimeString().slice(0, 5);

        // Set min date to today
        elements.dateInput.min = new Date().toISOString().split('T')[0];
    }

    /**
     * Set current time
     */
    function setCurrentTime() {
        const now = new Date();
        elements.timeInput.value = now.toTimeString().slice(0, 5);
        elements.dateInput.value = now.toISOString().split('T')[0];
    }

    /**
     * Swap origin and destination
     */
    function swapStations() {
        const tempStation = state.originStation;
        const tempValue = elements.originInput.value;

        // Swap state
        state.originStation = state.destinationStation;
        state.destinationStation = tempStation;

        // Swap input values
        elements.originInput.value = elements.destinationInput.value;
        elements.destinationInput.value = tempValue;
    }

    /**
     * Handle search form submission
     */
    async function handleSearch(event) {
        event.preventDefault();

        // Validate stations
        if (!state.originStation) {
            // Try to get station from input value
            state.originStation = StationData.getByName(elements.originInput.value) ||
                StationData.search(elements.originInput.value)[0];
        }

        if (!state.destinationStation) {
            state.destinationStation = StationData.getByName(elements.destinationInput.value) ||
                StationData.search(elements.destinationInput.value)[0];
        }

        if (!state.originStation) {
            alert('Please select a valid origin station');
            elements.originInput.focus();
            return;
        }

        if (!state.destinationStation) {
            alert('Please select a valid destination station');
            elements.destinationInput.focus();
            return;
        }

        // Get form values
        const date = elements.dateInput.value;
        const time = elements.timeInput.value;
        const timeType = document.querySelector('input[name="timeType"]:checked').value;

        // Show loading state
        showLoading(true);

        try {
            // Fetch journeys
            const journeys = await TrainApi.searchJourneys(
                state.originStation,
                state.destinationStation,
                date,
                time,
                timeType,
                state.viaStation
            );

            state.journeys = journeys || [];
            state.selectedJourneyIndex = 0;

            // Display results
            displayResults(state.journeys);

            // Update map
            updateMap(state.journeys);

        } catch (error) {
            console.error('Search failed:', error);
            // Manually trigger no-results display on error
            displayResults([]);
            // Also alert for good measure if it's a real crash
            if (error.message !== 'No journeys found') {
                console.error(error); // Keep silent alert, just log
            }
        } finally {
            showLoading(false);
        }
    }

    /**
     * Display search results
     */
    function displayResults(journeys) {
        // Ensure section is visible
        elements.resultsSection.classList.add('active');

        if (!journeys || journeys.length === 0) {
            elements.resultsCount.textContent = 'No journeys found';

            // Use specific warning from API if available
            const warningMessage = (journeys && journeys.warning) || "We couldn't find any train services for this route at the selected time.";

            elements.resultsList.innerHTML = `
                <div class="no-results-message">
                    <div class="no-results-icon">🚂</div>
                    <h3>No journeys found</h3>
                    <p>${warningMessage}</p>
                    <ul>
                        <li>Try a different time or date</li>
                        <li>Check if both stations are correct</li>
                        <li>Some routes may require multiple changes</li>
                    </ul>
                </div>
            `;
            return;
        }

        // Filter available journeys for count
        const availableCount = journeys.filter(j => !j.cancelled && !j.unavailableReason).length;

        elements.resultsCount.textContent = `${availableCount} option${availableCount !== 1 ? 's' : ''} found`;
        elements.resultsSection.classList.add('active');

        // Render journey cards
        RouteCard.renderList(journeys, elements.resultsList, (journey, index) => {
            state.selectedJourneyIndex = index;
            updateMap(journeys, index);
        }, state.selectedJourneyIndex);
    }

    /**
     * Update map with journey routes
     */
    function updateMap(journeys, selectedIndex = 0) {
        if (!journeys || journeys.length === 0) return;

        // Only show journeys with valid legs
        const validJourneys = journeys.filter(j => j.legs && j.legs.length > 0);

        if (validJourneys.length === 0) {
            // Just show origin and destination
            MapController.clearAll();
            MapController.addStationMarker(state.originStation, 'origin');
            MapController.addStationMarker(state.destinationStation, 'destination');

            // Draw simple line
            MapController.drawRoute([
                [state.originStation.lat, state.originStation.lng],
                [state.destinationStation.lat, state.destinationStation.lng]
            ], {}, true);

            MapController.fitBounds();
            return;
        }

        // Find selected journey (handle if it's not in validJourneys)
        let actualSelectedIndex = 0;
        for (let i = 0; i < journeys.length && i <= selectedIndex; i++) {
            if (journeys[i] === validJourneys[actualSelectedIndex]) {
                if (i === selectedIndex) break;
                actualSelectedIndex++;
            }
        }

        RouteRenderer.renderJourneys(validJourneys, Math.min(actualSelectedIndex, validJourneys.length - 1));
    }

    /**
     * Show/hide loading overlay
     */
    function showLoading(show) {
        state.isLoading = show;
        elements.loadingOverlay.classList.toggle('active', show);
        elements.searchButton.disabled = show;
    }

    /**
     * Initialize theme from preference
     */
    function initTheme() {
        const savedTheme = localStorage.getItem('railmap-theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

        if (savedTheme) {
            document.documentElement.dataset.theme = savedTheme;
        } else if (prefersDark) {
            document.documentElement.dataset.theme = 'dark';
        }
    }

    /**
     * Toggle dark/light theme
     */
    function toggleTheme() {
        const currentTheme = document.documentElement.dataset.theme;
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

        document.documentElement.dataset.theme = newTheme;
        localStorage.setItem('railmap-theme', newTheme);
    }

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
