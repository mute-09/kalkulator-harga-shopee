import React, { useState } from 'react';
import { api } from './api';

const TABS = [
  { key: 'login', label: 'Masuk' },
  { key: 'activate', label: 'Aktivasi' },
  { key: 'signup', label: 'Daftar' },
];

export default function AuthPage({ onLogin }) {
  const [tab, setTab] = useState('login');
  const [form, setForm] = useState({ email: '', password: '', code: '' });
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(false);

  const setField = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const switchTab = (next) => {
    setTab(next);
    setFeedback(null);
  };

  const callApi = async (path, body) => {
    setLoading(true);
    try {
      const res = await api(path, { method: 'POST', body: JSON.stringify(body) });
      return { ok: res.ok, data: res.data || {} };
    } catch {
      return { ok: false, data: { message: 'Tidak dapat terhubung ke server' } };
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const { ok, data } = await callApi('/api/auth/login', {
      email: form.email.trim(),
      password: form.password,
    });

    if (!ok || !data.success) {
      if (data.message?.includes('belum diaktivasi')) switchTab('activate');
      else setFeedback({ type: 'error', text: data.message || 'Login gagal' });
      return;
    }

    onLogin(data.user, data.token);
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    const { ok, data } = await callApi('/api/auth/signup', {
      email: form.email.trim(),
      password: form.password,
    });

    if (!ok || !data.success) {
      setFeedback({ type: 'error', text: data.message || 'Pendaftaran gagal' });
      return;
    }

    setForm((prev) => ({ ...prev, password: '', code: '' }));
    setTab('activate');
    setFeedback({ type: 'success', text: `${data.message} Lalu masukkan kode untuk mengaktivasi akun.` });
  };

  const handleActivate = async (e) => {
    e.preventDefault();
    const { ok, data } = await callApi('/api/auth/activate', {
      email: form.email.trim(),
      code: form.code.trim(),
    });

    if (!ok || !data.success) {
      setFeedback({ type: 'error', text: data.message || 'Aktivasi gagal' });
      return;
    }

    setForm((prev) => ({ ...prev, password: '', code: '' }));
    setTab('login');
    setFeedback({ type: 'success', text: data.message });
  };

  const handleResend = async () => {
    const { ok, data } = await callApi('/api/auth/resend-code', { email: form.email.trim() });
    setFeedback({
      type: ok && data.success ? 'success' : 'error',
      text: data.message || (ok ? '' : 'Gagal membuat kode baru'),
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-extrabold text-orange-600">Kalkulator Harga Shopee</h1>
          <p className="text-gray-500 text-sm mt-1">Masuk atau buat akun untuk mulai menyimpan riwayat</p>
        </div>

        <div className="grid grid-cols-3 gap-1 p-1 bg-gray-100 rounded-xl mb-6">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => switchTab(key)}
              className={`py-2 rounded-lg text-sm font-semibold transition ${
                tab === key
                  ? 'bg-white text-orange-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {feedback && (
          <div
            className={`mb-4 p-3 rounded-lg text-sm border ${
              feedback.type === 'success'
                ? 'bg-green-50 text-green-700 border-green-200'
                : 'bg-red-50 text-red-600 border-red-200'
            }`}
          >
            {feedback.text}
          </div>
        )}

        {tab === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <Field label="Email" type="email" value={form.email} onChange={setField('email')} required />
            <Field label="Password" type="password" value={form.password} onChange={setField('password')} required />
            <SubmitButton loading={loading}>Masuk</SubmitButton>
          </form>
        )}

        {tab === 'signup' && (
          <form onSubmit={handleSignup} className="space-y-4">
            <Field label="Email" type="email" value={form.email} onChange={setField('email')} required />
            <Field
              label="Password (min. 8 karakter)"
              type="password"
              value={form.password}
              onChange={setField('password')}
              required
              minLength={8}
            />
            <SubmitButton loading={loading}>Daftar</SubmitButton>
            <p className="text-xs text-gray-400 text-center">
              Kode aktivasi akan dikirim ke log terminal server.
            </p>
          </form>
        )}

        {tab === 'activate' && (
          <form onSubmit={handleActivate} className="space-y-4">
            <Field label="Email" type="email" value={form.email} onChange={setField('email')} required />
            <Field
              label="Kode Aktivasi (6 digit)"
              type="text"
              value={form.code}
              onChange={setField('code')}
              required
              maxLength={6}
              inputMode="numeric"
              pattern="\d{6}"
            />
            <SubmitButton loading={loading}>Aktivasi Akun</SubmitButton>
            <button
              type="button"
              onClick={handleResend}
              disabled={loading || !form.email.trim()}
              className="w-full text-xs text-orange-600 hover:text-orange-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Kode kedaluwarsa? Kirim ulang kode aktivasi
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({ label, type = 'text', ...props }) {
  return (
    <div>
      <label className="text-xs font-semibold text-gray-500 uppercase">{label}</label>
      <input
        type={type}
        {...props}
        className="w-full mt-1 p-2.5 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
      />
    </div>
  );
}

function SubmitButton({ loading, children }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 rounded-xl transition shadow-sm active:scale-95 disabled:opacity-50"
    >
      {loading ? 'Memproses...' : children}
    </button>
  );
}
