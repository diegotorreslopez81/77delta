/**
 * Contenido de los servicios. Lo comparten el índice /servicios/ y las páginas
 * de cada servicio, para que la copia viva en un solo sitio.
 */
export const resumen = [
  {
    etiqueta: 'Punto de partida',
    titulo: 'Diagnóstico',
    pie: '30 minutos · gratuito',
    ruta: '/servicios/diagnostico/',
  },
  {
    etiqueta: 'Proyecto puntual',
    titulo: 'Transformación operativa',
    pie: 'Implantación, integración y capacitación',
    ruta: '/servicios/transformacion/',
  },
  {
    etiqueta: 'Acompañamiento continuo',
    titulo: 'Partner tecnológico',
    pie: 'Criterio cualificado cada mes',
    ruta: '/servicios/partner/',
  },
  {
    etiqueta: 'Seguridad',
    titulo: 'Auditoría de IA',
    pie: 'Escaneo gratuito de tus asistentes',
    ruta: '/servicios/seguridad-ia/',
  },
];

export const queObtienes = [
  {
    titulo: 'Identificación de áreas con potencial',
    texto: 'Mapeo preliminar de procesos donde la IA puede aportar valor medible en tu empresa.',
  },
  {
    titulo: 'Estado inicial documentado',
    texto: 'Diagnóstico de cómo está tu organización hoy en términos de procesos, datos y madurez digital.',
  },
  {
    titulo: 'Plan de trabajo recomendado',
    texto: 'Hoja de ruta priorizada: qué hacer primero, qué después, con plazos estimados.',
  },
  {
    titulo: 'Presupuesto orientativo',
    texto: 'Estimación honesta de la inversión necesaria por fase, sin tarifas inflacionadas ni letra pequeña.',
  },
  {
    titulo: 'Recomendación de tecnologías',
    texto: 'Qué herramientas, modelos y arquitectura tienen sentido para tu caso concreto.',
  },
];

export const queIncluye = [
  {
    titulo: 'Implantación llave en mano',
    texto: 'Construimos las soluciones desde cero o adaptamos las nuestras a tu caso concreto.',
  },
  {
    titulo: 'Integración con tus sistemas',
    texto: 'Conectamos con tu ERP, CRM, WhatsApp, correo, agenda y cualquier herramienta que ya uses.',
  },
  {
    titulo: 'Automatización de procesos',
    texto: 'Diseñamos el flujo end-to-end, no solo el modelo. Human-in-the-loop por defecto.',
  },
  {
    titulo: 'Capacitación de tu equipo',
    texto: 'Formación a comerciales, administrativos y operaciones. Con casos prácticos de tu día a día.',
  },
  {
    titulo: 'Documentación y traspaso',
    texto: 'Al final del proyecto te quedas con código, claves, datos y manuales. Independencia real.',
  },
  {
    titulo: 'SLA y soporte mensual',
    texto: 'Acuerdo de nivel de servicio incluido durante el primer ciclo. Tiempos de respuesta comprometidos.',
  },
];

export const fases = [
  {
    n: '01',
    titulo: 'Piloto',
    texto: 'Versión mínima funcionando en un proceso acotado. Validamos hipótesis antes de escalar.',
  },
  {
    n: '02',
    titulo: 'Integración',
    texto: 'Conexión con tus sistemas (ERP, CRM, WhatsApp, agenda). Datos fluyendo end-to-end.',
  },
  {
    n: '03',
    titulo: 'Despliegue',
    texto: 'Salida a producción y formación a tu equipo. Medición desde el día uno.',
  },
  {
    n: '04',
    titulo: 'Cierre',
    texto: 'Entrega de código, claves, datos y documentación. Independencia real.',
  },
];

export const paquetes = [
  {
    nombre: 'Light',
    precio: '1.000 €/mes',
    horas: '10 horas mensuales',
    pie: '100 €/hora · ideal para arrancar',
  },
  {
    nombre: 'Standard',
    precio: '2.000 €/mes',
    horas: '25 horas mensuales',
    pie: '80 €/hora · empresas en fase activa',
  },
  {
    nombre: 'Plus',
    precio: '5.000 €/mes',
    horas: '75 horas mensuales',
    pie: '66 €/hora · transformación intensa',
  },
];

