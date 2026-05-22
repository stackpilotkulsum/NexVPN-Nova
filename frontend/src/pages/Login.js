import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authAPI } from '../utils/api';

function Login({ setToken }) {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({ username: '', password: '' });

    const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const response = await authAPI.login(formData.username, formData.password);
            const { token, userId } = response.data;
            localStorage.setItem('token', token);
            localStorage.setItem('userId', userId);
            localStorage.setItem('username', formData.username);
            setToken(token);
            navigate('/dashboard');
        } catch (err) {
            setError(err.response?.data?.error || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg-deep)', padding:'20px' }}>
            <div style={{ width:'100%', maxWidth:'420px' }}>
                {/* Logo */}
                <div style={{ textAlign:'center', marginBottom:'40px' }}>
                    <div style={{ fontSize:'42px', fontFamily:'Syne,sans-serif', fontWeight:'800', background:'linear-gradient(135deg, var(--accent-cyan), var(--accent-green))', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
                        ⬡ NEXVPN
                    </div>
                    <div style={{ fontFamily:'JetBrains Mono', fontSize:'11px', color:'var(--text-muted)', letterSpacing:'3px', marginTop:'6px' }}>SECURE TUNNEL SYSTEM</div>
                </div>

                <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'16px', padding:'32px', position:'relative', overflow:'hidden' }}>
                    <div style={{ position:'absolute', top:0, left:0, right:0, height:'2px', background:'linear-gradient(90deg, transparent, var(--accent-cyan), transparent)' }}></div>

                    <div style={{ fontFamily:'Syne,sans-serif', fontWeight:'700', fontSize:'20px', color:'var(--text-primary)', marginBottom:'6px' }}>Sign In</div>
                    <div style={{ fontFamily:'JetBrains Mono', fontSize:'11px', color:'var(--text-muted)', marginBottom:'28px' }}>Authenticate to access your secure tunnel</div>

                    {error && <div className="alert alert-danger">{error}</div>}

                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label>Username</label>
                            <input type="text" name="username" value={formData.username} onChange={handleChange} required placeholder="your_username" autoComplete="username" />
                        </div>
                        <div className="form-group" style={{ marginBottom:'24px' }}>
                            <label>Password</label>
                            <input type="password" name="password" value={formData.password} onChange={handleChange} required placeholder="••••••••" autoComplete="current-password" />
                        </div>
                        <button type="submit" className="btn btn-primary" disabled={loading} style={{ width:'100%', padding:'13px', fontSize:'14px', letterSpacing:'1px' }}>
                            {loading ? '⏳ Authenticating...' : '⬡ CONNECT'}
                        </button>
                    </form>

                    <div style={{ textAlign:'center', marginTop:'20px', fontFamily:'JetBrains Mono', fontSize:'12px', color:'var(--text-muted)' }}>
                        No account? <Link to="/register" style={{ color:'var(--accent-cyan)', textDecoration:'none' }}>Create one →</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Login;
