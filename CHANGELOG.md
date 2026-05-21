# Changelog

All notable changes to this project will be documented in this file.

## [0.3.0] - 2026-01-17 - Phase 3: Advanced Operations

### Added

#### Architecture Improvements
- **Modular Code Structure**: Refactored monolithic `index.ts` (1113 lines) into organized modules:
  - `src/config/` - Environment and constants configuration
  - `src/core/` - Connection, query execution, and validation
  - `src/tools/` - Tool handlers organized by category (read, write, advanced)
  - `src/services/` - Business logic for schema, health, migration, and backup
  - `src/utils/` - Logging and formatting utilities
- **Multi-Environment Support**: Configuration system for LOCAL, ISIT, PreProd, and PROD environments
- **Environment Configuration**: Dynamic database configuration with support for multiple environments

#### Phase 2: Simple Tools (3 new tools)

- **list_stored_procedures**: Discover stored procedures in the database
  - Filter by schema and name pattern
  - View creation and modification dates
  - Supports all configured databases

- **describe_procedure**: Get detailed stored procedure information
  - View parameters with data types and modes (IN/OUT/INOUT)
  - Retrieve full procedure definition (SQL code)
  - Comprehensive metadata (schema, type, return type, dates)

- **analyze_indexes**: Database performance health check
  - Identifies missing indexes with impact scores and CREATE statements
  - Detects fragmented indexes (>30% fragmentation) with REBUILD/REORGANIZE recommendations
  - Finds unused indexes (0 seeks/scans) with DROP statements
  - Includes usage statistics (seeks, scans, lookups, updates)
  - Configurable fragmentation threshold and usage stats

- **verify_backup**: Database backup file verification
  - Quick mode: RESTORE HEADERONLY and RESTORE VERIFYONLY
  - Backup metadata extraction (database name, server, dates, type, compression)
  - File existence and size validation
  - Optional comparison to live database (table counts)
  - Age warnings for old backups

#### Phase 3: Multi-Environment Tools (3 new tools)

- **compare_schemas**: Compare database schemas between environments
  - Compares tables, columns, constraints, foreign keys, and indexes
  - Detects type mismatches and structural differences
  - Identifies objects only in source or target
  - Detailed diff with summary statistics
  - Optional index and stored procedure comparison

- **validate_sync**: Check data synchronization across environments
  - Validates row counts across multiple environments
  - Supports exact and subset comparison modes
  - Identifies sync issues per table
  - Summary of in-sync vs out-of-sync tables

- **generate_migration**: Auto-generate SQL migration scripts
  - Analyzes schema differences using compare_schemas
  - Generates ALTER TABLE statements for missing columns
  - Creates TODO placeholders for tables, FKs, and indexes
  - Optional DROP statements for objects (DESTRUCTIVE mode)
  - Transaction-wrapped with safety warnings
  - Dry-run mode by default

#### Phase 4: Change Tracking & Health Check (2 new tools)

- **get_recent_changes**: Track data changes using timestamp columns
  - Automatically detects CreateDate, UpdateDate, DeleteDate columns
  - Tracks INSERT, UPDATE, DELETE operations
  - Configurable time window (default: 24 hours)
  - Filter by change type and table
  - Returns detailed change log with summaries

- **daily_health_check**: Automated comprehensive diagnostics
  - Checks for orphaned records (FK violations)
  - Data consistency validation (duplicate checks, etc.)
  - Row counts for all tables
  - Mutation log error analysis
  - Index health summary (missing, fragmented, unused)
  - Health score (0-100) and status (HEALTHY/WARNING/CRITICAL)
  - Actionable recommendations

#### Phase 5: AI-Assisted Tools (2 new tools)

- **nl_to_query**: Natural language to SQL query conversion
  - Provides comprehensive schema context (tables, columns, types, relationships)
  - Retrieves foreign key relationships
  - Includes sample enum values from small lookup tables
  - AI-assisted query generation within Claude Code conversation
  - Optional query execution with configurable row limit

- **generate_test_data**: AI-assisted realistic test data generation
  - Complete schema analysis with column types and constraints
  - Builds dependency graph from FK relationships
  - Topological sort for correct insertion order
  - Sample data for pattern recognition
  - Enum/lookup table values extraction
  - AI-assisted INSERT statement generation within Claude Code conversation
  - Dry-run mode by default

#### Services & Infrastructure

