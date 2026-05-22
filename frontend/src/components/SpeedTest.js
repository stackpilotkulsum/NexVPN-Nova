import React, { useState, useEffect, useRef } from 'react';
import { getSocket } from '../utils/socket';
import axios from 'axios';
import './SpeedTest.css';

const API_BASE = process.env.REACT_APP_API_URL || 'https://nexvpn.onrender.com/api';

function SpeedTest({ token }) {
    const [running, setRunning] = useState(false);
    const [stage, setStage] = useState('');
    const [results, setResults] = useState(null);
    const [history, setHistory] = useState([]);
    const [error, setError] = useState('');
    const [progress, setProgress] = useState(0);
    const listenerAttached = useRef(false);

    const cleanupListeners = () => {
        const socket = getSocket();
        if (socket) {
            socket.off('speed_test_progress');
            socket.off('speed_test_results');
        }
        listenerAttached.current = false;
    };

    useEffect(() => {
        return () => cleanupListeners();
    }, []);

    // Fallback: run speed test via REST API if socket fails
    const runTestViaAPI = async () => {
        setStage('Measuring ping to 1.1.1.1...');
        setProgress(20);
        try {
            const res = await axios.get(`${API_BASE}/network/speed-test`, { timeout: 30000 });
            setProgress(100);
            const data = res.data;
            const result = {
                download: data.download,
                ping: data.ping,
                dns: data.dns,
                bytesTransferred: data.bytesTransferred,
                timestamp: data.timestamp,
                server: 'Cloudflare CDN',
                source: 'REST API'
            };
            setResults(result);
            setHistory(prev => [result, ...prev.slice(0, 4)]);
        } catch (err) {
            setError('Speed test failed: ' + (err.response?.data?.error || err.message));
        }
    };

    const runTest = () => {
        if (running) return;
        setRunning(true);
        setResults(null);
        setError('');
        setProgress(5);
        setStage('Initializing speed test...');

        const socket = getSocket();

        // If no socket, fall back to REST
        if (!socket || !socket.connected) {
            runTestViaAPI().finally(() => { setRunning(false); setStage(''); setProgress(0); });
            return;
        }

        cleanupListeners();
        listenerAttached.current = true;

        // Timeout safety valve
        const timeout = setTimeout(() => {
            if (running) {
                cleanupListeners();
                setError('Speed test timed out. Trying REST fallback...');
                setRunning(false);
                setStage('');
                setProgress(0);
            }
        }, 35000);

        socket.on('speed_test_progress', (data) => {
            setStage(data.message || 'Running...');
            setProgress(prev => Math.min(85, prev + 30));
        });

        socket.once('speed_test_results', (data) => {
            clearTimeout(timeout);
            cleanupListeners();
            setProgress(100);
            const result = { ...data, source: 'WebSocket' };
            setResults(result);
            setHistory(prev => [result, ...prev.slice(0, 4)]);
            setRunning(false);
            setStage('');
            setTimeout(() => setProgress(0), 1000);
        });

        socket.emit('run_speed_test');
    };

    const formatBytes = (bytes) => {
        if (!bytes) return '0 B';
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const getSpeedRating = (mbps) => {
        if (!mbps) return { label: 'N/A', color: '#64748b' };
        if (mbps > 50) return { label: 'Excellent', color: '#10b981' };
        if (mbps > 20) return { label: 'Good', color: '#22c55e' };
        if (mbps > 5) return { label: 'Fair', color: '#f59e0b' };
        return { label: 'Slow', color: '#ef4444' };
    };

    const getPingRating = (ms) => {
        if (!ms) return { label: 'N/A', color: '#64748b' };
        if (ms < 20) return { label: 'Excellent', color: '#10b981' };
        if (ms < 50) return { label: 'Good', color: '#22c55e' };
        if (ms < 100) return { label: 'Fair', color: '#f59e0b' };
        return { label: 'Poor', color: '#ef4444' };
    };

    const downloadRating = getSpeedRating(results?.download);
    const pingRating = getPingRating(results?.ping);

    return (
        <div className="speed-test">
            <div className="speed-test-header">
                <h3>⚡ Real Network Speed Test</h3>
                <p>Measures actual download speed via Cloudflare CDN + real TCP latency to 1.1.1.1</p>
            </div>

            {error && (
                <div style={{ background: '#7f1d1d', border: '1px solid #ef4444', color: '#fca5a5', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
                    ⚠️ {error}
                </div>
            )}

            {running && (
                <div style={{ marginBottom: '12px' }}>
                    <div style={{ background: '#1f2937', borderRadius: '6px', height: '6px', overflow: 'hidden' }}>
                        <div style={{
                            height: '100%',
                            width: `${progress}%`,
                            background: 'linear-gradient(90deg, #3b82f6, #10b981)',
                            transition: 'width 0.5s ease',
                            borderRadius: '6px'
                        }}></div>
                    </div>
                </div>
            )}

            <div className="speed-gauge-area">
                {!running && !results && (
                    <div className="speed-idle">
                        <div className="speed-icon">🚀</div>
                        <p>Click below to run a real speed test</p>
                        <p style={{ color: '#6b7280', fontSize: '0.8rem' }}>Downloads 2MB from Cloudflare CDN to measure throughput</p>
                    </div>
                )}

                {running && (
                    <div className="speed-running">
                        <div className="speed-spinner"></div>
                        <p className="speed-stage">{stage}</p>
                        <p className="speed-note">Downloading 2MB from Cloudflare CDN...</p>
                    </div>
                )}

                {results && !running && (
                    <div className="speed-results-display">
                        <div className="speed-metrics">
                            <div className="speed-metric">
                                <div className="metric-icon">⬇️</div>
                                <div className="metric-label">Download</div>
                                <div className="metric-value" style={{ color: downloadRating.color }}>
                                    {results.download !== null ? `${results.download} Mbps` : 'N/A'}
                                </div>
                                <div className="metric-rating" style={{ color: downloadRating.color }}>{downloadRating.label}</div>
                            </div>

                            <div className="speed-metric">
                                <div className="metric-icon">🏓</div>
                                <div className="metric-label">Ping</div>
                                <div className="metric-value" style={{ color: pingRating.color }}>
                                    {results.ping !== null ? `${results.ping}ms` : 'N/A'}
                                </div>
                                <div className="metric-rating" style={{ color: pingRating.color }}>{pingRating.label}</div>
                            </div>

                            {results.dns !== undefined && results.dns !== null && (
                                <div className="speed-metric">
                                    <div className="metric-icon">🔍</div>
                                    <div className="metric-label">DNS</div>
                                    <div className="metric-value" style={{ color: getPingRating(results.dns).color }}>
                                        {results.dns}ms
                                    </div>
                                    <div className="metric-rating" style={{ color: getPingRating(results.dns).color }}>
                                        {getPingRating(results.dns).label}
                                    </div>
                                </div>
                            )}

                            <div className="speed-metric">
                                <div className="metric-icon">📊</div>
                                <div className="metric-label">Data Used</div>
                                <div className="metric-value">{formatBytes(results.bytesTransferred)}</div>
                                <div className="metric-rating">transferred</div>
                            </div>
                        </div>

                        <div className="speed-details">
                            <div className="detail-row">
                                <span>Test Server</span>
                                <span>Cloudflare CDN (speed.cloudflare.com)</span>
                            </div>
                            <div className="detail-row">
                                <span>VPN Server</span>
                                <span>{results.server || 'Not selected'}</span>
                            </div>
                            <div className="detail-row">
                                <span>Test Time</span>
                                <span>{new Date(results.timestamp).toLocaleTimeString()}</span>
                            </div>
                            {results.download && (
                                <div className="detail-row">
                                    <span>Speed</span>
                                    <span style={{ color: downloadRating.color }}>
                                        {results.download} Mbps ({(results.download / 8).toFixed(2)} MB/s)
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <button
                className={`btn ${running ? 'btn-secondary' : 'btn-primary'} speed-btn`}
                onClick={runTest}
                disabled={running}
            >
                {running ? '⏳ Running Speed Test...' : '▶ Start Real Speed Test'}
            </button>

            {history.length > 0 && (
                <div className="speed-history">
                    <h4>📋 Test History</h4>
                    <table className="history-table">
                        <thead>
                            <tr>
                                <th>Time</th>
                                <th>Download</th>
                                <th>Ping</th>
                                <th>Data</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.map((h, i) => (
                                <tr key={i}>
                                    <td>{new Date(h.timestamp).toLocaleTimeString()}</td>
                                    <td style={{ color: getSpeedRating(h.download).color }}>
                                        {h.download !== null ? `${h.download} Mbps` : 'N/A'}
                                    </td>
                                    <td style={{ color: getPingRating(h.ping).color }}>
                                        {h.ping !== null ? `${h.ping}ms` : 'N/A'}
                                    </td>
                                    <td>{formatBytes(h.bytesTransferred)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

export default SpeedTest;
