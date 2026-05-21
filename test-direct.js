import v8 from "msnodesqlv8";

const server = process.env.SQLSERVER_HOST || process.argv[2];
const database = process.env.SQLSERVER_DATABASE || process.argv[3] || "master";
if (!server) {
  console.error("Usage: SQLSERVER_HOST=<server> node test-direct.js [database]");
  console.error("   or: node test-direct.js <server> [database]");
  process.exit(1);
}
const connectionString = `Driver={ODBC Driver 17 for SQL Server};Server=${server};Database=${database};Trusted_Connection=Yes;`;

console.log("Testing direct msnodesqlv8 connection...");
console.log("Connection string:", connectionString);

v8.open(connectionString, (err, conn) => {
    if (err) {
        console.error("✗ Connection failed:");
        console.error(err);
        return;
    }

    console.log("✓ Connected successfully!");

    conn.query("SELECT @@VERSION AS version, DB_NAME() AS [database]", (err, results) => {
        if (err) {
            console.error("✗ Query failed:");
            console.error(err);
            return;
        }

        console.log("\nServer info:");
        console.log(JSON.stringify(results, null, 2));

        conn.close(() => {
            console.log("\n✓ Connection closed");
        });
    });
});
