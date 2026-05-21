// Whitelist for truncate operations (only tables with Test prefix or in this list)
export const TRUNCATE_WHITELIST = [
  "TestOrders",
  "TestLoadCarriers",
  "TestEquipment",
  "TestLocations",
  // Add more test tables as needed
];

// Default limits
export const DEFAULT_SAMPLE_LIMIT = 10;
export const MAX_SAMPLE_LIMIT = 100;
export const DEFAULT_RECENT_CHANGES_HOURS = 24;
export const DEFAULT_RECENT_CHANGES_LIMIT = 100;

// Index analysis thresholds
export const DEFAULT_MIN_FRAGMENTATION = 30; // Percentage
export const FRAGMENTATION_REBUILD_THRESHOLD = 30; // Percentage
export const FRAGMENTATION_REORGANIZE_THRESHOLD = 10; // Percentage

// Health check thresholds
export const HEALTH_SCORE_HEALTHY = 80;
export const HEALTH_SCORE_WARNING = 60;

// Logging configuration
export const LOG_DIR_NAME = "logs";
export const MUTATION_LOG_PREFIX = "mutations-";
