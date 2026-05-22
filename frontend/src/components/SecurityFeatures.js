import React, { useState, useEffect, useRef } from 'react';
import { getSocket, connectSocket } from '../utils/socket';

function SecurityFeatures({ token, onSettingsChange }) {
    const [killSwitch, setKillSwitch]       = useState(false);
    const [dnsProtection, setDnsProtection] = useState(false);
    const [splitTunneling, setSplitTunneling] = useState(false);
    const [selectedApps, setSelectedApps]   = useState([]);
    const [loading, setLoading]             = useState(null); // which toggle is loading
    const [toast, setToast]                 = useState('');
    const toastTimer = useRef(null);

    const availableApps = [
        { id: 'browser',   name: 'Web Browser',      icon: '🌐' },
        { id: 'email',     name: 'Email Client',      icon: '📧' },
        { id: 'gaming',    name: 'Gaming Platform',   icon: '🎮' },
        { id: 'streaming', name: 'Streaming Service', icon: '📺' },
        { id: 'social',    name: 'Social Media',      icon: '💬' },
        { id: 'banking',   name: 'Banking App',       icon: '🏦' },
    ];

    const showToast = (msg) => {
        setToast(msg);
        clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(''), 3000);
    };

    // Tell parent whenever security settings change
    useEffect(() => {
        if (onSettingsChange) {
            onSettingsChange({ killSwitch, dnsProtection, splitTunneling });
        }
    }, [killSwitch, dnsProtection, splitTunneling, onSettingsChange]);

    // Listen for socket responses — use getSocket() so we don't re-register connect listeners
    useEffect(() => {
        // Ensure socket exists (connectSocket creates it if needed)
        connectSocket(token);

        const handleKill    = (d) => { setKillSwitch(d.enabled);    setLoading(null); showToast(d.enabled ? '⚡ Kill Switch enabled' : '⚡ Kill Switch disabled'); };
        const handleDNS     = (d) => { setDnsProtection(d.enabled); setLoading(null); showToast(d.enabled ? '🛡️ DNS Protection enabled' : '🛡️ DNS Protection disabled'); };
        const handleSplit   = (d) => { setSplitTunneling(d.enabled); setSelectedApps(d.apps || []); setLoading(null); showToast(d.enabled ? '🔀 Split Tunneling enabled' : '🔀 Split Tunneling disabled'); };

        const s = getSocket();
        if (s) {
            s.on('kill_switch_status',    handleKill);
            s.on('dns_protection_status', handleDNS);
            s.on('split_tunneling_status', handleSplit);
        }

        return () => {
            const s2 = getSocket();
            if (s2) {
                s2.off('kill_switch_status',    handleKill);
                s2.off('dns_protection_status', handleDNS);
                s2.off('split_tunneling_status', handleSplit);
            }
        };
    }, [token]);

    const toggle = (type) => {
        // Use getSocket() — never connectSocket() here, to avoid re-registering listeners
        const s = getSocket();
        if (!s || !s.connected) {
            showToast('⚠ Not connected to backend. Start the backend server first.');
            return;
        }
        setLoading(type);
        if (type === 'kill')  s.emit('toggle_kill_switch',    { enabled: !killSwitch });
        if (type === 'dns')   s.emit('toggle_dns_protection', { enabled: !dnsProtection });
        if (type === 'split') s.emit('toggle_split_tunneling', { enabled: !splitTunneling, apps: !splitTunneling ? selectedApps : [] });

        // Safety: clear loading after 5s if no response
        setTimeout(() => setLoading(prev => prev === type ? null : prev), 5000);
    };

    const toggleApp = (id) => {
        setSelectedApps(prev => prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]);
    };

    const ToggleSwitch = ({ enabled, onChange, busy }) => (
        <div
            onClick={!busy ? onChange : undefined}
            style={{
                cursor: busy ? 'wait' : 'pointer',
                width: '48px', height: '26px', borderRadius: '13px',
                background: enabled ? 'var(--success)' : 'var(--bg-base)',
                border: `1px solid ${enabled ? 'var(--success)' : 'var(--border)'}`,
                position: 'relative', transition: 'all 0.3s ease',
                boxShadow: enabled ? '0 0 12px rgba(0,255,136,0.4)' : 'none',
                opacity: busy ? 0.7 : 1,
                flexShrink: 0,
            }}
        >
            {busy ? (
                <div style={{
                    position: 'absolute', top: '4px', left: '50%', transform: 'translateX(-50%)',
                    width: '16px', height: '16px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: '#fff',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                }} />
            ) : (
                <div style={{
                    position: 'absolute', top: '4px',
                    left: enabled ? '24px' : '4px',
                    width: '16px', height: '16px', borderRadius: '50%',
                    background: enabled ? '#000' : 'var(--text-muted)',
                    transition: 'left 0.3s ease',
                }} />
            )}
        </div>
    );

    const Card = ({ id, icon, title, desc, enabled, children }) => (
        <div style={{
            background: 'var(--bg-elevated)',
            border: `1px solid ${enabled ? 'rgba(0,255,136,0.3)' : 'var(--border)'}`,
            borderRadius: '12px', padding: '20px',
            transition: 'border-color 0.3s ease',
        }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '12px' }}>
                <div style={{ fontSize: '24px', flexShrink: 0 }}>{icon}</div>
                <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: '700', fontSize: '15px', color: 'var(--text-primary)', marginBottom: '3px' }}>{title}</div>
                    <div style={{ fontFamily: 'JetBrains Mono', fontSize: '11px', color: 'var(--text-muted)' }}>{desc}</div>
                </div>
                <ToggleSwitch enabled={enabled} onChange={() => toggle(id)} busy={loading === id} />
            </div>
            <div style={{
                fontFamily: 'JetBrains Mono', fontSize: '11px',
                padding: '6px 12px', borderRadius: '6px',
                background: enabled ? 'rgba(0,255,136,0.07)' : 'rgba(255,51,102,0.07)',
                color: enabled ? 'var(--success)' : 'var(--danger)',
                border: `1px solid ${enabled ? 'rgba(0,255,136,0.2)' : 'rgba(255,51,102,0.2)'}`,
                marginBottom: children ? '14px' : 0,
            }}>
                {enabled ? '✓ Active — protection enabled' : '✕ Inactive — click toggle to enable'}
            </div>
            {children}
        </div>
    );

    return (
        <div>
            <div style={{ fontSize: '11px', letterSpacing: '2px', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono', marginBottom: '20px', textTransform: 'uppercase' }}>
                Advanced Security Settings
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

                <Card id="kill" icon="⚡" title="Kill Switch" desc="Blocks all internet if VPN drops" enabled={killSwitch}>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                        Prevents data leaks if your VPN connection drops unexpectedly. All traffic is blocked until VPN reconnects.
                    </div>
                </Card>

                <Card id="dns" icon="🛡️" title="DNS Leak Protection" desc="Routes all DNS through VPN tunnel" enabled={dnsProtection}>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                        Prevents your ISP from seeing your DNS queries. All lookups are encrypted inside the VPN tunnel.
                    </div>
                </Card>

                <Card id="split" icon="🔀" title="Split Tunneling" desc="Choose which apps use the VPN" enabled={splitTunneling}>
                    {splitTunneling && (
                        <div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono', marginBottom: '10px', letterSpacing: '1px' }}>
                                SELECT APPS FOR VPN TUNNEL:
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '10px' }}>
                                {availableApps.map(app => (
                                    <div key={app.id} onClick={() => toggleApp(app.id)} style={{
                                        cursor: 'pointer', padding: '8px 10px', borderRadius: '6px',
                                        background: selectedApps.includes(app.id) ? 'rgba(0,212,255,0.1)' : 'var(--bg-base)',
                                        border: `1px solid ${selectedApps.includes(app.id) ? 'rgba(0,212,255,0.35)' : 'var(--border)'}`,
                                        display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px',
                                        color: selectedApps.includes(app.id) ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                                        transition: 'all 0.2s',
                                    }}>
                                        <span>{app.icon}</span>
                                        <span style={{ flex: 1 }}>{app.name}</span>
                                        {selectedApps.includes(app.id) && <span style={{ color: 'var(--accent-cyan)' }}>✓</span>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </Card>

                <Card id="enc" icon="🔐" title="Encryption Status" desc="AES-256 + RSA-2048 active" enabled={true}>
                    <div style={{ fontFamily: 'JetBrains Mono', fontSize: '11px', lineHeight: '2', color: 'var(--text-secondary)' }}>
                        <div>Protocol: <span style={{ color: 'var(--accent-cyan)' }}>TLS 1.3</span></div>
                        <div>Key Exchange: <span style={{ color: 'var(--accent-cyan)' }}>RSA-OAEP 2048-bit</span></div>
                        <div>Data Cipher: <span style={{ color: 'var(--accent-cyan)' }}>AES-256-CBC</span></div>
                        <div>Hash: <span style={{ color: 'var(--accent-cyan)' }}>SHA-256</span></div>
                    </div>
                </Card>
            </div>

            {/* Toast notification */}
            {toast && (
                <div style={{
                    position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999,
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    borderRadius: '8px', padding: '12px 18px',
                    fontFamily: 'JetBrains Mono', fontSize: '13px', color: 'var(--accent-cyan)',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                    animation: 'slideIn 0.2s ease',
                }}>
                    {toast}
                </div>
            )}
        </div>
    );
}

export default SecurityFeatures;
