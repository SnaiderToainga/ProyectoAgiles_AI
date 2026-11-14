@echo off
echo Iniciando todos los servicios de EduMonitor AI...
powershell -ExecutionPolicy Bypass -File "%~dp0start-dev.ps1"
pause
