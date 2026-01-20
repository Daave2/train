const fs = require('fs');
const path = require('path');

const inputFile = '/Users/nikicooke/Travel/routeing_guide/RJRG0939RGD.txt';
const outputFile = '/Users/nikicooke/Travel/js/data/stationGraph.json';

// Ensure output directory exists
const outputDir = path.dirname(outputFile);
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

try {
    const data = fs.readFileSync(inputFile, 'utf8');
    const lines = data.split('\n');
    const graph = {};

    console.log(`Processing ${lines.length} lines...`);

    let count = 0;
    for (const line of lines) {
        if (line.startsWith('/')) continue; // Skip comments/headers
        if (!line.trim()) continue;

        const parts = line.split(',');
        if (parts.length >= 3) {
            const origin = parts[0].trim();
            const dest = parts[1].trim();
            const distance = parseFloat(parts[2].trim());

            if (!graph[origin]) graph[origin] = {};
            // Store distance (miles/chains - used as weight)
            graph[origin][dest] = distance;

            // It's usually undirected, but let's check if the file has both directions.
            // Looking at the file, BAA->BOG exists. Let's see if BOG->BAA exists.
            // We'll trust the file is explicit.

            count++;
        }
    }

    fs.writeFileSync(outputFile, JSON.stringify(graph, null, 0)); // Minified
    console.log(`Graph saved to ${outputFile}`);
    console.log(`Processed ${count} links for ${Object.keys(graph).length} stations.`);

} catch (err) {
    console.error('Error processing file:', err);
}
