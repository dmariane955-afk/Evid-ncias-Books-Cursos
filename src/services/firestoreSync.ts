import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  query,
  where,
  writeBatch,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase';
import { Course, AcademicBook, ActivityItem, SlideData } from '../types';
import {
  MEDIA_REF_PREFIX,
  computeMediaId,
  dehydrateActivity,
  dehydrateBook,
  dehydrateCourse,
  hydrateActivity,
  hydrateBook,
  hydrateCourse,
  mediaMemoryMap,
  saveMediaToIDB,
  uploadedMediaIds,
} from './mediaCache';
import { compressImageToDataUrl } from './storageService';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: true,
      tenantId: null,
      providerInfo: [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  return errInfo;
}

export type SyncStatus = 'connecting' | 'connected' | 'syncing' | 'synced' | 'error' | 'offline';

export interface FirestoreListeners {
  onCoursesLoaded: (courses: Course[]) => void;
  onActivitiesLoaded: (activities: ActivityItem[]) => void;
  onBooksLoaded: (books: AcademicBook[]) => void;
  onStatusChange: (status: SyncStatus, message?: string) => void;
}

type StoredBookSlide = SlideData & {
  bookId: string;
  updatedAt?: string;
};

// Track saved slide signatures & remote slide doc IDs per book for incremental diffing
const savedSlideSignatureMap = new Map<string, string>();
const knownRemoteSlideDocIdsByBook = new Map<string, Set<string>>();

// Track per-book serialized saves to avoid out-of-order overwrites and protect against stale echoes
const bookSaveQueue = new Map<string, Promise<boolean>>();
const inFlightBookCount = new Map<string, number>();

export function isBookSaveInFlight(bookId: string): boolean {
  return (inFlightBookCount.get(bookId) || 0) > 0;
}

