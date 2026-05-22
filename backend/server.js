const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const net = require('net');
const dns = require('dns').promises;
const os = require('os');
const https = require('https');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Enable CORS for all origins for initial deployment
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

const io = socketIO(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const RSA_KEY_SIZE = 2048;

/* ================= VPN LOGIC ================= */



const VPN_SERVERS = [
    { id: 'us-east', name: 'US East', country: '🇺🇸 United States', city: 'New York', ip: '1.1.1.1', pingHost: '1.1.1.1', load: 25, speed: 85 },
    { id: 'us-west', name: 'US West', country: '🇺🇸 United States', city: 'Los Angeles', ip: '8.8.8.8', pingHost: '8.8.8.8', load: 35, speed: 78 },
    { id: 'uk', name: 'UK London', country: '🇬🇧 United Kingdom', city: 'London', ip: '8.8.4.4', pingHost: '8.8.4.4', load: 45, speed: 72 },
    { id: 'germany', name: 'Germany', country: '🇩🇪 Germany', city: 'Frankfurt', ip: '9.9.9.9', pingHost: '9.9.9.9', load: 30, speed: 80 },
    { id: 'japan', name: 'Japan', country: '🇯🇵 Japan', city: 'Tokyo', ip: '1.0.0.1', pingHost: '1.0.0.1', load: 55, speed: 65 },
    { id: 'singapore', name: 'Singapore', country: '🇸🇬 Singapore', city: 'Singapore', ip: '208.67.222.222', pingHost: '208.67.222.222', load: 40, speed: 75 },
    { id: 'canada', name: 'Canada', country: '🇨🇦 Canada', city: 'Toronto', ip: '149.112.112.112', pingHost: '149.112.112.112', load: 20, speed: 88 },
    { id: 'australia', name: 'Australia', country: '🇦🇺 Australia', city: 'Sydney', ip: '208.67.220.220', pingHost: '208.67.220.220', load: 50, speed: 60 }
];

const VPN_PROTOCOLS = [
    { id: 'openvpn', name: 'OpenVPN (TCP)', encryption: 'AES-256-CBC', port: 443, speed: 'Medium', security: 'High' },
    { id: 'wireguard', name: 'WireGuard', encryption: 'ChaCha20-Poly1305', port: 51820, speed: 'Fast', security: 'High' },
    { id: 'ikev2', name: 'IKEv2/IPSec', encryption: 'AES-256-GCM', port: 500, speed: 'Fast', security: 'High' },
    { id: 'l2tp', name: 'L2TP/IPSec', encryption: 'AES-256-CBC', port: 1701, speed: 'Slow', security: 'Medium' }
];

const users = new Map();
const connections = new Map();
const userToSocket = new Map();
const trafficStats = new Map();
const userServerSelection = new Map();
const userProtocolSelection = new Map();
const connectionLogs = new Map();



// ===== REAL NETWORK UTILITIES =====
function measureTCPLatency(host, port = 443) {
    return new Promise((resolve) => {
        const start = Date.now();
        const socket = new net.Socket();
        socket.setTimeout(8000);
        socket.on('connect', () => { const l = Date.now() - start; socket.destroy(); resolve(l); });
        socket.on('error', () => { socket.destroy(); resolve(null); });
        socket.on('timeout', () => { socket.destroy(); resolve(null); });
        try { socket.connect(port, host); } catch (e) { resolve(null); }
    });
}

async function measureDNSLatency(hostname) {
    const start = Date.now();
    try { await dns.resolve4(hostname); return Date.now() - start; } catch { return null; }
}

function measureDownloadSpeed() {
    return new Promise((resolve) => {
        const start = Date.now();
        let bytes = 0;
        const req = https.get('https://speed.cloudflare.com/__down?bytes=2000000', { timeout: 15000 }, (res) => {
            res.on('data', (chunk) => { bytes += chunk.length; });
            res.on('end', () => {
                const elapsed = (Date.now() - start) / 1000;
                const mbps = parseFloat(((bytes * 8) / elapsed / 1000000).toFixed(2));
                resolve({ mbps: mbps > 0 ? mbps : null, bytes, elapsed });
            });
            res.on('error', () => resolve(null));
        });
        req.on('error', () => resolve(null));
        req.on('timeout', () => { req.destroy(); resolve(null); });
    });
}

function getPublicIP() {
    return new Promise((resolve) => {
        const req = https.get('https://api.ipify.org?format=json', { timeout: 8000 }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => { try { resolve(JSON.parse(data).ip); } catch { resolve(null); } });
        });
        req.on('error', () => resolve(null));
        req.on('timeout', () => { req.destroy(); resolve(null); });
    });
}

