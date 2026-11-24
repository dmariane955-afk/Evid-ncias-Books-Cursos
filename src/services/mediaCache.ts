import { AcademicBook, ActivityItem, Course, PhotoItem, SlideData } from '../types';

export const MEDIA_REF_PREFIX = 'media://';

const IDB_NAME = 'estacio_academic_media_v1';
const IDB_VERSION = 1;
const STORE_MEDIA = 'media';
const STORE_COLLECTIONS = 'collections';

// Fast in-memory registry for O(1) dehydration and hydration
export const mediaMemoryMap = new Map<string, string>();
export const uploadedMediaIds = new Set<string>();

let idbPromise: Promise<IDBDatabase | null> | null = null;

function openMediaDB(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (idbPromise) return idbPromise;

  idbPromise = new Promise((resolve) => {
    try {
      const request = indexedDB.open(IDB_NAME, IDB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_MEDIA)) {
          db.createObjectStore(STORE_MEDIA, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_COLLECTIONS)) {
          db.createObjectStore(STORE_COLLECTIONS, { keyPath: 'key' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        console.warn('IndexedDB open failed:', request.error);
        resolve(null);
      };
    } catch (err) {
      console.warn('IndexedDB unavailable:', err);
      resolve(null);
    }
  });

  return idbPromise;
}

/**
 * Deterministic 64-bit FNV-1a dual hash + length -> safe Firestore document ID
 */
export function computeMediaId(dataUrl: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  const len = dataUrl.length;
  for (let i = 0; i < len; i++) {
    const c = dataUrl.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= c + (i & 0xff);
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return `m_${hex1}${hex2}_${len}`;
}

export async function saveMediaToIDB(id: string, dataUrl: string): Promise<void> {
  if (!id || !dataUrl) return;
  mediaMemoryMap.set(id, dataUrl);
  const db = await openMediaDB();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_MEDIA, 'readwrite');
      const store = tx.objectStore(STORE_MEDIA);
      store.put({ id, dataUrl, updatedAt: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function loadAllMediaFromIDB(): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const db = await openMediaDB();
  if (!db) return result;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_MEDIA, 'readonly');
      const store = tx.objectStore(STORE_MEDIA);
      const req = store.getAll();
      req.onsuccess = () => {
        const items = req.result as Array<{ id: string; dataUrl: string }> | undefined;
        if (Array.isArray(items)) {
          items.forEach((item) => {
            if (item?.id && item?.dataUrl) {
              result.set(item.id, item.dataUrl);
              mediaMemoryMap.set(item.id, item.dataUrl);
            }
          });
        }
        resolve(result);
      };
      req.onerror = () => resolve(result);
    } catch {
      resolve(result);
    }
  });
}

