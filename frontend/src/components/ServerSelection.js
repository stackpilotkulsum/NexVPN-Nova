import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './ServerSelection.css';

const API_BASE = process.env.REACT_APP_API_URL || 'https://nexvpn.onrender.com/api';

function ServerSelection({ token, onServerSelect, currentServer }) {
    const [servers, setServers]         = useState([]);
    const [loading, setLoading]         = useState(true);
    const [connecting, setConnecting]   = useState(null);
    const [pingingServer, setPinging]   = useState(null);
    const [pingResults, setPingResults] = useState({});
    const [error, setError]             = useState('');
    const [successMsg, setSuccessMsg]   = useState('');
    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;
        fetchServers();
        const interval = setInterval(fetchServers, 60000);
        return () => {
            mounted.current = false;
            clearInterval(interval);
        };
    }, []); // eslint-disable-line

    const fetchServers = async () => {
        try {
            setError('');
            const res = await axios.get(`${API_BASE}/vpn/servers`, { timeout: 15000 });
            if (mounted.current) setServers(res.data.servers || []);
        } catch (err) {
            console.error('Failed to fetch servers:', err);
            if (mounted.current)
                setError('Could not load servers — is the backend running on port 3001?');
        } finally {
            if (mounted.current) setLoading(false);
        }
    };

    const pingServer = async (server, e) => {
        e.stopPropagation();
        setPinging(server.id);
        try {
            const res = await axios.post(
                `${API_BASE}/vpn/ping-server`,
                { serverId: server.id },
                { timeout: 10000 }
            );
            if (mounted.current)
                setPingResults(prev => ({ ...prev, [server.id]: res.data }));
        } catch {
            if (mounted.current)
                setPingResults(prev => ({ ...prev, [server.id]: { error: 'Ping failed' } }));
        } finally {
            if (mounted.current) setPinging(null);
        }
    };

    const handleServerClick = async (server) => {
        // Prevent double-clicks / concurrent requests
        if (connecting) return;

        // If already selected — allow re-clicking to "reconnect"
        // (don't block it; just let the animation play and confirm again)

        setConnecting(server.id);
        setError('');
        setSuccessMsg('');

        // ── Optimistic update: apply selection immediately in UI ──────────
        onServerSelect(server);

        try {
            // Tell the backend (best-effort — UI already updated)
            const res = await axios.post(
                `${API_BASE}/vpn/select-server`,
                { token, serverId: server.id },
                { timeout: 10000 }
            );

            if (res.data.success && mounted.current) {
                // Use the server object the backend returns (may include virtualIp etc.)
                onServerSelect(res.data.server);
                setSuccessMsg(`✅ Connected to ${res.data.server.name}`);
                setTimeout(() => { if (mounted.current) setSuccessMsg(''); }, 3000);
            }
        } catch (err) {
            console.error('select-server error:', err);
            // Keep the optimistic selection — just warn the user
            if (mounted.current) {
                const msg = err.response?.data?.error || err.message;
                setError(`⚠ Backend error: ${msg}. Selection applied locally.`);
                setTimeout(() => { if (mounted.current) setError(''); }, 5000);
            }
        } finally {
            if (mounted.current) setConnecting(null);
        }
    };

    const getLoadColor    = (v) => v < 30 ? '#00ff88' : v < 60 ? '#ffaa00' : '#ff3366';
    const getLatencyColor = (v) => !v ? '#64748b' : v < 80 ? '#00ff88' : v < 200 ? '#ffaa00' : '#ff3366';

    if (loading) {
        return (
            <div className="server-selection">
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '40px', justifyContent: 'center',
                    fontFamily: 'JetBrains Mono', color: 'var(--text-muted)',
                }}>
                    <div className="spinner" />
                    Loading servers from backend…
                </div>
            </div>
        );
    }

    return (
        <div className="server-selection">
            <div className="server-selection-header">
                <h3>🌍 Select VPN Server</h3>
                <p>Click a server card to connect. Real TCP latency is shown per card.</p>
            </div>

            {/* Error / success banners */}
            {error && (
                <div style={{
                    background: 'rgba(255,51,102,0.1)',
                    border: '1px solid rgba(255,51,102,0.4)',
                    color: 'var(--danger)',
                    padding: '12px 16px', borderRadius: '8px',
                    marginBottom: '16px',
                    fontFamily: 'JetBrains Mono', fontSize: '12px',
                }}>
                    {error}
                </div>
            )}
            {successMsg && (
                <div style={{
                    background: 'rgba(0,255,136,0.1)',
                    border: '1px solid rgba(0,255,136,0.3)',
                    color: 'var(--success)',
                    padding: '12px 16px', borderRadius: '8px',
                    marginBottom: '16px',
                    fontFamily: 'JetBrains Mono', fontSize: '12px',
                }}>
                    {successMsg}
                </div>
            )}

            {/* Active-server banner */}
            {currentServer && (
                <div className="current-server">
                    <div className="selected-server-info">
                        <div className="server-flag">
                            {currentServer.country?.split(' ')[0]}
                        </div>
                        <div className="server-details">
                            <div className="server-name">{currentServer.name}</div>
                            <div className="server-location">
                                {currentServer.city},{' '}
                                {currentServer.country?.replace(/^\S+ /, '')}
                            </div>
                            <div className="server-ip">
                                Endpoint: {currentServer.ip}
                            </div>
                        </div>
                        <div className="server-status">
                            <div
                                className="status-dot"
                                style={{
                                    backgroundColor: '#00ff88',
                                    boxShadow: '0 0 8px #00ff88',
                                }}
                            />
                            <span style={{
                                color: 'var(--success)',
                                fontFamily: 'JetBrains Mono',
                                fontSize: '12px',
                            }}>
                                Active
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Server grid */}
            <div className="servers-grid">
                {servers.map((server) => {
                    const ping        = pingResults[server.id];
                    const realLatency = server.latency || ping?.bestLatency;
                    const isSelected  = currentServer?.id === server.id;
                    const isConnecting = connecting === server.id;

                    return (
                        <div
                            key={server.id}
                            className={`server-card ${isSelected ? 'selected' : ''}`}
                            onClick={() => handleServerClick(server)}
                            style={{
                                cursor: connecting ? 'wait' : 'pointer',
                                opacity: connecting && !isConnecting ? 0.7 : 1,
                                position: 'relative',
                            }}
                        >
                            {/* Connecting overlay */}
                            {isConnecting && (
                                <div style={{
                                    position: 'absolute', inset: 0,
                                    background: 'rgba(2,4,8,0.75)',
                                    borderRadius: '10px',
                                    display: 'flex', flexDirection: 'column',
                                    alignItems: 'center', justifyContent: 'center',
                                    gap: '8px', zIndex: 10,
                                }}>
                                    <div className="connecting-spinner" />
                                    <span style={{
                                        fontFamily: 'JetBrains Mono',
                                        fontSize: '11px',
                                        color: 'var(--accent-cyan)',
                                    }}>
                                        Connecting…
                                    </span>
                                </div>
                            )}

                            <div className="server-header">
                                <div className="server-flag">
                                    {server.country?.split(' ')[0]}
                                </div>
                                <div className="server-status">
                                    <div
                                        className="status-dot"
                                        style={{
                                            backgroundColor: isSelected ? '#00ff88' : '#1e4080',
                                            boxShadow: isSelected ? '0 0 6px #00ff88' : 'none',
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="server-info">
                                <h4>{server.name}</h4>
                                <p className="location">{server.city}</p>
                                <p className="ip" style={{
                                    fontFamily: 'JetBrains Mono',
                                    fontSize: '10px',
                                    color: 'var(--text-muted)',
                                }}>
                                    {server.ip}
                                </p>
                            </div>

                            <div className="server-metrics">
                                <div className="metric">
                                    <span className="metric-label">Load</span>
                                    <div className="metric-bar">
                                        <div
                                            className="metric-fill"
                                            style={{
                                                width: `${server.load}%`,
                                                backgroundColor: getLoadColor(server.load),
                                            }}
                                        />
                                    </div>
                                    <span className="metric-value">{server.load}%</span>
                                </div>

                                <div className="metric">
                                    <span className="metric-label">Latency</span>
                                    <span
                                        className="metric-value"
                                        style={{ color: getLatencyColor(realLatency) }}
                                    >
                                        {realLatency ? `${realLatency}ms` : '—'}
                                    </span>
                                </div>

                                <div className="metric">
                                    <span className="metric-label">Speed</span>
                                    <span className="metric-value">
                                        {server.speed} Mbps
                                    </span>
                                </div>
                            </div>

                            <button
                                className="ping-btn"
                                onClick={(e) => pingServer(server, e)}
                                disabled={pingingServer === server.id}
                            >
                                {pingingServer === server.id ? '⏳ Pinging…' : '📡 Ping'}
                            </button>

                            {ping && (
                                <div className="ping-result">
                                    {ping.error ? (
                                        <span style={{ color: 'var(--danger)' }}>
                                            {ping.error}
                                        </span>
                                    ) : (
                                        <>
                                            <span>
                                                Port 443:{' '}
                                                <strong style={{ color: getLatencyColor(ping.tcpPort443) }}>
                                                    {ping.tcpPort443 ? `${ping.tcpPort443}ms` : 'N/A'}
                                                </strong>
                                            </span>
                                            <span>
                                                Port 80:{' '}
                                                <strong style={{ color: getLatencyColor(ping.tcpPort80) }}>
                                                    {ping.tcpPort80 ? `${ping.tcpPort80}ms` : 'N/A'}
                                                </strong>
                                            </span>
                                        </>
                                    )}
                                </div>
                            )}

                            {isSelected && (
                                <div
                                    className="selected-badge"
                                    style={{ background: 'var(--success)', color: '#000' }}
                                >
                                    ✓ Connected
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default ServerSelection;
