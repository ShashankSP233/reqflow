@echo off
cd /d C:\webportal\nginx
start "" .\nginx.exe
cd /d D:\reqflow
start cmd /k "pnpm run dev"