
-- 1) Revoke EXECUTE on SECURITY DEFINER trigger-only functions from public/authenticated
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bootstrap_first_admin() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_set_updated_at() FROM PUBLIC, anon, authenticated;

-- 2) Orders: enforce user_id NOT NULL so guest rows can't exist unreachable
ALTER TABLE public.orders ALTER COLUMN user_id SET NOT NULL;

-- 3) user_roles: explicit admin-only write policies
CREATE POLICY "admins insert roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins update roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins delete roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
