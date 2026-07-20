
-- ============ ROLES ============
CREATE TYPE public.app_role AS ENUM ('admin', 'customer');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'customer',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- ============ UPDATED_AT HELPER ============
CREATE OR REPLACE FUNCTION public.tg_set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "own profile write" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "admin manages profiles" ON public.profiles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- auto-create profile + assign customer role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'customer') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ SITE SETTINGS (singleton) ============
CREATE TABLE public.site_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  brand_name text NOT NULL DEFAULT 'My Store',
  tagline text DEFAULT '',
  logo_url text,
  favicon_url text,
  currency text NOT NULL DEFAULT 'USD',
  currency_symbol text NOT NULL DEFAULT '$',
  primary_color text NOT NULL DEFAULT '#0f172a',
  accent_color text NOT NULL DEFAULT '#f59e0b',
  contact_email text,
  contact_phone text,
  social_links jsonb NOT NULL DEFAULT '{}'::jsonb,
  header_nav jsonb NOT NULL DEFAULT '[]'::jsonb,
  footer_nav jsonb NOT NULL DEFAULT '[]'::jsonb,
  banners jsonb NOT NULL DEFAULT '[]'::jsonb,
  announcement jsonb NOT NULL DEFAULT '{"enabled":false,"text":"","link":""}'::jsonb,
  seo jsonb NOT NULL DEFAULT '{"title":"My Store","description":"","og_image":""}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_settings TO anon, authenticated;
GRANT ALL ON public.site_settings TO service_role;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings public read" ON public.site_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin manages settings" ON public.site_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_settings_updated BEFORE UPDATE ON public.site_settings FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
INSERT INTO public.site_settings (id) VALUES (1);

-- ============ CATEGORIES ============
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  image_url text,
  parent_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cats public read active" ON public.categories FOR SELECT TO anon, authenticated USING (is_active OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin manages cats" ON public.categories FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_cats_updated BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ PRODUCTS ============
CREATE TYPE public.product_status AS ENUM ('draft', 'active', 'archived');

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  description text DEFAULT '',
  short_description text,
  price_cents int NOT NULL DEFAULT 0,
  compare_at_cents int,
  currency text NOT NULL DEFAULT 'USD',
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  status public.product_status NOT NULL DEFAULT 'draft',
  images jsonb NOT NULL DEFAULT '[]'::jsonb,
  tags text[] NOT NULL DEFAULT '{}',
  stock int NOT NULL DEFAULT 0,
  sku text,
  weight_grams int,
  seo jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_featured boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX products_status_idx ON public.products(status);
CREATE INDEX products_category_idx ON public.products(category_id);
GRANT SELECT ON public.products TO anon, authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products public read" ON public.products FOR SELECT TO anon, authenticated USING (status = 'active' OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin manages products" ON public.products FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Variants
CREATE TABLE public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL,
  sku text,
  price_cents int,
  stock int NOT NULL DEFAULT 0,
  option_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  image_url text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX variants_product_idx ON public.product_variants(product_id);
GRANT SELECT ON public.product_variants TO anon, authenticated;
GRANT ALL ON public.product_variants TO service_role;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "variants public read" ON public.product_variants FOR SELECT TO anon, authenticated USING (
  EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND (p.status = 'active' OR public.has_role(auth.uid(), 'admin')))
);
CREATE POLICY "admin manages variants" ON public.product_variants FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_variants_updated BEFORE UPDATE ON public.product_variants FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ ADDRESSES ============
CREATE TABLE public.addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text,
  full_name text NOT NULL,
  line1 text NOT NULL,
  line2 text,
  city text NOT NULL,
  region text,
  postal_code text NOT NULL,
  country text NOT NULL,
  phone text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.addresses TO authenticated;
GRANT ALL ON public.addresses TO service_role;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own addresses" ON public.addresses FOR ALL TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin')) WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_addresses_updated BEFORE UPDATE ON public.addresses FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ CART ============
CREATE TABLE public.carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.carts TO authenticated;
GRANT ALL ON public.carts TO service_role;
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own cart" ON public.carts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_carts_updated BEFORE UPDATE ON public.carts FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id uuid NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  quantity int NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cart_id, product_id, variant_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cart_items TO authenticated;
GRANT ALL ON public.cart_items TO service_role;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own cart items" ON public.cart_items FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.carts c WHERE c.id = cart_id AND c.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.carts c WHERE c.id = cart_id AND c.user_id = auth.uid())
);

