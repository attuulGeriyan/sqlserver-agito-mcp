// Health service - implements analyze_indexes, get_recent_changes, daily_health_check

import { query } from "../core/query.js";
import {
  DEFAULT_MIN_FRAGMENTATION,
  FRAGMENTATION_REBUILD_THRESHOLD,
  FRAGMENTATION_REORGANIZE_THRESHOLD,
  DEFAULT_RECENT_CHANGES_HOURS,
  DEFAULT_RECENT_CHANGES_LIMIT,
} from "../config/constants.js";
import { getLogStatistics } from "../utils/logging.js";

// Analyze index health
export const analyzeIndexes = async (
  connString: string,
  dbName: string,
  tableName?: string,
  minFragmentation: number = DEFAULT_MIN_FRAGMENTATION,
  includeUsageStats: boolean = true
) => {
  const results: any = {
    database: dbName,
    table: tableName || "all",
    missing_indexes: [],
    fragmented_indexes: [],
    unused_indexes: [],
    usage_statistics: [],
    summary: {},
  };

  // 1. Get missing indexes with impact score
  const missingIndexQuery = `
    SELECT TOP 20
      mid.statement AS TableName,
      mid.equality_columns AS EqualityColumns,
      mid.inequality_columns AS InequalityColumns,
      mid.included_columns AS IncludedColumns,
      ROUND(migs.avg_total_user_cost * migs.avg_user_impact * (migs.user_seeks + migs.user_scans), 2) AS ImprovementScore,
      migs.user_seeks AS UserSeeks,
      migs.user_scans AS UserScans,
      'CREATE INDEX IX_' + REPLACE(REPLACE(REPLACE(mid.statement, '[', ''), ']', ''), '.', '_') +
        '_' + REPLACE(REPLACE(ISNULL(mid.equality_columns, ''), ', ', '_'), '[', '') +
        CASE WHEN mid.inequality_columns IS NOT NULL THEN '_' + REPLACE(REPLACE(mid.inequality_columns, ', ', '_'), '[', '') ELSE '' END +
        ' ON ' + mid.statement +
        ' (' + ISNULL(mid.equality_columns, '') +
        CASE WHEN mid.inequality_columns IS NOT NULL THEN ', ' + mid.inequality_columns ELSE '' END + ')' +
        CASE WHEN mid.included_columns IS NOT NULL THEN ' INCLUDE (' + mid.included_columns + ')' ELSE '' END AS CreateStatement
    FROM sys.dm_db_missing_index_details mid
    INNER JOIN sys.dm_db_missing_index_groups mig ON mid.index_handle = mig.index_handle
    INNER JOIN sys.dm_db_missing_index_group_stats migs ON mig.index_group_handle = migs.group_handle
    WHERE mid.database_id = DB_ID()
    ${tableName ? `AND mid.statement LIKE '%[${tableName}]%'` : ''}
    ORDER BY ImprovementScore DESC
  `;

  try {
    results.missing_indexes = await query(connString, missingIndexQuery);
  } catch (error) {
    results.missing_indexes_error = error instanceof Error ? error.message : String(error);
  }

  // 2. Get fragmented indexes
  const fragmentedIndexQuery = `
    SELECT
      OBJECT_NAME(ps.object_id) AS TableName,
      i.name AS IndexName,
      i.type_desc AS IndexType,
      ROUND(ps.avg_fragmentation_in_percent, 2) AS FragmentationPercent,
      ps.page_count AS PageCount,
      CASE
        WHEN ps.avg_fragmentation_in_percent > ${FRAGMENTATION_REBUILD_THRESHOLD} THEN 'REBUILD'
        WHEN ps.avg_fragmentation_in_percent > ${FRAGMENTATION_REORGANIZE_THRESHOLD} THEN 'REORGANIZE'
        ELSE 'OK'
      END AS Recommendation,
      CASE
        WHEN ps.avg_fragmentation_in_percent > ${FRAGMENTATION_REBUILD_THRESHOLD}
          THEN 'ALTER INDEX [' + i.name + '] ON [' + OBJECT_SCHEMA_NAME(ps.object_id) + '].[' + OBJECT_NAME(ps.object_id) + '] REBUILD;'
        WHEN ps.avg_fragmentation_in_percent > ${FRAGMENTATION_REORGANIZE_THRESHOLD}
          THEN 'ALTER INDEX [' + i.name + '] ON [' + OBJECT_SCHEMA_NAME(ps.object_id) + '].[' + OBJECT_NAME(ps.object_id) + '] REORGANIZE;'
        ELSE NULL
      END AS MaintenanceSQL
    FROM sys.dm_db_index_physical_stats(DB_ID(), ${tableName ? `OBJECT_ID('${tableName}')` : 'NULL'}, NULL, NULL, 'LIMITED') ps
    INNER JOIN sys.indexes i ON ps.object_id = i.object_id AND ps.index_id = i.index_id
    WHERE ps.avg_fragmentation_in_percent >= ${minFragmentation}
      AND ps.page_count > 1000  -- Only consider indexes with more than 1000 pages
      AND i.name IS NOT NULL    -- Exclude heaps
    ORDER BY ps.avg_fragmentation_in_percent DESC
  `;

  try {
    results.fragmented_indexes = await query(connString, fragmentedIndexQuery);
  } catch (error) {
    results.fragmented_indexes_error = error instanceof Error ? error.message : String(error);
  }

  // 3. Get unused indexes (indexes with no seeks/scans but have updates)
  const unusedIndexQuery = `
    SELECT
      OBJECT_SCHEMA_NAME(i.object_id) AS SchemaName,
      OBJECT_NAME(i.object_id) AS TableName,
      i.name AS IndexName,
      i.type_desc AS IndexType,
      ISNULL(s.user_seeks, 0) AS UserSeeks,
      ISNULL(s.user_scans, 0) AS UserScans,
      ISNULL(s.user_lookups, 0) AS UserLookups,
      ISNULL(s.user_updates, 0) AS UserUpdates,
      'DROP INDEX [' + i.name + '] ON [' + OBJECT_SCHEMA_NAME(i.object_id) + '].[' + OBJECT_NAME(i.object_id) + '];' AS DropStatement
    FROM sys.indexes i
    LEFT JOIN sys.dm_db_index_usage_stats s ON i.object_id = s.object_id AND i.index_id = s.index_id AND s.database_id = DB_ID()
    WHERE i.object_id > 100  -- Exclude system tables
      AND i.type_desc != 'HEAP'
      AND i.is_primary_key = 0
      AND i.is_unique_constraint = 0
      ${tableName ? `AND OBJECT_NAME(i.object_id) = '${tableName}'` : ''}
      AND (s.user_seeks IS NULL OR s.user_seeks = 0)
      AND (s.user_scans IS NULL OR s.user_scans = 0)
      AND (s.user_lookups IS NULL OR s.user_lookups = 0)
      AND (s.user_updates > 0 OR s.user_updates IS NULL)
    ORDER BY OBJECT_NAME(i.object_id), i.name
  `;

  try {
    results.unused_indexes = await query(connString, unusedIndexQuery);
  } catch (error) {
    results.unused_indexes_error = error instanceof Error ? error.message : String(error);
  }

  // 4. Get usage statistics (if requested)
  if (includeUsageStats) {
    const usageStatsQuery = `
      SELECT TOP 50
        OBJECT_SCHEMA_NAME(i.object_id) AS SchemaName,
        OBJECT_NAME(i.object_id) AS TableName,
        i.name AS IndexName,
        i.type_desc AS IndexType,
        s.user_seeks AS UserSeeks,
        s.user_scans AS UserScans,
        s.user_lookups AS UserLookups,
        s.user_updates AS UserUpdates,
        s.last_user_seek AS LastSeek,
        s.last_user_scan AS LastScan
      FROM sys.indexes i
      LEFT JOIN sys.dm_db_index_usage_stats s ON i.object_id = s.object_id AND i.index_id = s.index_id AND s.database_id = DB_ID()
      WHERE i.object_id > 100
        AND i.name IS NOT NULL
        ${tableName ? `AND OBJECT_NAME(i.object_id) = '${tableName}'` : ''}
      ORDER BY (s.user_seeks + s.user_scans + s.user_lookups) DESC
    `;

    try {
      results.usage_statistics = await query(connString, usageStatsQuery);
    } catch (error) {
      results.usage_statistics_error = error instanceof Error ? error.message : String(error);
    }
  }

  // 5. Generate summary
  results.summary = {
    missing_indexes_count: results.missing_indexes.length,
    fragmented_indexes_count: results.fragmented_indexes.length,
    unused_indexes_count: results.unused_indexes.length,
    top_missing_index_impact:
      results.missing_indexes.length > 0 ? results.missing_indexes[0].ImprovementScore : 0,
    recommendations: [],
  };

  // Add recommendations
  if (results.missing_indexes.length > 0) {
    results.summary.recommendations.push(
      `Consider creating ${results.missing_indexes.length} missing indexes for improved performance`
    );
  }
  if (results.fragmented_indexes.length > 0) {
    results.summary.recommendations.push(
      `Rebuild or reorganize ${results.fragmented_indexes.length} fragmented indexes`
    );
  }
  if (results.unused_indexes.length > 0) {
    results.summary.recommendations.push(
      `Consider dropping ${results.unused_indexes.length} unused indexes to reduce write overhead`
    );
  }
  if (results.summary.recommendations.length === 0) {
    results.summary.recommendations.push("No index issues detected - database indexes are healthy");
  }

  return results;
};

