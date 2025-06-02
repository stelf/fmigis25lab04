const { getDuckDbConn } = require('./analysis');
require('dotenv').config();

function getPgAttachString() {
    const pgHost = process.env.PGHOST;
    const pgPort = process.env.PGPORT;
    const pgDatabase = process.env.PGDATABASE;
    const pgUser = process.env.PGUSER;
    const pgPassword = process.env.PGPASSWORD;

    return `ATTACH 'host=${pgHost} port=${pgPort} dbname=${pgDatabase} user=${pgUser} password=${pgPassword}' AS postgres_db (TYPE POSTGRES)`;
}

async function importPgToDuckDB() {
    let duckConn = null;

    try {
        duckConn = await getDuckDbConn();

        console.log(`DuckDB database opened.`);

        await duckConn.run("INSTALL spatial;");
        await duckConn.run("LOAD spatial;");
        console.log("DuckDB spatial extension installed and loaded.");

        await duckConn.run("INSTALL postgres;");
        await duckConn.run("LOAD postgres;");
        console.log("DuckDB postgres extension installed and loaded.");

        const attachString = getPgAttachString();
        await duckConn.run(attachString);
        console.log("Attached PostgreSQL database as 'postgres_db'.");

        console.log("Importing data from PostgreSQL 'jp_gari' table into DuckDB...");
        await duckConn.run(`
            CREATE OR REPLACE TABLE jp_gari AS
            SELECT
                id,
                st_centroid(ST_GeomFromWKB(geom)) as geom,
                tradename,
                "2016_prist",
                "2016_zamin",
                "2019_zamin",
                "2019_prist",
                st_centroid(ST_GeomFromWKB(geom_wgs84)) as geom_wgs84
            FROM postgres_db.jp_gari;
        `);
        console.log("Data successfully imported into DuckDB from PostgreSQL.");

    } catch (err) {
        console.error("Error during import process:", err);
    } finally {
        try {
            if (duckConn) {
                duckConn.closeSync();
                console.log("DuckDB Connection closed.");
            }
        } catch (closeErr) {
            console.error("Error during connection closing:", closeErr);
        }
    }
}

importPgToDuckDB();
