/** Los productos propios. Se listan en /productos/; el footer enlaza a /productos/#<slug>. */
export interface Producto {
  slug: string;
  nombre: string;
  estado: 'En producción' | 'Beta' | 'Pre-MVP';
  categoria: string;
  descripcion: string;
  /** Sin url cuando el producto todavía no es público. */
  url?: string;
  /** Nombre del fichero dentro de public/img/productos/. */
  logo: string;
  /** Ficha en /productos/<slug>/: qué hace y con qué está construido. */
  queHace: string;
  stack: string;
}

export const productos: Producto[] = [
  {
    slug: 'leakai',
    nombre: 'LeakAI',
    estado: 'En producción',
    categoria: 'Ciberseguridad',
    descripcion: 'Auditoría de seguridad para los chatbots con IA de tu web.',
    url: 'https://leakai.77delta.com',
    logo: 'leakai.svg',
    queHace:
      'Recorre una web, localiza los asistentes con IA que tiene publicados y les lanza una batería de pruebas de fuga: extracción de las instrucciones internas, revelación de condiciones comerciales, datos personales, inyección de instrucciones y salida de guion. Un modelo juez puntúa cada respuesta y tiene que citar el fragmento que demuestra la fuga.',
    stack: 'Node 22, Playwright, Mistral como modelo juez, Postgres',
  },
  {
    slug: 'regulia',
    nombre: 'Regulia',
    estado: 'En producción',
    categoria: 'Compliance EU',
    descripcion: 'Compliance europeo automatizado para pymes.',
    url: 'https://regulia.app',
    logo: 'regulia.png',
    queHace:
      'Plataforma con tres módulos de cumplimiento europeo: accesibilidad (norma EN 301 549), ciberseguridad (NIS2) y gobernanza de IA (Reglamento Europeo de IA). Analiza, genera la documentación obligatoria y vigila que siga cumpliéndose.',
    stack: 'Next.js 16, Supabase, Gemini 2.0 Flash, axe-core',
  },
  {
    slug: 'contestia',
    nombre: 'Contestia',
    estado: 'En producción',
    categoria: 'HealthTech',
    descripcion: 'Recepcionista virtual por WhatsApp para clínicas.',
    url: 'https://contestia.co',
    logo: 'contestia.png',
    queHace:
      'Recepcionista por WhatsApp para clínicas: responde a los pacientes, consulta la base de conocimiento del centro, gestiona las citas contra el calendario y escala a una persona cuando detecta una urgencia.',
    stack: 'FastAPI, Supabase con pgvector, Gemini 2.0 Flash, Evolution API',
  },
  {
    slug: 'instantexam',
    nombre: 'InstantExam',
    estado: 'En producción',
    categoria: 'EdTech',
    descripcion: 'Generador de exámenes con IA en 30 segundos.',
    url: 'https://instantexam.co',
    logo: 'instantexam.png',
    queHace:
      'Convierte un texto, un PDF, una URL o un vídeo de YouTube en un examen en segundos. El alumno entra con un enlace y una contraseña, sin registrarse, y la corrección y el ranking son automáticos.',
    stack: 'React 19, Express 5, MongoDB, OpenAI',
  },
  {
    slug: 'scoreflow',
    nombre: 'ScoreFlow',
    estado: 'Pre-MVP',
    categoria: 'B2B SaaS',
    descripcion: 'Craftsmanship Score para AI coding.',
    logo: 'scoreflow.svg',
    queHace:
      'Recoge la telemetría de las herramientas de programación con IA de un equipo y produce una puntuación de oficio por equipo. Métricas por bandas y agregados con mínimo de cinco personas, para medir sin vigilar a nadie.',
    stack: 'Next.js 16, Hono, Postgres y ClickHouse, OpenTelemetry',
  },
  {
    slug: 'contablia',
    nombre: 'Contablia',
    estado: 'Pre-MVP',
    categoria: 'FinTech',
    descripcion: 'Equipo virtual de 5 agentes para autónomos españoles.',
    logo: 'contablia.png',
    queHace:
      'Cinco agentes que se reparten la administración de un autónomo: presupuestos y seguimiento comercial, captura de ingresos y gastos, modelos fiscales, documentación y avisos de negocio. Se maneja conversando.',
    stack: 'Next.js, Postgres con pgvector, Drizzle, banca abierta',
  },
  {
    slug: 'swarmix',
    nombre: 'Swarmix',
    estado: 'Beta',
    categoria: 'Outreach',
    descripcion: 'Outreach IA multi-plataforma.',
    url: 'https://swarmix.co',
    logo: 'swarmix.png',
    queHace:
      'Motor de prospección multiplataforma sobre LinkedIn, email y X: encuentra contactos, los enriquece, ejecuta la secuencia y mide qué pasa en cada paso del embudo.',
    stack: 'Node 22, Express 5, MongoDB, Unipile, Gemini 2.5 Flash',
  },
];

/** Línea de formación en salud para empresas de Next Gen Academy SL. Web propia en corpora.cat. */
export const corpora = {
  slug: 'corpora',
  nombre: 'Corpora',
  url: 'https://corpora.cat',
  claim: 'Ciencia de la salud aplicada al día a día de las organizaciones.',
  descripcion:
    'Formaciones en salud para equipos profesionales, impartidas por una fisioterapeuta y profesora universitaria. Contenidos fundamentados en la evidencia y aplicados al puesto de trabajo. Presencial u online, en castellano y catalán.',
  ambitos: [
    {
      nombre: 'Ergonomía y cuerpo en el trabajo',
      programas: 'Puesto de oficina y teletrabajo · Dolor de espalda y cuello · Micropausas · Cuerpo y carga en trabajos de esfuerzo',
    },
    {
      nombre: 'Salud de la mujer en el trabajo',
      programas: 'Menopausia y transición hormonal · Salud de la mujer en la empresa',
    },
    {
      nombre: 'Longevidad y rendimiento',
      programas: 'Plantillas a partir de los 50 · Sueño, descanso y rendimiento',
    },
  ],
  financiacion: 'Formación bonificable por FUNDAE',
} as const;
