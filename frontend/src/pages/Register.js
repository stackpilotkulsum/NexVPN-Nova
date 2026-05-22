import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authAPI } from '../utils/api';

function Register({ setToken }) {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({ username: '', email: '', password: '', confirm: '' });

    const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (formData.password !== formData.confirm) { setError('Passwords do not match'); return; }
        if (formData.password.length < 6) { setError('Password must be at least 6 characters'); return; }
        setLoading(true); setError('');
        try {
            const response = await authAPI.register(formData.username, formData.email, formData.password);
            const { token, userId } = response.data;
            localStorage.setItem('token', token);
            localStorage.setItem('userId', userId);
            localStorage.setItem('username', formData.username);
            setToken(token);
            navigate('/dashboard');
        } catch (err) {
            setError(err.response?.data?.error || 'Registration failed');
        } finally { setLoading(false); }
    };

    return (
        <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg-deep)', padding:'20px' }}>
            <div style={{ width:'100%', maxWidth:'420px' }}>
                <div style={{ textAlign:'center', marginBottom:'40px' }}>
                    <div style={{ fontSize:'42px', fontFamily:'Syne,sans-serif', fontWeight:'800', background:'linear-gradient(135deg, var(--accent-cyan), var(--accent-green))', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>⬡ NEXVPN</div>
                    <div style={{ fontFamily:'JetBrains Mono', fontSize:'11px', color:'var(--text-muted)', letterSpacing:'3px', marginTop:'6px' }}>SECURE TUNNEL SYSTEM</div>
                </div>
                <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'16px', padding:'32px', position:'relative', overflow:'hidden' }}>
                    <div style={{ position:'absolute', top:0, left:0, right:0, height:'2px', background:'linear-gradient(90deg, transparent, var(--accent-purple), transparent)' }}></div>
                    <div style={{ fontFamily:'Syne,sans-serif', fontWeight:'700', fontSize:'20px', color:'var(--text-primary)', marginBottom:'6px' }}>Create Account</div>
                    <div style={{ fontFamily:'JetBrains Mono', fontSize:'11px', color:'var(--text-muted)', marginBottom:'28px' }}>Register to get your secure tunnel access</div>
                    {error && <div className="alert alert-danger">{error}</div>}
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label>Username</label>
                            <input type="text" name="username" value={formData.username} onChange={handleChange} required placeholder="choose_username" />
                        </div>
                        <div className="form-group">
                            <label>Email</label>
                            <input type="email" name="email" value={formData.email} onChange={handleChange} required placeholder="you@example.com" />
                        </div>
                        <div className="form-group">
                            <label>Password</label>
                            <input type="password" name="password" value={formData.password} onChange={handleChange} required placeholder="min. 6 characters" />
                        </div>
                        <div className="form-group" style={{ marginBottom:'24px' }}>
                            <label>Confirm Password</label>
                            <input type="password" name="confirm" value={formData.confirm} onChange={handleChange} required placeholder="repeat password" />
                        </div>
                        <button type="submit" className="btn btn-primary" disabled={loading} style={{ width:'100%', padding:'13px', fontSize:'14px', letterSpacing:'1px' }}>
                            {loading ? '⏳ Creating...' : '⬡ REGISTER'}
                        </button>
                    </form>
                    <div style={{ textAlign:'center', marginTop:'20px', fontFamily:'JetBrains Mono', fontSize:'12px', color:'var(--text-muted)' }}>
                        Already have an account? <Link to="/login" style={{ color:'var(--accent-cyan)', textDecoration:'none' }}>Sign in →</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Register;
