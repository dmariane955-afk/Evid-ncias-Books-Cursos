import React, { useState } from 'react';
import { X, GraduationCap, Plus, Share2, Image as ImageIcon, UploadCloud, Check } from 'lucide-react';
import { AcademicArea, CampusId } from '../types';
import { COURSE_COVER_LIBRARY, getCourseCoverImage } from '../utils/courseCovers';
import { EstacioLogo } from './EstacioLogo';
import { AREA_CONFIGS } from '../data/defaults';

interface NewCourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddCourse: (
    name: string, 
    area: AcademicArea, 
    campus: CampusId, 
    syncWithOtherCampus: boolean,
    coverImage?: string
  ) => void;
  initialArea?: AcademicArea;
  initialCampus?: CampusId;
}

export const NewCourseModal: React.FC<NewCourseModalProps> = ({
  isOpen,
  onClose,
  onAddCourse,
  initialArea = 'exatas',
  initialCampus = 'curitiba',
}) => {
  const [courseName, setCourseName] = useState('');
  const [area, setArea] = useState<AcademicArea>(initialArea);
  const [campus, setCampus] = useState<CampusId>(initialCampus);
  const [syncWithOtherCampus, setSyncWithOtherCampus] = useState(false);
  const [customCoverUrl, setCustomCoverUrl] = useState<string | null>(null);
  const [showGallery, setShowGallery] = useState(false);

  if (!isOpen) return null;

  const autoCover = getCourseCoverImage(courseName, area);
  const activeCover = customCoverUrl || autoCover;
  const areaConfig = AREA_CONFIGS[area];

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result) {
        setCustomCoverUrl(result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseName.trim()) return;
    onAddCourse(courseName.trim(), area, campus, syncWithOtherCampus, activeCover);
    setCourseName('');
    setCustomCoverUrl(null);
    setSyncWithOtherCampus(false);
    setShowGallery(false);
    onClose();
  };

  const otherCampusName = campus === 'curitiba' ? 'FATEC' : 'Curitiba';

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#E0F2FE] text-[#004B8D]">
              <GraduationCap className="w-5 h-5 text-[#00A3E0]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Cadastrar Novo Curso
              </h3>
              <p className="text-xs text-slate-500">
                Criação de curso com capa personalizada e ambiente seletivo
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Nome do Curso / Habilitação:
            </label>
            <input
              type="text"
              required
              autoFocus
              value={courseName}
              onChange={(e) => setCourseName(e.target.value)}
              placeholder="Ex: Engenharia Civil, Enfermagem, Administração..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#00A3E0]"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Ambiente de Origem:
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <label
                className={`p-2.5 rounded-lg border flex items-center gap-2 cursor-pointer transition-all ${
                  campus === 'curitiba'
                    ? 'border-[#00A3E0] bg-sky-50/50 font-bold text-[#004B8D]'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="campus_select"
                  checked={campus === 'curitiba'}
                  onChange={() => setCampus('curitiba')}
                  className="text-[#004B8D] focus:ring-[#00A3E0]"
                />
                <span>Curitiba</span>
              </label>

              <label
                className={`p-2.5 rounded-lg border flex items-center gap-2 cursor-pointer transition-all ${
                  campus === 'fatec'
                    ? 'border-[#00A3E0] bg-sky-50/50 font-bold text-[#004B8D]'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="campus_select"
                  checked={campus === 'fatec'}
                  onChange={() => setCampus('fatec')}
                  className="text-[#004B8D] focus:ring-[#00A3E0]"
                />
                <span>FATEC</span>
              </label>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Grande Área Acadêmica:
            </label>
            <select
              value={area}
              onChange={(e) => setArea(e.target.value as AcademicArea)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#00A3E0] bg-white font-medium"
            >
              <option value="exatas">Ciências Exatas & Tecnologia</option>
              <option value="saude">Ciências da Saúde & Biológicas</option>
              <option value="humanas">Ciências Humanas & Sociais</option>
              <option value="negocios">Negócios, Gestão & Comunicação</option>
            </select>
          </div>

          {/* Pré-visualização da Capa do Curso */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-[#00A3E0]" />
                <span>Capa Visual Coerente com o Curso:</span>
              </label>
              <button
                type="button"
                onClick={() => setShowGallery(!showGallery)}
                className="text-[11px] font-bold text-[#004B8D] hover:underline"
              >
                {showGallery ? 'Ocultar galeria' : 'Escolher outra imagem'}
              </button>
            </div>

            <div className="relative rounded-xl overflow-hidden border border-slate-300 aspect-16/9 h-36 bg-slate-900 shadow-xs">
              <img
                src={activeCover}
                alt="Capa do curso"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#001D3D]/95 via-[#001D3D]/40 to-transparent flex flex-col justify-between p-3">
                <div className="flex items-center justify-between">
                  <div className="bg-white/95 px-2 py-0.5 rounded shadow-2xs">
                    <EstacioLogo size="sm" />
                  </div>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-black/60 text-white">
                    2026.1
                  </span>
                </div>
                <div>
                  <span
                    className="inline-block px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider mb-0.5"
                    style={{ backgroundColor: areaConfig?.accentBg || '#E0F2FE', color: areaConfig?.color || '#004B8D' }}
                  >
                    {areaConfig?.label || 'Graduação'}
                  </span>
                  <h4 className="text-sm font-bold text-white drop-shadow-xs line-clamp-1">
                    {courseName.trim() || 'Nome do Curso'}
                  </h4>
                </div>
              </div>
            </div>

            {/* Galeria Opcional */}
            {showGallery && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700">Selecione uma imagem equivalente:</span>
                  <label className="cursor-pointer text-[11px] font-bold text-[#004B8D] hover:underline flex items-center gap-1">
                    <UploadCloud className="w-3.5 h-3.5 text-[#00A3E0]" />
                    <span>Upload Próprio</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
                      }}
                    />
                  </label>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {COURSE_COVER_LIBRARY.map((item) => {
                    const isSelected = activeCover === item.url;
                    return (
                      <div
                        key={item.id}
                        onClick={() => setCustomCoverUrl(item.url)}
                        className={`group relative rounded-lg overflow-hidden border cursor-pointer aspect-16/9 bg-slate-200 ${
                          isSelected ? 'border-[#00A3E0] ring-2 ring-[#00A3E0]' : 'border-slate-300'
                        }`}
                      >
                        <img src={item.url} alt={item.title} className="w-full h-full object-cover" />
                        {isSelected && (
                          <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#00A3E0] text-white flex items-center justify-center">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </div>
                        )}
                        <span className="absolute bottom-0 inset-x-0 bg-black/70 text-[8px] text-white p-0.5 truncate text-center font-medium">
                          {item.title.split('/')[0]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Sincronização entre ambientes */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
            <label className="text-xs font-bold text-slate-800 block">
              Sincronização entre Ambientes:
            </label>

            <div className="space-y-1.5 text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="course_sync"
                  checked={!syncWithOtherCampus}
                  onChange={() => setSyncWithOtherCampus(false)}
                  className="text-[#004B8D] focus:ring-[#00A3E0]"
                />
                <span className="text-slate-700 font-medium">
                  Não sincronizar com outro ambiente (exclusivo deste polo)
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="course_sync"
                  checked={syncWithOtherCampus}
                  onChange={() => setSyncWithOtherCampus(true)}
                  className="text-[#004B8D] focus:ring-[#00A3E0]"
                />
                <span className="text-[#004B8D] font-bold flex items-center gap-1">
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Criar vínculo com ambiente {otherCampusName}</span>
                </span>
              </label>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!courseName.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#004B8D] hover:bg-[#00386B] rounded-lg shadow-xs transition-colors disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5 text-[#00A3E0]" />
              <span>Cadastrar Curso com Capa</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
