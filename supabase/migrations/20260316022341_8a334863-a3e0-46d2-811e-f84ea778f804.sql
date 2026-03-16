ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS traccar_email TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS clients_name_phone_unique ON public.clients (name, phone);