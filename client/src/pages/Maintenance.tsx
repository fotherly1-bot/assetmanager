import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { Modal } from '../components/Modal';
import { formatDate, todayISO } from '../lib/format';
import { MAINT_TYPES, type Asset, type MaintenanceRecord } from '../types';

export function Maintenance() {
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [filter, setFilter] = useState<'all' | 'overdue' | 'dueSoon'>('all');
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({
    assetId: '',
    type: 'Service',
    date: todayISO(),
    nextDue: '',
    result: 'Pass' as 'Pass' | 'Fail' | 'Advisory',
    notes: '',
  });

  function load() {
    Promise.all([api<MaintenanceRecord[]>('/api/maintenance'), api<Asset[]>('/api/assets')]).then(([m, a]) => {
      setRecords(m);
      setAssets(a);
      if (!form.assetId && a[0]) setForm((f) => ({ ...f, assetId: a[0].id }));
    });
  }

  useEffect(() => {
    load();
  }, []);

  const today = todayISO();
  const soon = (() => {
    const d = new Date(today);
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  })();

  const enriched = useMemo(() => {
    return records.map((m) => {
      const a = assets.find((x) => x.id === m.assetId);
      const overdue = !!(m.nextDue && m.nextDue < today);
      const dueSoon = !!(m.nextDue && m.nextDue >= today && m.nextDue <= soon);
      return { ...m, assetName: a?.name, sku: a?.sku, overdue, dueSoon };
    });
  }, [records, assets, today, soon]);

  const filtered = enriched.filter((m) => {
    if (filter === 'overdue') return m.overdue;
    if (filter === 'dueSoon') return m.dueSoon || m.overdue;
    return true;
  });

  async function onSave(e: FormEvent) {
    e.preventDefault();
    await api('/api/maintenance', { method: 'POST', body: JSON.stringify(form) });
    setShow(false);
    load();
  }

  async function remove(id: string) {
    if (!confirm('Delete this maintenance record?')) return;
    await api(`/api/maintenance/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Maintenance</h2>
          <p>Service, MOT, PAT and LOLER tracking — overdue items highlighted</p>
        </div>
        <button className="btn btn-primary" type="button" onClick={() => setShow(true)}>
          Log maintenance
        </button>
      </div>

      <div className="filters">
        <button type="button" className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : ''}`} onClick={() => setFilter('all')}>
          All
        </button>
        <button type="button" className={`btn btn-sm ${filter === 'overdue' ? 'btn-primary' : ''}`} onClick={() => setFilter('overdue')}>
          Overdue
        </button>
        <button type="button" className={`btn btn-sm ${filter === 'dueSoon' ? 'btn-primary' : ''}`} onClick={() => setFilter('dueSoon')}>
          Due in 30 days
        </button>
      </div>

      <div className="card">
        <table className="data">
          <thead>
            <tr>
              <th>Asset</th>
              <th>Type</th>
              <th>Done</th>
              <th>Next due</th>
              <th>Result</th>
              <th>Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => (
              <tr key={m.id} style={m.overdue ? { background: 'color-mix(in srgb, #fee2e2 35%, transparent)' } : undefined}>
                <td>
                  <Link to={`/assets/${m.assetId}`}>{m.assetName || m.assetId}</Link>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{m.sku}</div>
                </td>
                <td>{m.type}</td>
                <td>{formatDate(m.date)}</td>
                <td>
                  <span className={`badge ${m.overdue ? 'badge-red' : m.dueSoon ? 'badge-amber' : 'badge-grey'}`}>
                    {formatDate(m.nextDue)}
                    {m.overdue ? ' · Overdue' : ''}
                  </span>
                </td>
                <td>
                  <span className={`badge ${m.result === 'Fail' ? 'badge-red' : m.result === 'Pass' ? 'badge-green' : 'badge-amber'}`}>
                    {m.result}
                  </span>
                </td>
                <td>{m.notes || '—'}</td>
                <td>
                  <button className="btn btn-sm btn-danger" type="button" onClick={() => remove(m.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="empty">No records match</div>}
      </div>

      {show && (
        <Modal title="Log maintenance" onClose={() => setShow(false)}>
          <form className="form-grid" onSubmit={onSave}>
            <div className="form-row">
              <label>Asset</label>
              <select required value={form.assetId} onChange={(e) => setForm({ ...form, assetId: e.target.value })}>
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-inline">
              <div className="form-row">
                <label>Type</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  {MAINT_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <label>Result</label>
                <select value={form.result} onChange={(e) => setForm({ ...form, result: e.target.value as 'Pass' | 'Fail' | 'Advisory' })}>
                  <option>Pass</option>
                  <option>Fail</option>
                  <option>Advisory</option>
                </select>
              </div>
            </div>
            <div className="form-inline">
              <div className="form-row">
                <label>Date completed</label>
                <input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div className="form-row">
                <label>Next due</label>
                <input type="date" required value={form.nextDue} onChange={(e) => setForm({ ...form, nextDue: e.target.value })} />
              </div>
            </div>
            <div className="form-row">
              <label>Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="form-actions">
              <button type="button" className="btn" onClick={() => setShow(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Save
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
