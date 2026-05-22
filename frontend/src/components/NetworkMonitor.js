import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import './NetworkMonitor.css';

const API_BASE = process.env.REACT_APP_API_URL || 'https://nexvpn.onrender.com/api';

const VPN_SERVERS = [
    { id: 'us-east',   name: 'US East',    city: 'New York',    flag: '🇺🇸' },
    { id: 'us-west',   name: 'US West',    city: 'Los Angeles', flag: '🇺🇸' },
    { id: 'uk',        name: 'UK London',  city: 'London',      flag: '🇬🇧' },
    { id: 'germany',   name: 'Germany',    city: 'Frankfurt',   flag: '🇩🇪' },
    { id: 'japan',     name: 'Japan',      city: 'Tokyo',       flag: '🇯🇵' },
    { id: 'singapore', name: 'Singapore',  city: 'Singapore',   flag: '🇸🇬' },
    { id: 'canada',    name: 'Canada',     city: 'Toronto',     flag: '🇨🇦' },
    { id: 'australia', name: 'Australia',  city: 'Sydney',      flag: '🇦🇺' },
];

function Section({ title, action, children }) {
    return (
        <div className="monitor-section">
            <div className="section-header">
                <h3>{title}</h3>
                {action}
            </div>
            {children}
        </div>
    );
}

