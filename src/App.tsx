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
const STORAGE_DELETED_IDS_KEY = 'estacio_academic_deleted_ids_v1';
const STORAGE_LAST_OPEN_KEY = 'estacio_last_open_course_by_campus_v1';
const STORAGE_LAST_VIEW_KEY = 'estacio_last_open_view_by_campus_v1';

function getStoredDeletedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_DELETED_IDS_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch (e) {
    console.warn(e);
  }
  return new Set();
}

function recordDeletedId(id: string) {
  if (!id) return;
  try {
    const existing = getStoredDeletedIds();
    existing.add(id);
    const arr = Array.from(existing);
    if (arr.length > 500) arr.splice(0, arr.length - 500);
    localStorage.setItem(STORAGE_DELETED_IDS_KEY, JSON.stringify(arr));
  } catch (e) {
    console.warn(e);
  }
}

interface HistoryState {
  courses: Course[];
  activities: ActivityItem[];
  books: AcademicBook[];
  currentCourseId: string;
  currentCampus: CampusId;
}

export default function App() {
  // 1. Initial State from localStorage or defaults (strictly filtering out deleted items)
  const [courses, setCourses] = useState<Course[]>(() => {
    const deletedIds = getStoredDeletedIds();
    try {
      const saved = localStorage.getItem(STORAGE_COURSES_KEY) || localStorage.getItem('estacio_academic_courses_v4');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed
            .filter((c: Course) => !deletedIds.has(c.id))
            .map((c: Course) => ({
              ...c,
              coverImage: c.coverImage || getCourseCoverImage(c.name, c.academicArea),
            }));
        }
      }
    } catch (e) {
      console.warn(e);
    }
    return INITIAL_COURSES.filter((c) => !deletedIds.has(c.id));
  });

  const [activities, setActivities] = useState<ActivityItem[]>(() => {
    const deletedIds = getStoredDeletedIds();
    try {
      const saved = localStorage.getItem(STORAGE_ACTIVITIES_KEY) || localStorage.getItem('estacio_academic_activities_v4');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed.filter((a: ActivityItem) => !deletedIds.has(a.id));
      }
    } catch (e) {
      console.warn(e);
    }
    return INITIAL_ACTIVITIES.filter((a) => !deletedIds.has(a.id));
  });

  const [books, setBooks] = useState<AcademicBook[]>(() => {
    const deletedIds = getStoredDeletedIds();
    try {
      const saved = localStorage.getItem(STORAGE_BOOKS_KEY) || localStorage.getItem('estacio_academic_books_v4');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed
            .filter((b: AcademicBook) => !deletedIds.has(b.id) && !deletedIds.has(b.courseId) && !deletedIds.has(`book-${b.courseId}`))
            .map((b: AcademicBook) => {
              const capaSlide = b.slides?.find((s) => s.type === 'capa');
              const existingPhoto = capaSlide?.photos?.[0]?.url;
              const coverUrl = b.coverImage || existingPhoto || getCourseCoverImage(b.courseName, b.academicArea);
              const updatedSlides = (b.slides || [])
                .filter((s) => !deletedIds.has(s.id) && (!s.activityId || !deletedIds.has(s.activityId)))
                .map((s) => {
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
    return createInitialBooks(INITIAL_COURSES, INITIAL_ACTIVITIES).filter(
      (b) => !deletedIds.has(b.id) && !deletedIds.has(b.courseId) && !deletedIds.has(`book-${b.courseId}`)
    );
  });

  // Current View & Campus separation (Curitiba and FATEC are separated by default)
  // Track the last open book and last open view per campus
  const [lastOpenCourseByCampus, setLastOpenCourseByCampus] = useState<Record<CampusId, string | null>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_LAST_OPEN_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn(e);
    }
    return { curitiba: null, fatec: null };
  });

  const [lastOpenViewByCampus, setLastOpenViewByCampus] = useState<Record<CampusId, 'home' | 'editor'>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_LAST_VIEW_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn(e);
    }
    return { curitiba: 'home', fatec: 'home' };
  });

  // Current View & Campus separation (Curitiba and FATEC are separated by default)
  const [currentCampus, setCurrentCampus] = useState<CampusId>('curitiba');

  const [currentView, setCurrentView] = useState<'home' | 'editor'>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_LAST_VIEW_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.curitiba) return parsed.curitiba;
      }
    } catch (e) {
      console.warn(e);
    }
    return 'home';
  });

  const [currentCourseId, setCurrentCourseId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_LAST_OPEN_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.curitiba) return parsed.curitiba;
      }
    } catch (e) {
      console.warn(e);
    }
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

  // Helper to normalize book & course names (case-insensitive, trim, no accents)
  const normalizeBookName = (s: string) =>
    (s || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  // 3.1 Bidirectional Reconciliation: Guarantee every evidence slide in books has an active ActivityItem (respecting tombstones)
  useEffect(() => {
    const deletedIds = getStoredDeletedIds();
    setActivities((prevActs) => {
      const actMap = new Map(prevActs.map((a) => [a.id, a]));
      let hasChanges = false;
      const additions: ActivityItem[] = [];

      books.forEach((b) => {
        if (deletedIds.has(b.id) || deletedIds.has(b.courseId) || deletedIds.has(`book-${b.courseId}`)) return;

        (b.slides || []).forEach((slide) => {
          if (
            slide.type === 'evidencia' &&
            slide.activityId &&
            !deletedIds.has(slide.activityId) &&
            !deletedIds.has(slide.id)
          ) {
            const existingAct = actMap.get(slide.activityId);
            if (!existingAct) {
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
              actMap.set(slide.activityId, restoredAct);
              saveActivityToFirestore(restoredAct);
              hasChanges = true;
            } else {
              // Ensure existing activity contains this book's courseId and campus
              const needsCourse = !existingAct.targetCourseIds.includes(b.courseId);
              const needsCampus = !existingAct.syncedCampuses?.includes(b.campus);
              if (needsCourse || needsCampus) {
                const updatedCourseIds = Array.from(new Set([...existingAct.targetCourseIds, b.courseId]));
                const updatedCampuses = Array.from(new Set([...(existingAct.syncedCampuses || []), b.campus])) as CampusId[];
                const updatedAct: ActivityItem = {
                  ...existingAct,
                  targetCourseIds: updatedCourseIds,
                  syncedCampuses: updatedCampuses,
                  isShared: updatedCourseIds.length > 1,
                  updatedAt: new Date().toISOString(),
                };
                actMap.set(slide.activityId, updatedAct);
                saveActivityToFirestore(updatedAct);
                hasChanges = true;
              }
            }
          }
        });
      });

      if (hasChanges) {
        const nextList = Array.from(actMap.values());
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
  // Non-destructive smart sync strictly respecting deleted tombstones
  useEffect(() => {
    const unsub = initFirestoreSync(
      {
        onCoursesLoaded: (loadedCourses) => {
          if (loadedCourses) {
            const deletedIds = getStoredDeletedIds();
            const cleanCourses = loadedCourses.filter((c) => {
              if (deletedIds.has(c.id)) {
                deleteCourseFromFirestore(c.id);
                return false;
              }
              return true;
            });
            setCourses((prevCourses) => {
              const remoteIds = new Set(cleanCourses.map((c) => c.id));
              const localOnly = prevCourses.filter((c) => !remoteIds.has(c.id) && !deletedIds.has(c.id));
              const merged = [...cleanCourses, ...localOnly];
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
          if (loadedActivities) {
            const deletedIds = getStoredDeletedIds();
            const cleanActivities = loadedActivities.filter((a) => {
              if (deletedIds.has(a.id)) {
                deleteActivityFromFirestore(a.id);
                return false;
              }
              return true;
            });
            setActivities((prevActs) => {
              const remoteIds = new Set(cleanActivities.map((a) => a.id));
              const localOnly = prevActs.filter((a) => !remoteIds.has(a.id) && !deletedIds.has(a.id));
              const merged = [...cleanActivities, ...localOnly];
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
          if (loadedBooks) {
            const deletedIds = getStoredDeletedIds();
            const cleanBooks = loadedBooks
              .filter((b) => {
                if (deletedIds.has(b.id) || deletedIds.has(b.courseId) || deletedIds.has(`book-${b.courseId}`)) {
                  deleteBookFromFirestore(b.id);
                  deleteBookFromFirestore(`book-${b.courseId}`);
                  return false;
                }
                return true;
              })
              .map((b) => {
                const cleanSlides = (b.slides || []).filter(
                  (s) => !deletedIds.has(s.id) && (!s.activityId || !deletedIds.has(s.activityId))
                ).map((s) => {
                  if (s.type === 'sumario' && s.title === 'Sumário das Atividades') {
                    return { ...s, title: 'Sumário' };
                  }
                  return s;
                });
                const capaSlide = cleanSlides.find((s) => s.type === 'capa');
                const capaPhotoUrl = capaSlide?.photos?.[0]?.url;
                const effectiveCover = b.coverImage || capaPhotoUrl;
                return {
                  ...b,
                  coverImage: effectiveCover || b.coverImage,
                  slides: cleanSlides,
                };
              });

            setBooks((prevBooks) => {
              const remoteIds = new Set(cleanBooks.map((b) => b.id));
              const remoteCourseIds = new Set(cleanBooks.map((b) => b.courseId));
              const localOnly = prevBooks.filter(
                (b) => !remoteIds.has(b.id) && !remoteCourseIds.has(b.courseId) && !deletedIds.has(b.id) && !deletedIds.has(b.courseId)
              );
              const merged = [...cleanBooks, ...localOnly];
              try {
                localStorage.setItem(STORAGE_BOOKS_KEY, JSON.stringify(merged));
              } catch (e) {
                console.warn(e);
              }
              return merged;
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

  // Switch campus with memory & exact 4-rule matching
  const handleSelectCampus = useCallback((targetCampus: CampusId) => {
    if (targetCampus === currentCampus) return;

    // 1. If currently in editor, record the last open book and editor view for the current campus
    const activeCourseId = currentBook?.courseId || currentCourseId;
    if (currentView === 'editor' && activeCourseId) {
      setLastOpenCourseByCampus((prev) => {
        const up = { ...prev, [currentCampus]: activeCourseId };
        try { localStorage.setItem(STORAGE_LAST_OPEN_KEY, JSON.stringify(up)); } catch (e) { console.warn(e); }
        return up;
      });
      setLastOpenViewByCampus((prev) => {
        const up = { ...prev, [currentCampus]: 'editor' as const };
        try { localStorage.setItem(STORAGE_LAST_VIEW_KEY, JSON.stringify(up)); } catch (e) { console.warn(e); }
        return up;
      });
    }

    const targetCampusCourses = courses.filter((c) => c.campus === targetCampus);

    // Rule 1: If currently in editor with an open book, check if target campus has a book with the SAME NAME
    if (currentView === 'editor' && currentBook) {
      const currentNormalizedName = normalizeBookName(currentBook.courseName);
      
      const matchingBookInTarget = books.find(
        (b) => b.campus === targetCampus && normalizeBookName(b.courseName) === currentNormalizedName
      );
      const matchingCourseInTarget = targetCampusCourses.find(
        (c) => normalizeBookName(c.name) === currentNormalizedName
      );
      const sameNameCourseId = matchingBookInTarget?.courseId || matchingCourseInTarget?.id;

      if (sameNameCourseId) {
        // MATCH: Keep editor open on the matching book in target unit
        setCurrentCampus(targetCampus);
        setCurrentCourseId(sameNameCourseId);
        setCurrentView('editor');

        setLastOpenCourseByCampus((prev) => {
          const up = { ...prev, [targetCampus]: sameNameCourseId };
          try { localStorage.setItem(STORAGE_LAST_OPEN_KEY, JSON.stringify(up)); } catch (e) { console.warn(e); }
          return up;
        });
        setLastOpenViewByCampus((prev) => {
          const up = { ...prev, [targetCampus]: 'editor' as const };
          try { localStorage.setItem(STORAGE_LAST_VIEW_KEY, JSON.stringify(up)); } catch (e) { console.warn(e); }
          return up;
        });
        return;
      } else {
        // NO MATCH: User requirement: "caso não tenha o book com mesmo nome cadastrado em ambas unidades, o app deve levr para a pgina inicial da unidade trocada"
        setCurrentCampus(targetCampus);
        setCurrentView('home');
        if (targetCampusCourses.length > 0) {
          setCurrentCourseId(targetCampusCourses[0].id);
        }
        setLastOpenViewByCampus((prev) => {
          const up = { ...prev, [targetCampus]: 'home' as const };
          try { localStorage.setItem(STORAGE_LAST_VIEW_KEY, JSON.stringify(up)); } catch (e) { console.warn(e); }
          return up;
        });
        return;
      }
    }

    // Rule 2: User is switching to target campus from home:
    // User requirement: "e ao retornar para a outra unidade o ultimo book aberto deve se manter aberto"
    const lastTargetCourseId = lastOpenCourseByCampus[targetCampus];
    const targetHasValidLastBook = lastTargetCourseId && targetCampusCourses.some((c) => c.id === lastTargetCourseId);

    if (targetHasValidLastBook && lastOpenViewByCampus[targetCampus] === 'editor') {
      // Return to last open book in target campus in editor
      setCurrentCampus(targetCampus);
      setCurrentCourseId(lastTargetCourseId!);
      setCurrentView('editor');
      return;
    }

    // Otherwise, stay in home for target campus
    setCurrentCampus(targetCampus);
    setCurrentView('home');
    if (targetCampusCourses.length > 0) {
      setCurrentCourseId(lastTargetCourseId || targetCampusCourses[0].id);
    }
  }, [currentCampus, currentView, currentBook, currentCourseId, courses, books, lastOpenCourseByCampus, lastOpenViewByCampus]);

  // Handle explicit opening of a book: switches view to editor and records memory for current campus
  const handleOpenBook = useCallback((courseId: string) => {
    setCurrentCourseId(courseId);
    setCurrentView('editor');
    setLastOpenCourseByCampus((prev) => {
      const up = { ...prev, [currentCampus]: courseId };
      try {
        localStorage.setItem(STORAGE_LAST_OPEN_KEY, JSON.stringify(up));
      } catch (e) {
        console.warn(e);
      }
      return up;
    });
    setLastOpenViewByCampus((prev) => {
      const up = { ...prev, [currentCampus]: 'editor' as const };
      try {
        localStorage.setItem(STORAGE_LAST_VIEW_KEY, JSON.stringify(up));
      } catch (e) {
        console.warn(e);
      }
      return up;
    });
  }, [currentCampus]);

  // Handle explicit navigation to Home: records memory for current campus
  const handleGoHome = useCallback(() => {
    setCurrentView('home');
    setLastOpenViewByCampus((prev) => {
      const up = { ...prev, [currentCampus]: 'home' as const };
      try {
        localStorage.setItem(STORAGE_LAST_VIEW_KEY, JSON.stringify(up));
      } catch (e) {
        console.warn(e);
      }
      return up;
    });
  }, [currentCampus]);

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
          targetBookIds.has(b.courseId) ||
          (safeActivity.targetCourseIds || []).includes(b.courseId) ||
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
      description: `Esta ação removerá definitivamente o Book e o curso ${book.courseName} (${book.campus === 'curitiba' ? 'Curitiba' : 'FATEC'}) da plataforma e do banco de dados.`,
      warningNote: 'Conteúdos compartilhados que também estão vinculados a outros Books continuarão preservados nos respectivos ambientes.',
      onConfirm: () => {
        pushHistorySnapshot();
        const bookId = book.id;
        const courseId = book.courseId;

        // 1. Record tombstones so it can NEVER be resurrected
        recordDeletedId(bookId);
        recordDeletedId(`book-${courseId}`);
        recordDeletedId(courseId);

        // 2. Remove book from books state & localStorage
        setBooks((prevBooks) => {
          const remaining = prevBooks.filter((b) => b.id !== bookId && b.courseId !== courseId);
          try {
            localStorage.setItem(STORAGE_BOOKS_KEY, JSON.stringify(remaining));
          } catch (e) {
            console.warn(e);
          }
          return remaining;
        });

        // 3. Remove course from courses state & localStorage
        setCourses((prevCourses) => {
          const remaining = prevCourses.filter((c) => c.id !== courseId);
          try {
            localStorage.setItem(STORAGE_COURSES_KEY, JSON.stringify(remaining));
          } catch (e) {
            console.warn(e);
          }
          return remaining;
        });

        // 4. Delete permanently in Firestore
        deleteBookFromFirestore(bookId);
        deleteBookFromFirestore(`book-${courseId}`);
        deleteCourseFromFirestore(courseId);

        // 5. Update activities: remove this courseId from targetCourseIds
        setActivities((prevActs) => {
          const updated = prevActs
            .map((act) => ({
              ...act,
              targetCourseIds: act.targetCourseIds.filter((cId) => cId !== courseId),
            }))
            .filter((act) => act.targetCourseIds.length > 0);

          try {
            localStorage.setItem(STORAGE_ACTIVITIES_KEY, JSON.stringify(updated));
          } catch (e) {
            console.warn(e);
          }
          return updated;
        });

        // 6. Navigation safely
        setCourses((current) => {
          const remaining = current.filter((c) => c.id !== courseId);
          if (currentCourseId === courseId) {
            const nextCourse = remaining.find((c) => c.campus === currentCampus) || remaining[0];
            if (nextCourse) {
              setCurrentCourseId(nextCourse.id);
            } else {
              setCurrentView('home');
            }
          }
          return remaining;
        });

        if (lastOpenCourseByCampus[book.campus] === courseId) {
          setLastOpenCourseByCampus((prev) => {
            const up = { ...prev, [book.campus]: null };
            try { localStorage.setItem(STORAGE_LAST_OPEN_KEY, JSON.stringify(up)); } catch (e) { console.warn(e); }
            return up;
          });
          setLastOpenViewByCampus((prev) => {
            const up = { ...prev, [book.campus]: 'home' as const };
            try { localStorage.setItem(STORAGE_LAST_VIEW_KEY, JSON.stringify(up)); } catch (e) { console.warn(e); }
            return up;
          });
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
      warningNote: 'A exclusão é definitiva e sincronizada em tempo real para todos os usuários.',
      onConfirm: () => {
        pushHistorySnapshot();
        const courseId = course.id;

        // 1. Record tombstones
        recordDeletedId(courseId);
        recordDeletedId(`book-${courseId}`);

        // 2. Remove course locally and in Firestore
        setCourses((prevCourses) => {
          const remaining = prevCourses.filter((c) => c.id !== courseId);
          try {
            localStorage.setItem(STORAGE_COURSES_KEY, JSON.stringify(remaining));
          } catch (e) {
            console.warn(e);
          }
          return remaining;
        });
        deleteCourseFromFirestore(courseId);

        // 3. Remove course books locally and in Firestore
        setBooks((prevBooks) => {
          const booksToDelete = prevBooks.filter((b) => b.courseId === courseId || b.id === `book-${courseId}`);
          booksToDelete.forEach((b) => {
            recordDeletedId(b.id);
            deleteBookFromFirestore(b.id);
          });
          deleteBookFromFirestore(`book-${courseId}`);

          const remaining = prevBooks.filter((b) => b.courseId !== courseId && b.id !== `book-${courseId}`);
          try {
            localStorage.setItem(STORAGE_BOOKS_KEY, JSON.stringify(remaining));
          } catch (e) {
            console.warn(e);
          }
          return remaining;
        });

        // 4. Remove from activities and sync with Firestore
        setActivities((prevActs) => {
          const updated = prevActs
            .map((act) => {
              const remainingTargets = act.targetCourseIds.filter((cId) => cId !== courseId);
              const updatedAct = {
                ...act,
                targetCourseIds: remainingTargets,
                isShared: remainingTargets.length > 1,
              };
              if (remainingTargets.length === 0) {
                recordDeletedId(act.id);
                deleteActivityFromFirestore(act.id);
              } else {
                saveActivityToFirestore(updatedAct);
              }
              return updatedAct;
            })
            .filter((act) => act.targetCourseIds.length > 0);

          try {
            localStorage.setItem(STORAGE_ACTIVITIES_KEY, JSON.stringify(updated));
          } catch (e) {
            console.warn(e);
          }
          return updated;
        });

        // 5. Navigation
        setCourses((current) => {
          const remaining = current.filter((c) => c.id !== courseId);
          if (currentCourseId === courseId) {
            const nextCourse = remaining.find((c) => c.campus === currentCampus) || remaining[0];
            if (nextCourse) {
              setCurrentCourseId(nextCourse.id);
            } else {
              setCurrentView('home');
            }
          }
          return remaining;
        });

        if (lastOpenCourseByCampus[course.campus] === courseId) {
          setLastOpenCourseByCampus((prev) => {
            const up = { ...prev, [course.campus]: null };
            try { localStorage.setItem(STORAGE_LAST_OPEN_KEY, JSON.stringify(up)); } catch (e) { console.warn(e); }
            return up;
          });
          setLastOpenViewByCampus((prev) => {
            const up = { ...prev, [course.campus]: 'home' as const };
            try { localStorage.setItem(STORAGE_LAST_VIEW_KEY, JSON.stringify(up)); } catch (e) { console.warn(e); }
            return up;
          });
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

    const performFullDelete = () => {
      pushHistorySnapshot();
      recordDeletedId(activity.id);

      // 1. Delete from activities state & localStorage
      setActivities((prev) => {
        const remaining = prev.filter((a) => a.id !== activity.id);
        try {
          localStorage.setItem(STORAGE_ACTIVITIES_KEY, JSON.stringify(remaining));
        } catch (e) {
          console.warn(e);
        }
        return remaining;
      });

      // 2. Delete from Firestore
      deleteActivityFromFirestore(activity.id);

      // 3. Remove slide from all books, update state, localStorage, and Firestore
      setBooks((prevBooks) => {
        const updatedBooks = prevBooks.map((b) => {
          const hasSlide = (b.slides || []).some((s) => s.activityId === activity.id);
          if (!hasSlide) return b;

          const newSlides = b.slides
            .filter((s) => s.activityId !== activity.id)
            .map((s, idx) => ({ ...s, order: idx + 1 }));

          const updatedB = { ...b, slides: newSlides, updatedAt: new Date().toISOString() };
          saveBookToFirestore(updatedB);
          return updatedB;
        });

        try {
          localStorage.setItem(STORAGE_BOOKS_KEY, JSON.stringify(updatedBooks));
        } catch (e) {
          console.warn(e);
        }
        return updatedBooks;
      });
    };

    if (campusesInvolved.size > 1) {
      // Synced between Curitiba and FATEC: ask scope!
      setDeleteSyncedState({
        isOpen: true,
        activity,
        onConfirm: (scope) => {
          if (scope === 'current') {
            pushHistorySnapshot();
            // Remove only courses of current campus from targetCourseIds
            const remainingTargetIds = activity.targetCourseIds.filter((cId) => {
              const c = courses.find((course) => course.id === cId);
              return c?.campus !== currentCampus;
            });

            if (remainingTargetIds.length === 0) {
              performFullDelete();
              return;
            }

            const updatedAct: ActivityItem = {
              ...activity,
              targetCourseIds: remainingTargetIds,
              syncedCampuses: [otherCampus],
              isShared: remainingTargetIds.length > 1,
              updatedAt: new Date().toISOString(),
            };

            setActivities((prev) => {
              const updated = prev.map((act) => (act.id === activity.id ? updatedAct : act));
              try {
                localStorage.setItem(STORAGE_ACTIVITIES_KEY, JSON.stringify(updated));
              } catch (e) {
                console.warn(e);
              }
              return updated;
            });
            saveActivityToFirestore(updatedAct);

            // Remove slides from current campus books & save to Firestore
            setBooks((prevBooks) => {
              const updatedBooks = prevBooks.map((b) => {
                if (b.campus !== currentCampus) return b;
                const newSlides = b.slides
                  .filter((s) => s.activityId !== activity.id)
                  .map((s, idx) => ({ ...s, order: idx + 1 }));
                const updatedB = { ...b, slides: newSlides, updatedAt: new Date().toISOString() };
                saveBookToFirestore(updatedB);
                return updatedB;
              });

              try {
                localStorage.setItem(STORAGE_BOOKS_KEY, JSON.stringify(updatedBooks));
              } catch (e) {
                console.warn(e);
              }
              return updatedBooks;
            });
          } else {
            performFullDelete();
          }
        },
      });
    } else {
      // Activity is only in one campus: standard delete confirm
      setDeleteConfirmState({
        isOpen: true,
        title: 'Excluir Atividade?',
        itemName: activity.title,
        description: 'Esta ação removerá permanentemente esta atividade do Book e do banco de dados.',
        onConfirm: performFullDelete,
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
        const bookActivities = activities.filter(
          (act) => act.targetCourseIds.includes(book.courseId) || act.bookId === book.id
        );

        // For each activity, link the selected courses and persist to Firestore & localStorage
        const updatedActivities = activities.map((act) => {
          if (!act.targetCourseIds.includes(book.courseId) && act.bookId !== book.id) return act;
          const merged = Array.from(new Set([...act.targetCourseIds, ...selectedIds, book.courseId]));
          const updatedAct: ActivityItem = {
            ...act,
            targetCourseIds: merged,
            syncedCampuses: ['curitiba', 'fatec'] as CampusId[],
            isShared: true,
            updatedAt: new Date().toISOString(),
          };
          saveActivityToFirestore(updatedAct);
          return updatedAct;
        });

        setActivities(updatedActivities);
        try {
          localStorage.setItem(STORAGE_ACTIVITIES_KEY, JSON.stringify(updatedActivities));
        } catch (e) {
          console.warn('LocalStorage error:', e);
        }

        // Update books to include slides and save to Firestore & localStorage
        setBooks((prevBooks) => {
          const updatedBooks = prevBooks.map((b) => {
            if (!selectedIds.includes(b.courseId) && !selectedIds.includes(b.id)) return b;
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
                    pedagogicalImpact: act.complementaryText || '',
                  },
                });
              }
            });
            const updatedB = {
              ...b,
              slides: newSlides.map((s, idx) => ({ ...s, order: idx + 1 })),
              updatedAt: new Date().toISOString(),
            };
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

    // Identify target courses and campuses for all selected destination books
    const targetCoursesToAdd: string[] = [currentBook.courseId];
    const targetCampusesToAdd: CampusId[] = [currentBook.campus];

    allSelectedIds.forEach((bId) => {
      const b = books.find((bk) => bk.id === bId || bk.courseId === bId || `book-${bk.courseId}` === bId);
      if (b) {
        targetCoursesToAdd.push(b.courseId);
        targetCampusesToAdd.push(b.campus);
      }
    });

    // 1. If this slide is linked to an activity, update the activity so it is linked to all target courses & campuses
    if (targetSlide.activityId) {
      setActivities((prevActs) => {
        const nextActs = prevActs.map((act) => {
          if (act.id !== targetSlide.activityId) return act;
          const mergedCourseIds = Array.from(new Set([...act.targetCourseIds, ...targetCoursesToAdd]));
          const mergedCampuses = Array.from(new Set([...(act.syncedCampuses || []), ...targetCampusesToAdd])) as CampusId[];
          const updatedAct: ActivityItem = {
            ...act,
            targetCourseIds: mergedCourseIds,
            syncedCampuses: mergedCampuses,
            isShared: mergedCourseIds.length > 1,
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

    // 2. Update all destination books in books state, localStorage, and Firestore
    setBooks((prevBooks) => {
      const updatedList = prevBooks.map((b) => {
        if (b.id === currentBook.id) {
          const upCurrent: AcademicBook = {
            ...b,
            slides: b.slides.map((s) => (s.id === slideId ? updatedCurrentSlide : s)),
            updatedAt: new Date().toISOString(),
          };
          saveBookToFirestore(upCurrent);
          return upCurrent;
        }

        const isTargeted =
          allSelectedIds.includes(b.id) ||
          allSelectedIds.includes(b.courseId) ||
          allSelectedIds.includes(`book-${b.courseId}`);

        const existingSlideIndex = b.slides.findIndex(
          (s) => (s.syncGroupId && s.syncGroupId === syncKey) || (s.activityId && s.activityId === syncKey)
        );

        if (isTargeted) {
          // Add or update the slide in this destination book
          const destinationSlide: SlideData = {
            ...targetSlide,
            id: existingSlideIndex !== -1 ? b.slides[existingSlideIndex].id : `slide-sync-${b.id}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
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

      try {
        localStorage.setItem(STORAGE_BOOKS_KEY, JSON.stringify(updatedList));
      } catch (e) {
        console.warn('LocalStorage error:', e);
      }
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
          title: 'Sumário',
          subtitle: 'Estrutura e índice analítico do período acadêmico',
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
            title: 'Sumário',
            subtitle: 'Estrutura e índice analítico do período acadêmico',
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
    setCurrentView('editor');

    try {
      localStorage.setItem(STORAGE_COURSES_KEY, JSON.stringify(updatedCourses));
      localStorage.setItem(STORAGE_BOOKS_KEY, JSON.stringify(updatedBooks));
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }

    setLastOpenCourseByCampus((prev) => {
      const up = { ...prev, [campus]: courseId };
      try { localStorage.setItem(STORAGE_LAST_OPEN_KEY, JSON.stringify(up)); } catch (e) { console.warn(e); }
      return up;
    });
    setLastOpenViewByCampus((prev) => {
      const up = { ...prev, [campus]: 'editor' as const };
      try { localStorage.setItem(STORAGE_LAST_VIEW_KEY, JSON.stringify(up)); } catch (e) { console.warn(e); }
      return up;
    });

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
    const targetSlide = currentBook.slides.find((s) => s.id === slideId);

    setDeleteConfirmState({
      isOpen: true,
      title: 'Excluir slide?',
      itemName: targetSlide?.title || activeSlide?.title || 'Slide selecionado',
      description: 'Deseja excluir este slide do Book de Evidências?',
      warningNote: 'A exclusão é salva permanentemente no banco de dados em tempo real.',
      onConfirm: () => {
        pushHistorySnapshot();
        recordDeletedId(slideId);

        const updated = currentBook.slides
          .filter((s) => s.id !== slideId)
          .map((s, idx) => ({ ...s, order: idx + 1 }));

        const updatedBook: AcademicBook = {
          ...currentBook,
          slides: updated,
          updatedAt: new Date().toISOString(),
        };
        persistBookUpdate(updatedBook, true);

        // If it was an evidence slide, clean up associated activity ONLY if not used by ANY other book
        if (targetSlide?.activityId) {
          const actId = targetSlide.activityId;
          const isStillUsedInCurrentBook = updated.some((s) => s.activityId === actId);
          const isStillUsedInOtherBooks = books.some(
            (b) => b.id !== currentBook.id && (b.slides || []).some((s) => s.activityId === actId)
          );

          if (!isStillUsedInCurrentBook && !isStillUsedInOtherBooks) {
            recordDeletedId(actId);
            setActivities((prev) => {
              const remaining = prev.filter((a) => a.id !== actId);
              try {
                localStorage.setItem(STORAGE_ACTIVITIES_KEY, JSON.stringify(remaining));
              } catch (e) {
                console.warn(e);
              }
              return remaining;
            });
            deleteActivityFromFirestore(actId);
          } else if (!isStillUsedInCurrentBook && isStillUsedInOtherBooks) {
            // Activity is still used in other books: unlink current course and save
            setActivities((prev) => {
              const updatedActs = prev.map((a) => {
                if (a.id !== actId) return a;
                const remainingTargets = (a.targetCourseIds || []).filter((cId) => cId !== currentBook.courseId);
                const updatedAct = {
                  ...a,
                  targetCourseIds: remainingTargets,
                  isShared: remainingTargets.length > 1,
                  updatedAt: new Date().toISOString(),
                };
                saveActivityToFirestore(updatedAct);
                return updatedAct;
              });
              try {
                localStorage.setItem(STORAGE_ACTIVITIES_KEY, JSON.stringify(updatedActs));
              } catch (e) {
                console.warn(e);
              }
              return updatedActs;
            });
          }
        }

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
        onGoHome={handleGoHome}
        onSelectCourse={handleOpenBook}
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
          onOpenBook={handleOpenBook}
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
              onSelectSlide={setActiveSlideId}
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
