import io from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'https://nexvpn.onrender.com';

let socket = null;
let authToken = null;

export const initSocket = (token) => {
    // Reuse existing connected socket
    if (socket && socket.connected && authToken === token) {
        return socket;
    }
    // Clean up old socket if token changed
    if (socket) {
        socket.removeAllListeners();
        socket.disconnect();
        socket = null;
    }
    authToken = token;
    socket = io(SOCKET_URL, {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 10,
        transports: ['websocket', 'polling'],
    });
    return socket;
};

export const getSocket = () => socket;

export const connectSocket = (token) => {
    const s = initSocket(token);

    // Remove any old connect listener to avoid duplicates
    s.off('connect');
    s.on('connect', () => {
        console.log('✅ Socket connected, authenticating...');
        s.emit('authenticate', { token });
    });

    // If already connected, authenticate immediately
    if (s.connected) {
        s.emit('authenticate', { token });
    }

    return s;
};

export const disconnectSocket = () => {
    if (socket) {
        socket.removeAllListeners();
        socket.disconnect();
        socket = null;
        authToken = null;
    }
};

export const sendMessage = (to, message) => {
    if (socket) socket.emit('send_message', { to, message });
};

export const getConnectionInfo = () => {
    return new Promise((resolve, reject) => {
        if (!socket || !socket.connected) {
            reject(new Error('Socket not connected'));
            return;
        }
        const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);
        socket.once('connection_info', (data) => {
            clearTimeout(timeout);
            resolve(data);
        });
        socket.emit('get_connection_info');
    });
};

export const simulateLatency = (latency) => {
    if (socket) socket.emit('simulate_latency', { latency });
};

export const simulatePacketLoss = (packetLoss) => {
    if (socket) socket.emit('simulate_packet_loss', { packetLoss });
};

export const requestUserList = () => {
    if (socket) socket.emit('request_users');
};

export const onUserList = (callback) => {
    if (socket) socket.on('user_list', callback);
};

export const onReceiveMessage = (callback) => {
    if (socket) socket.on('receive_message', callback);
};

export const onMessageSent = (callback) => {
    if (socket) socket.on('message_sent', callback);
};

export const ping = () => {
    if (socket) socket.emit('ping');
};

export const onPong = (callback) => {
    if (socket) socket.on('pong', callback);
};
