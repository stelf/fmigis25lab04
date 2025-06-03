require('dotenv').config();

const express = require('express');
const morgan = require('morgan'); 
const { getIsolineData, getPostGISData } = require('./analysis');

const app = express();
const port = process.env.SERVPORT;
const apiKey = process.env.GEOAPIFY_API_KEY; // Get Geoapify API key

if (!apiKey) {
    console.error("Error: GEOAPIFY_API_KEY environment variable not set.");
    process.exit(1);
}

app.use(morgan('dev')); 
app.use(express.static('public'));

// Крайна точка за получаване на пространствени данни като GeoJSON
app.get('/api/jp_gari', async (req, res) => {
    try {
        const geoJSON = await getPostGISData();
        res.json(geoJSON);
    } catch (err) {
        console.error(err);
        res.status(500).send(`Error fetching data from database. \n\n ${err}`);
    }
});

// index.html се подава винаги на основния URL адрес
app.get('/', (req, res) => {
    res.sendFile(path.join(pubDir, 'index.html'));
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
    console.log(`Server is running on port ${port}`);
});
