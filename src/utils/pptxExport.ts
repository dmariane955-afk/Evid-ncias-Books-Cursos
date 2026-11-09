import pptxgen from 'pptxgenjs';
import confetti from 'canvas-confetti';
import { AcademicBook, SlideData, PhotoItem } from '../types';
import { CAMPUS_CONFIGS, AREA_CONFIGS } from '../data/defaults';
import { getCourseCoverImage } from './courseCovers';
import { computePhotoLayout } from './photoLayoutEngine';
import estacioLogoOfficial from '../assets/images/estacio_logo_oficial.png';

function cleanColorHex(colorStr?: string, defaultColor: string = '000000'): string {
  if (!colorStr || colorStr === 'transparent') return defaultColor;
  return colorStr.replace('#', '').trim();
}

/**
 * Converts image URL (local asset, remote URL, or blob) to base64 Data URI
 */
async function toDataUri(url: string): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith('data:image/')) return url;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.onerror = () => {
        resolve(null);
      };
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn('Could not load image for PPTX export:', url, err);
    return null;
  }
}

/**
 * Creates the official cover composite background (Solid navy blue on the left transitioning
 * via progressive transparency degradê into the right-side course photograph).
 */
async function createPptxCapaBackground(coverImageUrl?: string): Promise<string | null> {
  if (!coverImageUrl) return null;
  return new Promise((resolve) => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1920;
      canvas.height = 1080;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(null);

      // Base solid navy background
      ctx.fillStyle = '#001D3D';
      ctx.fillRect(0, 0, 1920, 1080);

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        // Draw right-aligned course photograph occupying ~65% of width
        const imgX = 1920 * 0.35;
        const imgW = 1920 * 0.65;
        const imgH = 1080;

        const imgAspect = img.width / img.height;
        const targetAspect = imgW / imgH;
        let sWidth = img.width;
        let sHeight = img.height;
        let sx = 0;
        let sy = 0;

        if (imgAspect > targetAspect) {
          sWidth = img.height * targetAspect;
          sx = (img.width - sWidth) / 2;
        } else {
          sHeight = img.width / targetAspect;
          sy = (img.height - sHeight) / 2;
        }

        ctx.drawImage(img, sx, sy, sWidth, sHeight, imgX, 0, imgW, imgH);

        // Smooth progressive horizontal gradient from solid #001D3D to transparent
        const hGrad = ctx.createLinearGradient(0, 0, 1920, 0);
        hGrad.addColorStop(0, '#001D3D');
        hGrad.addColorStop(0.38, '#001D3D');
        hGrad.addColorStop(0.48, 'rgba(0, 29, 61, 0.95)');
        hGrad.addColorStop(0.60, 'rgba(0, 29, 61, 0.72)');
        hGrad.addColorStop(0.78, 'rgba(0, 29, 61, 0.35)');
        hGrad.addColorStop(0.90, 'rgba(0, 29, 61, 0.12)');
        hGrad.addColorStop(1.0, 'rgba(0, 29, 61, 0.05)');

        ctx.fillStyle = hGrad;
        ctx.fillRect(0, 0, 1920, 1080);

        // Smooth subtle vertical vignette for header/footer contrast
        const vGrad = ctx.createLinearGradient(0, 0, 0, 1080);
        vGrad.addColorStop(0, 'rgba(0, 29, 61, 0.65)');
        vGrad.addColorStop(0.25, 'rgba(0, 29, 61, 0)');
        vGrad.addColorStop(0.70, 'rgba(0, 29, 61, 0)');
        vGrad.addColorStop(1.0, 'rgba(0, 29, 61, 0.88)');

        ctx.fillStyle = vGrad;
        ctx.fillRect(0, 0, 1920, 1080);

        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(null);
      img.src = coverImageUrl;
    } catch {
      resolve(null);
    }
  });
}

/**
 * Triggers visual celebration confetti upon successful PPTX download
 */
export function fireCelebration() {
  confetti({
    particleCount: 80,
    spread: 70,
    origin: { y: 0.6 },
    colors: ['#004B8D', '#00A3E0', '#001D3D', '#38BDF8', '#60A5FA'],
  });
}

/**
 * Generates and downloads the official PowerPoint 16:9 presentation
 */
