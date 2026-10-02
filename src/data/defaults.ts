import { AcademicArea, CampusId, AcademicBook, SlideData, Course, ActivityItem } from '../types';
import { getCourseCoverImage } from '../utils/courseCovers';

export interface CampusConfig {
  id: CampusId;
  name: string;
  fullName: string;
  city: string;
  address: string;
  directorDefault: string;
  primaryColor: string;
  accentColor: string;
  badge: string;
}

export const CAMPUS_CONFIGS: Record<CampusId, CampusConfig> = {
  curitiba: {
    id: 'curitiba',
    name: 'Estácio Curitiba',
    fullName: 'Faculdade Estácio de Curitiba',
    city: 'Curitiba - PR',
    address: 'Av. Visconde de Nácar, 1440 - Centro, Curitiba - PR',
    directorDefault: '',
    primaryColor: '#004B8D',
    accentColor: '#00A3E0',
    badge: 'Campus Curitiba',
  },
  fatec: {
    id: 'fatec',
    name: 'FATEC Estácio',
    fullName: 'Faculdade de Tecnologia Estácio de Curitiba',
    city: 'Curitiba - PR',
    address: 'Rua Schiller, 1782 - Cristo Rei, Curitiba - PR',
    directorDefault: '',
    primaryColor: '#001D3D',
    accentColor: '#00A3E0',
    badge: 'Campus FATEC',
  },
};

export interface AreaConfig {
  id: AcademicArea;
  label: string;
  iconName: string;
  color: string;
  accentBg: string;
}

export const AREA_CONFIGS: Record<AcademicArea, AreaConfig> = {
  exatas: {
    id: 'exatas',
    label: 'Ciências Exatas & Tecnologia',
    iconName: 'Cpu',
    color: '#0284C7',
    accentBg: '#E0F2FE',
  },
  saude: {
    id: 'saude',
    label: 'Ciências da Saúde & Biológicas',
    iconName: 'HeartPulse',
    color: '#0D9488',
    accentBg: '#CCFBF1',
  },
  humanas: {
    id: 'humanas',
    label: 'Ciências Humanas & Sociais',
    iconName: 'Scale',
    color: '#7C3AED',
    accentBg: '#F3E8FF',
  },
  negocios: {
    id: 'negocios',
    label: 'Negócios, Gestão & Comunicação',
    iconName: 'TrendingUp',
    color: '#D97706',
    accentBg: '#FEF3C7',
  },
};

export const INITIAL_COURSES: Course[] = [
  {
    id: 'course-eng-soft',
    name: 'Engenharia de Software',
    campus: 'curitiba',
    academicArea: 'exatas',
    coordinator: '',
    director: '',
    period: '2026.1',
    coverImage: '/src/assets/images/course_software_code_1790971409616.jpg',
  },
  {
    id: 'course-eng-civil',
    name: 'Engenharia Civil',
    campus: 'curitiba',
    academicArea: 'exatas',
    coordinator: '',
    director: '',
    period: '2026.1',
    coverImage: '/src/assets/images/course_civil_engineering_1790971389732.jpg',
  },
  {
    id: 'course-biomedicina',
    name: 'Biomedicina',
    campus: 'curitiba',
    academicArea: 'saude',
    coordinator: '',
    director: '',
    period: '2026.1',
    coverImage: '/src/assets/images/course_biomedicine_lab_1790971432421.jpg',
  },
  {
    id: 'course-enfermagem',
    name: 'Enfermagem',
    campus: 'curitiba',
    academicArea: 'saude',
    coordinator: '',
    director: '',
    period: '2026.1',
    coverImage: '/src/assets/images/course_nursing_health_1790971399494.jpg',
  },
  {
    id: 'course-adm',
    name: 'Administração',
    campus: 'curitiba',
    academicArea: 'negocios',
    coordinator: '',
    director: '',
    period: '2026.1',
    coverImage: '/src/assets/images/course_business_adm_1790971421435.jpg',
  },
  {
    id: 'course-ads-fatec',
    name: 'Análise e Desenvolvimento de Sistemas',
    campus: 'fatec',
    academicArea: 'exatas',
    coordinator: '',
    director: '',
    period: '2026.1',
    coverImage: '/src/assets/images/course_software_code_1790971409616.jpg',
  },
  {
    id: 'course-gestao-ti-fatec',
    name: 'Gestão da Tecnologia da Informação',
    campus: 'fatec',
    academicArea: 'exatas',
    coordinator: '',
    director: '',
    period: '2026.1',
    coverImage: '/src/assets/images/technical_visit_field_1790966704861.jpg',
  },
];

export const COURSES_BY_AREA: Record<AcademicArea, string[]> = {
  exatas: [
    'Engenharia de Software',
    'Ciência da Computação',
    'Engenharia Civil',
    'Análise e Desenvolvimento de Sistemas',
    'Gestão da Tecnologia da Informação',
    'Engenharia Mecânica',
    'Sistemas de Informação',
    'Design Digital',
  ],
  saude: [
    'Biomedicina',
    'Enfermagem',
    'Fisioterapia',
    'Nutrição',
    'Farmácia',
    'Psicologia',
    'Odontologia',
  ],
  humanas: [
    'Pedagogia',
    'Letras',
    'História',
    'Serviço Social',
  ],
  negocios: [
    'Administração',
    'Ciências Contábeis',
    'Marketing',
    'Publicidade e Propaganda',
    'Gestão Financeira',
  ],
};

