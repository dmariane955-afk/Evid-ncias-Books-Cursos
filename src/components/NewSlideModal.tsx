import React from 'react';
import { 
  X, 
  Image as ImageIcon, 
  Layout, 
  Grid, 
  FileText, 
  Users, 
  BarChart3, 
  PhoneCall, 
  Award,
  Sparkles
} from 'lucide-react';
import { SlideData, SlideType, PhotoLayout } from '../types';

interface NewSlideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: Partial<SlideData>) => void;
  coordinator: string;
}

export const NewSlideModal: React.FC<NewSlideModalProps> = ({
  isOpen,
  onClose,
  onSelectTemplate,
  coordinator,
}) => {
  if (!isOpen) return null;

  const templates: {
    title: string;
    description: string;
    icon: React.ReactNode;
    slide: Partial<SlideData>;
  }[] = [
    {
      title: 'Evidência: 1 Foto Hero',
      description: 'Foto em destaque amplo acompanhada de relatório descritivo e dados da atividade.',
      icon: <ImageIcon className="w-5 h-5 text-sky-500" />,
      slide: {
        type: 'evidencia',
        title: 'Atividade Prática em Ambiente Profissional',
        photoLayout: 'single',
        photos: [],
        evidenceMeta: {
          category: 'Aula Prática / Laboratório',
          date: new Date().toLocaleDateString('pt-BR'),
          location: 'Laboratório Especializado',
          discipline: 'Unidade Curricular Prática',
          professor: coordinator,
          studentsCount: 32,
          actionsReport:
            'Desenvolveu-se a prática supervisionada com foco na aplicação de metodologias ativas e experimentação técnica em conformidade com as DCNs.',
          pedagogicalImpact: 'Desenvolvimento da autonomia discente e articulação teórico-prática.',
        },
      },
    },
    {
      title: 'Evidência: Divisão 50/50 (Pares)',
      description: 'Duas fotos comparativas ou complementares com relatório descritivo.',
      icon: <Layout className="w-5 h-5 text-blue-500" />,
      slide: {
        type: 'evidencia',
        title: 'Prática Experimental: Etapas e Execução',
        photoLayout: 'split-50-50',
        photos: [],
        evidenceMeta: {
          category: 'Atividade Prática Supervisionada',
          date: new Date().toLocaleDateString('pt-BR'),
          location: 'Complexo Laboratorial',
          discipline: 'Práticas Curriculares Integradas',
          professor: coordinator,
          studentsCount: 36,
          actionsReport:
            'Registro das etapas experimentais conduzidas pelos grupos discentes, com verificação de conformidade procedimental e biossegurança.',
          pedagogicalImpact: 'Capacidade analítica e sedimentação de boas práticas laboratoriais.',
        },
      },
    },
    {
      title: 'Evidência: Divisão 70/30 (Destaque)',
      description: 'Uma foto principal de grande impacto e fotos secundárias de detalhe.',
      icon: <Grid className="w-5 h-5 text-indigo-500" />,
      slide: {
        type: 'evidencia',
        title: 'Visita Técnica / Evento Institucional',
        photoLayout: 'split-70-30',
        photos: [],
        evidenceMeta: {
          category: 'Visita Técnica & Extensão',
          date: new Date().toLocaleDateString('pt-BR'),
          location: 'Polo Tecnológico Regional',
          discipline: 'Atividades Complementares e Extensão',
          professor: coordinator,
          studentsCount: 40,
          actionsReport:
            'Imersão prática externa proporcionando contato direto dos acadêmicos com infraestruturas reais e processos do setor produtivo.',
          pedagogicalImpact: 'Aproximação com o ecossistema profissional contemporâneo.',
        },
      },
    },
    {
      title: 'Evidência: Grade de 3 Fotos',
      description: 'Painel tríptico dinâmico para registrar sequência de atividades ou equipes.',
      icon: <Grid className="w-5 h-5 text-teal-500" />,
      slide: {
        type: 'evidencia',
        title: 'Mostra de Projetos e Bancas Avaliadoras',
        photoLayout: 'grid-3',
        photos: [],
        evidenceMeta: {
          category: 'Projeto Integrador / Mostra Científica',
          date: new Date().toLocaleDateString('pt-BR'),
          location: 'Auditório Master',
          discipline: 'Projetos Integradores Multidisciplinares',
          professor: coordinator,
          studentsCount: 45,
          actionsReport:
            'Apresentação pública de soluções desenvolvidas pelos estudantes, com arguição técnica e avaliação por bancas especializadas.',
          pedagogicalImpact: 'Desenvolvimento de comunicação oral, oratória e rigor metodológico.',
        },
      },
    },
    {
      title: 'Apresentação & Propósito Pedagógico',
      description: 'Visão geral do curso, matriz curricular e metodologia ativa no semestre.',
      icon: <FileText className="w-5 h-5 text-purple-500" />,
      slide: {
        type: 'apresentacao',
        title: 'Apresentação do Curso & Propósito Pedagógico',
        customText1:
          'O curso orienta-se pela sólida articulação entre rigor técnico-científico e aplicação prática imediata.',
        customText2:
          'A metodologia ativa adotada coloca o estudante no centro do processo de aprendizagem em ambientes vivos de cocriação.',
        photos: [],
      },
    },
    {
      title: 'Alinhamento Diretrizes MEC / DCNs',
      description: 'Quadro estruturado com códigos de competências e referências normativas do MEC.',
      icon: <Award className="w-5 h-5 text-amber-500" />,
      slide: {
        type: 'diretrizes',
        title: 'Alinhamento com Diretrizes Curriculares & Competências',
        photos: [],
        competencies: [
          {
            id: `comp-${Date.now()}-1`,
            code: 'COMP-01',
            title: 'Domínio Instrumental & Experimentação Prática',
            description: 'Capacidade de manusear instrumentais laboratoriais e simular ensaios críticos.',
            mecStandard: 'DCN Art. 4º - Conteúdos Profissionalizantes',
          },
          {
            id: `comp-${Date.now()}-2`,
            code: 'COMP-02',
            title: 'Solução Criativa de Problemas Complexos',
            description: 'Desenvolvimento de raciocínio investigativo para propor soluções metodologicamente fundamentadas.',
            mecStandard: 'Instrumento MEC/INEP - Indicador 1.3',
          },
        ],
      },
    },
    {
      title: 'Equipe Docente & Supervisores',
      description: 'Quadro com nomes, titulação e disciplinas do corpo acadêmico do período.',
      icon: <Users className="w-5 h-5 text-emerald-500" />,
      slide: {
        type: 'equipe',
        title: 'Ficha Técnica da Equipe Docente',
        photos: [],
        facultyList: [
          {
            id: `fac-${Date.now()}-1`,
            name: coordinator,
            role: 'Coordenador de Curso & Docente Titular',
            degree: 'Doutor em Ciências Aplicadas',
            discipline: 'Projetos Integradores e Inovação',
          },
        ],
      },
    },
    {
      title: 'Indicadores & Resultados Pedagógicos',
      description: 'Métricas numéricas de participação, adesão e síntese executiva do período.',
      icon: <BarChart3 className="w-5 h-5 text-rose-500" />,
      slide: {
        type: 'metricas',
        title: 'Indicadores de Engajamento & Resultados Pedagógicos',
        photos: [],
        metrics: [
          {
            id: `m-${Date.now()}-1`,
            label: 'Acadêmicos Impactados',
            value: '150+',
            detail: 'Frequência plena em práticas de laboratório',
          },
          {
            id: `m-${Date.now()}-2`,
            label: 'Carga Horária Prática',
            value: '100h',
            detail: 'Vivência em cenários simulados e reais',
          },
          {
            id: `m-${Date.now()}-3`,
            label: 'Projetos Concluídos',
            value: '18',
            detail: 'Articulação direta com a comunidade',
          },
          {
            id: `m-${Date.now()}-4`,
            label: 'Aprovação Prática',
            value: '96%',
            detail: 'Índice de aproveitamento nas bancas',
          },
        ],
        customText1:
          'Os indicadores consolidam a efetividade das metodologias ativas e o fortalecimento do perfil profissional do egresso.',
      },
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Adicionar Novo Slide ao Book
            </h3>
            <p className="text-xs text-slate-500">
              Selecione um modelo padronizado institucional
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Templates Grid */}
        <div className="p-5 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-3">
          {templates.map((tmpl, idx) => (
            <button
              key={idx}
              onClick={() => {
                onSelectTemplate(tmpl.slide);
                onClose();
              }}
              className="p-3.5 rounded-lg border border-slate-200 hover:border-[#00A3E0] hover:bg-sky-50/30 text-left transition-all flex items-start gap-3 group"
            >
              <div className="p-2 rounded-md bg-slate-100 group-hover:bg-[#E0F2FE] transition-colors shrink-0">
                {tmpl.icon}
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 group-hover:text-[#004B8D]">
                  {tmpl.title}
                </div>
                <div className="text-[11px] text-slate-500 mt-1 leading-snug">
                  {tmpl.description}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
