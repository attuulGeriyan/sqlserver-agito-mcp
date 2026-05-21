export interface EnvironmentConfig {
  name: string;
  server: string;
  databases: string[];
  authentication: 'windows' | 'sql';
  readonly?: boolean;
  username?: string;
  password?: string;
}

// Environment configurations
// Dynamic configuration - databases can be added/removed as needed
// MTMRobot and MTMCore are the source of truth (currently running on ISIT)
export const environments: Record<string, EnvironmentConfig> = {
  LOCAL: {
    name: "LOCAL",
    server: "(localdb)\\SQLLocalEXP01",
    databases: ["TestRobot", "WCSTest", "MTMCore", "MTMRobot", "MTMDHLScheduler", "MTMFives", "MTMERPTMS"],
    authentication: "windows",
  },
  // ISIT environment with well-defined schemas (source of truth)
  // Uncomment and configure when access is available
  // ISIT: {
  //   name: "ISIT",
  //   server: "isit-server.company.com",
  //   databases: ["MTMRobot", "MTMCore"],
  //   authentication: "windows",
  //   readonly: true,  // Prevent accidental modifications to ISIT
  // },
  // Placeholders for future environments
  // PreProd: {
  //   name: "PreProd",
  //   server: "preprod-server.company.com",
  //   databases: ["MTMRobot", "MTMCore"],
  //   authentication: "windows",
  //   readonly: true,
  // },
  // PROD: {
  //   name: "PROD",
  //   server: "prod-server.company.com",
  //   databases: ["MTMRobot", "MTMCore"],
  //   authentication: "windows",
  //   readonly: true,
  // },
};

// Get environment configuration by name
export const getEnvironment = (envName: string): EnvironmentConfig => {
  const env = environments[envName.toUpperCase()];
  if (!env) {
    throw new Error(`Environment '${envName}' not found. Available environments: ${Object.keys(environments).join(", ")}`);
  }
  return env;
};

// Check if database is available in environment
export const isDatabaseAvailable = (envName: string, database: string): boolean => {
  const env = getEnvironment(envName);
  return env.databases.includes(database);
};

// Get all available databases across all environments
export const getAllDatabases = (): string[] => {
  const databases = new Set<string>();
  Object.values(environments).forEach((env) => {
    env.databases.forEach((db) => databases.add(db));
  });
  return Array.from(databases);
};
