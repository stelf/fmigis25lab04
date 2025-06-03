require('dotenv').config();

const express = require('express');
const morgan = require('morgan'); 
const { getDuckDBData, getIsolineData } = require('./analysis');

const app = express();
const port = process.env.SERVPORT;
const apiKey = process.env.GEOAPIFY_API_KEY; // Get Geoapify API key

if (!apiKey) {
    console.error("Error: GEOAPIFY_API_KEY environment variable not set.");
    process.exit(1);
}

app.use(morgan('dev')); 
app.use(express.static('public'));

app.get('/api/jp_gari', async (req, res) => {
    try {
        const geoJSON = await getDuckDBData();
        res.json(geoJSON);
    } catch (err) {
        console.error("Error querying DuckDB:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// пресмята изолиниите 
app.get('/api/isoline', async (req, res) => {
    try {
        const { lat, lon, mode, range } = req.query;
        const data = await getIsolineData(lat, lon, mode, range, apiKey);
        res.json(data);
    } catch (error) {
        console.error(`Error fetching isoline data from Geoapify: ${error.message}`);
        res.status(500).json({ error: `Failed to fetch isoline data: ${error.message}` });
    }
});

app.listen(port, () => {
    console.log(`DuckDB2Web server listening at http://localhost:${port}`);
});
