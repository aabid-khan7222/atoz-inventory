-- Migration: Add vehicle_number column to stock_history table for tracking vehicle numbers of sold batteries
-- This migration adds the vehicle_number column to the stock_history table

-- Add vehicle_number column to stock_history table
ALTER TABLE stock_history 
  ADD COLUMN IF NOT EXISTS vehicle_number VARCHAR(100);

-- Create index for vehicle_number for better query performance
CREATE INDEX IF NOT EXISTS idx_stock_history_vehicle_number ON stock_history(vehicle_number);

-- Add comment
COMMENT ON COLUMN stock_history.vehicle_number IS 'Vehicle number for sold batteries';

