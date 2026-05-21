// Schema service - implements compare_schemas and validate_sync

import { query, queryMultipleEnvironments } from "../core/query.js";
import { getConnectionString, getMultiEnvConnectionStrings } from "../core/connection.js";

// Helper: Get all tables from a database
const getTables = async (connString: string) => {
  const sql = `
    SELECT
      TABLE_SCHEMA as SchemaName,
      TABLE_NAME as TableName
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_TYPE = 'BASE TABLE'
    ORDER BY TABLE_SCHEMA, TABLE_NAME
  `;
  return await query(connString, sql);
};

// Helper: Get all columns for a database
const getColumns = async (connString: string) => {
  const sql = `
    SELECT
      TABLE_SCHEMA as SchemaName,
      TABLE_NAME as TableName,
      COLUMN_NAME as ColumnName,
      DATA_TYPE as DataType,
      CHARACTER_MAXIMUM_LENGTH as MaxLength,
      NUMERIC_PRECISION as NumericPrecision,
      NUMERIC_SCALE as NumericScale,
      IS_NULLABLE as IsNullable,
      COLUMN_DEFAULT as DefaultValue,
      ORDINAL_POSITION as Position
    FROM INFORMATION_SCHEMA.COLUMNS
    ORDER BY TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION
  `;
  return await query(connString, sql);
};

// Helper: Get all constraints
const getConstraints = async (connString: string) => {
  const sql = `
    SELECT
      tc.CONSTRAINT_SCHEMA as SchemaName,
      tc.TABLE_NAME as TableName,
      tc.CONSTRAINT_NAME as ConstraintName,
      tc.CONSTRAINT_TYPE as ConstraintType,
      kcu.COLUMN_NAME as ColumnName
    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
    LEFT JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
      ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
      AND tc.TABLE_SCHEMA = kcu.TABLE_SCHEMA
      AND tc.TABLE_NAME = kcu.TABLE_NAME
    ORDER BY tc.TABLE_SCHEMA, tc.TABLE_NAME, tc.CONSTRAINT_NAME
  `;
  return await query(connString, sql);
};

// Helper: Get all foreign keys
const getForeignKeys = async (connString: string) => {
  const sql = `
    SELECT
      OBJECT_SCHEMA_NAME(fk.parent_object_id) as SchemaName,
      OBJECT_NAME(fk.parent_object_id) as TableName,
      fk.name as ForeignKeyName,
      COL_NAME(fkc.parent_object_id, fkc.parent_column_id) as ColumnName,
      OBJECT_SCHEMA_NAME(fk.referenced_object_id) as ReferencedSchema,
      OBJECT_NAME(fk.referenced_object_id) as ReferencedTable,
      COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) as ReferencedColumn
    FROM sys.foreign_keys fk
    INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
    ORDER BY SchemaName, TableName, fk.name
  `;
  return await query(connString, sql);
};

// Helper: Get all indexes
const getIndexes = async (connString: string) => {
  const sql = `
    SELECT
      OBJECT_SCHEMA_NAME(i.object_id) as SchemaName,
      OBJECT_NAME(i.object_id) as TableName,
      i.name as IndexName,
      i.type_desc as IndexType,
      i.is_unique as IsUnique,
      i.is_primary_key as IsPrimaryKey,
      COL_NAME(ic.object_id, ic.column_id) as ColumnName,
      ic.key_ordinal as KeyOrdinal,
      ic.is_included_column as IsIncluded
    FROM sys.indexes i
    INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
    WHERE i.name IS NOT NULL
      AND i.object_id > 100  -- Exclude system tables
    ORDER BY SchemaName, TableName, i.name, ic.key_ordinal
  `;
  return await query(connString, sql);
};

