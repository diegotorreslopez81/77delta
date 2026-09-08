/**
 * Proyectos en curso vía Cupó IA d'ACCIÓ, en /proyectos-en-curso/.
 * Regla dura (encargo de Diego, 2026-09-08): ninguno de estos cupones está cerrado
 * todavía, todos siguen en diagnosis. NO se publican cifras de resultado, porcentajes
 * de mejora ni la palabra "certificado": lo que se publica aquí se nos puede pedir
 * acreditado ante un órgano de contratación. Solo cliente, año, ámbito y qué estamos
 * haciendo ahora, en presente.
 *
 * Contenido de Martí (delivery-cupones), 2026-09-08. Nombres reales autorizados por
 * Diego el mismo día (HQ #179, "Sí, nombres de empresa").
 */
export interface ProyectoEnCurso {
  cliente: string;
  anio: string;
  ambito: string;
  queHacemos: string;
}

export const proyectosEnCurso: ProyectoEnCurso[] = [
  {
    cliente: 'Nora Real Food',
    anio: '2026',
    ambito: 'Alimentación · Barcelona',
    queHacemos:
      'Estamos mapeando cómo se decide la producción diaria, dónde se pierde información entre pedidos y reparto, y qué procesos administrativos son candidatos claros a automatización con IA.',
  },
  {
    cliente: 'One Hub Energy',
    anio: '2026',
    ambito: 'Energía',
    queHacemos:
      'Estamos revisando cómo se sigue el rendimiento de los activos, qué herramientas propias y de mercado se usan hoy, y dónde encaja la IA en la gestión diaria.',
  },
  {
    cliente: 'Aresa Shipyard',
    anio: '2026',
    ambito: 'Naval',
    queHacemos:
      'Estamos analizando el recorrido de un proyecto de la oferta a la entrega, dónde se pierden horas y materiales, y qué datos de producción y mantenimiento existen.',
  },
  {
    cliente: 'Epic Solutions',
    anio: '2026',
    ambito: 'Tecnología',
    queHacemos:
      'Estamos revisando las herramientas internas de gestión y soporte, y dónde la IA puede reducir el trabajo manual de revisión y clasificación.',
  },
  {
    cliente: 'Zimeron',
    anio: '2026',
    ambito: 'Industria',
    queHacemos:
      'Estamos empezando a mapear los procesos de producción en sus distintas líneas de negocio, para identificar dónde aporta la IA en planificación y calidad.',
  },
  {
    cliente: 'IPAE',
    anio: '2026',
    ambito: 'Ingeniería',
    queHacemos: 'Diagnosis de oportunidades de IA en curso, entregada junto a un socio especializado.',
  },
];
