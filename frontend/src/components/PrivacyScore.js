import React, { useState, useEffect, useRef } from 'react';

const RISKS = [
    { id: 'vpn', label: 'VPN Connected', weight: 30, check: ({isConnected}) => isConnected, tip: 'Connect to a VPN server to encrypt your traffic' },
    { id: 'protocol', label: 'Strong Protocol', weight: 15, check: ({selectedProtocol}) => selectedProtocol && ['wireguard','ikev2','openvpn'].includes(selectedProtocol.id), tip: 'Select WireGuard or IKEv2 for best security' },
    { id: 'killswitch', label: 'Kill Switch Active', weight: 20, check: ({securitySettings}) => securitySettings?.killSwitch, tip: 'Enable Kill Switch to prevent leaks on disconnect' },
    { id: 'dns', label: 'DNS Protection', weight: 20, check: ({securitySettings}) => securitySettings?.dnsProtection, tip: 'Enable DNS protection to stop ISP snooping' },
    { id: 'server', label: 'Server Selected', weight: 10, check: ({selectedServer}) => !!selectedServer, tip: 'Select a VPN server to route your traffic' },
    { id: 'proto_strong', label: 'High Security Protocol', weight: 5, check: ({selectedProtocol}) => selectedProtocol?.security === 'High', tip: 'Use a high-security protocol like WireGuard' },
];

function AnimatedScore({ target, prev }) {
    const [display, setDisplay] = useState(prev);
    useEffect(() => {
        const diff = target - display;
        if (diff === 0) return;
        const step = diff > 0 ? 1 : -1;
        const t = setTimeout(() => setDisplay(d => d + step), 16);
        return () => clearTimeout(t);
    }, [display, target]);
    return <>{display}</>;
}

