import React, { useState } from 'react';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'https://nexvpn.onrender.com/api';

/* ── Real WebRTC IP detection using ICE candidates ── */
function detectWebRTCIPs() {
    return new Promise((resolve) => {
        const localIPs  = [];
        const publicIPs = [];
        const seen = new Set();

        if (!window.RTCPeerConnection) {
            resolve({ localIPs, publicIPs, error: 'WebRTC not supported in this browser.' });
            return;
        }

        const isPrivate = (ip) =>
            ip === '127.0.0.1'       ||
            ip.startsWith('10.')     ||
            ip.startsWith('192.168.')||
            ip.startsWith('169.254.')||
            /^172\.(1[6-9]|2\d|3[01])\./.test(ip);

        let pc;
        try {
            pc = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun.cloudflare.com:3478' },
                ],
                iceCandidatePoolSize: 4,
            });
        } catch (e) {
            resolve({ localIPs, publicIPs, error: 'RTCPeerConnection failed: ' + e.message });
            return;
        }

        try { pc.createDataChannel('nexvpn-leak'); } catch (_) {}

        pc.onicecandidate = (evt) => {
            if (!evt.candidate) return;
            const sdp = evt.candidate.candidate || '';

            // IPv4
            const v4 = sdp.match(/\b(\d{1,3}\.){3}\d{1,3}\b/g) || [];
            v4.forEach(ip => {
                if (seen.has(ip)) return;
                seen.add(ip);
                (isPrivate(ip) ? localIPs : publicIPs).push(ip);
            });

            // IPv6 (link-local fe80:: goes to local, others to public)
            const v6 = sdp.match(/([0-9a-fA-F]{1,4}:){2,7}[0-9a-fA-F]{0,4}/g) || [];
            v6.forEach(ip => {
                const norm = ip.toLowerCase();
                if (seen.has(norm) || norm === '::1') return;
                seen.add(norm);
                if (norm.startsWith('fe80')) localIPs.push(ip + ' (link-local)');
                else publicIPs.push(ip);
            });
        };

        pc.createOffer()
            .then(o => pc.setLocalDescription(o))
            .catch(err => { pc.close(); resolve({ localIPs, publicIPs, error: err.message }); });

        // Give it 6 seconds to collect candidates
        setTimeout(() => { try { pc.close(); } catch (_) {} resolve({ localIPs, publicIPs, error: null }); }, 6000);
    });
}

/* ── Small UI helpers ───────────────────────────────── */
function Card({ ok, icon, headline, children }) {
    return (
        <div style={{
            background: ok === true  ? 'rgba(0,255,136,0.07)'  :
                        ok === false ? 'rgba(255,51,102,0.07)' : 'var(--bg-elevated)',
            border: `1px solid ${ok === true  ? 'rgba(0,255,136,0.3)'  :
                                  ok === false ? 'rgba(255,51,102,0.3)' : 'var(--border)'}`,
            borderRadius: '12px', padding: '22px', marginBottom: '16px',
        }}>
            <div style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                fontFamily: 'JetBrains Mono', fontWeight: '700', fontSize: '14px',
                color: ok === true ? 'var(--success)' : ok === false ? 'var(--danger)' : 'var(--text-primary)',
                marginBottom: '16px',
            }}>
                <span style={{ fontSize: '20px' }}>{icon}</span>
                {headline}
            </div>
            {children}
        </div>
    );
}

function IPRow({ ip, kind }) {
    const s = {
        local:  { bg: 'rgba(255,170,0,0.08)',  bd: 'rgba(255,170,0,0.3)',  c: '#ffaa00', tag: 'private — normal' },
        public: { bg: 'rgba(255,51,102,0.08)', bd: 'rgba(255,51,102,0.3)', c: 'var(--danger)', tag: '⚠ LEAKED' },
        safe:   { bg: 'rgba(0,255,136,0.07)',  bd: 'rgba(0,255,136,0.25)', c: 'var(--success)', tag: '✓ protected' },
    }[kind];
    return (
        <div style={{
            fontFamily: 'JetBrains Mono', fontSize: '12px', color: s.c,
            background: s.bg, border: `1px solid ${s.bd}`,
            borderRadius: '5px', padding: '6px 12px', marginBottom: '5px',
            display: 'flex', justifyContent: 'space-between',
        }}>
            <span>{ip}</span>
            <span style={{ fontSize: '10px', opacity: 0.75 }}>{s.tag}</span>
        </div>
    );
}

