import { FormEvent, Fragment, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { Modal } from '../components/Modal';
import { formatDate, overlaps, todayISO } from '../lib/format';
import type { Asset, Booking, Job } from '../types';

function addDays(iso: string, n: number) {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export function CalendarPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [weekStart, setWeekStart] = useState(() => {
    const t = new Date();
    const day = t.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    t.setDate(t.getDate() + diff);
    return t.toISOString().slice(0, 10);
  });
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({
    assetId: '',
    jobId: '',
    startDate: todayISO(),
    endDate: todayISO(),
    notes: '',
  });

  function load() {
    Promise.all([api<Booking[]>('/api/bookings'), api<Asset[]>('/api/assets'), api<Job[]>('/api/jobs')]).then(([b, a, j]) => {
      setBookings(b);
      setAssets(a);
      setJobs(j);
      if (!form.assetId && a[0]) setForm((f) => ({ ...f, assetId: a[0].id }));
    });
  }

  useEffect(() => {
    load();
  }, []);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const plantAssets = useMemo(
    () => assets.filter((a) => a.category === 'Vehicles' || a.category === 'Machinery / plant' || a.category === 'Power tools'),
    [assets]
  );

  function bookingsFor(assetId: string, day: string) {
    return bookings.filter((b) => b.assetId === assetId && b.startDate <= day && b.endDate >= day);
  }

  function hasConflict(assetId: string, start: string, end: string, excludeId?: string) {
    return bookings.some((b) => b.assetId === assetId && b.id !== excludeId && overlaps(b.startDate, b.endDate, start, end));
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    await api('/api/bookings', { method: 'POST', body: JSON.stringify({ ...form, jobId: form.jobId || null }) });
    setShow(false);
    load();
  }

  async function remove(id: string) {
    if (!confirm('Remove this booking?')) return;
    await api(`/api/bookings/${id}`, { method: 'DELETE' });
    load();
  }

  const conflictPreview = form.assetId && form.startDate && form.endDate && hasConflict(form.assetId, form.startDate, form.endDate);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Calendar</h2>
          <p>Asset bookings for future jobs — conflicts highlighted in red</p>
        </div>
        <button className="btn btn-primary" type="button" onClick={() => setShow(true)}>
          Book asset
        </button>
      </div>

      <div className="filters">
        <button className="btn btn-sm" type="button" onClick={() => setWeekStart(addDays(weekStart, -7))}>
          ← Previous week
        </button>
        <strong>
          Week of {formatDate(weekStart)}
        </strong>
        <button className="btn btn-sm" type="button" onClick={() => setWeekStart(addDays(weekStart, 7))}>
          Next week →
        </button>
        <button className="btn btn-sm" type="button" onClick={() => setWeekStart(todayISO())}>
          This week
        </button>
      </div>

      <div className="calendar-grid">
        <div className="cal-cell cal-head">Asset</div>
        {days.map((d) => (
          <div key={d} className="cal-cell cal-head">
            {new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
          </div>
        ))}
        {plantAssets.map((a) => (
          <Fragment key={a.id}>
            <div className="cal-cell cal-asset">
              {a.name}
              <div style={{ fontWeight: 400, fontSize: '0.7rem', color: 'var(--text-muted)' }}>{a.sku}</div>
            </div>
            {days.map((d) => {
              const cells = bookingsFor(a.id, d);
              const conflict = cells.length > 1;
              return (
                <div key={`${a.id}-${d}`} className="cal-cell">
                  {cells.map((b) => {
                    const job = jobs.find((j) => j.id === b.jobId);
                    return (
                      <div key={b.id} className={`cal-event ${conflict ? 'cal-conflict' : ''}`} title={b.notes || job?.title || 'Booking'}>
                        {job?.title || b.notes || 'Reserved'}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>

      <div className="card card-body" style={{ marginTop: '1.25rem' }}>
        <h3 className="card-title">All bookings</h3>
        <table className="data">
          <thead>
            <tr>
              <th>Asset</th>
              <th>Job</th>
              <th>From</th>
              <th>To</th>
              <th>Conflict</th>
              <th>Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {bookings
              .slice()
              .sort((a, b) => a.startDate.localeCompare(b.startDate))
              .map((b) => {
                const conflict = hasConflict(b.assetId, b.startDate, b.endDate, b.id);
                return (
                  <tr key={b.id}>
                    <td>{assets.find((a) => a.id === b.assetId)?.name || b.assetId}</td>
                    <td>{jobs.find((j) => j.id === b.jobId)?.title || '—'}</td>
                    <td>{formatDate(b.startDate)}</td>
                    <td>{formatDate(b.endDate)}</td>
                    <td>{conflict ? <span className="badge badge-red">Conflict</span> : <span className="badge badge-green">OK</span>}</td>
                    <td>{b.notes || '—'}</td>
                    <td>
                      <button className="btn btn-sm btn-danger" type="button" onClick={() => remove(b.id)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {show && (
        <Modal title="Book asset" onClose={() => setShow(false)}>
          <form className="form-grid" onSubmit={onSave}>
            <div className="form-row">
              <label>Asset</label>
              <select required value={form.assetId} onChange={(e) => setForm({ ...form, assetId: e.target.value })}>
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.sku})
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label>Job (optional)</label>
              <select value={form.jobId} onChange={(e) => setForm({ ...form, jobId: e.target.value })}>
                <option value="">— None —</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-inline">
              <div className="form-row">
                <label>Start</label>
                <input type="date" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </div>
              <div className="form-row">
                <label>End</label>
                <input type="date" required value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </div>
            </div>
            {conflictPreview && (
              <div className="login-error">Warning: this asset already has a booking overlapping these dates.</div>
            )}
            <div className="form-row">
              <label>Notes</label>
              <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="form-actions">
              <button type="button" className="btn" onClick={() => setShow(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Save booking
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
