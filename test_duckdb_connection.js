const { DuckDBInstance } = require('@duckdb/node-api');
const path = require('path');

async function testDuckDBConnection() {
    let dbInst = null;
    let duckConn = null;

    try {
        const dbPath = path.join(__dirname, 'test.duckdb'); // Use a temporary test database
        dbInst = await DuckDBInstance.create(dbPath);
        console.log("DuckDBInstance created.");

        duckConn = await dbInst.connect();
        console.log("DuckDB Connection obtained.");

        // Perform a simple query to ensure connection is active
        const result = await duckConn.run("SELECT 42 as answer;");
        console.log("Query result:", result);

    } catch (err) {
        console.error("Error during test:", err);
    } finally {
        try {
            if (duckConn) {
                duckConn.closeSync();
                console.log("DuckDB Connection closed.");
            }
            if (dbInst) {
                dbInst.closeSync();
                console.log("DuckDB Instance closed.");
            }
        } catch (closeErr) {
            console.error("Error during closing:", closeErr);
        }
    }
}

testDuckDBConnection();