export async function exportToPowerPoint(book: AcademicBook): Promise<void> {
  const pres = new pptxgen();
  pres.layout = 'LAYOUT_16x9'; // 10 x 5.625 inches
  pres.title = book.title;
  pres.subject = `Book de Evidências Acadêmicas - ${book.courseName} - ${book.period}`;
  pres.author = `${book.coordinator} · ${CAMPUS_CONFIGS[book.campus]?.fullName || 'Estácio'}`;

  const campus = CAMPUS_CONFIGS[book.campus] || CAMPUS_CONFIGS.curitiba;
  const area = AREA_CONFIGS[book.academicArea] || AREA_CONFIGS.exatas;

  // Primary colors
  const primaryBlue = '004B8D';
  const cyanAccent = '00A3E0';
  const darkNavy = '001D3D';
  const textDark = '0F172A';
  const textMuted = '64748B';
  const bgLight = 'F8FAFC';

  // Helper to add institutional header & footer to standard slides
  const addInstitutionalChrome = (
    slide: pptxgen.Slide,
    slideIndex: number,
    totalSlides: number,
    categoryTag?: string,
    titleText?: string,
    slideData?: SlideData
  ) => {
    // Top cyan bar (h-1.5 equivalent)
    slide.addShape(pres.ShapeType.rect, {
      x: 0,
      y: 0,
      w: 10,
      h: 0.1,
      fill: { color: cyanAccent },
      line: { color: cyanAccent },
    });

    // Header Course Tag + Category
    const tagContent = `${book.courseName.toUpperCase()} · ${categoryTag ? categoryTag.toUpperCase() : 'RELATÓRIO DE EVIDÊNCIAS'}`;
    slide.addText(tagContent, {
      x: 0.8,
      y: 0.28,
      w: 8.4,
      h: 0.25,
      fontSize: 8.5,
      bold: true,
      color: cyanAccent,
      fontFace: 'Arial',
    });

    // Main Slide Title
    if (titleText) {
      slide.addText(titleText, {
        x: 0.8,
        y: 0.52,
        w: 8.4,
        h: 0.45,
        fontSize: 16,
        bold: true,
        color: darkNavy,
        fontFace: 'Arial',
      });
    }

    // Divider line
    slide.addShape(pres.ShapeType.line, {
      x: 0.8,
      y: 1.02,
      w: 8.4,
      h: 0,
      line: { color: 'E2E8F0', width: 1 },
    });

    // Footer divider line
    slide.addShape(pres.ShapeType.line, {
      x: 0.8,
      y: 5.15,
      w: 8.4,
      h: 0,
      line: { color: 'E2E8F0', width: 1 },
    });

    const leftText = slideData?.footerLeftText || `${campus.fullName} · ${book.courseName} · Período ${book.period}`;
    const rightText = slideData?.footerRightText || `Slide ${slideIndex} de ${totalSlides}`;

    // Footer Left: Campus + Period / Custom text
    slide.addText(leftText, {
      x: 0.8,
      y: 5.22,
      w: 6.0,
      h: 0.3,
      fontSize: 8,
      color: textMuted,
      fontFace: 'Arial',
    });

    // Footer Right: Slide Number / Custom annotation
    slide.addText(rightText, {
      x: 7.0,
      y: 5.22,
      w: 2.2,
      h: 0.3,
      fontSize: 8,
      align: 'right',
      color: textMuted,
      fontFace: 'Arial',
    });
  };

  const totalSlides = book.slides.length;

  for (let i = 0; i < book.slides.length; i++) {
    const s = book.slides[i];
    const slideNumber = i + 1;

    if (s.type === 'capa') {
      // SLIDE 01 - CAPA DO BOOK (NOVO DESIGN: AZUL COM DEGRADÊ E IMAGEM INTEGRADA)
      const slide = pres.addSlide();
      slide.background = { color: darkNavy };

      // Carregar Logo Oficial e Capa Coerente do Curso com degradê integrado
      const logoDataUri = (await toDataUri(estacioLogoOfficial)) || (await toDataUri('/estacio_logo_oficial.png'));
      const coverImageUrl = s.photos[0]?.url || book.coverImage || getCourseCoverImage(book.courseName, book.academicArea);
      const capaBgDataUri = await createPptxCapaBackground(coverImageUrl);

      // CAMADAS 1, 2 e 3: Imagem representativa integrada no lado direito via degradê com transparência progressiva
      if (capaBgDataUri) {
        slide.addImage({
          data: capaBgDataUri,
          x: 0,
          y: 0,
          w: 10,
          h: 5.625,
        });
      }

      // Top cyan accent line
      slide.addShape(pres.ShapeType.rect, {
        x: 0,
        y: 0,
        w: 10,
        h: 0.12,
        fill: { color: cyanAccent },
        line: { color: cyanAccent },
      });

      // Logo Oficial da Estácio no Cabeçalho (proporção 198 x 57 rigorosamente mantida)
      if (logoDataUri) {
        slide.addShape(pres.ShapeType.rect, {
          x: 0.8,
          y: 0.35,
          w: 2.1,
          h: 0.65,
          fill: { color: 'FFFFFF' },
          line: { color: 'CBD5E1', width: 1 },
          rectRadius: 0.05,
        });
        slide.addImage({
          data: logoDataUri,
          x: 0.95,
          y: 0.42,
          w: 1.8,
          h: 0.518, // 1.8 / (198/57) = 0.518 exato
        });
      }

      // Campus identification
      slide.addText((s.customText1 || campus.fullName).toUpperCase(), {
        x: 3.1,
        y: 0.42,
        w: 4.8,
        h: 0.3,
        fontSize: 10,
        bold: true,
        color: cyanAccent,
        fontFace: 'Arial',
      });
      slide.addText(`${campus.badge} · ${campus.city}`, {
        x: 3.1,
        y: 0.7,
        w: 4.8,
        h: 0.25,
        fontSize: 8.5,
        color: '94A3B8',
        fontFace: 'Arial',
      });

      // Period badge in top right
      slide.addShape(pres.ShapeType.rect, {
        x: 8.0,
        y: 0.42,
        w: 1.2,
        h: 0.4,
        fill: { color: '003264' },
        line: { color: cyanAccent, width: 1 },
        rectRadius: 0.04,
      });
      slide.addText(`CICLO ${s.date || book.period}`, {
        x: 8.0,
        y: 0.46,
        w: 1.2,
        h: 0.3,
        fontSize: 8,
        bold: true,
        align: 'center',
        color: 'FFFFFF',
        fontFace: 'Arial',
      });

      // Side decorative accent bar
      slide.addShape(pres.ShapeType.rect, {
        x: 0.8,
        y: 1.35,
        w: 0.1,
        h: 2.6,
        fill: { color: cyanAccent },
        line: { color: cyanAccent },
      });

      // Left Column (Text & Metadata)
      // Course Tag
      slide.addText(`CURSO DE GRADUAÇÃO · ${area.label.toUpperCase()}`, {
        x: 1.05,
        y: 1.3,
        w: 5.5,
        h: 0.25,
        fontSize: 8.5,
        bold: true,
        color: cyanAccent,
        fontFace: 'Arial',
      });

      // Course Name
      slide.addText(s.customText1 || book.courseName, {
        x: 1.05,
        y: 1.55,
        w: 5.5,
        h: 0.65,
        fontSize: 22,
        bold: true,
        color: 'FFFFFF',
        fontFace: 'Arial',
      });

      // Book Title
      slide.addText(s.title || 'Book de Evidências Acadêmicas', {
        x: 1.05,
        y: 2.25,
        w: 5.5,
        h: 0.45,
        fontSize: 15,
        bold: true,
        color: 'E2E8F0',
        fontFace: 'Arial',
      });

      // Subtitle
      slide.addText(s.subtitle || 'Registro Institucional de Atividades e Práticas Desenvolvidas', {
        x: 1.05,
        y: 2.72,
        w: 5.5,
        h: 0.45,
        fontSize: 10,
        color: '94A3B8',
        fontFace: 'Arial',
      });

      // Period Box
      slide.addShape(pres.ShapeType.rect, {
        x: 1.05,
        y: 3.3,
        w: 2.8,
        h: 0.45,
        fill: { color: '003264' },
        line: { color: '00A3E0', width: 1 },
        rectRadius: 0.04,
      });
      slide.addText(`PERÍODO LETIVO: ${s.date || book.period}`, {
        x: 1.15,
        y: 3.37,
        w: 2.6,
        h: 0.3,
        fontSize: 9,
        bold: true,
        color: 'FFFFFF',
        fontFace: 'Arial',
      });

      // Technical Team / Ficha Técnica (Divider line)
      slide.addShape(pres.ShapeType.line, {
        x: 0.8,
        y: 4.15,
        w: 8.4,
        h: 0,
        line: { color: '1E3A5F', width: 1 },
      });

      slide.addText('FICHA TÉCNICA INSTITUCIONAL', {
        x: 0.8,
        y: 4.25,
        w: 8.4,
        h: 0.22,
        fontSize: 8,
        bold: true,
        color: cyanAccent,
        fontFace: 'Arial',
      });

      const dirText = s.footerCustomText || book.director || campus.directorDefault || 'Campus Curitiba';
      const coordText = s.customText2 || book.coordinator || 'Coordenação de Curso';
      const courseText = s.customText1 || book.courseName;
      const periodText = s.date || book.period;

      slide.addText(
        `Curso: ${courseText}   |   Período: ${periodText}   |   Coordenação: ${coordText}   |   Unidade: ${dirText}`,
        {
          x: 0.8,
          y: 4.5,
          w: 8.4,
          h: 0.4,
          fontSize: 8.5,
          color: 'CBD5E1',
          fontFace: 'Arial',
        }
      );
    } else if (s.type === 'sumario') {
      // SLIDE 02 - SUMÁRIO EXECUTIVO
      const slide = pres.addSlide();
      slide.background = { color: 'FFFFFF' };
      addInstitutionalChrome(slide, slideNumber, totalSlides, 'SUMÁRIO EXECUTIVO', s.title, s);

      // Intro text
      slide.addText('Estrutura de apresentação e índice analítico do período acadêmico:', {
        x: 0.8,
        y: 1.15,
        w: 8.4,
        h: 0.3,
        fontSize: 10,
        color: textMuted,
        fontFace: 'Arial',
      });

      // Filter evidence slides and other topics
      const topics = book.slides.filter((item) => item.type !== 'capa');
      const col1 = topics.slice(0, 5);
      const col2 = topics.slice(5, 10);

      // Col 1 items
      col1.forEach((topic, idx) => {
        const topY = 1.55 + idx * 0.65;
        slide.addShape(pres.ShapeType.rect, {
          x: 0.8,
          y: topY,
          w: 0.4,
          h: 0.4,
          fill: { color: 'E0F2FE' },
          line: { color: cyanAccent, width: 1 },
        });
        slide.addText(`${topic.order < 10 ? '0' : ''}${topic.order}`, {
          x: 0.8,
          y: topY + 0.05,
          w: 0.4,
          h: 0.3,
          fontSize: 9,
          bold: true,
          align: 'center',
          color: primaryBlue,
          fontFace: 'Arial',
        });
        slide.addText(topic.title, {
          x: 1.3,
          y: topY,
          w: 3.6,
          h: 0.25,
          fontSize: 9.5,
          bold: true,
          color: darkNavy,
          fontFace: 'Arial',
        });
        slide.addText(topic.subtitle || 'Registro acadêmico oficial', {
          x: 1.3,
          y: topY + 0.22,
          w: 3.6,
          h: 0.25,
          fontSize: 8,
          color: textMuted,
          fontFace: 'Arial',
        });
      });

      // Col 2 items
      col2.forEach((topic, idx) => {
        const topY = 1.55 + idx * 0.65;
        slide.addShape(pres.ShapeType.rect, {
          x: 5.1,
          y: topY,
          w: 0.4,
          h: 0.4,
          fill: { color: 'E0F2FE' },
          line: { color: cyanAccent, width: 1 },
        });
        slide.addText(`${topic.order < 10 ? '0' : ''}${topic.order}`, {
          x: 5.1,
          y: topY + 0.05,
          w: 0.4,
          h: 0.3,
          fontSize: 9,
          bold: true,
          align: 'center',
          color: primaryBlue,
          fontFace: 'Arial',
        });
        slide.addText(topic.title, {
          x: 5.6,
          y: topY,
          w: 3.6,
          h: 0.25,
          fontSize: 9.5,
          bold: true,
          color: darkNavy,
          fontFace: 'Arial',
        });
        slide.addText(topic.subtitle || 'Registro acadêmico oficial', {
          x: 5.6,
          y: topY + 0.22,
          w: 3.6,
          h: 0.25,
          fontSize: 8,
          color: textMuted,
          fontFace: 'Arial',
        });
      });
    } else if (s.type === 'apresentacao') {
      // SLIDE 03 - APRESENTAÇÃO DO CURSO & PROPÓSITO PEDAGÓGICO
      const slide = pres.addSlide();
      slide.background = { color: 'FFFFFF' };
      addInstitutionalChrome(slide, slideNumber, totalSlides, 'DIRETRIZES PEDAGÓGICAS', s.title, s);

      // Card 1: Visão Geral e Estruturação Curricular
      slide.addShape(pres.ShapeType.rect, {
        x: 0.8,
        y: 1.3,
        w: 4.0,
        h: 3.5,
        fill: { color: 'F8FAFC' },
        line: { color: 'E2E8F0', width: 1 },
      });
      slide.addShape(pres.ShapeType.rect, {
        x: 0.8,
        y: 1.3,
        w: 4.0,
        h: 0.4,
        fill: { color: 'E0F2FE' },
        line: { color: 'E2E8F0', width: 1 },
      });
      slide.addText('01. VISÃO GERAL & OBJETIVOS FORMATIVOS', {
        x: 1.0,
        y: 1.38,
        w: 3.6,
        h: 0.25,
        fontSize: 9,
        bold: true,
        color: primaryBlue,
        fontFace: 'Arial',
      });
      slide.addText(
        s.customText1 ||
          'O curso articula rigor técnico-científico com aplicação prática imediata. As atividades foram estruturadas em torno de desafios reais do setor produtivo e da comunidade, promovendo aprendizagem autêntica.',
        {
          x: 1.0,
          y: 1.85,
          w: 3.6,
          h: 2.7,
          fontSize: 10,
          color: textDark,
          lineSpacing: 18,
          fontFace: 'Arial',
        }
      );

      // Card 2: Metodologia Ativa e Prática Laboratorial
      slide.addShape(pres.ShapeType.rect, {
        x: 5.2,
        y: 1.3,
        w: 4.0,
        h: 3.5,
        fill: { color: 'F8FAFC' },
        line: { color: 'E2E8F0', width: 1 },
      });
      slide.addShape(pres.ShapeType.rect, {
        x: 5.2,
        y: 1.3,
        w: 4.0,
        h: 0.4,
        fill: { color: 'E0F2FE' },
        line: { color: 'E2E8F0', width: 1 },
      });
      slide.addText('02. METODOLOGIA ATIVA & EXPERIMENTAÇÃO', {
        x: 5.4,
        y: 1.38,
        w: 3.6,
        h: 0.25,
        fontSize: 9,
        bold: true,
        color: primaryBlue,
        fontFace: 'Arial',
      });
      slide.addText(
        s.customText2 ||
          'A metodologia ativa adotada coloca o acadêmico como protagonista do processo de construção do conhecimento, transformando laboratórios e espaços práticos em polos vivos de cocriação, experimentação assistida e resolução ética de problemas.',
        {
          x: 5.4,
          y: 1.85,
          w: 3.6,
          h: 2.7,
          fontSize: 10,
          color: textDark,
          lineSpacing: 18,
          fontFace: 'Arial',
        }
      );
    } else if (s.type === 'diretrizes') {
      // SLIDE 04 - ALINHAMENTO COM DIRETRIZES CURRICULARES & MEC
      const slide = pres.addSlide();
      slide.background = { color: 'FFFFFF' };
      addInstitutionalChrome(slide, slideNumber, totalSlides, 'CONFORMIDADE REGULATÓRIA MEC', s.title, s);

      const compList = s.competencies || [];
      compList.forEach((comp, idx) => {
        const topY = 1.3 + idx * 1.2;
        slide.addShape(pres.ShapeType.rect, {
          x: 0.8,
          y: topY,
          w: 8.4,
          h: 1.05,
          fill: { color: 'F8FAFC' },
          line: { color: 'E2E8F0', width: 1 },
        });

        // Left color indicator
        slide.addShape(pres.ShapeType.rect, {
          x: 0.8,
          y: topY,
          w: 0.1,
          h: 1.05,
          fill: { color: cyanAccent },
          line: { color: cyanAccent },
        });

        // Code
        slide.addText(comp.code, {
          x: 1.05,
          y: topY + 0.12,
          w: 1.2,
          h: 0.25,
          fontSize: 8.5,
          bold: true,
          color: primaryBlue,
          fontFace: 'Arial',
        });

        // Title
        slide.addText(comp.title, {
          x: 2.1,
          y: topY + 0.1,
          w: 7.0,
          h: 0.25,
          fontSize: 10.5,
          bold: true,
          color: darkNavy,
          fontFace: 'Arial',
        });

        // Description
        slide.addText(comp.description, {
          x: 1.05,
          y: topY + 0.38,
          w: 8.0,
          h: 0.35,
          fontSize: 9,
          color: textDark,
          fontFace: 'Arial',
        });

        // MEC reference
        slide.addText(`Referência Normativa: ${comp.mecStandard}`, {
          x: 1.05,
          y: topY + 0.76,
          w: 8.0,
          h: 0.2,
          fontSize: 7.5,
          color: textMuted,
          italic: true,
          fontFace: 'Arial',
        });
      });
    } else if (s.type === 'equipe') {
      // SLIDE 05 - EQUIPE DOCENTE
      const slide = pres.addSlide();
      slide.background = { color: 'FFFFFF' };
      addInstitutionalChrome(slide, slideNumber, totalSlides, 'CORPO DOCENTE', s.title);

      const facultyList = s.facultyList || [];
      const colWidth = 4.0;
      facultyList.forEach((fac, idx) => {
        const col = idx % 2;
        const row = Math.floor(idx / 2);
        const posX = col === 0 ? 0.8 : 5.2;
        const posY = 1.35 + row * 1.65;

        slide.addShape(pres.ShapeType.rect, {
          x: posX,
          y: posY,
          w: colWidth,
          h: 1.45,
          fill: { color: 'F8FAFC' },
          line: { color: 'E2E8F0', width: 1 },
        });

        slide.addShape(pres.ShapeType.rect, {
          x: posX,
          y: posY,
          w: colWidth,
          h: 0.08,
          fill: { color: primaryBlue },
          line: { color: primaryBlue },
        });

        // Name
        slide.addText(fac.name, {
          x: posX + 0.2,
          y: posY + 0.15,
          w: colWidth - 0.4,
          h: 0.3,
          fontSize: 10.5,
          bold: true,
          color: darkNavy,
          fontFace: 'Arial',
        });

        // Role
        slide.addText(fac.role, {
          x: posX + 0.2,
          y: posY + 0.45,
          w: colWidth - 0.4,
          h: 0.22,
          fontSize: 8.5,
          bold: true,
          color: cyanAccent,
          fontFace: 'Arial',
        });

        // Degree
        slide.addText(`Titulação: ${fac.degree}`, {
          x: posX + 0.2,
          y: posY + 0.72,
          w: colWidth - 0.4,
          h: 0.3,
          fontSize: 8,
          color: textDark,
          fontFace: 'Arial',
        });

        // Discipline
        slide.addText(`Disciplina/Atuação: ${fac.discipline}`, {
          x: posX + 0.2,
          y: posY + 1.05,
          w: colWidth - 0.4,
          h: 0.28,
          fontSize: 8,
          color: textMuted,
          fontFace: 'Arial',
        });
      });
    } else if (s.type === 'evidencia') {
      // SLIDES DE EVIDÊNCIA ACADÊMICA (Práticas, Eventos, Visitas, Laboratórios)
      const slide = pres.addSlide();
      slide.background = { color: 'FFFFFF' };

      const meta = s.evidenceMeta || {
        category: 'Prática Acadêmica',
        date: '2026.1',
        location: 'Campus Curitiba',
        discipline: 'Unidade Curricular',
        professor: book.coordinator,
        studentsCount: 30,
        actionsReport: 'Registro das ações pedagógicas desenvolvidas.',
      };

      addInstitutionalChrome(slide, slideNumber, totalSlides, meta.category, s.title, s);

      // Metadata summary strip
      slide.addShape(pres.ShapeType.rect, {
        x: 0.8,
        y: 1.1,
        w: 8.4,
        h: 0.36,
        fill: { color: 'F1F5F9' },
        line: { color: 'E2E8F0', width: 1 },
      });

      const timePart = s.time ? ` às ${s.time}` : '';
      const typePart = s.activityType || meta.category || 'Atividade Institucional';
      const metaText = `Data: ${s.date || meta.date}${timePart}   |   Tipo: ${typePart}${book.coordinator ? `   |   Coordenação: ${book.coordinator}` : ''}`;
      slide.addText(metaText, {
        x: 0.9,
        y: 1.15,
        w: 8.2,
        h: 0.25,
        fontSize: 8,
        color: textDark,
        fontFace: 'Arial',
      });

      // Photos layout area vs Text report area
      const photos = s.photos || [];
      const hasPhotos = photos.length > 0;
      const reportText = s.objective || meta.actionsReport || '';

      if (!hasPhotos) {
        // Text-only evidence view
        slide.addShape(pres.ShapeType.rect, {
          x: 0.8,
          y: 1.55,
          w: 8.4,
          h: 3.4,
          fill: { color: 'F8FAFC' },
          line: { color: 'E2E8F0', width: 1 },
        });

        slide.addText('OBJETIVO & REGISTRO DAS AÇÕES', {
          x: 1.1,
          y: 1.7,
          w: 7.8,
          h: 0.25,
          fontSize: 9,
          bold: true,
          color: primaryBlue,
          fontFace: 'Arial',
        });

        slide.addText(reportText, {
          x: 1.1,
          y: 2.05,
          w: 7.8,
          h: 2.6,
          fontSize: 10,
          color: textDark,
          lineSpacing: 18,
          fontFace: 'Arial',
        });
      } else {
        // Layout: Left column for Actions Report, Right column for Photos
        const textColX = 0.8;
        const textColW = 3.6;
        const photoColX = 4.6;
        const photoColW = 4.6;

        // Text card
        slide.addShape(pres.ShapeType.rect, {
          x: textColX,
          y: 1.55,
          w: textColW,
          h: 3.4,
          fill: { color: 'F8FAFC' },
          line: { color: 'E2E8F0', width: 1 },
        });

        slide.addText('OBJETIVO DA ATIVIDADE', {
          x: textColX + 0.2,
          y: 1.68,
          w: textColW - 0.4,
          h: 0.22,
          fontSize: 8.5,
          bold: true,
          color: primaryBlue,
          fontFace: 'Arial',
        });

        slide.addText(reportText, {
          x: textColX + 0.2,
          y: 1.95,
          w: textColW - 0.4,
          h: 2.2,
          fontSize: 8.5,
          color: textDark,
          lineSpacing: 14,
          fontFace: 'Arial',
        });

        if (meta.pedagogicalImpact || s.customText1) {
          slide.addShape(pres.ShapeType.line, {
            x: textColX + 0.2,
            y: 4.25,
            w: textColW - 0.4,
            h: 0,
            line: { color: 'E2E8F0', width: 1 },
          });

          slide.addText('Observações Complementares:', {
            x: textColX + 0.2,
            y: 4.3,
            w: textColW - 0.4,
            h: 0.2,
            fontSize: 7.5,
            bold: true,
            color: cyanAccent,
            fontFace: 'Arial',
          });

          slide.addText(meta.pedagogicalImpact || s.customText1 || '', {
            x: textColX + 0.2,
            y: 4.5,
            w: textColW - 0.4,
            h: 0.38,
            fontSize: 7.5,
            color: textMuted,
            italic: true,
            fontFace: 'Arial',
          });
        }

        // Intelligent Photo Layout Composition (REQUISITOS 1, 2, 5 E 6)
        // Consome a mesma matemática de proporção e posicionamento usada no editor
        const photoFrames = computePhotoLayout(photos, (s.photoLayout as any) || 'auto');
        const photoStageH = 3.35; // Altura total disponível em polegadas (16:9)

        for (let pi = 0; pi < photoFrames.length; pi++) {
          const frame = photoFrames[pi];
          const p = frame.photo;
          const pUri = await toDataUri(p.url);
          if (!pUri) continue;

          // Cálculo proporcional idêntico ao viewport do editor
          const frameX = Number((photoColX + (frame.leftPercent / 100) * photoColW).toFixed(2));
          const frameY = Number((1.55 + (frame.topPercent / 100) * photoStageH).toFixed(2));
          const frameW = Number(((frame.widthPercent / 100) * photoColW).toFixed(2));
          const frameH = Number(((frame.heightPercent / 100) * photoStageH).toFixed(2));

          const fitMode = (p.fit || frame.fit) === 'contain' ? 'contain' : 'cover';

          // Adiciona a imagem respeitando estritamente a proporção original sem esticar
          slide.addImage({
            data: pUri,
            x: frameX,
            y: frameY,
            w: frameW,
            h: frameH,
            sizing: {
              type: fitMode,
              w: frameW,
              h: frameH,
            },
          });

          // Legenda da foto se informada
          if (p.caption) {
            slide.addText(p.caption, {
              x: frameX,
              y: Math.min(5.1, frameY + frameH - 0.22),
              w: frameW,
              h: 0.2,
              fontSize: 6.5,
              color: textMuted,
              italic: true,
              fontFace: 'Arial',
              align: 'center',
            });
          }
        }
      }

      // Render custom free text boxes & balloons with exact styling (REQUISITO 3)
      if (s.customTextBoxes && s.customTextBoxes.length > 0) {
        s.customTextBoxes.forEach((tb) => {
          // tb.x and tb.y are percentages (0 - 100), slide is 10 x 5.625 inches
          const tbX = Math.max(0.4, Math.min(9.4, Number(((tb.x / 100) * 10).toFixed(2))));
          const tbY = Math.max(0.4, Math.min(5.0, Number(((tb.y / 100) * 5.625).toFixed(2))));
          const tbW = Math.max(1.2, Math.min(8.0, Number(((tb.width / 100) * 10).toFixed(2))));
          const tbH = Math.max(0.6, Math.min(2.5, 0.4 + Math.ceil((tb.text?.length || 1) / 35) * 0.22));

          const hasBg = tb.backgroundColor && tb.backgroundColor !== 'transparent';
          const hasBorder = (tb.borderWidth && tb.borderWidth > 0) || tb.isBalloon;

          // Se tiver fundo ou borda ou for balão de fala, desenha o retângulo arredondado do balão
          if (hasBg || hasBorder || tb.isBalloon) {
            const bgFill = tb.backgroundColor && tb.backgroundColor !== 'transparent'
              ? cleanColorHex(tb.backgroundColor, 'FEF3C7')
              : (tb.isBalloon ? 'FEF3C7' : 'FFFFFF');

            const lineBorder = tb.borderColor && tb.borderColor !== 'transparent'
              ? cleanColorHex(tb.borderColor, 'F59E0B')
              : (tb.isBalloon ? 'F59E0B' : 'CBD5E1');

            slide.addShape(pres.ShapeType.roundRect, {
              x: tbX,
              y: tbY,
              w: tbW,
              h: tbH,
              fill: { color: bgFill },
              line: { color: lineBorder, width: tb.borderWidth || (tb.isBalloon ? 1.5 : 1) },
              rectRadius: tb.isBalloon ? 0.12 : 0.06,
            });
          }

          slide.addText(tb.text, {
            x: tbX + 0.08,
            y: tbY + 0.06,
            w: tbW - 0.16,
            h: tbH - 0.12,
            fontSize: tb.fontSize ? Math.round(tb.fontSize * 0.72) : 9.5,
            bold: !!tb.bold,
            italic: !!tb.italic,
            align: tb.align || 'left',
            color: cleanColorHex(tb.color, textDark),
            fontFace: 'Arial',
            valign: 'middle',
          });
        });
      }
    } else if (s.type === 'metricas' || s.type === 'resultados') {
      // SLIDE METRICAS & RESULTADOS
      const slide = pres.addSlide();
      slide.background = { color: 'FFFFFF' };
      addInstitutionalChrome(slide, slideNumber, totalSlides, 'INDICADORES ACADÊMICOS', s.title, s);

      const metrics = s.metrics || [];
      const itemW = 1.95;
      const spacing = 0.2;

      metrics.forEach((m, idx) => {
        const mx = 0.8 + idx * (itemW + spacing);
        slide.addShape(pres.ShapeType.rect, {
          x: mx,
          y: 1.4,
          w: itemW,
          h: 2.1,
          fill: { color: 'F8FAFC' },
          line: { color: 'E2E8F0', width: 1 },
        });

        slide.addShape(pres.ShapeType.rect, {
          x: mx,
          y: 1.4,
          w: itemW,
          h: 0.08,
          fill: { color: cyanAccent },
          line: { color: cyanAccent },
        });

        // Value
        slide.addText(m.value, {
          x: mx,
          y: 1.6,
          w: itemW,
          h: 0.6,
          fontSize: 22,
          bold: true,
          align: 'center',
          color: primaryBlue,
          fontFace: 'Arial',
        });

        // Label
        slide.addText(m.label, {
          x: mx + 0.1,
          y: 2.2,
          w: itemW - 0.2,
          h: 0.35,
          fontSize: 8.5,
          bold: true,
          align: 'center',
          color: darkNavy,
          fontFace: 'Arial',
        });

        // Detail
        slide.addText(m.detail, {
          x: mx + 0.1,
          y: 2.6,
          w: itemW - 0.2,
          h: 0.8,
          fontSize: 7.5,
          align: 'center',
          color: textMuted,
          fontFace: 'Arial',
        });
      });

      // Bottom synthesis box
      slide.addShape(pres.ShapeType.rect, {
        x: 0.8,
        y: 3.75,
        w: 8.4,
        h: 1.2,
        fill: { color: 'E0F2FE' },
        line: { color: cyanAccent, width: 1 },
      });

      slide.addText('SÍNTESE EXECUTIVA DOS RESULTADOS DO SEMESTRE', {
        x: 1.0,
        y: 3.85,
        w: 8.0,
        h: 0.22,
        fontSize: 8,
        bold: true,
        color: primaryBlue,
        fontFace: 'Arial',
      });

      slide.addText(
        s.customText1 ||
          'Os indicadores consolidam a efetividade das metodologias ativas e a articulação entre as unidades curriculares e as demandas profissionais do mercado, mantendo elevados índices de aprovação e satisfação discente.',
        {
          x: 1.0,
          y: 4.12,
          w: 8.0,
          h: 0.7,
          fontSize: 9,
          color: darkNavy,
          fontFace: 'Arial',
        }
      );
    } else if (s.type === 'contatos') {
      // SLIDE FINAL - CONTATOS & INFORMAÇÕES INSTITUCIONAIS
      const slide = pres.addSlide();
      slide.background = { color: darkNavy };

      // Top cyan bar
      slide.addShape(pres.ShapeType.rect, {
        x: 0,
        y: 0,
        w: 10,
        h: 0.15,
        fill: { color: cyanAccent },
        line: { color: cyanAccent },
      });

      slide.addText('ENCERRAMENTO INSTITUCIONAL', {
        x: 0.8,
        y: 0.8,
        w: 8.4,
        h: 0.25,
        fontSize: 9,
        bold: true,
        color: cyanAccent,
        fontFace: 'Arial',
      });

      slide.addText(s.title || 'Informações Institucionais & Canais Acadêmicos', {
        x: 0.8,
        y: 1.1,
        w: 8.4,
        h: 0.5,
        fontSize: 18,
        bold: true,
        color: 'FFFFFF',
        fontFace: 'Arial',
      });

      // Left column: Addresses and phones
      const contactInfo = s.contacts || {
        address: campus.address,
        email: 'coordenacao.academica@estacio.br',
        phone: '(41) 3310-7000',
        serviceHours: 'Segunda a Sexta-feira: 08h00 às 21h30',
        coordinatorPhone: '(41) 3310-7025',
      };

      slide.addShape(pres.ShapeType.rect, {
        x: 0.8,
        y: 1.8,
        w: 4.0,
        h: 2.8,
        fill: { color: '002D5A' },
        line: { color: '004B8D', width: 1 },
      });

      slide.addText('CANAIS DE ATENDIMENTO ACADÊMICO', {
        x: 1.0,
        y: 1.95,
        w: 3.6,
        h: 0.25,
        fontSize: 8.5,
        bold: true,
        color: cyanAccent,
        fontFace: 'Arial',
      });

      slide.addText(
        `Endereço:\n${contactInfo.address}\n\nE-mail da Coordenação:\n${contactInfo.email}\n\nTelefone Geral: ${contactInfo.phone}\nTelefone Coordenação: ${contactInfo.coordinatorPhone || contactInfo.phone}\n\nHorário de Atendimento:\n${contactInfo.serviceHours}`,
        {
          x: 1.0,
          y: 2.25,
          w: 3.6,
          h: 2.2,
          fontSize: 8,
          color: 'E2E8F0',
          fontFace: 'Arial',
        }
      );

      // Right column: Official compliance declaration
      slide.addShape(pres.ShapeType.rect, {
        x: 5.2,
        y: 1.8,
        w: 4.0,
        h: 2.8,
        fill: { color: '002D5A' },
        line: { color: '004B8D', width: 1 },
      });

      slide.addText('VALIDAÇÃO & HOMOLOGAÇÃO ACADÊMICA', {
        x: 5.4,
        y: 1.95,
        w: 3.6,
        h: 0.25,
        fontSize: 8.5,
        bold: true,
        color: cyanAccent,
        fontFace: 'Arial',
      });

      slide.addText(
        s.customText1 ||
          'Este Book de Evidências Acadêmicas constitui instrumento formal de prestação de contas pedagógica, registro histórico da coordenação e documento comprobatório para os ciclos avaliativos do Ministério da Educação (MEC / INEP).',
        {
          x: 5.4,
          y: 2.25,
          w: 3.6,
          h: 1.3,
          fontSize: 8.5,
          color: 'E2E8F0',
          fontFace: 'Arial',
        }
      );

      slide.addShape(pres.ShapeType.line, {
        x: 5.4,
        y: 3.65,
        w: 3.6,
        h: 0,
        line: { color: '004B8D', width: 1 },
      });

      slide.addText(
        `Responsável: ${book.coordinator}\nCoordenação de Curso · ${campus.name}\nCuritiba, ${book.period}`,
        {
          x: 5.4,
          y: 3.8,
          w: 3.6,
          h: 0.65,
          fontSize: 8,
          color: '94A3B8',
          fontFace: 'Arial',
        }
      );
    }
  }

  // Generate file download
  const safeCourse = book.courseName.replace(/[^a-zA-Z0-9]/g, '_');
  const fileName = `Book_Evidencias_${safeCourse}_${book.period}_${book.campus}.pptx`;
  await pres.writeFile({ fileName });
  fireCelebration();
}
