
CREATE POLICY "store-media public read" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'store-media');
CREATE POLICY "store-media admin write" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'store-media' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "store-media admin update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'store-media' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "store-media admin delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'store-media' AND public.has_role(auth.uid(), 'admin'));
