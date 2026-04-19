export interface Project {
  id: number;
  name: string;
  address: string;
  created_at: string;
}

export interface Request {
  id: number;
  project_id: number;
  title: string;
  description: string;
  quantity: number;
  unit: string;
  status: 'pending' | 'approved' | 'procurement' | 'payment_pending' | 'purchased' | 'delivered';
  foreman_id: string;
  created_at: string;
}

export interface ProcurementOffer {
  id: number;
  request_id: number;
  supplier_name: string;
  supplier_phone: string;
  supplier_email: string;
  supplier_address: string;
  rating: number;
  price: number;
  details: string;
  source_url?: string;
  reliability_score?: number;
  risk_assessment?: string;
  status: 'pending' | 'approved';
  approved_quantity?: number;
  approved_amount?: number;
  payment_method?: string;
  payment_notes?: string;
}

export interface InventoryItem {
  id: number;
  item_name: string;
  quantity: number;
  unit: string;
}

export interface Transaction {
  id: number;
  type: 'expense' | 'income';
  amount: number;
  description: string;
  created_at: string;
}

export type UserRole = 'director' | 'foreman' | 'procurement' | 'accountant' | 'storekeeper' | 'worker';

export interface Worker {
  id: number;
  company_id: number;
  project_id: number | null;
  full_name: string;
  phone: string;
  position: string;
  daily_rate: number;
  work_start: string;
  work_end: string;
  status: 'active' | 'inactive';
  user_id: string | null;
  created_at: string;
}

export interface Geofence {
  id: number;
  project_id: number;
  company_id: number;
  center_lat: number;
  center_lng: number;
  radius_meters: number;
  name: string;
  created_at: string;
}

export interface GpsLog {
  id: number;
  worker_id: number;
  lat: number;
  lng: number;
  in_zone: boolean;
  logged_at: string;
}

export interface Attendance {
  id: number;
  worker_id: number;
  project_id: number;
  date: string;
  check_in: string | null;
  check_out: string | null;
  hours_worked: number;
  in_zone_percent: number;
  status: 'present' | 'absent' | 'late';
  created_at: string;
  // joined
  worker_name?: string;
}