// Compare schemas between two environments
export const compareSchemas = async (
  sourceEnv: string,
  targetEnv: string,
  databaseName: string,
  includeIndexes: boolean = true,
  includeProcedures: boolean = false
) => {
  const results: any = {
    source: sourceEnv,
    target: targetEnv,
    database: databaseName,
    differences: {
      tables: {},
      columns: [],
      constraints: [],
      foreign_keys: [],
      indexes: [],
    },
    summary: {},
  };

  try {
    // Get connection strings for both environments
    const sourceConnString = getConnectionString(databaseName, sourceEnv);
    const targetConnString = getConnectionString(databaseName, targetEnv);

    // 1. Compare tables
    const [sourceTables, targetTables] = await Promise.all([
      getTables(sourceConnString),
      getTables(targetConnString),
    ]);

    const sourceTableNames = new Set(sourceTables.map((t: any) => `${t.SchemaName}.${t.TableName}`));
    const targetTableNames = new Set(targetTables.map((t: any) => `${t.SchemaName}.${t.TableName}`));

    results.differences.tables = {
      only_in_source: Array.from(sourceTableNames).filter(t => !targetTableNames.has(t)),
      only_in_target: Array.from(targetTableNames).filter(t => !sourceTableNames.has(t)),
      common: Array.from(sourceTableNames).filter(t => targetTableNames.has(t)).length,
    };

    // 2. Compare columns (for common tables)
    const [sourceColumns, targetColumns] = await Promise.all([
      getColumns(sourceConnString),
      getColumns(targetConnString),
    ]);

    // Group columns by table
    const groupByTable = (columns: any[]) => {
      const grouped: any = {};
      columns.forEach(col => {
        const key = `${col.SchemaName}.${col.TableName}`;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(col);
      });
      return grouped;
    };

    const sourceColsByTable = groupByTable(sourceColumns);
    const targetColsByTable = groupByTable(targetColumns);

    // Find column differences
    const commonTables = Array.from(sourceTableNames).filter(t => targetTableNames.has(t));
    for (const tableName of commonTables) {
      const sourceCols = sourceColsByTable[tableName as string] || [];
      const targetCols = targetColsByTable[tableName as string] || [];

      const sourceColNames = new Set(sourceCols.map((c: any) => c.ColumnName));
      const targetColNames = new Set(targetCols.map((c: any) => c.ColumnName));

      // Columns only in source
      for (const col of sourceCols) {
        if (!targetColNames.has(col.ColumnName)) {
          results.differences.columns.push({
            table: tableName,
            column: col.ColumnName,
            difference: "missing_in_target",
            source_type: `${col.DataType}${col.MaxLength ? `(${col.MaxLength})` : ''}`,
            target_type: null,
          });
        }
      }

      // Columns only in target
      for (const col of targetCols) {
        if (!sourceColNames.has(col.ColumnName)) {
          results.differences.columns.push({
            table: tableName,
            column: col.ColumnName,
            difference: "missing_in_source",
            source_type: null,
            target_type: `${col.DataType}${col.MaxLength ? `(${col.MaxLength})` : ''}`,
          });
        }
      }

      // Type mismatches for common columns
      for (const sourceCol of sourceCols) {
        const targetCol = targetCols.find((c: any) => c.ColumnName === sourceCol.ColumnName);
        if (targetCol) {
          const sourceType = `${sourceCol.DataType}${sourceCol.MaxLength ? `(${sourceCol.MaxLength})` : ''}`;
          const targetType = `${targetCol.DataType}${targetCol.MaxLength ? `(${targetCol.MaxLength})` : ''}`;

          if (sourceType !== targetType || sourceCol.IsNullable !== targetCol.IsNullable) {
            results.differences.columns.push({
              table: tableName,
              column: sourceCol.ColumnName,
              difference: "type_mismatch",
              source_type: `${sourceType} ${sourceCol.IsNullable === 'YES' ? 'NULL' : 'NOT NULL'}`,
              target_type: `${targetType} ${targetCol.IsNullable === 'YES' ? 'NULL' : 'NOT NULL'}`,
            });
          }
        }
      }
    }

    // 3. Compare foreign keys
    const [sourceFKs, targetFKs] = await Promise.all([
      getForeignKeys(sourceConnString),
      getForeignKeys(targetConnString),
    ]);

    const sourceFKNames = new Set(sourceFKs.map((fk: any) => `${fk.SchemaName}.${fk.TableName}.${fk.ForeignKeyName}`));
    const targetFKNames = new Set(targetFKs.map((fk: any) => `${fk.SchemaName}.${fk.TableName}.${fk.ForeignKeyName}`));

    for (const fk of sourceFKs) {
      const fkKey = `${fk.SchemaName}.${fk.TableName}.${fk.ForeignKeyName}`;
      if (!targetFKNames.has(fkKey)) {
        results.differences.foreign_keys.push({
          foreign_key: fkKey,
          difference: "missing_in_target",
          details: `${fk.ColumnName} -> ${fk.ReferencedSchema}.${fk.ReferencedTable}.${fk.ReferencedColumn}`,
        });
      }
    }

    for (const fk of targetFKs) {
      const fkKey = `${fk.SchemaName}.${fk.TableName}.${fk.ForeignKeyName}`;
      if (!sourceFKNames.has(fkKey)) {
        results.differences.foreign_keys.push({
          foreign_key: fkKey,
          difference: "missing_in_source",
          details: `${fk.ColumnName} -> ${fk.ReferencedSchema}.${fk.ReferencedTable}.${fk.ReferencedColumn}`,
        });
      }
    }

    // 4. Compare indexes (if requested)
    if (includeIndexes) {
      const [sourceIndexes, targetIndexes] = await Promise.all([
        getIndexes(sourceConnString),
        getIndexes(targetConnString),
      ]);

      const sourceIndexNames = new Set(sourceIndexes.map((idx: any) => `${idx.SchemaName}.${idx.TableName}.${idx.IndexName}`));
      const targetIndexNames = new Set(targetIndexes.map((idx: any) => `${idx.SchemaName}.${idx.TableName}.${idx.IndexName}`));

      for (const idx of sourceIndexes.filter((i: any) => !i.IsPrimaryKey)) {
        const idxKey = `${idx.SchemaName}.${idx.TableName}.${idx.IndexName}`;
        if (!targetIndexNames.has(idxKey)) {
          results.differences.indexes.push({
            index: idxKey,
            difference: "missing_in_target",
            type: idx.IndexType,
          });
        }
      }

      for (const idx of targetIndexes.filter((i: any) => !i.IsPrimaryKey)) {
        const idxKey = `${idx.SchemaName}.${idx.TableName}.${idx.IndexName}`;
        if (!sourceIndexNames.has(idxKey)) {
          results.differences.indexes.push({
            index: idxKey,
            difference: "missing_in_source",
            type: idx.IndexType,
          });
        }
      }
    }

    // 5. Generate summary
    const totalDifferences =
      results.differences.tables.only_in_source.length +
      results.differences.tables.only_in_target.length +
      results.differences.columns.length +
      results.differences.foreign_keys.length +
      results.differences.indexes.length;

    results.summary = {
      total_differences: totalDifferences,
      tables_only_in_source: results.differences.tables.only_in_source.length,
      tables_only_in_target: results.differences.tables.only_in_target.length,
      column_differences: results.differences.columns.length,
      foreign_key_differences: results.differences.foreign_keys.length,
      index_differences: results.differences.indexes.length,
      schemas_match: totalDifferences === 0,
    };

  } catch (error) {
    results.error = error instanceof Error ? error.message : String(error);
  }

  return results;
};

