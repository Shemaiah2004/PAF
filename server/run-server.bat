@echo off
echo === PAF Server Startup ===
echo Clearing port 8080...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8080 "') do (
    taskkill /PID %%a /F >nul 2>&1
)
echo Port cleared.
set JAVA_HOME=C:\Users\Shemaiah David\AppData\Local\Programs\Eclipse Adoptium\jdk-21.0.10.7-hotspot
echo Starting Spring Boot server...
.\mvnw.cmd spring-boot:run
