/**
 * P2P 语音聊天室客户端
 */

// WebRTC 配置
const config = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

// 状态
let ws = null;
let username = null;
let roomId = null;
let userId = null;
let inVoiceCall = false;

// WebRTC
const peerConnections = new Map(); // userId -> RTCPeerConnection
const remoteAudioElements = new Map(); // userId -> Audio element
let localStream = null;
let isMicEnabled = false;

// DOM 元素
const loginForm = document.getElementById('loginForm');
const voiceRoom = document.getElementById('voiceRoom');
const usernameInput = document.getElementById('username');
const roomIdInput = document.getElementById('roomId');
const joinBtn = document.getElementById('joinBtn');
const currentRoom = document.getElementById('currentRoom');
const currentUser = document.getElementById('currentUser');
const micIndicator = document.getElementById('micIndicator');
const usersGrid = document.getElementById('usersGrid');
const joinVoiceBtn = document.getElementById('joinVoiceBtn');
const toggleMicBtn = document.getElementById('toggleMicBtn');
const leaveVoiceBtn = document.getElementById('leaveVoiceBtn');

// 存储房间用户信息
const roomUsers = new Map(); // userId -> {username, status}

// WebSocket 连接
function connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        console.log('WebSocket 已连接');
    };

    ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        handleMessage(message);
    };

    ws.onclose = () => {
        console.log('WebSocket 已断开');
        if (inVoiceCall) {
            leaveVoice();
        }
        alert('与服务器的连接已断开');
        location.reload();
    };

    ws.onerror = (error) => {
        console.error('WebSocket 错误:', error);
    };
}

// 处理消息
function handleMessage(message) {
    console.log('收到消息:', message.type);

    switch (message.type) {
        case 'room-users':
            updateUsers(message.users);
            break;

        case 'user-joined':
            addUser(message);
            break;

        case 'user-left':
            removeUser(message.userId);
            break;

        case 'offer':
            handleOffer(message);
            break;

        case 'answer':
            handleAnswer(message);
            break;

        case 'ice-candidate':
            handleIceCandidate(message);
            break;
    }
}

// 更新用户列表
function updateUsers(users) {
    users.forEach(user => {
        roomUsers.set(user.userId, {
            username: user.username,
            status: '在房间中'
        });
    });
    renderUsers();
}

// 添加用户
function addUser(message) {
    roomUsers.set(message.userId, {
        username: message.username,
        status: '已连接'
    });
    renderUsers();

    // 如果我在语音中，与新用户建立连接
    if (inVoiceCall) {
        createPeerConnection(message.userId, message.username, true);
    }
}

// 移除用户
function removeUser(userId) {
    // 关闭连接
    const pc = peerConnections.get(userId);
    if (pc) {
        pc.close();
        peerConnections.delete(userId);
    }

    // 停止并移除音频元素
    const audio = remoteAudioElements.get(userId);
    if (audio) {
        audio.pause();
        audio.srcObject = null;
        remoteAudioElements.delete(userId);
    }

    roomUsers.delete(userId);
    renderUsers();
}

// 渲染用户列表
function renderUsers() {
    usersGrid.innerHTML = '';

    // 渲染自己
    const myCard = document.createElement('div');
    myCard.className = 'user-card active';
    myCard.innerHTML = `
        <div class="avatar">${username.charAt(0).toUpperCase()}</div>
        <div class="name">${username} (我)</div>
        <div class="status">${inVoiceCall ? (isMicEnabled ? '🎤 麦克风开启' : '🔇 麦克风关闭') : '📵 未加入语音'}</div>
    `;
    usersGrid.appendChild(myCard);

    // 渲染其他用户
    roomUsers.forEach((user, uid) => {
        const card = document.createElement('div');
        const isActive = peerConnections.has(uid);
        card.className = `user-card ${isActive ? 'active' : ''}`;

        const currentVolume = remoteAudioElements.get(uid)?.volume || 1.0;
        const volumePercent = Math.round(currentVolume * 100);

        card.innerHTML = `
            <div class="avatar">${user.username.charAt(0).toUpperCase()}</div>
            <div class="name">${user.username}</div>
            <div class="status">${isActive ? '🎤 语音中' : '📵 未加入语音'}</div>
            ${isActive ? `
                <div class="volume-control">
                    <label>🔊 音量: ${volumePercent}%</label>
                    <input type="range" min="0" max="100" value="${volumePercent}" 
                           onchange="setVolume('${uid}', this.value)">
                </div>
            ` : ''}
        `;
        usersGrid.appendChild(card);
    });
}

