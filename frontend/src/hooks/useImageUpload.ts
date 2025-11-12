import { supabase } from "@/lib/supabaseClient";

export interface UseImageUploadOptions {
  bucketName: string;
}

/**
 * Hook for uploading images to Supabase Storage
 * Consolidates image upload logic used by both create and edit pages
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

      // Validate that the file is an image for RLS policy compliance
      if (!file.type || !file.type.startsWith('image/')) {
        console.error('File must be an image. Got:', file.type);
        throw new Error('Only image files are allowed');
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

  return {
    uploadToStorage,
  };
}
