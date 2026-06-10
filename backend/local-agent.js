#!/usr/bin/env node
/**
 * NEXVPN Local Agent — SOCKS5 Proxy → WebSocket Tunnel
 *
 * This runs on the user's machine and creates a local SOCKS5 proxy server.
 * Configure your browser / OS to use SOCKS5 proxy at 127.0.0.1:1080.
 * All TCP traffic is forwarded over an encrypted WebSocket to the NEXVPN
 * backend, which makes the outbound connection on the user's behalf.
 *
 * Usage:
 *   node local-agent.js --server wss://nexvpn.onrender.com --token <JWT>
 *
 * Options:
 *   --server   Backend WebSocket URL (default: ws://localhost:3001)
 *   --token    JWT auth token from NEXVPN login
 *   --port     Local SOCKS5 port (default: 1080)
 */

const net = require('net');
const WebSocket = require('ws');

// ─── Parse CLI args ───────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(name, defaultVal) {
    const idx = args.indexOf(name);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : defaultVal;
}

const BACKEND = getArg('--server', 'ws://localhost:3001');
const TOKEN   = getArg('--token',  '');
const PORT    = parseInt(getArg('--port', '1080'), 10);

if (!TOKEN) {
    console.error('❌ --token is required. Login to NEXVPN and copy your JWT token.');
    console.error('   Usage: node local-agent.js --server wss://nexvpn.onrender.com --token <JWT>');
    process.exit(1);
}

// ─── Statistics ───────────────────────────────────────────────────────────────
let totalConnections = 0;
let activeConnections = 0;
let totalBytesUp = 0;
let totalBytesDown = 0;

// ─── SOCKS5 Server ───────────────────────────────────────────────────────────
const socksServer = net.createServer((clientSocket) => {
    let phase = 'greeting';
    let buffer = Buffer.alloc(0);

    clientSocket.on('data', (data) => {
        buffer = Buffer.concat([buffer, data]);

        if (phase === 'greeting') {
            // SOCKS5 greeting: VER | NMETHODS | METHODS...
            if (buffer.length < 3) return;
            if (buffer[0] !== 0x05) {
                clientSocket.destroy();
                return;
            }
            // Reply: no auth required
            clientSocket.write(Buffer.from([0x05, 0x00]));
            buffer = Buffer.alloc(0);
            phase = 'request';
            return;
        }

        if (phase === 'request') {
            // SOCKS5 request: VER | CMD | RSV | ATYP | DST.ADDR | DST.PORT
            if (buffer.length < 4) return;

            const ver  = buffer[0];
            const cmd  = buffer[1];
            const atyp = buffer[3];

            if (ver !== 0x05 || cmd !== 0x01) { // Only CONNECT
                // Command not supported
                const reply = Buffer.from([0x05, 0x07, 0x00, 0x01, 0,0,0,0, 0,0]);
                clientSocket.write(reply);
                clientSocket.destroy();
                return;
            }

            let targetHost = '';
            let targetPort = 0;
            let headerLen = 0;

            if (atyp === 0x01) {
                // IPv4
                if (buffer.length < 10) return;
                targetHost = `${buffer[4]}.${buffer[5]}.${buffer[6]}.${buffer[7]}`;
                targetPort = buffer.readUInt16BE(8);
                headerLen = 10;
            } else if (atyp === 0x03) {
                // Domain
                const domainLen = buffer[4];
                if (buffer.length < 5 + domainLen + 2) return;
                targetHost = buffer.slice(5, 5 + domainLen).toString('ascii');
                targetPort = buffer.readUInt16BE(5 + domainLen);
                headerLen = 5 + domainLen + 2;
            } else if (atyp === 0x04) {
                // IPv6
                if (buffer.length < 22) return;
                const ipv6Parts = [];
                for (let i = 0; i < 16; i += 2) {
                    ipv6Parts.push(buffer.readUInt16BE(4 + i).toString(16));
                }
                targetHost = ipv6Parts.join(':');
                targetPort = buffer.readUInt16BE(20);
                headerLen = 22;
            } else {
                const reply = Buffer.from([0x05, 0x08, 0x00, 0x01, 0,0,0,0, 0,0]);
                clientSocket.write(reply);
                clientSocket.destroy();
                return;
            }

            // Any leftover data after SOCKS header
            const remaining = buffer.slice(headerLen);
            buffer = Buffer.alloc(0);
            phase = 'tunnel';

            // Open WebSocket tunnel to backend
            const tunnelUrl = `${BACKEND}/tunnel?token=${encodeURIComponent(TOKEN)}&host=${encodeURIComponent(targetHost)}&port=${targetPort}`;

            const ws = new WebSocket(tunnelUrl, {
                perMessageDeflate: false,
                maxPayload: 16 * 1024 * 1024
            });

            ws.binaryType = 'nodebuffer';
            let connected = false;

            ws.on('open', () => {
                // Wait for { type: 'connected' } message from server
            });

            ws.on('message', (data) => {
                // First message might be JSON control
                if (!connected) {
                    try {
                        const msg = JSON.parse(data.toString());
                        if (msg.type === 'connected') {
                            connected = true;
                            totalConnections++;
                            activeConnections++;

                            // SOCKS5 success reply
                            const reply = Buffer.from([0x05, 0x00, 0x00, 0x01, 0,0,0,0, 0,0]);
                            clientSocket.write(reply);

                            // Send any buffered data
                            if (remaining.length > 0) {
                                ws.send(remaining);
                                totalBytesUp += remaining.length;
                            }
                            return;
                        }
                        if (msg.type === 'error') {
                            console.error(`   ✗ Tunnel error for ${targetHost}:${targetPort}: ${msg.message}`);
                            const reply = Buffer.from([0x05, 0x05, 0x00, 0x01, 0,0,0,0, 0,0]);
                            clientSocket.write(reply);
                            clientSocket.destroy();
                            return;
                        }
                    } catch {
                        // Binary data before connected — unlikely but handle
                    }
                }

                // Forward downstream data to SOCKS client
                if (connected && !clientSocket.destroyed) {
                    // Check if it's a JSON error message
                    if (typeof data === 'string' || (Buffer.isBuffer(data) && data[0] === 0x7b)) {
                        try {
                            const msg = JSON.parse(data.toString());
                            if (msg.type === 'error') {
                                console.error(`   ✗ ${targetHost}:${targetPort}: ${msg.message}`);
                                return;
                            }
                        } catch { /* not JSON, treat as data */ }
                    }
                    clientSocket.write(data);
                    totalBytesDown += data.length;
                }
            });

            // Upstream: client → WS
            clientSocket.on('data', (chunk) => {
                if (connected && ws.readyState === WebSocket.OPEN) {
                    ws.send(chunk);
                    totalBytesUp += chunk.length;
                }
            });

            const cleanup = () => {
                if (connected) activeConnections = Math.max(0, activeConnections - 1);
                if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) ws.close();
                if (!clientSocket.destroyed) clientSocket.destroy();
            };

            clientSocket.on('close', cleanup);
            clientSocket.on('error', cleanup);
            ws.on('close', cleanup);
            ws.on('error', (err) => {
                if (!connected) {
                    // SOCKS5 connection refused reply
                    const reply = Buffer.from([0x05, 0x05, 0x00, 0x01, 0,0,0,0, 0,0]);
                    if (!clientSocket.destroyed) clientSocket.write(reply);
                }
                cleanup();
            });

            return;
        }
    });

    clientSocket.on('error', () => {});
});

