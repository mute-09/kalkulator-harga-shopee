import React, { useState, useEffect } from 'react';
import AuthPage from './AuthPage';
import CalculatorPage from './CalculatorPage';
import { api, getToken, setToken } from './api';

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const restoreSession = async () => {
      if (getToken()) {
        try {
          const { ok, data } = await api('/api/auth/me');
          if (ok && data.success) {
            setUser(data.user);
          } else {
            setToken(null);
          }
        } catch (e) {
          console.error(e);
        }
      }
      setChecking(false);
    };

    restoreSession();

    const handleExpired = () => setUser(null);
    window.addEventListener('auth:expired', handleExpired);
    return () => window.removeEventListener('auth:expired', handleExpired);
  }, []);

  const handleLogin = (loggedInUser, token) => {
    setToken(token);
    setUser(loggedInUser);
  };

  const handleLogout = async () => {
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error(e);
    }
    setToken(null);
    setUser(null);
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Memuat...</p>
      </div>
    );
  }

  return user ? (
    <CalculatorPage user={user} onLogout={handleLogout} />
  ) : (
    <AuthPage onLogin={handleLogin} />
  );
}
