import { FormEvent, useState } from 'react';
import { todayISO } from '../lib/format';
import {
  MAINT_STATUSES,
  MAINT_TYPES,
  type Asset,
  type MaintResult,
  type MaintStatus,
  type MaintenanceRecord,
} from '../types';

export type MaintenanceFormValues = {
  assetId: string;
  type: string;
  scheduledDate: string;
  completedDate: string;
  nextDue: string;
  status: MaintStatus;
  result: MaintResult;
  costGbp: string;
  vendor: string;
  description: string;
  notes: string;
  outOfService: boolean;
  outOfServiceStart: string;
  outOfServiceEnd: string;
};

export function emptyMaintForm(assetId = ''): MaintenanceFormValues {
  return {
    assetId,
    type: 'Service',
    scheduledDate: todayISO(),
    completedDate: '',
    nextDue: '',
    status: 'scheduled',
    result: '',
    costGbp: '',
    vendor: '',
    description: '',
    notes: '',
    outOfService: false,
    outOfServiceStart: '',
    outOfServiceEnd: '',
  };
}

export function formFromRecord(m: MaintenanceRecord): MaintenanceFormValues {
  return {
    assetId: m.assetId,
    type: m.type || 'Service',
    scheduledDate: m.scheduledDate || m.date || '',
    completedDate: m.completedDate || (m.status === 'completed' ? m.date : '') || '',
    nextDue: m.nextDue || '',
    status: m.status || 'completed',
    result: m.result || '',
    costGbp: m.costGbp != null && m.costGbp !== 0 ? String(m.costGbp) : m.costGbp === 0 ? '0' : '',
    vendor: m.vendor || '',
    description: m.description || '',
    notes: m.notes || '',
    outOfService: !!m.outOfService,
    outOfServiceStart: m.outOfServiceStart || '',
    outOfServiceEnd: m.outOfServiceEnd || '',
  };
}

export function payloadFromForm(form: MaintenanceFormValues) {
  const completedDate = form.completedDate || (form.status === 'completed' ? form.scheduledDate : '');
  return {
    assetId: form.assetId,
    type: form.type,
    scheduledDate: form.scheduledDate || '',
    completedDate,
    date: completedDate || form.scheduledDate || todayISO(),
    nextDue: form.nextDue || '',
    status: form.status,
    result: form.result || '',
    costGbp: form.costGbp === '' ? 0 : Number(form.costGbp),
    vendor: form.vendor || '',
    description: form.description || '',
    notes: form.notes || '',
    outOfService: !!form.outOfService,
    outOfServiceStart: form.outOfService ? form.outOfServiceStart || form.scheduledDate || '' : '',
    outOfServiceEnd: form.outOfService ? form.outOfServiceEnd || '' : '',
  };
}

export function MaintenanceForm({
  assets,
  initial,
  lockAsset,
  logNumber,
  submitLabel = 'Save',
  onSubmit,
  onCancel,
}: {
  assets: Asset[];
  initial: MaintenanceFormValues;
  lockAsset?: boolean;
  /** Existing log number when editing (read-only). */
  logNumber?: string;
  submitLabel?: string;
  onSubmit: (values: MaintenanceFormValues) => Promise<void> | void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<MaintenanceFormValues>(initial);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit(form);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      {logNumber ? (
        <div className="form-row">
          <label>Log number</label>
          <input value={logNumber} readOnly disabled />
        </div>
      ) : null}
      <div className="form-row">
        <label>Asset</label>
        <select
          required
          disabled={lockAsset}
          value={form.assetId}
          onChange={(e) => setForm({ ...form, assetId: e.target.value })}
        >
          <option value="">Select asset…</option>
          {assets.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.sku})
            </option>
          ))}
        </select>
      </div>
      <div className="form-inline">
        <div className="form-row">
          <label>Type</label>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            {MAINT_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <label>Status</label>
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as MaintStatus })}
          >
            {MAINT_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="form-inline">
        <div className="form-row">
          <label>Scheduled date</label>
          <input
            type="date"
            required
            value={form.scheduledDate}
            onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })}
          />
        </div>
        <div className="form-row">
          <label>Completed date</label>
          <input
            type="date"
            value={form.completedDate}
            onChange={(e) => setForm({ ...form, completedDate: e.target.value })}
          />
        </div>
      </div>
      <div className="form-inline">
        <div className="form-row">
          <label>Next due</label>
          <input type="date" value={form.nextDue} onChange={(e) => setForm({ ...form, nextDue: e.target.value })} />
        </div>
        <div className="form-row">
          <label>Result</label>
          <select
            value={form.result}
            onChange={(e) => setForm({ ...form, result: e.target.value as MaintResult })}
          >
            <option value="">—</option>
            <option>Pass</option>
            <option>Fail</option>
            <option>Advisory</option>
          </select>
        </div>
      </div>
      <div className="form-inline">
        <div className="form-row">
          <label>Cost (£)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.costGbp}
            onChange={(e) => setForm({ ...form, costGbp: e.target.value })}
            placeholder="0.00"
          />
        </div>
        <div className="form-row">
          <label>Vendor / garage</label>
          <input
            value={form.vendor}
            onChange={(e) => setForm({ ...form, vendor: e.target.value })}
            placeholder="e.g. Depot workshop"
          />
        </div>
      </div>
      <div className="form-row">
        <label>Description</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Work to be carried out"
        />
      </div>
      <div className="form-row">
        <label>Notes</label>
        <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </div>
      <div className="form-row">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={form.outOfService}
            onChange={(e) => {
              const on = e.target.checked;
              setForm({
                ...form,
                outOfService: on,
                outOfServiceStart: on ? form.outOfServiceStart || form.scheduledDate || todayISO() : '',
                outOfServiceEnd: on ? form.outOfServiceEnd : '',
              });
            }}
          />
          Puts asset out of service
        </label>
      </div>
      {form.outOfService && (
        <div className="form-inline">
          <div className="form-row">
            <label>Out of service from</label>
            <input
              type="date"
              required
              value={form.outOfServiceStart}
              onChange={(e) => setForm({ ...form, outOfServiceStart: e.target.value })}
            />
          </div>
          <div className="form-row">
            <label>Out of service until</label>
            <input
              type="date"
              value={form.outOfServiceEnd}
              onChange={(e) => setForm({ ...form, outOfServiceEnd: e.target.value })}
            />
          </div>
        </div>
      )}
      <div className="form-actions">
        <button type="button" className="btn" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving || !form.assetId}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
