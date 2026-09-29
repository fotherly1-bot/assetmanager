import { overlaps, todayISO, formatDate } from './format';
import { categoryLabel } from './categories';
import type { Asset, Booking, Job, MaintenanceRecord, Settings } from '../types';

export type InsightSeverity = 'info' | 'warn' | 'critical';

export type InsightGroup =
  | 'vehicles_needed'
  | 'overbooking'
  | 'hire'
  | 'maintenance_clash'
  | 'low_fuel'
  | 'stock'
  | 'idle_plant'
  | 'concentration';

export interface Insight {
  id: string;
  group: InsightGroup;
  severity: InsightSeverity;
  title: string;
  detail: string;
  action?: string;
}

export const INSIGHT_GROUP_META: Record<
  InsightGroup,
  { title: string; blurb: string }
> = {
  vehicles_needed: {
    title: 'Vehicles needed for future jobs',
    blurb: 'Required vehicles and plant versus what is free in each date window.',
  },
  overbooking: {
    title: 'Overbooking / capacity pressure',
    blurb: 'Double-booked assets and jobs asking for more vans or tools than the free fleet.',
  },
  hire: {
    title: 'Hire suggestions',
    blurb: 'Plant or vehicles to hire to fill planner holes.',
  },
  maintenance_clash: {
    title: 'Maintenance clashes',
    blurb: 'Out-of-service or scheduled works that collide with booked jobs.',
  },
  low_fuel: {
    title: 'Low fuel on assigned vehicles',
    blurb: 'Assigned or soon-to-be-booked plant running at or below the fuel threshold.',
  },
  stock: {
    title: 'Stock below reorder',
    blurb: 'Consumables and building products under reorder level with upcoming jobs.',
  },
  idle_plant: {
    title: 'Idle high-value plant',
    blurb: 'Vehicles and machinery with no bookings in the next 30 days.',
  },
  concentration: {
    title: 'Job concentration',
    blurb: 'Workload piled onto a small set of vehicles.',
  },
};

const HIGH_VALUE: ReadonlySet<string> = new Set(['Vehicles', 'Machinery / plant']);
const STOCK_CATS: ReadonlySet<string> = new Set(['Building products', 'Consumables']);
const FLEET_CATS: ReadonlySet<string> = new Set(['Vehicles', 'Machinery / plant', 'Power tools']);

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function isOpenJob(j: Job): boolean {
  return j.status !== 'Completed' && j.status !== 'Cancelled';
}

function isFutureOrActive(j: Job, today: string): boolean {
  return isOpenJob(j) && j.endDate >= today;
}

function assetById(assets: Asset[], id: string): Asset | undefined {
  return assets.find((a) => a.id === id);
}

function isOosInWindow(m: MaintenanceRecord, start: string, end: string): boolean {
  if (!m.outOfService) return false;
  const s = m.outOfServiceStart || m.scheduledDate || m.date;
  if (!s) return false;
  const e = m.outOfServiceEnd || '9999-12-31';
  return overlaps(s, e, start, end);
}

function maintBlocksWindow(m: MaintenanceRecord, start: string, end: string): boolean {
  if (m.status === 'completed') return false;
  if (isOosInWindow(m, start, end)) return true;
  // Scheduled / in-progress service overlapping the window (treat as unavailable that day)
  if (
    (m.status === 'scheduled' || m.status === 'in_progress' || m.status === 'overdue') &&
    m.scheduledDate &&
    overlaps(m.scheduledDate, m.scheduledDate, start, end)
  ) {
    return true;
  }
  return false;
}

function bookingsForAsset(bookings: Booking[], assetId: string): Booking[] {
  return bookings.filter((b) => b.assetId === assetId);
}

function isBookedInWindow(bookings: Booking[], assetId: string, start: string, end: string, excludeBookingId?: string): boolean {
  return bookings.some(
    (b) =>
      b.assetId === assetId &&
      b.id !== excludeBookingId &&
      overlaps(b.startDate, b.endDate, start, end)
  );
}

