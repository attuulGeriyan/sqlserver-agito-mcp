$connectionString = "Driver={ODBC Driver 17 for SQL Server};Server=(localdb)\SQLLocalEXP01;Database=TestRobot;Trusted_Connection=Yes;"

Write-Host "Testing connection with:" -ForegroundColor Cyan
Write-Host $connectionString -ForegroundColor Yellow
Write-Host ""

try {
    $conn = New-Object System.Data.Odbc.OdbcConnection($connectionString)
    $conn.Open()
    Write-Host "✓ Connection successful!" -ForegroundColor Green

    $cmd = New-Object System.Data.Odbc.OdbcCommand("SELECT TOP 5 LoadCarrierID, LoadCarrierType, Status FROM LoadCarriers", $conn)
    $reader = $cmd.ExecuteReader()

    Write-Host ""
    Write-Host "Sample data from LoadCarriers:" -ForegroundColor Cyan
    while ($reader.Read()) {
        Write-Host "  LoadCarrierID: $($reader.GetValue(0)), Type: $($reader.GetValue(1)), Status: $($reader.GetValue(2))"
    }

    $reader.Close()
    $conn.Close()
    Write-Host ""
    Write-Host "✓ Test completed successfully!" -ForegroundColor Green
} catch {
    Write-Host "✗ Error:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}
