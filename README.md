# P2P 语音聊天室

基于 WebRTC 的点对点实时语音聊天室，仅需一个端口，支持多用户同时语音通话。

## 特点

✅ **极简部署** - 单个端口，单个文件即可运行<br>
✅ **P2P 传输** - 音频不经过服务器，延迟极低<br>
✅ **零配置** - 浏览器直接访问，无需安装<br>
✅ **多用户支持** - 支持多人同时语音通话<br>
✅ **跨平台** - 支持所有现代浏览器和设备<br>

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

### 4. 开始使用

1. 输入用户名和房间号<br>
2. 点击"进入房间"<br>
3. 点击"加入语音"<br>
4. 邀请朋友加入同一房间<br>
5. 开始实时语音通话！<br>

## 使用方法

### 单人测试
1. 打开浏览器访问 <br>
2. 输入用户名"张三"，房间号"room1"<br>
3. 点击"进入房间"<br>
4. 点击"加入语音"<br>

### 两人通话
1. 用户 A：用户名"张三"，房间号"room1"<br>
2. 用户 B：用户名"李四"，房间号"room1"<br>
3. 两人都点击"加入语音"<br>
4. 开始实时语音通话！<br>

### 多人会议
- 所有用户输入相同的房间号<br>
- 每个人输入不同的用户名<br>
- 所有人点击"加入语音"<br>
- 开始多人语音会议！<br>

### 多个房间
- 不同的房间号 = 不同的语音室<br>
- 例如：room1、room2、room3 可以同时使用<br>

## 技术架构

```
用户A ←── WebRTC P2P ──→ 用户B
  ↑                            ↓
  └── WebSocket 信令 (1端口) ──┘
```

**核心优势**：
- 音频通过 P2P 直连，不经过服务器<br>
- 服务器只负责信令（SDP/ICE 交换）<br>
- 极低延迟（<50ms）<br>

## 浏览器支持

✅ Chrome 23+<br>
✅ Firefox 22+<br>
✅ Safari 11+<br>
✅ Edge (所有版本)<br>

❌ IE（不支持 WebRTC）<br>

## 注意事项

### 麦克风权限
- 首次使用需要允许浏览器使用麦克风<br>
- 如果误点"拒绝"，需要在浏览器设置中重新授权<br>

### HTTPS 要求
- **本地测试**：可以使用 http<br>
- **公网部署**：必须使用 https<br>

### 网络环境
- **局域网**：完美支持<br>
- **公网**：通过 STUN 服务器穿透<br>
- **受限网络**：可能需要 TURN 服务器<br>

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
- 检查服务器是否运行<br>
- 检查防火墙是否阻止端口<br>

### 听不到声音
- 检查麦克风权限<br>
- 检查系统音量<br>
- 确认对方已加入语音<br>

### 延迟较高
- 检查网络连接<br>
- 考虑部署 TURN 服务器<br>

## 许可证

MIT License

