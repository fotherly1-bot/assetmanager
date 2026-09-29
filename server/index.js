const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { load, save, id } = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'asset-manager-dev-secret-uk';

app.use(cors());
app.use(express.json({ limit: '2mb' }));

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Unauthorised' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}

// ——— Auth ———
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const db = load();
  const user = db.users.find((u) => u.email.toLowerCase() === String(email || '').toLowerCase());
  if (!user || !bcrypt.compareSync(password || '', user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const token = jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role }, JWT_SECRET, {
    expiresIn: '12h',
  });
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

app.get('/api/auth/me', auth, (req, res) => {
  res.json({ user: req.user });
});

// ——— Settings ———
app.get('/api/settings', auth, (req, res) => {
  const db = load();
  res.json(db.settings);
});

app.put('/api/settings', auth, (req, res) => {
  const db = load();
  db.settings = { ...db.settings, ...req.body };
  save(db);
  res.json(db.settings);
});

// ——— Customers ———
app.get('/api/customers', auth, (req, res) => {
  const db = load();
  res.json(db.customers);
});

app.get('/api/customers/:id', auth, (req, res) => {
  const db = load();
  const item = db.customers.find((c) => c.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

app.post('/api/customers', auth, (req, res) => {
  const db = load();
  const item = {
    id: id(),
    name: req.body.name || '',
    contactName: req.body.contactName || '',
    contactEmail: req.body.contactEmail || '',
    contactPhone: req.body.contactPhone || '',
    address: req.body.address || '',
    notes: req.body.notes || '',
    createdAt: new Date().toISOString(),
  };
  db.customers.push(item);
  save(db);
  res.status(201).json(item);
});

app.put('/api/customers/:id', auth, (req, res) => {
  const db = load();
  const idx = db.customers.findIndex((c) => c.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'Not found' });
  db.customers[idx] = { ...db.customers[idx], ...req.body, id: db.customers[idx].id };
  save(db);
  res.json(db.customers[idx]);
});

app.delete('/api/customers/:id', auth, (req, res) => {
  const db = load();
  db.customers = db.customers.filter((c) => c.id !== req.params.id);
  save(db);
  res.json({ ok: true });
});

// ——— Assets ———
app.get('/api/assets', auth, (req, res) => {
  const db = load();
  let list = db.assets;
  if (req.query.category) list = list.filter((a) => a.category === req.query.category);
  res.json(list);
});

app.get('/api/assets/:id', auth, (req, res) => {
  const db = load();
  const item = db.assets.find((a) => a.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  const fuelLogs = db.fuelLogs.filter((f) => f.assetId === item.id).sort((a, b) => b.date.localeCompare(a.date));
  const maintenance = db.maintenance
    .filter((m) => m.assetId === item.id)
    .map(normalizeMaint)
    .sort((a, b) => String(b.scheduledDate || b.date).localeCompare(String(a.scheduledDate || a.date)));
  const bookings = db.bookings.filter((b) => b.assetId === item.id);
  const job = item.currentJobId ? db.jobs.find((j) => j.id === item.currentJobId) : null;
  res.json({ ...item, fuelLogs, maintenance, bookings, currentJob: job });
});

app.post('/api/assets', auth, (req, res) => {
  const db = load();
  const item = {
    id: id(),
    name: req.body.name || '',
    sku: req.body.sku || '',
    category: req.body.category || 'Hand tools',
    condition: req.body.condition || 'Good',
    fuelTankLitres: req.body.fuelTankLitres ?? null,
    fuelLevelLitres: req.body.fuelLevelLitres ?? null,
    locationLat: req.body.locationLat ?? null,
    locationLng: req.body.locationLng ?? null,
    locationDescription: req.body.locationDescription || '',
    postcode: req.body.postcode || '',
    currentJobId: req.body.currentJobId || null,
    jobAssignedAt: req.body.currentJobId ? new Date().toISOString() : null,
    quantity: req.body.quantity ?? 1,
    reorderLevel: req.body.reorderLevel ?? null,
    notes: req.body.notes || '',
    createdAt: new Date().toISOString(),
  };
  db.assets.push(item);
  save(db);
  res.status(201).json(item);
});

app.put('/api/assets/:id', auth, (req, res) => {
  const db = load();
  const idx = db.assets.findIndex((a) => a.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'Not found' });
  const prev = db.assets[idx];
  const next = { ...prev, ...req.body, id: prev.id };
  if (req.body.currentJobId !== undefined && req.body.currentJobId !== prev.currentJobId) {
    next.jobAssignedAt = req.body.currentJobId ? new Date().toISOString() : null;
  }
  db.assets[idx] = next;
  save(db);
  res.json(next);
});

app.delete('/api/assets/:id', auth, (req, res) => {
  const db = load();
  db.assets = db.assets.filter((a) => a.id !== req.params.id);
  save(db);
  res.json({ ok: true });
});

// ——— Fuel logs ———
app.get('/api/fuel', auth, (req, res) => {
  const db = load();
  let list = db.fuelLogs;
  if (req.query.assetId) list = list.filter((f) => f.assetId === req.query.assetId);
  res.json(list.sort((a, b) => b.date.localeCompare(a.date)));
});

app.post('/api/fuel', auth, (req, res) => {
  const db = load();
  const entry = {
    id: id(),
    assetId: req.body.assetId,
    date: req.body.date || new Date().toISOString().slice(0, 10),
    litres: Number(req.body.litres) || 0,
    costGbp: Number(req.body.costGbp) || 0,
    odometerOrHours: req.body.odometerOrHours ?? null,
    notes: req.body.notes || '',
    receiptDataUrl: req.body.receiptDataUrl || null,
    receiptName: req.body.receiptName || null,
    receiptMime: req.body.receiptMime || null,
    createdAt: new Date().toISOString(),
  };
  db.fuelLogs.push(entry);
  const asset = db.assets.find((a) => a.id === entry.assetId);
  if (asset && asset.fuelTankLitres != null) {
    const level = (asset.fuelLevelLitres || 0) + entry.litres;
    asset.fuelLevelLitres = Math.min(asset.fuelTankLitres, level);
  }
  save(db);
  res.status(201).json(entry);
});

app.put('/api/fuel/:id', auth, (req, res) => {
  const db = load();
  const entry = db.fuelLogs.find((f) => f.id === req.params.id);
  if (!entry) return res.status(404).json({ error: 'Fuel log not found' });
  const b = req.body || {};
  if (b.date != null) entry.date = b.date;
  if (b.litres != null) entry.litres = Number(b.litres) || 0;
  if (b.costGbp != null) entry.costGbp = Number(b.costGbp) || 0;
  if (b.odometerOrHours !== undefined) entry.odometerOrHours = b.odometerOrHours;
  if (b.notes != null) entry.notes = b.notes;
  if (b.receiptDataUrl !== undefined) entry.receiptDataUrl = b.receiptDataUrl || null;
  if (b.receiptName !== undefined) entry.receiptName = b.receiptName || null;
  if (b.receiptMime !== undefined) entry.receiptMime = b.receiptMime || null;
  save(db);
  res.json(entry);
});

app.delete('/api/fuel/:id', auth, (req, res) => {
  const db = load();
  db.fuelLogs = db.fuelLogs.filter((f) => f.id !== req.params.id);
  save(db);
  res.json({ ok: true });
});


function normalizeMaint(raw) {
  const scheduledDate = String(raw.scheduledDate || raw.date || '');
  const completedDate = String(raw.completedDate || (raw.status === 'completed' || raw.result ? raw.date : '') || '');
  let status = String(raw.status || '');
  if (!status) {
    if (completedDate || raw.result) status = 'completed';
    else if (scheduledDate) status = 'scheduled';
    else status = 'completed';
  }
  const t = new Date().toISOString().slice(0, 10);
  if (status === 'scheduled' && scheduledDate && scheduledDate < t) status = 'overdue';
  return {
    ...raw,
    type: raw.type || 'Service',
    date: completedDate || scheduledDate || String(raw.date || t),
    scheduledDate,
    completedDate,
    nextDue: String(raw.nextDue || ''),
    status,
    result: raw.result || '',
    costGbp: Number(raw.costGbp) || 0,
    vendor: String(raw.vendor || ''),
    description: String(raw.description || ''),
    notes: String(raw.notes || ''),
    outOfService: !!raw.outOfService,
    outOfServiceStart: String(raw.outOfServiceStart || ''),
    outOfServiceEnd: String(raw.outOfServiceEnd || ''),
  };
}

function isOosActive(m, t) {
  if (!m.outOfService) return false;
  const start = String(m.outOfServiceStart || m.scheduledDate || '');
  if (!start || start > t) return false;
  const end = String(m.outOfServiceEnd || '');
  if (end && end < t) return false;
  return true;
}

function syncAssetOutOfService(db, assetId) {
  const asset = db.assets.find((a) => a.id === assetId);
  if (!asset) return;
  const t = new Date().toISOString().slice(0, 10);
  const active = db.maintenance.some((m) => m.assetId === assetId && isOosActive(normalizeMaint(m), t));
  if (active) {
    asset.condition = 'Out of service';
  } else if (asset.condition === 'Out of service') {
    asset.condition = 'Good';
  }
}

function buildMaintEntry(body, existing) {
  const scheduledDate = String(body.scheduledDate ?? existing?.scheduledDate ?? body.date ?? new Date().toISOString().slice(0, 10));
  const completedDate = String(
    body.completedDate ?? existing?.completedDate ?? (body.status === 'completed' ? body.date || scheduledDate : '') ?? ''
  );
  let status = String(body.status ?? existing?.status ?? '');
  if (!status) status = completedDate ? 'completed' : 'scheduled';
  const t = new Date().toISOString().slice(0, 10);
  if (status === 'scheduled' && scheduledDate && scheduledDate < t) status = 'overdue';
  const outOfService = body.outOfService !== undefined ? !!body.outOfService : !!existing?.outOfService;
  return normalizeMaint({
    ...(existing || {}),
    ...body,
    type: body.type ?? existing?.type ?? 'Service',
    scheduledDate,
    completedDate,
    date: completedDate || scheduledDate,
    nextDue: body.nextDue ?? existing?.nextDue ?? '',
    status,
    result: body.result ?? existing?.result ?? '',
    costGbp: body.costGbp !== undefined ? Number(body.costGbp) || 0 : Number(existing?.costGbp) || 0,
    vendor: body.vendor ?? existing?.vendor ?? '',
    description: body.description ?? existing?.description ?? '',
    notes: body.notes ?? existing?.notes ?? '',
    outOfService,
    outOfServiceStart: outOfService
      ? String(body.outOfServiceStart ?? existing?.outOfServiceStart ?? scheduledDate)
      : '',
    outOfServiceEnd: outOfService ? String(body.outOfServiceEnd ?? existing?.outOfServiceEnd ?? '') : '',
  });
}

// ——— Maintenance ———
app.get('/api/maintenance', auth, (req, res) => {
  const db = load();
  let list = db.maintenance.map(normalizeMaint);
  if (req.query.assetId) list = list.filter((m) => m.assetId === req.query.assetId);
  res.json(
    list.sort((a, b) =>
      String(a.scheduledDate || a.nextDue || '').localeCompare(String(b.scheduledDate || b.nextDue || ''))
    )
  );
});

app.post('/api/maintenance', auth, (req, res) => {
  const db = load();
  const entry = buildMaintEntry(req.body, {
    id: id(),
    assetId: req.body.assetId,
    createdAt: new Date().toISOString(),
  });
  entry.id = entry.id || id();
  entry.assetId = req.body.assetId;
  entry.createdAt = entry.createdAt || new Date().toISOString();
  db.maintenance.push(entry);
  syncAssetOutOfService(db, entry.assetId);
  save(db);
  res.status(201).json(entry);
});

app.put('/api/maintenance/:id', auth, (req, res) => {
  const db = load();
  const idx = db.maintenance.findIndex((m) => m.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'Not found' });
  const prev = db.maintenance[idx];
  const entry = buildMaintEntry(req.body, prev);
  entry.id = prev.id;
  entry.createdAt = prev.createdAt;
  db.maintenance[idx] = entry;
  syncAssetOutOfService(db, entry.assetId);
  save(db);
  res.json(entry);
});

app.delete('/api/maintenance/:id', auth, (req, res) => {
  const db = load();
  const prev = db.maintenance.find((m) => m.id === req.params.id);
  db.maintenance = db.maintenance.filter((m) => m.id !== req.params.id);
  if (prev) syncAssetOutOfService(db, prev.assetId);
  save(db);
  res.json({ ok: true });
});

// ——— Jobs ———
app.get('/api/jobs', auth, (req, res) => {
  const db = load();
  let list = db.jobs;
  const customerId = req.query.customerId;
  if (customerId) list = list.filter((j) => j.customerId === customerId);
  res.json(list);
});

app.get('/api/jobs/:id', auth, (req, res) => {
  const db = load();
  const item = db.jobs.find((j) => j.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  const customer = db.customers.find((c) => c.id === item.customerId);
  const assets = db.assets.filter((a) => (item.requiredAssetIds || []).includes(a.id));
  res.json({ ...item, customer, assets });
});

app.post('/api/jobs', auth, (req, res) => {
  const db = load();
  const item = {
    id: id(),
    title: req.body.title || '',
    customerId: req.body.customerId || '',
    status: req.body.status || 'Planned',
    startDate: req.body.startDate || '',
    endDate: req.body.endDate || '',
    requiredAssetIds: req.body.requiredAssetIds || [],
    location: req.body.location || '',
    notes: req.body.notes || '',
    createdAt: new Date().toISOString(),
  };
  db.jobs.push(item);
  save(db);
  res.status(201).json(item);
});

app.put('/api/jobs/:id', auth, (req, res) => {
  const db = load();
  const idx = db.jobs.findIndex((j) => j.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'Not found' });
  db.jobs[idx] = { ...db.jobs[idx], ...req.body, id: db.jobs[idx].id };
  // Sync asset current job assignments for required assets when status is In progress
  if (req.body.requiredAssetIds || req.body.status) {
    const job = db.jobs[idx];
    if (job.status === 'In progress') {
      for (const aid of job.requiredAssetIds || []) {
        const a = db.assets.find((x) => x.id === aid);
        if (a && !a.currentJobId) {
          a.currentJobId = job.id;
          a.jobAssignedAt = new Date().toISOString();
        }
      }
    }
  }
  save(db);
  res.json(db.jobs[idx]);
});

app.delete('/api/jobs/:id', auth, (req, res) => {
  const db = load();
  db.jobs = db.jobs.filter((j) => j.id !== req.params.id);
  for (const a of db.assets) {
    if (a.currentJobId === req.params.id) {
      a.currentJobId = null;
      a.jobAssignedAt = null;
    }
  }
  save(db);
  res.json({ ok: true });
});

// ——— Bookings ———
app.get('/api/bookings', auth, (req, res) => {
  const db = load();
  res.json(db.bookings);
});

app.post('/api/bookings', auth, (req, res) => {
  const db = load();
  const entry = {
    id: id(),
    assetId: req.body.assetId,
    jobId: req.body.jobId || null,
    startDate: req.body.startDate,
    endDate: req.body.endDate,
    notes: req.body.notes || '',
    createdAt: new Date().toISOString(),
  };
  db.bookings.push(entry);
  save(db);
  res.status(201).json(entry);
});

app.put('/api/bookings/:id', auth, (req, res) => {
  const db = load();
  const idx = db.bookings.findIndex((b) => b.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'Not found' });
  db.bookings[idx] = { ...db.bookings[idx], ...req.body, id: db.bookings[idx].id };
  save(db);
  res.json(db.bookings[idx]);
});

