/**
 * Proyectos en curso vía Cupó IA d'ACCIÓ, en /proyectos-en-curso/.
 * Regla dura (encargo de Diego, 2026-09-08): ninguno de estos cupones está cerrado
 * todavía, todos siguen en diagnosis. NO se publican cifras de resultado, porcentajes
 * de mejora ni la palabra "certificado" — lo que se publica aquí se nos puede pedir
 * acreditado ante un órgano de contratación. Solo cliente (si autoriza), año, ámbito
 * y qué estamos haciendo ahora, en presente.
 *
 * Contenido de Martí (delivery-cupones), 2026-09-08. Ningún cliente ha dado
 * autorización explícita para usar su nombre real todavía, así que van anonimizados
 * por sector. Si Diego confirma nombre real de alguno, sustituir aquí ese `cliente`
 * por el nombre real (el resto del contenido no cambia).
 */
export interface ProyectoEnCurso {
  cliente: string;
  anio: string;
  ambito: string;
  queHacemos: string;
}

export const proyectosEnCurso: ProyectoEnCurso[] = [
  {
    cliente: 'Restauración colectiva y catering',
    anio: '2026',
    ambito: 'Alimentación · Barcelona',
    queHacemos:
      'Estamos mapeando cómo se decide la producción diaria, dónde se pierde información entre pedidos y reparto, y qué procesos administrativos son candidatos claros a automatización con IA.',
  },
  {
    cliente: 'Gestión de activos de energía renovable',
    anio: '2026',
    ambito: 'Energía',
    queHacemos:
      'Estamos revisando cómo se sigue el rendimiento de los activos, qué herramientas propias y de mercado se usan hoy, y dónde encaja la IA en la gestión diaria.',
  },
  {
    cliente: 'Construcción y mantenimiento naval especializado',
    anio: '2026',
    ambito: 'Naval',
    queHacemos:
      'Estamos analizando el recorrido de un proyecto de la oferta a la entrega, dónde se pierden horas y materiales, y qué datos de producción y mantenimiento existen.',
  },
  {
    cliente: 'Consultoría tecnológica y desarrollo de software',
    anio: '2026',
    ambito: 'Tecnología',
    queHacemos:
      'Estamos revisando las herramientas internas de gestión y soporte, y dónde la IA puede reducir el trabajo manual de revisión y clasificación.',
  },
  {
    cliente: 'Fabricación y envasado industrial para terceros',
    anio: '2026',
    ambito: 'Industria',
    queHacemos:
      'Estamos empezando a mapear los procesos de producción en sus distintas líneas de negocio, para identificar dónde aporta la IA en planificación y calidad.',
  },
  {
    cliente: 'Servicios técnicos de ingeniería',
    anio: '2026',
    ambito: 'Ingeniería',
    queHacemos: 'Diagnosis de oportunidades de IA en curso, entregada junto a un socio especializado.',
  },
];
