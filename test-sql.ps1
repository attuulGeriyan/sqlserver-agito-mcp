$server = if ($env:SQLSERVER_HOST) { $env:SQLSERVER_HOST } else { $args[0] }
$database = if ($env:SQLSERVER_DATABASE) { $env:SQLSERVER_DATABASE } elseif ($args[1]) { $args[1] } else { "master" }

if (-not $server) {
    Write-Host "Usage: \$env:SQLSERVER_HOST='<server>'; ./test-sql.ps1 [database]" -ForegroundColor Yellow
    Write-Host "   or: ./test-sql.ps1 '<server>' [database]" -ForegroundColor Yellow
    exit 1
}

$connectionString = "Driver={ODBC Driver 17 for SQL Server};Server=$server;Database=$database;Trusted_Connection=Yes;"

Write-Host "Testing connection with:" -ForegroundColor Cyan
Write-Host $connectionString -ForegroundColor Yellow
Write-Host ""

try {
    $conn = New-Object System.Data.Odbc.OdbcConnection($connectionString)
    $conn.Open()
    Write-Host "✓ Connection successful!" -ForegroundColor Green

    $cmd = New-Object System.Data.Odbc.OdbcCommand("SELECT @@VERSION AS version, DB_NAME() AS [database]", $conn)
    $reader = $cmd.ExecuteReader()

    Write-Host ""
    Write-Host "Server info:" -ForegroundColor Cyan
    while ($reader.Read()) {
        Write-Host "  Version:  $($reader.GetValue(0))"
        Write-Host "  Database: $($reader.GetValue(1))"
    }

    $reader.Close()
    $conn.Close()
    Write-Host ""
    Write-Host "✓ Test completed successfully!" -ForegroundColor Green
} catch {
    Write-Host "✗ Error:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}
