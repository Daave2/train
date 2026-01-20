/**
 * UK Railway Stations Database
 * Curated subset of NaPTAN data for common stations
 * Includes station name, CRS code, and coordinates
 */

const UK_STATIONS = [
    // Major Terminals & Hubs
    { name: "London Kings Cross", code: "KGX", lat: 51.5308, lng: -0.1238 },
    { name: "London St Pancras International", code: "STP", lat: 51.5313, lng: -0.1262 },
    { name: "London Euston", code: "EUS", lat: 51.5282, lng: -0.1337 },
    { name: "London Paddington", code: "PAD", lat: 51.5154, lng: -0.1755 },
    { name: "London Victoria", code: "VIC", lat: 51.4952, lng: -0.1439 },
    { name: "London Waterloo", code: "WAT", lat: 51.5031, lng: -0.1132 },
    { name: "London Liverpool Street", code: "LST", lat: 51.5178, lng: -0.0823 },
    { name: "London Marylebone", code: "MYB", lat: 51.5225, lng: -0.1631 },
    { name: "London Charing Cross", code: "CHX", lat: 51.5074, lng: -0.1227 },
    { name: "London Bridge", code: "LBG", lat: 51.5052, lng: -0.0864 },
    
    // User's Route - Blackpool to Scarborough Area
    { name: "Blackpool South", code: "BPS", lat: 53.7994, lng: -3.0445 },
    { name: "Blackpool North", code: "BPN", lat: 53.8210, lng: -3.0494 },
    { name: "Blackpool Pleasure Beach", code: "BPB", lat: 53.7878, lng: -3.0556 },
    { name: "Scarborough", code: "SCA", lat: 54.2795, lng: -0.4070 },
    { name: "Filey", code: "FIL", lat: 54.2123, lng: -0.2927 },
    { name: "Seamer", code: "SEM", lat: 54.2538, lng: -0.4474 },
    
    // Yorkshire
    { name: "York", code: "YRK", lat: 53.9579, lng: -1.0926 },
    { name: "Leeds", code: "LDS", lat: 53.7950, lng: -1.5474 },
    { name: "Sheffield", code: "SHF", lat: 53.3780, lng: -1.4623 },
    { name: "Hull", code: "HUL", lat: 53.7445, lng: -0.3464 },
    { name: "Doncaster", code: "DON", lat: 53.5185, lng: -1.1392 },
    { name: "Bradford Interchange", code: "BDI", lat: 53.7909, lng: -1.7536 },
    { name: "Bradford Forster Square", code: "BDQ", lat: 53.7966, lng: -1.7535 },
    { name: "Huddersfield", code: "HUD", lat: 53.6485, lng: -1.7854 },
    { name: "Wakefield Westgate", code: "WKF", lat: 53.6817, lng: -1.5058 },
    { name: "Harrogate", code: "HGT", lat: 53.9935, lng: -1.5371 },
    { name: "Skipton", code: "SKI", lat: 53.9573, lng: -2.0235 },
    { name: "Keighley", code: "KEI", lat: 53.8677, lng: -1.9056 },
    { name: "Malton", code: "MLT", lat: 54.1361, lng: -0.7949 },
    
    // Lancashire
    { name: "Preston", code: "PRE", lat: 53.7569, lng: -2.7083 },
    { name: "Lancaster", code: "LAN", lat: 54.0484, lng: -2.8076 },
    { name: "Blackburn", code: "BBN", lat: 53.7469, lng: -2.4823 },
    { name: "Burnley Manchester Road", code: "BYM", lat: 53.7884, lng: -2.2431 },
    { name: "Bolton", code: "BON", lat: 53.5828, lng: -2.4286 },
    { name: "Wigan North Western", code: "WGN", lat: 53.5446, lng: -2.6340 },
    { name: "Wigan Wallgate", code: "WGW", lat: 53.5442, lng: -2.6373 },
    { name: "St Annes-on-the-Sea", code: "SAS", lat: 53.7505, lng: -3.0300 },
    { name: "Lytham", code: "LTM", lat: 53.7385, lng: -2.9704 },
    { name: "Kirkham & Wesham", code: "KKM", lat: 53.7875, lng: -2.8722 },
    { name: "Poulton-le-Fylde", code: "PFY", lat: 53.8477, lng: -2.9936 },
    
    // Manchester Area
    { name: "Manchester Piccadilly", code: "MAN", lat: 53.4771, lng: -2.2310 },
    { name: "Manchester Victoria", code: "MCV", lat: 53.4878, lng: -2.2418 },
    { name: "Manchester Oxford Road", code: "MCO", lat: 53.4739, lng: -2.2419 },
    { name: "Manchester Airport", code: "MIA", lat: 53.3652, lng: -2.2726 },
    { name: "Stockport", code: "SPT", lat: 53.4053, lng: -2.1632 },
    { name: "Salford Central", code: "SFD", lat: 53.4831, lng: -2.2555 },
    { name: "Salford Crescent", code: "SLD", lat: 53.4869, lng: -2.2757 },
    
    // Liverpool Area
    { name: "Liverpool Lime Street", code: "LIV", lat: 53.4073, lng: -2.9778 },
    { name: "Liverpool Central", code: "LVC", lat: 53.4048, lng: -2.9791 },
    { name: "Liverpool South Parkway", code: "LPY", lat: 53.3569, lng: -2.8886 },
    
    // North East
    { name: "Newcastle", code: "NCL", lat: 54.9686, lng: -1.6174 },
    { name: "Sunderland", code: "SUN", lat: 54.9053, lng: -1.3822 },
    { name: "Durham", code: "DHM", lat: 54.7797, lng: -1.5815 },
    { name: "Darlington", code: "DAR", lat: 54.5203, lng: -1.5487 },
    { name: "Middlesbrough", code: "MBR", lat: 54.5792, lng: -1.2341 },
    { name: "Northallerton", code: "NTR", lat: 54.3391, lng: -1.4386 },
    { name: "Thirsk", code: "THI", lat: 54.2324, lng: -1.3437 },
    
    // Midlands
    { name: "Birmingham New Street", code: "BHM", lat: 52.4778, lng: -1.8998 },
    { name: "Birmingham Moor Street", code: "BMO", lat: 52.4794, lng: -1.8927 },
    { name: "Nottingham", code: "NOT", lat: 52.9471, lng: -1.1463 },
    { name: "Derby", code: "DBY", lat: 52.9165, lng: -1.4637 },
    { name: "Leicester", code: "LEI", lat: 52.6316, lng: -1.1252 },
    { name: "Coventry", code: "COV", lat: 52.4008, lng: -1.5145 },
    { name: "Wolverhampton", code: "WVH", lat: 52.5886, lng: -2.1196 },
    { name: "Crewe", code: "CRE", lat: 53.0877, lng: -2.4316 },
    { name: "Stoke-on-Trent", code: "SOT", lat: 53.0069, lng: -2.1804 },
    { name: "Stafford", code: "STA", lat: 52.8036, lng: -2.1213 },
    { name: "Peterborough", code: "PBO", lat: 52.5749, lng: -0.2500 },
    { name: "Lincoln Central", code: "LCN", lat: 53.2264, lng: -0.5398 },
    
    // Scotland
    { name: "Edinburgh Waverley", code: "EDB", lat: 55.9521, lng: -3.1896 },
    { name: "Edinburgh Haymarket", code: "HYM", lat: 55.9457, lng: -3.2175 },
    { name: "Glasgow Central", code: "GLC", lat: 55.8596, lng: -4.2583 },
    { name: "Glasgow Queen Street", code: "GLQ", lat: 55.8622, lng: -4.2514 },
    { name: "Aberdeen", code: "ABD", lat: 57.1437, lng: -2.0977 },
    { name: "Dundee", code: "DEE", lat: 56.4570, lng: -2.9722 },
    { name: "Inverness", code: "INV", lat: 57.4801, lng: -4.2216 },
    { name: "Stirling", code: "STG", lat: 56.1197, lng: -3.9359 },
    { name: "Perth", code: "PER", lat: 56.3920, lng: -3.4398 },
    { name: "Berwick-upon-Tweed", code: "BWK", lat: 55.7749, lng: -2.0103 },
    
    // Wales
    { name: "Cardiff Central", code: "CDF", lat: 51.4759, lng: -3.1790 },
    { name: "Cardiff Queen Street", code: "CDQ", lat: 51.4828, lng: -3.1700 },
    { name: "Swansea", code: "SWA", lat: 51.6252, lng: -3.9415 },
    { name: "Newport (South Wales)", code: "NWP", lat: 51.5886, lng: -2.9987 },
    { name: "Wrexham General", code: "WRX", lat: 53.0520, lng: -2.9996 },
    { name: "Bangor (Gwynedd)", code: "BNG", lat: 53.2222, lng: -4.1337 },
    { name: "Holyhead", code: "HHD", lat: 53.3089, lng: -4.6291 },
    
    // South West
    { name: "Bristol Temple Meads", code: "BRI", lat: 51.4493, lng: -2.5810 },
    { name: "Bristol Parkway", code: "BPW", lat: 51.5136, lng: -2.5427 },
    { name: "Bath Spa", code: "BTH", lat: 51.3776, lng: -2.3575 },
    { name: "Exeter St Davids", code: "EXD", lat: 50.7282, lng: -3.5444 },
    { name: "Plymouth", code: "PLY", lat: 50.3773, lng: -4.1427 },
    { name: "Penzance", code: "PNZ", lat: 50.1216, lng: -5.5318 },
    { name: "Truro", code: "TRU", lat: 50.2603, lng: -5.0513 },
    { name: "Taunton", code: "TAU", lat: 51.0246, lng: -3.1013 },
    { name: "Swindon", code: "SWI", lat: 51.5650, lng: -1.7858 },
    { name: "Cheltenham Spa", code: "CNM", lat: 51.8963, lng: -2.0967 },
    { name: "Gloucester", code: "GCR", lat: 51.8648, lng: -2.2384 },
    
    // South East
    { name: "Brighton", code: "BTN", lat: 50.8291, lng: -0.1412 },
    { name: "Southampton Central", code: "SOU", lat: 50.9071, lng: -1.4135 },
    { name: "Portsmouth Harbour", code: "PMH", lat: 50.7973, lng: -1.1085 },
    { name: "Portsmouth & Southsea", code: "PMS", lat: 50.7986, lng: -1.0904 },
    { name: "Bournemouth", code: "BMH", lat: 50.7274, lng: -1.8643 },
    { name: "Gatwick Airport", code: "GTW", lat: 51.1564, lng: -0.1608 },
    { name: "Reading", code: "RDG", lat: 51.4586, lng: -0.9719 },
    { name: "Oxford", code: "OXF", lat: 51.7534, lng: -1.2700 },
    { name: "Cambridge", code: "CBG", lat: 52.1943, lng: 0.1379 },
    { name: "Norwich", code: "NRW", lat: 52.6273, lng: 1.3066 },
    { name: "Ipswich", code: "IPS", lat: 52.0510, lng: 1.1445 },
    { name: "Colchester", code: "COL", lat: 51.9003, lng: 0.8955 },
    { name: "Canterbury West", code: "CBW", lat: 51.2840, lng: 1.0746 },
    { name: "Dover Priory", code: "DVP", lat: 51.1266, lng: 1.3047 },
    { name: "Folkestone Central", code: "FKC", lat: 51.0855, lng: 1.1697 },
    { name: "Ashford International", code: "AFK", lat: 51.1434, lng: 0.8758 },
    
    // Cumbria / Lake District
    { name: "Carlisle", code: "CAR", lat: 54.8911, lng: -2.9343 },
    { name: "Penrith", code: "PNR", lat: 54.6609, lng: -2.7517 },
    { name: "Oxenholme Lake District", code: "OXN", lat: 54.2978, lng: -2.7231 },
    { name: "Windermere", code: "WDM", lat: 54.3796, lng: -2.9077 },
    { name: "Kendal", code: "KEN", lat: 54.3269, lng: -2.7441 },
    { name: "Barrow-in-Furness", code: "BIF", lat: 54.1167, lng: -3.2269 },
    
    // Additional useful stations
    { name: "Milton Keynes Central", code: "MKC", lat: 52.0343, lng: -0.7748 },
    { name: "Luton", code: "LUT", lat: 51.8821, lng: -0.4149 },
    { name: "Luton Airport Parkway", code: "LTN", lat: 51.8716, lng: -0.3955 },
    { name: "St Albans City", code: "SAC", lat: 51.7501, lng: -0.3268 },
    { name: "Watford Junction", code: "WFJ", lat: 51.6636, lng: -0.3967 },
    { name: "Stevenage", code: "SVG", lat: 51.9018, lng: -0.2069 },
    { name: "Hitchin", code: "HIT", lat: 51.9486, lng: -0.2617 },
    { name: "Grantham", code: "GRA", lat: 52.9062, lng: -0.6412 },
    { name: "Newark North Gate", code: "NNG", lat: 53.0779, lng: -0.7939 },
    { name: "Retford", code: "RET", lat: 53.3156, lng: -0.9467 },
    { name: "Worksop", code: "WRK", lat: 53.3028, lng: -1.1260 },
    { name: "Chesterfield", code: "CHD", lat: 53.2383, lng: -1.4225 },
    { name: "Meadowhall", code: "MHS", lat: 53.4174, lng: -1.4133 },
    { name: "Rotherham Central", code: "RMC", lat: 53.4305, lng: -1.3608 },
    { name: "Barnsley", code: "BNY", lat: 53.5556, lng: -1.4799 },
    
    // TransPennine stations
    { name: "Hebden Bridge", code: "HBD", lat: 53.7396, lng: -2.0088 },
    { name: "Todmorden", code: "TOD", lat: 53.7145, lng: -2.0958 },
    { name: "Rochdale", code: "RCD", lat: 53.6102, lng: -2.1548 },
    { name: "Dewsbury", code: "DEW", lat: 53.6907, lng: -1.6326 },
    { name: "Mirfield", code: "MIR", lat: 53.6704, lng: -1.6919 },
    { name: "Brighouse", code: "BGH", lat: 53.6971, lng: -1.7798 },
    { name: "Halifax", code: "HFX", lat: 53.7203, lng: -1.8548 },
    { name: "Sowerby Bridge", code: "SOW", lat: 53.7079, lng: -1.9078 },
    { name: "Selby", code: "SBY", lat: 53.7823, lng: -1.0653 },
    { name: "Goole", code: "GOO", lat: 53.7040, lng: -0.8699 },
    { name: "Brough", code: "BUH", lat: 53.7258, lng: -0.5731 },
    { name: "Beverley", code: "BEV", lat: 53.8393, lng: -0.4267 },
    { name: "Bridlington", code: "BDT", lat: 54.0811, lng: -0.1963 },
    { name: "Driffield", code: "DRF", lat: 54.0077, lng: -0.4330 }
];

