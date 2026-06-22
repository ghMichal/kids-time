-- F-04: event-images bucket and owner-only RLS on storage.objects (atomic deploy)
--
-- Path convention: {owner_id}/{event_id}/{filename}
-- events.image_path stores the object key relative to this bucket (no bucket id prefix).
-- Storage RLS checks owner segment (foldername)[1] only; event_id ↔ events.id is enforced in app (S-01/S-03).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'event-images',
  'event-images',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
);

CREATE POLICY event_images_select_own
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'event-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY event_images_insert_own
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'event-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY event_images_update_own
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'event-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'event-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY event_images_delete_own
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'event-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
