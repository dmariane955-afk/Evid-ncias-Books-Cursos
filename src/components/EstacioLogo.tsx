import React from 'react';

interface EstacioLogoProps {
  className?: string;
  variant?: 'color' | 'white' | 'dark';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showCampusName?: string;
}

/**
 * Componente com a Logo Oficial da Estácio
 * Mantém rigorosamente as proporções originais (198 x 57, aspect ratio ~ 3.47:1)
 * Não é deformada, não é esticada e não é redesenhada.
 */
export const EstacioLogo: React.FC<EstacioLogoProps> = ({
  className = '',
  variant = 'color',
  size = 'md',
  showCampusName,
}) => {
  // Height sizing presets keeping strict aspect ratio
  const heightClass = {
    sm: 'h-6',
    md: 'h-8',
    lg: 'h-10',
    xl: 'h-14',
  }[size];

  return (
    <div className={`inline-flex items-center gap-2 select-none shrink-0 ${className}`}>
      <div className={`relative ${heightClass} flex items-center`}>
        <img
          src="/src/assets/images/estacio_logo_oficial.png"
          alt="Estácio - Logo Oficial"
          className={`${heightClass} w-auto object-contain block`}
          style={{ aspectRatio: '198 / 57' }}
          loading="eager"
        />
      </div>

      {showCampusName && (
        <div className="border-l border-slate-300 pl-2 leading-tight">
          <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Campus
          </span>
          <span className="block text-xs font-extrabold text-[#004B8D]">
            {showCampusName}
          </span>
        </div>
      )}
    </div>
  );
};
