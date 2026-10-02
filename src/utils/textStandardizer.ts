/**
 * Academic & Institutional Text Standardizer for MEC / DCN Compliance
 * Rewrites descriptions into formal, rigorous higher-education Brazilian Portuguese.
 */

export function standardizeAcademicText(originalText: string, category: string = 'Prática Acadêmica'): string {
  if (!originalText || originalText.trim().length === 0) {
    return 'Os acadêmicos participaram de atividades estruturadas de consolidação teórico-prática, com rigor metodológico, observância das diretrizes curriculares e fomento ao desenvolvimento de competências profissionais.';
  }

  const trimmed = originalText.trim();

  // If already long and formal, polish with institutional phrasing
  const formalPrefixes = [
    'No âmbito das diretrizes curriculares nacionais (DCNs), ',
    'Com o objetivo de sedimentar competências analíticas e instrumentais, ',
    'Integrando teoria à experimentação aplicada, ',
    'Em consonância com as práticas pedagógicas inovadoras da instituição, ',
  ];

  const randomPrefix = formalPrefixes[Math.floor(Math.random() * formalPrefixes.length)];

  // Replace colloquial terms with MEC / academic equivalents
  let polished = trimmed
    .replace(/\bos alunos\b/gi, 'os acadêmicos')
    .replace(/\ba gente fez\b/gi, 'foi realizada a execução de')
    .replace(/\bfizemos\b/gi, 'desenvolveu-se a prática de')
    .replace(/\bviram na prática\b/gi, 'vivenciaram a aplicação empírica de')
    .replace(/\bmuito legal\b/gi, 'de expressiva relevância formativa')
    .replace(/\blegal\b/gi, 'produtivo e alinhado aos objetivos pedagógicos')
    .replace(/\bbacana\b/gi, 'enriquecedor')
    .replace(/\bpara aprender\b/gi, 'com vistas à consolidação da aprendizagem significativa')
    .replace(/\bfotos\b/gi, 'registros fotográficos e evidências visuais')
    .replace(/\baula normal\b/gi, 'sessão instrucional presencial')
    .replace(/\btrabalho\b/gi, 'produção acadêmico-científica')
    .replace(/\btodo mundo gostou\b/gi, 'houve elevado índice de engajamento discente e adesão participativa');

  // Ensure uppercase first letter and proper ending punctuation
  polished = polished.charAt(0).toUpperCase() + polished.slice(1);
  if (!polished.endsWith('.') && !polished.endsWith('!') && !polished.endsWith('?')) {
    polished += '.';
  }

  const conclusionSentence = ` A ação fortaleceu a metodologia ativa, articulando o saber técnico à reflexão crítica em ambiente acadêmico controlado e supervisionado.`;

  return `${randomPrefix}${polished}${conclusionSentence}`;
}