export const INITIAL_ACTIVITIES: ActivityItem[] = [
  {
    id: 'act-sample-1',
    title: 'Ação Prática de Laboratório',
    date: '2026-03-14',
    time: '14:30',
    activityType: 'Atividade regular',
    objective: 'A atividade teve como objetivo proporcionar aos alunos uma experiência prática, estimulando a participação, a colaboração e a aprendizagem relacionada ao tema trabalhado.',
    photos: [
      {
        id: 'p-act-1',
        url: '/src/assets/images/lab_engineering_practice_1790966670659.jpg',
        caption: 'Registro fotográfico da atividade prática',
        fit: 'cover',
      },
    ],
    targetCourseIds: ['course-eng-soft'],
    primaryCampus: 'curitiba',
    syncedCampuses: ['curitiba'],
    isShared: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'act-sample-inter-1',
    title: 'Campanha de Arrecadação de Inverno e Solidariedade',
    date: '2026-04-02',
    time: '10:00',
    activityType: 'Atividade de arrecadação',
    objective: 'A atividade teve como objetivo mobilizar a comunidade acadêmica em ações de solidariedade e responsabilidade social, integrando diferentes áreas do conhecimento.',
    photos: [
      {
        id: 'p-act-2',
        url: '/src/assets/images/campus_academic_lecture_1790966693712.jpg',
        caption: 'Encontro com discentes e coordenações participantes',
        fit: 'cover',
      },
    ],
    targetCourseIds: ['course-eng-soft', 'course-biomedicina'],
    primaryCampus: 'curitiba',
    syncedCampuses: ['curitiba'],
    isShared: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'act-sample-sust-1',
    title: 'Oficina de Práticas Tecnológicas e Descarte Consciente',
    date: '2026-04-18',
    time: '15:00',
    activityType: 'Atividade de sustentabilidade',
    objective: 'A atividade teve como objetivo promover a reflexão sobre práticas sustentáveis e gestão responsável de resíduos, estimulando o engajamento e a cidadania.',
    photos: [
      {
        id: 'p-act-3',
        url: '/src/assets/images/technical_visit_field_1790966704861.jpg',
        caption: 'Aplicação prática e orientações em campo',
        fit: 'cover',
      },
    ],
    targetCourseIds: ['course-ads-fatec'],
    primaryCampus: 'fatec',
    syncedCampuses: ['fatec'],
    isShared: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

/**
 * Creates default initial slides for any course, populated strictly with user data (no fake names)
 */
export function createDefaultSlidesForCourse(course: Course, activitiesForCourse: ActivityItem[] = []): SlideData[] {
  const coverImageUrl = course.coverImage || getCourseCoverImage(course.name, course.academicArea);

  const slides: SlideData[] = [
    {
      id: `slide-capa-${course.id}`,
      type: 'capa',
      title: `Book de Evidências Acadêmicas`,
      subtitle: `Registro das Atividades e Práticas Desenvolvidas`,
      order: 1,
      photos: [
        {
          id: `cover-photo-${course.id}`,
          url: coverImageUrl,
          caption: `Capa Oficial do Curso · ${course.name}`,
          fit: 'cover',
        },
      ],
      customText1: `Período Letivo: ${course.period}`,
      customText2: course.coordinator ? `Coordenação: ${course.coordinator}` : '',
    },
    {
      id: `slide-sumario-${course.id}`,
      type: 'sumario',
      title: 'Sumário das Atividades',
      subtitle: 'Visão geral das atividades e evidências do semestre',
      order: 2,
      photos: [],
    },
  ];

  // Add slides for each activity
  activitiesForCourse.forEach((act, idx) => {
    slides.push({
      id: `slide-act-${act.id}`,
      activityId: act.id,
      type: 'evidencia',
      title: act.title,
      subtitle: `${act.activityType} · ${act.date}${act.time ? ` às ${act.time}` : ''}`,
      activityType: act.activityType,
      date: act.date,
      time: act.time,
      objective: act.objective,
      order: idx + 3,
      photoLayout: act.photos.length > 1 ? 'split-50-50' : 'single',
      photos: [...act.photos],
      evidenceMeta: {
        category: act.activityType,
        date: act.date,
        time: act.time,
        location: 'Campus Universitário',
        discipline: '',
        professor: course.coordinator || '',
        studentsCount: 0,
        actionsReport: act.objective,
        pedagogicalImpact: act.complementaryText || '',
      },
      customTextBoxes: [],
    });
  });

  // Closing slide
  slides.push({
    id: `slide-contatos-${course.id}`,
    type: 'contatos',
    title: 'Informações Institucionais',
    subtitle: 'Encerramento do Book de Evidências',
    order: slides.length + 1,
    photos: [],
    contacts: {
      address: CAMPUS_CONFIGS[course.campus]?.address || 'Curitiba - PR',
      email: 'coordenacao.academica@estacio.br',
      phone: '(41) 3310-7000',
      serviceHours: 'Segunda a Sexta-feira: 08h00 às 21h30',
      coordinatorPhone: '',
    },
    customText1: 'Este Book de Evidências Acadêmicas constitui documento institucional oficial de registro das atividades desenvolvidas.',
  });

  return slides;
}

export function createInitialBooks(courses: Course[], activities: ActivityItem[]): AcademicBook[] {
  return courses.map((course) => {
    const courseActivities = activities.filter((act) => act.targetCourseIds.includes(course.id));
    const coverImageUrl = course.coverImage || getCourseCoverImage(course.name, course.academicArea);
    return {
      id: `book-${course.id}`,
      courseId: course.id,
      campus: course.campus,
      courseName: course.name,
      academicArea: course.academicArea,
      period: course.period,
      title: `Book de Evidências Acadêmicas - ${course.name}`,
      subtitle: `Registro das Atividades e Evidências · ${course.period}`,
      status: 'elaboracao',
      coordinator: course.coordinator || '',
      director: course.director || '',
      updatedAt: new Date().toISOString(),
      coverImage: coverImageUrl,
      slides: createDefaultSlidesForCourse(course, courseActivities),
    };
  });
}
