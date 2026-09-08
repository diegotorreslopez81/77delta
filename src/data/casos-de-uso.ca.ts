/**
 * Capacitats d'IA que hem dissenyat, construït i posat en producció.
 * Vénen de la web anterior; els exemples són representatius i estan anonimitzats
 * per confidencialitat. Es llisten i es filtren a /ca/casos-de-uso/.
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
  { slug: 'conversacional', num: '01', titulo: 'Assistents conversacionals', texto: 'Chatbots i assistents de veu per a web, WhatsApp i telèfon, amb cerca sobre la teva informació, escalat a persona i analítica de converses. Atenció al client, salut, formació i suport intern.' },
  { slug: 'agentes', num: '02', titulo: 'Agents autònoms', texto: 'Agents que executen processos de debò: consulten sistemes interns, responen preguntes de negoci sobre les teves dades, vigilen, proven i fan prospecció. Amb traça completa de cada pas per poder-ho auditar.' },
  { slug: 'rag', num: '03', titulo: 'Cerca i coneixement', texto: 'Cerca semàntica sobre la teva intranet, la teva normativa o les teves gravacions. Control d’accés per rol, citació obligatòria de la font a cada resposta i indexació incremental.' },
  { slug: 'workflow', num: '04', titulo: "Automatització de processos", texto: 'Integració entre sistemes que no es parlen, gestió d’incidències, comunicació multicanal, informes automàtics i memòries tècniques per a licitacions.' },
  { slug: 'governance', num: '05', titulo: 'Governança i compliment', texto: 'Governança de sistemes d’IA segons el Reglament Europeu d’IA, auditoria ALTAI i compliment multi-marc amb RGPD, NIS2 i la norma d’accessibilitat. La documentació obligatòria es genera sola.' },
  { slug: 'seguridad', num: '06', titulo: 'Seguretat d’IA', texto: 'Auditoria i blindatge dels assistents que ja tens publicats: què se’ls pot treure, com se’ls treu i com es tanca. Inclou proves adversàries, barreres de protecció i vigilància contínua.' },
  { slug: 'verticales', num: '07', titulo: 'Plataformes verticals i dades sintètiques', texto: 'Plataformes d’IA per a un sector concret (assegurances, legal, sanitat, acceleració empresarial), simulació digital i generació de dades sintètiques que preserven la privacitat.' },
  { slug: 'modelos', num: '08', titulo: 'Models propis i predicció', texto: 'Ajust fi de models oberts per a un vertical, previsió i detecció d’anomalies, classificació supervisada, reconeixement de documents a mida i avaluació de models.' },
];

/** Etiquetes dels filtres. La clau és la que porten els casos. */
export const sectores: Record<string, string> = {
  publico: 'Sector públic',
  salud: 'Salut',
  turismo: 'Turisme',
  edu: 'Formació',
  b2b: 'Empresa i B2B',
  legal: 'Legal i finances',
};

export const tecnologias: Record<string, string> = {
  chat: 'Conversacional',
  agentes: 'Agents',
  rag: 'Cerca',
  datos: 'Dades',
  modelos: 'Models',
  seguridad: 'Seguretat',
  compliance: 'Compliment',
};

