
CREATE TABLE public.fee_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  amount_cents integer NOT NULL DEFAULT 0,
  percent numeric(6,3) NOT NULL DEFAULT 0,
  scope text NOT NULL DEFAULT 'per_unit' CHECK (scope IN ('per_unit','per_order')),
  taxable boolean NOT NULL DEFAULT false,
  tax_rate_id uuid REFERENCES public.tax_rates(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.fee_categories TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.fee_categories TO authenticated;
GRANT ALL ON public.fee_categories TO service_role;

ALTER TABLE public.fee_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fee_categories readable by all"
  ON public.fee_categories FOR SELECT
  USING (is_active OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "fee_categories admin write"
  ON public.fee_categories FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER fee_categories_set_updated_at
  BEFORE UPDATE ON public.fee_categories
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.products
  ADD COLUMN tax_rate_id uuid REFERENCES public.tax_rates(id) ON DELETE SET NULL,
  ADD COLUMN price_includes_tax boolean NOT NULL DEFAULT false,
  ADD COLUMN fee_category_id uuid REFERENCES public.fee_categories(id) ON DELETE SET NULL;

ALTER TABLE public.orders
  ADD COLUMN fee_cents integer NOT NULL DEFAULT 0;