function PrivacyScore({ isConnected, selectedServer, selectedProtocol, securitySettings, onNavigate }) {
    const canvasRef = useRef(null);
    const [score, setScore] = useState(0);
    const [prevScore, setPrevScore] = useState(0);
    const [checks, setChecks] = useState([]);
    const animRef = useRef(null);

    const ctx = { isConnected, selectedServer, selectedProtocol, securitySettings };

    useEffect(() => {
        const passed = RISKS.filter(r => r.check(ctx));
        const newScore = passed.reduce((s, r) => s + r.weight, 0);
        setPrevScore(score);
        setScore(newScore);
        setChecks(RISKS.map(r => ({ ...r, passed: r.check(ctx) })));
    }, [isConnected, selectedServer, selectedProtocol, securitySettings]);

    // Animate canvas ring
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx2d = canvas.getContext('2d');
        const size = canvas.width;
        const cx = size / 2, cy = size / 2, r = size * 0.38;
        let start = Date.now();
        const target = score / 100;

        const getColor = (s) => {
            if (s < 0.4) return '#ff3366';
            if (s < 0.7) return '#ffaa00';
            return '#00ff88';
        };

        const draw = () => {
            const elapsed = (Date.now() - start) / 1000;
            const progress = Math.min(1, elapsed * 1.5);
            const current = target * progress;

            ctx2d.clearRect(0, 0, size, size);

            // Track ring
            ctx2d.beginPath();
            ctx2d.arc(cx, cy, r, 0, Math.PI * 2);
            ctx2d.strokeStyle = 'rgba(26,48,80,0.8)';
            ctx2d.lineWidth = 10;
            ctx2d.stroke();

            // Score segments
            const color = getColor(current);
            ctx2d.beginPath();
            ctx2d.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * current);
            ctx2d.strokeStyle = color;
            ctx2d.lineWidth = 10;
            ctx2d.lineCap = 'round';
            ctx2d.shadowColor = color;
            ctx2d.shadowBlur = 15;
            ctx2d.stroke();
            ctx2d.shadowBlur = 0;

            // Tick marks
            for (let i = 0; i < 10; i++) {
                const angle = (i / 10) * Math.PI * 2 - Math.PI / 2;
                const x1 = cx + (r - 16) * Math.cos(angle);
                const y1 = cy + (r - 16) * Math.sin(angle);
                const x2 = cx + (r - 22) * Math.cos(angle);
                const y2 = cy + (r - 22) * Math.sin(angle);
                ctx2d.beginPath();
                ctx2d.moveTo(x1, y1);
                ctx2d.lineTo(x2, y2);
                ctx2d.strokeStyle = i / 10 <= current ? color : 'rgba(26,48,80,0.6)';
                ctx2d.lineWidth = 2;
                ctx2d.stroke();
            }

            if (progress < 1) animRef.current = requestAnimationFrame(draw);
        };

        if (animRef.current) cancelAnimationFrame(animRef.current);
        start = Date.now();
        animRef.current = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(animRef.current);
    }, [score]);

    const getLabel = (s) => s >= 85 ? 'FORTIFIED' : s >= 65 ? 'PROTECTED' : s >= 40 ? 'MODERATE' : s >= 20 ? 'AT RISK' : 'EXPOSED';
    const getLabelColor = (s) => s >= 85 ? '#00ff88' : s >= 65 ? '#00d4ff' : s >= 40 ? '#ffaa00' : '#ff3366';

    return (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px' }}>
            {/* Score Panel */}
            <div style={{ background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:'12px', padding:'28px', display:'flex', flexDirection:'column', alignItems:'center', gap:'16px' }}>
                <div style={{ fontSize:'11px', letterSpacing:'2px', color:'var(--text-muted)', fontFamily:'JetBrains Mono', textTransform:'uppercase' }}>Privacy Score</div>
                <div style={{ position:'relative', width:'180px', height:'180px' }}>
                    <canvas ref={canvasRef} width={180} height={180} style={{ position:'absolute', top:0, left:0 }} />
                    <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', textAlign:'center' }}>
                        <div style={{ fontSize:'42px', fontWeight:'800', fontFamily:'JetBrains Mono', color: getLabelColor(score), lineHeight:1 }}>
                            <AnimatedScore target={score} prev={prevScore} />
                        </div>
                        <div style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'2px', fontFamily:'JetBrains Mono' }}>/100</div>
                    </div>
                </div>
                <div style={{ fontFamily:'JetBrains Mono', fontWeight:'700', fontSize:'16px', letterSpacing:'3px', color: getLabelColor(score) }}>
                    {getLabel(score)}
                </div>
                <div style={{ width:'100%', background:'var(--bg-base)', borderRadius:'8px', padding:'12px', fontFamily:'JetBrains Mono', fontSize:'11px', color:'var(--text-secondary)', lineHeight:'1.6' }}>
                    {score >= 85 && '✓ Your connection is fully fortified. Excellent privacy posture.'}
                    {score >= 65 && score < 85 && '⚡ Good protection, but a few improvements could maximize privacy.'}
                    {score >= 40 && score < 65 && '⚠ Moderate risk. Key protections are missing.'}
                    {score < 40 && '✕ Critical vulnerabilities detected. Enable VPN and protections now.'}
                </div>
            </div>

            {/* Checks Panel */}
            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                <div style={{ fontSize:'11px', letterSpacing:'2px', color:'var(--text-muted)', fontFamily:'JetBrains Mono', textTransform:'uppercase', marginBottom:'4px' }}>Security Checklist</div>
                {checks.map(c => (
                    <div key={c.id} style={{
                        background: c.passed ? 'rgba(0,255,136,0.05)' : 'rgba(255,51,102,0.05)',
                        border: `1px solid ${c.passed ? 'rgba(0,255,136,0.2)' : 'rgba(255,51,102,0.2)'}`,
                        borderRadius:'8px', padding:'12px 14px',
                        display:'flex', alignItems:'center', gap:'12px',
                        transition:'all 0.3s ease'
                    }}>
                        <span style={{ fontSize:'16px', flexShrink:0 }}>{c.passed ? '✅' : '❌'}</span>
                        <div style={{ flex:1 }}>
                            <div style={{ fontFamily:'JetBrains Mono', fontSize:'12px', fontWeight:'600', color: c.passed ? 'var(--success)' : 'var(--text-secondary)' }}>{c.label}</div>
                            {!c.passed && <div style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'2px' }}>{c.tip}</div>}
                        </div>
                        <span style={{ fontFamily:'JetBrains Mono', fontSize:'10px', color:'var(--text-muted)', flexShrink:0 }}>+{c.weight}</span>
                    </div>
                ))}
            </div>

            {/* Quick Actions */}
            <div style={{ gridColumn:'1/-1', background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:'12px', padding:'20px' }}>
                <div style={{ fontSize:'11px', letterSpacing:'2px', color:'var(--text-muted)', fontFamily:'JetBrains Mono', marginBottom:'14px', textTransform:'uppercase' }}>Quick Actions</div>
                <div style={{ display:'flex', gap:'10px', flexWrap:'wrap' }}>
                    {[
                        { label:'🌐 Connect to Best Server', action: () => onNavigate('server'), active: !selectedServer },
                        { label:'🔒 Choose Protocol', action: () => onNavigate('protocol'), active: !selectedProtocol },
                        { label:'🛡️ Enable Security', action: () => onNavigate('security'), active: !securitySettings?.killSwitch },
                        { label:'☠️ Check for Threats', action: () => onNavigate('threat'), active: true },
                        { label:'🔍 Run Leak Test', action: () => onNavigate('webrtc'), active: true },
                        { label:'⚡ Speed Test', action: () => onNavigate('speed'), active: true },
                    ].map((a, i) => (
                        <button key={i} className="btn btn-secondary btn-sm" onClick={a.action} style={{ fontSize:'12px' }}>
                            {a.label}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default PrivacyScore;
