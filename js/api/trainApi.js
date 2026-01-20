/**
 * Train API Service
 * Handles train data fetching and normalization
 * Uses Transport API for journey planning with Huxley2 as fallback
 */

const TrainApi = (function () {
    // API configuration
    const config = {
        // Transport API - Primary API for journey planning
        transportApi: {
            baseUrl: 'https://transportapi.com/v3/uk',
            appId: '48fbe82e',
            appKey: '647e1dbf42530ca505b555e05cbfac79'
        },
        // Huxley2 Community Edition - fallback for departures
        huxley: {
            baseUrl: 'https://huxley2.azurewebsites.net',
            accessToken: 'd1ea7eb6-36fb-468e-aad5-438b85f2e0c0'
        },
        // Use Transport API as primary
        useTransportApi: true,
        useMockData: false,
        // Cache duration in ms (5 minutes)
        cacheDuration: 5 * 60 * 1000
    };

    // Simple in-memory cache
    const cache = new Map();

    /**
     * Search for journeys between two stations, optionally via an intermediate station
     */
    async function searchJourneys(origin, destination, date, time, departOrArrive = 'depart', via = null) {
        // If via station is specified, use multi-leg search
        if (via) {
            return searchViaJourneys(origin, via, destination, date, time);
        }

        const cacheKey = `${origin.code}-${destination.code}-${date}-${time}-${departOrArrive}`;

        // Check cache
        const cached = cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < config.cacheDuration) {
            return cached.data;
        }

        let journeys;

        if (config.useMockData) {
            journeys = generateMockJourneys(origin, destination, date, time);
        } else if (config.useTransportApi) {
            journeys = await fetchTransportApiJourneys(origin, destination, date, time);
        } else {
            journeys = await fetchHuxleyJourneys(origin, destination, date, time);
        }

        // Cache results
        cache.set(cacheKey, { data: journeys, timestamp: Date.now() });

        return journeys;
    }

    /**
     * Fetch journeys using Transport API's train endpoints
     * Uses service timetables to find direct and connecting services
     */
    async function fetchTransportApiJourneys(origin, destination, date, time) {
        const { baseUrl, appId, appKey } = config.transportApi;
        const journeys = [];

        try {
            // Get departures from origin station
            // Use specific date and time from search
            const depUrl = `${baseUrl}/train/station/${origin.code}/live.json?app_id=${appId}&app_key=${appKey}&train_status=passenger&from_offset=PT00:00:00&date=${date}&time=${time}`;
            console.log('Fetching departures from Transport API:', depUrl);

            const depResponse = await fetch(depUrl);

            // Check for API errors (like usage limits)
            if (!depResponse.ok) {
                const errorText = await depResponse.text();
                throw new Error(`Transport API error: ${depResponse.status} - ${errorText}`);
            }

            const depData = await depResponse.json();

            // Check for API error response body
            if (depData.error) {
                throw new Error(`Transport API error: ${depData.error}`);
            }

            const departures = depData.departures?.all || [];

            if (departures.length === 0) {
                console.log('No departures found from', origin.code);
                const fallbackResults = await fetchHuxleyJourneys(origin, destination, date, time);
                if (fallbackResults.length === 0) {
                    fallbackResults.warning = `No trains found departing from ${origin.name} around ${time}.`;
                }
                return fallbackResults;
            }

            // Check each service's timetable to find direct or connecting services
            const servicePromises = departures.slice(0, 10).map(async (dep) => {
                try {
                    // Get full service timetable
                    const timetableUrl = dep.service_timetable?.id;
                    if (!timetableUrl) return null;

                    const ttResponse = await fetch(timetableUrl);
                    if (!ttResponse.ok) return null;

                    const timetable = await ttResponse.json();
                    const stops = timetable.stops || [];

                    // Find if this service calls at destination
                    const destStop = stops.find(s => s.station_code === destination.code);

                    if (destStop) {
                        // Direct service found!
                        const originStop = stops.find(s => s.station_code === origin.code);
                        return buildJourneyFromService(dep, timetable, origin, destination, originStop, destStop, date);
                    }

                    // Check for connections at major hubs
                    return await findConnectionsOnService(dep, timetable, origin, destination, date);
                } catch (e) {
                    console.warn('Service timetable fetch failed:', e);
                    return null;
                }
            });

            const results = await Promise.all(servicePromises);
            results.forEach(result => {
                if (result) {
                    if (Array.isArray(result)) {
                        journeys.push(...result);
                    } else {
                        journeys.push(result);
                    }
                }
            });

            // Sort by departure time
            journeys.sort((a, b) => new Date(a.departureTime) - new Date(b.departureTime));

            // If no journeys found, fall back to Huxley
            if (journeys.length === 0) {
                console.log('No Transport API journeys found, falling back to Huxley');
                const fallbackResults = await fetchHuxleyJourneys(origin, destination, date, time);
                if (fallbackResults.length === 0) {
                    fallbackResults.warning = `No direct or connecting trains found between ${origin.name} and ${destination.name}. Try splitting your journey at a major city like London, Manchester, or Leeds.`;
                }
                return fallbackResults;
            }

            console.log(`Found ${journeys.length} journeys via Transport API`);
            return journeys.slice(0, 8);

        } catch (error) {
            console.warn('Transport API failed, falling back to Huxley:', error.message);

            // Fallback to Huxley on ANY error (usage limit, network, etc)
            const fallbackResults = await fetchHuxleyJourneys(origin, destination, date, time);

            // If fallback also fails/finds nothing, give a specific warning
            if (fallbackResults.length === 0) {
                fallbackResults.warning = "Transport API unavailable (usage limit exceeded) and no fallback journeys found. Please try again later or verify your journey details.";
            }
            return fallbackResults;
        }
    }

    /**
     * Build a journey object from a direct service
     */
    function buildJourneyFromService(departure, timetable, origin, destination, originStop, destStop, date) {
        const depTime = originStop?.aimed_departure_time || departure.aimed_departure_time;
        const arrTime = destStop?.aimed_arrival_time || destStop?.aimed_departure_time;

        if (!depTime || !arrTime) return null;

        const duration = parseTimeToMinutes(arrTime) - parseTimeToMinutes(depTime);

        return {
            id: `tapi-${departure.train_uid}`,
            departureTime: `${date}T${depTime}:00`,
            arrivalTime: `${date}T${arrTime}:00`,
            duration: duration > 0 ? duration : duration + 1440,
            changes: 0,
            legs: [{
                origin: origin,
                destination: destination,
                departureTime: `${date}T${depTime}:00`,
                arrivalTime: `${date}T${arrTime}:00`,
                operator: departure.operator_name || departure.operator,
                platform: departure.platform || null
            }],
            status: departure.status === 'ON TIME' ? 'on-time' :
                departure.status === 'CANCELLED' ? 'cancelled' : 'scheduled'
        };
    }

    /**
     * Find connections on a service at major hub stations
     */
    async function findConnectionsOnService(departure, timetable, origin, destination, date) {
        const { baseUrl, appId, appKey } = config.transportApi;
        const stops = timetable.stops || [];
        const journeys = [];

        // Major connection hubs to check
        const connectionHubs = ['MAN', 'LDS', 'YRK', 'PRE', 'SHF', 'BHM', 'EUS', 'KGX', 'PBO', 'NCL', 'LIV', 'CBG'];

        // London terminal interchanges (walk between these)
        const londonInterchanges = {
            'EUS': ['KGX', 'STP'],  // Euston to Kings Cross/St Pancras (10min walk)
            'KGX': ['EUS', 'STP'],
            'STP': ['KGX', 'EUS'],
            'PAD': ['MYB'],          // Paddington to Marylebone
            'VIC': ['WAT']           // Victoria to Waterloo (via tube)
        };

        // Find which hubs this service stops at
        for (const stop of stops) {
            if (!connectionHubs.includes(stop.station_code)) continue;
            if (stop.station_code === origin.code) continue;

            const hubCode = stop.station_code;
            const arrivalAtHub = stop.aimed_arrival_time || stop.aimed_departure_time;
            if (!arrivalAtHub) continue;

            console.log(`Checking connection at ${hubCode} (Arrives ${arrivalAtHub})`);

            try {
                // Look for connecting services from this hub to destination
                // Use arrival time at hub to find relevant connections
                const connUrl = `${baseUrl}/train/station/${hubCode}/live.json?app_id=${appId}&app_key=${appKey}&calling_at=${destination.code}&train_status=passenger&from_offset=PT00:00:00&date=${date}&time=${arrivalAtHub}`;
                // console.log('Connection URL:', connUrl); 

                const connResponse = await fetch(connUrl);
                if (!connResponse.ok) continue;

                const connData = await connResponse.json();
                const connections = connData.departures?.all || [];

                if (connections.length > 0) {
                    console.log(`Found ${connections.length} potential connections from ${hubCode} to ${destination.code}`);
                }

                // Find valid connections (departing after we arrive + 5 min connection time)
                const hubArrMins = parseTimeToMinutes(arrivalAtHub);

                for (const conn of connections.slice(0, 6)) {
                    const connDepTime = conn.aimed_departure_time;
                    const connDepMins = parseTimeToMinutes(connDepTime);

                    console.log(`  Candidate: ${connDepTime} (Need >= ${minutesToTime(hubArrMins + 5)})`);

                    if (connDepMins >= hubArrMins + 5 && connDepMins <= hubArrMins + 120) { // Increased window to 120m
                        // Get connection service timetable for arrival time
                        const connTtUrl = conn.service_timetable?.id;
                        if (!connTtUrl) continue;

                        const connTtResponse = await fetch(connTtUrl);
                        if (!connTtResponse.ok) continue;

                        const connTimetable = await connTtResponse.json();
                        const connStops = connTimetable.stops || [];
                        const destStop = connStops.find(s => s.station_code === destination.code);

                        if (!destStop) continue;

                        const arrTime = destStop.aimed_arrival_time || destStop.aimed_departure_time;
                        const leg1DepTime = departure.aimed_departure_time;
                        const hub = StationData.getByCode(hubCode);

                        if (!hub || !arrTime) continue;

                        const totalDuration = parseTimeToMinutes(arrTime) - parseTimeToMinutes(leg1DepTime);

                        journeys.push({
                            id: `tapi-${departure.train_uid}-${conn.train_uid}`,
                            departureTime: `${date}T${leg1DepTime}:00`,
                            arrivalTime: `${date}T${arrTime}:00`,
                            duration: totalDuration > 0 ? totalDuration : totalDuration + 1440,
                            changes: 1,
                            legs: [
                                {
                                    origin: origin,
                                    destination: hub,
                                    departureTime: `${date}T${leg1DepTime}:00`,
                                    arrivalTime: `${date}T${arrivalAtHub}:00`,
                                    operator: departure.operator_name || departure.operator,
                                    platform: departure.platform || null
                                },
                                {
                                    origin: hub,
                                    destination: destination,
                                    departureTime: `${date}T${connDepTime}:00`,
                                    arrivalTime: `${date}T${arrTime}:00`,
                                    operator: conn.operator_name || conn.operator,
                                    platform: conn.platform || null
                                }
                            ],
                            status: 'scheduled'
                        });

                        break; // Found a connection, move to next hub
                    }
                }

                // If no direct connection from this hub, check London terminal interchange
                if (londonInterchanges[hubCode] && journeys.length === 0) {
                    for (const interchangeStation of londonInterchanges[hubCode]) {
                        try {
                            // Use calculated interchange time
                            const intUrl = `${baseUrl}/train/station/${interchangeStation}/live.json?app_id=${appId}&app_key=${appKey}&calling_at=${destination.code}&train_status=passenger&from_offset=PT00:00:00&date=${date}&time=${minutesToTime(hubArrMins + 30)}`;
                            const intResponse = await fetch(intUrl);
                            if (!intResponse.ok) continue;

                            const intData = await intResponse.json();
                            const intConnections = intData.departures?.all || [];

                            // 30 min interchange time for walking between London terminals
                            const interchangeMins = 30;

                            for (const intConn of intConnections.slice(0, 2)) {
                                const intDepTime = intConn.aimed_departure_time;
                                const intDepMins = parseTimeToMinutes(intDepTime);

                                if (intDepMins >= hubArrMins + interchangeMins && intDepMins <= hubArrMins + 120) {
                                    const intTtUrl = intConn.service_timetable?.id;
                                    if (!intTtUrl) continue;

                                    const intTtResponse = await fetch(intTtUrl);
                                    if (!intTtResponse.ok) continue;

                                    const intTimetable = await intTtResponse.json();
                                    const intStops = intTimetable.stops || [];
                                    const destStop = intStops.find(s => s.station_code === destination.code);

                                    if (!destStop) continue;

                                    const arrTime = destStop.aimed_arrival_time || destStop.aimed_departure_time;
                                    const leg1DepTime = departure.aimed_departure_time;
                                    const hub1 = StationData.getByCode(hubCode);
                                    const hub2 = StationData.getByCode(interchangeStation);

                                    if (!hub1 || !hub2 || !arrTime) continue;

                                    const totalDuration = parseTimeToMinutes(arrTime) - parseTimeToMinutes(leg1DepTime);

                                    journeys.push({
                                        id: `tapi-${departure.train_uid}-int-${intConn.train_uid}`,
                                        departureTime: `${date}T${leg1DepTime}:00`,
                                        arrivalTime: `${date}T${arrTime}:00`,
                                        duration: totalDuration > 0 ? totalDuration : totalDuration + 1440,
                                        changes: 2,
                                        legs: [
                                            {
                                                origin: origin,
                                                destination: hub1,
                                                departureTime: `${date}T${leg1DepTime}:00`,
                                                arrivalTime: `${date}T${arrivalAtHub}:00`,
                                                operator: departure.operator_name || departure.operator,
                                                platform: departure.platform || null
                                            },
                                            {
                                                origin: hub1,
                                                destination: hub2,
                                                departureTime: null,  // Walking
                                                arrivalTime: null,
                                                operator: 'Walk',
                                                isWalk: true
                                            },
                                            {
                                                origin: hub2,
                                                destination: destination,
                                                departureTime: `${date}T${intDepTime}:00`,
                                                arrivalTime: `${date}T${arrTime}:00`,
                                                operator: intConn.operator_name || intConn.operator,
                                                platform: intConn.platform || null
                                            }
                                        ],
                                        status: 'scheduled'
                                    });

                                    break;
                                }
                            }
                        } catch (e) {
                            // Continue
                        }
                    }
                }
            } catch (e) {
                // Continue to next hub
            }
        }

        return journeys;
    }


    /**
     * Search for journeys via an intermediate station
     */
    async function searchViaJourneys(origin, via, destination, date, time) {
        console.log(`Searching via ${via.name}...`);
        const journeys = [];

        try {
            // Leg 1: Origin to Via
            let url1 = `${config.huxley.baseUrl}/departures/${origin.code}/to/${via.code}/5`;
            if (config.huxley.accessToken) url1 += `?accessToken=${config.huxley.accessToken}`;

            const resp1 = await fetch(url1);
            if (!resp1.ok) throw new Error('Failed to fetch leg 1');
            const data1 = await resp1.json();

            if (!data1.trainServices || data1.trainServices.length === 0) {
                console.log('No services found for leg 1');
                return [];
            }

            // For each leg 1 service, find connecting leg 2
            for (const leg1Service of data1.trainServices.slice(0, 4)) {
                const leg1DepTime = leg1Service.std;
                const leg1Details = await fetchServiceDetails(leg1Service.serviceIdUrlSafe);
                const leg1ArrTime = findArrivalTimeAtHub(leg1Details, via.code);

                if (!leg1ArrTime) continue;

                // Leg 2: Via to Destination
                let url2 = `${config.huxley.baseUrl}/departures/${via.code}/to/${destination.code}/5`;
                if (config.huxley.accessToken) url2 += `?accessToken=${config.huxley.accessToken}`;

                const resp2 = await fetch(url2);
                if (!resp2.ok) continue;
                const data2 = await resp2.json();

                if (!data2.trainServices || data2.trainServices.length === 0) continue;

                // Find connecting service (at least 10 mins connection time)
                const leg1ArrMins = parseTimeToMinutes(leg1ArrTime);

                for (const leg2Service of data2.trainServices) {
                    const leg2DepTime = leg2Service.std;
                    const leg2DepMins = parseTimeToMinutes(leg2DepTime);

                    // Need at least 10 minutes connection time for user-specified via
                    if (leg2DepMins >= leg1ArrMins + 10) {
                        const leg2Details = await fetchServiceDetails(leg2Service.serviceIdUrlSafe);
                        const leg2ArrTime = findArrivalTime(leg2Details, destination.code, date);

                        if (!leg2ArrTime) continue;

                        const totalDuration = parseTimeToMinutes(leg2ArrTime.split('T')[1]) - parseTimeToMinutes(leg1DepTime);

                        journeys.push({
                            id: `via-${leg1Service.serviceIdUrlSafe}-${leg2Service.serviceIdUrlSafe}`,
                            departureTime: `${date}T${leg1DepTime}:00`,
                            arrivalTime: leg2ArrTime,
                            duration: totalDuration > 0 ? totalDuration : totalDuration + 1440,
                            changes: 1,
                            legs: [
                                {
                                    origin: origin,
                                    destination: via,
                                    departureTime: `${date}T${leg1DepTime}:00`,
                                    arrivalTime: `${date}T${leg1ArrTime}:00`,
                                    operator: leg1Service.operator || 'Unknown',
                                    platform: leg1Service.platform || null
                                },
                                {
                                    origin: via,
                                    destination: destination,
                                    departureTime: `${date}T${leg2DepTime}:00`,
                                    arrivalTime: leg2ArrTime,
                                    operator: leg2Service.operator || 'Unknown',
                                    platform: leg2Service.platform || null
                                }
                            ],
                            status: determineJourneyStatus(leg1Service, leg2Service)
                        });

                        break; // Found valid connection, move to next leg1
                    }
                }
            }
        } catch (error) {
            console.error('Via search failed:', error);
        }

        // Sort by departure time
        return journeys.sort((a, b) => new Date(a.departureTime) - new Date(b.departureTime));
    }

    /**
     * Fetch service details to get arrival time at destination
     */
    async function fetchServiceDetails(serviceId) {
        try {
            let url = `${config.huxley.baseUrl}/service/${serviceId}`;
            if (config.huxley.accessToken) {
                url += `?accessToken=${config.huxley.accessToken}`;
            }

            const response = await fetch(url);
            if (!response.ok) return null;

            return await response.json();
        } catch (error) {
            console.error('Failed to fetch service details:', error);
            return null;
        }
    }

    /**
     * Find arrival time at destination from service details
     */
    function findArrivalTime(serviceDetails, destinationCode, date) {
        if (!serviceDetails || !serviceDetails.subsequentCallingPoints) return null;

        // Flatten all calling point lists
        for (const cpList of serviceDetails.subsequentCallingPoints) {
            if (!cpList.callingPoint) continue;
            for (const cp of cpList.callingPoint) {
                if (cp.crs === destinationCode) {
                    const sta = cp.st || cp.at; // Scheduled or actual time
                    if (sta) {
                        return `${date}T${sta}:00`;
                    }
                }
            }
        }
        return null;
    }

    /**
     * Find optimal hub stations based on geography
     * Prefers hubs that lie along the travel corridor
     */
    async function findOptimalHubs(origin, destination) {
        // 1. Try RailGraph (Deterministic / Accurate)
        if (window.RailGraph) {
            if (!window.RailGraph.isLoaded()) await window.RailGraph.init();

            const pathHubs = window.RailGraph.findInterchanges(origin.code, destination.code);
            if (pathHubs && pathHubs.length > 0) {
                console.log(`RailGraph found path for ${origin.code}->${destination.code} via:`, pathHubs);
                return { type: 'sequence', hubs: pathHubs };
            }
        }

        console.log('RailGraph unavailable or no path found, using geometric fallback.');

        // Expanded list of UK interchange hubs covering more regions
        const allHubs = [
            // Major interchanges
            'MAN', 'LDS', 'BHM', 'YRK', 'PRE', 'EDB', 'NCL', 'SHF', 'CRE',
            // Regional hubs
            'BRI', 'NOT', 'DBY', 'DON', 'PBO', 'DAR', 'NTR', 'LEI', 'COV', 'GLC', 'CAR',
            // London terminals - critical for long distance journeys
            'EUS', 'KGX', 'STP', 'PAD', 'VIC', 'LST', 'WAT', 'CHX', 'MYB', 'FST',
            // Additional important stations
            'LIV', 'OXF', 'RDG', 'CBG', 'NRW', 'PLY', 'EXD', 'SOU', 'BHI', 'GTW',
            'HUL', 'MLT', 'SCA', 'SKI', 'WKF', 'HUD', 'BFD', 'DNC', 'RTM', 'PTH',
            'ABD', 'INV', 'DUN', 'STG', 'MBR', 'CHE', 'WVH', 'STO', 'STK', 'MAC'
        ];

        // Major interchange bonus (these are well-connected)
        const majorHubs = new Set(['YRK', 'BHM', 'LDS', 'MAN', 'PRE', 'SHF', 'CRE', 'EDB', 'NCL', 'LIV', 'BRI', 'RDG', 'CBG', 'GLC',
            'EUS', 'KGX', 'STP', 'PAD', 'VIC', 'LST']);

        const scoredHubs = [];

        for (const hubCode of allHubs) {
            if (hubCode === origin.code || hubCode === destination.code) continue;

            const hub = StationData.getByCode(hubCode);
            if (!hub) continue;

            // Calculate position along journey (0 = at origin, 1 = at destination)
            const totalDist = StationData.distance(origin.lat, origin.lng, destination.lat, destination.lng);
            const distFromOrigin = StationData.distance(origin.lat, origin.lng, hub.lat, hub.lng);
            const distFromDest = StationData.distance(hub.lat, hub.lng, destination.lat, destination.lng);

            // Position ratio along the journey corridor
            const position = distFromOrigin / (distFromOrigin + distFromDest);

            // Calculate perpendicular distance from the direct line (how far off-track)
            const directDist = totalDist;
            const viaThisHub = distFromOrigin + distFromDest;
            const detour = viaThisHub - directDist;
            const detourRatio = detour / directDist;

            // Score: prefer hubs between 15-85% of journey, penalize large detours
            let score = 100;

            // More lenient position scoring
            if (position >= 0.15 && position <= 0.85) {
                score += 50 - Math.abs(position - 0.5) * 80;
            } else {
                score -= 30; // Less penalty for edge positions
            }

            // Less strict detour penalty - allow cross-country routes
            if (detourRatio > 1.0) {
                score -= detourRatio * 20;
            }

            // Major hub bonus
            if (majorHubs.has(hubCode)) {
                score += 40;
            }

            // Reduced minimum distance filter (hub should be at least 20km from both endpoints)
            if (distFromOrigin < 20 || distFromDest < 20) {
                continue;
            }

            scoredHubs.push({ code: hubCode, score, position, distFromOrigin, distFromDest });
        }

        // Sort by score descending
        scoredHubs.sort((a, b) => b.score - a.score);

        console.log('Optimal hubs for journey:', scoredHubs.slice(0, 8).map(h => `${h.code}(${h.score.toFixed(0)})`));

        return scoredHubs.map(h => h.code);
    }

    /**
     * Search specific multi-leg sequence (Origin -> Hub1 -> Hub2 ... -> Dest)
     * Used when RailGraph provides a deterministic path
     */
    async function searchMultiLegSequence(origin, destination, hubs, date, time) {
        console.log(`Searching multi-leg sequence: ${origin.code} -> ${hubs.join(' -> ')} -> ${destination.code}`);

        // This is a naive implementation that chains calls.
        // For a 2-hub path (3 legs): A->H1, H1->H2, H2->B

        // 1. Search Leg 1: Origin -> Hub1
        const hub1Code = hubs[0];
        const legs1 = await fetchLeg(origin.code, hub1Code, date, time);
        if (legs1.length === 0) return [];

        const validJourneys = [];

        // For each valid 1st leg, try to find connecting 2nd leg
        for (const leg1 of legs1.slice(0, 3)) { // Limit to top 3 options to save requests
            const leg1ArrTime = parseTimeToMinutes(leg1.arrivalTime.split('T')[1]);
            const leg1ArrDate = leg1.arrivalTime.split('T')[0];

            // 2. Search Leg 2: Hub1 -> Hub2 (or Dest if only 1 hub)
            const nextDestCode = hubs.length > 1 ? hubs[1] : destination.code;
            const minDepTime = leg1ArrTime + 7; // Min connection 7 mins

            // Format time for next search (HH:MM)
            const nextDepStr = formatTimeFromMinutes(minDepTime);

            // Note: If crossing midnight, this simple logic might fail, but assuming same day for now
            const legs2 = await fetchLeg(hub1Code, nextDestCode, leg1ArrDate, nextDepStr);

            for (const leg2 of legs2) {
                const leg2DepTime = parseTimeToMinutes(leg2.departureTime.split('T')[1]);
                const leg2ArrTime = parseTimeToMinutes(leg2.arrivalTime.split('T')[1]);

                // Validate connection time window (7 mins to 120 mins)
                if (leg2DepTime < minDepTime || leg2DepTime > minDepTime + 120) continue;

                // If only 1 hub, we are done
                if (hubs.length === 1) {
                    const totalDuration = leg2ArrTime - parseTimeToMinutes(leg1.departureTime.split('T')[1]);
                    validJourneys.push({
                        id: `seq-${leg1.id}-${leg2.id}`,
                        departureTime: leg1.departureTime,
                        arrivalTime: leg2.arrivalTime,
                        duration: totalDuration > 0 ? totalDuration : totalDuration + 1440,
                        changes: 1,
                        legs: [leg1, leg2]
                    });
                }
                // If 2 hubs, search Leg 3: Hub2 -> Dest
                else if (hubs.length === 2) {
                    const hub2Code = hubs[1];
                    const minDepTime3 = leg2ArrTime + 7;
                    const nextDepStr3 = formatTimeFromMinutes(minDepTime3);
                    const leg2ArrDate = leg2.arrivalTime.split('T')[0];

                    const legs3 = await fetchLeg(hub2Code, destination.code, leg2ArrDate, nextDepStr3);

                    for (const leg3 of legs3) {
                        const leg3DepTime = parseTimeToMinutes(leg3.departureTime.split('T')[1]);
                        const leg3ArrTime = parseTimeToMinutes(leg3.arrivalTime.split('T')[1]);

                        if (leg3DepTime < minDepTime3 || leg3DepTime > minDepTime3 + 120) continue;

                        const totalDuration = leg3ArrTime - parseTimeToMinutes(leg1.departureTime.split('T')[1]);
                        validJourneys.push({
                            id: `seq-${leg1.id}-${leg2.id}-${leg3.id}`,
                            departureTime: leg1.departureTime,
                            arrivalTime: leg3.arrivalTime,
                            duration: totalDuration > 0 ? totalDuration : totalDuration + 1440,
                            changes: 2,
                            legs: [leg1, leg2, leg3]
                        });
                    }
                }
            }
        }

        return validJourneys;
    }

    /**
     * Helper to fetch a single leg (A->B)
     */
    async function fetchLeg(fromCode, toCode, date, time) {
        let url = `${config.huxley.baseUrl}/departures/${fromCode}/to/${toCode}/5`;
        if (config.huxley.accessToken) url += `?accessToken=${config.huxley.accessToken}`;

        // Add time params
        // Calculate offset if needed (reusing logic from fetchHuxleyJourneys effectively)
        // For simplicity here, assume direct Huxley "timeOffset" isn't needed if we trust the API to return near-future
        // Actually, we DO need to pass time/offset.
        // Let's rely on standard params logic or just simplified:

        // Simplification: just call fetch and filter locally or assume "now" + offset if strictly needed.
        // But `time` arg is HH:MM literal. Huxley takes `timeOffset` (mins from now).
        // We need to convert `time` (HH:MM on `date`) to `timeOffset` relative to `now`.

        const now = new Date();
        const searchDate = new Date(`${date}T${time}:00`);
        let diffMinutes = Math.floor((searchDate - now) / (1000 * 60));

        // Cap
        if (diffMinutes > 119) diffMinutes = 119;
        // If searching past, allow it? Huxley takes negative? likely yes.
        if (diffMinutes < -119) diffMinutes = -119;

        if (Math.abs(diffMinutes) > 2) {
            url += `&timeOffset=${diffMinutes}`;
        }

        try {
            const resp = await fetch(url);
            if (!resp.ok) return [];
            const data = await resp.json();
            if (!data.trainServices) return [];

            const results = [];
            const fromStation = StationData.getByCode(fromCode) || { code: fromCode, name: fromCode };
            const toStation = StationData.getByCode(toCode) || { code: toCode, name: toCode };

            for (const service of data.trainServices) {
                // We need arrival time at B.
                // Service details needed? Huxley /departures/to/ yields `sta`/`eta` at *destination*? 
                // Huxley docs: returns services filtering by destination. `std` is dep from A. `sta` is arr at B?
                // Usually for /from/to/, the `eta`/`sta` fields refer to the destination filter station.
                // Let's verify. If so, we avoid extra fetchServiceDetails calls!

                let arrTime = service.sta || service.eta; // Scheduled Time of Arrival
                if (arrTime === 'On time') arrTime = service.sta;
                // If Huxley response for /from/to includes arrival time at 'to', use it.
                // Testing shows it usually does implicitly or we check `service.destination` list? 
                // Actually Huxley2 usually returns `arrival_time` in the simplified object if `to` is specified?
                // Let's assume we need details if not present.

                // Safe bet: fetch details to be sure (like existing logic)
                // But for performance in multi-leg, maybe skip if possible?
                // Existing logic `searchSingleHop` calls `fetchServiceDetails` to find arrival at Hub.
                // We will stick to that pattern for robustness.

                const details = await fetchServiceDetails(service.serviceIdUrlSafe);
                const accurateArrTime = findArrivalTimeAtHub(details, toCode);
                if (!accurateArrTime) continue;

                results.push({
                    id: service.serviceIdUrlSafe,
                    departureTime: `${date}T${service.std}:00`,
                    arrivalTime: `${date}T${accurateArrTime}:00`,
                    operator: service.operator,
                    platform: service.platform,
                    origin: fromStation,
                    destination: toStation
                });
            }
            return results;
        } catch (e) {
            console.warn('Leg fetch failed', e);
            return [];
        }
    }

    // Helper to format mins to HH:MM
    function formatTimeFromMinutes(totalMins) {
        let h = Math.floor(totalMins / 60) % 24;
        let m = totalMins % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    }

    /**
     * Search for connecting journeys via intermediate hub stations
     * Uses intelligent hub selection and parallel API calls
     */
    async function searchConnectionJourneys(origin, destination, date, time) {
        const journeys = [];

        // Get geographically optimal hubs
        const optimalData = await findOptimalHubs(origin, destination);

        // Handle RailGraph Sequence (Simple multi-leg chain)
        if (optimalData && optimalData.type === 'sequence') {
            const sequenceJourneys = await searchMultiLegSequence(origin, destination, optimalData.hubs, date, time);
            if (sequenceJourneys.length > 0) return rankAndDeduplicateJourneys(sequenceJourneys);

            // If sequence search fails, fall back to loose search?
            // Let's degrade to using the hubs as a simple set if sequence fails.
            optimalData = optimalData.hubs;
        }

        const optimalHubs = Array.isArray(optimalData) ? optimalData : (optimalData ? optimalData.hubs : []);

        if (!optimalHubs || !Array.isArray(optimalHubs)) {
            console.warn('findOptimalHubs returned invalid data:', optimalHubs);
            return [];
        }

        const relevantHubs = optimalHubs.slice(0, 8); // Top 8 hubs

        if (relevantHubs.length === 0) {
            console.log('No suitable hubs found for this journey');
            return [];
        }

        console.log('Searching connections via:', relevantHubs.slice(0, 6).join(', '));

        // Search single-hop connections in parallel (first 6 hubs)
        const singleHopPromises = relevantHubs.slice(0, 6).map(hubCode =>
            searchSingleHopConnection(origin, destination, hubCode, date, time)
                .catch(e => { console.warn(`Hub ${hubCode} search failed:`, e); return []; })
        );

        const singleHopResults = await Promise.all(singleHopPromises);
        singleHopResults.forEach(result => journeys.push(...result));

        console.log(`Found ${journeys.length} single-hop routes`);

        // If not enough results, try 2-hop connections (2 changes)
        if (journeys.length < 3) {
            console.log('Searching for 2-hop connections...');

            // Build hub pairs for 2-hop search (hub1 near origin, hub2 near dest)
            const hubPairs = [];
            for (let i = 0; i < Math.min(6, relevantHubs.length); i++) {
                for (let j = 0; j < Math.min(6, relevantHubs.length); j++) {
                    if (i !== j) {
                        const hub1 = StationData.getByCode(relevantHubs[i]);
                        const hub2 = StationData.getByCode(relevantHubs[j]);
                        if (hub1 && hub2) {
                            const dist1ToOrigin = StationData.distance(origin.lat, origin.lng, hub1.lat, hub1.lng);
                            const dist2ToOrigin = StationData.distance(origin.lat, origin.lng, hub2.lat, hub2.lng);
                            // Only use pairs where hub1 is closer to origin than hub2
                            if (dist1ToOrigin < dist2ToOrigin) {
                                hubPairs.push([relevantHubs[i], relevantHubs[j]]);
                            }
                        }
                    }
                }
            }

            // Search 2-hop in parallel (limit to 8 pairs)
            const twoHopPromises = hubPairs.slice(0, 8).map(([hub1, hub2]) =>
                searchTwoHopConnection(origin, destination, hub1, hub2, date, time)
                    .catch(e => { console.warn(`2-hop ${hub1}-${hub2} failed:`, e); return []; })
            );

            const twoHopResults = await Promise.all(twoHopPromises);
            twoHopResults.forEach(result => journeys.push(...result));
        }

        // Deduplicate and rank results
        return rankAndDeduplicateJourneys(journeys);
    }

    /**
     * Rank journeys by duration and remove near-duplicates
     */
    function rankAndDeduplicateJourneys(journeys) {
        if (journeys.length === 0) return [];

        // Sort by duration
        journeys.sort((a, b) => (a.duration || 999) - (b.duration || 999));

        // Remove duplicates (same hubs, within 15 mins)
        const unique = [];
        for (const journey of journeys) {
            const hubsKey = journey.legs.map(l => l.destination.code).join('-');
            const isDuplicate = unique.some(j => {
                const jHubsKey = j.legs.map(l => l.destination.code).join('-');
                return hubsKey === jHubsKey && Math.abs((j.duration || 0) - (journey.duration || 0)) < 15;
            });

            if (!isDuplicate) {
                unique.push(journey);
            }
        }

        console.log(`Returning ${Math.min(5, unique.length)} routes from ${journeys.length} found`);
        return unique.slice(0, 5);
    }

    /**
     * Search single-hop connection (1 change via one hub)
     */
    async function searchSingleHopConnection(origin, destination, hubCode, date, time) {
        const journeys = [];

        try {
            let url1 = `${config.huxley.baseUrl}/departures/${origin.code}/to/${hubCode}/5`;
            if (config.huxley.accessToken) url1 += `?accessToken=${config.huxley.accessToken}`;

            const resp1 = await fetch(url1);
            if (!resp1.ok) return [];
            const data1 = await resp1.json();

            if (!data1.trainServices || data1.trainServices.length === 0) return [];

            const hub = StationData.getByCode(hubCode);
            if (!hub) return [];

            for (const leg1Service of data1.trainServices.slice(0, 3)) {
                const leg1DepTime = leg1Service.std;
                const leg1Details = await fetchServiceDetails(leg1Service.serviceIdUrlSafe);
                const leg1ArrTime = findArrivalTimeAtHub(leg1Details, hubCode);

                if (!leg1ArrTime) continue;

                let url2 = `${config.huxley.baseUrl}/departures/${hubCode}/to/${destination.code}/5`;
                if (config.huxley.accessToken) url2 += `?accessToken=${config.huxley.accessToken}`;

                const resp2 = await fetch(url2);
                if (!resp2.ok) continue;
                const data2 = await resp2.json();

                if (!data2.trainServices || data2.trainServices.length === 0) continue;

                const leg1ArrMins = parseTimeToMinutes(leg1ArrTime);

                for (const leg2Service of data2.trainServices) {
                    const leg2DepTime = leg2Service.std;
                    const leg2DepMins = parseTimeToMinutes(leg2DepTime);

                    // Need at least 5 mins connection time
                    if (leg2DepMins >= leg1ArrMins + 5 && leg2DepMins <= leg1ArrMins + 120) {
                        const leg2Details = await fetchServiceDetails(leg2Service.serviceIdUrlSafe);
                        const leg2ArrTime = findArrivalTime(leg2Details, destination.code, date);

                        if (!leg2ArrTime) continue;

                        const totalDuration = parseTimeToMinutes(leg2ArrTime.split('T')[1]) - parseTimeToMinutes(leg1DepTime);

                        journeys.push({
                            id: `conn-${leg1Service.serviceIdUrlSafe}-${leg2Service.serviceIdUrlSafe}`,
                            departureTime: `${date}T${leg1DepTime}:00`,
                            arrivalTime: leg2ArrTime,
                            duration: totalDuration > 0 ? totalDuration : totalDuration + 1440,
                            changes: 1,
                            legs: [
                                {
                                    origin: origin,
                                    destination: hub,
                                    departureTime: `${date}T${leg1DepTime}:00`,
                                    arrivalTime: `${date}T${leg1ArrTime}:00`,
                                    operator: leg1Service.operator || 'Unknown',
                                    platform: leg1Service.platform || null
                                },
                                {
                                    origin: hub,
                                    destination: destination,
                                    departureTime: `${date}T${leg2DepTime}:00`,
                                    arrivalTime: leg2ArrTime,
                                    operator: leg2Service.operator || 'Unknown',
                                    platform: leg2Service.platform || null
                                }
                            ],
                            status: determineJourneyStatus(leg1Service, leg2Service)
                        });

                        // Limit to 2 connections per leg1 service to avoid too many API calls
                        if (journeys.filter(j => j.legs[0].departureTime.includes(leg1DepTime)).length >= 2) break;
                    }
                }
            }
        } catch (error) {
            console.error(`Failed to search via ${hubCode}:`, error);
        }

        return journeys;
    }

    /**
     * Search two-hop connection (2 changes via two hubs)
     */
    async function searchTwoHopConnection(origin, destination, hub1Code, hub2Code, date, time) {
        const journeys = [];

        try {
            const hub1 = StationData.getByCode(hub1Code);
            const hub2 = StationData.getByCode(hub2Code);
            if (!hub1 || !hub2) return [];

            // Leg 1: Origin to Hub1
            let url1 = `${config.huxley.baseUrl}/departures/${origin.code}/to/${hub1Code}/3`;
            if (config.huxley.accessToken) url1 += `?accessToken=${config.huxley.accessToken}`;

            const resp1 = await fetch(url1);
            if (!resp1.ok) return [];
            const data1 = await resp1.json();
            if (!data1.trainServices || data1.trainServices.length === 0) return [];

            for (const leg1Service of data1.trainServices.slice(0, 1)) {
                const leg1DepTime = leg1Service.std;
                const leg1Details = await fetchServiceDetails(leg1Service.serviceIdUrlSafe);
                const leg1ArrTime = findArrivalTimeAtHub(leg1Details, hub1Code);
                if (!leg1ArrTime) continue;

                // Leg 2: Hub1 to Hub2
                let url2 = `${config.huxley.baseUrl}/departures/${hub1Code}/to/${hub2Code}/3`;
                if (config.huxley.accessToken) url2 += `?accessToken=${config.huxley.accessToken}`;

                const resp2 = await fetch(url2);
                if (!resp2.ok) continue;
                const data2 = await resp2.json();
                if (!data2.trainServices || data2.trainServices.length === 0) continue;

                const leg1ArrMins = parseTimeToMinutes(leg1ArrTime);

                for (const leg2Service of data2.trainServices) {
                    const leg2DepTime = leg2Service.std;
                    const leg2DepMins = parseTimeToMinutes(leg2DepTime);

                    if (leg2DepMins >= leg1ArrMins + 5) {
                        const leg2Details = await fetchServiceDetails(leg2Service.serviceIdUrlSafe);
                        const leg2ArrTime = findArrivalTimeAtHub(leg2Details, hub2Code);
                        if (!leg2ArrTime) continue;

                        // Leg 3: Hub2 to Destination
                        let url3 = `${config.huxley.baseUrl}/departures/${hub2Code}/to/${destination.code}/3`;
                        if (config.huxley.accessToken) url3 += `?accessToken=${config.huxley.accessToken}`;

                        const resp3 = await fetch(url3);
                        if (!resp3.ok) continue;
                        const data3 = await resp3.json();
                        if (!data3.trainServices || data3.trainServices.length === 0) continue;

                        const leg2ArrMins = parseTimeToMinutes(leg2ArrTime);

                        for (const leg3Service of data3.trainServices) {
                            const leg3DepTime = leg3Service.std;
                            const leg3DepMins = parseTimeToMinutes(leg3DepTime);

                            if (leg3DepMins >= leg2ArrMins + 5) {
                                const leg3Details = await fetchServiceDetails(leg3Service.serviceIdUrlSafe);
                                const leg3ArrTime = findArrivalTime(leg3Details, destination.code, date);
                                if (!leg3ArrTime) continue;

                                const totalDuration = parseTimeToMinutes(leg3ArrTime.split('T')[1]) - parseTimeToMinutes(leg1DepTime);

                                journeys.push({
                                    id: `conn2-${leg1Service.serviceIdUrlSafe}-${leg2Service.serviceIdUrlSafe}-${leg3Service.serviceIdUrlSafe}`,
                                    departureTime: `${date}T${leg1DepTime}:00`,
                                    arrivalTime: leg3ArrTime,
                                    duration: totalDuration > 0 ? totalDuration : totalDuration + 1440,
                                    changes: 2,
                                    legs: [
                                        {
                                            origin: origin,
                                            destination: hub1,
                                            departureTime: `${date}T${leg1DepTime}:00`,
                                            arrivalTime: `${date}T${leg1ArrTime}:00`,
                                            operator: leg1Service.operator || 'Unknown',
                                            platform: leg1Service.platform || null
                                        },
                                        {
                                            origin: hub1,
                                            destination: hub2,
                                            departureTime: `${date}T${leg2DepTime}:00`,
                                            arrivalTime: `${date}T${leg2ArrTime}:00`,
                                            operator: leg2Service.operator || 'Unknown',
                                            platform: leg2Service.platform || null
                                        },
                                        {
                                            origin: hub2,
                                            destination: destination,
                                            departureTime: `${date}T${leg3DepTime}:00`,
                                            arrivalTime: leg3ArrTime,
                                            operator: leg3Service.operator || 'Unknown',
                                            platform: leg3Service.platform || null
                                        }
                                    ],
                                    status: 'scheduled'
                                });

                                return journeys; // Found one 2-hop route, that's enough
                            }
                        }
                        break;
                    }
                }
            }
        } catch (error) {
            console.error(`Failed to search 2-hop via ${hub1Code}→${hub2Code}:`, error);
        }

        return journeys;
    }

    /**
     * Find arrival time at a hub station from service details
     */
    function findArrivalTimeAtHub(serviceDetails, hubCode) {
        if (!serviceDetails || !serviceDetails.subsequentCallingPoints) return null;

        for (const cpList of serviceDetails.subsequentCallingPoints) {
            if (!cpList.callingPoint) continue;
            for (const cp of cpList.callingPoint) {
                if (cp.crs === hubCode) {
                    return cp.st || cp.at; // Return just HH:MM format
                }
            }
        }
        return null;
    }

    /**
     * Determine journey status from multiple services
     */
    function determineJourneyStatus(service1, service2) {
        if (service1.isCancelled || service2.isCancelled) return 'cancelled';
        if (service1.etd === 'Delayed' || service2.etd === 'Delayed') return 'delayed';
        if (service1.etd === 'On time' && service2.etd === 'On time') return 'on-time';
        return 'scheduled';
    }

    /**
     * Fetch journey data from Huxley2 API (Darwin proxy)
     */
    async function fetchHuxleyJourneys(origin, destination, date, time) {
        let directJourneys = [];

        try {
            // Base URL with access token if available
            let url = `${config.huxley.baseUrl}/departures/${origin.code}/to/${destination.code}/10`;
            const params = [];

            if (config.huxley.accessToken) {
                params.push(`accessToken=${config.huxley.accessToken}`);
            }

            // Add time offset if searching for future/past time
            if (date && time) {
                const now = new Date();
                const searchDate = new Date(`${date}T${time}:00`);

                // Calculate difference in minutes (can be negative for past times, though typically future)
                // Huxley uses strict minutes or hours for offset
                // Note: Huxley expects offset from "now"
                let diffMinutes = Math.floor((searchDate - now) / (1000 * 60));

                // Cap offset to prevent 400 Bad Request (limit is usually +/- 120 mins)
                if (diffMinutes > 119) diffMinutes = 119;
                if (diffMinutes < -119) diffMinutes = -119;

                // Only filter if difference is significant (> 2 mins)
                if (Math.abs(diffMinutes) > 2) {
                    params.push(`timeOffset=${diffMinutes}`);
                    console.log(`Applying time offset of ${diffMinutes} minutes`);
                }
            }

            if (params.length > 0) {
                url += `?${params.join('&')}`;
            }

            console.log('Fetching from Huxley2:', url);

            const response = await fetch(url);

            if (response.ok) {
                const data = await response.json();
                directJourneys = await normalizeHuxleyResponse(data, origin, destination, date);
            } else {
                console.warn(`Direct API returned ${response.status}, will search connections`);
            }
        } catch (error) {
            console.warn('Direct API failed, will search connections:', error.message);
        }

        // Always search for connections if we have few or no direct services
        if (directJourneys.length < 2) {
            console.log('Searching for connecting journeys...');
            try {
                const connectionJourneys = await searchConnectionJourneys(origin, destination, date, time);

                // Combine and sort by departure time
                directJourneys = [...directJourneys, ...connectionJourneys].sort((a, b) =>
                    new Date(a.departureTime) - new Date(b.departureTime)
                );
            } catch (connError) {
                console.error('Connection search also failed:', connError);
            }
        }

        return directJourneys;
    }

    /**
     * Normalize Huxley2 API response to our journey format
     */
    async function normalizeHuxleyResponse(data, origin, destination, date) {
        if (!data.trainServices || data.trainServices.length === 0) {
            console.log('No train services found');
            return [];
        }

        // Fetch arrival times for each service in parallel
        const journeyPromises = data.trainServices.map(async (service, index) => {
            // Parse scheduled departure time
            const depTime = service.std || '00:00';
            const [depHours, depMins] = depTime.split(':').map(Number);

            // Fetch service details to get arrival time
            let arrivalTime = null;
            let duration = null;

            if (service.serviceIdUrlSafe) {
                const serviceDetails = await fetchServiceDetails(service.serviceIdUrlSafe);
                arrivalTime = findArrivalTime(serviceDetails, destination.code, date);

                if (arrivalTime) {
                    const arrTime = arrivalTime.split('T')[1].substring(0, 5);
                    const depMins = parseTimeToMinutes(depTime);
                    let arrMins = parseTimeToMinutes(arrTime);
                    if (arrMins < depMins) arrMins += 24 * 60; // Next day
                    duration = arrMins - depMins;
                }
            }

            // Build leg info
            const leg = {
                origin: origin,
                destination: destination,
                departureTime: `${date}T${depTime}:00`,
                arrivalTime: arrivalTime,
                operator: service.operator || 'Unknown',
                platform: service.platform || null
            };

            // Determine status
            let status = 'scheduled';
            let cancelled = false;
            let departureDelay = 0;

            if (service.isCancelled) {
                status = 'cancelled';
                cancelled = true;
            } else if (service.etd === 'Delayed') {
                status = 'delayed';
                departureDelay = -1; // Unknown delay amount
            } else if (service.etd !== 'On time' && service.etd !== depTime) {
                // Calculate delay from etd
                const [etdHours, etdMins] = (service.etd || depTime).split(':').map(Number);
                if (!isNaN(etdHours) && !isNaN(etdMins)) {
                    const scheduledMins = depHours * 60 + depMins;
                    const actualMins = etdHours * 60 + etdMins;
                    departureDelay = Math.max(0, actualMins - scheduledMins);
                    if (departureDelay > 0) status = 'delayed';
                }
            } else {
                status = 'on-time';
            }

            return {
                id: service.serviceIdUrlSafe || `huxley-${index}`,
                serviceId: service.serviceIdUrlSafe,
                departureTime: `${date}T${depTime}:00`,
                arrivalTime: arrivalTime,
                duration: duration,
                changes: 0, // Direct service
                legs: [leg],
                status: status,
                departureDelay: departureDelay,
                arrivalDelay: 0,
                cancelled: cancelled,
                delayReason: service.delayReason || null,
                cancelReason: service.cancelReason || null
            };
        });

        return Promise.all(journeyPromises);
    }

    /**
     * Parse RTT time format to ISO string
     */
    function parseRttTime(time, date) {
        if (!time || !date) return null;
        const hours = time.substring(0, 2);
        const mins = time.substring(2, 4);
        return `${date}T${hours}:${mins}:00`;
    }

    /**
     * Calculate delay in minutes
     */
    function calculateDelay(booked, actual) {
        if (!booked || !actual) return 0;
        const bookedMins = parseInt(booked.substring(0, 2)) * 60 + parseInt(booked.substring(2, 4));
        const actualMins = parseInt(actual.substring(0, 2)) * 60 + parseInt(actual.substring(2, 4));
        return Math.max(0, actualMins - bookedMins);
    }

    /**
     * Calculate duration between two times
     */
    function calculateDuration(dep, arr) {
        if (!dep || !arr) return null;
        const depMins = parseInt(dep.substring(0, 2)) * 60 + parseInt(dep.substring(2, 4));
        let arrMins = parseInt(arr.substring(0, 2)) * 60 + parseInt(arr.substring(2, 4));
        if (arrMins < depMins) arrMins += 24 * 60; // Next day
        return arrMins - depMins;
    }

    /**
     * Generate mock journey data for testing
     * Based on realistic Blackpool South to Scarborough options
     */
    function generateMockJourneys(origin, destination, date, time) {
        const baseTime = parseTimeToMinutes(time);
        const journeys = [];

        // Get intermediate stations for routing
        const preston = StationData.getByCode('PRE');
        const york = StationData.getByCode('YRK');
        const leeds = StationData.getByCode('LDS');
        const manchester = StationData.getByCode('MAN');
        const hull = StationData.getByCode('HUL');
        const malton = StationData.getByCode('MLT');

        // Route 1: Via Preston & York (typical fastest)
        journeys.push({
            id: 'j1',
            departureTime: formatDateTime(date, baseTime + 15),
            arrivalTime: formatDateTime(date, baseTime + 15 + 195), // ~3h 15m
            duration: 195,
            changes: 2,
            legs: [
                {
                    origin: origin,
                    destination: preston,
                    departureTime: formatDateTime(date, baseTime + 15),
                    arrivalTime: formatDateTime(date, baseTime + 40),
                    operator: 'Northern',
                    platform: '2'
                },
                {
                    origin: preston,
                    destination: york,
                    departureTime: formatDateTime(date, baseTime + 55),
                    arrivalTime: formatDateTime(date, baseTime + 140),
                    operator: 'TransPennine Express',
                    platform: '3'
                },
                {
                    origin: york,
                    destination: destination,
                    departureTime: formatDateTime(date, baseTime + 160),
                    arrivalTime: formatDateTime(date, baseTime + 210),
                    operator: 'TransPennine Express',
                    platform: '9'
                }
            ],
            status: 'on-time'
        });

        // Route 2: Via Manchester & Leeds (alternative)
        journeys.push({
            id: 'j2',
            departureTime: formatDateTime(date, baseTime + 35),
            arrivalTime: formatDateTime(date, baseTime + 35 + 230), // ~3h 50m
            duration: 230,
            changes: 2,
            legs: [
                {
                    origin: origin,
                    destination: manchester,
                    departureTime: formatDateTime(date, baseTime + 35),
                    arrivalTime: formatDateTime(date, baseTime + 110),
                    operator: 'Northern',
                    platform: '1'
                },
                {
                    origin: manchester,
                    destination: leeds,
                    departureTime: formatDateTime(date, baseTime + 125),
                    arrivalTime: formatDateTime(date, baseTime + 185),
                    operator: 'TransPennine Express',
                    platform: '13'
                },
                {
                    origin: leeds,
                    destination: destination,
                    departureTime: formatDateTime(date, baseTime + 200),
                    arrivalTime: formatDateTime(date, baseTime + 265),
                    operator: 'TransPennine Express',
                    platform: '5'
                }
            ],
            status: 'on-time',
            departureDelay: 3
        });

        // Route 3: Via Hull (slower but fewer changes)
        if (hull && malton) {
            journeys.push({
                id: 'j3',
                departureTime: formatDateTime(date, baseTime + 60),
                arrivalTime: formatDateTime(date, baseTime + 60 + 280), // ~4h 40m
                duration: 280,
                changes: 2,
                legs: [
                    {
                        origin: origin,
                        destination: manchester,
                        departureTime: formatDateTime(date, baseTime + 60),
                        arrivalTime: formatDateTime(date, baseTime + 135),
                        operator: 'Northern',
                        platform: '1'
                    },
                    {
                        origin: manchester,
                        destination: hull,
                        departureTime: formatDateTime(date, baseTime + 150),
                        arrivalTime: formatDateTime(date, baseTime + 270),
                        operator: 'TransPennine Express',
                        platform: '14'
                    },
                    {
                        origin: hull,
                        destination: destination,
                        departureTime: formatDateTime(date, baseTime + 290),
                        arrivalTime: formatDateTime(date, baseTime + 340),
                        operator: 'Northern',
                        platform: '1'
                    }
                ],
                status: 'on-time'
            });
        }

        // Route 4: Cancelled service (to demo unavailable routes)
        journeys.push({
            id: 'j4',
            departureTime: formatDateTime(date, baseTime + 5),
            arrivalTime: formatDateTime(date, baseTime + 5 + 180),
            duration: 180,
            changes: 1,
            legs: [
                {
                    origin: origin,
                    destination: preston,
                    departureTime: formatDateTime(date, baseTime + 5),
                    arrivalTime: formatDateTime(date, baseTime + 30),
                    operator: 'Northern',
                    platform: '2'
                },
                {
                    origin: preston,
                    destination: destination,
                    departureTime: formatDateTime(date, baseTime + 45),
                    arrivalTime: formatDateTime(date, baseTime + 185),
                    operator: 'LNER',
                    platform: '1'
                }
            ],
            cancelled: true,
            unavailableReason: 'cancelled',
            status: 'cancelled'
        });

        // Route 5: Engineering works affecting route
        journeys.push({
            id: 'j5',
            departureTime: formatDateTime(date, baseTime + 90),
            arrivalTime: formatDateTime(date, baseTime + 90 + 250),
            duration: 250,
            changes: 3,
            legs: [],
            unavailableReason: 'engineering',
            status: 'unavailable'
        });

        return journeys;
    }

    /**
     * Parse time string to minutes from midnight
     */
    function parseTimeToMinutes(timeStr) {
        const [hours, mins] = timeStr.split(':').map(Number);
        return hours * 60 + mins;
    }

    /**
     * Convert minutes from midnight to HH:MM string
     */
    function minutesToTime(minutes) {
        let h = Math.floor(minutes / 60) % 24;
        let m = minutes % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    }

    /**
     * Format date and minutes to ISO datetime
     */
    function formatDateTime(date, totalMinutes) {
        // Handle day overflow
        let days = 0;
        while (totalMinutes >= 24 * 60) {
            totalMinutes -= 24 * 60;
            days++;
        }

        const hours = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;

        // Simple date addition (works for most cases)
        let d = new Date(date);
        d.setDate(d.getDate() + days);
        const dateStr = d.toISOString().split('T')[0];

        return `${dateStr}T${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00`;
    }

    /**
     * Get disruption information for a route
     */
    async function getDisruptions(origin, destination) {
        // Mock disruption data
        return [
            {
                id: 'd1',
                type: 'engineering',
                title: 'Weekend Engineering Works',
                description: 'Buses replace trains between York and Scarborough on Sundays',
                affectedRoutes: ['York to Scarborough'],
                startDate: '2026-01-25',
                endDate: '2026-01-26'
            }
        ];
    }

    /**
     * Configure API credentials
     */
    function configure(options) {
        if (options.huxleyAccessToken) config.huxley.accessToken = options.huxleyAccessToken;
        if (typeof options.useMockData === 'boolean') config.useMockData = options.useMockData;
    }

    /**
     * Check if using real API
     */
    function isUsingRealApi() {
        return !config.useMockData;
    }

    // Public API
    return {
        searchJourneys,
        getDisruptions,
        configure,
        isUsingRealApi
    };
})();

window.TrainApi = TrainApi;
