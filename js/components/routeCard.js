/**
 * Route Card Component
 * Creates journey option cards for the results list
 */

const RouteCard = (function () {

    /**
     * Create a journey card element
     */
    function create(journey, index, isSelected = false) {
        const card = document.createElement('div');
        card.className = `journey-card${isSelected ? ' selected' : ''}`;
        card.dataset.index = index;

        const departTime = formatTime(journey.departureTime);
        const arriveTime = formatTime(journey.arrivalTime);
        const duration = formatDuration(journey.duration);
        const changes = journey.changes;
        const operators = getUniqueOperators(journey.legs);

        card.innerHTML = `
            <div class="journey-times">
                <span class="journey-time${journey.departureDelay ? ' delayed' : ''}">${departTime}</span>
                <div class="journey-arrow"></div>
                <span class="journey-time${journey.arrivalDelay ? ' delayed' : ''}">${arriveTime}</span>
                <span class="journey-duration">${duration}</span>
            </div>
            <div class="journey-details">
                <span class="journey-changes">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 4l3 3-3 3M6 20l-3-3 3-3M21 7H9M3 17h12"/>
                    </svg>
                    ${changes === 0 ? 'Direct' : `${changes} change${changes > 1 ? 's' : ''}`}
                </span>
                ${operators.map(op => `
                    <span class="journey-operator" style="background: ${getOperatorColor(op)}">${op}</span>
                `).join('')}
                ${renderStatus(journey)}
            </div>
            ${journey.unavailableReason ? `
                <div class="why-unavailable" data-reason="${journey.unavailableReason}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="16" x2="12" y2="12"/>
                        <line x1="12" y1="8" x2="12.01" y2="8"/>
                    </svg>
                    Why is this unavailable?
                </div>
            ` : ''}
        `;

        return card;
    }

    /**
     * Render status badge
     */
    function renderStatus(journey) {
        if (journey.cancelled) {
            return '<span class="journey-status cancelled">Cancelled</span>';
        }
        if (journey.arrivalDelay && journey.arrivalDelay >= 5) {
            return `<span class="journey-status delayed">+${journey.arrivalDelay} min</span>`;
        }
        if (journey.status === 'on-time') {
            return '<span class="journey-status on-time">On time</span>';
        }
        return '';
    }

    /**
     * Format time string (HH:MM)
     */
    function formatTime(dateString) {
        if (!dateString) return '--:--';
        const date = new Date(dateString);
        return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    }

    /**
     * Format duration in minutes to human readable
     */
    function formatDuration(minutes) {
        if (!minutes) return '';
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        if (hours === 0) return `${mins}m`;
        if (mins === 0) return `${hours}h`;
        return `${hours}h ${mins}m`;
    }

    /**
     * Get unique operators from journey legs
     */
    function getUniqueOperators(legs) {
        if (!legs) return [];
        const operators = legs.map(leg => leg.operator).filter(Boolean);
        return [...new Set(operators)];
    }

    /**
     * Get operator color
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

    /**
     * Render multiple journey cards
     */
    function renderList(journeys, container, onSelect, selectedIndex = 0) {
        container.innerHTML = '';

        journeys.forEach((journey, index) => {
            const card = create(journey, index, index === selectedIndex);

            card.addEventListener('click', () => {
                // Update selection
                container.querySelectorAll('.journey-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');

                if (onSelect) {
                    onSelect(journey, index);
                }
            });

            // Handle "why unavailable" click
            const whyLink = card.querySelector('.why-unavailable');
            if (whyLink) {
                whyLink.addEventListener('click', (e) => {
                    e.stopPropagation();
                    showUnavailableReason(journey.unavailableReason);
                });
            }

            container.appendChild(card);
        });
    }

    /**
     * Show unavailable reason in disruption banner
     */
    function showUnavailableReason(reason) {
        const banner = document.getElementById('disruptionBanner');
        const title = document.getElementById('disruptionTitle');
        const text = document.getElementById('disruptionText');

        if (!banner || !title || !text) return;

        const reasons = {
            'engineering': {
                title: 'Engineering Works',
                text: 'This route is affected by planned engineering work. Try an alternative route.'
            },
            'cancelled': {
                title: 'Service Cancelled',
                text: 'This service has been cancelled. Check for later options.'
            },
            'connection-missed': {
                title: 'Connection Not Possible',
                text: 'The connection time at the interchange station is too short.'
            },
            'no-service': {
                title: 'No Service',
                text: 'No trains run on this section at this time.'
            },
            'reduced-service': {
                title: 'Reduced Service',
                text: 'Fewer trains are running than normal on this route.'
            }
        };

        const info = reasons[reason] || {
            title: 'Route Unavailable',
            text: reason || 'This route is currently not available.'
        };

        title.textContent = info.title;
        text.textContent = info.text;
        banner.classList.add('active');
    }

    // Public API
    return {
        create,
        renderList,
        formatTime,
        formatDuration
    };
})();

window.RouteCard = RouteCard;
