import React, { useState, useEffect } from 'react';
import { getConnectionInfo } from '../utils/socket';
import './VPNStatus.css';

function VPNStatus({ connected, selectedServer, selectedProtocol }) {
    const [vpnInfo, setVpnInfo] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchInfo = async () => {
            try {
                const info = await getConnectionInfo();
                setVpnInfo(info);
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        fetchInfo();
        const iv = setInterval(fetchInfo, 3000);
        return () => clearInterval(iv);
    }, []);

    if (loading) return <div className="loading"><div className="spinner"></div></div>;

    return (
        <div className="vpn-status">
            <div className="status-grid">
                <div className="status-card">
                    <h3>🔗 Connection ID</h3>
                    <p className="connection-id">{vpnInfo?.connectionId?.substring(0,16) || 'N/A'}...</p>
                </div>
                <div className="status-card">
                    <h3>⚡ Latency</h3>
                    <p className="status-value">{vpnInfo?.latency || 0}ms</p>
                </div>
                <div className="status-card">
                    <h3>📉 Packet Loss</h3>
                    <p className="status-value">{(vpnInfo?.packetLoss || 0).toFixed(2)}%</p>
                </div>
                <div className="status-card">
                    <h3>⏱ Uptime</h3>
                    <p className="status-value">{Math.floor((vpnInfo?.uptime || 0) / 1000)}s</p>
                </div>
            </div>
            {selectedServer && (
                <div style={{ background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:'10px', padding:'16px', marginBottom:'16px' }}>
                    <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'12px' }}>Active Connection</div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', fontFamily:'JetBrains Mono,monospace', fontSize:'12px' }}>
                        <div><span style={{ color:'var(--text-muted)' }}>Server: </span><span style={{ color:'var(--accent-cyan)' }}>{selectedServer.name}</span></div>
                        <div><span style={{ color:'var(--text-muted)' }}>City: </span><span style={{ color:'var(--text-primary)' }}>{selectedServer.city}</span></div>
                        <div><span style={{ color:'var(--text-muted)' }}>Exit IP: </span><span style={{ color:'var(--text-primary)' }}>{selectedServer.ip}</span></div>
                        <div><span style={{ color:'var(--text-muted)' }}>Protocol: </span><span style={{ color:'var(--accent-cyan)' }}>{selectedProtocol?.name || 'Not set'}</span></div>
                        <div><span style={{ color:'var(--text-muted)' }}>Status: </span><span style={{ color: connected ? 'var(--success)' : 'var(--danger)' }}>{connected ? 'Secured' : 'Disconnected'}</span></div>
                        <div><span style={{ color:'var(--text-muted)' }}>Encryption: </span><span style={{ color:'var(--accent-cyan)' }}>{selectedProtocol?.encryption || 'AES-256'}</span></div>
                    </div>
                </div>
            )}
            <div className="encryption-section">
                <h3>🔐 Encryption Details</h3>
                <div className="encryption-details">
                    <p><strong>Protocol:</strong> TLS 1.3</p>
                    <p><strong>Key Exchange:</strong> RSA-OAEP (2048-bit)</p>
                    <p><strong>Data Encryption:</strong> AES-256-CBC</p>
                    <p><strong>Status:</strong> <span className="badge badge-success">{connected ? 'Secured' : 'Inactive'}</span></p>
                </div>
            </div>
        </div>
    );
}

export default VPNStatus;