function freeFleetInWindow(
  assets: Asset[],
  bookings: Booking[],
  maintenance: MaintenanceRecord[],
  category: string,
  start: string,
  end: string,
  excludeAssetIds: Set<string> = new Set()
): Asset[] {
  return assets.filter((a) => {
    if (a.category !== category) return false;
    if (excludeAssetIds.has(a.id)) return false;
    if (a.condition === 'Out of service') return false;
    if (maintenance.some((m) => m.assetId === a.id && maintBlocksWindow(m, start, end))) return false;
    if (isBookedInWindow(bookings, a.id, start, end)) return false;
    return true;
  });
}

export function computeInsights(input: {
  assets: Asset[];
  jobs: Job[];
  bookings: Booking[];
  maintenance: MaintenanceRecord[];
  settings: Pick<Settings, 'lowFuelThresholdPercent'>;
  today?: string;
}): Insight[] {
  const today = input.today || todayISO();
  const { assets, jobs, bookings, maintenance, settings } = input;
  const threshold = settings.lowFuelThresholdPercent ?? 25;
  const insights: Insight[] = [];
  const hireKeys = new Set<string>();

  const openJobs = jobs.filter((j) => isFutureOrActive(j, today)).sort((a, b) => a.startDate.localeCompare(b.startDate));

  // --- 1. Vehicles / plant needed vs available ---
  for (const job of openJobs) {
    const required = (job.requiredAssetIds || [])
      .map((id) => assetById(assets, id))
      .filter((a): a is Asset => !!a);

    const byCat: Record<string, Asset[]> = {};
    for (const a of required) {
      if (!FLEET_CATS.has(a.category)) continue;
      if (!byCat[a.category]) byCat[a.category] = [];
      byCat[a.category].push(a);
    }

    for (const [cat, reqList] of Object.entries(byCat)) {
      const shortfalls: string[] = [];
      for (const req of reqList) {
        const blocked =
          req.condition === 'Out of service' ||
          maintenance.some((m) => m.assetId === req.id && maintBlocksWindow(m, job.startDate, job.endDate)) ||
          bookings.some(
            (b) =>
              b.assetId === req.id &&
              b.jobId !== job.id &&
              overlaps(b.startDate, b.endDate, job.startDate, job.endDate)
          );

        if (!blocked) continue;

        const free = freeFleetInWindow(
          assets,
          bookings,
          maintenance,
          cat,
          job.startDate,
          job.endDate,
          new Set([req.id, ...reqList.map((r) => r.id)])
        );
        if (free.length === 0) {
          shortfalls.push(req.name);
        }
      }

      if (shortfalls.length > 0) {
        const window = `${formatDate(job.startDate)} – ${formatDate(job.endDate)}`;
        insights.push({
          id: `need-${job.id}-${cat}`,
          group: 'vehicles_needed',
          severity: 'critical',
          title: `Shortfall: ${categoryLabel(cat)} for “${job.title}”`,
          detail: `${shortfalls.join(', ')} unavailable ${window}. No free ${categoryLabel(cat).toLowerCase()} in the fleet for that window.`,
          action: `Arrange cover or hire ${categoryLabel(cat).toLowerCase()} for ${window}.`,
        });
        const hk = `${cat}|${job.startDate}|${job.endDate}`;
        if (!hireKeys.has(hk)) {
          hireKeys.add(hk);
          insights.push({
            id: `hire-${job.id}-${cat}`,
            group: 'hire',
            severity: 'warn',
            title: `Hire ${categoryLabel(cat)} · ${window}`,
            detail: `Needed for “${job.title}” because ${shortfalls.join(', ')} cannot cover the dates.`,
            action: `Request hire: ${categoryLabel(cat)}, ${window}.`,
          });
        }
      }
    }
  }

  // --- 2. Overbooking / capacity pressure ---
  const byAssetBookings = new Map<string, Booking[]>();
  for (const b of bookings) {
    if (b.endDate < today) continue;
    const list = byAssetBookings.get(b.assetId) || [];
    list.push(b);
    byAssetBookings.set(b.assetId, list);
  }

  for (const [assetId, list] of byAssetBookings) {
    const asset = assetById(assets, assetId);
    if (!asset) continue;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (!overlaps(a.startDate, a.endDate, b.startDate, b.endDate)) continue;
        const jobA = jobs.find((x) => x.id === a.jobId);
        const jobB = jobs.find((x) => x.id === b.jobId);
        insights.push({
          id: `dbl-${a.id}-${b.id}`,
          group: 'overbooking',
          severity: 'critical',
          title: `${asset.name} is double-booked`,
          detail: `Overlapping ${formatDate(a.startDate)} – ${formatDate(a.endDate)} (${jobA?.title || a.notes || 'booking'}) and ${formatDate(b.startDate)} – ${formatDate(b.endDate)} (${jobB?.title || b.notes || 'booking'}).`,
          action: 'Reassign one job or hire a matching vehicle/plant for the clash window.',
        });
      }
    }
  }

  // Capacity: concurrent demand for Vehicles vs fleet size on peak days
  const horizonEnd = addDays(today, 45);
  const vehicleFleet = assets.filter((a) => a.category === 'Vehicles');
  const toolFleet = assets.filter((a) => a.category === 'Power tools' || a.category === 'Hand tools');

  let peakVehicleDemand = 0;
  let peakVehicleDay = today;
  let peakToolDemand = 0;
  let peakToolDay = today;
  for (let d = today; d <= horizonEnd; d = addDays(d, 1)) {
    // Count required vehicle slots that day
    let vSlots = 0;
    let tSlots = 0;
    for (const j of openJobs) {
      if (j.startDate > d || j.endDate < d) continue;
      for (const id of j.requiredAssetIds || []) {
        const a = assetById(assets, id);
        if (!a) continue;
        if (a.category === 'Vehicles') vSlots += 1;
        if (a.category === 'Power tools' || a.category === 'Hand tools') tSlots += 1;
      }
    }
    if (vSlots > peakVehicleDemand) {
      peakVehicleDemand = vSlots;
      peakVehicleDay = d;
    }
    if (tSlots > peakToolDemand) {
      peakToolDemand = tSlots;
      peakToolDay = d;
    }
  }

  const availableVans = vehicleFleet.filter((a) => a.condition !== 'Out of service').length;
  if (peakVehicleDemand > availableVans) {
    insights.push({
      id: 'cap-vans',
      group: 'overbooking',
      severity: 'critical',
      title: 'More vans needed on the planner',
      detail: `Peak demand is ${peakVehicleDemand} vehicles on ${formatDate(peakVehicleDay)}, but only ${availableVans} vans/plant vehicles are in service.`,
      action: `Hire at least ${peakVehicleDemand - availableVans} extra van(s) around ${formatDate(peakVehicleDay)}.`,
    });
    const hk = `Vehicles|peak|${peakVehicleDay}`;
    if (!hireKeys.has(hk)) {
      hireKeys.add(hk);
      insights.push({
        id: 'hire-vans-peak',
        group: 'hire',
        severity: 'critical',
        title: `Hire Vehicles · around ${formatDate(peakVehicleDay)}`,
        detail: `Fleet short by ${peakVehicleDemand - availableVans} against concurrent job demand.`,
        action: 'Place a short-term van hire for the peak week.',
      });
    }
  } else if (peakVehicleDemand >= availableVans && peakVehicleDemand > 0) {
    insights.push({
      id: 'cap-vans-tight',
      group: 'overbooking',
      severity: 'warn',
      title: 'Van capacity is tight',
      detail: `Peak concurrent vehicle demand (${peakVehicleDemand}) matches the in-service fleet (${availableVans}) on ${formatDate(peakVehicleDay)}. Little slack for call-outs.`,
      action: 'Keep a contingency hire option on standby for reactive Area work.',
    });
  }

  const availableTools = toolFleet.reduce((s, a) => s + (a.condition === 'Out of service' ? 0 : a.quantity || 1), 0);
  if (peakToolDemand > availableTools) {
    insights.push({
      id: 'cap-tools',
      group: 'overbooking',
      severity: 'warn',
      title: 'More tools needed for concurrent jobs',
      detail: `Peak tool demand is ${peakToolDemand} on ${formatDate(peakToolDay)} against ${availableTools} available tool units.`,
      action: 'Hire or buy additional power tools before the peak week.',
    });
  }

  // --- 3. Hire for OOS plant with bookings ---
  for (const b of bookings) {
    if (b.endDate < today) continue;
    const asset = assetById(assets, b.assetId);
    if (!asset || !HIGH_VALUE.has(asset.category)) continue;
    const oos = maintenance.some((m) => m.assetId === asset.id && isOosInWindow(m, b.startDate, b.endDate));
    const condOos = asset.condition === 'Out of service';
    if (!oos && !condOos) continue;
    const window = `${formatDate(b.startDate)} – ${formatDate(b.endDate)}`;
    const hk = `${asset.category}|${b.startDate}|${b.endDate}|${asset.id}`;
    if (hireKeys.has(hk)) continue;
    hireKeys.add(hk);
    const job = jobs.find((j) => j.id === b.jobId);
    insights.push({
      id: `hire-oos-${b.id}`,
      group: 'hire',
      severity: 'critical',
      title: `Hire ${categoryLabel(asset.category)} · ${window}`,
      detail: `${asset.name} is out of service during ${job ? `“${job.title}”` : 'a reserved booking'} (${window}).`,
      action: `Hire a like-for-like ${categoryLabel(asset.category).toLowerCase()} for ${window}.`,
    });
  }

  // --- 4. Maintenance taking plant out during booked jobs ---
  for (const m of maintenance) {
    if (m.status === 'completed') continue;
    const asset = assetById(assets, m.assetId);
    if (!asset) continue;
    const related = bookings.filter((b) => {
      if (b.assetId !== asset.id || b.endDate < today) return false;
      if (isOosInWindow(m, b.startDate, b.endDate)) return true;
      if (m.scheduledDate && overlaps(m.scheduledDate, m.scheduledDate, b.startDate, b.endDate)) return true;
      return false;
    });
    if (related.length === 0) continue;
    const jobTitles = related
      .map((b) => jobs.find((j) => j.id === b.jobId)?.title || b.notes || 'booking')
      .join('; ');
    const sev: InsightSeverity = m.outOfService || asset.condition === 'Out of service' ? 'critical' : 'warn';
    insights.push({
      id: `maint-clash-${m.id}`,
      group: 'maintenance_clash',
      severity: sev,
      title: `${asset.name}: ${m.type} clashes with bookings`,
      detail: `${m.description || m.notes || m.type} (${m.status.replace('_', ' ')}) overlaps ${jobTitles}.`,
      action: m.outOfService
        ? 'Keep plant off the board until released, and hire cover if the job cannot slip.'
        : 'Move the service outside the job window or reassign the asset.',
    });
  }

  // --- 5. Low fuel on assigned / soon-booked vehicles ---
  for (const a of assets) {
    if (a.fuelTankLitres == null || Number(a.fuelTankLitres) <= 0) continue;
    const pct = ((Number(a.fuelLevelLitres) || 0) / Number(a.fuelTankLitres)) * 100;
    if (pct > threshold) continue;
    const upcoming = bookings.filter((b) => b.assetId === a.id && b.endDate >= today);
    const assigned = !!a.currentJobId;
    if (!assigned && upcoming.length === 0) continue;
    const job = a.currentJobId ? jobs.find((j) => j.id === a.currentJobId) : undefined;
    const next = upcoming.sort((x, y) => x.startDate.localeCompare(y.startDate))[0];
    const nextJob = next ? jobs.find((j) => j.id === next.jobId) : undefined;
    insights.push({
      id: `fuel-${a.id}`,
      group: 'low_fuel',
      severity: pct <= 15 ? 'critical' : 'warn',
      title: `${a.name} is low on fuel (${pct.toFixed(0)}%)`,
      detail: assigned
        ? `Assigned to “${job?.title || 'current job'}” with tank at ${Number(a.fuelLevelLitres).toFixed(0)} / ${a.fuelTankLitres} litres.`
        : `Booked for “${nextJob?.title || next?.notes || 'upcoming work'}” from ${formatDate(next!.startDate)} with only ${pct.toFixed(0)}% fuel.`,
      action: 'Top up at the depot bowser before the next shift.',
    });
  }

  // --- 6. Stock below reorder with upcoming jobs ---
  const upcomingNeeds = new Set<string>();
  for (const j of openJobs) {
    for (const id of j.requiredAssetIds || []) upcomingNeeds.add(id);
  }
  for (const a of assets) {
    if (!STOCK_CATS.has(a.category)) continue;
    if (a.reorderLevel == null) continue;
    if (a.quantity > a.reorderLevel) continue;
    const linked = upcomingNeeds.has(a.id);
    const hasUpcomingWork = openJobs.length > 0;
    if (!linked && !hasUpcomingWork) continue;
    insights.push({
      id: `stock-${a.id}`,
      group: 'stock',
      severity: a.quantity === 0 ? 'critical' : 'warn',
      title: `${a.name} below reorder (${a.quantity} ≤ ${a.reorderLevel})`,
      detail: linked
        ? `Required on upcoming job(s) and stock is at or below reorder level.`
        : `Building products / consumables are low while ${openJobs.length} job(s) remain on the planner.`,
      action: `Raise a purchase order for ${a.name} (SKU ${a.sku}).`,
    });
  }

  // --- 7. Idle high-value plant (next 30 days) ---
  const idleUntil = addDays(today, 30);
  for (const a of assets) {
    if (!HIGH_VALUE.has(a.category)) continue;
    if (a.condition === 'Out of service') continue;
    const busy =
      (a.currentJobId && openJobs.some((j) => j.id === a.currentJobId && j.endDate >= today)) ||
      bookings.some((b) => b.assetId === a.id && overlaps(b.startDate, b.endDate, today, idleUntil));
    if (busy) continue;
    insights.push({
      id: `idle-${a.id}`,
      group: 'idle_plant',
      severity: 'info',
      title: `${a.name} is idle for the next 30 days`,
      detail: `No bookings between ${formatDate(today)} and ${formatDate(idleUntil)}. Consider internal use, hire-out, or bringing forward planned work.`,
      action: 'Offer to active jobs or list for short-term hire-out.',
    });
  }

  // --- 8. Concentration of jobs on few vehicles ---
  const vehicleLoad: { asset: Asset; jobs: Set<string>; days: number }[] = [];
  for (const a of assets.filter((x) => x.category === 'Vehicles')) {
    const jobIds = new Set<string>();
    let days = 0;
    for (const b of bookingsForAsset(bookings, a.id)) {
      if (b.endDate < today) continue;
      if (b.jobId) jobIds.add(b.jobId);
      const s = new Date(b.startDate + 'T12:00:00');
      const e = new Date(b.endDate + 'T12:00:00');
      days += Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000) + 1);
    }
    if (jobIds.size > 0 || days > 0) vehicleLoad.push({ asset: a, jobs: jobIds, days });
  }
  vehicleLoad.sort((a, b) => b.jobs.size - a.jobs.size || b.days - a.days);
  if (vehicleLoad.length >= 2) {
    const top = vehicleLoad[0];
    const restAvg =
      vehicleLoad.slice(1).reduce((s, x) => s + x.jobs.size, 0) / Math.max(1, vehicleLoad.length - 1);
    if (top.jobs.size >= 2 && top.jobs.size >= restAvg + 1) {
      const titles = [...top.jobs]
        .map((id) => jobs.find((j) => j.id === id)?.title || id)
        .join('; ');
      insights.push({
        id: `conc-${top.asset.id}`,
        group: 'concentration',
        severity: 'warn',
        title: `${top.asset.name} carries ${top.jobs.size} upcoming jobs`,
        detail: `Workload is concentrated on this vehicle (${titles}). Other vans average ~${restAvg.toFixed(1)} jobs.`,
        action: 'Spread reactive call-outs across the fleet or hire a spare tipper/van.',
      });
    }
  }

  const severityRank: Record<InsightSeverity, number> = { critical: 0, warn: 1, info: 2 };
  insights.sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || a.group.localeCompare(b.group));
  return insights;
}

export function groupInsights(insights: Insight[]): { group: InsightGroup; items: Insight[] }[] {
  const order: InsightGroup[] = [
    'vehicles_needed',
    'overbooking',
    'hire',
    'maintenance_clash',
    'low_fuel',
    'stock',
    'idle_plant',
    'concentration',
  ];
  return order
    .map((group) => ({ group, items: insights.filter((i) => i.group === group) }))
    .filter((g) => g.items.length > 0);
}
