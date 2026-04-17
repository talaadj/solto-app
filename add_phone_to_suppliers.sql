-- Run this in your Supabase SQL Editor to add the 'phone' field to the 'suppliers' table
ALTER TABLE IF EXISTS suppliers 
ADD COLUMN IF NOT EXISTS phone TEXT;
