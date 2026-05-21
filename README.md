# SQL Server MCP Server - Agito Robot Project

MCP (Model Context Protocol) server for SQL Server LocalDB, designed for the Agito Robot project with comprehensive database testing and manipulation capabilities.

## Version

**v0.4.0 - Phase 4: Dynamic Discovery**

## Features

### Phase 1 - Read-Only Operations (Safe Exploration)
- Execute SELECT queries safely
- List all tables in a database
- Describe table schemas (columns, data types, constraints)
- Show foreign key relationships
- Get sample data from tables

### Phase 2 - Write Operations (With Safety Mechanisms)
- Insert test records with automatic FK validation
- Update existing records (requires confirmation)
- Delete records (requires confirmation)
- Truncate tables (requires confirmation + whitelist)
- Execute transactions with automatic rollback on errors

### Phase 3 - Advanced Operations (Diagnostics & Multi-Environment)
- **Stored Procedure Discovery**: List and inspect stored procedures with parameters and definitions
- **Index Analysis**: Identify missing, fragmented, and unused indexes with performance recommendations
- **Backup Verification**: Validate backup file integrity and metadata
- **Schema Comparison**: Compare database schemas across environments (LOCAL, ISIT, PreProd, PROD)
- **Sync Validation**: Check data synchronization across multiple environments
- **Migration Generation**: Auto-generate SQL migration scripts from schema differences
- **Change Tracking**: Track recent INSERT/UPDATE/DELETE operations using timestamps
- **Health Checks**: Comprehensive daily diagnostics with health scoring and recommendations
- **Natural Language Queries**: AI-assisted SQL query generation from natural language questions
- **Test Data Generation**: AI-assisted realistic test data generation with FK dependency awareness

## Architecture

### Modular Structure

The codebase is organized into logical modules for maintainability:

```
src/
├── index.ts                    # Main entry point and tool registration
├── config/
│   ├── environments.ts         # Multi-environment configuration
│   └── constants.ts            # Constants and thresholds
├── core/
│   ├── connection.ts           # Connection string management
│   ├── query.ts                # Query execution and transactions
│   └── validation.ts           # Input validation and FK checking
├── tools/
│   ├── read-tools.ts           # Phase 1 read-only tools
│   ├── write-tools.ts          # Phase 2 write tools
│   └── advanced-tools.ts       # Phase 3 advanced tools
├── services/
│   ├── schema-service.ts       # Schema comparison and sync validation
│   ├── health-service.ts       # Health checks, index analysis, change tracking
│   ├── migration-service.ts    # Migration script generation
│   └── backup-service.ts       # Backup verification
└── utils/
    ├── logging.ts              # Mutation logging and log analysis
    └── formatters.ts           # Response formatting
```

### Multi-Environment Support

The server supports multiple environments. The `LOCAL` server target is read at startup from the `SQLSERVER_HOST` environment variable — there is no hardcoded server, so each developer points the MCP at their own SQL Server instance.

- **LOCAL**: configured per-developer via `SQLSERVER_HOST` (e.g. `(localdb)\MSSQLLocalDB`, `localhost`, `localhost\SQLEXPRESS`)
- **ISIT / PreProd / PROD**: register additional environments in `src/config/environments.ts` as your team needs them

### Dynamic Database Discovery

The list of databases is **not hardcoded**. On startup the server queries `sys.databases` on the configured SQL Server and caches every user database (system DBs — `master`, `tempdb`, `model`, `msdb` — are excluded). Adding a new database to the server makes it instantly available to the MCP; call `list_databases` with `refresh: true` to pick up changes without restarting.

### Project-to-Database Resolution

Every database-aware tool accepts either an explicit `database` or a `project` name. When you pass `project: "RobotiMaster"` the server resolves to `MTMRobot` by:

1. Checking `MCP_PROJECT_OVERRIDES` (env var, JSON map of explicit overrides)
2. Exact `MTM<project>` match (e.g. `HFGStack` → `MTMHFGStack`)
3. Raw `<project>` match
4. Fuzzy stem match against `MTM*` databases (e.g. `RobotiMaster` shares the `Robot` stem with `MTMRobot`)

`MTMCore` is treated as a shared database and is reported alongside the resolved project DB. Use the `resolve_project` tool to preview the resolution for any project name.

