import { AcademicBook, SlideData } from '../types';

export interface SummarySection {
  id: string;
  orderNumber: string; // e.g. "01", "02", "03"
  title: string;
  subtitle: string;
  targetSlideId: string;
  targetSlideIndex: number;
  slideRangeText: string; // e.g. "Slide 03" or "Slides 04 a 09"
  slideCount: number;
  isActivitiesGroup: boolean;
  type: string;
}

/**
 * Returns structured presentation sections for the Table of Contents (Sumário).
 * 
 * CRITICAL RULE: Evidence/activity slides must NEVER appear individually in the summary.
 * Instead, they are all grouped into a single area called "Evidências" that encompasses
 * any registered activity.
 */
export function getSummarySections(book: AcademicBook): SummarySection[] {
  const slides = book.slides || [];
  
  const isEvidenceSlide = (s: SlideData) =>
    s.type === 'evidencia' || Boolean(s.activityId) || Boolean(s.activityType);
  const evidenceSlides = slides.filter(isEvidenceSlide);

  const sections: SummarySection[] = [];
  let currentOrder = 1;
  let activitiesInserted = false;

  const insertActivitiesSection = () => {
    if (activitiesInserted) return;
    activitiesInserted = true;

    // Find the target slide (first evidence slide if exists, or slide after sumario)
    let firstEvidenceIndex = slides.findIndex(isEvidenceSlide);
    if (firstEvidenceIndex === -1) {
      const sumarioIdx = slides.findIndex((s) => s.type === 'sumario');
      firstEvidenceIndex = sumarioIdx !== -1 && sumarioIdx < slides.length - 1 ? sumarioIdx + 1 : Math.max(0, slides.length - 1);
    }

    const targetSlide = slides[firstEvidenceIndex] || slides[0];

    // Calculate slide range text
    let rangeText = '';
    const count = evidenceSlides.length;
    if (count === 0) {
      rangeText = 'Aguardando cadastro';
    } else if (count === 1) {
      const idx = slides.findIndex((s) => s.id === evidenceSlides[0].id) + 1;
      rangeText = `Slide ${idx < 10 ? '0' : ''}${idx}`;
    } else {
      const firstIdx = slides.findIndex((s) => s.id === evidenceSlides[0].id) + 1;
      const lastIdx = slides.findIndex((s) => s.id === evidenceSlides[count - 1].id) + 1;
      rangeText = `Slides ${firstIdx < 10 ? '0' : ''}${firstIdx} a ${lastIdx < 10 ? '0' : ''}${lastIdx}`;
    }

    const sub = count === 0
      ? 'Abrange qualquer atividade cadastrada no período letivo'
      : `Abrange todas as ${count} atividades cadastradas no book · Registros acadêmicos e pedagógicos`;

    sections.push({
      id: 'section-evidencias',
      orderNumber: currentOrder < 10 ? `0${currentOrder}` : `${currentOrder}`,
      title: 'Evidências',
      subtitle: sub,
      targetSlideId: targetSlide ? targetSlide.id : '',
      targetSlideIndex: Math.max(0, firstEvidenceIndex),
      slideRangeText: rangeText,
      slideCount: count,
      isActivitiesGroup: true,
      type: 'evidencia',
    });
    currentOrder++;
  };

  // Traverse through slides in book order
  for (let i = 0; i < slides.length; i++) {
    const s = slides[i];
    
    // Capa and Sumário are not listed as internal content sections
    if (s.type === 'capa' || s.type === 'sumario') {
      continue;
    }

    // When we encounter evidence slides, insert the grouped "Evidências" section exactly once
    if (isEvidenceSlide(s)) {
      if (!activitiesInserted) {
        insertActivitiesSection();
      }
      // Skip listing individual evidence slides
      continue;
    }

    // It's an institutional or custom slide (e.g. apresentacao, diretrizes, equipe, metricas, contatos)
    const slideNumber = i + 1;
    const orderFormatted = currentOrder < 10 ? `0${currentOrder}` : `${currentOrder}`;

    let title = s.title?.trim();
    if (!title) {
      if (s.type === 'apresentacao') title = 'Apresentação do Curso';
      else if (s.type === 'diretrizes') title = 'Diretrizes Curriculares & DCNs';
      else if (s.type === 'equipe') title = 'Equipe Docente & Coordenação';
      else if (s.type === 'metricas') title = 'Indicadores & Métricas';
      else if (s.type === 'resultados') title = 'Resultados & Conquistas';
      else if (s.type === 'contatos') title = 'Informações Institucionais';
      else title = 'Seção Institucional';
    }

    let subtitle = s.subtitle?.trim();
    if (!subtitle) {
      if (s.type === 'apresentacao') subtitle = 'Visão pedagógica e objetivos do período';
      else if (s.type === 'diretrizes') subtitle = 'Alinhamento com diretrizes MEC e competências';
      else if (s.type === 'equipe') subtitle = 'Corpo docente, coordenação e supervisores';
      else if (s.type === 'metricas') subtitle = 'Indicadores de participação e engajamento';
      else if (s.type === 'resultados') subtitle = 'Conquistas pedagógicas e impacto discente';
      else if (s.type === 'contatos') subtitle = 'Encerramento oficial e canais de contato';
      else subtitle = 'Registro acadêmico institucional';
    }

    sections.push({
      id: `section-${s.id}`,
      orderNumber: orderFormatted,
      title,
      subtitle,
      targetSlideId: s.id,
      targetSlideIndex: i,
      slideRangeText: `Slide ${slideNumber < 10 ? '0' : ''}${slideNumber}`,
      slideCount: 1,
      isActivitiesGroup: false,
      type: s.type,
    });
    currentOrder++;
  }

  // If there were no evidence slides in the presentation, ensure "Evidências" is always represented
  if (!activitiesInserted) {
    insertActivitiesSection();
  }

  return sections;
}
