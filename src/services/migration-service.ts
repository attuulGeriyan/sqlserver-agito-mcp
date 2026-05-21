// Migration service - implements generate_migration

import { compareSchemas } from "./schema-service.js";

// Generate migration script based on schema differences
export const generateMigration = async (
  sourceEnv: string,
  targetEnv: string,
  databaseName: string,
  includeDrops: boolean = false,
  dryRun: boolean = true
) => {
  const results: any = {
    from_environment: sourceEnv,
    to_environment: targetEnv,
    database: databaseName,
    dry_run: dryRun,
    total_changes: 0,
    migration_script: "",
    changes_breakdown: {
      tables_added: 0,
      columns_added: 0,
      foreign_keys_added: 0,
      indexes_added: 0,
      tables_dropped: 0,
      columns_dropped: 0,
    },
    warnings: [],
  };

  try {
    // Get schema differences
    const comparison = await compareSchemas(sourceEnv, targetEnv, databaseName, true, false);

    if (comparison.error) {
      results.error = comparison.error;
      return results;
    }

    const scriptLines: string[] = [];
    scriptLines.push(`-- Migration Script: ${sourceEnv} -> ${targetEnv}`);
    scriptLines.push(`-- Database: ${databaseName}`);
    scriptLines.push(`-- Generated: ${new Date().toISOString()}`);
    scriptLines.push('');
    scriptLines.push('BEGIN TRANSACTION;');
    scriptLines.push('');

    // 1. Create tables that exist in source but not in target
    if (comparison.differences.tables.only_in_source.length > 0) {
      scriptLines.push('-- Create tables missing in target');
      for (const tableName of comparison.differences.tables.only_in_source) {
        scriptLines.push(`-- TODO: Manual schema for table ${tableName}`);
        scriptLines.push(`-- CREATE TABLE ${tableName} (...);`);
        scriptLines.push('');
        results.changes_breakdown.tables_added++;
      }
      results.warnings.push(
        `${comparison.differences.tables.only_in_source.length} table(s) require manual CREATE TABLE statements (schema not auto-generated)`
      );
    }

    // 2. Add columns that exist in source but not in target
    if (comparison.differences.columns.length > 0) {
      scriptLines.push('-- Add missing columns');
      for (const col of comparison.differences.columns) {
        if (col.difference === "missing_in_target") {
          const [schema, table] = col.table.split('.');
          scriptLines.push(
            `ALTER TABLE [${schema}].[${table}] ADD [${col.column}] ${col.source_type};`
          );
          results.changes_breakdown.columns_added++;
        } else if (col.difference === "type_mismatch") {
          scriptLines.push(
            `-- WARNING: Type mismatch for ${col.table}.${col.column}: ${col.source_type} vs ${col.target_type}`
          );
          scriptLines.push(`-- ALTER TABLE ${col.table} ALTER COLUMN [${col.column}] ${col.source_type};`);
          results.warnings.push(`Type mismatch detected: ${col.table}.${col.column}`);
        }
      }
      scriptLines.push('');
    }

    // 3. Add foreign keys that exist in source but not in target
    if (comparison.differences.foreign_keys.length > 0) {
      scriptLines.push('-- Add missing foreign keys');
      for (const fk of comparison.differences.foreign_keys) {
        if (fk.difference === "missing_in_target") {
          const parts = fk.foreign_key.split('.');
          if (parts.length >= 3) {
            const schema = parts[0];
            const table = parts[1];
            const fkName = parts.slice(2).join('.');

            scriptLines.push(`-- TODO: Verify FK details for ${fk.foreign_key}`);
            scriptLines.push(`-- ${fk.details}`);
            scriptLines.push(`-- ALTER TABLE [${schema}].[${table}] ADD CONSTRAINT [${fkName}] ...;`);
            scriptLines.push('');
            results.changes_breakdown.foreign_keys_added++;
          }
        }
      }
      results.warnings.push(
        `${results.changes_breakdown.foreign_keys_added} foreign key(s) require manual definition (details not auto-generated)`
      );
    }

    // 4. Add indexes that exist in source but not in target
    if (comparison.differences.indexes.length > 0) {
      scriptLines.push('-- Add missing indexes');
      for (const idx of comparison.differences.indexes) {
        if (idx.difference === "missing_in_target") {
          const parts = idx.index.split('.');
          if (parts.length >= 3) {
            const schema = parts[0];
            const table = parts[1];
            const indexName = parts.slice(2).join('.');

            scriptLines.push(`-- TODO: Define columns for index ${idx.index}`);
            scriptLines.push(`-- CREATE INDEX [${indexName}] ON [${schema}].[${table}] (...);`);
            scriptLines.push('');
            results.changes_breakdown.indexes_added++;
          }
        }
      }
      results.warnings.push(
        `${results.changes_breakdown.indexes_added} index(es) require manual column definition`
      );
    }

    // 5. Drop objects if requested (only in target, not in source)
    if (includeDrops) {
      // Drop extra tables
      if (comparison.differences.tables.only_in_target.length > 0) {
        scriptLines.push('-- Drop tables only in target (DESTRUCTIVE!)');
        for (const tableName of comparison.differences.tables.only_in_target) {
          scriptLines.push(`DROP TABLE ${tableName};`);
          results.changes_breakdown.tables_dropped++;
        }
        scriptLines.push('');
        results.warnings.push(
          `DESTRUCTIVE: ${results.changes_breakdown.tables_dropped} table(s) will be dropped`
        );
      }

      // Drop extra columns
      const extraColumns = comparison.differences.columns.filter(
        (c: any) => c.difference === "missing_in_source"
      );
      if (extraColumns.length > 0) {
        scriptLines.push('-- Drop columns only in target (DESTRUCTIVE!)');
        for (const col of extraColumns) {
          const [schema, table] = col.table.split('.');
          scriptLines.push(`ALTER TABLE [${schema}].[${table}] DROP COLUMN [${col.column}];`);
          results.changes_breakdown.columns_dropped++;
        }
        scriptLines.push('');
        results.warnings.push(
          `DESTRUCTIVE: ${results.changes_breakdown.columns_dropped} column(s) will be dropped`
        );
      }
    }

    // 6. Finalize script
    scriptLines.push('COMMIT TRANSACTION;');
    scriptLines.push('');
    scriptLines.push('-- Migration complete');

    results.migration_script = scriptLines.join('\n');
    results.total_changes =
      results.changes_breakdown.tables_added +
      results.changes_breakdown.columns_added +
      results.changes_breakdown.foreign_keys_added +
      results.changes_breakdown.indexes_added +
      results.changes_breakdown.tables_dropped +
      results.changes_breakdown.columns_dropped;

    // Add standard warnings
    if (dryRun) {
      results.warnings.unshift(
        "This is a DRY RUN. Set dry_run=false to generate executable script."
      );
    }
    results.warnings.push("ALWAYS backup database before running migrations.");
    results.warnings.push(
      "Review and test migration script in non-production environment first."
    );

    // Add note about limitations
    results.note =
      "Auto-generated migration script has limitations: " +
      "Table schemas, FK column mappings, and index column definitions must be added manually. " +
      "This script provides a starting point and highlights schema differences.";

  } catch (error) {
    results.error = error instanceof Error ? error.message : String(error);
  }

  return results;
};
