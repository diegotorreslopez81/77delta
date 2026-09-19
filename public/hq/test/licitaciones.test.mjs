import test from 'node:test';
import assert from 'node:assert/strict';
import { DECIDIBLES, ABIERTAS, pendiente, porDecidir, enCriba, porElegible, solvenciaTexto, embudo, estadoDe, tipologia, TIPOLOGIAS, sinSolvencia, filtrar, MOTIVOS_NO, motivosNo, enlacesLic } from '../app/licitaciones.js';

// Fixture de 8 licitaciones (Task 1, plan 3b): cubre decidibles, criba, descartada, aprobada por
// decision sin ser decidible, presentada y contratada con importe.
const lics = [
  { expediente: 'E1', elegible: 'Probable', estado: 'Nueva', decision: null, cierre: '2026-10-05', importe: null },
  { expediente: 'E2', elegible: 'Dudosa', estado: 'Por decidir', decision: '', cierre: null, importe: null },
  { expediente: 'E3', elegible: 'Revisar', estado: 'Nueva', decision: null, cierre: null, importe: null },
  { expediente: 'E4', elegible: 'No viable', estado: 'Nueva', decision: null, cierre: '2026-09-25', importe: null },
  { expediente: 'E5', elegible: 'Probable', estado: 'Descartada', decision: null, cierre: '2026-09-10', importe: '5000' },
  { expediente: 'E6', elegible: 'Probable', estado: 'Nueva', decision: 'OK', cierre: '2026-09-15', importe: '12000' },
  { expediente: 'E7', elegible: null, estado: 'Presentada', decision: 'OK', cierre: '2026-09-12', importe: '30000' },
  { expediente: 'E8', elegible: null, estado: 'Contratada', decision: 'OK', cierre: '2026-08-01', importe: '45000.5' },
];

test('DECIDIBLES y ABIERTAS son los conjuntos esperados', () => {
  assert.deepEqual([...DECIDIBLES], ['Probable', 'Dudosa']);
  assert.deepEqual([...ABIERTAS], ['Nueva', 'Por decidir']);
});

// C1 (revision final del controlador): estado '' (cadena vacia, valor por defecto de la columna en
// BD) se trata como 'Nueva' en todo el modulo.
test('estadoDe: cadena vacia o solo espacios cae a Nueva; un estado real se respeta tal cual', () => {
  assert.equal(estadoDe({ estado: '' }), 'Nueva');
  assert.equal(estadoDe({ estado: '   ' }), 'Nueva');
  assert.equal(estadoDe({}), 'Nueva');
  assert.equal(estadoDe({ estado: null }), 'Nueva');
  assert.equal(estadoDe({ estado: 'Presentada' }), 'Presentada');
});

test('C1: una fila con estado vacio, elegible Probable y decision null es pendiente y cuenta en por_decidir', () => {
  const fila = { expediente: 'EVACIO', elegible: 'Probable', estado: '', decision: null, cierre: '2026-10-01', importe: '1000' };
  assert.ok(pendiente(fila));
  assert.ok(porDecidir([fila]).some(l => l.expediente === 'EVACIO'), 'estado vacio debe tratarse como Nueva (abierta) y entrar en por_decidir');
  const e = embudo([fila]);
  assert.equal(e.find(f => f.clave === 'por_decidir').n, 1);
});

test('pendiente: decision null, vacia o Pendiente; OK y No no son pendientes', () => {
  assert.equal(pendiente({ decision: null }), true);
  assert.equal(pendiente({ decision: '' }), true);
  assert.equal(pendiente({ decision: 'Pendiente' }), true);
  assert.equal(pendiente({}), true);
  assert.equal(pendiente({ decision: 'OK' }), false);
  assert.equal(pendiente({ decision: 'No' }), false);
});

test('porDecidir: Probable/Nueva y Dudosa/Por decidir pendientes entran, ordenadas por cierre asc con nulls last', () => {
  const pd = porDecidir(lics);
  assert.deepEqual(pd.map(l => l.expediente), ['E1', 'E2']);
});

