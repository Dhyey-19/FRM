import React, { useState } from 'react';
import { User, Lock, UserPlus, Phone, Eye, EyeOff } from 'lucide-react';
import logo from '../assets/app_logo.jpeg';

const SignupPage = ({ onNavigate }) => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    mobileNo: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formData.username,
          password: formData.password,
          mobileNo: formData.mobileNo
        })
      });

      const data = await response.json();
      if (response.ok) {
        setSuccessMsg('Signup successful! Please log in.');
        setErrorMsg('');
        setTimeout(() => {
          onNavigate('login');
        }, 2000);
      } else {
        setErrorMsg(data.message || 'Signup failed');
        setSuccessMsg('');
      }
    } catch (error) {
      console.error('Error signing up:', error);
      setErrorMsg('Network error. Please try again later.');
      setSuccessMsg('');
    }
  };

  return (
    <div className="auth-card">
      <div className="logo-container">
        <img src={logo} alt="FRM Logo" />
      </div>
      <h2 className="auth-title">Create Account</h2>
      

      <form onSubmit={handleSubmit}>
        {errorMsg && (
          <div style={{ backgroundColor: '#fee2e2', color: '#ef4444', padding: '10px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px', textAlign: 'center' }}>
            {errorMsg}
          </div>
        )}
        
        {successMsg && (
          <div style={{ backgroundColor: '#dcfce7', color: '#15803d', padding: '10px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px', textAlign: 'center' }}>
            {successMsg}
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

        <div className="form-group floating-label-group">
          <input
            type="tel"
            id="mobileNo"
            name="mobileNo"
            placeholder=" "
            value={formData.mobileNo}
            onChange={handleChange}
          />
          <label htmlFor="mobileNo">Mobile Number</label>
          <Phone size={18} className="input-icon" />
        </div>

        <button type="submit" className="btn btn-primary">
          <UserPlus size={18} style={{ marginRight: '8px', verticalAlign: 'text-bottom' }} />
          Sign Up
        </button>
      </form>

      <div className="auth-links">
        Already have an account? <a href="#" onClick={(e) => { e.preventDefault(); onNavigate('login'); }}>Sign in</a>
      </div>
    </div>
  );
};

export default SignupPage;
