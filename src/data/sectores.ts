/** Los seis sectores. Las fichas de cada uno viven en la página /sectores/<slug>/. */
export interface Sector {
  slug: string;
  nombre: string;
  /** Una frase para la tarjeta de inicio y del índice. */
  resumen: string;
}

export const sectores: Sector[] = [
  {
    slug: 'clinicas',
    nombre: 'Clínicas y centros de salud',
    resumen: 'Repensamos la recepción, la agenda, el seguimiento del paciente y la trazabilidad clínica.',
  },
  {
    slug: 'industria',
    nombre: 'Industria y talleres',
    resumen: 'Transformamos el ciclo de presupuesto, mantenimiento y control de calidad de procesos productivos.',
  },
  {
    slug: 'distribucion',
    nombre: 'Distribución y logística',
    resumen: 'Repensamos cómo se reciben los pedidos, cómo se valida el stock y cómo trabajan los comerciales.',
  },
  {
    slug: 'despachos',
    nombre: 'Despachos profesionales',
    resumen: 'Liberamos horas del personal sénior automatizando documentos repetitivos y búsquedas sobre archivo.',
  },
  {
    slug: 'administracion',
    nombre: 'Administración pública',
    resumen: 'Transformamos la atención ciudadana, la gestión documental y el análisis de expedientes históricos.',
  },
  {
    slug: 'formacion',
    nombre: 'Formación y recursos humanos',
    resumen: 'Cambiamos cómo se evalúa, cómo se hace el onboarding y cómo se analiza el progreso del alumno.',
  },
];
