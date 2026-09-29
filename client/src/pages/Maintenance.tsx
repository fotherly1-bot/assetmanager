import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { Modal } from '../components/Modal';
import {
  MaintenanceForm,
  emptyMaintForm,
  formFromRecord,
  payloadFromForm,
  type MaintenanceFormValues,
} from '../components/MaintenanceForm';
import { formatDate, formatOutOfService, gbp, todayISO } from '../lib/format';
import { MAINT_STATUSES, type Asset, type MaintStatus, type MaintenanceRecord } from '../types';

type Filter = 'all' | 'overdue' | 'dueSoon' | 'scheduled' | 'in_progress' | 'completed';

function statusLabel(s: string) {
  return MAINT_STATUSES.find((x) => x.value === s)?.label || s || '—';
}

function statusBadge(s: string) {
  const map: Record<string, string> = {
    scheduled: 'badge-blue',
    in_progress: 'badge-amber',
    completed: 'badge-green',
    overdue: 'badge-red',
  };
  return map[s] || 'badge-grey';
}

export function Maintenance() {
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [show, setShow] = useState(false);
  const [editing, setEditing] = useState<MaintenanceRecord | null>(null);
  const [form, setForm] = useState<MaintenanceFormValues>(emptyMaintForm());

  function load() {
    Promise.all([api<MaintenanceRecord[]>('/api/maintenance'), api<Asset[]>('/api/assets')]).then(([m, a]) => {
      setRecords(m);
      setAssets(a);
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
      const overdue =
        m.status === 'overdue' ||
        !!(m.nextDue && m.nextDue < today && m.status !== 'completed') ||
        !!(m.status === 'scheduled' && m.scheduledDate && m.scheduledDate < today);
      const dueSoon = !!(
        !overdue &&
        m.nextDue &&
        m.nextDue >= today &&
        m.nextDue <= soon
      );
      return { ...m, assetName: a?.name, sku: a?.sku, overdue, dueSoon };
    });
  }, [records, assets, today, soon]);

  const filtered = enriched.filter((m) => {
    if (filter === 'overdue') return m.overdue;
    if (filter === 'dueSoon') return m.dueSoon || m.overdue;
    if (filter === 'scheduled') return m.status === 'scheduled';
    if (filter === 'in_progress') return m.status === 'in_progress';
    if (filter === 'completed') return m.status === 'completed';
    return true;
  });

  const totalCost = enriched.reduce((s, m) => s + (Number(m.costGbp) || 0), 0);
  const openCost = enriched
    .filter((m) => m.status !== 'completed')
    .reduce((s, m) => s + (Number(m.costGbp) || 0), 0);

  function openCreate(assetId?: string) {
    setEditing(null);
    setForm(emptyMaintForm(assetId || assets[0]?.id || ''));
    setShow(true);
  }

  function openEdit(m: MaintenanceRecord) {
    setEditing(m);
    setForm(formFromRecord(m));
    setShow(true);
  }

  async function onSave(values: MaintenanceFormValues) {
    const body = payloadFromForm(values);
    if (editing) {
      await api(`/api/maintenance/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) });
    } else {
      await api('/api/maintenance', { method: 'POST', body: JSON.stringify(body) });
    }
    setShow(false);
    setEditing(null);
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
          <p>Service, MOT, PAT and LOLER bookings — costs, vendors and out-of-service tracking</p>
        </div>
        <button className="btn btn-primary" type="button" onClick={() => openCreate()}>
          Add maintenance
        </button>
      </div>

      <div className="stats-row" style={{ marginBottom: '1rem' }}>
        <div className="stat-chip">
          <span className="stat-chip-label">Records</span>
          <strong>{enriched.length}</strong>
        </div>
        <div className="stat-chip">
          <span className="stat-chip-label">Total cost</span>
          <strong>{gbp(totalCost)}</strong>
        </div>
        <div className="stat-chip">
          <span className="stat-chip-label">Open / booked cost</span>
          <strong>{gbp(openCost)}</strong>
        </div>
        <div className="stat-chip">
          <span className="stat-chip-label">Overdue</span>
          <strong>{enriched.filter((m) => m.overdue).length}</strong>
        </div>
      </div>

      <div className="filters">
        {(
          [
            ['all', 'All'],
            ['overdue', 'Overdue'],
            ['dueSoon', 'Due in 30 days'],
            ['scheduled', 'Scheduled'],
            ['in_progress', 'In progress'],
            ['completed', 'Completed'],
          ] as [Filter, string][]
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            className={`btn btn-sm ${filter === k ? 'btn-primary' : ''}`}
            onClick={() => setFilter(k)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="card">
        <table className="data">
          <thead>
            <tr>
              <th>Asset</th>
              <th>Type</th>
              <th>Scheduled</th>
              <th>Completed</th>
              <th>Next due</th>
              <th>Status</th>
              <th>Cost</th>
              <th>Vendor</th>
              <th>Out of service</th>
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
                <td>{formatDate(m.scheduledDate || m.date)}</td>
                <td>{formatDate(m.completedDate)}</td>
                <td>
                  {m.nextDue ? (
                    <span className={`badge ${m.overdue ? 'badge-red' : m.dueSoon ? 'badge-amber' : 'badge-grey'}`}>
                      {formatDate(m.nextDue)}
                      {m.overdue ? ' · Overdue' : ''}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td>
                  <span className={`badge ${statusBadge(m.status)}`}>{statusLabel(m.status as MaintStatus)}</span>
                </td>
                <td>{m.costGbp ? gbp(m.costGbp) : '—'}</td>
                <td>{m.vendor || '—'}</td>
                <td style={{ fontSize: '0.8rem' }}>
                  {m.outOfService ? formatOutOfService(m.outOfServiceStart, m.outOfServiceEnd) : '—'}
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn btn-sm" type="button" onClick={() => openEdit(m)}>
                    Edit
                  </button>{' '}
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
        <Modal title={editing ? 'Edit maintenance' : 'Add maintenance'} onClose={() => setShow(false)} large>
          <MaintenanceForm
            key={editing?.id || 'new'}
            assets={assets}
            initial={form}
            submitLabel={editing ? 'Update' : 'Save'}
            onSubmit={onSave}
            onCancel={() => setShow(false)}
          />
        </Modal>
      )}
    </div>
  );
}
