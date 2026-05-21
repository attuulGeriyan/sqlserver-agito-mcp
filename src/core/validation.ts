import { query } from "./query.js";
import { TRUNCATE_WHITELIST } from "../config/constants.js";

// Validate table name to prevent SQL injection
export const isValidTableName = (tableName: string): boolean => {
  // Only allow alphanumeric characters and underscores
  return /^[a-zA-Z0-9_]+$/.test(tableName);
};

// Check if table can be truncated (must have Test prefix or be in whitelist)
export const canTruncateTable = (tableName: string): boolean => {
  return tableName.startsWith("Test") || TRUNCATE_WHITELIST.includes(tableName);
};

// Validate foreign key constraints before insert
export const validateForeignKeys = async (
  connString: string,
  tableName: string,
  data: Record<string, any>
): Promise<{ valid: boolean; errors: string[] }> => {
  const errors: string[] = [];

  try {
    // Get all foreign keys for this table
    const fkQuery = `
      SELECT
        COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS ColumnName,
        OBJECT_NAME(fk.referenced_object_id) AS ReferencedTable,
        COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS ReferencedColumn
      FROM sys.foreign_keys fk
      INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
      WHERE OBJECT_NAME(fk.parent_object_id) = '${tableName}'
    `;

    const foreignKeys = await query(connString, fkQuery);

    // Validate each foreign key
    for (const fk of foreignKeys) {
      const columnValue = data[fk.ColumnName];

      // Skip null values if allowed
      if (columnValue === null || columnValue === undefined) {
        continue;
      }

      // Check if referenced value exists
      const checkQuery = `
        SELECT COUNT(*) as count
        FROM [${fk.ReferencedTable}]
        WHERE [${fk.ReferencedColumn}] = '${columnValue}'
      `;

      const result = await query(connString, checkQuery);

      if (result[0].count === 0) {
        errors.push(
          `Foreign key violation: ${fk.ColumnName} references ${fk.ReferencedTable}.${fk.ReferencedColumn}, but value '${columnValue}' does not exist`
        );
      }
    }

    return { valid: errors.length === 0, errors };
  } catch (error) {
    errors.push(`Error validating foreign keys: ${error instanceof Error ? error.message : String(error)}`);
    return { valid: false, errors };
  }
};

// Validate that environment is writable (not readonly)
export const validateWritePermission = (isReadonly: boolean, operation: string): { valid: boolean; error?: string } => {
  if (isReadonly) {
    return {
      valid: false,
      error: `Cannot perform ${operation} on readonly environment. This environment is protected from modifications.`
    };
  }
  return { valid: true };
};