/**
 * Fuzzy search for stations
 * Handles typos and partial matches
 */
function searchStations(query, limit = 8) {
    if (!query || query.length < 2) return [];
    
    const normalizedQuery = query.toLowerCase().trim();
    const results = [];
    
    for (const station of UK_STATIONS) {
        const name = station.name.toLowerCase();
        const code = station.code.toLowerCase();
        
        // Exact code match gets highest priority
        if (code === normalizedQuery) {
            results.push({ ...station, score: 1000 });
            continue;
        }
        
        // Name starts with query
        if (name.startsWith(normalizedQuery)) {
            results.push({ ...station, score: 100 + (100 - name.length) });
            continue;
        }
        
        // Code starts with query
        if (code.startsWith(normalizedQuery)) {
            results.push({ ...station, score: 90 });
            continue;
        }
        
        // Name contains query
        if (name.includes(normalizedQuery)) {
            const index = name.indexOf(normalizedQuery);
            results.push({ ...station, score: 50 - index });
            continue;
        }
        
        // Fuzzy match (simple Levenshtein-like for typos)
        const fuzzyScore = fuzzyMatch(normalizedQuery, name);
        if (fuzzyScore >= 0.6) {
            results.push({ ...station, score: fuzzyScore * 30 });
        }
    }
    
    // Sort by score descending and limit
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit).map(({ score, ...station }) => station);
}

