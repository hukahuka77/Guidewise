import { supabase } from "@/lib/supabaseClient";

export interface UseImageUploadOptions {
  bucketName: string;
}

/**
 * Hook for uploading media (images or videos) to Supabase Storage
 * Consolidates upload logic used by both create and edit pages
 */
export function useImageUpload(options: UseImageUploadOptions) {
  const { bucketName } = options;

  /**
   * Upload a file to Supabase Storage and return the public URL
   */
  const uploadToStorage = async (
    prefix: string,
    file: File
  ): Promise<string | undefined> => {
    try {
      if (!supabase) {
        console.error('Supabase client not initialized');
        return undefined;
      }
      if (!bucketName) {
        console.error('Bucket name not provided');
        return undefined;
      }

      // Verify user is authenticated before uploading
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      console.log('Upload auth check:', {
        hasSession: !!session,
        sessionError,
        userId: session?.user?.id,
        accessToken: session?.access_token?.substring(0, 20) + '...'
      });

      if (sessionError || !session) {
        console.error('User must be authenticated to upload files', sessionError);
        throw new Error('Authentication required for file upload');
      }

      // Validate that the file is an image or video
      const isImage = file.type && file.type.startsWith('image/');
      const isVideo = file.type && file.type.startsWith('video/');
      if (!isImage && !isVideo) {
        console.error('File must be an image or video. Got:', file.type);
        throw new Error('Only image and video files are allowed');
      }

      // Enforce max size of 250MB
      const maxBytes = 250 * 1024 * 1024;
      if (file.size > maxBytes) {
        console.error('File too large:', file.size, 'bytes');
        throw new Error('File size exceeds 250MB limit');
      }

      // Sanitize filename to prevent issues
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${prefix}/${Date.now()}-${safeName}`;

      const { error } = await supabase.storage
        .from(bucketName)
        .upload(path, file, {
          contentType: file.type,
          upsert: true
        });

      if (error) {
        throw error;
      }

      const { data } = supabase.storage.from(bucketName).getPublicUrl(path);
      return data?.publicUrl || undefined;
    } catch (err) {
      console.error('Upload failed:', err);
      throw err;
    }
  };

  /**
   * Delete a previously uploaded file from Supabase Storage using its public URL
   */
  const deleteFromStorage = async (publicUrl: string): Promise<void> => {
    try {
      if (!supabase) {
        console.error('Supabase client not initialized');
        return;
      }
      if (!bucketName) {
        console.error('Bucket name not provided');
        return;
      }

      const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!baseUrl) {
        console.error('Supabase base URL env var missing; cannot derive storage path');
        return;
      }

      const marker = `${baseUrl}/storage/v1/object/public/${bucketName}/`;
      const idx = publicUrl.indexOf(marker);
      if (idx === -1) {
        console.warn('Public URL does not match expected pattern; skipping delete:', publicUrl);
        return;
      }

      const path = publicUrl.substring(idx + marker.length);
      if (!path) {
        console.warn('Derived empty storage path from public URL; skipping delete');
        return;
      }

      const { error } = await supabase.storage.from(bucketName).remove([path]);
      if (error) {
        throw error;
      }
    } catch (err) {
      console.error('Delete failed:', err);
      // Swallow errors so UI can still proceed with clearing local state
    }
  };

  return {
    uploadToStorage,
    deleteFromStorage,
  };
}
