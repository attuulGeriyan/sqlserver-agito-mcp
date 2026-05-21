import v8 from "msnodesqlv8";

const connectionString = "Driver={ODBC Driver 17 for SQL Server};Server=(localdb)\\SQLLocalEXP01;Database=TestRobot;Trusted_Connection=Yes;";

console.log("Testing direct msnodesqlv8 connection...");
console.log("Connection string:", connectionString);

v8.open(connectionString, (err, conn) => {
    if (err) {
        console.error("✗ Connection failed:");
        console.error(err);
        return;
    }

    console.log("✓ Connected successfully!");

    conn.query("SELECT TOP 5 * FROM LoadCarriers", (err, results) => {
        if (err) {
            console.error("✗ Query failed:");
            console.error(err);
            return;
        }

        console.log("\nSample data from LoadCarriers:");
        console.log(JSON.stringify(results, null, 2));

        conn.close(() => {
            console.log("\n✓ Connection closed");
        });
    });
});