// ─── Status display ──────────────────────────────────────────────────────────
function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
    return `${(bytes / 1073741824).toFixed(2)} GB`;
}

setInterval(() => {
    process.stdout.write(
        `\r  ↑ ${formatBytes(totalBytesUp)}  ↓ ${formatBytes(totalBytesDown)}  |  Active: ${activeConnections}  Total: ${totalConnections}   `
    );
}, 2000);

// ─── Start ───────────────────────────────────────────────────────────────────
socksServer.listen(PORT, '127.0.0.1', () => {
    console.log('');
    console.log('  ╔══════════════════════════════════════════════════╗');
    console.log('  ║           NEXVPN LOCAL AGENT — ACTIVE           ║');
    console.log('  ╠══════════════════════════════════════════════════╣');
    console.log(`  ║  SOCKS5 Proxy:  127.0.0.1:${String(PORT).padEnd(24)}║`);
    console.log(`  ║  Backend:       ${BACKEND.padEnd(33)}║`);
    console.log('  ║  Protocol:      SOCKS5 → WebSocket → TCP       ║');
    console.log('  ╠══════════════════════════════════════════════════╣');
    console.log('  ║  Configure your browser/OS proxy settings:      ║');
    console.log(`  ║    SOCKS Host: 127.0.0.1   Port: ${String(PORT).padEnd(15)}║`);
    console.log('  ║    Type: SOCKS v5                               ║');
    console.log('  ╚══════════════════════════════════════════════════╝');
    console.log('');
});

socksServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`\n❌ Port ${PORT} is already in use. Try --port <other_port>`);
    } else {
        console.error('Server error:', err.message);
    }
    process.exit(1);
});
