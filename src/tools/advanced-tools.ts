// Advanced tools - Phase 2+

import { query } from "../core/query.js";
import { formatQueryResult } from "../utils/formatters.js";
import {
  analyzeIndexes as analyzeIndexesService,
  getRecentChanges as getRecentChangesService,
  dailyHealthCheck as dailyHealthCheckService
} from "../services/health-service.js";
import { verifyBackup as verifyBackupService } from "../services/backup-service.js";
import { compareSchemas as compareSchemasService, validateSync as validateSyncService } from "../services/schema-service.js";
import { generateMigration as generateMigrationService } from "../services/migration-service.js";

// List stored procedures in database
export const listStoredProcedures = async (
  connString: string,
  dbName: string,
  schema?: string,
  namePattern?: string
) => {
  let sql = `
    SELECT
      ROUTINE_SCHEMA as [Schema],
      ROUTINE_NAME as [Name],
      CREATED as [Created],
      LAST_ALTERED as [LastModified]
    FROM INFORMATION_SCHEMA.ROUTINES
    WHERE ROUTINE_TYPE = 'PROCEDURE'
  `;

  if (schema) {
    sql += ` AND ROUTINE_SCHEMA = '${schema}'`;
  }

  if (namePattern) {
    sql += ` AND ROUTINE_NAME LIKE '%${namePattern}%'`;
  }

  sql += ` ORDER BY ROUTINE_SCHEMA, ROUTINE_NAME`;

  const results = await query(connString, sql);

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            database: dbName,
            procedureCount: results.length,
            procedures: results,
          },
          null,
          2
        ),
      },
    ],
  };
};

// Describe a specific stored procedure
export const describeProcedure = async (
  connString: string,
  dbName: string,
  procedureName: string,
  includeDefinition: boolean = true
) => {
  // Get procedure metadata
  const metadataQuery = `
    SELECT
      ROUTINE_SCHEMA as [Schema],
      ROUTINE_NAME as [Name],
      ROUTINE_TYPE as [Type],
      DATA_TYPE as [ReturnType],
      CREATED as [Created],
      LAST_ALTERED as [LastModified]
    FROM INFORMATION_SCHEMA.ROUTINES
    WHERE ROUTINE_TYPE = 'PROCEDURE'
      AND ROUTINE_NAME = '${procedureName}'
  `;

  const metadata = await query(connString, metadataQuery);

  if (metadata.length === 0) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              error: `Stored procedure '${procedureName}' not found`,
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }

  // Get parameters
  const parametersQuery = `
    SELECT
      PARAMETER_NAME as [Name],
      DATA_TYPE as [DataType],
      CHARACTER_MAXIMUM_LENGTH as [MaxLength],
      PARAMETER_MODE as [Mode],
      ORDINAL_POSITION as [Position]
    FROM INFORMATION_SCHEMA.PARAMETERS
    WHERE SPECIFIC_NAME = '${procedureName}'
    ORDER BY ORDINAL_POSITION
  `;

  const parameters = await query(connString, parametersQuery);

  // Get definition if requested
  let definition = null;
  if (includeDefinition) {
    const definitionQuery = `
      SELECT sm.definition
      FROM sys.sql_modules sm
      INNER JOIN sys.objects o ON sm.object_id = o.object_id
      WHERE o.type = 'P' AND o.name = '${procedureName}'
    `;

    const defResult = await query(connString, definitionQuery);
    definition = defResult.length > 0 ? defResult[0].definition : null;
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            database: dbName,
            procedure: metadata[0],
            parameters: parameters,
            definition: definition,
          },
          null,
          2
        ),
      },
    ],
  };
};

// Analyze index health
export const analyzeIndexes = async (
  connString: string,
  dbName: string,
  tableName?: string,
  minFragmentation?: number,
  includeUsageStats?: boolean
) => {
  const results = await analyzeIndexesService(
    connString,
    dbName,
    tableName,
    minFragmentation,
    includeUsageStats
  );

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(results, null, 2),
      },
    ],
  };
};

