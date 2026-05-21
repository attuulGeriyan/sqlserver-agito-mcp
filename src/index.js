"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
var stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
var types_js_1 = require("@modelcontextprotocol/sdk/types.js");
var mssql_1 = require("mssql");
// SQL Server connection configuration
var config = {
    server: "(localdb)\\SQLLocalEXP01",
    database: "TestRobot", // Default database
    options: {
        trustServerCertificate: true,
        enableArithAbort: true,
    },
    authentication: {
        type: "default",
        options: {
            userName: undefined,
            password: undefined,
        },
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000,
    },
};
// Create connection pool
var pool = null;
function getPool() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!!pool) return [3 /*break*/, 2];
                    return [4 /*yield*/, mssql_1.default.connect(config)];
                case 1:
                    pool = _a.sent();
                    _a.label = 2;
                case 2: return [2 /*return*/, pool];
            }
        });
    });
}
// Server setup
var server = new index_js_1.Server({
    name: "sqlserver-agito",
    version: "0.1.0",
}, {
    capabilities: {
        tools: {},
    },
});
// Tool definitions
server.setRequestHandler(types_js_1.ListToolsRequestSchema, function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        return [2 /*return*/, {
                tools: [
                    {
                        name: "execute_query",
                        description: "Execute a SELECT query on TestRobot or WCSTest database. Read-only, safe for exploration.",
                        inputSchema: {
                            type: "object",
                            properties: {
                                query: {
                                    type: "string",
                                    description: "The SELECT SQL query to execute",
                                },
                                database: {
                                    type: "string",
                                    enum: ["TestRobot", "WCSTest"],
                                    description: "Which database to query (default: TestRobot)",
                                },
                            },
                            required: ["query"],
                        },
                    },
                    {
                        name: "list_tables",
                        description: "List all tables in the specified database",
                        inputSchema: {
                            type: "object",
                            properties: {
                                database: {
                                    type: "string",
                                    enum: ["TestRobot", "WCSTest"],
                                    description: "Which database to list tables from (default: TestRobot)",
                                },
                            },
                        },
                    },
                    {
                        name: "describe_table",
                        description: "Get detailed schema information for a specific table including columns, data types, and constraints",
                        inputSchema: {
                            type: "object",
                            properties: {
                                table_name: {
                                    type: "string",
                                    description: "Name of the table to describe",
                                },
                                database: {
                                    type: "string",
                                    enum: ["TestRobot", "WCSTest"],
                                    description: "Which database the table is in (default: TestRobot)",
                                },
                            },
                            required: ["table_name"],
                        },
                    },
                    {
                        name: "show_foreign_keys",
                        description: "Show all foreign key relationships for a table or entire database",
                        inputSchema: {
                            type: "object",
                            properties: {
                                table_name: {
                                    type: "string",
                                    description: "Optional: specific table name. If omitted, shows all FKs",
                                },
                                database: {
                                    type: "string",
                                    enum: ["TestRobot", "WCSTest"],
                                    description: "Which database to query (default: TestRobot)",
                                },
                            },
                        },
                    },
                    {
                        name: "get_sample_data",
                        description: "Get sample rows from a table to understand the data structure",
                        inputSchema: {
                            type: "object",
                            properties: {
                                table_name: {
                                    type: "string",
                                    description: "Name of the table",
                                },
                                limit: {
                                    type: "number",
                                    description: "Number of rows to return (default: 10, max: 100)",
                                },
                                database: {
                                    type: "string",
                                    enum: ["TestRobot", "WCSTest"],
                                    description: "Which database the table is in (default: TestRobot)",
                                },
                            },
                            required: ["table_name"],
                        },
                    },
                ],
            }];
    });
}); });
// Tool execution
server.setRequestHandler(types_js_1.CallToolRequestSchema, function (request) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, name, args, dbName, currentPool, _b, query, trimmedQuery, result, result, tableName, columns, constraints, tableName, query, result, result, tableName, limit, result, error_1;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _a = request.params, name = _a.name, args = _a.arguments;
                _c.label = 1;
            case 1:
                _c.trys.push([1, 19, , 20]);
                dbName = (args === null || args === void 0 ? void 0 : args.database) || "TestRobot";
                return [4 /*yield*/, getPool()];
            case 2:
                currentPool = _c.sent();
                // Switch database if needed
                return [4 /*yield*/, currentPool.request().query("USE [".concat(dbName, "]"))];
            case 3:
                // Switch database if needed
                _c.sent();
                _b = name;
                switch (_b) {
                    case "execute_query": return [3 /*break*/, 4];
                    case "list_tables": return [3 /*break*/, 6];
                    case "describe_table": return [3 /*break*/, 8];
                    case "show_foreign_keys": return [3 /*break*/, 11];
                    case "get_sample_data": return [3 /*break*/, 15];
                }
                return [3 /*break*/, 17];
            case 4:
                query = args === null || args === void 0 ? void 0 : args.query;
                trimmedQuery = query.trim().toUpperCase();
                if (!trimmedQuery.startsWith("SELECT")) {
                    return [2 /*return*/, {
                            content: [
                                {
                                    type: "text",
                                    text: "Error: Only SELECT queries are allowed in read-only mode.",
                                },
                            ],
                        }];
                }
                return [4 /*yield*/, currentPool.request().query(query)];
            case 5:
                result = _c.sent();
                return [2 /*return*/, {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify({
                                    rowCount: result.recordset.length,
                                    data: result.recordset,
                                }, null, 2),
                            },
                        ],
                    }];
            case 6: return [4 /*yield*/, currentPool.request().query("\n          SELECT TABLE_SCHEMA, TABLE_NAME \n          FROM INFORMATION_SCHEMA.TABLES \n          WHERE TABLE_TYPE = 'BASE TABLE'\n          ORDER BY TABLE_SCHEMA, TABLE_NAME\n        ")];
            case 7:
                result = _c.sent();
                return [2 /*return*/, {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify({
                                    database: dbName,
                                    tables: result.recordset,
                                }, null, 2),
                            },
                        ],
                    }];
            case 8:
                tableName = args === null || args === void 0 ? void 0 : args.table_name;
                return [4 /*yield*/, currentPool.request()
                        .input("tableName", mssql_1.default.NVarChar, tableName)
                        .query("\n            SELECT \n              COLUMN_NAME,\n              DATA_TYPE,\n              CHARACTER_MAXIMUM_LENGTH,\n              NUMERIC_PRECISION,\n              NUMERIC_SCALE,\n              IS_NULLABLE,\n              COLUMN_DEFAULT,\n              ORDINAL_POSITION\n            FROM INFORMATION_SCHEMA.COLUMNS\n            WHERE TABLE_NAME = @tableName\n            ORDER BY ORDINAL_POSITION\n          ")];
            case 9:
                columns = _c.sent();
                return [4 /*yield*/, currentPool.request()
                        .input("tableName", mssql_1.default.NVarChar, tableName)
                        .query("\n            SELECT \n              tc.CONSTRAINT_NAME,\n              tc.CONSTRAINT_TYPE,\n              kcu.COLUMN_NAME\n            FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc\n            JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu\n              ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME\n            WHERE tc.TABLE_NAME = @tableName\n          ")];
            case 10:
                constraints = _c.sent();
                return [2 /*return*/, {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify({
                                    database: dbName,
                                    table: tableName,
                                    columns: columns.recordset,
                                    constraints: constraints.recordset,
                                }, null, 2),
                            },
                        ],
                    }];
            case 11:
                tableName = args === null || args === void 0 ? void 0 : args.table_name;
                query = "\n          SELECT \n            fk.name AS ForeignKey,\n            OBJECT_NAME(fk.parent_object_id) AS TableName,\n            COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS ColumnName,\n            OBJECT_NAME(fk.referenced_object_id) AS ReferencedTable,\n            COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS ReferencedColumn\n          FROM sys.foreign_keys fk\n          INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id\n        ";
                if (!tableName) return [3 /*break*/, 13];
                query += " WHERE OBJECT_NAME(fk.parent_object_id) = @tableName";
                return [4 /*yield*/, currentPool
                        .request()
                        .input("tableName", mssql_1.default.NVarChar, tableName)
                        .query(query)];
            case 12:
                result = _c.sent();
                return [2 /*return*/, {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify({
                                    database: dbName,
                                    table: tableName,
                                    foreignKeys: result.recordset,
                                }, null, 2),
                            },
                        ],
                    }];
            case 13: return [4 /*yield*/, currentPool.request().query(query)];
            case 14:
                result = _c.sent();
                return [2 /*return*/, {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify({
                                    database: dbName,
                                    allForeignKeys: result.recordset,
                                }, null, 2),
                            },
                        ],
                    }];
            case 15:
                tableName = args === null || args === void 0 ? void 0 : args.table_name;
                limit = Math.min((args === null || args === void 0 ? void 0 : args.limit) || 10, 100);
                return [4 /*yield*/, currentPool.request()
                        .input("tableName", mssql_1.default.NVarChar, tableName)
                        .query("SELECT TOP ".concat(limit, " * FROM [").concat(tableName, "]"))];
            case 16:
                result = _c.sent();
                return [2 /*return*/, {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify({
                                    database: dbName,
                                    table: tableName,
                                    rowCount: result.recordset.length,
                                    sampleData: result.recordset,
                                }, null, 2),
                            },
                        ],
                    }];
            case 17: return [2 /*return*/, {
                    content: [
                        {
                            type: "text",
                            text: "Unknown tool: ".concat(name),
                        },
                    ],
                }];
            case 18: return [3 /*break*/, 20];
            case 19:
                error_1 = _c.sent();
                return [2 /*return*/, {
                        content: [
                            {
                                type: "text",
                                text: "Error: ".concat(error_1 instanceof Error ? error_1.message : String(error_1)),
                            },
                        ],
                        isError: true,
                    }];
            case 20: return [2 /*return*/];
        }
    });
}); });
// Start server
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var transport;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    transport = new stdio_js_1.StdioServerTransport();
                    return [4 /*yield*/, server.connect(transport)];
                case 1:
                    _a.sent();
                    console.error("SQL Server MCP server running on stdio");
                    return [2 /*return*/];
            }
        });
    });
}
main().catch(function (error) {
    console.error("Fatal error:", error);
    process.exit(1);
});