test('enCriba: Revisar/Nueva y No viable/Nueva pendientes entran, no decidibles, mismo orden', () => {
  const ec = enCriba(lics);
  assert.deepEqual(ec.map(l => l.expediente), ['E4', 'E3']);
});

test('Descartada queda fuera de porDecidir y enCriba aunque sea Probable y pendiente', () => {
  assert.ok(!porDecidir(lics).some(l => l.expediente === 'E5'));
  assert.ok(!enCriba(lics).some(l => l.expediente === 'E5'));
});

test('decision OK saca la fila de porDecidir/enCriba aunque sea elegible y este abierta', () => {
  assert.ok(!porDecidir(lics).some(l => l.expediente === 'E6'));
  assert.ok(!enCriba(lics).some(l => l.expediente === 'E6'));
});

test('porDecidir/enCriba: empate de cierre (incluidos ambos null) desempata por expediente', () => {
  const empatadas = [
    { expediente: 'Z9', elegible: 'Probable', estado: 'Nueva', decision: null, cierre: '2026-09-01' },
    { expediente: 'A1', elegible: 'Probable', estado: 'Nueva', decision: null, cierre: '2026-09-01' },
    { expediente: 'B2', elegible: 'Probable', estado: 'Nueva', decision: null, cierre: null },
    { expediente: 'A3', elegible: 'Probable', estado: 'Nueva', decision: null, cierre: null },
  ];
  assert.deepEqual(porDecidir(empatadas).map(l => l.expediente), ['A1', 'Z9', 'A3', 'B2']);
});

test('porElegible: agrupa por elegible (o Sin clasificar) y ordena por tamano desc', () => {
  const grupos = porElegible(lics);
  // Minor 11 (revision final): la asercion original se comparaba consigo misma
  // (assert.deepEqual(grupos[0], ['Probable', grupos[0][1]])), siempre en verde. Se sustituye por el
  // valor esperado real: Probable agrupa E1, E5 y E6 (por orden de insercion).
  assert.equal(grupos[0][0], 'Probable');
  assert.deepEqual(grupos[0][1].map(l => l.expediente), ['E1', 'E5', 'E6']);
  assert.equal(grupos[0][1].length, 3);
  assert.equal(grupos[1][0], 'Sin clasificar');
  assert.equal(grupos[1][1].length, 2);
  assert.equal(grupos.length, 5);
  assert.equal(grupos.reduce((n, g) => n + g[1].length, 0), 8);
});

test('solvenciaTexto: vacio, ausente o que empieza por ? es sin dato', () => {
  assert.equal(solvenciaTexto({ solvencia: '' }), 'sin dato');
  assert.equal(solvenciaTexto({ solvencia: null }), 'sin dato');
  assert.equal(solvenciaTexto({}), 'sin dato');
  assert.equal(solvenciaTexto({ solvencia: '? no se pudo determinar la solvencia' }), 'sin dato');
});

test('solvenciaTexto: texto normal se devuelve tal cual', () => {
  assert.equal(solvenciaTexto({ solvencia: 'Alta, sin incidencias declaradas' }), 'Alta, sin incidencias declaradas');
});

test('solvenciaTexto: recorte a 160 caracteres mas el caracter de elipsis U+2026', () => {
  const largo = 'a'.repeat(200);
  const r = solvenciaTexto({ solvencia: largo });
  assert.equal(r.length, 161);
  assert.equal(r.slice(0, 160), 'a'.repeat(160));
  assert.equal(r.slice(160), '…');
  assert.equal(r.includes('...'), false);
});

test('embudo sin kpis: no hay fila detectadas ni analizadas', () => {
  const e = embudo(lics);
  // I1 (revision final): fila pausadas anadida entre presentadas y adjudicadas.
  assert.deepEqual(e.map(f => f.clave), ['por_decidir', 'en_criba', 'aprobadas', 'presentadas', 'pausadas', 'adjudicadas', 'contratadas', 'descartadas', 'cerradas']);
});

