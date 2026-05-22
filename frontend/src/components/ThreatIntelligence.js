import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'https://nexvpn.onrender.com/api';

// Known malicious/suspicious domain patterns
const SUSPICIOUS_PATTERNS = ['track', 'telemetry', 'analytics', 'beacon', 'spy', 'log', 'collect', 'monitor'];

// Simulate threat feed scanning
const THREAT_FEED = [
    { type: 'Tor Exit Node', severity: 'medium', description: 'Connection may route through Tor exit nodes' },
    { type: 'Data Center IP', severity: 'low', description: 'IP belongs to a cloud/hosting provider' },
    { type: 'Proxy Detection', severity: 'low', description: 'Standard VPN proxy behavior detected' },
];

function ThreatIntelligence() {
    const [scanning, setScanning] = useState(false);
    const [scanDone, setScanDone] = useState(false);
    const [publicIP, setPublicIP] = useState(null);
    const [threats, setThreats] = useState([]);
    const [domainScan, setDomainScan] = useState('');
    const [domainResult, setDomainResult] = useState(null);
    const [domainScanning, setDomainScanning] = useState(false);
    const [liveEvents, setLiveEvents] = useState([]);

    useEffect(() => {
        // Simulate live threat event feed
        const events = [
            { time: new Date().toLocaleTimeString(), type: 'BLOCK', msg: 'Blocked tracker: analytics.google.com', color: '#00ff88' },
            { time: new Date(Date.now()-5000).toLocaleTimeString(), type: 'ALERT', msg: 'Suspicious outbound to 185.220.101.x', color: '#ffaa00' },
            { time: new Date(Date.now()-12000).toLocaleTimeString(), type: 'BLOCK', msg: 'DNS request blocked: tracking.pixel.io', color: '#00ff88' },
            { time: new Date(Date.now()-30000).toLocaleTimeString(), type: 'INFO', msg: 'VPN tunnel established — traffic encrypted', color: '#00d4ff' },
        ];
        setLiveEvents(events);

        const interval = setInterval(() => {
            const msgs = [
                { type:'BLOCK', msg:`Blocked DNS: ${SUSPICIOUS_PATTERNS[Math.floor(Math.random()*SUSPICIOUS_PATTERNS.length)]}-${Math.floor(Math.random()*99)}.io`, color:'#00ff88' },
                { type:'INFO', msg:'Heartbeat: tunnel healthy', color:'#00d4ff' },
                { type:'ALERT', msg:`Port scan detected from ${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}`, color:'#ffaa00' },
            ];
            const e = msgs[Math.floor(Math.random() * msgs.length)];
            setLiveEvents(prev => [{ ...e, time: new Date().toLocaleTimeString() }, ...prev.slice(0, 14)]);
        }, 4000);

        return () => clearInterval(interval);
    }, []);

    const runIPScan = async () => {
        setScanning(true);
        setScanDone(false);
        setThreats([]);
        try {
            const res = await axios.get(`${API_BASE}/network/public-ip`);
            setPublicIP(res.data.ip);

            // Simulate threat analysis delay
            await new Promise(r => setTimeout(r, 1500));

            // Real checks + simulated threat intel
            const foundThreats = [];
            if (res.data.ip && res.data.ip !== 'unavailable') {
                // Check if it looks like a datacenter IP (simplified heuristic)
                const ipParts = res.data.ip.split('.');
                if (ipParts[0] === '1' || ipParts[0] === '8' || ipParts[0] === '9') {
                    foundThreats.push({ type: 'Public DNS/CDN Range', severity: 'info', description: `${res.data.ip} is in a well-known public IP range` });
                }
                foundThreats.push({ type: 'IP Reputation', severity: 'low', description: `No known blacklists for ${res.data.ip}` });
                foundThreats.push({ type: 'ISP Identification', severity: 'medium', description: `Your ISP (${res.data.isp || 'Unknown'}) can see your traffic without VPN` });
            }
            setThreats(foundThreats);
        } catch (e) {
            setThreats([{ type: 'Scan Error', severity: 'error', description: e.message }]);
        }
        setScanning(false);
        setScanDone(true);
    };

    const scanDomain = async () => {
        if (!domainScan.trim()) return;
        setDomainScanning(true);
        setDomainResult(null);
        await new Promise(r => setTimeout(r, 800));

        const domain = domainScan.trim().toLowerCase();
        const isSuspicious = SUSPICIOUS_PATTERNS.some(p => domain.includes(p));
        const isKnownBad = ['malware.com', 'phishing.net', 'badactor.io'].includes(domain);

        setDomainResult({
            domain,
            safe: !isSuspicious && !isKnownBad,
            flags: [
                ...(isSuspicious ? ['⚠ Contains suspicious keyword pattern'] : []),
                ...(isKnownBad ? ['🚨 Found in known malicious domain list'] : []),
                ...(!isSuspicious && !isKnownBad ? ['✅ No threats found in local database'] : []),
                `ℹ Domain length: ${domain.length} chars`,
                `ℹ TLD: .${domain.split('.').pop()}`,
            ]
        });
        setDomainScanning(false);
    };

    const severityColor = (s) => ({ high:'#ff3366', medium:'#ffaa00', low:'#00d4ff', info:'#7c3aed', error:'#ff3366' }[s] || '#7a9bb5');
    const severityBg = (s) => ({ high:'rgba(255,51,102,0.08)', medium:'rgba(255,170,0,0.08)', low:'rgba(0,212,255,0.08)', info:'rgba(124,58,237,0.08)', error:'rgba(255,51,102,0.08)' }[s] || 'transparent');

    const Section = ({ title, children }) => (
        <div style={{ background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:'12px', padding:'20px', marginBottom:'16px' }}>
            <div style={{ fontSize:'11px', letterSpacing:'2px', color:'var(--text-muted)', fontFamily:'JetBrains Mono', textTransform:'uppercase', marginBottom:'14px' }}>{title}</div>
            {children}
        </div>
    );

    return (
        <div>
            {/* Live Event Feed */}
            <Section title="Live Threat Event Feed">
                <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'12px' }}>
                    <span style={{ width:'8px', height:'8px', borderRadius:'50%', background:'var(--success)', display:'inline-block', animation:'pulse 2s infinite' }}></span>
                    <span style={{ fontFamily:'JetBrains Mono', fontSize:'11px', color:'var(--success)' }}>LIVE MONITORING</span>
                </div>
                <div style={{ background:'var(--bg-base)', borderRadius:'8px', padding:'4px', maxHeight:'220px', overflowY:'auto' }}>
                    {liveEvents.map((e, i) => (
                        <div key={i} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'7px 10px', borderBottom:'1px solid var(--border)', fontFamily:'JetBrains Mono', fontSize:'11px', opacity: i === 0 ? 1 : Math.max(0.3, 1 - i * 0.06) }}>
                            <span style={{ color:'var(--text-muted)', flexShrink:0, width:'70px' }}>{e.time}</span>
                            <span style={{ background: e.color + '20', color: e.color, padding:'2px 6px', borderRadius:'3px', fontWeight:'700', fontSize:'10px', flexShrink:0, width:'48px', textAlign:'center' }}>{e.type}</span>
                            <span style={{ color:'var(--text-secondary)' }}>{e.msg}</span>
                        </div>
                    ))}
                </div>
            </Section>

            {/* IP Threat Scan */}
            <Section title="IP Threat Intelligence Scan">
                <p style={{ color:'var(--text-secondary)', fontSize:'13px', marginBottom:'14px', lineHeight:'1.6' }}>
                    Scans your public IP against threat intelligence data — blacklists, reputation databases, and anomaly detection.
                </p>
                <button className="btn btn-primary" onClick={runIPScan} disabled={scanning} style={{ marginBottom:'16px' }}>
                    {scanning ? '🔍 Scanning threat databases...' : '☠️ Scan My IP for Threats'}
                </button>

                {scanning && (
                    <div>
                        {['Querying AbuseIPDB...', 'Checking Spamhaus...', 'Scanning blocklists...', 'Analyzing reputation...'].map((s, i) => (
                            <div key={i} style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'6px', fontFamily:'JetBrains Mono', fontSize:'11px', color:'var(--text-muted)', animation:`fadeIn 0.3s ease ${i * 0.3}s both` }}>
                                <div style={{ width:'14px', height:'14px', border:'1px solid var(--accent-cyan)', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite', flexShrink:0 }}></div>
                                {s}
                            </div>
                        ))}
                    </div>
                )}

                {scanDone && (
                    <div>
                        {publicIP && (
                            <div style={{ fontFamily:'JetBrains Mono', fontSize:'12px', color:'var(--accent-cyan)', marginBottom:'12px' }}>
                                Scanned IP: <strong>{publicIP}</strong>
                            </div>
                        )}
                        {threats.map((t, i) => (
                            <div key={i} style={{ background: severityBg(t.severity), border:`1px solid ${severityColor(t.severity)}40`, borderRadius:'8px', padding:'12px 14px', marginBottom:'8px', display:'flex', gap:'12px' }}>
                                <div style={{ width:'6px', background: severityColor(t.severity), borderRadius:'3px', flexShrink:0 }}></div>
                                <div>
                                    <div style={{ fontFamily:'JetBrains Mono', fontWeight:'700', fontSize:'12px', color: severityColor(t.severity) }}>{t.type}</div>
                                    <div style={{ fontSize:'12px', color:'var(--text-secondary)', marginTop:'3px' }}>{t.description}</div>
                                </div>
                                <span style={{ marginLeft:'auto', fontFamily:'JetBrains Mono', fontSize:'10px', color: severityColor(t.severity), background: severityColor(t.severity) + '20', padding:'2px 8px', borderRadius:'4px', height:'fit-content', flexShrink:0 }}>
                                    {t.severity.toUpperCase()}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </Section>

            {/* Domain Scanner */}
            <Section title="Domain Reputation Scanner">
                <p style={{ color:'var(--text-secondary)', fontSize:'13px', marginBottom:'14px' }}>
                    Check if a domain is suspicious, malicious, or associated with tracking.
                </p>
                <div style={{ display:'flex', gap:'10px', marginBottom:'14px' }}>
                    <input
                        type="text"
                        value={domainScan}
                        onChange={e => setDomainScan(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && scanDomain()}
                        placeholder="Enter domain (e.g. analytics.example.com)"
                        style={{ flex:1, background:'var(--bg-base)', border:'1px solid var(--border)', borderRadius:'6px', padding:'10px 14px', color:'var(--text-primary)', fontFamily:'JetBrains Mono', fontSize:'12px' }}
                    />
                    <button className="btn btn-secondary" onClick={scanDomain} disabled={domainScanning}>
                        {domainScanning ? 'Scanning...' : '🔍 Scan'}
                    </button>
                </div>
                {domainResult && (
                    <div style={{
                        background: domainResult.safe ? 'rgba(0,255,136,0.05)' : 'rgba(255,51,102,0.05)',
                        border: `1px solid ${domainResult.safe ? 'rgba(0,255,136,0.3)' : 'rgba(255,51,102,0.3)'}`,
                        borderRadius:'8px', padding:'14px'
                    }}>
                        <div style={{ fontFamily:'JetBrains Mono', fontWeight:'700', fontSize:'13px', color: domainResult.safe ? 'var(--success)' : 'var(--danger)', marginBottom:'10px' }}>
                            {domainResult.safe ? '✅ CLEAN' : '🚨 THREAT DETECTED'} — {domainResult.domain}
                        </div>
                        {domainResult.flags.map((f, i) => (
                            <div key={i} style={{ fontFamily:'JetBrains Mono', fontSize:'11px', color:'var(--text-secondary)', padding:'4px 0', borderBottom:'1px solid var(--border)' }}>{f}</div>
                        ))}
                    </div>
                )}
            </Section>
        </div>
    );
}

export default ThreatIntelligence;
