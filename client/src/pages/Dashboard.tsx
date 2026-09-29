import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { FuelBar } from '../components/FuelBar';
import { formatDate } from '../lib/format';
import type { Asset, Booking, MaintenanceRecord } from '../types';

interface Dash {
  stats: {
    totalAssets: number;
    assetsOnJobs: number;
    lowFuel: number;
    maintenanceDue: number;
    activeJobs: number;
    customers: number;
  };
  lowFuel: Asset[];
  maintDue: MaintenanceRecord[];
  upcoming: Booking[];
  assetsOnJobs: Asset[];
}

export function Dashboard() {
  const [data, setData] = useState<Dash | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [jobs, setJobs] = useState<{ id: string; title: string }[]>([]);

  useEffect(() => {
    Promise.all([
      api<Dash>('/api/dashboard'),
      api<Asset[]>('/api/assets'),
      api<{ id: string; title: string }[]>('/api/jobs'),
    ]).then(([d, a, j]) => {
      setData(d);
      setAssets(a);
      setJobs(j);
    });
  }, []);

  if (!data) return <div className="empty">Loading dashboard…</div>;

  const assetName = (id: string) => assets.find((a) => a.id === id)?.name || id;
  const jobTitle = (id: string | null) => (id ? jobs.find((j) => j.id === id)?.title || id : '—');

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Dashboard</h2>
          <p>Operations overview for plant, fuel and jobs</p>
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: '1.25rem' }}>
        <div className="card stat-card stat-ok">
          <div className="label">Assets on jobs</div>
          <div className="value">{data.stats.assetsOnJobs}</div>
          <div className="hint">of {data.stats.totalAssets} total</div>
        </div>
        <div className={`card stat-card ${data.stats.lowFuel ? 'stat-danger' : ''}`}>
          <div className="label">Fuel low alerts</div>
          <div className="value">{data.stats.lowFuel}</div>
          <div className="hint">≤ threshold</div>
        </div>
        <div className={`card stat-card ${data.stats.maintenanceDue ? 'stat-warn' : ''}`}>
          <div className="label">Maintenance due</div>
          <div className="value">{data.stats.maintenanceDue}</div>
          <div className="hint">Overdue / due today</div>
        </div>
        <div className="card stat-card">
          <div className="label">Active jobs</div>
          <div className="value">{data.stats.activeJobs}</div>
          <div className="hint">{data.stats.customers} customers</div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card card-body">
          <h3 className="card-title">Fuel low alerts</h3>
          {data.lowFuel.length === 0 ? (
            <p className="empty" style={{ padding: '1rem' }}>All tanks above threshold</p>
          ) : (
            <ul className="alert-list">
              {data.lowFuel.map((a) => (
                <li key={a.id}>
                  <div>
                    <Link to={`/assets/${a.id}`}>{a.name}</Link>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{a.sku}</div>
                  </div>
                  <div style={{ width: 120 }}>
                    <FuelBar level={a.fuelLevelLitres} tank={a.fuelTankLitres} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card card-body">
          <h3 className="card-title">Maintenance overdue</h3>
          {data.maintDue.length === 0 ? (
            <p className="empty" style={{ padding: '1rem' }}>Nothing overdue</p>
          ) : (
            <ul className="alert-list">
              {data.maintDue.slice(0, 8).map((m) => (
                <li key={m.id}>
                  <div>
                    <strong>{m.type}</strong> · {assetName(m.assetId)}
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{m.notes || '—'}</div>
                  </div>
                  <span className="badge badge-red">{formatDate(m.nextDue)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card card-body">
          <h3 className="card-title">Assets currently on jobs</h3>
          {data.assetsOnJobs.length === 0 ? (
            <p className="empty" style={{ padding: '1rem' }}>None assigned</p>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Job</th>
                  <th>Location</th>
                </tr>
              </thead>
              <tbody>
                {data.assetsOnJobs.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <Link to={`/assets/${a.id}`}>{a.name}</Link>
                    </td>
                    <td>{jobTitle(a.currentJobId)}</td>
                    <td>{a.locationDescription || a.postcode || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card card-body">
          <h3 className="card-title">Upcoming bookings</h3>
          {data.upcoming.length === 0 ? (
            <p className="empty" style={{ padding: '1rem' }}>No upcoming bookings</p>
          ) : (
            <ul className="alert-list">
              {data.upcoming.map((b) => (
                <li key={b.id}>
                  <div>
                    <strong>{assetName(b.assetId)}</strong>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{jobTitle(b.jobId)} · {b.notes || 'Booking'}</div>
                  </div>
                  <span className="badge badge-blue">
                    {formatDate(b.startDate)} – {formatDate(b.endDate)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
