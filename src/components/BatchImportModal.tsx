import React, { useState } from 'react';
import { X, UploadCloud, Image as ImageIcon, Sparkles, Check } from 'lucide-react';
import { SlideData, PhotoItem } from '../types';

interface BatchImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportBatch: (newSlides: SlideData[]) => void;
  courseName: string;
  coordinator: string;
}

export const BatchImportModal: React.FC<BatchImportModalProps> = ({
  isOpen,
  onClose,
  onImportBatch,
  courseName,
  coordinator,
}) => {
  const [selectedImages, setSelectedImages] = useState<{ name: string; url: string }[]>([]);
  const [layoutMode, setLayoutMode] = useState<'pairs' | 'single'>('pairs');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const fileArray = Array.from(files);
    fileArray.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const url = e.target?.result as string;
        if (url) {
          setSelectedImages((prev) => [...prev, { name: file.name, url }]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleCreateSlides = () => {
    if (selectedImages.length === 0) return;
    setIsProcessing(true);

    const generatedSlides: SlideData[] = [];
    const timestamp = Date.now();

    if (layoutMode === 'pairs') {
      // 2 photos per slide
      for (let i = 0; i < selectedImages.length; i += 2) {
        const pair = selectedImages.slice(i, i + 2);
        const photos: PhotoItem[] = pair.map((img, idx) => ({
          id: `batch-p-${timestamp}-${i + idx}`,
          url: img.url,
          caption: `Registro de aula prática / atividade ${Math.floor(i / 2) + 1}`,
          fit: 'cover',
        }));

        generatedSlides.push({
          id: `batch-s-${timestamp}-${i}`,
          type: 'evidencia',
          title: `Atividade Prática em Laboratório · Parte ${Math.floor(i / 2) + 1}`,
          order: 999, // will be reassigned
          photoLayout: 'split-50-50',
          photos,
          evidenceMeta: {
            category: 'Aula Prática / Laboratório',
            date: new Date().toLocaleDateString('pt-BR'),
            location: 'Laboratório Integrado',
            discipline: 'Unidade Curricular Prática',
            professor: coordinator,
            studentsCount: 35,
            actionsReport:
              'Registro fotográfico de atividade prática supervisionada em laboratório, com observância das diretrizes curriculares e fomento ao desenvolvimento de competências técnicas discentes.',
            pedagogicalImpact: 'Consolidação das habilidades operacionais e análise empírica de processos.',
          },
        });
      }
    } else {
      // 1 photo per slide (Single Hero)
      selectedImages.forEach((img, idx) => {
        generatedSlides.push({
          id: `batch-s-${timestamp}-${idx}`,
          type: 'evidencia',
          title: `Evidência de Aprendizagem Prática ${idx + 1}`,
          order: 999,
          photoLayout: 'single',
          photos: [
            {
              id: `batch-p-${timestamp}-${idx}`,
              url: img.url,
              caption: `Evidência fotográfica: ${img.name}`,
              fit: 'cover',
            },
          ],
          evidenceMeta: {
            category: 'Prática Acadêmica',
            date: new Date().toLocaleDateString('pt-BR'),
            location: 'Campus Curitiba',
            discipline: 'Atividade Prática Supervisionada',
            professor: coordinator,
            studentsCount: 30,
            actionsReport:
              'Execução de experimentos e dinâmicas curriculares integradas, proporcionando aos acadêmicos a sedimentação de competências essenciais.',
            pedagogicalImpact: 'Desenvolvimento do pensamento crítico e solução de problemas.',
          },
        });
      });
    }

    onImportBatch(generatedSlides);
    setIsProcessing(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-xl w-full overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-[#E0F2FE] text-[#004B8D]">
              <UploadCloud className="w-5 h-5 text-[#00A3E0]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Preenchimento em Lote de Evidências
              </h3>
              <p className="text-xs text-slate-500">
                Importe múltiplas fotos para gerar slides estruturados automaticamente
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

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {/* Drop area */}
          <label className="border-2 border-dashed border-slate-300 hover:border-[#00A3E0] rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer bg-slate-50/50 hover:bg-slate-50 transition-colors">
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => handleFiles(e.target.files)}
              className="hidden"
            />
            <div className="w-12 h-12 rounded-full bg-white shadow-xs flex items-center justify-center text-[#00A3E0] mb-2 border border-slate-200">
              <ImageIcon className="w-6 h-6" />
            </div>
            <span className="text-xs font-bold text-slate-800">
              Selecionar fotos do computador
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5">
              Selecione 4, 10 ou 20 fotos simultâneas (PNG, JPG, WebP)
            </span>
          </label>

          {/* Layout choice */}
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <span className="text-xs font-bold text-slate-700 block mb-2">
              Estruturação dos Slides Gerados:
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setLayoutMode('pairs')}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  layoutMode === 'pairs'
                    ? 'border-[#00A3E0] bg-white ring-1 ring-[#00A3E0] font-semibold text-[#004B8D]'
                    : 'border-slate-200 bg-white/60 text-slate-600'
                }`}
              >
                <div className="font-bold">Divisão em Pares (50/50)</div>
                <div className="text-[10px] text-slate-500">
                  2 fotos por slide com caixa de ações
                </div>
              </button>

              <button
                type="button"
                onClick={() => setLayoutMode('single')}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  layoutMode === 'single'
                    ? 'border-[#00A3E0] bg-white ring-1 ring-[#00A3E0] font-semibold text-[#004B8D]'
                    : 'border-slate-200 bg-white/60 text-slate-600'
                }`}
              >
                <div className="font-bold">1 Foto Hero</div>
                <div className="text-[10px] text-slate-500">
                  1 foto em destaque amplo por slide
                </div>
              </button>
            </div>
          </div>

          {/* Photos count info */}
          {selectedImages.length > 0 && (
            <div className="flex items-center justify-between text-xs text-slate-700 bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg">
              <span className="flex items-center gap-1.5 font-medium">
                <Check className="w-4 h-4 text-emerald-600" />
                {selectedImages.length} fotos carregadas
              </span>
              <span className="font-semibold text-emerald-800">
                Gera{' '}
                {layoutMode === 'pairs'
                  ? Math.ceil(selectedImages.length / 2)
                  : selectedImages.length}{' '}
                slides novos
              </span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg"
          >
            Cancelar
          </button>
          <button
            onClick={handleCreateSlides}
            disabled={selectedImages.length === 0 || isProcessing}
            className="px-4 py-1.5 text-xs font-bold text-white bg-[#004B8D] hover:bg-[#00386B] rounded-lg shadow-xs transition-colors disabled:opacity-50"
          >
            {isProcessing ? 'Gerando Slides...' : 'Gerar Slides Automáticos'}
          </button>
        </div>
      </div>
    </div>
  );
};
