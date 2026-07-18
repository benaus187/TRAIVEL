-- Phase 4b: add day number to stops for pagination
ALTER TABLE public.stops ADD COLUMN IF NOT EXISTS day int DEFAULT 1;
