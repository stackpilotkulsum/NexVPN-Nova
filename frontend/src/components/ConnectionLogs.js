import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './ConnectionLogs.css';

const API_BASE = process.env.REACT_APP_API_URL || 'https://nexvpn.onrender.com/api';

function ConnectionLogs({ token, userId }) {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');

    useEffect(() => {
        fetchLogs();
        const interval = setInterval(fetchLogs, 30000); // Refresh every 30 seconds
        return () => clearInterval(interval);
    }, [userId]);

    const fetchLogs = async () => {
        try {
            const response = await axios.get(`${API_BASE}/vpn/connection-logs/${userId}`);
            setLogs(response.data.logs.reverse()); // Show newest first
        } catch (error) {
            console.error('Failed to fetch logs:', error);
        } finally {
            setLoading(false);
        }
    };

    const getActionIcon = (action) => {
        switch (action) {
            case 'server_selected': return '🌍';
            case 'protocol_selected': return '🔐';
            case 'kill_switch_enabled': return '⚡';
            case 'kill_switch_disabled': return '⚡';
            case 'dns_protection_enabled': return '🛡️';
            case 'dns_protection_disabled': return '🛡️';
            case 'split_tunneling_enabled': return '🔀';
            case 'split_tunneling_disabled': return '🔀';
            case 'speed_test_completed': return '⚡';
            case 'connected': return '🔗';
            case 'disconnected': return '🔌';
            default: return '📝';
        }
    };

    const getActionDescription = (log) => {
        switch (log.action) {
            case 'server_selected':
                return `Connected to ${log.serverName}`;
            case 'protocol_selected':
                return `Switched to ${log.protocolName}`;
            case 'kill_switch_enabled':
                return 'Kill Switch activated';
            case 'kill_switch_disabled':
                return 'Kill Switch deactivated';
            case 'dns_protection_enabled':
                return 'DNS Leak Protection enabled';
            case 'dns_protection_disabled':
                return 'DNS Leak Protection disabled';
            case 'split_tunneling_enabled':
                return `Split tunneling enabled for ${log.apps?.length || 0} apps`;
            case 'split_tunneling_disabled':
                return 'Split tunneling disabled';
            case 'speed_test_completed':
                return `Speed test: ${log.results?.download} Mbps download, ${log.results?.upload} Mbps upload`;
            case 'connected':
                return 'VPN connection established';
            case 'disconnected':
                return `VPN disconnected (${log.reason || 'manual'})`;
            default:
                return log.action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        }
    };

    const getActionColor = (action) => {
        if (action.includes('enabled') || action.includes('connected') || action.includes('selected') || action.includes('completed')) {
            return '#10b981';
        }
        if (action.includes('disabled') || action.includes('disconnected')) {
            return '#ef4444';
        }
        return '#3b82f6';
    };

    const formatTimestamp = (timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleString();
    };

    const filteredLogs = logs.filter(log => {
        if (filter === 'all') return true;
        if (filter === 'security') return log.action.includes('kill_switch') || log.action.includes('dns') || log.action.includes('split_tunneling');
        if (filter === 'connection') return log.action.includes('connected') || log.action.includes('disconnected') || log.action.includes('server_selected');
        if (filter === 'performance') return log.action.includes('speed_test');
        return true;
    });

    if (loading) {
        return (
            <div className="connection-logs">
                <div className="loading">Loading connection logs...</div>
            </div>
        );
    }

    return (
        <div className="connection-logs">
            <div className="logs-header">
                <h3> Connection Logs</h3>
                <p>Monitor your VPN connection activity and security events</p>
            </div>

            <div className="logs-controls">
                <div className="filter-buttons">
                    <button
                        className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
                        onClick={() => setFilter('all')}
                    >
                        All Events
                    </button>
                    <button
                        className={`filter-btn ${filter === 'connection' ? 'active' : ''}`}
                        onClick={() => setFilter('connection')}
                    >
                        Connection
                    </button>
                    <button
                        className={`filter-btn ${filter === 'security' ? 'active' : ''}`}
                        onClick={() => setFilter('security')}
                    >
                        Security
                    </button>
                    <button
                        className={`filter-btn ${filter === 'performance' ? 'active' : ''}`}
                        onClick={() => setFilter('performance')}
                    >
                        Performance
                    </button>
                </div>

                <div className="logs-stats">
                    <span className="log-count">{filteredLogs.length} events</span>
                </div>
            </div>

            <div className="logs-container">
                {filteredLogs.length === 0 ? (
                    <div className="no-logs">
                        <div className="no-logs-icon"></div>
                        <div className="no-logs-text">No logs available</div>
                        <div className="no-logs-description">
                            {filter === 'all' ? 'Start using the VPN to see connection logs' : `No ${filter} events found`}
                        </div>
                    </div>
                ) : (
                    <div className="logs-list">
                        {filteredLogs.map((log, index) => (
                            <div key={index} className="log-entry">
                                <div className="log-icon" style={{ color: getActionColor(log.action) }}>
                                    {getActionIcon(log.action)}
                                </div>
                                <div className="log-content">
                                    <div className="log-description" style={{ color: getActionColor(log.action) }}>
                                        {getActionDescription(log)}
                                    </div>
                                    <div className="log-details">
                                        <span className="log-timestamp">{formatTimestamp(log.timestamp)}</span>
                                        {log.ip && (
                                            <span className="log-ip">IP: {log.ip}</span>
                                        )}
                                        {log.serverName && (
                                            <span className="log-server">Server: {log.serverName}</span>
                                        )}
                                    </div>
                                </div>
                                <div className="log-status">
                                    <div className="status-dot" style={{ backgroundColor: getActionColor(log.action) }}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {filteredLogs.length > 0 && (
                <div className="logs-footer">
                    <button className="export-btn" onClick={() => {
                        const logText = filteredLogs.map(log =>
                            `${formatTimestamp(log.timestamp)} - ${getActionDescription(log)}`
                        ).join('\n');

                        const blob = new Blob([logText], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `vpn-logs-${new Date().toISOString().split('T')[0]}.txt`;
                        a.click();
                        URL.revokeObjectURL(url);
                    }}>
                        📥 Export Logs
                    </button>
                </div>
            )}
        </div>
    );
}

export default ConnectionLogs;
