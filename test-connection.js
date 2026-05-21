import msnodesqlv8 from "mssql/msnodesqlv8.js";

const server = process.env.SQLSERVER_HOST || process.argv[2];
const database = process.env.SQLSERVER_DATABASE || process.argv[3] || "master";
if (!server) {
  console.error("Usage: SQLSERVER_HOST=<server> node test-connection.js [database]");
  console.error("   or: node test-connection.js <server> [database]");
  process.exit(1);
}
const connectionString = `Driver={ODBC Driver 17 for SQL Server};Server=${server};Database=${database};Trusted_Connection=Yes;`;

console.log("Testing connection to LocalDB...");
console.log("Connection string:", connectionString);

try {
  const pool = await msnodesqlv8.connect(connectionString);
  console.log("✓ Connected successfully!");

  const result = await pool.request().query("SELECT @@VERSION AS version, DB_NAME() AS [database]");
  console.log("\nServer info:");
  console.log(JSON.stringify(result.recordset, null, 2));

  await pool.close();
  console.log("\n✓ Connection closed");
} catch (err) {
  console.error("✗ Connection failed:");
  console.error(err);
  if (err.message.includes("Driver")) {
    console.log("\nTrying alternative driver: SQL Server Native Client 11.0");
    const altConnectionString = `server=${server};Database=${database};Trusted_Connection=Yes;Driver={SQL Server Native Client 11.0}`;
    try {
      const pool = await msnodesqlv8.connect(altConnectionString);
      console.log("✓ Connected with alternative driver!");
      await pool.close();
      console.log("You should update index.ts to use this connection string instead.");
    } catch (err2) {
      console.error("✗ Alternative driver also failed:", err2.message);
    }
  }
}
