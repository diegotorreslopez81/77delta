# 77 Delta · guía de estilo

> Fuente de verdad de la identidad visual. Aplica a la web, a los documentos de cliente (fichas, planes, guiones, informes) y a cualquier artefacto HTML. Versión 1 · septiembre 2026.

## 1. La marca

- **Nombre:** 77 Delta. Monograma `77Δ`. Nunca se añade una palabra de categoría (Consulting, Labs, AI, Solutions, Studio).
- **El 77 no se explica.** Nunca, en ningún documento.
- **La Δ es una letra, femenina:** *la* delta. Nunca *el* delta.
- **Marca única.** En un documento de 77 Delta no aparecen otras marcas ni logotipos propios anteriores.
- **Datos legales y fiscales:** los que correspondan al documento. No se tocan al aplicar la identidad visual.

### Monograma en HTML

Sora no tiene la letra Δ: si se escribe como texto, cada sistema la pinta con una fuente distinta. **La Δ va siempre como SVG inline** con este trazado (la misma geometría que la web y el favicon):

```html
<span class="monograma">77<svg viewBox="0 0 745 730" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" transform="translate(0 730)" d="M721.2 0L24 0L277.3-730L468.9-730L721.2 0M369.9-566.4L224.4-124L521.8-124L375.8-566.4"/></svg></span>
```

```css
.monograma{display:inline-flex;align-items:baseline;font-family:'Sora',system-ui,sans-serif;font-weight:700;letter-spacing:-.055em;line-height:1}
.monograma svg{height:.73em;width:auto;color:#A7781B}
```

Sobre fondo oscuro el `77` va en marfil `#EDEAE3`; sobre fondo claro, en tinta del logo `#060B14`. La Δ siempre en oro `#A7781B`. Ficheros: `brand/monograma.svg`, `brand/monograma-positivo.svg`, `brand/delta.svg`, `brand/favicon.svg`, `brand/png/`.

## 2. Color

Tema claro por defecto. Un solo acento: el oro.

| Token | Hex | Uso |
|---|---|---|
| `papel` | `#F3EEE4` | Fondo de página |
| `panel` | `#FAF7F0` | Tarjetas, franjas alternas, campos de formulario |
| `tinta` | `#0A1628` | Texto principal. Es azul marino, no negro |
| `tinta-2` | `#26354D` | Texto de apoyo con peso |
| `pizarra` | `#5C6879` | Texto secundario |
| `pizarra-tenue` | `#9AA3B0` | Pies, metadatos |
| `linea` | `#E0D9CB` | Bordes y separadores sobre papel |
| `marino` | `#06101F` | Fondo de cabecera, hero, cierres y pie |
| `marfil` | `#EDEAE3` | Texto sobre marino |
| `pizarra-clara` | `#AEB8C6` | Texto secundario sobre marino |
| `linea-oscura` | `#1E2B3B` | Separadores sobre marino |
| `oro` | `#A7781B` | Acento: botones, cifras, énfasis en titulares |
| `oro-oscuro` | `#8A6216` | Oro como texto pequeño sobre papel (contraste 5,2:1) |
| `oro-luz` | `#D4A03A` | Oro como texto o icono sobre marino (9:1) |

Reglas:

- **El oro es acento, nunca relleno.** Por debajo del 5 % de la superficie: botones, una cifra, una palabra del titular, iconos, líneas.
- **Oro plano.** Nunca degradado ni efecto metálico.
- **Nunca un segundo color de acento.** Los colores semánticos (error, aviso, éxito) existen solo en interfaces que los necesiten, apagados y sin competir: error `#A8392C`, aviso = oro, éxito `#3F6B4A`.
- **Sin blanco puro ni negro puro.** El claro es papel o panel; el oscuro es marino.
- **Texto pequeño en oro** solo con `oro-oscuro` (sobre papel) u `oro-luz` (sobre marino). El oro base no llega al contraste mínimo en texto pequeño.

### Tema oscuro (si el documento lo ofrece)

