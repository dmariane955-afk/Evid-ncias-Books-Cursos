import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HeaderNav } from './components/HeaderNav';
import { HomePage } from './components/HomePage';
import { SlideThumbnails } from './components/SlideThumbnails';
import { SlideCanvas } from './components/SlideCanvas';
import { NewActivityModal } from './components/NewActivityModal';
import { NewSlideModal } from './components/NewSlideModal';
import { NewCourseModal } from './components/NewCourseModal';
import { BookSettingsModal } from './components/BookSettingsModal';
import { PresentationModal } from './components/PresentationModal';
import { 
  DeleteConfirmModal, 
  DeleteSyncedActivityModal, 
  SyncContentModal,
  SyncSlideModal 
} from './components/SyncAndActionModals';
import { Course, AcademicBook, ActivityItem, SlideData, CampusId, AcademicArea, ActivityType, PhotoItem } from './types';
import { INITIAL_COURSES, INITIAL_ACTIVITIES, createInitialBooks, COURSES_BY_AREA } from './data/defaults';
import { exportToPowerPoint } from './utils/pptxExport';
import { getCourseCoverImage } from './utils/courseCovers';
import { compressImageToDataUrl } from './services/storageService';
import { 
  initFirestoreSync, 
  saveBookToFirestore, 
  saveCourseToFirestore, 
  saveActivityToFirestore, 
  deleteBookFromFirestore, 
  deleteCourseFromFirestore, 
  deleteActivityFromFirestore,
  SyncStatus 
} from './services/firestoreSync';
import { Share2 } from 'lucide-react';

const STORAGE_COURSES_KEY = 'estacio_academic_courses_v5';
const STORAGE_ACTIVITIES_KEY = 'estacio_academic_activities_v5';
const STORAGE_BOOKS_KEY = 'estacio_academic_books_v5';

interface HistoryState {
  courses: Course[];
  activities: ActivityItem[];
  books: AcademicBook[];
  currentCourseId: string;
  currentCampus: CampusId;
}

