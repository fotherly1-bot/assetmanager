import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { FuelBar } from '../components/FuelBar';
import { ConditionBadge, JobStatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { daysOnJob, formatDate, gbp, todayISO } from '../lib/format';
import type { Asset, FuelLog, MaintenanceRecord } from '../types';

export function AssetDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [fuelOpen, setFuelOpen] = useState(false);
  const [levelOpen, setLevelOpen] = useState(false);
  const [fuelForm, setFuelForm] = useState({ date: todayISO(), litres: '', costGbp: '', odometerOrHours: '', notes: '' });
  const [level, setLevel] = useState('');

  function load() {
    if (!id) return;
    api<Asset>(`/api/assets/${id}`).then((a) => {
      setAsset(a);
      setLevel(String(a.fuelLevelLitres ?? ''));
    });
  }

  useEffect(() => {
    load();
  }, [id]);

  async function saveFuel(e: FormEvent) {
    e.preventDefault();
    await api('/api/fuel', {
      method: 'POST',
      body: JSON.stringify({
        assetId: id,
        date: fuelForm.date,
        litres: Number(fuelForm.litres),
        costGbp: Number(fuelForm.costGbp),
        odometerOrHours: fuelForm.odometerOrHours === '' ? null : Number(fuelForm.odometerOrHours),
        notes: fuelForm.notes,
      }),
    });
    setFuelOpen(false);
    setFuelForm({ date: todayISO(), litres: '', costGbp: '', odometerOrHours: '', notes: '' });
    load();
  }

  async function saveLevel(e: FormEvent) {
    e.preventDefault();
    await api(`/api/assets/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ fuelLevelLitres: Number(level) }),
    });
    setLevelOpen(false);
    load();
  }

  async function remove() {
    if (!confirm('Delete this asset?')) return;
    await api(`/api/assets/${id}`, { method: 'DELETE' });
    navigate('/assets');
  }

  if (!asset) return <div className="empty">Loading asset…</div>;

  const hasFuel = asset.fuelTankLitres != null && asset.fuelTankLitres > 0;
  const logs = (asset.fuelLogs || []) as FuelLog[];
  const maint = (asset.maintenance || []) as MaintenanceRecord[];
  const today = todayISO();

  return (
    <div>
      <div className="page-header">
        <div>
          <p style={{ margin: 0 }}>
            <Link to="/assets">Assets</Link> / {asset.sku}
          </p>
          <h2>{asset.name}</h2>
          <p>
            {asset.category} · <ConditionBadge condition={asset.condition} />
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {hasFuel && (
            <>
              <button className="btn" type="button" onClick={() => setLevelOpen(true)}>
                Set fuel level
              </button>
              <button className="btn btn-primary" type="button" onClick={() => setFuelOpen(true)}>
                Log fuel cost
              </button>
            </>
          )}
          <button className="btn btn-danger" type="button" onClick={remove}>
            Delete
          </button>
        </div>
      </div>

      <div className="detail-grid">
        <div className="grid" style={{ gap: '1rem' }}>
          <div className="card card-body">
            <h3 className="card-title">Overview</h3>
            <dl className="dl">
              <dt>SKU</dt>
              <dd style={{ fontFamily: 'var(--mono)' }}>{asset.sku}</dd>
              <dt>Condition</dt>
              <dd>
                <ConditionBadge condition={asset.condition} />
              </dd>
              <dt>Quantity</dt>
              <dd>
                {asset.quantity}
                {asset.reorderLevel != null ? ` (reorder at ${asset.reorderLevel})` : ''}
              </dd>
              <dt>Location</dt>
              <dd>
                {asset.locationDescription || '—'}
                {asset.postcode ? ` · ${asset.postcode}` : ''}
              </dd>
              <dt>GPS</dt>
              <dd>
                {asset.locationLat != null && asset.locationLng != null
                  ? `${asset.locationLat.toFixed(4)}, ${asset.locationLng.toFixed(4)}`
                  : 'Not set'}
              </dd>
              <dt>Notes</dt>
              <dd>{asset.notes || '—'}</dd>
            </dl>
          </div>

          {(asset.category === 'Vehicles' || asset.category === 'Machinery / plant' || hasFuel) && (
            <div className="card card-body">
              <h3 className="card-title">Current assignment</h3>
              {asset.currentJob ? (
                <dl className="dl">
                  <dt>Job</dt>
                  <dd>
                    <Link to={`/jobs?jobId=${encodeURIComponent(asset.currentJob.id)}`}>{asset.currentJob.title}</Link> <JobStatusBadge status={asset.currentJob.status} />
                  </dd>
                  <dt>Location</dt>
                  <dd>{asset.currentJob.location || asset.locationDescription || '—'}</dd>
                  <dt>Time on job</dt>
                  <dd>{daysOnJob(asset.jobAssignedAt)}</dd>
                  <dt>Dates</dt>
                  <dd>
                    {formatDate(asset.currentJob.startDate)} – {formatDate(asset.currentJob.endDate)}
                  </dd>
                </dl>
              ) : (
                <p style={{ color: 'var(--text-muted)', margin: 0 }}>Not currently assigned to a job.</p>
              )}
            </div>
          )}

          {hasFuel && (
            <div className="card card-body">
              <h3 className="card-title">Fuel</h3>
              <FuelBar level={asset.fuelLevelLitres} tank={asset.fuelTankLitres} />
              <h4 style={{ margin: '1rem 0 0.5rem', fontSize: '0.85rem' }}>Fuel cost log</h4>
              <table className="data">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Litres</th>
                    <th>Cost</th>
                    <th>Odo / hrs</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((f) => (
                    <tr key={f.id}>
                      <td>{formatDate(f.date)}</td>
                      <td>{f.litres}</td>
                      <td>{gbp(f.costGbp)}</td>
                      <td>{f.odometerOrHours ?? '—'}</td>
                      <td>{f.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {logs.length === 0 && <div className="empty">No fuel entries yet</div>}
            </div>
          )}
        </div>

        <div className="grid" style={{ gap: '1rem' }}>
          <div className="card card-body">
            <h3 className="card-title">Maintenance summary</h3>
            <table className="data">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Next due</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {maint.map((m) => {
                  const overdue = m.nextDue && m.nextDue < today;
                  return (
                    <tr key={m.id}>
                      <td>{m.type}</td>
                      <td>
                        <span className={`badge ${overdue ? 'badge-red' : 'badge-grey'}`}>{formatDate(m.nextDue)}</span>
                      </td>
                      <td>
                        <span className={`badge ${m.result === 'Fail' ? 'badge-red' : m.result === 'Pass' ? 'badge-green' : 'badge-amber'}`}>
                          {m.result}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {maint.length === 0 && <div className="empty">No maintenance records</div>}
            <p style={{ marginTop: '0.75rem' }}>
              <Link to="/maintenance">View all maintenance →</Link>
            </p>
          </div>

          <div className="card card-body">
            <h3 className="card-title">Bookings</h3>
            <table className="data">
              <thead>
                <tr>
                  <th>From</th>
                  <th>To</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {(asset.bookings || []).map((b) => (
                  <tr key={b.id}>
                    <td>{formatDate(b.startDate)}</td>
                    <td>{formatDate(b.endDate)}</td>
                    <td>{b.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(asset.bookings || []).length === 0 && <div className="empty">No bookings</div>}
            <p style={{ marginTop: '0.75rem' }}>
              <Link to="/calendar">Open calendar →</Link>
            </p>
          </div>
        </div>
      </div>

      {fuelOpen && (
        <Modal title="Log fuel cost" onClose={() => setFuelOpen(false)}>
          <form className="form-grid" onSubmit={saveFuel}>
            <div className="form-inline">
              <div className="form-row">
                <label>Date</label>
                <input type="date" required value={fuelForm.date} onChange={(e) => setFuelForm({ ...fuelForm, date: e.target.value })} />
              </div>
              <div className="form-row">
                <label>Litres</label>
                <input type="number" step="0.1" required value={fuelForm.litres} onChange={(e) => setFuelForm({ ...fuelForm, litres: e.target.value })} />
              </div>
            </div>
            <div className="form-inline">
              <div className="form-row">
                <label>Cost (£)</label>
                <input type="number" step="0.01" required value={fuelForm.costGbp} onChange={(e) => setFuelForm({ ...fuelForm, costGbp: e.target.value })} />
              </div>
              <div className="form-row">
                <label>Odometer / hours</label>
                <input type="number" value={fuelForm.odometerOrHours} onChange={(e) => setFuelForm({ ...fuelForm, odometerOrHours: e.target.value })} />
              </div>
            </div>
            <div className="form-row">
              <label>Notes</label>
              <input value={fuelForm.notes} onChange={(e) => setFuelForm({ ...fuelForm, notes: e.target.value })} />
            </div>
            <div className="form-actions">
              <button type="button" className="btn" onClick={() => setFuelOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Save entry
              </button>
            </div>
          </form>
        </Modal>
      )}

      {levelOpen && (
        <Modal title="Set fuel level" onClose={() => setLevelOpen(false)}>
          <form className="form-grid" onSubmit={saveLevel}>
            <div className="form-row">
              <label>Current fuel level (litres) — tank capacity {asset.fuelTankLitres} L</label>
              <input type="number" step="0.1" required value={level} onChange={(e) => setLevel(e.target.value)} max={asset.fuelTankLitres ?? undefined} />
            </div>
            <div className="form-actions">
              <button type="button" className="btn" onClick={() => setLevelOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Update level
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
