import React, { useState, useEffect } from 'react';
import { ShieldCheck, Cpu, KeyRound, ArrowRight, WifiOff, Mail } from 'lucide-react';
import logo from '../assets/app_logo.jpeg';
import { APP_VERSION } from '../config/version';

const RegistrationPage = ({ onRegisterSuccess }) => {
  const [randomNumber, setRandomNumber] = useState('');
  const [activationKey, setActivationKey] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [sendingRequest, setSendingRequest] = useState(false);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/auth/registration-status`)
      .then(res => res.json())
      .then(data => {
        setRandomNumber(data.randomNumber);
      })
      .catch(err => {
        console.error('Failed to get registration status:', err);
        // Fallback
        let storedNumber = localStorage.getItem('registrationRandomNumber');
        if (!storedNumber) {
          const min = 1000000000;
          const max = 9999999999;
          storedNumber = Math.floor(Math.random() * (max - min + 1) + min).toString();
          localStorage.setItem('registrationRandomNumber', storedNumber);
        }
        setRandomNumber(storedNumber);
      });
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const getCorrectKeys = () => {
    if (!randomNumber) return [];
    return ['FRM-BBP', 'FRM', 'FACTORYFLOW'].map(suffix => {
      const validationString = randomNumber + suffix;
      let asciiSum = 0;
      for (let i = 0; i < validationString.length; i++) {
        asciiSum += validationString.charCodeAt(i);
      }
      return (asciiSum * 10252).toString();
    });
  };

  const correctKeys = getCorrectKeys();

  const handleRegister = (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!activationKey.trim()) {
      setErrorMsg('Please enter the activation key.');
      return;
    }

    if (correctKeys.includes(activationKey.trim())) {
      setSuccessMsg('Registration successful! Redirecting...');
      
      // Save registration status to backend API
      fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      .then(() => {
        localStorage.setItem('isAppRegistered', 'true');
        localStorage.removeItem('registrationRandomNumber');
        setTimeout(() => {
          onRegisterSuccess();
        }, 1500);
      })
      .catch(err => {
        console.error('Failed to save registration to backend:', err);
        localStorage.setItem('isAppRegistered', 'true');
        localStorage.removeItem('registrationRandomNumber');
        setTimeout(() => {
          onRegisterSuccess();
        }, 1500);
      });
    } else {
      setErrorMsg('Invalid Activation Key. Please contact support to get a valid key.');
    }
  };

  const handleRequestActivation = async (e) => {
    if (e) e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!navigator.onLine) {
      setErrorMsg('Your internet is offline. Please turn on your internet connection and then click the "Request for Activation" button.');
      return;
    }

    setSendingRequest(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/auth/request-activation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appName: 'FRM-BBP',
          randomNumber: randomNumber,
          activationKey: correctKeys[0] || ''
        })
      });

      const data = await response.json();
      if (response.ok) {
        setSuccessMsg('Activation request sent successfully!');
      } else {
        setErrorMsg(data.message || 'Failed to send activation request.');
      }
    } catch (err) {
      console.error('Request activation error:', err);
      setErrorMsg('Failed to connect to backend server. Make sure the server is running and internet is active.');
    } finally {
      setSendingRequest(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card" style={{ maxWidth: '450px' }}>
        <div className="logo-container">
          <img src={logo} alt="FRM-BBP Logo" />
        </div>
        <h2 className="auth-title">Application Registration</h2>
        <p style={{ textAlign: 'center', color: '#64748b', fontSize: '14px', marginBottom: '24px' }}>
          This is the first time FRM-BBP is running on this device. Please register the application to activate it.
        </p>

        <form onSubmit={handleRegister}>
          {!isOnline && (
            <div style={{ 
              backgroundColor: '#fffbeb', 
              color: '#d97706', 
              padding: '12px', 
              borderRadius: '8px', 
              marginBottom: '16px', 
              fontSize: '14px', 
              textAlign: 'center',
              fontWeight: '500',
              border: '1px solid #fef3c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}>
              <WifiOff size={18} />
              <span>Internet is off. Please turn on internet and then click on the "Request for Activation" button.</span>
            </div>
          )}

          {errorMsg && (
            <div style={{ 
              backgroundColor: '#fee2e2', 
              color: '#ef4444', 
              padding: '12px', 
              borderRadius: '8px', 
              marginBottom: '16px', 
              fontSize: '14px', 
              textAlign: 'center',
              fontWeight: '500',
              border: '1px solid #fecaca'
            }}>
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div style={{ 
              backgroundColor: '#dcfce7', 
              color: '#15803d', 
              padding: '12px', 
              borderRadius: '8px', 
              marginBottom: '16px', 
              fontSize: '14px', 
              textAlign: 'center',
              fontWeight: '500',
              border: '1px solid #bbf7d0'
            }}>
              {successMsg}
            </div>
          )}

          {/* Application Name Field */}
          <div className="form-group floating-label-group">
            <input
              type="text"
              id="appName"
              name="appName"
              value="FRM-BBP"
              disabled
              style={{ 
                backgroundColor: '#f8fafc', 
                color: '#64748b', 
                cursor: 'not-allowed',
                fontWeight: '500'
              }}
            />
            <label htmlFor="appName" style={{ top: '0', left: '12px', fontSize: '12px', color: '#64748b', backgroundColor: '#ffffff' }}>
              Application Name
            </label>
            <Cpu size={18} className="input-icon" style={{ color: '#64748b' }} />
          </div>

          {/* Random Number Field */}
          <div className="form-group floating-label-group">
            <input
              type="text"
              id="deviceNumber"
              name="deviceNumber"
              value={randomNumber}
              disabled
              style={{ 
                backgroundColor: '#f8fafc', 
                color: '#64748b', 
                cursor: 'not-allowed',
                fontWeight: '600',
                letterSpacing: '1px'
              }}
            />
            <label htmlFor="deviceNumber" style={{ top: '0', left: '12px', fontSize: '12px', color: '#64748b', backgroundColor: '#ffffff' }}>
              Device Verification Number
            </label>
            <ShieldCheck size={18} className="input-icon" style={{ color: '#64748b' }} />
          </div>

          {/* Activation Key Input */}
          <div className="form-group floating-label-group">
            <input
              type="text"
              id="activationKey"
              name="activationKey"
              placeholder=" "
              value={activationKey}
              onChange={(e) => setActivationKey(e.target.value)}
              required
              style={{ 
                fontWeight: '500'
              }}
            />
            <label htmlFor="activationKey">Enter Activation Key</label>
            <KeyRound size={18} className="input-icon" />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
            <button 
              type="button" 
              onClick={handleRequestActivation} 
              disabled={sendingRequest}
              className="btn btn-secondary" 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: '8px',
                marginTop: '0',
                borderColor: !isOnline ? '#94a3b8' : 'var(--primary)',
                color: !isOnline ? '#94a3b8' : 'var(--primary)',
                cursor: 'pointer'
              }}
            >
              {sendingRequest ? 'Requesting...' : 'Request for Activation'}
              <Mail size={18} />
            </button>

            <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              Activate Application
              <ArrowRight size={18} />
            </button>
          </div>
        </form>
        
        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '12px', color: '#94a3b8' }}>
          Please share the Device Verification Number with your administrator to receive your Activation Key.
        </div>

        <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '11px', color: '#94a3b8', letterSpacing: '0.5px', fontWeight: 500 }}>
          FRM-BBP • v{APP_VERSION}
        </div>
      </div>
    </div>
  );
};

export default RegistrationPage;
