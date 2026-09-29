import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../lib/api';
import { formatDate, gbp, monthLabel } from '../lib/format';
import type { Asset, MaintenanceRecord } from '../types';
import { categoryLabel } from '../lib/categories';

type Tab = 'utilisation' | 'fuel' | 'maintenance' | 'location' | 'category';

type FuelReport = {
  rows: { name: string; sku: string; litres: number; costGbp: number; entries: number }[];
  byMonth?: { month: string; litres: number; costGbp: number; entries: number }[];
  totalCost: number;
  totalLitres: number;
};

type MaintReport = {
  rows: MaintenanceRecord[];
  summary: { overdue: number; dueSoon: number; ok: number; scheduled: number; totalCost: number };
  all?: MaintenanceRecord[];
};

const PIE_COLOURS = {
  overdue: '#dc2626',
  dueSoon: '#d97706',
  ok: '#16a34a',
};

const BAR_COLOURS = ['#2563eb', '#0891b2', '#7c3aed', '#059669', '#d97706', '#db2777', '#4f46e5'];

export function Reports() {
  const [tab, setTab] = useState<Tab>('utilisation');
  const [util, setUtil] = useState<{ name: string; sku: string; category: string; onJob: boolean; bookingDays: number; condition: string }[]>([]);
  const [fuel, setFuel] = useState<FuelReport | null>(null);
  const [maint, setMaint] = useState<MaintReport | null>(null);
  const [byLoc, setByLoc] = useState<Record<string, Asset[]>>({});
  const [byCat, setByCat] = useState<Record<string, Asset[]>>({});

  useEffect(() => {
    api<typeof util>('/api/reports/utilisation').then(setUtil);
    api<FuelReport>('/api/reports/fuel').then(setFuel);
    api<MaintReport | MaintenanceRecord[]>('/api/reports/maintenance-due').then((data) => {
      if (Array.isArray(data)) {
        const overdue = data.filter((m) => m.overdue).length;
        const dueSoon = data.filter((m) => m.dueSoon && !m.overdue).length;
        setMaint({
          rows: data,
          summary: { overdue, dueSoon, ok: 0, scheduled: 0, totalCost: 0 },
        });
      } else {
        setMaint(data);
      }
    });
    api<Record<string, Asset[]>>('/api/reports/by-location').then(setByLoc);
    api<Record<string, Asset[]>>('/api/reports/by-category').then(setByCat);
  }, []);

  const fuelByMonth = useMemo(
    () =>
      (fuel?.byMonth || []).map((m) => ({
        ...m,
        label: monthLabel(m.month),
      })),
    [fuel]
  );

  const fuelByAsset = useMemo(
    () =>
      (fuel?.rows || []).map((r) => ({
        ...r,
        shortName: r.name.length > 18 ? r.name.slice(0, 16) + '…' : r.name,
      })),
    [fuel]
  );

  const maintPie = useMemo(() => {
    if (!maint) return [];
    return [
      { name: 'Overdue', key: 'overdue', value: maint.summary.overdue },
      { name: 'Due soon', key: 'dueSoon', value: maint.summary.dueSoon },
      { name: 'OK', key: 'ok', value: maint.summary.ok },
    ].filter((d) => d.value > 0);
  }, [maint]);

  const upcomingBars = useMemo(() => {
    const rows = maint?.rows || [];
    const byType: Record<string, number> = {};
    for (const m of rows) {
      byType[m.type] = (byType[m.type] || 0) + 1;
    }
    return Object.entries(byType).map(([type, count]) => ({ type, count }));
  }, [maint]);

  return (
    <div className="print-area">
      <div className="page-header">
        <div>
          <h2>Reports</h2>
          <p>Printable operational summaries — use your browser print dialog</p>
        </div>
        <button className="btn no-print" type="button" onClick={() => window.print()}>
          Print / export
        </button>
      </div>

      <div className="tabs no-print">
        {(
          [
            ['utilisation', 'Asset utilisation'],
            ['fuel', 'Fuel costs'],
            ['maintenance', 'Maintenance due'],
            ['location', 'By location'],
            ['category', 'By category'],
          ] as [Tab, string][]
        ).map(([k, label]) => (
          <button key={k} type="button" className={`tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'utilisation' && (
        <div className="card">
          <div className="card-body">
            <h3 className="card-title">Asset utilisation</h3>
            <p style={{ color: 'var(--text-muted)', marginTop: 0 }}>Booking-days scheduled and current job assignment</p>
          </div>
          <table className="data">
            <thead>
              <tr>
                <th>Asset</th>
                <th>SKU</th>
                <th>Category</th>
                <th>Condition</th>
                <th>On job now</th>
                <th>Booking days</th>
              </tr>
            </thead>
            <tbody>
              {util.map((r) => (
                <tr key={r.sku}>
                  <td>{r.name}</td>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: '0.8rem' }}>{r.sku}</td>
                  <td>{categoryLabel(r.category)}</td>
                  <td>{r.condition}</td>
                  <td>{r.onJob ? 'Yes' : 'No'}</td>
                  <td>{r.bookingDays}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'fuel' && fuel && (
        <div className="grid" style={{ gap: '1rem' }}>
          <div className="charts-row no-print">
            <div className="card card-body chart-card">
              <h3 className="card-title">Fuel cost by month</h3>
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={fuelByMonth} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `£${v}`} width={48} />
                    <Tooltip formatter={(v: number) => gbp(v)} labelFormatter={(l) => String(l)} />
                    <Legend />
                    <Line type="monotone" dataKey="costGbp" name="Cost (£)" stroke="#2563eb" strokeWidth={2} dot />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card card-body chart-card">
              <h3 className="card-title">Fuel cost by asset</h3>
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={fuelByAsset} margin={{ top: 8, right: 12, left: 0, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="shortName" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={50} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `£${v}`} width={48} />
                    <Tooltip formatter={(v: number) => gbp(v)} />
                    <Bar dataKey="costGbp" name="Cost (£)" radius={[4, 4, 0, 0]}>
                      {fuelByAsset.map((_, i) => (
                        <Cell key={i} fill={BAR_COLOURS[i % BAR_COLOURS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <h3 className="card-title">Fuel costs summary</h3>
              <p style={{ color: 'var(--text-muted)', marginTop: 0 }}>
                Total {fuel.totalLitres.toFixed(0)} litres · {gbp(fuel.totalCost)}
              </p>
            </div>
            <table className="data">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>SKU</th>
                  <th>Entries</th>
                  <th>Litres</th>
                  <th>Cost (£)</th>
                </tr>
              </thead>
              <tbody>
                {fuel.rows.map((r) => (
                  <tr key={r.sku}>
                    <td>{r.name}</td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: '0.8rem' }}>{r.sku}</td>
                    <td>{r.entries}</td>
                    <td>{r.litres.toFixed(1)}</td>
                    <td>{gbp(r.costGbp)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>
                    <strong>Total</strong>
                  </td>
                  <td>
                    <strong>{fuel.totalLitres.toFixed(1)}</strong>
                  </td>
                  <td>
                    <strong>{gbp(fuel.totalCost)}</strong>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {tab === 'maintenance' && maint && (
        <div className="grid" style={{ gap: '1rem' }}>
          <div className="charts-row no-print">
            <div className="card card-body chart-card">
              <h3 className="card-title">Maintenance status</h3>
              <p style={{ color: 'var(--text-muted)', marginTop: 0, fontSize: '0.85rem' }}>
                Overdue vs due soon vs OK across the fleet
              </p>
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={maintPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                      {maintPie.map((d) => (
                        <Cell key={d.key} fill={PIE_COLOURS[d.key as keyof typeof PIE_COLOURS]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card card-body chart-card">
              <h3 className="card-title">Upcoming by type</h3>
              <p style={{ color: 'var(--text-muted)', marginTop: 0, fontSize: '0.85rem' }}>
                MOT / PAT / service and other open items
              </p>
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={upcomingBars} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="type" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={32} />
                    <Tooltip />
                    <Bar dataKey="count" name="Count" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <h3 className="card-title">Maintenance due / overdue</h3>
              <p style={{ color: 'var(--text-muted)', marginTop: 0 }}>
                {maint.summary.overdue} overdue · {maint.summary.dueSoon} due soon
                {maint.summary.totalCost ? ` · booked costs ${gbp(maint.summary.totalCost)}` : ''}
              </p>
            </div>
            <table className="data">
              <thead>
                <tr>
                  <th>Log no.</th>
                  <th>Asset</th>
                  <th>Type</th>
                  <th>Scheduled</th>
                  <th>Next due</th>
                  <th>Status</th>
                  <th>Cost</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {maint.rows.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <code style={{ fontSize: '0.8rem' }}>{m.logNumber || '—'}</code>
                    </td>
                    <td>
                      {m.assetName}
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{m.sku}</div>
                    </td>
                    <td>{m.type}</td>
                    <td>{formatDate(m.scheduledDate || m.date)}</td>
                    <td>{formatDate(m.nextDue)}</td>
                    <td>
                      {m.overdue ? (
                        <span className="badge badge-red">Overdue</span>
                      ) : m.dueSoon ? (
                        <span className="badge badge-amber">Due soon</span>
                      ) : (
                        <span className="badge badge-grey">{m.status || '—'}</span>
                      )}
                    </td>
                    <td>{m.costGbp ? gbp(m.costGbp) : '—'}</td>
                    <td>{m.notes || m.description || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'location' && (
        <div className="grid" style={{ gap: '1rem' }}>
          {Object.entries(byLoc).map(([loc, items]) => (
            <div key={loc} className="card">
              <div className="card-body">
                <h3 className="card-title">{loc}</h3>
              </div>
              <table className="data">
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th>Category</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((a) => (
                    <tr key={a.id}>
                      <td>{a.name}</td>
                      <td>{categoryLabel(a.category)}</td>
                      <td>{a.locationDescription || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {tab === 'category' && (
        <div className="grid" style={{ gap: '1rem' }}>
          {Object.entries(byCat).map(([cat, items]) => (
            <div key={cat} className="card">
              <div className="card-body">
                <h3 className="card-title">
                  {categoryLabel(cat)} ({items.length})
                </h3>
              </div>
              <table className="data">
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th>SKU</th>
                    <th>Condition</th>
                    <th>Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((a) => (
                    <tr key={a.id}>
                      <td>{a.name}</td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: '0.8rem' }}>{a.sku}</td>
                      <td>{a.condition}</td>
                      <td>{a.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
