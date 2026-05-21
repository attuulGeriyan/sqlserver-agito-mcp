import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import v8 from "msnodesqlv8";
import { promisify } from "util";

// SQL Server connection string for LocalDB
const getConnectionString = (database: string) =>
  `Driver={ODBC Driver 17 for SQL Server};Server=(localdb)\\SQLLocalEXP01;Database=${database};Trusted_Connection=Yes;`;

// Promisified query function
const query = (connectionString: string, sql: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    v8.query(connectionString, sql, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
};

// Server setup
const server = new Server(
  {
    name: "sqlserver-agito",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Tool definitions
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "execute_query",
        description:
          "Execute a SELECT query on TestRobot or WCSTest database. Read-only, safe for exploration.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "The SELECT SQL query to execute",
            },
            database: {
              type: "string",
              enum: ["TestRobot", "WCSTest"],
              description: "Which database to query (default: TestRobot)",
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
              enum: ["TestRobot", "WCSTest"],
              description: "Which database to list tables from (default: TestRobot)",
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
              enum: ["TestRobot", "WCSTest"],
              description: "Which database the table is in (default: TestRobot)",
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
              enum: ["TestRobot", "WCSTest"],
              description: "Which database to query (default: TestRobot)",
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
              enum: ["TestRobot", "WCSTest"],
              description: "Which database the table is in (default: TestRobot)",
            },
          },
          required: ["table_name"],
        },
      },
    ],
  };
});

// Tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const dbName = (args?.database as string) || "TestRobot";
    const connString = getConnectionString(dbName);

    switch (name) {
      case "execute_query": {
        const queryText = args?.query as string;

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
              text: JSON.stringify(
                {
                  rowCount: results.length,
                  data: results,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "list_tables": {
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
              text: JSON.stringify(
                {
                  database: dbName,
                  tables: results,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "describe_table": {
        const tableName = args?.table_name as string;

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
              text: JSON.stringify(
                {
                  database: dbName,
                  table: tableName,
                  columns: columns,
                  constraints: constraints,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "show_foreign_keys": {
        const tableName = args?.table_name as string;

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
              text: JSON.stringify(
                {
                  database: dbName,
                  table: tableName || "all",
                  foreignKeys: results,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "get_sample_data": {
        const tableName = args?.table_name as string;
        const limit = Math.min((args?.limit as number) || 10, 100);

        const results = await query(
          connString,
          `SELECT TOP ${limit} * FROM [${tableName}]`
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  database: dbName,
                  table: tableName,
                  rowCount: results.length,
                  sampleData: results,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      default:
        return {
          content: [
            {
              type: "text",
              text: `Unknown tool: ${name}`,
            },
          ],
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("SQL Server MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
