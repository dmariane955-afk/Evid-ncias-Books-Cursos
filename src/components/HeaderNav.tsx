import React from 'react';
import { 
  Home, 
  Presentation, 
  Download, 
  Printer, 
  Undo2, 
  Redo2, 
  Plus, 
  Settings2,
  Trash2,
  ArrowLeftRight
} from 'lucide-react';
import { AcademicBook, CampusId, Course } from '../types';
import { CAMPUS_CONFIGS } from '../data/defaults';
import { EstacioLogo } from './EstacioLogo';

interface HeaderNavProps {
  book: AcademicBook;
  courses: Course[];
  currentCampus: CampusId;
  onSelectCampus: (campus: CampusId) => void;
  currentView: 'home' | 'editor';
  onGoHome: () => void;
  onSelectCourse: (courseId: string) => void;
  onUpdateBook: (updated: Partial<AcademicBook>) => void;
  onOpenNewActivity: () => void;
  onOpenNewCourse: () => void;
  onOpenSettings: () => void;
  onStartPresentation: () => void;
  onExportPPTX: () => void;
  onExportPDF: () => void;
  isExporting: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onRequestDeleteBook?: () => void;
}

export const HeaderNav: React.FC<HeaderNavProps> = ({
  book,
  courses,
  currentCampus,
  onSelectCampus,
  currentView,
  onGoHome,
  onSelectCourse,
  onUpdateBook,
  onOpenNewActivity,
  onOpenNewCourse,
  onOpenSettings,
  onStartPresentation,
  onExportPPTX,
  onExportPDF,
  isExporting,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onRequestDeleteBook,
}) => {
  const campusCourses = courses.filter((c) => c.campus === currentCampus);
  const otherCampusName = currentCampus === 'curitiba' ? 'FATEC' : 'Curitiba';

  return (
    <header className="no-print bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs select-none">
      {/* Top micro institutional accent */}
      <div className="h-1 bg-gradient-to-r from-[#004B8D] via-[#00A3E0] to-[#001D3D]" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex items-center justify-between gap-3">
        {/* Zone 1: Brand & Navigation */}
        <div className="flex items-center gap-3 shrink-0">
          <div 
            onClick={onGoHome}
            className="cursor-pointer flex items-center gap-2 hover:opacity-90 transition-opacity"
            title="Ir para a Página Inicial"
          >
            <EstacioLogo size="md" />
            <div className="border-l border-slate-200 pl-2 hidden sm:block">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-[#001D3D] tracking-tight">
                  Books Acadêmicos
                </span>
                {/* PROMINENT CAMPUS BADGE IN TOP BAR */}
                <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded text-white ${
                  currentCampus === 'curitiba' ? 'bg-[#004B8D]' : 'bg-[#001D3D]'
                }`}>
                  {currentCampus === 'curitiba' ? 'CURITIBA' : 'FATEC'}
                </span>
              </div>
            </div>
          </div>

          {/* Home / Editor Toggle Button */}
          <button
            onClick={onGoHome}
            className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg border transition-colors ${
              currentView === 'home'
                ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                : 'text-slate-700 hover:text-slate-900 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <Home className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Página Inicial</span>
          </button>
        </div>

        {/* Zone 2: Campus Switcher, Course Selector & Undo/Redo */}
        <div className="flex items-center gap-2">
          {/* Prominent Campus Switcher in Top Bar */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-300 text-xs font-bold">
            <button
              type="button"
              onClick={() => onSelectCampus('curitiba')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                currentCampus === 'curitiba'
                  ? 'bg-[#004B8D] text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Curitiba
            </button>
            <button
              type="button"
              onClick={() => onSelectCampus('fatec')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                currentCampus === 'fatec'
                  ? 'bg-[#001D3D] text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              FATEC
            </button>
          </div>

          {/* Course Selector for CURRENT campus */}
          <div className="relative">
            <select
              value={book?.courseId || ''}
              onChange={(e) => {
                if (e.target.value === '__NEW__') {
                  onOpenNewCourse();
                } else {
                  onSelectCourse(e.target.value);
                }
              }}
              className="appearance-none bg-slate-50 hover:bg-white border border-slate-300 text-xs font-bold text-slate-900 rounded-lg px-3 py-1.5 pr-7 max-w-[210px] truncate focus:outline-hidden focus:ring-2 focus:ring-[#00A3E0] cursor-pointer"
            >
              <optgroup label={`Cursos de ${currentCampus === 'curitiba' ? 'Curitiba' : 'FATEC'}:`}>
                {campusCourses.map((c) => (
                  <option key={c.id} value={c.id}>
                    Book: {c.name}
                  </option>
                ))}
              </optgroup>
              <option value="__NEW__">+ Cadastrar Novo Curso...</option>
            </select>
          </div>

          {/* Undo / Redo controls */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              disabled={!canUndo}
              onClick={onUndo}
              title="Desfazer (Ctrl+Z)"
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-md disabled:opacity-30 disabled:hover:bg-transparent transition-all"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              disabled={!canRedo}
              onClick={onRedo}
              title="Refazer (Ctrl+Shift+Z)"
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-md disabled:opacity-30 disabled:hover:bg-transparent transition-all"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Zone 3: Actions (+ Nova Atividade, Apresentar, Baixar PPTX, Baixar PDF) */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* + Nova atividade button */}
          <button
            onClick={onOpenNewActivity}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#004B8D] hover:bg-[#00386B] rounded-lg shadow-2xs transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5 text-[#00A3E0]" />
            <span className="hidden sm:inline">Nova Atividade</span>
            <span className="sm:hidden">Atividade</span>
          </button>

          {/* Presentation Fullscreen */}
          <button
            onClick={onStartPresentation}
            title="Apresentar em tela cheia (16:9)"
            className="hidden lg:inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Presentation className="w-3.5 h-3.5 text-[#004B8D]" />
            <span>Apresentar</span>
          </button>

          {/* Export PDF */}
          <button
            onClick={onExportPDF}
            title="Exportar Book em PDF paisagem 16:9"
            className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            <span>PDF</span>
          </button>

          {/* Download in PowerPoint (.pptx) */}
          <button
            onClick={onExportPPTX}
            disabled={isExporting}
            title="Baixar em PowerPoint (.pptx) Widescreen 16:9"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-extrabold text-white bg-[#001D3D] hover:bg-[#003264] border border-[#004B8D] rounded-lg shadow-xs transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-[#00A3E0]" />
            <span>{isExporting ? 'Gerando...' : 'Baixar em PowerPoint'}</span>
          </button>

          {/* Settings */}
          <button
            onClick={onOpenSettings}
            title="Configurações do Book"
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
