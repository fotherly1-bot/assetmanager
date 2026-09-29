export type Category =
  | 'Vehicles'
  | 'Machinery / plant'
  | 'Hand tools'
  | 'Power tools'
  | 'Building products'
  | 'Consumables';

export type Condition = 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Out of service';
export type JobStatus = 'Planned' | 'In progress' | 'Completed' | 'On hold' | 'Cancelled';
export type Availability = 'available' | 'on_job' | 'maintenance' | 'booked';
export type MaintStatus = 'scheduled' | 'in_progress' | 'completed' | 'overdue';
export type MaintResult = 'Pass' | 'Fail' | 'Advisory' | '';

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface Customer {
  id: string;
  name: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  notes: string;
  createdAt: string;
}

export interface Asset {
  id: string;
  name: string;
  sku: string;
  category: Category;
  condition: Condition;
  fuelTankLitres: number | null;
  fuelLevelLitres: number | null;
  locationLat: number | null;
  locationLng: number | null;
  locationDescription: string;
  postcode: string;
  currentJobId: string | null;
  jobAssignedAt: string | null;
  quantity: number;
  reorderLevel: number | null;
  notes: string;
  createdAt: string;
  availability?: Availability;
  overdueMaint?: boolean;
  fuelLogs?: FuelLog[];
  maintenance?: MaintenanceRecord[];
  bookings?: Booking[];
  currentJob?: Job | null;
}

export interface Job {
  id: string;
  title: string;
  customerId: string;
  status: JobStatus;
  startDate: string;
  endDate: string;
  requiredAssetIds: string[];
  location: string;
  notes: string;
  createdAt: string;
  customer?: Customer;
  assets?: Asset[];
}

export interface FuelLog {
  id: string;
  assetId: string;
  date: string;
  litres: number;
  costGbp: number;
  odometerOrHours: number | null;
  notes: string;
  /** Data URL (image/* or application/pdf) of fuel receipt — MVP localStorage/JSON storage. */
  receiptDataUrl?: string | null;
  receiptName?: string | null;
  receiptMime?: string | null;
  createdAt: string;
}

export interface MaintenanceRecord {
  id: string;
  /** Human-readable unique maintenance log number, e.g. ML-0001 */
  logNumber: string;
  assetId: string;
  type: string;
  /** Completed date (legacy field name kept for compatibility). */
  date: string;
  scheduledDate: string;
  completedDate: string;
  nextDue: string;
  status: MaintStatus;
  result: MaintResult;
  costGbp: number;
  vendor: string;
  description: string;
  notes: string;
  outOfService: boolean;
  outOfServiceStart: string;
  outOfServiceEnd: string;
  createdAt: string;
  assetName?: string;
  sku?: string;
  category?: string;
  overdue?: boolean;
  dueSoon?: boolean;
}

export interface Booking {
  id: string;
  assetId: string;
  jobId: string | null;
  startDate: string;
  endDate: string;
  notes: string;
  createdAt: string;
}

export interface Settings {
  companyName: string;
  currency: string;
  lowFuelThresholdPercent: number;
  theme: string;
}

export const CATEGORIES: Category[] = [
  'Vehicles',
  'Machinery / plant',
  'Hand tools',
  'Power tools',
  'Building products',
  'Consumables',
];

export const CONDITIONS: Condition[] = ['Excellent', 'Good', 'Fair', 'Poor', 'Out of service'];
export const JOB_STATUSES: JobStatus[] = ['Planned', 'In progress', 'Completed', 'On hold', 'Cancelled'];
export const MAINT_TYPES = ['Service', 'MOT', 'PAT', 'LOLER', 'Inspection', 'Repair'];
export const MAINT_STATUSES: { value: MaintStatus; label: string }[] = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'overdue', label: 'Overdue' },
];
export const STOCK_CATEGORIES: Category[] = ['Hand tools', 'Power tools', 'Building products', 'Consumables'];
