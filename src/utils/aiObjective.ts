import { ActivityType } from '../types';

const OBJECTIVE_TEMPLATES: Record<ActivityType, string[]> = {
  'Atividade de sustentabilidade': [
    'A atividade teve como objetivo promover a conscientização ambiental e o desenvolvimento de práticas sustentáveis, estimulando a responsabilidade socioecológica e a reflexão crítica da comunidade acadêmica.',
    'A iniciativa teve como objetivo incentivar ações práticas de sustentabilidade e preservação de recursos, fortalecendo o compromisso institucional com as metas de desenvolvimento sustentável.',
    'O projeto buscou engajar os estudantes em práticas ecológicas aplicadas, proporcionando vivência colaborativa e reflexão sobre o impacto socioambiental no ambiente universitário.',
  ],
  'Atividade de arrecadação': [
    'A atividade teve como objetivo mobilizar a comunidade acadêmica em prol de ações solidárias de cidadania, promovendo a integração discente e o apoio a causas sociais prioritárias.',
    'A campanha teve como propósito incentivar o espírito de cooperação comunitária e responsabilidade social, arrecadando doações essenciais para instituições assistidas.',
    'A ação solidária buscou estreitar os laços entre a instituição de ensino e a sociedade civil, estimulando o voluntariado e a formação ética e humana dos estudantes.',
  ],
  'Atividade colaborativa interdisciplinar': [
    'A atividade teve como objetivo fomentar a troca de saberes e a integração multidisciplinar entre diferentes cursos, estimulando a colaboração discente e a resolução compartilhada de problemas.',
    'A ação interdisciplinar proporcionou a articulação de competências complementares entre áreas distintas do conhecimento, fortalecendo o trabalho em equipe e a visão sistêmica.',
    'O encontro colaborativo buscou integrar estudantes de diversos cursos em uma dinâmica sinérgica, promovendo a aplicação prática e integrada dos conteúdos curriculares.',
  ],
  'Atividade regular': [
    'A atividade teve como objetivo proporcionar aos alunos uma experiência prática, estimulando a participação, a colaboração e a aprendizagem relacionada ao tema trabalhado.',
    'A atividade curricular teve como propósito sedimentar os conceitos teóricos por meio de dinâmicas aplicadas, favorecendo o engajamento participativo e a consolidação de competências.',
    'A sessão prática buscou desenvolver a capacidade analítica e a vivência colaborativa dos discentes, promovendo a articulação direta entre a teoria e os desafios do exercício profissional.',
  ],
};

export async function generateActivityObjective(
  activityType: ActivityType,
  date?: string,
  time?: string,
  seedIndex: number = 0
): Promise<string> {
  // If user has client Gemini environment variable, we could invoke it:
  const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || (window as any).__GEMINI_API_KEY__;
  if (apiKey) {
    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `Escreva em português do Brasil um texto curto institucional de exatamente 2 linhas (aproximadamente 30 a 40 palavras) descrevendo o objetivo de uma atividade acadêmica universitária do tipo "${activityType}". Exemplo: "A atividade teve como objetivo proporcionar aos alunos uma experiência prática, estimulando a participação, a colaboração e a aprendizagem relacionada ao tema trabalhado." Não invente nomes de pessoas, disciplinas inventadas ou dados não fornecidos. Retorne apenas o texto do objetivo.`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
      });

      const text = response.text?.trim();
      if (text) {
        return text;
      }
    } catch (e) {
      console.warn('Fallback to standard objective template:', e);
    }
  }

  // Template pool with rotation for "Gerar novamente"
  const templates = OBJECTIVE_TEMPLATES[activityType] || OBJECTIVE_TEMPLATES['Atividade regular'];
  const index = Math.abs(seedIndex) % templates.length;
  return templates[index];
}
