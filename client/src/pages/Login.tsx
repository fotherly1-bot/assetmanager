import { FormEvent, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';

export function Login() {
  const { user, login, loading } = useAuth();
  const { theme, toggle } = useTheme();
  const [email, setEmail] = useState('admin@contractor.local');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!loading && user) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <div style={{ position: 'fixed', top: 16, right: 16 }} className="theme-toggle">
        <span>Light</span>
        <button type="button" className="theme-switch" aria-label="Toggle theme" onClick={toggle} />
        <span>Dark</span>
      </div>
      <div className="card login-card">
        <h1>Asset Manager</h1>
        <p className="sub">Sign in to Midlands Highways Plant Ltd</p>
        {error && <div className="login-error">{error}</div>}
        <form className="form-grid" onSubmit={onSubmit}>
          <div className="form-row">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
          </div>
          <div className="form-row">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          </div>
          <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: '100%', justifyContent: 'center' }}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p style={{ marginTop: '1.25rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Demo: admin@contractor.local / admin123 · Theme: {theme}
        </p>
      </div>
    </div>
  );
}
