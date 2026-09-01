/** Los cinco casos del inicio. Tres tienen historia completa en /historias-de-exito/<slug>/. */
export interface Caso {
  /** Parte numérica de la cifra, para el contador. */
  valor: number;
  sufijo: string;
  etiqueta: string;
  meta: string;
  titulo: string;
  situacion: string;
  solucion: string;
  /** Slug de la historia completa, si existe. */
  historia?: string;
  sector: string;
}

export const casos: Caso[] = [
  {
    valor: 38,
    sufijo: '%',
    etiqueta: 'menos ausencias en consulta',
    meta: 'Clínicas dentales · Barcelona',
    titulo: 'Tres clínicas dentales compartían el mismo problema.',
    situacion:
      'Un número elevado de pacientes no acudía a sus citas sin previo aviso. La recepción no disponía del tiempo necesario para las llamadas de confirmación.',
    solucion:
      'En cuatro semanas implantamos Contestia, una recepcionista virtual por WhatsApp. La inversión se amortizó en menos de un mes.',
    historia: 'clinicas-dentales-barcelona',
    sector: 'clinicas',
  },
  {
    valor: 2,
    sufijo: 'h',
    etiqueta: 'recuperadas por comercial y día',
    meta: 'Distribución industrial · Catalunya',
    titulo: '12 comerciales perdían dos horas diarias en pedidos manuales.',
    situacion:
      'Los pedidos llegaban por WhatsApp, llamada y correo. Los comerciales dedicaban las dos primeras horas del día a transcribirlos al ERP.',
    solucion:
      'Conectamos un asistente de IA al WhatsApp principal: identifica al cliente, reconoce referencias, valida stock y genera el pedido. El comercial solo interviene en excepciones.',
    historia: 'distribuidora-industrial',
    sector: 'distribucion',
  },
  {
    valor: 20,
    sufijo: 'h',
    etiqueta: 'liberadas por socio sénior y mes',
    meta: 'Derecho mercantil · Madrid',
    titulo: 'Un despacho de 18 profesionales repetía cinco plantillas de contratos.',
    situacion:
      'Cada socio sénior dedicaba entre 4 y 6 horas semanales a redactar y revisar contratos que eran variaciones de las mismas plantillas.',
    solucion:
      'Desarrollamos un generador de contratos basado en sus plantillas. El tiempo medio de respuesta a clientes pasó de 3 días a 6 horas.',
    historia: 'despacho-mercantil',
    sector: 'despachos',
  },
  {
    valor: 45,
    sufijo: '%',
    etiqueta: 'menos tiempo en presupuestos',
    meta: 'Industria metalúrgica · Sabadell',
    titulo: 'Cada presupuesto industrial se demoraba 3 días en oficina técnica.',
    situacion:
      'El cliente enviaba planos por correo. La oficina técnica calculaba materiales, mano de obra y márgenes a mano. El presupuesto tardaba 3 días en salir.',
    solucion:
      'Implantamos un sistema de IA que interpreta el plano, calcula la estimación y propone márgenes. El equipo revisa y aprueba. Plazo: 4 horas.',
    sector: 'industria',
  },
  {
    valor: 3,
    sufijo: 'x',
    etiqueta: 'más alumnos atendidos en tutoría',
    meta: 'Formación profesional · Valencia',
    titulo: 'Un centro de FP tenía cola de un mes para tutorías personalizadas.',
    situacion:
      'Los formadores no daban abasto con las dudas individuales. Los alumnos esperaban hasta un mes para una tutoría, lo que afectaba a la tasa de aprobado.',
    solucion:
      'Construimos un asistente formativo entrenado con su material. Resuelve dudas 24/7 y escala a tutor humano solo en casos complejos. La cola se eliminó.',
    sector: 'formacion',
  },
];