// Get recent data changes (timestamp-based tracking)
export const getRecentChanges = async (
  connString: string,
  dbName: string,
  tableName?: string,
  timeWindowHours: number = DEFAULT_RECENT_CHANGES_HOURS,
  changeTypes?: string[],
  limit: number = DEFAULT_RECENT_CHANGES_LIMIT
) => {
  const results: any = {
    database: dbName,
    table: tableName || "all",
    time_window_hours: timeWindowHours,
    tracking_method: "timestamp_based",
    changes: [],
    total_changes: 0,
    returned: 0,
  };

  try {
    // Get list of tables to check
    let tablesToCheck: string[] = [];
    if (tableName) {
      tablesToCheck = [tableName];
    } else {
      // Get all tables
      const tablesQuery = `
        SELECT TABLE_NAME
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_TYPE = 'BASE TABLE'
        ORDER BY TABLE_NAME
      `;
      const tablesResult = await query(connString, tablesQuery);
      tablesToCheck = tablesResult.map((t: any) => t.TABLE_NAME);
    }

    const changes: any[] = [];
    const requestedTypes = changeTypes || ["INSERT", "UPDATE", "DELETE"];

    // For each table, check for timestamp columns
    for (const table of tablesToCheck) {
      // Get columns for this table
      const columnsQuery = `
        SELECT COLUMN_NAME, DATA_TYPE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = '${table}'
        AND (
          COLUMN_NAME LIKE '%Create%Date%' OR
          COLUMN_NAME LIKE '%Update%Date%' OR
          COLUMN_NAME LIKE '%Delete%Date%' OR
          COLUMN_NAME LIKE '%Modified%Date%' OR
          COLUMN_NAME LIKE '%Changed%Date%'
        )
      `;

      const columns = await query(connString, columnsQuery);

      if (columns.length === 0) {
        continue; // Skip tables without timestamp columns
      }

      // Build query based on available timestamp columns
      const queryParts: string[] = [];

      for (const col of columns) {
        const colName = col.COLUMN_NAME;
        let changeType = "UNKNOWN";

        if (colName.toLowerCase().includes("create")) {
          changeType = "INSERT";
        } else if (colName.toLowerCase().includes("update") || colName.toLowerCase().includes("modif")) {
          changeType = "UPDATE";
        } else if (colName.toLowerCase().includes("delete")) {
          changeType = "DELETE";
        }

        if (!requestedTypes.includes(changeType)) {
          continue;
        }

        // Try to find primary key or ID column
        const pkQuery = `
          SELECT COLUMN_NAME
          FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
          WHERE TABLE_NAME = '${table}'
          AND CONSTRAINT_NAME LIKE 'PK%'
          ORDER BY ORDINAL_POSITION
        `;
        const pkResult = await query(connString, pkQuery);
        const pkColumn = pkResult.length > 0 ? pkResult[0].COLUMN_NAME : null;

        // Build query part for this change type
        const selectCols = pkColumn ? `[${pkColumn}] as RecordId,` : "'N/A' as RecordId,";

        queryParts.push(`
          SELECT TOP ${limit}
            '${table}' AS TableName,
            ${selectCols}
            '${changeType}' AS ChangeType,
            [${colName}] AS ChangeTimestamp,
            NULL AS ChangedBy
          FROM [${table}]
          WHERE [${colName}] >= DATEADD(hour, -${timeWindowHours}, GETDATE())
          AND [${colName}] IS NOT NULL
        `);
      }

      if (queryParts.length > 0) {
        try {
          const unionQuery = queryParts.join(" UNION ALL ") + " ORDER BY ChangeTimestamp DESC";
          const tableChanges = await query(connString, unionQuery);
          changes.push(...tableChanges);
        } catch (error) {
          // Skip tables that cause errors
          results.warnings = results.warnings || [];
          results.warnings.push(`Could not query ${table}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    // Sort all changes by timestamp
    changes.sort((a, b) => {
      const dateA = new Date(a.ChangeTimestamp).getTime();
      const dateB = new Date(b.ChangeTimestamp).getTime();
      return dateB - dateA; // Descending order
    });

    results.changes = changes.slice(0, limit);
    results.total_changes = changes.length;
    results.returned = results.changes.length;

    // Add summary
    const changeTypeCounts: any = {};
    for (const change of results.changes) {
      changeTypeCounts[change.ChangeType] = (changeTypeCounts[change.ChangeType] || 0) + 1;
    }
    results.summary = {
      by_type: changeTypeCounts,
      tables_with_changes: new Set(results.changes.map((c: any) => c.TableName)).size,
    };

  } catch (error) {
    results.error = error instanceof Error ? error.message : String(error);
  }

  return results;
};

// Daily health check - aggregates multiple diagnostic checks
export const dailyHealthCheck = async (
  connString: string,
  dbName: string,
  compareToEnvironment?: string
) => {
  const results: any = {
    timestamp: new Date().toISOString(),
    database: dbName,
    health_score: 100,
    status: "HEALTHY",
    checks: {},
    recommendations: [],
  };

  try {
    // 1. Check for orphaned records (FK violations)
    results.checks.orphaned_records = { total_orphans: 0, details: [] };

    try {
      // Get all foreign keys
      const fkQuery = `
        SELECT
          OBJECT_NAME(fk.parent_object_id) AS TableName,
          fk.name AS FKName,
          COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS ColumnName,
          OBJECT_NAME(fk.referenced_object_id) AS ReferencedTable,
          COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS ReferencedColumn
        FROM sys.foreign_keys fk
        INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
      `;

      const foreignKeys = await query(connString, fkQuery);
      let totalOrphans = 0;

      for (const fk of foreignKeys.slice(0, 10)) { // Check first 10 FKs to avoid long runtime
        try {
          const orphanQuery = `
            SELECT COUNT(*) as OrphanCount
            FROM [${fk.TableName}] t
            LEFT JOIN [${fk.ReferencedTable}] r ON t.[${fk.ColumnName}] = r.[${fk.ReferencedColumn}]
            WHERE r.[${fk.ReferencedColumn}] IS NULL
            AND t.[${fk.ColumnName}] IS NOT NULL
          `;
          const orphanResult = await query(connString, orphanQuery);
          const orphanCount = orphanResult[0]?.OrphanCount || 0;

          if (orphanCount > 0) {
            totalOrphans += orphanCount;
            results.checks.orphaned_records.details.push({
              table: fk.TableName,
              foreign_key: fk.FKName,
              orphan_count: orphanCount,
            });
          }
        } catch (error) {
          // Skip FK checks that fail
        }
      }

      results.checks.orphaned_records.total_orphans = totalOrphans;

      if (totalOrphans > 0) {
        results.health_score -= 15;
        results.recommendations.push(`Fix ${totalOrphans} orphaned records with invalid foreign key references`);
      }
    } catch (error) {
      results.checks.orphaned_records.error = error instanceof Error ? error.message : String(error);
    }

    // 2. Data consistency checks
    results.checks.data_consistency = { issues_found: 0, details: [] };

    try {
      // Check for null values in non-nullable columns (beyond constraints)
      // Check for common data quality issues
      const consistencyIssues: any[] = [];

      // Example: Check for duplicate barcodes if LoadCarriers table exists
      try {
        const dupQuery = `
          SELECT COUNT(*) as DuplicateCount
          FROM (
            SELECT Barcode, COUNT(*) as cnt
            FROM LoadCarriers
            WHERE Barcode IS NOT NULL
            GROUP BY Barcode
            HAVING COUNT(*) > 1
          ) duplicates
        `;
        const dupResult = await query(connString, dupQuery);
        const dupCount = dupResult[0]?.DuplicateCount || 0;

        if (dupCount > 0) {
          consistencyIssues.push({
            issue: "duplicate_barcodes",
            count: dupCount,
            severity: "high",
          });
        }
      } catch (error) {
        // Table might not exist
      }

      results.checks.data_consistency.issues_found = consistencyIssues.length;
      results.checks.data_consistency.details = consistencyIssues;

      if (consistencyIssues.length > 0) {
        results.health_score -= 10;
        results.recommendations.push(`Resolve ${consistencyIssues.length} data consistency issues`);
      }
    } catch (error) {
      results.checks.data_consistency.error = error instanceof Error ? error.message : String(error);
    }

    // 3. Get row counts for all tables
    results.checks.row_counts = {};

    try {
      const rowCountQuery = `
        SELECT
          t.name AS TableName,
          SUM(p.rows) AS RowCount
        FROM sys.tables t
        INNER JOIN sys.partitions p ON t.object_id = p.object_id
        WHERE p.index_id IN (0, 1)
        GROUP BY t.name
        ORDER BY t.name
      `;
      const rowCounts = await query(connString, rowCountQuery);

      for (const rc of rowCounts) {
        results.checks.row_counts[rc.TableName] = rc.RowCount;
      }
    } catch (error) {
      results.checks.row_counts.error = error instanceof Error ? error.message : String(error);
    }

    // 4. Check error logs
    results.checks.error_logs = { operations_today: 0, errors: 0 };

    try {
      const logStats = getLogStatistics();
      results.checks.error_logs = {
        operations_today: logStats.total,
        errors: logStats.errors,
        operations_by_type: logStats.operations,
      };

      if (logStats.errors > 10) {
        results.health_score -= 10;
        results.recommendations.push(`Review ${logStats.errors} failed operations in mutation logs`);
      }
    } catch (error) {
      results.checks.error_logs.error = error instanceof Error ? error.message : String(error);
    }

    // 5. Index health summary (call existing function)
    results.checks.index_health = { missing_indexes: 0, fragmented_indexes: 0, unused_indexes: 0 };

    try {
      const indexHealth = await analyzeIndexes(connString, dbName, undefined, 30, false);
      results.checks.index_health = {
        missing_indexes: indexHealth.missing_indexes?.length || 0,
        fragmented_indexes: indexHealth.fragmented_indexes?.length || 0,
        unused_indexes: indexHealth.unused_indexes?.length || 0,
      };

      if (indexHealth.missing_indexes?.length > 5) {
        results.health_score -= 15;
        results.recommendations.push(`Create ${indexHealth.missing_indexes.length} recommended indexes for better performance`);
      }
      if (indexHealth.fragmented_indexes?.length > 10) {
        results.health_score -= 10;
        results.recommendations.push(`Rebuild or reorganize ${indexHealth.fragmented_indexes.length} fragmented indexes`);
      }
    } catch (error) {
      results.checks.index_health.error = error instanceof Error ? error.message : String(error);
    }

    // 6. Determine overall status
    if (results.health_score >= 80) {
      results.status = "HEALTHY";
    } else if (results.health_score >= 60) {
      results.status = "WARNING";
    } else {
      results.status = "CRITICAL";
    }

    if (results.recommendations.length === 0) {
      results.recommendations.push("No issues detected - database health is good");
    }

  } catch (error) {
    results.error = error instanceof Error ? error.message : String(error);
    results.status = "ERROR";
  }

  return results;
};