export const casos: Caso[] = [
  {
    id: 'chatbot-ciudadano',
    familia: 'conversacional',
    titulo: 'Chatbot ciutadà per a serveis públics',
    texto:
      'Assistent conversacional web + WhatsApp perquè el ciutadà resolgui tràmits, ajudes i normativa sense desplaçar-se ni trucar al 010.',
    sectores: ['publico'],
    tecnologias: ['chat', 'rag'],
  },
  {
    id: 'chatbot-academico',
    familia: 'conversacional',
    titulo: 'Chatbot acadèmic universitari',
    texto:
      'Assistent amb SSO contra LDAP/SAML del centre i RAG sobre plans d’estudi, matrícula i normativa acadèmica. Multilingüe.',
    sectores: ['edu', 'publico'],
    tecnologias: ['chat', 'rag'],
  },
  {
    id: 'chatbot-turistico',
    familia: 'conversacional',
    titulo: 'Chatbot turístic de destinació intel·ligent',
    texto:
      'Assistent multilingüe (ES/EN/CA/FR/DE/IT) amb geolocalització per a punts d’interès, esdeveniments, restauració i mobilitat del visitant.',
    sectores: ['turismo', 'publico'],
    tecnologias: ['chat', 'rag'],
  },
  {
    id: 'chatbot-crm',
    familia: 'conversacional',
    titulo: 'Chatbot integrat en CRM corporatiu',
    texto:
      'Assistent amb tool calling sobre el teu CRM open source: consulta clients, obre tiquets, redacta correus, executa fluxos de treball.',
    sectores: ['b2b'],
    tecnologias: ['chat', 'agentes'],
  },
  {
    id: 'recepcionista-salud',
    familia: 'conversacional',
    titulo: 'Recepcionista IA per WhatsApp per a clíniques',
    texto:
      'Bot que gestiona cites contra Google Calendar, transcriu notes de veu i escala a humà quan detecta urgència. Facturació per ús.',
    sectores: ['salud'],
    tecnologias: ['chat', 'agentes'],
  },
  {
    id: 'chatbot-legal',
    familia: 'conversacional',
    titulo: 'Chatbot vertical legal/assegurador',
    texto:
      'Assistent amb RAG sobre normativa sectorial, condicionats i procediments interns. Citacions obligatòries a la font.',
    sectores: ['legal', 'b2b'],
    tecnologias: ['chat', 'rag', 'compliance'],
  },
  {
    id: 'agentes-backoffice',
    familia: 'agentes',
    titulo: 'Agents IA per a mòduls de back-office',
    texto:
      'Agents LangGraph que executen processos administratius del client, amb observabilitat predictiva i registre d’auditoria per al Reglament d’IA.',
    sectores: ['publico', 'b2b'],
    tecnologias: ['agentes', 'compliance'],
  },
  {
    id: 'agente-bi-conversacional',
    familia: 'agentes',
    titulo: 'BI conversacional amb text-to-SQL',
    texto:
      'Agent que consulta les teves bases de dades operatives i retorna indicadors en llenguatge natural. Validació semàntica, anti-injecció SQL.',
    sectores: ['b2b', 'publico'],
    tecnologias: ['agentes', 'datos'],
  },
  {
    id: 'agente-normativa',
    familia: 'agentes',
    titulo: 'Agent conversacional de consulta normativa',
    texto:
      'RAG sobre el BOE, la Llei de Contractes del Sector Públic i normativa sectorial. Distingeix vigent i derogada, cita articles.',
    sectores: ['legal', 'publico'],
    tecnologias: ['agentes', 'rag', 'compliance'],
  },
  {
    id: 'agentes-qa',
    familia: 'agentes',
    titulo: 'Agents de QA i testing automatitzat',
    texto:
      'Agents que generen tests, detecten regressions i validen patrons OWASP sobre codi heretat.',
    sectores: ['b2b'],
    tecnologias: ['agentes'],
  },
  {
    id: 'agente-observability',
    familia: 'agentes',
    titulo: 'Agent d’observabilitat predictiva',
    texto:
      'Monitora registres i mètriques, prediu incidències abans que passin, proposa remeis en llenguatge natural.',
    sectores: ['b2b'],
    tecnologias: ['agentes', 'datos'],
  },
  {
    id: 'agente-outreach',
    familia: 'agentes',
    titulo: 'Agent comercial de prospecció multicanal',
    texto:
      'Prospecció i seqüències per LinkedIn, correu i X amb personalització IA, detecció de respostes reals i supressió automàtica.',
    sectores: ['b2b'],
    tecnologias: ['agentes', 'chat'],
  },
  {
    id: 'agente-evaluaciones',
    familia: 'agentes',
    titulo: 'Agent de generació d’avaluacions',
    texto:
      'Qüestionaris a partir de text, PDF, URL o YouTube. Tipus test, obertes, relació, ordre. Anti-còpia i autocorrecció.',
    sectores: ['edu', 'b2b'],
    tecnologias: ['agentes', 'modelos'],
  },
  {
    id: 'rag-corporativo',
    familia: 'rag',
    titulo: 'RAG sobre documentació corporativa',
    texto:
      'Cerca semàntica amb control d’accés per rols sobre intranet, manuals i procediments. Cites a la font verificables.',
    sectores: ['b2b', 'publico'],
    tecnologias: ['rag'],
  },
  {
    id: 'rag-compliance',
    familia: 'rag',
    titulo: 'RAG multi-marc per a compliment europeu',
    texto:
      'Plataforma RGPD + NIS2 + EAA + Reglament d’IA que analitza la teva web i documents, mapeja obligacions i genera documentació obligatòria.',
    sectores: ['b2b', 'legal'],
    tecnologias: ['rag', 'compliance'],
  },
  {
    id: 'rag-transcripciones',
    familia: 'rag',
    titulo: 'RAG sobre transcripcions audiovisuals',
    texto:
      'Transcripció Whisper + cerca semàntica amb marques de temps sobre plens, classes o formació en vídeo.',
    sectores: ['publico', 'edu'],
    tecnologias: ['rag', 'modelos'],
  },
  {
    id: 'rag-busqueda-juridica',
    familia: 'rag',
    titulo: 'Cerca semàntica sobre jurisprudència',
    texto:
      'RAG sobre sentències i normativa amb validació de cites legals i comparativa entre cossos jurisprudencials.',
    sectores: ['legal', 'publico'],
    tecnologias: ['rag', 'compliance'],
  },
  {
    id: 'cdc-hibrido',
    familia: 'workflow',
    titulo: 'CDC i sincronització entre sistemes heterogenis',
    texto:
      'Captura de canvis basada en registres entre Oracle, SQL Server, PostgreSQL i Mongo amb entrega exactly-once. Sense impacte en producció.',
    sectores: ['b2b', 'publico'],
    tecnologias: ['datos'],
  },
  {
    id: 'itsm-publico',
    familia: 'workflow',
    titulo: 'ITSM i tiquets open source',
    texto:
      'Plataforma d’incidències amb SSO LDAP/SAML, 2FA, automatització condició-acció i portal web d’autoservei.',
    sectores: ['publico', 'b2b'],
    tecnologias: ['agentes'],
  },
  {
    id: 'comunicacion-ciudadana',
    familia: 'workflow',
    titulo: 'Comunicació ciutadana multicanal',
    texto:
      'WhatsApp + SMS amb segmentació geogràfica, generació de campanyes assistida per IA i seguiment auditable.',
    sectores: ['publico'],
    tecnologias: ['chat', 'agentes'],
  },
  {
    id: 'informes-automaticos',
    familia: 'workflow',
    titulo: 'Generació automàtica d’informes',
    texto:
      'Pipeline que extreu dades operatives i genera DOCX/PDF amb narrativa interpretativa i comparatives històriques.',
    sectores: ['publico', 'b2b'],
    tecnologias: ['agentes', 'datos'],
  },
  {
    id: 'memorias-licitaciones',
    familia: 'workflow',
    titulo: 'Memòries tècniques assistides per IA',
    texto:
      'RAG sobre l’històric de propostes guanyades + anàlisi del plec. Redueix el temps de redacció de 40-80 hores a 5-10.',
    sectores: ['b2b', 'publico'],
    tecnologias: ['agentes', 'rag'],
  },
  {
    id: 'governance-ai-act',
    familia: 'governance',
    titulo: 'Plataforma de governança del Reglament d’IA',
    texto:
      'Registre de sistemes d’IA, classificació per risc, avaluació d’impacte i monitoratge de deriva i biaix.',
    sectores: ['b2b', 'publico'],
    tecnologias: ['compliance'],
  },
  {
    id: 'auditoria-altai',
    familia: 'governance',
    titulo: 'Auditoria ALTAI d’IA fiable',
    texto:
      'Marc europeu d’avaluació dels 7 requisits ALTAI amb informe certificable per a licitacions públiques.',
    sectores: ['publico', 'b2b'],
    tecnologias: ['compliance'],
  },
  {
    id: 'multi-marco-compliance',
    familia: 'governance',
    titulo: 'Compliment multi-marc automatitzat',
    texto:
      'Escàner tècnic + generador de documents (declaració d’accessibilitat, política de privacitat, registre d’IA) per a pimes europees.',
    sectores: ['b2b', 'publico'],
    tecnologias: ['compliance', 'rag'],
  },
  {
    id: 'auditoria-asistentes',
    familia: 'seguridad',
    titulo: 'Auditoria d’assistents d’IA publicats',
    texto:
      'Escaneig dels chatbots amb IA d’una web: extracció de les instruccions internes, revelació de condicions comercials i fuga de dades, amb el fragment exacte que demostra cada troballa.',
    sectores: ['b2b', 'publico', 'salud', 'legal'],
    tecnologias: ['seguridad', 'chat'],
  },
  {
    id: 'red-team-llm',
    familia: 'seguridad',
    titulo: 'Proves adversàries sobre LLM i agents',
    texto:
      'Bateria de proves contra l’assistent i les eines que té connectades: injecció d’instruccions, jailbreak i sortida de guió, puntuades per un model jutge amb rúbrica.',
    sectores: ['b2b', 'publico'],
    tecnologias: ['seguridad', 'agentes'],
  },
  {
    id: 'guardarrailes',
    familia: 'seguridad',
    titulo: 'Barreres de protecció i filtres de sortida',
    texto:
      'Reescriptura del system prompt, filtres d’entrada i sortida, i límits explícits del que l’agent pot consultar o executar. Amb proves de regressió perquè no es torni a obrir.',
    sectores: ['b2b', 'salud', 'legal'],
    tecnologias: ['seguridad', 'chat', 'compliance'],
  },
  {
    id: 'hardening-rag',
    familia: 'seguridad',
    titulo: 'Blindatge del RAG i de les eines',
    texto:
      'Control d’accés per rol sobre les fonts, sanejament del context que entra al model i permisos mínims a cada eina connectada a l’agent.',
    sectores: ['b2b', 'publico', 'legal'],
    tecnologias: ['seguridad', 'rag'],
  },
  {
    id: 'vigilancia-ia',
    familia: 'seguridad',
    titulo: 'Vigilància contínua de l’assistent',
    texto:
      'Reescaneig periòdic i avís quan un canvi al prompt o una font nova torna a obrir una fuga que estava tancada.',
    sectores: ['b2b', 'publico', 'salud'],
    tecnologias: ['seguridad', 'compliance'],
  },
  {
    id: 'plataforma-seguros',
    familia: 'verticales',
    titulo: 'Plataforma IA corporativa per a assegurances',
    texto:
      'Catàleg intern de models (classificació, frau, OCR) amb governança, costos i observabilitat centralitzats.',
    sectores: ['legal', 'b2b'],
    tecnologias: ['modelos', 'agentes', 'compliance'],
  },
  {
    id: 'asistente-legal',
    familia: 'verticales',
    titulo: 'Assistent IA per al sector legal',
    texto:
      'Vertical jurídic amb RAG sobre jurisprudència, redacció assistida i validació humana al bucle.',
    sectores: ['legal', 'b2b'],
    tecnologias: ['rag', 'chat', 'compliance'],
  },
  {
    id: 'aceleradora-empresarial',
    familia: 'verticales',
    titulo: 'Acceleradora empresarial amb eines d’IA',
    texto:
      'Gestió de programes amb diagnòstic automàtic de startups, aparellament amb mentors i informes a finançadors europeus.',
    sectores: ['b2b', 'publico'],
    tecnologias: ['agentes', 'datos'],
  },
  {
    id: 'gemelo-digital',
    familia: 'verticales',
    titulo: 'Simulació digital i bessó d’aforament',
    texto:
      'Bessó digital per a escenaris d’afluència i esdeveniments massius. Avalua mesures abans d’implementar-les.',
    sectores: ['publico', 'turismo'],
    tecnologias: ['datos', 'modelos'],
  },
  {
    id: 'datos-sinteticos-salud',
    familia: 'verticales',
    titulo: 'Dades sintètiques per a recerca sanitària',
    texto:
      'Conjunts de dades sintètics que preserven propietats estadístiques sense informació personal. K-anonymity i differential privacy.',
    sectores: ['salud', 'b2b'],
    tecnologias: ['modelos', 'datos', 'compliance'],
  },
  {
    id: 'data-spaces',
    familia: 'verticales',
    titulo: 'Espais de dades federats (Gaia-X)',
    texto:
      'Espai sectorial conforme a IDS / Gaia-X per compartir dades entre organitzacions mantenint sobirania.',
    sectores: ['b2b', 'publico'],
    tecnologias: ['datos', 'compliance'],
  },
  {
    id: 'finetuning-vertical',
    familia: 'modelos',
    titulo: 'Fine-tuning de LLM de pes obert verticals',
    texto:
      'Ajust de Mistral o Llama sobre corpus propi del client. Compleix la sobirania de la UE i redueix el cost d’inferència.',
    sectores: ['b2b', 'legal', 'salud'],
    tecnologias: ['modelos'],
  },
  {
    id: 'forecasting-anomaly',
    familia: 'modelos',
    titulo: 'Previsió i detecció d’anomalies',
    texto:
      'Models de sèrie temporal (Prophet, ARIMA, deep learning) i detecció d’anomalies sobre mètriques operatives.',
    sectores: ['b2b', 'publico', 'turismo'],
    tecnologias: ['modelos', 'datos'],
  },
  {
    id: 'clasificacion-salud',
    familia: 'modelos',
    titulo: 'Classificació supervisada per a triatge clínic',
    texto:
      'Model de triatge simptomàtic per a assistent sanitari remot entrenat sobre dades sintètiques. Auditable i reproduïble.',
    sectores: ['salud', 'legal'],
    tecnologias: ['modelos', 'compliance'],
  },
  {
    id: 'ocr-custom',
    familia: 'modelos',
    titulo: 'OCR a mida per a documentació específica',
    texto:
      'Extracció estructurada de camps en pòlisses, factures, receptes o expedients. Reentrenament incremental amb retroacció.',
    sectores: ['legal', 'b2b', 'publico'],
    tecnologias: ['modelos', 'datos'],
  },
  {
    id: 'eval-benchmarking',
    familia: 'modelos',
    titulo: 'Avaluació i benchmarking de models',
    texto:
      'Marc reproduïble per comparar LLM i models clàssics sobre la teva tasca concreta amb mètriques pròpies, no genèriques.',
    sectores: ['b2b'],
    tecnologias: ['modelos', 'compliance'],
  },
];
