/**
 * Capacidades de IA que hemos diseñado, construido y puesto en producción.
 * Vienen de la web anterior; los ejemplos son representativos y están anonimizados
 * por confidencialidad. Se listan y se filtran en /casos-de-uso/.
 */
export interface Familia {
  slug: string;
  num: string;
  titulo: string;
  texto: string;
}

export interface Caso {
  id: string;
  familia: string;
  titulo: string;
  texto: string;
  sectores: string[];
  tecnologias: string[];
}

export const familias: Familia[] = [
  { slug: 'conversacional', num: '01', titulo: 'Asistentes conversacionales', texto: 'Chatbots y asistentes de voz para web, WhatsApp y teléfono, con búsqueda sobre tu información, escalado a persona y analítica de conversaciones. Atención al cliente, salud, formación y soporte interno.' },
  { slug: 'agentes', num: '02', titulo: 'Agentes autónomos', texto: 'Agentes que ejecutan procesos de verdad: consultan sistemas internos, responden preguntas de negocio sobre tus datos, vigilan, prueban y hacen prospección. Con traza completa de cada paso para poder auditarlo.' },
  { slug: 'rag', num: '03', titulo: 'Búsqueda y conocimiento', texto: 'Búsqueda semántica sobre tu intranet, tu normativa o tus grabaciones. Control de acceso por rol, cita obligatoria de la fuente en cada respuesta e indexación incremental.' },
  { slug: 'workflow', num: '04', titulo: 'Automatización de procesos', texto: 'Integración entre sistemas que no se hablan, gestión de incidencias, comunicación multicanal, informes automáticos y memorias técnicas para licitaciones.' },
  { slug: 'governance', num: '05', titulo: 'Gobernanza y cumplimiento', texto: 'Gobernanza de sistemas de IA según el Reglamento Europeo de IA, auditoría ALTAI y cumplimiento multi-marco con RGPD, NIS2 y la norma de accesibilidad. La documentación obligatoria se genera sola.' },
  { slug: 'seguridad', num: '06', titulo: 'Seguridad de IA', texto: 'Auditoría y blindaje de los asistentes que ya tienes publicados: qué se les puede sacar, cómo se les saca y cómo se cierra. Incluye pruebas adversarias, guardarraíles y vigilancia continua.' },
  { slug: 'verticales', num: '07', titulo: 'Plataformas verticales y datos sintéticos', texto: 'Plataformas de IA para un sector concreto (seguros, legal, sanidad, aceleración empresarial), simulación digital y generación de datos sintéticos que preservan la privacidad.' },
  { slug: 'modelos', num: '08', titulo: 'Modelos propios y predicción', texto: 'Ajuste fino de modelos abiertos para un vertical, previsión y detección de anomalías, clasificación supervisada, reconocimiento de documentos a medida y evaluación de modelos.' },
];

/** Etiquetas de los filtros. La clave es la que llevan los casos. */
export const sectores: Record<string, string> = {
  publico: 'Sector público',
  salud: 'Salud',
  turismo: 'Turismo',
  edu: 'Formación',
  b2b: 'Empresa y B2B',
  legal: 'Legal y finanzas',
};

export const tecnologias: Record<string, string> = {
  chat: 'Conversacional',
  agentes: 'Agentes',
  rag: 'Búsqueda',
  datos: 'Datos',
  modelos: 'Modelos',
  seguridad: 'Seguridad',
  compliance: 'Cumplimiento',
};