// Try multiple geo APIs for redundancy
function getIPGeoLocationFromAPI(ip, apiUrl) {
    return new Promise((resolve) => {
        const requestModule = apiUrl.startsWith('https') ? https : http;
        const req = requestModule.get(apiUrl, { timeout: 6000 }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve(parsed);
                } catch { resolve(null); }
            });
        });
        req.on('error', () => resolve(null));
        req.on('timeout', () => { req.destroy(); resolve(null); });
    });
}

async function getIPGeoLocation(ip) {
    // Try ipapi.co first
    const result1 = await getIPGeoLocationFromAPI(ip, `https://ipapi.co/${ip}/json/`);
    if (result1 && result1.country_name && result1.country_name !== 'Unknown') {
        return {
            country_name: result1.country_name,
            country_code: result1.country_code,
            city: result1.city,
            region: result1.region,
            org: result1.org,
            timezone: result1.timezone,
            latitude: result1.latitude,
            longitude: result1.longitude
        };
    }

    // Fallback: ip-api.com (free, no key needed)
    const result2 = await getIPGeoLocationFromAPI(ip, `http://ip-api.com/json/${ip}?fields=status,country,countryCode,regionName,city,org,lat,lon,timezone`);
    if (result2 && result2.status === 'success') {
        return {
            country_name: result2.country,
            country_code: result2.countryCode,
            city: result2.city,
            region: result2.regionName,
            org: result2.org,
            timezone: result2.timezone,
            latitude: result2.lat,
            longitude: result2.lon
        };
    }

    // Fallback: ipinfo.io
    const result3 = await getIPGeoLocationFromAPI(ip, `https://ipinfo.io/${ip}/json`);
    if (result3 && result3.country) {
        const [lat, lon] = (result3.loc || '0,0').split(',').map(Number);
        return {
            country_name: result3.country,
            country_code: result3.country,
            city: result3.city,
            region: result3.region,
            org: result3.org,
            timezone: result3.timezone,
            latitude: lat,
            longitude: lon
        };
    }

    return null;
}

function getSystemNetworkStats() {
    const ifaces = os.networkInterfaces();
    const interfaces = [];
    for (const [name, addresses] of Object.entries(ifaces)) {
        if (addresses) {
            const ipv4 = addresses.find(a => a.family === 'IPv4' && !a.internal);
            if (ipv4) interfaces.push({ name, address: ipv4.address, netmask: ipv4.netmask, mac: ipv4.mac });
        }
    }
    return { interfaces };
}

async function performDNSLeakTest() {
    const testDomains = ['cloudflare.com', 'google.com', 'quad9.net', '1dot1dot1dot1.cloudflare-dns.com'];
    const results = await Promise.allSettled(testDomains.map(async (domain) => {
        const start = Date.now();
        try {
            const lookupResult = await Promise.race([
                dns.lookup(domain, { all: true }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('DNS timeout')), 5000))
            ]);
            const addresses = lookupResult.map(r => r.address);
            return { domain, resolved: true, addresses: addresses.slice(0, 2), latency: Date.now() - start };
        } catch (e) {
            return { domain, resolved: false, latency: Date.now() - start, error: e.message };
        }
    }));
    return results.map(r => r.status === 'fulfilled' ? r.value : { domain: 'unknown', resolved: false, latency: 0 });
}

// ===== ENCRYPTION =====
class EncryptionManager {
    generateRSAKeyPairs() {
        return crypto.generateKeyPairSync('rsa', {
            modulusLength: RSA_KEY_SIZE,
            publicKeyEncoding: { type: 'spki', format: 'pem' },
            privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
        });
    }
    encryptAES(key, plaintext) {
        const iv = crypto.randomBytes(16);
        const keyBuffer = typeof key === 'string' ? Buffer.from(key, 'hex') : key;
        const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, iv);
        let enc = cipher.update(plaintext, 'utf8', 'binary');
        enc = Buffer.concat([Buffer.from(enc, 'binary'), cipher.final()]);
        return iv.toString('hex') + ':' + enc.toString('hex');
    }
    generateAESKey() { return crypto.randomBytes(32).toString('hex'); }
    hashData(data) { return crypto.createHash('sha256').update(data).digest('hex'); }
}
const encryptionManager = new EncryptionManager();

