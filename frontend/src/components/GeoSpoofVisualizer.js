import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'https://nexvpn.onrender.com/api';

function latLonToXY(lat, lon, w, h) {
    const x = (lon + 180) / 360 * w;
    const y = (90 - lat) / 180 * h;
    return { x, y };
}

const SERVER_COORDS = {
    'us-east':   { lat: 40.71,  lon: -74.01,  city: 'New York',    flag: '🇺🇸' },
    'us-west':   { lat: 34.05,  lon: -118.24, city: 'Los Angeles', flag: '🇺🇸' },
    'uk':        { lat: 51.51,  lon: -0.13,   city: 'London',      flag: '🇬🇧' },
    'germany':   { lat: 50.11,  lon: 8.68,    city: 'Frankfurt',   flag: '🇩🇪' },
    'japan':     { lat: 35.69,  lon: 139.69,  city: 'Tokyo',       flag: '🇯🇵' },
    'singapore': { lat: 1.35,   lon: 103.82,  city: 'Singapore',   flag: '🇸🇬' },
    'canada':    { lat: 43.65,  lon: -79.38,  city: 'Toronto',     flag: '🇨🇦' },
    'australia': { lat: -33.87, lon: 151.21,  city: 'Sydney',      flag: '🇦🇺' },
};

// Rough continent polygon points for a nicer map
const CONTINENTS = [
    // North America
    { lat:70,lon:-140 },{ lat:60,lon:-130 },{ lat:55,lon:-120 },{ lat:50,lon:-125 },
    { lat:48,lon:-85 },{ lat:45,lon:-75 },{ lat:30,lon:-100 },{ lat:25,lon:-105 },
    { lat:20,lon:-90 },{ lat:15,lon:-90 },{ lat:10,lon:-85 },{ lat:8,lon:-77 },
    { lat:22,lon:-110 },{ lat:30,lon:-115 },{ lat:32,lon:-117 },
    // Europe
    { lat:71,lon:25 },{ lat:60,lon:10 },{ lat:58,lon:5 },{ lat:51,lon:3 },
    { lat:48,lon:-5 },{ lat:36,lon:-9 },{ lat:36,lon:36 },{ lat:41,lon:29 },
    { lat:45,lon:15 },{ lat:47,lon:8 },{ lat:54,lon:18 },{ lat:60,lon:25 },
    // Africa
    { lat:37,lon:10 },{ lat:15,lon:38 },{ lat:10,lon:42 },{ lat:0,lon:42 },
    { lat:-10,lon:40 },{ lat:-34,lon:18 },{ lat:-22,lon:14 },{ lat:5,lon:2 },
    { lat:15,lon:-17 },{ lat:20,lon:-17 },{ lat:30,lon:-10 },
    // Asia
    { lat:70,lon:140 },{ lat:60,lon:150 },{ lat:50,lon:140 },{ lat:45,lon:135 },
    { lat:35,lon:120 },{ lat:25,lon:120 },{ lat:20,lon:110 },{ lat:10,lon:100 },
    { lat:5,lon:100 },{ lat:20,lon:80 },{ lat:30,lon:75 },{ lat:35,lon:70 },
    { lat:40,lon:55 },{ lat:45,lon:60 },{ lat:55,lon:70 },{ lat:65,lon:80 },
    // South America
    { lat:10,lon:-75 },{ lat:5,lon:-77 },{ lat:-5,lon:-80 },{ lat:-15,lon:-75 },
    { lat:-25,lon:-70 },{ lat:-35,lon:-60 },{ lat:-55,lon:-67 },{ lat:-40,lon:-62 },
    { lat:-30,lon:-50 },{ lat:-15,lon:-40 },{ lat:5,lon:-52 },
    // Australia
    { lat:-15,lon:130 },{ lat:-20,lon:120 },{ lat:-30,lon:115 },{ lat:-35,lon:117 },
    { lat:-38,lon:145 },{ lat:-28,lon:153 },{ lat:-15,lon:145 },{ lat:-12,lon:136 },
];

