-- Alteryx Swag Portal Database Setup
-- Run this script in your Supabase SQL editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  invited BOOLEAN DEFAULT FALSE,
  full_name TEXT NOT NULL,
  shipping_address JSONB NOT NULL,
  order_submitted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  date_submitted TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inventory table
CREATE TABLE IF NOT EXISTS inventory (
  product_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  quantity_available INTEGER DEFAULT 0
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_invited ON users(invited);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(date_submitted);
CREATE INDEX IF NOT EXISTS idx_inventory_sku ON inventory(sku);

-- Insert sample inventory
INSERT INTO inventory (sku, name, quantity_available) 
VALUES ('ALT-SWAG-001', 'Alteryx Welcome Kit', 100)
ON CONFLICT (sku) DO NOTHING;

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Users can create orders" ON orders;
DROP POLICY IF EXISTS "Users can view own orders" ON orders;
DROP POLICY IF EXISTS "Anyone can view inventory" ON inventory;
DROP POLICY IF EXISTS "Authenticated users can update inventory" ON inventory;

-- Create RLS policies for users table
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Create RLS policies for orders table
CREATE POLICY "Users can create orders" ON orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own orders" ON orders
  FOR SELECT USING (auth.uid() = user_id);

-- Create RLS policies for inventory table
CREATE POLICY "Anyone can view inventory" ON inventory
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can update inventory" ON inventory
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Create function to handle user creation from webhook
CREATE OR REPLACE FUNCTION create_user_from_webhook(
  user_email TEXT,
  user_full_name TEXT,
  user_shipping_address JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_user_id UUID;
BEGIN
  -- Check if user already exists
  IF EXISTS (SELECT 1 FROM users WHERE email = user_email) THEN
    RAISE EXCEPTION 'User with email % already exists', user_email;
  END IF;

  -- Validate email domain - allow @alteryx.com and @whitestonebranding.com
  IF NOT (user_email LIKE '%@alteryx.com' OR user_email LIKE '%@whitestonebranding.com') THEN
    RAISE EXCEPTION 'Only @alteryx.com or @whitestonebranding.com email addresses are allowed';
  END IF;

  -- Create new user
  INSERT INTO users (email, full_name, invited, shipping_address)
  VALUES (user_email, user_full_name, true, user_shipping_address)
  RETURNING id INTO new_user_id;

  RETURN new_user_id;
END;
$$;

-- Create function to place order
CREATE OR REPLACE FUNCTION place_order()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_record users%ROWTYPE;
  inventory_record inventory%ROWTYPE;
  new_order_id UUID;
BEGIN
  -- Get current user
  SELECT * INTO user_record FROM users WHERE id = auth.uid();
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Check if user has already ordered
  IF user_record.order_submitted THEN
    RAISE EXCEPTION 'User has already placed an order';
  END IF;

  -- Get inventory
  SELECT * INTO inventory_record FROM inventory LIMIT 1;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No inventory available';
  END IF;

  -- Check if inventory is available
  IF inventory_record.quantity_available <= 0 THEN
    RAISE EXCEPTION 'Item is out of stock';
  END IF;

  -- Create order
  INSERT INTO orders (user_id)
  VALUES (auth.uid())
  RETURNING id INTO new_order_id;

  -- Update user order status
  UPDATE users SET order_submitted = true WHERE id = auth.uid();

  -- Update inventory
  UPDATE inventory SET quantity_available = quantity_available - 1;

  RETURN new_order_id;
END;
$$;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- Create sample data for testing (optional)
-- INSERT INTO users (email, full_name, invited, shipping_address) VALUES
--   ('test@alteryx.com', 'Test User', true, '{"address_line_1": "123 Test St", "city": "Test City", "state": "CA", "zip_code": "12345", "country": "USA"}');
