import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// Import core modules
import { getConnectionString } from "./core/connection.js";

// Import tool definitions and handlers
import {
  readToolDefinitions,
  executeQuery,
  listTables,
  describeTable,
  showForeignKeys,
  getSampleData,
} from "./tools/read-tools.js";

import {
  writeToolDefinitions,
  insertData,
  updateData,
  deleteData,
  truncateTable,
  executeTransaction,
} from "./tools/write-tools.js";

import {
  advancedToolDefinitions,
  listStoredProcedures,
  describeProcedure,
  analyzeIndexes,
  verifyBackup,
  compareSchemas,
  validateSync,
  generateMigration,
  getRecentChanges,
  dailyHealthCheck,
  nlToQuery,
  generateTestData,
} from "./tools/advanced-tools.js";

// Server setup
const server = new Server(
  {
    name: "sqlserver-agito",
    version: "0.3.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Tool definitions - combine all tool definitions
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      ...readToolDefinitions,
      ...writeToolDefinitions,
      ...advancedToolDefinitions,
    ],
  };
});

// Tool execution handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const dbName = (args?.database as string) || "TestRobot";
    const connString = getConnectionString(dbName);

    // Read-only tools
    switch (name) {
      case "execute_query":
        return await executeQuery(connString, dbName, args?.query as string);

      case "list_tables":
        return await listTables(connString, dbName);

      case "describe_table":
        return await describeTable(connString, dbName, args?.table_name as string);

      case "show_foreign_keys":
        return await showForeignKeys(connString, dbName, args?.table_name as string);

      case "get_sample_data":
        return await getSampleData(
          connString,
          dbName,
          args?.table_name as string,
          args?.limit as number
        );

      // Write tools
      case "insert_data":
        return await insertData(
          connString,
          dbName,
          args?.table_name as string,
          args?.data as Record<string, any>,
          args?.validate_fk !== false
        );

      case "update_data":
        return await updateData(
          connString,
          dbName,
          args?.table_name as string,
          args?.data as Record<string, any>,
          args?.where_clause as string,
          args?.confirmed as boolean
        );

      case "delete_data":
        return await deleteData(
          connString,
          dbName,
          args?.table_name as string,
          args?.where_clause as string,
          args?.confirmed as boolean
        );

      case "truncate_table":
        return await truncateTable(
          connString,
          dbName,
          args?.table_name as string,
          args?.confirmed as boolean
        );

      case "execute_transaction":
        return await executeTransaction(
          connString,
          dbName,
          args?.statements as string[],
          args?.confirmed as boolean
        );

      // Advanced tools - Phase 2+
      case "list_stored_procedures":
        return await listStoredProcedures(
          connString,
          dbName,
          args?.schema as string,
          args?.name_pattern as string
        );

      case "describe_procedure":
        return await describeProcedure(
          connString,
          dbName,
          args?.procedure_name as string,
          args?.include_definition !== false
        );

      case "analyze_indexes":
        return await analyzeIndexes(
          connString,
          dbName,
          args?.table_name as string,
          args?.min_fragmentation as number,
          args?.include_usage_stats as boolean
        );

      case "verify_backup":
        return await verifyBackup(
          connString,
          dbName,
          args?.backup_file_path as string,
          args?.verification_type as "quick" | "full",
          args?.compare_to_database as string
        );

      case "compare_schemas":
        return await compareSchemas(
          args?.source_environment as string,
          args?.target_environment as string,
          args?.database_name as string,
          args?.include_indexes as boolean,
          args?.include_procedures as boolean
        );

      case "validate_sync":
        return await validateSync(
          args?.environments as string[],
          args?.database_name as string,
          args?.table_names as string[],
          args?.comparison_mode as "exact" | "subset",
          args?.check_row_counts as boolean
        );

      case "generate_migration":
        return await generateMigration(
          args?.source_environment as string,
          args?.target_environment as string,
          args?.database_name as string,
          args?.include_drops as boolean,
          args?.dry_run as boolean
        );

      case "get_recent_changes":
        return await getRecentChanges(
          connString,
          dbName,
          args?.table_name as string,
          args?.time_window_hours as number,
          args?.change_types as string[],
          args?.limit as number
        );

      case "daily_health_check":
        return await dailyHealthCheck(
          connString,
          dbName,
          args?.compare_to_environment as string
        );

      case "nl_to_query":
        return await nlToQuery(
          connString,
          dbName,
          args?.question as string,
          args?.provide_schema_context as boolean,
          args?.execute as boolean,
          args?.limit as number
        );

      case "generate_test_data":
        return await generateTestData(
          connString,
          dbName,
          args?.scenario as string,
          args?.record_count as number,
          args?.include_related as boolean,
          args?.dry_run as boolean
        );

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
  console.error("SQL Server MCP server running on stdio (v0.3.0)");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