## Safety Features

### Confirmation Requirements
All destructive operations (UPDATE, DELETE, TRUNCATE, TRANSACTION with mutations) require explicit confirmation by setting `confirmed: true` in the request parameters.

### Whitelist Protection
The `truncate_table` tool only works on:
- Tables with names starting with "Test"
- Tables explicitly whitelisted in the code

### Transaction Management
- All write operations are wrapped in transactions
- Automatic rollback on any error
- All-or-nothing execution for multi-statement transactions

### Foreign Key Validation
- INSERT operations automatically validate FK constraints before execution
- Prevents orphaned records
- Can be disabled with `validate_fk: false`

### SQL Injection Prevention
- Table names are validated (alphanumeric + underscores only)
- Values are properly escaped
- WHERE clauses are required for UPDATE/DELETE operations

### Mutation Logging
All write operations are logged to `logs/mutations-YYYY-MM-DD.log` with:
- Timestamp
- Operation type
- Database name
- Details (affected tables, data, errors)

## Available Tools (20 Total)

### Phase 1: Read-Only Tools

#### execute_query
Execute SELECT queries on TestRobot or WCSTest database.

```json
{
  "query": "SELECT * FROM LoadCarriers WHERE LoadCarrierType = 4",
  "database": "TestRobot"
}
```

#### list_tables
List all tables in the specified database.

```json
{
  "database": "TestRobot"
}
```

#### describe_table
Get detailed schema information for a specific table.

```json
{
  "table_name": "LoadCarriers",
  "database": "TestRobot"
}
```

#### show_foreign_keys
Show foreign key relationships for a table or entire database.

```json
{
  "table_name": "LoadCarriers",
  "database": "TestRobot"
}
```

#### get_sample_data
Get sample rows from a table.

```json
{
  "table_name": "LoadCarriers",
  "limit": 10,
  "database": "TestRobot"
}
```

### Phase 2: Write Tools

#### insert_data
Insert test records with automatic FK validation.

```json
{
  "table_name": "LoadCarriers",
  "data": {
    "LoadCarrierId": "12345678-1234-1234-1234-123456789012",
    "Barcode": "TEST-001",
    "SourceLocationId": "existing-location-id",
    "LoadCarrierType": 4,
    "CurrentStatus": 0,
    "CreatedBy": "SYSTEM",
    "Deleted": false,
    "PositionIndex": 0
  },
  "database": "TestRobot",
  "validate_fk": true
}
```

**Features:**
- Automatic FK validation (default: enabled)
- Transaction-wrapped with auto-rollback
- Logged to mutation log

#### update_data
Update existing records (requires confirmation).

```json
{
  "table_name": "LoadCarriers",
  "data": {
    "CurrentStatus": 3,
    "UpdatedBy": "SYSTEM",
    "UpdateDate": "2025-10-31T10:00:00Z"
  },
  "where_clause": "Barcode = 'TEST-001'",
  "database": "TestRobot",
  "confirmed": true
}
```

**Safety:**
- Requires `confirmed: true`
- WHERE clause is mandatory
- Transaction-wrapped with auto-rollback
- Logged to mutation log

#### delete_data
Delete records (requires confirmation).

```json
{
  "table_name": "LoadCarriers",
  "where_clause": "Barcode = 'TEST-001'",
  "database": "TestRobot",
  "confirmed": true
}
```

**Safety:**
- Requires `confirmed: true`
- WHERE clause is mandatory
- Returns count of deleted records
- Transaction-wrapped with auto-rollback
- Logged to mutation log

#### truncate_table
Clear all data from a table (requires confirmation + whitelist).

```json
{
  "table_name": "TestLoadCarriers",
  "database": "TestRobot",
  "confirmed": true
}
```

**Safety:**
- Requires `confirmed: true`
- Only works on tables starting with "Test" or in whitelist
- Returns count of deleted records
- Transaction-wrapped with auto-rollback
- Logged to mutation log

#### execute_transaction
Execute multiple SQL statements as a single transaction.

