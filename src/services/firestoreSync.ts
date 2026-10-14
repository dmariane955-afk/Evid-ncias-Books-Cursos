import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  writeBatch,
  Unsubscribe
} from 'firebase/firestore';

import { db } from '../firebase';
import { Course, AcademicBook, ActivityItem } from '../types';

import {
  uploadImageDataUrl,
  isImageDataUrl
} from '../utils/imageStorage';

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

/**
 * Clean data object for Firestore (remove undefined fields that Firestore rejects)
 */
function sanitizeForFirestore<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj, (_, v) => (v === undefined ? null : v)));
}

/**
 * Initializes real-time Firestore synchronization.
 * If Firestore collections are empty, seeds with default data provided.
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

  // Listen to Courses
  try {
    const coursesCol = collection(db, 'courses');
    const unsubCourses = onSnapshot(
      coursesCol,
      async (snapshot) => {
        if (snapshot.empty && !initialCoursesReceived && initialDefaults.courses.length > 0) {
          // Seed initial courses
          await seedInitialCourses(initialDefaults.courses);
        } else {
          const list: Course[] = [];
          snapshot.forEach((docSnap) => {
            list.push(docSnap.data() as Course);
          });
          listeners.onCoursesLoaded(list);
        }
        initialCoursesReceived = true;
        checkSyncComplete();
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'courses');
        listeners.onStatusChange('error', 'Falha ao sincronizar cursos');
      }
    );
    unsubs.push(unsubCourses);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'courses');
    listeners.onStatusChange('offline', 'Modo offline ativo');
  }

  // Listen to Activities
  try {
    const activitiesCol = collection(db, 'activities');
    const unsubActivities = onSnapshot(
      activitiesCol,
      async (snapshot) => {
        if (snapshot.empty && !initialActivitiesReceived && initialDefaults.activities.length > 0) {
          // Seed initial activities
          await seedInitialActivities(initialDefaults.activities);
        } else {
          const list: ActivityItem[] = [];
          snapshot.forEach((docSnap) => {
            list.push(docSnap.data() as ActivityItem);
          });
          listeners.onActivitiesLoaded(list);
        }
        initialActivitiesReceived = true;
        checkSyncComplete();
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'activities');
        listeners.onStatusChange('error', 'Falha ao sincronizar atividades');
      }
    );
    unsubs.push(unsubActivities);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'activities');
  }

  // Listen to Books
  try {
    const booksCol = collection(db, 'books');
    const unsubBooks = onSnapshot(
      booksCol,
      async (snapshot) => {
        if (snapshot.empty && !initialBooksReceived && initialDefaults.books.length > 0) {
          // Seed initial books
          await seedInitialBooks(initialDefaults.books);
        } else {
          const list: AcademicBook[] = [];
          snapshot.forEach((docSnap) => {
            list.push(docSnap.data() as AcademicBook);
          });
          listeners.onBooksLoaded(list);
        }
        initialBooksReceived = true;
        checkSyncComplete();
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'books');
        listeners.onStatusChange('error', 'Falha ao sincronizar books');
      }
    );
    unsubs.push(unsubBooks);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'books');
  }

  function checkSyncComplete() {
    if (initialCoursesReceived && initialActivitiesReceived && initialBooksReceived) {
      listeners.onStatusChange('connected', 'Sincronizado na nuvem (Tempo Real)');
    }
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
    const batch = writeBatch(db);
    courses.forEach((c) => {
      const ref = doc(db, 'courses', c.id);
      batch.set(ref, sanitizeForFirestore(c));
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'courses');
  }
}

/**
 * Seed initial activities if Firestore is empty
 */
async function seedInitialActivities(activities: ActivityItem[]) {
  try {
    const batch = writeBatch(db);
    activities.forEach((a) => {
      const ref = doc(db, 'activities', a.id);
      batch.set(ref, sanitizeForFirestore(a));
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'activities');
  }
}

/**
 * Seed initial books if Firestore is empty
 */
async function seedInitialBooks(books: AcademicBook[]) {
  try {
    const batch = writeBatch(db);
    books.forEach((b) => {
      const ref = doc(db, 'books', b.id);
      batch.set(ref, sanitizeForFirestore(b));
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'books');
  }
}

/**
 * Save / Update a single book to Firestore
 */

export async function saveBookToFirestore(
  book: AcademicBook
): Promise<boolean> {
  const path = `books/${book.id}`;

  try {
    const preparedBook: AcademicBook = {
      ...book,
      slides: [...(book.slides || [])],
    };

    // Salva a capa no Firebase Storage quando ainda estiver em Base64.
    if (
      preparedBook.coverImage &&
      isImageDataUrl(preparedBook.coverImage)
    ) {
      preparedBook.coverImage = await uploadImageDataUrl(
        preparedBook.coverImage,
        `books/${book.id}/cover`
      );
    }

    // Salva as imagens dos slides no Firebase Storage.
    preparedBook.slides = await Promise.all(
      preparedBook.slides.map(async (slide) => {
        const photos = await Promise.all(
          (slide.photos || []).map(async (photo, index) => {
            if (!isImageDataUrl(photo.url)) {
              return photo;
            }

            const url = await uploadImageDataUrl(
              photo.url,
              `books/${book.id}/slides/${slide.id}/photo-${index}`
            );

            return { ...photo, url };
          })
        );

        return { ...slide, photos };
      })
    );

    const ref = doc(db, 'books', book.id);

    await setDoc(ref, sanitizeForFirestore(preparedBook), {
      merge: true,
    });

    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    return false;
  }
}

    // Converte imagens dos slides em URLs permanentes.
    preparedBook.slides = await Promise.all(
      preparedBook.slides.map(async (slide) => {
        const photos = await Promise.all(
          (slide.photos || []).map(async (photo, index) => {
            if (!isImageDataUrl(photo.url)) {
              return photo;
            }

            const url = await uploadImageDataUrl(
              photo.url,
              `books/${book.id}/slides/${slide.id}/photo-${index}`
            );

            return { ...photo, url };
          })
        );

        return { ...slide, photos };
      })
    );

    const ref = doc(db, 'books', book.id);

    await setDoc(ref, sanitizeForFirestore(preparedBook), {
      merge: true,
    });

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
 * Save / Update an activity to Firestore
 */
export async function saveActivityToFirestore(
  activity: ActivityItem
): Promise<boolean> {
  const path = `activities/${activity.id}`;

  try {
    const preparedActivity: ActivityItem = {
      ...activity,
      photos: await Promise.all(
        (activity.photos || []).map(async (photo, index) => {
          if (!isImageDataUrl(photo.url)) {
            return photo;
          }

          const url = await uploadImageDataUrl(
            photo.url,
            `activities/${activity.id}/photo-${index}`
          );

          return { ...photo, url };
        })
      ),
    };

    const ref = doc(db, 'activities', activity.id);

    await setDoc(ref, sanitizeForFirestore(preparedActivity), {
      merge: true,
    });

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
