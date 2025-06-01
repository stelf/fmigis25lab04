require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const fetch = require('node-fetch'); // Import node-fetch
const { URL, URLSearchParams } = require('url');

const app = express();
const port = process.env.SERVPORT;
const apiKey = process.env.GEOAPIFY_API_KEY; // Get Geoapify API key

if (!apiKey) {
    console.error("Error: GEOAPIFY_API_KEY environment variable not set.");
    process.exit(1);
}

// Път до публичната директория
const pubDir = path.join(__dirname, 'public');

// PostgreSQL конфигурация за връзка
const db = {
    user: process.env.PGUSER,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    password: process.env.PGPASSWORD,
    port: process.env.PGPORT,
    client_encoding: process.env.PGCLIENTENCODING,
    ssl: {
        rejectUnauthorized: false
    }
};

const pool = new Pool(db);

async function initConn() {
    try {
        const conn = await pool.connect();
        console.log('Connected to the database');
        await conn.query('SHOW client_encoding');
        await conn.query('SHOW server_encoding');
        conn.release();
    } catch (err) {
        console.error('Error connecting to the database', err);
        process.exit(1);
    }
}

// Крайна точка за получаване на пространствени данни като GeoJSON
app.get('/gari', async (req, res) => {
    try {
        const conn = await pool.connect();
        const resDb = await conn.query(`
            SELECT ST_AsGeoJSON(
                        ST_Transform(geom, 4326)) as geojson, 
                        tradename 
            FROM public.jp_gari`);
        conn.release();
        const geoJSON = {
            type: 'FeatureCollection',
            features: resDb.rows.map(row => ({
                type: 'Feature',
                geometry: JSON.parse(row.geojson),
                properties: { tradename: row.tradename || 'Unknown' }
            }))
        };
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

// Обслужва подавнето на статични файлове от публичната директория
app.get('/api/isoline', async (req, res) => {
    try {
        let { lat, lon, mode, range } = req.query;

        if (!lat || !lon || !mode || !range) {
            return res.status(400).json({ 
                error: "Missing required parameters (lat, lon, mode, range)" });
        }

        if (Array.isArray(range)) { range = range.join(','); }

        const baseUrl = 'https://api.geoapify.com/v1/isoline';
        const params = new URLSearchParams({
            lat, lon, mode,
            type: 'time',
            range: range, // 'range' is now guaranteed to be a string
            apiKey
        });
        const geoapifyUrl = `${baseUrl}?${params.toString()}`;
        
        const response = await fetch(geoapifyUrl);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Geoapify API error: ${response.status} - ${errorText}`);
        }
        
        const data = await response.json();
        res.json(data);

    } catch (error) {
        console.error(`Error fetching isoline data from Geoapify: ${error.message}`);
        res.status(500).json({ error: `Failed to fetch isoline data: ${error.message}` });
    }
});

app.get('/:filename', (req, res) => {
    res.sendFile(path.join(pubDir, req.params.filename));
});

(async () => {
    await initConn();
    app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });
})();
