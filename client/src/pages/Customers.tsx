import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Modal } from '../components/Modal';
import { JobStatusBadge } from '../components/StatusBadge';
import { formatDate } from '../lib/format';
import type { Customer, Job } from '../types';

const empty = { name: '', contactName: '', contactEmail: '', contactPhone: '', address: '', notes: '' };

const ACTIVE_STATUSES = new Set(['Planned', 'In progress', 'On hold']);

export function Customers() {
  const [list, setList] = useState<Customer[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobTab, setJobTab] = useState<'active' | 'completed'>('active');
  const [show, setShow] = useState(false);
  const [edit, setEdit] = useState<Customer | null>(null);
  const [form, setForm] = useState(empty);
  const { id } = useParams();
  const navigate = useNavigate();

  function load() {
    api<Customer[]>('/api/customers').then(setList);
  }
  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!id) {
      setJobs([]);
      return;
    }
    setJobsLoading(true);
    api<Job[]>(`/api/jobs?customerId=${encodeURIComponent(id)}`)
      .then(setJobs)
      .catch(() => setJobs([]))
      .finally(() => setJobsLoading(false));
    setJobTab('active');
  }, [id]);

  const selected = id ? list.find((c) => c.id === id) : null;

  const { activeJobs, completedJobs } = useMemo(() => {
    const active: Job[] = [];
    const completed: Job[] = [];
    for (const j of jobs) {
      if (ACTIVE_STATUSES.has(j.status)) active.push(j);
      else completed.push(j);
    }
    const byStart = (a: Job, b: Job) => String(b.startDate || '').localeCompare(String(a.startDate || ''));
    active.sort(byStart);
    completed.sort(byStart);
    return { activeJobs: active, completedJobs: completed };
  }, [jobs]);

  const shownJobs = jobTab === 'active' ? activeJobs : completedJobs;

  function openCreate() {
    setEdit(null);
    setForm(empty);
    setShow(true);
  }

  function openEdit(c: Customer) {
    setEdit(c);
    setForm({
      name: c.name,
      contactName: c.contactName,
      contactEmail: c.contactEmail,
      contactPhone: c.contactPhone,
      address: c.address,
      notes: c.notes,
    });
    setShow(true);
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (edit) {
      await api(`/api/customers/${edit.id}`, { method: 'PUT', body: JSON.stringify(form) });
    } else {
      await api('/api/customers', { method: 'POST', body: JSON.stringify(form) });
    }
    setShow(false);
    load();
  }

  async function onDelete(c: Customer) {
    if (!confirm(`Delete customer ${c.name}?`)) return;
    await api(`/api/customers/${c.id}`, { method: 'DELETE' });
    if (id === c.id) navigate('/customers');
    load();
  }

  function goToJob(jobId: string) {
    navigate(`/jobs?jobId=${encodeURIComponent(jobId)}`);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Customers</h2>
          <p>Highways authorities and principal contractors</p>
        </div>
        <button className="btn btn-primary" type="button" onClick={openCreate}>
          Add customer
        </button>
      </div>

      <div className="detail-grid">
        <div className="card">
          <table className="data">
            <thead>
              <tr>
                <th>Name</th>
                <th>Contact</th>
                <th>Phone</th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id} className="clickable" onClick={() => navigate(`/customers/${c.id}`)}>
                  <td>
                    <Link to={`/customers/${c.id}`} onClick={(e) => e.stopPropagation()}>
                      {c.name}
                    </Link>
                  </td>
                  <td>{c.contactName}</td>
                  <td>{c.contactPhone}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card card-body">
          {selected ? (
            <>
              <h3 className="card-title">{selected.name}</h3>
              <dl className="dl">
                <dt>Contact</dt>
                <dd>{selected.contactName}</dd>
                <dt>Email</dt>
                <dd>{selected.contactEmail || '—'}</dd>
                <dt>Phone</dt>
                <dd>{selected.contactPhone || '—'}</dd>
                <dt>Address</dt>
                <dd>{selected.address || '—'}</dd>
                <dt>Notes</dt>
                <dd>{selected.notes || '—'}</dd>
              </dl>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <button className="btn" type="button" onClick={() => openEdit(selected)}>
                  Edit
                </button>
                <button className="btn btn-danger" type="button" onClick={() => onDelete(selected)}>
                  Delete
                </button>
              </div>
            </>
          ) : (
            <div className="empty">Select a customer to view details</div>
          )}
        </div>
      </div>

      {selected && (
        <div className="card" style={{ marginTop: '1rem' }}>
          <div className="card-body" style={{ paddingBottom: 0 }}>
            <h3 className="card-title" style={{ marginBottom: '0.75rem' }}>
              Jobs for {selected.name}
            </h3>
            <div className="tabs">
              <button
                type="button"
                className={`tab ${jobTab === 'active' ? 'active' : ''}`}
                onClick={() => setJobTab('active')}
              >
                Active jobs ({activeJobs.length})
              </button>
              <button
                type="button"
                className={`tab ${jobTab === 'completed' ? 'active' : ''}`}
                onClick={() => setJobTab('completed')}
              >
                Completed jobs ({completedJobs.length})
              </button>
            </div>
          </div>
          {jobsLoading ? (
            <div className="empty">Loading jobs…</div>
          ) : shownJobs.length === 0 ? (
            <div className="empty">
              {jobTab === 'active' ? 'No active jobs for this customer' : 'No completed or cancelled jobs for this customer'}
            </div>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Status</th>
                  <th>Dates</th>
                  <th>Location</th>
                  <th>Assets</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {shownJobs.map((j) => (
                  <tr key={j.id}>
                    <td>
                      <strong>{j.title}</strong>
                      {j.notes ? (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: 280 }} className="truncate">
                          {j.notes}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      <JobStatusBadge status={j.status} />
                    </td>
                    <td>
                      {formatDate(j.startDate)} – {formatDate(j.endDate)}
                    </td>
                    <td>{j.location || '—'}</td>
                    <td>{(j.requiredAssetIds || []).length}</td>
                    <td>
                      <button className="btn btn-sm btn-primary" type="button" onClick={() => goToJob(j.id)}>
                        Go to job
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {show && (
        <Modal title={edit ? 'Edit customer' : 'Add customer'} onClose={() => setShow(false)}>
          <form className="form-grid" onSubmit={onSave}>
            <div className="form-row">
              <label>Organisation name</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="form-inline">
              <div className="form-row">
                <label>Contact name</label>
                <input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
              </div>
              <div className="form-row">
                <label>Phone</label>
                <input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} />
              </div>
            </div>
            <div className="form-row">
              <label>Email</label>
              <input type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} />
            </div>
            <div className="form-row">
              <label>Address</label>
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
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