// ===== TRAFFIC MONITOR =====
class TrafficMonitor {
    constructor(userId) {
        this.userId = userId;
        this.bytesSent = 0; this.bytesReceived = 0;
        this.packetsSent = 0; this.packetsReceived = 0;
        this.latencyHistory = [];
        this.timestamp = Date.now();
    }
    recordSent(b) { this.bytesSent += b; this.packetsSent++; }
    recordReceived(b) { this.bytesReceived += b; this.packetsReceived++; }
    addLatency(l) {
        this.latencyHistory.push({ value: l, time: Date.now() });
        if (this.latencyHistory.length > 100) this.latencyHistory.shift();
    }
    getAvgLatency() {
        if (!this.latencyHistory.length) return 0;
        return Math.round(this.latencyHistory.reduce((s, l) => s + l.value, 0) / this.latencyHistory.length);
    }
    getStats() {
        return {
            userId: this.userId,
            bytesSent: this.bytesSent, bytesReceived: this.bytesReceived,
            packetsSent: this.packetsSent, packetsReceived: this.packetsReceived,
            totalData: this.bytesSent + this.bytesReceived,
            avgLatency: this.getAvgLatency(),
            latencyHistory: this.latencyHistory.slice(-20),
            uptime: Date.now() - this.timestamp
        };
    }
}

// ===== AUTH =====
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, password, email } = req.body;
        if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
        if (users.has(username)) return res.status(400).json({ error: 'User already exists' });
        const hashedPassword = await bcrypt.hash(password, 10);
        const userId = uuidv4();
        users.set(username, { userId, username, email, password: hashedPassword, rsaKeys: encryptionManager.generateRSAKeyPairs(), createdAt: Date.now() });
        trafficStats.set(userId, new TrafficMonitor(userId));
        const token = jwt.sign({ userId, username }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ success: true, token, userId });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = users.get(username);
        if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: 'Invalid credentials' });
        const token = jwt.sign({ userId: user.userId, username }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ success: true, token, userId: user.userId, publicKey: user.rsaKeys.publicKey });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

function verifyToken(t) {
    if (!t) return null;
    // Strip "Bearer " prefix if present
    const clean = t.startsWith('Bearer ') ? t.slice(7) : t;
    try { return jwt.verify(clean, JWT_SECRET); } catch { return null; }
}

// ===== NETWORK ENDPOINTS =====
app.get('/api/network/public-ip', async (req, res) => {
    try {
        const ip = await getPublicIP();
        if (!ip) return res.json({ ip: 'unavailable', country: 'N/A', city: 'N/A', isp: 'N/A', timezone: 'N/A', region: 'N/A' });
        const geo = await getIPGeoLocation(ip);
        res.json({
            ip,
            country: geo?.country_name || 'N/A',
            countryCode: geo?.country_code || '',
            city: geo?.city || 'N/A',
            region: geo?.region || 'N/A',
            isp: geo?.org || 'N/A',
            timezone: geo?.timezone || 'N/A',
            latitude: geo?.latitude || null,
            longitude: geo?.longitude || null
        });
    } catch (e) {
        res.json({ ip: 'error', country: 'N/A', city: 'N/A', isp: 'N/A', timezone: 'N/A', region: 'N/A', error: e.message });
    }
});

app.get('/api/network/system-info', (req, res) => {
    const net = getSystemNetworkStats();
    res.json({
        hostname: os.hostname() || 'Unknown',
        platform: os.platform() || 'Unknown',
        arch: os.arch() || 'Unknown',
        cpus: os.cpus().length || 0,
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        uptime: os.uptime(),
        networkInterfaces: net.interfaces
    });
});

