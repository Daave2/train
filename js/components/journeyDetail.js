/**
 * Journey Detail Component
 * Handles the display of a full journey itinerary in a modal
 */

const JourneyDetail = (function () {
    let modalElement = null;

    /**
     * Show journey details in a modal
     */
    function show(journey) {
        if (!modalElement) {
            createModalContainer();
        }

        const content = modalElement.querySelector('.modal-content-body');
        content.innerHTML = renderItinerary(journey);

        modalElement.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent scrolling
    }

    /**
     * Hide the modal
     */
    function hide() {
        if (modalElement) {
            modalElement.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    /**
     * Create modal container in the DOM
     */
    function createModalContainer() {
        modalElement = document.createElement('div');
        modalElement.id = 'journeyDetailModal';
        modalElement.className = 'modal-overlay';

        modalElement.innerHTML = `
            <div class="modal-container glass">
                <header class="modal-header">
                    <h2 class="modal-title">Journey Details</h2>
                    <button class="modal-close" id="closeJourneyDetail">&times;</button>
                </header>
                <div class="modal-content-body">
                    <!-- Itinerary will be rendered here -->
                </div>
            </div>
        `;

        document.body.appendChild(modalElement);

        // Add event listeners
        modalElement.querySelector('#closeJourneyDetail').addEventListener('click', hide);
        modalElement.addEventListener('click', (e) => {
            if (e.target === modalElement) hide();
        });

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modalElement.classList.contains('active')) hide();
        });
    }

    /**
     * Render the full journey itinerary
     */
    function renderItinerary(journey) {
        const legs = journey.legs || [];

        return `
            <div class="itinerary-summary">
                <div class="summary-times">
                    <div class="summary-time">
                        <span class="label">Depart</span>
                        <span class="value">${RouteCard.formatTime(journey.departureTime)}</span>
                    </div>
                    <div class="summary-arrow">→</div>
                    <div class="summary-time">
                        <span class="label">Arrive</span>
                        <span class="value">${RouteCard.formatTime(journey.arrivalTime)}</span>
                    </div>
                </div>
                <div class="summary-meta">
                    <span class="meta-item">${RouteCard.formatDuration(journey.duration)}</span>
                    <span class="meta-item">${journey.changes === 0 ? 'Direct' : `${journey.changes} change${journey.changes > 1 ? 's' : ''}`}</span>
                </div>
            </div>

            <div class="timeline">
                ${legs.map((leg, index) => renderLeg(leg, index, legs)).join('')}
            </div>
        `;
    }

    /**
     * Render a single leg in the timeline
     */
    function renderLeg(leg, index, allLegs) {
        const isFirst = index === 0;
        const isLast = index === allLegs.length - 1;

        return `
            <div class="timeline-item">
                <div class="timeline-point origin">
                    <div class="point-marker"></div>
                    <div class="point-info">
                        <div class="point-time">
                            <span class="scheduled">${RouteCard.formatTime(leg.departureTime)}</span>
                        </div>
                        <div class="point-station">
                            <span class="station-name">${leg.origin.name}</span>
                            <span class="platform">${leg.platform ? `Platform ${leg.platform}` : ''}</span>
                        </div>
                    </div>
                </div>

                <div class="timeline-segment">
                    <div class="segment-line"></div>
                    <div class="segment-details">
                        <div class="operator-badge" style="background: ${getOperatorColor(leg.operator)}">
                            ${leg.operator || 'National Rail'}
                        </div>
                    </div>
                </div>

                <div class="timeline-point destination">
                    <div class="point-marker"></div>
                    <div class="point-info">
                        <div class="point-time">
                            <span class="scheduled">${RouteCard.formatTime(leg.arrivalTime)}</span>
                        </div>
                        <div class="point-station">
                            <span class="station-name">${leg.destination.name}</span>
                        </div>
                    </div>
                </div>

                ${!isLast ? `
                    <div class="timeline-connection">
                        <div class="connection-label">Change trains at ${leg.destination.name}</div>
                        <div class="connection-time">Wait time: ${calculateWaitTime(leg, allLegs[index + 1])}</div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Calculate wait time between legs
     */
    function calculateWaitTime(currentLeg, nextLeg) {
        if (!currentLeg || !nextLeg) return '';
        const arrival = new Date(currentLeg.arrivalTime);
        const departure = new Date(nextLeg.departureTime);
        const diff = Math.round((departure - arrival) / (1000 * 60));
        return `${diff} min`;
    }

    /**
     * Helper to get operator color (copied from RouteCard to avoid circular dependency or missing access)
     */
    function getOperatorColor(operator) {
        const colors = {
            'TransPennine Express': '#00a6e6',
            'TPE': '#00a6e6',
            'Northern': '#262262',
            'NT': '#262262',
            'LNER': '#ce0e2d',
            'Avanti': '#004354',
            'CrossCountry': '#660f21',
            'XC': '#660f21',
            'GWR': '#0a493e',
            'EMR': '#473727'
        };
        return colors[operator] || '#6b7280';
    }

    // Public API
    return {
        show,
        hide
    };
})();

window.JourneyDetail = JourneyDetail;
