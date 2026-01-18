# P2P 语音聊天室

基于 WebRTC 的点对点实时语音聊天室，仅需一个端口，支持多用户同时语音通话。

## 特点

✅ **极简部署** - 单个端口，单个文件即可运行
✅ **P2P 传输** - 音频不经过服务器，延迟极低
✅ **零配置** - 浏览器直接访问，无需安装
✅ **多用户支持** - 支持多人同时语音通话
✅ **跨平台** - 支持所有现代浏览器和设备

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务器

双击 `启动服务器.bat` 或运行：

```bash
npm start
```

### 3. 访问网页

打开浏览器访问：

```
http://localhost:3000
```

### 4. 开始使用

1. 输入用户名和房间号
2. 点击"进入房间"
3. 点击"加入语音"
4. 邀请朋友加入同一房间
5. 开始实时语音通话！

## 使用方法

### 单人测试
1. 打开浏览器访问 `http://localhost:3000`
2. 输入用户名"张三"，房间号"room1"
3. 点击"进入房间"
4. 点击"加入语音"

### 两人通话
1. 用户 A：用户名"张三"，房间号"room1"
2. 用户 B：用户名"李四"，房间号"room1"
3. 两人都点击"加入语音"
4. 开始实时语音通话！

### 多人会议
- 所有用户输入相同的房间号
- 每个人输入不同的用户名
- 所有人点击"加入语音"
- 开始多人语音会议！

### 多个房间
- 不同的房间号 = 不同的语音室
- 例如：room1、room2、room3 可以同时使用

## 技术架构

```
用户A ←── WebRTC P2P ──→ 用户B
  ↑                            ↓
  └── WebSocket 信令 (1端口) ──┘
```

**核心优势**：
- 音频通过 P2P 直连，不经过服务器
- 服务器只负责信令（SDP/ICE 交换）
- 极低延迟（<50ms）

## 浏览器支持

✅ Chrome 23+
✅ Firefox 22+
✅ Safari 11+
✅ Edge (所有版本)

❌ IE（不支持 WebRTC）

## 注意事项

### 麦克风权限
- 首次使用需要允许浏览器使用麦克风
- 如果误点"拒绝"，需要在浏览器设置中重新授权

### HTTPS 要求
- **本地测试**：可以使用 http
- **公网部署**：必须使用 https

### 网络环境
- **局域网**：完美支持
- **公网**：通过 STUN 服务器穿透
- **受限网络**：可能需要 TURN 服务器

## 文件结构

```
OnlineChat/
├── server.js           # 信令服务器
├── index.html          # 网页界面
├── app.js             # 客户端逻辑
├── package.json        # 依赖配置
├── 启动服务器.bat     # Windows 启动脚本
└── README.md          # 说明文档
```

## 部署到公网

### 1. 使用 HTTPS

需要配置 SSL 证书，使用 https 模块启动服务器。

### 2. 使用 Nginx 反向代理

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
    }
}
```

### 3. 配置 TURN 服务器

对于严格防火墙环境，需要部署 TURN 服务器。

## 故障排查

### 无法连接
- 检查服务器是否运行
- 检查防火墙是否阻止 3000 端口

### 听不到声音
- 检查麦克风权限
- 检查系统音量
- 确认对方已加入语音

### 延迟较高
- 检查网络连接
- 考虑部署 TURN 服务器

## 许可证

MIT License
