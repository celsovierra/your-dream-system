
-- Tabela para fila de cobrança automatizada
CREATE TABLE public.billing_queue (
  id serial PRIMARY KEY,
  client_id integer REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  client_name text NOT NULL,
  client_phone text NOT NULL,
  type text NOT NULL, -- reminder, due, overdue
  amount numeric,
  due_date date,
  days_overdue integer DEFAULT 0,
  status text NOT NULL DEFAULT 'pending', -- pending, sent, failed
  message text,
  created_at timestamptz DEFAULT now(),
  sent_at timestamptz
);

-- Tabela para configurações do sistema (horários, dias, etc)
CREATE TABLE public.billing_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- Valores padrão
INSERT INTO public.billing_settings (key, value) VALUES
  ('reminder_days', '3'),
  ('send_time_reminder', '08:00'),
  ('send_time_due', '08:00'),
  ('send_time_overdue', '09:00'),
  ('overdue_frequency', '3');

-- RLS
ALTER TABLE public.billing_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on billing_queue" ON public.billing_queue FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on billing_settings" ON public.billing_settings FOR ALL TO public USING (true) WITH CHECK (true);