// Verify backup file
export const verifyBackup = async (
  connString: string,
  dbName: string,
  backupFilePath: string,
  verificationType?: "quick" | "full",
  compareToDatabase?: string
) => {
  const results = await verifyBackupService(
    connString,
    dbName,
    backupFilePath,
    verificationType,
    compareToDatabase
  );

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(results, null, 2),
      },
    ],
  };
};

// Compare schemas between environments
export const compareSchemas = async (
  sourceEnv: string,
  targetEnv: string,
  databaseName: string,
  includeIndexes?: boolean,
  includeProcedures?: boolean
) => {
  const results = await compareSchemasService(
    sourceEnv,
    targetEnv,
    databaseName,
    includeIndexes,
    includeProcedures
  );

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(results, null, 2),
      },
    ],
  };
};

// Validate sync between environments
export const validateSync = async (
  environments: string[],
  databaseName: string,
  tableNames: string[],
  comparisonMode?: "exact" | "subset",
  checkRowCounts?: boolean
) => {
  const results = await validateSyncService(
    environments,
    databaseName,
    tableNames,
    comparisonMode,
    checkRowCounts
  );

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(results, null, 2),
      },
    ],
  };
};

// Generate migration script
export const generateMigration = async (
  sourceEnv: string,
  targetEnv: string,
  databaseName: string,
  includeDrops?: boolean,
  dryRun?: boolean
) => {
  const results = await generateMigrationService(
    sourceEnv,
    targetEnv,
    databaseName,
    includeDrops,
    dryRun
  );

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(results, null, 2),
      },
    ],
  };
};

// Get recent changes (timestamp-based)
export const getRecentChanges = async (
  connString: string,
  dbName: string,
  tableName?: string,
  timeWindowHours?: number,
  changeTypes?: string[],
  limit?: number
) => {
  const results = await getRecentChangesService(
    connString,
    dbName,
    tableName,
    timeWindowHours,
    changeTypes,
    limit
  );

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(results, null, 2),
      },
    ],
  };
};

// Daily health check
export const dailyHealthCheck = async (
  connString: string,
  dbName: string,
  compareToEnvironment?: string
) => {
  const results = await dailyHealthCheckService(
    connString,
    dbName,
    compareToEnvironment
  );

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(results, null, 2),
      },
    ],
  };
};