function GeoSpoofVisualizer({ selectedServer, isConnected }) {
    const canvasRef = useRef(null);
    const [realLocation, setRealLocation] = useState(null);
    const [loading, setLoading] = useState(true);
    const [locationError, setLocationError] = useState(false);
    const animRef = useRef(null);
    const phaseRef = useRef(0);

    useEffect(() => {
        // Fetch real location — try backend first, then direct ipapi.co fallback
        const fetchLocation = async () => {
            setLoading(true);
            try {
                const res = await axios.get(`${API_BASE}/network/public-ip`, { timeout: 8000 });
                const d = res.data;
                // Backend might return strings, parse to float
                const lat = parseFloat(d.latitude);
                const lon = parseFloat(d.longitude);
                if (!isNaN(lat) && !isNaN(lon)) {
                    setRealLocation({ ...d, latitude: lat, longitude: lon });
                    setLocationError(false);
                } else {
                    throw new Error('No coordinates from backend');
                }
            } catch (e) {
                // Fallback: call ipapi.co directly from browser
                try {
                    const r2 = await axios.get('https://ipapi.co/json/', { timeout: 6000 });
                    const d2 = r2.data;
                    const lat = parseFloat(d2.latitude);
                    const lon = parseFloat(d2.longitude);
                    if (!isNaN(lat) && !isNaN(lon)) {
                        setRealLocation({
                            ip: d2.ip,
                            city: d2.city || 'Unknown',
                            country: d2.country_name || 'Unknown',
                            isp: d2.org || 'Unknown',
                            latitude: lat,
                            longitude: lon,
                        });
                        setLocationError(false);
                    } else {
                        throw new Error('No coords');
                    }
                } catch (e2) {
                    // Last resort: use a default location (India, since user is in Coimbatore)
                    setRealLocation({
                        ip: 'detecting...',
                        city: 'Coimbatore',
                        country: 'India',
                        isp: 'Local ISP',
                        latitude: 11.0168,
                        longitude: 76.9558,
                    });
                    setLocationError(true);
                }
            }
            setLoading(false);
        };
        fetchLocation();
    }, []);

    // Canvas animation loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const W = canvas.width;
        const H = canvas.height;

        const draw = () => {
            phaseRef.current += 0.018;
            const phase = phaseRef.current;

            ctx.clearRect(0, 0, W, H);

            // Deep space background
            ctx.fillStyle = '#020408';
            ctx.fillRect(0, 0, W, H);

            // Stars
            if (phaseRef.current < 0.02) {
                // Generate star positions once conceptually — draw them every frame
            }
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            // Simple star grid based on pseudo-random positions
            for (let i = 0; i < 60; i++) {
                const sx = ((i * 137.5) % W);
                const sy = ((i * 97.3) % H);
                ctx.fillRect(sx, sy, 1, 1);
            }

            // Grid lines
            ctx.strokeStyle = 'rgba(0,212,255,0.06)';
            ctx.lineWidth = 0.5;
            for (let lon2 = -180; lon2 <= 180; lon2 += 30) {
                const { x } = latLonToXY(0, lon2, W, H);
                ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
            }
            for (let lat2 = -90; lat2 <= 90; lat2 += 30) {
                const { y } = latLonToXY(lat2, 0, W, H);
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
            }

            // Draw continent blobs as large overlapping circles
            ctx.fillStyle = 'rgba(10,30,60,0.9)';
            CONTINENTS.forEach(({ lat, lon }) => {
                const { x, y } = latLonToXY(lat, lon, W, H);
                ctx.beginPath();
                ctx.arc(x, y, 22, 0, Math.PI * 2);
                ctx.fill();
            });

            // Continent outlines glow
            ctx.strokeStyle = 'rgba(0,80,160,0.4)';
            ctx.lineWidth = 1;
            CONTINENTS.forEach(({ lat, lon }) => {
                const { x, y } = latLonToXY(lat, lon, W, H);
                ctx.beginPath();
                ctx.arc(x, y, 22, 0, Math.PI * 2);
                ctx.stroke();
            });

            // Draw all server nodes
            Object.entries(SERVER_COORDS).forEach(([id, coords]) => {
                const { x, y } = latLonToXY(coords.lat, coords.lon, W, H);
                const isSelected = selectedServer?.id === id;
                const pulse = Math.sin(phase * 2 + Object.keys(SERVER_COORDS).indexOf(id) * 0.8) * 0.5 + 0.5;

                if (isSelected) {
                    // Outer pulse rings
                    for (let ring = 0; ring < 3; ring++) {
                        const ringPhase = (phase * 1.5 + ring * 0.5) % 1;
                        ctx.beginPath();
                        ctx.arc(x, y, 8 + ringPhase * 25, 0, Math.PI * 2);
                        ctx.strokeStyle = `rgba(0,255,136,${(1 - ringPhase) * 0.4})`;
                        ctx.lineWidth = 1.5;
                        ctx.stroke();
                    }
                    // Core dot
                    ctx.beginPath();
                    ctx.arc(x, y, 7, 0, Math.PI * 2);
                    ctx.fillStyle = '#00ff88';
                    ctx.shadowColor = '#00ff88';
                    ctx.shadowBlur = 20;
                    ctx.fill();
                    ctx.shadowBlur = 0;
                    // City label
                    ctx.fillStyle = '#00ff88';
                    ctx.font = 'bold 11px monospace';
                    ctx.textAlign = 'center';
                    ctx.fillText(`${coords.flag} ${coords.city}`, x, y - 16);
                } else {
                    // Idle node
                    ctx.beginPath();
                    ctx.arc(x, y, 4 + pulse * 1, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(0,100,200,${0.5 + pulse * 0.3})`;
                    ctx.shadowColor = '#004488';
                    ctx.shadowBlur = 5;
                    ctx.fill();
                    ctx.shadowBlur = 0;
                }
            });

            // Draw real location (YOU dot)
            if (realLocation?.latitude) {
                const { x, y } = latLonToXY(realLocation.latitude, realLocation.longitude, W, H);
                const rpulse = Math.sin(phase * 1.8) * 0.5 + 0.5;

                // Ripple rings
                for (let ring = 0; ring < 2; ring++) {
                    const ringPhase = (phase * 1.2 + ring * 0.6) % 1;
                    ctx.beginPath();
                    ctx.arc(x, y, 6 + ringPhase * 20, 0, Math.PI * 2);
                    ctx.strokeStyle = `rgba(255,51,102,${(1 - ringPhase) * 0.5})`;
                    ctx.lineWidth = 1.5;
                    ctx.stroke();
                }

                // Core dot
                ctx.beginPath();
                ctx.arc(x, y, 6, 0, Math.PI * 2);
                ctx.fillStyle = '#ff3366';
                ctx.shadowColor = '#ff3366';
                ctx.shadowBlur = 15;
                ctx.fill();
                ctx.shadowBlur = 0;

                // YOU label
                ctx.fillStyle = '#ff3366';
                ctx.font = 'bold 11px monospace';
                ctx.textAlign = 'center';
                ctx.fillText('📍 YOU', x, y - 14);
            }

            // Animated tunnel line from YOU → selected server
            if (selectedServer && realLocation?.latitude) {
                const serverCoords = SERVER_COORDS[selectedServer.id];
                if (serverCoords) {
                    const from = latLonToXY(realLocation.latitude, realLocation.longitude, W, H);
                    const to = latLonToXY(serverCoords.lat, serverCoords.lon, W, H);

                    // Control point for arc (above midpoint)
                    const midX = (from.x + to.x) / 2;
                    const midY = Math.min(from.y, to.y) - 50;

                    const lineColor = isConnected ? '#00ff88' : '#ffaa00';
                    const dashOffset = phase * 12;

                    ctx.beginPath();
                    ctx.moveTo(from.x, from.y);
                    ctx.quadraticCurveTo(midX, midY, to.x, to.y);
                    ctx.strokeStyle = lineColor;
                    ctx.lineWidth = 2.5;
                    ctx.setLineDash([10, 6]);
                    ctx.lineDashOffset = -dashOffset;
                    ctx.shadowColor = lineColor;
                    ctx.shadowBlur = 12;
                    ctx.stroke();
                    ctx.setLineDash([]);
                    ctx.shadowBlur = 0;

                    // Animated data packet along the line
                    const t = (Math.sin(phase * 0.8) * 0.5 + 0.5);
                    const px = from.x + (midX - from.x) * t * 2 > midX
                        ? midX + (to.x - midX) * (t * 2 - 1)
                        : from.x + (midX - from.x) * t * 2;
                    const py = from.y + (midY - from.y) * t * 2 > midY
                        ? midY + (to.y - midY) * (t * 2 - 1)
                        : from.y + (midY - from.y) * t * 2;

                    // Simple bezier point calculation
                    const bt = t;
                    const bx = (1 - bt) * (1 - bt) * from.x + 2 * (1 - bt) * bt * midX + bt * bt * to.x;
                    const by = (1 - bt) * (1 - bt) * from.y + 2 * (1 - bt) * bt * midY + bt * bt * to.y;

                    ctx.beginPath();
                    ctx.arc(bx, by, 4, 0, Math.PI * 2);
                    ctx.fillStyle = lineColor;
                    ctx.shadowColor = lineColor;
                    ctx.shadowBlur = 10;
                    ctx.fill();
                    ctx.shadowBlur = 0;
                }
            }

            animRef.current = requestAnimationFrame(draw);
        };

        if (animRef.current) cancelAnimationFrame(animRef.current);
        animRef.current = requestAnimationFrame(draw);
        return () => {
            if (animRef.current) cancelAnimationFrame(animRef.current);
        };
    }, [selectedServer, isConnected, realLocation]);

    return (
        <div>
            <div style={{ background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:'12px', padding:'20px', marginBottom:'16px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
                    <div style={{ fontSize:'11px', letterSpacing:'2px', color:'var(--text-muted)', fontFamily:'JetBrains Mono', textTransform:'uppercase' }}>
                        Live GeoSpoof Tunnel Visualizer
                    </div>
                    {loading && (
                        <span style={{ fontFamily:'JetBrains Mono', fontSize:'11px', color:'var(--text-muted)' }}>
                            <span className="spinner" style={{ width:'14px', height:'14px', display:'inline-block', borderWidth:'2px', verticalAlign:'middle', marginRight:'6px' }}></span>
                            Detecting location...
                        </span>
                    )}
                    {locationError && !loading && (
                        <span style={{ fontFamily:'JetBrains Mono', fontSize:'11px', color:'var(--warning)' }}>
                            ⚠ Using approximate location
                        </span>
                    )}
                </div>

                <canvas
                    ref={canvasRef}
                    width={760}
                    height={360}
                    style={{ width:'100%', borderRadius:'8px', border:'1px solid var(--border)', display:'block' }}
                />

                {/* Legend */}
                <div style={{ display:'flex', gap:'20px', marginTop:'14px', flexWrap:'wrap' }}>
                    {[
                        { color:'#ff3366', label:'Your real location (YOU)' },
                        { color:'#00ff88', label:'VPN exit node (masked identity)' },
                        { color:'rgba(0,100,200,0.8)', label:'Available servers' },
                    ].map((item, i) => (
                        <div key={i} style={{ display:'flex', alignItems:'center', gap:'8px', fontFamily:'JetBrains Mono', fontSize:'11px', color:'var(--text-secondary)' }}>
                            <span style={{ width:'10px', height:'10px', borderRadius:'50%', background:item.color, display:'inline-block', flexShrink:0 }}></span>
                            {item.label}
                        </div>
                    ))}
                    {selectedServer && (
                        <div style={{ display:'flex', alignItems:'center', gap:'8px', fontFamily:'JetBrains Mono', fontSize:'11px', color: isConnected ? 'var(--success)' : 'var(--warning)' }}>
                            <span>— —</span>
                            {isConnected ? 'Encrypted tunnel active' : 'Tunnel inactive'}
                        </div>
                    )}
                </div>
            </div>

            {/* Identity cards */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px' }}>
                <div style={{ background:'var(--bg-elevated)', border:'1px solid rgba(255,51,102,0.3)', borderRadius:'10px', padding:'16px' }}>
                    <div style={{ fontSize:'10px', letterSpacing:'1.5px', color:'var(--text-muted)', fontFamily:'JetBrains Mono', marginBottom:'10px', textTransform:'uppercase' }}>
                        🔴 Your Real Identity
                    </div>
                    {loading ? (
                        <div style={{ color:'var(--text-muted)', fontFamily:'JetBrains Mono', fontSize:'12px' }}>Detecting...</div>
                    ) : (
                        <>
                            <div style={{ fontFamily:'JetBrains Mono', fontSize:'14px', color:'var(--danger)', fontWeight:'700' }}>
                                📍 {realLocation?.city}, {realLocation?.country}
                            </div>
                            <div style={{ fontFamily:'JetBrains Mono', fontSize:'12px', color:'var(--text-muted)', marginTop:'6px' }}>
                                IP: {realLocation?.ip || 'detecting...'}
                            </div>
                            <div style={{ fontFamily:'JetBrains Mono', fontSize:'11px', color:'var(--text-muted)', marginTop:'4px' }}>
                                {realLocation?.isp}
                            </div>
                            <div style={{ fontFamily:'JetBrains Mono', fontSize:'10px', color:'var(--text-muted)', marginTop:'4px' }}>
                                {realLocation?.latitude?.toFixed(4)}°, {realLocation?.longitude?.toFixed(4)}°
                            </div>
                        </>
                    )}
                </div>

                <div style={{ background:'var(--bg-elevated)', border:`1px solid ${selectedServer ? 'rgba(0,255,136,0.3)' : 'var(--border)'}`, borderRadius:'10px', padding:'16px' }}>
                    <div style={{ fontSize:'10px', letterSpacing:'1.5px', color:'var(--text-muted)', fontFamily:'JetBrains Mono', marginBottom:'10px', textTransform:'uppercase' }}>
                        🟢 Your Masked Identity
                    </div>
                    {selectedServer ? (
                        <>
                            <div style={{ fontFamily:'JetBrains Mono', fontSize:'14px', color: isConnected ? 'var(--success)' : 'var(--warning)', fontWeight:'700' }}>
                                {selectedServer.country?.split(' ')[0]} {selectedServer.city}, {selectedServer.country?.replace(/^\S+ /, '')}
                            </div>
                            <div style={{ fontFamily:'JetBrains Mono', fontSize:'12px', color:'var(--text-muted)', marginTop:'6px' }}>
                                IP: {selectedServer.ip}
                            </div>
                            <div style={{ fontFamily:'JetBrains Mono', fontSize:'11px', color: isConnected ? 'var(--success)' : 'var(--warning)', marginTop:'8px' }}>
                                {isConnected ? '🟢 Tunnel ACTIVE — identity masked' : '🟡 Tunnel pending — identity exposed'}
                            </div>
                        </>
                    ) : (
                        <div style={{ fontFamily:'JetBrains Mono', fontSize:'12px', color:'var(--text-muted)' }}>
                            No server selected — go to 🌐 Servers tab and connect to a server to mask your identity.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default GeoSpoofVisualizer;
