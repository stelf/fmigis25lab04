const duckdb = require('duckdb');
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config(); // Load environment variables from .env file

async function importPgToDuckDB() {
    const pgConfig = {
        user: process.env.PGUSER,
        host: process.env.PGHOST,
        database: process.env.PGDATABASE,
        password: process.env.PGPASSWORD,
        port: parseInt(process.env.PGPORT, 10),
        ssl: {
            rejectUnauthorized: false // Required for some PostgreSQL setups, especially cloud-hosted
        }
    };

    const pgClient = new Client(pgConfig);
    let duckdbConn;
    let duckdbDb;

    try {
        await pgClient.connect();
        console.log("Connected to PostgreSQL.");

        // Initialize DuckDB with a persistent database file
        const duckdbFilePath = path.join(__dirname, 'jp_gari.duckdb');
        duckdbDb = new duckdb.Database(duckdbFilePath);
        duckdbConn = duckdbDb.connect();
        console.log(`DuckDB database created/opened at ${duckdbFilePath}`);

        // Install and load spatial extension
        await duckdbConn.run("INSTALL spatial;");
        await duckdbConn.run("LOAD spatial;");
        console.log("DuckDB spatial extension installed and loaded.");

        // Fetch data from PostgreSQL
        console.log("Fetching data from PostgreSQL 'jp_gari' table...");
        const res = await pgClient.query('SELECT id, ST_AsBinary(geom) as geom_wkb, tradename, "2016_prist", "2016_zamin", "2019_zamin", "2019_prist" FROM public.jp_gari');
        const rows = res.rows;
        console.log(`Fetched ${rows.length} rows from PostgreSQL.`);

        // Check if the table already exists in the DuckDB file
        const tableExists = await duckdbConn.all("SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'jp_gari'");
        if (tableExists[0]['count_star()'] > 0) {
            console.log("Table 'jp_gari' already exists in DuckDB. Skipping data import.");
        } else {
            // Create table and insert data in one go
            console.log("Creating table 'jp_gari' and importing data into DuckDB...");
            await duckdbConn.run(`
                CREATE TABLE jp_gari AS SELECT
                    id,
                    geom_wkb AS geom, -- Rename geom_wkb to geom
                    tradename,
                    "2016_prist",
                    "2016_zamin",
                    "2019_zamin",
                    "2019_prist"
                FROM (SELECT * FROM res.rows);
            `);
            console.log("Data successfully imported into DuckDB.");
        }

    } catch (err) {
        console.error("Error during import process:", err);
    } finally {
        if (pgClient) {
            await pgClient.end();
            console.log("Disconnected from PostgreSQL.");
        }
        if (duckdbConn) {
            duckdbConn.close();
        }
        if (duckdbDb) {
            duckdbDb.close();
        }
    }
}

importPgToDuckDB();
