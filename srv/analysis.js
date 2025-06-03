const { Pool } = require('pg');
const { DuckDBInstance } = require('@duckdb/node-api');
const fetch = require('node-fetch');
const { URLSearchParams } = require('url');
const path = require('path');

// Function to get PostgreSQL connection pool
function getPgPool() {
    const dbConfig = {
        user: process.env.PGUSER,
        host: process.env.PGHOST,
        database: process.env.PGDATABASE,
        password: process.env.PGPASSWORD,
        port: process.env.PGPORT,
        client_encoding: process.env.PGCLIENTENCODING,
        ssl: { rejectUnauthorized: false }
    };
    return new Pool(dbConfig);
}

let duckDbInst;
async function getDuckDbConn() {
    if (!duckDbInst) {
        duckDbInst = await DuckDBInstance.create(
            path.join(__dirname, process.env.DUCKDB_FILE)
        );
    }
    return await duckDbInst.connect();
}

async function getIsolineData(lat, lon, mode, range, apiKey) {
    if (!apiKey) {
        throw new Error("GEOAPIFY_API_KEY environment variable not set.");
    }

    if (!lat || !lon || !mode || !range) {
        throw new Error("Missing required parameters (lat, lon, mode, range)");
    }

    if (Array.isArray(range)) { range = range.join(','); }

    const baseUrl = 'https://api.geoapify.com/v1/isoline';
    const params = new URLSearchParams({
        lat, lon, mode,
        type: 'time',
        range: range,
        apiKey
    });
    const geoapifyUrl = `${baseUrl}?${params.toString()}`;

    const response = await fetch(geoapifyUrl);
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Geoapify API error: ${response.status} - ${errorText}`);
    }

    return await response.json();
}

async function getPostGISData() {
    const pool = getPgPool();
    let conn;
    try {
        conn = await pool.connect();
        const resDb = await conn.query(`
            SELECT ST_AsGeoJSON(
                        ST_Transform(geom, 4326)) as geojson,
                        tradename
            FROM public.jp_gari`);
        return {
            type: 'FeatureCollection',
            features: resDb.rows.map(row => ({
                type: 'Feature',
                geometry: JSON.parse(row.geojson),
                properties: { tradename: row.tradename || 'Unknown' }
            }))
        };
    } finally {
        if (conn) {
            conn.release();
        }
    }
}

async function getDuckDBData() {
    let conn;
    try {
        conn = await getDuckDbConn();
        await conn.run("LOAD spatial;");
        await conn.run("LOAD json;");

        const reader = await conn.stream(`
            SELECT
                json_object(
                    'type', 'Feature',
                    'geometry',  ST_AsGeoJSON( geom_wgs84 ),
                    'properties', json_object(
                        'id', id,
                        'tradename', tradename,
                        '2016_prist', "2016_prist",
                        '2016_zamin', "2016_zamin",
                        '2019_zamin', "2019_zamin",
                        '2019_prist', "2019_prist"
                    )
                ) AS feature_json
            FROM jp_gari
        `);

        const rows = await reader.getRowObjectsJson();
        const features = rows.map(row => JSON.parse(row.feature_json));

        return {
            type: "FeatureCollection",
            features: features
        };
    } finally {
        if (conn) {
            conn.closeSync();
        }
    }
}

module.exports = {
    getIsolineData,
    getPostGISData,
    getDuckDBData,
    getDuckDbConn
};
