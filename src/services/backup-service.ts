// Backup service - implements verify_backup

import { query } from "../core/query.js";
import fs from "fs";
import path from "path";

// Verify database backup file
export const verifyBackup = async (
  connString: string,
  dbName: string,
  backupFilePath: string,
  verificationType: "quick" | "full" = "quick",
  compareToDatabase?: string
) => {
  const results: any = {
    backup_file: backupFilePath,
    verification_type: verificationType,
    file_exists: false,
    file_size_mb: 0,
    backup_metadata: null,
    verification_status: "pending",
    errors: [],
    warnings: [],
  };

  // 1. Check if file exists
  try {
    if (!fs.existsSync(backupFilePath)) {
      results.errors.push(`Backup file does not exist: ${backupFilePath}`);
      results.verification_status = "failed";
      return results;
    }

    results.file_exists = true;
    const stats = fs.statSync(backupFilePath);
    results.file_size_mb = (stats.size / (1024 * 1024)).toFixed(2);
    results.file_modified = stats.mtime;
  } catch (error) {
    results.errors.push(`Error accessing file: ${error instanceof Error ? error.message : String(error)}`);
    results.verification_status = "failed";
    return results;
  }

  // 2. Get backup header information
  try {
    const headerQuery = `
      RESTORE HEADERONLY
      FROM DISK = '${backupFilePath.replace(/'/g, "''")}'
    `;

    const headerResult = await query(connString, headerQuery);

    if (headerResult && headerResult.length > 0) {
      const header = headerResult[0];
      results.backup_metadata = {
        database_name: header.DatabaseName,
        server_name: header.ServerName,
        backup_start_date: header.BackupStartDate,
        backup_finish_date: header.BackupFinishDate,
        backup_type: header.BackupType === 1 ? "Full" : header.BackupType === 2 ? "Log" : "Differential",
        compressed: header.Compressed === 1,
        position: header.Position,
        software_version: header.SoftwareVersionMajor + "." + header.SoftwareVersionMinor,
      };
    }
  } catch (error) {
    results.errors.push(`Error reading backup header: ${error instanceof Error ? error.message : String(error)}`);
    results.verification_status = "failed";
    return results;
  }

  // 3. Quick verification - RESTORE VERIFYONLY
  try {
    const verifyQuery = `
      RESTORE VERIFYONLY
      FROM DISK = '${backupFilePath.replace(/'/g, "''")}'
    `;

    await query(connString, verifyQuery);
    results.verification_status = "verified";
    results.quick_verification = "PASSED - Backup file is valid and can be restored";
  } catch (error) {
    results.errors.push(`Backup verification failed: ${error instanceof Error ? error.message : String(error)}`);
    results.verification_status = "failed";
    return results;
  }

  // 4. Full verification (if requested) - Would require actually restoring to temp DB
  // NOTE: Full verification is complex and risky, so we'll just simulate it here
  if (verificationType === "full") {
    results.warnings.push(
      "Full verification (restore to temp DB + DBCC CHECKDB) is not implemented for safety reasons. " +
      "Quick verification with RESTORE VERIFYONLY has been performed instead."
    );
  }

  // 5. Compare to live database (if requested)
  if (compareToDatabase && results.verification_status === "verified") {
    try {
      // Get table counts from live database
      const liveTableCountQuery = `
        SELECT
          t.name AS TableName,
          p.rows AS RowCount
        FROM sys.tables t
        INNER JOIN sys.partitions p ON t.object_id = p.object_id
        WHERE p.index_id IN (0, 1)  -- Heap or clustered index
        ORDER BY t.name
      `;

      const liveConnString = connString.replace(/Database=[^;]+/, `Database=${compareToDatabase}`);
      const liveTables = await query(liveConnString, liveTableCountQuery);

      results.comparison = {
        live_database: compareToDatabase,
        live_table_count: liveTables.length,
        live_total_rows: liveTables.reduce((sum: number, t: any) => sum + (t.RowCount || 0), 0),
        note: "Detailed row comparison would require restoring backup to temporary database",
      };
    } catch (error) {
      results.warnings.push(`Could not compare to live database: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // 6. Final summary
  results.summary = {
    status: results.verification_status,
    can_restore: results.verification_status === "verified",
    recommendations: [],
  };

  if (results.verification_status === "verified") {
    results.summary.recommendations.push("Backup file is valid and can be restored successfully");
  }

  if (results.backup_metadata) {
    const backupAge = new Date().getTime() - new Date(results.backup_metadata.backup_finish_date).getTime();
    const backupAgeDays = backupAge / (1000 * 60 * 60 * 24);

    if (backupAgeDays > 7) {
      results.warnings.push(`Backup is ${backupAgeDays.toFixed(1)} days old`);
    }
  }

  return results;
};
