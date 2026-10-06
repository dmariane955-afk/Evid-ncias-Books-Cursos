import { AcademicArea } from '../types';

import softwareImg from '../assets/images/course_software_code_1790971409616.jpg';
import civilImg from '../assets/images/course_civil_engineering_1790971389732.jpg';
import labMecImg from '../assets/images/lab_engineering_practice_1790966670659.jpg';
import nursingImg from '../assets/images/course_nursing_health_1790971399494.jpg';
import biomedImg from '../assets/images/course_biomedicine_lab_1790971432421.jpg';
import healthSimImg from '../assets/images/health_clinical_simulation_1790966684186.jpg';
import businessImg from '../assets/images/course_business_adm_1790971421435.jpg';
import lawImg from '../assets/images/course_law_justice_1790971444314.jpg';
import pedagogyImg from '../assets/images/course_pedagogy_class_1790971455883.jpg';
import campusLectureImg from '../assets/images/campus_academic_lecture_1790966693712.jpg';

export interface CourseCoverOption {
  id: string;
  title: string;
  area: AcademicArea;
  url: string;
  keywords: string[];
}

export const COURSE_COVER_LIBRARY: CourseCoverOption[] = [
  {
    id: 'cover-eng-software',
    title: 'Engenharia de Software / Ciência da Computação / TI',
    area: 'exatas',
    url: softwareImg,
    keywords: [
      'software', 'computação', 'computacao', 'sistemas', 'ti', 'programação', 
      'programacao', 'desenvolvimento', 'ads', 'web', 'dados', 'inteligência', 'algoritmos'
    ],
  },
  {
    id: 'cover-eng-civil',
    title: 'Engenharia Civil / Estruturas / Construção',
    area: 'exatas',
    url: civilImg,
    keywords: [
      'civil', 'construção', 'construcao', 'obras', 'estruturas', 'edificações', 
      'edificacoes', 'plantas', 'engenheiro civil', 'arquitetura'
    ],
  },
  {
    id: 'cover-eng-mecanica-lab',
    title: 'Engenharias & Automação / Práticas de Laboratório',
    area: 'exatas',
    url: labMecImg,
    keywords: [
      'engenharia', 'mecânica', 'mecanica', 'elétrica', 'eletrica', 'automação', 
      'automacao', 'robótica', 'robotica', 'produção', 'producao', 'laboratório'
    ],
  },
  {
    id: 'cover-enfermagem',
    title: 'Enfermagem & Ambiente Hospitalar / Clínico',
    area: 'saude',
    url: nursingImg,
    keywords: [
      'enfermagem', 'hospital', 'cuidados', 'clínica', 'clinica', 'saúde', 'saude', 
      'médico', 'medico', 'pacientes', 'emergência'
    ],
  },
  {
    id: 'cover-biomedicina',
    title: 'Biomedicina & Diagnóstico Laboratorial',
    area: 'saude',
    url: biomedImg,
    keywords: [
      'biomedicina', 'laboratório', 'laboratorio', 'microscópio', 'microscopio', 
      'análises', 'analises', 'biologia', 'farmácia', 'farmacia', 'bioquímica'
    ],
  },
  {
    id: 'cover-saude-simulada',
    title: 'Fisioterapia, Nutrição & Cuidados em Saúde',
    area: 'saude',
    url: healthSimImg,
    keywords: [
      'fisioterapia', 'nutrição', 'nutricao', 'odontologia', 'psicologia', 
      'reabilitação', 'reabilitacao', 'terapia', 'movimento'
    ],
  },
  {
    id: 'cover-administracao',
    title: 'Administração, Negócios & Gestão Corporativa',
    area: 'negocios',
    url: businessImg,
    keywords: [
      'administração', 'administracao', 'gestão', 'gestao', 'negócios', 'negocios', 
      'finanças', 'financas', 'marketing', 'contábeis', 'contabeis', 'economia', 
      'recursos humanos', 'logística', 'logistica', 'comércio'
    ],
  },
  {
    id: 'cover-direito',
    title: 'Direito & Ciências Jurídicas',
    area: 'humanas',
    url: lawImg,
    keywords: [
      'direito', 'jurídico', 'juridico', 'leis', 'advocacia', 'tribunal', 
      'justiça', 'justica', 'legislação', 'criminologia'
    ],
  },
  {
    id: 'cover-pedagogia',
    title: 'Pedagogia & Práticas Educacionais',
    area: 'humanas',
    url: pedagogyImg,
    keywords: [
      'pedagogia', 'educação', 'educacao', 'ensino', 'escola', 'letras', 
      'história', 'historia', 'didática', 'didatica', 'professores', 'aprendizagem'
    ],
  },
  {
    id: 'cover-academico-geral',
    title: 'Comunicação & Grandes Acontecimentos Acadêmicos',
    area: 'humanas',
    url: campusLectureImg,
    keywords: [
      'comunicação', 'comunicacao', 'jornalismo', 'publicidade', 'palestra', 
      'auditório', 'auditorio', 'simpósio', 'simposio', 'seminário'
    ],
  },
];

/**
 * Retorna a capa visual mais equivalente e coerente para o curso dado,
 * analisando o nome do curso e a sua grande área do conhecimento.
 * Garante que cursos diferentes recebam capas representativas de sua área.
 */
export function getCourseCoverImage(courseName: string, area?: AcademicArea): string {
  const normalized = (courseName || '').toLowerCase().trim();

  // 1. Procurar correspondência exata por palavras-chave
  for (const item of COURSE_COVER_LIBRARY) {
    if (item.keywords.some((kw) => normalized.includes(kw))) {
      return item.url;
    }
  }

  // 2. Se não encontrou por palavra-chave direta, procurar pela área acadêmica
  if (area) {
    const areaMatches = COURSE_COVER_LIBRARY.filter((item) => item.area === area);
    if (areaMatches.length > 0) {
      return areaMatches[0].url;
    }
  }

  // 3. Fallback inteligente
  return COURSE_COVER_LIBRARY[0].url;
}
