
ALTER FUNCTION public.tg_set_updated_at() SET search_path = public;

-- These functions are only meant to be called by policies/triggers, not directly.
REVOKE EXECUTE ON FUNCTION public.tg_set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
-- has_role must remain callable by authenticated because RLS policies reference it.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
