import v8 from "msnodesqlv8";

// Promisified query function
export const query = (connectionString: string, sql: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    v8.query(connectionString, sql, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
};

// Execute query with transaction support
export const queryWithTransaction = async (
  connectionString: string,
  sql: string,
  useTransaction: boolean = true
): Promise<any> => {
  if (!useTransaction) {
    return query(connectionString, sql);
  }

  // For transactions, we need to use BEGIN TRANSACTION, COMMIT, and ROLLBACK
  const transactionSql = `
    BEGIN TRANSACTION;
    BEGIN TRY
      ${sql}
      COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
      ROLLBACK TRANSACTION;
      THROW;
    END CATCH
  `;

  return query(connectionString, transactionSql);
};

// Execute multiple queries in parallel across different environments
export const queryMultipleEnvironments = async (
  connectionStrings: Map<string, string>,
  sql: string
): Promise<Map<string, any>> => {
  const results = new Map<string, any>();
  const promises: Promise<void>[] = [];

  for (const [envName, connString] of connectionStrings) {
    promises.push(
      query(connString, sql)
        .then((result) => {
          results.set(envName, result);
        })
        .catch((error) => {
          results.set(envName, { error: error.message });
        })
    );
  }

  await Promise.all(promises);
  return results;
};
