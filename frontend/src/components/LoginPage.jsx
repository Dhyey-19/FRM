import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, LogIn, Eye, EyeOff } from 'lucide-react';
import logo from '../assets/app_logo.jpeg';

const LoginPage = ({ onNavigate }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    rememberMe: false
  });
  const [errorMsg, setErrorMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formData.username,
          password: formData.password
        })
      });

      const data = await response.json();
      if (response.ok) {
        if (formData.rememberMe) {
          localStorage.setItem('user', JSON.stringify(data.user));
          sessionStorage.removeItem('user');
        } else {
          sessionStorage.setItem('user', JSON.stringify(data.user));
          localStorage.removeItem('user');
        }
        navigate('/dashboard');
      } else {
        setErrorMsg(data.message || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      setErrorMsg('A network error occurred. Please try again.');
    }
  };

  return (
    <div className="auth-card">
      <div className="logo-container">
        <img src={logo} alt="Factory Flow Logo" />
      </div>
      <h2 className="auth-title">Welcome Back</h2>
      
      <form onSubmit={handleSubmit}>
        {errorMsg && (
          <div style={{ 
            backgroundColor: '#fee2e2', 
            color: '#ef4444', 
            padding: '10px', 
            borderRadius: '8px', 
            marginBottom: '16px', 
            fontSize: '13px', 
            textAlign: 'center',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }} title={errorMsg}>
            {errorMsg}
          </div>
        )}

        <div className="form-group floating-label-group">
          <input
            type="text"
            id="username"
            name="username"
            placeholder=" "
            value={formData.username}
            onChange={handleChange}
            required
          />
          <label htmlFor="username">Username</label>
          <User size={18} className="input-icon" />
        </div>

        <div className="form-group floating-label-group" style={{ position: 'relative' }}>
          <input
            type={showPassword ? 'text' : 'password'}
            id="password"
            name="password"
            placeholder=" "
            value={formData.password}
            onChange={handleChange}
            required
            style={{ paddingRight: '40px' }}
          />
          <label htmlFor="password">Password</label>
          <Lock size={18} className="input-icon" />
          <div 
            style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center' }}
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </div>
        </div>

        <div className="checkbox-group">
          <input
            type="checkbox"
            id="rememberMe"
            name="rememberMe"
            checked={formData.rememberMe}
            onChange={handleChange}
          />
          <label htmlFor="rememberMe">Remember me</label>
        </div>

        <button type="submit" className="btn btn-primary">
          <LogIn size={18} style={{ marginRight: '8px', verticalAlign: 'text-bottom' }} />
          Sign In
        </button>
      </form>

      <div className="auth-links">
        Don't have an account? <a href="#" onClick={(e) => { e.preventDefault(); onNavigate('signup'); }}>Sign up</a>
      </div>
    </div>
  );
};

export default LoginPage;