export async function saveCollectionToIDB(key: string, data: unknown): Promise<void> {
  const db = await openMediaDB();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_COLLECTIONS, 'readwrite');
      const store = tx.objectStore(STORE_COLLECTIONS);
      store.put({ key, data, updatedAt: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function loadCollectionFromIDB<T>(key: string): Promise<T | null> {
  const db = await openMediaDB();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_COLLECTIONS, 'readonly');
      const store = tx.objectStore(STORE_COLLECTIONS);
      const req = store.get(key);
      req.onsuccess = () => {
        resolve((req.result?.data as T) ?? null);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Registers a data: URL in memory & IDB and returns a compact media:// reference.
 */
export function registerDataUrl(
  url: string | undefined,
  collectedMedia?: Map<string, string>
): string | undefined {
  if (!url) return url;
  if (url.startsWith('data:')) {
    const mediaId = computeMediaId(url);
    mediaMemoryMap.set(mediaId, url);
    if (collectedMedia) {
      collectedMedia.set(mediaId, url);
    }
    saveMediaToIDB(mediaId, url);
    return `${MEDIA_REF_PREFIX}${mediaId}`;
  }
  return url;
}

export function hydrateUrl(
  url: string | undefined,
  extraMap?: Map<string, string>
): string | undefined {
  if (!url) return url;
  if (url.startsWith(MEDIA_REF_PREFIX)) {
    const mediaId = url.slice(MEDIA_REF_PREFIX.length);
    const resolved = extraMap?.get(mediaId) || mediaMemoryMap.get(mediaId);
    return resolved || url;
  }
  // Also populate memory map if we encounter raw data URLs
  if (url.startsWith('data:')) {
    const mediaId = computeMediaId(url);
    if (!mediaMemoryMap.has(mediaId)) {
      mediaMemoryMap.set(mediaId, url);
      saveMediaToIDB(mediaId, url);
    }
  }
  return url;
}

/**
 * Resolves a URL synchronously for safe <img src> rendering (never returns raw media:// refs).
 */
export function resolveSafeDisplayUrl(url: string | undefined, fallback: string = ''): string {
  if (!url) return fallback;
  if (url.startsWith(MEDIA_REF_PREFIX)) {
    const mediaId = url.slice(MEDIA_REF_PREFIX.length);
    return mediaMemoryMap.get(mediaId) || fallback;
  }
  return url;
}

function dehydratePhotos(photos: PhotoItem[] | undefined, collectedMedia: Map<string, string>): PhotoItem[] {
  if (!Array.isArray(photos)) return [];
  return photos.map((p) => ({
    ...p,
    url: registerDataUrl(p.url, collectedMedia) || '',
  }));
}

function hydratePhotos(photos: PhotoItem[] | undefined, extraMap?: Map<string, string>): PhotoItem[] {
  if (!Array.isArray(photos)) return [];
  return photos.map((p) => ({
    ...p,
    url: hydrateUrl(p.url, extraMap) || '',
  }));
}

export function dehydrateSlide(
  slide: SlideData,
  collectedMedia: Map<string, string>
): SlideData {
  return {
    ...slide,
    photos: dehydratePhotos(slide.photos, collectedMedia),
  };
}

export function hydrateSlide(slide: SlideData, extraMap?: Map<string, string>): SlideData {
  return {
    ...slide,
    photos: hydratePhotos(slide.photos, extraMap),
  };
}

export function dehydrateBook(book: AcademicBook): {
  dehydratedBook: AcademicBook;
  mediaItems: Map<string, string>;
} {
  const mediaItems = new Map<string, string>();
  const dehydratedSlides = (book.slides || []).map((s) => dehydrateSlide(s, mediaItems));
  const dehydratedCover = registerDataUrl(book.coverImage, mediaItems);

  return {
    dehydratedBook: {
      ...book,
      coverImage: dehydratedCover,
      slides: dehydratedSlides,
    },
    mediaItems,
  };
}

export function hydrateBook(book: AcademicBook, extraMap?: Map<string, string>): AcademicBook {
  return {
    ...book,
    coverImage: hydrateUrl(book.coverImage, extraMap),
    slides: (book.slides || []).map((s) => hydrateSlide(s, extraMap)),
  };
}

export function dehydrateActivity(activity: ActivityItem): {
  dehydratedActivity: ActivityItem;
  mediaItems: Map<string, string>;
} {
  const mediaItems = new Map<string, string>();
  return {
    dehydratedActivity: {
      ...activity,
      photos: dehydratePhotos(activity.photos, mediaItems),
    },
    mediaItems,
  };
}

export function hydrateActivity(activity: ActivityItem, extraMap?: Map<string, string>): ActivityItem {
  return {
    ...activity,
    photos: hydratePhotos(activity.photos, extraMap),
  };
}

export function dehydrateCourse(course: Course): {
  dehydratedCourse: Course;
  mediaItems: Map<string, string>;
} {
  const mediaItems = new Map<string, string>();
  return {
    dehydratedCourse: {
      ...course,
      coverImage: registerDataUrl(course.coverImage, mediaItems),
    },
    mediaItems,
  };
}

export function hydrateCourse(course: Course, extraMap?: Map<string, string>): Course {
  return {
    ...course,
    coverImage: hydrateUrl(course.coverImage, extraMap),
  };
}

/**
 * Safely persists courses/activities/books locally without ever hitting localStorage 5MB QuotaExceededError.
 * - Frees legacy v4 localStorage keys if present
 * - Always stores full data in IndexedDB (unlimited capacity)
 * - Stores either full JSON (if < 900KB) or dehydrated JSON (media:// refs, ~30KB for 1000 slides) in localStorage
 */
export function persistLocalCollection(
  storageKey: string,
  kind: 'courses' | 'activities' | 'books',
  items: unknown[]
): void {
  try {
    // Free legacy v4 keys that waste localStorage quota
    ['estacio_academic_courses_v4', 'estacio_academic_activities_v4', 'estacio_academic_books_v4'].forEach((oldKey) => {
      if (localStorage.getItem(oldKey)) {
        localStorage.removeItem(oldKey);
      }
    });
  } catch {
    // ignore
  }

  // Always save full hydrated state & media into IndexedDB (gigabytes of quota)
  saveCollectionToIDB(storageKey, items);

  let dehydrated: unknown[] = items;
  if (kind === 'books') {
    dehydrated = (items as AcademicBook[]).map((b) => dehydrateBook(b).dehydratedBook);
  } else if (kind === 'activities') {
    dehydrated = (items as ActivityItem[]).map((a) => dehydrateActivity(a).dehydratedActivity);
  } else if (kind === 'courses') {
    dehydrated = (items as Course[]).map((c) => dehydrateCourse(c).dehydratedCourse);
  }

  try {
    const fullJson = JSON.stringify(items);
    if (fullJson.length < 900_000) {
      localStorage.setItem(storageKey, fullJson);
      return;
    }
  } catch {
    // Fall through to dehydrated storage
  }

  // Dataset is large (>900KB): store lightweight dehydrated JSON in localStorage (fits thousands of slides!)
  try {
    const slimJson = JSON.stringify(dehydrated);
    localStorage.setItem(storageKey, slimJson);
  } catch (err) {
    console.warn('LocalStorage fallback warning:', err);
  }
}