test('embudo con kpis.lic.detectadas.n: primera fila detectadas con n 1500 y eur null', () => {
  const e = embudo(lics, { 'lic.detectadas.n': { valor: 1500 } });
  assert.equal(e[0].clave, 'detectadas');
  assert.equal(e[0].n, 1500);
  assert.equal(e[0].eur, null);
  assert.equal(e.some(f => f.clave === 'analizadas'), false);
});

test('embudo con detectadas y analizadas: ambas delante, en ese orden', () => {
  const e = embudo(lics, { 'lic.detectadas.n': { valor: 1500 }, 'lic.analizadas.n': { valor: 300 } });
  assert.deepEqual(e.slice(0, 2).map(f => f.clave), ['detectadas', 'analizadas']);
  assert.equal(e[1].n, 300);
});

test('embudo: cuenta por_decidir y en_criba igual que las funciones puras', () => {
  const e = embudo(lics);
  const pd = e.find(f => f.clave === 'por_decidir'), ec = e.find(f => f.clave === 'en_criba');
  assert.equal(pd.n, 2); assert.equal(pd.eur, 0);
  assert.equal(ec.n, 2); assert.equal(ec.eur, 0);
});

test('embudo: aprobadas cuenta estado Aprobada y decision OK fuera de Presentada/Adjudicada/Contratada, una vez cada fila', () => {
  const e = embudo(lics);
  const ap = e.find(f => f.clave === 'aprobadas');
  assert.equal(ap.n, 1); // solo E6
  assert.equal(ap.eur, 12000);
  const ambas = [...lics, { expediente: 'E9', estado: 'Aprobada', decision: 'OK', importe: '100' }];
  assert.equal(embudo(ambas).find(f => f.clave === 'aprobadas').n, 2);
});

test('embudo: presentadas, adjudicadas y contratadas por estado exacto', () => {
  const e = embudo(lics);
  assert.equal(e.find(f => f.clave === 'presentadas').n, 1);
  assert.equal(e.find(f => f.clave === 'presentadas').eur, 30000);
  assert.equal(e.find(f => f.clave === 'adjudicadas').n, 0);
  assert.equal(e.find(f => f.clave === 'contratadas').n, 1);
  assert.equal(e.find(f => f.clave === 'contratadas').eur, 45000.5);
});

test('embudo: No adjudicada no cuenta como adjudicada', () => {
  const conNoAdjudicada = [...lics, { expediente: 'E10', estado: 'No adjudicada', decision: 'OK', importe: '9999' }];
  assert.equal(embudo(conNoAdjudicada).find(f => f.clave === 'adjudicadas').n, 0);
});

test('embudo: descartadas por estado que empieza por Descartada o decision No, una vez por fila', () => {
  const e = embudo(lics);
  const de = e.find(f => f.clave === 'descartadas');
  assert.equal(de.n, 1); assert.equal(de.eur, 5000);
  const conNo = [...lics, { expediente: 'E11', estado: 'Nueva', decision: 'No', importe: '10' }, { expediente: 'E12', estado: 'Descartada por chief', decision: 'No', importe: '20' }];
  assert.equal(embudo(conNo).find(f => f.clave === 'descartadas').n, 3);
});

test('embudo: cerradas solo con estado Cerrada sin presentar', () => {
  const e = embudo(lics);
  assert.equal(e.find(f => f.clave === 'cerradas').n, 0);
  const conCerrada = [...lics, { expediente: 'E13', estado: 'Cerrada sin presentar', importe: '0' }];
  assert.equal(embudo(conCerrada).find(f => f.clave === 'cerradas').n, 1);
});

// Ruling del controlador (17-sep): el payload real ya no trae en 'licitaciones' las filas cerradas
// (Descartada, Cerrada sin presentar, Adjudicada, Contratada): esas se sirven agregadas en
// 'lic_resumen' ({ total, descartadas, cerradas, adjudicadas, no_adjudicadas, contratadas }, cada una
// { n, eur }). embudo(lics, kpis, resumen) usa resumen[clave] cuando existe para esas cuatro filas en
// vez de contar el array, y resumen.total para la fila detectadas cuando no hay kpis.