| Token | Hex |
|---|---|
| fondo | `#06101F` |
| superficie | `#0C1A30` |
| superficie elevada | `#122238` |
| texto | `#EDEAE3` |
| texto secundario | `#AEB8C6` |
| apagado | `#8794A6` |
| línea | `#1E2B3B` |
| línea fuerte | `#2C3B52` |
| acento | `#D4A03A` |
| acento texto | `#E2B65A` |
| acento suave | `rgba(212,160,58,.14)` |

## 3. Tipografía

Google Fonts (las tres): `https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap`

| Rol | Familia | Notas |
|---|---|---|
| Titulares y marca | **Sora** | 600 para titulares, 700 para el monograma y el énfasis en oro. Sin cursiva: Sora no la tiene; el énfasis se hace con peso 700 y color oro |
| Texto | **IBM Plex Sans** | 400 cuerpo, 500 y 600 para etiquetas y botones |
| Etiquetas de sección y datos | **IBM Plex Mono** | Mayúsculas, 11 a 12 px, `letter-spacing: .14em`, color `oro-oscuro` |

Escala orientativa: h1 `clamp(36px,4.2vw,58px)`, h2 `clamp(28px,3.4vw,44px)`, h3 20 a 24 px, cuerpo 16 px con interlineado 1.55, texto pequeño 13 a 14 px. Titulares con `letter-spacing: -.025em` y `line-height: 1.08`.

**Sin serif.** Fraunces, Georgia y similares quedan fuera. Sin Inter ni Public Sans: se sustituyen por IBM Plex Sans.

## 4. Componentes

- **Botón principal:** fondo `oro`, texto `marfil`, radio 10 px, peso 600, 15 px. Al pasar el ratón cambia al inverso del fondo: sobre claro pasa a `marino`; sobre marino pasa a `marfil` con texto `marino`. Todos los botones de acción son ocre; no hay botones de otro color.
- **Botón secundario:** contorno 1 px `tinta` al 20 %, texto `tinta`, mismo radio. Sobre marino: contorno `marfil` al 30 %, texto `marfil`.
- **Etiqueta de sección (eyebrow):** Plex Mono, mayúsculas, 11 px, `letter-spacing .14em`, `oro-oscuro`.
- **Tarjetas:** fondo `panel`, borde 1 px `linea`, radio 12 px, padding 24 a 32 px. Sombra solo al pasar el ratón: `0 16px 40px rgba(6,16,31,.08)`.
- **Cabecera:** fondo `marino`, monograma en marfil, enlaces `marfil` al 70 %, activo en `oro-luz`, botón ocre.
- **Franjas oscuras:** `marino` con texto `marfil`. Sirven para abrir (hero), para el dato fuerte y para cerrar. Nunca dos seguidas.
- **Cifras grandes:** Sora 200 o 600, la cifra en `tinta` y el sufijo (%, h, ×) en `oro`.
- **Iconos:** trazo 1,5 a 1,7 px, un solo color (`oro-oscuro` sobre papel, `oro-luz` sobre marino), 24 px, en cuadrado de 48 px con fondo `oro` al 10 % cuando encabezan una tarjeta.
- **Fotos:** color, radio 12 a 20 px. Sobre marino pueden llevar velo `rgba(6,16,31,.45)` para que el texto lea.
- **Medidores y barras** (horas, presupuesto): relleno `oro`; tramos secundarios en `pizarra`; tramos fuera de alcance en `tinta-2`. Pista en `linea`.

## 5. Ritmo y tono

- Una idea por bloque. Mucho aire: secciones de 96 a 140 px de padding vertical en web, 48 a 64 px en documentos.
- Alternar claro y oscuro; el oscuro es puntual.
- Redacción directa, frases cortas, números concretos. Sin guiones largos (—): se usa el guión normal o el punto.
- Castellano por defecto; catalán cuando el destinatario lo pida.

## 6. Referencias

- Web: https://77delta.com · repo `~/dev/77delta`
- Tokens listos para pegar: `brand/tokens.css`
- Sistema de identidad original: https://claude.ai/code/artifact/f2c2a403-9136-488e-b878-f96a8f8473f1
