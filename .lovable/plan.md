
# E-Commerce Platform with Admin Panel

Build a physical-product store with customer accounts on the frontend and a highly configurable admin panel. Payments will be wired in later.

## Stack

- **TanStack Start** (existing) — routes, server functions, SSR
- **Lovable Cloud** (Supabase) — DB, auth, storage for product images
- **shadcn/ui + Tailwind** — UI and admin sidebar
- **TanStack Query** — data fetching/caching

## Database schema (Lovable Cloud migration)

Core tables, all with RLS + GRANTs:

- `profiles` — customer profile (auto-created on signup via trigger)
- `user_roles` + `app_role` enum (`admin`, `customer`) + `has_role()` security-definer fn
- `categories` — id, slug, name, description, image, parent_id, sort_order
- `products` — id, slug, title, description, price_cents, compare_at_cents, currency, status (draft/active/archived), category_id, images (jsonb), seo (jsonb), created_at
- `product_variants` — id, product_id, sku, name, price_cents override, stock, option_values (jsonb — e.g. size/color)
- `product_options` — id, product_id, name (Size/Color), values
- `addresses` — user_id, name, line1/2, city, region, postal, country, phone
- `orders` — id, user_id, status (pending/paid/fulfilled/cancelled/refunded), subtotal, shipping, tax, discount, total, currency, shipping_address (jsonb), billing_address (jsonb), notes, created_at
- `order_items` — order_id, product_id, variant_id, title snapshot, unit_price, qty
- `carts` / `cart_items` — persistent cart per user (guest cart lives in localStorage until sign-in, then merges)
- `discounts` — code, type (percent/fixed/free_shipping), value, min_subtotal, starts_at, ends_at, usage_limit, used_count, active
- `shipping_zones` + `shipping_rates` — zone (country list), rate name, price, min/max order value, free-over threshold
- `tax_rates` — country/region → percent
- `site_settings` — single-row jsonb: brand name, logo url, primary color, currency, contact info, social links, footer links, nav items, homepage banners (array), announcement bar, SEO defaults
- `pages` — cms slug, title, body (markdown/html), status (for About, Terms, Privacy, custom pages)

RLS:
- Customers read/write only their own carts, orders, addresses, profile
- Public read: active products/variants/categories, active discounts (code lookup), pages, site_settings, shipping/tax
- Admins (via `has_role`) full CRUD on everything

Seed one admin user (prompt during setup) and default site_settings row.

## Auth

Email/password + Google sign-in (via `configure_social_auth`). Standard Supabase flow with `_authenticated/` route gate (integration-managed). Admin routes gated additionally by `has_role(uid, 'admin')` check in server fns + a client-side redirect guard on `/admin/*`.

## Storefront routes (public)

- `/` — homepage: announcement bar, hero/banner slider (from site_settings), featured products, category grid, footer
- `/shop` — all products with filters (category, price range, in-stock), sort, pagination
- `/shop/$category` — category listing
- `/product/$slug` — PDP with variant picker, images gallery, add-to-cart, related products
- `/cart` — line items, quantity edit, discount code, shipping estimate
- `/checkout` — address forms, shipping method, order summary; on submit creates an `orders` row with `status=pending` (payments deferred — order marks as "awaiting payment")
- `/account` (auth) — profile, addresses, order history, order detail
- `/auth` — sign in / sign up
- `/pages/$slug` — CMS pages
- `/search` — product search

Header/footer/nav pulled from `site_settings`.

## Admin panel routes (`/admin/*`, admin-gated)

Uses shadcn Sidebar (collapsible) layout with these sections:

- **Dashboard** — order counts, revenue, low-stock alerts, recent orders
- **Products** — list, create/edit (title, description rich text, images upload to storage, pricing, variants + options, SEO, status), bulk actions, CSV import later
- **Categories** — tree editor, images, sort order
- **Inventory** — stock per variant, adjust with reason log
- **Orders** — list with filters, order detail (update status, add tracking, refund note, print packing slip)
- **Customers** — list, detail (orders, addresses), promote/demote admin
- **Discounts** — CRUD codes, usage stats
- **Shipping** — zones + rates editor
- **Taxes** — tax rates per region
- **Content**
  - Homepage builder — banners (image, headline, subhead, CTA link), featured collections, section ordering
  - Pages — CMS for About/Terms/Privacy/custom
  - Navigation — header & footer menu editor
  - Announcement bar — text + link + on/off
- **Branding** — brand name, logo upload, favicon, primary/accent colors (writes CSS variables), typography choice, currency
- **Settings** — contact info, social links, SEO defaults (title template, description, OG image), email sender name

All admin mutations go through `createServerFn` with `requireSupabaseAuth` + admin role check, then use `supabaseAdmin` for privileged writes.

## Configurability

Two layers:

1. **Runtime config in `site_settings`** — every branding/content knob (colors, logo, nav, banners, announcements, currency, SEO) lives in one jsonb row edited from the admin panel and read at request time (SSR) so changes appear instantly without a redeploy. Colors get injected as CSS variables on `__root.tsx` from the loaded settings.
2. **Structured content tables** — products, categories, pages, discounts, shipping, tax are all admin-editable; no hardcoded catalog.

## Build order

1. Enable Lovable Cloud + create schema (all tables, RLS, GRANTs, seed settings, trigger for profiles, role enum & fn)
2. Auth (signup/signin/Google + protected routes + admin role)
3. Admin sidebar shell + Products CRUD + image upload to Cloud storage
4. Categories, Inventory
5. Storefront: home, shop, PDP wired to real data (settings-driven header/footer)
6. Cart + checkout (creating pending orders, no payment yet)
7. Customer account (orders, addresses, profile)
8. Admin: Orders, Customers, Discounts, Shipping, Taxes
9. Admin: Content (homepage builder, pages, nav, announcement, branding)
10. Search, SEO metadata per route, polish

## Payments (deferred)

Checkout creates orders with `status=pending`. When you're ready, we'll run the payment provider recommendation and wire Stripe or Shopify checkout into the existing `/checkout` flow and add a webhook route under `/api/public/webhooks/*` to mark orders paid.

## Notes

- This is a big scope — I'll ship it in the phases above so you can review and steer between each. Say "start with phase 1" (or all of it) after approving.
- Design direction (color palette, typography, overall vibe) — I'll ask before building the storefront UI in phase 5 unless you want to specify now.
