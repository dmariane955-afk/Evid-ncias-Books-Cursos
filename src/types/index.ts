export type CampusId = 'curitiba' | 'fatec';

export type AcademicArea = 'exatas' | 'saude' | 'humanas' | 'negocios';

export type BookStatus = 'elaboracao' | 'revisao' | 'homologado';

export type UserRole = 'docente' | 'coordenador' | 'direcao';

export type ActivityType =
  | 'Atividade de sustentabilidade'
  | 'Atividade de arrecadação'
  | 'Atividade colaborativa interdisciplinar'
  | 'Atividade regular';

export type SlideType = 
  | 'capa'
  | 'sumario'
  | 'apresentacao'
  | 'diretrizes'
  | 'equipe'
  | 'evidencia'
  | 'metricas'
  | 'resultados'
  | 'contatos';

export type PhotoLayout = 'single' | 'split-50-50' | 'split-70-30' | 'grid-3' | 'gallery-4';

export type PhotoFit = 'cover' | 'contain';

export interface PhotoItem {
  id: string;
  url: string;
  caption?: string;
  fit?: PhotoFit;
  zoom?: number;
  position?: 'center' | 'top' | 'bottom' | 'left' | 'right';
}

export interface TextBoxElement {
  id: string;
  text: string;
  x: number; // percentage (0-100)
  y: number; // percentage (0-100)
  width: number; // percentage (10-100)
  height?: number;
  fontSize?: number; // px equivalent or relative
  color?: string;
  bold?: boolean;
  italic?: boolean;
  align?: 'left' | 'center' | 'right';
}

export interface ActivityItem {
  id: string;
  title: string;
  date: string;
  time: string;
  activityType: ActivityType;
  objective: string;
  complementaryText?: string;
  photos: PhotoItem[];
  targetCourseIds: string[];
  primaryCampus?: CampusId; // Campus where it originated
  syncedCampuses?: CampusId[]; // e.g. ['curitiba', 'fatec'] if user opted to sync
  syncedBookIds?: string[];
  isShared: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Course {
  id: string;
  name: string;
  campus: CampusId;
  academicArea: AcademicArea;
  coordinator: string;
  director: string;
  period: string;
  linkedCampus?: CampusId;
  coverImage?: string; // Capa visual personalizada equivalente e relacionada à área do curso
}

export interface FacultyMember {
  id: string;
  name: string;
  role: string;
  degree: string;
  lattes?: string;
  discipline: string;
}

export interface CompetencyItem {
  id: string;
  code: string;
  title: string;
  description: string;
  mecStandard: string;
}

export interface MetricItem {
  id: string;
  label: string;
  value: string;
  detail: string;
}

export interface EvidenceMeta {
  category: string;
  date: string;
  time?: string;
  location: string;
  discipline: string;
  professor: string;
  studentsCount: number;
  actionsReport: string;
  pedagogicalImpact?: string;
}

export interface SlideData {
  id: string;
  type: SlideType;
  title: string;
  subtitle?: string;
  order: number;
  activityId?: string; // Linked activity ID for auto-sync across course books
  activityType?: ActivityType;
  date?: string;
  time?: string;
  objective?: string;
  photoLayout?: PhotoLayout;
  photos: PhotoItem[];
  customTextBoxes?: TextBoxElement[];
  evidenceMeta?: EvidenceMeta;
  facultyList?: FacultyMember[];
  competencies?: CompetencyItem[];
  metrics?: MetricItem[];
  customText1?: string;
  customText2?: string;
  footerCustomText?: string;
  footerLeftText?: string; // Informação institucional / campus / data editável do rodapé
  footerRightText?: string; // Paginação ou anotação editável do rodapé
  contacts?: {
    address: string;
    email: string;
    phone: string;
    serviceHours: string;
    coordinatorPhone?: string;
  };
}

export interface AcademicBook {
  id: string;
  courseId: string;
  campus: CampusId;
  courseName: string;
  academicArea: AcademicArea;
  period: string;
  title: string;
  subtitle: string;
  status: BookStatus;
  coordinator: string;
  director: string;
  updatedAt: string;
  coverImage?: string; // Capa visual personalizada do book coerente com o curso
  slides: SlideData[];
}
