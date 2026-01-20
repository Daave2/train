/**
 * Station Search Component
 * Handles autocomplete for station input fields
 */

const StationSearch = (function () {
    const instances = new Map();

    /**
     * Initialize a station search on an input element
     */
    function init(inputId, dropdownId, onSelect) {
        const input = document.getElementById(inputId);
        const dropdown = document.getElementById(dropdownId);

        if (!input || !dropdown) {
            console.error(`Station search: elements not found for ${inputId}`);
            return null;
        }

        const state = {
            input,
            dropdown,
            onSelect,
            selectedStation: null,
            highlightIndex: -1,
            results: [],
            debounceTimer: null
        };

        // Event listeners
        input.addEventListener('input', (e) => handleInput(state, e));
        input.addEventListener('keydown', (e) => handleKeydown(state, e));
        input.addEventListener('focus', () => showDropdownIfResults(state));
        input.addEventListener('blur', () => hideDropdownDelayed(state));

        // Store instance
        instances.set(inputId, state);

        return {
            getValue: () => state.selectedStation,
            setValue: (station) => setStation(state, station),
            clear: () => clearStation(state)
        };
    }

    /**
     * Handle input changes with debounce
     */
    function handleInput(state, event) {
        const query = event.target.value;

        // Clear previous debounce
        if (state.debounceTimer) {
            clearTimeout(state.debounceTimer);
        }

        // Reset selected station when typing
        state.selectedStation = null;

        // Debounce search
        state.debounceTimer = setTimeout(() => {
            performSearch(state, query);
        }, 150);
    }

    /**
     * Perform station search
     */
    function performSearch(state, query) {
        if (!query || query.length < 2) {
            hideDropdown(state);
            return;
        }

        const results = StationData.search(query);
        state.results = results;
        state.highlightIndex = -1;

        if (results.length > 0) {
            renderDropdown(state, results);
            showDropdown(state);
        } else {
            hideDropdown(state);
        }
    }

    /**
     * Render dropdown with results
     */
    function renderDropdown(state, results) {
        state.dropdown.innerHTML = results.map((station, index) => `
            <div class="autocomplete-item${index === state.highlightIndex ? ' highlighted' : ''}" 
                 data-index="${index}">
                <span class="station-code">${station.code}</span>
                <span class="station-name">${station.name}</span>
            </div>
        `).join('');

        // Add click listeners
        state.dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
            item.addEventListener('mousedown', (e) => {
                e.preventDefault();
                const index = parseInt(item.dataset.index);
                selectStation(state, state.results[index]);
            });
        });
    }

    /**
     * Handle keyboard navigation
     */
    function handleKeydown(state, event) {
        if (!state.results.length) return;

        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                state.highlightIndex = Math.min(state.highlightIndex + 1, state.results.length - 1);
                updateHighlight(state);
                break;

            case 'ArrowUp':
                event.preventDefault();
                state.highlightIndex = Math.max(state.highlightIndex - 1, 0);
                updateHighlight(state);
                break;

            case 'Enter':
                event.preventDefault();
                if (state.highlightIndex >= 0 && state.results[state.highlightIndex]) {
                    selectStation(state, state.results[state.highlightIndex]);
                } else if (state.results.length === 1) {
                    selectStation(state, state.results[0]);
                }
                break;

            case 'Escape':
                hideDropdown(state);
                break;

            case 'Tab':
                if (state.results.length === 1) {
                    selectStation(state, state.results[0]);
                }
                hideDropdown(state);
                break;
        }
    }

    /**
     * Update highlight styling
     */
    function updateHighlight(state) {
        const items = state.dropdown.querySelectorAll('.autocomplete-item');
        items.forEach((item, index) => {
            item.classList.toggle('highlighted', index === state.highlightIndex);
        });

        // Scroll highlighted item into view
        if (state.highlightIndex >= 0 && items[state.highlightIndex]) {
            items[state.highlightIndex].scrollIntoView({ block: 'nearest' });
        }
    }

    /**
     * Select a station
     */
    function selectStation(state, station) {
        state.selectedStation = station;
        state.input.value = station.name;
        hideDropdown(state);

        if (state.onSelect) {
            state.onSelect(station);
        }
    }

    /**
     * Set station programmatically
     */
    function setStation(state, station) {
        if (!station) return;
        state.selectedStation = station;
        state.input.value = station.name;
    }

    /**
     * Clear station
     */
    function clearStation(state) {
        state.selectedStation = null;
        state.input.value = '';
        state.results = [];
        hideDropdown(state);
    }

    /**
     * Show dropdown
     */
    function showDropdown(state) {
        state.dropdown.classList.add('active');
    }

    /**
     * Hide dropdown
     */
    function hideDropdown(state) {
        state.dropdown.classList.remove('active');
    }

    /**
     * Show dropdown if there are results
     */
    function showDropdownIfResults(state) {
        if (state.results.length > 0) {
            showDropdown(state);
        }
    }

    /**
     * Hide dropdown with delay (for click handling)
     */
    function hideDropdownDelayed(state) {
        setTimeout(() => hideDropdown(state), 150);
    }

    /**
     * Get instance by input ID
     */
    function getInstance(inputId) {
        return instances.get(inputId);
    }

    // Public API
    return {
        init,
        getInstance
    };
})();

window.StationSearch = StationSearch;