export const casos: Caso[] = [
  {
    id: 'chatbot-ciudadano',
    familia: 'conversacional',
    titulo: 'Chatbot ciudadano para servicios públicos',
    texto:
      'Asistente conversacional web + WhatsApp para que el ciudadano resuelva trámites, ayudas y normativa sin desplazarse ni llamar al 010.',
    sectores: ['publico'],
    tecnologias: ['chat', 'rag'],
  },
  {
    id: 'chatbot-academico',
    familia: 'conversacional',
    titulo: 'Chatbot académico universitario',
    texto:
      'Asistente con SSO contra LDAP/SAML del centro y RAG sobre planes de estudio, matrícula y normativa académica. Multilingüe.',
    sectores: ['edu', 'publico'],
    tecnologias: ['chat', 'rag'],
  },
  {
    id: 'chatbot-turistico',
    familia: 'conversacional',
    titulo: 'Chatbot turístico de destino inteligente',
    texto:
      'Asistente multilingüe (ES/EN/CA/FR/DE/IT) con geolocalización para POIs, eventos, restauración y movilidad del visitante.',
    sectores: ['turismo', 'publico'],
    tecnologias: ['chat', 'rag'],
  },
  {
    id: 'chatbot-crm',
    familia: 'conversacional',
    titulo: 'Chatbot integrado en CRM corporativo',
    texto:
      'Asistente con tool calling sobre tu CRM open source: consulta clientes, abre tickets, redacta emails, ejecuta workflows.',
    sectores: ['b2b'],
    tecnologias: ['chat', 'agentes'],
  },
  {
    id: 'recepcionista-salud',
    familia: 'conversacional',
    titulo: 'Recepcionista IA por WhatsApp para clínicas',
    texto:
      'Bot que gestiona citas contra Google Calendar, transcribe notas de voz y escala a humano cuando detecta urgencia. Metered billing.',
    sectores: ['salud'],
    tecnologias: ['chat', 'agentes'],
  },
  {
    id: 'chatbot-legal',
    familia: 'conversacional',
    titulo: 'Chatbot vertical legal/asegurador',
    texto:
      'Asistente con RAG sobre normativa sectorial, condicionados y procedimientos internos. Citaciones obligatorias a fuente.',
    sectores: ['legal', 'b2b'],
    tecnologias: ['chat', 'rag', 'compliance'],
  },
  {
    id: 'agentes-backoffice',
    familia: 'agentes',
    titulo: 'Agentes IA para módulos de back-office',
    texto:
      'Agentes LangGraph que ejecutan procesos administrativos del cliente, con observability predictiva y audit log para AI Act.',
    sectores: ['publico', 'b2b'],
    tecnologias: ['agentes', 'compliance'],
  },
  {
    id: 'agente-bi-conversacional',
    familia: 'agentes',
    titulo: 'BI conversacional con text-to-SQL',
    texto:
      'Agente que consulta tus BBDD operativas y devuelve indicadores en lenguaje natural. Validación semántica, anti-SQL-injection.',
    sectores: ['b2b', 'publico'],
    tecnologias: ['agentes', 'datos'],
  },
  {
    id: 'agente-normativa',
    familia: 'agentes',
    titulo: 'Agente conversacional de consulta normativa',
    texto:
      'RAG sobre BOE, Ley de Contratos del Sector Público y normativa sectorial. Distingue vigente y derogada, cita artículos.',
    sectores: ['legal', 'publico'],
    tecnologias: ['agentes', 'rag', 'compliance'],
  },
  {
    id: 'agentes-qa',
    familia: 'agentes',
    titulo: 'Agentes de QA y testing automatizado',
    texto:
      'Agentes que generan tests, detectan regresiones y validan patrones OWASP sobre código legacy.',
    sectores: ['b2b'],
    tecnologias: ['agentes'],
  },
  {
    id: 'agente-observability',
    familia: 'agentes',
    titulo: 'Agente de observabilidad predictiva',
    texto:
      'Monitoriza logs y métricas, predice incidencias antes de que ocurran, propone remediation en lenguaje natural.',
    sectores: ['b2b'],
    tecnologias: ['agentes', 'datos'],
  },
  {
    id: 'agente-outreach',
    familia: 'agentes',
    titulo: 'Agente comercial de outreach multi-canal',
    texto:
      'Prospección y secuencias por LinkedIn, email y X con personalización IA, detección de respuestas reales y supresión automática.',
    sectores: ['b2b'],
    tecnologias: ['agentes', 'chat'],
  },
  {
    id: 'agente-evaluaciones',
    familia: 'agentes',
    titulo: 'Agente de generación de evaluaciones',
    texto:
      'Cuestionarios desde texto, PDF, URL o YouTube. Tipos test, abiertas, relación, orden. Anti-cheat y auto-corrección.',
    sectores: ['edu', 'b2b'],
    tecnologias: ['agentes', 'modelos'],
  },
  {
    id: 'rag-corporativo',
    familia: 'rag',
    titulo: 'RAG sobre documentación corporativa',
    texto:
      'Búsqueda semántica con control de acceso por roles sobre intranet, manuales y procedimientos. Citas a fuente verificables.',
    sectores: ['b2b', 'publico'],
    tecnologias: ['rag'],
  },
  {
    id: 'rag-compliance',
    familia: 'rag',
    titulo: 'RAG multi-marco para compliance EU',
    texto:
      'Plataforma RGPD + NIS2 + EAA + AI Act que analiza tu web y docs, mapea obligaciones y genera documentación obligatoria.',
    sectores: ['b2b', 'legal'],
    tecnologias: ['rag', 'compliance'],
  },
  {
    id: 'rag-transcripciones',
    familia: 'rag',
    titulo: 'RAG sobre transcripciones audiovisuales',
    texto:
      'Transcripción Whisper + búsqueda semántica con timestamps sobre plenos, clases o formación en vídeo.',
    sectores: ['publico', 'edu'],
    tecnologias: ['rag', 'modelos'],
  },
  {
    id: 'rag-busqueda-juridica',
    familia: 'rag',
    titulo: 'Búsqueda semántica sobre jurisprudencia',
    texto:
      'RAG sobre sentencias y normativa con validación de citas legales y comparativa entre cuerpos jurisprudenciales.',
    sectores: ['legal', 'publico'],
    tecnologias: ['rag', 'compliance'],
  },
  {
    id: 'cdc-hibrido',
    familia: 'workflow',
    titulo: 'CDC y sync entre sistemas heterogéneos',
    texto:
      'Captura de cambios log-based entre Oracle, SQL Server, PostgreSQL y Mongo con entrega exactly-once. Sin impacto en producción.',
    sectores: ['b2b', 'publico'],
    tecnologias: ['datos'],
  },
  {
    id: 'itsm-publico',
    familia: 'workflow',
    titulo: 'ITSM y ticketing open source',
    texto:
      'Plataforma de incidencias con SSO LDAP/SAML, 2FA, automatización condición-acción y portal web de autoservicio.',
    sectores: ['publico', 'b2b'],
    tecnologias: ['agentes'],
  },
  {
    id: 'comunicacion-ciudadana',
    familia: 'workflow',
    titulo: 'Comunicación ciudadana multi-canal',
    texto:
      'WhatsApp + SMS con segmentación geográfica, generación de campañas asistida por IA y tracking auditable.',
    sectores: ['publico'],
    tecnologias: ['chat', 'agentes'],
  },
  {
    id: 'informes-automaticos',
    familia: 'workflow',
    titulo: 'Generación automática de informes',
    texto:
      'Pipeline que extrae datos operativos y genera DOCX/PDF con narrativa interpretativa y comparativas históricas.',
    sectores: ['publico', 'b2b'],
    tecnologias: ['agentes', 'datos'],
  },
  {
    id: 'memorias-licitaciones',
    familia: 'workflow',
    titulo: 'Memorias técnicas asistidas por IA',
    texto:
      'RAG sobre histórico de propuestas ganadas + análisis del pliego. Reduce time-to-bid de 40-80 horas a 5-10.',
    sectores: ['b2b', 'publico'],
    tecnologias: ['agentes', 'rag'],
  },
  {
    id: 'governance-ai-act',
    familia: 'governance',
    titulo: 'Plataforma de governance AI Act',
    texto:
      'Registro de sistemas IA, clasificación por riesgo, evaluación de impacto y monitorización de drift y bias.',
    sectores: ['b2b', 'publico'],
    tecnologias: ['compliance'],
  },
  {
    id: 'auditoria-altai',
    familia: 'governance',
    titulo: 'Auditoría ALTAI de IA confiable',
    texto:
      'Marco europeo de evaluación de los 7 requisitos ALTAI con informe certificable para licitaciones públicas.',
    sectores: ['publico', 'b2b'],
    tecnologias: ['compliance'],
  },
  {
    id: 'multi-marco-compliance',
    familia: 'governance',
    titulo: 'Compliance multi-marco automatizado',
    texto:
      'Scanner técnico + generador de docs (declaración accesibilidad, política privacidad, registro IA) para PYMEs europeas.',
    sectores: ['b2b', 'publico'],
    tecnologias: ['compliance', 'rag'],
  },
  {
    id: 'auditoria-asistentes',
    familia: 'seguridad',
    titulo: 'Auditoría de asistentes IA publicados',
    texto:
      'Escaneo de los chatbots con IA de una web: extracción de las instrucciones internas, revelación de condiciones comerciales y fuga de datos, con el fragmento exacto que demuestra cada hallazgo.',
    sectores: ['b2b', 'publico', 'salud', 'legal'],
    tecnologias: ['seguridad', 'chat'],
  },
  {
    id: 'red-team-llm',
    familia: 'seguridad',
    titulo: 'Pruebas adversarias sobre LLM y agentes',
    texto:
      'Batería de pruebas contra el asistente y las herramientas que tiene conectadas: inyección de instrucciones, jailbreak y salida de guion, puntuadas por un modelo juez con rúbrica.',
    sectores: ['b2b', 'publico'],
    tecnologias: ['seguridad', 'agentes'],
  },
  {
    id: 'guardarrailes',
    familia: 'seguridad',
    titulo: 'Guardarraíles y filtros de salida',
    texto:
      'Reescritura del system prompt, filtros de entrada y salida, y límites explícitos de lo que el agente puede consultar o ejecutar. Con pruebas de regresión para que no se vuelva a abrir.',
    sectores: ['b2b', 'salud', 'legal'],
    tecnologias: ['seguridad', 'chat', 'compliance'],
  },
  {
    id: 'hardening-rag',
    familia: 'seguridad',
    titulo: 'Blindaje del RAG y de las herramientas',
    texto:
      'Control de acceso por rol sobre las fuentes, saneado del contexto que entra al modelo y permisos mínimos en cada herramienta conectada al agente.',
    sectores: ['b2b', 'publico', 'legal'],
    tecnologias: ['seguridad', 'rag'],
  },
  {
    id: 'vigilancia-ia',
    familia: 'seguridad',
    titulo: 'Vigilancia continua del asistente',
    texto:
      'Re-escaneo periódico y aviso cuando un cambio en el prompt o una fuente nueva vuelve a abrir una fuga que estaba cerrada.',
    sectores: ['b2b', 'publico', 'salud'],
    tecnologias: ['seguridad', 'compliance'],
  },
  {
    id: 'plataforma-seguros',
    familia: 'verticales',
    titulo: 'Plataforma IA corporativa para seguros',
    texto:
      'Catálogo interno de modelos (clasificación, fraude, OCR) con governance, costes y observability centralizados.',
    sectores: ['legal', 'b2b'],
    tecnologias: ['modelos', 'agentes', 'compliance'],
  },
  {
    id: 'asistente-legal',
    familia: 'verticales',
    titulo: 'Asistente IA para sector legal',
    texto:
      'Vertical jurídico con RAG sobre jurisprudencia, redacción asistida y validación humana en bucle.',
    sectores: ['legal', 'b2b'],
    tecnologias: ['rag', 'chat', 'compliance'],
  },
  {
    id: 'aceleradora-empresarial',
    familia: 'verticales',
    titulo: 'Aceleradora empresarial con tooling IA',
    texto:
      'Gestión de programas con diagnóstico automático de startups, matching con mentores y reporting a financiadores EU.',
    sectores: ['b2b', 'publico'],
    tecnologias: ['agentes', 'datos'],
  },
  {
    id: 'gemelo-digital',
    familia: 'verticales',
    titulo: 'Simulación digital y gemelo de aforo',
    texto:
      'Gemelo digital para escenarios de afluencia y eventos masivos. Evalúa medidas antes de implementarlas.',
    sectores: ['publico', 'turismo'],
    tecnologias: ['datos', 'modelos'],
  },
  {
    id: 'datos-sinteticos-salud',
    familia: 'verticales',
    titulo: 'Datos sintéticos para investigación sanitaria',
    texto:
      'Datasets sintéticos que preservan propiedades estadísticas sin información personal. K-anonymity y differential privacy.',
    sectores: ['salud', 'b2b'],
    tecnologias: ['modelos', 'datos', 'compliance'],
  },
  {
    id: 'data-spaces',
    familia: 'verticales',
    titulo: 'Espacios de datos federados (Gaia-X)',
    texto:
      'Espacio sectorial conforme a IDS / Gaia-X para compartir datos entre organizaciones manteniendo soberanía.',
    sectores: ['b2b', 'publico'],
    tecnologias: ['datos', 'compliance'],
  },
  {
    id: 'finetuning-vertical',
    familia: 'modelos',
    titulo: 'Fine-tuning de LLM open weights verticales',
    texto:
      'Ajuste de Mistral o Llama sobre corpus propio del cliente. Cumple soberanía EU y reduce coste de inferencia.',
    sectores: ['b2b', 'legal', 'salud'],
    tecnologias: ['modelos'],
  },
  {
    id: 'forecasting-anomaly',
    familia: 'modelos',
    titulo: 'Forecasting y detección de anomalías',
    texto:
      'Modelos de serie temporal (Prophet, ARIMA, deep learning) y anomaly detection sobre métricas operativas.',
    sectores: ['b2b', 'publico', 'turismo'],
    tecnologias: ['modelos', 'datos'],
  },
  {
    id: 'clasificacion-salud',
    familia: 'modelos',
    titulo: 'Clasificación supervisada para triaje clínico',
    texto:
      'Modelo de triaje sintomático para asistente sanitario remoto entrenado sobre datos sintéticos. Auditable y reproducible.',
    sectores: ['salud', 'legal'],
    tecnologias: ['modelos', 'compliance'],
  },
  {
    id: 'ocr-custom',
    familia: 'modelos',
    titulo: 'OCR custom para documentación específica',
    texto:
      'Extracción estructurada de campos en pólizas, facturas, recetas o expedientes. Re-entrenamiento incremental con feedback.',
    sectores: ['legal', 'b2b', 'publico'],
    tecnologias: ['modelos', 'datos'],
  },
  {
    id: 'eval-benchmarking',
    familia: 'modelos',
    titulo: 'Evaluación y benchmarking de modelos',
    texto:
      'Harness reproducible para comparar LLMs y modelos clásicos sobre tu tarea concreta con métricas tuyas, no genéricas.',
    sectores: ['b2b'],
    tecnologias: ['modelos', 'compliance'],
  },
];
