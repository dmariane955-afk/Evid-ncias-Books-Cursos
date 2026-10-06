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
  Image as ImageIcon
} from 'lucide-react';
import { AcademicBook, SlideData, PhotoItem, PhotoLayout, PhotoFit, TextBoxElement, ActivityType } from '../types';
import { CAMPUS_CONFIGS, AREA_CONFIGS } from '../data/defaults';
import { generateActivityObjective } from '../utils/aiObjective';
import { EstacioLogo } from './EstacioLogo';
import { getCourseCoverImage, COURSE_COVER_LIBRARY } from '../utils/courseCovers';

interface SlideCanvasProps {
  book: AcademicBook;
  slide: SlideData;
  slideIndex: number;
  totalSlides: number;
  onUpdateSlide: (updated: Partial<SlideData>) => void;
  onTriggerNewActivityModal?: (droppedImage?: string) => void;
}

export const SlideCanvas: React.FC<SlideCanvasProps> = ({
  book,
  slide,
  slideIndex,
  totalSlides,
  onUpdateSlide,
  onTriggerNewActivityModal,
}) => {
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);
  const [selectedTextBoxId, setSelectedTextBoxId] = useState<string | null>(null);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [draggedPhotoIndex, setDraggedPhotoIndex] = useState<number | null>(null);
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [isCoverLibraryOpen, setIsCoverLibraryOpen] = useState(false);

  // Dragging text box state
  const [draggingBoxId, setDraggingBoxId] = useState<string | null>(null);
  const dragStartPos = useRef<{ mouseX: number; mouseY: number; boxX: number; boxY: number } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const replacePhotoIndexRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const campus = CAMPUS_CONFIGS[book.campus] || CAMPUS_CONFIGS.curitiba;

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

  // FREE TEXT BOXES (POWERPOINT STYLE)
  const handleAddTextBox = () => {
    const newBox: TextBoxElement = {
      id: `tb-${Date.now()}`,
      text: 'Clique duas vezes para editar este texto',
      x: 30,
      y: 35,
      width: 40,
      fontSize: 14,
      bold: false,
      italic: false,
      align: 'left',
      color: '#0F172A',
    };
    const currentBoxes = slide.customTextBoxes || [];
    onUpdateSlide({ customTextBoxes: [...currentBoxes, newBox] });
    setSelectedTextBoxId(newBox.id);
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

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingBoxId || !dragStartPos.current || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const deltaXPercent = ((e.clientX - dragStartPos.current.mouseX) / rect.width) * 100;
      const deltaYPercent = ((e.clientY - dragStartPos.current.mouseY) / rect.height) * 100;

      const newX = Math.max(2, Math.min(85, dragStartPos.current.boxX + deltaXPercent));
      const newY = Math.max(5, Math.min(85, dragStartPos.current.boxY + deltaYPercent));

      handleUpdateTextBox(draggingBoxId, { x: Math.round(newX), y: Math.round(newY) });
    };

    const handleMouseUp = () => {
      setDraggingBoxId(null);
      dragStartPos.current = null;
    };

    if (draggingBoxId) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingBoxId]);

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
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateSlide({ photoLayout: 'single' });
                }}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  (slide.photoLayout || 'single') === 'single'
                    ? 'bg-white text-[#004B8D] font-bold shadow-2xs'
                    : 'text-slate-600'
                }`}
              >
                1 Foto
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateSlide({ photoLayout: 'split-50-50' });
                }}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  slide.photoLayout === 'split-50-50'
                    ? 'bg-white text-[#004B8D] font-bold shadow-2xs'
                    : 'text-slate-600'
                }`}
              >
                50/50
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateSlide({ photoLayout: 'grid-3' });
                }}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  slide.photoLayout === 'grid-3'
                    ? 'bg-white text-[#004B8D] font-bold shadow-2xs'
                    : 'text-slate-600'
                }`}
              >
                Grade 3
              </button>
            </div>
          )}
        </div>

        {/* Action buttons on canvas */}
        <div className="flex items-center gap-1.5">
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
            <span>+ Caixa de Texto</span>
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
          const capaCoverUrl = slide.photos[0]?.url || book.coverImage || getCourseCoverImage(book.courseName, book.academicArea);
          const coverPhoto = slide.photos[0];
          const coverPos = coverPhoto?.position || 'center';
          const coverZoom = coverPhoto?.zoom || 1;

          const updateCoverProps = (props: Partial<PhotoItem>) => {
            const updatedPhoto: PhotoItem = {
              id: coverPhoto?.id || `cover-photo-${Date.now()}`,
              url: capaCoverUrl,
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
              <div className="absolute top-0 bottom-0 right-0 w-3/5 sm:w-2/3 overflow-hidden pointer-events-none">
                <img
                  src={capaCoverUrl}
                  alt={`Capa de ${book.courseName}`}
                  className={`w-full h-full object-cover transition-all duration-300 ${
                    coverPos === 'top' ? 'object-top' :
                    coverPos === 'bottom' ? 'object-bottom' :
                    coverPos === 'left' ? 'object-left' :
                    coverPos === 'right' ? 'object-right' : 'object-center'
                  }`}
                  style={{
                    transform: `scale(${coverZoom})`,
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
              <div className="no-print absolute top-3 right-3 z-30 flex items-center gap-1.5 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/20 text-white text-[11px] shadow-lg">
                <label className="cursor-pointer flex items-center gap-1 hover:text-[#00A3E0] transition-colors font-semibold">
                  <ImageIcon className="w-3.5 h-3.5 text-[#00A3E0]" />
                  <span>Substituir Imagem</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          const url = ev.target?.result as string;
                          if (url) updateCoverProps({ url });
                        };
                        reader.readAsDataURL(file);
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
                <select
                  value={coverZoom}
                  onChange={(e) => updateCoverProps({ zoom: parseFloat(e.target.value) })}
                  className="bg-black/40 border border-white/20 rounded px-1.5 py-0.5 text-[10px] text-white focus:outline-hidden"
                >
                  <option value="1" className="text-black">1.0x</option>
                  <option value="1.15" className="text-black">1.15x</option>
                  <option value="1.3" className="text-black">1.3x</option>
                  <option value="1.5" className="text-black">1.5x</option>
                </select>
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
            <div className="flex-1 my-3 flex flex-col md:flex-row gap-4 min-h-0">
              {/* Left Column: Objetivo da Atividade */}
              <div className="w-full md:w-5/12 bg-slate-50/90 border border-slate-200 rounded-lg p-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] uppercase font-bold text-[#004B8D] tracking-wider">
                      Objetivo da Atividade
                    </span>
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

                  <textarea
                    rows={6}
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
                    className="w-full bg-transparent text-xs text-slate-800 leading-relaxed focus:outline-hidden resize-none"
                  />
                </div>

                <div className="pt-2 border-t border-slate-200 mt-2">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">
                    Observações complementares (opcional):
                  </span>
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

              {/* Right Column: Ordered Photos Container (Reorder, Replace, Delete) */}
              <div className="w-full md:w-7/12 flex flex-col justify-center min-h-[220px]">
                {(!slide.photos || slide.photos.length === 0) ? (
                  /* Empty state for photo drop */
                  <div
                    onClick={() => {
                      replacePhotoIndexRef.current = null;
                      fileInputRef.current?.click();
                    }}
                    className="w-full h-full border-2 border-dashed border-slate-300 hover:border-[#00A3E0] rounded-lg bg-slate-50 flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-colors group"
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
                  /* Photos Grid with Reordering & Replacement */
                  <div className="w-full h-full flex flex-col justify-between gap-2">
                    <div
                      className={`grid gap-2 h-full ${
                        slide.photoLayout === 'split-50-50' || slide.photos.length === 2
                          ? 'grid-cols-2'
                          : slide.photoLayout === 'grid-3' || slide.photos.length === 3
                          ? 'grid-cols-3'
                          : 'grid-cols-1'
                      }`}
                    >
                      {slide.photos.map((photo, pIdx) => {
                        const isSelected = activePhotoId === photo.id;
                        return (
                          <div
                            key={photo.id}
                            onClick={() => setActivePhotoId(photo.id)}
                            className={`relative rounded-md overflow-hidden bg-slate-100 flex flex-col justify-between border group transition-all ${
                              isSelected
                                ? 'border-[#00A3E0] ring-2 ring-[#00A3E0]'
                                : 'border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="relative w-full h-full min-h-[170px] overflow-hidden bg-slate-900/5">
                              <img
                                src={photo.url}
                                alt={photo.caption || 'Foto'}
                                className={`w-full h-full ${
                                  photo.fit === 'contain' ? 'object-contain' : 'object-cover'
                                }`}
                              />

                              {/* Number Badge */}
                              <div className="absolute top-1.5 left-1.5 bg-black/70 text-white font-mono font-bold text-[9px] px-1.5 py-0.5 rounded z-20">
                                #{pIdx + 1}
                              </div>

                              {/* Action controls on hover */}
                              <div className="absolute top-1.5 right-1.5 flex items-center gap-1 z-30 opacity-90 hover:opacity-100">
                                {/* Move Left */}
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

                                {/* Move Right */}
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

                                {/* Fit toggle */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleFit(photo.id);
                                  }}
                                  title="Ajustar / Preencher"
                                  className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-black/60 text-white hover:bg-black/80"
                                >
                                  {photo.fit === 'contain' ? 'Ajustado' : 'Preenchido'}
                                </button>

                                {/* Replace */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    replacePhotoIndexRef.current = pIdx;
                                    fileInputRef.current?.click();
                                  }}
                                  title="Substituir foto"
                                  className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-black/60 text-white hover:bg-black/80"
                                >
                                  Trocar
                                </button>

                                {/* Delete */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeletePhoto(photo.id);
                                  }}
                                  title="Remover foto"
                                  className="p-1 rounded bg-red-600 text-white hover:bg-red-700"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>

                            {/* Caption input */}
                            <div className="p-1 bg-white border-t border-slate-100">
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

        {/* SLIDE: SUMÁRIO & OUTROS */}
        {slide.type !== 'capa' && slide.type !== 'evidencia' && (
          <div className="flex-1 bg-white p-8 flex flex-col justify-between">
            <div>
              <div className="text-xs text-[#00A3E0] font-bold tracking-wider uppercase mb-1">
                {book.courseName} · {slide.type.toUpperCase()}
              </div>
              <input
                type="text"
                value={slide.title}
                onChange={(e) => onUpdateSlide({ title: e.target.value })}
                className="w-full bg-transparent font-bold text-2xl text-[#001D3D] border-b border-slate-200 pb-2 focus:outline-hidden"
              />
            </div>

            <div className="my-auto space-y-4">
              <textarea
                rows={4}
                value={slide.customText1 || ''}
                onChange={(e) => onUpdateSlide({ customText1: e.target.value })}
                placeholder="Texto explicativo ou tópicos do Book..."
                className="w-full bg-transparent text-sm text-slate-800 leading-relaxed focus:outline-hidden resize-none"
              />
            </div>

            {/* Slide footer - Totalmente Editável */}
            <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 gap-3">
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <input
                  type="text"
                  value={slide.footerLeftText !== undefined ? slide.footerLeftText : `${campus.fullName} · ${book.courseName}`}
                  onChange={(e) => onUpdateSlide({ footerLeftText: e.target.value })}
                  placeholder="Instituição / Campus no rodapé..."
                  className="bg-transparent font-medium text-slate-700 hover:bg-slate-100/70 focus:bg-white focus:ring-1 focus:ring-[#00A3E0] rounded px-1.5 py-0.5 w-full border-b border-transparent hover:border-slate-300 focus:outline-hidden transition-colors truncate text-xs"
                  title="Clique para editar as informações do rodapé"
                />
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <input
                  type="text"
                  value={slide.footerRightText !== undefined ? slide.footerRightText : `Slide ${slideIndex} de ${totalSlides}`}
                  onChange={(e) => onUpdateSlide({ footerRightText: e.target.value })}
                  placeholder={`Slide ${slideIndex} de ${totalSlides}`}
                  className="bg-transparent font-mono text-slate-500 text-right hover:bg-slate-100/70 focus:bg-white focus:ring-1 focus:ring-[#00A3E0] rounded px-1.5 py-0.5 border-b border-transparent hover:border-slate-300 focus:outline-hidden transition-colors w-28 text-xs"
                  title="Clique para editar a numeração ou anotação do rodapé"
                />
              </div>
            </div>
          </div>
        )}

        {/* CUSTOM FREE TEXT BOXES (POWERPOINT STYLE MOVABLE & RESIZABLE) */}
        {(slide.customTextBoxes || []).map((box) => {
          const isSelected = selectedTextBoxId === box.id;
          return (
            <div
              key={box.id}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedTextBoxId(box.id);
              }}
              style={{
                left: `${box.x}%`,
                top: `${box.y}%`,
                width: `${box.width}%`,
              }}
              className={`absolute cursor-move z-30 transition-shadow ${
                isSelected
                  ? 'ring-2 ring-[#00A3E0] bg-white/95 rounded p-1 shadow-md'
                  : 'hover:ring-1 hover:ring-slate-300 rounded p-1'
              }`}
            >
              {/* Drag handle & actions toolbar when selected */}
              {isSelected && (
                <div className="absolute -top-7 left-0 flex items-center gap-1 bg-[#001D3D] text-white px-2 py-0.5 rounded text-[10px] font-mono shadow-xs z-40">
                  <span
                    onMouseDown={(e) => startDragBox(e, box)}
                    className="cursor-grab flex items-center gap-1"
                  >
                    <Move className="w-3 h-3 text-[#00A3E0]" />
                    <span>Mover</span>
                  </span>
                  <span className="text-white/30">|</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUpdateTextBox(box.id, { bold: !box.bold });
                    }}
                    className={`px-1 rounded ${box.bold ? 'bg-[#00A3E0] text-black font-bold' : ''}`}
                  >
                    B
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUpdateTextBox(box.id, { italic: !box.italic });
                    }}
                    className={`px-1 rounded ${box.italic ? 'bg-[#00A3E0] text-black italic' : ''}`}
                  >
                    I
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteTextBox(box.id);
                    }}
                    className="text-red-400 hover:text-red-300 ml-1"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )}

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
                rows={2}
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