```json
{
  "statements": [
    "INSERT INTO TestTable (Col1, Col2) VALUES ('A', 1)",
    "UPDATE TestTable SET Col2 = 2 WHERE Col1 = 'A'",
    "DELETE FROM TestTable WHERE Col1 = 'B'"
  ],
  "database": "TestRobot",
  "confirmed": true
}
```

**Features:**
- All statements succeed or all fail (atomic)
- Automatic rollback on any error
- Requires confirmation if any mutations are present
- Logged to mutation log

### Phase 3: Advanced Tools

#### list_stored_procedures
Discover stored procedures in the database with filtering options.

```json
{
  "database": "TestRobot",
  "schema": "dbo",
  "name_pattern": "sp_Get%"
}
```

**Features:**
- Filter by schema and name pattern
- View creation and modification dates
- Works across all configured databases

#### describe_procedure
Get detailed information about a specific stored procedure.

```json
{
  "database": "TestRobot",
  "procedure_name": "sp_GetLoadCarriers",
  "include_definition": true
}
```

**Returns:**
- Parameters with data types and modes (IN/OUT/INOUT)
- Full procedure definition (SQL code)
- Comprehensive metadata (schema, type, return type, dates)

#### analyze_indexes
Database performance health check for indexes.

```json
{
  "database": "TestRobot",
  "table_name": "LoadCarriers",
  "min_fragmentation": 30,
  "include_usage_stats": true
}
```

**Identifies:**
- **Missing indexes** with impact scores and CREATE statements
- **Fragmented indexes** (>30% fragmentation) with REBUILD/REORGANIZE recommendations
- **Unused indexes** (0 seeks/scans) with DROP statements
- Usage statistics (seeks, scans, lookups, updates)

#### verify_backup
Database backup file verification and integrity checking.

```json
{
  "backup_file_path": "C:\\Backups\\TestRobot_2026-01-17.bak",
  "verification_type": "quick",
  "compare_to_database": "TestRobot"
}
```

**Verification modes:**
- **Quick**: RESTORE HEADERONLY and RESTORE VERIFYONLY
- **Full**: Restore to temp database, run DBCC CHECKDB, cleanup

**Returns:**
- Backup metadata (database name, server, dates, type, compression)
- File existence and size validation
- Optional comparison to live database (table counts)
- Age warnings for old backups

#### compare_schemas
Compare database schemas between environments.

```json
{
  "source_environment": "LOCAL",
  "target_environment": "ISIT",
  "database_name": "MTMRobot",
  "include_indexes": true,
  "include_procedures": false
}
```

**Compares:**
- Tables (structure, existence)
- Columns (types, nullability)
- Constraints (primary keys, unique, check)
- Foreign keys
- Indexes (optional)
- Stored procedures (optional)

**Returns:**
- Objects only in source or target
- Type mismatches and structural differences
- Detailed diff with summary statistics

#### validate_sync
Check data synchronization across multiple environments.

```json
{
  "environments": ["LOCAL", "ISIT"],
  "database_name": "MTMCore",
  "table_names": ["LocationType", "LoadCarrierType"],
  "comparison_mode": "exact",
  "check_row_counts": true
}
```

**Features:**
- Validates row counts across environments
- Supports exact and subset comparison modes
- Identifies sync issues per table
- Summary of in-sync vs out-of-sync tables

#### generate_migration
Auto-generate SQL migration scripts from schema differences.

```json
{
  "source_environment": "ISIT",
  "target_environment": "LOCAL",
  "database_name": "MTMRobot",
  "include_drops": false,
  "dry_run": true
}
```

**Generates:**
- ALTER TABLE statements for missing columns
- CREATE INDEX statements for missing indexes
- CREATE TABLE templates (requires manual completion)
- Optional DROP statements (DESTRUCTIVE mode)
- Transaction-wrapped with safety warnings

**Default:** Dry-run mode (review before executing)

#### get_recent_changes
Track data changes using timestamp columns.

```json
{
  "database": "TestRobot",
  "table_name": "LoadCarriers",
  "time_window_hours": 24,
  "change_types": ["INSERT", "UPDATE", "DELETE"],
  "limit": 100
}
```

**Features:**
- Automatically detects CreateDate, UpdateDate, DeleteDate columns
- Tracks INSERT, UPDATE, DELETE operations
- Configurable time window (default: 24 hours)
- Filter by change type and table
- Returns detailed change log with summaries

