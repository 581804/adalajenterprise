
CREATE OR REPLACE FUNCTION public.redeem_discount(_code text, _subtotal_cents integer)
RETURNS TABLE (id uuid, code text, type public.discount_type, value numeric, discount_cents integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d public.discounts%ROWTYPE;
  _amount integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO d FROM public.discounts WHERE upper(code) = upper(_code) LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid discount code'; END IF;
  IF NOT d.is_active THEN RAISE EXCEPTION 'Discount is not active'; END IF;
  IF d.starts_at IS NOT NULL AND now() < d.starts_at THEN RAISE EXCEPTION 'Discount not started yet'; END IF;
  IF d.ends_at IS NOT NULL AND now() > d.ends_at THEN RAISE EXCEPTION 'Discount expired'; END IF;
  IF _subtotal_cents < COALESCE(d.min_subtotal_cents, 0) THEN RAISE EXCEPTION 'Order does not meet minimum'; END IF;
  IF d.usage_limit IS NOT NULL AND d.used_count >= d.usage_limit THEN RAISE EXCEPTION 'Discount usage limit reached'; END IF;

  IF d.type = 'percent' THEN
    _amount := floor(_subtotal_cents * (COALESCE(d.value, 0) / 100.0))::int;
  ELSIF d.type = 'fixed' THEN
    _amount := LEAST(_subtotal_cents, COALESCE(d.value, 0)::int);
  ELSE
    _amount := 0; -- free_shipping handled by caller
  END IF;

  UPDATE public.discounts SET used_count = used_count + 1 WHERE public.discounts.id = d.id;

  RETURN QUERY SELECT d.id, d.code, d.type, d.value, _amount;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.redeem_discount(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_discount(text, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.preview_discount(_code text, _subtotal_cents integer)
RETURNS TABLE (id uuid, code text, type public.discount_type, value numeric, discount_cents integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d public.discounts%ROWTYPE;
  _amount integer := 0;
BEGIN
  SELECT * INTO d FROM public.discounts WHERE upper(code) = upper(_code) LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid discount code'; END IF;
  IF NOT d.is_active THEN RAISE EXCEPTION 'Discount is not active'; END IF;
  IF d.starts_at IS NOT NULL AND now() < d.starts_at THEN RAISE EXCEPTION 'Discount not started yet'; END IF;
  IF d.ends_at IS NOT NULL AND now() > d.ends_at THEN RAISE EXCEPTION 'Discount expired'; END IF;
  IF _subtotal_cents < COALESCE(d.min_subtotal_cents, 0) THEN RAISE EXCEPTION 'Order does not meet minimum'; END IF;
  IF d.usage_limit IS NOT NULL AND d.used_count >= d.usage_limit THEN RAISE EXCEPTION 'Discount usage limit reached'; END IF;

  IF d.type = 'percent' THEN
    _amount := floor(_subtotal_cents * (COALESCE(d.value, 0) / 100.0))::int;
  ELSIF d.type = 'fixed' THEN
    _amount := LEAST(_subtotal_cents, COALESCE(d.value, 0)::int);
  ELSE
    _amount := 0;
  END IF;

  RETURN QUERY SELECT d.id, d.code, d.type, d.value, _amount;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.preview_discount(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.preview_discount(text, integer) TO anon, authenticated;
