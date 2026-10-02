import React, { useRef } from 'react';
import { 
  X, 
  Settings2, 
  Download, 
  Upload, 
  RotateCcw, 
  Building2, 
  ShieldCheck,
  FileJson
} from 'lucide-react';
import { AcademicBook } from '../types';
import { CAMPUS_CONFIGS } from '../data/defaults';

interface BookSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  book: AcademicBook;
  onUpdateBook: (updated: Partial<AcademicBook>) => void;
  onResetBook: () => void;
  onLoadBook: (newBook: AcademicBook) => void;
}

export const BookSettingsModal: React.FC<BookSettingsModalProps> = ({
  isOpen,
  onClose,
  book,
  onUpdateBook,
  onResetBook,
  onLoadBook,
}) => {
  const jsonFileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const campus = CAMPUS_CONFIGS[book.campus] || CAMPUS_CONFIGS.curitiba;

  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(book, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute(
      'download',
      `Backup_Book_${book.courseName}_${book.period}.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (parsed && parsed.slides && Array.isArray(parsed.slides)) {
            onLoadBook(parsed);
            onClose();
          } else {
            alert('Formato de arquivo JSON inválido.');
          }
        } catch (err) {
          alert('Erro ao processar arquivo JSON.');
        }
      };
      reader.readAsText(file);
    }
    if (jsonFileInputRef.current) jsonFileInputRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-xl w-full overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-[#E0F2FE] text-[#004B8D]">
              <Settings2 className="w-5 h-5 text-[#00A3E0]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Configurações do Book & Ficha Técnica
              </h3>
              <p className="text-xs text-slate-500">
                Gerencie metadados institucionais, corpo diretivo e backups
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

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Title & Subtitle */}
          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Título Principal do Book:
            </label>
            <input
              type="text"
              value={book.title}
              onChange={(e) => onUpdateBook({ title: e.target.value })}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#00A3E0]"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Subtítulo Institucional:
            </label>
            <input
              type="text"
              value={book.subtitle}
              onChange={(e) => onUpdateBook({ subtitle: e.target.value })}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#00A3E0]"
            />
          </div>

          {/* Coordinator & Director */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Coordenação de Curso:
              </label>
              <input
                type="text"
                value={book.coordinator}
                onChange={(e) => onUpdateBook({ coordinator: e.target.value })}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#00A3E0]"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Direção Geral de Campus:
              </label>
              <input
                type="text"
                value={book.director}
                onChange={(e) => onUpdateBook({ director: e.target.value })}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#00A3E0]"
              />
            </div>
          </div>

          {/* Backup / Export / Import JSON section */}
          <div className="pt-3 border-t border-slate-200">
            <span className="font-bold text-slate-800 block mb-2">
              Sincronização & Backup de Dados (Offline/Cloud)
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleExportJSON}
                className="p-2.5 rounded-lg border border-slate-200 hover:border-[#004B8D] bg-slate-50 flex items-center justify-center gap-1.5 text-slate-700 font-semibold transition-colors"
              >
                <Download className="w-4 h-4 text-[#004B8D]" />
                <span>Exportar Backup (JSON)</span>
              </button>

              <button
                type="button"
                onClick={() => jsonFileInputRef.current?.click()}
                className="p-2.5 rounded-lg border border-slate-200 hover:border-[#004B8D] bg-slate-50 flex items-center justify-center gap-1.5 text-slate-700 font-semibold transition-colors"
              >
                <Upload className="w-4 h-4 text-[#00A3E0]" />
                <span>Restaurar (JSON)</span>
              </button>
              <input
                ref={jsonFileInputRef}
                type="file"
                accept=".json"
                onChange={handleImportJSON}
                className="hidden"
              />
            </div>
          </div>

          {/* Danger zone / Reset */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
            <div>
              <span className="font-bold text-slate-800 block">
                Restaurar Padrão Institucional
              </span>
              <span className="text-[11px] text-slate-500">
                Recarrega os 10 slides modelo oficiais
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                if (confirm('Tem certeza que deseja restaurar o Book padrão? As alterações não salvas serão substituídas.')) {
                  onResetBook();
                  onClose();
                }
              }}
              className="px-3 py-1.5 rounded-lg border border-red-200 hover:bg-red-50 text-red-600 font-semibold flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restaurar Padrão</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold text-white bg-[#004B8D] hover:bg-[#00386B] rounded-lg transition-colors"
          >
            Concluído
          </button>
        </div>
      </div>
    </div>
  );
};
