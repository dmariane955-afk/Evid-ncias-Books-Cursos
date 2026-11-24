import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  FileUp,
  FileText,
  Check,
  Trash2,
  Calendar,
  Clock,
  Image as ImageIcon,
  AlertCircle,
  Loader2,
  Sparkles,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { ActivityItem, ActivityType, CampusId, Course, PhotoItem } from '../types';
import { extractActivitiesFromPdf, ParsedPdfActivityDraft } from '../utils/pdfImport';
import { compressImageToDataUrl } from '../services/storageService';

interface ImportPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  courses: Course[];
  currentCampus: CampusId;
  initialCourseId?: string;
  initialFile?: File | null;
  onImportActivities: (activities: ActivityItem[]) => Promise<void> | void;
}

export const ImportPdfModal: React.FC<ImportPdfModalProps> = ({
  isOpen,
  onClose,
  courses,
  currentCampus,
  initialCourseId,
  initialFile = null,
  onImportActivities,
}) => {
  const [targetCampus, setTargetCampus] = useState<CampusId>(currentCampus);
  const [targetCourseId, setTargetCourseId] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<ParsedPdfActivityDraft[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const extraPhotoInputRef = useRef<HTMLInputElement>(null);
  const activeDraftIdForPhotoRef = useRef<string | null>(null);

  const campusCourses = courses.filter((c) => c.campus === targetCampus);

  useEffect(() => {
    if (!isOpen) return;
    setTargetCampus(currentCampus);
    const matchingInCampus = courses.filter((c) => c.campus === currentCampus);
    const preferred =
      initialCourseId && courses.some((c) => c.id === initialCourseId)
        ? initialCourseId
        : matchingInCampus[0]?.id || courses[0]?.id || '';
    const preferredCourse = courses.find((c) => c.id === preferred);
    if (preferredCourse) {
      setTargetCampus(preferredCourse.campus);
    }
    setTargetCourseId(preferred);
    setErrorMsg(null);

    if (initialFile) {
      handleProcessPdfFile(initialFile);
    } else {
      setSelectedFile(null);
      setDrafts([]);
      setProgress({ current: 0, total: 0 });
    }
  }, [isOpen, initialCourseId, currentCampus, initialFile]);

  // Keep targetCourseId valid when switching campus selector inside modal
  useEffect(() => {
    if (!isOpen) return;
    const valid = campusCourses.some((c) => c.id === targetCourseId);
    if (!valid && campusCourses.length > 0) {
      setTargetCourseId(campusCourses[0].id);
    }
  }, [targetCampus, courses, isOpen]);

  if (!isOpen) return null;

  const handleProcessPdfFile = async (file: File) => {
    if (!file || (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf')) {
      setErrorMsg('Por favor, selecione um arquivo PDF válido (.pdf).');
      return;
    }

    setSelectedFile(file);
    setErrorMsg(null);
    setIsParsing(true);
    setDrafts([]);
    setProgress({ current: 0, total: 0 });

    try {
      const extracted = await extractActivitiesFromPdf(file, (curr, total) => {
        setProgress({ current: curr, total });
      });

      if (extracted.length === 0) {
        setErrorMsg('Não foi possível identificar conteúdo ou páginas válidas neste PDF.');
      }
      setDrafts(extracted);
    } catch (err) {
      console.error('Erro ao processar PDF:', err);
      setErrorMsg('Falha ao ler o arquivo PDF. Verifique se o arquivo não está corrompido ou protegido por senha.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleUpdateDraft = (draftId: string, patch: Partial<ParsedPdfActivityDraft>) => {
    setDrafts((prev) => prev.map((d) => (d.id === draftId ? { ...d, ...patch } : d)));
  };

  const handleRemoveDraftPhoto = (draftId: string, photoId: string) => {
    setDrafts((prev) =>
      prev.map((d) =>
        d.id === draftId ? { ...d, photos: d.photos.filter((p) => p.id !== photoId) } : d
      )
    );
  };

  const handleUsePageSnapshotAsPhoto = (draftId: string) => {
    setDrafts((prev) =>
      prev.map((d) => {
        if (d.id !== draftId || !d.pagePreviewUrl) return d;
        const alreadyHas = d.photos.some((p) => p.url === d.pagePreviewUrl);
        if (alreadyHas) return d;
        const newPhoto: PhotoItem = {
          id: `pdf-snap-${d.pageNumber}-${Date.now()}`,
          url: d.pagePreviewUrl,
          caption: `Registro da página ${d.pageNumber}`,
          fit: 'contain',
        };
        return { ...d, photos: [...d.photos, newPhoto] };
      })
    );
  };

  const handleAddManualPhotosToDraft = async (files: FileList | null) => {
    const draftId = activeDraftIdForPhotoRef.current;
    if (!files || !draftId) return;
    const added: PhotoItem[] = [];
    for (const file of Array.from(files)) {
      try {
        const compressed = await compressImageToDataUrl(file, 1280, 720, 0.75);
        if (compressed) {
          added.push({
            id: `pdf-manual-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            url: compressed,
            caption: 'Registro fotográfico da atividade',
            fit: 'cover',
          });
        }
      } catch {
        // ignore bad image
      }
    }
    if (added.length > 0) {
      setDrafts((prev) =>
        prev.map((d) => (d.id === draftId ? { ...d, photos: [...d.photos, ...added] } : d))
      );
    }
    activeDraftIdForPhotoRef.current = null;
  };

  const selectedDrafts = drafts.filter((d) => d.selected);
  const selectedCourse = courses.find((c) => c.id === targetCourseId);

  const handleConfirmImport = async () => {
    if (!targetCourseId || selectedDrafts.length === 0) return;
    setIsSaving(true);
    try {
      const nowBase = Date.now();
      const newActivities: ActivityItem[] = selectedDrafts.map((draft, idx) => {
        const actId = `act-${nowBase + idx}-${Math.random().toString(36).substring(2, 6)}`;
        return {
          id: actId,
          bookId: `book-${targetCourseId}`,
          campus: targetCampus,
          unitId: targetCampus,
          courseId: targetCourseId,
          title: draft.title.trim() || `Atividade ${idx + 1}`,
          date: draft.date,
          time: draft.time || '14:00',
          activityType: draft.activityType,
          objective: draft.objective.trim(),
          complementaryText: draft.complementaryText.trim(),
          photos: draft.photos,
          targetCourseIds: [targetCourseId],
          primaryCampus: targetCampus,
          syncedCampuses: [targetCampus],
          isShared: false,
          createdAt: new Date(nowBase + idx).toISOString(),
          updatedAt: new Date().toISOString(),
        };
      });

      await onImportActivities(newActivities);
      onClose();
    } catch (err) {
      console.error('Erro ao importar atividades do PDF:', err);
      setErrorMsg('Ocorreu um erro ao salvar as atividades importadas. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#E0F2FE] text-[#004B8D] flex items-center justify-center">
              <FileUp className="w-5 h-5 text-[#00A3E0]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Importar Atividades de PDF para Book
              </h3>
              <p className="text-xs text-slate-500">
                Extrai automaticamente títulos, datas, objetivos e fotografias das páginas do PDF
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Hidden Inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleProcessPdfFile(f);
            e.target.value = '';
          }}
          className="hidden"
        />
        <input
          ref={extraPhotoInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => {
            handleAddManualPhotosToDraft(e.target.files);
            e.target.value = '';
          }}
          className="hidden"
        />

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* Destination Book Selector */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Unidade / Polo de Destino:
              </label>
              <div className="flex bg-white p-0.5 rounded-lg border border-slate-300 font-bold">
                <button
                  type="button"
                  onClick={() => setTargetCampus('curitiba')}
                  className={`flex-1 py-1.5 rounded-md text-xs transition-all ${
                    targetCampus === 'curitiba'
                      ? 'bg-[#004B8D] text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Curitiba
                </button>
                <button
                  type="button"
                  onClick={() => setTargetCampus('fatec')}
                  className={`flex-1 py-1.5 rounded-md text-xs transition-all ${
                    targetCampus === 'fatec'
                      ? 'bg-[#001D3D] text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  FATEC
                </button>
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="font-bold text-slate-700 block mb-1">
                Book de Destino ({targetCampus === 'curitiba' ? 'Curitiba' : 'FATEC'}):
              </label>
              <select
                value={targetCourseId}
                onChange={(e) => setTargetCourseId(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-[#001D3D] focus:outline-hidden focus:ring-2 focus:ring-[#00A3E0]"
              >
                {campusCourses.length === 0 ? (
                  <option value="">Nenhum Book cadastrado neste polo</option>
                ) : (
                  campusCourses.map((c) => (
                    <option key={c.id} value={c.id}>
                      Book: {c.name} ({c.campus === 'curitiba' ? 'Curitiba' : 'FATEC'})
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Dropzone when no file processed yet or parsing */}
          {drafts.length === 0 && !isParsing && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingOver(true);
              }}
              onDragLeave={() => setIsDraggingOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDraggingOver(false);
                const file = e.dataTransfer.files?.[0];
                if (file) handleProcessPdfFile(file);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                isDraggingOver
                  ? 'border-[#00A3E0] bg-sky-50/70 scale-[0.99]'
                  : 'border-slate-300 bg-white hover:border-[#00A3E0] hover:bg-slate-50/60'
              }`}
            >
              <div className="w-16 h-16 rounded-2xl bg-[#E0F2FE] flex items-center justify-center text-[#004B8D] mb-3 shadow-xs">
                <FileText className="w-8 h-8 text-[#00A3E0]" />
              </div>
              <span className="text-sm font-extrabold text-slate-900">
                Arraste o arquivo PDF das atividades aqui
              </span>
              <span className="text-xs text-slate-500 mt-1 max-w-md">
                ou <strong className="text-[#004B8D] underline">clique para selecionar o PDF</strong> do computador. Cada página de atividade será lida com suas fotos e textos para você revisar antes de salvar.
              </span>
            </div>
          )}

          {/* Parsing Progress */}
          {isParsing && (
            <div className="border border-sky-200 bg-sky-50/60 rounded-2xl p-8 flex flex-col items-center justify-center text-center space-y-3">
              <Loader2 className="w-8 h-8 text-[#00A3E0] animate-spin" />
              <div>
                <p className="text-sm font-bold text-[#001D3D]">
                  Analisando PDF: {selectedFile?.name}
                </p>
                <p className="text-xs text-slate-600 mt-0.5">
                  {progress.total > 0
                    ? `Extraindo textos e fotografias da página ${progress.current} de ${progress.total}...`
                    : 'Carregando documento...'}
                </p>
              </div>
              {progress.total > 0 && (
                <div className="w-full max-w-sm h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#00A3E0] transition-all duration-200"
                    style={{ width: `${Math.round((progress.current / progress.total) * 100)}%` }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Extracted Drafts Review List */}
          {drafts.length > 0 && !isParsing && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-sky-50/70 border border-sky-200 rounded-xl px-3.5 py-2.5">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#00A3E0]" />
                  <span className="font-bold text-[#001D3D]">
                    {drafts.length} {drafts.length === 1 ? 'página identificada' : 'páginas identificadas'} em "{selectedFile?.name}"
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-[#004B8D] text-white font-bold text-[10px]">
                    {selectedDrafts.length} selecionadas
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDrafts((prev) => prev.map((d) => ({ ...d, selected: !d.isStructuralPage })))}
                    className="text-[11px] font-semibold text-[#004B8D] hover:underline"
                  >
                    Apenas atividades
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => setDrafts((prev) => prev.map((d) => ({ ...d, selected: true })))}
                    className="text-[11px] font-semibold text-[#004B8D] hover:underline"
                  >
                    Marcar todas
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => setDrafts((prev) => prev.map((d) => ({ ...d, selected: false })))}
                    className="text-[11px] font-semibold text-slate-500 hover:underline"
                  >
                    Desmarcar todas
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 text-[11px]"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Trocar PDF</span>
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {drafts.map((draft) => (
                  <div
                    key={draft.id}
                    className={`rounded-xl border p-3.5 transition-all ${
                      draft.selected
                        ? 'bg-white border-[#00A3E0]/60 shadow-2xs'
                        : 'bg-slate-50/70 border-slate-200 opacity-75'
                    }`}
                  >
                    {/* Card top toggle header */}
                    <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                      <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                        <input
                          type="checkbox"
                          checked={draft.selected}
                          onChange={(e) => handleUpdateDraft(draft.id, { selected: e.target.checked })}
                          className="rounded border-slate-300 text-[#004B8D] focus:ring-[#00A3E0]"
                        />
                        <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          Página {draft.pageNumber}
                        </span>
                        {draft.isStructuralPage && (
                          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                            {draft.structuralReason || 'Página institucional'}
                          </span>
                        )}
                      </label>

                      <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                        <ImageIcon className="w-3.5 h-3.5 text-[#00A3E0]" />
                        {draft.photos.length} {draft.photos.length === 1 ? 'foto extraída' : 'fotos extraídas'}
                      </span>
                    </div>

                    {draft.selected && (
                      <div className="pt-3 grid grid-cols-1 md:grid-cols-12 gap-4">
                        {/* Left column: Metadata inputs */}
                        <div className="md:col-span-7 space-y-2.5">
                          <div>
                            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-0.5">
                              Título da Atividade
                            </label>
                            <input
                              type="text"
                              value={draft.title}
                              onChange={(e) => handleUpdateDraft(draft.id, { title: e.target.value })}
                              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#00A3E0]"
                            />
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="text-[10px] font-bold uppercase text-slate-500 mb-0.5 flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-[#00A3E0]" />
                                <span>Data</span>
                              </label>
                              <input
                                type="date"
                                value={draft.date}
                                onChange={(e) => handleUpdateDraft(draft.id, { date: e.target.value })}
                                className="w-full px-2 py-1 border border-slate-300 rounded-lg text-[11px] font-mono bg-white"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold uppercase text-slate-500 mb-0.5 flex items-center gap-1">
                                <Clock className="w-3 h-3 text-[#00A3E0]" />
                                <span>Horário</span>
                              </label>
                              <input
                                type="time"
                                value={draft.time}
                                onChange={(e) => handleUpdateDraft(draft.id, { time: e.target.value })}
                                className="w-full px-2 py-1 border border-slate-300 rounded-lg text-[11px] font-mono bg-white"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold uppercase text-slate-500 block mb-0.5">
                                Tipo
                              </label>
                              <select
                                value={draft.activityType}
                                onChange={(e) =>
                                  handleUpdateDraft(draft.id, { activityType: e.target.value as ActivityType })
                                }
                                className="w-full px-2 py-1 border border-slate-300 rounded-lg text-[11px] bg-white"
                              >
                                <option value="Atividade regular">Regular</option>
                                <option value="Atividade de sustentabilidade">Sustentabilidade</option>
                                <option value="Atividade de arrecadação">Arrecadação</option>
                                <option value="Atividade colaborativa interdisciplinar">Interdisciplinar</option>
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-0.5">
                              Objetivo / Registro das Ações
                            </label>
                            <textarea
                              rows={3}
                              value={draft.objective}
                              onChange={(e) => handleUpdateDraft(draft.id, { objective: e.target.value })}
                              className="w-full p-2 border border-slate-300 rounded-lg text-[11px] text-slate-800 leading-relaxed resize-none focus:outline-hidden focus:ring-2 focus:ring-[#00A3E0]"
                            />
                          </div>
                        </div>

                        {/* Right column: Extracted photos + fallback page capture */}
                        <div className="md:col-span-5 flex flex-col justify-between bg-slate-50 border border-slate-200 rounded-lg p-2.5 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase text-slate-600">
                              Fotos ({draft.photos.length})
                            </span>
                            <div className="flex items-center gap-1.5">
                              {draft.pagePreviewUrl && (
                                <button
                                  type="button"
                                  onClick={() => handleUsePageSnapshotAsPhoto(draft.id)}
                                  title="Adicionar uma captura visual desta página como foto da atividade"
                                  className="text-[10px] font-semibold text-slate-600 hover:text-[#004B8D] underline"
                                >
                                  Usar página
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  activeDraftIdForPhotoRef.current = draft.id;
                                  extraPhotoInputRef.current?.click();
                                }}
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white border border-slate-300 text-[10px] font-bold text-[#004B8D] hover:bg-sky-50"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Foto</span>
                              </button>
                            </div>
                          </div>

                          {draft.photos.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-center p-3 border border-dashed border-slate-300 rounded-md bg-white space-y-1.5">
                              <span className="text-[11px] text-slate-400">
                                Nenhuma imagem isolada extraída nesta página.
                              </span>
                              {draft.pagePreviewUrl && (
                                <button
                                  type="button"
                                  onClick={() => handleUsePageSnapshotAsPhoto(draft.id)}
                                  className="px-2.5 py-1 rounded bg-sky-50 border border-sky-200 text-[#004B8D] font-bold text-[10px] hover:bg-sky-100"
                                >
                                  Capturar página inteira como foto
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto pr-0.5">
                              {draft.photos.map((photo, pIdx) => (
                                <div
                                  key={photo.id}
                                  className="relative group aspect-4/3 rounded overflow-hidden border border-slate-300 bg-white"
                                >
                                  <img
                                    src={photo.url}
                                    alt={`Foto ${pIdx + 1}`}
                                    className="w-full h-full object-cover"
                                  />
                                  <span className="absolute top-1 left-1 bg-black/70 text-white text-[9px] font-mono px-1 rounded">
                                    #{pIdx + 1}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveDraftPhoto(draft.id, photo.id)}
                                    title="Remover foto"
                                    className="absolute top-1 right-1 p-1 rounded bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500">
            {selectedCourse ? (
              <span>
                Destino: <strong className="text-[#001D3D]">Book {selectedCourse.name}</strong> ({selectedCourse.campus === 'curitiba' ? 'Curitiba' : 'FATEC'})
              </span>
            ) : (
              <span>Selecione um Book de destino</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={isParsing || isSaving || !targetCourseId || selectedDrafts.length === 0}
              onClick={handleConfirmImport}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-[#004B8D] hover:bg-[#00386B] rounded-lg shadow-xs transition-colors disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4 text-[#00A3E0]" />
              )}
              <span>
                {isSaving
                  ? 'Salvando atividades...'
                  : `Cadastrar ${selectedDrafts.length} ${selectedDrafts.length === 1 ? 'Atividade' : 'Atividades'} no Book`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
