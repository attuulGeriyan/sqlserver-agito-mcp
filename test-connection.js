import msnodesqlv8 from "mssql/msnodesqlv8.js";

const connectionString = "Driver={ODBC Driver 17 for SQL Server};Server=(localdb)\\SQLLocalEXP01;Database=TestRobot;Trusted_Connection=Yes;";

console.log("Testing connection to LocalDB...");
console.log("Connection string:", connectionString);

try {
  const pool = await msnodesqlv8.connect(connectionString);
  console.log("✓ Connected successfully!");

  const result = await pool.request().query("SELECT TOP 5 * FROM LoadCarriers");
  console.log("\nSample data from LoadCarriers:");
  console.log(JSON.stringify(result.recordset, null, 2));

  await pool.close();
  console.log("\n✓ Connection closed");
} catch (err) {
  console.error("✗ Connection failed:");
  console.error(err);
  if (err.message.includes("Driver")) {
    console.log("\nTrying alternative driver: SQL Server Native Client 11.0");
    const altConnectionString = "server=(localdb)\\SQLLocalEXP01;Database=TestRobot;Trusted_Connection=Yes;Driver={SQL Server Native Client 11.0}";
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
