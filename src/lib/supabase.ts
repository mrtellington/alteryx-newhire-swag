import { createClient } from '@supabase/supabase-js';

// Use environment variables for React app
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || '';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || '';

console.log('🔧 Supabase Environment Check:', {
  hasUrl: !!supabaseUrl,
  hasKey: !!supabaseAnonKey,
  urlLength: supabaseUrl.length,
  keyLength: supabaseAnonKey.length
});

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Supabase configuration missing. Please check your environment variables.');
  console.error('Required: REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY');
  console.error('Current values:', { supabaseUrl, supabaseAnonKey: supabaseAnonKey ? '[HIDDEN]' : 'undefined' });
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

// Database types
export interface User {
  id: string;
  email: string;
  invited: boolean;
  full_name: string;
  shipping_address: {
    address_line_1: string;
    address_line_2?: string;
    city: string;
    state: string;
    zip_code: string;
    country: string;
  };
  order_submitted: boolean;
  created_at: string;
}

export interface Order {
  id: string;
  user_id: string;
  date_submitted: string;
}

export interface Inventory {
  product_id: string;
  sku: string;
  name: string;
  quantity_available: number;
}

export interface CognitoFormSubmission {
  email: string;
  full_name: string;
  address_line_1: string;
  address_line_2?: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
}




