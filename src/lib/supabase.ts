import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type UserType = 'patient' | 'caregiver' | 'family' | 'admin';

export type RequestStatus =
  | 'searching'
  | 'awaiting_approval'
  | 'scheduled'
  | 'in_progress'
  | 'awaiting_payment'
  | 'completed'
  | 'cancelled';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  avatar_url: string;
  user_type: UserType;
  verified: boolean;
  active: boolean;
  created_at: string;
}

export interface Caregiver {
  id: string;
  user_id: string;
  cpf: string;
  bio: string;
  experience_years: number;
  avg_rating: number;
  total_ratings: number;
  total_services: number;
  status: 'available' | 'busy' | 'offline' | 'suspended';
  pix_key: string;
  available_balance: number;
  pending_balance: number;
  latitude: number | null;
  longitude: number | null;
  profiles?: Profile;
  caregiver_specialties?: { specialties: { name: string } }[];
}

export interface Patient {
  id: string;
  user_id: string;
  date_of_birth: string;
  gender: string;
  health_conditions: string;
  avg_rating: number;
  total_ratings: number;
  profiles?: Profile;
}

export interface CareRequest {
  id: string;
  patient_id: string;
  caregiver_id: string | null;
  requester_id: string;
  care_type: string;
  status: RequestStatus;
  scheduled_at: string;
  duration_minutes: number;
  actual_start_at: string | null;
  actual_end_at: string | null;
  actual_duration_minutes: number | null;
  location_address: string;
  latitude: number | null;
  longitude: number | null;
  proposed_value: number;
  final_value: number | null;
  observations: string;
  interested_caregivers: string[];
  rejected_caregivers: string[];
  created_at: string;
  patients?: Patient;
  caregivers?: Caregiver;
}

export interface MonitoringPhoto {
  id: string;
  request_id: string;
  caregiver_id: string;
  photo_url: string;
  latitude: number | null;
  longitude: number | null;
  photo_type: 'start' | 'periodic' | 'end';
  taken_at: string;
  metadata: Record<string, unknown>;
}

export interface Message {
  id: string;
  request_id: string;
  sender_id: string;
  content: string;
  message_type: 'text' | 'image' | 'system';
  media_url: string;
  read: boolean;
  created_at: string;
  profiles?: Profile;
}

export interface Payment {
  id: string;
  request_id: string;
  payment_method: 'card' | 'pix' | 'cash';
  gross_amount: number;
  platform_fee: number;
  net_amount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
  pix_qr_code: string;
  pix_copy_paste: string;
  transaction_id: string;
  paid_at: string | null;
  created_at: string;
}

export interface Rating {
  id: string;
  request_id: string;
  reviewer_id: string;
  reviewed_id: string;
  score: number;
  comment: string;
  created_at: string;
  profiles?: Profile;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  request_id: string | null;
  read: boolean;
  created_at: string;
}

export interface Withdrawal {
  id: string;
  caregiver_id: string;
  amount: number;
  pix_key: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  requested_at: string;
  processed_at: string | null;
  completed_at: string | null;
}
