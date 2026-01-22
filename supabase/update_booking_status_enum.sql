-- Add new statuses to the booking_status enum
-- Run this in your Supabase SQL Editor

ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'pending_approval';
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'approved_pending_payment';
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'rejected';
