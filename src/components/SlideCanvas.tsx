import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, 
  Sparkles, 
  Trash2, 
  ArrowLeft,
  ArrowRight,
  Maximize2, 
  Minimize2, 
  Plus, 
  Upload, 
  Edit3, 
  Bold, 
  Italic, 
  Type, 
  Calendar,
  Clock,
  MapPin,
  Users2,
  BookOpen,
  Move,
  RefreshCw,
  Image as ImageIcon,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RotateCcw,
  Crop,
  Sliders,
  MessageSquare,
  Share2,
  Split,
  Copy,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Palette,
  Layers
} from 'lucide-react';
import { AcademicBook, SlideData, PhotoItem, PhotoLayout, PhotoFit, TextBoxElement, ActivityType } from '../types';
import { CAMPUS_CONFIGS, AREA_CONFIGS } from '../data/defaults';
import { generateActivityObjective } from '../utils/aiObjective';
import { EstacioLogo } from './EstacioLogo';
import { getCourseCoverImage, COURSE_COVER_LIBRARY } from '../utils/courseCovers';
import { uploadCoverImageToStorage } from '../services/storageService';
import { computePhotoLayout, SmartCompositionPreset } from '../utils/photoLayoutEngine';
import { Loader2 } from 'lucide-react';

interface SlideCanvasProps {
  book: AcademicBook;
  slide: SlideData;
  slideIndex: number;
  totalSlides: number;
  onUpdateSlide: (updated: Partial<SlideData>) => void;
  onTriggerNewActivityModal?: (droppedImage?: string) => void;
  onOpenSyncSlideModal?: (slide: SlideData) => void;
  onSplitSlidePhotos?: (slideId: string) => void;
}

