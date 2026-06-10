import React, { useState, useEffect, useCallback } from 'react';
import './VPNClient.css';

const API_BASE = process.env.REACT_APP_API_URL || 'https://nexvpn.onrender.com/api';

function VPNClient({ token }) {
    const [activeSection, setActiveSection] = useState('quickstart');
    const [tunnelStatus, setTunnelStatus] = useState(null);
    const [copied, setCopied] = useState('');
    const [platform, setPlatform] = useState('windows');

    // Detect platform
    useEffect(() => {
        const ua = navigator.userAgent.toLowerCase();
        if (ua.includes('mac'))       setPlatform('macos');
        else if (ua.includes('linux')) setPlatform('linux');
        else                           setPlatform('windows');
    }, []);

    // Poll tunnel status
    const fetchTunnelStatus = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/tunnel/status`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) setTunnelStatus(await res.json());
        } catch { /* backend unreachable */ }
    }, [token]);

    useEffect(() => {
        fetchTunnelStatus();
        const id = setInterval(fetchTunnelStatus, 5000);
        return () => clearInterval(id);
    }, [fetchTunnelStatus]);

    const backendWsUrl = (API_BASE.replace('/api', '')).replace('https://', 'wss://').replace('http://', 'ws://');

    const copyToClipboard = (text, label) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopied(label);
            setTimeout(() => setCopied(''), 2000);
        });
    };

    const agentCommand = `node local-agent.js --server ${backendWsUrl} --token ${token}`;

    const proxyConfigs = {
        windows: {
            title: 'Windows',
            icon: '🪟',
            steps: [
                'Open Settings → Network & Internet → Proxy',
                'Under "Manual proxy setup", toggle ON "Use a proxy server"',
                'Set Address to: 127.0.0.1',
                'Set Port to: 1080',
                'Check "Don\'t use the proxy server for local addresses"',
                'Click Save',
            ],
            firefoxSteps: [
                'Open Firefox → Settings → Network Settings → Settings…',
                'Select "Manual proxy configuration"',
                'SOCKS Host: 127.0.0.1 | Port: 1080',
                'Select SOCKS v5',
                'Check "Proxy DNS when using SOCKS v5"',
                'Click OK',
            ]
        },
        macos: {
            title: 'macOS',
            icon: '🍎',
            steps: [
                'Open System Settings → Network → Wi-Fi → Details → Proxies',
                'Enable "SOCKS Proxy"',
                'Server: 127.0.0.1 | Port: 1080',
                'Click OK, then Apply',
            ],
            terminalCmd: `networksetup -setsocksfirewallproxy Wi-Fi 127.0.0.1 1080`
        },
        linux: {
            title: 'Linux',
            icon: '🐧',
            steps: [
                'Open System Settings → Network → Network Proxy',
                'Set method to "Manual"',
                'SOCKS Host: 127.0.0.1 | Port: 1080',
                'Click Apply',
            ],
            terminalCmd: `export ALL_PROXY=socks5://127.0.0.1:1080`
        }
    };

    return (
        <div className="vpn-client">
            {/* Header */}
            <div className="vpn-client-header">
                <div className="vpn-client-title">
                    <span className="vpn-icon">🔌</span>
                    <div>
                        <h2>VPN Tunnel Client</h2>
                        <p className="vpn-subtitle">Real TCP tunneling via SOCKS5 → WebSocket</p>
                    </div>
                </div>
                <div className="tunnel-status-badge">
                    <span className={`tunnel-dot ${tunnelStatus?.activeTunnels > 0 ? 'active' : ''}`} />
                    {tunnelStatus?.activeTunnels > 0
                        ? `${tunnelStatus.activeTunnels} active tunnel${tunnelStatus.activeTunnels > 1 ? 's' : ''}`
                        : 'No active tunnels'}
                </div>
            </div>

            {/* Navigation */}
            <div className="vpn-sections">
                {[
                    { id: 'quickstart', label: '🚀 Quick Start', },
                    { id: 'setup', label: '⚙️ Proxy Setup', },
                    { id: 'status', label: '📊 Live Status', },
                    { id: 'how', label: '🔍 How It Works', },
                ].map(sec => (
                    <button
                        key={sec.id}
                        className={`vpn-section-btn ${activeSection === sec.id ? 'active' : ''}`}
                        onClick={() => setActiveSection(sec.id)}
                    >
                        {sec.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="vpn-client-content">
                {/* ─── Quick Start ────────────────────────────────────── */}
                {activeSection === 'quickstart' && (
                    <div className="vpn-quickstart">
                        <div className="step-card">
                            <div className="step-number">1</div>
                            <div className="step-body">
                                <h3>Install Node.js</h3>
                                <p>The local agent requires Node.js 18+. Download from <a href="https://nodejs.org" target="_blank" rel="noreferrer">nodejs.org</a></p>
                            </div>
                        </div>

                        <div className="step-card">
                            <div className="step-number">2</div>
                            <div className="step-body">
                                <h3>Download the Local Agent</h3>
                                <p>The <code>local-agent.js</code> file is in the <code>backend/</code> folder of the NexVPN repository.</p>
                                <div className="code-block">
                                    <code>git clone https://github.com/stackpilotkulsum/NexVPN-Nova.git</code>
                                    <button
                                        className={`copy-btn ${copied === 'clone' ? 'copied' : ''}`}
                                        onClick={() => copyToClipboard('git clone https://github.com/stackpilotkulsum/NexVPN-Nova.git', 'clone')}
                                    >
                                        {copied === 'clone' ? '✓' : '⎘'}
                                    </button>
                                </div>
                                <div className="code-block" style={{ marginTop: 8 }}>
                                    <code>cd NexVPN-Nova/backend && npm install</code>
                                    <button
                                        className={`copy-btn ${copied === 'install' ? 'copied' : ''}`}
                                        onClick={() => copyToClipboard('cd NexVPN-Nova/backend && npm install', 'install')}
                                    >
                                        {copied === 'install' ? '✓' : '⎘'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="step-card highlight">
                            <div className="step-number">3</div>
                            <div className="step-body">
                                <h3>Run the Agent</h3>
                                <p>Start the SOCKS5 proxy (your JWT token is auto-filled):</p>
                                <div className="code-block agent-cmd">
                                    <code>{agentCommand}</code>
                                    <button
                                        className={`copy-btn ${copied === 'agent' ? 'copied' : ''}`}
                                        onClick={() => copyToClipboard(agentCommand, 'agent')}
                                    >
                                        {copied === 'agent' ? '✓ Copied!' : '⎘ Copy'}
                                    </button>
                                </div>
                                <div className="security-note">
                                    <span>🔒</span>
                                    <span>Your token is session-specific and expires in 24h. Never share it.</span>
                                </div>
                            </div>
                        </div>

                        <div className="step-card">
                            <div className="step-number">4</div>
                            <div className="step-body">
                                <h3>Configure Your Browser/OS</h3>
                                <p>Point your system or browser proxy to <strong>SOCKS5 127.0.0.1:1080</strong>. See the <button className="inline-link" onClick={() => setActiveSection('setup')}>Proxy Setup</button> tab for detailed instructions.</p>
                            </div>
                        </div>

                        <div className="step-card">
                            <div className="step-number">5</div>
                            <div className="step-body">
                                <h3>Browse!</h3>
                                <p>All your TCP traffic now flows through the NEXVPN server. Your real IP is hidden — websites see the server's IP instead.</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── Proxy Setup ────────────────────────────────────── */}
                {activeSection === 'setup' && (
                    <div className="vpn-setup">
                        <div className="platform-tabs">
                            {Object.entries(proxyConfigs).map(([key, cfg]) => (
                                <button
                                    key={key}
                                    className={`platform-tab ${platform === key ? 'active' : ''}`}
                                    onClick={() => setPlatform(key)}
                                >
                                    {cfg.icon} {cfg.title}
                                </button>
                            ))}
                        </div>

                        <div className="setup-instructions">
                            <h3>{proxyConfigs[platform].icon} {proxyConfigs[platform].title} — System Proxy</h3>
                            <ol className="setup-steps">
                                {proxyConfigs[platform].steps.map((step, i) => (
                                    <li key={i}>{step}</li>
                                ))}
                            </ol>

                            {proxyConfigs[platform].terminalCmd && (
                                <div className="terminal-alternative">
                                    <h4>Or use terminal:</h4>
                                    <div className="code-block">
                                        <code>{proxyConfigs[platform].terminalCmd}</code>
                                        <button
                                            className={`copy-btn ${copied === 'proxy' ? 'copied' : ''}`}
                                            onClick={() => copyToClipboard(proxyConfigs[platform].terminalCmd, 'proxy')}
                                        >
                                            {copied === 'proxy' ? '✓' : '⎘'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {proxyConfigs[platform].firefoxSteps && (
                                <div className="browser-setup">
                                    <h3>🦊 Firefox (Recommended — per-browser proxy)</h3>
                                    <ol className="setup-steps">
                                        {proxyConfigs[platform].firefoxSteps.map((step, i) => (
                                            <li key={i}>{step}</li>
                                        ))}
                                    </ol>
                                </div>
                            )}

                            <div className="chrome-note">
                                <h4>🌐 Chrome / Edge / Brave</h4>
                                <p>These browsers use the system proxy. Configure the system-wide settings above, or use extensions like <strong>SwitchyOmega</strong> or <strong>FoxyProxy</strong> for per-browser control.</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── Live Status ─────────────────────────────────────── */}
                {activeSection === 'status' && (
                    <div className="vpn-status-panel">
                        <div className="status-grid">
                            <div className="status-card">
                                <div className="status-card-icon">🔗</div>
                                <div className="status-card-value">
                                    {tunnelStatus?.activeTunnels ?? '—'}
                                </div>
                                <div className="status-card-label">Active Tunnels</div>
                            </div>
                            <div className="status-card">
                                <div className="status-card-icon">🌍</div>
                                <div className="status-card-value">
                                    {tunnelStatus?.tunnels?.length
                                        ? tunnelStatus.tunnels.map(t => t.target).join(', ')
                                        : '—'}
                                </div>
                                <div className="status-card-label">Connected Targets</div>
                            </div>
                        </div>

                        {tunnelStatus?.tunnels?.length > 0 && (
                            <div className="tunnel-list">
                                <h3>Active Tunnel Sessions</h3>
                                <table className="tunnel-table">
                                    <thead>
                                        <tr>
                                            <th>Target</th>
                                            <th>Started</th>
                                            <th>Duration</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tunnelStatus.tunnels.map((t, i) => (
                                            <tr key={i}>
                                                <td className="mono">{t.target}</td>
                                                <td>{new Date(t.startedAt).toLocaleTimeString()}</td>
                                                <td>{Math.round((Date.now() - t.startedAt) / 1000)}s</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {(!tunnelStatus?.tunnels || tunnelStatus.tunnels.length === 0) && (
                            <div className="no-tunnels">
                                <div className="no-tunnels-icon">🔌</div>
                                <p>No active tunnels. Start the local agent to see live data here.</p>
                                <button className="inline-link" onClick={() => setActiveSection('quickstart')}>
                                    → Quick Start Guide
                                </button>
                            </div>
                        )}

                        <button className="refresh-btn" onClick={fetchTunnelStatus}>
                            ↻ Refresh
                        </button>
                    </div>
                )}

                {/* ─── How It Works ────────────────────────────────────── */}
                {activeSection === 'how' && (
                    <div className="vpn-how">
                        <div className="architecture-diagram">
                            <div className="arch-node client-node">
                                <div className="arch-icon">💻</div>
                                <div className="arch-label">Your Machine</div>
                                <div className="arch-detail">Browser / Apps</div>
                            </div>
                            <div className="arch-arrow">
                                <span>SOCKS5</span>
                                <div className="arrow-line" />
                            </div>
                            <div className="arch-node agent-node">
                                <div className="arch-icon">⚡</div>
                                <div className="arch-label">Local Agent</div>
                                <div className="arch-detail">127.0.0.1:1080</div>
                            </div>
                            <div className="arch-arrow">
                                <span>WebSocket (WSS)</span>
                                <div className="arrow-line encrypted" />
                            </div>
                            <div className="arch-node server-node">
                                <div className="arch-icon">🛡️</div>
                                <div className="arch-label">NEXVPN Server</div>
                                <div className="arch-detail">Render Cloud</div>
                            </div>
                            <div className="arch-arrow">
                                <span>TCP</span>
                                <div className="arrow-line" />
                            </div>
                            <div className="arch-node dest-node">
                                <div className="arch-icon">🌐</div>
                                <div className="arch-label">Destination</div>
                                <div className="arch-detail">google.com, etc.</div>
                            </div>
                        </div>

                        <div className="how-details">
                            <div className="how-card">
                                <h4>🔐 Encryption</h4>
                                <p>The WebSocket connection uses <strong>TLS (WSS)</strong> when connecting to the production server, encrypting all data in transit. Your ISP cannot see what sites you visit.</p>
                            </div>
                            <div className="how-card">
                                <h4>🎭 IP Masking</h4>
                                <p>Websites see the <strong>NEXVPN server's IP</strong>, not yours. Your real IP is never exposed to the destination.</p>
                            </div>
                            <div className="how-card">
                                <h4>📦 Protocol</h4>
                                <p>The local agent speaks SOCKS5 — the same protocol used by Tor and SSH tunnels. It's compatible with virtually all applications.</p>
                            </div>
                            <div className="how-card">
                                <h4>⚡ Performance</h4>
                                <p>WebSocket keeps a persistent connection, avoiding repeated TLS handshakes. Binary frames minimize overhead — expect near-native speeds.</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default VPNClient;
