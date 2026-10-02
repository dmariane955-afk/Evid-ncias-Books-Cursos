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
              <div className={`relative aspect-16/9 w-full rounded-sm border overflow-hidden flex flex-col justify-between p-1.5 pointer-events-none ${
                slide.type === 'capa' ? 'bg-[#001D3D] text-white border-[#00A3E0]/40' : 'bg-slate-100 text-slate-800 border-slate-200'
              }`}>
                {/* Mini top cyan bar */}
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#00A3E0]" />

                {slide.type === 'capa' ? (
                  <>
                    {slide.photos[0]?.url && (
                      <div className="absolute top-0 bottom-0 right-0 w-3/5 overflow-hidden pointer-events-none">
                        <img
                          src={slide.photos[0].url}
                          alt="Capa"
                          className="w-full h-full object-cover opacity-80"
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
                ) : (
                  <>
                    <div className="pt-1">
                      <div className="text-[9px] font-bold text-slate-800 line-clamp-1">
                        {slide.title || 'Slide sem título'}
                      </div>
                      {slide.subtitle && (
                        <div className="text-[7.5px] text-slate-500 line-clamp-1">
                          {slide.subtitle}
                        </div>
                      )}
                    </div>

                    {/* Content preview indicators */}
                    <div className="flex items-center justify-between text-[7px] text-slate-400">
                      {slide.type === 'evidencia' ? (
                        <div className="flex items-center gap-1">
                          {photoCount > 0 ? (
                            <span className="text-[#00A3E0] font-medium font-mono">
                              {photoCount} {photoCount === 1 ? 'foto' : 'fotos'}
                            </span>
                          ) : (
                            <span className="text-slate-400">Texto</span>
                          )}
                        </div>
                      ) : (
                        <span>Padrão Institucional</span>
                      )}
                      <span className="font-mono">16:9</span>
                    </div>
                  </>
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
