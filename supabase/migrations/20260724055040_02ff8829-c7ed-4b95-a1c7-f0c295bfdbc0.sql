ALTER TABLE public.site_settings
ADD COLUMN IF NOT EXISTS footer jsonb NOT NULL DEFAULT jsonb_build_object(
  'about', '',
  'address', '',
  'columns', '[]'::jsonb,
  'newsletter', jsonb_build_object('enabled', false, 'heading', 'Join our newsletter', 'subheading', 'Get updates and offers.', 'placeholder', 'you@example.com'),
  'bottom_links', '[]'::jsonb,
  'payment_badges', '[]'::jsonb,
  'show_social', true,
  'copyright', ''
);

UPDATE public.site_settings SET footer = jsonb_build_object(
  'about', COALESCE(tagline, ''),
  'address', '',
  'columns', '[]'::jsonb,
  'newsletter', jsonb_build_object('enabled', false, 'heading', 'Join our newsletter', 'subheading', 'Get updates and offers.', 'placeholder', 'you@example.com'),
  'bottom_links', '[]'::jsonb,
  'payment_badges', '[]'::jsonb,
  'show_social', true,
  'copyright', ''
) WHERE id = 1 AND (footer IS NULL OR footer = '{}'::jsonb);