- **Schema Service** (`schema-service.ts`):
  - Schema introspection (tables, columns, constraints, FKs, indexes)
  - Multi-environment schema comparison
  - Data synchronization validation

- **Health Service** (`health-service.ts`):
  - Index analysis and recommendations
  - Change tracking with timestamp detection
  - Multi-faceted health checks with scoring

- **Migration Service** (`migration-service.ts`):
  - Intelligent migration script generation
  - Dependency-aware change ordering
  - Safety warnings and dry-run support

- **Backup Service** (`backup-service.ts`):
  - Backup integrity verification
  - Metadata extraction and validation

- **Enhanced Logging** (`utils/logging.ts`):
  - Mutation log reading and parsing
  - Log statistics for health checks
  - Operation tracking by type

### Changed
- Package version updated to 0.3.0
- Package description updated to "Phase 3: Advanced Operations"
- Server version metadata updated to 0.3.0
- Startup message now displays version number

### Technical Details

#### Modular Architecture
The codebase is now organized into logical modules:
- **Core**: Fundamental operations (connection, query, validation)
- **Tools**: User-facing MCP tool handlers
- **Services**: Business logic and complex operations
- **Utils**: Shared utilities (logging, formatting)
- **Config**: Environment and constant definitions

#### Environment System
```typescript
interface EnvironmentConfig {
  name: string;
  server: string;
  databases: string[];
  authentication: 'windows' | 'sql';
  readonly?: boolean;
}
```

#### Multi-Environment Query Execution
Supports parallel queries across multiple environments with error handling per environment.

#### Timestamp-Based Change Tracking
Automatically discovers and uses timestamp columns matching patterns:
- CreateDate, CreatedDate, CreateDateTime
- UpdateDate, UpdatedDate, ModifiedDate, LastModified
- DeleteDate, DeletedDate

#### Health Score Calculation
- Starts at 100 points
- Deductions:
  - -15 for orphaned records
  - -10 for data consistency issues
  - -10 for >10 errors in mutation logs
  - -15 for >5 missing indexes
  - -10 for >10 fragmented indexes
- Status: HEALTHY (≥80), WARNING (≥60), CRITICAL (<60)

### Breaking Changes
None. All Phase 1 and Phase 2 tools remain fully compatible.

### Migration Guide
1. Rebuild the project: `npm run build`
2. Restart Claude Code to load updated MCP server
3. All existing tools work exactly as before
4. New tools are immediately available

### Known Limitations
1. **Schema Comparison**: Limited to structural differences; does not compare stored procedure logic
2. **Migration Generation**: CREATE TABLE, FK, and Index definitions require manual completion
3. **Change Tracking**: Requires timestamp columns to exist; no support for SQL Server Change Data Capture (CDC)
4. **Health Check**: Orphan record checking limited to first 10 FKs for performance
5. **AI-Assisted Tools**: Provide schema context; actual SQL generation happens in conversation with Claude

### Performance Considerations
- Schema comparison: O(tables × columns) complexity
- Parallel environment queries improve multi-environment tool performance
- Health check optimized to check subset of FKs
- Change tracking scans timestamp columns only
- Test data generation provides dependency graph upfront

### Security Notes
- Multi-environment support includes readonly flag for production protection
- Environment configurations allow controlled access to different servers
- All write operations still require confirmation flags
- Migration scripts default to dry-run mode

### Future Enhancements
- Real ISIT/PreProd/PROD environment configuration (when access available)
- Connection pooling for improved performance
- Scheduled health check automation
- Data migration tools (not just schema)
- Advanced CDC-based change tracking
- Migration script execution with progress tracking

---

## [0.2.0] - 2025-10-31 - Phase 2: Write Operations

### Added

#### New Tools
- **insert_data**: Insert test records into tables with automatic foreign key validation
  - Validates FK constraints before insertion
  - Wrapped in transaction with auto-rollback on error
  - Supports NULL values
  - Optional FK validation disable

- **update_data**: Update existing records with safety confirmation
  - Requires explicit confirmation (`confirmed: true`)
  - Mandatory WHERE clause to prevent accidental mass updates
  - Transaction-wrapped with auto-rollback
  - Logs all mutations

- **delete_data**: Delete records with safety confirmation
  - Requires explicit confirmation (`confirmed: true`)
  - Mandatory WHERE clause to prevent accidental mass deletions
  - Returns count of deleted records
  - Transaction-wrapped with auto-rollback
  - Logs all mutations

