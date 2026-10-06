import React, { useState } from 'react';
import { 
  BookOpen, 
  Plus, 
  Share2, 
  Download, 
  UploadCloud, 
  Calendar, 
  Clock, 
  ChevronRight, 
  GraduationCap, 
  Cpu, 
  HeartPulse, 
  Scale, 
  TrendingUp, 
  Edit3, 
  Trash2,
  MoreVertical,
  Layers,
  ArrowLeftRight,
  ShieldCheck,
  Image as ImageIcon
} from 'lucide-react';
import { Course, AcademicBook, ActivityItem, CampusId, ActivityType } from '../types';
import { CAMPUS_CONFIGS, AREA_CONFIGS } from '../data/defaults';
import { EstacioLogo } from './EstacioLogo';
import { CourseCoverModal } from './CourseCoverModal';
import { getCourseCoverImage } from '../utils/courseCovers';

interface HomePageProps {
  courses: Course[];
  books: AcademicBook[];
  activities: ActivityItem[];
  currentCampus: CampusId;
  onSelectCampus: (campus: CampusId) => void;
  onOpenBook: (courseId: string) => void;
  onOpenNewActivity: (courseId?: string, isShared?: boolean) => void;
  onOpenNewCourse: () => void;
  onEditActivity: (activity: ActivityItem) => void;
  onRequestDeleteActivity: (activity: ActivityItem) => void;
  onRequestDeleteBook: (book: AcademicBook) => void;
  onRequestDeleteCourse: (course: Course) => void;
  onRequestSyncActivity: (activity: ActivityItem) => void;
  onRequestSyncBook: (book: AcademicBook) => void;
  onDirectExportPPTX: (book: AcademicBook) => void;
  onDropImageToNewActivity: (imageUrl: string) => void;
  onUpdateCourseCover: (courseId: string, newCoverUrl: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  courses,
  books,
  activities,
  currentCampus,
  onSelectCampus,
  onOpenBook,
  onOpenNewActivity,
  onOpenNewCourse,
  onEditActivity,
  onRequestDeleteActivity,
  onRequestDeleteBook,
  onRequestDeleteCourse,
  onRequestSyncActivity,
  onRequestSyncBook,
  onDirectExportPPTX,
  onDropImageToNewActivity,
  onUpdateCourseCover,
}) => {
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('todos');
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>('todos');
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [openBookMenuId, setOpenBookMenuId] = useState<string | null>(null);
  const [openActivityMenuId, setOpenActivityMenuId] = useState<string | null>(null);
  const [coverModalCourse, setCoverModalCourse] = useState<Course | null>(null);

  const otherCampus: CampusId = currentCampus === 'curitiba' ? 'fatec' : 'curitiba';
  const otherCampusName = currentCampus === 'curitiba' ? 'FATEC' : 'Curitiba';

  // Strictly filter courses by current campus
  const campusCourses = courses.filter((c) => c.campus === currentCampus);
  const campusCourseIds = campusCourses.map((c) => c.id);

  // Strictly filter books by current campus
  const campusBooks = books.filter((b) => b.campus === currentCampus);

  // Filter activities that belong to at least one course of the CURRENT campus
  const campusActivities = activities.filter((act) =>
    act.targetCourseIds.some((cId) => campusCourseIds.includes(cId))
  );

  const filteredActivities = campusActivities.filter((act) => {
    if (selectedTypeFilter !== 'todos' && act.activityType !== selectedTypeFilter) return false;
    if (selectedCourseFilter !== 'todos' && !act.targetCourseIds.includes(selectedCourseFilter)) return false;
    return true;
  });

  const getAreaIcon = (area: string) => {
    switch (area) {
      case 'exatas': return Cpu;
      case 'saude': return HeartPulse;
      case 'humanas': return Scale;
      case 'negocios': return TrendingUp;
      default: return GraduationCap;
    }
  };

  const getActivityTypeColor = (type: ActivityType) => {
    switch (type) {
      case 'Atividade de sustentabilidade':
        return 'text-emerald-700 bg-emerald-50 border-emerald-200';
      case 'Atividade de arrecadação':
        return 'text-amber-700 bg-amber-50 border-amber-200';
      case 'Atividade colaborativa interdisciplinar':
        return 'text-purple-700 bg-purple-50 border-purple-200';
      default:
        return 'text-[#004B8D] bg-sky-50 border-sky-200';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const url = event.target?.result as string;
        if (url) {
          onDropImageToNewActivity(url);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div 
      className="flex-1 overflow-y-auto bg-slate-100 p-4 sm:p-6 lg:p-8 space-y-7 max-w-7xl mx-auto w-full select-none"
      onClick={() => {
        setOpenBookMenuId(null);
        setOpenActivityMenuId(null);
      }}
    >
      {/* 1. TOP BAR / CAMPUS SELECTOR HERO BANNER (INDIVIDUALIZAÇÃO COMPLETA) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3">
            <EstacioLogo size="lg" />
            <div className="hidden sm:block h-6 w-px bg-slate-300" />
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-extrabold tracking-wider text-slate-500">
                Polo:
              </span>
              <div className="inline-flex items-center bg-slate-100 p-1 rounded-xl border border-slate-300">
                <button
                  type="button"
                  onClick={() => onSelectCampus('curitiba')}
                  className={`px-4 py-1.5 text-xs font-extrabold rounded-lg transition-all ${
                    currentCampus === 'curitiba'
                      ? 'bg-[#004B8D] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  CURITIBA
                </button>
                <button
                  type="button"
                  onClick={() => onSelectCampus('fatec')}
                  className={`px-4 py-1.5 text-xs font-extrabold rounded-lg transition-all ${
                    currentCampus === 'fatec'
                      ? 'bg-[#001D3D] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  FATEC
                </button>
              </div>
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#001D3D] tracking-tight">
            Painel do Campus {currentCampus === 'curitiba' ? 'Curitiba' : 'FATEC'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
            Ambiente 100% individualizado. Cursos e Books pertencem exclusivamente a este polo, com sincronização opcional e seletiva.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={() => onOpenNewActivity(undefined, false)}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-[#004B8D] hover:bg-[#00386B] active:bg-[#002B52] rounded-xl shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4 text-[#00A3E0]" />
            <span>+ Nova atividade</span>
          </button>

          <button
            onClick={() => onOpenNewActivity(undefined, true)}
            title="Criar atividade sincronizada com outros cursos ou com FATEC"
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-[#004B8D] bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-xl transition-colors"
          >
            <Share2 className="w-4 h-4 text-[#00A3E0]" />
            <span>+ Atividade Compartilhada</span>
          </button>

          <button
            onClick={onOpenNewCourse}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl transition-colors"
          >
            <GraduationCap className="w-4 h-4 text-slate-500" />
            <span>Novo Curso</span>
          </button>
        </div>
      </div>

      {/* 2. RAPID DRAG & DROP ZONE (INICIA CADASTRO IMEDIATO) */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDraggingOver(true);
        }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={handleDrop}
        onClick={() => onOpenNewActivity()}
        className={`rounded-2xl border-2 border-dashed p-6 sm:p-7 flex flex-col sm:flex-row items-center justify-center gap-4 text-center sm:text-left cursor-pointer transition-all ${
          isDraggingOver
            ? 'border-[#00A3E0] bg-sky-50 shadow-md scale-[0.99]'
            : 'border-slate-300 bg-white hover:border-[#00A3E0] hover:bg-slate-50/70 shadow-xs'
        }`}
      >
        <div className="w-12 h-12 rounded-xl bg-[#E0F2FE] text-[#004B8D] flex items-center justify-center shrink-0">
          <UploadCloud className="w-6 h-6 text-[#00A3E0]" />
        </div>
        <div>
          <span className="text-sm font-bold text-slate-800 block">
            Arraste uma foto aqui para iniciar o cadastro imediato de uma atividade
          </span>
          <span className="text-xs text-slate-500">
            Ou clique neste espaço para selecionar uma foto, definir data, horário e objetivo por IA.
          </span>
        </div>
      </div>

      {/* 3. SEÇÃO: CURSOS & RESPECTIVOS BOOKS (COM OPÇÕES ⋮ EXCLUIR E SINCRONIZAR) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>Cursos & Books — {currentCampus === 'curitiba' ? 'Curitiba' : 'FATEC'}</span>
              <span className="text-xs font-normal text-slate-400 font-mono">
                ({campusCourses.length} cadastrados)
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              Cada Book contém exclusivamente as atividades deste curso e campus
            </p>
          </div>

          <button
            onClick={onOpenNewCourse}
            className="text-xs font-bold text-[#004B8D] hover:underline flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Cadastrar Novo Curso</span>
          </button>
        </div>

        {campusCourses.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-xs text-slate-500 space-y-2">
            <p>Nenhum curso cadastrado no polo {currentCampus === 'curitiba' ? 'Curitiba' : 'FATEC'}.</p>
            <button
              onClick={onOpenNewCourse}
              className="text-[#004B8D] font-bold hover:underline"
            >
              + Cadastrar primeiro curso
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {campusCourses.map((course) => {
              const courseBook = campusBooks.find((b) => b.courseId === course.id);
              const courseActivitiesCount = campusActivities.filter((a) =>
                a.targetCourseIds.includes(course.id)
              ).length;
              const AreaIcon = getAreaIcon(course.academicArea);
              const isMenuOpen = openBookMenuId === course.id;
              const coverUrl = course.coverImage || courseBook?.coverImage || getCourseCoverImage(course.name, course.academicArea);
              const areaConfig = AREA_CONFIGS[course.academicArea];

              return (
                <div
                  key={course.id}
                  className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:border-[#00A3E0] hover:shadow-md transition-all flex flex-col justify-between relative group"
                >
                  {/* Capa Visual Personalizada do Curso */}
                  <div className="relative aspect-16/9 sm:h-44 w-full overflow-hidden bg-slate-900 shrink-0">
                    <img
                      src={coverUrl}
                      alt={`Capa de ${course.name}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />

                    {/* Gradient Overlay for Readability */}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#001D3D] via-[#001D3D]/50 to-transparent flex flex-col justify-between p-3.5">
                      {/* Top row: Estácio Logo Badge & 3-dots Menu */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="bg-white/95 backdrop-blur-xs px-2 py-0.5 rounded-md shadow-xs flex items-center">
                          <EstacioLogo size="sm" />
                        </div>

                        <div className="flex items-center gap-1.5 relative">
                          <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-black/60 text-white backdrop-blur-xs">
                            {course.period}
                          </span>

                          {/* ⋮ Three dots menu trigger */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenBookMenuId(isMenuOpen ? null : course.id);
                            }}
                            title="Mais opções do Book e Curso"
                            className="p-1.5 rounded-lg bg-black/40 hover:bg-black/70 text-white backdrop-blur-xs transition-colors"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {/* Dropdown Menu */}
                          {isMenuOpen && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="absolute right-0 top-8 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-40 text-xs animate-in fade-in zoom-in-95 duration-100"
                            >
                              <div className="px-3 py-1 font-bold text-slate-400 text-[10px] uppercase border-b border-slate-100">
                                Gerenciar: {course.name}
                              </div>

                              <button
                                onClick={() => {
                                  setOpenBookMenuId(null);
                                  setCoverModalCourse(course);
                                }}
                                className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors font-medium"
                              >
                                <ImageIcon className="w-3.5 h-3.5 text-[#00A3E0]" />
                                <span>Alterar Capa do Curso</span>
                              </button>

                              {courseBook && (
                                <button
                                  onClick={() => {
                                    setOpenBookMenuId(null);
                                    onRequestSyncBook(courseBook);
                                  }}
                                  className="w-full text-left px-3 py-2 text-slate-700 hover:bg-sky-50 hover:text-[#004B8D] flex items-center gap-2 transition-colors font-medium"
                                >
                                  <ArrowLeftRight className="w-3.5 h-3.5 text-[#00A3E0]" />
                                  <span>Sincronizar Book com {otherCampusName}</span>
                                </button>
                              )}

                              {courseBook && (
                                <button
                                  onClick={() => {
                                    setOpenBookMenuId(null);
                                    onDirectExportPPTX(courseBook);
                                  }}
                                  className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                                >
                                  <Download className="w-3.5 h-3.5 text-slate-500" />
                                  <span>Baixar Apresentação (.pptx)</span>
                                </button>
                              )}

                              <div className="border-t border-slate-100 my-1" />

                              {courseBook && (
                                <button
                                  onClick={() => {
                                    setOpenBookMenuId(null);
                                    onRequestDeleteBook(courseBook);
                                  }}
                                  className="w-full text-left px-3 py-2 text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors font-semibold"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                  <span>Excluir Book</span>
                                </button>
                              )}

                              <button
                                onClick={() => {
                                  setOpenBookMenuId(null);
                                  onRequestDeleteCourse(course);
                                }}
                                className="w-full text-left px-3 py-2 text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors font-semibold"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                <span>Excluir Curso</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Bottom row on cover: Area tag & Course Name */}
                      <div>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span 
                            className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full inline-flex items-center gap-1 shadow-2xs"
                            style={{ backgroundColor: areaConfig?.accentBg || '#E0F2FE', color: areaConfig?.color || '#004B8D' }}
                          >
                            <AreaIcon className="w-3 h-3" />
                            <span>{areaConfig?.label || 'Graduação'}</span>
                          </span>
                        </div>

                        <h3 className="text-base sm:text-lg font-extrabold text-white tracking-tight leading-snug drop-shadow-xs line-clamp-2">
                          {course.name}
                        </h3>
                      </div>
                    </div>
                  </div>

                  {/* Card Content Below Cover */}
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
                      <span className="font-semibold text-slate-700">
                        {courseActivitiesCount} {courseActivitiesCount === 1 ? 'atividade' : 'atividades'}
                      </span>
                      <span>·</span>
                      <span>{courseBook?.slides.length || 0} slides</span>
                      <span>·</span>
                      <button
                        type="button"
                        onClick={() => setCoverModalCourse(course)}
                        className="text-[#004B8D] hover:underline text-[11px] font-semibold flex items-center gap-1"
                        title="Trocar a foto de capa deste curso"
                      >
                        <ImageIcon className="w-3 h-3 text-[#00A3E0]" />
                        <span>Trocar Capa</span>
                      </button>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                      <button
                        onClick={() => onOpenBook(course.id)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-[#004B8D] hover:bg-[#00386B] rounded-lg transition-colors shadow-2xs"
                      >
                        <BookOpen className="w-3.5 h-3.5 text-[#00A3E0]" />
                        <span>Acessar Book</span>
                      </button>

                      {courseBook && (
                        <button
                          onClick={() => onDirectExportPPTX(courseBook)}
                          title="Baixar apresentação PowerPoint (.pptx) deste curso"
                          className="p-2 text-slate-600 hover:text-[#004B8D] hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors shrink-0"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRequestDeleteCourse(course);
                        }}
                        title={`Excluir curso "${course.name}" e seu Book`}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 border border-slate-200 hover:border-red-200 rounded-lg transition-colors shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 4. SEÇÃO: ATIVIDADES DESTE AMBIENTE (COM INDICAÇÃO CLARA DE SINCRONIZAÇÃO E OPÇÕES ⋮) */}
      <section className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>Atividades Cadastradas — {currentCampus === 'curitiba' ? 'Curitiba' : 'FATEC'}</span>
              <span className="text-xs font-normal text-slate-400 font-mono">
                ({filteredActivities.length})
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              Atividades deste polo com controle individualizado de sincronização
            </p>
          </div>

          {/* Filter options */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select
              value={selectedCourseFilter}
              onChange={(e) => setSelectedCourseFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-medium text-slate-700 focus:outline-hidden"
            >
              <option value="todos">Todos os Cursos de {currentCampus === 'curitiba' ? 'Curitiba' : 'FATEC'}</option>
              {campusCourses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <select
              value={selectedTypeFilter}
              onChange={(e) => setSelectedTypeFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-medium text-slate-700 focus:outline-hidden"
            >
              <option value="todos">Todos os Tipos</option>
              <option value="Atividade de sustentabilidade">Sustentabilidade</option>
              <option value="Atividade de arrecadação">Arrecadação</option>
              <option value="Atividade colaborativa interdisciplinar">Interdisciplinar</option>
              <option value="Atividade regular">Regular</option>
            </select>
          </div>
        </div>

        {/* Activities List */}
        {filteredActivities.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-xs text-slate-500 space-y-2">
            <p>Nenhuma atividade cadastrada neste ambiente para os filtros selecionados.</p>
            <button
              onClick={() => onOpenNewActivity()}
              className="text-[#004B8D] font-bold hover:underline"
            >
              + Cadastrar atividade em {currentCampus === 'curitiba' ? 'Curitiba' : 'FATEC'}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredActivities.map((act) => {
              const linkedCourses = courses.filter((c) => act.targetCourseIds.includes(c.id));
              const mainPhoto = act.photos[0];
              const isSyncedWithOtherCampus = act.syncedCampuses?.includes(otherCampus) || act.targetCourseIds.some((cId) => {
                const c = courses.find((course) => course.id === cId);
                return c?.campus === otherCampus;
              });
              const isActivityMenuOpen = openActivityMenuId === act.id;

              return (
                <div
                  key={act.id}
                  className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
                >
                  {/* Image thumbnail banner */}
                  <div className="relative aspect-16/9 bg-slate-100 overflow-hidden">
                    {mainPhoto ? (
                      <img
                        src={mainPhoto.url}
                        alt={act.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs font-medium">
                        Sem foto anexada
                      </div>
                    )}

                    <div className="absolute top-2 left-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md border shadow-2xs ${getActivityTypeColor(
                          act.activityType
                        )}`}
                      >
                        {act.activityType}
                      </span>
                    </div>

                    {/* Prominent Sync Badge as requested in rule 14: ↔ Sincronizado com FATEC / Curitiba */}
                    {isSyncedWithOtherCampus && (
                      <div className="absolute top-2 right-2 bg-[#001D3D] text-white text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shadow-2xs border border-[#00A3E0]/50">
                        <ArrowLeftRight className="w-3 h-3 text-[#00A3E0]" />
                        <span>↔ Sincronizado com {otherCampusName}</span>
                      </div>
                    )}
                  </div>

                  {/* Activity Details */}
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono mb-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-[#00A3E0]" />
                          {act.date}
                        </span>
                        {act.time && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-[#00A3E0]" />
                            {act.time}
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm font-bold text-slate-900 leading-snug">
                        {act.title}
                      </h3>

                      <p className="text-xs text-slate-600 line-clamp-2 mt-1.5 leading-relaxed">
                        {act.objective}
                      </p>
                    </div>

                    {/* Linked Courses Badges */}
                    <div className="pt-2 border-t border-slate-100">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                        Presente nos Books:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {linkedCourses.map((lc) => (
                          <span
                            key={lc.id}
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-sm ${
                              lc.campus === currentCampus
                                ? 'bg-slate-100 text-slate-700'
                                : 'bg-purple-50 text-purple-800 border border-purple-200'
                            }`}
                          >
                            {lc.name} ({lc.campus === 'curitiba' ? 'Curitiba' : 'FATEC'})
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Actions Footer with ⋮ menu */}
                  <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs relative">
                    <button
                      onClick={() => onEditActivity(act)}
                      className="inline-flex items-center gap-1 font-semibold text-slate-700 hover:text-[#004B8D]"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Editar</span>
                    </button>

                    {/* Manual Sync Button: ⋮ Sincronizar com outro ambiente */}
                    <button
                      onClick={() => onRequestSyncActivity(act)}
                      title={`Sincronizar esta atividade com ${otherCampusName}`}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-[#004B8D] hover:underline"
                    >
                      <ArrowLeftRight className="w-3 h-3" />
                      <span>{isSyncedWithOtherCampus ? 'Ajustar Sincronia' : `Sincronizar com ${otherCampusName}`}</span>
                    </button>

                    {/* Delete button with scope logic */}
                    <button
                      onClick={() => onRequestDeleteActivity(act)}
                      className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                      title="Excluir atividade"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Modal para Trocar/Personalizar Capa do Curso */}
      <CourseCoverModal
        isOpen={!!coverModalCourse}
        onClose={() => setCoverModalCourse(null)}
        course={coverModalCourse}
        onSaveCover={(courseId, newCoverUrl) => {
          onUpdateCourseCover(courseId, newCoverUrl);
        }}
      />
    </div>
  );
};
