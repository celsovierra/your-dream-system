
-- Add owner_id column to all data tables for multi-tenant isolation
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS owner_id text;
ALTER TABLE public.billing_queue ADD COLUMN IF NOT EXISTS owner_id text;
ALTER TABLE public.message_templates ADD COLUMN IF NOT EXISTS owner_id text;
ALTER TABLE public.bills_payable ADD COLUMN IF NOT EXISTS owner_id text;
ALTER TABLE public.billing_settings ADD COLUMN IF NOT EXISTS owner_id text;
