import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Global fetch interceptor to append User credentials for server-side authorization checks
const originalFetch = window.fetch;
window.fetch = async function (url, options = {}) {
  try {
    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      if (user && (user.UserId || user.Username)) {
        if (!options.headers) {
          options.headers = {};
        }
        
        if (options.headers instanceof Headers) {
          if (user.UserId && !options.headers.has('X-User-Id')) {
            options.headers.append('X-User-Id', String(user.UserId));
          }
          if (user.Username && !options.headers.has('X-Username')) {
            options.headers.append('X-Username', String(user.Username));
          }
        } else {
          options.headers = {
            'X-User-Id': user.UserId ? String(user.UserId) : '',
            'X-Username': user.Username ? String(user.Username) : '',
            ...options.headers
          };
        }
      }
    }
  } catch (e) {
    console.error('Error in fetch interceptor:', e);
  }
  return originalFetch(url, options);
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Register PWA Service Worker
if ('serviceWorker' in navigator) {
  const registerSW = () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('[PWA] Service Worker registered successfully with scope:', registration.scope);
      })
      .catch((error) => {
        console.log('[PWA] Service Worker registration skipped or failed:', error.message);
      });
  };

  if (document.readyState === 'complete') {
    registerSW();
  } else {
    window.addEventListener('load', registerSW);
  }
}
