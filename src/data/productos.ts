/** Los siete SaaS propios. Se listan en /productos/; el footer enlaza a /productos/#<slug>. */
export interface Producto {
  slug: string;
  nombre: string;
  estado: 'En producción' | 'Beta' | 'Pre-MVP';
  categoria: string;
  descripcion: string;
  /** Sin url cuando el producto todavía no es público. */
  url?: string;
  /** Nombre del fichero dentro de public/img/productos/. */
  logo: string;
}

export const productos: Producto[] = [
  {
    slug: 'regulia',
    nombre: 'Regulia',
    estado: 'En producción',
    categoria: 'Compliance EU',
    descripcion: 'Compliance europeo automatizado para pymes.',
    url: 'https://regulia.app',
    logo: 'regulia.png',
  },
  {
    slug: 'contestia',
    nombre: 'Contestia',
    estado: 'En producción',
    categoria: 'HealthTech',
    descripcion: 'Recepcionista virtual por WhatsApp para clínicas.',
    url: 'https://contestia.co',
    logo: 'contestia.png',
  },
  {
    slug: 'instantexam',
    nombre: 'InstantExam',
    estado: 'En producción',
    categoria: 'EdTech',
    descripcion: 'Generador de exámenes con IA en 30 segundos.',
    url: 'https://instantexam.co',
    logo: 'instantexam.png',
  },
  {
    slug: 'canto',
    nombre: 'Canto',
    estado: 'En producción',
    categoria: 'DevTool',
    descripcion: 'Editor markdown para Claude Code.',
    url: 'https://marketplace.visualstudio.com/items?itemName=infinitelabs.canto-claude',
    logo: 'canto.png',
  },
  {
    slug: 'scoreflow',
    nombre: 'ScoreFlow',
    estado: 'Pre-MVP',
    categoria: 'B2B SaaS',
    descripcion: 'Craftsmanship Score para AI coding.',
    logo: 'scoreflow.svg',
  },
  {
    slug: 'contablia',
    nombre: 'Contablia',
    estado: 'Pre-MVP',
    categoria: 'FinTech',
    descripcion: 'Equipo virtual de 5 agentes para autónomos españoles.',
    logo: 'contablia.png',
  },
  {
    slug: 'swarmix',
    nombre: 'Swarmix',
    estado: 'Beta',
    categoria: 'Outreach',
    descripcion: 'Outreach IA multi-plataforma.',
    url: 'https://swarmix.co',
    logo: 'swarmix.png',
  },
];