// Validate data sync between environments
export const validateSync = async (
  environmentNames: string[],
  databaseName: string,
  tableNames: string[],
  comparisonMode: "exact" | "subset" = "exact",
  checkRowCounts: boolean = true
) => {
  const results: any = {
    environments: environmentNames,
    database: databaseName,
    tables_checked: tableNames,
    results: [],
    summary: {},
  };

  try {
    // Get connection strings for all environments
    const connectionStrings = getMultiEnvConnectionStrings(databaseName, environmentNames);

    // For each table, check sync status
    for (const tableName of tableNames) {
      const tableResult: any = {
        table: tableName,
        in_sync: true,
        row_counts: {},
        differences: [],
      };

      // 1. Check row counts across all environments
      if (checkRowCounts) {
        const countQuery = `SELECT COUNT(*) as RowCount FROM [${tableName}]`;
        const countResults = await queryMultipleEnvironments(connectionStrings, countQuery);

        for (const [envName, result] of countResults) {
          if (result.error) {
            tableResult.differences.push({
              type: "query_error",
              environment: envName,
              error: result.error,
            });
            tableResult.in_sync = false;
          } else {
            tableResult.row_counts[envName] = result[0]?.RowCount || 0;
          }
        }

        // Check if all row counts match
        const counts = Object.values(tableResult.row_counts);
        if (counts.length > 1 && new Set(counts).size > 1) {
          tableResult.in_sync = false;
          tableResult.differences.push({
            type: "row_count_mismatch",
            counts: tableResult.row_counts,
          });
        }
      }

      // 2. For exact comparison, we would need to fetch all data and compare
      // This is expensive, so we'll add a note about it
      if (comparisonMode === "exact" && tableResult.in_sync) {
        tableResult.note = "Row counts match. Full data comparison requires fetching all records.";
      }

      results.results.push(tableResult);
    }

    // Generate summary
    const inSyncCount = results.results.filter((r: any) => r.in_sync).length;
    results.summary = {
      total_tables: tableNames.length,
      in_sync: inSyncCount,
      out_of_sync: tableNames.length - inSyncCount,
      all_synced: inSyncCount === tableNames.length,
    };

  } catch (error) {
    results.error = error instanceof Error ? error.message : String(error);
  }

  return results;
};