// Natural language to query - provides schema context
export const nlToQuery = async (
  connString: string,
  dbName: string,
  question: string,
  provideSchemaContext: boolean = true,
  execute: boolean = false,
  limit: number = 100
) => {
  const results: any = {
    question,
    database: dbName,
    schema_context: {},
    message: "",
  };

  try {
    if (provideSchemaContext) {
      // Get comprehensive schema information

      // 1. Get all tables with columns
      const tablesQuery = `
        SELECT
          t.TABLE_SCHEMA,
          t.TABLE_NAME,
          c.COLUMN_NAME,
          c.DATA_TYPE,
          c.CHARACTER_MAXIMUM_LENGTH,
          c.IS_NULLABLE,
          c.COLUMN_DEFAULT,
          CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END AS IS_PRIMARY_KEY
        FROM INFORMATION_SCHEMA.TABLES t
        INNER JOIN INFORMATION_SCHEMA.COLUMNS c ON t.TABLE_NAME = c.TABLE_NAME AND t.TABLE_SCHEMA = c.TABLE_SCHEMA
        LEFT JOIN (
          SELECT ku.TABLE_SCHEMA, ku.TABLE_NAME, ku.COLUMN_NAME
          FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
          INNER JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku
            ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
          WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
        ) pk ON c.TABLE_SCHEMA = pk.TABLE_SCHEMA AND c.TABLE_NAME = pk.TABLE_NAME AND c.COLUMN_NAME = pk.COLUMN_NAME
        WHERE t.TABLE_TYPE = 'BASE TABLE'
        ORDER BY t.TABLE_SCHEMA, t.TABLE_NAME, c.ORDINAL_POSITION
      `;

      const tableData = await query(connString, tablesQuery);

      // Group by table
      const tables: any = {};
      for (const row of tableData) {
        const tableKey = `${row.TABLE_SCHEMA}.${row.TABLE_NAME}`;
        if (!tables[tableKey]) {
          tables[tableKey] = {
            schema: row.TABLE_SCHEMA,
            name: row.TABLE_NAME,
            columns: [],
          };
        }
        tables[tableKey].columns.push({
          name: row.COLUMN_NAME,
          type: row.DATA_TYPE,
          max_length: row.CHARACTER_MAXIMUM_LENGTH,
          nullable: row.IS_NULLABLE === 'YES',
          default: row.COLUMN_DEFAULT,
          is_primary_key: row.IS_PRIMARY_KEY === 1,
        });
      }

      // 2. Get foreign key relationships
      const fkQuery = `
        SELECT
          OBJECT_SCHEMA_NAME(fk.parent_object_id) AS TableSchema,
          OBJECT_NAME(fk.parent_object_id) AS TableName,
          COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS ColumnName,
          OBJECT_SCHEMA_NAME(fk.referenced_object_id) AS ReferencedSchema,
          OBJECT_NAME(fk.referenced_object_id) AS ReferencedTable,
          COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS ReferencedColumn
        FROM sys.foreign_keys fk
        INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
      `;

      const foreignKeys = await query(connString, fkQuery);

      // Add FK info to tables
      for (const fk of foreignKeys) {
        const tableKey = `${fk.TableSchema}.${fk.TableName}`;
        if (tables[tableKey]) {
          if (!tables[tableKey].foreign_keys) {
            tables[tableKey].foreign_keys = [];
          }
          tables[tableKey].foreign_keys.push({
            column: fk.ColumnName,
            references: `${fk.ReferencedSchema}.${fk.ReferencedTable}.${fk.ReferencedColumn}`,
          });
        }
      }

      // 3. Get sample enum values from small lookup tables (< 50 rows)
      const enumValues: any = {};
      for (const tableKey of Object.keys(tables)) {
        const table = tables[tableKey];
        try {
          const countQuery = `SELECT COUNT(*) as cnt FROM [${table.schema}].[${table.name}]`;
          const countResult = await query(connString, countQuery);
          const rowCount = countResult[0]?.cnt || 0;

          if (rowCount > 0 && rowCount < 50) {
            // Get all rows as sample values
            const sampleQuery = `SELECT TOP 10 * FROM [${table.schema}].[${table.name}]`;
            const samples = await query(connString, sampleQuery);
            enumValues[tableKey] = samples;
          }
        } catch (error) {
          // Skip tables that can't be queried
        }
      }

      results.schema_context = {
        tables: Object.values(tables),
        enum_values: enumValues,
        total_tables: Object.keys(tables).length,
      };

      results.message =
        `I've retrieved the schema for database '${dbName}' with ${Object.keys(tables).length} tables.\n\n` +
        `Based on your question: "${question}"\n\n` +
        `I can help you write the SQL query. The schema context above shows all available tables, columns, data types, and relationships.\n\n` +
        (execute ?
          `Once we craft the query, I'll execute it for you (limited to ${limit} rows).` :
          `Set execute=true if you want me to run the query after we write it.`);
    }

    // If execute is true and user provides a query in the question, we could execute it
    // But for safety, we'll just provide the schema context
    if (execute) {
      results.note = "To execute a query, use the 'execute_query' tool with the SQL statement we craft together.";
    }

  } catch (error) {
    results.error = error instanceof Error ? error.message : String(error);
  }

  return results;
};

