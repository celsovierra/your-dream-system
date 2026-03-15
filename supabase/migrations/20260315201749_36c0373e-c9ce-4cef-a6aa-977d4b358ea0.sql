
CREATE TABLE public.bills_payable (
  id SERIAL PRIMARY KEY,
  description TEXT NOT NULL,
  supplier TEXT,
  category TEXT,
  payment_type TEXT NOT NULL DEFAULT 'single' CHECK (payment_type IN ('single', 'installment')),
  total_amount NUMERIC(10,2) NOT NULL,
  installments_count INTEGER DEFAULT 1,
  current_installment INTEGER DEFAULT 1,
  parent_bill_id INTEGER REFERENCES public.bills_payable(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  due_date DATE NOT NULL,
  paid_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.bills_payable ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on bills_payable" ON public.bills_payable
  FOR ALL TO public
  USING (true)
  WITH CHECK (true);