app.get('/api/network/dns-leak-test', async (req, res) => {
    try {
        const results = await performDNSLeakTest();
        res.json({ results, timestamp: Date.now() });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/network/latencies', async (req, res) => {
    // Use allSettled so one timeout doesn't block the whole response
    const results = await Promise.allSettled(VPN_SERVERS.map(async (s) => {
        const l = await measureTCPLatency(s.pingHost, 443) || await measureTCPLatency(s.pingHost, 80);
        return { id: s.id, latency: l };
    }));
    const latencies = results.map((r, i) => 
        r.status === 'fulfilled' ? r.value : { id: VPN_SERVERS[i].id, latency: null }
    );
    res.json({ latencies, timestamp: Date.now() });
});

app.get('/api/network/speed-test', async (req, res) => {
    try {
        const [downloadResult, pingLatency, dnsLatency] = await Promise.all([
            measureDownloadSpeed(),
            measureTCPLatency('1.1.1.1', 443),
            measureDNSLatency('cloudflare.com')
        ]);
        res.json({
            download: downloadResult ? downloadResult.mbps : null,
            ping: pingLatency,
            dns: dnsLatency,
            bytesTransferred: downloadResult?.bytes || 0,
            duration: downloadResult?.elapsed || 0,
            timestamp: Date.now()
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/vpn/ping-server', async (req, res) => {
    const { serverId } = req.body;
    const server = VPN_SERVERS.find(s => s.id === serverId);
    if (!server) return res.status(404).json({ error: 'Server not found' });
    const [tcp443, tcp80, dnsL] = await Promise.all([
        measureTCPLatency(server.pingHost, 443),
        measureTCPLatency(server.pingHost, 80),
        measureDNSLatency('cloudflare.com')
    ]);
    const vals = [tcp443, tcp80, dnsL].filter(v => v !== null);
    res.json({ serverId, tcpPort443: tcp443, tcpPort80: tcp80, dnsLatency: dnsL, bestLatency: vals.length ? Math.min(...vals) : null, timestamp: Date.now() });
});

app.get('/api/vpn/servers', async (req, res) => {
    const latencyResults = await Promise.all(
        VPN_SERVERS.map(s => measureTCPLatency(s.pingHost, 443)
            .then(l => ({ id: s.id, latency: l }))
            .catch(() => ({ id: s.id, latency: null })))
    );
    const latencyMap = Object.fromEntries(latencyResults.map(r => [r.id, r.latency]));
    const servers = VPN_SERVERS.map(s => ({
        ...s,
        load: Math.max(5, s.load + Math.floor(Math.random() * 11 - 5)),
        users: Math.floor(Math.random() * 500) + 100,
        status: 'online',
        latency: latencyMap[s.id] || null
    }));
    res.json({ servers });
});

app.get('/api/vpn/protocols', (req, res) => res.json({ protocols: VPN_PROTOCOLS }));

app.post('/api/vpn/select-server', (req, res) => {
    const { token, serverId } = req.body;
    const decoded = verifyToken(token);
    if (!decoded) return res.status(401).json({ error: 'Invalid token' });
    const server = VPN_SERVERS.find(s => s.id === serverId);
    if (!server) return res.status(404).json({ error: 'Server not found' });
    userServerSelection.set(decoded.userId, serverId);
    if (!connectionLogs.has(decoded.userId)) connectionLogs.set(decoded.userId, []);
    connectionLogs.get(decoded.userId).push({ action: 'server_selected', serverId, serverName: server.name, timestamp: Date.now(), ip: server.ip });
    res.json({ success: true, server: { ...server, virtualIp: server.ip } });
});

app.post('/api/vpn/select-protocol', (req, res) => {
    const { token, protocolId } = req.body;
    const decoded = verifyToken(token);
    if (!decoded) return res.status(401).json({ error: 'Invalid token' });
    const protocol = VPN_PROTOCOLS.find(p => p.id === protocolId);
    if (!protocol) return res.status(404).json({ error: 'Protocol not found' });
    userProtocolSelection.set(decoded.userId, protocolId);
    if (!connectionLogs.has(decoded.userId)) connectionLogs.set(decoded.userId, []);
    connectionLogs.get(decoded.userId).push({ action: 'protocol_selected', protocolId, protocolName: protocol.name, timestamp: Date.now() });
    res.json({ success: true, protocol });
});

app.get('/api/vpn/connection-info/:userId', (req, res) => {
    const { userId } = req.params;
    const server = userServerSelection.has(userId) ? VPN_SERVERS.find(s => s.id === userServerSelection.get(userId)) : null;
    const protocol = userProtocolSelection.has(userId) ? VPN_PROTOCOLS.find(p => p.id === userProtocolSelection.get(userId)) : null;
    res.json({ server: server ? { ...server, virtualIp: server.ip } : null, protocol, connectedAt: connections.get(userId)?.connectedAt || null });
});

app.get('/api/vpn/connection-logs/:userId', (req, res) => {
    res.json({ logs: connectionLogs.get(req.params.userId) || [] });
});

app.get('/api/traffic/stats/:userId', (req, res) => {
    const stats = trafficStats.get(req.params.userId);
    if (!stats) return res.status(404).json({ error: 'Not found' });
    res.json(stats.getStats());
});

app.post('/api/crypto/exchange-key', (req, res) => {
    const { token } = req.body;
    const decoded = verifyToken(token);
    if (!decoded) return res.status(401).json({ error: 'Invalid token' });
    let userPublicKey = null;
    for (const user of users.values()) { if (user.userId === decoded.userId) { userPublicKey = user.rsaKeys.publicKey; break; } }
    if (!userPublicKey) return res.status(404).json({ error: 'User not found' });
    res.json({ publicKey: userPublicKey, keySize: RSA_KEY_SIZE, algorithm: 'RSA-OAEP', handshakeId: uuidv4() });
});

app.get('/api/health', (req, res) => res.json({ status: 'ok', connections: connections.size, users: users.size, timestamp: Date.now(), uptime: process.uptime() }));

// ===== WEBSOCKET =====
io.on('connection', (socket) => {
    socket.on('authenticate', (data) => {
        const decoded = verifyToken(data.token);
        if (!decoded) { socket.emit('auth_error', { error: 'Invalid token' }); socket.disconnect(); return; }
        const connectionId = uuidv4();
        connections.set(socket.id, {
            userId: decoded.userId, username: decoded.username,
            connectionId, connectedAt: Date.now(),
            aesKey: encryptionManager.generateAESKey(), latency: 0, packetLoss: 0
        });
        userToSocket.set(decoded.userId, socket.id);
        if (!trafficStats.has(decoded.userId)) trafficStats.set(decoded.userId, new TrafficMonitor(decoded.userId));
        socket.emit('auth_success', { connectionId });
        io.emit('user_list', Array.from(connections.values()).map(c => ({ userId: c.userId, username: c.username, status: 'online' })));
    });

    socket.on('ping', () => socket.emit('pong', { timestamp: Date.now() }));

    socket.on('measure_server_latency', async ({ serverId }) => {
        const server = VPN_SERVERS.find(s => s.id === serverId);
        if (!server) { socket.emit('server_latency_result', { serverId, error: 'Not found' }); return; }
        const latency = await measureTCPLatency(server.pingHost, 443) || await measureTCPLatency(server.pingHost, 80);
        const conn = connections.get(socket.id);
        if (conn && latency) { const stats = trafficStats.get(conn.userId); if (stats) stats.addLatency(latency); }
        socket.emit('server_latency_result', { serverId, latency, timestamp: Date.now() });
    });

    socket.on('send_message', (data) => {
        const conn = connections.get(socket.id);
        if (!conn) { socket.emit('error', { error: 'Not authenticated' }); return; }
        const { to, message } = data;
        const recipientSocketId = userToSocket.get(to);
        if (!recipientSocketId) { socket.emit('message_sent', { success: false, error: 'Recipient not found' }); return; }
        const msgBytes = Buffer.byteLength(message, 'utf8');
        io.to(recipientSocketId).emit('receive_message', { from: conn.userId, username: conn.username, message, encrypted: true, timestamp: Date.now() });
        const stats = trafficStats.get(conn.userId);
        if (stats) stats.recordSent(msgBytes);
        socket.emit('message_sent', { success: true, bytes: msgBytes });
    });

    socket.on('get_connection_info', () => {
        const conn = connections.get(socket.id);
        if (conn) socket.emit('connection_info', {
            connectionId: conn.connectionId, latency: conn.latency,
            packetLoss: conn.packetLoss, connectedAt: conn.connectedAt,
            uptime: Date.now() - conn.connectedAt
        });
    });

    socket.on('toggle_kill_switch', ({ enabled }) => {
        const conn = connections.get(socket.id);
        if (conn) {
            if (!connectionLogs.has(conn.userId)) connectionLogs.set(conn.userId, []);
            connectionLogs.get(conn.userId).push({ action: enabled ? 'kill_switch_enabled' : 'kill_switch_disabled', timestamp: Date.now() });
            socket.emit('kill_switch_status', { enabled });
        }
    });

    socket.on('toggle_dns_protection', ({ enabled }) => {
        const conn = connections.get(socket.id);
        if (conn) {
            if (!connectionLogs.has(conn.userId)) connectionLogs.set(conn.userId, []);
            connectionLogs.get(conn.userId).push({ action: enabled ? 'dns_protection_enabled' : 'dns_protection_disabled', timestamp: Date.now() });
            socket.emit('dns_protection_status', { enabled });
        }
    });

    socket.on('toggle_split_tunneling', ({ enabled, apps = [] }) => {
        const conn = connections.get(socket.id);
        if (conn) {
            if (!connectionLogs.has(conn.userId)) connectionLogs.set(conn.userId, []);
            connectionLogs.get(conn.userId).push({ action: enabled ? 'split_tunneling_enabled' : 'split_tunneling_disabled', apps, timestamp: Date.now() });
            socket.emit('split_tunneling_status', { enabled, apps });
        }
    });

    socket.on('run_speed_test', async () => {
        const conn = connections.get(socket.id);
        if (!conn) { socket.emit('speed_test_results', { error: 'Not authenticated' }); return; }

        socket.emit('speed_test_progress', { stage: 'ping', message: 'Measuring TCP latency to 1.1.1.1...' });
        const pingLatency = await measureTCPLatency('1.1.1.1', 443);

        socket.emit('speed_test_progress', { stage: 'download', message: 'Testing download speed via Cloudflare CDN...' });
        const [downloadResult, dnsLatency] = await Promise.all([
            measureDownloadSpeed(),
            measureDNSLatency('cloudflare.com')
        ]);

        const serverId = userServerSelection.get(conn.userId);
        const srv = serverId ? VPN_SERVERS.find(s => s.id === serverId) : null;

        const results = {
            download: downloadResult ? downloadResult.mbps : null,
            upload: null,
            ping: pingLatency,
            dns: dnsLatency,
            server: srv?.name || 'Not selected',
            bytesTransferred: downloadResult?.bytes || 0,
            timestamp: Date.now()
        };

        if (!connectionLogs.has(conn.userId)) connectionLogs.set(conn.userId, []);
        connectionLogs.get(conn.userId).push({ action: 'speed_test_completed', results, timestamp: Date.now() });
        socket.emit('speed_test_results', results);
    });

    socket.on('request_users', () => socket.emit('user_list', Array.from(connections.values()).map(c => ({ userId: c.userId, username: c.username, status: 'online' }))));

    socket.on('disconnect', () => {
        const conn = connections.get(socket.id);
        if (conn) {
            if (!connectionLogs.has(conn.userId)) connectionLogs.set(conn.userId, []);
            connectionLogs.get(conn.userId).push({ action: 'disconnected', timestamp: Date.now() });
            userToSocket.delete(conn.userId);
            connections.delete(socket.id);
            io.emit('user_list', Array.from(connections.values()).map(c => ({ userId: c.userId, username: c.username, status: 'online' })));
        }
    });
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`\n❌ Port ${PORT} is already in use!`);
        console.error(`   Run this command to find and kill it:`);
        console.error(`   Windows: netstat -ano | findstr :${PORT}  then  taskkill /PID <PID> /F`);
        console.error(`   Mac/Linux: lsof -ti :${PORT} | xargs kill -9`);
        console.error(`   Or change PORT in backend/.env to a different number (e.g. PORT=3002)\n`);
        process.exit(1);
    } else {
        throw err;
    }
});

server.listen(PORT, () => {
    console.log('\n✅ NEXVPN Backend running!');
    console.log(`   → API:    http://localhost:${PORT}/api`);
    console.log(`   → Socket: http://localhost:${PORT}`);
    console.log(`   → Health: http://localhost:${PORT}/api/health\n`);
});
