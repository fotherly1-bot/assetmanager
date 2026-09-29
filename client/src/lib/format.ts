export function gbp(n: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n || 0);
}

export function fuelPercent(level: number | null | undefined, tank: number | null | undefined): number | null {
  if (tank == null || tank <= 0 || level == null) return null;
  return Math.max(0, Math.min(100, (level / tank) * 100));
}

export function fuelColour(pct: number): string {
  if (pct <= 20) return '#dc2626';
  if (pct <= 40) return '#d97706';
  if (pct <= 60) return '#ca8a04';
  return '#16a34a';
}

export function daysOnJob(assignedAt: string | null | undefined): string {
  if (!assignedAt) return '—';
  const ms = Date.now() - new Date(assignedAt).getTime();
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  if (days <= 0) return `${hours}h`;
  return `${days}d ${hours}h`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

export function daysBetween(start: string | null | undefined, end: string | null | undefined): number | null {
  if (!start) return null;
  const s = new Date(start.length === 10 ? start + 'T12:00:00' : start);
  const e = end
    ? new Date(end.length === 10 ? end + 'T12:00:00' : end)
    : new Date();
  const days = Math.round((e.getTime() - s.getTime()) / 86400000);
  return Number.isFinite(days) ? Math.max(0, days) : null;
}

export function formatOutOfService(start: string | null | undefined, end: string | null | undefined): string {
  if (!start) return '—';
  const days = daysBetween(start, end || todayISO());
  const range = end ? `${formatDate(start)} – ${formatDate(end)}` : `${formatDate(start)} – ongoing`;
  return days == null ? range : `${range} (${days} day${days === 1 ? '' : 's'})`;
}

export function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, (m || 1) - 1, 1);
  return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}
