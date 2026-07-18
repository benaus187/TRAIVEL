-- Phase 4: add coordinates to stops for map view
ALTER TABLE public.stops ADD COLUMN IF NOT EXISTS lat double precision;
ALTER TABLE public.stops ADD COLUMN IF NOT EXISTS lon double precision;
