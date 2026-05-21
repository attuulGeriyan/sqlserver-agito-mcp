import {
  canonicalDatabaseName,
  getDatabases,
  getEnvironment,
  isDatabaseAvailable,
} from "../config/environments.js";

// Generate connection string for a specific database
export const getConnectionString = (database: string, environment: string = "LOCAL"): string => {
  const env = getEnvironment(environment);

  // Validate against the dynamically-discovered database list
  if (!isDatabaseAvailable(environment, database)) {
    const available = getDatabases(environment);
    const hint = available.length
      ? `Available databases: ${available.join(", ")}`
      : `No databases discovered yet for '${environment}' — server discovery may have failed.`;
    throw new Error(`Database '${database}' is not available in environment '${environment}'. ${hint}`);
  }

  const canonical = canonicalDatabaseName(environment, database);

  if (env.authentication === "windows") {
    return `Driver={ODBC Driver 17 for SQL Server};Server=${env.server};Database=${canonical};Trusted_Connection=Yes;`;
  }
  if (!env.username || !env.password) {
    throw new Error(`SQL authentication requires username and password for environment '${environment}'`);
  }
  return `Driver={ODBC Driver 17 for SQL Server};Server=${env.server};Database=${canonical};UID=${env.username};PWD=${env.password};`;
};

// Get connection string for multi-environment operations
export const getMultiEnvConnectionStrings = (
  database: string,
  environmentNames: string[]
): Map<string, string> => {
  const connectionStrings = new Map<string, string>();

  for (const envName of environmentNames) {
    const connString = getConnectionString(database, envName);
    connectionStrings.set(envName, connString);
  }

  return connectionStrings;
};

// Check if environment is readonly
export const isEnvironmentReadonly = (environment: string): boolean => {
  const env = getEnvironment(environment);
  return env.readonly === true;
};
