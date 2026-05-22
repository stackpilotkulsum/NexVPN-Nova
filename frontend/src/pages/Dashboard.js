import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Chat from '../components/Chat';
import VPNStatus from '../components/VPNStatus';
import NetworkMonitor from '../components/NetworkMonitor';
import ServerSelection from '../components/ServerSelection';
import ProtocolSelection from '../components/ProtocolSelection';
import SecurityFeatures from '../components/SecurityFeatures';
import SpeedTest from '../components/SpeedTest';
import ConnectionLogs from '../components/ConnectionLogs';
import PrivacyScore from '../components/PrivacyScore';
import ThreatIntelligence from '../components/ThreatIntelligence';
import WebRTCLeakDetector from '../components/WebRTCLeakDetector';
import GeoSpoofVisualizer from '../components/GeoSpoofVisualizer';
import { connectSocket, disconnectSocket, getSocket } from '../utils/socket';
import './Dashboard.css';

const TABS = [
    { id: 'overview', label: '⬡ Overview' },
    { id: 'server',   label: '🌐 Servers' },
    { id: 'protocol', label: '🔒 Protocol' },
    { id: 'security', label: '🛡️ Security' },
    { id: 'threat',   label: '☠️ Threats' },
    { id: 'webrtc',   label: '🔍 Leak Tests' },
    { id: 'geo',      label: '🗺️ GeoSpoof' },
    { id: 'speed',    label: '⚡ Speed' },
    { id: 'monitor',  label: '📡 Network' },
    { id: 'chat',     label: '💬 Chat' },
    { id: 'logs',     label: '📋 Logs' },
];

