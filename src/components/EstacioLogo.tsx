import React, { useState } from 'react';
import estacioLogoOfficial from '../assets/images/estacio_logo_oficial.png';

interface EstacioLogoProps {
  className?: string;
  variant?: 'color' | 'white' | 'dark';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showCampusName?: string;
}

/**
 * Componente com a Logo Oficial da Estácio
 * - Importa o ativo diretamente via ESM para bundling garantido no Vercel/Netlify/Vite.
 * - Possui fallback automático para URL pública e SVG vetorial de alta fidelidade.
 * - Mantém proporções oficiais travadas (198 x 57, aspect ratio ~ 3.47:1) sem deslocamentos.
 */
export const EstacioLogo: React.FC<EstacioLogoProps> = ({
  className = '',
  variant = 'color',
  size = 'md',
  showCampusName,
}) => {
  const [imgErrorCount, setImgErrorCount] = useState(0);

  // Height and fixed dimensions to prevent layout shifts
  const sizeConfig = {
    sm: { heightClass: 'h-6', widthClass: 'w-[83px]', textClass: 'text-[9px]' },
    md: { heightClass: 'h-8', widthClass: 'w-[111px]', textClass: 'text-xs' },
    lg: { heightClass: 'h-10', widthClass: 'w-[139px]', textClass: 'text-sm' },
    xl: { heightClass: 'h-14', widthClass: 'w-[195px]', textClass: 'text-base' },
  }[size];

  const handleImageError = () => {
    setImgErrorCount((prev) => prev + 1);
  };

  const getSource = () => {
    if (imgErrorCount === 0) return estacioLogoOfficial;
    if (imgErrorCount === 1) return '/estacio_logo_oficial.png';
    if (imgErrorCount === 2) return '/assets/images/estacio_logo_oficial.png';
    return null;
  };

  const currentSrc = getSource();

  return (
    <div className={`inline-flex items-center gap-2 select-none shrink-0 ${className}`}>
      <div 
        className={`relative ${sizeConfig.heightClass} ${sizeConfig.widthClass} flex items-center justify-center shrink-0 overflow-hidden`}
        style={{ aspectRatio: '198 / 57' }}
      >
        {currentSrc ? (
          <img
            src={currentSrc}
            alt="Estácio - Logo Oficial"
            onError={handleImageError}
            className={`${sizeConfig.heightClass} w-auto object-contain block shrink-0 max-w-none`}
            style={{ aspectRatio: '198 / 57' }}
            loading="eager"
            decoding="sync"
          />
        ) : (
          /* SVG Vetorial de Segurança da Estácio: 4 diamantes geométricos + tipografia institucional */
          <svg
            viewBox="0 0 198 57"
            className={`${sizeConfig.heightClass} w-auto block shrink-0`}
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Ícone Geométrico Oficial Estácio */}
            <g transform="translate(4, 4)">
              {/* Losango Superior (Ciano) */}
              <polygon points="24,2 35,16 24,19 13,16" fill="#00A3E0" />
              {/* Losango Esquerdo (Azul Royal) */}
              <polygon points="12,17 23,20 12,33 2,24" fill="#004B8D" />
              {/* Losango Direito (Vermelho/Magenta Institucional) */}
              <polygon points="25,20 36,17 46,24 36,33" fill="#E30613" />
              {/* Losango Inferior (Azul Marinho) */}
              <polygon points="24,21 35,34 24,47 13,34" fill="#002244" />
            </g>
            {/* Tipografia ESTÁCIO */}
            <text
              x="58"
              y="38"
              fontFamily="'Plus Jakarta Sans', Arial, sans-serif"
              fontSize="29"
              fontWeight="900"
              letterSpacing="2.5"
              fill={variant === 'white' ? '#FFFFFF' : '#002B52'}
            >
              ESTÁCIO
            </text>
          </svg>
        )}
      </div>

      {showCampusName && (
        <div className="border-l border-slate-300 pl-2 leading-tight shrink-0">
          <span className="block text-[9.5px] uppercase font-bold text-slate-400 tracking-wider">
            Campus
          </span>
          <span className={`block font-extrabold text-[#004B8D] ${sizeConfig.textClass}`}>
            {showCampusName}
          </span>
        </div>
      )}
    </div>
  );
};
export default EstacioLogo;
