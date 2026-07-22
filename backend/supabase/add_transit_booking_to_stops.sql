-- Phase 1: add transit notes and booking URLs to stops
ALTER TABLE public.stops ADD COLUMN IF NOT EXISTS transit_note text;
ALTER TABLE public.stops ADD COLUMN IF NOT EXISTS booking_url text;
