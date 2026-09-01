/** Logos de la barra de confianza. Ficheros en public/img/logos/. */
export interface Logo {
  src: string;
  alt: string;
  href: string;
  /** `wide`: logotipos apaisados; `tall`: cuadrados o verticales. */
  forma?: 'wide' | 'tall';
}

export const instituciones: Logo[] = [
  { src: 'accio.png', alt: 'ACCIÓ', href: 'https://www.accio.gencat.cat' },
  { src: 'barcelona-activa.png', alt: 'Barcelona Activa', href: 'https://barcelonactiva.cat', forma: 'tall' },
  { src: 'futurium.svg', alt: 'Futurium, Comisión Europea', href: 'https://futurium.ec.europa.eu' },
  { src: 'gencat.svg', alt: 'Generalitat de Catalunya', href: 'https://www.gencat.cat' },
  { src: 'gov-dubai.svg', alt: 'Gobierno de Dubái', href: 'https://www.dubai.gov.ae' },
  { src: 'i2cat.svg', alt: 'i2CAT', href: 'https://i2cat.net', forma: 'wide' },
  { src: 'alastria.png', alt: 'Alastria', href: 'https://alastria.io' },
  { src: 'all-tech-is-human.png', alt: 'All Tech Is Human', href: 'https://alltechishuman.org', forma: 'tall' },
  { src: 'sabadell.png', alt: 'Banc Sabadell', href: 'https://www.bancsabadell.com', forma: 'wide' },
  { src: 'eba.png', alt: 'Euro Banking Association', href: 'https://www.eba-online.org' },
  { src: 'interledger.svg', alt: 'Interledger Foundation', href: 'https://interledger.org' },
  { src: 'mydata.png', alt: 'MyData Global', href: 'https://www.mydata.org' },
  { src: 'open-society.png', alt: 'Open Society Foundations', href: 'https://www.opensocietyfoundations.org' },
  { src: 'peninsula.png', alt: 'Peninsula', href: 'https://peninsula.es', forma: 'wide' },
];

export const tecnologia: Logo[] = [
  { src: 'anthropic.svg', alt: 'Anthropic', href: 'https://www.anthropic.com', forma: 'wide' },
  { src: 'aws.svg', alt: 'Amazon Web Services', href: 'https://aws.amazon.com', forma: 'wide' },
  { src: 'cloudflare.svg', alt: 'Cloudflare', href: 'https://www.cloudflare.com', forma: 'wide' },
  { src: 'deepseek.svg', alt: 'DeepSeek', href: 'https://www.deepseek.com' },
  { src: 'gemini.svg', alt: 'Google Gemini', href: 'https://gemini.google.com' },
  { src: 'googlecloud.svg', alt: 'Google Cloud', href: 'https://cloud.google.com', forma: 'wide' },
  { src: 'hetzner.svg', alt: 'Hetzner Cloud', href: 'https://www.hetzner.com' },
  { src: 'huggingface.svg', alt: 'Hugging Face', href: 'https://huggingface.co', forma: 'wide' },
  { src: 'mistral.svg', alt: 'Mistral AI', href: 'https://mistral.ai', forma: 'wide' },
  { src: 'openai.svg', alt: 'OpenAI', href: 'https://openai.com', forma: 'wide' },
];