export default function App() {
  // 1. Initial State from localStorage or defaults
  const [courses, setCourses] = useState<Course[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_COURSES_KEY) || localStorage.getItem('estacio_academic_courses_v4');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((c: Course) => ({
            ...c,
            coverImage: c.coverImage || getCourseCoverImage(c.name, c.academicArea),
          }));
        }
      }
    } catch (e) {
      console.warn(e);
    }
    return INITIAL_COURSES;
  });

  const [activities, setActivities] = useState<ActivityItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_ACTIVITIES_KEY) || localStorage.getItem('estacio_academic_activities_v4');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn(e);
    }
    return INITIAL_ACTIVITIES;
  });

  const [books, setBooks] = useState<AcademicBook[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_BOOKS_KEY) || localStorage.getItem('estacio_academic_books_v4');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((b: AcademicBook) => {
            const capaSlide = b.slides?.find((s) => s.type === 'capa');
            const existingPhoto = capaSlide?.photos?.[0]?.url;
            const coverUrl = b.coverImage || existingPhoto || getCourseCoverImage(b.courseName, b.academicArea);
            const updatedSlides = b.slides.map((s) => {
              if (s.type === 'capa') {
                if (!s.photos || s.photos.length === 0) {
                  return {
                    ...s,
                    photos: [{ id: `cover-${b.courseId}`, url: coverUrl, caption: b.courseName, fit: 'cover' as const }],
                  };
                } else if (b.coverImage && s.photos[0]?.url !== b.coverImage) {
                  return {
                    ...s,
                    photos: [{ ...s.photos[0], url: b.coverImage }],
                  };
                }
              }
              return s;
            });
            return {
              ...b,
              coverImage: coverUrl,
              slides: updatedSlides,
            };
          });
        }
      }
    } catch (e) {
      console.warn(e);
    }
    return createInitialBooks(INITIAL_COURSES, INITIAL_ACTIVITIES);
  });

  // Current View & Campus separation (Curitiba and FATEC are separated by default)
  const [currentView, setCurrentView] = useState<'home' | 'editor'>('home');
  const [currentCampus, setCurrentCampus] = useState<CampusId>('curitiba');
  const [currentCourseId, setCurrentCourseId] = useState<string>(() => {
    const curitibaCourses = INITIAL_COURSES.filter((c) => c.campus === 'curitiba');
    return curitibaCourses[0]?.id || INITIAL_COURSES[0]?.id || 'course-eng-soft';
  });
  const [activeSlideId, setActiveSlideId] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);

  // Firestore Database Real-time Synchronization State
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('connecting');
  const [syncMessage, setSyncMessage] = useState<string>('Conectando ao banco de dados...');
  const [shareToast, setShareToast] = useState<string | null>(null);

  const isInitialSyncDone = useRef(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Modals state
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [activityModalSharedMode, setActivityModalSharedMode] = useState(false);
  const [editingActivity, setEditingActivity] = useState<ActivityItem | null>(null);
  const [droppedImageForNewActivity, setDroppedImageForNewActivity] = useState<string | null>(null);
  const [isNewCourseOpen, setIsNewCourseOpen] = useState(false);
  const [isNewSlideOpen, setIsNewSlideOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPresentationOpen, setIsPresentationOpen] = useState(false);

  // Confirmation & Action Modals state
  const [deleteConfirmState, setDeleteConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    itemName: string;
    description: string;
    warningNote?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    itemName: '',
    description: '',
    onConfirm: () => {},
  });

  const [deleteSyncedState, setDeleteSyncedState] = useState<{
    isOpen: boolean;
    activity: ActivityItem | null;
    onConfirm: (scope: 'current' | 'all') => void;
  }>({
    isOpen: false,
    activity: null,
    onConfirm: () => {},
  });

  const [syncModalState, setSyncModalState] = useState<{
    isOpen: boolean;
    title: string;
    sourceCampus: CampusId;
    targetCourses: Course[];
    initialSelectedCourseIds: string[];
    onConfirmSync: (selectedIds: string[]) => void;
  }>({
    isOpen: false,
    title: '',
    sourceCampus: 'curitiba',
    targetCourses: [],
    initialSelectedCourseIds: [],
    onConfirmSync: () => {},
  });

  // Modal para sincronização de slide individual pós-criação (Requisito 4)
  const [syncSlideModalState, setSyncSlideModalState] = useState<{
    isOpen: boolean;
    slide: SlideData | null;
    sourceBook: AcademicBook | null;
  }>({
    isOpen: false,
    slide: null,
    sourceBook: null,
  });

  // 2. Undo / Redo History Stack (Ctrl+Z / Ctrl+Shift+Z)
  const historyPastRef = useRef<HistoryState[]>([]);
  const historyFutureRef = useRef<HistoryState[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Record state snapshot before mutation
  const pushHistorySnapshot = useCallback(() => {
    historyPastRef.current.push({
      courses: JSON.parse(JSON.stringify(courses)),
      activities: JSON.parse(JSON.stringify(activities)),
      books: JSON.parse(JSON.stringify(books)),
      currentCourseId,
      currentCampus,
    });
    if (historyPastRef.current.length > 30) {
      historyPastRef.current.shift();
    }
    historyFutureRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }, [courses, activities, books, currentCourseId, currentCampus]);

  // Undo action
  const handleUndo = useCallback(() => {
    if (historyPastRef.current.length === 0) return;
    const previous = historyPastRef.current.pop();
    if (!previous) return;

    historyFutureRef.current.push({
      courses: JSON.parse(JSON.stringify(courses)),
      activities: JSON.parse(JSON.stringify(activities)),
      books: JSON.parse(JSON.stringify(books)),
      currentCourseId,
      currentCampus,
    });

    setCourses(previous.courses);
    setActivities(previous.activities);
    setBooks(previous.books);
    setCurrentCourseId(previous.currentCourseId);
    setCurrentCampus(previous.currentCampus);

    setCanUndo(historyPastRef.current.length > 0);
    setCanRedo(true);
  }, [courses, activities, books, currentCourseId, currentCampus]);

  // Redo action
  const handleRedo = useCallback(() => {
    if (historyFutureRef.current.length === 0) return;
    const next = historyFutureRef.current.pop();
    if (!next) return;

    historyPastRef.current.push({
      courses: JSON.parse(JSON.stringify(courses)),
      activities: JSON.parse(JSON.stringify(activities)),
      books: JSON.parse(JSON.stringify(books)),
      currentCourseId,
      currentCampus,
    });

    setCourses(next.courses);
    setActivities(next.activities);
    setBooks(next.books);
    setCurrentCourseId(next.currentCourseId);
    setCurrentCampus(next.currentCampus);

    setCanUndo(true);
    setCanRedo(historyFutureRef.current.length > 0);
  }, [courses, activities, books, currentCourseId, currentCampus]);

  // Global Keyboard listener for Ctrl+Z and Ctrl+Shift+Z / Ctrl+Y
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  // 3. Persist to localStorage (Local fallback cache)
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_COURSES_KEY, JSON.stringify(courses));
      localStorage.setItem(STORAGE_ACTIVITIES_KEY, JSON.stringify(activities));
      localStorage.setItem(STORAGE_BOOKS_KEY, JSON.stringify(books));
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
  }, [courses, activities, books]);

  // 3.1 Bidirectional Reconciliation: Guarantee every evidence slide in books has an active ActivityItem
  useEffect(() => {
    setActivities((prevActs) => {
      const existingIds = new Set(prevActs.map((a) => a.id));
      const additions: ActivityItem[] = [];

      books.forEach((b) => {
        (b.slides || []).forEach((slide) => {
          if (slide.type === 'evidencia' && slide.activityId && !existingIds.has(slide.activityId)) {
            const restoredAct: ActivityItem = {
              id: slide.activityId,
              bookId: b.id,
              campus: b.campus,
              unitId: b.campus,
              courseId: b.courseId,
              title: slide.title || 'Evidência Acadêmica',
              date: slide.date || slide.evidenceMeta?.date || new Date().toISOString().split('T')[0],
              time: slide.time || slide.evidenceMeta?.time || '14:00',
              activityType: (slide.activityType as ActivityType) || 'Atividade regular',
              objective: slide.objective || slide.evidenceMeta?.actionsReport || 'Registro de atividade prática.',
              complementaryText: slide.evidenceMeta?.pedagogicalImpact || '',
              photos: slide.photos || [],
              targetCourseIds: [b.courseId],
              primaryCampus: b.campus,
              syncedCampuses: [b.campus],
              isShared: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            additions.push(restoredAct);
            existingIds.add(slide.activityId);
            saveActivityToFirestore(restoredAct);
          }
        });
      });

      if (additions.length > 0) {
        const nextList = [...additions, ...prevActs];
        try {
          localStorage.setItem(STORAGE_ACTIVITIES_KEY, JSON.stringify(nextList));
        } catch (e) {
          console.warn(e);
        }
        return nextList;
      }
      return prevActs;
    });
  }, [books]);

  // 4. Real-time Cloud Database Synchronization (Firestore)
  // Smart non-destructive bidirectional merge: NEVER erases locally created activities or evidence slides
  useEffect(() => {
    const unsub = initFirestoreSync(
      {
        onCoursesLoaded: (loadedCourses) => {
          if (loadedCourses && loadedCourses.length > 0) {
            setCourses((currentCourses) => {
              const remoteIds = new Set(loadedCourses.map((c) => c.id));
              const merged = [...loadedCourses];
              // Preserve any locally created courses not yet in remote
              for (const localC of currentCourses) {
                if (!remoteIds.has(localC.id)) {
                  merged.push(localC);
                  saveCourseToFirestore(localC);
                }
              }
              try {
                localStorage.setItem(STORAGE_COURSES_KEY, JSON.stringify(merged));
              } catch (e) {
                console.warn(e);
              }
              return merged;
            });
          }
        },
        onActivitiesLoaded: (loadedActivities) => {
          if (loadedActivities && loadedActivities.length > 0) {
            setActivities((currentActivities) => {
              const remoteMap = new Map(loadedActivities.map((a) => [a.id, a]));
              const merged: ActivityItem[] = [...loadedActivities];

              for (const localAct of currentActivities) {
                if (!remoteMap.has(localAct.id)) {
                  // Local activity not in Firestore snapshot: preserve and save to Firestore!
                  merged.push(localAct);
                  saveActivityToFirestore(localAct);
                } else {
                  // Compare timestamps: if local has more recent edit, keep local and sync to Firestore
                  const remote = remoteMap.get(localAct.id)!;
                  const localTime = new Date(localAct.updatedAt || 0).getTime();
                  const remoteTime = new Date(remote.updatedAt || 0).getTime();
                  if (localTime > remoteTime) {
                    const idx = merged.findIndex((a) => a.id === localAct.id);
                    if (idx !== -1) merged[idx] = localAct;
                    saveActivityToFirestore(localAct);
                  }
                }
              }

              try {
                localStorage.setItem(STORAGE_ACTIVITIES_KEY, JSON.stringify(merged));
              } catch (e) {
                console.warn(e);
              }
              return merged;
            });
          }
        },
        onBooksLoaded: (loadedBooks) => {
          if (loadedBooks && loadedBooks.length > 0) {
            setBooks((currentBooks) => {
              const localBooksMap = new Map(currentBooks.map((b) => [b.id, b]));

              const mergedBooks = loadedBooks.map((remoteBook) => {
                const localBook = localBooksMap.get(remoteBook.id);
                if (!localBook) {
                  const capaSlide = remoteBook.slides?.find((s) => s.type === 'capa');
                  const capaPhotoUrl = capaSlide?.photos?.[0]?.url;
                  const effectiveCover = remoteBook.coverImage || capaPhotoUrl;
                  return {
                    ...remoteBook,
                    coverImage: effectiveCover || remoteBook.coverImage,
                  };
                }

                // Remote book exists and local book exists: merge slides to preserve local evidence slides!
                const remoteSlideIds = new Set((remoteBook.slides || []).map((s) => s.id));
                const mergedSlides = [...(remoteBook.slides || [])];
                let shouldSyncBack = false;

                for (const localSlide of (localBook.slides || [])) {
                  if (!remoteSlideIds.has(localSlide.id)) {
                    // Local slide not in remote book (e.g. newly added evidence slide)
                    mergedSlides.push(localSlide);
                    shouldSyncBack = true;
                  }
                }

                const sortedSlides = mergedSlides.sort((s1, s2) => (s1.order || 0) - (s2.order || 0));

                const capaSlide = sortedSlides.find((s) => s.type === 'capa');
                const capaPhotoUrl = capaSlide?.photos?.[0]?.url;
                const effectiveCover = localBook.coverImage || remoteBook.coverImage || capaPhotoUrl;

                const finalBook: AcademicBook = {
                  ...remoteBook,
                  ...localBook,
                  coverImage: effectiveCover || remoteBook.coverImage,
                  slides: sortedSlides,
                  updatedAt: localBook.updatedAt && remoteBook.updatedAt
                    ? new Date(localBook.updatedAt) > new Date(remoteBook.updatedAt)
                      ? localBook.updatedAt
                      : remoteBook.updatedAt
                    : localBook.updatedAt || remoteBook.updatedAt || new Date().toISOString(),
                };

                if (shouldSyncBack) {
                  saveBookToFirestore(finalBook);
                }
                return finalBook;
              });

              // Include any local book that wasn't in remote at all
              const remoteBookIds = new Set(loadedBooks.map((b) => b.id));
              for (const localBook of currentBooks) {
                if (!remoteBookIds.has(localBook.id)) {
                  mergedBooks.push(localBook);
                  saveBookToFirestore(localBook);
                }
              }

              try {
                localStorage.setItem(STORAGE_BOOKS_KEY, JSON.stringify(mergedBooks));
              } catch (e) {
                console.warn(e);
              }
              return mergedBooks;
            });
          }
        },
        onStatusChange: (status, message) => {
          setSyncStatus(status);
          if (message) setSyncMessage(message);
          if (status === 'connected') {
            isInitialSyncDone.current = true;
          }
        },
      },
      {
        courses: courses,
        activities: activities,
        books: books,
      }
    );

    return () => unsub();
  }, []);

  // Current Campus Courses & Books
  const campusCourses = courses.filter((c) => c.campus === currentCampus);
  const otherCampus: CampusId = currentCampus === 'curitiba' ? 'fatec' : 'curitiba';
  const otherCampusCourses = courses.filter((c) => c.campus === otherCampus);

  // Switch campus safely: pick first available course in that campus
  const handleSelectCampus = (campus: CampusId) => {
    setCurrentCampus(campus);
    const validCourses = courses.filter((c) => c.campus === campus);
    if (validCourses.length > 0) {
      setCurrentCourseId(validCourses[0].id);
    }
  };

  // Get active book and active slide (STRICTLY ISOLATED TO CURRENT CAMPUS FIRST)
  const currentBook =
    books.find((b) => b.courseId === currentCourseId && b.campus === currentCampus) ||
    books.find((b) => b.campus === currentCampus) ||
    books.find((b) => b.courseId === currentCourseId) ||
    books[0];
  const activeSlide = currentBook?.slides.find((s) => s.id === activeSlideId) || currentBook?.slides[0];

  useEffect(() => {
    if (currentBook && (!activeSlideId || !currentBook.slides.some((s) => s.id === activeSlideId))) {
      setActiveSlideId(currentBook.slides[0]?.id || '');
    }
  }, [currentBook, activeSlideId]);

  // Centralized persistent saver for books with immediate/debounced dispatch and real status tracking
  const persistBookUpdate = useCallback(
    (updatedBook: AcademicBook, immediate: boolean = false) => {
      console.log('[CoverImageTrace] persistBookUpdate called:', {
        bookId: updatedBook.id,
        courseId: updatedBook.courseId,
        coverImage: updatedBook.coverImage ? `${updatedBook.coverImage.substring(0, 50)}...` : 'undefined',
        capaSlidePhoto: updatedBook.slides?.find((s) => s.type === 'capa')?.photos?.[0]?.url ? `${updatedBook.slides.find((s) => s.type === 'capa')!.photos[0].url.substring(0, 50)}...` : 'none',
        immediate,
      });

      // 1. Update React state immediately
      setBooks((prev) => prev.map((b) => (b.id === updatedBook.id ? updatedBook : b)));

      // 2. Persist to localStorage immediately (offline cache fallback)
      try {
        const stored = JSON.parse(localStorage.getItem(STORAGE_BOOKS_KEY) || '[]');
        const updatedList = stored.map((b: AcademicBook) => (b.id === updatedBook.id ? updatedBook : b));
        localStorage.setItem(STORAGE_BOOKS_KEY, JSON.stringify(updatedList));
      } catch (e) {
        console.warn('LocalStorage error:', e);
      }

      // 3. Clear any pending debounce timeout
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

      setSyncStatus('syncing');
      setSyncMessage('Salvando alterações no banco de dados...');

      const doSave = async () => {
        try {
          console.log('[CoverImageTrace] persistBookUpdate executing doSave to Firestore:', {
            bookId: updatedBook.id,
            coverImage: updatedBook.coverImage ? `${updatedBook.coverImage.substring(0, 50)}...` : 'undefined',
          });
          const success = await saveBookToFirestore(updatedBook);
          if (success) {
            setSyncStatus('connected');
            setSyncMessage('Salvo no banco de dados');
          } else {
            setSyncStatus('error');
            setSyncMessage('Não foi possível salvar. Tente novamente.');
          }
        } catch (err) {
          console.error('Error saving book to Firestore:', err);
          setSyncStatus('error');
          setSyncMessage('Não foi possível salvar. Tente novamente.');
        }
      };

      if (immediate) {
        doSave();
      } else {
        saveTimeoutRef.current = setTimeout(doSave, 300);
      }
    },
    []
  );

  // Guarantee flush on page refresh / window close
  useEffect(() => {
    const handleBeforeUnload = () => {
      try {
        localStorage.setItem(STORAGE_COURSES_KEY, JSON.stringify(courses));
        localStorage.setItem(STORAGE_ACTIVITIES_KEY, JSON.stringify(activities));
        localStorage.setItem(STORAGE_BOOKS_KEY, JSON.stringify(books));
      } catch (e) {
        console.warn('LocalStorage flush error on beforeunload:', e);
      }
      if (currentBook) {
        saveBookToFirestore(currentBook);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [courses, activities, books, currentBook]);

  // Handle Share Link for Real-time Collaboration
  const handleShareLink = () => {
    try {
      navigator.clipboard.writeText(window.location.href);
      setShareToast('Link copiado! Qualquer pessoa com este link acessará as alterações salvas no banco de dados.');
      setTimeout(() => setShareToast(null), 4000);
    } catch {
      setShareToast('Copie o endereço da barra de navegação para compartilhar.');
      setTimeout(() => setShareToast(null), 4000);
    }
  };

  // Update a book's properties (with explicit coverImage synchronization & tracing)
  const handleUpdateBook = (updated: Partial<AcademicBook>) => {
    pushHistorySnapshot();
    const baseBook = books.find((b) => b.id === currentBook.id) || currentBook;

    console.log('[CoverImageTrace] handleUpdateBook called:', {
      bookId: baseBook.id,
      previousCoverImage: baseBook.coverImage ? `${baseBook.coverImage.substring(0, 50)}...` : 'none',
      incomingCoverImage: updated.coverImage ? `${updated.coverImage.substring(0, 50)}...` : 'undefined',
    });

    const newCover = updated.coverImage !== undefined ? updated.coverImage : baseBook.coverImage;

    // Ensure capa slide photos[0].url is kept in sync if coverImage is being updated
    let updatedSlides = baseBook.slides;
    if (updated.coverImage) {
      updatedSlides = baseBook.slides.map((s) => {
        if (s.type === 'capa') {
          const firstPhoto = s.photos?.[0];
          return {
            ...s,
            photos: [
              {
                id: firstPhoto?.id || `cover-photo-${baseBook.courseId}`,
                url: updated.coverImage!,
                caption: firstPhoto?.caption || `Capa Oficial · ${baseBook.courseName}`,
                fit: firstPhoto?.fit || 'cover',
                position: firstPhoto?.position || 'center',
                zoom: firstPhoto?.zoom || 1,
              },
            ],
          };
        }
        return s;
      });

      // Synchronize course in courses list & Firestore
      setCourses((prev) => {
        const up = prev.map((c) => (c.id === baseBook.courseId ? { ...c, coverImage: updated.coverImage } : c));
        const targetCourse = up.find((c) => c.id === baseBook.courseId);
        if (targetCourse) saveCourseToFirestore(targetCourse);
        return up;
      });
    }

    const updatedBook: AcademicBook = {
      ...baseBook,
      ...updated,
      coverImage: newCover,
      slides: updated.slides || updatedSlides,
      updatedAt: new Date().toISOString(),
    };

    console.log('[CoverImageTrace] handleUpdateBook passing fully merged book to persistBookUpdate:', {
      bookId: updatedBook.id,
      finalCoverImage: updatedBook.coverImage ? `${updatedBook.coverImage.substring(0, 50)}...` : 'none',
      capaSlidePhoto: updatedBook.slides.find((s) => s.type === 'capa')?.photos?.[0]?.url ? `${updatedBook.slides.find((s) => s.type === 'capa')!.photos[0].url.substring(0, 50)}...` : 'none',
    });

    persistBookUpdate(updatedBook, true);
  };

  // Update current active slide in current book (with explicit coverImage sync & multi-book sync propagation)
  const handleUpdateActiveSlide = (updated: Partial<SlideData>) => {
    pushHistorySnapshot();
    const baseBook = books.find((b) => b.id === currentBook.id) || currentBook;
    const currentActiveSlide = baseBook.slides.find((s) => s.id === activeSlide.id) || activeSlide;

    console.log('[CoverImageTrace] handleUpdateActiveSlide called:', {
      slideId: currentActiveSlide.id,
      slideType: currentActiveSlide.type,
      currentBookCover: baseBook.coverImage ? `${baseBook.coverImage.substring(0, 50)}...` : 'none',
      incomingPhotosCount: updated.photos?.length,
      incomingPhoto0Url: updated.photos?.[0]?.url ? `${updated.photos[0].url.substring(0, 50)}...` : 'none',
    });

    let newCoverImage = baseBook.coverImage;

    // Detect if the capa slide photo is updated
    if (currentActiveSlide.type === 'capa') {
      const incomingCapaUrl = updated.photos?.[0]?.url;
      if (incomingCapaUrl) {
        newCoverImage = incomingCapaUrl;
        console.log('[CoverImageTrace] Capa slide photo update detected. Setting new coverImage:', `${newCoverImage.substring(0, 50)}...`);

        // Update corresponding course in courses state & Firestore
        setCourses((prev) => {
          const up = prev.map((c) => (c.id === baseBook.courseId ? { ...c, coverImage: newCoverImage } : c));
          const targetCourse = up.find((c) => c.id === baseBook.courseId);
          if (targetCourse) saveCourseToFirestore(targetCourse);
          return up;
        });
      }
    }

    const updatedSlides = baseBook.slides.map((s) => {
      if (s.id === currentActiveSlide.id) {
        const merged = { ...s, ...updated };
        if (s.type === 'capa' && newCoverImage) {
          const firstPhoto = merged.photos?.[0];
          merged.photos = [
            {
              id: firstPhoto?.id || `cover-photo-${baseBook.courseId}`,
              url: newCoverImage,
              caption: firstPhoto?.caption || `Capa Oficial · ${baseBook.courseName}`,
              fit: firstPhoto?.fit || 'cover',
              position: firstPhoto?.position || 'center',
              zoom: firstPhoto?.zoom || 1,
            },
          ];
        }
        return merged;
      }
      return s;
    });

    const updatedBook: AcademicBook = {
      ...baseBook,
      coverImage: newCoverImage,
      slides: updatedSlides,
      updatedAt: new Date().toISOString(),
    };

    console.log('[CoverImageTrace] handleUpdateActiveSlide saving fully merged book:', {
      bookId: updatedBook.id,
      coverImage: updatedBook.coverImage ? `${updatedBook.coverImage.substring(0, 50)}...` : 'none',
      capaSlideCover: updatedBook.slides.find((s) => s.type === 'capa')?.photos?.[0]?.url ? `${updatedBook.slides.find((s) => s.type === 'capa')!.photos[0].url.substring(0, 50)}...` : 'none',
    });

    persistBookUpdate(updatedBook, currentActiveSlide.type === 'capa');

    // If this slide is synchronized across multiple books (via syncGroupId or activityId), propagate changes!
    const syncKey = currentActiveSlide.syncGroupId || currentActiveSlide.activityId;
    if (syncKey) {
      setBooks((prevBooks) => {
        return prevBooks.map((b) => {
          if (b.id === baseBook.id) return b;
          const matchingIndex = b.slides.findIndex(
            (s) => (s.syncGroupId && s.syncGroupId === syncKey) || (s.activityId && s.activityId === syncKey)
          );
          if (matchingIndex !== -1) {
            const syncedSlide: SlideData = {
              ...b.slides[matchingIndex],
              ...updated,
              id: b.slides[matchingIndex].id,
              order: b.slides[matchingIndex].order,
            };
            const updatedB: AcademicBook = {
              ...b,
              slides: b.slides.map((s, idx) => (idx === matchingIndex ? syncedSlide : s)),
              updatedAt: new Date().toISOString(),
            };
            saveBookToFirestore(updatedB);
            return updatedB;
          }
          return b;
        });
      });
    }

    // If this slide is linked to an activity, update the activity and save it to Firestore
    // If this slide is linked to an activity, update the activity and save it to Firestore & localStorage
    if (currentActiveSlide.activityId) {
      setActivities((prev) => {
        const nextActs = prev.map((act) => {
          if (act.id !== currentActiveSlide.activityId) return act;
          const updatedAct: ActivityItem = {
            ...act,
            title: updated.title !== undefined ? updated.title : act.title,
            date: updated.date !== undefined ? updated.date : act.date,
            time: updated.time !== undefined ? updated.time : act.time,
            activityType: updated.activityType !== undefined ? updated.activityType : act.activityType,
            objective: updated.objective !== undefined ? updated.objective : act.objective,
            photos: updated.photos !== undefined ? updated.photos : act.photos,
            updatedAt: new Date().toISOString(),
          };
          saveActivityToFirestore(updatedAct);
          return updatedAct;
        });
        try {
          localStorage.setItem(STORAGE_ACTIVITIES_KEY, JSON.stringify(nextActs));
        } catch (e) {
          console.warn('LocalStorage error:', e);
        }
        return nextActs;
      });
    }
  };

  // 4. Activity Management with STRICT ISOLATION BETWEEN BOOKS & UNITS
  const handleSaveActivity = async (activity: ActivityItem, applyToAllSynced: boolean = true) => {
    pushHistorySnapshot();

    // Guard: compress any raw base64 photos to ensure lightweight storage
    const compressedPhotos: PhotoItem[] = await Promise.all(
      (activity.photos || []).map(async (p) => {
        if (p.url && (p.url.startsWith('data:') || p.url.startsWith('blob:')) && p.url.length > 80000) {
          try {
            const compressed = await compressImageToDataUrl(p.url, 1280, 720, 0.75);
            return { ...p, url: compressed || p.url };
          } catch {
            return p;
          }
        }
        return p;
      })
    );

    const safeActivity: ActivityItem = {
      ...activity,
      photos: compressedPhotos,
      updatedAt: new Date().toISOString(),
    };

    const isExisting = activities.some((a) => a.id === safeActivity.id);
    let updatedActivities: ActivityItem[];
    if (isExisting) {
      updatedActivities = activities.map((a) => (a.id === safeActivity.id ? safeActivity : a));
    } else {
      updatedActivities = [safeActivity, ...activities];
    }
    setActivities(updatedActivities);
    try {
      localStorage.setItem(STORAGE_ACTIVITIES_KEY, JSON.stringify(updatedActivities));
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
    saveActivityToFirestore(safeActivity);

    // Identify target books explicitly:
    const targetBookIds = new Set<string>();
    if (safeActivity.bookId) targetBookIds.add(safeActivity.bookId);
    (safeActivity.targetCourseIds || []).forEach((cId) => {
      const c = courses.find((course) => course.id === cId);
      if (c) {
        targetBookIds.add(`book-${c.id}`);
      }
    });

    // Update ONLY the targeted Books — all other books remain 100% UNTOUCHED
    setBooks((prevBooks) => {
      const updatedBooks = prevBooks.map((b) => {
        const isTargeted =
          (safeActivity.bookId && b.id === safeActivity.bookId) ||
          targetBookIds.has(b.id) ||
          (safeActivity.courseId === b.courseId && safeActivity.campus === b.campus);

        if (!isTargeted) {
          // TOTAL ISOLATION: NADA é alterado ou removido em outros Books
          return b;
        }

        const existingSlideIndex = b.slides.findIndex((s) => s.activityId === safeActivity.id);
        const updatedSlide: SlideData = {
          id: existingSlideIndex !== -1 ? b.slides[existingSlideIndex].id : `slide-act-${b.id}-${safeActivity.id}`,
          activityId: safeActivity.id,
          type: 'evidencia',
          title: safeActivity.title,
          subtitle: `${safeActivity.activityType} · ${safeActivity.date}${safeActivity.time ? ` às ${safeActivity.time}` : ''}`,
          activityType: safeActivity.activityType,
          date: safeActivity.date,
          time: safeActivity.time,
          objective: safeActivity.objective,
          order: existingSlideIndex !== -1 ? b.slides[existingSlideIndex].order : b.slides.length + 1,
          photoLayout: safeActivity.photos.length > 1 ? 'split-50-50' : 'single',
          photos: [...safeActivity.photos],
          evidenceMeta: {
            category: safeActivity.activityType,
            date: safeActivity.date,
            time: safeActivity.time,
            location: 'Campus Universitário',
            discipline: '',
            professor: b.coordinator || '',
            studentsCount: 0,
            actionsReport: safeActivity.objective,
            pedagogicalImpact: safeActivity.complementaryText || '',
          },
          customTextBoxes: existingSlideIndex !== -1 ? b.slides[existingSlideIndex].customTextBoxes || [] : [],
        };

        let newSlides = [...b.slides];
        if (existingSlideIndex !== -1) {
          newSlides[existingSlideIndex] = updatedSlide;
        } else {
          const insertIndex = Math.max(1, newSlides.length - 1);
          newSlides.splice(insertIndex, 0, updatedSlide);
          newSlides = newSlides.map((s, idx) => ({ ...s, order: idx + 1 }));
        }

        const updatedB = { ...b, slides: newSlides, updatedAt: new Date().toISOString() };
        saveBookToFirestore(updatedB);
        return updatedB;
      });

      try {
        localStorage.setItem(STORAGE_BOOKS_KEY, JSON.stringify(updatedBooks));
      } catch (e) {
        console.warn('LocalStorage error:', e);
      }
      return updatedBooks;
    });

    setEditingActivity(null);
    setDroppedImageForNewActivity(null);
  };

  // 5. EXCLUSÃO REAL DE BOOKS (REQUISITO 1 & 2)
  const handleRequestDeleteBook = (book: AcademicBook) => {
    setDeleteConfirmState({
      isOpen: true,
      title: 'Excluir Book?',
      itemName: `Book de Evidências — ${book.courseName}`,
      description: `Esta ação removerá definitivamente o Book do curso ${book.courseName} (${book.campus === 'curitiba' ? 'Curitiba' : 'FATEC'}).`,
      warningNote: 'Conteúdos que também estão vinculados a outros Books (como na FATEC ou em outros cursos) continuarão preservados nos respectivos ambientes.',
      onConfirm: () => {
        pushHistorySnapshot();
        // Remove book
        const remainingBooks = books.filter((b) => b.id !== book.id);
        setBooks(remainingBooks);
        deleteBookFromFirestore(book.id);

        // Update activities: remove this courseId from targetCourseIds
        setActivities((prevActs) =>
          prevActs
            .map((act) => ({
              ...act,
              targetCourseIds: act.targetCourseIds.filter((cId) => cId !== book.courseId),
            }))
            .filter((act) => act.targetCourseIds.length > 0) // only delete activity if it has zero books left!
        );

        if (currentCourseId === book.courseId) {
          const nextBook = remainingBooks.find((b) => b.campus === currentCampus) || remainingBooks[0];
          if (nextBook) {
            setCurrentCourseId(nextBook.courseId);
          } else {
            setCurrentView('home');
          }
        }
      },
    });
  };

  // 6. EXCLUSÃO REAL DE CURSOS (REQUISITO 1 & 2)
  const handleRequestDeleteCourse = (course: Course) => {
    setDeleteConfirmState({
      isOpen: true,
      title: 'Excluir curso e respectivo Book?',
      itemName: `${course.name} (${course.campus === 'curitiba' ? 'Curitiba' : 'FATEC'})`,
      description: 'Esta ação removerá o curso e seu Book permanentemente da plataforma e do banco de dados na nuvem.',
      warningNote: 'A exclusão é sincronizada em tempo real para todos os usuários com o link.',
      onConfirm: () => {
        pushHistorySnapshot();
        // Remove course locally and in Firestore
        const remainingCourses = courses.filter((c) => c.id !== course.id);
        setCourses(remainingCourses);
        deleteCourseFromFirestore(course.id);

        // Remove course books locally and in Firestore
        const booksToDelete = books.filter((b) => b.courseId === course.id);
        booksToDelete.forEach((b) => deleteBookFromFirestore(b.id));
        deleteBookFromFirestore(`book-${course.id}`); // Guarantee default ID as well

        const remainingBooks = books.filter((b) => b.courseId !== course.id);
        setBooks(remainingBooks);

        // Remove from activities and sync with Firestore
        setActivities((prevActs) =>
          prevActs
            .map((act) => {
              const remainingTargets = act.targetCourseIds.filter((cId) => cId !== course.id);
              const updatedAct = {
                ...act,
                targetCourseIds: remainingTargets,
                isShared: remainingTargets.length > 1,
              };
              if (remainingTargets.length === 0) {
                deleteActivityFromFirestore(act.id);
              } else {
                saveActivityToFirestore(updatedAct);
              }
              return updatedAct;
            })
            .filter((act) => act.targetCourseIds.length > 0)
        );

        if (currentCourseId === course.id) {
          const nextCourse = remainingCourses.find((c) => c.campus === currentCampus) || remainingCourses[0];
          if (nextCourse) {
            setCurrentCourseId(nextCourse.id);
          } else {
            setCurrentView('home');
          }
        }
      },
    });
  };

  // 7. EXCLUSÃO DE ATIVIDADES (REQUISITO 13: ESCOPO DE EXCLUSÃO PARA CONTEÚDO SINCRONIZADO)
  const handleRequestDeleteActivity = (activity: ActivityItem) => {
    // Check if activity is present in both campuses
    const campusesInvolved = new Set<CampusId>();
    activity.targetCourseIds.forEach((cId) => {
      const c = courses.find((course) => course.id === cId);
      if (c) campusesInvolved.add(c.campus);
    });

    if (campusesInvolved.size > 1) {
      // Synced between Curitiba and FATEC: ask scope!
      setDeleteSyncedState({
        isOpen: true,
        activity,
        onConfirm: (scope) => {
          pushHistorySnapshot();
          if (scope === 'current') {
            // Remove only courses of current campus from targetCourseIds
            const remainingTargetIds = activity.targetCourseIds.filter((cId) => {
              const c = courses.find((course) => course.id === cId);
              return c?.campus !== currentCampus;
            });

            setActivities((prev) =>
              prev.map((act) =>
                act.id === activity.id
                  ? { ...act, targetCourseIds: remainingTargetIds, isShared: remainingTargetIds.length > 1 }
                  : act
              )
            );

            // Remove slides from current campus books
            setBooks((prevBooks) =>
              prevBooks.map((b) => {
                if (b.campus !== currentCampus) return b;
                return {
                  ...b,
                  slides: b.slides.filter((s) => s.activityId !== activity.id).map((s, idx) => ({ ...s, order: idx + 1 })),
                };
              })
            );
          } else {
            // Delete completely from all books and from activities
            setActivities((prev) => prev.filter((a) => a.id !== activity.id));
            setBooks((prev) =>
              prev.map((b) => ({
                ...b,
                slides: b.slides.filter((s) => s.activityId !== activity.id).map((s, idx) => ({ ...s, order: idx + 1 })),
              }))
            );
          }
        },
      });
    } else {
      // Activity is only in one campus: standard delete confirm
      setDeleteConfirmState({
        isOpen: true,
        title: 'Excluir Atividade?',
        itemName: activity.title,
        description: 'Esta ação removerá permanentemente esta atividade do Book.',
        onConfirm: () => {
          pushHistorySnapshot();
          setActivities((prev) => prev.filter((a) => a.id !== activity.id));
          deleteActivityFromFirestore(activity.id);
          setBooks((prev) =>
            prev.map((b) => ({
              ...b,
              slides: b.slides.filter((s) => s.activityId !== activity.id).map((s, idx) => ({ ...s, order: idx + 1 })),
            }))
          );
        },
      });
    }
  };

  // 8. SINCRONIZAÇÃO MANUAL DE ATIVIDADE EXISTENTE (REQUISITO 6 & 7)
  const handleRequestSyncActivity = (activity: ActivityItem) => {
    const targetCampusCourses = courses.filter((c) => c.campus === otherCampus);
    const existingOtherCampusIds = activity.targetCourseIds.filter((id) =>
      targetCampusCourses.some((c) => c.id === id)
    );

    setSyncModalState({
      isOpen: true,
      title: `Sincronizar "${activity.title}"`,
      sourceCampus: currentCampus,
      targetCourses: targetCampusCourses,
      initialSelectedCourseIds: existingOtherCampusIds,
      onConfirmSync: (selectedIds) => {
        pushHistorySnapshot();
        // Remove previously linked courses of the other campus, and add newly selected ones
        const currentCampusCourseIds = activity.targetCourseIds.filter((id) =>
          courses.find((c) => c.id === id)?.campus === currentCampus
        );
        const finalCourseIds = [...currentCampusCourseIds, ...selectedIds];

        const updatedActivity: ActivityItem = {
          ...activity,
          targetCourseIds: finalCourseIds,
          syncedCampuses: selectedIds.length > 0 ? ['curitiba', 'fatec'] : [currentCampus],
          isShared: finalCourseIds.length > 1,
          updatedAt: new Date().toISOString(),
        };

        handleSaveActivity(updatedActivity, true);
      },
    });
  };

  // 9. SINCRONIZAÇÃO DE BOOK INTEIRO (REQUISITO 8)
  const handleRequestSyncBook = (book: AcademicBook) => {
    const targetCampusCourses = courses.filter((c) => c.campus === otherCampus);

    setSyncModalState({
      isOpen: true,
      title: `Sincronizar Book de ${book.courseName}`,
      sourceCampus: currentCampus,
      targetCourses: targetCampusCourses,
      initialSelectedCourseIds: [],
      onConfirmSync: (selectedIds) => {
        if (selectedIds.length === 0) return;
        pushHistorySnapshot();

        // Get all activities of this book
        const bookActivities = activities.filter((act) => act.targetCourseIds.includes(book.courseId));

        // For each activity, link the selected courses
        const updatedActivities = activities.map((act) => {
          if (!act.targetCourseIds.includes(book.courseId)) return act;
          const merged = Array.from(new Set([...act.targetCourseIds, ...selectedIds]));
          return {
            ...act,
            targetCourseIds: merged,
            syncedCampuses: ['curitiba', 'fatec'] as CampusId[],
            isShared: true,
            updatedAt: new Date().toISOString(),
          };
        });

        setActivities(updatedActivities);

        // Update books to include slides
        setBooks((prevBooks) => {
          return prevBooks.map((b) => {
            if (!selectedIds.includes(b.courseId)) return b;
            const newSlides = [...b.slides];
            bookActivities.forEach((act) => {
              const alreadyHas = newSlides.some((s) => s.activityId === act.id);
              if (!alreadyHas) {
                const insertIdx = Math.max(1, newSlides.length - 1);
                newSlides.splice(insertIdx, 0, {
                  id: `slide-act-${act.id}-${b.courseId}`,
                  activityId: act.id,
                  type: 'evidencia',
                  title: act.title,
                  subtitle: `${act.activityType} · ${act.date}`,
                  activityType: act.activityType,
                  date: act.date,
                  time: act.time,
                  objective: act.objective,
                  order: newSlides.length + 1,
                  photoLayout: act.photos.length > 1 ? 'split-50-50' : 'single',
                  photos: [...act.photos],
                  evidenceMeta: {
                    category: act.activityType,
                    date: act.date,
                    time: act.time,
                    location: 'Campus Universitário',
                    discipline: '',
                    professor: b.coordinator || '',
                    studentsCount: 0,
                    actionsReport: act.objective,
                  },
                });
              }
            });
            return { ...b, slides: newSlides.map((s, idx) => ({ ...s, order: idx + 1 })) };
          });
        });
      },
    });
  };

  // 9.1 DISTRIBUIÇÃO AUTOMÁTICA DE FOTOS EM NOVO SLIDE (Requisito 1)
  const handleSplitSlidePhotos = (slideId: string) => {
    const targetSlide = currentBook?.slides.find((s) => s.id === slideId);
    if (!targetSlide || !targetSlide.photos || targetSlide.photos.length <= 3) return;

    pushHistorySnapshot();
    const photosToKeep = targetSlide.photos.slice(0, 3);
    const photosToMove = targetSlide.photos.slice(3);

    const updatedCurrentSlide: SlideData = {
      ...targetSlide,
      photos: photosToKeep,
    };

    const continuationSlide: SlideData = {
      ...targetSlide,
      id: `slide-cont-${Date.now()}`,
      title: `${targetSlide.title} (Continuação)`,
      subtitle: `${targetSlide.subtitle || ''} · Registros Adicionais`,
      photos: photosToMove,
      order: targetSlide.order + 1,
    };

    const currentSlideIndex = currentBook.slides.findIndex((s) => s.id === slideId);
    const newSlides = [...currentBook.slides];
    newSlides[currentSlideIndex] = updatedCurrentSlide;
    newSlides.splice(currentSlideIndex + 1, 0, continuationSlide);
    const reorderedSlides = newSlides.map((s, idx) => ({ ...s, order: idx + 1 }));

    const updatedBook: AcademicBook = {
      ...currentBook,
      slides: reorderedSlides,
      updatedAt: new Date().toISOString(),
    };

    persistBookUpdate(updatedBook, true);
    setActiveSlideId(continuationSlide.id);
  };

  // 9.2 SINCRONIZAÇÃO DE SLIDE INDIVIDUAL COM OUTROS BOOKS (Requisito 4)
  const handleOpenSyncSlideModal = (slide: SlideData) => {
    setSyncSlideModalState({
      isOpen: true,
      slide,
      sourceBook: currentBook,
    });
  };

  const handleConfirmSyncSlide = (slideId: string, selectedBookIds: string[]) => {
    const targetSlide = currentBook?.slides.find((s) => s.id === slideId);
    if (!targetSlide || !currentBook) return;

    pushHistorySnapshot();
    const syncKey = targetSlide.syncGroupId || targetSlide.activityId || `sync-${Date.now()}`;
    const allSelectedIds = Array.from(new Set(selectedBookIds));

    // Update current slide
    const updatedCurrentSlide: SlideData = {
      ...targetSlide,
      syncGroupId: syncKey,
      syncedBookIds: allSelectedIds,
      isShared: allSelectedIds.length > 1,
    };

    handleUpdateActiveSlide(updatedCurrentSlide);

    // Update all destination books in books state and save to Firestore
    setBooks((prevBooks) => {
      const updatedList = prevBooks.map((b) => {
        if (b.id === currentBook.id) {
          return {
            ...b,
            slides: b.slides.map((s) => (s.id === slideId ? updatedCurrentSlide : s)),
          };
        }

        const isTargeted = allSelectedIds.includes(b.id);
        const existingSlideIndex = b.slides.findIndex(
          (s) => (s.syncGroupId && s.syncGroupId === syncKey) || (s.activityId && s.activityId === syncKey)
        );

        if (isTargeted) {
          // Add or update the slide in this book
          const destinationSlide: SlideData = {
            ...targetSlide,
            id: existingSlideIndex !== -1 ? b.slides[existingSlideIndex].id : `slide-sync-${b.id}-${Date.now()}`,
            syncGroupId: syncKey,
            syncedBookIds: allSelectedIds,
            isShared: true,
            order: existingSlideIndex !== -1 ? b.slides[existingSlideIndex].order : b.slides.length + 1,
          };

          let newSlides = [...b.slides];
          if (existingSlideIndex !== -1) {
            newSlides[existingSlideIndex] = destinationSlide;
          } else {
            const insertIdx = Math.max(1, newSlides.length - 1);
            newSlides.splice(insertIdx, 0, destinationSlide);
            newSlides = newSlides.map((s, idx) => ({ ...s, order: idx + 1 }));
          }

          const updatedB: AcademicBook = { ...b, slides: newSlides, updatedAt: new Date().toISOString() };
          saveBookToFirestore(updatedB);
          return updatedB;
        } else {
          // If was previously synced and now unlinked without deleting
          if (existingSlideIndex !== -1) {
            const unlinkedSlide: SlideData = {
              ...b.slides[existingSlideIndex],
              syncGroupId: undefined,
              syncedBookIds: [],
              isShared: false,
            };
            const updatedB: AcademicBook = {
              ...b,
              slides: b.slides.map((s, idx) => (idx === existingSlideIndex ? unlinkedSlide : s)),
              updatedAt: new Date().toISOString(),
            };
            saveBookToFirestore(updatedB);
            return updatedB;
          }
          return b;
        }
      });
      return updatedList;
    });

    setSyncSlideModalState({ isOpen: false, slide: null, sourceBook: null });
  };

  // 10. CRIAÇÃO DE CURSO COM VÍNCULO OPCIONAL & CAPA PERSONALIZADA
  const handleAddCourse = (
    name: string,
    area: AcademicArea,
    campus: CampusId,
    syncWithOtherCampus: boolean,
    coverImage?: string
  ) => {
    pushHistorySnapshot();
    const courseId = `course-${Date.now()}`;
    const effectiveCover = coverImage || getCourseCoverImage(name, area);

    const newCourse: Course = {
      id: courseId,
      name,
      campus,
      academicArea: area,
      coordinator: '',
      director: '',
      period: '2026.1',
      coverImage: effectiveCover,
    };

    let updatedCourses = [...courses, newCourse];

    // Create corresponding Book with personalized cover slide and metadata
    const newBook: AcademicBook = {
      id: `book-${courseId}`,
      courseId,
      campus,
      courseName: name,
      academicArea: area,
      period: '2026.1',
      title: `Book de Evidências Acadêmicas - ${name}`,
      subtitle: `Registro das Atividades · 2026.1`,
      status: 'elaboracao',
      coordinator: '',
      director: '',
      updatedAt: new Date().toISOString(),
      coverImage: effectiveCover,
      slides: [
        {
          id: `slide-capa-${courseId}`,
          type: 'capa',
          title: `Book de Evidências Acadêmicas`,
          subtitle: `Registro das Atividades e Práticas Desenvolvidas`,
          order: 1,
          photos: [
            {
              id: `cover-photo-${courseId}`,
              url: effectiveCover,
              caption: `Capa Oficial · ${name}`,
              fit: 'cover',
            },
          ],
          customText1: `Período Letivo: 2026.1`,
          customText2: '',
        },
        {
          id: `slide-sumario-${courseId}`,
          type: 'sumario',
          title: 'Sumário das Atividades',
          subtitle: 'Visão geral das evidências do semestre',
          order: 2,
          photos: [],
        },
        {
          id: `slide-contatos-${courseId}`,
          type: 'contatos',
          title: 'Informações Institucionais',
          subtitle: 'Encerramento do Book de Evidências',
          order: 3,
          photos: [],
        },
      ],
    };

    let updatedBooks = [...books, newBook];

    // If user explicitly chose to link with the other campus:
    if (syncWithOtherCampus) {
      const counterpartCampus: CampusId = campus === 'curitiba' ? 'fatec' : 'curitiba';
      const counterpartCourseId = `course-${Date.now()}-sync`;
      const counterpartCourse: Course = {
        id: counterpartCourseId,
        name,
        campus: counterpartCampus,
        academicArea: area,
        coordinator: '',
        director: '',
        period: '2026.1',
        linkedCampus: campus,
        coverImage: effectiveCover,
      };

      const counterpartBook: AcademicBook = {
        id: `book-${counterpartCourseId}`,
        courseId: counterpartCourseId,
        campus: counterpartCampus,
        courseName: name,
        academicArea: area,
        period: '2026.1',
        title: `Book de Evidências Acadêmicas - ${name}`,
        subtitle: `Registro das Atividades · 2026.1 (${counterpartCampus === 'curitiba' ? 'Curitiba' : 'FATEC'})`,
        status: 'elaboracao',
        coordinator: '',
        director: '',
        updatedAt: new Date().toISOString(),
        coverImage: effectiveCover,
        slides: [
          {
            id: `slide-capa-${counterpartCourseId}`,
            type: 'capa',
            title: `Book de Evidências Acadêmicas`,
            subtitle: `Registro das Atividades e Práticas Desenvolvidas`,
            order: 1,
            photos: [
              {
                id: `cover-photo-${counterpartCourseId}`,
                url: effectiveCover,
                caption: `Capa Oficial · ${name}`,
                fit: 'cover',
              },
            ],
            customText1: `Período Letivo: 2026.1`,
            customText2: '',
          },
          {
            id: `slide-sumario-${counterpartCourseId}`,
            type: 'sumario',
            title: 'Sumário das Atividades',
            subtitle: 'Visão geral das evidências do semestre',
            order: 2,
            photos: [],
          },
          {
            id: `slide-contatos-${counterpartCourseId}`,
            type: 'contatos',
            title: 'Informações Institucionais',
            subtitle: 'Encerramento do Book de Evidências',
            order: 3,
            photos: [],
          },
        ],
      };

      updatedCourses.push(counterpartCourse);
      updatedBooks.push(counterpartBook);
      saveCourseToFirestore(counterpartCourse);
      saveBookToFirestore(counterpartBook);
    }

    setCourses(updatedCourses);
    setBooks(updatedBooks);
    setCurrentCampus(campus);
    setCurrentCourseId(courseId);

    saveCourseToFirestore(newCourse);
    saveBookToFirestore(newBook);
  };

  // 11. ATUALIZAÇÃO DA CAPA DO CURSO E DO RESPECTIVO BOOK
  const handleUpdateCourseCover = (courseId: string, newCoverUrl: string) => {
    pushHistorySnapshot();
    setCourses((prevCourses) => {
      const updated = prevCourses.map((c) => (c.id === courseId ? { ...c, coverImage: newCoverUrl } : c));
      const targetC = updated.find((c) => c.id === courseId);
      if (targetC) {
        saveCourseToFirestore(targetC);
        try {
          localStorage.setItem(STORAGE_COURSES_KEY, JSON.stringify(updated));
        } catch (e) {
          console.warn(e);
        }
      }
      return updated;
    });

    setBooks((prevBooks) => {
      const updated = prevBooks.map((b) => {
        if (b.courseId === courseId || b.id === `book-${courseId}` || b.id === courseId) {
          const hasCapa = b.slides?.some((s) => s.type === 'capa');
          let updatedSlides = (b.slides || []).map((s) => {
            if (s.type === 'capa') {
              const currentPhoto = s.photos?.[0];
              return {
                ...s,
                photos: [
                  {
                    id: currentPhoto?.id || `cover-photo-${courseId}`,
                    url: newCoverUrl,
                    caption: `Capa Oficial · ${b.courseName}`,
                    fit: 'cover' as const,
                    position: currentPhoto?.position || 'center',
                    zoom: currentPhoto?.zoom || 1,
                  },
                ],
              };
            }
            return s;
          });

          if (!hasCapa) {
            updatedSlides = [
              {
                id: `slide-capa-${courseId}`,
                type: 'capa' as const,
                title: b.courseName,
                subtitle: 'Book de Evidências Acadêmicas',
                order: 1,
                photos: [
                  {
                    id: `cover-photo-${courseId}`,
                    url: newCoverUrl,
                    caption: `Capa Oficial · ${b.courseName}`,
                    fit: 'cover' as const,
                  },
                ],
              },
              ...updatedSlides,
            ];
          }

          const updatedB: AcademicBook = {
            ...b,
            coverImage: newCoverUrl,
            updatedAt: new Date().toISOString(),
            slides: updatedSlides,
          };
          saveBookToFirestore(updatedB);
          return updatedB;
        }
        return b;
      });

      try {
        localStorage.setItem(STORAGE_BOOKS_KEY, JSON.stringify(updated));
      } catch (e) {
        console.warn(e);
      }

      return updated;
    });
  };

  // Reorder slides in current book
  const handleMoveSlide = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === currentBook.slides.length - 1)
    ) {
      return;
    }
    pushHistorySnapshot();

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const slides = [...currentBook.slides];
    const temp = slides[index];
    slides[index] = slides[targetIndex];
    slides[targetIndex] = temp;

    const reordered = slides.map((s, idx) => ({ ...s, order: idx + 1 }));
    const updatedBook: AcademicBook = {
      ...currentBook,
      slides: reordered,
      updatedAt: new Date().toISOString(),
    };
    persistBookUpdate(updatedBook, true);
  };

  const handleDuplicateSlide = (slideId: string) => {
    const target = currentBook.slides.find((s) => s.id === slideId);
    if (!target) return;
    pushHistorySnapshot();

    const newId = `slide-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const duplicated: SlideData = {
      ...JSON.parse(JSON.stringify(target)),
      id: newId,
      title: `${target.title} (Cópia)`,
      activityId: undefined,
    };

    const targetIdx = currentBook.slides.findIndex((s) => s.id === slideId);
    const updated = [...currentBook.slides];
    updated.splice(targetIdx + 1, 0, duplicated);

    const reordered = updated.map((s, idx) => ({ ...s, order: idx + 1 }));
    const updatedBook: AcademicBook = {
      ...currentBook,
      slides: reordered,
      updatedAt: new Date().toISOString(),
    };
    persistBookUpdate(updatedBook, true);
    setActiveSlideId(newId);
  };

  const handleDeleteSlide = (slideId: string) => {
    if (currentBook.slides.length <= 1) return;
    setDeleteConfirmState({
      isOpen: true,
      title: 'Excluir slide?',
      itemName: activeSlide?.title || 'Slide selecionado',
      description: 'Deseja excluir este slide do Book de Evidências?',
      warningNote: 'A exclusão é salva permanentemente no banco de dados em tempo real.',
      onConfirm: () => {
        pushHistorySnapshot();
        const updated = currentBook.slides
          .filter((s) => s.id !== slideId)
          .map((s, idx) => ({ ...s, order: idx + 1 }));

        const updatedBook: AcademicBook = {
          ...currentBook,
          slides: updated,
          updatedAt: new Date().toISOString(),
        };
        persistBookUpdate(updatedBook, true);

        if (activeSlideId === slideId) {
          setActiveSlideId(updated[0]?.id || '');
        }
      },
    });
  };

  const handleAddSlideFromTemplate = (template: Partial<SlideData>) => {
    pushHistorySnapshot();
    const newSlideId = `slide-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const isEvidence = (template.type || 'evidencia') === 'evidencia';
    const newActivityId = isEvidence ? `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}` : undefined;

    const newSlide: SlideData = {
      id: newSlideId,
      activityId: newActivityId,
      type: template.type || 'evidencia',
      title: template.title || 'Nova Atividade',
      subtitle: template.subtitle || (isEvidence ? `Atividade regular · ${new Date().toLocaleDateString('pt-BR')}` : undefined),
      activityType: isEvidence ? 'Atividade regular' : undefined,
      date: isEvidence ? new Date().toISOString().split('T')[0] : undefined,
      time: isEvidence ? '14:00' : undefined,
      objective: template.evidenceMeta?.actionsReport || template.objective || '',
      order: currentBook.slides.length + 1,
      photos: template.photos || [],
      photoLayout: template.photoLayout || 'single',
      evidenceMeta: template.evidenceMeta,
      customTextBoxes: [],
      customText1: template.customText1,
      customText2: template.customText2,
    };

    const updated = [...currentBook.slides, newSlide].map((s, idx) => ({ ...s, order: idx + 1 }));
    const updatedBook: AcademicBook = {
      ...currentBook,
      slides: updated,
      updatedAt: new Date().toISOString(),
    };
    persistBookUpdate(updatedBook, true);

    // If it's an evidence slide, create the corresponding ActivityItem so it appears on HomePage and persists everywhere
    if (isEvidence && newActivityId) {
      const newActivity: ActivityItem = {
        id: newActivityId,
        bookId: currentBook.id,
        campus: currentBook.campus,
        unitId: currentBook.campus,
        courseId: currentBook.courseId,
        title: newSlide.title,
        date: newSlide.date || new Date().toISOString().split('T')[0],
        time: newSlide.time || '14:00',
        activityType: 'Atividade regular',
        objective: newSlide.objective || newSlide.evidenceMeta?.actionsReport || 'Registro de atividade prática acadêmica.',
        complementaryText: newSlide.evidenceMeta?.pedagogicalImpact || '',
        photos: newSlide.photos || [],
        targetCourseIds: [currentBook.courseId],
        primaryCampus: currentBook.campus,
        syncedCampuses: [currentBook.campus],
        isShared: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setActivities((prev) => {
        const nextActs = [newActivity, ...prev];
        try {
          localStorage.setItem(STORAGE_ACTIVITIES_KEY, JSON.stringify(nextActs));
        } catch (e) {
          console.warn('LocalStorage error:', e);
        }
        return nextActs;
      });
      saveActivityToFirestore(newActivity);
    }

    setActiveSlideId(newSlideId);
  };

  // Export to PowerPoint
  const handleExportPPTX = async (bookToExport: AcademicBook = currentBook) => {
    try {
      setIsExporting(true);
      await exportToPowerPoint(bookToExport);
    } catch (err) {
      console.error('Erro ao exportar apresentação PPTX:', err);
      alert('Houve um problema ao compilar o arquivo PowerPoint. Verifique os dados e tente novamente.');
    } finally {
      setIsExporting(false);
    }
  };

  // Export to PDF / Print
  const handleExportPDF = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      {/* 3-Zone Header Contract with prominent campus identity */}
      <HeaderNav
        book={currentBook}
        courses={courses}
        currentCampus={currentCampus}
        onSelectCampus={handleSelectCampus}
        currentView={currentView}
        onGoHome={() => setCurrentView('home')}
        onSelectCourse={(courseId) => {
          setCurrentCourseId(courseId);
          setCurrentView('editor');
        }}
        onUpdateBook={handleUpdateBook}
        onOpenNewActivity={() => {
          setEditingActivity(null);
          setActivityModalSharedMode(false);
          setDroppedImageForNewActivity(null);
          setIsActivityModalOpen(true);
        }}
        onOpenNewCourse={() => setIsNewCourseOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onStartPresentation={() => setIsPresentationOpen(true)}
        onExportPPTX={() => handleExportPPTX(currentBook)}
        onExportPDF={handleExportPDF}
        isExporting={isExporting}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onRequestDeleteBook={() => handleRequestDeleteBook(currentBook)}
        syncStatus={syncStatus}
        syncMessage={syncMessage}
        onShareLink={handleShareLink}
      />

      {/* VIEW: HOME / DASHBOARD (100% INDIVIDUALIZADO POR POLO) */}
      {currentView === 'home' ? (
        <HomePage
          courses={courses}
          books={books}
          activities={activities}
          currentCampus={currentCampus}
          onSelectCampus={handleSelectCampus}
          onOpenBook={(courseId) => {
            setCurrentCourseId(courseId);
            setCurrentView('editor');
          }}
          onOpenNewActivity={(courseId, isShared) => {
            setEditingActivity(null);
            setActivityModalSharedMode(!!isShared);
            setDroppedImageForNewActivity(null);
            setIsActivityModalOpen(true);
          }}
          onOpenNewCourse={() => setIsNewCourseOpen(true)}
          onEditActivity={(act) => {
            setEditingActivity(act);
            setActivityModalSharedMode(act.isShared);
            setIsActivityModalOpen(true);
          }}
          onRequestDeleteActivity={handleRequestDeleteActivity}
          onRequestDeleteBook={handleRequestDeleteBook}
          onRequestDeleteCourse={handleRequestDeleteCourse}
          onRequestSyncActivity={handleRequestSyncActivity}
          onRequestSyncBook={handleRequestSyncBook}
          onDirectExportPPTX={(book) => handleExportPPTX(book)}
          onDropImageToNewActivity={(imgUrl) => {
            setEditingActivity(null);
            setDroppedImageForNewActivity(imgUrl);
            setIsActivityModalOpen(true);
          }}
          onUpdateCourseCover={handleUpdateCourseCover}
        />
      ) : (
        /* VIEW: POWERPOINT-STYLE BOOK EDITOR */
        <main className="flex-1 flex overflow-hidden">
          {/* Left Thumbnails Navigation */}
          <SlideThumbnails
            slides={currentBook.slides}
            activeSlideId={activeSlideId}
            onSelectSlide={setActiveSlideId}
            onAddSlide={() => setIsNewSlideOpen(true)}
            onDuplicateSlide={handleDuplicateSlide}
            onDeleteSlide={handleDeleteSlide}
            onMoveSlide={handleMoveSlide}
            onOpenSyncSlideModal={handleOpenSyncSlideModal}
          />

          {/* Center Interactive WYSIWYG Slide Stage */}
          {activeSlide && (
            <SlideCanvas
              book={currentBook}
              slide={activeSlide}
              slideIndex={currentBook.slides.findIndex((s) => s.id === activeSlide.id) + 1}
              totalSlides={currentBook.slides.length}
              onUpdateSlide={handleUpdateActiveSlide}
              onTriggerNewActivityModal={(droppedImage) => {
                setEditingActivity(null);
                setDroppedImageForNewActivity(droppedImage || null);
                setIsActivityModalOpen(true);
              }}
              onOpenSyncSlideModal={handleOpenSyncSlideModal}
              onSplitSlidePhotos={handleSplitSlidePhotos}
            />
          )}
        </main>
      )}

      {/* MODAL: NEW / EDIT ACTIVITY */}
      <NewActivityModal
        isOpen={isActivityModalOpen}
        onClose={() => {
          setIsActivityModalOpen(false);
          setEditingActivity(null);
          setDroppedImageForNewActivity(null);
        }}
        onSaveActivity={handleSaveActivity}
        courses={courses}
        initialCourseId={currentCourseId}
        currentCampus={currentCampus}
        isSharedMode={activityModalSharedMode}
        editingActivity={editingActivity}
        initialDroppedImage={droppedImageForNewActivity}
      />

      {/* MODAL: NEW SLIDE TEMPLATE */}
      <NewSlideModal
        isOpen={isNewSlideOpen}
        onClose={() => setIsNewSlideOpen(false)}
        onSelectTemplate={handleAddSlideFromTemplate}
        coordinator={currentBook?.coordinator || ''}
      />

      {/* MODAL: NEW COURSE */}
      <NewCourseModal
        isOpen={isNewCourseOpen}
        onClose={() => setIsNewCourseOpen(false)}
        onAddCourse={handleAddCourse}
        initialArea={currentBook?.academicArea}
        initialCampus={currentCampus}
      />

      {/* MODAL: BOOK SETTINGS & JSON BACKUP */}
      <BookSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        book={currentBook}
        onUpdateBook={handleUpdateBook}
        onResetBook={() => {
          pushHistorySnapshot();
          setBooks(createInitialBooks(courses, activities));
        }}
        onLoadBook={(newBook) => {
          pushHistorySnapshot();
          setBooks((prev) => prev.map((b) => (b.id === newBook.id ? newBook : b)));
        }}
        onRequestDeleteBook={() => handleRequestDeleteBook(currentBook)}
      />

      {/* MODAL: FULLSCREEN 16:9 PRESENTATION */}
      <PresentationModal
        isOpen={isPresentationOpen}
        onClose={() => setIsPresentationOpen(false)}
        book={currentBook}
        initialSlideIndex={
          currentBook?.slides.findIndex((s) => s.id === activeSlideId) >= 0
            ? currentBook.slides.findIndex((s) => s.id === activeSlideId)
            : 0
        }
      />

      {/* MODAL: EXCLUSÃO DE BOOK / CURSO COM CONFIRMAÇÃO REAL */}
      <DeleteConfirmModal
        isOpen={deleteConfirmState.isOpen}
        onClose={() => setDeleteConfirmState((prev) => ({ ...prev, isOpen: false }))}
        title={deleteConfirmState.title}
        itemName={deleteConfirmState.itemName}
        description={deleteConfirmState.description}
        warningNote={deleteConfirmState.warningNote}
        onConfirm={deleteConfirmState.onConfirm}
      />

      {/* MODAL: EXCLUSÃO DE ATIVIDADE SINCRONIZADA COM ESCOLHA DE ESCOPO */}
      <DeleteSyncedActivityModal
        isOpen={deleteSyncedState.isOpen}
        onClose={() => setDeleteSyncedState((prev) => ({ ...prev, isOpen: false }))}
        activity={deleteSyncedState.activity}
        currentCampus={currentCampus}
        onConfirm={deleteSyncedState.onConfirm}
      />

      {/* MODAL: SINCRONIZAÇÃO DE CONTEÚDO OU BOOK ENTRE AMBIENTES */}
      <SyncContentModal
        isOpen={syncModalState.isOpen}
        onClose={() => setSyncModalState((prev) => ({ ...prev, isOpen: false }))}
        title={syncModalState.title}
        sourceCampus={syncModalState.sourceCampus}
        targetCourses={syncModalState.targetCourses}
        initialSelectedCourseIds={syncModalState.initialSelectedCourseIds}
        onConfirmSync={syncModalState.onConfirmSync}
      />

      {/* MODAL: SINCRONIZAÇÃO DE SLIDE INDIVIDUAL COM OUTROS BOOKS (Requisito 4) */}
      <SyncSlideModal
        isOpen={syncSlideModalState.isOpen}
        onClose={() => setSyncSlideModalState({ isOpen: false, slide: null, sourceBook: null })}
        slide={syncSlideModalState.slide}
        sourceBook={syncSlideModalState.sourceBook}
        allBooks={books}
        onConfirmSync={handleConfirmSyncSlide}
      />

      {/* Toast de Notificação de Compartilhamento / Nuvem */}
      {shareToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#001D3D] text-white px-4 py-3 rounded-xl shadow-2xl border border-[#00A3E0] flex items-center gap-2.5 text-xs animate-in fade-in slide-in-from-bottom-3 duration-200">
          <Share2 className="w-4 h-4 text-[#00A3E0] shrink-0" />
          <span>{shareToast}</span>
        </div>
      )}
    </div>
  );
}
