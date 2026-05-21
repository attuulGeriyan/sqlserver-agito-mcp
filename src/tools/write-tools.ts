import { query, queryWithTransaction } from "../core/query.js";
import { isValidTableName, canTruncateTable, validateForeignKeys } from "../core/validation.js";
import { logMutation } from "../utils/logging.js";
import { formatSuccessResponse, formatErrorResponse } from "../utils/formatters.js";

// Insert data into a table
export const insertData = async (
  connString: string,
  dbName: string,
  tableName: string,
  data: Record<string, any>,
  validateFK: boolean = true
) => {
  // Validate table name
  if (!isValidTableName(tableName)) {
    return {
      content: [
        {
          type: "text",
          text: "Error: Invalid table name. Only alphanumeric characters and underscores allowed.",
        },
      ],
      isError: true,
    };
  }

  try {
    // Validate foreign keys if requested
    if (validateFK) {
      const validation = await validateForeignKeys(connString, tableName, data);
      if (!validation.valid) {
        return {
          content: [
            {
              type: "text",
              text: formatErrorResponse("Foreign key validation failed", { violations: validation.errors }),
            },
          ],
          isError: true,
        };
      }
    }

    // Build INSERT statement
    const columns = Object.keys(data);
    const values = Object.values(data);
    const columnList = columns.map((col) => `[${col}]`).join(", ");
    const valuePlaceholders = values
      .map((val) => {
        if (val === null || val === undefined) return "NULL";
        if (typeof val === "string") return `'${val.replace(/'/g, "''")}'`;
        return val;
      })
      .join(", ");

    const insertSql = `INSERT INTO [${tableName}] (${columnList}) VALUES (${valuePlaceholders})`;

    // Execute with transaction
    await queryWithTransaction(connString, insertSql, true);

    // Log mutation
    logMutation("INSERT", dbName, { table: tableName, data });

    return {
      content: [
        {
          type: "text",
          text: formatSuccessResponse("INSERT", dbName, {
            table: tableName,
            recordsAffected: 1,
            data: data,
          }),
        },
      ],
    };
  } catch (error) {
    logMutation("INSERT_FAILED", dbName, {
      table: tableName,
      data,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      content: [
        {
          type: "text",
          text: `Error: Insert failed and was rolled back. ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
};

// Update data in a table
export const updateData = async (
  connString: string,
  dbName: string,
  tableName: string,
  data: Record<string, any>,
  whereClause: string,
  confirmed: boolean
) => {
  // Require confirmation
  if (!confirmed) {
    return {
      content: [
        {
          type: "text",
          text: 'Error: UPDATE operation requires confirmation. Set "confirmed": true to proceed. This is a safety measure to prevent accidental data modification.',
        },
      ],
      isError: true,
    };
  }

  // Validate table name
  if (!isValidTableName(tableName)) {
    return {
      content: [
        {
          type: "text",
          text: "Error: Invalid table name. Only alphanumeric characters and underscores allowed.",
        },
      ],
      isError: true,
    };
  }

  if (!whereClause || whereClause.trim() === "") {
    return {
      content: [
        {
          type: "text",
          text: "Error: WHERE clause is required for UPDATE operations to prevent accidental mass updates.",
        },
      ],
      isError: true,
    };
  }

  try {
    // Build UPDATE statement
    const setClause = Object.entries(data)
      .map(([key, val]) => {
        if (val === null || val === undefined) return `[${key}] = NULL`;
        if (typeof val === "string") return `[${key}] = '${val.replace(/'/g, "''")}'`;
        return `[${key}] = ${val}`;
      })
      .join(", ");

    const updateSql = `UPDATE [${tableName}] SET ${setClause} WHERE ${whereClause}`;

    // Execute with transaction
    await queryWithTransaction(connString, updateSql, true);

    // Log mutation
    logMutation("UPDATE", dbName, { table: tableName, data, whereClause });

    return {
      content: [
        {
          type: "text",
          text: formatSuccessResponse("UPDATE", dbName, {
            table: tableName,
            data: data,
            whereClause: whereClause,
          }),
        },
      ],
    };
  } catch (error) {
    logMutation("UPDATE_FAILED", dbName, {
      table: tableName,
      data,
      whereClause,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      content: [
        {
          type: "text",
          text: `Error: Update failed and was rolled back. ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
};

// Delete data from a table
export const deleteData = async (
  connString: string,
  dbName: string,
  tableName: string,
  whereClause: string,
  confirmed: boolean
) => {
  // Require confirmation
  if (!confirmed) {
    return {
      content: [
        {
          type: "text",
          text: 'Error: DELETE operation requires confirmation. Set "confirmed": true to proceed. This is a safety measure to prevent accidental data deletion.',
        },
      ],
      isError: true,
    };
  }

  // Validate table name
  if (!isValidTableName(tableName)) {
    return {
      content: [
        {
          type: "text",
          text: "Error: Invalid table name. Only alphanumeric characters and underscores allowed.",
        },
      ],
      isError: true,
    };
  }

  if (!whereClause || whereClause.trim() === "") {
    return {
      content: [
        {
          type: "text",
          text: "Error: WHERE clause is required for DELETE operations to prevent accidental mass deletions.",
        },
      ],
      isError: true,
    };
  }

  try {
    // First, get count of records to be deleted
    const countSql = `SELECT COUNT(*) as count FROM [${tableName}] WHERE ${whereClause}`;
    const countResult = await query(connString, countSql);
    const recordCount = countResult[0].count;

    // Build DELETE statement
    const deleteSql = `DELETE FROM [${tableName}] WHERE ${whereClause}`;

    // Execute with transaction
    await queryWithTransaction(connString, deleteSql, true);

    // Log mutation
    logMutation("DELETE", dbName, { table: tableName, whereClause, recordsDeleted: recordCount });

    return {
      content: [
        {
          type: "text",
          text: formatSuccessResponse("DELETE", dbName, {
            table: tableName,
            recordsDeleted: recordCount,
            whereClause: whereClause,
          }),
        },
      ],
    };
  } catch (error) {
    logMutation("DELETE_FAILED", dbName, {
      table: tableName,
      whereClause,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      content: [
        {
          type: "text",
          text: `Error: Delete failed and was rolled back. ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
};

// Truncate table (delete all data)
export const truncateTable = async (
  connString: string,
  dbName: string,
  tableName: string,
  confirmed: boolean
) => {
  // Require confirmation
  if (!confirmed) {
    return {
      content: [
        {
          type: "text",
          text: 'Error: TRUNCATE operation requires confirmation. Set "confirmed": true to proceed. This will DELETE ALL DATA from the table.',
        },
      ],
      isError: true,
    };
  }

  // Validate table name
  if (!isValidTableName(tableName)) {
    return {
      content: [
        {
          type: "text",
          text: "Error: Invalid table name. Only alphanumeric characters and underscores allowed.",
        },
      ],
      isError: true,
    };
  }

  // Check whitelist
  if (!canTruncateTable(tableName)) {
    return {
      content: [
        {
          type: "text",
          text: `Error: Table '${tableName}' is not whitelisted for truncation. Only tables starting with 'Test' or explicitly whitelisted can be truncated.`,
        },
      ],
      isError: true,
    };
  }

  try {
    // Get count before truncation
    const countSql = `SELECT COUNT(*) as count FROM [${tableName}]`;
    const countResult = await query(connString, countSql);
    const recordCount = countResult[0].count;

    // TRUNCATE cannot be used in transactions, so we use DELETE
    const deleteSql = `DELETE FROM [${tableName}]`;

    // Execute with transaction
    await queryWithTransaction(connString, deleteSql, true);

    // Log mutation
    logMutation("TRUNCATE", dbName, { table: tableName, recordsDeleted: recordCount });

    return {
      content: [
        {
          type: "text",
          text: formatSuccessResponse("TRUNCATE", dbName, {
            table: tableName,
            recordsDeleted: recordCount,
            message: "All records deleted from table",
          }),
        },
      ],
    };
  } catch (error) {
    logMutation("TRUNCATE_FAILED", dbName, {
      table: tableName,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      content: [
        {
          type: "text",
          text: `Error: Truncate failed and was rolled back. ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
};

// Execute transaction (multiple statements)
export const executeTransaction = async (
  connString: string,
  dbName: string,
  statements: string[],
  confirmed: boolean
) => {
  // Require confirmation for any mutations
  const hasMutations = statements.some((stmt) => {
    const upper = stmt.trim().toUpperCase();
    return (
      upper.startsWith("INSERT") ||
      upper.startsWith("UPDATE") ||
      upper.startsWith("DELETE") ||
      upper.startsWith("TRUNCATE")
    );
  });

  if (hasMutations && !confirmed) {
    return {
      content: [
        {
          type: "text",
          text: 'Error: Transaction contains mutations and requires confirmation. Set "confirmed": true to proceed.',
        },
      ],
      isError: true,
    };
  }

  if (!statements || statements.length === 0) {
    return {
      content: [
        {
          type: "text",
          text: "Error: No SQL statements provided.",
        },
      ],
      isError: true,
    };
  }

  try {
    // Combine all statements into a single transaction
    const combinedSql = statements.join(";\n");

    // Execute with transaction
    await queryWithTransaction(connString, combinedSql, true);

    // Log mutation
    logMutation("TRANSACTION", dbName, {
      statementCount: statements.length,
      statements: statements,
    });

    return {
      content: [
        {
          type: "text",
          text: formatSuccessResponse("TRANSACTION", dbName, {
            statementsExecuted: statements.length,
            message: "All statements executed successfully",
          }),
        },
      ],
    };
  } catch (error) {
    logMutation("TRANSACTION_FAILED", dbName, {
      statementCount: statements.length,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      content: [
        {
          type: "text",
          text: `Error: Transaction failed and was rolled back. ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
};

// Tool definitions for write operations
export const writeToolDefinitions = [
  {
    name: "insert_data",
    description:
      "Insert test records into a table with automatic FK validation. Wrapped in transaction with auto-rollback on error.",
    inputSchema: {
      type: "object",
      properties: {
        table_name: {
          type: "string",
          description: "Name of the table to insert into",
        },
        data: {
          type: "object",
          description: "Key-value pairs for the record (column: value)",
        },
        database: {
          type: "string",
          description: "Exact database name. Call list_databases to see what's available. If omitted, supply 'project' instead.",
        },
        project: {
          type: "string",
          description: "Project name (e.g. 'RobotiMaster'). MCP resolves it to the matching DB (e.g. 'MTMRobot'). Ignored when 'database' is supplied.",
        },
        validate_fk: {
          type: "boolean",
          description: "Validate foreign key constraints before insert (default: true)",
        },
      },
      required: ["table_name", "data"],
    },
  },
  {
    name: "update_data",
    description:
      "Update existing records in a table. REQUIRES CONFIRMATION. Wrapped in transaction with auto-rollback on error.",
    inputSchema: {
      type: "object",
      properties: {
        table_name: {
          type: "string",
          description: "Name of the table to update",
        },
        data: {
          type: "object",
          description: "Key-value pairs to update (column: new_value)",
        },
        where_clause: {
          type: "string",
          description: "WHERE clause to identify records (e.g., 'LoadCarrierId = \\'xxx\\'')",
        },
        database: {
          type: "string",
          description: "Exact database name. Call list_databases to see what's available. If omitted, supply 'project' instead.",
        },
        project: {
          type: "string",
          description: "Project name (e.g. 'RobotiMaster'). MCP resolves it to the matching DB (e.g. 'MTMRobot'). Ignored when 'database' is supplied.",
        },
        confirmed: {
          type: "boolean",
          description: "Must be true to execute. Safety confirmation flag.",
        },
      },
      required: ["table_name", "data", "where_clause", "confirmed"],
    },
  },
  {
    name: "delete_data",
    description:
      "Delete records from a table. REQUIRES CONFIRMATION. Wrapped in transaction with auto-rollback on error.",
    inputSchema: {
      type: "object",
      properties: {
        table_name: {
          type: "string",
          description: "Name of the table to delete from",
        },
        where_clause: {
          type: "string",
          description: "WHERE clause to identify records to delete (e.g., 'Barcode = \\'TEST-001\\'')",
        },
        database: {
          type: "string",
          description: "Exact database name. Call list_databases to see what's available. If omitted, supply 'project' instead.",
        },
        project: {
          type: "string",
          description: "Project name (e.g. 'RobotiMaster'). MCP resolves it to the matching DB (e.g. 'MTMRobot'). Ignored when 'database' is supplied.",
        },
        confirmed: {
          type: "boolean",
          description: "Must be true to execute. Safety confirmation flag.",
        },
      },
      required: ["table_name", "where_clause", "confirmed"],
    },
  },
  {
    name: "truncate_table",
    description:
      "Clear all data from a table. REQUIRES CONFIRMATION. Only works on tables with 'Test' prefix or in whitelist. Wrapped in transaction.",
    inputSchema: {
      type: "object",
      properties: {
        table_name: {
          type: "string",
          description: "Name of the table to truncate (must start with 'Test' or be whitelisted)",
        },
        database: {
          type: "string",
          description: "Exact database name. Call list_databases to see what's available. If omitted, supply 'project' instead.",
        },
        project: {
          type: "string",
          description: "Project name (e.g. 'RobotiMaster'). MCP resolves it to the matching DB (e.g. 'MTMRobot'). Ignored when 'database' is supplied.",
        },
        confirmed: {
          type: "boolean",
          description: "Must be true to execute. Safety confirmation flag.",
        },
      },
      required: ["table_name", "confirmed"],
    },
  },
  {
    name: "execute_transaction",
    description:
      "Execute multiple SQL statements as a single transaction with automatic rollback on any error. All statements succeed or all fail.",
    inputSchema: {
      type: "object",
      properties: {
        statements: {
          type: "array",
          description: "Array of SQL statements to execute in order",
          items: {
            type: "string",
          },
        },
        database: {
          type: "string",
          description: "Exact database name. Call list_databases to see what's available. If omitted, supply 'project' instead.",
        },
        project: {
          type: "string",
          description: "Project name (e.g. 'RobotiMaster'). MCP resolves it to the matching DB (e.g. 'MTMRobot'). Ignored when 'database' is supplied.",
        },
        confirmed: {
          type: "boolean",
          description: "Must be true for mutations. Safety confirmation flag.",
        },
      },
      required: ["statements", "confirmed"],
    },
  },
];
