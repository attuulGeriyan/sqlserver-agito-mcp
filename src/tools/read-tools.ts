import { query } from "../core/query.js";
import {
  formatQueryResult,
  formatTableList,
  formatSchemaDescription,
  formatForeignKeys,
  formatSampleData,
} from "../utils/formatters.js";
import { DEFAULT_SAMPLE_LIMIT, MAX_SAMPLE_LIMIT } from "../config/constants.js";

// Execute query (read-only)
export const executeQuery = async (connString: string, dbName: string, queryText: string) => {
  // Safety check: only allow SELECT queries
  const trimmedQuery = queryText.trim().toUpperCase();
  if (!trimmedQuery.startsWith("SELECT")) {
    return {
      content: [
        {
          type: "text",
          text: "Error: Only SELECT queries are allowed in read-only mode.",
        },
      ],
    };
  }

  const results = await query(connString, queryText);

  return {
    content: [
      {
        type: "text",
        text: formatQueryResult(results),
      },
    ],
  };
};

// List all tables in database
export const listTables = async (connString: string, dbName: string) => {
  const results = await query(
    connString,
    `
      SELECT TABLE_SCHEMA, TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_SCHEMA, TABLE_NAME
    `
  );

  return {
    content: [
      {
        type: "text",
        text: formatTableList(dbName, results),
      },
    ],
  };
};

// Describe table schema
export const describeTable = async (connString: string, dbName: string, tableName: string) => {
  const columns = await query(
    connString,
    `
      SELECT
        COLUMN_NAME,
        DATA_TYPE,
        CHARACTER_MAXIMUM_LENGTH,
        NUMERIC_PRECISION,
        NUMERIC_SCALE,
        IS_NULLABLE,
        COLUMN_DEFAULT,
        ORDINAL_POSITION
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = '${tableName}'
      ORDER BY ORDINAL_POSITION
    `
  );

  const constraints = await query(
    connString,
    `
      SELECT
        tc.CONSTRAINT_NAME,
        tc.CONSTRAINT_TYPE,
        kcu.COLUMN_NAME
      FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
      JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
        ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
      WHERE tc.TABLE_NAME = '${tableName}'
    `
  );

  return {
    content: [
      {
        type: "text",
        text: formatSchemaDescription(dbName, tableName, columns, constraints),
      },
    ],
  };
};

// Show foreign key relationships
export const showForeignKeys = async (connString: string, dbName: string, tableName?: string) => {
  let queryText = `
    SELECT
      fk.name AS ForeignKey,
      OBJECT_NAME(fk.parent_object_id) AS TableName,
      COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS ColumnName,
      OBJECT_NAME(fk.referenced_object_id) AS ReferencedTable,
      COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS ReferencedColumn
    FROM sys.foreign_keys fk
    INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
  `;

  if (tableName) {
    queryText += ` WHERE OBJECT_NAME(fk.parent_object_id) = '${tableName}'`;
  }

  const results = await query(connString, queryText);

  return {
    content: [
      {
        type: "text",
        text: formatForeignKeys(dbName, tableName || "all", results),
      },
    ],
  };
};

// Get sample data from a table
export const getSampleData = async (
  connString: string,
  dbName: string,
  tableName: string,
  limit?: number
) => {
  const actualLimit = Math.min(limit || DEFAULT_SAMPLE_LIMIT, MAX_SAMPLE_LIMIT);

  const results = await query(
    connString,
    `SELECT TOP ${actualLimit} * FROM [${tableName}]`
  );

  return {
    content: [
      {
        type: "text",
        text: formatSampleData(dbName, tableName, results),
      },
    ],
  };
};

// Tool definitions for read-only tools
export const readToolDefinitions = [
  {
    name: "execute_query",
    description:
      "Execute a SELECT query against the chosen database. Read-only, safe for exploration.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The SELECT SQL query to execute",
        },
        database: {
          type: "string",
          description: "Exact database name. Call list_databases to see what's available. If omitted, supply 'project' instead.",
        },
        project: {
          type: "string",
          description: "Project name (e.g. 'RobotiMaster'). MCP resolves it to the matching DB (e.g. 'MTMRobot'). Ignored when 'database' is supplied.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "list_tables",
    description: "List all tables in the specified database",
    inputSchema: {
      type: "object",
      properties: {
        database: {
          type: "string",
          description: "Exact database name. Call list_databases to see what's available. If omitted, supply 'project' instead.",
        },
        project: {
          type: "string",
          description: "Project name (e.g. 'RobotiMaster'). MCP resolves it to the matching DB (e.g. 'MTMRobot'). Ignored when 'database' is supplied.",
        },
      },
    },
  },
  {
    name: "describe_table",
    description:
      "Get detailed schema information for a specific table including columns, data types, and constraints",
    inputSchema: {
      type: "object",
      properties: {
        table_name: {
          type: "string",
          description: "Name of the table to describe",
        },
        database: {
          type: "string",
          description: "Exact database name. Call list_databases to see what's available. If omitted, supply 'project' instead.",
        },
        project: {
          type: "string",
          description: "Project name (e.g. 'RobotiMaster'). MCP resolves it to the matching DB (e.g. 'MTMRobot'). Ignored when 'database' is supplied.",
        },
      },
      required: ["table_name"],
    },
  },
  {
    name: "show_foreign_keys",
    description:
      "Show all foreign key relationships for a table or entire database",
    inputSchema: {
      type: "object",
      properties: {
        table_name: {
          type: "string",
          description: "Optional: specific table name. If omitted, shows all FKs",
        },
        database: {
          type: "string",
          description: "Exact database name. Call list_databases to see what's available. If omitted, supply 'project' instead.",
        },
        project: {
          type: "string",
          description: "Project name (e.g. 'RobotiMaster'). MCP resolves it to the matching DB (e.g. 'MTMRobot'). Ignored when 'database' is supplied.",
        },
      },
    },
  },
  {
    name: "get_sample_data",
    description:
      "Get sample rows from a table to understand the data structure",
    inputSchema: {
      type: "object",
      properties: {
        table_name: {
          type: "string",
          description: "Name of the table",
        },
        limit: {
          type: "number",
          description: "Number of rows to return (default: 10, max: 100)",
        },
        database: {
          type: "string",
          description: "Exact database name. Call list_databases to see what's available. If omitted, supply 'project' instead.",
        },
        project: {
          type: "string",
          description: "Project name (e.g. 'RobotiMaster'). MCP resolves it to the matching DB (e.g. 'MTMRobot'). Ignored when 'database' is supplied.",
        },
      },
      required: ["table_name"],
    },
  },
];
