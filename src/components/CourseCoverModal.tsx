import React, { useState } from 'react';
import { X, Image as ImageIcon, UploadCloud, Check, Sparkles } from 'lucide-react';
import { Course } from '../types';
import { COURSE_COVER_LIBRARY, getCourseCoverImage } from '../utils/courseCovers';
import { EstacioLogo } from './EstacioLogo';
import { AREA_CONFIGS } from '../data/defaults';

interface CourseCoverModalProps {
  isOpen: boolean;
  onClose: () => void;
  course: Course | null;
  onSaveCover: (courseId: string, newCoverUrl: string) => void;
}

export const CourseCoverModal: React.FC<CourseCoverModalProps> = ({
  isOpen,
  onClose,
  course,
  onSaveCover,
}) => {
  if (!isOpen || !course) return null;

  const currentCover = course.coverImage || getCourseCoverImage(course.name, course.academicArea);
  const [selectedUrl, setSelectedUrl] = useState<string>(currentCover);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result) {
        setSelectedUrl(result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleSave = () => {
    onSaveCover(course.id, selectedUrl);
    onClose();
  };

  const areaConfig = AREA_CONFIGS[course.academicArea];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#E0F2FE] text-[#004B8D]">
              <ImageIcon className="w-5 h-5 text-[#00A3E0]" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[#001D3D]">
                Capa Personalizada do Curso
              </h3>
              <p className="text-xs text-slate-500">
                {course.name} · Polo {course.campus === 'curitiba' ? 'Curitiba' : 'FATEC'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Live Preview Card */}
          <div>
            <span className="text-xs font-bold text-slate-700 block mb-2">
              Pré-visualização da Capa do Curso & Book:
            </span>
            <div className="rounded-xl overflow-hidden border border-slate-300 relative aspect-16/9 max-h-56 w-full shadow-md bg-slate-900">
              <img
                src={selectedUrl}
                alt="Prévia da Capa"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#001D3D]/95 via-[#001D3D]/40 to-transparent flex flex-col justify-between p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <div className="bg-white/95 backdrop-blur-xs px-2.5 py-1 rounded-md shadow-xs flex items-center">
                    <EstacioLogo size="sm" />
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-black/50 text-white backdrop-blur-xs">
                    {course.period}
                  </span>
                </div>

                <div>
                  <span
                    className="inline-block px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider mb-1"
                    style={{ backgroundColor: areaConfig?.accentBg || '#E0F2FE', color: areaConfig?.color || '#004B8D' }}
                  >
                    {areaConfig?.label || 'Graduação'}
                  </span>
                  <h4 className="text-base sm:text-lg font-bold text-white tracking-tight leading-snug">
                    {course.name}
                  </h4>
                  <span className="text-xs text-slate-300">
                    Faculdade Estácio · Book de Evidências Acadêmicas
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Upload Custom Image Area */}
          <div>
            <span className="text-xs font-bold text-slate-700 block mb-1.5">
              Enviar Foto Própria:
            </span>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
                isDragging
                  ? 'border-[#00A3E0] bg-sky-50'
                  : 'border-slate-300 hover:border-[#00A3E0] hover:bg-slate-50'
              }`}
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = (e: any) => {
                  if (e.target?.files?.[0]) {
                    handleFileUpload(e.target.files[0]);
                  }
                };
                input.click();
              }}
            >
              <UploadCloud className="w-6 h-6 text-[#00A3E0] mx-auto mb-1.5" />
              <p className="text-xs font-semibold text-slate-700">
                Arraste uma foto aqui ou clique para selecionar do computador
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                JPG, PNG ou WEBP em alta resolução (proporção 16:9 recomendada)
              </p>
            </div>
          </div>

          {/* Curated Thematic Library */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#00A3E0]" />
                <span>Galeria de Imagens Equivalentes por Área:</span>
              </span>
              <span className="text-[11px] text-slate-400">
                Clique para selecionar
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {COURSE_COVER_LIBRARY.map((item) => {
                const isSelected = selectedUrl === item.url;
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedUrl(item.url)}
                    className={`group relative rounded-lg overflow-hidden border-2 cursor-pointer transition-all aspect-16/9 bg-slate-100 ${
                      isSelected
                        ? 'border-[#00A3E0] shadow-md ring-2 ring-[#00A3E0]/30'
                        : 'border-slate-200 hover:border-slate-400'
                    }`}
                  >
                    <img
                      src={item.url}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-2 flex flex-col justify-between">
                      <div className="flex justify-end">
                        {isSelected && (
                          <span className="w-5 h-5 rounded-full bg-[#00A3E0] text-white flex items-center justify-center shadow-xs">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-bold text-white leading-tight drop-shadow-xs line-clamp-2">
                        {item.title}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-200 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 text-xs font-bold text-white bg-[#004B8D] hover:bg-[#00386B] rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Salvar Capa do Curso & Book</span>
          </button>
        </div>
      </div>
    </div>
  );
};
