/** Els productes propis, versió catalana. Es llisten a /ca/productos/; el peu enllaça a /ca/productos/#<slug>. */
export interface Producto {
  slug: string;
  nombre: string;
  estado: 'En producció' | 'Beta' | 'Pre-MVP';
  categoria: string;
  descripcion: string;
  /** Sense url quan el producte encara no és públic. */
  url?: string;
  /** Nom del fitxer dins de public/img/productos/. */
  logo: string;
  /** Fitxa a /ca/productos/<slug>/: què fa i amb què està construït. */
  queHace: string;
  stack: string;
}

export const productos: Producto[] = [
  {
    slug: 'leakai',
    nombre: 'LeakAI',
    estado: 'En producció',
    categoria: 'Ciberseguretat',
    descripcion: 'Auditoria de seguretat per als chatbots amb IA de la teva web.',
    url: 'https://leakai.77delta.com',
    logo: 'leakai.svg',
    queHace:
      'Recorre una web, localitza els assistents amb IA que hi ha publicats i els llança una bateria de proves de fuga: extracció de les instruccions internes, revelació de condicions comercials, dades personals, injecció d’instruccions i sortida de guió. Un model jutge puntua cada resposta i ha de citar el fragment que demostra la fuga.',
    stack: 'Node 22, Playwright, Mistral com a model jutge, Postgres',
  },
  {
    slug: 'regulia',
    nombre: 'Regulia',
    estado: 'En producció',
    categoria: 'Compliance EU',
    descripcion: 'Compliance europeu automatitzat per a pimes.',
    url: 'https://regulia.app',
    logo: 'regulia.png',
    queHace:
      'Plataforma amb tres mòduls de compliment europeu: accessibilitat (norma EN 301 549), ciberseguretat (NIS2) i governança d’IA (Reglament Europeu d’IA). Analitza, genera la documentació obligatòria i vigila que se segueixi complint.',
    stack: 'Next.js 16, Supabase, Gemini 2.0 Flash, axe-core',
  },
  {
    slug: 'contestia',
    nombre: 'Contestia',
    estado: 'En producció',
    categoria: 'HealthTech',
    descripcion: 'Recepcionista virtual per WhatsApp per a clíniques.',
    url: 'https://contestia.co',
    logo: 'contestia.png',
    queHace:
      'Recepcionista per WhatsApp per a clíniques: respon als pacients, consulta la base de coneixement del centre, gestiona les cites contra el calendari i escala a una persona quan detecta una urgència.',
    stack: 'FastAPI, Supabase amb pgvector, Gemini 2.0 Flash, Evolution API',
  },
  {
    slug: 'instantexam',
    nombre: 'InstantExam',
    estado: 'En producció',
    categoria: 'EdTech',
    descripcion: 'Generador d’exàmens amb IA en 30 segons.',
    url: 'https://instantexam.co',
    logo: 'instantexam.png',
    queHace:
      'Converteix un text, un PDF, una URL o un vídeo de YouTube en un examen en segons. L’alumne entra amb un enllaç i una contrasenya, sense registrar-se, i la correcció i el rànquing són automàtics.',
    stack: 'React 19, Express 5, MongoDB, OpenAI',
  },
  {
    slug: 'scoreflow',
    nombre: 'ScoreFlow',
    estado: 'Pre-MVP',
    categoria: 'B2B SaaS',
    descripcion: 'Craftsmanship Score per a AI coding.',
    logo: 'scoreflow.svg',
    queHace:
      'Recull la telemetria de les eines de programació amb IA d’un equip i produeix una puntuació d’ofici per equip. Mètriques per bandes i agregats amb un mínim de cinc persones, per mesurar sense vigilar ningú.',
    stack: 'Next.js 16, Hono, Postgres i ClickHouse, OpenTelemetry',
  },
  {
    slug: 'contablia',
    nombre: 'Contablia',
    estado: 'Pre-MVP',
    categoria: 'FinTech',
    descripcion: 'Equip virtual de 5 agents per a autònoms espanyols.',
    logo: 'contablia.png',
    queHace:
      'Cinc agents que es reparteixen l’administració d’un autònom: pressupostos i seguiment comercial, captura d’ingressos i despeses, models fiscals, documentació i avisos de negoci. Es gestiona conversant.',
    stack: 'Next.js, Postgres amb pgvector, Drizzle, banca oberta',
  },
  {
    slug: 'swarmix',
    nombre: 'Swarmix',
    estado: 'Beta',
    categoria: 'Outreach',
    descripcion: 'Outreach IA multiplataforma.',
    url: 'https://swarmix.co',
    logo: 'swarmix.png',
    queHace:
      'Motor de prospecció multiplataforma sobre LinkedIn, correu i X: troba contactes, els enriqueix, executa la seqüència i mesura què passa a cada pas de l’embut.',
    stack: 'Node 22, Express 5, MongoDB, Unipile, Gemini 2.5 Flash',
  },
];

/** Línia de formació en salut per a empreses de Next Gen Academy SL. Web pròpia a corpora.cat. */
export const corpora = {
  slug: 'corpora',
  nombre: 'Corpora',
  url: 'https://corpora.cat',
  claim: 'Ciència de la salut aplicada al dia a dia de les organitzacions.',
  descripcion:
    'Formacions en salut per a equips professionals, impartides per una fisioterapeuta i professora universitària. Continguts fonamentats en l’evidència i aplicats al lloc de treball. Presencial o online, en castellà i català.',
  ambitos: [
    {
      nombre: 'Ergonomia i cos a la feina',
      programas: 'Lloc d’oficina i teletreball · Dolor d’esquena i coll · Micropauses · Cos i càrrega en feines d’esforç',
    },
    {
      nombre: 'Salut de la dona a la feina',
      programas: 'Menopausa i transició hormonal · Salut de la dona a l’empresa',
    },
    {
      nombre: 'Longevitat i rendiment',
      programas: 'Plantilles a partir dels 50 · Son, descans i rendiment',
    },
  ],
  financiacion: 'Formació bonificable per FUNDAE',
} as const;
