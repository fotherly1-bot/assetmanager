import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { Modal } from '../components/Modal';
import { AvailabilityBadge, JobStatusBadge } from '../components/StatusBadge';
import { formatDate } from '../lib/format';
import { JOB_STATUSES, type Asset, type Customer, type Job, type JobStatus } from '../types';

interface Planner {
  jobs: Job[];
  assets: Asset[];
  customers: Customer[];
}

export function Jobs() {
  const [data, setData] = useState<Planner | null>(null);
  const [tab, setTab] = useState<'board' | 'list'>('board');
  const [show, setShow] = useState(false);
  const [editJob, setEditJob] = useState<Job | null>(null);
  const [form, setForm] = useState({
    title: '',
    customerId: '',
    status: 'Planned' as JobStatus,
    startDate: '',
    endDate: '',
    location: '',
    notes: '',
    requiredAssetIds: [] as string[],
  });

  function load() {
    api<Planner>('/api/planner').then(setData);
  }
  useEffect(() => {
    load();
  }, []);

  const columns = useMemo(() => {
    const order: JobStatus[] = ['Planned', 'In progress', 'On hold', 'Completed', 'Cancelled'];
    const map: Record<string, Job[]> = {};
    for (const s of order) map[s] = [];
    for (const j of data?.jobs || []) {
      if (!map[j.status]) map[j.status] = [];
      map[j.status].push(j);
    }
    return order.map((s) => ({ status: s, jobs: map[s] || [] }));
  }, [data]);

  function assetById(id: string) {
    return data?.assets.find((a) => a.id === id);
  }

  function customerName(id: string) {
    return data?.customers.find((c) => c.id === id)?.name || '—';
  }

  function openCreate() {
    setEditJob(null);
    setForm({
      title: '',
      customerId: data?.customers[0]?.id || '',
      status: 'Planned',
      startDate: '',
      endDate: '',
      location: '',
      notes: '',
      requiredAssetIds: [],
    });
    setShow(true);
  }

  function openEdit(j: Job) {
    setEditJob(j);
    setForm({
      title: j.title,
      customerId: j.customerId,
      status: j.status,
      startDate: j.startDate,
      endDate: j.endDate,
      location: j.location,
      notes: j.notes,
      requiredAssetIds: [...(j.requiredAssetIds || [])],
    });
    setShow(true);
  }

  function toggleAsset(id: string) {
    setForm((f) => ({
      ...f,
      requiredAssetIds: f.requiredAssetIds.includes(id) ? f.requiredAssetIds.filter((x) => x !== id) : [...f.requiredAssetIds, id],
    }));
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (editJob) {
      await api(`/api/jobs/${editJob.id}`, { method: 'PUT', body: JSON.stringify(form) });
    } else {
      await api('/api/jobs', { method: 'POST', body: JSON.stringify(form) });
    }
    setShow(false);
    load();
  }

  async function onDelete(j: Job) {
    if (!confirm(`Delete job “${j.title}”?`)) return;
    await api(`/api/jobs/${j.id}`, { method: 'DELETE' });
    load();
  }

  if (!data) return <div className="empty">Loading jobs…</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Jobs / Planner</h2>
          <p>Kanban board with asset availability highlighting</p>
        </div>
        <button className="btn btn-primary" type="button" onClick={openCreate}>
          Create job
        </button>
      </div>

      <div className="legend">
        <span>
          <i className="dot" style={{ background: '#16a34a' }} /> Available
        </span>
        <span>
          <i className="dot" style={{ background: '#1d4ed8' }} /> On another job
        </span>
        <span>
          <i className="dot" style={{ background: '#d97706' }} /> Booked
        </span>
        <span>
          <i className="dot" style={{ background: '#dc2626' }} /> Maintenance / out of service
        </span>
      </div>

      <div className="tabs">
        <button type="button" className={`tab ${tab === 'board' ? 'active' : ''}`} onClick={() => setTab('board')}>
          Planner board
        </button>
        <button type="button" className={`tab ${tab === 'list' ? 'active' : ''}`} onClick={() => setTab('list')}>
          Job list
        </button>
      </div>

      {tab === 'board' && (
        <div className="kanban">
          {columns.map((col) => (
            <div key={col.status} className="kanban-col">
              <h4>
                {col.status} ({col.jobs.length})
              </h4>
              {col.jobs.map((j) => (
                <div key={j.id} className="kanban-card" onClick={() => openEdit(j)}>
                  <h5>{j.title}</h5>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                    {customerName(j.customerId)}
                    <br />
                    {formatDate(j.startDate)} – {formatDate(j.endDate)}
                  </div>
                  <div>
                    {(j.requiredAssetIds || []).map((aid) => {
                      const a = assetById(aid);
                      const avail = a?.availability || 'available';
                      return (
                        <span key={aid} className={`asset-chip chip-${avail}`} title={a?.name}>
                          {a?.name || aid}
                        </span>
                      );
                    })}
                    {(j.requiredAssetIds || []).length === 0 && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No assets required</span>}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {tab === 'list' && (
        <div className="card">
          <table className="data">
            <thead>
              <tr>
                <th>Job</th>
                <th>Customer</th>
                <th>Status</th>
                <th>Dates</th>
                <th>Assets</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.jobs.map((j) => (
                <tr key={j.id}>
                  <td>
                    <strong>{j.title}</strong>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{j.location}</div>
                  </td>
                  <td>{customerName(j.customerId)}</td>
                  <td>
                    <JobStatusBadge status={j.status} />
                  </td>
                  <td>
                    {formatDate(j.startDate)} – {formatDate(j.endDate)}
                  </td>
                  <td>
                    {(j.requiredAssetIds || []).map((aid) => {
                      const a = assetById(aid);
                      return (
                        <span key={aid} className={`asset-chip chip-${a?.availability || 'available'}`}>
                          {a?.sku || aid}
                        </span>
                      );
                    })}
                  </td>
                  <td>
                    <button className="btn btn-sm" type="button" onClick={() => openEdit(j)}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {show && (
        <Modal title={editJob ? 'Edit job' : 'Create job'} onClose={() => setShow(false)} large>
          <form className="form-grid" onSubmit={onSave}>
            <div className="form-row">
              <label>Title</label>
              <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="form-inline">
              <div className="form-row">
                <label>Customer</label>
                <select required value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
                  {data.customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <label>Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as JobStatus })}>
                  {JOB_STATUSES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-inline">
              <div className="form-row">
                <label>Start date</label>
                <input type="date" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </div>
              <div className="form-row">
                <label>End date</label>
                <input type="date" required value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </div>
            </div>
            <div className="form-row">
              <label>Location</label>
              <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
            <div className="form-row">
              <label>Required assets (coloured by availability)</label>
              <div style={{ maxHeight: 200, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 6, padding: '0.5rem' }}>
                {data.assets.map((a) => (
                  <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0', cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.requiredAssetIds.includes(a.id)} onChange={() => toggleAsset(a.id)} />
                    <span className={`asset-chip chip-${a.availability || 'available'}`}>{a.name}</span>
                    <AvailabilityBadge availability={a.availability || 'available'} />
                  </label>
                ))}
              </div>
            </div>
            <div className="form-row">
              <label>Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="form-actions">
              {editJob && (
                <button type="button" className="btn btn-danger" style={{ marginRight: 'auto' }} onClick={() => onDelete(editJob)}>
                  Delete
                </button>
              )}
              <button type="button" className="btn" onClick={() => setShow(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Save job
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