// 创建 WebRTC 连接
async function createPeerConnection(remoteUserId, remoteUsername, isInitiator) {
    console.log(`创建与 ${remoteUsername} 的连接，发起方: ${isInitiator}`);

    const pc = new RTCPeerConnection(config);

    // 添加本地流
    if (localStream) {
        localStream.getTracks().forEach(track => {
            pc.addTrack(track, localStream);
        });
    }

    // 处理远程流
    pc.ontrack = (event) => {
        console.log(`收到 ${remoteUsername} 的音频流`);
        playRemoteStream(event.streams[0], remoteUserId);
    };

    // 处理 ICE candidate
    pc.onicecandidate = (event) => {
        if (event.candidate && ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'ice-candidate',
                candidate: event.candidate
            }));
        }
    };

    // 处理连接状态
    pc.onconnectionstatechange = () => {
        console.log(`与 ${remoteUsername} 的连接状态: ${pc.connectionState}`);
        renderUsers();
    };

    peerConnections.set(remoteUserId, pc);

    // 如果是发起方，创建 offer
    if (isInitiator) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'offer',
                sdp: offer
            }));
            console.log('已发送 offer');
        } else {
            console.error('WebSocket 未连接，无法发送 offer');
        }
    }

    return pc;
}

// 播放远程音频流
function playRemoteStream(stream, userId) {
    // 如果已存在该用户的音频元素，先停止
    const existingAudio = remoteAudioElements.get(userId);
    if (existingAudio) {
        existingAudio.pause();
        existingAudio.srcObject = null;
    }

    const audio = new Audio();
    audio.srcObject = stream;
    audio.autoplay = true;
    audio.volume = 1.0;

    // 错误处理
    audio.onerror = (error) => {
        console.error('音频播放错误:', error);
    };

    remoteAudioElements.set(userId, audio);
    console.log(`为用户 ${userId} 创建音频元素`);
}

// 处理 offer
async function handleOffer(message) {
    const { sdp, from, username: remoteUsername } = message;

    const pc = await createPeerConnection(from, remoteUsername, false);
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'answer',
            sdp: answer
        }));
        console.log('已发送 answer');
    } else {
        console.error('WebSocket 未连接，无法发送 answer');
    }

    console.log('已发送 answer');
}

// 处理 answer
async function handleAnswer(message) {
    const { sdp, from } = message;
    const pc = peerConnections.get(from);

    if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        console.log('已设置远程描述');
    }
}

// 处理 ICE candidate
async function handleIceCandidate(message) {
    const { candidate, from } = message;
    const pc = peerConnections.get(from);

    if (pc) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
        console.log('已添加 ICE candidate');
    }
}

// 加入语音
async function joinVoice() {
    if (inVoiceCall) return;

    inVoiceCall = true;
    joinVoiceBtn.classList.add('hidden');
    leaveVoiceBtn.classList.remove('hidden');
    toggleMicBtn.classList.remove('hidden');
    toggleMicBtn.textContent = '🎤 开启麦克风';

    micIndicator.classList.remove('hidden');

    // 与房间内所有已加入语音的用户建立连接
    roomUsers.forEach((user, uid) => {
        if (!peerConnections.has(uid)) {
            createPeerConnection(uid, user.username, true);
        }
    });

    // 通知服务器我已加入语音
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'join-voice',
            username: username
        }));
    } else {
        console.error('WebSocket 未连接，无法通知服务器加入语音');
        alert('与服务器连接已断开，请刷新页面');
        inVoiceCall = false;
        joinVoiceBtn.classList.remove('hidden');
        leaveVoiceBtn.classList.add('hidden');
        toggleMicBtn.classList.add('hidden');
        micIndicator.classList.add('hidden');
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            localStream = null;
        }
        return;
    }

    renderUsers();
    console.log('✅ 已加入语音 (仅收听模式)');
}