app.delete('/api/bookings/:id', auth, (req, res) => {
  const db = load();
  db.bookings = db.bookings.filter((b) => b.id !== req.params.id);
  save(db);
  res.json({ ok: true });
});

// ——— Dashboard / Reports ———
app.get('/api/dashboard', auth, (req, res) => {
  const db = load();
  const today = new Date().toISOString().slice(0, 10);
  const lowFuel = db.assets.filter((a) => {
    if (a.fuelTankLitres == null || a.fuelTankLitres <= 0) return false;
    const pct = ((a.fuelLevelLitres || 0) / a.fuelTankLitres) * 100;
    return pct <= (db.settings.lowFuelThresholdPercent || 25);
  });
  const maintDue = db.maintenance.filter((m) => m.nextDue && m.nextDue <= today);
  const assetsOnJobs = db.assets.filter((a) => a.currentJobId);
  const upcoming = db.bookings
    .filter((b) => b.startDate >= today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .slice(0, 8);
  res.json({
    stats: {
      totalAssets: db.assets.length,
      assetsOnJobs: assetsOnJobs.length,
      lowFuel: lowFuel.length,
      maintenanceDue: maintDue.length,
      activeJobs: db.jobs.filter((j) => j.status === 'In progress').length,
      customers: db.customers.length,
    },
    lowFuel,
    maintDue,
    upcoming,
    assetsOnJobs,
  });
});

app.get('/api/reports/utilisation', auth, (req, res) => {
  const db = load();
  const rows = db.assets.map((a) => {
    const bookingDays = db.bookings
      .filter((b) => b.assetId === a.id)
      .reduce((sum, b) => {
        const s = new Date(b.startDate);
        const e = new Date(b.endDate);
        const days = Math.max(1, Math.round((e - s) / 86400000) + 1);
        return sum + days;
      }, 0);
    return {
      assetId: a.id,
      name: a.name,
      sku: a.sku,
      category: a.category,
      onJob: !!a.currentJobId,
      bookingDays,
      condition: a.condition,
    };
  });
  res.json(rows);
});

app.get('/api/reports/fuel', auth, (req, res) => {
  const db = load();
  const byAsset = {};
  const byMonthMap = {};
  for (const f of db.fuelLogs) {
    if (!byAsset[f.assetId]) byAsset[f.assetId] = { litres: 0, costGbp: 0, entries: 0 };
    byAsset[f.assetId].litres += f.litres;
    byAsset[f.assetId].costGbp += f.costGbp;
    byAsset[f.assetId].entries += 1;
    const month = String(f.date || '').slice(0, 7);
    if (month) {
      if (!byMonthMap[month]) byMonthMap[month] = { litres: 0, costGbp: 0, entries: 0 };
      byMonthMap[month].litres += f.litres;
      byMonthMap[month].costGbp += f.costGbp;
      byMonthMap[month].entries += 1;
    }
  }
  const rows = Object.entries(byAsset)
    .map(([assetId, agg]) => {
      const a = db.assets.find((x) => x.id === assetId);
      return { assetId, name: a?.name || assetId, sku: a?.sku, ...agg };
    })
    .sort((a, b) => b.costGbp - a.costGbp);
  const byMonth = Object.entries(byMonthMap)
    .map(([month, agg]) => ({ month, ...agg }))
    .sort((a, b) => a.month.localeCompare(b.month));
  const totalCost = rows.reduce((s, r) => s + r.costGbp, 0);
  const totalLitres = rows.reduce((s, r) => s + r.litres, 0);
  res.json({ rows, byMonth, totalCost, totalLitres });
});

app.get('/api/reports/maintenance-due', auth, (req, res) => {
  const db = load();
  const today = new Date().toISOString().slice(0, 10);
  const all = db.maintenance.map((m) => {
    const n = normalizeMaint(m);
    const a = db.assets.find((x) => x.id === n.assetId);
    const overdue =
      n.status === 'overdue' ||
      !!(n.nextDue && n.nextDue < today && n.status !== 'completed') ||
      !!(n.status === 'scheduled' && n.scheduledDate && n.scheduledDate < today);
    const dueSoon = !!(
      !overdue &&
      n.nextDue &&
      n.nextDue >= today &&
      n.nextDue <= addDays(today, 30)
    );
    const ok = !overdue && !dueSoon;
    return { ...n, assetName: a?.name, sku: a?.sku, category: a?.category, overdue, dueSoon, ok };
  });
  const summary = {
    overdue: all.filter((r) => r.overdue).length,
    dueSoon: all.filter((r) => r.dueSoon).length,
    ok: all.filter((r) => r.ok).length,
    scheduled: all.filter((r) => r.status === 'scheduled' || r.status === 'in_progress').length,
    totalCost: all.reduce((s, r) => s + (Number(r.costGbp) || 0), 0),
  };
  const rows = all
    .filter((r) => r.overdue || r.dueSoon || r.status === 'scheduled' || r.status === 'in_progress')
    .sort((a, b) => String(a.nextDue || a.scheduledDate || '').localeCompare(String(b.nextDue || b.scheduledDate || '')));
  res.json({ rows, summary, all });
});

app.get('/api/reports/by-location', auth, (req, res) => {
  const db = load();
  const groups = {};
  for (const a of db.assets) {
    const key = a.postcode || a.locationDescription || 'Unspecified';
    if (!groups[key]) groups[key] = [];
    groups[key].push(a);
  }
  res.json(groups);
});

app.get('/api/reports/by-category', auth, (req, res) => {
  const db = load();
  const groups = {};
  for (const a of db.assets) {
    if (!groups[a.category]) groups[a.category] = [];
    groups[a.category].push(a);
  }
  res.json(groups);
});

app.get('/api/planner', auth, (req, res) => {
  const db = load();
  const today = new Date().toISOString().slice(0, 10);
  const assetStatus = db.assets.map((a) => {
    const maint = db.maintenance.filter((m) => m.assetId === a.id).map(normalizeMaint);
    const hasOverdue = maint.some(
      (m) =>
        (m.nextDue && m.nextDue < today && m.status !== 'completed') ||
        m.status === 'overdue' ||
        (m.status === 'scheduled' && m.scheduledDate && m.scheduledDate < today)
    );
    const oosNow = a.condition === 'Out of service' || maint.some((m) => isOosActive(m, today));
    const booked = db.bookings.some((b) => b.assetId === a.id && b.startDate <= today && b.endDate >= today);
    let availability = 'available';
    if (oosNow || hasOverdue) availability = 'maintenance';
    else if (a.currentJobId) availability = 'on_job';
    else if (booked) availability = 'booked';
    return { ...a, availability, overdueMaint: hasOverdue };
  });
  res.json({ jobs: db.jobs, assets: assetStatus, bookings: db.bookings, customers: db.customers });
});

function addDays(isoDate, n) {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

// Production static
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' });
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Asset Manager API listening on http://0.0.0.0:${PORT}`);
});
