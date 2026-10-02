import React, { useState } from 'react';
import { 
  X, 
  Trash2, 
  AlertTriangle, 
  Share2, 
  Check, 
  Building2, 
  BookOpen 
} from 'lucide-react';
import { ActivityItem, AcademicBook, Course, CampusId } from '../types';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  itemName: string;
  description: string;
  warningNote?: string;
  onConfirm: () => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  onClose,
  title,
  itemName,
  description,
  warningNote,
  onConfirm,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-red-50/50">
          <div className="flex items-center gap-2 text-red-700 font-bold text-sm">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <span>{title}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-3 text-xs text-slate-700">
          <p className="font-semibold text-slate-900 text-sm">
            Tem certeza que deseja excluir definitivamente:
          </p>
          <div className="p-2.5 bg-slate-100 rounded-lg font-bold text-slate-900 border border-slate-200">
            {itemName}
          </div>
          <p className="leading-relaxed text-slate-600">
            {description}
          </p>
          {warningNote && (
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[11px] leading-snug">
              {warningNote}
            </div>
          )}
        </div>

        <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="px-4 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-2xs transition-colors"
          >
            Excluir definitivamente
          </button>
        </div>
      </div>
    </div>
  );
};

// Modal for deleting synced activities (Choose scope: Only Curitiba, Only FATEC, or Both)
interface DeleteSyncedActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  activity: ActivityItem | null;
  currentCampus: CampusId;
  onConfirm: (scope: 'current' | 'all') => void;
}

export const DeleteSyncedActivityModal: React.FC<DeleteSyncedActivityModalProps> = ({
  isOpen,
  onClose,
  activity,
  currentCampus,
  onConfirm,
}) => {
  const [scope, setScope] = useState<'current' | 'all'>('current');

  if (!isOpen || !activity) return null;

  const currentCampusName = currentCampus === 'curitiba' ? 'Curitiba' : 'FATEC';
  const otherCampusName = currentCampus === 'curitiba' ? 'FATEC' : 'Curitiba';

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-amber-50/60">
          <div className="flex items-center gap-2 text-amber-800 font-bold text-sm">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <span>Excluir conteúdo sincronizado</span>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700 rounded-md">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          <div>
            <p className="font-semibold text-slate-900 text-sm">
              Excluir este conteúdo de onde?
            </p>
            <p className="text-slate-500 mt-0.5">
              "{activity.title}" está sincronizado entre múltiplos ambientes/Books.
            </p>
          </div>

          <div className="space-y-2">
            <label className="p-3 rounded-lg border border-slate-200 hover:border-slate-300 flex items-start gap-2.5 cursor-pointer bg-slate-50/50">
              <input
                type="radio"
                name="del_scope"
                checked={scope === 'current'}
                onChange={() => setScope('current')}
                className="mt-0.5 text-red-600 focus:ring-red-500"
              />
              <div>
                <span className="font-bold text-slate-900 block">
                  Somente em {currentCampusName}
                </span>
                <span className="text-[11px] text-slate-500">
                  O conteúdo continuará preservado no ambiente {otherCampusName}.
                </span>
              </div>
            </label>

            <label className="p-3 rounded-lg border border-slate-200 hover:border-slate-300 flex items-start gap-2.5 cursor-pointer bg-slate-50/50">
              <input
                type="radio"
                name="del_scope"
                checked={scope === 'all'}
                onChange={() => setScope('all')}
                className="mt-0.5 text-red-600 focus:ring-red-500"
              />
              <div>
                <span className="font-bold text-red-700 block">
                  Em ambos os ambientes ({currentCampusName} + {otherCampusName})
                </span>
                <span className="text-[11px] text-slate-500">
                  Excluirá a atividade definitivamente de todos os Books.
                </span>
              </div>
            </label>
          </div>
        </div>

        <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm(scope);
              onClose();
            }}
            className="px-4 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
          >
            Confirmar Exclusão
          </button>
        </div>
      </div>
    </div>
  );
};

// Modal for manual synchronization of an activity or full Book
interface SyncContentModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  sourceCampus: CampusId;
  targetCourses: Course[];
  initialSelectedCourseIds?: string[];
  onConfirmSync: (selectedCourseIds: string[]) => void;
}

export const SyncContentModal: React.FC<SyncContentModalProps> = ({
  isOpen,
  onClose,
  title,
  sourceCampus,
  targetCourses,
  initialSelectedCourseIds = [],
  onConfirmSync,
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedCourseIds);

  if (!isOpen) return null;

  const targetCampusName = sourceCampus === 'curitiba' ? 'FATEC' : 'Curitiba';

  const toggleCourse = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-sky-50">
          <div className="flex items-center gap-2 text-[#004B8D] font-bold text-sm">
            <Share2 className="w-5 h-5 text-[#00A3E0]" />
            <span>Sincronizar com {targetCampusName}</span>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700 rounded-md">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          <div>
            <p className="font-semibold text-slate-900 text-sm">
              {title}
            </p>
            <p className="text-slate-500 mt-1">
              Selecione quais Books no ambiente <strong>{targetCampusName}</strong> deverão receber este conteúdo:
            </p>
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {targetCourses.length === 0 ? (
              <p className="text-slate-400 italic">Nenhum curso cadastrado em {targetCampusName}. Cadastre um curso primeiro.</p>
            ) : (
              targetCourses.map((c) => {
                const isChecked = selectedIds.includes(c.id);
                return (
                  <label
                    key={c.id}
                    className={`p-2.5 rounded-lg border flex items-center gap-2.5 cursor-pointer transition-all ${
                      isChecked
                        ? 'border-[#00A3E0] bg-sky-50/50 text-[#004B8D] font-bold'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleCourse(c.id)}
                      className="rounded border-slate-300 text-[#004B8D] focus:ring-[#00A3E0]"
                    />
                    <span>Book: {c.name}</span>
                  </label>
                );
              })
            )}
          </div>
        </div>

        <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirmSync(selectedIds);
              onClose();
            }}
            className="px-4 py-1.5 text-xs font-bold text-white bg-[#004B8D] hover:bg-[#00386B] rounded-lg shadow-2xs transition-colors"
          >
            Salvar Sincronização
          </button>
        </div>
      </div>
    </div>
  );
};
