@echo off
chcp 65001 > nul
title P2P 语音聊天室服务器

echo ========================================
echo   P2P 语音聊天室服务器
echo ========================================
echo.

:: 检查是否已安装依赖
if not exist "node_modules" (
    echo 首次运行，正在安装依赖...
    call npm install
    echo.
)

echo 启动服务器...
echo.
echo 正在读取配置文件 config.json...
if exist config.json (
    echo 配置文件已加载
) else (
    echo ⚠️ 配置文件不存在，使用默认端口 25554
)
echo.
echo 按 Ctrl+C 停止服务器
echo.

node server.js

pause
