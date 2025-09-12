export type Role = 'shipper' | 'forwarder' | 'carrier' | 'broker' | 'other';

export interface Profile {
  id: string;
  username: string;
  display_name?: string | null;
  role?: Role;
  onboarding_completed?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
  company_name?: string | null;
  website?: string | null;
  location?: string | null;
  phone?: string | null;
  email?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  banner_url?: string | null;
  noble_score?: number | null;
  completed_requests?: number | null;
  completed_shipments?: number | null;
  average_rating?: number | null;
  details?: Record<string, any> | null;
  last_active_at?: string | null;
}