// 切换麦克风
async function toggleMicrophone() {
    if (isMicEnabled) {
        // 关闭麦克风
        isMicEnabled = false;

        if (localStream) {
            localStream.getTracks().forEach(track => {
                track.enabled = false;
            });
        }

        toggleMicBtn.textContent = '🎤 开启麦克风';
        renderUsers();
        console.log('🔇 麦克风已关闭');
        return;
    }

    // 开启麦克风 - 申请权限
    try {
        console.log('正在请求麦克风权限...');

        if (!localStream) {
            // 第一次获取麦克风
            localStream = await navigator.mediaDevices.getUserMedia({
                audio: true
            });

            // 更新所有已存在的连接，添加音频轨道
            peerConnections.forEach((pc) => {
                localStream.getTracks().forEach(track => {
                    pc.addTrack(track, localStream);
                });
            });

            console.log('✅ 已获取麦克风权限');
        } else {
            // 启用已存在的音频轨道
            localStream.getTracks().forEach(track => {
                track.enabled = true;
            });
        }

        isMicEnabled = true;
        toggleMicBtn.textContent = '🔇 关闭麦克风';
        renderUsers();
        console.log('🎤 麦克风已开启');

    } catch (error) {
        console.error('❌ 无法获取麦克风:', error);

        let errorMsg = '无法获取麦克风：\n\n';

        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            errorMsg += '❌ 麦克风权限被拒绝\n\n';
            errorMsg += '解决方法：\n';
            errorMsg += '1. 点击浏览器地址栏左侧的锁图标\n';
            errorMsg += '2. 找到"麦克风"权限\n';
            errorMsg += '3. 改为"允许"\n';
            errorMsg += '4. 刷新页面重试';
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
            errorMsg += '❌ 未检测到麦克风设备\n\n';
            errorMsg += '请检查麦克风是否正确连接。';
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
            errorMsg += '❌ 麦克风被其他应用占用\n\n';
            errorMsg += '请关闭其他使用麦克风的应用。';
        } else {
            errorMsg += `错误：${error.name}\n`;
            errorMsg += `详情：${error.message}`;
        }

        alert(errorMsg);
    }
}

// 设置用户音量
function setVolume(userId, value) {
    const audio = remoteAudioElements.get(userId);
    if (audio) {
        audio.volume = value / 100;
        console.log(`用户 ${userId} 音量设置为 ${value}%`);
    }
}

// 离开语音
function leaveVoice() {
    if (!inVoiceCall) return;

    inVoiceCall = false;
    isMicEnabled = false;

    joinVoiceBtn.classList.remove('hidden');
    leaveVoiceBtn.classList.add('hidden');
    toggleMicBtn.classList.add('hidden');
    micIndicator.classList.add('hidden');

    // 关闭所有连接
    peerConnections.forEach((pc, uid) => {
        pc.close();
    });
    peerConnections.clear();

    // 停止并移除所有远程音频
    remoteAudioElements.forEach((audio) => {
        audio.pause();
        audio.srcObject = null;
    });
    remoteAudioElements.clear();

    // 停止本地流
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    // 通知服务器
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'leave-voice',
            username: username
        }));
    }

    renderUsers();
    console.log('已离开语音');
}

// 进入房间
joinBtn.addEventListener('click', () => {
    username = usernameInput.value.trim();
    roomId = roomIdInput.value.trim();

    if (!username) {
        alert('请输入用户名');
        return;
    }

    if (!roomId) {
        alert('请输入房间号');
        return;
    }

    // 切换界面
    loginForm.style.display = 'none';
    voiceRoom.style.display = 'block';

    currentRoom.textContent = roomId;
    currentUser.textContent = username;

    // 连接服务器
    connect();

    // 加入房间
    ws.addEventListener('open', () => {
        ws.send(JSON.stringify({
            type: 'join',
            username: username,
            roomId: roomId
        }));
    });
});

// 加入语音按钮
joinVoiceBtn.addEventListener('click', joinVoice);

// 切换麦克风按钮
toggleMicBtn.addEventListener('click', toggleMicrophone);

// 离开语音按钮
leaveVoiceBtn.addEventListener('click', leaveVoice);

// 回车键支持
roomIdInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        joinBtn.click();
    }
});

usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        roomIdInput.focus();
    }
});

// 页面加载时聚焦用户名输入框
window.addEventListener('load', () => {
    usernameInput.focus();

    // 检测麦克风设备
    checkMicrophoneAvailability();
});

// 检测麦克风设备
async function checkMicrophoneAvailability() {
    console.log('正在检测麦克风设备...');

    try {
        // 仅获取设备列表，不请求权限
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(device => device.kind === 'audioinput');

        console.log(`✅ 检测到 ${audioInputs.length} 个音频输入设备`);
        if (audioInputs.length > 0) {
            audioInputs.forEach((device, index) => {
                console.log(`${index + 1}. ${device.label || '未知设备'} (${device.deviceId})`);
            });
        } else {
            console.warn('⚠️ 未检测到麦克风设备，将以仅收听模式运行');
        }

    } catch (error) {
        console.warn('⚠️ 无法检测麦克风设备，将以仅收听模式运行:', error.message);
    }
}

// 页面关闭时清理
window.addEventListener('beforeunload', () => {
    leaveVoice();
    if (ws) {
        ws.close();
    }
});
