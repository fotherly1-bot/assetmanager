import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { ConditionBadge } from '../components/StatusBadge';
import { STOCK_CATEGORIES, type Asset, type Category } from '../types';

export function Inventory() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [cat, setCat] = useState<Category | ''>('');

  useEffect(() => {
    api<Asset[]>('/api/assets').then(setAssets);
  }, []);

  const stock = useMemo(() => {
    return assets.filter((a) => {
      if (!STOCK_CATEGORIES.includes(a.category)) return false;
      if (cat && a.category !== cat) return false;
      return true;
    });
  }, [assets, cat]);

  const byCat = useMemo(() => {
    const g: Record<string, Asset[]> = {};
    for (const a of stock) {
      if (!g[a.category]) g[a.category] = [];
      g[a.category].push(a);
    }
    return g;
  }, [stock]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Inventory</h2>
          <p>Stock-style listing for products, consumables and tool sets</p>
        </div>
      </div>

      <div className="filters">
        <select value={cat} onChange={(e) => setCat(e.target.value as Category | '')}>
          <option value="">All stock categories</option>
          {STOCK_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {Object.entries(byCat).map(([category, items]) => (
        <div key={category} className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-body" style={{ paddingBottom: 0 }}>
            <h3 className="card-title">{category}</h3>
          </div>
          <table className="data">
            <thead>
              <tr>
                <th>Item</th>
                <th>SKU</th>
                <th>Qty</th>
                <th>Reorder</th>
                <th>Condition</th>
                <th>Location</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => {
                const low = a.reorderLevel != null && a.quantity <= a.reorderLevel;
                return (
                  <tr key={a.id}>
                    <td>
                      <Link to={`/assets/${a.id}`}>{a.name}</Link>
                    </td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: '0.8rem' }}>{a.sku}</td>
                    <td>
                      <strong>{a.quantity}</strong>
                    </td>
                    <td>{a.reorderLevel ?? '—'}</td>
                    <td>
                      <ConditionBadge condition={a.condition} />
                    </td>
                    <td>{a.locationDescription || a.postcode || '—'}</td>
                    <td>{low ? <span className="badge badge-amber">Reorder</span> : <span className="badge badge-green">OK</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
      {stock.length === 0 && <div className="empty">No inventory items</div>}
    </div>
  );
}
