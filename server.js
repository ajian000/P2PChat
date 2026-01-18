#!/usr/bin/env node
/**
 * WebRTC 信令服务器
 * 用于协助建立 P2P 语音连接
 */

const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

// 读取配置文件
let config;
try {
    config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
} catch (error) {
    console.warn('⚠️ 无法读取配置文件，使用默认配置');
    config = {
        port: 25554
    };
}

const PORT = config.port;

// 存储房间和用户信息
const rooms = new Map(); // roomId -> Set of ws
const users = new Map(); // ws -> {username, roomId, userId}

// 创建 HTTP 服务器
const server = http.createServer((req, res) => {
    // 根据路由返回不同文件
    let filePath = '.' + req.url;
    if (filePath === './') {
        filePath = './index.html';
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
    };

    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404);
                res.end('404 - Not Found');
            } else {
                res.writeHead(500);
                res.end('500 - Server Error: ' + error.code);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

// 创建 WebSocket 服务器
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
    const userId = Date.now() + Math.random().toString(36).substr(2, 9);
    const ip = req.socket.remoteAddress;

    console.log(`[连接] 用户 ${userId} 从 ${ip} 连接`);

    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            handleMessage(ws, userId, message);
        } catch (e) {
            console.error(`[错误] ${userId}: ${e.message}`);
        }
    });

    ws.on('close', () => {
        handleDisconnect(ws, userId);
    });

    ws.on('error', (error) => {
        console.error(`[错误] ${userId} WebSocket 错误:`, error);
    });
});

// 处理消息
function handleMessage(ws, userId, message) {
    const user = users.get(ws);

    switch (message.type) {
        case 'join':
            handleJoin(ws, userId, message);
            break;

        case 'offer':
        case 'answer':
            handleSdp(ws, user, message);
            break;

        case 'ice-candidate':
            handleIceCandidate(ws, user, message);
            break;

        case 'leave-voice':
            handleLeaveVoice(ws, user);
            break;
    }
}

// 处理加入房间
function handleJoin(ws, userId, message) {
    const { username, roomId } = message;

    console.log(`[加入] ${username} 加入房间 ${roomId}`);

    // 保存用户信息
    users.set(ws, {
        username,
        roomId,
        userId
    });

    // 获取或创建房间
    if (!rooms.has(roomId)) {
        rooms.set(roomId, new Set());
    }

    const room = rooms.get(roomId);

    // 通知房间内其他用户新用户加入
    room.forEach(client => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
            const otherUser = users.get(client);
            client.send(JSON.stringify({
                type: 'user-joined',
                username,
                userId
            }));
        }
    });

    // 添加到房间
    room.add(ws);

    // 发送房间内用户列表给新用户
    const roomUsers = Array.from(room)
        .filter(client => client !== ws)
        .map(client => users.get(client))
        .filter(u => u);

    ws.send(JSON.stringify({
        type: 'room-users',
        users: roomUsers
    }));

    console.log(`[房间 ${roomId}] 当前用户数: ${room.size}`);
}

// 处理 SDP offer/answer
function handleSdp(ws, user, message) {
    if (!user || !user.roomId) return;

    const room = rooms.get(user.roomId);
    if (!room) return;

    console.log(`[信令] ${user.username} 发送 ${message.type}`);

    // 广播给房间内其他用户
    room.forEach(client => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: message.type,
                sdp: message.sdp,
                from: user.userId,
                username: user.username
            }));
        }
    });
}

// 处理 ICE candidate
function handleIceCandidate(ws, user, message) {
    if (!user || !user.roomId) return;

    const room = rooms.get(user.roomId);
    if (!room) return;

    // 转发给房间内其他用户
    room.forEach(client => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: 'ice-candidate',
                candidate: message.candidate,
                from: user.userId
            }));
        }
    });
}

// 处理离开语音
function handleLeaveVoice(ws, user) {
    if (!user || !user.roomId) return;

    const room = rooms.get(user.roomId);
    if (!room) return;

    // 从房间移除
    room.delete(ws);

    // 如果房间为空，删除房间
    if (room.size === 0) {
        rooms.delete(user.roomId);
        console.log(`[房间 ${user.roomId}] 已删除`);
    }

    console.log(`[离开] ${user.username} 离开房间 ${user.roomId}`);

    // 通知房间内其他用户
    room.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: 'user-left',
                userId: user.userId,
                username: user.username
            }));
        }
    });

    users.delete(ws);
}

// 处理断开连接
function handleDisconnect(ws, userId) {
    const user = users.get(ws);
    if (user) {
        handleLeaveVoice(ws, user);
    }
    console.log(`[断开] 用户 ${userId} 断开连接`);
}

// 启动服务器
server.listen(PORT, '0.0.0.0', () => {
    console.log('========================================');
    console.log('  P2P 语音聊天室服务器已启动');
    console.log('========================================');
    console.log(`  访问地址: http://localhost:${PORT}`);
    console.log(`  端口: ${PORT}`);
    console.log(`  配置文件: config.json`);
    console.log('========================================');
    console.log('  提示: 生产环境请使用 HTTPS');
    console.log('========================================');
});

// 优雅关闭
process.on('SIGINT', () => {
    console.log('\n正在关闭服务器...');
    wss.close();
    server.close();
    process.exit(0);
});
