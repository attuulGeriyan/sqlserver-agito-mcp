import fs from "fs";
import path from "path";
import { LOG_DIR_NAME, MUTATION_LOG_PREFIX } from "../config/constants.js";

// Logging setup
const LOG_DIR = path.join(process.cwd(), LOG_DIR_NAME);
const getLogFile = () => path.join(LOG_DIR, `${MUTATION_LOG_PREFIX}${new Date().toISOString().split('T')[0]}.log`);

// Ensure log directory exists
export const ensureLogDirectory = () => {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
};

// Initialize logging on module load
ensureLogDirectory();

// Log mutation operations
export const logMutation = (operation: string, database: string, details: any) => {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    operation,
    database,
    details,
  };

  const logLine = JSON.stringify(logEntry) + "\n";
  const logFile = getLogFile();

  fs.appendFileSync(logFile, logLine);
  console.error(`[MUTATION LOG] ${timestamp} - ${operation} on ${database}:`, details);
};

// Read mutation logs for a specific date
export const readMutationLogs = (date?: Date): any[] => {
  const targetDate = date || new Date();
  const dateStr = targetDate.toISOString().split('T')[0];
  const logFile = path.join(LOG_DIR, `${MUTATION_LOG_PREFIX}${dateStr}.log`);

  if (!fs.existsSync(logFile)) {
    return [];
  }

  const content = fs.readFileSync(logFile, 'utf-8');
  const lines = content.trim().split('\n');

  return lines
    .filter(line => line.trim())
    .map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(entry => entry !== null);
};

// Get log statistics for health checks
export const getLogStatistics = (date?: Date): { total: number; errors: number; operations: Record<string, number> } => {
  const logs = readMutationLogs(date);
  const stats = {
    total: logs.length,
    errors: 0,
    operations: {} as Record<string, number>,
  };

  for (const log of logs) {
    // Count errors (operations ending with _FAILED)
    if (log.operation?.endsWith('_FAILED')) {
      stats.errors++;
    }

    // Count operations
    stats.operations[log.operation] = (stats.operations[log.operation] || 0) + 1;
  }

  return stats;
};