function encodeSlideDocId(bookId: string, slideId: string): string {
  const safeBook = String(bookId).replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeSlide = String(slideId).replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${safeBook}__${safeSlide}`;
}

/**
 * Clean data object for Firestore (remove undefined fields that Firestore rejects)
 */
function sanitizeForFirestore<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj, (_, v) => (v === undefined ? null : v)));
}

/**
 * Ensures any oversized data URL (>700KB) is safely compressed before storing in media/{mediaId}
 */
async function ensureSafeMediaSize(dataUrl: string): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith('data:') || dataUrl.length <= 700_000) {
    return dataUrl;
  }
  try {
    const compressed = await compressImageToDataUrl(dataUrl, 1280, 720, 0.7);
    return compressed || dataUrl;
  } catch {
    return dataUrl;
  }
}

/**
 * Uploads extracted media assets to `media/{mediaId}` collection (each doc is ~40-150KB, never >1MB).
 */
async function uploadMediaAssets(mediaItems: Map<string, string>): Promise<void> {
  if (mediaItems.size === 0) return;

  const entries = Array.from(mediaItems.entries());
  const promises: Promise<void>[] = [];

  for (const [mediaId, rawDataUrl] of entries) {
    if (uploadedMediaIds.has(mediaId)) continue;
    if (!rawDataUrl || !rawDataUrl.startsWith('data:')) continue;

    promises.push(
      (async () => {
        try {
          const safeUrl = await ensureSafeMediaSize(rawDataUrl);
          mediaMemoryMap.set(mediaId, safeUrl);
          saveMediaToIDB(mediaId, safeUrl);

          const ref = doc(db, 'media', mediaId);
          await setDoc(
            ref,
            sanitizeForFirestore({
              id: mediaId,
              dataUrl: safeUrl,
              updatedAt: new Date().toISOString(),
            }),
            { merge: true }
          );
          uploadedMediaIds.add(mediaId);
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `media/${mediaId}`);
        }
      })()
    );
  }

  await Promise.all(promises);
}

/**
 * Pre-compresses any raw data URLs in a book's photos/cover if oversized before hashing
 */
async function normalizeBookMediaSizes(book: AcademicBook): Promise<AcademicBook> {
  let changed = false;
  let coverImage = book.coverImage;
  if (coverImage && coverImage.startsWith('data:') && coverImage.length > 700_000) {
    coverImage = await ensureSafeMediaSize(coverImage);
    changed = true;
  }

  const slides = await Promise.all(
    (book.slides || []).map(async (slide) => {
      const hasLargePhoto = (slide.photos || []).some((p) => p.url?.startsWith('data:') && p.url.length > 700_000);
      if (!hasLargePhoto) return slide;
      changed = true;
      const newPhotos = await Promise.all(
        (slide.photos || []).map(async (p) => {
          if (p.url?.startsWith('data:') && p.url.length > 700_000) {
            return { ...p, url: await ensureSafeMediaSize(p.url) };
          }
          return p;
        })
      );
      return { ...slide, photos: newPhotos };
    })
  );

  return changed ? { ...book, coverImage, slides } : book;
}

/**
 * Initializes real-time Firestore synchronization across courses, activities, books, book_slides, and media.
 * Supports unlimited slides per book without hitting Firestore's 1 MiB document size limit,
 * while seamlessly reading and migrating legacy embedded books/activities.
 */
export function initFirestoreSync(
  listeners: FirestoreListeners,
  initialDefaults: {
    courses: Course[];
    activities: ActivityItem[];
    books: AcademicBook[];
  }
): () => void {
  const unsubs: Unsubscribe[] = [];
  listeners.onStatusChange('connecting', 'Conectando ao banco de dados...');

  let initialCoursesReceived = false;
  let initialActivitiesReceived = false;
  let initialBooksReceived = false;
  let initialSlidesReceived = false;
  let initialMediaReceived = false;
  let allInitialLoaded = false;
  let legacyMigrationDone = false;

  let latestRawCourses: Course[] = [];
  let latestRawActivities: ActivityItem[] = [];
  let latestRawBooks: AcademicBook[] = [];
  let latestSlidesByBook = new Map<string, StoredBookSlide[]>();
  const latestRemoteMedia = new Map<string, string>();

  function checkAllInitialReady(): boolean {
    if (allInitialLoaded) return true;
    if (
      initialCoursesReceived &&
      initialActivitiesReceived &&
      initialBooksReceived &&
      initialSlidesReceived &&
      initialMediaReceived
    ) {
      allInitialLoaded = true;
      listeners.onStatusChange('connected', 'Sincronizado na nuvem (Tempo Real)');
      return true;
    }
    return false;
  }

  function emitCourses() {
    if (!checkAllInitialReady()) return;
    const hydrated = latestRawCourses.map((c) => hydrateCourse(c, latestRemoteMedia));
    listeners.onCoursesLoaded(hydrated);
  }

  function emitActivities() {
    if (!checkAllInitialReady()) return;
    const hydrated = latestRawActivities.map((a) => hydrateActivity(a, latestRemoteMedia));
    listeners.onActivitiesLoaded(hydrated);
  }

  function emitBooks() {
    if (!checkAllInitialReady()) return;

    const assembledBooks: AcademicBook[] = latestRawBooks.map((rawBook) => {
      const subSlides = latestSlidesByBook.get(rawBook.id) || [];
      const legacySlides = Array.isArray(rawBook.slides) ? rawBook.slides : [];

      const slideMap = new Map<string, SlideData>();

      // 1. Seed with legacy embedded slides (guarantees zero data loss during/before migration)
      legacySlides.forEach((s) => {
        if (s && s.id) {
          slideMap.set(s.id, s);
        }
      });

      // 2. Overlay dedicated `book_slides` documents
      subSlides.forEach((sub) => {
        if (!sub || !sub.id) return;
        const { bookId: _ignoredBookId, updatedAt: _ignoredUpdatedAt, ...cleanSlide } = sub;
        slideMap.set(sub.id, cleanSlide);
      });

      const seenIds = new Set<string>();
      let finalSlides: SlideData[] = [];

      if (rawBook.storageVersion === 2 && Array.isArray(rawBook.slideOrder) && rawBook.slideOrder.length > 0) {
        // Preserve exact slide order while deduplicating duplicate IDs
        rawBook.slideOrder.forEach((sId) => {
          if (!sId || seenIds.has(sId)) return;
          const found = slideMap.get(sId);
          if (found) {
            seenIds.add(sId);
            finalSlides.push({ ...found });
          }
        });

        // NEVER drop slides that exist in book_slides or legacySlides even if missing from rawBook.slideOrder
        const orphanSlides: SlideData[] = [];
        slideMap.forEach((slide, sId) => {
          if (!seenIds.has(sId)) {
            seenIds.add(sId);
            orphanSlides.push({ ...slide });
          }
        });

        orphanSlides.sort((a, b) => (a.order || 0) - (b.order || 0));
        orphanSlides.forEach((orphan) => {
          if (orphan.type === 'capa' && !finalSlides.some((s) => s.type === 'capa')) {
            finalSlides.unshift(orphan);
          } else if (orphan.type === 'sumario' && !finalSlides.some((s) => s.type === 'sumario')) {
            const capaIdx = finalSlides.findIndex((s) => s.type === 'capa');
            finalSlides.splice(capaIdx >= 0 ? capaIdx + 1 : 0, 0, orphan);
          } else if (orphan.type === 'contatos' && !finalSlides.some((s) => s.type === 'contatos')) {
            finalSlides.push(orphan);
          } else {
            const contatosIdx = finalSlides.findIndex((s) => s.type === 'contatos');
            const insertIdx = contatosIdx >= 0 ? contatosIdx : finalSlides.length;
            finalSlides.splice(insertIdx, 0, orphan);
          }
        });

        finalSlides = finalSlides.map((s, idx) => ({ ...s, order: idx + 1 }));
      } else {
        finalSlides = Array.from(slideMap.values())
          .sort((a, b) => (a.order || 0) - (b.order || 0))
          .map((s, idx) => ({ ...s, order: idx + 1 }));
      }

      const capaPhotoUrl = finalSlides.find((s) => s.type === 'capa')?.photos?.[0]?.url;
      const assembled: AcademicBook = {
        ...rawBook,
        coverImage: rawBook.coverImage || capaPhotoUrl,
        slides: finalSlides,
      };

      return hydrateBook(assembled, latestRemoteMedia);
    });

    listeners.onBooksLoaded(assembledBooks);

    // One-time background upgrade for legacy books/activities/courses so all data uses unlimited schema
    if (!legacyMigrationDone) {
      legacyMigrationDone = true;
      setTimeout(() => {
        latestRawBooks.forEach((rawBook, index) => {
          const hasLegacySlides = Array.isArray(rawBook.slides) && rawBook.slides.length > 0;
          if (rawBook.storageVersion !== 2 && hasLegacySlides) {
            const hydratedBook = assembledBooks[index];
            if (hydratedBook) {
              saveBookToFirestore(hydratedBook);
            }
          }
        });

        latestRawActivities.forEach((rawAct) => {
          const hasRawDataUrls = (rawAct.photos || []).some((p) => p.url?.startsWith('data:'));
          if (hasRawDataUrls) {
            saveActivityToFirestore(hydrateActivity(rawAct, latestRemoteMedia));
          }
        });

        latestRawCourses.forEach((rawCourse) => {
          if (rawCourse.coverImage?.startsWith('data:')) {
            saveCourseToFirestore(hydrateCourse(rawCourse, latestRemoteMedia));
          }
        });
      }, 1500);
    }
  }

  function emitAllInitialIfReady() {
    if (checkAllInitialReady()) {
      emitCourses();
      emitActivities();
      emitBooks();
    }
  }

  // 1. Listen to Media Assets
  try {
    const mediaCol = collection(db, 'media');
    const unsubMedia = onSnapshot(
      mediaCol,
      (snapshot) => {
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as { id?: string; dataUrl?: string };
          const id = data.id || docSnap.id;
          if (id && data.dataUrl) {
            latestRemoteMedia.set(id, data.dataUrl);
            mediaMemoryMap.set(id, data.dataUrl);
            uploadedMediaIds.add(id);
            saveMediaToIDB(id, data.dataUrl);
          }
        });

        const wasInitial = !initialMediaReceived;
        initialMediaReceived = true;
        if (wasInitial) {
          emitAllInitialIfReady();
        } else {
          // Re-hydrate in case newly uploaded media arrived
          emitCourses();
          emitActivities();
          emitBooks();
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'media');
        initialMediaReceived = true;
        emitAllInitialIfReady();
      }
    );
    unsubs.push(unsubMedia);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'media');
    initialMediaReceived = true;
  }

  // 2. Listen to Book Slides
  try {
    const slidesCol = collection(db, 'book_slides');
    const unsubSlides = onSnapshot(
      slidesCol,
      (snapshot) => {
        const nextSlidesByBook = new Map<string, StoredBookSlide[]>();
        const nextKnownDocIds = new Map<string, Set<string>>();

        snapshot.forEach((docSnap) => {
          const slide = docSnap.data() as StoredBookSlide;
          if (!slide || !slide.bookId || !slide.id) return;

          const list = nextSlidesByBook.get(slide.bookId) || [];
          list.push(slide);
          nextSlidesByBook.set(slide.bookId, list);

          const docSet = nextKnownDocIds.get(slide.bookId) || new Set<string>();
          docSet.add(docSnap.id);
          nextKnownDocIds.set(slide.bookId, docSet);

          // Update signature map so unchanged slides aren't rewritten unnecessarily
          savedSlideSignatureMap.set(docSnap.id, JSON.stringify(sanitizeForFirestore(slide)));
        });

        latestSlidesByBook = nextSlidesByBook;
        knownRemoteSlideDocIdsByBook.clear();
        nextKnownDocIds.forEach((set, bId) => knownRemoteSlideDocIdsByBook.set(bId, set));

        const wasInitial = !initialSlidesReceived;
        initialSlidesReceived = true;
        if (wasInitial) {
          emitAllInitialIfReady();
        } else {
          emitBooks();
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'book_slides');
        initialSlidesReceived = true;
        emitAllInitialIfReady();
      }
    );
    unsubs.push(unsubSlides);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'book_slides');
    initialSlidesReceived = true;
  }

  // 3. Listen to Courses
  try {
    const coursesCol = collection(db, 'courses');
    const unsubCourses = onSnapshot(
      coursesCol,
      async (snapshot) => {
        if (snapshot.empty && !initialCoursesReceived && initialDefaults.courses.length > 0) {
          await seedInitialCourses(initialDefaults.courses);
        } else {
          const list: Course[] = [];
          snapshot.forEach((docSnap) => {
            list.push(docSnap.data() as Course);
          });
          latestRawCourses = list;
        }
        const wasInitial = !initialCoursesReceived;
        initialCoursesReceived = true;
        if (wasInitial) {
          emitAllInitialIfReady();
        } else {
          emitCourses();
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'courses');
        listeners.onStatusChange('error', 'Falha ao sincronizar cursos');
        initialCoursesReceived = true;
        emitAllInitialIfReady();
      }
    );
    unsubs.push(unsubCourses);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'courses');
    listeners.onStatusChange('offline', 'Modo offline ativo');
    initialCoursesReceived = true;
  }

  // 4. Listen to Activities
  try {
    const activitiesCol = collection(db, 'activities');
    const unsubActivities = onSnapshot(
      activitiesCol,
      async (snapshot) => {
        if (snapshot.empty && !initialActivitiesReceived && initialDefaults.activities.length > 0) {
          await seedInitialActivities(initialDefaults.activities);
        } else {
          const list: ActivityItem[] = [];
          snapshot.forEach((docSnap) => {
            list.push(docSnap.data() as ActivityItem);
          });
          latestRawActivities = list;
        }
        const wasInitial = !initialActivitiesReceived;
        initialActivitiesReceived = true;
        if (wasInitial) {
          emitAllInitialIfReady();
        } else {
          emitActivities();
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'activities');
        listeners.onStatusChange('error', 'Falha ao sincronizar atividades');
        initialActivitiesReceived = true;
        emitAllInitialIfReady();
      }
    );
    unsubs.push(unsubActivities);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'activities');
    initialActivitiesReceived = true;
  }

  // 5. Listen to Books
  try {
    const booksCol = collection(db, 'books');
    const unsubBooks = onSnapshot(
      booksCol,
      async (snapshot) => {
        if (snapshot.empty && !initialBooksReceived && initialDefaults.books.length > 0) {
          await seedInitialBooks(initialDefaults.books);
        } else {
          const list: AcademicBook[] = [];
          snapshot.forEach((docSnap) => {
            list.push(docSnap.data() as AcademicBook);
          });
          latestRawBooks = list;
        }
        const wasInitial = !initialBooksReceived;
        initialBooksReceived = true;
        if (wasInitial) {
          emitAllInitialIfReady();
        } else {
          emitBooks();
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'books');
        listeners.onStatusChange('error', 'Falha ao sincronizar books');
        initialBooksReceived = true;
        emitAllInitialIfReady();
      }
    );
    unsubs.push(unsubBooks);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'books');
    initialBooksReceived = true;
  }

  return () => {
    unsubs.forEach((unsub) => unsub());
  };
}

/**
 * Seed initial courses if Firestore is empty
 */
async function seedInitialCourses(courses: Course[]) {
  try {
    for (const c of courses) {
      await saveCourseToFirestore(c);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'courses');
  }
}

/**
 * Seed initial activities if Firestore is empty
 */
async function seedInitialActivities(activities: ActivityItem[]) {
  try {
    for (const a of activities) {
      await saveActivityToFirestore(a);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'activities');
  }
}

/**
 * Seed initial books if Firestore is empty
 */
async function seedInitialBooks(books: AcademicBook[]) {
  try {
    for (const b of books) {
      await saveBookToFirestore(b);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'books');
  }
}

/**
 * Internal implementation of book persistence using normalized `media` + `book_slides` + `books` metadata.
 * Completely eliminates Firestore's 1 MiB document size limit so books can store unlimited slides.
 */
async function performSaveBook(book: AcademicBook): Promise<boolean> {
  const path = `books/${book.id}`;
  try {
    const normalizedBook = await normalizeBookMediaSizes(book);
    const { dehydratedBook, mediaItems } = dehydrateBook(normalizedBook);

    // 1. Upload all new images to `media/{mediaId}` FIRST
    await uploadMediaAssets(mediaItems);

    const updatedAt = dehydratedBook.updatedAt || new Date().toISOString();
    const seenSlideIds = new Set<string>();
    const currentSlides = (dehydratedBook.slides || []).filter((s) => {
      if (!s || !s.id || seenSlideIds.has(s.id)) return false;
      seenSlideIds.add(s.id);
      return true;
    });
    const currentSlideDocIds = new Set<string>();
    const ops: Array<
      | { type: 'set'; docId: string; data: StoredBookSlide; signature: string }
      | { type: 'delete'; docId: string }
    > = [];

    // 2. Prepare changed/new slides in `book_slides`
    currentSlides.forEach((slide, idx) => {
      const docId = encodeSlideDocId(book.id, slide.id);
      currentSlideDocIds.add(docId);

      const slideDocData = sanitizeForFirestore<StoredBookSlide>({
        ...slide,
        bookId: book.id,
        order: idx + 1,
        updatedAt,
      });

      const signature = JSON.stringify(slideDocData);
      if (savedSlideSignatureMap.get(docId) !== signature) {
        ops.push({ type: 'set', docId, data: slideDocData, signature });
      }
    });

    // 3. Delete slides that were removed from this book (never delete the capa slide doc if none replaces it unless empty)
    const previousDocIds = knownRemoteSlideDocIdsByBook.get(book.id) || new Set<string>();
    const capaPrefixDocId = encodeSlideDocId(book.id, `slide-capa-${book.courseId}`);
    const hasCapaInCurrent = currentSlides.some((s) => s.type === 'capa');
    previousDocIds.forEach((oldDocId) => {
      if (!currentSlideDocIds.has(oldDocId)) {
        if (!hasCapaInCurrent && (oldDocId === capaPrefixDocId || oldDocId.includes('__slide-capa-'))) {
          return;
        }
        ops.push({ type: 'delete', docId: oldDocId });
      }
    });

    // 4. Commit slide changes in Firestore batches (max 300 ops per batch)
    for (let i = 0; i < ops.length; i += 300) {
      const chunk = ops.slice(i, i + 300);
      const batch = writeBatch(db);
      chunk.forEach((op) => {
        const ref = doc(db, 'book_slides', op.docId);
        if (op.type === 'set') {
          batch.set(ref, op.data);
        } else {
          batch.delete(ref);
        }
      });
      await batch.commit();

      chunk.forEach((op) => {
        if (op.type === 'set') {
          savedSlideSignatureMap.set(op.docId, op.signature);
        } else {
          savedSlideSignatureMap.delete(op.docId);
        }
      });
    }

    knownRemoteSlideDocIdsByBook.set(book.id, currentSlideDocIds);

    // 5. Save lightweight `books/{book.id}` metadata document (always <10 KB, unlimited slides!)
    const { slides: _omittedHeavySlides, ...bookWithoutHeavySlides } = dehydratedBook;
    const bookMeta = sanitizeForFirestore({
      ...bookWithoutHeavySlides,
      slides: [],
      slideOrder: currentSlides.map((s) => s.id),
      storageVersion: 2,
      updatedAt,
    });

    const bookRef = doc(db, 'books', book.id);
    await setDoc(bookRef, bookMeta, { merge: true });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    return false;
  }
}

/**
 * Save / Update a single book to Firestore (queued per bookId to prevent concurrent race conditions)
 */
export function saveBookToFirestore(book: AcademicBook): Promise<boolean> {
  inFlightBookCount.set(book.id, (inFlightBookCount.get(book.id) || 0) + 1);

  const previous = bookSaveQueue.get(book.id) || Promise.resolve(true);
  const next = previous
    .catch(() => false)
    .then(() => performSaveBook(book))
    .finally(() => {
      const remaining = Math.max(0, (inFlightBookCount.get(book.id) || 1) - 1);
      if (remaining === 0) {
        inFlightBookCount.delete(book.id);
      } else {
        inFlightBookCount.set(book.id, remaining);
      }
    });

  bookSaveQueue.set(book.id, next);
  return next;
}

/**
 * Delete a book and all of its slides from Firestore
 */
export async function deleteBookFromFirestore(bookId: string): Promise<boolean> {
  const path = `books/${bookId}`;
  try {
    const ref = doc(db, 'books', bookId);
    await deleteDoc(ref);

    // Clean up all associated slides in `book_slides`
    const slidesSnap = await getDocs(query(collection(db, 'book_slides'), where('bookId', '==', bookId)));
    const docIdsToDelete = new Set<string>();
    slidesSnap.forEach((d) => docIdsToDelete.add(d.id));
    (knownRemoteSlideDocIdsByBook.get(bookId) || new Set<string>()).forEach((id) => docIdsToDelete.add(id));

    const allIds = Array.from(docIdsToDelete);
    for (let i = 0; i < allIds.length; i += 300) {
      const batch = writeBatch(db);
      allIds.slice(i, i + 300).forEach((sDocId) => {
        batch.delete(doc(db, 'book_slides', sDocId));
        savedSlideSignatureMap.delete(sDocId);
      });
      await batch.commit();
    }
    knownRemoteSlideDocIdsByBook.delete(bookId);

    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    return false;
  }
}

/**
 * Save / Update a single course to Firestore (with media deduplication)
 */
export async function saveCourseToFirestore(course: Course): Promise<boolean> {
  const path = `courses/${course.id}`;
  try {
    let safeCourse = course;
    if (course.coverImage?.startsWith('data:') && course.coverImage.length > 700_000) {
      safeCourse = { ...course, coverImage: await ensureSafeMediaSize(course.coverImage) };
    }
    const { dehydratedCourse, mediaItems } = dehydrateCourse(safeCourse);
    await uploadMediaAssets(mediaItems);

    const ref = doc(db, 'courses', course.id);
    await setDoc(ref, sanitizeForFirestore(dehydratedCourse), { merge: true });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    return false;
  }
}

/**
 * Delete a course from Firestore
 */
export async function deleteCourseFromFirestore(courseId: string): Promise<boolean> {
  const path = `courses/${courseId}`;
  try {
    const ref = doc(db, 'courses', courseId);
    await deleteDoc(ref);
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    return false;
  }
}

/**
 * Save / Update an activity to Firestore (with media deduplication for unlimited photos)
 */
export async function saveActivityToFirestore(activity: ActivityItem): Promise<boolean> {
  const path = `activities/${activity.id}`;
  try {
    const hasOversizedPhoto = (activity.photos || []).some(
      (p) => p.url?.startsWith('data:') && p.url.length > 700_000
    );
    let safeActivity = activity;
    if (hasOversizedPhoto) {
      const safePhotos = await Promise.all(
        (activity.photos || []).map(async (p) =>
          p.url?.startsWith('data:') && p.url.length > 700_000
            ? { ...p, url: await ensureSafeMediaSize(p.url) }
            : p
        )
      );
      safeActivity = { ...activity, photos: safePhotos };
    }

    const { dehydratedActivity, mediaItems } = dehydrateActivity(safeActivity);
    await uploadMediaAssets(mediaItems);

    const ref = doc(db, 'activities', activity.id);
    await setDoc(ref, sanitizeForFirestore(dehydratedActivity), { merge: true });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    return false;
  }
}

/**
 * Delete an activity from Firestore
 */
export async function deleteActivityFromFirestore(activityId: string): Promise<boolean> {
  const path = `activities/${activityId}`;
  try {
    const ref = doc(db, 'activities', activityId);
    await deleteDoc(ref);
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    return false;
  }
}

export { MEDIA_REF_PREFIX, computeMediaId };