test('embudo con resumen: adjudicadas/contratadas/descartadas/cerradas usan resumen en vez de contar el array', () => {
  const resumen = {
    total: { n: 1500, eur: 9000000 },
    descartadas: { n: 900, eur: 4000000 },
    cerradas: { n: 200, eur: 1000000 },
    adjudicadas: { n: 50, eur: 500000 },
    no_adjudicadas: { n: 30, eur: 300000 },
    contratadas: { n: 20, eur: 200000 },
  };
  const e = embudo(lics, {}, resumen);
  assert.deepEqual(e.find(f => f.clave === 'descartadas'), { clave: 'descartadas', nombre: 'Descartadas', n: 900, eur: 4000000 });
  assert.deepEqual(e.find(f => f.clave === 'cerradas'), { clave: 'cerradas', nombre: 'Cerradas sin presentar', n: 200, eur: 1000000 });
  assert.deepEqual(e.find(f => f.clave === 'adjudicadas'), { clave: 'adjudicadas', nombre: 'Adjudicadas', n: 50, eur: 500000 });
  assert.deepEqual(e.find(f => f.clave === 'contratadas'), { clave: 'contratadas', nombre: 'Contratadas', n: 20, eur: 200000 });
  // aprobadas y presentadas no tienen clave en lic_resumen: se siguen contando del array, sin cambios.
  assert.equal(e.find(f => f.clave === 'aprobadas').n, 1);
  assert.equal(e.find(f => f.clave === 'presentadas').n, 1);
});

test('embudo con resumen: detectadas usa resumen.total cuando no hay kpis.lic.detectadas.n', () => {
  const e = embudo(lics, {}, { total: { n: 1500, eur: 9000000 } });
  assert.equal(e[0].clave, 'detectadas');
  assert.equal(e[0].n, 1500);
  assert.equal(e[0].eur, null);
});

test('embudo: kpis.lic.detectadas.n tiene prioridad sobre resumen.total', () => {
  const e = embudo(lics, { 'lic.detectadas.n': { valor: 1600 } }, { total: { n: 1500, eur: 9000000 } });
  assert.equal(e[0].clave, 'detectadas');
  assert.equal(e[0].n, 1600);
});

test('embudo: sin resumen (por defecto {}) sigue contando el array como antes, sin romper', () => {
  const e = embudo(lics);
  assert.equal(e.find(f => f.clave === 'adjudicadas').n, 0);
  assert.equal(e.find(f => f.clave === 'contratadas').n, 1);
  assert.equal(e.find(f => f.clave === 'contratadas').eur, 45000.5);
  assert.equal(e.some(f => f.clave === 'detectadas'), false);
});

test('embudo con resumen: eur y n se leen con Number y por defecto 0 si faltan', () => {
  const e = embudo(lics, {}, { adjudicadas: { n: 3 } });
  const adj = e.find(f => f.clave === 'adjudicadas');
  assert.equal(adj.n, 3);
  assert.equal(adj.eur, 0);
});

// I1 (revision final): fila pausadas, misma logica que aprobadas/presentadas (array o resumen).
test('embudo: pausadas cuenta por estado Pausada, del array cuando no hay resumen.pausadas', () => {
  const conPausada = [...lics, { expediente: 'E14', estado: 'Pausada', decision: 'OK', importe: '7000' }];
  const e = embudo(conPausada);
  const pa = e.find(f => f.clave === 'pausadas');
  assert.equal(pa.n, 1);
  assert.equal(pa.eur, 7000);
});

test('embudo: pausadas usa resumen.pausadas cuando existe (C2)', () => {
  const e = embudo(lics, {}, { pausadas: { n: 4, eur: 25000 } });
  assert.deepEqual(e.find(f => f.clave === 'pausadas'), { clave: 'pausadas', nombre: 'Pausadas', n: 4, eur: 25000 });
});