-- ============ ORDERS ============
CREATE TYPE public.order_status AS ENUM ('pending', 'paid', 'fulfilled', 'shipped', 'delivered', 'cancelled', 'refunded');

CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text UNIQUE NOT NULL DEFAULT ('ORD-' || upper(substr(md5(random()::text), 1, 8))),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email text NOT NULL,
  status public.order_status NOT NULL DEFAULT 'pending',
  subtotal_cents int NOT NULL DEFAULT 0,
  shipping_cents int NOT NULL DEFAULT 0,
  tax_cents int NOT NULL DEFAULT 0,
  discount_cents int NOT NULL DEFAULT 0,
  total_cents int NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  shipping_address jsonb NOT NULL DEFAULT '{}'::jsonb,
  billing_address jsonb NOT NULL DEFAULT '{}'::jsonb,
  discount_code text,
  shipping_method text,
  notes text,
  tracking_number text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX orders_user_idx ON public.orders(user_id);
CREATE INDEX orders_status_idx ON public.orders(status);
GRANT SELECT, INSERT, UPDATE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own orders read" ON public.orders FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "own orders insert" ON public.orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admin manages orders" ON public.orders FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  title text NOT NULL,
  variant_name text,
  unit_price_cents int NOT NULL,
  quantity int NOT NULL CHECK (quantity > 0),
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own order items read" ON public.order_items FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND (o.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin')))
);
CREATE POLICY "own order items insert" ON public.order_items FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid())
);
CREATE POLICY "admin manages order items" ON public.order_items FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ DISCOUNTS ============
CREATE TYPE public.discount_type AS ENUM ('percent', 'fixed', 'free_shipping');

CREATE TABLE public.discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  description text,
  type public.discount_type NOT NULL DEFAULT 'percent',
  value numeric NOT NULL DEFAULT 0,
  min_subtotal_cents int NOT NULL DEFAULT 0,
  starts_at timestamptz,
  ends_at timestamptz,
  usage_limit int,
  used_count int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.discounts TO anon, authenticated;
GRANT ALL ON public.discounts TO service_role;
ALTER TABLE public.discounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "discounts public read active" ON public.discounts FOR SELECT TO anon, authenticated USING (is_active OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin manages discounts" ON public.discounts FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_discounts_updated BEFORE UPDATE ON public.discounts FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ SHIPPING ============
CREATE TABLE public.shipping_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  countries text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.shipping_zones TO anon, authenticated;
GRANT ALL ON public.shipping_zones TO service_role;
ALTER TABLE public.shipping_zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "zones public read" ON public.shipping_zones FOR SELECT TO anon, authenticated USING (is_active OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin zones" ON public.shipping_zones FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.shipping_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id uuid NOT NULL REFERENCES public.shipping_zones(id) ON DELETE CASCADE,
  name text NOT NULL,
  price_cents int NOT NULL DEFAULT 0,
  min_order_cents int NOT NULL DEFAULT 0,
  free_over_cents int,
  estimated_days text,
  is_active boolean NOT NULL DEFAULT true
);
GRANT SELECT ON public.shipping_rates TO anon, authenticated;
GRANT ALL ON public.shipping_rates TO service_role;
ALTER TABLE public.shipping_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rates public read" ON public.shipping_rates FOR SELECT TO anon, authenticated USING (is_active OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin rates" ON public.shipping_rates FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ TAXES ============
CREATE TABLE public.tax_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  country text NOT NULL,
  region text,
  rate_percent numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true
);
GRANT SELECT ON public.tax_rates TO anon, authenticated;
GRANT ALL ON public.tax_rates TO service_role;
ALTER TABLE public.tax_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tax public read" ON public.tax_rates FOR SELECT TO anon, authenticated USING (is_active OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin tax" ON public.tax_rates FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ CMS PAGES ============
CREATE TABLE public.pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  body text DEFAULT '',
  seo jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pages TO anon, authenticated;
GRANT ALL ON public.pages TO service_role;
ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pages public read" ON public.pages FOR SELECT TO anon, authenticated USING (is_published OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin pages" ON public.pages FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_pages_updated BEFORE UPDATE ON public.pages FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
