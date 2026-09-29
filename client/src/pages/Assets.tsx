import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { FuelBar } from '../components/FuelBar';
import { ConditionBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import {
  MaintenanceForm,
  emptyMaintForm,
  payloadFromForm,
  type MaintenanceFormValues,
} from '../components/MaintenanceForm';
import { CATEGORIES, CONDITIONS, type Asset, type Category, type Condition } from '../types';
import { categoryLabel } from '../lib/categories';

const emptyForm = {
  name: '',
  sku: '',
  category: 'Vehicles' as Category,
  condition: 'Good' as Condition,
  fuelTankLitres: '' as string | number,
  fuelLevelLitres: '' as string | number,
  locationDescription: '',
  postcode: '',
  locationLat: '' as string | number,
  locationLng: '' as string | number,
  quantity: 1 as string | number,
  reorderLevel: '' as string | number,
  notes: '',
};

export function Assets() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [show, setShow] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [maintOpen, setMaintOpen] = useState(false);
  const [maintForm, setMaintForm] = useState<MaintenanceFormValues>(emptyMaintForm());
  const navigate = useNavigate();

  function load() {
    api<Asset[]>('/api/assets').then(setAssets);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    return assets.filter((a) => {
      if (cat && a.category !== cat) return false;
      if (!q) return true;
      const s = q.toLowerCase();
      return a.name.toLowerCase().includes(s) || a.sku.toLowerCase().includes(s) || a.postcode.toLowerCase().includes(s);
    });
  }, [assets, q, cat]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    await api('/api/assets', {
      method: 'POST',
      body: JSON.stringify({
        ...form,
        fuelTankLitres: form.fuelTankLitres === '' ? null : Number(form.fuelTankLitres),
        fuelLevelLitres: form.fuelLevelLitres === '' ? null : Number(form.fuelLevelLitres),
        locationLat: form.locationLat === '' ? null : Number(form.locationLat),
        locationLng: form.locationLng === '' ? null : Number(form.locationLng),
        quantity: Number(form.quantity) || 1,
        reorderLevel: form.reorderLevel === '' ? null : Number(form.reorderLevel),
      }),
    });
    setShow(false);
    setForm(emptyForm);
    load();
  }

  function openMaint(assetId: string) {
    setMaintForm(emptyMaintForm(assetId));
    setMaintOpen(true);
  }

  async function saveMaint(values: MaintenanceFormValues) {
    await api('/api/maintenance', {
      method: 'POST',
      body: JSON.stringify(payloadFromForm(values)),
    });
    setMaintOpen(false);
    load();
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Assets</h2>
          <p>Vehicles, plant, tools and materials across the fleet</p>
        </div>
        <button className="btn btn-primary" type="button" onClick={() => setShow(true)}>
          Add asset
        </button>
      </div>

      <div className="filters">
        <input placeholder="Search name, SKU, postcode…" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 220 }} />
        <select value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {categoryLabel(c)}
            </option>
          ))}
        </select>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{filtered.length} assets</span>
      </div>

      <div className="card">
        <table className="data">
          <thead>
            <tr>
              <th>Name</th>
              <th>SKU</th>
              <th>Category</th>
              <th>Condition</th>
              <th>Fuel</th>
              <th>Location</th>
              <th>Job</th>
              <th className="no-print"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <tr key={a.id} className="clickable" onClick={() => navigate(`/assets/${a.id}`)}>
                <td>
                  <Link to={`/assets/${a.id}`} onClick={(e) => e.stopPropagation()}>
                    {a.name}
                  </Link>
                </td>
                <td style={{ fontFamily: 'var(--mono)', fontSize: '0.8rem' }}>{a.sku}</td>
                <td>{categoryLabel(a.category)}</td>
                <td>
                  <ConditionBadge condition={a.condition} />
                </td>
                <td style={{ minWidth: 110 }}>
                  <FuelBar level={a.fuelLevelLitres} tank={a.fuelTankLitres} showLabel={false} />
                </td>
                <td>{a.postcode || a.locationDescription || '—'}</td>
                <td>{a.currentJobId ? <span className="badge badge-blue">Assigned</span> : <span className="badge">Idle</span>}</td>
                <td className="no-print" onClick={(e) => e.stopPropagation()}>
                  <button className="btn btn-sm" type="button" onClick={() => openMaint(a.id)}>
                    Add maintenance
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="empty">No assets match your filters</div>}
      </div>

      {maintOpen && (
        <Modal title="Add maintenance" onClose={() => setMaintOpen(false)} large>
          <MaintenanceForm
            assets={assets}
            initial={maintForm}
            submitLabel="Save booking"
            onSubmit={saveMaint}
            onCancel={() => setMaintOpen(false)}
          />
        </Modal>
      )}

      {show && (
        <Modal title="Add asset" onClose={() => setShow(false)} large>
          <form className="form-grid" onSubmit={onCreate}>
            <div className="form-inline">
              <div className="form-row">
                <label>Name</label>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="form-row">
                <label>SKU</label>
                <input required value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
              </div>
            </div>
            <div className="form-inline">
              <div className="form-row">
                <label>Category</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as Category })}>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {categoryLabel(c)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <label>Condition</label>
                <select value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value as Condition })}>
                  {CONDITIONS.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-inline">
              <div className="form-row">
                <label>Fuel tank (litres)</label>
                <input type="number" step="0.1" value={form.fuelTankLitres} onChange={(e) => setForm({ ...form, fuelTankLitres: e.target.value })} />
              </div>
              <div className="form-row">
                <label>Current fuel (litres)</label>
                <input type="number" step="0.1" value={form.fuelLevelLitres} onChange={(e) => setForm({ ...form, fuelLevelLitres: e.target.value })} />
              </div>
            </div>
            <div className="form-inline">
              <div className="form-row">
                <label>Location description</label>
                <input value={form.locationDescription} onChange={(e) => setForm({ ...form, locationDescription: e.target.value })} />
              </div>
              <div className="form-row">
                <label>UK postcode</label>
                <input value={form.postcode} onChange={(e) => setForm({ ...form, postcode: e.target.value })} />
              </div>
            </div>
            <div className="form-inline">
              <div className="form-row">
                <label>GPS latitude</label>
                <input type="number" step="any" value={form.locationLat} onChange={(e) => setForm({ ...form, locationLat: e.target.value })} />
              </div>
              <div className="form-row">
                <label>GPS longitude</label>
                <input type="number" step="any" value={form.locationLng} onChange={(e) => setForm({ ...form, locationLng: e.target.value })} />
              </div>
            </div>
            <div className="form-inline">
              <div className="form-row">
                <label>Quantity</label>
                <input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
              </div>
              <div className="form-row">
                <label>Reorder level</label>
                <input type="number" value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })} />
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
                Save asset
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
