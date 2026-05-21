// Format query results as JSON response
export const formatQueryResult = (data: any, metadata?: Record<string, any>) => {
  return JSON.stringify(
    {
      rowCount: Array.isArray(data) ? data.length : 0,
      data,
      ...metadata,
    },
    null,
    2
  );
};

// Format success response for mutations
export const formatSuccessResponse = (
  operation: string,
  database: string,
  details: Record<string, any>
) => {
  return JSON.stringify(
    {
      success: true,
      operation,
      database,
      ...details,
    },
    null,
    2
  );
};

// Format error response
export const formatErrorResponse = (message: string, details?: Record<string, any>) => {
  return JSON.stringify(
    {
      error: message,
      ...details,
    },
    null,
    2
  );
};

// Format table list response
export const formatTableList = (database: string, tables: any[]) => {
  return JSON.stringify(
    {
      database,
      tableCount: tables.length,
      tables,
    },
    null,
    2
  );
};

// Format schema description
export const formatSchemaDescription = (
  database: string,
  table: string,
  columns: any[],
  constraints: any[]
) => {
  return JSON.stringify(
    {
      database,
      table,
      columns,
      constraints,
    },
    null,
    2
  );
};

// Format foreign key information
export const formatForeignKeys = (database: string, table: string, foreignKeys: any[]) => {
  return JSON.stringify(
    {
      database,
      table: table || "all",
      foreignKeyCount: foreignKeys.length,
      foreignKeys,
    },
    null,
    2
  );
};

// Format sample data response
export const formatSampleData = (database: string, table: string, sampleData: any[]) => {
  return JSON.stringify(
    {
      database,
      table,
      rowCount: sampleData.length,
      sampleData,
    },
    null,
    2
  );
};

// Format comparison results
export const formatComparisonResult = (
  source: string,
  target: string,
  differences: any,
  summary: any
) => {
  return JSON.stringify(
    {
      source,
      target,
      differences,
      summary,
    },
    null,
    2
  );
};

// Format health check results
export const formatHealthCheckResult = (
  database: string,
  healthScore: number,
  status: string,
  checks: any,
  recommendations: string[]
) => {
  return JSON.stringify(
    {
      timestamp: new Date().toISOString(),
      database,
      health_score: healthScore,
      status,
      checks,
      recommendations,
    },
    null,
    2
  );
};
