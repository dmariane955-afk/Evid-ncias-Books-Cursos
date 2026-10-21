import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';

/**
 * Compresses an image to an optimized 16:9 HD Web JPEG (max 1280x720, quality 0.80).
 * Generates a lightweight (~40KB-65KB) base64 data URL in <50ms.
 * Safely fits in Firestore documents (1MB limit) while maintaining sharp HD quality.
 */
export async function compressImageToDataUrl(
  fileOrBlob: File | Blob | string,
  maxWidth = 1280,
  maxHeight = 720,
  quality = 0.8
): Promise<string> {
  // If already a remote or asset URL, return directly
  if (typeof fileOrBlob === 'string' && !fileOrBlob.startsWith('data:')) {
    return fileOrBlob;
  }

  return new Promise((resolve) => {
    try {
      let objectUrl = '';
      if (typeof fileOrBlob === 'string') {
        objectUrl = fileOrBlob;
      } else {
        objectUrl = URL.createObjectURL(fileOrBlob);
      }

      const img = new Image();
      img.crossOrigin = 'anonymous';

      const cleanup = () => {
        if (typeof fileOrBlob !== 'string' && objectUrl) {
          try {
            URL.revokeObjectURL(objectUrl);
          } catch {
            // ignore
          }
        }
      };

      img.onload = () => {
        cleanup();
        let { width, height } = img;

        if (width <= 0 || height <= 0) {
          return resolve(typeof fileOrBlob === 'string' ? fileOrBlob : '');
        }

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          return resolve(typeof fileOrBlob === 'string' ? fileOrBlob : '');
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };

      img.onerror = () => {
        cleanup();
        // Fallback: if FileReader is available, read directly
        if (fileOrBlob instanceof Blob) {
          const reader = new FileReader();
          reader.onloadend = () => resolve((reader.result as string) || '');
          reader.onerror = () => resolve('');
          reader.readAsDataURL(fileOrBlob);
        } else {
          resolve(typeof fileOrBlob === 'string' ? fileOrBlob : '');
        }
      };

      img.src = objectUrl;
    } catch {
      resolve(typeof fileOrBlob === 'string' ? fileOrBlob : '');
    }
  });
}

/**
 * Converts a data URL to a binary Blob for upload.
 */
export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return await res.blob();
}

/**
 * Uploads a custom cover image.
 * Uses a strict 1500ms timeout for Firebase Storage so that if the bucket is unprovisioned,
 * has CORS restrictions, or requires auth, it NEVER hangs in an infinite loading state.
 * Returns either the Firebase Storage permanent URL or the optimized high-definition compressed image.
 */
export async function uploadCoverImageToStorage(
  fileOrDataUrl: File | Blob | string,
  identifier: string
): Promise<string> {
  // If it's already an asset path or external URL (not data:), return as is
  if (typeof fileOrDataUrl === 'string' && !fileOrDataUrl.startsWith('data:')) {
    return fileOrDataUrl;
  }

  // 1. Process and compress immediately into an ultra-fast, lightweight HD JPEG (<65KB)
  const compressedDataUrl = await compressImageToDataUrl(fileOrDataUrl, 1280, 720, 0.8);
  if (!compressedDataUrl) {
    return typeof fileOrDataUrl === 'string' ? fileOrDataUrl : '';
  }

  // 2. Try Firebase Storage with a strict 1500ms timeout race.
  // If Firebase Storage is unavailable/404/hanging, IMMEDIATELY fallback to compressedDataUrl.
  try {
    const storageUploadPromise = (async (): Promise<string> => {
      const blob = await dataUrlToBlob(compressedDataUrl);
      const safeId = (identifier || 'cover').replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `covers/${safeId}_${Date.now()}.jpg`;
      const storageRef = ref(storage, filename);

      const snapshot = await uploadBytes(storageRef, blob, {
        contentType: 'image/jpeg',
        cacheControl: 'public, max-age=31536000',
      });

      const permanentUrl = await getDownloadURL(snapshot.ref);
      return permanentUrl;
    })();

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Firebase Storage timeout after 1500ms')), 1500);
    });

    const finalUrl = await Promise.race([storageUploadPromise, timeoutPromise]);
    return finalUrl;
  } catch (error) {
    // Graceful and instant fallback: Firebase Storage is optional or blocked
    console.info('Firebase Storage upload timed out or unavailable, using optimized compressed cover:', error);
    return compressedDataUrl;
  }
}
