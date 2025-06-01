const express = require('express');
const duckdb = require('duckdb');
const fs = require('fs');
const path = require('path');
require('dotenv').config(); // Load environment variables from .env file

const app = express();
const port = process.env.SERVPORT || 3000; // Use SERVPORT from .env or default to 3000

const db = new duckdb.Database('jp_gari.duckdb'); // Use a persistent database file

// Serve static files from the 'public' directory
app.use(express.static('public'));

// API endpoint to get all data
app.get('/api/jp_gari', async (req, res) => {
    const conn = db.connect();
    try {
        // Load spatial extension
        await conn.run("INSTALL spatial;");
        await conn.run("LOAD spatial;");

        // Query data and convert WKB to GeoJSON using DuckDB's spatial functions
        const rows = await conn.all(`
            SELECT
                id,
                ST_AsGeoJSON(geom) as geom_geojson,
                tradename
            FROM jp_gari
        `);

        const geojsonFeatures = rows.map(row => {
            return {
                type: "Feature",
                geometry: JSON.parse(row.geom_geojson), // Parse the GeoJSON string
                properties: {
                    id: row.id,
                    tradename: row.tradename
                }
            };
        });
        res.json({
            type: "FeatureCollection",
            features: geojsonFeatures
        });
    } catch (error) {
        console.error("Error querying DuckDB:", error);
        res.status(500).json({ error: "Internal server error" });
    } finally {
        conn.close();
    }
});

app.listen(port, () => {
    console.log(`DuckDB2Web server listening at http://localhost:${port}`);
});