// C2 (revision final): aprobadas y presentadas tambien pueden venir de lic_resumen (el corte de 7
// dias por cierre ya no aplica a estos dos estados en el SQL, pero lic_resumen sigue siendo la fuente
// completa sin el limite de pestana/30 dias de omc_hq).
test('embudo: aprobadas y presentadas usan resumen cuando existe (C2)', () => {
  const e = embudo(lics, {}, { aprobadas: { n: 10, eur: 90000 }, presentadas: { n: 5, eur: 45000 } });
  assert.deepEqual(e.find(f => f.clave === 'aprobadas'), { clave: 'aprobadas', nombre: 'Aprobadas', n: 10, eur: 90000 });
  assert.deepEqual(e.find(f => f.clave === 'presentadas'), { clave: 'presentadas', nombre: 'Presentadas', n: 5, eur: 45000 });
});

// tarjetas ricas (encargo #1057): tipologia deriva la categoria del organo por texto libre; TIPOLOGIAS
// es la lista de opciones del selector, TIPOLOGIA_RE de licitaciones.js mas 'Otro'.
test('tipologia: reconoce cada categoria por patron en el texto del organo', () => {
  assert.equal(tipologia('Ajuntament de Sabadell'), 'Ayuntamiento');
  assert.equal(tipologia('Ayuntamiento de Madrid'), 'Ayuntamiento');
  assert.equal(tipologia('Concello de Vigo'), 'Ayuntamiento');
  assert.equal(tipologia('Diputación de Barcelona'), 'Diputación');
  assert.equal(tipologia('Consell Insular de Menorca'), 'Diputación');
  assert.equal(tipologia('Consorci Sanitari de Terrassa'), 'Consorcio');
  assert.equal(tipologia('Generalitat de Catalunya'), 'Autonómica');
  assert.equal(tipologia('Servei Català de la Salut'), 'Autonómica');
  assert.equal(tipologia('Servicio Extremeño de Salud'), 'Autonómica');
  assert.equal(tipologia('Ministerio de Sanidad'), 'Estatal');
  assert.equal(tipologia('Universidad Politécnica de Madrid'), 'Universidad');
  assert.equal(tipologia('Aigües de Barcelona, S.A.'), 'Empresa pública');
  assert.equal(tipologia('Texto sin patron reconocido'), 'Otro');
  assert.equal(tipologia(null), 'Otro');
  assert.equal(tipologia(undefined), 'Otro');
  assert.deepEqual(TIPOLOGIAS[TIPOLOGIAS.length - 1], 'Otro');
  assert.ok(TIPOLOGIAS.includes('Ayuntamiento') && TIPOLOGIAS.includes('Diputación'));
});

test('sinSolvencia: exencion 159.6, "no exige" o "sin acreditaci" es sin solvencia; texto normal exige', () => {
  assert.equal(sinSolvencia({ solvencia: 'Exenta por el articulo 159.6 LCSP' }), true);
  assert.equal(sinSolvencia({ solvencia: 'No exige solvencia especifica' }), true);
  assert.equal(sinSolvencia({ solvencia: 'Sin acreditacion de solvencia' }), true);
  assert.equal(sinSolvencia({ solvencia: 'Clasificacion grupo G, subgrupo 6' }), false);
  assert.equal(sinSolvencia({}), false);
  assert.equal(sinSolvencia({ solvencia: null }), false);
});

