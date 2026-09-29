import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { formatDate, gbp } from '../lib/format';
import type { Asset, MaintenanceRecord } from '../types';

type Tab = 'utilisation' | 'fuel' | 'maintenance' | 'location' | 'category';

export function Reports() {
  const [tab, setTab] = useState<Tab>('utilisation');
  const [util, setUtil] = useState<{ name: string; sku: string; category: string; onJob: boolean; bookingDays: number; condition: string }[]>([]);
  const [fuel, setFuel] = useState<{ rows: { name: string; sku: string; litres: number; costGbp: number; entries: number }[]; totalCost: number; totalLitres: number } | null>(null);
  const [maint, setMaint] = useState<MaintenanceRecord[]>([]);
  const [byLoc, setByLoc] = useState<Record<string, Asset[]>>({});
  const [byCat, setByCat] = useState<Record<string, Asset[]>>({});

  useEffect(() => {
    api<typeof util>('/api/reports/utilisation').then(setUtil);
    api<NonNullable<typeof fuel>>('/api/reports/fuel').then(setFuel);
    api<MaintenanceRecord[]>('/api/reports/maintenance-due').then(setMaint);
    api<Record<string, Asset[]>>('/api/reports/by-location').then(setByLoc);
    api<Record<string, Asset[]>>('/api/reports/by-category').then(setByCat);
  }, []);

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
                  <td>{r.category}</td>
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
      )}

      {tab === 'maintenance' && (
        <div className="card">
          <div className="card-body">
            <h3 className="card-title">Maintenance due / overdue</h3>
          </div>
          <table className="data">
            <thead>
              <tr>
                <th>Asset</th>
                <th>Type</th>
                <th>Next due</th>
                <th>Status</th>
                <th>Result</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {maint.map((m) => (
                <tr key={m.id}>
                  <td>
                    {m.assetName}
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{m.sku}</div>
                  </td>
                  <td>{m.type}</td>
                  <td>{formatDate(m.nextDue)}</td>
                  <td>
                    {m.overdue ? <span className="badge badge-red">Overdue</span> : m.dueSoon ? <span className="badge badge-amber">Due soon</span> : '—'}
                  </td>
                  <td>{m.result}</td>
                  <td>{m.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
                      <td>{a.category}</td>
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
                  {cat} ({items.length})
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