// Generate test data - provides schema analysis for AI-assisted generation
export const generateTestData = async (
  connString: string,
  dbName: string,
  scenario: string,
  recordCount: number = 5,
  includeRelated: boolean = true,
  dryRun: boolean = true
) => {
  const results: any = {
    scenario,
    database: dbName,
    record_count: recordCount,
    include_related: includeRelated,
    dry_run: dryRun,
    schema_analysis: {},
    message: "",
  };

  try {
    // 1. Get all tables with complete schema
    const tablesQuery = `
      SELECT
        t.TABLE_SCHEMA,
        t.TABLE_NAME,
        c.COLUMN_NAME,
        c.DATA_TYPE,
        c.CHARACTER_MAXIMUM_LENGTH,
        c.NUMERIC_PRECISION,
        c.IS_NULLABLE,
        c.COLUMN_DEFAULT,
        CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END AS IS_PRIMARY_KEY
      FROM INFORMATION_SCHEMA.TABLES t
      INNER JOIN INFORMATION_SCHEMA.COLUMNS c ON t.TABLE_NAME = c.TABLE_NAME AND t.TABLE_SCHEMA = c.TABLE_SCHEMA
      LEFT JOIN (
        SELECT ku.TABLE_SCHEMA, ku.TABLE_NAME, ku.COLUMN_NAME
        FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
        INNER JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku
          ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
        WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
      ) pk ON c.TABLE_SCHEMA = pk.TABLE_SCHEMA AND c.TABLE_NAME = pk.TABLE_NAME AND c.COLUMN_NAME = pk.COLUMN_NAME
      WHERE t.TABLE_TYPE = 'BASE TABLE'
      ORDER BY t.TABLE_SCHEMA, t.TABLE_NAME, c.ORDINAL_POSITION
    `;

    const tableData = await query(connString, tablesQuery);

    // Group by table
    const tables: any = {};
    for (const row of tableData) {
      const tableKey = `${row.TABLE_SCHEMA}.${row.TABLE_NAME}`;
      if (!tables[tableKey]) {
        tables[tableKey] = {
          schema: row.TABLE_SCHEMA,
          name: row.TABLE_NAME,
          columns: [],
        };
      }
      tables[tableKey].columns.push({
        name: row.COLUMN_NAME,
        type: row.DATA_TYPE,
        max_length: row.CHARACTER_MAXIMUM_LENGTH,
        precision: row.NUMERIC_PRECISION,
        nullable: row.IS_NULLABLE === 'YES',
        default: row.COLUMN_DEFAULT,
        is_primary_key: row.IS_PRIMARY_KEY === 1,
      });
    }

    // 2. Build dependency graph (FK relationships)
    const fkQuery = `
      SELECT
        OBJECT_SCHEMA_NAME(fk.parent_object_id) AS TableSchema,
        OBJECT_NAME(fk.parent_object_id) AS TableName,
        fk.name AS FKName,
        COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS ColumnName,
        OBJECT_SCHEMA_NAME(fk.referenced_object_id) AS ReferencedSchema,
        OBJECT_NAME(fk.referenced_object_id) AS ReferencedTable,
        COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS ReferencedColumn
      FROM sys.foreign_keys fk
      INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
    `;

    const foreignKeys = await query(connString, fkQuery);

    // Build dependency order
    const dependencies: any = {};
    for (const fk of foreignKeys) {
      const tableKey = `${fk.TableSchema}.${fk.TableName}`;
      const refKey = `${fk.ReferencedSchema}.${fk.ReferencedTable}`;

      if (!dependencies[tableKey]) {
        dependencies[tableKey] = { depends_on: [], foreign_keys: [] };
      }

      if (!dependencies[tableKey].depends_on.includes(refKey)) {
        dependencies[tableKey].depends_on.push(refKey);
      }

      dependencies[tableKey].foreign_keys.push({
        column: fk.ColumnName,
        references: `${refKey}.${fk.ReferencedColumn}`,
      });
    }

    // Topological sort for insertion order
    const insertionOrder: string[] = [];
    const visited = new Set<string>();

    const visit = (tableKey: string) => {
      if (visited.has(tableKey)) return;
      visited.add(tableKey);

      const deps = dependencies[tableKey]?.depends_on || [];
      for (const dep of deps) {
        visit(dep);
      }

      insertionOrder.push(tableKey);
    };

    for (const tableKey of Object.keys(tables)) {
      visit(tableKey);
    }

    // 3. Get sample data for pattern recognition
    const sampleData: any = {};
    for (const tableKey of Object.keys(tables)) {
      const table = tables[tableKey];
      try {
        const sampleQuery = `SELECT TOP 3 * FROM [${table.schema}].[${table.name}]`;
        const samples = await query(connString, sampleQuery);
        if (samples.length > 0) {
          sampleData[tableKey] = samples;
        }
      } catch (error) {
        // Skip tables that can't be queried
      }
    }

    // 4. Get enum/lookup table values
    const enumValues: any = {};
    for (const tableKey of Object.keys(tables)) {
      const table = tables[tableKey];
      try {
        const countQuery = `SELECT COUNT(*) as cnt FROM [${table.schema}].[${table.name}]`;
        const countResult = await query(connString, countQuery);
        const rowCount = countResult[0]?.cnt || 0;

        if (rowCount > 0 && rowCount < 100) {
          const allQuery = `SELECT * FROM [${table.schema}].[${table.name}]`;
          const allRows = await query(connString, allQuery);
          enumValues[tableKey] = allRows;
        }
      } catch (error) {
        // Skip
      }
    }

    results.schema_analysis = {
      tables: Object.values(tables),
      dependency_graph: dependencies,
      insertion_order: insertionOrder,
      sample_data: sampleData,
      enum_values: enumValues,
      total_tables: Object.keys(tables).length,
    };

    results.message =
      `I've analyzed the schema for database '${dbName}'.\n\n` +
      `Scenario: "${scenario}"\n` +
      `Records to generate: ${recordCount}\n\n` +
      `Based on the schema analysis above, I can help you generate realistic test data.\n\n` +
      `The dependency graph shows we need to insert in this order:\n${insertionOrder.join(' → ')}\n\n` +
      `I'll help you craft INSERT statements that:\n` +
      `- Respect foreign key relationships\n` +
      `- Use appropriate data types\n` +
      `- Generate realistic values based on the scenario\n` +
      `- Follow the correct insertion order\n\n` +
      (dryRun ?
        `This is a DRY RUN. Set dry_run=false to execute the generated SQL.` :
        `Ready to execute when you approve the generated SQL.`);

  } catch (error) {
    results.error = error instanceof Error ? error.message : String(error);
  }

  return results;
};

