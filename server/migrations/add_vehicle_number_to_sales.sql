-- Migration: Add vehicle_number column to sales table
-- This migration adds the vehicle_number column to the sales table for tracking customer vehicle numbers

-- Add vehicle_number column to sales table
ALTER TABLE sales 
  ADD COLUMN IF NOT EXISTS vehicle_number VARCHAR(100);

-- Create index for vehicle_number for better query performance
CREATE INDEX IF NOT EXISTS idx_sales_vehicle_number ON sales(vehicle_number);

-- Add comment
COMMENT ON COLUMN sales.vehicle_number IS 'Vehicle number for the customer purchase';