export const ritmo = [
  { n: '01', titulo: 'Revisión', texto: 'mensual conjunta' },
  { n: '02', titulo: 'Interlocución', texto: 'con tus proveedores' },
  { n: '03', titulo: 'Hoja de ruta', texto: 'trimestral' },
  { n: '04', titulo: 'Auditoría', texto: 'SaaS y software' },
];

export const cadaMes = [
  {
    titulo: 'Revisión de propuestas de proveedores',
    texto: 'Filtramos lo que llega a tu mesa: descartamos lo que no aporta, negociamos lo que sí.',
  },
  {
    titulo: 'Interlocución con consultoras y agencias',
    texto: 'Te acompañamos en reuniones técnicas para que no te lleven por donde no quieres ir.',
  },
  {
    titulo: 'Hoja de ruta IA actualizada',
    texto: 'Cada trimestre revisamos prioridades, inversiones y métricas. La hoja de ruta vive.',
  },
  {
    titulo: 'Auditoría de software y SaaS',
    texto: 'Identificamos solapamientos, gastos no usados y oportunidades de consolidación.',
  },
  {
    titulo: 'Canal directo Slack/WhatsApp',
    texto: 'Disponibilidad inmediata para consultas puntuales sin esperar a la reunión mensual.',
  },
];

export const recorrido = [
  {
    n: '01',
    titulo: 'Diagnóstico',
    texto: '30 minutos de entrevista. Te entregamos propuesta con estado inicial, plan de trabajo y presupuesto.',
  },
  {
    n: '02',
    titulo: 'Decisión',
    texto: 'Tú decides el siguiente paso. Ningún compromiso hasta firmar el alcance del proyecto.',
  },
  {
    n: '03',
    titulo: 'Ejecución',
    texto: 'Implantamos, integramos y formamos a tu equipo. Piloto controlado antes del despliegue completo.',
  },
  {
    n: '04',
    titulo: 'Acompañamiento',
    texto:
      'Si quieres, continuamos como tu Partner tecnológico para escalar y mantener la transformación.',
  },
];

export const faq = [
  {
    pregunta: '¿El diagnóstico realmente es gratuito? ¿Cuál es el truco?',
    respuesta:
      'No hay truco. Es nuestro punto de entrada. Si tras el diagnóstico no decides contratar nada, te quedas con la propuesta y plan de trabajo. Es información valiosa para ti y un coste razonable para nosotros si lo comparamos con un proyecto fallido por no haber entendido el caso.',
  },
  {
    pregunta: '¿Por qué no publicáis precios fijos del servicio de transformación?',
    respuesta:
      'Porque cada caso es distinto. Un proyecto de automatización conversacional en una clínica no se parece a uno de búsqueda inteligente en un despacho. Las tarifas cerradas obligan a inflar precio para los casos complejos o a aceptar pérdidas en los casos pequeños. Preferimos cotizar cada proyecto tras entenderlo.',
  },
  {
    pregunta: '¿En cuánto tiempo veo resultados medibles?',
    respuesta:
      'Depende del proyecto, pero por norma general entre 4 y 12 semanas desde el inicio. Trabajamos siempre por hitos cortos con métricas verificables, para que veas resultados antes de comprometer recursos al despliegue completo.',
  },
  {
    pregunta: '¿Mis datos están seguros?',
    respuesta:
      'Toda nuestra infraestructura está en la Unión Europea (Hetzner Frankfurt y proveedores EU). Cumplimos RGPD por defecto, sin dependencias de terceros países. Si trabajamos con sectores regulados (salud, legal, finanzas), añadimos las medidas específicas que tu sector requiera.',
  },
  {
    pregunta: '¿Qué pasa si quiero dejar de trabajar con vosotros?',
    respuesta:
      'Al finalizar cualquier proyecto te entregamos código, claves de acceso, datos y documentación. Tu empresa conserva todo el activo construido. El Partner tecnológico se revisa trimestralmente y puedes ajustarlo o pausarlo según evolucione tu empresa.',
  },
];
