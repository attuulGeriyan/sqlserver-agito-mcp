# Usage Examples - SQL Server MCP Phase 2

This document provides practical examples for using all the Phase 2 write operations.

## Table of Contents
- [Insert Data](#insert-data)
- [Update Data](#update-data)
- [Delete Data](#delete-data)
- [Truncate Table](#truncate-table)
- [Execute Transaction](#execute-transaction)
- [Common Workflows](#common-workflows)

## Insert Data

### Basic Insert with FK Validation

```json
{
  "tool": "insert_data",
  "arguments": {
    "table_name": "LoadCarriers",
    "data": {
      "LoadCarrierId": "A1234567-89AB-CDEF-0123-456789ABCDEF",
      "Barcode": "TEST-LC-001",
      "SourceLocationId": "6ED298D8-AB70-4B2C-8565-B37BAD3EF573",
      "LoadCarrierType": 4,
      "CurrentStatus": 0,
      "CreatedBy": "TEST-USER",
      "CreateDate": "2025-10-31T10:00:00Z",
      "Deleted": false,
      "PositionIndex": 0
    },
    "database": "TestRobot",
    "validate_fk": true
  }
}
```

**Response on Success:**
```json
{
  "success": true,
  "operation": "INSERT",
  "database": "TestRobot",
  "table": "LoadCarriers",
  "recordsAffected": 1,
  "data": { ... }
}
```

**Response on FK Violation:**
```json
{
  "error": "Foreign key validation failed",
  "violations": [
    "Foreign key violation: SourceLocationId references Locations.LocationId, but value '...' does not exist"
  ]
}
```

### Insert Without FK Validation (Not Recommended)

```json
{
  "tool": "insert_data",
  "arguments": {
    "table_name": "LoadCarriers",
    "data": { ... },
    "validate_fk": false
  }
}
```

### Insert with NULL Values

```json
{
  "tool": "insert_data",
  "arguments": {
    "table_name": "LoadCarriers",
    "data": {
      "LoadCarrierId": "B2345678-89AB-CDEF-0123-456789ABCDEF",
      "Barcode": "TEST-LC-002",
      "SourceLocationId": "6ED298D8-AB70-4B2C-8565-B37BAD3EF573",
      "LoadCarrierType": 4,
      "CurrentStatus": 0,
      "TareWeight": null,
      "GrossWeight": null,
      "Height": null,
      "CreatedBy": "TEST-USER",
      "Deleted": false
    }
  }
}
```

## Update Data

### Update Single Record

```json
{
  "tool": "update_data",
  "arguments": {
    "table_name": "LoadCarriers",
    "data": {
      "CurrentStatus": 3,
      "UpdatedBy": "TEST-USER",
      "UpdateDate": "2025-10-31T11:00:00Z"
    },
    "where_clause": "Barcode = 'TEST-LC-001'",
    "database": "TestRobot",
    "confirmed": true
  }
}
```

### Update Multiple Fields

```json
{
  "tool": "update_data",
  "arguments": {
    "table_name": "LoadCarriers",
    "data": {
      "CurrentStatus": 3,
      "TareWeight": 100,
      "GrossWeight": 500,
      "Height": 150,
      "UpdatedBy": "TEST-USER",
      "UpdateDate": "2025-10-31T11:00:00Z"
    },
    "where_clause": "LoadCarrierId = 'A1234567-89AB-CDEF-0123-456789ABCDEF'",
    "confirmed": true
  }
}
```

### Update Multiple Records (Use with Caution)

```json
{
  "tool": "update_data",
  "arguments": {
    "table_name": "LoadCarriers",
    "data": {
      "CurrentStatus": 0
    },
    "where_clause": "CreatedBy = 'TEST-USER' AND CreateDate > '2025-10-31'",
    "confirmed": true
  }
}
```

### Safety: Attempt Without Confirmation

```json
{
  "tool": "update_data",
  "arguments": {
    "table_name": "LoadCarriers",
    "data": { "CurrentStatus": 3 },
    "where_clause": "Barcode = 'TEST-LC-001'",
    "confirmed": false
  }
}
```

**Response:**
```json
{
  "error": "UPDATE operation requires confirmation. Set \"confirmed\": true to proceed."
}
```

## Delete Data

### Delete Single Record

```json
{
  "tool": "delete_data",
  "arguments": {
    "table_name": "LoadCarriers",
    "where_clause": "Barcode = 'TEST-LC-001'",
    "database": "TestRobot",
    "confirmed": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "operation": "DELETE",
  "database": "TestRobot",
  "table": "LoadCarriers",
  "recordsDeleted": 1,
  "whereClause": "Barcode = 'TEST-LC-001'"
}
```

### Delete Multiple Records

```json
{
  "tool": "delete_data",
  "arguments": {
    "table_name": "LoadCarriers",
    "where_clause": "CreatedBy = 'TEST-USER' AND Deleted = 1",
    "confirmed": true
  }
}
```

### Delete with Complex WHERE Clause

```json
{
  "tool": "delete_data",
  "arguments": {
    "table_name": "LoadCarriers",
    "where_clause": "Barcode LIKE 'TEST-%' AND CreateDate < '2025-01-01'",
    "confirmed": true
  }
}
```

## Truncate Table

### Truncate Test Table

```json
{
  "tool": "truncate_table",
  "arguments": {
    "table_name": "TestLoadCarriers",
    "database": "TestRobot",
    "confirmed": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "operation": "TRUNCATE",
  "database": "TestRobot",
  "table": "TestLoadCarriers",
  "recordsDeleted": 1234,
  "message": "All records deleted from table"
}
```

### Safety: Attempt on Non-Whitelisted Table

```json
{
  "tool": "truncate_table",
  "arguments": {
    "table_name": "LoadCarriers",
    "confirmed": true
  }
}
```

**Response:**
```json
{
  "error": "Table 'LoadCarriers' is not whitelisted for truncation. Only tables starting with 'Test' or explicitly whitelisted can be truncated."
}
```

## Execute Transaction

### Multi-Step Insert Transaction

```json
{
  "tool": "execute_transaction",
  "arguments": {
    "statements": [
      "INSERT INTO TestLoadCarriers (LoadCarrierId, Barcode, LoadCarrierType, CurrentStatus, CreatedBy, Deleted, PositionIndex) VALUES ('C3456789-89AB-CDEF-0123-456789ABCDEF', 'TEST-TX-001', 4, 0, 'SYSTEM', 0, 0)",
      "INSERT INTO TestLoadCarriers (LoadCarrierId, Barcode, LoadCarrierType, CurrentStatus, CreatedBy, Deleted, PositionIndex) VALUES ('D4567890-89AB-CDEF-0123-456789ABCDEF', 'TEST-TX-002', 4, 0, 'SYSTEM', 0, 0)"
    ],
    "database": "TestRobot",
    "confirmed": true
  }
}
```

### Complex Transaction with Multiple Operations

```json
{
  "tool": "execute_transaction",
  "arguments": {
    "statements": [
      "INSERT INTO TestOrders (OrderId, OrderNumber, Status, CreatedBy) VALUES ('E5678901-89AB-CDEF-0123-456789ABCDEF', 'ORD-001', 1, 'SYSTEM')",
      "UPDATE TestLoadCarriers SET CurrentStatus = 2 WHERE Barcode = 'TEST-TX-001'",
      "INSERT INTO TestOrderItems (OrderId, LoadCarrierId, Quantity) VALUES ('E5678901-89AB-CDEF-0123-456789ABCDEF', 'C3456789-89AB-CDEF-0123-456789ABCDEF', 1)"
    ],
    "confirmed": true
  }
}
```

**Response on Success:**
```json
{
  "success": true,
  "operation": "TRANSACTION",
  "database": "TestRobot",
  "statementsExecuted": 3,
  "message": "All statements executed successfully"
}
```

**Response on Failure (All Rolled Back):**
```json
{
  "error": "Transaction failed and was rolled back. Violation of PRIMARY KEY constraint..."
}
```

### Read-Only Transaction (No Confirmation Required)

```json
{
  "tool": "execute_transaction",
  "arguments": {
    "statements": [
      "SELECT * FROM LoadCarriers WHERE LoadCarrierType = 4",
      "SELECT * FROM Locations WHERE LocationType = 1"
    ],
    "confirmed": false
  }
}
```

## Common Workflows

### Workflow 1: Create Test Load Carrier with Location

```json
// Step 1: Verify location exists
{
  "tool": "execute_query",
  "arguments": {
    "query": "SELECT LocationId FROM Locations WHERE Barcode = 'LOC-TEST-01'"
  }
}

// Step 2: Insert load carrier with FK validation
{
  "tool": "insert_data",
  "arguments": {
    "table_name": "LoadCarriers",
    "data": {
      "LoadCarrierId": "F6789012-89AB-CDEF-0123-456789ABCDEF",
      "Barcode": "LC-WORKFLOW-001",
      "SourceLocationId": "<location-id-from-step-1>",
      "LoadCarrierType": 5,
      "CurrentStatus": 0,
      "CreatedBy": "WORKFLOW",
      "Deleted": false,
      "PositionIndex": 0
    },
    "validate_fk": true
  }
}

// Step 3: Verify insertion
{
  "tool": "execute_query",
  "arguments": {
    "query": "SELECT * FROM LoadCarriers WHERE Barcode = 'LC-WORKFLOW-001'"
  }
}
```

### Workflow 2: Update and Track Changes

```json
// Step 1: Get current state
{
  "tool": "execute_query",
  "arguments": {
    "query": "SELECT * FROM LoadCarriers WHERE Barcode = 'LC-WORKFLOW-001'"
  }
}

// Step 2: Update with tracking
{
  "tool": "update_data",
  "arguments": {
    "table_name": "LoadCarriers",
    "data": {
      "CurrentStatus": 3,
      "TareWeight": 50,
      "GrossWeight": 250,
      "UpdatedBy": "WORKFLOW",
      "UpdateDate": "2025-10-31T12:00:00Z"
    },
    "where_clause": "Barcode = 'LC-WORKFLOW-001'",
    "confirmed": true
  }
}

// Step 3: Verify update
{
  "tool": "execute_query",
  "arguments": {
    "query": "SELECT * FROM LoadCarriers WHERE Barcode = 'LC-WORKFLOW-001'"
  }
}
```

### Workflow 3: Cleanup Test Data

```json
// Step 1: Check what will be deleted
{
  "tool": "execute_query",
  "arguments": {
    "query": "SELECT COUNT(*) as count FROM LoadCarriers WHERE CreatedBy = 'TEST-USER'"
  }
}

// Step 2: Delete test records
{
  "tool": "delete_data",
  "arguments": {
    "table_name": "LoadCarriers",
    "where_clause": "CreatedBy = 'TEST-USER' AND Barcode LIKE 'TEST-%'",
    "confirmed": true
  }
}

// Step 3: Verify cleanup
{
  "tool": "execute_query",
  "arguments": {
    "query": "SELECT COUNT(*) as count FROM LoadCarriers WHERE CreatedBy = 'TEST-USER'"
  }
}
```

### Workflow 4: Atomic Multi-Record Creation

```json
{
  "tool": "execute_transaction",
  "arguments": {
    "statements": [
      "INSERT INTO TestLoadCarriers (LoadCarrierId, Barcode, LoadCarrierType, CurrentStatus, CreatedBy, Deleted, PositionIndex) VALUES ('11111111-1111-1111-1111-111111111111', 'BATCH-001', 4, 0, 'BATCH', 0, 0)",
      "INSERT INTO TestLoadCarriers (LoadCarrierId, Barcode, LoadCarrierType, CurrentStatus, CreatedBy, Deleted, PositionIndex) VALUES ('22222222-2222-2222-2222-222222222222', 'BATCH-002', 4, 0, 'BATCH', 0, 1)",
      "INSERT INTO TestLoadCarriers (LoadCarrierId, Barcode, LoadCarrierType, CurrentStatus, CreatedBy, Deleted, PositionIndex) VALUES ('33333333-3333-3333-3333-333333333333', 'BATCH-003', 4, 0, 'BATCH', 0, 2)",
      "UPDATE TestLoadCarriers SET CurrentStatus = 1 WHERE CreatedBy = 'BATCH'"
    ],
    "confirmed": true
  }
}
```

## Error Scenarios

### FK Violation During Insert

```json
{
  "tool": "insert_data",
  "arguments": {
    "table_name": "LoadCarriers",
    "data": {
      "LoadCarrierId": "99999999-9999-9999-9999-999999999999",
      "Barcode": "ERROR-TEST",
      "SourceLocationId": "00000000-0000-0000-0000-000000000000",
      "LoadCarrierType": 4,
      "CurrentStatus": 0,
      "CreatedBy": "ERROR",
      "Deleted": false
    }
  }
}
```

**Response:**
```json
{
  "error": "Foreign key validation failed",
  "violations": [
    "Foreign key violation: SourceLocationId references Locations.LocationId, but value '00000000-0000-0000-0000-000000000000' does not exist"
  ]
}
```

### Transaction Rollback Example

```json
{
  "tool": "execute_transaction",
  "arguments": {
    "statements": [
      "INSERT INTO TestLoadCarriers (LoadCarrierId, Barcode, LoadCarrierType, CurrentStatus, CreatedBy, Deleted) VALUES ('AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA', 'TX-ROLLBACK-1', 4, 0, 'TX', 0)",
      "INSERT INTO TestLoadCarriers (LoadCarrierId, Barcode, LoadCarrierType, CurrentStatus, CreatedBy, Deleted) VALUES ('AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA', 'TX-ROLLBACK-2', 4, 0, 'TX', 0)"
    ],
    "confirmed": true
  }
}
```

**Response:**
```json
{
  "error": "Transaction failed and was rolled back. Violation of PRIMARY KEY constraint 'PK_LoadCarriers'. Cannot insert duplicate key..."
}
```

Note: The first INSERT is also rolled back, ensuring data consistency.

## Best Practices

1. **Always confirm before writes**: Set `confirmed: true` for all mutations
2. **Validate FKs on inserts**: Keep `validate_fk: true` (default) to prevent orphaned records
3. **Use specific WHERE clauses**: Avoid broad UPDATE/DELETE operations
4. **Test queries first**: Use `execute_query` to verify your WHERE clauses
5. **Use transactions for related changes**: Group related operations to maintain consistency
6. **Check logs**: Review `logs/mutations-*.log` after operations
7. **Start small**: Test with single records before bulk operations
8. **Backup first**: Always have database backups before major operations

## Troubleshooting

### Common Issues

1. **"Foreign key validation failed"**
   - Check that referenced records exist
   - Verify GUID format is correct
   - Use `execute_query` to confirm referenced IDs

2. **"WHERE clause is required"**
   - All UPDATE/DELETE operations need WHERE clauses
   - Even if updating all records, specify a condition

3. **"Table not whitelisted for truncation"**
   - Only tables starting with "Test" can be truncated
   - Or add the table to `TRUNCATE_WHITELIST` in code

4. **"Transaction failed and was rolled back"**
   - Check mutation log for specific error
   - Verify all SQL syntax is correct
   - Ensure all FKs are valid across all statements

## Logging

All operations are logged to `logs/mutations-YYYY-MM-DD.log`:

```json
{
  "timestamp": "2025-10-31T12:00:00.000Z",
  "operation": "INSERT",
  "database": "TestRobot",
  "details": {
    "table": "LoadCarriers",
    "data": { ... }
  }
}
```

Check logs to:
- Audit all database changes
- Troubleshoot failed operations
- Track test data creation
- Review rollback events