// Tool definitions for advanced tools
export const advancedToolDefinitions = [
  {
    name: "list_stored_procedures",
    description: "List all stored procedures in the database with optional filtering",
    inputSchema: {
      type: "object",
      properties: {
        database: {
          type: "string",
          enum: ["TestRobot", "WCSTest", "MTMCore", "MTMRobot", "MTMDHLScheduler", "MTMFives", "MTMERPTMS"],
          description: "Which database to query (default: TestRobot)",
        },
        schema: {
          type: "string",
          description: "Optional: filter by schema name",
        },
        name_pattern: {
          type: "string",
          description: "Optional: filter by name pattern (partial match)",
        },
      },
    },
  },
  {
    name: "describe_procedure",
    description:
      "Get detailed information about a specific stored procedure including parameters and definition",
    inputSchema: {
      type: "object",
      properties: {
        database: {
          type: "string",
          enum: ["TestRobot", "WCSTest", "MTMCore", "MTMRobot", "MTMDHLScheduler", "MTMFives", "MTMERPTMS"],
          description: "Which database (default: TestRobot)",
        },
        procedure_name: {
          type: "string",
          description: "Name of the stored procedure",
        },
        include_definition: {
          type: "boolean",
          description: "Include the procedure SQL definition (default: true)",
        },
      },
      required: ["procedure_name"],
    },
  },
  {
    name: "analyze_indexes",
    description:
      "Analyze database index health including missing, fragmented, and unused indexes with recommendations",
    inputSchema: {
      type: "object",
      properties: {
        database: {
          type: "string",
          enum: ["TestRobot", "WCSTest", "MTMCore", "MTMRobot", "MTMDHLScheduler", "MTMFives", "MTMERPTMS"],
          description: "Which database to analyze (default: TestRobot)",
        },
        table_name: {
          type: "string",
          description: "Optional: specific table to analyze. If omitted, analyzes all tables",
        },
        min_fragmentation: {
          type: "number",
          description: "Minimum fragmentation percentage to report (default: 30)",
        },
        include_usage_stats: {
          type: "boolean",
          description: "Include index usage statistics (default: true)",
        },
      },
    },
  },
  {
    name: "verify_backup",
    description:
      "Verify database backup file integrity and optionally compare to live database",
    inputSchema: {
      type: "object",
      properties: {
        backup_file_path: {
          type: "string",
          description: "Full path to the backup file (.bak)",
        },
        verification_type: {
          type: "string",
          enum: ["quick", "full"],
          description: "Verification type: quick (RESTORE VERIFYONLY) or full (default: quick)",
        },
        compare_to_database: {
          type: "string",
          description: "Optional: database name to compare table counts",
        },
        database: {
          type: "string",
          enum: ["TestRobot", "WCSTest", "MTMCore", "MTMRobot", "MTMDHLScheduler", "MTMFives", "MTMERPTMS"],
          description: "Which database to use for verification queries (default: TestRobot)",
        },
      },
      required: ["backup_file_path"],
    },
  },
  {
    name: "compare_schemas",
    description:
      "Compare database schemas between two environments to identify differences in tables, columns, foreign keys, and indexes",
    inputSchema: {
      type: "object",
      properties: {
        source_environment: {
          type: "string",
          description: "Source environment name (e.g., 'LOCAL', 'ISIT')",
        },
        target_environment: {
          type: "string",
          description: "Target environment name to compare against",
        },
        database_name: {
          type: "string",
          description: "Database name to compare (e.g., 'MTMRobot', 'MTMCore')",
        },
        include_indexes: {
          type: "boolean",
          description: "Include index comparison (default: true)",
        },
        include_procedures: {
          type: "boolean",
          description: "Include stored procedure comparison (default: false)",
        },
      },
      required: ["source_environment", "target_environment", "database_name"],
    },
  },
  {
    name: "validate_sync",
    description:
      "Check if reference/config data is synchronized across multiple environments by comparing row counts and data",
    inputSchema: {
      type: "object",
      properties: {
        environments: {
          type: "array",
          items: {
            type: "string",
          },
          description: "List of environment names to compare (e.g., ['LOCAL', 'ISIT'])",
        },
        database_name: {
          type: "string",
          description: "Database name containing the tables",
        },
        table_names: {
          type: "array",
          items: {
            type: "string",
          },
          description: "List of table names to check for synchronization",
        },
        comparison_mode: {
          type: "string",
          enum: ["exact", "subset"],
          description: "Comparison mode: exact (full match) or subset (default: exact)",
        },
        check_row_counts: {
          type: "boolean",
          description: "Check row counts across environments (default: true)",
        },
      },
      required: ["environments", "database_name", "table_names"],
    },
  },
  {
    name: "generate_migration",
    description:
      "Auto-generate SQL migration script to synchronize target environment schema with source environment",
    inputSchema: {
      type: "object",
      properties: {
        source_environment: {
          type: "string",
          description: "Source environment (e.g., 'ISIT' as source of truth)",
        },
        target_environment: {
          type: "string",
          description: "Target environment to update (e.g., 'LOCAL')",
        },
        database_name: {
          type: "string",
          description: "Database name (e.g., 'MTMRobot', 'MTMCore')",
        },
        include_drops: {
          type: "boolean",
          description: "Include DROP statements for objects only in target (default: false, DESTRUCTIVE)",
        },
        dry_run: {
          type: "boolean",
          description: "Generate read-only preview without execution (default: true)",
        },
      },
      required: ["source_environment", "target_environment", "database_name"],
    },
  },
  {
    name: "get_recent_changes",
    description:
      "Track recent data changes using timestamp-based detection (CreateDate, UpdateDate, etc.)",
    inputSchema: {
      type: "object",
      properties: {
        database: {
          type: "string",
          enum: ["TestRobot", "WCSTest", "MTMCore", "MTMRobot", "MTMDHLScheduler", "MTMFives", "MTMERPTMS"],
          description: "Which database to check (default: TestRobot)",
        },
        table_name: {
          type: "string",
          description: "Optional: specific table to check. If omitted, checks all tables",
        },
        time_window_hours: {
          type: "number",
          description: "Time window in hours to look back (default: 24)",
        },
        change_types: {
          type: "array",
          items: {
            type: "string",
            enum: ["INSERT", "UPDATE", "DELETE"],
          },
          description: "Types of changes to include (default: all types)",
        },
        limit: {
          type: "number",
          description: "Maximum number of changes to return (default: 100)",
        },
      },
    },
  },
  {
    name: "daily_health_check",
    description:
      "Automated daily diagnostic report checking orphaned records, data consistency, index health, and error logs",
    inputSchema: {
      type: "object",
      properties: {
        database: {
          type: "string",
          enum: ["TestRobot", "WCSTest", "MTMCore", "MTMRobot", "MTMDHLScheduler", "MTMFives", "MTMERPTMS"],
          description: "Which database to check (default: TestRobot)",
        },
        compare_to_environment: {
          type: "string",
          description: "Optional: environment to compare schema against",
        },
      },
    },
  },
  {
    name: "nl_to_query",
    description:
      "Convert natural language questions into SQL queries with comprehensive schema context for AI assistance",
    inputSchema: {
      type: "object",
      properties: {
        question: {
          type: "string",
          description: "Natural language question about the data (e.g., 'Find all load carriers that haven't moved in 7 days')",
        },
        database: {
          type: "string",
          enum: ["TestRobot", "WCSTest", "MTMCore", "MTMRobot", "MTMDHLScheduler", "MTMFives", "MTMERPTMS"],
          description: "Which database to query (default: TestRobot)",
        },
        provide_schema_context: {
          type: "boolean",
          description: "Provide full schema context for query generation (default: true)",
        },
        execute: {
          type: "boolean",
          description: "Execute the generated query (default: false, for safety)",
        },
        limit: {
          type: "number",
          description: "Row limit if executing query (default: 100)",
        },
      },
      required: ["question"],
    },
  },
  {
    name: "generate_test_data",
    description:
      "AI-assisted realistic test data generation with FK awareness and dependency ordering",
    inputSchema: {
      type: "object",
      properties: {
        scenario: {
          type: "string",
          description: "Test scenario description (e.g., 'palletizing workflow with 5 load carriers')",
        },
        database: {
          type: "string",
          enum: ["TestRobot", "WCSTest", "MTMCore", "MTMRobot", "MTMDHLScheduler", "MTMFives", "MTMERPTMS"],
          description: "Which database (default: TestRobot)",
        },
        record_count: {
          type: "number",
          description: "Number of primary records to generate (default: 5)",
        },
        include_related: {
          type: "boolean",
          description: "Include related records respecting FK relationships (default: true)",
        },
        dry_run: {
          type: "boolean",
          description: "Generate SQL without executing (default: true)",
        },
      },
      required: ["scenario"],
    },
  },
];