function Dashboard() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('overview');
    const [socketReady, setSocketReady] = useState(false);
    const [selectedServer, setSelectedServer] = useState(null);
    const [selectedProtocol, setSelectedProtocol] = useState(null);
    const [securitySettings, setSecuritySettings] = useState({
        killSwitch: false,
        dnsProtection: false,
        splitTunneling: false,
    });
    const [sessionStart] = useState(Date.now());
    const [uptime, setUptime] = useState(0);
    const pollRef = useRef(null);

    const token    = localStorage.getItem('token');
    const username = localStorage.getItem('username');
    const userId   = localStorage.getItem('userId');

    // ── Socket setup ──────────────────────────────────────────────────────────
    useEffect(() => {
        if (!token) { navigate('/login'); return; }

        const socket = connectSocket(token);

        const onConnect    = () => { socket.emit('authenticate', { token }); };
        const onAuthOK     = () => setSocketReady(true);
        const onAuthErr    = () => setSocketReady(false);
        const onDisconnect = () => setSocketReady(false);

        socket.on('connect',      onConnect);
        socket.on('auth_success', onAuthOK);
        socket.on('auth_error',   onAuthErr);
        socket.on('disconnect',   onDisconnect);

        // Already connected before mount
        if (socket.connected) { socket.emit('authenticate', { token }); }

        // Fallback poll — sync state with actual socket
        pollRef.current = setInterval(() => {
            const s = getSocket();
            if (s && s.connected !== socketReady) setSocketReady(s.connected);
        }, 2000);

        return () => {
            clearInterval(pollRef.current);
            socket.off('connect',      onConnect);
            socket.off('auth_success', onAuthOK);
            socket.off('auth_error',   onAuthErr);
            socket.off('disconnect',   onDisconnect);
        };
    }, [token, navigate]); // eslint-disable-line

    // ── Uptime counter ────────────────────────────────────────────────────────
    useEffect(() => {
        const t = setInterval(
            () => setUptime(Math.floor((Date.now() - sessionStart) / 1000)),
            1000
        );
        return () => clearInterval(t);
    }, [sessionStart]);

    // ── Handlers ──────────────────────────────────────────────────────────────
    const handleServerSelect   = (server)   => setSelectedServer(server);
    const handleProtocolSelect = (protocol) => setSelectedProtocol(protocol);
    const handleSecurityChange = (settings) => setSecuritySettings(settings);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('userId');
        localStorage.removeItem('username');
        disconnectSocket();
        navigate('/login');
    };

    const formatUptime = (s) => {
        const h   = Math.floor(s / 3600);
        const m   = Math.floor((s % 3600) / 60);
        const sec = s % 60;
        return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
    };

    // ── VPN is "connected" when a server has been chosen ─────────────────────
    const isVpnConnected = !!selectedServer;

    // ── Status label & colours ────────────────────────────────────────────────
    // Show:  PROTECTED (server selected)  |  CONNECTED (socket auth'd, no server)  |  DISCONNECTED
    const statusLabel =
        isVpnConnected ? 'PROTECTED' :
        socketReady    ? 'CONNECTED'  : 'DISCONNECTED';

    const statusColor =
        isVpnConnected ? '#00ff88' :
        socketReady    ? '#00d4ff'  : '#ff3366';

    const statusBg =
        isVpnConnected ? 'rgba(0,255,136,0.12)' :
        socketReady    ? 'rgba(0,212,255,0.10)'  : 'rgba(255,51,102,0.12)';

    const statusBorder =
        isVpnConnected ? 'rgba(0,255,136,0.5)' :
        socketReady    ? 'rgba(0,212,255,0.4)'  : 'rgba(255,51,102,0.5)';

    return (
        <div className="dashboard">
            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="dashboard-header">
                <div className="header-left">
                    <h1>⬡ NEXVPN</h1>

                    {/* Status badge — reflects VPN state, not raw socket state */}
                    <span
                        className="status-indicator"
                        style={{
                            background: statusBg,
                            border: `1px solid ${statusBorder}`,
                            color: statusColor,
                        }}
                    >
                        <span
                            className={`pulse-dot ${isVpnConnected || socketReady ? 'active' : 'inactive'}`}
                        />
                        {statusLabel}
                    </span>

                    {/* Server chip */}
                    {selectedServer && (
                        <span style={{
                            fontFamily: 'JetBrains Mono', fontSize: '11px',
                            color: 'var(--accent-cyan)',
                            background: 'rgba(0,212,255,0.08)',
                            border: '1px solid rgba(0,212,255,0.3)',
                            padding: '4px 10px', borderRadius: '4px',
                        }}>
                            {selectedServer.country?.split(' ')[0]} {selectedServer.city}
                        </span>
                    )}

                    {/* Protocol chip */}
                    {selectedProtocol && (
                        <span style={{
                            fontFamily: 'JetBrains Mono', fontSize: '11px',
                            color: '#a78bfa',
                            background: 'rgba(124,58,237,0.08)',
                            border: '1px solid rgba(124,58,237,0.3)',
                            padding: '4px 10px', borderRadius: '4px',
                        }}>
                            {selectedProtocol.name}
                        </span>
                    )}

                    <span style={{
                        fontFamily: 'JetBrains Mono', fontSize: '11px',
                        color: 'var(--text-muted)',
                    }}>
                        ⏱ {formatUptime(uptime)}
                    </span>
                </div>

                <div className="header-right">
                    <span className="username">// {username}</span>
                    <button className="btn btn-danger btn-sm" onClick={handleLogout}>
                        DISCONNECT
                    </button>
                </div>
            </div>

            {/* ── Tabs + content ─────────────────────────────────────────── */}
            <div className="dashboard-container">
                <div className="tabs">
                    {TABS.map(t => (
                        <button
                            key={t.id}
                            className={`tab-btn ${activeTab === t.id ? 'active' : ''}`}
                            onClick={() => setActiveTab(t.id)}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                <div className="tab-content">
                    {activeTab === 'overview' && (
                        <PrivacyScore
                            isConnected={isVpnConnected}
                            selectedServer={selectedServer}
                            selectedProtocol={selectedProtocol}
                            securitySettings={securitySettings}
                            onNavigate={setActiveTab}
                        />
                    )}

                    {activeTab === 'server' && (
                        <ServerSelection
                            token={token}
                            onServerSelect={handleServerSelect}
                            currentServer={selectedServer}
                        />
                    )}

                    {activeTab === 'protocol' && (
                        <ProtocolSelection
                            token={token}
                            onProtocolSelect={handleProtocolSelect}
                            currentProtocol={selectedProtocol}
                        />
                    )}

                    {activeTab === 'security' && (
                        <SecurityFeatures
                            token={token}
                            onSettingsChange={handleSecurityChange}
                        />
                    )}

                    {activeTab === 'threat'  && <ThreatIntelligence />}
                    {activeTab === 'webrtc'  && <WebRTCLeakDetector />}
                    {activeTab === 'geo'     && (
                        <GeoSpoofVisualizer
                            selectedServer={selectedServer}
                            isConnected={isVpnConnected}
                        />
                    )}
                    {activeTab === 'speed'   && <SpeedTest token={token} />}
                    {activeTab === 'monitor' && <NetworkMonitor />}
                    {activeTab === 'chat'    && <Chat />}
                    {activeTab === 'logs'    && (
                        <ConnectionLogs token={token} userId={userId} />
                    )}
                    {activeTab === 'vpn'     && (
                        <VPNStatus
                            connected={isVpnConnected}
                            selectedServer={selectedServer}
                            selectedProtocol={selectedProtocol}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

export default Dashboard;
