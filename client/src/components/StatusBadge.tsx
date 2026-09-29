import type { Availability, Condition, JobStatus } from '../types';

export function JobStatusBadge({ status }: { status: JobStatus | string }) {
  const map: Record<string, string> = {
    Planned: 'badge-blue',
    'In progress': 'badge-green',
    Completed: 'badge-grey',
    'On hold': 'badge-amber',
    Cancelled: 'badge-red',
  };
  return <span className={`badge ${map[status] || 'badge-grey'}`}>{status}</span>;
}

export function ConditionBadge({ condition }: { condition: Condition | string }) {
  const map: Record<string, string> = {
    Excellent: 'badge-green',
    Good: 'badge-green',
    Fair: 'badge-amber',
    Poor: 'badge-red',
    'Out of service': 'badge-red',
  };
  return <span className={`badge ${map[condition] || 'badge-grey'}`}>{condition}</span>;
}

export function AvailabilityBadge({ availability }: { availability: Availability | string }) {
  const labels: Record<string, string> = {
    available: 'Available',
    on_job: 'On another job',
    maintenance: 'Maintenance',
    booked: 'Booked',
  };
  const map: Record<string, string> = {
    available: 'badge-green',
    on_job: 'badge-blue',
    maintenance: 'badge-red',
    booked: 'badge-amber',
  };
  return <span className={`badge ${map[availability] || 'badge-grey'}`}>{labels[availability] || availability}</span>;
}