/**
 * Simple fuzzy matching using bigram similarity
 */
function fuzzyMatch(str1, str2) {
    const getBigrams = (str) => {
        const bigrams = new Set();
        for (let i = 0; i < str.length - 1; i++) {
            bigrams.add(str.slice(i, i + 2));
        }
        return bigrams;
    };
    
    const bigrams1 = getBigrams(str1);
    const bigrams2 = getBigrams(str2);
    
    let matches = 0;
    for (const bigram of bigrams1) {
        if (bigrams2.has(bigram)) matches++;
    }
    
    const total = bigrams1.size + bigrams2.size;
    if (total === 0) return 0;
    
    return (2 * matches) / total;
}

/**
 * Get station by CRS code
 */
function getStationByCode(code) {
    return UK_STATIONS.find(s => s.code.toUpperCase() === code.toUpperCase());
}

/**
 * Get station by name (exact or close match)
 */
function getStationByName(name) {
    const normalized = name.toLowerCase().trim();
    return UK_STATIONS.find(s => s.name.toLowerCase() === normalized);
}

/**
 * Find nearby stations (within approximate km radius)
 */
function getNearbyStations(lat, lng, radiusKm = 20, limit = 5) {
    const results = UK_STATIONS.map(station => {
        const distance = calculateDistance(lat, lng, station.lat, station.lng);
        return { ...station, distance };
    })
    .filter(s => s.distance <= radiusKm)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);
    
    return results;
}

/**
 * Haversine formula for distance in km
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in km
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function toRad(deg) {
    return deg * (Math.PI / 180);
}

// Export for use in other modules
window.StationData = {
    stations: UK_STATIONS,
    search: searchStations,
    getByCode: getStationByCode,
    getByName: getStationByName,
    getNearby: getNearbyStations,
    distance: calculateDistance
};
