import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  getDocs 
} from 'firebase/firestore';
import { db } from '../firebase';
import { Course, ActivityItem, AcademicBook } from '../types';
import { INITIAL_COURSES, INITIAL_ACTIVITIES, createInitialBooks } from '../data/defaults';

const COURSES_COLLECTION = 'courses';
const ACTIVITIES_COLLECTION = 'activities';
const BOOKS_COLLECTION = 'books';

/**
 * Initializes Firestore with default seed data if collections are completely empty.
 */
export async function seedInitialDataIfEmpty() {
  try {
    const coursesSnap = await getDocs(collection(db, COURSES_COLLECTION));
    if (coursesSnap.empty) {
      console.log('Populando Firestore com dados iniciais...');
      // Seed courses
      for (const course of INITIAL_COURSES) {
        await setDoc(doc(db, COURSES_COLLECTION, course.id), course);
      }
      // Seed activities
      for (const activity of INITIAL_ACTIVITIES) {
        await setDoc(doc(db, ACTIVITIES_COLLECTION, activity.id), activity);
      }
      // Seed books
      const initialBooks = createInitialBooks(INITIAL_COURSES, INITIAL_ACTIVITIES);
      for (const book of initialBooks) {
        await setDoc(doc(db, BOOKS_COLLECTION, book.id), book);
      }
    }
  } catch (err) {
    console.warn('Erro ao verificar/popular dados iniciais no Firestore:', err);
  }
}

/**
 * Subscribes to real-time changes across all three collections (Cursos, Atividades, Books)
 */
export function subscribeToPlatformData(
  onCourses: (courses: Course[]) => void,
  onActivities: (activities: ActivityItem[]) => void,
  onBooks: (books: AcademicBook[]) => void
) {
  // 1. Courses Snapshot
  const unsubCourses = onSnapshot(
    collection(db, COURSES_COLLECTION),
    (snapshot) => {
      if (!snapshot.empty) {
        const items = snapshot.docs.map((d) => d.data() as Course);
        onCourses(items);
      }
    },
    (err) => console.warn('Erro na escuta de cursos:', err)
  );

  // 2. Activities Snapshot
  const unsubActivities = onSnapshot(
    collection(db, ACTIVITIES_COLLECTION),
    (snapshot) => {
      if (!snapshot.empty) {
        const items = snapshot.docs.map((d) => d.data() as ActivityItem);
        onActivities(items);
      }
    },
    (err) => console.warn('Erro na escuta de atividades:', err)
  );

  // 3. Books Snapshot
  const unsubBooks = onSnapshot(
    collection(db, BOOKS_COLLECTION),
    (snapshot) => {
      if (!snapshot.empty) {
        const items = snapshot.docs.map((d) => d.data() as AcademicBook);
        onBooks(items);
      }
    },
    (err) => console.warn('Erro na escuta de books:', err)
  );

  return () => {
    unsubCourses();
    unsubActivities();
    unsubBooks();
  };
}

export async function saveCourseToCloud(course: Course) {
  try {
    await setDoc(doc(db, COURSES_COLLECTION, course.id), course);
  } catch (err) {
    console.error('Falha ao salvar curso no Firestore:', err);
  }
}

export async function deleteCourseFromCloud(courseId: string) {
  try {
    await deleteDoc(doc(db, COURSES_COLLECTION, courseId));
  } catch (err) {
    console.error('Falha ao excluir curso no Firestore:', err);
  }
}

export async function saveActivityToCloud(activity: ActivityItem) {
  try {
    await setDoc(doc(db, ACTIVITIES_COLLECTION, activity.id), activity);
  } catch (err) {
    console.error('Falha ao salvar atividade no Firestore:', err);
  }
}

export async function deleteActivityFromCloud(activityId: string) {
  try {
    await deleteDoc(doc(db, ACTIVITIES_COLLECTION, activityId));
  } catch (err) {
    console.error('Falha ao excluir atividade no Firestore:', err);
  }
}

export async function saveBookToCloud(book: AcademicBook) {
  try {
    await setDoc(doc(db, BOOKS_COLLECTION, book.id), book);
  } catch (err) {
    console.error('Falha ao salvar book no Firestore:', err);
  }
}

export async function deleteBookFromCloud(bookId: string) {
  try {
    await deleteDoc(doc(db, BOOKS_COLLECTION, bookId));
  } catch (err) {
    console.error('Falha ao excluir book no Firestore:', err);
  }
}
