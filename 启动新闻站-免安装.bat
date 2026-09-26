@echo off
rem cnuhs-news 便携启动器：无需安装 Node.js
rem 优先使用文件夹内自带的 node.exe，其次尝试系统 PATH / D:\nodejs
setlocal
cd /d "%~dp0"
set "NODE=%~dp0node.exe"
if not exist "%NODE%" (
  where node >nul 2>nul && set "NODE=node" || set "NODE=D:\nodejs\node.exe"
)
if not exist "%NODE%" (
  echo 未找到 node.exe：请确认本文件夹内有 node.exe，或系统已安装 Node.js
  pause
  exit /b 1
)
"%NODE%" "%~dp0server.js"
if errorlevel 1 (
  echo.
  echo 服务器未能启动，请查看上方错误信息。
  pause
)
