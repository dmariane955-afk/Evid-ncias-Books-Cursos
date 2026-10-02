import React, { useState, useEffect } from 'react';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Maximize, 
  Minimize, 
  Clock, 
  Award,
  Sparkles,
  BookOpen,
  Calendar,
  MapPin,
  Users2
} from 'lucide-react';
import { AcademicBook, SlideData } from '../types';
import { CAMPUS_CONFIGS } from '../data/defaults';
import { EstacioLogo } from './EstacioLogo';
import { getCourseCoverImage } from '../utils/courseCovers';

interface PresentationModalProps {
  isOpen: boolean;
  onClose: () => void;
  book: AcademicBook;
  initialSlideIndex?: number;
}

export const PresentationModal: React.FC<PresentationModalProps> = ({
  isOpen,
  onClose,
  book,
  initialSlideIndex = 0,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialSlideIndex);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const campus = CAMPUS_CONFIGS[book.campus] || CAMPUS_CONFIGS.curitiba;
  const currentSlide = book.slides[currentIndex] || book.slides[0];
  const totalSlides = book.slides.length;

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        setCurrentIndex((prev) => Math.min(prev + 1, totalSlides - 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        setCurrentIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, totalSlides, onClose]);

  if (!isOpen || !currentSlide) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-between select-none">
      {/* Top Floating Controls Bar */}
      <div className="w-full px-6 py-3 flex items-center justify-between text-white/80 bg-gradient-to-b from-black/80 to-transparent z-20">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-white tracking-tight">
            {campus.name}
          </span>
          <span className="text-white/40">|</span>
          <span className="text-xs text-white/70">
            {book.courseName} · {book.period}
          </span>
        </div>

        {/* Counter */}
        <div className="flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full text-xs font-mono">
          <span>
            {currentIndex + 1} / {totalSlides}
          </span>
        </div>

        {/* Exit & Fullscreen */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen();
                setIsFullscreen(true);
              } else {
                document.exitFullscreen();
                setIsFullscreen(false);
              }
            }}
            title="Alternar Tela Cheia"
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors"
          >
            {isFullscreen ? (
              <Minimize className="w-4 h-4" />
            ) : (
              <Maximize className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={onClose}
            title="Fechar Apresentação (Esc)"
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Slide 16:9 Viewport Stage */}
      <div className="flex-1 w-full max-w-6xl max-h-[82vh] aspect-16/9 bg-white my-auto rounded-lg shadow-2xl overflow-hidden flex flex-col justify-between relative">
        {/* Top cyan bar */}
        <div className="h-1.5 bg-[#00A3E0] shrink-0 w-full" />

        {/* Slide contents based on type */}
        {currentSlide.type === 'capa' && (() => {
          const capaCoverUrl = currentSlide.photos[0]?.url || book.coverImage || getCourseCoverImage(book.courseName, book.academicArea);
          const coverPhoto = currentSlide.photos[0];
          const coverPos = coverPhoto?.position || 'center';
          const coverZoom = coverPhoto?.zoom || 1;

          return (
            <div className="relative flex-1 bg-[#001D3D] text-white flex flex-col justify-between overflow-hidden select-none">
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
                    opacity: 0.88,
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
              <div 
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'linear-gradient(180deg, rgba(0,29,61,0.65) 0%, rgba(0,29,61,0) 25%, rgba(0,29,61,0) 70%, rgba(0,29,61,0.92) 100%)'
                }}
              />

              {/* CAMADA 4 & 5: CONTEÚDO, TEXTOS E ELEMENTOS INSTITUCIONAIS */}
              <div className="relative z-20 flex-1 p-8 sm:p-12 flex flex-col justify-between">
                {/* Cabeçalho */}
                <div className="flex items-center justify-between border-b border-white/15 pb-4">
                  <div className="flex items-center gap-4">
                    <div className="bg-white/95 px-3 py-1.5 rounded-lg shadow-sm flex items-center">
                      <EstacioLogo size="lg" />
                    </div>
                    <div className="border-l border-white/25 pl-3">
                      <div className="text-xs uppercase tracking-widest text-[#00A3E0] font-extrabold">
                        {currentSlide.customText1 || campus.fullName}
                      </div>
                      <div className="text-xs text-slate-300">
                        {campus.badge} · {campus.city}
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#003264]/90 border border-[#00A3E0] px-4 py-1.5 rounded-lg text-xs font-mono font-bold text-white shadow-sm">
                    PERÍODO {currentSlide.date || book.period}
                  </div>
                </div>

                {/* Região Central / Esquerda: Título Principal e Subtítulo */}
                <div className="my-auto py-6 max-w-2xl space-y-4">
                  <div className="inline-flex items-center gap-2 px-3.5 py-1 bg-[#00A3E0]/20 border border-[#00A3E0] rounded-sm text-[#00A3E0] font-extrabold text-xs uppercase tracking-wider backdrop-blur-xs">
                    <span>Curso:</span>
                    <span className="text-white">{currentSlide.customText1 || book.courseName}</span>
                  </div>
                  <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight drop-shadow-sm">
                    {currentSlide.title || 'Book de Evidências Acadêmicas'}
                  </h1>
                  <p className="text-base sm:text-lg text-slate-200 leading-relaxed drop-shadow-xs">
                    {currentSlide.subtitle}
                  </p>
                </div>

                {/* Ficha Técnica no Rodapé */}
                <div className="bg-[#002B52]/90 backdrop-blur-md border border-white/15 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs shadow-lg">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#00A3E0] block mb-0.5">
                      Curso / Habilitação
                    </span>
                    <span className="text-slate-100 font-semibold truncate block">
                      {currentSlide.customText1 || book.courseName}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#00A3E0] block mb-0.5">
                      Período Letivo
                    </span>
                    <span className="text-slate-100 font-mono font-bold">
                      {currentSlide.date || book.period}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#00A3E0] block mb-0.5">
                      Coordenação de Curso
                    </span>
                    <span className="text-slate-100 truncate block">
                      {currentSlide.customText2 || book.coordinator || 'Coordenação Acadêmica'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#00A3E0] block mb-0.5">
                      Campus / Direção
                    </span>
                    <span className="text-slate-100 truncate block">
                      {currentSlide.footerCustomText || campus.fullName}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {currentSlide.type === 'sumario' && (
          <div className="flex-1 bg-white p-8 flex flex-col justify-between">
            <div>
              <div className="text-xs text-[#00A3E0] font-bold tracking-wider uppercase mb-1">
                {book.courseName} · SUMÁRIO ANALÍTICO
              </div>
              <h2 className="text-2xl font-bold text-[#001D3D] border-b border-slate-200 pb-2">
                {currentSlide.title}
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-3 my-auto">
              {book.slides
                .filter((s) => s.type !== 'capa')
                .map((topic) => (
                  <div
                    key={topic.id}
                    className="flex items-start gap-2.5 p-2 rounded-lg bg-slate-50 border border-slate-200"
                  >
                    <span className="w-6 h-6 rounded bg-[#E0F2FE] text-[#004B8D] font-mono font-bold text-xs flex items-center justify-center shrink-0">
                      {topic.order < 10 ? `0${topic.order}` : topic.order}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">
                        {topic.title}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {topic.subtitle || 'Registro acadêmico'}
                      </div>
                    </div>
                  </div>
                ))}
            </div>

            <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <span>{campus.fullName}</span>
              <span className="font-mono">
                Slide {currentIndex + 1} de {totalSlides}
              </span>
            </div>
          </div>
        )}

        {currentSlide.type === 'evidencia' && (
          <div className="flex-1 bg-white p-8 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs text-[#00A3E0] font-bold tracking-wider uppercase mb-1">
                <span>
                  {book.courseName} · {currentSlide.evidenceMeta?.category || 'EVIDÊNCIA'}
                </span>
                <span className="font-mono text-slate-400">{book.period}</span>
              </div>
              <h2 className="text-2xl font-bold text-[#001D3D]">
                {currentSlide.title}
              </h2>

              {currentSlide.evidenceMeta && (
                <div className="mt-2 py-1.5 px-3 bg-slate-50 rounded-md border border-slate-200 flex items-center justify-between text-xs text-slate-600">
                  <div className="flex items-center gap-4">
                    <span><b>Data:</b> {currentSlide.evidenceMeta.date}</span>
                    <span><b>Local:</b> {currentSlide.evidenceMeta.location}</span>
                    <span><b>Docente:</b> {currentSlide.evidenceMeta.professor}</span>
                  </div>
                  <div className="font-bold text-[#004B8D]">
                    {currentSlide.evidenceMeta.studentsCount} acadêmicos
                  </div>
                </div>
              )}
            </div>

            <div className="flex-1 my-3 flex flex-row gap-6 min-h-0">
              <div className="w-5/12 bg-slate-50/90 border border-slate-200 rounded-lg p-4 flex flex-col justify-between">
                <div>
                  <span className="text-xs uppercase font-bold text-[#004B8D] block mb-2">
                    Registro das Ações
                  </span>
                  <p className="text-xs sm:text-sm text-slate-800 leading-relaxed">
                    {currentSlide.evidenceMeta?.actionsReport}
                  </p>
                </div>

                {currentSlide.evidenceMeta?.pedagogicalImpact && (
                  <div className="pt-3 border-t border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-[#00A3E0] block">
                      Impacto Formativo / DCN:
                    </span>
                    <p className="text-xs text-slate-600 italic">
                      {currentSlide.evidenceMeta.pedagogicalImpact}
                    </p>
                  </div>
                )}
              </div>

              <div className="w-7/12 flex items-center justify-center">
                {currentSlide.photos && currentSlide.photos.length > 0 ? (
                  <div
                    className={`grid gap-2 w-full h-full ${
                      currentSlide.photos.length === 2 ? 'grid-cols-2' : 'grid-cols-1'
                    }`}
                  >
                    {currentSlide.photos.map((p) => (
                      <div
                        key={p.id}
                        className="rounded-lg overflow-hidden border border-slate-200 relative bg-slate-100 flex flex-col justify-between"
                      >
                        <img
                          src={p.url}
                          alt={p.caption || 'Foto'}
                          className={`w-full h-full ${
                            p.fit === 'contain' ? 'object-contain' : 'object-cover'
                          }`}
                        />
                        {p.caption && (
                          <div className="p-1.5 bg-white/90 text-[10px] text-slate-700 italic border-t border-slate-200 truncate">
                            {p.caption}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-slate-400 text-xs">Registro textual de evidência</div>
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <span className="font-medium text-slate-700">{currentSlide.footerLeftText || `${campus.fullName} · ${book.courseName}`}</span>
              <span className="font-mono">
                {currentSlide.footerRightText || `Slide ${currentIndex + 1} de ${totalSlides}`}
              </span>
            </div>
          </div>
        )}

        {/* Fallback for other slide types */}
        {['apresentacao', 'diretrizes', 'equipe', 'metricas', 'resultados', 'contatos'].includes(
          currentSlide.type
        ) && (
          <div className="flex-1 bg-white p-8 flex flex-col justify-between">
            <div>
              <div className="text-xs text-[#00A3E0] font-bold tracking-wider uppercase mb-1">
                {book.courseName} · {currentSlide.type.toUpperCase()}
              </div>
              <h2 className="text-2xl font-bold text-[#001D3D] border-b border-slate-200 pb-2">
                {currentSlide.title}
              </h2>
            </div>

            <div className="my-auto">
              {currentSlide.customText1 && (
                <p className="text-sm text-slate-800 leading-relaxed max-w-3xl mb-4">
                  {currentSlide.customText1}
                </p>
              )}
              {currentSlide.customText2 && (
                <p className="text-sm text-slate-800 leading-relaxed max-w-3xl">
                  {currentSlide.customText2}
                </p>
              )}
            </div>

            <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <span className="font-medium text-slate-700">{currentSlide.footerLeftText || `${campus.fullName} · ${book.courseName}`}</span>
              <span className="font-mono">
                {currentSlide.footerRightText || `Slide ${currentIndex + 1} de ${totalSlides}`}
              </span>
            </div>
          </div>
        )}

        {/* CUSTOM FREE TEXT BOXES (POWERPOINT STYLE) IN PRESENTATION MODE */}
        {(currentSlide.customTextBoxes || []).map((box) => (
          <div
            key={box.id}
            style={{
              position: 'absolute',
              left: `${box.x}%`,
              top: `${box.y}%`,
              width: `${box.width}%`,
              fontSize: `${box.fontSize || 14}px`,
              color: box.color || '#0F172A',
              fontWeight: box.bold ? 'bold' : 'normal',
              fontStyle: box.italic ? 'italic' : 'normal',
              textAlign: box.align || 'left',
              pointerEvents: 'none',
              zIndex: 30,
            }}
            className="leading-relaxed whitespace-pre-wrap select-none"
          >
            {box.text}
          </div>
        ))}
      </div>

      {/* Bottom Floating Navigation Buttons */}
      <div className="w-full px-6 py-4 flex items-center justify-center gap-4 bg-gradient-to-t from-black/80 to-transparent z-20">
        <button
          disabled={currentIndex === 0}
          onClick={() => setCurrentIndex((prev) => Math.max(prev - 1, 0))}
          className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium text-xs flex items-center gap-1.5 transition-colors disabled:opacity-20"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Anterior</span>
        </button>

        <span className="text-xs text-white/60 font-mono">
          Use as setas do teclado para navegar
        </span>

        <button
          disabled={currentIndex === totalSlides - 1}
          onClick={() => setCurrentIndex((prev) => Math.min(prev + 1, totalSlides - 1))}
          className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium text-xs flex items-center gap-1.5 transition-colors disabled:opacity-20"
        >
          <span>Próximo</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