export default function NetworkMonitor() {
    const [publicIP, setPublicIP]           = useState(null);
    const [ipLoading, setIpLoading]         = useState(true);
    const [systemInfo, setSystemInfo]       = useState(null);
    const [latencies, setLatencies]         = useState([]);
    const [latLoading, setLatLoading]       = useState(false);
    const [latHistory, setLatHistory]       = useState([]);
    const [dnsResults, setDnsResults]       = useState(null);
    const [dnsLoading, setDnsLoading]       = useState(false);
    const intervalRef = useRef(null);

    // ── Public IP ───────────────────────────────────────────────────────────
    const fetchPublicIP = useCallback(async () => {
        setIpLoading(true);
        try {
            const res = await axios.get(`${API_BASE}/network/public-ip`, { timeout: 10000 });
            const d = res.data;
            if (d.ip === 'error' || d.ip === 'unavailable') throw new Error(d.error || 'Backend failed');
            setPublicIP({
                ...d,
                latitude:  d.latitude  != null ? parseFloat(d.latitude)  : null,
                longitude: d.longitude != null ? parseFloat(d.longitude) : null,
            });
        } catch {
            // Fallback: call ipapi.co directly from the browser
            try {
                const r2 = await axios.get('https://ipapi.co/json/', { timeout: 8000 });
                const d2 = r2.data;
                setPublicIP({
                    ip:        d2.ip,
                    country:   d2.country_name || 'N/A',
                    city:      d2.city         || 'N/A',
                    region:    d2.region       || 'N/A',
                    isp:       d2.org          || 'N/A',
                    timezone:  d2.timezone     || 'N/A',
                    latitude:  d2.latitude  != null ? parseFloat(d2.latitude)  : null,
                    longitude: d2.longitude != null ? parseFloat(d2.longitude) : null,
                });
            } catch {
                setPublicIP({ ip: 'Unavailable', country: 'N/A', city: 'N/A', isp: 'N/A', timezone: 'N/A', region: 'N/A' });
            }
        }
        setIpLoading(false);
    }, []);

    // ── System info ─────────────────────────────────────────────────────────
    const fetchSystemInfo = useCallback(async () => {
        try {
            const res = await axios.get(`${API_BASE}/network/system-info`, { timeout: 6000 });
            setSystemInfo(res.data);
        } catch {
            setSystemInfo({
                hostname:          window.location.hostname || 'browser',
                platform:          navigator.platform       || 'Unknown',
                arch:              'Unknown',
                cpus:              navigator.hardwareConcurrency || 'Unknown',
                totalMemory:       null,
                freeMemory:        null,
                networkInterfaces: [],
            });
        }
    }, []);

    // ── Latencies ───────────────────────────────────────────────────────────
    const fetchLatencies = useCallback(async () => {
        setLatLoading(true);
        try {
            // Increase timeout — TCP to global IPs from local network can take 3–8s
            const res = await axios.get(`${API_BASE}/network/latencies`, { timeout: 25000 });
            const lats = res.data.latencies || [];
            setLatencies(lats);
            const valid = lats.filter(l => l.latency != null);
            if (valid.length > 0) {
                const avg = valid.reduce((s, l) => s + l.latency, 0) / valid.length;
                setLatHistory(prev => [...prev.slice(-29), { time: new Date().toLocaleTimeString(), avg: Math.round(avg) }]);
            }
        } catch (e) {
            console.error('Latencies fetch failed:', e.message);
            // On timeout, show all as N/A
            setLatencies(VPN_SERVERS.map(s => ({ id: s.id, latency: null })));
        }
        setLatLoading(false);
    }, []);

    // ── DNS leak test ────────────────────────────────────────────────────────
    const runDNSTest = async () => {
        setDnsLoading(true);
        setDnsResults(null);
        try {
            const res = await axios.get(`${API_BASE}/network/dns-leak-test`, { timeout: 20000 });
            setDnsResults(res.data.results || []);
        } catch (e) {
            setDnsResults([{ domain: 'Backend error: ' + e.message, resolved: false, latency: 0 }]);
        }
        setDnsLoading(false);
    };

    // ── Init ────────────────────────────────────────────────────────────────
    useEffect(() => {
        fetchPublicIP();
        fetchSystemInfo();
        fetchLatencies();
        intervalRef.current = setInterval(fetchLatencies, 60000); // refresh every 60s
        return () => clearInterval(intervalRef.current);
    }, [fetchPublicIP, fetchSystemInfo, fetchLatencies]);

    const latColor = (ms) => {
        if (ms == null) return 'var(--text-muted)';
        if (ms < 80)  return 'var(--success)';
        if (ms < 200) return 'var(--warning)';
        return 'var(--danger)';
    };
    const latLabel = (ms) => {
        if (ms == null) return 'Timeout';
        if (ms < 80)  return 'Excellent';
        if (ms < 200) return 'Good';
        if (ms < 350) return 'Fair';
        return 'Poor';
    };
    const fmtBytes = (b) => {
        if (!b) return 'N/A';
        if (b < 1024)       return `${b} B`;
        if (b < 1024*1024)  return `${(b/1024).toFixed(1)} KB`;
        return `${(b/1024/1024).toFixed(1)} MB`;
    };

    return (
        <div className="network-monitor">

            {/* ── Public IP ─────────────────────────────────── */}
            <Section
                title="🌐 Your Public IP"
                action={
                    <button className="btn btn-secondary btn-sm" onClick={fetchPublicIP} disabled={ipLoading}>
                        {ipLoading ? '⏳' : '🔄 Refresh'}
                    </button>
                }
            >
                {ipLoading ? (
                    <div style={{ display:'flex', gap:'10px', alignItems:'center', padding:'16px', color:'var(--text-muted)', fontFamily:'JetBrains Mono', fontSize:'12px' }}>
                        <div className="spinner"></div> Detecting your IP and location...
                    </div>
                ) : publicIP ? (
                    <div className="ip-info-grid">
                        {[
                            { label: 'Public IP',    value: publicIP.ip,       large: true },
                            { label: 'Location',     value: [publicIP.city, publicIP.country].filter(Boolean).join(', ') || 'N/A' },
                            { label: 'ISP',          value: publicIP.isp      || 'N/A' },
                            { label: 'Region',       value: publicIP.region   || 'N/A' },
                            { label: 'Timezone',     value: publicIP.timezone || 'N/A' },
                            { label: 'Coordinates',  value: publicIP.latitude != null ? `${publicIP.latitude.toFixed(4)}, ${publicIP.longitude?.toFixed(4)}` : 'N/A' },
                        ].map((item, i) => (
                            <div key={i} className={`ip-info-card${i === 0 ? ' main-ip' : ''}`}>
                                <div className="ip-label">{item.label}</div>
                                <div className="ip-value" style={item.large ? { fontSize:'1.3rem', fontFamily:'monospace' } : {}}>
                                    {item.value}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : null}
            </Section>

            {/* ── Server Latencies ──────────────────────────── */}
            <Section
                title="📡 Real Server Latencies"
                action={
                    <button className="btn btn-secondary btn-sm" onClick={fetchLatencies} disabled={latLoading}>
                        {latLoading ? '⏳ Measuring...' : '🔄 Refresh'}
                    </button>
                }
            >
                <p className="section-note">Real TCP connection times to VPN endpoints. Values vary by your network conditions.</p>
                {latLoading && latencies.length === 0 && (
                    <div style={{ display:'flex', gap:'10px', alignItems:'center', padding:'16px', color:'var(--text-muted)', fontFamily:'JetBrains Mono', fontSize:'12px' }}>
                        <div className="spinner"></div> Measuring TCP latency to 8 global servers (takes ~10s)...
                    </div>
                )}
                <div className="latency-grid">
                    {VPN_SERVERS.map(srv => {
                        const r = latencies.find(l => l.id === srv.id);
                        const ms = r?.latency ?? (latLoading ? undefined : null);
                        return (
                            <div key={srv.id} className="latency-card">
                                <div className="latency-server">{srv.flag} {srv.name}</div>
                                <div className="latency-city">{srv.city}</div>
                                <div className="latency-ms" style={{ color: latColor(ms) }}>
                                    {latLoading && ms === undefined ? '...' : ms != null ? `${ms}ms` : 'N/A'}
                                </div>
                                <div className="latency-label" style={{ color: latColor(ms) }}>
                                    {latLoading && ms === undefined ? 'Measuring' : latLabel(ms)}
                                </div>
                                <div className="latency-bar-container">
                                    <div className="latency-bar" style={{
                                        width: ms ? `${Math.min(100,(ms/500)*100)}%` : '0%',
                                        backgroundColor: latColor(ms),
                                        transition: 'width 0.5s ease',
                                    }} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </Section>

            {/* ── System Info ────────────────────────────────── */}
            {systemInfo && (
                <Section title="💻 System Network Info">
                    <div className="system-info-grid">
                        {[
                            { label: 'Hostname', value: systemInfo.hostname || 'Unknown' },
                            { label: 'Platform', value: systemInfo.platform && systemInfo.platform !== 'Unknown' ? `${systemInfo.platform} (${systemInfo.arch})` : (navigator.platform || 'Unknown') },
                            { label: 'CPU Cores', value: String(systemInfo.cpus || navigator.hardwareConcurrency || 'Unknown') },
                            { label: 'Memory', value: systemInfo.totalMemory ? `${fmtBytes(systemInfo.freeMemory)} free / ${fmtBytes(systemInfo.totalMemory)}` : (navigator.deviceMemory ? `~${navigator.deviceMemory} GB` : 'N/A') },
                        ].map((item, i) => (
                            <div key={i} className="sys-card">
                                <span className="sys-label">{item.label}</span>
                                <span className="sys-value">{item.value}</span>
                            </div>
                        ))}
                    </div>
                    {systemInfo.networkInterfaces && systemInfo.networkInterfaces.length > 0 && (
                        <div className="ifaces-list">
                            <h4>Network Interfaces</h4>
                            {systemInfo.networkInterfaces.map((iface, i) => (
                                <div key={i} className="iface-row">
                                    <span className="iface-name">{iface.name}</span>
                                    <span className="iface-ip">{iface.address}</span>
                                    <span className="iface-mask">{iface.netmask}</span>
                                    <span className="iface-mac">{iface.mac}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </Section>
            )}

            {/* ── DNS Leak Test ────────────────────────────── */}
            <Section
                title="🔍 DNS Leak Test"
                action={
                    <button className="btn btn-primary btn-sm" onClick={runDNSTest} disabled={dnsLoading}>
                        {dnsLoading ? '⏳ Testing...' : '▶ Run Test'}
                    </button>
                }
            >
                <p className="section-note">Resolves test domains through your current DNS. All should resolve — failures may indicate a DNS leak.</p>

                {dnsLoading && (
                    <div style={{ display:'flex', gap:'10px', alignItems:'center', padding:'16px', color:'var(--text-muted)', fontFamily:'JetBrains Mono', fontSize:'12px' }}>
                        <div className="spinner"></div> Querying DNS servers...
                    </div>
                )}

                {dnsResults && !dnsLoading && (
                    <div className="dns-results">
                        {/* Summary banner */}
                        {(() => {
                            const ok = dnsResults.every(r => r.resolved);
                            return (
                                <div style={{
                                    background: ok ? 'rgba(0,255,136,0.08)' : 'rgba(255,170,0,0.08)',
                                    border: `1px solid ${ok ? 'rgba(0,255,136,0.35)' : 'rgba(255,170,0,0.35)'}`,
                                    borderRadius:'8px', padding:'12px 16px', marginBottom:'12px',
                                    color: ok ? 'var(--success)' : 'var(--warning)',
                                    fontFamily:'JetBrains Mono', fontWeight:'700', fontSize:'13px',
                                }}>
                                    {ok ? '✅ No DNS Leak Detected — all queries resolved' : '⚠ Some DNS queries failed — possible misconfiguration'}
                                </div>
                            );
                        })()}
                        {dnsResults.map((r, i) => (
                            <div key={i} className={`dns-result-row ${r.resolved ? 'resolved' : 'failed'}`}>
                                <span className="dns-domain">{r.domain}</span>
                                <span className="dns-status">{r.resolved ? '✅ Resolved' : '❌ Failed'}</span>
                                {r.addresses && <span className="dns-addrs">{r.addresses.join(', ')}</span>}
                                <span className="dns-latency">{r.latency}ms</span>
                            </div>
                        ))}
                    </div>
                )}

                {!dnsResults && !dnsLoading && (
                    <div style={{ color:'var(--text-muted)', fontFamily:'JetBrains Mono', fontSize:'12px', padding:'16px', textAlign:'center' }}>
                        Click "Run Test" to check for DNS leaks
                    </div>
                )}
            </Section>

            {/* ── Latency History Chart ─────────────────────── */}
            {latHistory.length > 1 && (
                <Section title="📈 Latency History">
                    <div style={{ display:'flex', alignItems:'flex-end', gap:'4px', height:'80px', padding:'8px 0' }}>
                        {latHistory.map((h, i) => (
                            <div key={i} style={{ flex:1 }}>
                                <div style={{
                                    width:'100%',
                                    height:`${Math.max(4, Math.min(64, (h.avg/500)*64))}px`,
                                    backgroundColor: latColor(h.avg),
                                    borderRadius:'2px 2px 0 0',
                                    transition:'height 0.3s ease',
                                    opacity: 0.4 + 0.6 * (i / latHistory.length),
                                }} />
                            </div>
                        ))}
                    </div>
                    <div style={{ color:'var(--text-muted)', fontSize:'11px', textAlign:'center', fontFamily:'JetBrains Mono', marginTop:'4px' }}>
                        Avg latency over time — last {latHistory.length} measurements
                    </div>
                </Section>
            )}
        </div>
    );
}
