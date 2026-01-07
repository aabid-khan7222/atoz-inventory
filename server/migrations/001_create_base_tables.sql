-- Base tables for authentication and user management
-- Run this FIRST before any other migrations

-- Create roles table
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  role_name VARCHAR(50) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default roles
INSERT INTO roles (id, role_name) VALUES 
  (1, 'Super Admin'),
  (2, 'Admin'),
  (3, 'Customer')
ON CONFLICT (id) DO NOTHING;

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(20),
  password VARCHAR(255),
  role_id INTEGER NOT NULL DEFAULT 3,
  is_active BOOLEAN DEFAULT true,
  state VARCHAR(100),
  city VARCHAR(100),
  address TEXT,
  gst_number VARCHAR(50),
  company_name VARCHAR(255),
  company_address TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES roles(id)
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- Create customer_profiles table (if not exists)
CREATE TABLE IF NOT EXISTS customer_profiles (
  user_id INTEGER PRIMARY KEY,
  phone VARCHAR(20),
  state VARCHAR(100),
  city VARCHAR(100),
  address TEXT,
  pincode VARCHAR(10),
  is_business_customer BOOLEAN DEFAULT false,
  company_name VARCHAR(255),
  gst_number VARCHAR(50),
  company_address TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

