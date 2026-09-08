/**
 * Contingut dels serveis, en català. Mateixa estructura que servicios.ts
 * (castellà); el comparteixen l'índex /ca/servicios/ i les pàgines de cada
 * servei, perquè el text visqui en un sol lloc.
 */
export const resumen = [
  {
    etiqueta: 'Punt de partida',
    titulo: 'Diagnòstic',
    pie: '30 minuts · gratuït',
    ruta: '/servicios/diagnostico/',
  },
  {
    etiqueta: 'Projecte puntual',
    titulo: 'Transformació operativa',
    pie: 'Implantació, integració i capacitació',
    ruta: '/servicios/transformacion/',
  },
  {
    etiqueta: 'Acompanyament continu',
    titulo: 'Soci tecnològic',
    pie: 'Criteri qualificat cada mes',
    ruta: '/servicios/partner/',
  },
  {
    etiqueta: 'Seguretat',
    titulo: 'Auditoria d’IA',
    pie: 'Escaneig gratuït dels teus assistents',
    ruta: '/servicios/seguridad-ia/',
  },
];

export const queObtienes = [
  {
    titulo: 'Identificació d’àrees amb potencial',
    texto: 'Mapatge preliminar de processos on la IA pot aportar valor mesurable a la teva empresa.',
  },
  {
    titulo: 'Estat inicial documentat',
    texto: 'Diagnòstic de com està la teva organització avui en termes de processos, dades i maduresa digital.',
  },
  {
    titulo: 'Pla de treball recomanat',
    texto: 'Full de ruta prioritzat: què fer primer, què després, amb terminis estimats.',
  },
  {
    titulo: 'Pressupost orientatiu',
    texto: 'Estimació honesta de la inversió necessària per fase, sense tarifes inflades ni lletra petita.',
  },
  {
    titulo: 'Recomanació de tecnologies',
    texto: 'Quines eines, models i arquitectura tenen sentit per al teu cas concret.',
  },
];

export const queIncluye = [
  {
    titulo: 'Implantació clau en mà',
    texto: 'Construïm les solucions des de zero o adaptem les nostres al teu cas concret.',
  },
  {
    titulo: 'Integració amb els teus sistemes',
    texto: 'Connectem amb el teu ERP, CRM, WhatsApp, correu, agenda i qualsevol eina que ja facis servir.',
  },
  {
    titulo: 'Automatització de processos',
    texto: 'Dissenyem el flux end-to-end, no només el model. Human-in-the-loop per defecte.',
  },
  {
    titulo: 'Capacitació del teu equip',
    texto: 'Formació a comercials, administratius i operacions. Amb casos pràctics del teu dia a dia.',
  },
  {
    titulo: 'Documentació i traspàs',
    texto: 'En acabar el projecte et quedes amb codi, claus, dades i manuals. Independència real.',
  },
  {
    titulo: 'SLA i suport mensual',
    texto: 'Acord de nivell de servei inclòs durant el primer cicle. Temps de resposta compromesos.',
  },
];

export const fases = [
  {
    n: '01',
    titulo: 'Pilot',
    texto: 'Versió mínima funcionant en un procés acotat. Validem hipòtesis abans d’escalar.',
  },
  {
    n: '02',
    titulo: 'Integració',
    texto: 'Connexió amb els teus sistemes (ERP, CRM, WhatsApp, agenda). Dades fluint end-to-end.',
  },
  {
    n: '03',
    titulo: 'Desplegament',
    texto: 'Sortida a producció i formació al teu equip. Mesurament des del primer dia.',
  },
  {
    n: '04',
    titulo: 'Tancament',
    texto: 'Lliurament de codi, claus, dades i documentació. Independència real.',
  },
];

export const paquetes = [
  {
    nombre: 'Light',
    precio: '1.000 €/mes',
    horas: '10 hores mensuals',
    pie: '100 €/hora · ideal per començar',
  },
  {
    nombre: 'Standard',
    precio: '2.000 €/mes',
    horas: '25 hores mensuals',
    pie: '80 €/hora · empreses en fase activa',
  },
  {
    nombre: 'Plus',
    precio: '5.000 €/mes',
    horas: '75 hores mensuals',
    pie: '66 €/hora · transformació intensa',
  },
];

