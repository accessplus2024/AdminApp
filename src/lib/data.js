// Estado + configuração compartilhada do AdminApp (pt-BR).
// Os arrays de conteúdo (opportunities, team, activity, instaAccounts,
// instaPosts, newsletters) começam VAZIOS — sem dados fictícios/placeholder.
// Eles são preenchidos com dados REAIS (Supabase) em tempo de execução:
//   - opportunities: App.jsx -> fetchOpportunities()
//   - team:          Team.jsx -> fetchTeam()
// O resto abaixo (nav, filters, variants) é configuração da interface, não
// conteúdo de exemplo — continua fixo.
const D = {
  nav: [
    { id: 'dashboard',     label: 'Visão geral',    icon: 'LayoutDashboard' },
    { id: 'oportunidades', label: 'Oportunidades',   icon: 'Compass' },
    { id: 'revisao',       label: 'Em revisão',      icon: 'FilePen' },
    { id: 'sentinel',      label: 'Sentinel',        icon: 'Radar' },
    { id: 'submissoes',    label: 'Submissões',      icon: 'Inbox' },
    { id: 'newsletter',    label: 'Newsletter',      icon: 'Newspaper' },
    { id: 'time',          label: 'Membros do time', icon: 'UsersRound' },
  ],

  filters: [
    { key: 'tipo', label: 'Tipo', type: 'check', options: [
      'Olimpíadas Científicas', 'MUNs', 'Programas Acadêmicos', 'Programas de Intercâmbio',
      'Bolsas de Estudo', 'Competições', 'Competições de Escrita', 'Mentorias',
    ] },
    { key: 'inscricoes', label: 'Disponibilidade', type: 'radio', options: ['Inscrições abertas', 'Inscrições encerradas'] },
    { key: 'nivel', label: 'Nível', type: 'check', options: ['Fundamental', 'Ensino Médio', 'Gap', 'Faculdade'] },
    { key: 'custo', label: 'Custo', type: 'check', options: ['Bolsa', 'Gratuito', 'Totalmente Financiado'] },
    { key: 'interesse', label: 'Interesse', type: 'check', options: ['Meio Ambiente', 'Humanas', 'STEM', 'Linguagens', 'Artes', 'Empreendedorismo', 'Ativismo', 'Tech', 'Política'] },
    { key: 'publicoAlvo', label: 'Público-alvo', type: 'check', options: ['Negro/Pardo', 'LGBT', 'Baixa Renda', 'Indígena/Quilombola', 'Deficientes', 'Meninas', 'Escola Pública'] },
  ],

  // Oportunidades reais — carregadas do Supabase (App.jsx). Vazio até carregar.
  opportunities: [],

  // Time real (admins) — carregado do Supabase (Team.jsx). Vazio até carregar.
  team: [],

  // Atividade recente — hoje é derivada das oportunidades reais (Dashboard.jsx).
  activity: [],

  statusVariant: {
    'Publicada': 'success', 'Em revisão': 'warning', 'Rascunho': 'neutral', 'Inscrições encerradas': 'danger',
    'Ativo': 'success', 'Convite pendente': 'warning', 'Inativo': 'neutral',
  },
  papelVariant: { 'Admin': 'primary', 'Editor': 'mint', 'Analista': 'pink', 'Viewer': 'neutral' },
  tipoVariant: {
    'Olimpíadas Científicas': 'primary', 'MUNs': 'pink', 'Programas Acadêmicos': 'mint',
    'Programas de Intercâmbio': 'primary', 'Bolsas de Estudo': 'lime', 'Competições': 'pink',
    'Competições de Escrita': 'mint', 'Mentorias': 'lime',
  },
  custoVariant: { 'Gratuito': 'success', 'Bolsa': 'primary', 'Totalmente Financiado': 'mint' },

  // Newsletter (tela fora do nav nesta versão) — mantido vazio, sem exemplos.
  instaAccounts: [],
  instaPosts: [],
  newsletters: [],
  newsletterStatusVariant: { 'Enviada': 'success', 'Agendada': 'primary', 'Rascunho': 'neutral' },
};

export default D;
