-- Make legal-documents bucket public so PDF viewer can load files
UPDATE storage.buckets
SET public = true
WHERE id = 'legal-documents';