test('filtrar: cada dimension es opcional y se combinan con AND', () => {
  const rows = [
    { expediente: 'F1', organo: 'Ajuntament de Reus', solvencia: 'no exige', pestana: 'PLACSP', tipo: 'obras', estado: 'Nueva' },
    { expediente: 'F2', organo: 'Ministerio de Defensa', solvencia: 'Grupo A', pestana: 'Gencat', tipo: 'servicios', estado: 'Cerrada sin presentar' },
    { expediente: 'F3', organo: 'Ajuntament de Reus', solvencia: 'Grupo A', pestana: 'PLACSP', tipo: 'servicios', estado: 'Nueva' },
  ];
  assert.deepEqual(filtrar(rows, {}).map(l => l.expediente), ['F1', 'F2', 'F3']);
  assert.deepEqual(filtrar(rows, { tipologia: 'Ayuntamiento' }).map(l => l.expediente), ['F1', 'F3']);
  assert.deepEqual(filtrar(rows, { tipologia: 'Estatal' }).map(l => l.expediente), ['F2']);
  assert.deepEqual(filtrar(rows, { solvencia: 'todas' }).map(l => l.expediente), ['F1', 'F2', 'F3']);
  assert.deepEqual(filtrar(rows, { solvencia: 'sin solvencia' }).map(l => l.expediente), ['F1']);
  assert.deepEqual(filtrar(rows, { solvencia: 'exige' }).map(l => l.expediente), ['F2', 'F3']);
  assert.deepEqual(filtrar(rows, { fuente: 'PLACSP' }).map(l => l.expediente), ['F1', 'F3']);
  assert.deepEqual(filtrar(rows, { tipo: 'servicios' }).map(l => l.expediente), ['F2', 'F3']);
  assert.deepEqual(filtrar(rows, { desiertas: true }).map(l => l.expediente), ['F2']);
  assert.deepEqual(filtrar(rows, { tipologia: 'Ayuntamiento', tipo: 'servicios' }).map(l => l.expediente), ['F3']);
  assert.deepEqual(filtrar(null, {}), []);
});

// Motivos de NO (encargo #1063): catalogo cerrado, mismo orden que omc_motivos_no() en SQL y
// MOTIVOS_NO en scripts/hq/hq.py.
test('MOTIVOS_NO: 10 elementos en el orden exacto del catalogo', () => {
  assert.deepEqual(MOTIVOS_NO, ['Fuera de España', 'Suministro/hardware', 'No TIC ni formación', 'Solvencia/clasificación',
    'Presencial', 'Sin pliego', 'Plazo corto', 'Importe bajo', 'Competencia/consorcio', 'Duplicada']);
  assert.equal(MOTIVOS_NO.length, 10);
});

test('motivosNo: solo devuelve los elementos de l.motivos que estan en el catalogo', () => {
  assert.deepEqual(motivosNo({ motivos: ['Sin pliego', 'Plazo corto'] }), ['Sin pliego', 'Plazo corto']);
  // una aprobada/presentada trae motivos de SI (texto libre de Sales), ajenos al catalogo de NO.
  assert.deepEqual(motivosNo({ motivos: ['Buen encaje con el equipo', 'Cliente conocido'] }), []);
  assert.deepEqual(motivosNo({ motivos: [] }), []);
  assert.deepEqual(motivosNo({}), []);
  assert.deepEqual(motivosNo({ motivos: null }), []);
});

test('filtrar con motivo: pasa las filas cuyo motivosNo incluye el motivo pedido', () => {
  const rows = [
    { expediente: 'M1', estado: 'Descartada', motivos: ['Sin pliego'] },
    { expediente: 'M2', estado: 'Descartada', motivos: ['Plazo corto', 'Sin pliego'] },
    { expediente: 'M3', estado: 'Descartada', motivos: [] },
    { expediente: 'M4', estado: 'Aprobada', motivos: ['Cliente conocido'] },
  ];
  assert.deepEqual(filtrar(rows, { motivo: 'Sin pliego' }).map(l => l.expediente), ['M1', 'M2']);
  assert.deepEqual(filtrar(rows, { motivo: 'Plazo corto' }).map(l => l.expediente), ['M2']);
  assert.deepEqual(filtrar(rows, {}).map(l => l.expediente), ['M1', 'M2', 'M3', 'M4']);
});

