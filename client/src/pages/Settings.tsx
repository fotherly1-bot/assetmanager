import { FormEvent, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useTheme } from '../hooks/useTheme';
import type { Settings as SettingsType } from '../types';

export function Settings() {
  const { theme, setTheme } = useTheme();
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api<SettingsType>('/api/settings').then(setSettings);
  }, []);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!settings) return;
    const updated = await api<SettingsType>('/api/settings', { method: 'PUT', body: JSON.stringify(settings) });
    setSettings(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (!settings) return <div className="empty">Loading settings…</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Settings</h2>
          <p>Company preferences and display options</p>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card card-body">
          <h3 className="card-title">Company</h3>
          <form className="form-grid" onSubmit={onSave}>
            <div className="form-row">
              <label>Company name</label>
              <input value={settings.companyName} onChange={(e) => setSettings({ ...settings, companyName: e.target.value })} />
            </div>
            <div className="form-row">
              <label>Low fuel threshold (%)</label>
              <input
                type="number"
                min={1}
                max={100}
                value={settings.lowFuelThresholdPercent}
                onChange={(e) => setSettings({ ...settings, lowFuelThresholdPercent: Number(e.target.value) })}
              />
            </div>
            <div className="form-row">
              <label>Currency</label>
              <input value={settings.currency} disabled />
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary">
                {saved ? 'Saved' : 'Save settings'}
              </button>
            </div>
          </form>
        </div>

        <div className="card card-body">
          <h3 className="card-title">Appearance</h3>
          <div className="form-row">
            <label>Colour theme</label>
            <div className="theme-toggle" style={{ marginTop: '0.5rem' }}>
              <span>Light</span>
              <button
                type="button"
                className="theme-switch"
                aria-label="Toggle colour theme"
                onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              />
              <span>Dark</span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.75rem' }}>
              Preference is stored in this browser. Current: <strong>{theme}</strong>
            </p>
          </div>
          <div style={{ marginTop: '1.5rem' }}>
            <h3 className="card-title">Demo login</h3>
            <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.875rem' }}>
              admin@contractor.local / admin123
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
