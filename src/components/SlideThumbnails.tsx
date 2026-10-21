import React from 'react';
import { 
  Plus, 
  Copy, 
  Trash2, 
  ChevronUp, 
  ChevronDown, 
  FileText, 
  Image as ImageIcon, 
  Users, 
  Award, 
  BarChart3, 
  PhoneCall, 
  ListOrdered
} from 'lucide-react';
import { SlideData, SlideType } from '../types';

interface SlideThumbnailsProps {
  slides: SlideData[];
  activeSlideId: string;
  onSelectSlide: (id: string) => void;
  onAddSlide: () => void;
  onDuplicateSlide: (id: string) => void;
  onDeleteSlide: (id: string) => void;
  onMoveSlide: (index: number, direction: 'up' | 'down') => void;
}

export const SlideThumbnails: React.FC<SlideThumbnailsProps> = ({
  slides,
  activeSlideId,
  onSelectSlide,
  onAddSlide,
  onDuplicateSlide,
  onDeleteSlide,
  onMoveSlide,
}) => {
  const getSlideIcon = (type: SlideType) => {
    switch (type) {
      case 'capa':
        return <Award className="w-3.5 h-3.5 text-[#00A3E0]" />;
      case 'sumario':
        return <ListOrdered className="w-3.5 h-3.5 text-slate-500" />;
      case 'apresentacao':
      case 'diretrizes':
        return <FileText className="w-3.5 h-3.5 text-indigo-500" />;
      case 'equipe':
        return <Users className="w-3.5 h-3.5 text-emerald-500" />;
      case 'evidencia':
        return <ImageIcon className="w-3.5 h-3.5 text-sky-500" />;
      case 'metricas':
      case 'resultados':
        return <BarChart3 className="w-3.5 h-3.5 text-amber-500" />;
      case 'contatos':
        return <PhoneCall className="w-3.5 h-3.5 text-slate-500" />;
      default:
        return <FileText className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  return (
    <aside className="no-print w-64 shrink-0 bg-slate-50/80 border-r border-slate-200 flex flex-col h-[calc(100vh-53px)] select-none">
      {/* Top Header of Sidebar */}
      <div className="p-3 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Estrutura do Book
          </span>
          <span className="text-[11px] font-mono bg-white px-1.5 py-0.5 rounded-sm border border-slate-200 text-slate-500">
            {slides.length} slides
          </span>
        </div>

        <button
          onClick={onAddSlide}
          title="Inserir novo slide institucional"
          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-white bg-[#004B8D] hover:bg-[#00386B] rounded-md transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Slide</span>
        </button>
      </div>

      {/* Thumbnails list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {slides.map((slide, index) => {
          const isActive = slide.id === activeSlideId;
          const photoCount = slide.photos?.length || 0;

          return (
            <div
              key={slide.id}
              onClick={() => onSelectSlide(slide.id)}
              className={`group relative rounded-lg border text-left p-2 cursor-pointer transition-all ${
                isActive
                  ? 'bg-white border-[#00A3E0] shadow-sm ring-1 ring-[#00A3E0]'
                  : 'bg-white/60 hover:bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              {/* Slide preview header */}
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono font-bold text-slate-400">
                    #{index + 1 < 10 ? `0${index + 1}` : index + 1}
                  </span>
                  <div className="p-0.5 rounded-sm bg-slate-100">
                    {getSlideIcon(slide.type)}
                  </div>
                  <span className="text-[10px] font-semibold uppercase text-slate-500 truncate max-w-[100px]">
                    {slide.type}
                  </span>
                </div>

                {/* Quick actions on hover */}
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    disabled={index === 0}
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveSlide(index, 'up');
                    }}
                    title="Mover para cima"
                    className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20"
                  >
                    <ChevronUp className="w-3 h-3" />
                  </button>
                  <button
                    disabled={index === slides.length - 1}
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveSlide(index, 'down');
                    }}
                    title="Mover para baixo"
                    className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20"
                  >
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDuplicateSlide(slide.id);
                    }}
                    title="Duplicar slide"
                    className="p-1 text-slate-400 hover:text-[#004B8D]"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                  {slides.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSlide(slide.id);
                      }}
                      title="Excluir slide"
                      className="p-1 text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Slide thumbnail miniature preview (16:9 aspect box) */}
              <div className={`relative aspect-16/9 w-full rounded-sm border overflow-hidden flex flex-col justify-between p-1.5 pointer-events-none select-none ${
                slide.type === 'capa' ? 'bg-[#001D3D] text-white border-[#00A3E0]/40' : 'bg-slate-100 text-slate-800 border-slate-200'
              }`}>
                {/* Mini top cyan bar */}
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#00A3E0] z-20" />

                {slide.type === 'capa' ? (
                  <>
                    {slide.photos && slide.photos[0]?.url && (
                      <div className="absolute top-0 bottom-0 right-0 w-3/5 overflow-hidden pointer-events-none">
                        <img
                          src={slide.photos[0].url}
                          alt="Capa"
                          className="w-full h-full object-cover opacity-85"
                          style={{
                            transform: `scale(${slide.photos[0].zoom || 1}) translate(${slide.photos[0].x || 0}%, ${slide.photos[0].y || 0}%) rotate(${slide.photos[0].rotation || 0}deg)`,
                            objectPosition: slide.photos[0].position === 'top' ? 'top center' : slide.photos[0].position === 'bottom' ? 'bottom center' : slide.photos[0].position === 'left' ? 'left center' : slide.photos[0].position === 'right' ? 'right center' : `${slide.photos[0].cropX ?? 50}% ${slide.photos[0].cropY ?? 50}%`,
                          }}
                        />
                        <div
                          className="absolute inset-0"
                          style={{
                            background: 'linear-gradient(90deg, #001D3D 0%, #001D3D 30%, rgba(0,29,61,0.85) 60%, rgba(0,29,61,0.2) 100%)',
                          }}
                        />
                      </div>
                    )}
                    <div className="relative z-10 flex flex-col justify-between h-full pt-0.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[7.5px] font-extrabold text-[#00A3E0]">ESTÁCIO</span>
                        <span className="text-[6.5px] font-mono text-slate-300">16:9</span>
                      </div>
                      <div className="my-auto py-0.5">
                        <div className="text-[8px] font-bold text-white line-clamp-1 leading-tight">
                          {slide.title || 'Book de Evidências'}
                        </div>
                        <div className="text-[6.5px] text-slate-300 line-clamp-1">
                          {slide.subtitle}
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[6.5px] text-slate-300 border-t border-white/10 pt-0.5">
                        <span className="text-[#00A3E0] font-bold truncate max-w-[90px]">
                          {slide.customText1 || 'Capa Oficial'}
                        </span>
                        <span className="font-mono text-[6px]">OFICIAL</span>
                      </div>
                    </div>
                  </>
                ) : slide.type === 'evidencia' ? (
                  /* Slide de Evidência com visualização proporcional fiel (2 colunas: Objetivo + Fotos) */
                  <div className="relative z-10 flex flex-col justify-between h-full pt-0.5">
                    <div>
                      <div className="flex items-center justify-between text-[6.5px] text-[#00A3E0] font-bold tracking-tight uppercase truncate">
                        <span className="truncate max-w-[110px]">{slide.activityType || 'ATIVIDADE'}</span>
                        <span className="font-mono text-slate-400">{slide.date || ''}</span>
                      </div>
                      <div className="text-[7.5px] font-bold text-slate-900 line-clamp-1 leading-tight">
                        {slide.title || 'Atividade sem título'}
                      </div>
                    </div>

                    {/* Miniature 2-Column Stage matching SlideCanvas and PowerPoint */}
                    <div className="my-0.5 flex-1 min-h-0 flex flex-row gap-1 items-stretch">
                      {/* Left Mini Objective Card */}
                      <div className="w-[40%] bg-slate-200/50 border border-slate-300/60 rounded-[2px] p-1 flex flex-col justify-between overflow-hidden">
                        <span className="text-[5.5px] font-bold text-[#004B8D] uppercase tracking-tighter truncate block">
                          Objetivo
                        </span>
                        <div className="space-y-0.5 my-auto">
                          <div className="h-[2px] w-full bg-slate-300 rounded-[1px]" />
                          <div className="h-[2px] w-4/5 bg-slate-300 rounded-[1px]" />
                          <div className="h-[2px] w-3/5 bg-slate-300 rounded-[1px]" />
                        </div>
                        <span className="text-[5px] text-slate-400 truncate block">
                          Registro
                        </span>
                      </div>

                      {/* Right Mini Photos Card */}
                      <div className="w-[60%] flex flex-col justify-between overflow-hidden">
                        {slide.photos && slide.photos.length > 0 ? (
                          <div
                            className={`h-full grid gap-0.5 overflow-hidden rounded-[2px] bg-slate-200/60 ${
                              slide.photoLayout === 'split-50-50' || slide.photos.length === 2
                                ? 'grid-rows-2'
                                : slide.photoLayout === 'grid-3' || slide.photos.length >= 3
                                ? 'grid-cols-2 grid-rows-2'
                                : 'grid-cols-1'
                            }`}
                          >
                            {slide.photos.slice(0, 4).map((ph, pIdx) => (
                              <div key={ph.id || pIdx} className="relative w-full h-full min-h-0 overflow-hidden bg-slate-300 rounded-[1px]">
                                <img
                                  src={ph.url}
                                  alt=""
                                  className={`w-full h-full ${ph.fit === 'contain' ? 'object-contain' : 'object-cover'}`}
                                  style={{
                                    transform: `scale(${(ph.zoom || 1) * (ph.scale || 1)}) translate(${ph.x || 0}%, ${ph.y || 0}%) rotate(${ph.rotation || 0}deg)`,
                                    objectPosition: ph.position === 'top' ? 'top center' : ph.position === 'bottom' ? 'bottom center' : ph.position === 'left' ? 'left center' : ph.position === 'right' ? 'right center' : `${ph.cropX ?? 50}% ${ph.cropY ?? 50}%`,
                                  }}
                                />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="h-full border border-dashed border-slate-300 rounded-[2px] bg-slate-100 flex items-center justify-center">
                            <span className="text-[5.5px] text-slate-400">Sem fotos</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Render custom free text boxes miniature */}
                    {(slide.customTextBoxes || []).map((box) => (
                      <div
                        key={box.id}
                        style={{
                          left: `${box.x}%`,
                          top: `${box.y}%`,
                          width: `${box.width}%`,
                          color: box.color || '#0F172A',
                          fontWeight: box.bold ? 'bold' : 'normal',
                          fontStyle: box.italic ? 'italic' : 'normal',
                        }}
                        className="absolute z-20 text-[5px] leading-tight line-clamp-1 pointer-events-none overflow-hidden"
                      >
                        {box.text}
                      </div>
                    ))}

                    <div className="flex items-center justify-between text-[6px] text-slate-400 border-t border-slate-200 pt-0.5">
                      <span className="truncate max-w-[90px]">{slide.footerLeftText || 'Estácio'}</span>
                      <span className="font-mono text-[5.5px]">16:9</span>
                    </div>
                  </div>
                ) : slide.type === 'sumario' ? (
                  /* Miniatura Sumário Analítico */
                  <div className="relative z-10 flex flex-col justify-between h-full pt-0.5">
                    <div>
                      <div className="text-[6.5px] text-[#00A3E0] font-bold tracking-tight uppercase truncate">
                        SUMÁRIO ANALÍTICO
                      </div>
                      <div className="text-[7.5px] font-bold text-slate-800 line-clamp-1 leading-tight">
                        {slide.title || 'Sumário das Atividades'}
                      </div>
                    </div>
                    <div className="my-auto grid grid-cols-2 gap-1 py-0.5">
                      {[1, 2, 3, 4].map((n) => (
                        <div key={n} className="flex items-center gap-1 p-0.5 rounded-[2px] bg-slate-50 border border-slate-200">
                          <span className="w-2.5 h-2.5 rounded-[1px] bg-[#E0F2FE] text-[#004B8D] font-mono text-[5px] font-bold flex items-center justify-center shrink-0">
                            0{n}
                          </span>
                          <div className="h-[2px] w-8 bg-slate-300 rounded-[1px]" />
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between text-[6px] text-slate-400 border-t border-slate-200 pt-0.5">
                      <span className="truncate max-w-[80px]">{slide.footerLeftText || 'Estácio'}</span>
                      <span className="font-mono text-[5.5px]">16:9</span>
                    </div>
                  </div>
                ) : slide.type === 'apresentacao' ? (
                  /* Miniatura Apresentação (2 Cards) */
                  <div className="relative z-10 flex flex-col justify-between h-full pt-0.5">
                    <div>
                      <div className="text-[6.5px] text-[#00A3E0] font-bold tracking-tight uppercase truncate">
                        APRESENTAÇÃO
                      </div>
                      <div className="text-[7.5px] font-bold text-slate-800 line-clamp-1 leading-tight">
                        {slide.title || 'Apresentação'}
                      </div>
                    </div>
                    <div className="my-auto grid grid-cols-2 gap-1 py-0.5">
                      <div className="rounded-[2px] border border-slate-200 bg-slate-50 overflow-hidden">
                        <div className="h-1.5 bg-[#E0F2FE] border-b border-slate-200 flex items-center px-0.5">
                          <span className="text-[4.5px] font-bold text-[#004B8D]">01. Contexto</span>
                        </div>
                        <div className="p-1 space-y-0.5">
                          <div className="h-[2px] w-full bg-slate-300 rounded-[1px]" />
                          <div className="h-[2px] w-4/5 bg-slate-300 rounded-[1px]" />
                        </div>
                      </div>
                      <div className="rounded-[2px] border border-slate-200 bg-slate-50 overflow-hidden">
                        <div className="h-1.5 bg-[#E0F2FE] border-b border-slate-200 flex items-center px-0.5">
                          <span className="text-[4.5px] font-bold text-[#004B8D]">02. Metodologia</span>
                        </div>
                        <div className="p-1 space-y-0.5">
                          <div className="h-[2px] w-full bg-slate-300 rounded-[1px]" />
                          <div className="h-[2px] w-4/5 bg-slate-300 rounded-[1px]" />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[6px] text-slate-400 border-t border-slate-200 pt-0.5">
                      <span className="truncate max-w-[80px]">{slide.footerLeftText || 'Estácio'}</span>
                      <span className="font-mono text-[5.5px]">16:9</span>
                    </div>
                  </div>
                ) : slide.type === 'diretrizes' ? (
                  /* Miniatura Diretrizes MEC */
                  <div className="relative z-10 flex flex-col justify-between h-full pt-0.5">
                    <div>
                      <div className="text-[6.5px] text-[#00A3E0] font-bold tracking-tight uppercase truncate">
                        DIRETRIZES MEC
                      </div>
                      <div className="text-[7.5px] font-bold text-slate-800 line-clamp-1 leading-tight">
                        {slide.title || 'Diretrizes Curriculares'}
                      </div>
                    </div>
                    <div className="my-auto space-y-1 py-0.5">
                      {[1, 2].map((i) => (
                        <div key={i} className="rounded-[2px] border border-slate-200 bg-slate-50 flex items-stretch overflow-hidden">
                          <div className="w-0.5 bg-[#00A3E0] shrink-0" />
                          <div className="p-0.5 flex-1 space-y-0.5">
                            <div className="h-[2px] w-2/3 bg-slate-400 rounded-[1px]" />
                            <div className="h-[2px] w-full bg-slate-200 rounded-[1px]" />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between text-[6px] text-slate-400 border-t border-slate-200 pt-0.5">
                      <span className="truncate max-w-[80px]">{slide.footerLeftText || 'Estácio'}</span>
                      <span className="font-mono text-[5.5px]">16:9</span>
                    </div>
                  </div>
                ) : (
                  /* Demais slides com títulos e layouts institucionais (equipe, contatos, etc.) */
                  <div className="relative z-10 flex flex-col justify-between h-full pt-0.5">
                    <div>
                      <div className="text-[6.5px] text-[#00A3E0] font-bold tracking-tight uppercase truncate">
                        {slide.type.toUpperCase()}
                      </div>
                      <div className="text-[7.5px] font-bold text-slate-800 line-clamp-1 leading-tight">
                        {slide.title || 'Slide Institucional'}
                      </div>
                    </div>

                    <div className="my-auto py-0.5 grid grid-cols-2 gap-1">
                      <div className="h-4 rounded-[2px] bg-slate-50 border border-slate-200 p-0.5 space-y-0.5">
                        <div className="h-[2px] w-3/4 bg-[#004B8D] rounded-[1px]" />
                        <div className="h-[2px] w-full bg-slate-200 rounded-[1px]" />
                      </div>
                      <div className="h-4 rounded-[2px] bg-slate-50 border border-slate-200 p-0.5 space-y-0.5">
                        <div className="h-[2px] w-3/4 bg-[#004B8D] rounded-[1px]" />
                        <div className="h-[2px] w-full bg-slate-200 rounded-[1px]" />
                      </div>
                    </div>

                    {/* Render custom free text boxes miniature */}
                    {(slide.customTextBoxes || []).map((box) => (
                      <div
                        key={box.id}
                        style={{
                          left: `${box.x}%`,
                          top: `${box.y}%`,
                          width: `${box.width}%`,
                          color: box.color || '#0F172A',
                          fontWeight: box.bold ? 'bold' : 'normal',
                          fontStyle: box.italic ? 'italic' : 'normal',
                        }}
                        className="absolute z-20 text-[5px] leading-tight line-clamp-1 pointer-events-none overflow-hidden"
                      >
                        {box.text}
                      </div>
                    ))}

                    <div className="flex items-center justify-between text-[6px] text-slate-400 border-t border-slate-200 pt-0.5">
                      <span className="truncate max-w-[80px]">{slide.footerLeftText || 'Estácio'}</span>
                      <span className="font-mono text-[5.5px]">16:9</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer info */}
      <div className="p-3 border-t border-slate-200 text-[11px] text-slate-400 text-center bg-white/40">
        Clique para editar · Arraste para ordenar
      </div>
    </aside>
  );
};
