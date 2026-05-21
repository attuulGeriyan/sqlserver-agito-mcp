import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// Core
import { getConnectionString } from "./core/connection.js";
import { resolveProjectDatabases } from "./core/project-resolver.js";
import {
  discoverDatabases,
  getDatabases,
  refreshDatabases,
  getEnvironment,
} from "./config/environments.js";

// Tool definitions and handlers
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

const DEFAULT_ENV = "LOCAL";

// Discovery & resolution tools (built-in, not from tool modules)
const discoveryToolDefinitions = [
  {
    name: "list_databases",
    description:
      "List all user databases discovered on the configured SQL Server. System databases (master, tempdb, model, msdb) are excluded.",
    inputSchema: {
      type: "object",
      properties: {
        refresh: {
          type: "boolean",
          description: "If true, re-query sys.databases instead of returning the cached list (default: false).",
        },
      },
    },
  },
  {
    name: "resolve_project",
    description:
      "Resolve a project name (e.g. 'RobotiMaster') to its database (e.g. 'MTMRobot') plus shared DBs (MTMCore). Use this to verify which DB Claude should target before issuing tool calls.",
    inputSchema: {
      type: "object",
      properties: {
        project: {
          type: "string",
          description: "Project name to resolve (e.g. 'RobotiMaster', 'HFGStack').",
        },
      },
      required: ["project"],
    },
  },
];

// Resolve the target database for a tool call, honoring 'database' first, then 'project'.
const resolveTargetDatabase = (args: Record<string, any> | undefined): string => {
  const explicit = (args?.database as string | undefined)?.trim();
  if (explicit) return explicit;

  const project = (args?.project as string | undefined)?.trim();
  if (project) {
    const resolved = resolveProjectDatabases(project, getDatabases(DEFAULT_ENV));
    if (!resolved.project) {
      throw new Error(
        `Could not resolve project '${project}' to a database. ${resolved.reasoning} ` +
          `Available databases: ${getDatabases(DEFAULT_ENV).join(", ") || "(none discovered)"}.`
      );
    }
    return resolved.project;
  }

  throw new Error(
    "Missing 'database' or 'project'. Pass an exact database name, or pass a project name and let MCP resolve it."
  );
};

const server = new Server(
  {
    name: "sqlserver-agito",
    version: "0.4.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      ...discoveryToolDefinitions,
      ...readToolDefinitions,
      ...writeToolDefinitions,
      ...advancedToolDefinitions,
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    // Discovery tools — no database needed
    if (name === "list_databases") {
      const shouldRefresh = args?.refresh === true;
      const dbs = shouldRefresh
        ? await refreshDatabases(DEFAULT_ENV)
        : getDatabases(DEFAULT_ENV);
      const env = getEnvironment(DEFAULT_ENV);
      return {
        content: [
          {
            type: "text",
            text:
              `Server: ${env.server}\n` +
              `Environment: ${env.name}\n` +
              `Databases (${dbs.length}):\n` +
              (dbs.length ? dbs.map((d) => `  - ${d}`).join("\n") : "  (none)"),
          },
        ],
      };
    }

    if (name === "resolve_project") {
      const project = (args?.project as string)?.trim();
      const resolved = resolveProjectDatabases(project, getDatabases(DEFAULT_ENV));
      const lines = [
        `Project:   ${project}`,
        `Resolved:  ${resolved.project ?? "(no match)"}`,
        `Shared:    ${resolved.shared.length ? resolved.shared.join(", ") : "(none)"}`,
        `Reasoning: ${resolved.reasoning}`,
      ];
      return { content: [{ type: "text", text: lines.join("\n") }] };
    }

    // All other tools: resolve target DB then build conn string
    const dbName = resolveTargetDatabase(args as Record<string, any> | undefined);
    const connString = getConnectionString(dbName);

    switch (name) {
      // Read-only tools
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

      // Advanced tools
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

async function main() {
  // Discover databases up front so resolve / validation work immediately.
  try {
    const dbs = await discoverDatabases(DEFAULT_ENV);
    console.error(`Discovered ${dbs.length} database(s) on ${DEFAULT_ENV}: ${dbs.join(", ")}`);
  } catch (err) {
    console.error(
      `Warning: failed to discover databases on startup: ${err instanceof Error ? err.message : String(err)}. ` +
        `Tools may fail until 'list_databases' (refresh=true) succeeds.`
    );
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("SQL Server MCP server running on stdio (v0.4.0)");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