#### daily_health_check
Automated comprehensive diagnostics with health scoring.

```json
{
  "database": "TestRobot",
  "compare_to_environment": "ISIT"
}
```

**Checks:**
- Orphaned records (FK violations)
- Data consistency validation (duplicates, nulls in required fields)
- Row counts for all tables
- Mutation log error analysis
- Index health summary (missing, fragmented, unused)

**Returns:**
- Health score (0-100) based on weighted checks
- Status (HEALTHY/WARNING/CRITICAL)
- Actionable recommendations

**Health Scoring:**
- Starts at 100 points
- Deductions: -15 for orphans, -10 for consistency issues, -10 for log errors, -15 for missing indexes, -10 for fragmentation
- HEALTHY (≥80), WARNING (≥60), CRITICAL (<60)

#### nl_to_query
Natural language to SQL query conversion with AI assistance.

```json
{
  "database": "MTMRobot",
  "question": "Find all load carriers that haven't moved in 7 days",
  "provide_schema_context": true,
  "execute": false,
  "limit": 100
}
```

**Features:**
- Provides comprehensive schema context (tables, columns, types, relationships)
- Retrieves foreign key relationships
- Includes sample enum values from small lookup tables
- AI-assisted query generation within Claude Code conversation
- Optional query execution with configurable row limit

**Workflow:**
1. Tool provides schema context
2. Claude (in conversation) generates SQL query
3. Optionally execute with `execute: true`

#### generate_test_data
AI-assisted realistic test data generation with FK dependency awareness.

```json
{
  "database": "TestRobot",
  "scenario": "palletizing workflow with 5 load carriers and 3 missions",
  "record_count": 5,
  "include_related": true,
  "dry_run": true
}
```

**Features:**
- Complete schema analysis with column types and constraints
- Builds dependency graph from FK relationships
- Topological sort for correct insertion order (parents before children)
- Sample data for pattern recognition
- Enum/lookup table values extraction
- AI-assisted INSERT statement generation within Claude Code conversation

**Workflow:**
1. Tool provides schema analysis and dependency graph
2. Claude (in conversation) generates realistic INSERT statements
3. Tool validates and executes if approved

**Default:** Dry-run mode (review before executing)

## Configuration

### Databases
Databases are discovered at runtime from `sys.databases` on the configured SQL Server. There is **no hardcoded list** — whatever exists on your server is automatically available. Call `list_databases` to see what was discovered, or `list_databases` with `refresh: true` to re-query after creating a new database.

### Environments
The `LOCAL` environment is defined in `src/config/environments.ts` and reads its server from `SQLSERVER_HOST`. To add ISIT / PreProd / PROD, register them in the same file:

```typescript
export const environments: Record<string, EnvironmentConfig> = {
  LOCAL: {
    name: "LOCAL",
    server: localServer, // from SQLSERVER_HOST
    authentication: "windows",
  },
  ISIT: {
    name: "ISIT",
    server: "isit-server.company.com",
    authentication: "windows",
    readonly: true,
  },
};
```

### Connection
- **Server**: read from `SQLSERVER_HOST` (required — no default)
- **Authentication**: Windows Trusted Connection
- **Driver**: ODBC Driver 17 for SQL Server
- **Multi-environment**: register additional environments in code as needed

### Truncate Whitelist
Edit `TRUNCATE_WHITELIST` in `src/config/constants.ts` to add tables:

```typescript
const TRUNCATE_WHITELIST = [
  "TestOrders",
  "TestLoadCarriers",
  "TestEquipment",
  "TestLocations",
  // Add more as needed
];
```

## Installation

### Prerequisites

- **Node.js** 18+ and npm
- **SQL Server** reachable from your machine (LocalDB, Express, or full SQL Server). Note your connection target — you'll need it for `SQLSERVER_HOST`.
- **ODBC Driver 17 for SQL Server** installed locally. Download from Microsoft if not already present.
- **Windows authentication** is the assumed mode. SQL authentication can be added by populating `username` / `password` on the environment config.

### Setup

1. Clone the repo and install dependencies:
   ```bash
   npm install
   ```

2. Build the project:
   ```bash
   npm run build
   ```