test('filtrar con motivo "sin": solo descartadas sin ningun motivo del catalogo', () => {
  const rows = [
    { expediente: 'M1', estado: 'Descartada', motivos: ['Sin pliego'] },
    { expediente: 'M2', estado: 'Descartada', motivos: [] },
    { expediente: 'M3', estado: 'Descartada', motivos: null },
    { expediente: 'M4', estado: 'Aprobada', motivos: [] },
  ];
  assert.deepEqual(filtrar(rows, { motivo: 'sin' }).map(l => l.expediente), ['M2', 'M3']);
});

test('enlacesLic prefiere los pliegos de Drive y cae al portal si no hay copia', () => {
  const con = { enlace: 'https://p.example/1', carpeta: 'https://drive.google.com/drive/folders/abc', ppt: 'https://p.example/ppt', pcap: 'https://p.example/pcap', ppt_drive: 'https://drive.google.com/file/d/PPT1/view', pcap_drive: '' };
  assert.deepEqual(enlacesLic(con), [['Perfil', 'https://p.example/1'], ['Carpeta', 'https://drive.google.com/drive/folders/abc'], ['PPT', 'https://drive.google.com/file/d/PPT1/view'], ['PCAP', 'https://p.example/pcap']]);
  assert.deepEqual(enlacesLic({ enlace: 'https://p.example/2' }), [['Perfil', 'https://p.example/2']]);
});

// 2.0.20: estado sucio ('Descartada: motivo libre'), presencialidad y buscador como filtro.
test('estadoPartido y estadoBase: separan el motivo que viene pegado al estado', async () => {
  const { estadoPartido, estadoBase } = await import('../app/licitaciones.js');
  assert.deepEqual(estadoPartido({ estado: 'Descartada: solo viable en UTE' }), { estado: 'Descartada', motivo: 'solo viable en UTE' });
  assert.deepEqual(estadoPartido({ estado: 'Aprobada' }), { estado: 'Aprobada', motivo: '' });
  assert.equal(estadoBase({ estado: 'Descartada: sin pliego' }), 'Descartada');
  assert.equal(estadoBase({}), 'Nueva', 'sin estado, Nueva, igual que estadoDe');
});

test('presencial: lo detecta por el motivo de NO y por el texto de la licitacion', async () => {
  const { presencial } = await import('../app/licitaciones.js');
  assert.equal(presencial({ motivos: ['Presencial'] }), true);
  assert.equal(presencial({ motivo_auto: 'Requiere trabajo presencial en Bilbao' }), true);
  assert.equal(presencial({ objeto: 'Soporte IN SITU en las oficinas' }), true);
  assert.equal(presencial({ objeto: 'Servicio remoto de consultoria' }), false);
  assert.equal(presencial({}), false);
});

test('filtrar con presencial y texto: sin acentos y sobre expediente, objeto, organo y provincia', async () => {
  const { filtrar, coincideTexto } = await import('../app/licitaciones.js');
  const rows = [
    { expediente: 'P1', objeto: 'Auditoría de IA', organo: 'Ajuntament de Girona', provincia: 'Girona', motivos: ['Presencial'] },
    { expediente: 'P2', objeto: 'Formación en remoto', organo: 'Diputación de Málaga', provincia: 'Málaga', motivos: [] },
  ];
  assert.deepEqual(filtrar(rows, { presencial: 'si' }).map(l => l.expediente), ['P1']);
  assert.deepEqual(filtrar(rows, { presencial: 'no' }).map(l => l.expediente), ['P2']);
  assert.deepEqual(filtrar(rows, { texto: 'girona' }).map(l => l.expediente), ['P1']);
  assert.deepEqual(filtrar(rows, { texto: 'MALAGA' }).map(l => l.expediente), ['P2']);
  assert.deepEqual(filtrar(rows, { texto: 'auditoria de ia' }).map(l => l.expediente), ['P1']);
  assert.deepEqual(filtrar(rows, { texto: '  ' }).map(l => l.expediente), ['P1', 'P2']);
  assert.equal(coincideTexto(rows[0], 'zzz'), false);
});