/* ── Main component ─────────────────────────────────── */
export default function WebRTCLeakDetector() {
    const [wrtcState, setWrtcState] = useState('idle'); // idle | running | done
    const [wrtcData,  setWrtcData]  = useState(null);
    const [dnsState,  setDnsState]  = useState('idle');
    const [dnsData,   setDnsData]   = useState(null);

    const runWebRTC = async () => {
        setWrtcState('running');
        setWrtcData(null);
        const result = await detectWebRTCIPs();
        setWrtcData(result);
        setWrtcState('done');
    };

    const runDNS = async () => {
        setDnsState('running');
        setDnsData(null);
        try {
            const res = await axios.get(`${API_BASE}/network/dns-leak-test`, { timeout: 20000 });
            setDnsData(res.data.results || []);
        } catch (e) {
            setDnsData([{ domain: 'Backend error — is the server running?', resolved: false, latency: 0, note: e.message }]);
        }
        setDnsState('done');
    };

    const hasLeak   = wrtcData && wrtcData.publicIPs.length > 0;
    const dnsAllOk  = dnsData  && dnsData.every(r => r.resolved);

    return (
        <div>

            {/* ── WebRTC Section ──────────────────────────────── */}
            <div style={{ background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:'12px', padding:'22px', marginBottom:'16px' }}>
                <div style={{ fontSize:'11px', letterSpacing:'2px', color:'var(--text-muted)', fontFamily:'JetBrains Mono', textTransform:'uppercase', marginBottom:'14px' }}>
                    WebRTC IP Leak Test
                </div>

                <p style={{ color:'var(--text-secondary)', fontSize:'13px', lineHeight:'1.7', marginBottom:'10px' }}>
                    Browsers can expose your <strong style={{color:'var(--text-primary)'}}>real IP</strong> via WebRTC 
                    even through a VPN. This test probes ICE candidates gathered by your browser.
                </p>
                <p style={{ color:'var(--text-muted)', fontFamily:'JetBrains Mono', fontSize:'11px', lineHeight:'1.6', marginBottom:'16px' }}>
                    ℹ Private IPs (192.168.x, 10.x) are your router/LAN — totally normal, not a leak.
                    Only <em>public</em> IPs appearing here indicate a real WebRTC leak.
                </p>

                <button className="btn btn-primary" onClick={runWebRTC}
                    disabled={wrtcState === 'running'} style={{ marginBottom:'16px' }}>
                    {wrtcState === 'running' ? '🔍 Scanning ICE candidates (6s)...' : '▶ Run WebRTC Leak Test'}
                </button>

                {wrtcState === 'running' && (
                    <div style={{ display:'flex', gap:'12px', alignItems:'center', fontFamily:'JetBrains Mono', fontSize:'12px', color:'var(--text-muted)', marginBottom:'12px' }}>
                        <div className="spinner" style={{ width:'18px', height:'18px', borderWidth:'2px' }} />
                        Collecting STUN ICE candidates from 3 servers...
                    </div>
                )}

                {wrtcState === 'done' && wrtcData && (
                    <>
                        {wrtcData.error ? (
                            <div style={{ color:'var(--warning)', fontFamily:'JetBrains Mono', fontSize:'12px', background:'rgba(255,170,0,0.08)', border:'1px solid rgba(255,170,0,0.3)', borderRadius:'6px', padding:'10px 14px', marginBottom:'14px' }}>
                                ⚠ {wrtcData.error}
                            </div>
                        ) : (
                            <Card ok={!hasLeak} icon={hasLeak ? '🚨' : '✅'}
                                headline={hasLeak
                                    ? `WebRTC LEAK — ${wrtcData.publicIPs.length} public IP(s) exposed to websites`
                                    : 'No WebRTC Leak — your real IP is protected'}>

                                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
                                    <div>
                                        <div style={{ fontFamily:'JetBrains Mono', fontSize:'10px', color:'var(--text-muted)', letterSpacing:'1px', textTransform:'uppercase', marginBottom:'8px' }}>
                                            Private / LAN IPs &nbsp;
                                            <span style={{ color:'#ffaa00', fontSize:'9px' }}>(not a leak)</span>
                                        </div>
                                        {wrtcData.localIPs.length > 0
                                            ? wrtcData.localIPs.map((ip, i) => <IPRow key={i} ip={ip} kind="local" />)
                                            : <div style={{ color:'var(--text-muted)', fontFamily:'JetBrains Mono', fontSize:'12px' }}>None detected</div>
                                        }
                                    </div>
                                    <div>
                                        <div style={{ fontFamily:'JetBrains Mono', fontSize:'10px', color:'var(--text-muted)', letterSpacing:'1px', textTransform:'uppercase', marginBottom:'8px' }}>
                                            Public IPs &nbsp;
                                            <span style={{ color: hasLeak ? 'var(--danger)' : 'var(--success)', fontSize:'9px' }}>
                                                {hasLeak ? '← LEAKED' : '← none = safe'}
                                            </span>
                                        </div>
                                        {wrtcData.publicIPs.length > 0
                                            ? wrtcData.publicIPs.map((ip, i) => <IPRow key={i} ip={ip} kind="public" />)
                                            : <IPRow ip="No public IPs exposed" kind="safe" />
                                        }
                                    </div>
                                </div>

                                <div style={{ marginTop:'14px', background:'var(--bg-base)', borderRadius:'6px', padding:'12px 14px', fontFamily:'JetBrains Mono', fontSize:'11px', color:'var(--text-muted)', lineHeight:'1.8' }}>
                                    {hasLeak
                                        ? <>💡 <strong style={{color:'var(--text-secondary)'}}>Fix:</strong> In Firefox → <code>about:config</code> → set <code>media.peerconnection.enabled = false</code>. In Chrome → install the "WebRTC Leak Prevent" extension.</>
                                        : '✓ Your browser is not leaking your real IP via WebRTC. Websites only see your VPN exit IP.'}
                                </div>
                            </Card>
                        )}
                    </>
                )}
            </div>

            {/* ── DNS Section ─────────────────────────────────── */}
            <div style={{ background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:'12px', padding:'22px' }}>
                <div style={{ fontSize:'11px', letterSpacing:'2px', color:'var(--text-muted)', fontFamily:'JetBrains Mono', textTransform:'uppercase', marginBottom:'14px' }}>
                    DNS Leak Test
                </div>

                <p style={{ color:'var(--text-secondary)', fontSize:'13px', lineHeight:'1.7', marginBottom:'16px' }}>
                    Tests whether DNS queries leak to your ISP. All domains should resolve — 
                    failures here may indicate DNS is going outside the VPN tunnel.
                </p>

                <button className="btn btn-primary" onClick={runDNS}
                    disabled={dnsState === 'running'} style={{ marginBottom:'16px' }}>
                    {dnsState === 'running' ? '🔍 Testing DNS...' : '▶ Run DNS Leak Test'}
                </button>

                {dnsState === 'running' && (
                    <div style={{ display:'flex', gap:'12px', alignItems:'center', fontFamily:'JetBrains Mono', fontSize:'12px', color:'var(--text-muted)' }}>
                        <div className="spinner" style={{ width:'18px', height:'18px', borderWidth:'2px' }} />
                        Resolving 4 test domains via your current DNS...
                    </div>
                )}

                {dnsState === 'done' && dnsData && (
                    <>
                        <div style={{
                            background: dnsAllOk ? 'rgba(0,255,136,0.08)' : 'rgba(255,170,0,0.08)',
                            border: `1px solid ${dnsAllOk ? 'rgba(0,255,136,0.35)' : 'rgba(255,170,0,0.35)'}`,
                            borderRadius: '8px', padding:'12px 16px', marginBottom:'12px',
                            fontFamily:'JetBrains Mono', fontWeight:'700', fontSize:'13px',
                            color: dnsAllOk ? 'var(--success)' : 'var(--warning)',
                            display:'flex', alignItems:'center', gap:'8px',
                        }}>
                            <span>{dnsAllOk ? '✅' : '⚠'}</span>
                            {dnsAllOk ? 'No DNS Leak — all domains resolved correctly' : 'Some DNS queries failed — check your DNS configuration'}
                        </div>

                        {dnsData.map((r, i) => (
                            <div key={i} style={{
                                display:'flex', alignItems:'center', gap:'12px',
                                padding:'10px 14px', marginBottom:'6px', borderRadius:'6px',
                                background: r.resolved ? 'rgba(0,255,136,0.04)' : 'rgba(255,51,102,0.04)',
                                border: `1px solid ${r.resolved ? 'rgba(0,255,136,0.15)' : 'rgba(255,51,102,0.2)'}`,
                                fontFamily:'JetBrains Mono', fontSize:'12px',
                            }}>
                                <span style={{ fontSize:'15px' }}>{r.resolved ? '✅' : '❌'}</span>
                                <span style={{ flex:1, color:'var(--text-primary)' }}>{r.domain}</span>
                                {r.addresses && (
                                    <span style={{ color:'var(--accent-cyan)', fontSize:'11px' }}>
                                        {r.addresses.slice(0,2).join(', ')}
                                    </span>
                                )}
                                <span style={{ color:'var(--text-muted)', fontSize:'11px', flexShrink:0 }}>
                                    {r.latency}ms
                                </span>
                            </div>
                        ))}

                        {!dnsAllOk && (
                            <div style={{ marginTop:'12px', background:'var(--bg-base)', borderRadius:'6px', padding:'12px 14px', fontFamily:'JetBrains Mono', fontSize:'11px', color:'var(--text-muted)', lineHeight:'1.8' }}>
                                💡 DNS failures can occur when the backend server cannot reach external DNS. Make sure your backend server has internet access.
                            </div>
                        )}
                    </>
                )}

                {dnsState === 'idle' && (
                    <div style={{ color:'var(--text-muted)', fontFamily:'JetBrains Mono', fontSize:'12px', padding:'10px 0' }}>
                        Click "Run DNS Leak Test" to check your DNS configuration
                    </div>
                )}
            </div>
        </div>
    );
}
