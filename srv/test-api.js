const fetch = require('node-fetch');
const { spawn } = require('child_process');
const waitOn = require('wait-on');

const BASE_URL = 'http://localhost:8686'; // Ensure this matches your server's port
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 1000; // 1 second

async function retryFetch(url, options, retries = MAX_RETRIES) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);
            if (response.ok) {
                return response;
            }
            console.warn(`Attempt ${i + 1} failed for ${url}: HTTP status ${response.status}. Retrying...`);
        } catch (error) {
            console.warn(`Attempt ${i + 1} failed for ${url}: ${error.message}. Retrying...`);
        }
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
    }
    throw new Error(`Failed to fetch ${url} after ${retries} attempts.`);
}

async function runApiTests() {
    let serverProcess = null;
    try {
        console.log('--- Starting API Test Scenario ---');

        // Start the DuckDB server as a child process
        console.log('Starting DuckDB server...');
        serverProcess = spawn('node', ['srv/duckdb2web.js'], { stdio: 'inherit' });

        // Wait for the server to be ready
        console.log(`Waiting for server at ${BASE_URL}...`);
        await waitOn({ resources: [BASE_URL], timeout: 30000 }); // 30 seconds timeout
        console.log('Server is ready.');

        // Test /api/jp_gari with retry logic
        console.log('1. Calling /api/jp_gari...');
        const jpGariResponse = await retryFetch(`${BASE_URL}/api/jp_gari`);
        const jpGariData = await jpGariResponse.json();
        console.log(`   /api/jp_gari successful. Received ${jpGariData.features.length} features.`);

        // Test /api/isoline
        console.log('2. Calling /api/isoline...');
        const isolineUrl = `${BASE_URL}/api/isoline?lat=42.712813616999895&lon=23.291268088&mode=drive&range=300`;
        const isolineResponse = await fetch(isolineUrl); // No retry for this one unless specified
        if (!isolineResponse.ok) {
            throw new Error(`HTTP error! status: ${isolineResponse.status} from /api/isoline`);
        }
        const isolineData = await isolineResponse.json();
        console.log('   /api/isoline successful. Response data:', isolineData);

        console.log('--- All API tests passed! ---');
        process.exit(0); // Indicate success
    } catch (error) {
        console.error('--- API Test Failed! ---');
        console.error('Error:', error.message);
        process.exit(1); // Indicate failure
    } finally {
        if (serverProcess) {
            console.log('Terminating DuckDB server...');
            serverProcess.kill();
        }
    }
}

runApiTests();
