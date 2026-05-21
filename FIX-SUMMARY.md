# SQL Server MCP Connection Fix - Summary

## Problem
The MCP server was unable to connect to SQL Server LocalDB instance `(localdb)\SQLLocalEXP01` with the error:
```
Error: getaddrinfo ENOTFOUND (localdb)
```

## Root Cause
The `mssql` package with the default Tedious driver doesn't support SQL Server LocalDB's `(localdb)\` syntax or named pipe connections on Windows. LocalDB uses Windows named pipes instead of TCP/IP connections.

## Solution
Switched from the `mssql` package with Tedious driver to using `msnodesqlv8` directly, which supports:
- Windows Authentication (Trusted_Connection)
- LocalDB connection strings
- ODBC drivers for SQL Server

## Changes Made

### 1. Installed msnodesqlv8 package
```bash
npm install msnodesqlv8
```

### 2. Rewrote the MCP server (`src/index.ts`)
- Removed dependency on `mssql` package's connection pooling
- Used `msnodesqlv8` directly with ODBC connection strings
- Changed from async/await with connection pool to promise-wrapped callbacks

### 3. Updated connection string format
**Before:**
```
server: "(localdb)\\SQLLocalEXP01"
```

**After:**
```
Driver={ODBC Driver 17 for SQL Server};Server=(localdb)\\SQLLocalEXP01;Database=TestRobot;Trusted_Connection=Yes;
```

## Verification
The connection was tested and verified working with:
```bash
node test-direct.js
```

Successfully retrieved 5 sample rows from the LoadCarriers table.

## Next Steps
1. **Restart Claude Code** to reload the MCP server with the new configuration
2. Test the MCP tools are working correctly
3. If you encounter any database connection issues in the future, check:
   - LocalDB instance is running: `sqllocaldb info SQLLocalEXP01`
   - ODBC Driver 17 for SQL Server is installed
   - Connection string format is correct

## Files Modified
- `src/index.ts` - Complete rewrite to use msnodesqlv8
- `src/index.ts.bak` - Backup of original implementation
- `package.json` - Added msnodesqlv8 dependency

## Test Files Created
- `test-connection.js` - Tests mssql/msnodesqlv8 wrapper (has issues)
- `test-direct.js` - Tests msnodesqlv8 directly (**works!**)
- `test-sql.ps1` - PowerShell ODBC test
- `check-drivers.ps1` - Lists available ODBC drivers

## Connection Details
- **Instance**: (localdb)\SQLLocalEXP01
- **Databases**: TestRobot, WCSTest
- **Driver**: ODBC Driver 17 for SQL Server
- **Authentication**: Windows Authentication (Trusted_Connection)
- **Named Pipe**: `np:\\.\pipe\LOCALDB#E07E4C9A\tsql\query`
