import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './ProtocolSelection.css';

const API_BASE = process.env.REACT_APP_API_URL || 'https://nexvpn.onrender.com/api';

const DESCRIPTIONS = {
    wireguard: 'Modern, ultra-fast protocol with state-of-the-art ChaCha20 cryptography. Best all-round choice.',
    openvpn:   'Industry-standard protocol. Highly compatible across all platforms and firewalls.',
    ikev2:     'Fast and stable. Excellent on mobile — auto-reconnects when network changes.',
    l2tp:      'Legacy protocol. Only use if WireGuard or OpenVPN are blocked.',
};

function ProtocolSelection({ token, onProtocolSelect, currentProtocol }) {
    const [protocols, setProtocols]   = useState([]);
    const [loading, setLoading]       = useState(true);
    const [switching, setSwitching]   = useState(null);
    const [successMsg, setSuccessMsg] = useState('');
    const [error, setError]           = useState('');
    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;
        fetchProtocols();
        return () => { mounted.current = false; };
    }, []); // eslint-disable-line

    const fetchProtocols = async () => {
        try {
            const res = await axios.get(`${API_BASE}/vpn/protocols`, { timeout: 10000 });
            if (mounted.current) setProtocols(res.data.protocols || []);
        } catch (err) {
            console.error('Failed to fetch protocols:', err);
            if (mounted.current)
                setError('Failed to load protocols — is the backend running on port 3001?');
        } finally {
            if (mounted.current) setLoading(false);
        }
    };

    const handleSelect = async (protocol) => {
        if (switching) return;

        setSwitching(protocol.id);
        setError('');
        setSuccessMsg('');

        // ── Optimistic update ─────────────────────────────────────────────
        onProtocolSelect(protocol);

        try {
            const res = await axios.post(
                `${API_BASE}/vpn/select-protocol`,
                { token, protocolId: protocol.id },
                { timeout: 10000 }
            );

            if (res.data.success && mounted.current) {
                onProtocolSelect(res.data.protocol);
                setSuccessMsg(`✅ Switched to ${res.data.protocol.name}`);
                setTimeout(() => { if (mounted.current) setSuccessMsg(''); }, 3000);
            }
        } catch (err) {
            console.error('select-protocol error:', err);
            if (mounted.current) {
                const msg = err.response?.data?.error || err.message;
                setError(`⚠ Backend error: ${msg}. Protocol applied locally.`);
                setTimeout(() => { if (mounted.current) setError(''); }, 5000);
            }
        } finally {
            if (mounted.current) setSwitching(null);
        }
    };

    const secColor = (s) =>
        s === 'High' ? '#00ff88' : s === 'Medium' ? '#ffaa00' : '#ff3366';
    const spdColor = (s) =>
        s === 'Fast' ? '#00ff88' : s === 'Medium' ? '#ffaa00' : '#ff3366';

    if (loading) {
        return (
            <div className="protocol-selection">
                <div style={{
                    display: 'flex', gap: '12px', alignItems: 'center',
                    padding: '40px', justifyContent: 'center',
                    fontFamily: 'JetBrains Mono', color: 'var(--text-muted)',
                }}>
                    <div className="spinner" />
                    Loading protocols…
                </div>
            </div>
        );
    }

    return (
        <div className="protocol-selection">
            <div className="protocol-selection-header">
                <h3>🔒 Connection Protocol</h3>
                <p>Click a protocol card to activate it. The active protocol is highlighted in green.</p>
            </div>

            {/* Banners */}
            {error && (
                <div style={{
                    background: 'rgba(255,51,102,0.1)',
                    border: '1px solid rgba(255,51,102,0.3)',
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

            {/* Active protocol banner */}
            {currentProtocol && (
                <div className="current-protocol">
                    <div className="selected-protocol-info">
                        <div className="protocol-icon">🛡️</div>
                        <div className="protocol-details">
                            <div className="protocol-name">{currentProtocol.name}</div>
                            <div className="protocol-encryption">
                                Encryption: {currentProtocol.encryption}
                            </div>
                            <div className="protocol-port">Port: {currentProtocol.port}</div>
                        </div>
                        <div className="protocol-badges">
                            <span
                                className="badge"
                                style={{
                                    background: secColor(currentProtocol.security) + '25',
                                    color: secColor(currentProtocol.security),
                                    border: `1px solid ${secColor(currentProtocol.security)}50`,
                                }}
                            >
                                {currentProtocol.security} Security
                            </span>
                            <span
                                className="badge"
                                style={{
                                    background: spdColor(currentProtocol.speed) + '25',
                                    color: spdColor(currentProtocol.speed),
                                    border: `1px solid ${spdColor(currentProtocol.speed)}50`,
                                }}
                            >
                                {currentProtocol.speed} Speed
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Protocol grid */}
            <div className="protocols-grid">
                {protocols.map((protocol) => {
                    const isActive    = currentProtocol?.id === protocol.id;
                    const isSwitching = switching === protocol.id;

                    return (
                        <div
                            key={protocol.id}
                            className={`protocol-card ${isActive ? 'selected' : ''}`}
                            onClick={() => handleSelect(protocol)}
                            style={{
                                cursor: isSwitching ? 'wait' : switching ? 'not-allowed' : 'pointer',
                                opacity: switching && !isActive && !isSwitching ? 0.6 : 1,
                                position: 'relative',
                                userSelect: 'none',
                            }}
                        >
                            {/* Switching overlay */}
                            {isSwitching && (
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
                                        Switching…
                                    </span>
                                </div>
                            )}

                            <div className="protocol-header">
                                <h4>{protocol.name}</h4>
                                {isActive && (
                                    <div style={{
                                        color: 'var(--success)',
                                        fontWeight: '700',
                                        fontSize: '18px',
                                        lineHeight: 1,
                                    }}>
                                        ✓
                                    </div>
                                )}
                            </div>

                            <div className="protocol-specs">
                                <div className="spec">
                                    <span className="spec-label">Encryption</span>
                                    <span className="spec-value" style={{ fontSize: '10px' }}>
                                        {protocol.encryption}
                                    </span>
                                </div>
                                <div className="spec">
                                    <span className="spec-label">Port</span>
                                    <span className="spec-value">{protocol.port}</span>
                                </div>
                            </div>

                            <div className="protocol-characteristics">
                                <div className="characteristic">
                                    <span className="char-label">Security</span>
                                    <span
                                        className="char-badge"
                                        style={{
                                            background: secColor(protocol.security),
                                            color: '#000',
                                        }}
                                    >
                                        {protocol.security}
                                    </span>
                                </div>
                                <div className="characteristic">
                                    <span className="char-label">Speed</span>
                                    <span
                                        className="char-badge"
                                        style={{
                                            background: spdColor(protocol.speed),
                                            color: '#000',
                                        }}
                                    >
                                        {protocol.speed}
                                    </span>
                                </div>
                            </div>

                            <div style={{
                                color: 'var(--text-muted)',
                                fontSize: '11px',
                                marginTop: '10px',
                                lineHeight: '1.5',
                                fontFamily: 'JetBrains Mono',
                            }}>
                                {DESCRIPTIONS[protocol.id] || ''}
                            </div>

                            {!isActive && !switching && (
                                <div style={{
                                    marginTop: '12px', textAlign: 'center',
                                    fontFamily: 'JetBrains Mono', fontSize: '11px',
                                    color: 'var(--accent-cyan)', opacity: 0.7,
                                    border: '1px solid rgba(0,212,255,0.2)',
                                    borderRadius: '4px', padding: '4px 8px',
                                }}>
                                    Click to activate
                                </div>
                            )}

                            {isActive && (
                                <div style={{
                                    marginTop: '12px', textAlign: 'center',
                                    fontFamily: 'JetBrains Mono', fontSize: '11px',
                                    color: 'var(--success)', fontWeight: '700',
                                    background: 'rgba(0,255,136,0.1)',
                                    border: '1px solid rgba(0,255,136,0.3)',
                                    borderRadius: '4px', padding: '4px 8px',
                                }}>
                                    ✓ ACTIVE
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default ProtocolSelection;
