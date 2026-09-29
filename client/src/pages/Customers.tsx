import { FormEvent, useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Modal } from '../components/Modal';
import type { Customer } from '../types';

const empty = { name: '', contactName: '', contactEmail: '', contactPhone: '', address: '', notes: '' };

export function Customers() {
  const [list, setList] = useState<Customer[]>([]);
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

  const selected = id ? list.find((c) => c.id === id) : null;

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