export const SlideCanvas: React.FC<SlideCanvasProps> = ({
  book,
  slide,
  slideIndex,
  totalSlides,
  onUpdateSlide,
  onTriggerNewActivityModal,
  onOpenSyncSlideModal,
  onSplitSlidePhotos,
}) => {
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);
  const [selectedTextBoxId, setSelectedTextBoxId] = useState<string | null>(null);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [draggedPhotoIndex, setDraggedPhotoIndex] = useState<number | null>(null);
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [isCoverLibraryOpen, setIsCoverLibraryOpen] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);

  // Interactive Photo Transform state (Canva / Figma style direct canvas manipulation)
  const [photoTransformState, setPhotoTransformState] = useState<{
    photoId: string;
    type: 'pan' | 'resize-corner';
    corner?: 'tl' | 'tr' | 'bl' | 'br';
    startX: number;
    startY: number;
    initX: number;
    initY: number;
    initZoom: number;
    initScale?: number;
  } | null>(null);

  // Dragging text box state
  const [draggingBoxId, setDraggingBoxId] = useState<string | null>(null);
  const dragStartPos = useRef<{ mouseX: number; mouseY: number; boxX: number; boxY: number } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const replacePhotoIndexRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const campus = CAMPUS_CONFIGS[book.campus] || CAMPUS_CONFIGS.curitiba;

  // Global Mouse Move and Mouse Up for Interactive Photo Transformations
  useEffect(() => {
    if (!photoTransformState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - photoTransformState.startX;
      const deltaY = e.clientY - photoTransformState.startY;

      const currentPhotos = slide.photos || [];
      const targetPhoto = currentPhotos.find((p) => p.id === photoTransformState.photoId);
      if (!targetPhoto) return;

      if (photoTransformState.type === 'pan') {
        const deltaPercentX = Math.round(deltaX * 0.25);
        const deltaPercentY = Math.round(deltaY * 0.25);
        const newX = Math.max(-100, Math.min(100, photoTransformState.initX + deltaPercentX));
        const newY = Math.max(-100, Math.min(100, photoTransformState.initY + deltaPercentY));

        const updated = currentPhotos.map((p) =>
          p.id === photoTransformState.photoId ? { ...p, x: newX, y: newY } : p
        );
        onUpdateSlide({ photos: updated });
      } else if (photoTransformState.type === 'resize-corner') {
        let factor = 1;
        if (photoTransformState.corner === 'br' || photoTransformState.corner === 'tr') {
          factor = 1 + (deltaX + (photoTransformState.corner === 'br' ? deltaY : -deltaY)) * 0.005;
        } else {
          factor = 1 - (deltaX + (photoTransformState.corner === 'bl' ? -deltaY : deltaY)) * 0.005;
        }
        const newZoom = Math.max(0.4, Math.min(3.5, Number((photoTransformState.initZoom * factor).toFixed(2))));

        const updated = currentPhotos.map((p) =>
          p.id === photoTransformState.photoId ? { ...p, zoom: newZoom } : p
        );
        onUpdateSlide({ photos: updated });
      }
    };

    const handleMouseUp = () => {
      setPhotoTransformState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [photoTransformState, slide.photos, onUpdateSlide]);

  // Global paste (Ctrl+V) handler
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!e.clipboardData) return;
      const items = e.clipboardData.items;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
              const url = event.target?.result as string;
              if (url) {
                handleInsertPhoto(url);
              }
            };
            reader.readAsDataURL(file);
            e.preventDefault();
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [slide]);

  // Insert or Replace photo
  const handleInsertPhoto = (url: string) => {
    const currentPhotos = slide.photos ? [...slide.photos] : [];
    if (replacePhotoIndexRef.current !== null) {
      const idx = replacePhotoIndexRef.current;
      const updated = [...currentPhotos];
      if (updated[idx]) {
        updated[idx] = { ...updated[idx], url };
      }
      onUpdateSlide({ photos: updated });
      replacePhotoIndexRef.current = null;
    } else {
      const newPhoto: PhotoItem = {
        id: `p-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        url,
        caption: 'Registro fotográfico da atividade',
        fit: 'cover',
      };
      onUpdateSlide({ photos: [...currentPhotos, newPhoto] });
      setActivePhotoId(newPhoto.id);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const url = event.target?.result as string;
        if (url) {
          handleInsertPhoto(url);
        }
      };
      reader.readAsDataURL(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Reorder photos with drag & drop or arrows
  const handleMovePhoto = (fromIndex: number, direction: 'left' | 'right') => {
    const toIndex = direction === 'left' ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= (slide.photos?.length || 0)) return;
    const updated = [...(slide.photos || [])];
    const temp = updated[fromIndex];
    updated[fromIndex] = updated[toIndex];
    updated[toIndex] = temp;
    onUpdateSlide({ photos: updated });
  };

  const handleDeletePhoto = (photoId: string) => {
    const updated = (slide.photos || []).filter((p) => p.id !== photoId);
    onUpdateSlide({ photos: updated });
    if (activePhotoId === photoId) setActivePhotoId(null);
  };

  const handleToggleFit = (photoId: string) => {
    const updated = (slide.photos || []).map((p) => {
      if (p.id === photoId) {
        return {
          ...p,
          fit: (p.fit === 'contain' ? 'cover' : 'contain') as PhotoFit,
        };
      }
      return p;
    });
    onUpdateSlide({ photos: updated });
  };

  const handleUpdatePhoto = (photoId: string, props: Partial<PhotoItem>) => {
    const currentPhotos = slide.photos ? [...slide.photos] : [];
    const updated = currentPhotos.map((p) => (p.id === photoId ? { ...p, ...props } : p));
    onUpdateSlide({ photos: updated });
  };

  const handleZoomPhoto = (photoId: string, delta: number) => {
    const currentPhotos = slide.photos ? [...slide.photos] : [];
    const photo = currentPhotos.find((p) => p.id === photoId);
    if (!photo) return;
    const currentZoom = photo.zoom || 1;
    const newZoom = Math.max(0.4, Math.min(3.5, Number((currentZoom + delta).toFixed(2))));
    handleUpdatePhoto(photoId, { zoom: newZoom });
  };

  const handleRotatePhoto = (photoId: string) => {
    const currentPhotos = slide.photos ? [...slide.photos] : [];
    const photo = currentPhotos.find((p) => p.id === photoId);
    if (!photo) return;
    const currentRotation = photo.rotation || 0;
    const newRotation = (currentRotation + 90) % 360;
    handleUpdatePhoto(photoId, { rotation: newRotation });
  };

  const handleResetPhoto = (photoId: string) => {
    handleUpdatePhoto(photoId, {
      zoom: 1,
      scale: 1,
      x: 0,
      y: 0,
      rotation: 0,
      cropX: 50,
      cropY: 50,
      fit: 'cover',
      position: 'center',
      aspectRatio: 'auto',
    });
  };

  const handleStartPhotoResize = (e: React.MouseEvent, photo: PhotoItem, corner: 'tl' | 'tr' | 'bl' | 'br') => {
    e.stopPropagation();
    e.preventDefault();
    setActivePhotoId(photo.id);
    setPhotoTransformState({
      photoId: photo.id,
      type: 'resize-corner',
      corner,
      startX: e.clientX,
      startY: e.clientY,
      initX: photo.x || 0,
      initY: photo.y || 0,
      initZoom: photo.zoom || 1,
      initScale: photo.scale || 1,
    });
  };

  const handleStartPhotoPan = (e: React.MouseEvent, photo: PhotoItem) => {
    e.stopPropagation();
    setActivePhotoId(photo.id);
    setPhotoTransformState({
      photoId: photo.id,
      type: 'pan',
      startX: e.clientX,
      startY: e.clientY,
      initX: photo.x || 0,
      initY: photo.y || 0,
      initZoom: photo.zoom || 1,
      initScale: photo.scale || 1,
    });
  };

  const handleRegenerateObjective = async () => {
    setIsGeneratingAI(true);
    try {
      const type = slide.activityType || 'Atividade regular';
      const text = await generateActivityObjective(type, slide.date, slide.time, Date.now());
      onUpdateSlide({
        objective: text,
        evidenceMeta: slide.evidenceMeta
          ? { ...slide.evidenceMeta, actionsReport: text }
          : undefined,
      });
    } catch (e) {
      console.warn(e);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // FREE TEXT BOXES & HIGHLIGHT BALLOONS (POWERPOINT STYLE - REQUISITO 3)
  const handleAddTextBox = () => {
    const newBox: TextBoxElement = {
      id: `tb-${Date.now()}`,
      text: 'Clique para editar este texto',
      x: 35,
      y: 40,
      width: 35,
      fontSize: 14,
      bold: false,
      italic: false,
      align: 'left',
      color: '#0F172A',
      backgroundColor: '#FFFFFF',
      borderColor: '#CBD5E1',
      borderWidth: 1,
      borderRadius: 6,
      padding: 8,
      isBalloon: false,
    };
    const currentBoxes = slide.customTextBoxes || [];
    onUpdateSlide({ customTextBoxes: [...currentBoxes, newBox] });
    setSelectedTextBoxId(newBox.id);
  };

  const handleAddBalloon = () => {
    const newBalloon: TextBoxElement = {
      id: `balloon-${Date.now()}`,
      text: '💡 Destaque ou observação importante da aula prática',
      x: 40,
      y: 30,
      width: 32,
      fontSize: 13,
      bold: false,
      italic: false,
      align: 'left',
      color: '#92400E',
      backgroundColor: '#FEF3C7',
      borderColor: '#F59E0B',
      borderWidth: 1.5,
      borderRadius: 10,
      padding: 10,
      isBalloon: true,
      balloonPosition: 'bottom',
    };
    const currentBoxes = slide.customTextBoxes || [];
    onUpdateSlide({ customTextBoxes: [...currentBoxes, newBalloon] });
    setSelectedTextBoxId(newBalloon.id);
  };

  const handleDuplicateTextBox = (id: string) => {
    const currentBoxes = slide.customTextBoxes || [];
    const source = currentBoxes.find((b) => b.id === id);
    if (!source) return;
    const duplicated: TextBoxElement = {
      ...source,
      id: `tb-dup-${Date.now()}`,
      x: Math.min(80, source.x + 3),
      y: Math.min(80, source.y + 4),
    };
    onUpdateSlide({ customTextBoxes: [...currentBoxes, duplicated] });
    setSelectedTextBoxId(duplicated.id);
  };

  const handleConvertToFloatingBalloon = (title: string, text: string) => {
    if (!text) return;
    const newBalloon: TextBoxElement = {
      id: `balloon-conv-${Date.now()}`,
      text: `${title}: ${text}`,
      x: 25,
      y: 35,
      width: 45,
      fontSize: 13,
      bold: false,
      italic: false,
      align: 'left',
      color: '#004B8D',
      backgroundColor: '#F0F9FF',
      borderColor: '#00A3E0',
      borderWidth: 1.5,
      borderRadius: 8,
      padding: 10,
      isBalloon: true,
      balloonPosition: 'bottom',
    };
    const currentBoxes = slide.customTextBoxes || [];
    onUpdateSlide({ customTextBoxes: [...currentBoxes, newBalloon] });
    setSelectedTextBoxId(newBalloon.id);
  };

  const handleUpdateTextBox = (id: string, updatedProps: Partial<TextBoxElement>) => {
    const currentBoxes = slide.customTextBoxes || [];
    const updated = currentBoxes.map((box) => (box.id === id ? { ...box, ...updatedProps } : box));
    onUpdateSlide({ customTextBoxes: updated });
  };

  const handleDeleteTextBox = (id: string) => {
    const currentBoxes = slide.customTextBoxes || [];
    onUpdateSlide({ customTextBoxes: currentBoxes.filter((b) => b.id !== id) });
    if (selectedTextBoxId === id) setSelectedTextBoxId(null);
  };

  // Dragging text box movement
  const startDragBox = (e: React.MouseEvent, box: TextBoxElement) => {
    e.stopPropagation();
    setDraggingBoxId(box.id);
    dragStartPos.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      boxX: box.x,
      boxY: box.y,
    };
  };

  // Resizing text box width
  const [resizingBoxId, setResizingBoxId] = useState<string | null>(null);
  const resizeBoxStartRef = useRef<{ mouseX: number; initWidth: number } | null>(null);

  const startResizeBox = (e: React.MouseEvent, box: TextBoxElement) => {
    e.stopPropagation();
    setResizingBoxId(box.id);
    resizeBoxStartRef.current = {
      mouseX: e.clientX,
      initWidth: box.width,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();

      if (draggingBoxId && dragStartPos.current) {
        const deltaXPercent = ((e.clientX - dragStartPos.current.mouseX) / rect.width) * 100;
        const deltaYPercent = ((e.clientY - dragStartPos.current.mouseY) / rect.height) * 100;

        const newX = Math.max(2, Math.min(85, dragStartPos.current.boxX + deltaXPercent));
        const newY = Math.max(5, Math.min(85, dragStartPos.current.boxY + deltaYPercent));

        handleUpdateTextBox(draggingBoxId, { x: Math.round(newX), y: Math.round(newY) });
      }

      if (resizingBoxId && resizeBoxStartRef.current) {
        const deltaWPercent = ((e.clientX - resizeBoxStartRef.current.mouseX) / rect.width) * 100;
        const newW = Math.max(15, Math.min(85, resizeBoxStartRef.current.initWidth + deltaWPercent));
        handleUpdateTextBox(resizingBoxId, { width: Math.round(newW) });
      }
    };

    const handleMouseUp = () => {
      setDraggingBoxId(null);
      dragStartPos.current = null;
      setResizingBoxId(null);
      resizeBoxStartRef.current = null;
    };

    if (draggingBoxId || resizingBoxId) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingBoxId, resizingBoxId]);

  return (
    <div
      className="flex-1 overflow-auto bg-slate-200/60 p-4 sm:p-6 lg:p-8 flex flex-col items-center justify-start min-h-[calc(100vh-53px)] select-none"
      onClick={() => {
        setSelectedElement(null);
        setActivePhotoId(null);
        setSelectedTextBoxId(null);
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* TOP CANVAS CONTROLS (Add Text Box, Insert Photo, Change Layout) */}
      <div className="no-print mb-3 h-10 w-full max-w-5xl flex items-center justify-between px-3 py-1.5 bg-white rounded-lg border border-slate-300 shadow-2xs text-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-800">Slide #{slideIndex}</span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-500 font-medium">Tipo:</span>
          <span className="font-semibold text-[#004B8D] capitalize">{slide.type}</span>

          {slide.type === 'evidencia' && (
            <div className="hidden sm:flex items-center gap-1 bg-slate-100 p-0.5 rounded-md ml-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase px-1">Layout:</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateSlide({ photoLayout: 'auto' });
                }}
                title="Composição fotográfica adaptativa inteligente (proporcional, sem distorção)"
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  !slide.photoLayout || slide.photoLayout === 'auto'
                    ? 'bg-white text-[#004B8D] font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Auto ✨
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateSlide({ photoLayout: 'editorial' });
                }}
                title="Composição Editorial (1 foto principal em destaque + secundárias)"
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  slide.photoLayout === 'editorial'
                    ? 'bg-white text-[#004B8D] font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Editorial
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateSlide({ photoLayout: 'side-by-side' });
                }}
                title="Colunas Lado a Lado proporcionais"
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  slide.photoLayout === 'side-by-side' || slide.photoLayout === 'split-50-50'
                    ? 'bg-white text-[#004B8D] font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Lado a Lado
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateSlide({ photoLayout: 'stacked' });
                }}
                title="Fotos empilhadas horizontalmente"
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  slide.photoLayout === 'stacked'
                    ? 'bg-white text-[#004B8D] font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Empilhado
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateSlide({ photoLayout: 'grid' });
                }}
                title="Grade balanceada 2x2 ou mosaico"
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  slide.photoLayout === 'grid' || slide.photoLayout === 'grid-3'
                    ? 'bg-white text-[#004B8D] font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Grade
              </button>
            </div>
          )}
        </div>

        {/* Action buttons on canvas */}
        <div className="flex items-center gap-1.5">
          {/* Synchronize Slide with other books (Requisito 4) */}
          {onOpenSyncSlideModal && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenSyncSlideModal(slide);
              }}
              title="Sincronizar este slide com outros books de evidências da instituição"
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold border transition-colors ${
                slide.isShared || (slide.syncedBookIds && slide.syncedBookIds.length > 0)
                  ? 'bg-sky-50 text-[#00A3E0] border-sky-300 font-bold'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
              }`}
            >
              <Share2 className="w-3.5 h-3.5 text-[#00A3E0]" />
              <span>{slide.isShared ? 'Sincronizado' : 'Sincronizar'}</span>
            </button>
          )}

          {/* Add Free Text Box button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleAddTextBox();
            }}
            title="Criar nova caixa de texto livre (estilo PowerPoint)"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold transition-colors"
          >
            <Type className="w-3.5 h-3.5 text-[#004B8D]" />
            <span>+ Texto</span>
          </button>

          {/* Add Balloon button (Requisito 3) */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleAddBalloon();
            }}
            title="Criar balão de destaque ou etiqueta (com cauda e formato editável)"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-semibold transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5 text-amber-600" />
            <span>+ Balão</span>
          </button>

          {/* Insert Photo button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              replacePhotoIndexRef.current = null;
              fileInputRef.current?.click();
            }}
            title="Adicionar foto ao slide ou colar com Ctrl+V"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#004B8D] hover:bg-[#00386B] text-white font-bold transition-colors"
          >
            <Camera className="w-3.5 h-3.5 text-[#00A3E0]" />
            <span>Inserir Foto</span>
          </button>
        </div>
      </div>

      {/* 16:9 SLIDE VIEWPORT CONTAINER */}
      <div
        ref={canvasRef}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDraggingCanvas(true);
        }}
        onDragLeave={() => setIsDraggingCanvas(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDraggingCanvas(false);
          const files = e.dataTransfer.files;
          if (files && files.length > 0) {
            handleFileUpload({ target: { files } } as any);
          }
        }}
        className={`slide-print-page w-full max-w-5xl aspect-16/9 bg-white rounded-xl shadow-xl border border-slate-300 relative flex flex-col justify-between overflow-hidden select-none transition-all ${
          isDraggingCanvas ? 'ring-4 ring-[#00A3E0] scale-[0.99]' : ''
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top cyan bar (Institucional h-1.5 bg-[#00A3E0]) */}
        <div className="h-1.5 bg-[#00A3E0] shrink-0 w-full" />

        {/* SLIDE 01: CAPA DO BOOK (NOVO DESIGN: AZUL COM DEGRADÊ E IMAGEM INTEGRADA) */}
        {slide.type === 'capa' && (() => {
          const customDataUrl = [slide.photos[0]?.url, book.coverImage].find(
            (url) => url && typeof url === 'string' && url.startsWith('data:')
          );
          const capaCoverUrl =
            customDataUrl ||
            book.coverImage ||
            slide.photos[0]?.url ||
            getCourseCoverImage(book.courseName, book.academicArea);
          const coverPhoto = slide.photos[0];
          const coverPos = coverPhoto?.position || 'center';
          const coverZoom = coverPhoto?.zoom || 1;

          const updateCoverProps = (props: Partial<PhotoItem>) => {
            const finalUrl = props.url || capaCoverUrl;
            const updatedPhoto: PhotoItem = {
              id: coverPhoto?.id || `cover-photo-${Date.now()}`,
              url: finalUrl,
              caption: `Capa Oficial · ${book.courseName}`,
              fit: 'cover',
              position: coverPos,
              zoom: coverZoom,
              ...props,
            };
            onUpdateSlide({ photos: [updatedPhoto] });
          };

          return (
            <div className="relative flex-1 bg-[#001D3D] text-white flex flex-col justify-between overflow-hidden select-text">
              {/* CAMADA 1 & 2: IMAGEM REPRESENTATIVA INTEGRADA NO LADO DIREITO (SEM BORDA DE CARD) */}
              <div 
                onMouseDown={(e) => coverPhoto && handleStartPhotoPan(e, coverPhoto)}
                className="absolute top-0 bottom-0 right-0 w-3/5 sm:w-2/3 overflow-hidden cursor-grab active:cursor-grabbing select-none"
                title="Arraste para enquadrar a imagem da capa"
              >
                <img
                  src={capaCoverUrl}
                  alt={`Capa de ${book.courseName}`}
                  draggable={false}
                  className={`w-full h-full object-cover transition-transform duration-75 select-none pointer-events-none ${
                    coverPos === 'top' ? 'object-top' :
                    coverPos === 'bottom' ? 'object-bottom' :
                    coverPos === 'left' ? 'object-left' :
                    coverPos === 'right' ? 'object-right' : 'object-center'
                  }`}
                  style={{
                    transform: `scale(${coverZoom}) translate(${coverPhoto?.x || 0}%, ${coverPhoto?.y || 0}%) rotate(${coverPhoto?.rotation || 0}deg)`,
                    transformOrigin: coverPos === 'top' ? 'top center' : coverPos === 'bottom' ? 'bottom center' : 'center center',
                  }}
                />
              </div>

              {/* CAMADA 3: DEGRADÊ AZUL INSTITUCIONAL SUAVE COM TRANSPARÊNCIA PROGRESSIVA */}
              <div 
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'linear-gradient(90deg, #001D3D 0%, #001D3D 36%, rgba(0,29,61,0.95) 50%, rgba(0,29,61,0.72) 65%, rgba(0,29,61,0.25) 85%, rgba(0,29,61,0.08) 100%)'
                }}
              />
              {/* Vignette suave vertical para garantir contraste nos textos do cabeçalho e rodapé */}
              <div 
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'linear-gradient(180deg, rgba(0,29,61,0.65) 0%, rgba(0,29,61,0) 25%, rgba(0,29,61,0) 70%, rgba(0,29,61,0.92) 100%)'
                }}
              />

              {/* BARRA DE FERRAMENTAS FLUTUANTE DE ENQUADRAMENTO DA CAPA */}
              <div className="no-print absolute top-3 right-3 z-30 flex items-center gap-1.5 bg-black/75 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/20 text-white text-[11px] shadow-lg">
                <label className="cursor-pointer flex items-center gap-1 hover:text-[#00A3E0] transition-colors font-semibold">
                  {isUploadingCover ? (
                    <RefreshCw className="w-3.5 h-3.5 text-[#00A3E0] animate-spin" />
                  ) : (
                    <ImageIcon className="w-3.5 h-3.5 text-[#00A3E0]" />
                  )}
                  <span>{isUploadingCover ? 'Enviando...' : 'Substituir'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={isUploadingCover}
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        try {
                          setIsUploadingCover(true);
                          const url = await uploadCoverImageToStorage(file, `book_${book.id}_cover`);
                          if (url) updateCoverProps({ url });
                        } catch (err) {
                          console.error('Falha no upload da capa:', err);
                        } finally {
                          setIsUploadingCover(false);
                          e.target.value = '';
                        }
                      }
                    }}
                  />
                </label>
                <span className="text-white/30">|</span>

                <button
                  type="button"
                  onClick={() => setIsCoverLibraryOpen(!isCoverLibraryOpen)}
                  className={`flex items-center gap-1 hover:text-[#00A3E0] transition-colors font-semibold ${
                    isCoverLibraryOpen ? 'text-[#00A3E0]' : ''
                  }`}
                  title="Escolher foto na biblioteca institucional coerente com o curso"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Galeria</span>
                </button>
                <span className="text-white/30">|</span>
                
                {/* Posição / Enquadramento */}
                <span className="text-[10px] text-slate-300">Posição:</span>
                <select
                  value={coverPos}
                  onChange={(e) => updateCoverProps({ position: e.target.value as any })}
                  className="bg-black/40 border border-white/20 rounded px-1.5 py-0.5 text-[10px] text-white focus:outline-hidden"
                >
                  <option value="center" className="text-black">Centro</option>
                  <option value="top" className="text-black">Topo</option>
                  <option value="bottom" className="text-black">Base</option>
                  <option value="left" className="text-black">Esquerda</option>
                  <option value="right" className="text-black">Direita</option>
                </select>

                {/* Zoom */}
                <div className="flex items-center gap-0.5 ml-1">
                  <button
                    onClick={() => updateCoverProps({ zoom: Math.max(0.8, Number((coverZoom - 0.1).toFixed(2))) })}
                    title="Diminuir Zoom"
                    className="p-0.5 hover:bg-white/20 rounded text-slate-300 hover:text-white"
                  >
                    <ZoomOut className="w-3 h-3" />
                  </button>
                  <span className="font-mono text-[10px] w-8 text-center text-amber-300 font-bold">
                    {Math.round(coverZoom * 100)}%
                  </span>
                  <button
                    onClick={() => updateCoverProps({ zoom: Math.min(2.5, Number((coverZoom + 0.1).toFixed(2))) })}
                    title="Aumentar Zoom"
                    className="p-0.5 hover:bg-white/20 rounded text-slate-300 hover:text-white"
                  >
                    <ZoomIn className="w-3 h-3" />
                  </button>
                </div>

                {/* Reset */}
                <button
                  onClick={() => updateCoverProps({ zoom: 1, x: 0, y: 0, position: 'center', rotation: 0 })}
                  title="Redefinir enquadramento"
                  className="p-1 hover:bg-white/20 rounded text-slate-400 hover:text-white ml-0.5"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              </div>

              {/* POPOVER DA BIBLIOTECA DE IMAGENS DO CURSO */}
              {isCoverLibraryOpen && (
                <div 
                  className="no-print absolute top-14 right-3 z-40 bg-[#001D3D]/95 border border-[#00A3E0]/40 rounded-xl p-3 shadow-2xl backdrop-blur-md max-w-sm text-left"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between pb-2 border-b border-white/10 mb-2">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      Fotos Temáticas para {book.courseName}
                    </span>
                    <button
                      onClick={() => setIsCoverLibraryOpen(false)}
                      className="text-slate-400 hover:text-white text-xs font-bold px-1"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                    {COURSE_COVER_LIBRARY.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => {
                          updateCoverProps({ url: item.url });
                          setIsCoverLibraryOpen(false);
                        }}
                        className={`group cursor-pointer rounded-lg overflow-hidden border transition-all ${
                          capaCoverUrl === item.url
                            ? 'border-[#00A3E0] ring-2 ring-[#00A3E0]'
                            : 'border-white/20 hover:border-[#00A3E0]'
                        }`}
                      >
                        <div className="aspect-16/9 bg-black/40 relative">
                          <img
                            src={item.url}
                            alt={item.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        </div>
                        <div className="p-1 bg-[#002663] text-[9.5px] text-slate-200 truncate font-medium">
                          {item.title.split('/')[0]}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* CAMADA 4 & 5: CONTEÚDO, TEXTOS E ELEMENTOS INSTITUCIONAIS */}
              <div className="relative z-20 flex-1 p-6 sm:p-10 flex flex-col justify-between">
                {/* Cabeçalho: Logo Oficial da Estácio + Identificação do Campus e Período */}
                <div className="flex items-center justify-between border-b border-white/15 pb-4 gap-4">
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="bg-white px-3.5 py-1.5 rounded-lg shadow-sm flex items-center shrink-0 min-w-max">
                      <EstacioLogo size="md" />
                    </div>
                    <div className="border-l border-white/25 pl-3">
                      <input
                        type="text"
                        value={slide.customText1 || campus.fullName}
                        onChange={(e) => onUpdateSlide({ customText1: e.target.value })}
                        className="bg-transparent text-xs uppercase tracking-wider text-[#00A3E0] font-extrabold focus:outline-hidden border-b border-transparent hover:border-white/30 focus:border-[#00A3E0] transition-colors"
                        placeholder="Nome da Instituição / Campus..."
                      />
                      <div className="text-[11px] text-slate-300">
                        {campus.badge} · {campus.city}
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#003264]/90 border border-[#00A3E0] px-3.5 py-1 rounded-lg text-xs font-mono font-bold text-white shadow-2xs">
                    PERÍODO {book.period}
                  </div>
                </div>

                {/* Região Central / Esquerda: Título Principal, Subtítulo e Curso */}
                <div className="my-auto py-4 max-w-2xl space-y-3.5">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#00A3E0]/20 border border-[#00A3E0] rounded text-[#00A3E0] font-extrabold text-xs uppercase tracking-wider shadow-2xs backdrop-blur-xs">
                    <span>Curso:</span>
                    <span className="text-white">{book.courseName}</span>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-bold text-[#00A3E0] block mb-0.5 tracking-wider">
                      Título do Book (clique para editar)
                    </label>
                    <input
                      type="text"
                      value={slide.title}
                      onChange={(e) => onUpdateSlide({ title: e.target.value })}
                      className="w-full bg-transparent font-extrabold text-3xl sm:text-4xl text-white tracking-tight focus:outline-hidden border-b border-transparent hover:border-white/20 focus:border-[#00A3E0] pb-1 transition-colors leading-tight"
                      placeholder="Book de Evidências Acadêmicas..."
                    />
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-300 block mb-0.5 tracking-wider">
                      Subtítulo do Relatório (clique para editar)
                    </label>
                    <textarea
                      rows={2}
                      value={slide.subtitle || ''}
                      onChange={(e) => onUpdateSlide({ subtitle: e.target.value })}
                      className="w-full bg-transparent text-sm sm:text-base text-slate-200 focus:outline-hidden border-b border-transparent hover:border-white/20 focus:border-[#00A3E0] pb-1 transition-colors leading-relaxed resize-none"
                      placeholder="Registro Institucional de Atividades, Práticas Laboratoriais e Projetos..."
                    />
                  </div>
                </div>

                {/* Ficha Técnica no Rodapé: Totalmente Editável */}
                <div className="bg-[#002B52]/90 backdrop-blur-md border border-white/15 rounded-xl p-3.5 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs shadow-lg">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#00A3E0] block mb-0.5">
                      Curso / Habilitação
                    </span>
                    <input
                      type="text"
                      value={slide.customText1 !== undefined ? slide.customText1 : book.courseName}
                      onChange={(e) => onUpdateSlide({ customText1: e.target.value })}
                      placeholder="Nome do Curso..."
                      className="w-full bg-transparent text-slate-100 font-semibold focus:outline-hidden border-b border-transparent hover:border-white/30 focus:border-[#00A3E0] transition-colors truncate"
                      title="Clique para editar o nome do curso na capa"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#00A3E0] block mb-0.5">
                      Período Letivo
                    </span>
                    <input
                      type="text"
                      value={slide.date || book.period}
                      onChange={(e) => onUpdateSlide({ date: e.target.value })}
                      placeholder="2026.1"
                      className="w-full bg-transparent text-slate-100 font-mono font-bold focus:outline-hidden border-b border-transparent hover:border-white/30 focus:border-[#00A3E0] transition-colors"
                      title="Clique para editar o período letivo na capa"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#00A3E0] block mb-0.5">
                      Coordenação de Curso
                    </span>
                    <input
                      type="text"
                      value={slide.customText2 !== undefined ? slide.customText2 : (book.coordinator || '')}
                      onChange={(e) => onUpdateSlide({ customText2: e.target.value })}
                      placeholder="Nome do(a) Coordenador(a)..."
                      className="w-full bg-transparent text-slate-100 focus:outline-hidden border-b border-transparent hover:border-white/30 focus:border-[#00A3E0] transition-colors truncate"
                      title="Clique para editar a coordenação"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#00A3E0] block mb-0.5">
                      Campus / Direção
                    </span>
                    <input
                      type="text"
                      value={slide.footerCustomText !== undefined ? slide.footerCustomText : `${campus.fullName}`}
                      onChange={(e) => onUpdateSlide({ footerCustomText: e.target.value })}
                      placeholder="Unidade / Campus..."
                      className="w-full bg-transparent text-slate-100 focus:outline-hidden border-b border-transparent hover:border-white/30 focus:border-[#00A3E0] transition-colors truncate"
                      title="Clique para editar a unidade/direção"
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* SLIDE: EVIDÊNCIA ACADÊMICA COM FOTOS E METADADOS */}
        {slide.type === 'evidencia' && (
          <div className="flex-1 bg-white p-5 sm:p-7 flex flex-col justify-between relative">
            {/* Slide Header */}
            <div>
              <div className="flex items-center justify-between text-[11px] text-[#00A3E0] font-bold tracking-wider uppercase mb-1">
                <span>
                  {book.courseName} · {slide.activityType || 'ATIVIDADE ACADÊMICA'}
                </span>
                <span className="font-mono text-slate-400">{book.period}</span>
              </div>

              {/* Title input */}
              <input
                type="text"
                value={slide.title}
                onChange={(e) => onUpdateSlide({ title: e.target.value })}
                className="w-full bg-transparent font-bold text-lg sm:text-xl text-[#001D3D] focus:outline-hidden"
                placeholder="Título da Atividade..."
              />

              {/* Editable Meta Bar: Data, Horário, Tipo */}
              <div className="mt-2 py-1.5 px-3 bg-slate-50 rounded-md border border-slate-200 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600">
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-[#00A3E0]" />
                  <input
                    type="date"
                    value={slide.date || slide.evidenceMeta?.date || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      onUpdateSlide({
                        date: val,
                        evidenceMeta: slide.evidenceMeta ? { ...slide.evidenceMeta, date: val } : undefined,
                      });
                    }}
                    className="bg-transparent focus:outline-hidden font-mono"
                  />
                </div>

                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-[#00A3E0]" />
                  <input
                    type="time"
                    value={slide.time || ''}
                    onChange={(e) => onUpdateSlide({ time: e.target.value })}
                    className="bg-transparent focus:outline-hidden font-mono"
                  />
                </div>

                <div className="flex items-center gap-1 font-semibold text-slate-700 ml-auto">
                  <span className="px-2 py-0.5 rounded bg-sky-50 text-[#004B8D] border border-sky-200">
                    {slide.activityType || 'Atividade regular'}
                  </span>
                </div>
              </div>
            </div>

            {/* Central Stage: Objetivo / Registro (Left) + Photos Container (Right) */}
            <div className="flex-1 my-2 sm:my-3 flex flex-row gap-3.5 min-h-0">
              {/* Left Column: Objetivo da Atividade (Proporcional a 42% do slide) */}
              <div className="w-[42%] bg-slate-50/90 border border-slate-200 rounded-xl p-3 sm:p-3.5 flex flex-col justify-between shadow-2xs">
                <div className="flex-1 min-h-0 flex flex-col">
                  <div className="flex items-center justify-between mb-1.5 shrink-0">
                    <span className="text-[10px] uppercase font-bold text-[#004B8D] tracking-wider">
                      Objetivo da Atividade
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleConvertToFloatingBalloon('Objetivo', slide.objective || slide.evidenceMeta?.actionsReport || '')}
                        title="Destacar este objetivo como balão livre no slide"
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 text-[10px] font-semibold transition-colors border border-amber-200"
                      >
                        <MessageSquare className="w-2.5 h-2.5 text-amber-600" />
                        <span>Balão</span>
                      </button>
                      <button
                        onClick={handleRegenerateObjective}
                        disabled={isGeneratingAI}
                        title="Gerar novo objetivo institucional com IA"
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-sky-100 hover:bg-sky-200 text-[#004B8D] text-[10px] font-bold transition-colors"
                      >
                        <RefreshCw className={`w-3 h-3 ${isGeneratingAI ? 'animate-spin' : ''}`} />
                        <span>✨ Gerar</span>
                      </button>
                    </div>
                  </div>

                  <textarea
                    rows={5}
                    value={slide.objective || slide.evidenceMeta?.actionsReport || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      onUpdateSlide({
                        objective: val,
                        evidenceMeta: slide.evidenceMeta
                          ? { ...slide.evidenceMeta, actionsReport: val }
                          : undefined,
                      });
                    }}
                    placeholder="Descreva o objetivo e desenvolvimento da atividade..."
                    className="w-full flex-1 min-h-0 bg-transparent text-xs text-slate-800 leading-relaxed focus:outline-hidden resize-none"
                  />
                </div>

                <div className="pt-2 border-t border-slate-200 mt-2 shrink-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block">
                      Observações complementares (opcional):
                    </span>
                    <button
                      onClick={() => handleConvertToFloatingBalloon('Observação', slide.customText1 || slide.evidenceMeta?.pedagogicalImpact || '')}
                      title="Destacar observações como balão livre"
                      className="text-[9px] text-amber-700 hover:underline flex items-center gap-0.5"
                    >
                      <MessageSquare className="w-2.5 h-2.5 text-amber-600" />
                      <span>Converter balão</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    value={slide.customText1 || slide.evidenceMeta?.pedagogicalImpact || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      onUpdateSlide({
                        customText1: val,
                        evidenceMeta: slide.evidenceMeta
                          ? { ...slide.evidenceMeta, pedagogicalImpact: val }
                          : undefined,
                      });
                    }}
                    placeholder="Informações adicionais..."
                    className="w-full bg-transparent text-[11px] text-slate-600 italic focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Right Column: Ordered Photos Container (58% de largura) */}
              <div className="w-[58%] flex flex-col justify-between min-h-0 h-full">
                {(!slide.photos || slide.photos.length === 0) ? (
                  /* Empty state for photo drop */
                  <div
                    onClick={() => {
                      replacePhotoIndexRef.current = null;
                      fileInputRef.current?.click();
                    }}
                    className="w-full h-full border-2 border-dashed border-slate-300 hover:border-[#00A3E0] rounded-xl bg-slate-50 flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-full bg-white shadow-xs border border-slate-200 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                      <Camera className="w-5 h-5 text-[#00A3E0]" />
                    </div>
                    <span className="text-xs font-bold text-slate-700">
                      Arraste uma imagem ou clique para selecionar
                    </span>
                    <span className="text-[11px] text-slate-400 mt-0.5">
                      Cole diretamente com Ctrl+V
                    </span>
                  </div>
                ) : (
                  /* Photos Dynamic Composition with Reordering & Replacement (Requisitos 1 e 2) */
                  <div className="w-full h-full flex flex-col justify-between min-h-0">
                    {/* Prompt to split slide if > 3 photos */}
                    {slide.photos.length > 3 && onSplitSlidePhotos && (
                      <div className="mb-2 px-2.5 py-1 bg-sky-50 border border-sky-200 rounded-md flex items-center justify-between text-[11px] text-[#004B8D] shrink-0">
                        <div className="flex items-center gap-1.5 truncate">
                          <Split className="w-3.5 h-3.5 text-[#00A3E0] shrink-0" />
                          <span className="truncate"><b>{slide.photos.length} fotos</b> no slide. Deseja distribuir o excesso?</span>
                        </div>
                        <button
                          onClick={() => onSplitSlidePhotos(slide.id)}
                          className="px-2 py-0.5 bg-[#004B8D] hover:bg-[#00386B] text-white font-bold rounded text-[10px] transition-colors shrink-0 shadow-2xs ml-1"
                        >
                          Dividir Fotos
                        </button>
                      </div>
                    )}

                    {/* Intelligent Layout Composition Stage */}
                    <div className="relative w-full flex-1 min-h-0">
                      {computePhotoLayout(slide.photos, (slide.photoLayout as SmartCompositionPreset) || 'auto').map((frame) => {
                        const photo = frame.photo;
                        const pIdx = frame.index;
                        const isSelected = activePhotoId === photo.id;
                        return (
                          <div
                            key={photo.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setActivePhotoId(photo.id);
                              setSelectedTextBoxId(null);
                            }}
                            style={{
                              position: 'absolute',
                              left: `${frame.leftPercent}%`,
                              top: `${frame.topPercent}%`,
                              width: `${frame.widthPercent}%`,
                              height: `${frame.heightPercent}%`,
                            }}
                            className={`rounded-lg overflow-visible bg-slate-100 flex flex-col justify-between border transition-all ${
                              isSelected
                                ? 'border-[#00A3E0] ring-2 ring-[#00A3E0] shadow-md z-30'
                                : 'border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            {/* FLOATING CANVA/FIGMA TOOLBAR (WHEN PHOTO SELECTED) */}
                            {isSelected && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="no-print absolute -top-11 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 bg-[#001D3D] text-white px-2.5 py-1 rounded-lg shadow-2xl border border-white/20 text-[11px] whitespace-nowrap animate-in fade-in zoom-in-95 duration-150"
                              >
                                {/* Direct Pan Button / Indicator */}
                                <span
                                  onMouseDown={(e) => handleStartPhotoPan(e, photo)}
                                  className="flex items-center gap-1 text-[#00A3E0] font-mono cursor-grab active:cursor-grabbing px-1 hover:bg-white/10 rounded transition-colors"
                                  title="Clique e arraste com o mouse para enquadrar livremente a imagem"
                                >
                                  <Move className="w-3.5 h-3.5" />
                                  <span>Mover</span>
                                </span>
                                <span className="text-white/20">|</span>

                                {/* Zoom Controls */}
                                <div className="flex items-center gap-0.5">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleZoomPhoto(photo.id, -0.1);
                                    }}
                                    title="Diminuir Zoom"
                                    className="p-1 hover:bg-white/10 rounded text-slate-300 hover:text-white"
                                  >
                                    <ZoomOut className="w-3.5 h-3.5" />
                                  </button>
                                  <span className="font-mono text-[10px] w-8 text-center text-amber-300 font-bold">
                                    {Math.round((photo.zoom || 1) * 100)}%
                                  </span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleZoomPhoto(photo.id, 0.1);
                                    }}
                                    title="Aumentar Zoom"
                                    className="p-1 hover:bg-white/10 rounded text-slate-300 hover:text-white"
                                  >
                                    <ZoomIn className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                <span className="text-white/20">|</span>

                                {/* Rotate */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRotatePhoto(photo.id);
                                  }}
                                  title="Girar 90° no sentido horário"
                                  className="flex items-center gap-1 p-1 hover:bg-white/10 rounded text-[#00A3E0]"
                                >
                                  <RotateCw className="w-3.5 h-3.5" />
                                  <span className="font-mono text-[10px]">{photo.rotation || 0}°</span>
                                </button>
                                <span className="text-white/20">|</span>

                                {/* Aspect Ratio */}
                                <select
                                  value={photo.aspectRatio || 'auto'}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    handleUpdatePhoto(photo.id, { aspectRatio: e.target.value as any });
                                  }}
                                  className="bg-black/50 border border-white/20 rounded px-1.5 py-0.5 text-[10px] text-white focus:outline-hidden"
                                  title="Proporção da imagem (Aspect Ratio)"
                                >
                                  <option value="auto" className="text-black">Auto</option>
                                  <option value="16/9" className="text-black">16:9</option>
                                  <option value="4/3" className="text-black">4:3</option>
                                  <option value="1/1" className="text-black">1:1</option>
                                </select>
                                <span className="text-white/20">|</span>

                                {/* Fit mode */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleFit(photo.id);
                                  }}
                                  title="Alternar Preencher (cortar bordas) ou Ajustar (mostrar inteira)"
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    (photo.fit || frame.fit) === 'contain' ? 'bg-[#00A3E0] text-slate-900' : 'bg-white/10 text-white'
                                  }`}
                                >
                                  {(photo.fit || frame.fit) === 'contain' ? 'Ajustado' : 'Preenchido'}
                                </button>
                                <span className="text-white/20">|</span>

                                {/* Reset Transform */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleResetPhoto(photo.id);
                                  }}
                                  title="Redefinir enquadramento e transformações"
                                  className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                                <span className="text-white/20">|</span>

                                {/* Replace Photo */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    replacePhotoIndexRef.current = pIdx;
                                    fileInputRef.current?.click();
                                  }}
                                  title="Substituir foto por upload"
                                  className="p-1 hover:bg-white/10 rounded text-sky-400 hover:text-white"
                                >
                                  <ImageIcon className="w-3.5 h-3.5" />
                                </button>

                                {/* Delete Photo */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeletePhoto(photo.id);
                                  }}
                                  title="Remover foto do slide"
                                  className="p-1 hover:bg-red-600 rounded text-red-400 hover:text-white ml-0.5"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}

                            {/* 4 FIGMA/CANVA CORNER RESIZE HANDLES */}
                            {isSelected && (
                              <>
                                <div
                                  onMouseDown={(e) => handleStartPhotoResize(e, photo, 'tl')}
                                  title="Arraste para redimensionar"
                                  className="no-print absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-[#00A3E0] rounded-[2px] z-40 cursor-nwse-resize shadow-md hover:scale-125 transition-transform"
                                />
                                <div
                                  onMouseDown={(e) => handleStartPhotoResize(e, photo, 'tr')}
                                  title="Arraste para redimensionar"
                                  className="no-print absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-[#00A3E0] rounded-[2px] z-40 cursor-nesw-resize shadow-md hover:scale-125 transition-transform"
                                />
                                <div
                                  onMouseDown={(e) => handleStartPhotoResize(e, photo, 'bl')}
                                  title="Arraste para redimensionar"
                                  className="no-print absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-[#00A3E0] rounded-[2px] z-40 cursor-nesw-resize shadow-md hover:scale-125 transition-transform"
                                />
                                <div
                                  onMouseDown={(e) => handleStartPhotoResize(e, photo, 'br')}
                                  title="Arraste para redimensionar"
                                  className="no-print absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-[#00A3E0] rounded-[2px] z-40 cursor-nwse-resize shadow-md hover:scale-125 transition-transform"
                                />
                              </>
                            )}

                            {/* Image Canvas Frame with Pan Dragging */}
                            <div
                              onMouseDown={(e) => handleStartPhotoPan(e, photo)}
                              className={`relative w-full flex-1 min-h-0 overflow-hidden bg-slate-900/5 select-none rounded-t-lg ${
                                isSelected ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                              }`}
                            >
                              <img
                                src={photo.url}
                                alt={photo.caption || 'Foto'}
                                draggable={false}
                                className={`w-full h-full pointer-events-none transition-transform duration-75 select-none ${
                                  (photo.fit || frame.fit) === 'contain' ? 'object-contain' : 'object-cover'
                                }`}
                                style={{
                                  transform: `scale(${(photo.zoom || 1) * (photo.scale || 1)}) translate(${photo.x || 0}%, ${photo.y || 0}%) rotate(${photo.rotation || 0}deg)`,
                                  objectPosition: photo.position === 'top' ? 'top center' : photo.position === 'bottom' ? 'bottom center' : photo.position === 'left' ? 'left center' : photo.position === 'right' ? 'right center' : `${photo.cropX ?? 50}% ${photo.cropY ?? 50}%`,
                                }}
                              />

                              {/* Number Badge */}
                              <div className="absolute top-1.5 left-1.5 bg-black/70 text-white font-mono font-bold text-[9px] px-1.5 py-0.5 rounded z-20 pointer-events-none">
                                #{pIdx + 1}
                              </div>

                              {/* Floating status badge when customized */}
                              {isSelected && ((photo.zoom && photo.zoom !== 1) || (photo.x && photo.x !== 0) || (photo.y && photo.y !== 0) || (photo.rotation && photo.rotation !== 0)) && (
                                <div className="no-print absolute bottom-1.5 right-1.5 bg-black/75 backdrop-blur-xs text-[#00A3E0] font-mono text-[9px] px-1.5 py-0.5 rounded shadow-xs z-20 pointer-events-none">
                                  {photo.zoom ? `${Math.round(photo.zoom * 100)}% ` : ''}
                                  {photo.x ? `X:${photo.x}% ` : ''}
                                  {photo.y ? `Y:${photo.y}% ` : ''}
                                  {photo.rotation ? `${photo.rotation}°` : ''}
                                </div>
                              )}

                              {/* Reorder controls on hover */}
                              <div className="absolute top-1.5 right-1.5 flex items-center gap-1 z-30 opacity-90 hover:opacity-100">
                                {pIdx > 0 && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleMovePhoto(pIdx, 'left');
                                    }}
                                    title="Mover foto para esquerda"
                                    className="p-1 rounded bg-black/60 text-white hover:bg-black/90"
                                  >
                                    <ArrowLeft className="w-3 h-3" />
                                  </button>
                                )}
                                {pIdx < (slide.photos?.length || 0) - 1 && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleMovePhoto(pIdx, 'right');
                                    }}
                                    title="Mover foto para direita"
                                    className="p-1 rounded bg-black/60 text-white hover:bg-black/90"
                                  >
                                    <ArrowRight className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Caption input */}
                            <div className="p-1 bg-white border-t border-slate-100 rounded-b-lg shrink-0">
                              <input
                                type="text"
                                value={photo.caption || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const updated = (slide.photos || []).map((p) =>
                                    p.id === photo.id ? { ...p, caption: val } : p
                                  );
                                  onUpdateSlide({ photos: updated });
                                }}
                                placeholder="Legenda da foto..."
                                className="w-full text-[10px] text-slate-600 bg-transparent focus:outline-hidden truncate italic"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Slide footer - Totalmente Editável */}
            <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500 gap-3">
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <input
                  type="text"
                  value={slide.footerLeftText !== undefined ? slide.footerLeftText : `${campus.fullName} · ${book.courseName}`}
                  onChange={(e) => onUpdateSlide({ footerLeftText: e.target.value })}
                  placeholder="Instituição / Campus no rodapé..."
                  className="bg-transparent font-medium text-slate-700 hover:bg-slate-100/70 focus:bg-white focus:ring-1 focus:ring-[#00A3E0] rounded px-1.5 py-0.5 w-full border-b border-transparent hover:border-slate-300 focus:outline-hidden transition-colors truncate text-[11px]"
                  title="Clique para editar as informações do rodapé"
                />
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <input
                  type="text"
                  value={slide.footerRightText !== undefined ? slide.footerRightText : `Slide ${slideIndex} de ${totalSlides}`}
                  onChange={(e) => onUpdateSlide({ footerRightText: e.target.value })}
                  placeholder={`Slide ${slideIndex} de ${totalSlides}`}
                  className="bg-transparent font-mono text-slate-500 text-right hover:bg-slate-100/70 focus:bg-white focus:ring-1 focus:ring-[#00A3E0] rounded px-1.5 py-0.5 border-b border-transparent hover:border-slate-300 focus:outline-hidden transition-colors w-28 text-[11px]"
                  title="Clique para editar o número de página ou texto do rodapé"
                />
              </div>
            </div>
          </div>
        )}

        {/* SLIDE: SUMÁRIO ANALÍTICO (ORGANIZADO EM COLUNAS COM CARDS NUMERADOS) */}
        {slide.type === 'sumario' && (
          <div className="flex-1 bg-white p-5 sm:p-7 flex flex-col justify-between select-text">
            <div>
              <div className="text-[11px] text-[#00A3E0] font-bold tracking-wider uppercase mb-1">
                {book.courseName} · SUMÁRIO ANALÍTICO EXECUTIVO
              </div>
              <input
                type="text"
                value={slide.title}
                onChange={(e) => onUpdateSlide({ title: e.target.value })}
                className="w-full bg-transparent font-bold text-xl sm:text-2xl text-[#001D3D] focus:outline-hidden"
                placeholder="Sumário das Atividades..."
              />
              <div className="text-xs text-slate-500 mt-1 border-b border-slate-200 pb-2">
                Estrutura de apresentação e índice analítico do período acadêmico:
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 my-auto max-h-[310px] overflow-y-auto pr-1">
              {book.slides
                .filter((s) => s.type !== 'capa')
                .map((topic) => (
                  <div
                    key={topic.id}
                    className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-50 border border-slate-200 hover:border-[#00A3E0] hover:bg-sky-50/40 transition-colors shadow-2xs"
                  >
                    <span className="w-6 h-6 rounded bg-[#E0F2FE] border border-[#00A3E0]/40 text-[#004B8D] font-mono font-bold text-xs flex items-center justify-center shrink-0">
                      {topic.order < 10 ? `0${topic.order}` : topic.order}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-900 truncate">
                        {topic.title}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate flex items-center gap-1.5">
                        <span className="capitalize">{topic.type}</span>
                        {topic.date && (
                          <>
                            <span>·</span>
                            <span>{topic.date}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            </div>

            {/* Slide footer */}
            <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500 gap-3">
              <input
                type="text"
                value={slide.footerLeftText !== undefined ? slide.footerLeftText : `${campus.fullName} · ${book.courseName}`}
                onChange={(e) => onUpdateSlide({ footerLeftText: e.target.value })}
                className="bg-transparent font-medium text-slate-700 hover:bg-slate-100/70 focus:bg-white focus:ring-1 focus:ring-[#00A3E0] rounded px-1.5 py-0.5 border-b border-transparent hover:border-slate-300 focus:outline-hidden transition-colors truncate text-[11px]"
              />
              <input
                type="text"
                value={slide.footerRightText !== undefined ? slide.footerRightText : `Slide ${slideIndex} de ${totalSlides}`}
                onChange={(e) => onUpdateSlide({ footerRightText: e.target.value })}
                className="bg-transparent font-mono text-slate-500 text-right hover:bg-slate-100/70 focus:bg-white focus:ring-1 focus:ring-[#00A3E0] rounded px-1.5 py-0.5 border-b border-transparent hover:border-slate-300 focus:outline-hidden transition-colors w-28 text-[11px]"
              />
            </div>
          </div>
        )}

        {/* SLIDE: APRESENTAÇÃO & CONTEXTUALIZAÇÃO (2 CARDS VISUAIS LADO A LADO IDÊNTICOS AO PPTX) */}
        {slide.type === 'apresentacao' && (
          <div className="flex-1 bg-white p-5 sm:p-7 flex flex-col justify-between select-text">
            <div>
              <div className="text-[11px] text-[#00A3E0] font-bold tracking-wider uppercase mb-1">
                {book.courseName} · APRESENTAÇÃO & CONTEXTUALIZAÇÃO
              </div>
              <input
                type="text"
                value={slide.title}
                onChange={(e) => onUpdateSlide({ title: e.target.value })}
                className="w-full bg-transparent font-bold text-xl sm:text-2xl text-[#001D3D] focus:outline-hidden"
                placeholder="Apresentação do Curso..."
              />
              <div className="text-xs text-slate-500 mt-1 border-b border-slate-200 pb-2">
                Visão estratégica, objetivos pedagógicos e metodologias ativas do curso:
              </div>
            </div>

            <div className="my-auto grid grid-cols-2 gap-4">
              {/* Card 1: Contexto & Proposta Pedagógica */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/90 overflow-hidden shadow-2xs flex flex-col">
                <div className="bg-[#E0F2FE] border-b border-slate-200 px-3.5 py-2 flex items-center justify-between">
                  <span className="text-xs font-bold text-[#004B8D] uppercase tracking-wide">
                    01. Contexto & Proposta Pedagógica
                  </span>
                </div>
                <div className="p-3.5 flex-1">
                  <textarea
                    rows={6}
                    value={
                      slide.customText1 !== undefined
                        ? slide.customText1
                        : 'O presente Book de Evidências Acadêmicas consolida as atividades práticas, laboratoriais, projetos de extensão e intervenções interdisciplinares desenvolvidas ao longo do período letivo, evidenciando o compromisso com a formação profissional de excelência.'
                    }
                    onChange={(e) => onUpdateSlide({ customText1: e.target.value })}
                    placeholder="Descreva a fundamentação pedagógica, objetivos e missão formativa da unidade..."
                    className="w-full bg-transparent text-xs text-slate-800 leading-relaxed focus:outline-hidden resize-none"
                  />
                </div>
              </div>

              {/* Card 2: Metodologia Ativa & Experimentação */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/90 overflow-hidden shadow-2xs flex flex-col">
                <div className="bg-[#E0F2FE] border-b border-slate-200 px-3.5 py-2 flex items-center justify-between">
                  <span className="text-xs font-bold text-[#004B8D] uppercase tracking-wide">
                    02. Metodologia Ativa & Experimentação
                  </span>
                </div>
                <div className="p-3.5 flex-1">
                  <textarea
                    rows={6}
                    value={
                      slide.customText2 !== undefined
                        ? slide.customText2
                        : 'A metodologia ativa adotada coloca o acadêmico como protagonista do processo de construção do conhecimento, transformando laboratórios e espaços práticos em polos vivos de cocriação, experimentação assistida e resolução ética de problemas reais.'
                    }
                    onChange={(e) => onUpdateSlide({ customText2: e.target.value })}
                    placeholder="Descreva como os estudantes vivenciam as práticas laboratoriais, visitas técnicas e dinâmicas ativas..."
                    className="w-full bg-transparent text-xs text-slate-800 leading-relaxed focus:outline-hidden resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Slide footer */}
            <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500 gap-3">
              <input
                type="text"
                value={slide.footerLeftText !== undefined ? slide.footerLeftText : `${campus.fullName} · ${book.courseName}`}
                onChange={(e) => onUpdateSlide({ footerLeftText: e.target.value })}
                className="bg-transparent font-medium text-slate-700 hover:bg-slate-100/70 focus:bg-white focus:ring-1 focus:ring-[#00A3E0] rounded px-1.5 py-0.5 border-b border-transparent hover:border-slate-300 focus:outline-hidden transition-colors truncate text-[11px]"
              />
              <input
                type="text"
                value={slide.footerRightText !== undefined ? slide.footerRightText : `Slide ${slideIndex} de ${totalSlides}`}
                onChange={(e) => onUpdateSlide({ footerRightText: e.target.value })}
                className="bg-transparent font-mono text-slate-500 text-right hover:bg-slate-100/70 focus:bg-white focus:ring-1 focus:ring-[#00A3E0] rounded px-1.5 py-0.5 border-b border-transparent hover:border-slate-300 focus:outline-hidden transition-colors w-28 text-[11px]"
              />
            </div>
          </div>
        )}

        {/* SLIDE: DIRETRIZES CURRICULARES & MEC (CARDS ESTRUTURADOS COM TARJA CIANO) */}
        {slide.type === 'diretrizes' && (
          <div className="flex-1 bg-white p-5 sm:p-7 flex flex-col justify-between select-text">
            <div>
              <div className="text-[11px] text-[#00A3E0] font-bold tracking-wider uppercase mb-1">
                {book.courseName} · CONFORMIDADE REGULATÓRIA MEC
              </div>
              <input
                type="text"
                value={slide.title}
                onChange={(e) => onUpdateSlide({ title: e.target.value })}
                className="w-full bg-transparent font-bold text-xl sm:text-2xl text-[#001D3D] focus:outline-hidden"
                placeholder="Diretrizes Curriculares Nacionais..."
              />
              <div className="text-xs text-slate-500 mt-1 border-b border-slate-200 pb-2">
                Alinhamento pedagógico às Diretrizes Curriculares Nacionais e aos Padrões de Qualidade do MEC:
              </div>
            </div>

            <div className="my-auto space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
              {(slide.competencies || [
                {
                  id: 'comp-1',
                  code: 'DCN-01',
                  title: 'Domínio Técnico, Científico e Tecnológico',
                  description: 'Capacidade de diagnosticar, analisar e conceber soluções profissionais pautadas em métodos científicos rigorosos e no domínio das tecnologias emergentes.',
                  mecStandard: 'DCNs MEC · Resolução CNE/CES',
                },
                {
                  id: 'comp-2',
                  code: 'DCN-02',
                  title: 'Prática Laboratorial & Experimentação Supervisionada',
                  description: 'Vivência prática em ambientes simulados, ateliês e laboratórios com instrumental técnico adequado à futura atuação mercadológica e comunitária.',
                  mecStandard: 'Instrumento de Avaliação de Cursos de Graduação MEC',
                },
                {
                  id: 'comp-3',
                  code: 'DCN-03',
                  title: 'Responsabilidade Social, Ética e Sustentabilidade',
                  description: 'Engajamento em ações sociais, cidadãs e de preservação ambiental articuladas às demandas contemporâneas da sociedade e das comunidades locais.',
                  mecStandard: 'Diretrizes Curriculares Nacionais de Extensão e Cidadania',
                },
              ]).map((comp, cIdx) => (
                <div
                  key={comp.id || cIdx}
                  className="rounded-lg border border-slate-200 bg-slate-50/90 overflow-hidden flex items-stretch shadow-2xs"
                >
                  <div className="w-1.5 bg-[#00A3E0] shrink-0" />
                  <div className="p-3 flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-1.5 py-0.5 rounded bg-sky-100 text-[#004B8D] font-mono font-bold text-[10px]">
                        {comp.code}
                      </span>
                      <span className="font-bold text-xs text-slate-900 truncate">
                        {comp.title}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-700 leading-relaxed">
                      {comp.description}
                    </p>
                    <span className="text-[9.5px] text-slate-400 italic block mt-1">
                      Referência Normativa: {comp.mecStandard}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Slide footer */}
            <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500 gap-3">
              <input
                type="text"
                value={slide.footerLeftText !== undefined ? slide.footerLeftText : `${campus.fullName} · ${book.courseName}`}
                onChange={(e) => onUpdateSlide({ footerLeftText: e.target.value })}
                className="bg-transparent font-medium text-slate-700 hover:bg-slate-100/70 focus:bg-white focus:ring-1 focus:ring-[#00A3E0] rounded px-1.5 py-0.5 border-b border-transparent hover:border-slate-300 focus:outline-hidden transition-colors truncate text-[11px]"
              />
              <input
                type="text"
                value={slide.footerRightText !== undefined ? slide.footerRightText : `Slide ${slideIndex} de ${totalSlides}`}
                onChange={(e) => onUpdateSlide({ footerRightText: e.target.value })}
                className="bg-transparent font-mono text-slate-500 text-right hover:bg-slate-100/70 focus:bg-white focus:ring-1 focus:ring-[#00A3E0] rounded px-1.5 py-0.5 border-b border-transparent hover:border-slate-300 focus:outline-hidden transition-colors w-28 text-[11px]"
              />
            </div>
          </div>
        )}

        {/* SLIDE: EQUIPE DOCENTE & COORDENAÇÃO (CARDS EM GRADE 2 COLUNAS IDÊNTICO AO PPTX) */}
        {slide.type === 'equipe' && (
          <div className="flex-1 bg-white p-5 sm:p-7 flex flex-col justify-between select-text">
            <div>
              <div className="text-[11px] text-[#00A3E0] font-bold tracking-wider uppercase mb-1">
                {book.courseName} · CORPO DOCENTE & COORDENAÇÃO
              </div>
              <input
                type="text"
                value={slide.title}
                onChange={(e) => onUpdateSlide({ title: e.target.value })}
                className="w-full bg-transparent font-bold text-xl sm:text-2xl text-[#001D3D] focus:outline-hidden"
                placeholder="Equipe Docente e Coordenação..."
              />
              <div className="text-xs text-slate-500 mt-1 border-b border-slate-200 pb-2">
                Corpo docente qualificado responsável pela condução das unidades curriculares e atividades do período:
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3.5 my-auto max-h-[300px] overflow-y-auto pr-1">
              {(slide.facultyList || [
                {
                  id: 'fac-coord',
                  name: book.coordinator || 'Coordenação de Curso',
                  role: 'Coordenador(a) do Curso',
                  degree: 'Mestre / Doutor em Área Conexa',
                  discipline: 'Gestão Pedagógica & Atividades Integradas',
                },
                {
                  id: 'fac-1',
                  name: 'Prof. Orientador Titular',
                  role: 'Docente Responsável',
                  degree: 'Mestre em Ciências',
                  discipline: 'Práticas Laboratoriais & Metodologias',
                },
                {
                  id: 'fac-2',
                  name: 'Prof. Supervisor Prático',
                  role: 'Docente Especialista',
                  degree: 'Especialista / Mestre',
                  discipline: 'Projetos Integradores & Extensão',
                },
                {
                  id: 'fac-3',
                  name: 'Corpo Técnico Laboratorial',
                  role: 'Apoio às Práticas',
                  degree: 'Graduação / Tecnólogo',
                  discipline: 'Infraestrutura e Segurança de Laboratório',
                },
              ]).map((fac, fIdx) => (
                <div
                  key={fac.id || fIdx}
                  className="rounded-xl border border-slate-200 bg-slate-50/90 overflow-hidden shadow-2xs flex flex-col justify-between"
                >
                  <div className="h-1 bg-[#004B8D] w-full" />
                  <div className="p-3 space-y-0.5">
                    <span className="font-bold text-xs text-[#001D3D] block truncate">
                      {fac.name}
                    </span>
                    <span className="text-[10px] font-bold text-[#00A3E0] uppercase tracking-wide block truncate">
                      {fac.role}
                    </span>
                    <span className="text-[10.5px] text-slate-700 block truncate">
                      Titulação: {fac.degree}
                    </span>
                    <span className="text-[10px] text-slate-500 block truncate">
                      Disciplina/Atuação: {fac.discipline}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Slide footer */}
            <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500 gap-3">
              <input
                type="text"
                value={slide.footerLeftText !== undefined ? slide.footerLeftText : `${campus.fullName} · ${book.courseName}`}
                onChange={(e) => onUpdateSlide({ footerLeftText: e.target.value })}
                className="bg-transparent font-medium text-slate-700 hover:bg-slate-100/70 focus:bg-white focus:ring-1 focus:ring-[#00A3E0] rounded px-1.5 py-0.5 border-b border-transparent hover:border-slate-300 focus:outline-hidden transition-colors truncate text-[11px]"
              />
              <input
                type="text"
                value={slide.footerRightText !== undefined ? slide.footerRightText : `Slide ${slideIndex} de ${totalSlides}`}
                onChange={(e) => onUpdateSlide({ footerRightText: e.target.value })}
                className="bg-transparent font-mono text-slate-500 text-right hover:bg-slate-100/70 focus:bg-white focus:ring-1 focus:ring-[#00A3E0] rounded px-1.5 py-0.5 border-b border-transparent hover:border-slate-300 focus:outline-hidden transition-colors w-28 text-[11px]"
              />
            </div>
          </div>
        )}

        {/* SLIDE: INFORMAÇÕES INSTITUCIONAIS & CONTATOS (4 CARDS ESTRUTURADOS) */}
        {slide.type === 'contatos' && (
          <div className="flex-1 bg-white p-5 sm:p-7 flex flex-col justify-between select-text">
            <div>
              <div className="text-[11px] text-[#00A3E0] font-bold tracking-wider uppercase mb-1">
                {book.courseName} · ENCERRAMENTO & CANAIS INSTITUCIONAIS
              </div>
              <input
                type="text"
                value={slide.title}
                onChange={(e) => onUpdateSlide({ title: e.target.value })}
                className="w-full bg-transparent font-bold text-xl sm:text-2xl text-[#001D3D] focus:outline-hidden"
                placeholder="Informações Institucionais..."
              />
              <div className="text-xs text-slate-500 mt-1 border-b border-slate-200 pb-2">
                Atendimento, coordenação acadêmica e canais oficiais de comunicação:
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3.5 my-auto">
              {/* Card 1: Campus & Endereço */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/90 shadow-2xs space-y-1">
                <span className="text-[10px] uppercase font-bold text-[#004B8D] tracking-wider block">
                  Campus & Endereço Oficial
                </span>
                <span className="text-xs font-bold text-slate-900 block">
                  {campus.fullName}
                </span>
                <span className="text-[11px] text-slate-600 block">
                  {campus.address}
                </span>
              </div>

              {/* Card 2: E-mail da Coordenação */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/90 shadow-2xs space-y-1">
                <span className="text-[10px] uppercase font-bold text-[#004B8D] tracking-wider block">
                  E-mail Institucional da Coordenação
                </span>
                <span className="text-xs font-bold text-[#004B8D] block font-mono">
                  {slide.contacts?.email || 'coordenacao.academica@estacio.br'}
                </span>
                <span className="text-[11px] text-slate-500 block">
                  Canal para envio de relatórios e documentação complementar
                </span>
              </div>

              {/* Card 3: Central de Atendimento */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/90 shadow-2xs space-y-1">
                <span className="text-[10px] uppercase font-bold text-[#004B8D] tracking-wider block">
                  Telefone & Central de Atendimento
                </span>
                <span className="text-xs font-bold text-slate-900 block font-mono">
                  {slide.contacts?.phone || '(41) 3310-7000'}
                </span>
                <span className="text-[11px] text-slate-500 block">
                  Atendimento direto a docentes, discentes e comunidade
                </span>
              </div>

              {/* Card 4: Horário de Funcionamento */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/90 shadow-2xs space-y-1">
                <span className="text-[10px] uppercase font-bold text-[#004B8D] tracking-wider block">
                  Horário de Funcionamento Acadêmico
                </span>
                <span className="text-xs font-bold text-slate-900 block">
                  {slide.contacts?.serviceHours || 'Segunda a Sexta-feira: 08h00 às 21h30'}
                </span>
                <span className="text-[11px] text-slate-500 block">
                  Período letivo oficial · Ano 2026
                </span>
              </div>
            </div>

            {/* Slide footer */}
            <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500 gap-3">
              <input
                type="text"
                value={slide.footerLeftText !== undefined ? slide.footerLeftText : `${campus.fullName} · ${book.courseName}`}
                onChange={(e) => onUpdateSlide({ footerLeftText: e.target.value })}
                className="bg-transparent font-medium text-slate-700 hover:bg-slate-100/70 focus:bg-white focus:ring-1 focus:ring-[#00A3E0] rounded px-1.5 py-0.5 border-b border-transparent hover:border-slate-300 focus:outline-hidden transition-colors truncate text-[11px]"
              />
              <input
                type="text"
                value={slide.footerRightText !== undefined ? slide.footerRightText : `Slide ${slideIndex} de ${totalSlides}`}
                onChange={(e) => onUpdateSlide({ footerRightText: e.target.value })}
                className="bg-transparent font-mono text-slate-500 text-right hover:bg-slate-100/70 focus:bg-white focus:ring-1 focus:ring-[#00A3E0] rounded px-1.5 py-0.5 border-b border-transparent hover:border-slate-300 focus:outline-hidden transition-colors w-28 text-[11px]"
              />
            </div>
          </div>
        )}

        {/* SLIDE: OUTROS TIPOS / PERSONALIZADOS */}
        {slide.type !== 'capa' &&
          slide.type !== 'evidencia' &&
          slide.type !== 'sumario' &&
          slide.type !== 'apresentacao' &&
          slide.type !== 'diretrizes' &&
          slide.type !== 'equipe' &&
          slide.type !== 'contatos' && (
            <div className="flex-1 bg-white p-5 sm:p-7 flex flex-col justify-between select-text">
              <div>
                <div className="text-[11px] text-[#00A3E0] font-bold tracking-wider uppercase mb-1">
                  {book.courseName} · {slide.type.toUpperCase()}
                </div>
                <input
                  type="text"
                  value={slide.title}
                  onChange={(e) => onUpdateSlide({ title: e.target.value })}
                  className="w-full bg-transparent font-bold text-xl sm:text-2xl text-[#001D3D] border-b border-slate-200 pb-2 focus:outline-hidden"
                />
              </div>

              <div className="my-auto space-y-3 p-4 bg-slate-50/90 border border-slate-200 rounded-xl shadow-2xs">
                <textarea
                  rows={5}
                  value={slide.customText1 || ''}
                  onChange={(e) => onUpdateSlide({ customText1: e.target.value })}
                  placeholder="Texto explicativo ou registro de evidências deste slide..."
                  className="w-full bg-transparent text-xs text-slate-800 leading-relaxed focus:outline-hidden resize-none"
                />
              </div>

              {/* Slide footer */}
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500 gap-3">
                <input
                  type="text"
                  value={slide.footerLeftText !== undefined ? slide.footerLeftText : `${campus.fullName} · ${book.courseName}`}
                  onChange={(e) => onUpdateSlide({ footerLeftText: e.target.value })}
                  className="bg-transparent font-medium text-slate-700 hover:bg-slate-100/70 focus:bg-white focus:ring-1 focus:ring-[#00A3E0] rounded px-1.5 py-0.5 border-b border-transparent hover:border-slate-300 focus:outline-hidden transition-colors truncate text-[11px]"
                />
                <input
                  type="text"
                  value={slide.footerRightText !== undefined ? slide.footerRightText : `Slide ${slideIndex} de ${totalSlides}`}
                  onChange={(e) => onUpdateSlide({ footerRightText: e.target.value })}
                  className="bg-transparent font-mono text-slate-500 text-right hover:bg-slate-100/70 focus:bg-white focus:ring-1 focus:ring-[#00A3E0] rounded px-1.5 py-0.5 border-b border-transparent hover:border-slate-300 focus:outline-hidden transition-colors w-28 text-[11px]"
                />
              </div>
            </div>
          )}

        {/* CUSTOM FREE TEXT BOXES & HIGHLIGHT BALLOONS (REQUISITO 3 - EDIÇÃO TOTAL E LIVRE) */}
        {(slide.customTextBoxes || []).map((box) => {
          const isSelected = selectedTextBoxId === box.id;
          const bgCol = box.backgroundColor || (box.isBalloon ? '#FEF3C7' : 'transparent');
          const borderCol = box.borderColor || (box.isBalloon ? '#F59E0B' : 'transparent');
          const borderW = box.borderWidth !== undefined ? box.borderWidth : (box.isBalloon ? 1.5 : 0);
          const borderR = box.borderRadius !== undefined ? box.borderRadius : (box.isBalloon ? 10 : 6);

          return (
            <div
              key={box.id}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedTextBoxId(box.id);
                setActivePhotoId(null);
              }}
              style={{
                left: `${box.x}%`,
                top: `${box.y}%`,
                width: `${box.width}%`,
                backgroundColor: bgCol,
                borderColor: borderCol,
                borderWidth: `${borderW}px`,
                borderStyle: borderW > 0 ? 'solid' : 'none',
                borderRadius: `${borderR}px`,
                padding: `${box.padding || 8}px`,
              }}
              className={`absolute cursor-move z-35 transition-all select-none ${
                isSelected
                  ? 'ring-2 ring-[#00A3E0] shadow-lg'
                  : 'hover:ring-1 hover:ring-slate-400 shadow-2xs'
              }`}
            >
              {/* Balloon tail indicator if isBalloon is true */}
              {box.isBalloon && (
                <div
                  style={{
                    backgroundColor: bgCol,
                    borderColor: borderCol,
                    borderBottomWidth: `${borderW}px`,
                    borderRightWidth: `${borderW}px`,
                  }}
                  className="absolute -bottom-1.5 left-5 w-3 h-3 rotate-45 pointer-events-none"
                />
              )}

              {/* FLOATING FORMATTING TOOLBAR WHEN SELECTED */}
              {isSelected && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="no-print absolute -top-10 left-0 flex items-center gap-1.5 bg-[#001D3D] text-white px-2.5 py-1 rounded-lg text-[10px] font-sans shadow-2xl border border-white/20 z-50 whitespace-nowrap animate-in fade-in zoom-in-95 duration-100"
                >
                  {/* Drag Handle */}
                  <span
                    onMouseDown={(e) => startDragBox(e, box)}
                    className="cursor-grab active:cursor-grabbing flex items-center gap-1 text-[#00A3E0] font-bold hover:bg-white/10 px-1 py-0.5 rounded transition-colors"
                    title="Clique e arraste para reposicionar livremente no slide"
                  >
                    <Move className="w-3.5 h-3.5" />
                    <span>Mover</span>
                  </span>
                  <span className="text-white/20">|</span>

                  {/* Font Size Selector */}
                  <select
                    value={box.fontSize || 14}
                    onChange={(e) => handleUpdateTextBox(box.id, { fontSize: Number(e.target.value) })}
                    className="bg-black/40 border border-white/20 rounded px-1 py-0.5 text-white font-mono text-[10px] focus:outline-hidden"
                    title="Tamanho da fonte"
                  >
                    <option value="10" className="text-black">10px</option>
                    <option value="12" className="text-black">12px</option>
                    <option value="13" className="text-black">13px</option>
                    <option value="14" className="text-black">14px</option>
                    <option value="16" className="text-black">16px</option>
                    <option value="18" className="text-black">18px</option>
                    <option value="20" className="text-black">20px</option>
                    <option value="24" className="text-black">24px</option>
                  </select>

                  {/* Bold & Italic */}
                  <button
                    onClick={() => handleUpdateTextBox(box.id, { bold: !box.bold })}
                    title="Negrito"
                    className={`px-1.5 py-0.5 rounded font-bold ${box.bold ? 'bg-[#00A3E0] text-black' : 'hover:bg-white/10 text-white'}`}
                  >
                    B
                  </button>
                  <button
                    onClick={() => handleUpdateTextBox(box.id, { italic: !box.italic })}
                    title="Itálico"
                    className={`px-1.5 py-0.5 rounded italic ${box.italic ? 'bg-[#00A3E0] text-black' : 'hover:bg-white/10 text-white'}`}
                  >
                    I
                  </button>

                  {/* Text Alignment */}
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => handleUpdateTextBox(box.id, { align: 'left' })}
                      title="Alinhar à esquerda"
                      className={`p-1 rounded ${(box.align || 'left') === 'left' ? 'bg-[#00A3E0] text-black' : 'hover:bg-white/10 text-slate-300'}`}
                    >
                      <AlignLeft className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleUpdateTextBox(box.id, { align: 'center' })}
                      title="Centralizar"
                      className={`p-1 rounded ${box.align === 'center' ? 'bg-[#00A3E0] text-black' : 'hover:bg-white/10 text-slate-300'}`}
                    >
                      <AlignCenter className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleUpdateTextBox(box.id, { align: 'right' })}
                      title="Alinhar à direita"
                      className={`p-1 rounded ${box.align === 'right' ? 'bg-[#00A3E0] text-black' : 'hover:bg-white/10 text-slate-300'}`}
                    >
                      <AlignRight className="w-3 h-3" />
                    </button>
                  </div>
                  <span className="text-white/20">|</span>

                  {/* Text Color Dropdown / Presets */}
                  <select
                    value={box.color || '#0F172A'}
                    onChange={(e) => handleUpdateTextBox(box.id, { color: e.target.value })}
                    className="bg-black/40 border border-white/20 rounded px-1 py-0.5 text-white text-[10px] focus:outline-hidden"
                    title="Cor do Texto"
                  >
                    <option value="#0F172A" className="text-black">Preto / Escuro</option>
                    <option value="#004B8D" className="text-black">Azul Estácio</option>
                    <option value="#00A3E0" className="text-black">Ciano</option>
                    <option value="#D97706" className="text-black">Âmbar</option>
                    <option value="#DC2626" className="text-black">Vermelho</option>
                    <option value="#059669" className="text-black">Verde</option>
                    <option value="#FFFFFF" className="text-black">Branco</option>
                  </select>

                  {/* Background Color Presets */}
                  <select
                    value={box.backgroundColor || 'transparent'}
                    onChange={(e) => handleUpdateTextBox(box.id, { backgroundColor: e.target.value })}
                    className="bg-black/40 border border-white/20 rounded px-1 py-0.5 text-white text-[10px] focus:outline-hidden"
                    title="Cor de Fundo"
                  >
                    <option value="transparent" className="text-black">Fundo Transparente</option>
                    <option value="#FFFFFF" className="text-black">Branco</option>
                    <option value="#FEF3C7" className="text-black">Amarelo / Destaque</option>
                    <option value="#E0F2FE" className="text-black">Azul Claro</option>
                    <option value="#DCFCE7" className="text-black">Verde Claro</option>
                    <option value="#F1F5F9" className="text-black">Cinza Claro</option>
                    <option value="#001D3D" className="text-black">Azul Marinho</option>
                  </select>

                  {/* Balloon Style Toggle */}
                  <button
                    onClick={() => handleUpdateTextBox(box.id, { 
                      isBalloon: !box.isBalloon,
                      backgroundColor: !box.isBalloon && (!box.backgroundColor || box.backgroundColor === 'transparent') ? '#FEF3C7' : box.backgroundColor,
                      borderColor: !box.isBalloon && (!box.borderColor || box.borderColor === 'transparent') ? '#F59E0B' : box.borderColor,
                      borderWidth: !box.isBalloon && (!box.borderWidth || box.borderWidth === 0) ? 1.5 : box.borderWidth,
                    })}
                    title="Alternar estilo Balão de Fala"
                    className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold ${box.isBalloon ? 'bg-amber-400 text-black font-bold' : 'hover:bg-white/10 text-amber-300'}`}
                  >
                    <MessageSquare className="w-3 h-3" />
                    <span>Balão</span>
                  </button>
                  <span className="text-white/20">|</span>

                  {/* Duplicate Button */}
                  <button
                    onClick={() => handleDuplicateTextBox(box.id)}
                    title="Duplicar elemento"
                    className="p-1 hover:bg-white/10 rounded text-sky-400 hover:text-white"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>

                  {/* Delete Button */}
                  <button
                    onClick={() => handleDeleteTextBox(box.id)}
                    title="Excluir elemento"
                    className="p-1 hover:bg-red-600 rounded text-red-400 hover:text-white"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Right edge resize handle */}
              {isSelected && (
                <div
                  onMouseDown={(e) => startResizeBox(e, box)}
                  title="Arraste para redimensionar a largura"
                  className="no-print absolute -right-1 top-0 bottom-0 w-2.5 cursor-ew-resize hover:bg-[#00A3E0]/40 rounded-r z-40 transition-colors"
                />
              )}

              {/* Editable Text Area */}
              <textarea
                value={box.text}
                onChange={(e) => handleUpdateTextBox(box.id, { text: e.target.value })}
                style={{
                  fontSize: `${box.fontSize || 14}px`,
                  color: box.color || '#0F172A',
                  fontWeight: box.bold ? 'bold' : 'normal',
                  fontStyle: box.italic ? 'italic' : 'normal',
                  textAlign: box.align || 'left',
                }}
                className="w-full bg-transparent border-none focus:outline-hidden resize-none leading-relaxed"
                rows={Math.max(1, Math.min(6, Math.ceil((box.text?.length || 1) / 35)))}
              />
            </div>
          );
        })}
      </div>

      <div className="no-print mt-3 text-[11px] text-slate-500 flex items-center gap-2">
        <span><b>Ctrl+Z</b> para desfazer</span>
        <span>·</span>
        <span><b>Ctrl+Shift+Z</b> para refazer</span>
        <span>·</span>
        <span>Clique e arraste fotos ou use as setas para reorganizar</span>
      </div>
    </div>
  );
};
