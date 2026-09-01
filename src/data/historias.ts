/** Las tres historias de éxito con caso completo en /historias-de-exito/<slug>/. */
export interface Historia {
  slug: string;
  /** Cifra principal, partida para el contador del titular. */
  cifra: { valor: number; sufijo: string };
  /** Etiqueta corta bajo la cifra, para la tarjeta del índice. */
  etiqueta: string;
  /** Resto del titular, detrás de la cifra. */
  titular: string;
  /** Quién es el cliente. */
  cliente: string;
  /** Sector al que pertenece, tal como se muestra. */
  sector: string;
  /** Una frase para la tarjeta del índice. */
  resumen: string;
  /** Tres métricas verificadas, en la fila bajo el titular. */
  metricas: { valor: string; etiqueta: string }[];
  situacion: string;
  solucion: string;
  como: string;
  resultados: string;
}

export const historias: Historia[] = [
  {
    slug: 'clinicas-dentales-barcelona',
    cifra: { valor: 38, sufijo: '%' },
    etiqueta: 'menos ausencias',
    titular: 'menos ausencias en consulta',
    cliente: 'Tres clínicas dentales en Barcelona',
    sector: 'Clínicas y salud',
    resumen:
      'Recepcionista virtual por WhatsApp en 4 semanas. 22 horas semanales liberadas y ROI en menos de un mes.',
    metricas: [
      { valor: '18% → 11%', etiqueta: 'tasa de ausencias' },
      { valor: '22h/sem', etiqueta: 'liberadas en recepción' },
      { valor: 'Menos de 1 mes', etiqueta: 'ROI total' },
    ],
    situacion:
      'Un grupo de tres clínicas dentales en Barcelona compartía el mismo problema: el 18% de los pacientes no acudía a sus citas sin previo aviso. La recepción contaba con tres personas dedicadas a las confirmaciones telefónicas, pero el ratio de localización era bajo y los huecos quedaban sin cubrir.',
    solucion:
      'Implantamos Contestia, nuestra recepcionista virtual por WhatsApp. El bot envía confirmación 24h antes con detalle de la visita, gestiona cambios proponiendo alternativas según agenda real, libera el hueco si el paciente cancela y avisa a lista de espera, y escala al equipo humano solo en casos clínicos sensibles. Integrado con Google Calendar y la ficha de paciente.',
    como: 'Cuatro semanas. Semana 1: auditoría de llamadas perdidas y mapeo de los 12 escenarios habituales. Semana 2: piloto en la clínica principal con volumen controlado. Semana 3: integración con calendar y ficha de paciente. Semana 4: despliegue en las dos clínicas restantes.',
    resultados:
      'Tres meses después del despliegue: tasa de ausencias del 18% al 11%. La recepción recuperó 22 horas semanales (equivalente a media jornada de una persona) que se redirigieron a atención presencial, gestión de presupuestos y captación. Satisfacción del paciente subió 0,8 puntos sobre 10. La inversión se amortizó en menos de un mes.',
  },
  {
    slug: 'distribuidora-industrial',
    cifra: { valor: 2, sufijo: 'h' },
    etiqueta: 'recuperadas / comercial · día',
    titular: 'recuperadas por comercial al día',
    cliente: 'Distribuidora industrial con 12 comerciales',
    sector: 'Distribución y logística',
    resumen:
      'Asistente automático en WhatsApp para recepción de pedidos. +25% capacidad de gestión sin incrementar plantilla.',
    metricas: [
      { valor: '2h/día', etiqueta: 'por comercial' },
      { valor: '+25%', etiqueta: 'capacidad sin nueva plantilla' },
      { valor: '0 errores', etiqueta: 'de transcripción' },
    ],
    situacion:
      'Una distribuidora de material industrial con 12 comerciales recibía pedidos por WhatsApp, llamada y correo. Los comerciales dedicaban las dos primeras horas del día a introducir manualmente los pedidos en el ERP. Más del 50% de la jornada se consumía en tareas administrativas, no en venta.',
    solucion:
      'Conectamos un asistente automatizado al número principal de WhatsApp. El sistema identifica al cliente por número y CIF, reconoce las referencias del catálogo, verifica stock y precio en tiempo real, genera el pedido en el ERP y notifica al comercial responsable. El comercial interviene únicamente en casos de excepción: cliente nuevo, producto fuera de catálogo o validación de descuento especial.',
    como: 'Seis semanas. Análisis de los patrones de pedido habitual, conexión con el ERP, entrenamiento del asistente con catálogo completo y nomenclatura cliente, validación de stock y precio en tiempo real, despliegue progresivo cliente a cliente con supervisión.',
    resultados:
      'Cada comercial recuperó entre 90 minutos y 2 horas diarias. La capacidad de gestión de pedidos aumentó un 25% sin incrementar plantilla. Los errores de transcripción manual desaparecieron. Los comerciales dedican esas horas a venta proactiva y atención de clientes premium.',
  },
  {
    slug: 'despacho-mercantil',
    cifra: { valor: 20, sufijo: 'h' },
    etiqueta: 'liberadas / socio · mes',
    titular: 'liberadas por socio sénior al mes',
    cliente: 'Despacho de derecho mercantil de 18 profesionales',
    sector: 'Despachos profesionales',
    resumen:
      'Generador de contratos sobre plantillas propias. Tiempo de respuesta a cliente de 3 días a 6 horas.',
    metricas: [
      { valor: '20h/mes', etiqueta: 'por socio sénior' },
      { valor: '3 días → 6h', etiqueta: 'tiempo de respuesta a cliente' },
      { valor: '5 plantillas', etiqueta: 'sistematizadas' },
    ],
    situacion:
      'Un despacho de derecho mercantil con 18 profesionales redactaba reiteradamente contratos similares. Cada socio sénior dedicaba entre 4 y 6 horas semanales a revisar y redactar contratos que, en esencia, eran variaciones de cinco plantillas. Tiempo que no facturaba a tarifa premium y que retrasaba la entrega a clientes urgentes.',
    solucion:
      'Desarrollamos un generador de contratos basado en las plantillas del despacho. El abogado responde a un cuestionario estructurado y el sistema entrega el contrato preparado para revisión. La búsqueda inteligente sobre el archivo histórico permite recuperar precedentes en segundos. El control siempre queda en el socio que firma.',
    como: 'Ocho semanas. Análisis de los cinco tipos de contrato más frecuentes, sistematización de las variables clave, entrenamiento con archivo histórico anonimizado, validación con casos reales del último semestre, despliegue progresivo con sesiones de calibración.',
    resultados:
      'Cada socio sénior recupera aproximadamente 20 horas mensuales, redirigidas a casos de mayor valor o a desarrollo de negocio. El tiempo medio de respuesta a clientes en contratos estándar pasó de 3 días a 6 horas. La satisfacción del cliente final mejoró notablemente.',
  },
];
