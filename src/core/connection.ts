import { getEnvironment, type EnvironmentConfig } from "../config/environments.js";

// Generate connection string for a specific database
export const getConnectionString = (database: string, environment: string = "LOCAL"): string => {
  const env = getEnvironment(environment);

  // Check if database is available in this environment
  if (!env.databases.includes(database)) {
    throw new Error(
      `Database '${database}' is not available in environment '${environment}'. ` +
      `Available databases: ${env.databases.join(", ")}`
    );
  }

  // Build connection string based on authentication type
  if (env.authentication === "windows") {
    return `Driver={ODBC Driver 17 for SQL Server};Server=${env.server};Database=${database};Trusted_Connection=Yes;`;
  } else {
    // SQL authentication
    if (!env.username || !env.password) {
      throw new Error(`SQL authentication requires username and password for environment '${environment}'`);
    }
    return `Driver={ODBC Driver 17 for SQL Server};Server=${env.server};Database=${database};UID=${env.username};PWD=${env.password};`;
  }
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
