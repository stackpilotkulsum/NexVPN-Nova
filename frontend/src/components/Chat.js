import React, { useState, useEffect, useRef } from 'react';
import { getSocket, sendMessage, onReceiveMessage, onMessageSent, requestUserList, onUserList } from '../utils/socket';

function Chat() {
    const [messages, setMessages] = useState([
        { type: 'system', content: '🔐 End-to-end encrypted channel active. Messages are secured with AES-256.', time: new Date().toLocaleTimeString() }
    ]);
    const [input, setInput] = useState('');
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const messagesEndRef = useRef(null);
    const userId = localStorage.getItem('userId');
    const username = localStorage.getItem('username');

    useEffect(() => {
        requestUserList();
        onUserList((list) => setUsers(list.filter(u => u.userId !== userId)));
        onReceiveMessage((msg) => {
            setMessages(prev => [...prev, { type: 'received', from: msg.username, content: msg.message, time: new Date(msg.timestamp).toLocaleTimeString() }]);
        });
        onMessageSent((data) => {
            if (!data.success) setMessages(prev => [...prev, { type: 'system', content: `⚠ Failed: ${data.error}`, time: new Date().toLocaleTimeString() }]);
        });
    }, [userId]);

    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    const handleSend = () => {
        if (!input.trim() || !selectedUser) return;
        sendMessage(selectedUser.userId, input.trim());
        setMessages(prev => [...prev, { type: 'sent', content: input.trim(), time: new Date().toLocaleTimeString() }]);
        setInput('');
    };

    const s = {
        wrap: { color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', height: '500px' },
        header: { fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)', marginBottom: '12px' },
        userList: { display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' },
        userChip: (selected) => ({ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '20px', cursor: 'pointer', fontFamily: 'JetBrains Mono,monospace', fontSize: '12px', background: selected ? 'rgba(0,212,255,0.1)' : 'var(--bg-elevated)', border: `1px solid ${selected ? 'var(--accent-cyan)' : 'var(--border)'}`, color: selected ? 'var(--accent-cyan)' : 'var(--text-secondary)', transition: 'all 0.2s' }),
        messages: { flex: 1, overflowY: 'auto', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px', marginBottom: '10px', display: 'flex', flexDirection: 'column', gap: '8px' },
        msgSent: { padding: '10px 14px', borderRadius: '8px 8px 2px 8px', maxWidth: '70%', background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.2)', color: 'var(--accent-cyan)', alignSelf: 'flex-end', fontFamily: 'JetBrains Mono,monospace', fontSize: '12px' },
        msgRecv: { padding: '10px 14px', borderRadius: '8px 8px 8px 2px', maxWidth: '70%', background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--text-secondary)', alignSelf: 'flex-start', fontFamily: 'JetBrains Mono,monospace', fontSize: '12px' },
        msgSys: { padding: '8px 14px', borderRadius: '8px', background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', color: '#a78bfa', alignSelf: 'center', fontFamily: 'JetBrains Mono,monospace', fontSize: '11px', textAlign: 'center' },
        inputRow: { display: 'flex', gap: '8px' },
        input: { flex: 1, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px', color: 'var(--text-primary)', fontFamily: 'JetBrains Mono,monospace', fontSize: '12px', outline: 'none' },
    };

    return (
        <div style={s.wrap}>
            <div style={s.header}>💬 Encrypted Peer Chat</div>
            <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px' }}>
                Messages encrypted with AES-256. Select a user to chat.
            </div>

            {users.length > 0 ? (
                <div style={s.userList}>
                    <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '10px', color: 'var(--text-muted)', alignSelf: 'center', marginRight: '4px', textTransform: 'uppercase', letterSpacing: '1px' }}>To:</span>
                    {users.map(u => (
                        <div key={u.userId} style={s.userChip(selectedUser?.userId === u.userId)} onClick={() => setSelectedUser(u)}>
                            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }}></span>
                            {u.username}
                        </div>
                    ))}
                </div>
            ) : (
                <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px', padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                    👥 No other users online. Register another account to test chat.
                </div>
            )}

            <div style={s.messages}>
                {messages.map((m, i) => (
                    <div key={i} style={m.type === 'sent' ? s.msgSent : m.type === 'received' ? s.msgRecv : s.msgSys}>
                        {m.type === 'received' && <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '3px' }}>{m.from}</div>}
                        {m.content}
                        {m.time && <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '3px', textAlign: m.type === 'sent' ? 'right' : 'left' }}>{m.time}</div>}
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            <div style={s.inputRow}>
                <input
                    style={s.input}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                    placeholder={selectedUser ? `Message ${selectedUser.username}...` : 'Select a user first...'}
                    disabled={!selectedUser}
                />
                <button className="btn btn-primary" onClick={handleSend} disabled={!selectedUser || !input.trim()}>Send 🔐</button>
            </div>
        </div>
    );
}

export default Chat;