- **truncate_table**: Clear all data from whitelisted tables
  - Requires explicit confirmation
  - Only works on tables with "Test" prefix or in whitelist
  - Returns count of deleted records
  - Transaction-wrapped with auto-rollback
  - Logs all mutations

- **execute_transaction**: Execute multiple SQL statements as atomic transaction
  - All statements succeed or all fail
  - Automatic rollback on any error
  - Requires confirmation for mutations
  - Supports both read and write operations
  - Logs transaction details

#### Safety Features
- **Confirmation System**: All destructive operations require `confirmed: true`
- **Whitelist Protection**: Truncate only works on approved tables
- **Transaction Management**: All writes wrapped in transactions with auto-rollback
- **FK Validation**: Automatic foreign key constraint validation for inserts
- **SQL Injection Prevention**:
  - Table name validation (alphanumeric + underscores only)
  - Proper value escaping
  - Mandatory WHERE clauses for UPDATE/DELETE
- **Mutation Logging**: All write operations logged to `logs/mutations-YYYY-MM-DD.log`

#### Infrastructure
- Log directory creation on startup
- Daily log file rotation (by date)
- Comprehensive error handling with rollback
- Detailed error messages and validation feedback

#### Documentation
- README.md with comprehensive feature documentation
- USAGE_EXAMPLES.md with practical examples for all tools
- CHANGELOG.md for version tracking
- Inline code documentation

### Changed
- Package version updated to 0.2.0
- Package description updated to indicate Phase 2 features
- Enhanced error messages with safety context

### Technical Details

#### Transaction Implementation
All write operations use a wrapper function that:
1. Begins transaction
2. Executes SQL in TRY block
3. Commits on success
4. Automatically rolls back on error
5. Throws error for caller to handle

#### FK Validation Process
1. Queries sys.foreign_keys for table constraints
2. Checks each FK column value against referenced table
3. Reports all violations before attempting insert
4. Skips NULL values if column allows NULL

#### Logging Format
```json
{
  "timestamp": "ISO-8601 datetime",
  "operation": "INSERT|UPDATE|DELETE|TRUNCATE|TRANSACTION",
  "database": "TestRobot|WCSTest",
  "details": {
    "table": "table_name",
    "data": { ... },
    "error": "error message if failed"
  }
}
```

### Security Considerations
- Read-only tools remain unchanged and safe
- Write tools require explicit confirmation
- Truncate limited to test tables only
- All inputs validated and sanitized
- Transactions ensure atomic operations
- Failed operations logged for audit trail

### Breaking Changes
None. Phase 1 tools remain fully compatible.

### Migration Guide
No migration needed. Phase 2 is additive - all existing functionality remains unchanged.

To use new features:
1. Rebuild the project: `npm run build`
2. Restart Claude Code to load updated MCP server
3. Use new tools with required safety parameters

### Known Limitations
1. TRUNCATE operations use DELETE (for transaction support) instead of native TRUNCATE
2. Batch inserts should use execute_transaction for best performance
3. Large result sets in FK validation may impact performance
4. Log files are not automatically archived (manual cleanup required)

### Performance Notes
- FK validation adds 1 query per foreign key constraint
- Transaction overhead is minimal (<10ms typical)
- Logging is asynchronous and doesn't block operations
- Batch operations should group related statements in single transaction

---

## [0.1.0] - 2025-10-XX - Initial Release (Phase 1)

### Added
- **execute_query**: Execute SELECT queries on TestRobot/WCSTest databases
- **list_tables**: List all tables in a database
- **describe_table**: Get table schema (columns, types, constraints)
- **show_foreign_keys**: Show FK relationships
- **get_sample_data**: Get sample rows from tables
- Basic MCP server infrastructure
- ODBC connection to LocalDB
- TypeScript build system
- Read-only safety enforcement

### Security
- Only SELECT queries allowed in execute_query
- Read-only operations only
- Connection string hardened with Trusted Connection

---

## Future Roadmap

### Phase 3 (Planned)
- Backup/restore functionality
- Advanced query builder
- Schema migration tools
- Performance monitoring
- Query result caching
- Batch operation optimizations

### Phase 4 (Planned)
- Multi-database transaction support
- Scheduled operations
- Advanced reporting
- Data validation rules
- Automated testing helpers