export const ritmo = [
  { n: '01', titulo: 'Revisió', texto: 'mensual conjunta' },
  { n: '02', titulo: 'Interlocució', texto: 'amb els teus proveïdors' },
  { n: '03', titulo: 'Full de ruta', texto: 'trimestral' },
  { n: '04', titulo: 'Auditoria', texto: 'SaaS i programari' },
];

export const cadaMes = [
  {
    titulo: 'Revisió de propostes de proveïdors',
    texto: 'Filtrem el que arriba a la teva taula: descartem el que no aporta, negociem el que sí.',
  },
  {
    titulo: 'Interlocució amb consultores i agències',
    texto: 'T’acompanyem en reunions tècniques perquè no et portin per on no vols anar.',
  },
  {
    titulo: 'Full de ruta d’IA actualitzat',
    texto: 'Cada trimestre revisem prioritats, inversions i mètriques. El full de ruta és viu.',
  },
  {
    titulo: 'Auditoria de programari i SaaS',
    texto: 'Identifiquem solapaments, despeses no usades i oportunitats de consolidació.',
  },
  {
    titulo: 'Canal directe Slack/WhatsApp',
    texto: 'Disponibilitat immediata per a consultes puntuals sense esperar la reunió mensual.',
  },
];

export const recorrido = [
  {
    n: '01',
    titulo: 'Diagnòstic',
    texto: '30 minuts d’entrevista. Et lliurem proposta amb estat inicial, pla de treball i pressupost.',
  },
  {
    n: '02',
    titulo: 'Decisió',
    texto: 'Tu decideixes el següent pas. Cap compromís fins a signar l’abast del projecte.',
  },
  {
    n: '03',
    titulo: 'Execució',
    texto: 'Implantem, integrem i formem el teu equip. Pilot controlat abans del desplegament complet.',
  },
  {
    n: '04',
    titulo: 'Acompanyament',
    texto:
      'Si vols, continuem com el teu soci tecnològic per escalar i mantenir la transformació.',
  },
];

export const faq = [
  {
    pregunta: 'El diagnòstic és realment gratuït? Quin és el truc?',
    respuesta:
      'No hi ha truc. És el nostre punt d’entrada. Si després del diagnòstic no decideixes contractar res, et quedes amb la proposta i el pla de treball. És informació valuosa per a tu i un cost raonable per a nosaltres si el comparem amb un projecte fallit per no haver entès el cas.',
  },
  {
    pregunta: 'Per què no publiqueu preus fixos del servei de transformació?',
    respuesta:
      'Perquè cada cas és diferent. Un projecte d’automatització conversacional en una clínica no s’assembla a un de cerca intel·ligent en un despatx. Les tarifes tancades obliguen a inflar el preu en els casos complexos o a acceptar pèrdues en els casos petits. Preferim cotitzar cada projecte després d’entendre’l.',
  },
  {
    pregunta: 'En quant de temps veig resultats mesurables?',
    respuesta:
      'Depèn del projecte, però per norma general entre 4 i 12 setmanes des de l’inici. Treballem sempre per fites curtes amb mètriques verificables, perquè vegis resultats abans de comprometre recursos al desplegament complet.',
  },
  {
    pregunta: 'Les meves dades estan segures?',
    respuesta:
      'Tota la nostra infraestructura és a la Unió Europea (Hetzner Frankfurt i proveïdors UE). Complim el RGPD per defecte, sense dependències de tercers països. Si treballem amb sectors regulats (salut, legal, finances), afegim les mesures específiques que el teu sector requereixi.',
  },
  {
    pregunta: 'Què passa si vull deixar de treballar amb vosaltres?',
    respuesta:
      'En finalitzar qualsevol projecte et lliurem codi, claus d’accés, dades i documentació. La teva empresa conserva tot l’actiu construït. El soci tecnològic es revisa trimestralment i el pots ajustar o pausar segons evolucioni la teva empresa.',
  },
];
