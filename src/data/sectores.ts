/** Los seis sectores. Las fichas de cada uno viven en la página /sectores/<slug>/. */
export interface Sector {
  slug: string;
  nombre: string;
  /** Una frase para la tarjeta de inicio y del índice. */
  resumen: string;
  /** Titular de la ficha del sector. */
  h1: string;
  /** Entradilla bajo el titular. */
  lead: string;
  /** Lo que nos cuentan cuando llegan a nosotros. */
  problema: string;
  /** Las cuatro líneas de transformación, numeradas 01-04 en la ficha. */
  soluciones: string[];
  /** Caso destacado del sector. `historia` enlaza con /historias-de-exito/<slug>/. */
  caso: {
    cifra: string;
    etiqueta: string;
    titulo: string;
    texto: string;
    historia?: string;
  };
  /** Titular del bloque de cierre de la ficha. */
  ctaTitulo: string;
}

export const sectores: Sector[] = [
  {
    slug: 'clinicas',
    nombre: 'Clínicas y centros de salud',
    resumen: 'Repensamos la recepción, la agenda, el seguimiento del paciente y la trazabilidad clínica.',
    h1: 'Recepción, agenda y seguimiento clínico repensados con IA',
    lead: 'Recepcionista virtual por WhatsApp, agenda inteligente y notas clínicas automáticas. Tu equipo deja de saturarse con confirmaciones y vuelve a centrarse en pacientes.',
    problema:
      'Las clínicas pierden ingresos por ausencias no avisadas. La recepción se satura con llamadas de confirmación. El profesional pierde tiempo en notas y seguimiento.',
    soluciones: [
      'Recepcionista virtual por WhatsApp que confirma citas y gestiona cambios',
      'Transcripción clínica asistida durante la consulta',
      'Seguimiento automatizado de pacientes en tratamiento',
      'Búsqueda inteligente sobre historiales clínicos',
    ],
    caso: {
      cifra: '38%',
      etiqueta: 'menos ausencias en consulta',
      titulo: 'Tres clínicas dentales de Barcelona',
      texto:
        'Implantamos Contestia en cuatro semanas. Las ausencias pasaron del 18% al 11%. La recepción recuperó 22 horas semanales. La inversión se amortizó en menos de un mes.',
      historia: 'clinicas-dentales-barcelona',
    },
    ctaTitulo: '¿Aplicamos esto a tu clínica?',
  },
  {
    slug: 'industria',
    nombre: 'Industria y talleres',
    resumen: 'Transformamos el ciclo de presupuesto, mantenimiento y control de calidad de procesos productivos.',
    h1: 'Mantenimiento, presupuestos y control de calidad con IA aplicada',
    lead: 'Predicción de averías antes de la parada, generación automática de presupuestos y QA visual con cámara. Para talleres y plantas que quieren reducir tiempo muerto.',
    problema:
      'Los presupuestos tardan días en salir. El mantenimiento es reactivo, no predictivo. El control de calidad consume horas del personal técnico.',
    soluciones: [
      'Generación de presupuestos a partir de planos y especificaciones',
      'Mantenimiento predictivo basado en sensores y telemetría',
      'Control de calidad por imagen con escalado a humano',
      'Búsqueda sobre documentación técnica y normativa industrial',
    ],
    caso: {
      cifra: '45%',
      etiqueta: 'menos tiempo en presupuestos',
      titulo: 'Taller metalúrgico en Sabadell',
      texto:
        'Pasamos de 3 días a 4 horas en el ciclo de presupuestación. El equipo técnico se centra en casos complejos. La tasa de aceptación subió porque los clientes reciben respuesta antes que de la competencia.',
    },
    ctaTitulo: '¿Aplicamos esto a tu taller?',
  },
  {
    slug: 'distribucion',
    nombre: 'Distribución y logística',
    resumen: 'Repensamos cómo se reciben los pedidos, cómo se valida el stock y cómo trabajan los comerciales.',
    h1: 'Pedidos, stock y atención comercial automatizados 24/7',
    lead: 'Procesamiento de pedidos por WhatsApp y email, sincronización de stock multicanal y atención comercial sin guardias humanas. Tu cliente no espera.',
    problema:
      'Los comerciales transcriben pedidos manualmente al ERP. Los clientes piden por WhatsApp, correo y llamada. Las validaciones de stock son lentas.',
    soluciones: [
      'Recepción automática de pedidos por WhatsApp con integración ERP',
      'Validación de stock, precio y crédito en tiempo real',
      'Asistente comercial 24/7 para clientes recurrentes',
      'Análisis predictivo de demanda y reposición',
    ],
    caso: {
      cifra: '2h',
      etiqueta: 'recuperadas por comercial al día',
      titulo: 'Distribuidora industrial con 12 comerciales',
      texto:
        'Conectamos un asistente al WhatsApp principal. Cada comercial recuperó dos horas diarias que pasaban transcribiendo pedidos. La capacidad de gestión aumentó un 25% sin incrementar plantilla.',
      historia: 'distribuidora-industrial',
    },
    ctaTitulo: '¿Aplicamos esto a tu empresa?',
  },
  {
    slug: 'despachos',
    nombre: 'Despachos profesionales',
    resumen: 'Liberamos horas del personal sénior automatizando documentos repetitivos y búsquedas sobre archivo.',
    h1: 'Recupera horas facturables automatizando tareas repetitivas',
    lead: 'Búsqueda jurisprudencial, redacción asistida de escritos y análisis de expedientes. Liberas las horas de bajo valor para concentrarte en estrategia y cliente.',
    problema:
      'El socio sénior redacta contratos repetitivos. El equipo busca jurisprudencia manualmente. Las reuniones se transcriben a mano.',
    soluciones: [
      'Generación de contratos a partir de plantillas del despacho',
      'Búsqueda inteligente sobre archivo histórico y jurisprudencia',
      'Transcripción y resumen automático de reuniones',
      'Asistente jurídico para primera consulta de cliente',
    ],
    caso: {
      cifra: '20h',
      etiqueta: 'liberadas por socio sénior al mes',
      titulo: 'Despacho de derecho mercantil de 18 profesionales',
      texto:
        'Desarrollamos un generador de contratos basado en sus plantillas. El tiempo medio de respuesta a clientes pasó de 3 días a 6 horas. Cada socio sénior recupera 20 horas mensuales para casos de mayor valor.',
      historia: 'despacho-mercantil',
    },
    ctaTitulo: '¿Aplicamos esto a tu despacho?',
  },
  {
    slug: 'administracion',
    nombre: 'Administración pública',
    resumen: 'Transformamos la atención ciudadana, la gestión documental y el análisis de expedientes históricos.',
    h1: 'Atención ciudadana, gestión documental y análisis de expedientes con IA',
    lead: 'Sede electrónica conversacional, clasificación documental masiva y análisis de expedientes. Cumplimiento ENS y datos procesados en territorio europeo.',
    problema:
      'La atención ciudadana satura el call center. Los expedientes históricos son difíciles de consultar. Los plenos generan actas extensas.',
    soluciones: [
      'Chatbot de atención ciudadana 24/7 con escalado a funcionario',
      'Búsqueda semántica sobre expedientes históricos',
      'Resumen y clasificación automática de actas de pleno',
      'Asistente para gestión documental interna',
    ],
    caso: {
      cifra: '60%',
      etiqueta: 'consultas resueltas sin escalado',
      titulo: 'Ayuntamiento de tamaño medio en Catalunya',
      texto:
        'Implantamos chatbot de atención ciudadana integrado con el catálogo de trámites. Seis de cada diez consultas se resuelven sin pasar por el equipo humano. El personal de atención dedica más tiempo a casos complejos.',
    },
    ctaTitulo: '¿Aplicamos esto a tu administración?',
  },
  {
    slug: 'formacion',
    nombre: 'Formación y recursos humanos',
    resumen: 'Cambiamos cómo se evalúa, cómo se hace el onboarding y cómo se analiza el progreso del alumno.',
    h1: 'Evaluación adaptativa, tutorías 24/7 y análisis de progreso',
    lead: 'Exámenes generados con IA en 30 segundos, tutorías automáticas y dashboard de progreso por alumno. Para academias, bootcamps y áreas de formación corporativa.',
    problema:
      'Los tutores no dan abasto con dudas individuales. Las evaluaciones consumen tiempo del profesorado. El onboarding de nuevos empleados es genérico.',
    soluciones: [
      'Asistente formativo entrenado con material del centro',
      'Evaluación adaptativa al nivel del alumno',
      'Onboarding personalizado por rol y experiencia',
      'Analítica de progreso en tiempo real',
    ],
    caso: {
      cifra: '3x',
      etiqueta: 'más alumnos atendidos en tutoría',
      titulo: 'Centro de FP con cola de un mes',
      texto:
        'Construimos un asistente formativo entrenado con el material del centro. Resuelve dudas 24/7 y escala a tutor humano solo en casos complejos. La cola de tutorías se eliminó y la tasa de aprobado subió cinco puntos.',
    },
    ctaTitulo: '¿Aplicamos esto a tu centro?',
  },
];
