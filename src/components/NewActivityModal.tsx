import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  UploadCloud, 
  Sparkles, 
  Image as ImageIcon, 
  Trash2, 
  ArrowLeft, 
  ArrowRight, 
  RefreshCw, 
  Check, 
  Calendar, 
  Clock, 
  Layers, 
  Share2,
  Plus
} from 'lucide-react';
import { ActivityItem, ActivityType, Course, PhotoItem, CampusId } from '../types';
import { generateActivityObjective } from '../utils/aiObjective';

interface NewActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveActivity: (activity: ActivityItem, applyToAllSynced?: boolean) => void;
  courses: Course[];
  initialCourseId?: string;
  currentCampus: CampusId;
  isSharedMode?: boolean;
  editingActivity?: ActivityItem | null;
  initialDroppedImage?: string | null;
}

export const NewActivityModal: React.FC<NewActivityModalProps> = ({
  isOpen,
  onClose,
  onSaveActivity,
  courses,
  initialCourseId,
  currentCampus,
  isSharedMode = false,
  editingActivity = null,
  initialDroppedImage = null,
}) => {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState('14:00');
  const [activityType, setActivityType] = useState<ActivityType>('Atividade regular');
  const [objective, setObjective] = useState('');
  const [complementaryText, setComplementaryText] = useState('');
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [syncWithOtherCampus, setSyncWithOtherCampus] = useState(false);
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [selectedOtherCampusCourseIds, setSelectedOtherCampusCourseIds] = useState<string[]>([]);
  const [applyScope, setApplyScope] = useState<'current' | 'all'>('current');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiSeed, setAiSeed] = useState(0);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceIndexRef = useRef<number | null>(null);

  const otherCampus: CampusId = currentCampus === 'curitiba' ? 'fatec' : 'curitiba';
  const currentCampusCourses = courses.filter((c) => c.campus === currentCampus);
  const otherCampusCourses = courses.filter((c) => c.campus === otherCampus);

  // Initialize or reset state when modal opens
  useEffect(() => {
    if (!isOpen) return;

    if (editingActivity) {
      setTitle(editingActivity.title);
      setDate(editingActivity.date);
      setTime(editingActivity.time);
      setActivityType(editingActivity.activityType);
      setObjective(editingActivity.objective);
      setComplementaryText(editingActivity.complementaryText || '');
      setPhotos([...editingActivity.photos]);
      
      const currentCampusIds = editingActivity.targetCourseIds.filter((id) =>
        currentCampusCourses.some((c) => c.id === id)
      );
      const otherCampusIds = editingActivity.targetCourseIds.filter((id) =>
        otherCampusCourses.some((c) => c.id === id)
      );

      setSelectedCourseIds(currentCampusIds.length > 0 ? currentCampusIds : (initialCourseId ? [initialCourseId] : []));
      setSelectedOtherCampusCourseIds(otherCampusIds);
      setSyncWithOtherCampus(otherCampusIds.length > 0);
      setApplyScope('current');
    } else {
      // New activity
      const defaultCourseId = initialCourseId || currentCampusCourses[0]?.id || '';
      setTitle('');
      setDate(new Date().toISOString().split('T')[0]);
      setTime('14:00');
      const defaultType: ActivityType = isSharedMode ? 'Atividade colaborativa interdisciplinar' : 'Atividade regular';
      setActivityType(defaultType);
      setSelectedCourseIds(defaultCourseId ? [defaultCourseId] : []);
      setSelectedOtherCampusCourseIds([]);
      setSyncWithOtherCampus(false);
      setComplementaryText('');
      setAiSeed(0);
      setApplyScope('current');

      if (initialDroppedImage) {
        setPhotos([
          {
            id: `p-${Date.now()}`,
            url: initialDroppedImage,
            caption: 'Registro fotográfico da atividade',
            fit: 'cover',
          },
        ]);
      } else {
        setPhotos([]);
      }

      generateActivityObjective(defaultType, date, time, 0).then((text) => {
        setObjective(text);
      });
    }
  }, [isOpen, editingActivity, initialCourseId, isSharedMode, initialDroppedImage, currentCampus]);

  if (!isOpen) return null;

  // Handle image files upload
  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const fileArray = Array.from(files);
    fileArray.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const url = e.target?.result as string;
        if (url) {
          if (replaceIndexRef.current !== null) {
            // Replace photo at specific index
            const idx = replaceIndexRef.current;
            setPhotos((prev) => {
              const updated = [...prev];
              if (updated[idx]) {
                updated[idx] = { ...updated[idx], url };
              }
              return updated;
            });
            replaceIndexRef.current = null;
          } else {
            // Add new photo
            setPhotos((prev) => [
              ...prev,
              {
                id: `p-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                url,
                caption: 'Registro fotográfico da atividade',
                fit: 'cover',
              },
            ]);
          }
        }
      };
      reader.readAsDataURL(file);
    });
  };

  // Re-generate AI Objective
  const handleRegenerateObjective = async () => {
    setIsGeneratingAI(true);
    const newSeed = aiSeed + 1;
    setAiSeed(newSeed);
    try {
      const text = await generateActivityObjective(activityType, date, time, newSeed);
      setObjective(text);
    } catch (e) {
      console.warn(e);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // When activity type changes, auto-update AI objective suggestion if not heavily customized
  const handleActivityTypeChange = async (newType: ActivityType) => {
    setActivityType(newType);
    if (['Atividade de sustentabilidade', 'Atividade de arrecadação', 'Atividade colaborativa interdisciplinar'].includes(newType)) {
      // Suggest sharing
    }
    const text = await generateActivityObjective(newType, date, time, aiSeed);
    setObjective(text);
  };

  // Photo ordering actions
  const handleMovePhoto = (fromIndex: number, direction: 'left' | 'right') => {
    const toIndex = direction === 'left' ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= photos.length) return;
    const updated = [...photos];
    const temp = updated[fromIndex];
    updated[fromIndex] = updated[toIndex];
    updated[toIndex] = temp;
    setPhotos(updated);
  };

  const handleDeletePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleTriggerReplace = (index: number) => {
    replaceIndexRef.current = index;
    fileInputRef.current?.click();
  };

  const toggleCurrentCampusCourse = (courseId: string) => {
    setSelectedCourseIds((prev) => {
      if (prev.includes(courseId)) {
        if (prev.length === 1 && !syncWithOtherCampus) return prev;
        return prev.filter((id) => id !== courseId);
      } else {
        return [...prev, courseId];
      }
    });
  };

  const toggleOtherCampusCourse = (courseId: string) => {
    setSelectedOtherCampusCourseIds((prev) =>
      prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalCourseIds = [
      ...selectedCourseIds,
      ...(syncWithOtherCampus ? selectedOtherCampusCourseIds : []),
    ];

    if (finalCourseIds.length === 0) {
      alert('Selecione pelo menos um Book/Curso para vincular esta atividade.');
      return;
    }

    const originalCampus = editingActivity?.primaryCampus || currentCampus;
    const finalSyncedCampuses: CampusId[] = syncWithOtherCampus
      ? ['curitiba', 'fatec']
      : [originalCampus];

    const activityData: ActivityItem = {
      id: editingActivity ? editingActivity.id : `act-${Date.now()}`,
      title: title.trim() || `Atividade de ${activityType}`,
      date,
      time,
      activityType,
      objective: objective.trim(),
      complementaryText: complementaryText.trim(),
      photos,
      targetCourseIds: finalCourseIds,
      primaryCampus: originalCampus,
      syncedCampuses: finalSyncedCampuses,
      isShared: finalCourseIds.length > 1,
      createdAt: editingActivity ? editingActivity.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSaveActivity(activityData, applyScope === 'all');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-3xl w-full overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {editingActivity ? 'Editar Atividade' : isSharedMode ? 'Nova Atividade Compartilhada entre Cursos' : '+ Nova Atividade'}
            </h3>
            <p className="text-xs text-slate-500">
              Organização automática de fotos, datas, horários e objetivo institucional
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-5 text-xs flex-1">
          {/* 1. LARGE WHITE DRAG AND DROP UPLOAD ZONE */}
          <div>
            <label className="font-bold text-slate-800 block mb-1.5">
              Imagens da Atividade:
            </label>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => handleFiles(e.target.files)}
              className="hidden"
            />

            {/* Drop Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingOver(true);
              }}
              onDragLeave={() => setIsDraggingOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDraggingOver(false);
                handleFiles(e.dataTransfer.files);
              }}
              onClick={() => {
                replaceIndexRef.current = null;
                fileInputRef.current?.click();
              }}
              className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                isDraggingOver
                  ? 'border-[#00A3E0] bg-sky-50/60 scale-[0.99]'
                  : 'border-slate-300 bg-white hover:border-[#00A3E0] hover:bg-slate-50/50'
              }`}
            >
              <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-[#00A3E0] mb-3 shadow-xs">
                <UploadCloud className="w-7 h-7" />
              </div>
              <span className="text-sm font-bold text-slate-800">
                Arraste uma imagem aqui
              </span>
              <span className="text-xs text-slate-500 mt-1">
                ou <strong className="text-[#004B8D] font-semibold underline">Clique para selecionar uma imagem</strong> do computador
              </span>
            </div>

            {/* Photos Preview & Ordering List (Drag/Move left/right, Replace, Delete) */}
            {photos.length > 0 && (
              <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-slate-700">
                    Fotos da Atividade ({photos.length}) — Ordem de Apresentação no Book:
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      replaceIndexRef.current = null;
                      fileInputRef.current?.click();
                    }}
                    className="inline-flex items-center gap-1 text-[11px] text-[#004B8D] font-bold hover:underline"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Adicionar mais foto</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {photos.map((photo, idx) => (
                    <div
                      key={photo.id}
                      className="group relative rounded-md overflow-hidden border border-slate-300 bg-white shadow-xs flex flex-col justify-between"
                    >
                      <div className="relative aspect-4/3 overflow-hidden bg-slate-100">
                        <img
                          src={photo.url}
                          alt={photo.caption || 'Foto'}
                          className="w-full h-full object-cover"
                        />
                        {/* Order badge */}
                        <div className="absolute top-1 left-1 bg-black/70 text-white font-mono font-bold text-[9px] px-1.5 py-0.5 rounded">
                          #{idx + 1}
                        </div>

                        {/* Quick action buttons overlay */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMovePhoto(idx, 'left')}
                            title="Mover para a esquerda"
                            className="p-1 rounded bg-white text-slate-800 hover:bg-slate-100 disabled:opacity-30"
                          >
                            <ArrowLeft className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTriggerReplace(idx)}
                            title="Substituir imagem"
                            className="px-1.5 py-1 rounded bg-white text-[10px] font-bold text-slate-800 hover:bg-slate-100"
                          >
                            Trocar
                          </button>
                          <button
                            type="button"
                            disabled={idx === photos.length - 1}
                            onClick={() => handleMovePhoto(idx, 'right')}
                            title="Mover para a direita"
                            className="p-1 rounded bg-white text-slate-800 hover:bg-slate-100 disabled:opacity-30"
                          >
                            <ArrowRight className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePhoto(idx)}
                            title="Excluir foto"
                            className="p-1 rounded bg-red-600 text-white hover:bg-red-700"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      <div className="p-1">
                        <input
                          type="text"
                          value={photo.caption || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPhotos((prev) =>
                              prev.map((p, pIdx) => (pIdx === idx ? { ...p, caption: val } : p))
                            );
                          }}
                          placeholder="Legenda da foto..."
                          className="w-full text-[10px] text-slate-600 bg-transparent focus:outline-hidden truncate"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 2. ACTIVITY DETAILS: DATA, HORÁRIO, TIPO DE ATIVIDADE */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Title / Nome da atividade */}
            <div className="sm:col-span-3">
              <label className="font-bold text-slate-800 block mb-1">
                Título ou Identificação da Atividade:
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Aula Prática de Laboratório, Oficina de Sustentabilidade..."
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#00A3E0]"
              />
            </div>

            {/* Data */}
            <div>
              <label className="font-bold text-slate-800 block mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[#00A3E0]" />
                <span>Data:</span>
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#00A3E0] bg-white font-mono"
              />
            </div>

            {/* Horário */}
            <div>
              <label className="font-bold text-slate-800 block mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#00A3E0]" />
                <span>Horário:</span>
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#00A3E0] bg-white font-mono"
              />
            </div>

            {/* Tipo de Atividade (Specific options requested by user) */}
            <div>
              <label className="font-bold text-slate-800 block mb-1">
                Tipo de atividade:
              </label>
              <select
                value={activityType}
                onChange={(e) => handleActivityTypeChange(e.target.value as ActivityType)}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#00A3E0] bg-white font-medium text-slate-800"
              >
                <option value="Atividade de sustentabilidade">Atividade de sustentabilidade</option>
                <option value="Atividade de arrecadação">Atividade de arrecadação</option>
                <option value="Atividade colaborativa interdisciplinar">Atividade colaborativa interdisciplinar</option>
                <option value="Atividade regular">Atividade regular</option>
              </select>
            </div>
          </div>

          {/* 3. OBJETIVO DA VISITA GERADO POR IA (EDITABLE, COM BOTÃO ✨ GERAR NOVAMENTE) */}
          <div className="bg-sky-50/60 border border-[#00A3E0]/40 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#004B8D] flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#00A3E0]" />
                <span>Objetivo da Atividade (Sugerido por IA ~2 linhas):</span>
              </span>

              <button
                type="button"
                onClick={handleRegenerateObjective}
                disabled={isGeneratingAI}
                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white hover:bg-sky-100 text-[#004B8D] font-bold text-[11px] border border-sky-200 transition-colors shadow-2xs"
              >
                <RefreshCw className={`w-3 h-3 ${isGeneratingAI ? 'animate-spin' : ''}`} />
                <span>✨ Gerar novamente</span>
              </button>
            </div>

            <textarea
              rows={3}
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="O objetivo da atividade será inserido aqui automaticamente..."
              className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 leading-relaxed focus:outline-hidden focus:ring-2 focus:ring-[#00A3E0] resize-none"
            />
            <p className="text-[10px] text-slate-500">
              Texto editável livremente. O usuário pode alterar completamente o objetivo conforme a prática realizada.
            </p>
          </div>

          {/* 4. SELEÇÃO DO BOOK & SINCRONIZAÇÃO ENTRE AMBIENTES */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#00A3E0]" />
                <span>Ambiente Atual: <strong>{currentCampus === 'curitiba' ? 'CURITIBA' : 'FATEC'}</strong></span>
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                {currentCampusCourses.length} cursos disponíveis
              </span>
            </div>

            {/* Courses of CURRENT campus */}
            <div>
              <span className="text-[11px] font-bold text-slate-700 block mb-1.5">
                Books de {currentCampus === 'curitiba' ? 'Curitiba' : 'FATEC'} que receberão esta atividade:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {currentCampusCourses.map((c) => {
                  const isChecked = selectedCourseIds.includes(c.id);
                  return (
                    <label
                      key={c.id}
                      className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
                        isChecked
                          ? 'border-[#00A3E0] bg-white font-semibold text-[#004B8D] shadow-2xs'
                          : 'border-slate-200 bg-white/60 text-slate-600 hover:bg-white'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleCurrentCampusCourse(c.id)}
                        className="rounded border-slate-300 text-[#004B8D] focus:ring-[#00A3E0]"
                      />
                      <span className="truncate">
                        Book: <strong>{c.name}</strong>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Optional Sincronização com o outro ambiente (FATEC ou Curitiba) */}
            <div className="pt-3 border-t border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800">
                  Sincronização com {otherCampus === 'curitiba' ? 'Curitiba' : 'FATEC'}:
                </span>
                <label className="flex items-center gap-1.5 cursor-pointer bg-white px-2.5 py-1 rounded-md border border-slate-300">
                  <input
                    type="checkbox"
                    checked={syncWithOtherCampus}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setSyncWithOtherCampus(checked);
                      if (checked && selectedOtherCampusCourseIds.length === 0 && otherCampusCourses.length > 0) {
                        setSelectedOtherCampusCourseIds([otherCampusCourses[0].id]);
                      }
                    }}
                    className="rounded text-[#004B8D] focus:ring-[#00A3E0]"
                  />
                  <span className="text-xs font-bold text-[#004B8D]">
                    Sincronizar com {otherCampus === 'curitiba' ? 'Curitiba' : 'FATEC'}
                  </span>
                </label>
              </div>

              {!syncWithOtherCampus ? (
                <p className="text-[11px] text-slate-500">
                  Por padrão, esta atividade permanecerá <strong>exclusivamente</strong> no ambiente {currentCampus === 'curitiba' ? 'Curitiba' : 'FATEC'}.
                </p>
              ) : (
                <div className="p-3 bg-sky-50/70 border border-[#00A3E0]/40 rounded-lg space-y-2">
                  <span className="text-[11px] font-bold text-[#004B8D] block">
                    Selecione os Books de {otherCampus === 'curitiba' ? 'Curitiba' : 'FATEC'} de destino:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {otherCampusCourses.length === 0 ? (
                      <p className="text-slate-400 italic text-[11px]">Nenhum curso cadastrado no polo {otherCampus}.</p>
                    ) : (
                      otherCampusCourses.map((oc) => {
                        const isChecked = selectedOtherCampusCourseIds.includes(oc.id);
                        return (
                          <label
                            key={oc.id}
                            className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
                              isChecked
                                ? 'border-[#00A3E0] bg-white font-bold text-[#004B8D] shadow-2xs'
                                : 'border-slate-200 bg-white/70 text-slate-600 hover:bg-white'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleOtherCampusCourse(oc.id)}
                              className="rounded border-slate-300 text-[#004B8D] focus:ring-[#00A3E0]"
                            />
                            <span className="truncate">
                              Book: <strong>{oc.name}</strong> ({otherCampus === 'curitiba' ? 'Curitiba' : 'FATEC'})
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Scope when editing a synced activity */}
            {editingActivity && (editingActivity.syncedCampuses?.length || 0) > 1 && (
              <div className="pt-3 border-t border-slate-200">
                <span className="font-bold text-slate-800 block mb-1">
                  Aplicar alteração:
                </span>
                <div className="flex items-center gap-4 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="apply_scope"
                      checked={applyScope === 'current'}
                      onChange={() => setApplyScope('current')}
                      className="text-[#004B8D] focus:ring-[#00A3E0]"
                    />
                    <span>Somente neste Book/Ambiente</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="apply_scope"
                      checked={applyScope === 'all'}
                      onChange={() => setApplyScope('all')}
                      className="text-[#004B8D] focus:ring-[#00A3E0]"
                    />
                    <span className="font-bold text-[#004B8D]">Em todos os Books sincronizados</span>
                  </label>
                </div>
              </div>
            )}
          </div>
        </form>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg transition-colors"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-[#004B8D] hover:bg-[#00386B] rounded-lg shadow-xs transition-colors"
          >
            <Check className="w-4 h-4 text-[#00A3E0]" />
            <span>{editingActivity ? 'Salvar Alterações' : 'Cadastrar Atividade no Book'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
