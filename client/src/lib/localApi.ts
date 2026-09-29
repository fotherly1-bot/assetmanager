import { createSeedDb, DEMO_USER, type LocalDb, type DbRow } from './seed';

const DB_KEY = 'am_local_db';
const SESSION_KEY = 'am_local_session';

function uid(): string {
  return crypto.randomUUID();
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(isoDate: string, n: number): string {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function normalizeMaint(raw: DbRow): DbRow {
  const scheduledDate = String(raw.scheduledDate || raw.date || '');
  const completedDate = String(raw.completedDate || (raw.status === 'completed' || raw.result ? raw.date : '') || '');
  let status = String(raw.status || '');
  if (!status) {
    if (completedDate || raw.result) status = 'completed';
    else if (scheduledDate) status = 'scheduled';
    else status = 'completed';
  }
  const t = today();
  if (status === 'scheduled' && scheduledDate && scheduledDate < t) status = 'overdue';
  if (status !== 'completed' && status !== 'in_progress' && raw.nextDue && String(raw.nextDue) < t && !completedDate) {
    // keep computed overdue for open bookings past nextDue
  }
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

function isOosActive(m: DbRow, t: string): boolean {
  if (!m.outOfService) return false;
  const start = String(m.outOfServiceStart || m.scheduledDate || '');
  if (!start || start > t) return false;
  const end = String(m.outOfServiceEnd || '');
  if (end && end < t) return false;
  // completed with ended OOS already handled by end date
  return true;
}

function syncAssetOutOfService(db: LocalDb, assetId: string) {
  const asset = db.assets.find((a) => a.id === assetId);
  if (!asset) return;
  const t = today();
  const active = db.maintenance.some((m) => m.assetId === assetId && isOosActive(normalizeMaint(m), t));
  if (active) {
    asset.condition = 'Out of service';
  } else if (asset.condition === 'Out of service') {
    // restore only if no other active OOS — leave as Good when coming back into service
    asset.condition = 'Good';
  }
}

function buildMaintEntry(body: Record<string, unknown>, existing?: DbRow): DbRow {
  const scheduledDate = String(body.scheduledDate ?? existing?.scheduledDate ?? body.date ?? today());
  const completedDate = String(
    body.completedDate ?? existing?.completedDate ?? (body.status === 'completed' ? body.date || scheduledDate : '') ?? ''
  );
  let status = String(body.status ?? existing?.status ?? '');
  if (!status) status = completedDate ? 'completed' : 'scheduled';
  const t = today();
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


export function loadDb(): LocalDb {
  const raw = localStorage.getItem(DB_KEY);
  if (!raw) {
    const db = createSeedDb();
    saveDb(db);
    return db;
  }
  try {
    return JSON.parse(raw) as LocalDb;
  } catch {
    const db = createSeedDb();
    saveDb(db);
    return db;
  }
}

export function saveDb(db: LocalDb) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

export function ensureSeeded() {
  loadDb();
}

type SessionUser = { id: string; email: string; name: string; role: string };

function getSession(): SessionUser | null {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

function setSession(user: SessionUser | null) {
  if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  else localStorage.removeItem(SESSION_KEY);
}

function requireAuth() {
  const user = getSession();
  if (!user) {
    const err = new Error('Unauthorised') as Error & { status: number };
    err.status = 401;
    throw err;
  }
  return user;
}

function parsePath(path: string): { pathname: string; query: URLSearchParams } {
  const [pathname, qs] = path.split('?');
  return { pathname, query: new URLSearchParams(qs || '') };
}

/** Handle an API-shaped request against localStorage. Returns response body or throws. */
export async function localApiHandle(
  path: string,
  options: RequestInit = {}
): Promise<unknown> {
  const method = (options.method || 'GET').toUpperCase();
  let body: Record<string, unknown> = {};
  if (options.body && typeof options.body === 'string') {
    try {
      body = JSON.parse(options.body);
    } catch {
      body = {};
    }
  }

  const { pathname, query } = parsePath(path);

  // Auth (no session required for login)
  if (pathname === '/api/auth/login' && method === 'POST') {
    const email = String(body.email || '').toLowerCase();
    const password = String(body.password || '');
    if (email !== DEMO_USER.email.toLowerCase() || password !== DEMO_USER.password) {
      const err = new Error('Invalid email or password') as Error & { status: number };
      err.status = 401;
      throw err;
    }
    ensureSeeded();
    const user = { id: DEMO_USER.id, email: DEMO_USER.email, name: DEMO_USER.name, role: DEMO_USER.role };
    setSession(user);
    const token = 'local-' + btoa(user.id);
    return { token, user };
  }

  if (pathname === '/api/auth/me' && method === 'GET') {
    const user = requireAuth();
    return { user };
  }

  requireAuth();
  const db = loadDb();

  // Settings
  if (pathname === '/api/settings' && method === 'GET') return db.settings;
  if (pathname === '/api/settings' && method === 'PUT') {
    db.settings = { ...db.settings, ...body } as LocalDb['settings'];
    saveDb(db);
    return db.settings;
  }

  // Customers
  if (pathname === '/api/customers' && method === 'GET') return db.customers;
  if (pathname === '/api/customers' && method === 'POST') {
    const item = {
      id: uid(),
      name: body.name || '',
      contactName: body.contactName || '',
      contactEmail: body.contactEmail || '',
      contactPhone: body.contactPhone || '',
      address: body.address || '',
      notes: body.notes || '',
      createdAt: new Date().toISOString(),
    };
    db.customers.push(item);
    saveDb(db);
    return item;
  }
  {
    const m = pathname.match(/^\/api\/customers\/([^/]+)$/);
    if (m) {
      const id = m[1];
      if (method === 'GET') {
        const item = db.customers.find((c) => c.id === id);
        if (!item) throw notFound();
        return item;
      }
      if (method === 'PUT') {
        const idx = db.customers.findIndex((c) => c.id === id);
        if (idx < 0) throw notFound();
        db.customers[idx] = { ...db.customers[idx], ...body, id };
        saveDb(db);
        return db.customers[idx];
      }
      if (method === 'DELETE') {
        db.customers = db.customers.filter((c) => c.id !== id);
        saveDb(db);
        return { ok: true };
      }
    }
  }

  // Assets
  if (pathname === '/api/assets' && method === 'GET') {
    let list = db.assets;
    const cat = query.get('category');
    if (cat) list = list.filter((a) => a.category === cat);
    return list;
  }
  if (pathname === '/api/assets' && method === 'POST') {
    const item = {
      id: uid(),
      name: body.name || '',
      sku: body.sku || '',
      category: body.category || 'Hand tools',
      condition: body.condition || 'Good',
      fuelTankLitres: body.fuelTankLitres ?? null,
      fuelLevelLitres: body.fuelLevelLitres ?? null,
      locationLat: body.locationLat ?? null,
      locationLng: body.locationLng ?? null,
      locationDescription: body.locationDescription || '',
      postcode: body.postcode || '',
      currentJobId: body.currentJobId || null,
      jobAssignedAt: body.currentJobId ? new Date().toISOString() : null,
      quantity: body.quantity ?? 1,
      reorderLevel: body.reorderLevel ?? null,
      notes: body.notes || '',
      createdAt: new Date().toISOString(),
    };
    db.assets.push(item);
    saveDb(db);
    return item;
  }
  {
    const m = pathname.match(/^\/api\/assets\/([^/]+)$/);
    if (m) {
      const id = m[1];
      if (method === 'GET') {
        const item = db.assets.find((a) => a.id === id);
        if (!item) throw notFound();
        const fuelLogs = db.fuelLogs
          .filter((f) => f.assetId === id)
          .sort((a, b) => String(b.date).localeCompare(String(a.date)));
        const maintenance = db.maintenance
          .filter((x) => x.assetId === id)
          .map(normalizeMaint)
          .sort((a, b) =>
            String(b.scheduledDate || b.date).localeCompare(String(a.scheduledDate || a.date))
          );
        const bookings = db.bookings.filter((b) => b.assetId === id);
        const job = item.currentJobId
          ? db.jobs.find((j) => j.id === item.currentJobId) || null
          : null;
        return { ...item, fuelLogs, maintenance, bookings, currentJob: job };
      }
      if (method === 'PUT') {
        const idx = db.assets.findIndex((a) => a.id === id);
        if (idx < 0) throw notFound();
        const prev = db.assets[idx];
        const next: DbRow = { ...prev, ...body, id };
        if (body.currentJobId !== undefined && body.currentJobId !== prev.currentJobId) {
          next.jobAssignedAt = body.currentJobId ? new Date().toISOString() : null;
        }
        db.assets[idx] = next;
        saveDb(db);
        return next;
      }
      if (method === 'DELETE') {
        db.assets = db.assets.filter((a) => a.id !== id);
        saveDb(db);
        return { ok: true };
      }
    }
  }

  // Fuel
  if (pathname === '/api/fuel' && method === 'GET') {
    let list = db.fuelLogs;
    const assetId = query.get('assetId');
    if (assetId) list = list.filter((f) => f.assetId === assetId);
    return [...list].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }
  if (pathname === '/api/fuel' && method === 'POST') {
    const entry = {
      id: uid(),
      assetId: body.assetId,
      date: body.date || today(),
      litres: Number(body.litres) || 0,
      costGbp: Number(body.costGbp) || 0,
      odometerOrHours: body.odometerOrHours ?? null,
      notes: body.notes || '',
      receiptDataUrl: body.receiptDataUrl || null,
      receiptName: body.receiptName || null,
      receiptMime: body.receiptMime || null,
      createdAt: new Date().toISOString(),
    };
    db.fuelLogs.push(entry);
    const asset = db.assets.find((a) => a.id === entry.assetId);
    if (asset && asset.fuelTankLitres != null) {
      const level = (Number(asset.fuelLevelLitres) || 0) + entry.litres;
      asset.fuelLevelLitres = Math.min(Number(asset.fuelTankLitres), level);
    }
    saveDb(db);
    return entry;
  }
  {
    const m = pathname.match(/^\/api\/fuel\/([^/]+)$/);
    if (m && method === 'PUT') {
      const entry = db.fuelLogs.find((f) => f.id === m[1]);
      if (!entry) throw notFound();
      if (body.date != null) entry.date = body.date;
      if (body.litres != null) entry.litres = Number(body.litres) || 0;
      if (body.costGbp != null) entry.costGbp = Number(body.costGbp) || 0;
      if (body.odometerOrHours !== undefined) entry.odometerOrHours = body.odometerOrHours;
      if (body.notes != null) entry.notes = body.notes;
      if (body.receiptDataUrl !== undefined) entry.receiptDataUrl = body.receiptDataUrl || null;
      if (body.receiptName !== undefined) entry.receiptName = body.receiptName || null;
      if (body.receiptMime !== undefined) entry.receiptMime = body.receiptMime || null;
      saveDb(db);
      return entry;
    }
    if (m && method === 'DELETE') {
      db.fuelLogs = db.fuelLogs.filter((f) => f.id !== m[1]);
      saveDb(db);
      return { ok: true };
    }
  }

  // Maintenance
  if (pathname === '/api/maintenance' && method === 'GET') {
    let list = db.maintenance.map(normalizeMaint);
    const assetId = query.get('assetId');
    if (assetId) list = list.filter((x) => x.assetId === assetId);
    return [...list].sort((a, b) =>
      String(a.scheduledDate || a.nextDue || '').localeCompare(String(b.scheduledDate || b.nextDue || ''))
    );
  }
  if (pathname === '/api/maintenance' && method === 'POST') {
    const entry = buildMaintEntry(body, {
      id: uid(),
      assetId: body.assetId,
      createdAt: new Date().toISOString(),
    });
    entry.id = entry.id || uid();
    entry.assetId = body.assetId;
    entry.createdAt = entry.createdAt || new Date().toISOString();
    db.maintenance.push(entry);
    syncAssetOutOfService(db, String(entry.assetId));
    saveDb(db);
    return entry;
  }
  {
    const m = pathname.match(/^\/api\/maintenance\/([^/]+)$/);
    if (m) {
      const id = m[1];
      if (method === 'PUT') {
        const idx = db.maintenance.findIndex((x) => x.id === id);
        if (idx < 0) throw notFound();
        const prev = db.maintenance[idx];
        const entry = buildMaintEntry(body, prev);
        entry.id = id;
        entry.createdAt = prev.createdAt;
        db.maintenance[idx] = entry;
        syncAssetOutOfService(db, String(entry.assetId));
        saveDb(db);
        return entry;
      }
      if (method === 'DELETE') {
        const prev = db.maintenance.find((x) => x.id === id);
        db.maintenance = db.maintenance.filter((x) => x.id !== id);
        if (prev) syncAssetOutOfService(db, String(prev.assetId));
        saveDb(db);
        return { ok: true };
      }
    }
  }

  // Jobs
  if (pathname === '/api/jobs' && method === 'GET') {
    let list = db.jobs;
    const customerId = query.get('customerId');
    if (customerId) list = list.filter((j) => j.customerId === customerId);
    return list;
  }
  if (pathname === '/api/jobs' && method === 'POST') {
    const item = {
      id: uid(),
      title: body.title || '',
      customerId: body.customerId || '',
      status: body.status || 'Planned',
      startDate: body.startDate || '',
      endDate: body.endDate || '',
      requiredAssetIds: body.requiredAssetIds || [],
      location: body.location || '',
      notes: body.notes || '',
      createdAt: new Date().toISOString(),
    };
    db.jobs.push(item);
    saveDb(db);
    return item;
  }
  {
    const m = pathname.match(/^\/api\/jobs\/([^/]+)$/);
    if (m) {
      const id = m[1];
      if (method === 'GET') {
        const item = db.jobs.find((j) => j.id === id);
        if (!item) throw notFound();
        const customer = db.customers.find((c) => c.id === item.customerId);
        const assets = db.assets.filter((a) =>
          ((item.requiredAssetIds as string[]) || []).includes(a.id as string)
        );
        return { ...item, customer, assets };
      }
      if (method === 'PUT') {
        const idx = db.jobs.findIndex((j) => j.id === id);
        if (idx < 0) throw notFound();
        db.jobs[idx] = { ...db.jobs[idx], ...body, id };
        const job = db.jobs[idx];
        if (body.requiredAssetIds || body.status) {
          if (job.status === 'In progress') {
            for (const aid of (job.requiredAssetIds as string[]) || []) {
              const a = db.assets.find((x) => x.id === aid);
              if (a && !a.currentJobId) {
                a.currentJobId = job.id;
                a.jobAssignedAt = new Date().toISOString();
              }
            }
          }
        }
        saveDb(db);
        return db.jobs[idx];
      }
      if (method === 'DELETE') {
        db.jobs = db.jobs.filter((j) => j.id !== id);
        for (const a of db.assets) {
          if (a.currentJobId === id) {
            a.currentJobId = null;
            a.jobAssignedAt = null;
          }
        }
        saveDb(db);
        return { ok: true };
      }
    }
  }

  // Bookings
  if (pathname === '/api/bookings' && method === 'GET') return db.bookings;
  if (pathname === '/api/bookings' && method === 'POST') {
    const entry = {
      id: uid(),
      assetId: body.assetId,
      jobId: body.jobId || null,
      startDate: body.startDate,
      endDate: body.endDate,
      notes: body.notes || '',
      createdAt: new Date().toISOString(),
    };
    db.bookings.push(entry);
    saveDb(db);
    return entry;
  }
  {
    const m = pathname.match(/^\/api\/bookings\/([^/]+)$/);
    if (m) {
      const id = m[1];
      if (method === 'PUT') {
        const idx = db.bookings.findIndex((b) => b.id === id);
        if (idx < 0) throw notFound();
        db.bookings[idx] = { ...db.bookings[idx], ...body, id };
        saveDb(db);
        return db.bookings[idx];
      }
      if (method === 'DELETE') {
        db.bookings = db.bookings.filter((b) => b.id !== id);
        saveDb(db);
        return { ok: true };
      }
    }
  }

  // Dashboard
  if (pathname === '/api/dashboard' && method === 'GET') {
    const t = today();
    const lowFuel = db.assets.filter((a) => {
      if (a.fuelTankLitres == null || Number(a.fuelTankLitres) <= 0) return false;
      const pct = ((Number(a.fuelLevelLitres) || 0) / Number(a.fuelTankLitres)) * 100;
      return pct <= (db.settings.lowFuelThresholdPercent || 25);
    });
    const maintDue = db.maintenance.filter((m) => m.nextDue && String(m.nextDue) <= t);
    const assetsOnJobs = db.assets.filter((a) => a.currentJobId);
    const upcoming = db.bookings
      .filter((b) => String(b.startDate) >= t)
      .sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)))
      .slice(0, 8);
    return {
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
    };
  }

  // Planner
  if (pathname === '/api/planner' && method === 'GET') {
    const t = today();
    const assetStatus = db.assets.map((a) => {
      const maint = db.maintenance.filter((m) => m.assetId === a.id).map(normalizeMaint);
      const hasOverdue = maint.some(
        (m) =>
          (m.nextDue && String(m.nextDue) < t && m.status !== 'completed') ||
          m.status === 'overdue' ||
          (m.status === 'scheduled' && m.scheduledDate && String(m.scheduledDate) < t)
      );
      const oosNow =
        a.condition === 'Out of service' || maint.some((m) => isOosActive(m, t));
      const booked = db.bookings.some(
        (b) => b.assetId === a.id && String(b.startDate) <= t && String(b.endDate) >= t
      );
      let availability = 'available';
      if (oosNow || hasOverdue) availability = 'maintenance';
      else if (a.currentJobId) availability = 'on_job';
      else if (booked) availability = 'booked';
      return { ...a, availability, overdueMaint: hasOverdue };
    });
    return { jobs: db.jobs, assets: assetStatus, bookings: db.bookings, customers: db.customers };
  }

  // Reports
  if (pathname === '/api/reports/utilisation' && method === 'GET') {
    return db.assets.map((a) => {
      const bookingDays = db.bookings
        .filter((b) => b.assetId === a.id)
        .reduce((sum, b) => {
          const s = new Date(String(b.startDate));
          const e = new Date(String(b.endDate));
          const days = Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000) + 1);
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
  }

  if (pathname === '/api/reports/fuel' && method === 'GET') {
    const byAsset: Record<string, { litres: number; costGbp: number; entries: number }> = {};
    const byMonthMap: Record<string, { litres: number; costGbp: number; entries: number }> = {};
    for (const f of db.fuelLogs) {
      const aid = String(f.assetId);
      if (!byAsset[aid]) byAsset[aid] = { litres: 0, costGbp: 0, entries: 0 };
      byAsset[aid].litres += Number(f.litres) || 0;
      byAsset[aid].costGbp += Number(f.costGbp) || 0;
      byAsset[aid].entries += 1;
      const month = String(f.date || '').slice(0, 7);
      if (month) {
        if (!byMonthMap[month]) byMonthMap[month] = { litres: 0, costGbp: 0, entries: 0 };
        byMonthMap[month].litres += Number(f.litres) || 0;
        byMonthMap[month].costGbp += Number(f.costGbp) || 0;
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
    return { rows, byMonth, totalCost, totalLitres };
  }

  if (pathname === '/api/reports/maintenance-due' && method === 'GET') {
    const t = today();
    const all: DbRow[] = db.maintenance.map((m) => {
      const n = normalizeMaint(m);
      const a = db.assets.find((x) => x.id === n.assetId);
      const overdue =
        n.status === 'overdue' ||
        !!(n.nextDue && String(n.nextDue) < t && n.status !== 'completed') ||
        !!(n.status === 'scheduled' && n.scheduledDate && String(n.scheduledDate) < t);
      const dueSoon = !!(
        !overdue &&
        n.nextDue &&
        String(n.nextDue) >= t &&
        String(n.nextDue) <= addDays(t, 30)
      );
      const ok = !overdue && !dueSoon;
      return {
        ...n,
        assetName: a?.name,
        sku: a?.sku,
        category: a?.category,
        overdue,
        dueSoon,
        ok,
      };
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
      .sort((a, b) =>
        String(a.nextDue || a.scheduledDate || '').localeCompare(String(b.nextDue || b.scheduledDate || ''))
      );
    return { rows, summary, all };
  }

  if (pathname === '/api/reports/by-location' && method === 'GET') {
    const groups: Record<string, unknown[]> = {};
    for (const a of db.assets) {
      const key = String(a.postcode || a.locationDescription || 'Unspecified');
      if (!groups[key]) groups[key] = [];
      groups[key].push(a);
    }
    return groups;
  }

  if (pathname === '/api/reports/by-category' && method === 'GET') {
    const groups: Record<string, unknown[]> = {};
    for (const a of db.assets) {
      const key = String(a.category);
      if (!groups[key]) groups[key] = [];
      groups[key].push(a);
    }
    return groups;
  }

  const err = new Error(`Local API: no handler for ${method} ${pathname}`) as Error & {
    status: number;
  };
  err.status = 404;
  throw err;
}

function notFound(): Error & { status: number } {
  const err = new Error('Not found') as Error & { status: number };
  err.status = 404;
  return err;
}

/** Clear local session (logout in local mode). */
export function localLogout() {
  setSession(null);
}

/** Restore session from token for local mode when token starts with local- */
export function restoreLocalSessionFromToken(token: string | null): boolean {
  if (!token || !token.startsWith('local-')) return false;
  const existing = getSession();
  if (existing) return true;
  // Rehydrate demo session if token present but session missing
  setSession({
    id: DEMO_USER.id,
    email: DEMO_USER.email,
    name: DEMO_USER.name,
    role: DEMO_USER.role,
  });
  ensureSeeded();
  return true;
}