3. Identify your SQL Server connection target. Common values:
   - `(localdb)\MSSQLLocalDB` — default SQL Server LocalDB instance
   - `(localdb)\SQLLocalEXP01` — a custom-named LocalDB instance
   - `localhost` — default SQL Server install on the local machine
   - `localhost\SQLEXPRESS` — SQL Server Express default

   See `.env.example` for more examples.

4. Configure the MCP in your Claude Code `.mcp.json`. Use a path that works on your machine and set `SQLSERVER_HOST` in the `env` block:

   ```json
   {
     "mcpServers": {
       "sqlserver-agito": {
         "command": "node",
         "args": ["<absolute-path-to-repo>/build/index.js"],
         "env": {
           "SQLSERVER_HOST": "(localdb)\\MSSQLLocalDB"
         }
       }
     }
   }
   ```

   On Windows, the path looks like `C:\\Users\\<you>\\path\\to\\sqlserver-agito-mcp\\build\\index.js`. On macOS / Linux, `/Users/<you>/path/to/sqlserver-agito-mcp/build/index.js`.

5. (Optional) If the project-name resolver picks the wrong DB for any of your projects, add overrides:
   ```json
   "env": {
     "SQLSERVER_HOST": "(localdb)\\MSSQLLocalDB",
     "MCP_PROJECT_OVERRIDES": "{\"LegacyName\":\"MTMSomething\"}"
   }
   ```

6. Restart Claude Code. On startup the MCP logs `Discovered N database(s) on LOCAL: ...` to stderr — verify it sees what you expect.

## Logging

Mutation logs are stored in `logs/mutations-YYYY-MM-DD.log` with the following format:

```json
{
  "timestamp": "2025-10-31T10:00:00.000Z",
  "operation": "INSERT",
  "database": "TestRobot",
  "details": {
    "table": "LoadCarriers",
    "data": { ... }
  }
}
```

Failed operations are logged with error details for troubleshooting.

## Development

### Build
```bash
npm run build
```

### Watch mode
```bash
npm run watch
```

### Start
```bash
npm start
```

## Safety Best Practices

1. Always use test data in TestRobot/WCSTest databases
2. Review WHERE clauses carefully before confirming DELETE/UPDATE
3. Test with small datasets first
4. Check mutation logs regularly
5. Backup databases before bulk operations
6. Use transactions for related operations
7. Validate foreign keys before inserting related data

## Error Handling

All write operations include:
- Automatic transaction rollback on errors
- Detailed error messages
- Mutation logging (both success and failure)
- FK validation before inserts

If an operation fails, check:
1. The mutation log for details
2. FK constraints and referenced data
3. Table/column names are correct
4. WHERE clauses are properly formatted
5. Data types match schema requirements

## Known Limitations

### Phase 3 Tools
1. **Schema Comparison**: Limited to structural differences; does not compare stored procedure logic line-by-line
2. **Migration Generation**: CREATE TABLE, FK, and Index definitions generate TODO placeholders requiring manual completion
3. **Change Tracking**: Requires timestamp columns to exist; no support for SQL Server Change Data Capture (CDC)
4. **Health Check**: Orphan record checking limited to first 10 FKs for performance optimization
5. **AI-Assisted Tools**: Provide schema context; actual SQL generation happens in conversation with Claude (no separate API calls)

### Performance Considerations
- Schema comparison: O(tables × columns) complexity
- Parallel environment queries improve multi-environment tool performance
- Health check optimized to check subset of FKs (configurable)
- Change tracking scans timestamp columns only (indexed recommended)
- Test data generation provides dependency graph upfront

### Security Notes
- Multi-environment support includes readonly flag for production protection
- Environment configurations allow controlled access to different servers
- All write operations still require confirmation flags
- Migration scripts default to dry-run mode

## Version History

See [CHANGELOG.md](CHANGELOG.md) for detailed version history and release notes.

- **v0.3.0** (2026-01-17): Phase 3 - Advanced Operations with 10 new diagnostic and multi-environment tools
- **v0.2.0** (2025-10-31): Phase 2 - Write Operations with safety mechanisms
- **v0.1.0** (2025-10-XX): Phase 1 - Initial release with read-only tools

## License

MIT

## Author

Attuul Geriyan
