Write-Host "Checking available ODBC drivers..." -ForegroundColor Cyan
Write-Host ""

$drivers = Get-OdbcDriver | Where-Object { $_.Name -like "*SQL*" }

if ($drivers.Count -eq 0) {
    Write-Host "No SQL Server ODBC drivers found!" -ForegroundColor Red
} else {
    Write-Host "Found SQL Server ODBC drivers:" -ForegroundColor Green
    foreach ($driver in $drivers) {
        Write-Host "  - $($driver.Name)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Listing all LocalDB instances on this machine..." -ForegroundColor Cyan
sqllocaldb info

# To inspect a specific instance:
#   sqllocaldb info <instance-name>
# e.g. sqllocaldb info MSSQLLocalDB
