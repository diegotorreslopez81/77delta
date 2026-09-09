/** Els sis sectors, versió catalana. Les fitxes viuen a /ca/sectores/<slug>/. */
export interface Sector {
  slug: string;
  nombre: string;
  /** Una frase per a la targeta d'inici i de l'índex. */
  resumen: string;
  /** Titular de la fitxa del sector. */
  h1: string;
  /** Entradeta sota el titular. */
  lead: string;
  /** El que ens expliquen quan arriben a nosaltres. */
  problema: string;
  /** Les quatre línies de transformació, numerades 01-04 a la fitxa. */
  soluciones: string[];
  /** Cas destacat del sector. `historia` enllaça amb /ca/historias-de-exito/<slug>/. */
  caso: {
    cifra: string;
    etiqueta: string;
    titulo: string;
    texto: string;
    historia?: string;
  };
  /** Titular del bloc de tancament de la fitxa. */
  ctaTitulo: string;
  /** Bloc opcional abans del tancament: una altra línia de negoci relacionada amb el sector. */
  aparte?: { eyebrow: string; titulo: string; texto: string; enlace: string; etiqueta: string };
}

export const sectores: Sector[] = [
  {
    slug: 'clinicas',
    nombre: 'Clíniques i centres de salut',
    resumen: 'Repensem la recepció, l’agenda, el seguiment del pacient i la traçabilitat clínica.',
    h1: 'Recepció, agenda i seguiment clínic repensats amb IA',
    lead: 'Recepcionista virtual per WhatsApp, agenda intel·ligent i notes clíniques automàtiques. El teu equip deixa de saturar-se amb confirmacions i torna a centrar-se en pacients.',
    problema:
      'Les clíniques perden ingressos per absències no avisades. La recepció se satura amb trucades de confirmació. El professional perd temps en notes i seguiment.',
    soluciones: [
      'Recepcionista virtual per WhatsApp que confirma cites i gestiona canvis',
      'Transcripció clínica assistida durant la consulta',
      'Seguiment automatitzat de pacients en tractament',
      'Cerca intel·ligent sobre historials clínics',
    ],
    caso: {
      cifra: '38%',
      etiqueta: 'menys absències a consulta',
      titulo: 'Tres clíniques dentals de Barcelona',
      texto:
        'Vam implantar Contestia en quatre setmanes. Les absències van passar del 18% a l’11%. La recepció va recuperar 22 hores setmanals. La inversió es va amortitzar en menys d’un mes.',
      historia: 'clinicas-dentales-barcelona',
    },
    ctaTitulo: 'Apliquem això a la teva clínica?',
  },
  {
    slug: 'industria',
    nombre: 'Indústria i tallers',
    resumen: 'Transformem el cicle de pressupost, manteniment i control de qualitat de processos productius.',
    h1: 'Manteniment, pressupostos i control de qualitat amb IA aplicada',
    lead: 'Predicció d’avaries abans de l’aturada, generació automàtica de pressupostos i QA visual amb càmera. Per a tallers i plantes que volen reduir temps mort.',
    problema:
      'Els pressupostos triguen dies a sortir. El manteniment és reactiu, no predictiu. El control de qualitat consumeix hores del personal tècnic.',
    soluciones: [
      'Generació de pressupostos a partir de plànols i especificacions',
      'Manteniment predictiu basat en sensors i telemetria',
      'Control de qualitat per imatge amb escalat a humà',
      'Cerca sobre documentació tècnica i normativa industrial',
    ],
    caso: {
      cifra: '45%',
      etiqueta: 'menys temps en pressupostos',
      titulo: 'Taller metal·lúrgic a Sabadell',
      texto:
        'Vam passar de 3 dies a 4 hores en el cicle de pressupostació. L’equip tècnic se centra en casos complexos. La taxa d’acceptació va pujar perquè els clients reben resposta abans que la competència.',
    },
    ctaTitulo: 'Apliquem això al teu taller?',
  },
  {
    slug: 'distribucion',
    nombre: 'Distribució i logística',
    resumen: 'Repensem com es reben les comandes, com es valida l’estoc i com treballen els comercials.',
    h1: 'Comandes, estoc i atenció comercial automatitzats 24/7',
    lead: 'Processament de comandes per WhatsApp i correu, sincronització d’estoc multicanal i atenció comercial sense guàrdies humanes. El teu client no espera.',
    problema:
      'Els comercials transcriuen comandes manualment a l’ERP. Els clients demanen per WhatsApp, correu i trucada. Les validacions d’estoc són lentes.',
    soluciones: [
      'Recepció automàtica de comandes per WhatsApp amb integració ERP',
      'Validació d’estoc, preu i crèdit en temps real',
      'Assistent comercial 24/7 per a clients recurrents',
      'Anàlisi predictiva de demanda i reposició',
    ],
    caso: {
      cifra: '2h',
      etiqueta: 'recuperades per comercial al dia',
      titulo: 'Distribuïdora industrial amb 12 comercials',
      texto:
        'Vam connectar un assistent al WhatsApp principal. Cada comercial va recuperar dues hores diàries que passava transcrivint comandes. La capacitat de gestió va augmentar un 25% sense incrementar plantilla.',
      historia: 'distribuidora-industrial',
    },
    ctaTitulo: 'Apliquem això a la teva empresa?',
  },
  {
    slug: 'despachos',
    nombre: 'Despatxos professionals',
    resumen: 'Alliberem hores del personal sènior automatitzant documents repetitius i cerques sobre arxiu.',
    h1: 'Recupera hores facturables automatitzant tasques repetitives',
    lead: 'Cerca jurisprudencial, redacció assistida d’escrits i anàlisi d’expedients. Allibera les hores de baix valor per centrar-te en estratègia i client.',
    problema:
      'El soci sènior redacta contractes repetitius. L’equip cerca jurisprudència manualment. Les reunions es transcriuen a mà.',
    soluciones: [
      'Generació de contractes a partir de plantilles del despatx',
      'Cerca intel·ligent sobre arxiu històric i jurisprudència',
      'Transcripció i resum automàtic de reunions',
      'Assistent jurídic per a la primera consulta de client',
    ],
    caso: {
      cifra: '20h',
      etiqueta: 'alliberades per soci sènior al mes',
      titulo: 'Despatx de dret mercantil de 18 professionals',
      texto:
        'Vam desenvolupar un generador de contractes basat en les seves plantilles. El temps mitjà de resposta a clients va passar de 3 dies a 6 hores. Cada soci sènior recupera 20 hores mensuals per a casos de més valor.',
      historia: 'despacho-mercantil',
    },
    ctaTitulo: 'Apliquem això al teu despatx?',
  },
  {
    slug: 'administracion',
    nombre: 'Administració pública',
    resumen: 'Transformem l’atenció ciutadana, la gestió documental i l’anàlisi d’expedients històrics.',
    h1: 'Atenció ciutadana, gestió documental i anàlisi d’expedients amb IA',
    lead: 'Seu electrònica conversacional, classificació documental massiva i anàlisi d’expedients. Compliment ENS i dades processades en territori europeu.',
    problema:
      'L’atenció ciutadana satura el call center. Els expedients històrics són difícils de consultar. Els plens generen actes extenses.',
    soluciones: [
      'Chatbot d’atenció ciutadana 24/7 amb escalat a funcionari',
      'Cerca semàntica sobre expedients històrics',
      'Resum i classificació automàtica d’actes de ple',
      'Assistent per a la gestió documental interna',
      'Formació de l’equip municipal en eines d’IA',
    ],
    caso: {
      cifra: '60%',
      etiqueta: 'consultes resoltes sense escalat',
      titulo: 'Ajuntament de mida mitjana a Catalunya',
      texto:
        'Vam implantar un chatbot d’atenció ciutadana integrat amb el catàleg de tràmits. Sis de cada deu consultes es resolen sense passar per l’equip humà. El personal d’atenció dedica més temps als casos complexos.',
    },
    ctaTitulo: 'Apliquem això a la teva administració?',
  },
  {
    slug: 'formacion',
    nombre: 'Formació i recursos humans',
    resumen: 'Canviem com s’avalua, com es fa l’acollida i com s’analitza el progrés de l’alumne.',
    h1: 'Avaluació adaptativa, tutories 24/7 i anàlisi de progrés',
    lead: 'Exàmens generats amb IA en 30 segons, tutories automàtiques i tauler de progrés per alumne. Per a acadèmies, bootcamps i àrees de formació corporativa.',
    problema:
      'Els tutors no donen l’abast amb dubtes individuals. Les avaluacions consumeixen temps del professorat. L’acollida de nous empleats és genèrica.',
    soluciones: [
      'Assistent formatiu entrenat amb material del centre',
      'Avaluació adaptativa al nivell de l’alumne',
      'Acollida personalitzada per rol i experiència',
      'Analítica de progrés en temps real',
    ],
    caso: {
      cifra: '3x',
      etiqueta: 'més alumnes atesos en tutoria',
      titulo: 'Centre de FP amb cua d’un mes',
      texto:
        'Vam construir un assistent formatiu entrenat amb el material del centre. Resol dubtes 24/7 i escala a tutor humà només en casos complexos. La cua de tutories es va eliminar i la taxa d’aprovat va pujar cinc punts.',
    },
    ctaTitulo: 'Apliquem això al teu centre?',
    aparte: {
      eyebrow: 'També per a recursos humans',
      titulo: 'Formació en salut per a la teva plantilla',
      texto:
        'Corpora és la nostra línia de formacions en salut per a empreses: ergonomia del lloc, dolor d’esquena i coll, micropauses, menopausa a la feina, longevitat i descans. Impartida per una fisioterapeuta i docent universitària, presencial o online, en castellà i català. Bonificable per FUNDAE.',
      enlace: 'https://corpora.cat',
      etiqueta: 'Veure el catàleg a corpora.cat →',
    },
  },
];
