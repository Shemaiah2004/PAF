# PAF Server Startup Script
# Automatically kills any process on port 8080, sets JAVA_HOME, and starts the Spring Boot server

Write-Host "=== PAF Server Startup ===" -ForegroundColor Cyan

# Step 1: Kill any process on port 8080
$existing = Get-NetTCPConnection -LocalPort 8080 -ErrorAction SilentlyContinue
if ($existing) {
    $existing | ForEach-Object {
        Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
    }
    Write-Host "[OK] Cleared existing process on port 8080" -ForegroundColor Green
    Start-Sleep -Seconds 1
} else {
    Write-Host "[OK] Port 8080 is free" -ForegroundColor Green
}

# Step 2: Set JAVA_HOME
$env:JAVA_HOME = "C:\Users\Shemaiah David\AppData\Local\Programs\Eclipse Adoptium\jdk-21.0.10.7-hotspot"
Write-Host "[OK] JAVA_HOME set to $env:JAVA_HOME" -ForegroundColor Green

# Step 3: Start the server
Write-Host "[..] Starting Spring Boot server on port 8080..." -ForegroundColor Yellow
.\mvnw.cmd spring-boot:run
