const { io } = require('socket.io-client');

// Valid test JWT token
const testToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LXVzZXItMTIzIiwibmFtZSI6IlRlc3QgVXNlciIsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsImlhdCI6MTc1Mzg0OTk3NiwiZXhwIjoxNzUzODUxNzc2fQ.NSXvX-tFtmFmNDOrmw-jvVCmVAxTEGMr_oC3DxnBjdE';

const socket = io('http://localhost:3000/chat', {
  auth: {
    token: testToken
  }
});

socket.on('connect', () => {
  console.log('✅ Connected to WebSocket server');
  console.log('Socket ID:', socket.id);
  
  // 채팅방 조인 테스트
  socket.emit('join_room', { chat_room_id: 'test-room-1' });
});

socket.on('disconnect', () => {
  console.log('❌ Disconnected from WebSocket server');
});

socket.on('connect_error', (error) => {
  console.log('⚠️ Connection error:', error.message);
});

// WebSocket 이벤트 리스너들
socket.on('new_message', (data) => {
  console.log('📨 New message received:', data);
});

socket.on('user_online', (data) => {
  console.log('🟢 User came online:', data);
});

socket.on('user_offline', (data) => {
  console.log('🔴 User went offline:', data);
});

socket.on('message_read', (data) => {
  console.log('👁️ Message read:', data);
});

socket.on('user_typing_start', (data) => {
  console.log('⌨️ User started typing:', data);
});

socket.on('user_typing_stop', (data) => {
  console.log('⏹️ User stopped typing:', data);
});

// 3초 후 메시지 전송 시도
setTimeout(() => {
  console.log('Attempting to send test message...');
  socket.emit('send_message', {
    chat_room_id: 'test-room-1',
    message_text: '안녕하세요! WebSocket 테스트 메시지입니다.',
    message_type: 'text'
  });
}, 3000);

// 10초 후 연결 종료
setTimeout(() => {
  console.log('Closing connection...');
  socket.disconnect();
  process.exit(0);
}, 10000);