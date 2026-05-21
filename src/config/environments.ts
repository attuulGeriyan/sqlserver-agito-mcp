import v8 from "msnodesqlv8";

export interface EnvironmentConfig {
  name: string;
  server: string;
  authentication: "windows" | "sql";
  readonly?: boolean;
  username?: string;
  password?: string;
}

const SYSTEM_DATABASES = new Set(["master", "tempdb", "model", "msdb"]);

// Server host is read from SQLSERVER_HOST at startup. Required — no default.
// Examples: "(localdb)\\MSSQLLocalDB", "(localdb)\\SQLLocalEXP01", "localhost",
// "localhost\\SQLEXPRESS", "tcp:my-server.company.com,1433".
const localServer = process.env.SQLSERVER_HOST?.trim();
if (!localServer) {
  throw new Error(
    "SQLSERVER_HOST environment variable is not set. " +
      "Add it to your .mcp.json `env` block, e.g. " +
      '`"env": { "SQLSERVER_HOST": "(localdb)\\\\MSSQLLocalDB" }`. ' +
      "See README and .env.example for more examples."
  );
}

// Databases are discovered dynamically from sys.databases at startup (and on demand).
// To add an environment, register it here; databases auto-populate from the server.
export const environments: Record<string, EnvironmentConfig> = {
  LOCAL: {
    name: "LOCAL",
    server: localServer,
    authentication: "windows",
  },
};

// Cache of discovered databases per environment (UPPERCASE env name -> db names).
const databaseCache = new Map<string, string[]>();

const buildMasterConnectionString = (env: EnvironmentConfig): string => {
  if (env.authentication === "windows") {
    return `Driver={ODBC Driver 17 for SQL Server};Server=${env.server};Database=master;Trusted_Connection=Yes;`;
  }
  if (!env.username || !env.password) {
    throw new Error(`SQL authentication requires username and password for environment '${env.name}'`);
  }
  return `Driver={ODBC Driver 17 for SQL Server};Server=${env.server};Database=master;UID=${env.username};PWD=${env.password};`;
};

const runMasterQuery = (connStr: string, sql: string): Promise<any[]> =>
  new Promise((resolve, reject) => {
    v8.query(connStr, sql, (err, rows) => (err ? reject(err) : resolve(rows || [])));
  });

export const getEnvironment = (envName: string): EnvironmentConfig => {
  const env = environments[envName.toUpperCase()];
  if (!env) {
    throw new Error(
      `Environment '${envName}' not found. Available: ${Object.keys(environments).join(", ")}`
    );
  }
  return env;
};

// Query sys.databases and cache the result. Filters out system databases.
export const discoverDatabases = async (envName: string = "LOCAL"): Promise<string[]> => {
  const env = getEnvironment(envName);
  const conn = buildMasterConnectionString(env);
  const rows = await runMasterQuery(
    conn,
    "SELECT name FROM sys.databases WHERE state_desc = 'ONLINE' ORDER BY name"
  );
  const names = rows
    .map((r: any) => String(r.name))
    .filter((n) => !SYSTEM_DATABASES.has(n.toLowerCase()));
  databaseCache.set(envName.toUpperCase(), names);
  return names;
};

export const refreshDatabases = (envName: string = "LOCAL"): Promise<string[]> =>
  discoverDatabases(envName);

export const getDatabases = (envName: string = "LOCAL"): string[] => {
  return databaseCache.get(envName.toUpperCase()) ?? [];
};

export const isDatabaseAvailable = (envName: string, database: string): boolean => {
  const dbs = getDatabases(envName);
  return dbs.some((d) => d.toLowerCase() === database.toLowerCase());
};

// Resolve a user-supplied database name to its canonical (server-side) casing.
// Returns the original input if no match is found.
export const canonicalDatabaseName = (envName: string, database: string): string => {
  const dbs = getDatabases(envName);
  const match = dbs.find((d) => d.toLowerCase() === database.toLowerCase());
  return match ?? database;
};

export const getAllDatabases = (): string[] => {
  const set = new Set<string>();
  for (const env of Object.keys(environments)) {
    for (const db of getDatabases(env)) set.add(db);
  }
  return Array.from(set).sort();
};
