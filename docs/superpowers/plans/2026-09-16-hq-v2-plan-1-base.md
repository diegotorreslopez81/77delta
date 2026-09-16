# HQ v2 · Plan 1: base de datos, RPC, CLI y puertas duras

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que HQ sea la única fuente de la verdad en cascada (objetivo → bloque → frente → encargo) con puertas técnicas que impidan encargos sin frente, cierres sin fuente y envíos sin contacto, y con el CLI, el latido y los crons leyendo de ahí.

**Architecture:** todo lo nuevo va en `scripts/hq/schema-v2.sql` (idempotente, se aplica después de `schema.sql`) y en un módulo nuevo `scripts/hq/hq_v2.py` que `hq.py` importa para registrar subcomandos; las RPC v1 que usa la webapp actual (`omc_hq`, `omc_comentar`...) no cambian de firma. La UI v2 (plan 2) consume una RPC nueva `omc_hq_v2`. Las pruebas corren contra la base real en un tenant aislado `pruebas`.

**Tech Stack:** Postgres (Supabase self-hosted, PostgREST, RPC `security definer`), Python 3.14 stdlib (`urllib`, `argparse`, `unittest`), bash. Sin dependencias nuevas.

**Spec:** `docs/superpowers/specs/2026-09-16-hq-fuente-unica-cascada-design.md` (secciones 2.3 a 4 y 7 a 9). Plan 2 (interfaz): `docs/superpowers/plans/2026-09-16-hq-v2-plan-2-interfaz.md`.

## Global Constraints

- Nunca la raya larga ni el guion largo en código, SQL, docs ni commits; siempre "-".
- Español con acentos en mensajes al usuario; identificadores SQL y Python sin acentos (`linea_id`, `fuente_cierre`).
- Ninguna credencial impresa ni escrita en ficheros del repo: tokens solo por variable de entorno o `~/.config/77delta/hq.env` (600). Los tokens del tenant `pruebas` reciben el mismo trato.
- Todo el SQL es idempotente: `create table if not exists`, `add column if not exists`, `create or replace function`, `on conflict do nothing`. Al cambiar la firma de una función existente, `drop function if exists <nombre>(<firma vieja>)` antes del `create or replace` (evita sobrecargas; hoy hay drift con `omc_escalar`).
- RLS activo en todas las tablas `omc_*` y ninguna `create policy`: todo acceso pasa por funciones `security definer` que validan el token con `omc_tok(p_token)`.
- Se aplica el esquema con `scripts/hq/aplicar-schema.sh` (ejecuta `schema.sql` y `schema-v2.sql` con `~/dev/cuponsIA/scripts/plataforma/pgq.py`, que corta la salida a 2000 caracteres). Nunca editar la base a mano fuera de esos ficheros salvo la migración de datos de la Tarea 6.
- Nada específico de 77 Delta en código: todo lo que sea nombre de empresa, bloques, frentes o agentes vive en filas con `empresa` (semillas en `scripts/hq/seed-77delta-v2.sql`).
- Tests: `python3 -m unittest discover -s scripts/hq/tests -p 'test_*.py'`. No hay pytest. Cada test usa el tenant `pruebas` y limpia lo que crea.
- Los scripts de cron que lean con `HQ_OWNER_TOKEN` (Tarea 13) solo se despliegan tras el OK explícito de Diego (regla "owner token: pedir antes").
- Commits pequeños por tarea, mensaje en español, con las líneas de atribución de la sesión.

---

## Mapa de ficheros

| Fichero | Responsabilidad |
|---|---|
| `scripts/hq/schema-v2.sql` (nuevo) | tablas, columnas, funciones y grants de la v2; no toca `schema.sql` salvo lo indicado |
| `scripts/hq/seed-77delta-v2.sql` (nuevo) | objetivos 2026/2027, bloques, frentes, kit y expedientes de 77 Delta |
| `scripts/hq/aplicar-schema.sh` (nuevo) | aplica `schema.sql` + `schema-v2.sql` (+ `--seed`) con pgq.py |
| `scripts/hq/hq_v2.py` (nuevo) | subcomandos nuevos del CLI: `frentes`, `bloques`, `encargo alta/tomar/hecho`, `kit`, `contacto`, `expediente`, `sesion`, `agente`, `feed` |
| `scripts/hq/hq.py` (modificar) | importa `hq_v2`, registra sus subparsers y le delega; `activo` imprime encargos del latido |
| `scripts/hq/migrar-encargos-frente.py` (nuevo) | asigna frente a los 226 encargos huérfanos y normaliza departamentos |
| `scripts/hq/migrar-envios-contactos.py` (nuevo) | carga `envios-realizados.json` en `omc_contactos` |
| `scripts/hq/hq-parados.py` (nuevo) | cron 07:00/15:00: reclamo a 48 h, escalado a 72 h |
| `scripts/hq/hq-informe.py` (nuevo) | cron 06:50: informe de Diego desde HQ a Drive |
| `scripts/gmail/enviar-con-lock.sh` (modificar) | exige `--contacto`, rechaza adjuntos .html/.md, marca el contacto enviado |
| `~/bin/hq-correo.py` (modificar) | casa respuestas de hilo con contactos |
| `~/bin/chief-cuenta.sh` (modificar) | registra `sesion_url` y avance antes de relanzar |
| `scripts/hq/tests/pg.py` (nuevo) | helper SQL y tenant `pruebas` para los tests |
| `scripts/hq/tests/test_*.py` (nuevos) | un fichero por tarea |
| `scripts/hq/tests/e2e-peticion.sh` (nuevo) | recorrido completo petición → hecho en el tenant `pruebas` |
| `docs/empresa/03-hq-manual.md`, `30-alta-de-agente.md`, `reglas-agente-hq.md` (modificar) | documentación de los comandos y la regla nueva |

---

### Task 1: Infraestructura de pruebas y esquema v2 vacío

**Files:**
- Create: `scripts/hq/tests/__init__.py` (vacío)
- Create: `scripts/hq/tests/pg.py`
- Create: `scripts/hq/tests/test_00_tenant.py`
- Create: `scripts/hq/schema-v2.sql`
- Create: `scripts/hq/aplicar-schema.sh`

**Interfaces:**
- Produces: `pg.sql(q: str) -> list[dict]` (ejecuta SQL con la service key; lanza `RuntimeError` con el cuerpo del error si HTTP != 2xx); `pg.preparar_tenant() -> dict(owner=str, agente=str, url=str, anon=str)` (crea la empresa `pruebas` y sus dos tokens si no existen y los devuelve; nunca los imprime); `pg.entorno_cli(rol='agente') -> dict` (copia de `os.environ` con `HQ_URL`, `HQ_ANON`, `HQ_TOKEN`, y `HQ_OWNER_TOKEN` si rol owner, para lanzar `hq.py` por subprocess); `pg.limpiar_tenant()` (borra encargos, contactos, kit, expedientes, sesiones, avances, líneas y bloques de `pruebas`; conserva empresa y tokens).

- [ ] **Step 1: Escribir el helper de base de datos**

```python
# scripts/hq/tests/pg.py
"""Acceso SQL para los tests de HQ v2. Usa la service key del portal (misma fuente que pgq.py).
Nunca imprime claves ni tokens."""
import json, os, urllib.request, urllib.error

ENV_PORTAL = '/Users/diego/dev/infinitelabs-portal-cupons/.env.local'
HQ_ENV = os.path.expanduser('~/.config/77delta/hq.env')
EMPRESA = 'pruebas'


def _leer_env(ruta):
    e = {}
    for l in open(ruta):
        l = l.strip()
        if '=' in l and not l.startswith('#'):
            k, v = l.split('=', 1)
            e[k.strip()] = v.strip().strip('"').strip("'")
    return e


_P = _leer_env(ENV_PORTAL)
BASE = _P['SUPABASE_URL'].rstrip('/')
_SVC = _P['SUPABASE_SERVICE_ROLE_KEY']
ANON = _P['NEXT_PUBLIC_SUPABASE_ANON_KEY']


def sql(q, *params):
    """Ejecuta SQL. params se interpolan con format() tras escapar comillas simples: solo para valores de test."""
    if params:
        q = q.format(*[str(p).replace("'", "''") for p in params])
    req = urllib.request.Request(BASE + '/pg/query', data=json.dumps({'query': q}).encode(), method='POST',
                                 headers={'apikey': _SVC, 'Authorization': 'Bearer ' + _SVC, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read() or b'null') or []
    except urllib.error.HTTPError as e:
        raise RuntimeError(f'SQL HTTP {e.code}: {e.read().decode()[:600]}') from None


def preparar_tenant():
    sql("insert into omc_empresas (id, nombre, plan_usd) values ('{0}', 'Tenant de pruebas', 0) on conflict (id) do nothing", EMPRESA)
    for rol in ('owner', 'agente'):
        sql("insert into omc_tokens (empresa, rol, nombre) select '{0}', '{1}', 'pruebas-{1}' "
            "where not exists (select 1 from omc_tokens where empresa='{0}' and rol='{1}')", EMPRESA, rol)
    filas = sql("select rol, token from omc_tokens where empresa='{0}'", EMPRESA)
    t = {f['rol']: f['token'] for f in filas}
    return {'owner': t['owner'], 'agente': t['agente'], 'url': BASE, 'anon': ANON}


def entorno_cli(rol='agente'):
    t = preparar_tenant()
    env = dict(os.environ)
    env.update({'HQ_URL': t['url'], 'HQ_ANON': t['anon'], 'HQ_TOKEN': t[rol], 'HQ_AGENTE_FORZADO': env.get('HQ_AGENTE_FORZADO', 'probador'),
                'HQ_ENGRAM_OFF': '1'})
    if rol == 'owner':
        env['HQ_OWNER_TOKEN'] = t['owner']
    env.pop('HQ_AGENTE', None)
    return env


def limpiar_tenant():
    for tabla in ('omc_sesiones', 'omc_contactos', 'omc_encargo_avances', 'omc_kit', 'omc_expedientes', 'omc_encargos',
                  'omc_decisiones', 'omc_plan_lineas', 'omc_plan_bloques', 'omc_plan_objetivo', 'omc_agentes', 'omc_solicitudes'):
        existe = sql("select 1 from information_schema.tables where table_name='{0}'", tabla)
        if existe:
            sql("delete from {0} where empresa='{1}'", tabla, EMPRESA)
```

Nota: `HQ_ENGRAM_OFF=1` lo respeta `hq.py` desde la Tarea 11 (la función `engram()` vuelve sin hacer nada si está puesto), para que los tests no toquen la cola de Engram.

- [ ] **Step 2: Escribir el test del tenant**

```python
# scripts/hq/tests/test_00_tenant.py
import unittest
from . import pg


class TestTenant(unittest.TestCase):
    def test_tenant_pruebas_existe_con_dos_tokens(self):
        t = pg.preparar_tenant()
        self.assertEqual(len(t['owner']), len(t['agente']))
        self.assertNotEqual(t['owner'], t['agente'])
        filas = pg.sql("select count(*) as n from omc_tokens where empresa='pruebas'")
        self.assertEqual(int(filas[0]['n']), 2)

    def test_schema_v2_aplicado(self):
        filas = pg.sql("select 1 from pg_proc where proname='omc_v2_version'")
        self.assertEqual(len(filas), 1, 'aplica scripts/hq/aplicar-schema.sh')
```

- [ ] **Step 3: Ejecutar y ver que falla**

Run: `cd ~/dev/77delta && python3 -m unittest scripts.hq.tests.test_00_tenant -v`
Expected: `test_schema_v2_aplicado` FAIL (no existe `omc_v2_version`). Si `scripts` no se importa como paquete, crear `scripts/__init__.py` y `scripts/hq/__init__.py` vacíos.

- [ ] **Step 4: Crear schema-v2.sql con la función de versión y el script de aplicación**

```sql
-- scripts/hq/schema-v2.sql · HQ v2: fuente única en cascada. Idempotente. Se aplica DESPUÉS de schema.sql.
-- Convención: cada sección lleva el número de tarea del plan 2026-09-16-hq-v2-plan-1-base.md.

-- T1 · versión del esquema v2 (los tests la usan como centinela)
create or replace function omc_v2_version() returns text language sql immutable as $$ select '2.0.1' $$;
grant execute on function omc_v2_version() to anon, authenticated;

notify pgrst, 'reload schema';
```

```bash
#!/usr/bin/env bash
# scripts/hq/aplicar-schema.sh · aplica schema.sql y schema-v2.sql (y la semilla con --seed) en el Supabase de HQ.
set -euo pipefail
AQUI="$(cd "$(dirname "$0")" && pwd)"
PGQ="$HOME/dev/cuponsIA/scripts/plataforma/pgq.py"
[ -f "$PGQ" ] || { echo "falta $PGQ" >&2; exit 1; }
for f in schema.sql schema-v2.sql; do
  echo "== $f"; python3 "$PGQ" "$AQUI/$f" | cut -c1-300
done
if [ "${1:-}" = "--seed" ]; then
  echo "== seed-77delta-v2.sql"; python3 "$PGQ" "$AQUI/seed-77delta-v2.sql" | cut -c1-300
fi
python3 "$PGQ" -c "select omc_v2_version() as v" 
```

Run: `chmod +x scripts/hq/aplicar-schema.sh && scripts/hq/aplicar-schema.sh`
Expected: tres bloques sin `HTTP 4xx` y la última línea con `"v": "2.0.1"`.

- [ ] **Step 5: Ejecutar los tests y ver que pasan**

Run: `python3 -m unittest scripts.hq.tests.test_00_tenant -v`
Expected: 2 tests OK.

- [ ] **Step 6: Commit**

```bash
git add scripts/hq/schema-v2.sql scripts/hq/aplicar-schema.sh scripts/hq/tests/ scripts/__init__.py scripts/hq/__init__.py
git commit -m "test(hq): tenant pruebas, helper SQL y esquema v2 vacío"
```

---

### Task 2: Objetivo con horizonte (2026 y 2027)

**Files:**
- Modify: `scripts/hq/schema-v2.sql` (sección T2)
- Create: `scripts/hq/seed-77delta-v2.sql` (sección objetivos)
- Test: `scripts/hq/tests/test_02_objetivo.py`

**Interfaces:**
- Consumes: `omc_tok(p_token)` de schema.sql (devuelve fila con `empresa`, `rol`, `nombre`).
- Produces: `omc_plan_objetivo(empresa, horizonte int, titulo, meta, unidad, fecha_limite)` con PK `(empresa, horizonte)`; RPC `omc_plan_objetivo_set(p_token, p jsonb)` acepta `horizonte` (default 2026); RPC `omc_plan_objetivos(p_token) -> jsonb[]` ordenados por horizonte; `omc_plan_objetivo(p_token)` sigue devolviendo una sola fila (el horizonte mínimo) para la UI v1.

- [ ] **Step 1: Test**

```python
# scripts/hq/tests/test_02_objetivo.py
import json, unittest, urllib.request
from . import pg


def rpc(token, fn, **args):
    t = pg.preparar_tenant()
    args['p_token'] = token
    req = urllib.request.Request(t['url'] + '/rest/v1/rpc/' + fn, data=json.dumps(args).encode(), method='POST',
                                 headers={'apikey': t['anon'], 'Authorization': 'Bearer ' + t['anon'], 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read() or b'null')
    except urllib.error.HTTPError as e:
        raise RuntimeError(json.loads(e.read().decode()).get('message', '')) from None


class TestObjetivo(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.t = pg.preparar_tenant()
        pg.sql("delete from omc_plan_objetivo where empresa='pruebas'")

    def test_dos_horizontes_conviven(self):
        rpc(self.t['owner'], 'omc_plan_objetivo_set', p={'titulo': 'Contratado 2026', 'meta': 300000, 'unidad': 'EUR', 'fecha_limite': '2026-12-31'})
        rpc(self.t['owner'], 'omc_plan_objetivo_set', p={'horizonte': 2027, 'titulo': 'Contratado 2027', 'meta': 3000000, 'unidad': 'EUR', 'fecha_limite': '2027-12-31'})
        rpc(self.t['owner'], 'omc_plan_objetivo_set', p={'titulo': 'Contratado 2026', 'meta': 310000, 'unidad': 'EUR', 'fecha_limite': '2026-12-31'})
        todos = rpc(self.t['agente'], 'omc_plan_objetivos')
        self.assertEqual([o['horizonte'] for o in todos], [2026, 2027])
        self.assertEqual(float(todos[0]['meta']), 310000)
        uno = rpc(self.t['agente'], 'omc_plan_objetivo')
        self.assertEqual(uno['horizonte'], 2026)

    def test_agente_no_puede_fijar_objetivo(self):
        with self.assertRaisesRegex(RuntimeError, 'solo owner'):
            rpc(self.t['agente'], 'omc_plan_objetivo_set', p={'titulo': 'x', 'meta': 1})
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `python3 -m unittest scripts.hq.tests.test_02_objetivo -v`
Expected: FAIL (`omc_plan_objetivos` no existe / `horizonte` desconocido).

- [ ] **Step 3: SQL**

Añadir a `schema-v2.sql` (antes del `notify`):

```sql
-- T2 · objetivo por horizonte
alter table omc_plan_objetivo add column if not exists horizonte int not null default 2026;
do $$
begin
  if exists (select 1 from pg_constraint where conrelid='omc_plan_objetivo'::regclass and contype='p'
             and array_length(conkey,1)=1) then
    alter table omc_plan_objetivo drop constraint omc_plan_objetivo_pkey;
    alter table omc_plan_objetivo add primary key (empresa, horizonte);
  end if;
end $$;

drop function if exists omc_plan_objetivo_set(text, jsonb);
create or replace function omc_plan_objetivo_set(p_token text, p jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare t record; h int := coalesce((p->>'horizonte')::int, 2026); r omc_plan_objetivo;
begin
  select * into t from omc_tok(p_token);
  if t.rol <> 'owner' then raise exception 'solo owner' using errcode='42501'; end if;
  insert into omc_plan_objetivo (empresa, horizonte, titulo, meta, unidad, fecha_limite)
  values (t.empresa, h, p->>'titulo', (p->>'meta')::numeric, coalesce(p->>'unidad','EUR'), (p->>'fecha_limite')::date)
  on conflict (empresa, horizonte) do update set titulo=excluded.titulo, meta=excluded.meta, unidad=excluded.unidad, fecha_limite=excluded.fecha_limite
  returning * into r;
  return to_jsonb(r);
end $$;

create or replace function omc_plan_objetivos(p_token text) returns jsonb
language sql security definer set search_path=public as $$
  select coalesce(jsonb_agg(to_jsonb(o) order by o.horizonte), '[]'::jsonb)
  from omc_plan_objetivo o where o.empresa = (select empresa from omc_tok(p_token));
$$;

drop function if exists omc_plan_objetivo(text);
create or replace function omc_plan_objetivo(p_token text) returns jsonb
language sql security definer set search_path=public as $$
  select to_jsonb(o) from omc_plan_objetivo o where o.empresa = (select empresa from omc_tok(p_token))
  order by o.horizonte limit 1;
$$;
grant execute on function omc_plan_objetivo_set(text, jsonb), omc_plan_objetivos(text), omc_plan_objetivo(text) to anon, authenticated;
```

Comprobar antes de aplicar que `omc_plan_objetivo_set` de `schema.sql` (línea 454) no la vuelve a crear con `on conflict (empresa)`: al aplicar `schema.sql` primero y `schema-v2.sql` después, la v2 gana. Añadir en `schema.sql`, junto a esa función, el comentario `-- sustituida en schema-v2.sql (T2); se conserva para instalaciones sin v2`.

Semilla (`scripts/hq/seed-77delta-v2.sql`, nuevo):

```sql
-- seed-77delta-v2.sql · datos de 77 Delta para HQ v2. Idempotente.
insert into omc_plan_objetivo (empresa, horizonte, titulo, meta, unidad, fecha_limite) values
  ('77delta', 2026, 'Contratado a 31 de diciembre de 2026', 300000, 'EUR', '2026-12-31'),
  ('77delta', 2027, 'Contratado en 2027 con licitaciones europeas', 3000000, 'EUR', '2027-12-31')
on conflict (empresa, horizonte) do update set titulo=excluded.titulo, meta=excluded.meta, fecha_limite=excluded.fecha_limite;
```

- [ ] **Step 4: Aplicar y probar**

Run: `scripts/hq/aplicar-schema.sh --seed && python3 -m unittest scripts.hq.tests.test_02_objetivo -v`
Expected: 2 OK. Comprobar la UI v1 sigue viva: `python3 scripts/hq/hq.py plan` imprime el objetivo 2026 con meta 300000.

- [ ] **Step 5: Commit**

```bash
git add scripts/hq/schema-v2.sql scripts/hq/seed-77delta-v2.sql scripts/hq/schema.sql scripts/hq/tests/test_02_objetivo.py
git commit -m "feat(hq): objetivo por horizonte 2026/2027"
```

---

### Task 3: Bloques estratégicos y frentes (cascada)

**Files:**
- Modify: `scripts/hq/schema-v2.sql` (sección T3)
- Modify: `scripts/hq/seed-77delta-v2.sql` (bloques y frentes)
- Modify: `scripts/hq/tests/pg.py` (mover aquí `rpc()`)
- Test: `scripts/hq/tests/test_03_frentes.py`

**Interfaces:**
- Produces: tabla `omc_plan_bloques(id bigserial pk, empresa, letra text, nombre, meta_eur numeric, director text, orden int, activo bool, updated_at)` con `unique(empresa, letra)`; columnas nuevas en `omc_plan_lineas`: `bloque_id bigint`, `codigo text` (único por empresa cuando no es null), `etiquetas text[]`; helpers SQL `omc_frente_id(p_empresa text, p_ref text) -> bigint` (acepta id numérico o código `A3`, insensible a mayúsculas; null si no existe o no está activa) y `omc_agente_valido(p_empresa text, p_nombre text) -> text` (devuelve el `id` canónico de `omc_agentes` si `p_nombre` coincide con id, nombre o primer tramo de una de sus `sesiones`; null si no); RPC `omc_bloques_lista(p_token)`, `omc_frentes_lista(p_token, p_bloque text default null)` (cada frente con `codigo, linea, kpi, valor_actual, meta, unidad, responsable, bloque_letra, bloque_nombre, encargos_abiertos`), `omc_bloque_set(p_token, p jsonb)` y `omc_frente_set(p_token, p jsonb)` (owner; `p` acepta `letra`/`codigo` como clave natural y hace upsert).
- `pg.rpc(token, fn, **args)`: misma función que en test_02 pero compartida; `test_02_objetivo.py` pasa a importarla de `pg`.

- [ ] **Step 1: Mover `rpc` a `pg.py` y escribir el test**

Añadir al final de `scripts/hq/tests/pg.py` la función `rpc` de `test_02_objetivo.py` (misma firma `rpc(token, fn, **args)`), y en `test_02_objetivo.py` sustituir su definición por `from .pg import rpc`.

```python
# scripts/hq/tests/test_03_frentes.py
import unittest
from . import pg
from .pg import rpc


class TestFrentes(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.t = pg.preparar_tenant()
        pg.sql("delete from omc_plan_lineas where empresa='pruebas'")
        pg.sql("delete from omc_plan_bloques where empresa='pruebas'")
        pg.sql("delete from omc_agentes where empresa='pruebas'")
        pg.sql("insert into omc_agentes (empresa, id, nombre, depto, nivel, sesiones, activo) values "
               "('pruebas','sales-licita','Guillem','licitaciones',2,array['Guillem-Licitaciones'],true)")

    def test_upsert_bloque_y_frente_por_clave_natural(self):
        b = rpc(self.t['owner'], 'omc_bloque_set', p={'letra': 'A', 'nombre': 'Licitaciones públicas', 'meta_eur': 200000, 'director': 'Guillem', 'orden': 1})
        b2 = rpc(self.t['owner'], 'omc_bloque_set', p={'letra': 'A', 'nombre': 'Licitaciones públicas', 'meta_eur': 210000})
        self.assertEqual(b['id'], b2['id']); self.assertEqual(float(b2['meta_eur']), 210000)
        f = rpc(self.t['owner'], 'omc_frente_set', p={'codigo': 'A3', 'bloque': 'A', 'linea': 'Ofertas en curso', 'kpi': 'EUR presentados', 'meta': 200000, 'unidad': 'EUR', 'responsable': 'Guillem'})
        self.assertEqual(f['bloque_id'], b['id'])
        lista = rpc(self.t['agente'], 'omc_frentes_lista')
        self.assertEqual([x['codigo'] for x in lista], ['A3'])
        self.assertEqual(lista[0]['bloque_letra'], 'A')
        self.assertEqual(lista[0]['encargos_abiertos'], 0)

    def test_helpers_frente_y_agente(self):
        rpc(self.t['owner'], 'omc_bloque_set', p={'letra': 'B', 'nombre': 'Subvenciones', 'orden': 2})
        f = rpc(self.t['owner'], 'omc_frente_set', p={'codigo': 'B1', 'bloque': 'B', 'linea': 'ACCIÓ', 'kpi': 'EUR', 'meta': 1})
        self.assertEqual(int(pg.sql("select omc_frente_id('pruebas','b1') as id")[0]['id']), f['id'])
        self.assertEqual(int(pg.sql("select omc_frente_id('pruebas','{0}') as id", f['id'])[0]['id']), f['id'])
        self.assertIsNone(pg.sql("select omc_frente_id('pruebas','Z9') as id")[0]['id'])
        for nombre in ('sales-licita', 'Guillem', 'guillem', 'Guillem-Licitaciones'):
            self.assertEqual(pg.sql("select omc_agente_valido('pruebas','{0}') as a", nombre)[0]['a'], 'sales-licita')
        self.assertIsNone(pg.sql("select omc_agente_valido('pruebas','nadie') as a")[0]['a'])

    def test_agente_no_edita_frentes(self):
        with self.assertRaisesRegex(RuntimeError, 'solo owner'):
            rpc(self.t['agente'], 'omc_frente_set', p={'codigo': 'A1', 'bloque': 'A', 'linea': 'x'})
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `python3 -m unittest scripts.hq.tests.test_03_frentes -v`
Expected: FAIL (`omc_bloque_set` no existe).

- [ ] **Step 3: SQL**

```sql
-- T3 · bloques y frentes
create table if not exists omc_plan_bloques (
  id bigserial primary key, empresa text not null references omc_empresas(id), letra text not null, nombre text not null,
  meta_eur numeric default 0, director text, orden int default 0, activo boolean default true, updated_at timestamptz default now(),
  unique (empresa, letra));
alter table omc_plan_bloques enable row level security;
alter table omc_plan_lineas add column if not exists bloque_id bigint references omc_plan_bloques(id) on delete set null;
alter table omc_plan_lineas add column if not exists codigo text;
alter table omc_plan_lineas add column if not exists etiquetas text[] default '{}';
create unique index if not exists omc_plan_lineas_codigo_u on omc_plan_lineas (empresa, upper(codigo)) where codigo is not null;

create or replace function omc_frente_id(p_empresa text, p_ref text) returns bigint
language sql stable as $$
  select l.id from omc_plan_lineas l where l.empresa = p_empresa and l.activa
    and (upper(l.codigo) = upper(trim(p_ref)) or (p_ref ~ '^[0-9]+$' and l.id = p_ref::bigint)) limit 1;
$$;

create or replace function omc_agente_valido(p_empresa text, p_nombre text) returns text
language sql stable as $$
  select a.id from omc_agentes a where a.empresa = p_empresa and a.activo and p_nombre is not null
    and (lower(a.id) = lower(trim(p_nombre)) or lower(a.nombre) = lower(trim(p_nombre))
         or exists (select 1 from unnest(a.sesiones) s where lower(split_part(s,'-',1)) = lower(trim(p_nombre)) or lower(s) = lower(trim(p_nombre))))
  order by a.orden nulls last, a.id limit 1;
$$;

create or replace function omc_bloque_set(p_token text, p jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare t record; r omc_plan_bloques;
begin
  select * into t from omc_tok(p_token);
  if t.rol <> 'owner' then raise exception 'solo owner' using errcode='42501'; end if;
  if coalesce(p->>'letra','') = '' then raise exception 'falta letra'; end if;
  insert into omc_plan_bloques (empresa, letra, nombre, meta_eur, director, orden, activo)
  values (t.empresa, upper(p->>'letra'), coalesce(p->>'nombre','(sin nombre)'), coalesce((p->>'meta_eur')::numeric,0), p->>'director', coalesce((p->>'orden')::int,0), coalesce((p->>'activo')::boolean,true))
  on conflict (empresa, letra) do update set
    nombre = coalesce(p->>'nombre', omc_plan_bloques.nombre), meta_eur = coalesce((p->>'meta_eur')::numeric, omc_plan_bloques.meta_eur),
    director = coalesce(p->>'director', omc_plan_bloques.director), orden = coalesce((p->>'orden')::int, omc_plan_bloques.orden),
    activo = coalesce((p->>'activo')::boolean, omc_plan_bloques.activo), updated_at = now()
  returning * into r;
  return to_jsonb(r);
end $$;

create or replace function omc_frente_set(p_token text, p jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare t record; r omc_plan_lineas; b bigint; existente bigint;
begin
  select * into t from omc_tok(p_token);
  if t.rol <> 'owner' then raise exception 'solo owner' using errcode='42501'; end if;
  if coalesce(p->>'codigo','') = '' then raise exception 'falta codigo (A1, B2...)'; end if;
  if p ? 'bloque' then
    select id into b from omc_plan_bloques where empresa = t.empresa and letra = upper(p->>'bloque');
    if b is null then raise exception 'bloque % no existe', p->>'bloque'; end if;
  end if;
  select id into existente from omc_plan_lineas where empresa = t.empresa and upper(codigo) = upper(p->>'codigo');
  if existente is null then
    insert into omc_plan_lineas (empresa, orden, linea, kpi, valor_actual, meta, unidad, responsable, proximo_hito, fecha_hito, fuente, activa, actualizado_por, bloque_id, codigo, etiquetas)
    values (t.empresa, coalesce((p->>'orden')::int, 0), coalesce(p->>'linea','(sin nombre)'), coalesce(p->>'kpi',''), coalesce((p->>'valor_actual')::numeric,0),
            coalesce((p->>'meta')::numeric,0), coalesce(p->>'unidad','EUR'), p->>'responsable', p->>'proximo_hito', (p->>'fecha_hito')::date, 'manual', true, t.nombre, b, upper(p->>'codigo'),
            coalesce(array(select jsonb_array_elements_text(p->'etiquetas')), '{}'))
    returning * into r;
  else
    update omc_plan_lineas set
      orden = coalesce((p->>'orden')::int, orden), linea = coalesce(p->>'linea', linea), kpi = coalesce(p->>'kpi', kpi),
      valor_actual = coalesce((p->>'valor_actual')::numeric, valor_actual), meta = coalesce((p->>'meta')::numeric, meta), unidad = coalesce(p->>'unidad', unidad),
      responsable = coalesce(p->>'responsable', responsable), proximo_hito = coalesce(p->>'proximo_hito', proximo_hito), fecha_hito = coalesce((p->>'fecha_hito')::date, fecha_hito),
      activa = coalesce((p->>'activa')::boolean, activa), bloque_id = coalesce(b, bloque_id), actualizado_por = t.nombre,
      etiquetas = case when p ? 'etiquetas' then array(select jsonb_array_elements_text(p->'etiquetas')) else etiquetas end
    where id = existente returning * into r;
  end if;
  return to_jsonb(r);
end $$;

create or replace function omc_bloques_lista(p_token text) returns jsonb
language sql security definer set search_path=public as $$
  select coalesce(jsonb_agg(to_jsonb(b) || jsonb_build_object(
    'frentes', (select count(*) from omc_plan_lineas l where l.bloque_id = b.id and l.activa),
    'encargos_abiertos', (select count(*) from omc_encargos e join omc_plan_lineas l on l.id = e.linea_id where l.bloque_id = b.id and e.estado in ('encolado','en_curso','bloqueado_diego'))
  ) order by b.orden, b.letra), '[]'::jsonb)
  from omc_plan_bloques b where b.empresa = (select empresa from omc_tok(p_token)) and b.activo;
$$;

create or replace function omc_frentes_lista(p_token text, p_bloque text default null) returns jsonb
language sql security definer set search_path=public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', l.id, 'codigo', l.codigo, 'linea', l.linea, 'kpi', l.kpi, 'valor_actual', l.valor_actual, 'meta', l.meta, 'unidad', l.unidad,
    'responsable', l.responsable, 'proximo_hito', l.proximo_hito, 'fecha_hito', l.fecha_hito, 'etiquetas', l.etiquetas, 'orden', l.orden,
    'bloque_id', b.id, 'bloque_letra', b.letra, 'bloque_nombre', b.nombre,
    'encargos_abiertos', (select count(*) from omc_encargos e where e.linea_id = l.id and e.estado in ('encolado','en_curso','bloqueado_diego'))
  ) order by b.orden, b.letra, l.orden, l.codigo), '[]'::jsonb)
  from omc_plan_lineas l left join omc_plan_bloques b on b.id = l.bloque_id
  where l.empresa = (select empresa from omc_tok(p_token)) and l.activa and (p_bloque is null or b.letra = upper(p_bloque));
$$;
grant execute on function omc_bloque_set(text, jsonb), omc_frente_set(text, jsonb), omc_bloques_lista(text), omc_frentes_lista(text, text) to anon, authenticated;
```

Semilla, añadir a `seed-77delta-v2.sql`:

```sql
insert into omc_plan_bloques (empresa, letra, nombre, meta_eur, director, orden) values
  ('77delta','A','Licitaciones públicas',200000,'Guillem',1), ('77delta','B','Subvenciones y ayudas',105000,'Helena',2),
  ('77delta','C','Comercial directo',60000,'Biel',3), ('77delta','D','Producto',9000,'Marina',4), ('77delta','E','Empresa y capacidades',0,'chief',5)
on conflict (empresa, letra) do update set nombre=excluded.nombre, meta_eur=excluded.meta_eur, director=excluded.director, orden=excluded.orden;

-- líneas existentes (ids 1-8 de 77delta) reciben código y bloque; la 8 se apaga (KPI duplicado de A3)
update omc_plan_lineas l set codigo = m.codigo, bloque_id = (select id from omc_plan_bloques where empresa='77delta' and letra = m.letra), orden = m.orden,
  linea = coalesce(m.linea, l.linea), kpi = coalesce(m.kpi, l.kpi)
from (values (1,'B1','B',1,null,null), (2,'A3','A',3,'Ofertas en curso','EUR presentados'), (3,'C2','C',2,null,null), (4,'B4','B',4,null,null),
             (5,'D1','D',1,null,null), (6,'E2','E',2,null,null), (7,'C4','C',4,null,null)) as m(id, codigo, letra, orden, linea, kpi)
where l.empresa='77delta' and l.id = m.id and l.codigo is null;
update omc_plan_lineas set activa = false where empresa='77delta' and id = 8 and codigo is null;
update omc_encargos set linea_id = 2 where empresa='77delta' and linea_id = 8;

-- frentes nuevos
insert into omc_plan_lineas (empresa, orden, linea, kpi, valor_actual, meta, unidad, responsable, fuente, activa, actualizado_por, bloque_id, codigo)
select '77delta', f.orden, f.linea, f.kpi, 0, f.meta, f.unidad, f.responsable, 'manual', true, 'seed', b.id, f.codigo
from (values
  ('A1',1,'Detección y fuentes','Fuentes cubiertas (CCAA)',17,'fuentes','Ariadna'), ('A2',2,'Cribado y elegibilidad','Candidatas con art. 76 leído por semana',20,'expedientes','Guillem'),
  ('A4',4,'Solvencia, colaboradores y UTE','Colaboradores con acuerdo',5,'personas','Biel'), ('A5',5,'Europeas 2027','Convocatorias UE identificadas',10,'convocatorias','Clara'),
  ('B2',2,'Cupons IA','EUR concedidos',40000,'EUR','Martí'), ('B3',3,'Estatales y europeas','Solicitudes presentadas',3,'solicitudes','Clara'),
  ('C1',1,'Ayuntamientos','Reuniones',10,'reuniones','Biel'), ('C3',3,'Consultoría y Peninsula','EUR facturados',20000,'EUR','Diego'), ('C5',5,'Prospección y seguimiento','% respuesta',20,'%','Aina'),
  ('D2',2,'Regulia','Clientes de pago',3,'clientes','Marina'), ('D3',3,'Otros SaaS','MRR',0,'EUR','Diego'),
  ('E1',1,'Habilitaciones y certificaciones','Habilitaciones conseguidas',4,'habilitaciones','Ferran'), ('E3',3,'Equipo y cuentas','% fichas completas',100,'%','Pol'),
  ('E4',4,'HQ y fuente de la verdad','Encargos fuera de plan',0,'encargos','chief'), ('E5',5,'Marca y web','Leads web al mes',10,'leads','Mireia')
) as f(codigo, orden, linea, kpi, meta, unidad, responsable)
join omc_plan_bloques b on b.empresa='77delta' and b.letra = left(f.codigo,1)
where not exists (select 1 from omc_plan_lineas x where x.empresa='77delta' and upper(x.codigo) = f.codigo);
```

- [ ] **Step 4: Aplicar y probar**

Run: `scripts/hq/aplicar-schema.sh --seed && python3 -m unittest scripts.hq.tests.test_02_objetivo scripts.hq.tests.test_03_frentes -v`
Expected: 5 OK. Y en producción: `python3 ~/dev/cuponsIA/scripts/plataforma/pgq.py -c "select codigo, linea from omc_plan_lineas where empresa='77delta' and activa order by codigo"` devuelve 22 filas (A1-A5, B1-B4, C1-C5, D1-D3, E1-E5).

- [ ] **Step 5: Commit**

```bash
git add scripts/hq/schema-v2.sql scripts/hq/seed-77delta-v2.sql scripts/hq/tests/
git commit -m "feat(hq): bloques y frentes con código, helpers de frente y agente"
```

---

### Task 4: Encargos v2 · columnas, avances append-only y alta con frente obligatorio

**Files:**
- Modify: `scripts/hq/schema-v2.sql` (sección T4)
- Test: `scripts/hq/tests/test_04_encargo_alta.py`

**Interfaces:**
- Consumes: `omc_frente_id`, `omc_agente_valido` (T3); `omc_encargo_set(p_token, p jsonb)` y `omc_encargo_avance(p_token, p_id, p_texto, p_agente)` de schema.sql (líneas 611 y 662).
- Produces: columnas en `omc_encargos`: `etiquetas text[]`, `enlaces jsonb` (`[{"titulo","url"}]`), `fuente_cierre text`, `entregable_url text`, `orden_kanban int`, `origen text`, `expediente_id bigint`, `motivo_descarte text`; tabla `omc_encargo_avances(id bigserial, empresa, encargo_id, autor, tipo, texto, fecha)` con trigger que impide update/delete; RPC `omc_encargo_alta(p_token, p jsonb) -> jsonb` (campos de `p`: `texto` obligatorio, `frente` obligatorio (código o id), `responsable`, `interpretacion`, `prioridad`, `etiquetas`, `enlaces`, `proximo_hito`, `fecha_hito`, `solicitud_id`, `origen`, `expediente_id`, `agente` (quien lo da de alta cuando el token es de agente); devuelve el encargo con `codigo` del frente); `omc_encargo_set` con `id` null lanza `usa omc_encargo_alta (frente obligatorio)`; `omc_encargo_avance` inserta en `omc_encargo_avances` tipo `avance` además de actualizar la caché `ultimo_avance`/`fecha_avance`, y autoriza también a `chief` y `sistema`; función interna `omc_encargo_puede(t record, e omc_encargos, v_agente text) -> boolean` con la regla de autorización compartida.

- [ ] **Step 1: Test**

```python
# scripts/hq/tests/test_04_encargo_alta.py
import unittest
from . import pg
from .pg import rpc


class TestEncargoAlta(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.t = pg.preparar_tenant()
        pg.limpiar_tenant()
        pg.sql("insert into omc_agentes (empresa, id, nombre, depto, nivel, sesiones, activo) values "
               "('pruebas','sales-licita','Guillem','licitaciones',2,array['Guillem-Licitaciones'],true), ('pruebas','chief','Marc','direccion',1,array['Marc-Chief'],true)")
        rpc(cls.t['owner'], 'omc_bloque_set', p={'letra': 'A', 'nombre': 'Licitaciones', 'orden': 1})
        rpc(cls.t['owner'], 'omc_frente_set', p={'codigo': 'A3', 'bloque': 'A', 'linea': 'Ofertas en curso', 'kpi': 'EUR', 'meta': 1})

    def test_alta_sin_frente_se_rechaza(self):
        with self.assertRaisesRegex(RuntimeError, 'falta frente'):
            rpc(self.t['owner'], 'omc_encargo_alta', p={'texto': 'Preparar oferta X'})
        with self.assertRaisesRegex(RuntimeError, 'frente Z9 no existe'):
            rpc(self.t['owner'], 'omc_encargo_alta', p={'texto': 'Preparar oferta X', 'frente': 'Z9'})

    def test_alta_con_frente_crea_encargo_y_avance_de_alta(self):
        e = rpc(self.t['owner'], 'omc_encargo_alta', p={'texto': 'Preparar oferta X', 'frente': 'a3', 'responsable': 'guillem', 'etiquetas': ['oferta', 'urgente'],
                                                         'enlaces': [{'titulo': 'pliego', 'url': 'https://docs.google.com/document/d/1'}], 'origen': 'Diego 16-09 15:30'})
        self.assertEqual(e['codigo'], 'A3'); self.assertEqual(e['agente'], 'sales-licita'); self.assertEqual(e['estado'], 'encolado')
        self.assertEqual(e['etiquetas'], ['oferta', 'urgente']); self.assertEqual(e['creado_por'], 'diego')
        av = pg.sql("select tipo, autor from omc_encargo_avances where encargo_id={0}", e['id'])
        self.assertEqual([(a['tipo'], a['autor']) for a in av], [('alta', 'diego')])

    def test_responsable_desconocido_se_rechaza(self):
        with self.assertRaisesRegex(RuntimeError, 'responsable nadie no es un agente'):
            rpc(self.t['owner'], 'omc_encargo_alta', p={'texto': 'x', 'frente': 'A3', 'responsable': 'nadie'})

    def test_encargo_set_sin_id_redirige(self):
        with self.assertRaisesRegex(RuntimeError, 'usa omc_encargo_alta'):
            rpc(self.t['owner'], 'omc_encargo_set', p={'texto': 'x'})

    def test_avance_queda_en_historial_inmutable(self):
        e = rpc(self.t['owner'], 'omc_encargo_alta', p={'texto': 'Avanzable', 'frente': 'A3', 'responsable': 'Guillem'})
        r = rpc(self.t['agente'], 'omc_encargo_avance', p_id=e['id'], p_texto='Leído el pliego', p_agente='Guillem')
        self.assertEqual(r['ultimo_avance'], 'Leído el pliego')
        rpc(self.t['agente'], 'omc_encargo_avance', p_id=e['id'], p_texto='Como chief, ok', p_agente='chief')
        n = pg.sql("select count(*) as n from omc_encargo_avances where encargo_id={0} and tipo='avance'", e['id'])[0]['n']
        self.assertEqual(int(n), 2)
        with self.assertRaisesRegex(RuntimeError, 'append-only'):
            pg.sql("delete from omc_encargo_avances where encargo_id={0}", e['id'])
        with self.assertRaisesRegex(RuntimeError, 'no autorizado'):
            rpc(self.t['agente'], 'omc_encargo_avance', p_id=e['id'], p_texto='intruso', p_agente='otro')
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `python3 -m unittest scripts.hq.tests.test_04_encargo_alta -v`
Expected: 5 FAIL.

- [ ] **Step 3: SQL**

```sql
-- T4 · encargos v2
alter table omc_encargos add column if not exists etiquetas text[] default '{}';
alter table omc_encargos add column if not exists enlaces jsonb default '[]'::jsonb;
alter table omc_encargos add column if not exists fuente_cierre text;
alter table omc_encargos add column if not exists entregable_url text;
alter table omc_encargos add column if not exists orden_kanban int default 0;
alter table omc_encargos add column if not exists origen text;
alter table omc_encargos add column if not exists expediente_id bigint;
alter table omc_encargos add column if not exists motivo_descarte text;

create table if not exists omc_encargo_avances (
  id bigserial primary key, empresa text not null references omc_empresas(id), encargo_id bigint not null references omc_encargos(id) on delete cascade,
  autor text not null, tipo text not null check (tipo in ('alta','avance','comentario_diego','estado','cierre','sistema')), texto text not null,
  fecha timestamptz default now());
create index if not exists omc_encargo_avances_enc on omc_encargo_avances (encargo_id, fecha desc);
create index if not exists omc_encargo_avances_emp on omc_encargo_avances (empresa, fecha desc);
alter table omc_encargo_avances enable row level security;
create or replace function omc_avances_inmutables() returns trigger language plpgsql as $$
begin raise exception 'omc_encargo_avances es append-only'; end $$;
drop trigger if exists omc_avances_inmutables on omc_encargo_avances;
create trigger omc_avances_inmutables before update or delete on omc_encargo_avances for each row execute function omc_avances_inmutables();

create or replace function omc_avance_insertar(p_empresa text, p_encargo bigint, p_autor text, p_tipo text, p_texto text) returns void
language sql as $$
  insert into omc_encargo_avances (empresa, encargo_id, autor, tipo, texto) values (p_empresa, p_encargo, coalesce(p_autor,'sistema'), p_tipo, p_texto);
  update omc_encargos set ultimo_avance = case when p_tipo in ('avance','cierre') then p_texto else ultimo_avance end,
    fecha_avance = case when p_tipo in ('avance','cierre') then now() else fecha_avance end, updated_at = now() where id = p_encargo;
$$;

-- regla de autorización compartida por avance/estado/hecho/tomar
create or replace function omc_encargo_puede(p_rol text, p_creado_por text, p_agente_encargo text, p_actor text) returns boolean
language sql immutable as $$
  select p_rol = 'owner' or lower(p_actor) in ('chief','sistema') or lower(p_actor) = lower(coalesce(p_creado_por,''))
    or position(lower(p_actor) in lower(coalesce(p_agente_encargo,''))) > 0;
$$;

create or replace function omc_encargo_alta(p_token text, p jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare t record; v_linea bigint; v_resp text; v_actor text; r omc_encargos;
begin
  select * into t from omc_tok(p_token);
  if coalesce(p->>'texto','') = '' then raise exception 'falta texto'; end if;
  if coalesce(p->>'frente','') = '' then raise exception 'falta frente: pasa --frente A3 (hq.py frentes)'; end if;
  v_linea := omc_frente_id(t.empresa, p->>'frente');
  if v_linea is null then raise exception 'frente % no existe o no está activo (hq.py frentes)', p->>'frente'; end if;
  v_actor := case when t.rol = 'owner' then 'diego' else coalesce(p->>'agente', 'agente') end;
  if coalesce(p->>'responsable','') <> '' then
    v_resp := omc_agente_valido(t.empresa, p->>'responsable');
    if v_resp is null then raise exception 'responsable % no es un agente activo (hq.py agente lista)', p->>'responsable'; end if;
  end if;
  insert into omc_encargos (empresa, fecha, texto, interpretacion, linea_id, departamento, agente, estado, prioridad, solicitud_id, proximo_hito, fecha_hito,
                            creado_por, etiquetas, enlaces, origen, expediente_id, mensaje_id)
  values (t.empresa, now(), p->>'texto', p->>'interpretacion', v_linea,
          (select coalesce(b.nombre, 'sin bloque') from omc_plan_lineas l left join omc_plan_bloques b on b.id = l.bloque_id where l.id = v_linea),
          v_resp, 'encolado', coalesce((p->>'prioridad')::int, 50), (p->>'solicitud_id')::bigint, p->>'proximo_hito', (p->>'fecha_hito')::date,
          v_actor, coalesce(array(select jsonb_array_elements_text(p->'etiquetas')), '{}'), coalesce(p->'enlaces', '[]'::jsonb),
          coalesce(p->>'origen', initcap(v_actor) || ' ' || to_char(now(), 'DD-MM HH24:MI')), (p->>'expediente_id')::bigint, (p->>'mensaje_id')::bigint)
  returning * into r;
  perform omc_avance_insertar(t.empresa, r.id, v_actor, 'alta', left(r.texto, 200));
  return to_jsonb(r) || jsonb_build_object('codigo', (select codigo from omc_plan_lineas where id = v_linea));
end $$;

```

Bloqueo del alta antigua: **editar `schema.sql` en la línea 611** (`omc_encargo_set`). Justo tras `select * into t from omc_tok(p_token);` añadir

```sql
  if (p->>'id') is null then raise exception 'usa omc_encargo_alta (frente obligatorio)'; end if;
```

La función de `schema.sql` sigue sirviendo para editar por id (lo usa `hq.py encargo alta --id`); el alta nueva va por `omc_encargo_alta`.

Reescritura de `omc_encargo_avance` (en `schema-v2.sql`, gana a la de schema.sql porque se aplica después):

```sql
drop function if exists omc_encargo_avance(text, bigint, text, text);
create or replace function omc_encargo_avance(p_token text, p_id bigint, p_texto text, p_agente text default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare t record; e omc_encargos; v_agente text;
begin
  select * into t from omc_tok(p_token);
  select * into e from omc_encargos where id = p_id and empresa = t.empresa;
  if e.id is null then raise exception 'encargo % no existe', p_id; end if;
  v_agente := case when t.rol = 'owner' then 'diego' else coalesce(p_agente, 'agente') end;
  if not omc_encargo_puede(t.rol, e.creado_por, e.agente, v_agente) then raise exception 'no autorizado: el encargo es de %', coalesce(e.agente, e.creado_por) using errcode='42501'; end if;
  if coalesce(trim(p_texto),'') = '' then raise exception 'falta texto'; end if;
  perform omc_avance_insertar(t.empresa, e.id, v_agente, 'avance', p_texto);
  select * into e from omc_encargos where id = p_id;
  return to_jsonb(e);
end $$;
grant execute on function omc_encargo_alta(text, jsonb), omc_encargo_avance(text, bigint, text, text) to anon, authenticated;
```

- [ ] **Step 4: Aplicar y probar**

Run: `scripts/hq/aplicar-schema.sh && python3 -m unittest scripts.hq.tests.test_04_encargo_alta -v`
Expected: 5 OK. Comprobar que la sobrecarga vieja no queda: `pgq.py -c "select oidvectortypes(proargtypes) from pg_proc where proname='omc_encargo_avance'"` devuelve una sola fila.

- [ ] **Step 5: Commit**

```bash
git add scripts/hq/schema-v2.sql scripts/hq/schema.sql scripts/hq/tests/test_04_encargo_alta.py
git commit -m "feat(hq): encargos v2 con frente obligatorio y avances append-only"
```

---

### Task 5: Puertas de cierre y flujo Kanban · hecho con fuente, estado con motivo, tomar, editar, feed

**Files:**
- Modify: `scripts/hq/schema-v2.sql` (sección T5)
- Test: `scripts/hq/tests/test_05_encargo_flujo.py`

**Interfaces:**
- Consumes: `omc_avance_insertar`, `omc_encargo_puede` (T4); tabla `omc_kit` se crea en T7, así que esta tarea crea antes un esqueleto mínimo `omc_kit` (mismas columnas que T7; T7 solo añade RPC y semilla).
- Produces: `omc_encargo_hecho(p_token, p_id, p_fuente text, p_entregable text default '', p_agente text default null) -> jsonb` (fuente válida = url de una fila `omc_kit` vigente de la empresa o url que casa `^https://(docs|drive)\.google\.com/`; si no, `fuente no válida: cita una entrada del kit (hq.py kit lista <frente>) o un Google Doc`; deja `estado='hecho'`, `fuente_cierre`, `entregable_url`, avance tipo `cierre`); `omc_encargo_estado(p_token, p_id, p_estado, p_agente text default null, p_motivo text default '')` (drop de la firma de 4 args; `hecho` se rechaza con `usa omc_encargo_hecho --fuente`; `descartado` exige `p_motivo` y lo guarda en `motivo_descarte`; inserta avance tipo `estado`); `omc_encargo_tomar(p_token, p_id, p_agente) -> jsonb` (pasa a `en_curso` si estaba `encolado`/`bloqueado_diego`, avance `estado`, devuelve `{encargo, frente, kit[], avances[≤10], contactos[], expediente}`; `contactos` y `expediente` vacíos hasta T8/T9, que solo cambian el `select`); `omc_encargo_editar(p_token, p_id, p jsonb)` (owner; campos `texto, interpretacion, prioridad, etiquetas, enlaces, proximo_hito, fecha_hito, frente, responsable, orden_kanban, expediente_id, comentario`; `comentario` inserta avance `comentario_diego`); `omc_feed(p_token, p_desde timestamptz default now()-interval '24 hours') -> jsonb[]` (avances con `encargo_id, texto_encargo, codigo, autor, tipo, texto, fecha`, ordenado desc).

- [ ] **Step 1: Test**

```python
# scripts/hq/tests/test_05_encargo_flujo.py
import unittest
from . import pg
from .pg import rpc


class TestEncargoFlujo(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.t = pg.preparar_tenant()
        pg.limpiar_tenant()
        pg.sql("insert into omc_agentes (empresa, id, nombre, depto, nivel, sesiones, activo) values ('pruebas','sales-licita','Guillem','licitaciones',2,array['Guillem-Licitaciones'],true)")
        rpc(cls.t['owner'], 'omc_bloque_set', p={'letra': 'A', 'nombre': 'Licitaciones', 'orden': 1})
        cls.f = rpc(cls.t['owner'], 'omc_frente_set', p={'codigo': 'A3', 'bloque': 'A', 'linea': 'Ofertas en curso', 'kpi': 'EUR', 'meta': 1})
        pg.sql("insert into omc_kit (empresa, linea_id, tipo, nombre, url, vigente, actualizado_por) values ('pruebas', {0}, 'plantilla', 'Plantilla oferta', 'https://example.com/kit/oferta', true, 'test')", cls.f['id'])

    def nuevo(self, texto='Oferta'):
        return rpc(self.t['owner'], 'omc_encargo_alta', p={'texto': texto, 'frente': 'A3', 'responsable': 'Guillem'})

    def test_tomar_pasa_a_en_curso_y_devuelve_contexto(self):
        e = self.nuevo()
        ctx = rpc(self.t['agente'], 'omc_encargo_tomar', p_id=e['id'], p_agente='Guillem')
        self.assertEqual(ctx['encargo']['estado'], 'en_curso'); self.assertEqual(ctx['frente']['codigo'], 'A3')
        self.assertEqual([k['nombre'] for k in ctx['kit']], ['Plantilla oferta'])
        self.assertEqual([a['tipo'] for a in ctx['avances']], ['estado', 'alta'])

    def test_hecho_exige_fuente_valida(self):
        e = self.nuevo()
        with self.assertRaisesRegex(RuntimeError, 'fuente no válida'):
            rpc(self.t['agente'], 'omc_encargo_hecho', p_id=e['id'], p_fuente='lo hice bien', p_agente='Guillem')
        with self.assertRaisesRegex(RuntimeError, 'usa omc_encargo_hecho'):
            rpc(self.t['agente'], 'omc_encargo_estado', p_id=e['id'], p_estado='hecho', p_agente='Guillem')
        r = rpc(self.t['agente'], 'omc_encargo_hecho', p_id=e['id'], p_fuente='https://example.com/kit/oferta', p_entregable='https://docs.google.com/document/d/abc', p_agente='Guillem')
        self.assertEqual(r['estado'], 'hecho'); self.assertEqual(r['fuente_cierre'], 'https://example.com/kit/oferta')
        e2 = self.nuevo()
        r2 = rpc(self.t['agente'], 'omc_encargo_hecho', p_id=e2['id'], p_fuente='https://docs.google.com/document/d/xyz/edit', p_agente='Guillem')
        self.assertEqual(r2['estado'], 'hecho')
        tipos = [a['tipo'] for a in pg.sql("select tipo from omc_encargo_avances where encargo_id={0} order by id", e['id'])]
        self.assertEqual(tipos, ['alta', 'cierre'])

    def test_descartar_exige_motivo(self):
        e = self.nuevo()
        with self.assertRaisesRegex(RuntimeError, 'falta motivo'):
            rpc(self.t['owner'], 'omc_encargo_estado', p_id=e['id'], p_estado='descartado')
        r = rpc(self.t['owner'], 'omc_encargo_estado', p_id=e['id'], p_estado='descartado', p_motivo='duplicado de #1')
        self.assertEqual(r['motivo_descarte'], 'duplicado de #1')

    def test_editar_solo_owner_y_comentario_queda_en_feed(self):
        e = self.nuevo('Editable')
        with self.assertRaisesRegex(RuntimeError, 'solo owner'):
            rpc(self.t['agente'], 'omc_encargo_editar', p_id=e['id'], p={'texto': 'x'})
        r = rpc(self.t['owner'], 'omc_encargo_editar', p_id=e['id'], p={'texto': 'Editado', 'etiquetas': ['a'], 'orden_kanban': 3, 'comentario': 'Prioridad alta, Guillem'})
        self.assertEqual(r['texto'], 'Editado'); self.assertEqual(r['orden_kanban'], 3)
        feed = rpc(self.t['agente'], 'omc_feed')
        mio = [f for f in feed if f['encargo_id'] == e['id']]
        self.assertEqual(mio[0]['tipo'], 'comentario_diego'); self.assertEqual(mio[0]['codigo'], 'A3')
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `python3 -m unittest scripts.hq.tests.test_05_encargo_flujo -v`
Expected: FAIL (`omc_kit` no existe).

- [ ] **Step 3: SQL**

```sql
-- T5 · kit (tabla; RPC en T7) y flujo de encargos
create table if not exists omc_kit (
  id bigserial primary key, empresa text not null references omc_empresas(id), linea_id bigint references omc_plan_lineas(id) on delete set null,
  tipo text not null check (tipo in ('plantilla','oficial','procedimiento','regla')), nombre text not null, url text, texto text,
  version text default '1', vigente boolean default true, actualizado_por text, fecha timestamptz default now());
create index if not exists omc_kit_emp on omc_kit (empresa, linea_id) where vigente;
alter table omc_kit enable row level security;

create or replace function omc_fuente_valida(p_empresa text, p_fuente text) returns boolean
language sql stable as $$
  select p_fuente ~ '^https://(docs|drive)\.google\.com/'
      or exists (select 1 from omc_kit k where k.empresa = p_empresa and k.vigente and k.url is not null and k.url = trim(p_fuente));
$$;

create or replace function omc_encargo_hecho(p_token text, p_id bigint, p_fuente text, p_entregable text default '', p_agente text default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare t record; e omc_encargos; v_agente text;
begin
  select * into t from omc_tok(p_token);
  select * into e from omc_encargos where id = p_id and empresa = t.empresa;
  if e.id is null then raise exception 'encargo % no existe', p_id; end if;
  v_agente := case when t.rol = 'owner' then 'diego' else coalesce(p_agente, 'agente') end;
  if not omc_encargo_puede(t.rol, e.creado_por, e.agente, v_agente) then raise exception 'no autorizado: el encargo es de %', coalesce(e.agente, e.creado_por) using errcode='42501'; end if;
  if not omc_fuente_valida(t.empresa, coalesce(p_fuente,'')) then
    raise exception 'fuente no válida: cita una entrada del kit (hq.py kit lista %) o un Google Doc', coalesce((select codigo from omc_plan_lineas where id = e.linea_id), '<frente>');
  end if;
  update omc_encargos set estado = 'hecho', fuente_cierre = trim(p_fuente), entregable_url = nullif(trim(coalesce(p_entregable,'')), ''), espera = null where id = e.id;
  perform omc_avance_insertar(t.empresa, e.id, v_agente, 'cierre', 'hecho · fuente ' || trim(p_fuente) || case when coalesce(p_entregable,'') <> '' then ' · entregable ' || p_entregable else '' end);
  select * into e from omc_encargos where id = p_id;
  return to_jsonb(e);
end $$;

drop function if exists omc_encargo_estado(text, bigint, text, text);
create or replace function omc_encargo_estado(p_token text, p_id bigint, p_estado text, p_agente text default null, p_motivo text default '') returns jsonb
language plpgsql security definer set search_path=public as $$
declare t record; e omc_encargos; v_agente text;
begin
  select * into t from omc_tok(p_token);
  select * into e from omc_encargos where id = p_id and empresa = t.empresa;
  if e.id is null then raise exception 'encargo % no existe', p_id; end if;
  v_agente := case when t.rol = 'owner' then 'diego' else coalesce(p_agente, 'agente') end;
  if not omc_encargo_puede(t.rol, e.creado_por, e.agente, v_agente) then raise exception 'no autorizado: el encargo es de %', coalesce(e.agente, e.creado_por) using errcode='42501'; end if;
  if p_estado = 'hecho' then raise exception 'usa omc_encargo_hecho --fuente <url del kit o Google Doc>'; end if;
  if p_estado not in ('encolado','en_curso','bloqueado_diego','descartado') then raise exception 'estado % no válido', p_estado; end if;
  if p_estado = 'descartado' and coalesce(trim(p_motivo),'') = '' then raise exception 'falta motivo: --motivo "por qué se descarta"'; end if;
  update omc_encargos set estado = p_estado, motivo_descarte = case when p_estado = 'descartado' then trim(p_motivo) else motivo_descarte end where id = e.id;
  perform omc_avance_insertar(t.empresa, e.id, v_agente, 'estado', e.estado || ' -> ' || p_estado || case when coalesce(p_motivo,'') <> '' then ' · ' || p_motivo else '' end);
  select * into e from omc_encargos where id = p_id;
  return to_jsonb(e);
end $$;

create or replace function omc_encargo_contexto(p_empresa text, p_id bigint) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'encargo', (select to_jsonb(e) || jsonb_build_object('codigo', l.codigo) from omc_encargos e left join omc_plan_lineas l on l.id = e.linea_id where e.id = p_id),
    'frente', (select jsonb_build_object('id', l.id, 'codigo', l.codigo, 'linea', l.linea, 'kpi', l.kpi, 'meta', l.meta, 'valor_actual', l.valor_actual, 'responsable', l.responsable,
                 'bloque', b.letra || ' ' || b.nombre) from omc_encargos e join omc_plan_lineas l on l.id = e.linea_id left join omc_plan_bloques b on b.id = l.bloque_id where e.id = p_id),
    'kit', (select coalesce(jsonb_agg(jsonb_build_object('id', k.id, 'tipo', k.tipo, 'nombre', k.nombre, 'url', k.url, 'texto', k.texto) order by k.tipo, k.nombre), '[]'::jsonb)
              from omc_kit k where k.empresa = p_empresa and k.vigente and (k.linea_id is null or k.linea_id = (select linea_id from omc_encargos where id = p_id))),
    'avances', (select coalesce(jsonb_agg(to_jsonb(a) order by a.fecha desc), '[]'::jsonb) from (select * from omc_encargo_avances where encargo_id = p_id order by fecha desc limit 10) a),
    'contactos', '[]'::jsonb,
    'expediente', null);
$$;

create or replace function omc_encargo_tomar(p_token text, p_id bigint, p_agente text default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare t record; e omc_encargos; v_agente text;
begin
  select * into t from omc_tok(p_token);
  select * into e from omc_encargos where id = p_id and empresa = t.empresa;
  if e.id is null then raise exception 'encargo % no existe', p_id; end if;
  v_agente := case when t.rol = 'owner' then 'diego' else coalesce(p_agente, 'agente') end;
  if not omc_encargo_puede(t.rol, e.creado_por, e.agente, v_agente) then raise exception 'no autorizado: el encargo es de %', coalesce(e.agente, e.creado_por) using errcode='42501'; end if;
  if e.estado in ('encolado','bloqueado_diego') then
    update omc_encargos set estado = 'en_curso', agente = coalesce(agente, omc_agente_valido(t.empresa, v_agente), v_agente) where id = e.id;
    perform omc_avance_insertar(t.empresa, e.id, v_agente, 'estado', e.estado || ' -> en_curso (tomado)');
  end if;
  return omc_encargo_contexto(t.empresa, e.id);
end $$;

create or replace function omc_encargo_editar(p_token text, p_id bigint, p jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare t record; e omc_encargos; v_linea bigint; v_resp text;
begin
  select * into t from omc_tok(p_token);
  if t.rol <> 'owner' then raise exception 'solo owner' using errcode='42501'; end if;
  select * into e from omc_encargos where id = p_id and empresa = t.empresa;
  if e.id is null then raise exception 'encargo % no existe', p_id; end if;
  if p ? 'frente' then v_linea := omc_frente_id(t.empresa, p->>'frente'); if v_linea is null then raise exception 'frente % no existe', p->>'frente'; end if; end if;
  if p ? 'responsable' then v_resp := omc_agente_valido(t.empresa, p->>'responsable'); if v_resp is null then raise exception 'responsable % no es un agente activo', p->>'responsable'; end if; end if;
  update omc_encargos set
    texto = coalesce(p->>'texto', texto), interpretacion = coalesce(p->>'interpretacion', interpretacion), prioridad = coalesce((p->>'prioridad')::int, prioridad),
    etiquetas = case when p ? 'etiquetas' then array(select jsonb_array_elements_text(p->'etiquetas')) else etiquetas end,
    enlaces = coalesce(p->'enlaces', enlaces), proximo_hito = coalesce(p->>'proximo_hito', proximo_hito), fecha_hito = coalesce((p->>'fecha_hito')::date, fecha_hito),
    linea_id = coalesce(v_linea, linea_id), agente = coalesce(v_resp, agente), orden_kanban = coalesce((p->>'orden_kanban')::int, orden_kanban),
    expediente_id = coalesce((p->>'expediente_id')::bigint, expediente_id), updated_at = now()
  where id = e.id returning * into e;
  if coalesce(p->>'comentario','') <> '' then perform omc_avance_insertar(t.empresa, e.id, 'diego', 'comentario_diego', p->>'comentario'); end if;
  return to_jsonb(e) || jsonb_build_object('codigo', (select codigo from omc_plan_lineas where id = e.linea_id));
end $$;

create or replace function omc_feed(p_token text, p_desde timestamptz default now() - interval '24 hours') returns jsonb
language sql security definer set search_path=public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'encargo_id', a.encargo_id, 'texto_encargo', left(e.texto, 80), 'codigo', l.codigo, 'agente', e.agente,
    'autor', a.autor, 'tipo', a.tipo, 'texto', a.texto, 'fecha', a.fecha) order by a.fecha desc), '[]'::jsonb)
  from omc_encargo_avances a join omc_encargos e on e.id = a.encargo_id left join omc_plan_lineas l on l.id = e.linea_id
  where a.empresa = (select empresa from omc_tok(p_token)) and a.fecha >= p_desde;
$$;
grant execute on function omc_encargo_hecho(text, bigint, text, text, text), omc_encargo_estado(text, bigint, text, text, text), omc_encargo_tomar(text, bigint, text),
  omc_encargo_editar(text, bigint, jsonb), omc_feed(text, timestamptz) to anon, authenticated;
```

- [ ] **Step 4: Aplicar y probar**

Run: `scripts/hq/aplicar-schema.sh && python3 -m unittest discover -s scripts/hq/tests -p 'test_0*.py' -v`
Expected: todos OK. `pgq.py -c "select oidvectortypes(proargtypes) from pg_proc where proname='omc_encargo_estado'"` devuelve una sola fila con 5 tipos.

- [ ] **Step 5: Commit**

```bash
git add scripts/hq/schema-v2.sql scripts/hq/tests/test_05_encargo_flujo.py
git commit -m "feat(hq): puertas de cierre (fuente, motivo), tomar, editar y feed"
```

---

### Task 6: CLI v2 · módulo `hq_v2.py` con frentes, bloques, encargo alta/tomar/hecho, estado --motivo y feed

**Files:**
- Create: `scripts/hq/hq_v2.py`
- Modify: `scripts/hq/hq.py:204` (`engram()` respeta `HQ_ENGRAM_OFF`), `:277` (registro de subparsers), `:349-363` (parser `encargo`), `:837-860` (despacho `encargo`)
- Test: `scripts/hq/tests/test_06_cli.py`

**Interfaces:**
- Consumes: `rpc(fn, **params)`, `E`, `agente_actual(explicito)`, `engram(titulo, texto)` de hq.py; RPC de T3-T5.
- Produces: en `hq_v2.py`: `registrar(sub, esub)` (añade parsers `frentes`, `bloques`, `feed`, y a `esub` los subcomandos `tomar`, `hecho`, `editar`; amplía `alta` con `--frente`, `--etiqueta` repetible, `--enlace TITULO=URL` repetible, `--origen`; amplía `estado` con `--motivo`), `ejecutar(a, ctx) -> bool` (devuelve True si atendió el comando; `ctx` es un dict con `rpc, E, agente_actual, engram, json`). Comandos:
  - `hq.py frentes [--bloque A]`: `A3  Ofertas en curso · EUR presentados 0/200000 · Guillem · 12 abiertos`
  - `hq.py bloques`
  - `hq.py encargo alta --texto ... --frente A3 [--responsable Guillem] [--etiqueta x]... [--enlace pliego=https://...] [--prioridad N] [--fecha-hito YYYY-MM-DD] [--proximo-hito ...] [--tarjeta N] [--origen "Diego 16-09 15:30"]` → llama `omc_encargo_alta`. Con `--id` sigue llamando a `omc_encargo_set` (edición v1).
  - `hq.py encargo tomar ID [--agente X]` → imprime contexto: encargo, frente, kit (una línea por entrada), últimos avances.
  - `hq.py encargo hecho ID --fuente URL [--entregable URL] [--agente X]`.
  - `hq.py encargo estado ID VALOR [--motivo "..."] [--agente X]` (VALOR sin `hecho`).
  - `hq.py encargo editar ID [--texto] [--prioridad] [--frente] [--responsable] [--orden N] [--etiqueta]... [--comentario "..."]` (owner).
  - `hq.py feed [--desde "2026-09-16 07:00"]`.

- [ ] **Step 1: Test por subprocess**

```python
# scripts/hq/tests/test_06_cli.py
import json, subprocess, sys, unittest
from pathlib import Path
from . import pg
from .pg import rpc

HQ = str(Path(__file__).resolve().parents[1] / 'hq.py')


def cli(rol, *args):
    p = subprocess.run([sys.executable, HQ, '--json', *args], env=pg.entorno_cli(rol), capture_output=True, text=True)
    return p.returncode, p.stdout.strip(), p.stderr.strip()


class TestCli(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.t = pg.preparar_tenant()
        pg.limpiar_tenant()
        pg.sql("insert into omc_agentes (empresa, id, nombre, depto, nivel, sesiones, activo) values ('pruebas','sales-licita','Guillem','licitaciones',2,array['Guillem-Licitaciones'],true)")
        rpc(cls.t['owner'], 'omc_bloque_set', p={'letra': 'A', 'nombre': 'Licitaciones', 'orden': 1})
        rpc(cls.t['owner'], 'omc_frente_set', p={'codigo': 'A3', 'bloque': 'A', 'linea': 'Ofertas en curso', 'kpi': 'EUR', 'meta': 200000})

    def test_frentes_lista(self):
        rc, out, _ = cli('agente', 'frentes')
        self.assertEqual(rc, 0); self.assertEqual(json.loads(out)[0]['codigo'], 'A3')

    def test_alta_sin_frente_falla_con_pista(self):
        rc, out, err = cli('owner', 'encargo', 'alta', '--texto', 'Sin frente')
        self.assertNotEqual(rc, 0); self.assertIn('falta frente', out + err)

    def test_alta_tomar_hecho(self):
        rc, out, err = cli('owner', 'encargo', 'alta', '--texto', 'Oferta CLI', '--frente', 'A3', '--responsable', 'Guillem', '--etiqueta', 'oferta', '--enlace', 'pliego=https://docs.google.com/document/d/1')
        self.assertEqual(rc, 0, err); e = json.loads(out); self.assertEqual(e['codigo'], 'A3'); self.assertEqual(e['enlaces'][0]['titulo'], 'pliego')
        rc, out, err = cli('agente', 'encargo', 'tomar', str(e['id']), '--agente', 'Guillem')
        self.assertEqual(rc, 0, err); self.assertEqual(json.loads(out)['encargo']['estado'], 'en_curso')
        rc, out, err = cli('agente', 'encargo', 'hecho', str(e['id']), '--fuente', 'sin url', '--agente', 'Guillem')
        self.assertNotEqual(rc, 0); self.assertIn('fuente no válida', out + err)
        rc, out, err = cli('agente', 'encargo', 'hecho', str(e['id']), '--fuente', 'https://docs.google.com/document/d/2', '--agente', 'Guillem')
        self.assertEqual(rc, 0, err); self.assertEqual(json.loads(out)['estado'], 'hecho')
        rc, out, err = cli('agente', 'feed', '--desde', '2026-01-01')
        self.assertEqual(rc, 0, err); self.assertEqual(json.loads(out)[0]['tipo'], 'cierre')

    def test_estado_descartado_pide_motivo(self):
        rc, out, _ = cli('owner', 'encargo', 'alta', '--texto', 'Para descartar', '--frente', 'A3'); e = json.loads(out)
        rc, out, err = cli('owner', 'encargo', 'estado', str(e['id']), 'descartado')
        self.assertNotEqual(rc, 0); self.assertIn('falta motivo', out + err)
        rc, out, err = cli('owner', 'encargo', 'estado', str(e['id']), 'descartado', '--motivo', 'duplicado')
        self.assertEqual(rc, 0, err)
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `python3 -m unittest scripts.hq.tests.test_06_cli -v`
Expected: FAIL (`frentes` no es un subcomando; `--frente` desconocido).

- [ ] **Step 3: Escribir `hq_v2.py`**

```python
# scripts/hq/hq_v2.py
"""Subcomandos HQ v2 (fuente única en cascada). hq.py los registra con registrar() y delega con ejecutar().
Plan: docs/superpowers/plans/2026-09-16-hq-v2-plan-1-base.md"""
import json

ESTADOS_ESTADO = ('encolado', 'en_curso', 'bloqueado_diego', 'descartado')


def _enlaces(lista):
    out = []
    for x in lista or []:
        if '=' not in x:
            raise SystemExit(f'--enlace espera TITULO=URL, no "{x}"')
        t, u = x.split('=', 1)
        out.append({'titulo': t.strip(), 'url': u.strip()})
    return out


def registrar(sub, esub):
    f = sub.add_parser('frentes', help='frentes del plan (código, KPI, responsable, encargos abiertos)')
    f.add_argument('--bloque', help='letra del bloque (A..E)')
    sub.add_parser('bloques', help='bloques estratégicos con meta y director')
    fe = sub.add_parser('feed', help='actividad de encargos (avances, comentarios de Diego, cambios de estado)')
    fe.add_argument('--desde', help='fecha u hora ISO; por defecto últimas 24 h')
    # ampliaciones de encargo alta / estado (los parsers los creó hq.py)
    ea, ee = esub.choices['alta'], esub.choices['estado']
    ea.add_argument('--frente', help='código del frente (A3) o id de línea; obligatorio en altas nuevas')
    ea.add_argument('--etiqueta', action='append', default=[], help='repetible')
    ea.add_argument('--enlace', action='append', default=[], help='TITULO=URL, repetible')
    ea.add_argument('--origen', help='"Diego 16-09 15:30" o de dónde nace la petición')
    ee.add_argument('--motivo', default='', help='obligatorio al descartar')
    et = esub.add_parser('tomar', help='pasar a en_curso y recibir el contexto (frente, kit, avances, contactos, expediente)')
    et.add_argument('id', type=int); et.add_argument('--agente')
    eh = esub.add_parser('hecho', help='cerrar con fuente citada (url del kit o Google Doc)')
    eh.add_argument('id', type=int); eh.add_argument('--fuente', required=True); eh.add_argument('--entregable', default=''); eh.add_argument('--agente')
    ed = esub.add_parser('editar', help='(Diego) editar la tarjeta del tablero')
    ed.add_argument('id', type=int)
    for k in ('--texto', '--interpretacion', '--frente', '--responsable', '--proximo-hito', '--fecha-hito', '--comentario'):
        ed.add_argument(k)
    ed.add_argument('--prioridad', type=int); ed.add_argument('--orden', type=int); ed.add_argument('--etiqueta', action='append')


def _linea_encargo(e):
    return f"[{e.get('codigo') or '?'}] " if e.get('codigo') else ''


def ejecutar(a, c):
    rpc, E, agente_actual, engram = c['rpc'], c['E'], c['agente_actual'], c['engram']
    salida = lambda r, txt: print(json.dumps(r, ensure_ascii=False) if a.json else txt)
    if a.cmd == 'frentes':
        fs = rpc('omc_frentes_lista', p_token=E['HQ_TOKEN'], p_bloque=a.bloque)
        salida(fs, '\n'.join(f"{f['codigo']:<4} {f['linea']} · {f['kpi']} {f['valor_actual']}/{f['meta']} {f['unidad']} · {f.get('responsable') or '-'} · {f['encargos_abiertos']} abiertos" for f in fs))
        return True
    if a.cmd == 'bloques':
        bs = rpc('omc_bloques_lista', p_token=E['HQ_TOKEN'])
        salida(bs, '\n'.join(f"{b['letra']} {b['nombre']} · meta {b['meta_eur']} EUR · {b.get('director') or '-'} · {b['frentes']} frentes · {b['encargos_abiertos']} abiertos" for b in bs))
        return True
    if a.cmd == 'feed':
        args = {'p_token': E['HQ_TOKEN']}
        if a.desde: args['p_desde'] = a.desde
        fs = rpc('omc_feed', **args)
        salida(fs, '\n'.join(f"{f['fecha'][:16]} #{f['encargo_id']} {_linea_encargo(f)}{f['autor']} {f['tipo']}: {f['texto'][:100]}" for f in fs))
        return True
    if a.cmd != 'encargo':
        return False
    if a.sub == 'alta' and a.id is None:
        p = {k: v for k, v in {'texto': a.texto, 'interpretacion': a.interpretacion, 'frente': a.frente, 'responsable': a.responsable, 'prioridad': a.prioridad,
                               'solicitud_id': a.tarjeta, 'proximo_hito': a.proximo_hito, 'fecha_hito': a.fecha_hito, 'agente': agente_actual(a.agente),
                               'origen': a.origen, 'mensaje_id': a.mensaje}.items() if v is not None}
        if a.etiqueta: p['etiquetas'] = a.etiqueta
        if a.enlace: p['enlaces'] = _enlaces(a.enlace)
        r = rpc('omc_encargo_alta', p_token=E['HQ_TOKEN'], p=p)
        engram(f"[ENCARGO #{r['id']}] alta", f"{r['texto']} · frente {r.get('codigo')} · {r.get('agente') or 'sin responsable'} · {r['estado']}")
        salida(r, f"#{r['id']} [{r['estado']}] {_linea_encargo(r)}{r['texto'][:60]} · {r.get('agente') or 'sin responsable'}")
        return True
    if a.sub == 'tomar':
        r = rpc('omc_encargo_tomar', p_token=E['HQ_TOKEN'], p_id=a.id, p_agente=agente_actual(a.agente))
        e, fr = r['encargo'], r.get('frente') or {}
        txt = [f"#{e['id']} [{e['estado']}] {_linea_encargo(e)}{e['texto']}", f"frente: {fr.get('codigo')} {fr.get('linea')} · KPI {fr.get('kpi')} {fr.get('valor_actual')}/{fr.get('meta')} · bloque {fr.get('bloque')}"]
        txt += [f"kit · {k['tipo']}: {k['nombre']} {k.get('url') or ''}".rstrip() for k in r['kit']] or ['kit · (vacío: pide al chief la plantilla antes de producir nada)']
        txt += [f"avance {x['fecha'][:16]} {x['autor']} {x['tipo']}: {x['texto'][:100]}" for x in r['avances']]
        if r.get('expediente'): txt.append(f"expediente: #{r['expediente']['id']} {r['expediente']['nombre']} · ficha {r['expediente'].get('ficha_url') or '-'}")
        engram(f"[ENCARGO #{a.id}] tomado", agente_actual(a.agente))
        salida(r, '\n'.join(txt))
        return True
    if a.sub == 'hecho':
        r = rpc('omc_encargo_hecho', p_token=E['HQ_TOKEN'], p_id=a.id, p_fuente=a.fuente, p_entregable=a.entregable, p_agente=agente_actual(a.agente))
        engram(f"[ENCARGO #{a.id}] hecho", f"fuente {a.fuente} · entregable {a.entregable or '-'}")
        salida(r, f"#{r['id']} -> hecho · fuente {r['fuente_cierre']}")
        return True
    if a.sub == 'estado':
        r = rpc('omc_encargo_estado', p_token=E['HQ_TOKEN'], p_id=a.id, p_estado=a.valor, p_agente=agente_actual(a.agente), p_motivo=a.motivo)
        engram(f"[ENCARGO #{a.id}] estado", f"-> {a.valor}" + (f" · {a.motivo}" if a.motivo else ''))
        salida(r, f"#{r['id']} -> {r['estado']}")
        return True
    if a.sub == 'editar':
        p = {k: v for k, v in {'texto': a.texto, 'interpretacion': a.interpretacion, 'frente': a.frente, 'responsable': a.responsable, 'proximo_hito': a.proximo_hito,
                               'fecha_hito': a.fecha_hito, 'comentario': a.comentario, 'prioridad': a.prioridad, 'orden_kanban': a.orden, 'etiquetas': a.etiqueta}.items() if v is not None}
        r = rpc('omc_encargo_editar', p_token=E.get('HQ_OWNER_TOKEN') or E['HQ_TOKEN'], p_id=a.id, p=p)
        salida(r, f"#{r['id']} editado · {_linea_encargo(r)}{r['texto'][:60]}")
        return True
    return False
```

- [ ] **Step 4: Enganchar en `hq.py`**

1. Línea 204, primera línea del cuerpo de `engram()`: `if os.environ.get('HQ_ENGRAM_OFF'): return`.
2. Tras el bloque de parsers de `encargo` (línea 363, después de `esub.add_parser('lista', ...)`): `import hq_v2; hq_v2.registrar(sub, esub)`. (La importación va arriba del fichero, junto al resto: `import hq_v2` funciona porque `hq.py` y `hq_v2.py` comparten carpeta; si `sys.path[0]` no es la carpeta del script, añadir `sys.path.insert(0, str(Path(__file__).parent))` antes.)
3. En el despacho, justo antes de `elif a.cmd == 'encargo':` (línea 837), añadir una rama previa que delegue:

```python
    elif a.cmd in ('frentes', 'bloques', 'feed') or (a.cmd == 'encargo' and (a.sub in ('tomar', 'hecho', 'editar', 'estado') or (a.sub == 'alta' and a.id is None))):
        hq_v2.ejecutar(a, {'rpc': rpc, 'E': E, 'agente_actual': agente_actual, 'engram': engram})
```

El `elif a.cmd == 'encargo'` original queda debajo y sigue atendiendo `alta --id`, `avance`, `prioridad` y `lista`. La rama vieja de `estado` (línea 853-856) queda muerta: borrarla. En el parser `estado` (línea 359) quitar `'hecho'` de `choices`.

- [ ] **Step 5: Probar**

Run: `python3 -m unittest scripts.hq.tests.test_06_cli -v && python3 scripts/hq/hq.py frentes | head -3`
Expected: 4 OK y tres frentes de 77 Delta en pantalla.

- [ ] **Step 6: Commit**

```bash
git add scripts/hq/hq_v2.py scripts/hq/hq.py scripts/hq/tests/test_06_cli.py
git commit -m "feat(hq): CLI v2 (frentes, bloques, encargo alta --frente, tomar, hecho --fuente, feed)"
```

---

### Task 7: Migración de los 226 encargos sin frente y normalización de departamentos

**Files:**
- Create: `scripts/hq/migrar-encargos-frente.py`
- Test: `scripts/hq/tests/test_07_migracion.py` (unitario, sin base de datos)

**Interfaces:**
- Produces: `clasificar(texto, responsable, departamento) -> tuple[str | None, str]` (código de frente o None, y el motivo: `regla:<patrón>`, `responsable:<nombre>`, `departamento:<depto>` o `sin regla`); `depto_canonico(departamento, codigo) -> str`; CLI `--dry-run` (CSV `id;estado;codigo;motivo;texto` en `$SCRATCHPAD/migracion-encargos.csv` o `/tmp/claude-1000/.../scratchpad`), `--aplicar` (actualiza `linea_id`, `departamento` y añade avance `sistema` "frente asignado por migración 17-sep: <motivo>"), `--asignar 123=A3,124=E4` (fuerza casos manuales; se aplica antes que las reglas).
- Tras aplicar, `schema-v2.sql` añade el `check` de la Tarea 7 Step 5.

- [ ] **Step 1: Test unitario de la clasificación**

```python
# scripts/hq/tests/test_07_migracion.py
import importlib.util, unittest
from pathlib import Path

ruta = Path(__file__).resolve().parents[1] / 'migrar-encargos-frente.py'
spec = importlib.util.spec_from_file_location('migrar', ruta); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)


class TestClasificar(unittest.TestCase):
    def test_reglas_por_texto(self):
        casos = [('Cubrir las fuentes de todas las CCAA en el motor', 'ariadna', '', 'A1'), ('Leer el art. 76 del pliego antes de proponer', 'guillem', '', 'A2'),
                 ('Base de colaboradores para UTE', 'biel', '', 'A4'), ('Sobre digital de la oferta de San Fernando', 'laia', '', 'A3'),
                 ('Memoria ACCIÓ Exploració', 'helena', '', 'B1'), ('Ficha del Cupó IA de Nora Fuchs', 'martí', '', 'B2'), ('Kit Digital y CDTI', 'clara', '', 'B3'),
                 ('Inscripción FUNDAE bonificada', 'ferran', '', 'B4'), ('Reunión con el ayuntamiento', 'biel', '', 'C1'), ('Contrato menor de formación', 'biel', '', 'C2'),
                 ('Propuesta a Peninsula', 'diego', '', 'C3'), ('Auditoría LeakAI para clínica', 'ona', '', 'C4'), ('Campaña LinkedIn Swarmix segundo toque', 'aina', '', 'C5'),
                 ('Landing de Licita producto', 'joana', '', 'D1'), ('Stripe de Regulia', 'marina', '', 'D2'), ('Contestia pricing', 'diego', '', 'D3'),
                 ('Alta en epígrafes IAE de telecos', 'ferran', '', 'E1'), ('Solvencia y facturación de NGA', 'teresa', '', 'E2'),
                 ('Relanzar la ventana tmux del agente', 'pol', '', 'E3'), ('Informe de las 7 desde HQ', 'chief', '', 'E4'), ('Firma de correo con la marca', 'mireia', '', 'E5')]
        for texto, resp, depto, esperado in casos:
            with self.subTest(texto=texto):
                self.assertEqual(m.clasificar(texto, resp, depto)[0], esperado)

    def test_fallback_por_responsable_y_departamento(self):
        self.assertEqual(m.clasificar('cosa sin palabras clave', 'guillem', ''), ('A3', 'responsable:guillem'))
        self.assertEqual(m.clasificar('cosa sin palabras clave', 'desconocido', 'grants'), ('B3', 'departamento:grants'))
        self.assertEqual(m.clasificar('cosa sin palabras clave', '', ''), (None, 'sin regla'))

    def test_orden_de_reglas_el_especifico_gana(self):
        self.assertEqual(m.clasificar('licitación: leer art. 76 del pliego', 'guillem', '')[0], 'A2')
        self.assertEqual(m.clasificar('landing de Licita producto', 'mireia', '')[0], 'D1')

    def test_departamento_canonico(self):
        self.assertEqual(m.depto_canonico('sales', 'A3'), 'licitaciones'); self.assertEqual(m.depto_canonico('bizdev', 'C5'), 'comercial')
        self.assertEqual(m.depto_canonico('', 'E4'), 'hq'); self.assertEqual(m.depto_canonico('grants', 'B1'), 'subvenciones')
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `python3 -m unittest scripts.hq.tests.test_07_migracion -v`
Expected: FAIL (fichero no existe).

- [ ] **Step 3: Script**

```python
#!/usr/bin/env python3
# scripts/hq/migrar-encargos-frente.py
"""Asigna frente (omc_plan_lineas.codigo) a los encargos de 77delta sin linea_id y normaliza departamentos.
Uso: --dry-run (CSV en scratchpad) | --aplicar [--asignar 123=A3,124=E4]. Usa la service key del portal (como pgq.py); no imprime claves."""
import argparse, csv, json, os, re, sys, urllib.request

EMPRESA = os.environ.get('HQ_EMPRESA', '77delta')
# orden importa: la primera regla que casa gana. Específicas antes que genéricas.
REGLAS = [
    ('A2', r'crib|elegib|art\.? ?76|rolece|reli\b|checklist de (elegib|viab)'), ('A1', r'fuentes?\b.*(ccaa|licitaci|feed)|placsp|detecci[oó]n|motor de licitaciones|scraper'),
    ('A4', r'colaborador|\bute\b|freelance|referee|jaume|oriol'), ('D1', r'licita producto|licita\.app|landing de licita|demo de licita'),
    ('A3', r'licitaci|oferta|pliego|sobre digital|deuc|segipsa|\bdgt\b|san fernando|\bcvc\b|durango|memoria t[eé]cnica'),
    ('B1', r'acci[oó]|exploraci[oó]|cambra|\been\b'), ('B2', r'cup[oó]n?s? ia|cup[oó] ia|nora|one ?hub|aresa|zimeron|epic|ipae|\bacta\b'),
    ('B4', r'fundae|bonificad|formaci[oó]n programada'), ('B3', r'subvenci|europe|kit digital|kit consulting|cdti|convocatoria'),
    ('C1', r'ayuntamient|municip|diputaci'), ('C2', r'contrato menor|\bmenor(es)?\b'), ('C3', r'peninsula|consultor[ií]a|moncon'), ('C4', r'\bciber|leakai|auditor[ií]a de chatbot'),
    ('C5', r'prospecci|outreach|linkedin|seguimiento|campa[nñ]a|\blead|swarmix|toque'), ('D2', r'regulia|stripe'), ('D3', r'contestia|instantexam|canto|scoreflow|contablia|corpora|radar'),
    ('E1', r'\biae\b|\biso\b|\bens\b|certific|ep[ií]grafe|habilitaci'), ('E2', r'solvencia|factur|banco|santander|finom|capital|contab|fiscal|patrimonio'),
    ('E3', r'agente|ventana|tmux|cuenta|ahorro|relanzar|onboarding|alias'), ('E4', r'\bhq\b|tarjeta|encargo|backlog|informe|engram|memoria|cron|latido|webapp|spec'),
    ('E5', r'\bweb\b|marca|firma|logo|landing|seo'),
]
RESPONSABLE = {'guillem': 'A3', 'laia': 'A3', 'roger': 'A3', 'ariadna': 'A1', 'quim': 'A1', 'helena': 'B1', 'martí': 'B2', 'marti': 'B2', 'biel': 'C2', 'aina': 'C5', 'ona': 'C4',
               'marina': 'D2', 'joana': 'D1', 'ferran': 'E2', 'teresa': 'E2', 'arnau': 'E2', 'pol': 'E3', 'jordi': 'E3', 'coo': 'E3', 'bernat': 'E3', 'victor': 'E3', 'víctor': 'E3',
               'nuria': 'E4', 'núria': 'E4', 'chief': 'E4', 'mireia': 'E5', 'clara': 'B3'}
DEPARTAMENTO = {'licitaciones': 'A3', 'sales': 'A3', 'grants': 'B3', 'subvenciones': 'B3', 'comercial': 'C5', 'bizdev': 'C5', 'producto': 'D1', 'operaciones': 'E3',
                'estrategia': 'E4', 'chief': 'E4', 'direccion': 'E4', 'hq': 'E4', 'finanzas': 'E2'}
CANONICO = {'A': 'licitaciones', 'B': 'subvenciones', 'C': 'comercial', 'D': 'producto', 'E': 'operaciones'}
CANONICO_E = {'E1': 'operaciones', 'E2': 'finanzas', 'E3': 'operaciones', 'E4': 'hq', 'E5': 'comercial'}


def clasificar(texto, responsable, departamento):
    t = (texto or '').lower()
    for codigo, patron in REGLAS:
        if re.search(patron, t):
            return codigo, f'regla:{patron[:30]}'
    r = (responsable or '').lower().split('-')[0].strip()
    if r in RESPONSABLE:
        return RESPONSABLE[r], f'responsable:{r}'
    d = (departamento or '').lower().strip()
    if d in DEPARTAMENTO:
        return DEPARTAMENTO[d], f'departamento:{d}'
    return None, 'sin regla'


def depto_canonico(departamento, codigo):
    if not codigo:
        return (departamento or '').lower().strip() or 'operaciones'
    return CANONICO_E.get(codigo) or CANONICO[codigo[0]]


def _sql(q):
    e = {}
    for l in open('/Users/diego/dev/infinitelabs-portal-cupons/.env.local'):
        if '=' in l and not l.startswith('#'):
            k, v = l.strip().split('=', 1); e[k] = v.strip('"').strip("'")
    svc = e['SUPABASE_SERVICE_ROLE_KEY']
    req = urllib.request.Request(e['SUPABASE_URL'].rstrip('/') + '/pg/query', data=json.dumps({'query': q}).encode(), method='POST',
                                 headers={'apikey': svc, 'Authorization': 'Bearer ' + svc, 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read() or b'null') or []


def q(s):
    return "'" + str(s).replace("'", "''") + "'"


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    g = ap.add_mutually_exclusive_group(required=True); g.add_argument('--dry-run', action='store_true'); g.add_argument('--aplicar', action='store_true')
    ap.add_argument('--asignar', default='', help='123=A3,124=E4')
    a = ap.parse_args()
    manual = dict(x.split('=') for x in a.asignar.split(',') if '=' in x)
    frentes = {f['codigo'].upper(): f['id'] for f in _sql(f"select id, upper(codigo) as codigo from omc_plan_lineas where empresa={q(EMPRESA)} and activa and codigo is not null")}
    encargos = _sql(f"select id, texto, agente, departamento, estado, linea_id from omc_encargos where empresa={q(EMPRESA)} order by id")
    filas = []
    for e in encargos:
        if e['linea_id']:
            codigo = next((c for c, i in frentes.items() if i == e['linea_id']), None); motivo = 'ya tenía'
        elif str(e['id']) in manual:
            codigo, motivo = manual[str(e['id'])].upper(), 'manual'
        else:
            codigo, motivo = clasificar(e['texto'], e['agente'], e['departamento'])
        if codigo and codigo not in frentes:
            sys.exit(f'frente {codigo} no existe en la base (encargo {e["id"]})')
        filas.append({'id': e['id'], 'estado': e['estado'], 'codigo': codigo or '', 'motivo': motivo, 'depto': depto_canonico(e['departamento'], codigo), 'texto': (e['texto'] or '')[:90]})
    sin = [f for f in filas if not f['codigo'] and f['estado'] != 'descartado']
    if a.dry_run:
        destino = os.path.join(os.environ.get('SCRATCHPAD', '/tmp'), 'migracion-encargos.csv')
        with open(destino, 'w', newline='') as fh:
            w = csv.DictWriter(fh, fieldnames=list(filas[0].keys()), delimiter=';'); w.writeheader(); w.writerows(filas)
        print(f'{len(filas)} encargos · {len(sin)} vivos sin frente · CSV {destino}')
        for f in sin: print(f"  #{f['id']} [{f['estado']}] {f['texto']}")
        return
    if sin:
        sys.exit(f'{len(sin)} encargos vivos sin frente; pásalos con --asignar id=CODIGO')
    for f in filas:
        if f['motivo'] == 'ya tenía' or not f['codigo']:
            _sql(f"update omc_encargos set departamento={q(f['depto'])} where id={f['id']} and departamento is distinct from {q(f['depto'])}")
            continue
        _sql(f"update omc_encargos set linea_id={frentes[f['codigo']]}, departamento={q(f['depto'])}, updated_at=now() where id={f['id']}")
        _sql(f"insert into omc_encargo_avances (empresa, encargo_id, autor, tipo, texto) values ({q(EMPRESA)}, {f['id']}, 'sistema', 'sistema', {q('frente ' + f['codigo'] + ' asignado por migración 17-sep (' + f['motivo'] + ')')})")
    print(f'aplicado: {sum(1 for f in filas if f["motivo"] not in ("ya tenía",) and f["codigo"])} encargos con frente nuevo')


if __name__ == '__main__':
    main()
```

- [ ] **Step 4: Tests y ensayo**

Run: `python3 -m unittest scripts.hq.tests.test_07_migracion -v && SCRATCHPAD=$PWD/.. python3 scripts/hq/migrar-encargos-frente.py --dry-run`
Expected: 4 OK; el dry-run lista los vivos sin frente (se esperan menos de 15). Revisar el CSV a mano: los descartados pueden quedar sin frente; el resto se resuelve con `--asignar`. **Antes de `--aplicar`, el chief revisa la lista y la enseña a Diego en una línea con el enlace al CSV subido a Drive.**

- [ ] **Step 5: Aplicar y cerrar la puerta en el esquema**

Run: `python3 scripts/hq/migrar-encargos-frente.py --aplicar --asignar <lo que salga>` y después `pgq.py -c "select count(*) from omc_encargos where empresa='77delta' and linea_id is null and estado<>'descartado'"` → `0`.

Añadir a `schema-v2.sql` (sección T7):

```sql
-- T7 · sin encargos vivos fuera de plan (se activa tras la migración; si falla, aún hay huérfanos)
do $$ begin
  if not exists (select 1 from omc_encargos where linea_id is null and estado <> 'descartado') then
    alter table omc_encargos drop constraint if exists omc_encargos_frente_obligatorio;
    alter table omc_encargos add constraint omc_encargos_frente_obligatorio check (linea_id is not null or estado = 'descartado');
  else
    raise notice 'omc_encargos: quedan encargos vivos sin frente, constraint no aplicada';
  end if;
end $$;
```

Run: `scripts/hq/aplicar-schema.sh && pgq.py -c "select conname from pg_constraint where conname='omc_encargos_frente_obligatorio'"` → 1 fila.

- [ ] **Step 6: Commit**

```bash
git add scripts/hq/migrar-encargos-frente.py scripts/hq/schema-v2.sql scripts/hq/tests/test_07_migracion.py
git commit -m "feat(hq): migración de encargos a frentes y constraint de frente obligatorio"
```

---

### Task 8: Kit por frente · RPC, CLI y semilla de reglas

**Files:**
- Modify: `scripts/hq/schema-v2.sql` (sección T8), `scripts/hq/seed-77delta-v2.sql` (kit), `scripts/hq/hq_v2.py`
- Test: `scripts/hq/tests/test_08_kit.py`

**Interfaces:**
- Consumes: tabla `omc_kit` (T5).
- Produces: RPC `omc_kit_set(p_token, p jsonb)` (owner o agente `chief`; campos `id` opcional, `frente` (código o null = toda la empresa), `tipo`, `nombre`, `url`, `texto`, `version`, `vigente`; una entrada nueva con el mismo `nombre` y `frente` deja `vigente=false` la anterior); `omc_kit_lista(p_token, p_frente text default null) -> jsonb[]` (vigentes; con frente devuelve las del frente y las generales). CLI `hq.py kit lista [FRENTE]`, `hq.py kit alta --frente A3|--general --tipo plantilla --nombre "..." [--url] [--texto] [--version]`, `hq.py kit vigente ID --no` (retira).

- [ ] **Step 1: Test**

```python
# scripts/hq/tests/test_08_kit.py
import json, subprocess, sys, unittest
from pathlib import Path
from . import pg
from .pg import rpc

HQ = str(Path(__file__).resolve().parents[1] / 'hq.py')


class TestKit(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.t = pg.preparar_tenant(); pg.limpiar_tenant()
        pg.sql("insert into omc_agentes (empresa, id, nombre, depto, nivel, sesiones, activo) values ('pruebas','chief','Marc','direccion',1,array['Marc-Chief'],true), ('pruebas','sales-licita','Guillem','licitaciones',2,array['Guillem-Licitaciones'],true)")
        rpc(cls.t['owner'], 'omc_bloque_set', p={'letra': 'A', 'nombre': 'Licitaciones', 'orden': 1})
        rpc(cls.t['owner'], 'omc_frente_set', p={'codigo': 'A3', 'bloque': 'A', 'linea': 'Ofertas', 'kpi': 'EUR', 'meta': 1})

    def test_alta_versiona_y_lista_por_frente(self):
        k1 = rpc(self.t['agente'], 'omc_kit_set', p={'frente': 'A3', 'tipo': 'plantilla', 'nombre': 'Plantilla oferta', 'url': 'https://docs.google.com/document/d/v1', 'agente': 'chief'})
        rpc(self.t['owner'], 'omc_kit_set', p={'tipo': 'regla', 'nombre': 'Catalán con entidades catalanas', 'texto': 'A entidades catalanas se escribe en catalán.'})
        k2 = rpc(self.t['owner'], 'omc_kit_set', p={'frente': 'A3', 'tipo': 'plantilla', 'nombre': 'Plantilla oferta', 'url': 'https://docs.google.com/document/d/v2', 'version': '2'})
        self.assertNotEqual(k1['id'], k2['id'])
        lista = rpc(self.t['agente'], 'omc_kit_lista', p_frente='A3')
        self.assertEqual(sorted(k['nombre'] for k in lista), ['Catalán con entidades catalanas', 'Plantilla oferta'])
        self.assertEqual([k['url'] for k in lista if k['tipo'] == 'plantilla'], ['https://docs.google.com/document/d/v2'])
        self.assertFalse(pg.sql("select vigente from omc_kit where id={0}", k1['id'])[0]['vigente'])

    def test_agente_normal_no_edita_kit(self):
        with self.assertRaisesRegex(RuntimeError, 'solo owner o chief'):
            rpc(self.t['agente'], 'omc_kit_set', p={'tipo': 'regla', 'nombre': 'x', 'texto': 'y', 'agente': 'Guillem'})

    def test_cli_kit_lista(self):
        p = subprocess.run([sys.executable, HQ, '--json', 'kit', 'lista', 'A3'], env=pg.entorno_cli('agente'), capture_output=True, text=True)
        self.assertEqual(p.returncode, 0, p.stderr); self.assertTrue(len(json.loads(p.stdout)) >= 1)
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `python3 -m unittest scripts.hq.tests.test_08_kit -v` → FAIL.

- [ ] **Step 3: SQL, CLI y semilla**

```sql
-- T8 · kit
create or replace function omc_kit_set(p_token text, p jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare t record; v_linea bigint; v_actor text; r omc_kit;
begin
  select * into t from omc_tok(p_token);
  v_actor := case when t.rol = 'owner' then 'diego' else coalesce(p->>'agente', 'agente') end;
  if t.rol <> 'owner' and lower(v_actor) <> 'chief' then raise exception 'solo owner o chief editan el kit' using errcode='42501'; end if;
  if coalesce(p->>'nombre','') = '' or coalesce(p->>'tipo','') = '' then raise exception 'falta nombre o tipo (plantilla|oficial|procedimiento|regla)'; end if;
  if coalesce(p->>'frente','') <> '' then
    v_linea := omc_frente_id(t.empresa, p->>'frente');
    if v_linea is null then raise exception 'frente % no existe', p->>'frente'; end if;
  end if;
  if (p->>'id') is not null then
    update omc_kit set vigente = coalesce((p->>'vigente')::boolean, vigente), url = coalesce(p->>'url', url), texto = coalesce(p->>'texto', texto), actualizado_por = v_actor, fecha = now()
    where id = (p->>'id')::bigint and empresa = t.empresa returning * into r;
    return to_jsonb(r);
  end if;
  update omc_kit set vigente = false where empresa = t.empresa and vigente and nombre = p->>'nombre' and linea_id is not distinct from v_linea;
  insert into omc_kit (empresa, linea_id, tipo, nombre, url, texto, version, vigente, actualizado_por)
  values (t.empresa, v_linea, p->>'tipo', p->>'nombre', p->>'url', p->>'texto', coalesce(p->>'version','1'), true, v_actor) returning * into r;
  return to_jsonb(r);
end $$;

create or replace function omc_kit_lista(p_token text, p_frente text default null) returns jsonb
language sql security definer set search_path=public as $$
  with e as (select empresa from omc_tok(p_token)), f as (select omc_frente_id((select empresa from e), p_frente) as id)
  select coalesce(jsonb_agg(to_jsonb(k) || jsonb_build_object('codigo', l.codigo) order by k.linea_id nulls first, k.tipo, k.nombre), '[]'::jsonb)
  from omc_kit k left join omc_plan_lineas l on l.id = k.linea_id
  where k.empresa = (select empresa from e) and k.vigente and (p_frente is null or k.linea_id is null or k.linea_id = (select id from f));
$$;
grant execute on function omc_kit_set(text, jsonb), omc_kit_lista(text, text) to anon, authenticated;
```

En `hq_v2.py`, dentro de `registrar()`:

```python
    k = sub.add_parser('kit', help='plantillas, oficiales, procedimientos y reglas por frente')
    ksub = k.add_subparsers(dest='sub', required=True)
    kl = ksub.add_parser('lista'); kl.add_argument('frente', nargs='?')
    ka = ksub.add_parser('alta'); ka.add_argument('--frente'); ka.add_argument('--general', action='store_true'); ka.add_argument('--tipo', required=True, choices=('plantilla', 'oficial', 'procedimiento', 'regla'))
    ka.add_argument('--nombre', required=True); ka.add_argument('--url'); ka.add_argument('--texto'); ka.add_argument('--version'); ka.add_argument('--agente')
    kv = ksub.add_parser('vigente'); kv.add_argument('id', type=int); kv.add_argument('--no', action='store_true'); kv.add_argument('--agente')
```

y en `ejecutar()`, antes de `if a.cmd != 'encargo'`:

```python
    if a.cmd == 'kit':
        if a.sub == 'lista':
            ks = rpc('omc_kit_lista', p_token=E['HQ_TOKEN'], p_frente=a.frente)
            salida(ks, '\n'.join(f"#{k['id']} [{k.get('codigo') or 'general'}] {k['tipo']}: {k['nombre']} v{k['version']} {k.get('url') or ''}\n    {(k.get('texto') or '')[:160]}".rstrip() for k in ks))
        elif a.sub == 'alta':
            if not a.frente and not a.general: raise SystemExit('kit alta: --frente A3 o --general')
            p = {k: v for k, v in {'frente': a.frente, 'tipo': a.tipo, 'nombre': a.nombre, 'url': a.url, 'texto': a.texto, 'version': a.version, 'agente': agente_actual(a.agente)}.items() if v is not None}
            r = rpc('omc_kit_set', p_token=E.get('HQ_OWNER_TOKEN') or E['HQ_TOKEN'], p=p)
            salida(r, f"kit #{r['id']} {r['tipo']}: {r['nombre']} v{r['version']}")
        else:
            r = rpc('omc_kit_set', p_token=E.get('HQ_OWNER_TOKEN') or E['HQ_TOKEN'], p={'id': a.id, 'vigente': not a.no, 'agente': agente_actual(a.agente)})
            salida(r, f"kit #{r['id']} vigente={r['vigente']}")
        return True
```

Añadir `'kit'` a la tupla de la rama de despacho en `hq.py` (`a.cmd in ('frentes', 'bloques', 'feed', 'kit')`). Las tareas 9 a 12 añaden ahí `contacto`, `expediente`, `sesion` y `agente`.

Semilla (`seed-77delta-v2.sql`); las URL de Drive de las plantillas las da de alta el chief el 17-sep con `kit alta` tras el inventario, aquí solo reglas y procedimientos del repo:

```sql
insert into omc_kit (empresa, linea_id, tipo, nombre, url, texto, actualizado_por)
select '77delta', null, k.tipo, k.nombre, k.url, k.texto, 'seed' from (values
  ('regla', 'Ningún documento a cliente en HTML ni markdown', null, 'Todo entregable a cliente u órgano va en plantilla 77 Delta (Google Doc, PDF o DOCX). Regla 40, incidente #648.'),
  ('regla', 'Documento por enlace, nunca adjunto (decisión 80)', null, 'Correos de impacto a cliente salen como borrador de diego@; el documento va por enlace de Google Doc. A un órgano de contratación sí va adjunto. Nunca datos de otro cliente, ni anonimizados.'),
  ('regla', 'Cifras con etiqueta y fuente (decisión 81)', null, 'Toda cifra lleva "sin IVA" o "con IVA" y su fuente; bajas y márgenes sobre base sin IVA; si no se puede reconstruir, se escribe NO LO SÉ.'),
  ('regla', 'Catalán con entidades catalanas', null, 'A entidades y empresas catalanas se escribe en catalán.'),
  ('regla', 'Validar lo que llega de oídas (regla 36)', null, 'Antes de actuar sobre un dato verbal se contrasta en la fuente primaria.'),
  ('regla', 'Prospección fría desde el alias de team@ (regla 37)', null, 'Nunca desde diego@. Remitente = agente con su alias verificado o Diego en persona; nunca "Equipo 77 Delta".'),
  ('regla', 'Cronología completa antes de redactar (regla 38)', null, 'Antes de redactar a un tercero se reconstruye el hilo entero con él.'),
  ('regla', 'Máximo dos toques (regla 39)', null, 'Segundo toque obligatorio antes de dar por perdido un contacto; nunca un tercero sin OK del chief.'),
  ('procedimiento', 'Envío a terceros con candado', 'https://github.com/diegotorreslopez81/77delta/blob/main/scripts/gmail/enviar-con-lock.sh', 'Tarjeta HQ aprobada + fila de contacto + franja 08-20. Nada sale de otra forma.'),
  ('procedimiento', 'Alta de agente', 'https://github.com/diegotorreslopez81/77delta/blob/main/docs/empresa/30-alta-de-agente.md', 'hq.py agente alta con frentes, ventana tmux y ficha.')
) as k(tipo, nombre, url, texto)
where not exists (select 1 from omc_kit x where x.empresa='77delta' and x.nombre = k.nombre);

insert into omc_kit (empresa, linea_id, tipo, nombre, texto, actualizado_por)
select '77delta', l.id, k.tipo, k.nombre, k.texto, 'seed' from (values
  ('A2', 'regla', 'Medios personales del art. 76 antes de proponer', 'El bloque de medios a adscribir del pliego se lee y se cita ANTES de proponer un expediente (caso CVC).'),
  ('A3', 'regla', 'Facturador en contratos públicos', 'Siempre Next Gen Academy SL (B44861649). Nunca Infinite Labs OÜ ni su solvencia externa.'),
  ('A3', 'regla', 'Hosting con datos de la administración', 'Proveedor con conformidad ENS en el registro del CCN (OVHcloud por defecto). Nunca Hetzner, Vercel ni Supabase.'),
  ('B4', 'regla', 'FUNDAE: solo áreas con formador acreditable', 'Inscritos en todas las áreas por decisión de Diego 16-sep, pero nunca se oferta ni acepta formación sin formador acreditable.'),
  ('C5', 'regla', 'Seguimiento siempre en campañas', 'Toque 2 obligatorio antes de parar o escalar (Aina, Ona, Marina, 15-sep).')
) as k(codigo, tipo, nombre, texto) join omc_plan_lineas l on l.empresa='77delta' and l.codigo = k.codigo
where not exists (select 1 from omc_kit x where x.empresa='77delta' and x.nombre = k.nombre);
```

- [ ] **Step 4: Probar**

Run: `scripts/hq/aplicar-schema.sh --seed && python3 -m unittest scripts.hq.tests.test_08_kit -v && python3 scripts/hq/hq.py kit lista A3 | head`
Expected: 3 OK; la lista muestra las reglas generales y las dos de A3.

- [ ] **Step 5: Commit**

```bash
git add scripts/hq/schema-v2.sql scripts/hq/seed-77delta-v2.sql scripts/hq/hq_v2.py scripts/hq/hq.py scripts/hq/tests/test_08_kit.py
git commit -m "feat(hq): kit por frente con versionado y semilla de reglas"
```

---

### Task 9: Contactos · tabla, RPC y CLI

**Files:**
- Modify: `scripts/hq/schema-v2.sql` (sección T9), `scripts/hq/hq_v2.py`, `scripts/hq/hq.py` (tupla de despacho: añadir `'contacto'`)
- Test: `scripts/hq/tests/test_09_contactos.py`

**Interfaces:**
- Produces: tabla `omc_contactos(id bigserial, empresa, persona, email, organizacion, canal check correo|linkedin|formulario|telefono|plataforma, motivo, linea_id, encargo_id, expediente_id, solicitud_id, agente, fecha timestamptz, toque int, estado check previsto|enviado|respondido|reunion|cerrado|sin_respuesta, proximo_toque date, respuesta_ref, respuesta_fecha, updated_at)`; RPC `omc_contacto_alta(p_token, p jsonb) -> jsonb` (obligatorios `persona` u `organizacion`, `canal`, `motivo`, y `encargo` (id; de él hereda `linea_id` y `expediente_id`); `email` obligatorio si canal correo; `toque` por defecto = 1 + toques previos con el mismo email/persona y encargo; estado inicial `previsto`; el tercer toque se rechaza con `máximo dos toques (regla 39): pide OK al chief con hq.py pedir`), `omc_contacto_estado(p_token, p_id, p_estado, p_ref text default null, p_proximo date default null)`, `omc_contactos_lista(p_token, p_filtro jsonb default '{}')` (filtros `encargo`, `frente`, `estado`, `agente`, `pendientes` bool = enviados sin respuesta con `proximo_toque <= hoy`), `omc_contacto_ficha(p_token, p_id)`, `omc_contacto_casar(p_token, p_email, p_ref, p_fecha timestamptz default now()) -> jsonb` (marca `respondido` el último contacto `enviado` con ese email en los últimos 60 días; devuelve el contacto o null). `omc_encargo_contexto` pasa a devolver los contactos del encargo. CLI: `hq.py contacto alta --encargo N --persona "..." [--email] [--organizacion] --canal correo --motivo "..." [--proximo-toque YYYY-MM-DD]`, `contacto estado N enviado|respondido|reunion|cerrado|sin_respuesta [--ref ...] [--proximo-toque ...]`, `contacto lista [--encargo N] [--frente A3] [--pendientes] [--agente X]`, `contacto ficha N`, `contacto respondido --email x@y --ref "Message-Id"`.

- [ ] **Step 1: Test**

```python
# scripts/hq/tests/test_09_contactos.py
import json, subprocess, sys, unittest
from pathlib import Path
from . import pg
from .pg import rpc

HQ = str(Path(__file__).resolve().parents[1] / 'hq.py')


class TestContactos(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.t = pg.preparar_tenant(); pg.limpiar_tenant()
        pg.sql("insert into omc_agentes (empresa, id, nombre, depto, nivel, sesiones, activo) values ('pruebas','bdr','Aina','comercial',3,array['Aina-BDR'],true)")
        rpc(cls.t['owner'], 'omc_bloque_set', p={'letra': 'C', 'nombre': 'Comercial', 'orden': 3})
        rpc(cls.t['owner'], 'omc_frente_set', p={'codigo': 'C5', 'bloque': 'C', 'linea': 'Prospección', 'kpi': '%', 'meta': 20})
        cls.e = rpc(cls.t['owner'], 'omc_encargo_alta', p={'texto': 'Campaña clínicas', 'frente': 'C5', 'responsable': 'Aina'})

    def test_alta_hereda_frente_y_cuenta_toques(self):
        c1 = rpc(self.t['agente'], 'omc_contacto_alta', p={'encargo': self.e['id'], 'persona': 'Nil Vidal', 'email': 'nil@example.com', 'organizacion': 'Clínica X', 'canal': 'correo', 'motivo': 'presentar LeakAI', 'agente': 'Aina'})
        self.assertEqual(c1['linea_id'], self.e['linea_id']); self.assertEqual(c1['toque'], 1); self.assertEqual(c1['estado'], 'previsto')
        rpc(self.t['agente'], 'omc_contacto_estado', p_id=c1['id'], p_estado='enviado', p_proximo='2026-09-23')
        c2 = rpc(self.t['agente'], 'omc_contacto_alta', p={'encargo': self.e['id'], 'persona': 'Nil Vidal', 'email': 'nil@example.com', 'canal': 'correo', 'motivo': 'segundo toque', 'agente': 'Aina'})
        self.assertEqual(c2['toque'], 2)
        with self.assertRaisesRegex(RuntimeError, 'máximo dos toques'):
            rpc(self.t['agente'], 'omc_contacto_alta', p={'encargo': self.e['id'], 'persona': 'Nil Vidal', 'email': 'nil@example.com', 'canal': 'correo', 'motivo': 'tercero', 'agente': 'Aina'})

    def test_correo_exige_email_y_alta_exige_encargo(self):
        with self.assertRaisesRegex(RuntimeError, 'falta email'):
            rpc(self.t['agente'], 'omc_contacto_alta', p={'encargo': self.e['id'], 'persona': 'X', 'canal': 'correo', 'motivo': 'm'})
        with self.assertRaisesRegex(RuntimeError, 'falta encargo'):
            rpc(self.t['agente'], 'omc_contacto_alta', p={'persona': 'X', 'canal': 'linkedin', 'motivo': 'm'})

    def test_casar_respuesta_y_pendientes(self):
        c = rpc(self.t['agente'], 'omc_contacto_alta', p={'encargo': self.e['id'], 'persona': 'Marta', 'email': 'marta@example.com', 'canal': 'correo', 'motivo': 'demo', 'agente': 'Aina'})
        rpc(self.t['agente'], 'omc_contacto_estado', p_id=c['id'], p_estado='enviado', p_proximo='2026-01-01')
        pend = rpc(self.t['agente'], 'omc_contactos_lista', p_filtro={'pendientes': True})
        self.assertIn(c['id'], [x['id'] for x in pend])
        r = rpc(self.t['agente'], 'omc_contacto_casar', p_email='MARTA@example.com', p_ref='<msg-1@example.com>')
        self.assertEqual(r['id'], c['id']); self.assertEqual(r['estado'], 'respondido'); self.assertEqual(r['respuesta_ref'], '<msg-1@example.com>')
        self.assertIsNone(rpc(self.t['agente'], 'omc_contacto_casar', p_email='nadie@example.com', p_ref='x'))
        ctx = rpc(self.t['agente'], 'omc_encargo_tomar', p_id=self.e['id'], p_agente='Aina')
        self.assertTrue(any(x['id'] == c['id'] for x in ctx['contactos']))

    def test_cli_alta_y_ficha(self):
        env = pg.entorno_cli('agente'); env['HQ_AGENTE_FORZADO'] = 'Aina'
        p = subprocess.run([sys.executable, HQ, '--json', 'contacto', 'alta', '--encargo', str(self.e['id']), '--persona', 'Pau', '--canal', 'linkedin', '--motivo', 'saludo'], env=env, capture_output=True, text=True)
        self.assertEqual(p.returncode, 0, p.stderr); c = json.loads(p.stdout)
        p = subprocess.run([sys.executable, HQ, '--json', 'contacto', 'ficha', str(c['id'])], env=env, capture_output=True, text=True)
        self.assertEqual(json.loads(p.stdout)['persona'], 'Pau')
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `python3 -m unittest scripts.hq.tests.test_09_contactos -v` → FAIL.

- [ ] **Step 3: SQL**

```sql
-- T9 · contactos
create table if not exists omc_contactos (
  id bigserial primary key, empresa text not null references omc_empresas(id), persona text, email text, organizacion text,
  canal text not null check (canal in ('correo','linkedin','formulario','telefono','plataforma')), motivo text not null,
  linea_id bigint references omc_plan_lineas(id) on delete set null, encargo_id bigint references omc_encargos(id) on delete set null, expediente_id bigint, solicitud_id bigint,
  agente text, fecha timestamptz default now(), toque int default 1,
  estado text not null default 'previsto' check (estado in ('previsto','enviado','respondido','reunion','cerrado','sin_respuesta')),
  proximo_toque date, respuesta_ref text, respuesta_fecha timestamptz, updated_at timestamptz default now());
create index if not exists omc_contactos_emp on omc_contactos (empresa, fecha desc);
create index if not exists omc_contactos_email on omc_contactos (empresa, lower(email));
alter table omc_contactos enable row level security;

create or replace function omc_contacto_alta(p_token text, p jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare t record; e omc_encargos; v_actor text; v_toque int; r omc_contactos;
begin
  select * into t from omc_tok(p_token);
  v_actor := case when t.rol = 'owner' then 'diego' else coalesce(p->>'agente', 'agente') end;
  if (p->>'encargo') is null then raise exception 'falta encargo: --encargo <id> (todo contacto cuelga de un encargo con frente)'; end if;
  select * into e from omc_encargos where id = (p->>'encargo')::bigint and empresa = t.empresa;
  if e.id is null then raise exception 'encargo % no existe', p->>'encargo'; end if;
  if coalesce(p->>'persona','') = '' and coalesce(p->>'organizacion','') = '' then raise exception 'falta persona u organizacion'; end if;
  if coalesce(p->>'canal','') = '' or coalesce(p->>'motivo','') = '' then raise exception 'falta canal o motivo'; end if;
  if p->>'canal' = 'correo' and coalesce(p->>'email','') = '' then raise exception 'falta email (canal correo)'; end if;
  select count(*) + 1 into v_toque from omc_contactos c where c.empresa = t.empresa and c.encargo_id = e.id and c.estado <> 'previsto'
    and ((p->>'email') is not null and lower(c.email) = lower(p->>'email') or (p->>'email') is null and lower(c.persona) = lower(p->>'persona'));
  if v_toque > 2 then raise exception 'máximo dos toques (regla 39): pide OK al chief con hq.py pedir antes de un tercero'; end if;
  insert into omc_contactos (empresa, persona, email, organizacion, canal, motivo, linea_id, encargo_id, expediente_id, solicitud_id, agente, toque, proximo_toque)
  values (t.empresa, p->>'persona', lower(nullif(trim(p->>'email'),'')), p->>'organizacion', p->>'canal', p->>'motivo', e.linea_id, e.id, e.expediente_id, (p->>'solicitud_id')::bigint,
          coalesce(omc_agente_valido(t.empresa, v_actor), v_actor), coalesce((p->>'toque')::int, v_toque), (p->>'proximo_toque')::date)
  returning * into r;
  perform omc_avance_insertar(t.empresa, e.id, v_actor, 'sistema', 'contacto #' || r.id || ' previsto: ' || coalesce(r.persona, r.organizacion) || ' por ' || r.canal || ' (toque ' || r.toque || ')');
  return to_jsonb(r);
end $$;

create or replace function omc_contacto_estado(p_token text, p_id bigint, p_estado text, p_ref text default null, p_proximo date default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare t record; r omc_contactos;
begin
  select * into t from omc_tok(p_token);
  update omc_contactos set estado = p_estado, respuesta_ref = coalesce(p_ref, respuesta_ref),
    respuesta_fecha = case when p_estado in ('respondido','reunion') then now() else respuesta_fecha end,
    fecha = case when p_estado = 'enviado' then now() else fecha end,
    proximo_toque = coalesce(p_proximo, case when p_estado = 'enviado' then (now() + interval '7 days')::date else proximo_toque end), updated_at = now()
  where id = p_id and empresa = t.empresa returning * into r;
  if r.id is null then raise exception 'contacto % no existe', p_id; end if;
  if r.encargo_id is not null then perform omc_avance_insertar(t.empresa, r.encargo_id, coalesce(r.agente,'sistema'), 'sistema', 'contacto #' || r.id || ' ' || p_estado || ': ' || coalesce(r.persona, r.organizacion)); end if;
  return to_jsonb(r);
end $$;

create or replace function omc_contactos_lista(p_token text, p_filtro jsonb default '{}'::jsonb) returns jsonb
language sql security definer set search_path=public as $$
  select coalesce(jsonb_agg(to_jsonb(c) || jsonb_build_object('codigo', l.codigo, 'texto_encargo', left(e.texto, 60)) order by c.fecha desc), '[]'::jsonb)
  from omc_contactos c left join omc_plan_lineas l on l.id = c.linea_id left join omc_encargos e on e.id = c.encargo_id
  where c.empresa = (select empresa from omc_tok(p_token))
    and (p_filtro->>'encargo' is null or c.encargo_id = (p_filtro->>'encargo')::bigint)
    and (p_filtro->>'frente' is null or c.linea_id = omc_frente_id(c.empresa, p_filtro->>'frente'))
    and (p_filtro->>'estado' is null or c.estado = p_filtro->>'estado')
    and (p_filtro->>'agente' is null or lower(c.agente) = lower(p_filtro->>'agente'))
    and (coalesce((p_filtro->>'pendientes')::boolean, false) = false or (c.estado = 'enviado' and c.proximo_toque <= current_date));
$$;

create or replace function omc_contacto_ficha(p_token text, p_id bigint) returns jsonb
language sql security definer set search_path=public as $$
  select to_jsonb(c) || jsonb_build_object('codigo', l.codigo, 'texto_encargo', e.texto,
    'historial', (select coalesce(jsonb_agg(jsonb_build_object('id', h.id, 'fecha', h.fecha, 'toque', h.toque, 'estado', h.estado, 'canal', h.canal, 'motivo', h.motivo) order by h.fecha), '[]'::jsonb)
                  from omc_contactos h where h.empresa = c.empresa and (lower(h.email) = lower(c.email) or (c.email is null and lower(h.persona) = lower(c.persona)))))
  from omc_contactos c left join omc_plan_lineas l on l.id = c.linea_id left join omc_encargos e on e.id = c.encargo_id
  where c.id = p_id and c.empresa = (select empresa from omc_tok(p_token));
$$;

create or replace function omc_contacto_casar(p_token text, p_email text, p_ref text, p_fecha timestamptz default now()) returns jsonb
language plpgsql security definer set search_path=public as $$
declare t record; r omc_contactos;
begin
  select * into t from omc_tok(p_token);
  select * into r from omc_contactos c where c.empresa = t.empresa and lower(c.email) = lower(trim(p_email)) and c.estado = 'enviado' and c.fecha >= p_fecha - interval '60 days'
  order by c.fecha desc limit 1;
  if r.id is null then return null; end if;
  update omc_contactos set estado = 'respondido', respuesta_ref = p_ref, respuesta_fecha = p_fecha, updated_at = now() where id = r.id returning * into r;
  if r.encargo_id is not null then perform omc_avance_insertar(t.empresa, r.encargo_id, 'sistema', 'sistema', 'respuesta de ' || coalesce(r.persona, r.email) || ' casada con el contacto #' || r.id); end if;
  return to_jsonb(r);
end $$;
grant execute on function omc_contacto_alta(text, jsonb), omc_contacto_estado(text, bigint, text, text, date), omc_contactos_lista(text, jsonb), omc_contacto_ficha(text, bigint), omc_contacto_casar(text, text, text, timestamptz) to anon, authenticated;
```

Y en `omc_encargo_contexto` (T5) sustituir `'contactos', '[]'::jsonb,` por:

```sql
    'contactos', (select coalesce(jsonb_agg(to_jsonb(c) order by c.fecha desc), '[]'::jsonb) from omc_contactos c where c.encargo_id = p_id),
```

- [ ] **Step 4: CLI en `hq_v2.py`**

En `registrar()`:

```python
    c = sub.add_parser('contacto', help='registro de contactos y envíos a terceros (una fila por toque)')
    csub = c.add_subparsers(dest='sub', required=True)
    ca = csub.add_parser('alta'); ca.add_argument('--encargo', type=int, required=True); ca.add_argument('--persona'); ca.add_argument('--email'); ca.add_argument('--organizacion')
    ca.add_argument('--canal', required=True, choices=('correo', 'linkedin', 'formulario', 'telefono', 'plataforma')); ca.add_argument('--motivo', required=True)
    ca.add_argument('--proximo-toque', dest='proximo_toque'); ca.add_argument('--tarjeta', type=int); ca.add_argument('--agente')
    ce = csub.add_parser('estado'); ce.add_argument('id', type=int); ce.add_argument('valor', choices=('enviado', 'respondido', 'reunion', 'cerrado', 'sin_respuesta')); ce.add_argument('--ref'); ce.add_argument('--proximo-toque', dest='proximo_toque')
    cl = csub.add_parser('lista'); cl.add_argument('--encargo', type=int); cl.add_argument('--frente'); cl.add_argument('--estado'); cl.add_argument('--agente'); cl.add_argument('--pendientes', action='store_true')
    cf = csub.add_parser('ficha'); cf.add_argument('id', type=int)
    cr = csub.add_parser('respondido'); cr.add_argument('--email', required=True); cr.add_argument('--ref', required=True)
```

En `ejecutar()`:

```python
    if a.cmd == 'contacto':
        if a.sub == 'alta':
            p = {k: v for k, v in {'encargo': a.encargo, 'persona': a.persona, 'email': a.email, 'organizacion': a.organizacion, 'canal': a.canal, 'motivo': a.motivo,
                                   'proximo_toque': a.proximo_toque, 'solicitud_id': a.tarjeta, 'agente': agente_actual(a.agente)}.items() if v is not None}
            r = rpc('omc_contacto_alta', p_token=E['HQ_TOKEN'], p=p)
            salida(r, f"contacto #{r['id']} [{r['estado']}] {r.get('persona') or r.get('organizacion')} · {r['canal']} · toque {r['toque']} · encargo #{r['encargo_id']}")
        elif a.sub == 'estado':
            args = {'p_token': E['HQ_TOKEN'], 'p_id': a.id, 'p_estado': a.valor}
            if a.ref: args['p_ref'] = a.ref
            if a.proximo_toque: args['p_proximo'] = a.proximo_toque
            r = rpc('omc_contacto_estado', **args)
            salida(r, f"contacto #{r['id']} -> {r['estado']} · próximo toque {r.get('proximo_toque') or '-'}")
        elif a.sub == 'lista':
            f = {k: v for k, v in {'encargo': a.encargo, 'frente': a.frente, 'estado': a.estado, 'agente': a.agente, 'pendientes': a.pendientes or None}.items() if v is not None}
            cs = rpc('omc_contactos_lista', p_token=E['HQ_TOKEN'], p_filtro=f)
            salida(cs, '\n'.join(f"#{c['id']} {c['fecha'][:10]} [{c['estado']}] {c.get('persona') or ''} {c.get('organizacion') or ''} · {c['canal']} t{c['toque']} · {c.get('codigo')} #{c.get('encargo_id')} · {c.get('agente')} · próximo {c.get('proximo_toque') or '-'}" for c in cs))
        elif a.sub == 'ficha':
            r = rpc('omc_contacto_ficha', p_token=E['HQ_TOKEN'], p_id=a.id)
            salida(r, json.dumps(r, ensure_ascii=False, indent=1))
        elif a.sub == 'respondido':
            r = rpc('omc_contacto_casar', p_token=E['HQ_TOKEN'], p_email=a.email, p_ref=a.ref)
            salida(r, f"casado con contacto #{r['id']} ({r.get('persona')})" if r else 'sin contacto enviado para ese email')
        return True
```

Añadir `'contacto'` a la tupla de despacho de `hq.py`.

- [ ] **Step 5: Probar y commit**

Run: `scripts/hq/aplicar-schema.sh && python3 -m unittest scripts.hq.tests.test_09_contactos -v` → 4 OK.

```bash
git add scripts/hq/schema-v2.sql scripts/hq/hq_v2.py scripts/hq/hq.py scripts/hq/tests/test_09_contactos.py
git commit -m "feat(hq): registro de contactos por toque con casado de respuestas"
```

---

### Task 10: Puertas de envío · candado con contacto, adjuntos prohibidos, casado en hq-correo y migración de los 80 envíos

**Files:**
- Modify: `scripts/gmail/enviar-con-lock.sh:37-48` (parseo), `:89-107` (simulacro y envío)
- Modify: `~/bin/hq-correo.py:189` (`es_respuesta_hilo`) y `:527-534` (bucle de `todos`)
- Create: `scripts/hq/migrar-envios-contactos.py`
- Test: `scripts/hq/tests/test_10_candado.sh` (bash, se invoca desde `test_10_candado.py` por subprocess)

**Interfaces:**
- Consumes: `hq.py contacto ficha N --json` y `hq.py contacto estado N enviado` (T9); `hq.py estado <tarjeta>` (v1).
- Produces: `enviar-con-lock.sh --tarjeta N --to X --contacto M [--organo] [--simular] -- <args de gmail-agente send>`; códigos nuevos: `6` = contacto inválido (no existe, estado distinto de `previsto`/`enviado`, o email distinto de `--to`), `7` = adjunto `.html`/`.md` sin `--organo`. Tras `ENVIADO OK` ejecuta `hq.py contacto estado M enviado`. `hq-correo.py`: cuando `respuesta_hilo` es cierto, llama `hq.py contacto respondido --email <de> --ref <Message-Id>` con `HQ_AGENTE_FORZADO=sistema` y añade `[casado con contacto #N]` a la línea del resumen si lo encuentra.

- [ ] **Step 1: Test del candado (simulacro, sin enviar)**

```bash
#!/usr/bin/env bash
# scripts/hq/tests/test_10_candado.sh · se ejecuta con el entorno del tenant pruebas (HQ_*). Imprime OK/FALLO por caso y sale 1 si alguno falla.
set -u
AQUI="$(cd "$(dirname "$0")" && pwd)"; HQ="$AQUI/../hq.py"; LOCK="$AQUI/../../gmail/enviar-con-lock.sh"; FALLOS=0
caso() { local esperado="$1"; shift; "$LOCK" "$@" >/tmp/candado.out 2>&1; local rc=$?; if [ "$rc" = "$esperado" ]; then echo "OK   rc=$rc $*"; else echo "FALLO rc=$rc (esperaba $esperado) $*"; sed -n 1,3p /tmp/candado.out; FALLOS=$((FALLOS+1)); fi; }
TARJETA="$1"; CONTACTO="$2"; CONTACTO_OTRO_EMAIL="$3"
caso 2 --tarjeta "$TARJETA" --to nil@example.com --simular
caso 6 --tarjeta "$TARJETA" --to nil@example.com --contacto 999999 --simular
caso 6 --tarjeta "$TARJETA" --to nil@example.com --contacto "$CONTACTO_OTRO_EMAIL" --simular
caso 7 --tarjeta "$TARJETA" --to nil@example.com --contacto "$CONTACTO" --simular -- --adjunto acta.html
caso 0 --tarjeta "$TARJETA" --to nil@example.com --contacto "$CONTACTO" --organo --simular -- --adjunto acta.html
caso 0 --tarjeta "$TARJETA" --to nil@example.com --contacto "$CONTACTO" --simular -- --subject hola
exit $FALLOS
```

```python
# scripts/hq/tests/test_10_candado.py
import subprocess, sys, unittest
from pathlib import Path
from . import pg
from .pg import rpc

HQ = str(Path(__file__).resolve().parents[1] / 'hq.py'); SH = str(Path(__file__).resolve().parent / 'test_10_candado.sh')


class TestCandado(unittest.TestCase):
    def test_candado_exige_contacto_y_rechaza_html(self):
        t = pg.preparar_tenant(); pg.limpiar_tenant()
        pg.sql("insert into omc_agentes (empresa, id, nombre, depto, nivel, sesiones, activo) values ('pruebas','bdr','Aina','comercial',3,array['Aina-BDR'],true)")
        rpc(t['owner'], 'omc_bloque_set', p={'letra': 'C', 'nombre': 'Comercial', 'orden': 3})
        rpc(t['owner'], 'omc_frente_set', p={'codigo': 'C5', 'bloque': 'C', 'linea': 'Prospección', 'kpi': '%', 'meta': 20})
        e = rpc(t['owner'], 'omc_encargo_alta', p={'texto': 'Campaña', 'frente': 'C5', 'responsable': 'Aina'})
        c = rpc(t['agente'], 'omc_contacto_alta', p={'encargo': e['id'], 'persona': 'Nil', 'email': 'nil@example.com', 'canal': 'correo', 'motivo': 'm', 'agente': 'Aina'})
        c2 = rpc(t['agente'], 'omc_contacto_alta', p={'encargo': e['id'], 'persona': 'Otra', 'email': 'otra@example.com', 'canal': 'correo', 'motivo': 'm', 'agente': 'Aina'})
        tarjeta = rpc(t['agente'], 'omc_pedir', p={'agente': 'bdr', 'tipo': 'contacto', 'titulo': 'Enviar prueba', 'detalle': 'test'})
        pg.sql("update omc_solicitudes set estado='aprobada' where id={0}", tarjeta['id'])
        env = pg.entorno_cli('agente'); env['HQ_AGENTE_FORZADO'] = 'Aina'
        p = subprocess.run(['bash', SH, str(tarjeta['id']), str(c['id']), str(c2['id'])], env=env, capture_output=True, text=True)
        self.assertEqual(p.returncode, 0, p.stdout + p.stderr)
```

`omc_pedir(p_token, p jsonb)` (schema.sql 912) devuelve la fila de `omc_solicitudes`; el test la pone en `aprobada` por SQL porque aprobar es de Diego y la UI.

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `python3 -m unittest scripts.hq.tests.test_10_candado -v` → FALLO en los casos 6 y 7 (hoy el script no conoce `--contacto`).

- [ ] **Step 3: Cambios en `enviar-con-lock.sh`**

Parseo (líneas 37-48), añadir dos opciones y la comprobación:

```bash
    --contacto) CONTACTO="${2:-}"; shift 2 ;;
    --organo)   ORGANO=1; shift ;;
```

(inicializar arriba `CONTACTO=""; ORGANO=0`). Tras `[ -n "$TO" ] || ...`:

```bash
[ -n "$CONTACTO" ] || { echo "ABORTA (2): falta --contacto <id>. Registra el toque: hq.py contacto alta --encargo N --persona ... --email $TO --canal correo --motivo ..." >&2; exit 2; }

# 2b. puerta de contacto (HQ v2, spec 2.5): sin fila de contacto en HQ no se dispara
FICHA=$(python3 "$HQ" --json contacto ficha "$CONTACTO" 2>&1) || { echo "ABORTA (6): contacto #$CONTACTO no existe en HQ. $(echo "$FICHA" | head -1 | cut -c1-140)"; exit 6; }
C_EMAIL=$(printf '%s' "$FICHA" | python3 -c 'import json,sys; d=json.load(sys.stdin); print((d.get("email") or "").lower())')
C_ESTADO=$(printf '%s' "$FICHA" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("estado",""))')
if [ "$C_EMAIL" != "$(printf '%s' "$TO" | tr 'A-Z' 'a-z')" ]; then echo "ABORTA (6): el contacto #$CONTACTO es de '$C_EMAIL', no de '$TO'."; exit 6; fi
case "$C_ESTADO" in previsto|enviado) ;; *) echo "ABORTA (6): el contacto #$CONTACTO está en '$C_ESTADO'; solo se envía en previsto (o enviado para el segundo toque con fila nueva)."; exit 6 ;; esac

# 2c. ningún .html ni .md a un tercero (regla 40); a un órgano de contratación sí van adjuntos
if [ "$ORGANO" != "1" ]; then
  for arg in "$@"; do case "$arg" in *.html|*.htm|*.md) echo "ABORTA (7): adjunto '$arg' en HTML o markdown. Conviértelo a la plantilla 77 Delta (PDF o Google Doc por enlace). Si el destinatario es un órgano de contratación, pasa --organo."; exit 7 ;; esac; done
fi
```

En el bloque de simulacro añadir la línea `echo "  contacto: #$CONTACTO ($C_EMAIL, $C_ESTADO)"`. Tras `date ... > "$LOCK/enviado"` añadir:

```bash
python3 "$HQ" contacto estado "$CONTACTO" enviado >/dev/null 2>&1 || echo "  aviso: no pude marcar el contacto #$CONTACTO como enviado; hazlo a mano: hq.py contacto estado $CONTACTO enviado"
```

Actualizar la cabecera de uso del script (comentarios de las primeras líneas) con `--contacto` y `--organo` y los códigos 6 y 7.

- [ ] **Step 4: `hq-correo.py` casa respuestas**

En el bucle `for m in todos:` (línea 527), antes de `engram_mirror(...)`:

```python
        m['contacto'] = None
        if m['respuesta_hilo'] and m.get('email_de') and m.get('message_id'):
            try:
                r = subprocess.run([sys.executable, HQ, '--json', 'contacto', 'respondido', '--email', m['email_de'], '--ref', m['message_id']],
                                   env={**os.environ, 'HQ_AGENTE_FORZADO': 'sistema'}, capture_output=True, text=True, timeout=30)
                d = json.loads(r.stdout) if r.returncode == 0 and r.stdout.strip() else None
                m['contacto'] = d.get('id') if isinstance(d, dict) else None
            except Exception:
                pass
```

y en `lineas` añadir `+ (f" [casado con contacto #{m['contacto']}]" if m.get('contacto') else '')`. Donde se construye cada `m` (función que parsea el mensaje, busca `respuesta_hilo=` para localizarla) añadir `'email_de': email.utils.parseaddr(hdr.get('From',''))[1]` y `'message_id': hdr.get('Message-Id','').strip()`. Añadir `import os` si falta.

- [ ] **Step 5: Migración de los 80 envíos**

```python
#!/usr/bin/env python3
# scripts/hq/migrar-envios-contactos.py
"""Carga ~/.config/77delta/envios-realizados.json (80 envíos del candado, 9-16 sep) en omc_contactos como toques 'enviado'.
Cada envío se cuelga del encargo de su tarjeta (solicitud_id) si existe; si no, del encargo del frente C5 más reciente del agente. --dry-run | --aplicar."""
import json, os, sys, urllib.request

ENVIOS = os.path.expanduser('~/.config/77delta/envios-realizados.json'); EMPRESA = '77delta'


def _sql(q):
    e = dict(l.strip().split('=', 1) for l in open('/Users/diego/dev/infinitelabs-portal-cupons/.env.local') if '=' in l and not l.startswith('#'))
    svc = e['SUPABASE_SERVICE_ROLE_KEY'].strip('"').strip("'")
    req = urllib.request.Request(e['SUPABASE_URL'].strip('"').rstrip('/') + '/pg/query', data=json.dumps({'query': q}).encode(), method='POST',
                                 headers={'apikey': svc, 'Authorization': 'Bearer ' + svc, 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read() or b'null') or []


def q(s):
    return 'null' if s is None else "'" + str(s).replace("'", "''") + "'"


def main():
    modo = sys.argv[1] if len(sys.argv) > 1 else '--dry-run'
    envios = list(json.load(open(ENVIOS)).values())
    por_tarjeta = {int(r['solicitud_id']): r['id'] for r in _sql(f"select id, solicitud_id from omc_encargos where empresa={q(EMPRESA)} and solicitud_id is not null")}
    ya = {(r['email'], r['respuesta_ref']) for r in _sql(f"select lower(email) as email, respuesta_ref from omc_contactos where empresa={q(EMPRESA)} and respuesta_ref like 'migracion:%'")}
    c5 = _sql(f"select id from omc_encargos where empresa={q(EMPRESA)} and linea_id = omc_frente_id({q(EMPRESA)}, 'C5') and estado <> 'descartado' order by id desc limit 1")
    fallback = c5[0]['id'] if c5 else None
    filas = []
    for e in envios:
        ref = f"migracion:{e['tarjeta']}"
        if (e['destinatario'].lower(), ref) in ya: continue
        encargo = por_tarjeta.get(int(e['tarjeta'])) or fallback
        filas.append((e, encargo, ref))
    print(f"{len(filas)} envíos a cargar ({sum(1 for f in filas if f[1] == fallback)} sin encargo propio, van a C5 #{fallback})")
    if modo != '--aplicar':
        for e, enc, _ in filas[:80]: print(f"  {e['fecha'][:10]} {e['agente']:<8} -> {e['destinatario']:<40} #{enc} {e['asunto'][:50]}")
        return
    for e, enc, ref in filas:
        toque = 2 if e['asunto'].lower().startswith('re:') else 1
        _sql(f"insert into omc_contactos (empresa, persona, email, canal, motivo, linea_id, encargo_id, solicitud_id, agente, fecha, toque, estado, proximo_toque, respuesta_ref) "
             f"select {q(EMPRESA)}, null, {q(e['destinatario'].lower())}, 'correo', {q(e['asunto'][:200])}, x.linea_id, x.id, {e['tarjeta']}, {q(e['agente'])}, {q(e['fecha'])}, {toque}, 'enviado', "
             f"({q(e['fecha'])}::timestamptz + interval '7 days')::date, {q(ref)} from omc_encargos x where x.id = {enc}")
    print('aplicado')


if __name__ == '__main__':
    main()
```

Run: `python3 scripts/hq/migrar-envios-contactos.py --dry-run` (revisar) y `--aplicar`; comprobar `pgq.py -c "select count(*) from omc_contactos where empresa='77delta'"` → 80.

- [ ] **Step 6: Probar y commit**

Run: `python3 -m unittest scripts.hq.tests.test_10_candado -v` → OK. Probar hq-correo en seco: `python3 ~/bin/hq-correo.py --dry-run` si tiene esa opción; si no, ejecutar una vez y comprobar que no rompe (`tail ~/.config/77delta/hq-correo.log` o el fichero de estado que use).

```bash
git add scripts/gmail/enviar-con-lock.sh scripts/hq/migrar-envios-contactos.py scripts/hq/tests/test_10_candado.sh scripts/hq/tests/test_10_candado.py
git commit -m "feat(hq): candado exige contacto, rechaza html/md y casa respuestas con contactos"
```

`~/bin/hq-correo.py` no vive en el repo: el cambio se anota en `docs/empresa/03-hq-manual.md` (sección hq-correo) con la fecha y el diff resumido.

---

### Task 11: Expedientes y sesiones de trabajo

**Files:**
- Modify: `scripts/hq/schema-v2.sql` (sección T11), `scripts/hq/seed-77delta-v2.sql` (expedientes), `scripts/hq/hq_v2.py`, `scripts/hq/hq.py` (tupla: `'expediente'`, `'sesion'`)
- Modify: `scripts/hq/hq-despertar.py:81-96` (main: sesiones solicitadas)
- Test: `scripts/hq/tests/test_11_expedientes.py`

**Interfaces:**
- Produces: tabla `omc_expedientes(id bigserial, empresa, tipo check cliente|producto|convocatoria|licitacion, nombre, linea_id, responsable, ficha_url, carpeta_url, estado_funnel, entregables jsonb default '[]' ([{nombre, fecha, hecho}]), importe numeric, resumen_estado, resumen_fecha, licitacion_expediente text, activo bool, created_at, updated_at)` con `unique(empresa, nombre)`; `omc_sesiones(id bigserial, empresa, expediente_id, agente, solicitada_por, estado check solicitada|abierta|cerrada, abierta timestamptz, cerrada timestamptz, resumen, encargos_tocados bigint[])`; FK `omc_encargos.expediente_id -> omc_expedientes(id)` y `omc_contactos.expediente_id` igual. RPC: `omc_expediente_set(p_token, p jsonb)` (owner o chief; upsert por `id` o `nombre`; `frente`, `responsable` validados), `omc_expedientes_lista(p_token, p_filtro jsonb default '{}')` (`tipo`, `frente`, `responsable`, `activo`), `omc_expediente_ficha(p_token, p_id) -> {expediente, frente, encargos[], contactos[], decisiones[], sesiones[≤5], kit[]}`, `omc_sesion_solicitar(p_token owner, p_expediente) -> sesion` (crea `solicitada`; la recoge hq-despertar), `omc_sesion_abrir(p_token, p_expediente, p_agente) -> {sesion, ficha}` (si el agente tiene otra sesión abierta: `cierra antes la sesión #N (hq.py sesion cerrar N --resumen ...)`; si hay una `solicitada` para ese expediente y agente la convierte en `abierta`), `omc_sesion_cerrar(p_token, p_sesion, p_resumen, p_entregables jsonb default '[]', p_agente) -> sesion` (falla si algún encargo del expediente en `en_curso`/`bloqueado_diego` asignado al agente no tiene avance suyo posterior a la apertura: `falta avance en #N: hq.py encargo avance N --texto ...`; guarda `resumen_estado` en el expediente y marca `hecho` los entregables pasados). `omc_encargo_contexto` devuelve el expediente. `omc_latido` (T13) avisa de sesiones `solicitada`. CLI: `hq.py expediente alta --nombre --tipo --frente [--responsable] [--ficha URL] [--carpeta URL] [--estado-funnel] [--importe]`, `expediente lista [--tipo] [--frente] [--responsable]`, `expediente ficha ID`, `expediente entregable ID --nombre --fecha`, `hq.py sesion abrir --expediente ID [--agente]`, `sesion cerrar ID --resumen "..." [--entregable "nombre"]... [--agente]`, `sesion solicitar --expediente ID` (owner).

- [ ] **Step 1: Test**

```python
# scripts/hq/tests/test_11_expedientes.py
import unittest
from . import pg
from .pg import rpc


class TestExpedientes(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.t = pg.preparar_tenant(); pg.limpiar_tenant()
        pg.sql("insert into omc_agentes (empresa, id, nombre, depto, nivel, sesiones, activo) values ('pruebas','cupones','Martí','subvenciones',2,array['Marti-Cupones'],true)")
        rpc(cls.t['owner'], 'omc_bloque_set', p={'letra': 'B', 'nombre': 'Subvenciones', 'orden': 2})
        rpc(cls.t['owner'], 'omc_frente_set', p={'codigo': 'B2', 'bloque': 'B', 'linea': 'Cupons IA', 'kpi': 'EUR', 'meta': 40000})

    def test_alta_ficha_y_sesion_completa(self):
        x = rpc(self.t['owner'], 'omc_expediente_set', p={'nombre': 'Nora Fuchs', 'tipo': 'cliente', 'frente': 'B2', 'responsable': 'Martí', 'ficha_url': 'https://docs.google.com/document/d/nora', 'estado_funnel': 'diagnóstico'})
        x2 = rpc(self.t['owner'], 'omc_expediente_set', p={'nombre': 'Nora Fuchs', 'estado_funnel': 'propuesta'})
        self.assertEqual(x['id'], x2['id']); self.assertEqual(x2['estado_funnel'], 'propuesta')
        e = rpc(self.t['owner'], 'omc_encargo_alta', p={'texto': 'Redactar diagnóstico', 'frente': 'B2', 'responsable': 'Martí', 'expediente_id': x['id']})
        rpc(self.t['agente'], 'omc_encargo_tomar', p_id=e['id'], p_agente='Martí')
        s = rpc(self.t['agente'], 'omc_sesion_abrir', p_expediente=x['id'], p_agente='Martí')
        self.assertEqual(s['sesion']['estado'], 'abierta'); self.assertEqual(s['ficha']['expediente']['nombre'], 'Nora Fuchs')
        self.assertEqual([k['id'] for k in s['ficha']['encargos']], [e['id']])
        with self.assertRaisesRegex(RuntimeError, 'cierra antes la sesión'):
            rpc(self.t['agente'], 'omc_sesion_abrir', p_expediente=x['id'], p_agente='Martí')
        with self.assertRaisesRegex(RuntimeError, f'falta avance en #{e["id"]}'):
            rpc(self.t['agente'], 'omc_sesion_cerrar', p_sesion=s['sesion']['id'], p_resumen='sin avances', p_agente='Martí')
        rpc(self.t['agente'], 'omc_encargo_avance', p_id=e['id'], p_texto='Diagnóstico al 60 %', p_agente='Martí')
        c = rpc(self.t['agente'], 'omc_sesion_cerrar', p_sesion=s['sesion']['id'], p_resumen='Diagnóstico avanzado, falta el bloque de datos', p_entregables=[{'nombre': 'Diagnóstico', 'fecha': '2026-09-18'}], p_agente='Martí')
        self.assertEqual(c['estado'], 'cerrada'); self.assertEqual(c['encargos_tocados'], [e['id']])
        ficha = rpc(self.t['agente'], 'omc_expediente_ficha', p_id=x['id'])
        self.assertEqual(ficha['expediente']['resumen_estado'], 'Diagnóstico avanzado, falta el bloque de datos')
        self.assertEqual(ficha['expediente']['entregables'][0]['nombre'], 'Diagnóstico')

    def test_solicitar_desde_hq_y_abrir_la_convierte(self):
        x = rpc(self.t['owner'], 'omc_expediente_set', p={'nombre': 'One Hub', 'tipo': 'cliente', 'frente': 'B2', 'responsable': 'Martí'})
        s = rpc(self.t['owner'], 'omc_sesion_solicitar', p_expediente=x['id'])
        self.assertEqual(s['estado'], 'solicitada'); self.assertEqual(s['agente'], 'cupones')
        with self.assertRaisesRegex(RuntimeError, 'solo owner'):
            rpc(self.t['agente'], 'omc_sesion_solicitar', p_expediente=x['id'])
        a = rpc(self.t['agente'], 'omc_sesion_abrir', p_expediente=x['id'], p_agente='Martí')
        self.assertEqual(a['sesion']['id'], s['id']); self.assertEqual(a['sesion']['estado'], 'abierta')
        rpc(self.t['agente'], 'omc_sesion_cerrar', p_sesion=s['id'], p_resumen='sin encargos', p_agente='Martí')
```

- [ ] **Step 2: Ejecutar y ver que falla** → `python3 -m unittest scripts.hq.tests.test_11_expedientes -v` FAIL.

- [ ] **Step 3: SQL**

```sql
-- T11 · expedientes y sesiones
create table if not exists omc_expedientes (
  id bigserial primary key, empresa text not null references omc_empresas(id), tipo text not null check (tipo in ('cliente','producto','convocatoria','licitacion')),
  nombre text not null, linea_id bigint references omc_plan_lineas(id) on delete set null, responsable text, ficha_url text, carpeta_url text, estado_funnel text,
  entregables jsonb default '[]'::jsonb, importe numeric, resumen_estado text, resumen_fecha timestamptz, licitacion_expediente text, activo boolean default true,
  created_at timestamptz default now(), updated_at timestamptz default now(), unique (empresa, nombre));
alter table omc_expedientes enable row level security;
create table if not exists omc_sesiones (
  id bigserial primary key, empresa text not null references omc_empresas(id), expediente_id bigint not null references omc_expedientes(id) on delete cascade,
  agente text not null, solicitada_por text, estado text not null default 'abierta' check (estado in ('solicitada','abierta','cerrada')),
  abierta timestamptz, cerrada timestamptz, resumen text, encargos_tocados bigint[] default '{}', created_at timestamptz default now());
alter table omc_sesiones enable row level security;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'omc_encargos_expediente_fk') then
    alter table omc_encargos add constraint omc_encargos_expediente_fk foreign key (expediente_id) references omc_expedientes(id) on delete set null; end if;
  if not exists (select 1 from pg_constraint where conname = 'omc_contactos_expediente_fk') then
    alter table omc_contactos add constraint omc_contactos_expediente_fk foreign key (expediente_id) references omc_expedientes(id) on delete set null; end if;
end $$;

create or replace function omc_expediente_set(p_token text, p jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare t record; v_actor text; v_linea bigint; v_resp text; r omc_expedientes; existente bigint;
begin
  select * into t from omc_tok(p_token);
  v_actor := case when t.rol = 'owner' then 'diego' else coalesce(p->>'agente','agente') end;
  if t.rol <> 'owner' and lower(v_actor) <> 'chief' then raise exception 'solo owner o chief' using errcode='42501'; end if;
  if p ? 'frente' then v_linea := omc_frente_id(t.empresa, p->>'frente'); if v_linea is null then raise exception 'frente % no existe', p->>'frente'; end if; end if;
  if p ? 'responsable' then v_resp := omc_agente_valido(t.empresa, p->>'responsable'); if v_resp is null then raise exception 'responsable % no es un agente activo', p->>'responsable'; end if; end if;
  select id into existente from omc_expedientes where empresa = t.empresa and (id = (p->>'id')::bigint or lower(nombre) = lower(p->>'nombre'));
  if existente is null then
    if coalesce(p->>'nombre','') = '' or coalesce(p->>'tipo','') = '' or v_linea is null then raise exception 'alta de expediente: faltan nombre, tipo o frente'; end if;
    insert into omc_expedientes (empresa, tipo, nombre, linea_id, responsable, ficha_url, carpeta_url, estado_funnel, entregables, importe, licitacion_expediente)
    values (t.empresa, p->>'tipo', p->>'nombre', v_linea, v_resp, p->>'ficha_url', p->>'carpeta_url', p->>'estado_funnel', coalesce(p->'entregables','[]'::jsonb), (p->>'importe')::numeric, p->>'licitacion_expediente')
    returning * into r;
  else
    update omc_expedientes set tipo = coalesce(p->>'tipo', tipo), nombre = coalesce(p->>'nombre', nombre), linea_id = coalesce(v_linea, linea_id), responsable = coalesce(v_resp, responsable),
      ficha_url = coalesce(p->>'ficha_url', ficha_url), carpeta_url = coalesce(p->>'carpeta_url', carpeta_url), estado_funnel = coalesce(p->>'estado_funnel', estado_funnel),
      entregables = case when p ? 'entregable' then entregables || jsonb_build_array(p->'entregable') else coalesce(p->'entregables', entregables) end,
      importe = coalesce((p->>'importe')::numeric, importe), licitacion_expediente = coalesce(p->>'licitacion_expediente', licitacion_expediente),
      activo = coalesce((p->>'activo')::boolean, activo), updated_at = now()
    where id = existente returning * into r;
  end if;
  return to_jsonb(r);
end $$;

create or replace function omc_expediente_ficha(p_token text, p_id bigint) returns jsonb
language sql security definer set search_path=public as $$
  with e as (select empresa from omc_tok(p_token)), x as (select * from omc_expedientes where id = p_id and empresa = (select empresa from e))
  select jsonb_build_object(
    'expediente', (select to_jsonb(x) from x),
    'frente', (select jsonb_build_object('id', l.id, 'codigo', l.codigo, 'linea', l.linea, 'kpi', l.kpi) from x join omc_plan_lineas l on l.id = x.linea_id),
    'encargos', (select coalesce(jsonb_agg(to_jsonb(en) order by en.estado, en.fecha_hito nulls last), '[]'::jsonb) from omc_encargos en where en.expediente_id = p_id and en.estado <> 'descartado'),
    'contactos', (select coalesce(jsonb_agg(to_jsonb(c) order by c.fecha desc), '[]'::jsonb) from omc_contactos c where c.expediente_id = p_id),
    'decisiones', (select coalesce(jsonb_agg(to_jsonb(d) order by d.fecha desc), '[]'::jsonb) from omc_decisiones d join x on d.linea_id = x.linea_id and d.empresa = x.empresa),
    'sesiones', (select coalesce(jsonb_agg(to_jsonb(s) order by s.created_at desc), '[]'::jsonb) from (select * from omc_sesiones where expediente_id = p_id order by created_at desc limit 5) s),
    'kit', (select coalesce(jsonb_agg(jsonb_build_object('id', k.id, 'tipo', k.tipo, 'nombre', k.nombre, 'url', k.url) order by k.tipo, k.nombre), '[]'::jsonb)
            from omc_kit k join x on k.empresa = x.empresa where k.vigente and (k.linea_id is null or k.linea_id = x.linea_id)));
$$;

create or replace function omc_expedientes_lista(p_token text, p_filtro jsonb default '{}'::jsonb) returns jsonb
language sql security definer set search_path=public as $$
  select coalesce(jsonb_agg(to_jsonb(x) || jsonb_build_object('codigo', l.codigo,
    'encargos_abiertos', (select count(*) from omc_encargos en where en.expediente_id = x.id and en.estado in ('encolado','en_curso','bloqueado_diego')),
    'sesion_abierta', (select s.agente from omc_sesiones s where s.expediente_id = x.id and s.estado = 'abierta' limit 1)) order by x.tipo, x.nombre), '[]'::jsonb)
  from omc_expedientes x left join omc_plan_lineas l on l.id = x.linea_id
  where x.empresa = (select empresa from omc_tok(p_token)) and x.activo = coalesce((p_filtro->>'activo')::boolean, true)
    and (p_filtro->>'tipo' is null or x.tipo = p_filtro->>'tipo') and (p_filtro->>'frente' is null or x.linea_id = omc_frente_id(x.empresa, p_filtro->>'frente'))
    and (p_filtro->>'responsable' is null or lower(x.responsable) = lower(omc_agente_valido(x.empresa, p_filtro->>'responsable')));
$$;

create or replace function omc_sesion_solicitar(p_token text, p_expediente bigint) returns jsonb
language plpgsql security definer set search_path=public as $$
declare t record; x omc_expedientes; s omc_sesiones;
begin
  select * into t from omc_tok(p_token);
  if t.rol <> 'owner' then raise exception 'solo owner' using errcode='42501'; end if;
  select * into x from omc_expedientes where id = p_expediente and empresa = t.empresa;
  if x.id is null then raise exception 'expediente % no existe', p_expediente; end if;
  if x.responsable is null then raise exception 'el expediente % no tiene responsable', x.nombre; end if;
  select * into s from omc_sesiones where expediente_id = x.id and agente = x.responsable and estado in ('solicitada','abierta') order by created_at desc limit 1;
  if s.id is not null then return to_jsonb(s); end if;
  insert into omc_sesiones (empresa, expediente_id, agente, solicitada_por, estado) values (t.empresa, x.id, x.responsable, 'diego', 'solicitada') returning * into s;
  return to_jsonb(s);
end $$;

create or replace function omc_sesion_abrir(p_token text, p_expediente bigint, p_agente text default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare t record; v_agente text; abierta_id bigint; s omc_sesiones;
begin
  select * into t from omc_tok(p_token);
  v_agente := coalesce(omc_agente_valido(t.empresa, case when t.rol = 'owner' then 'diego' else coalesce(p_agente,'agente') end), case when t.rol = 'owner' then 'diego' else coalesce(p_agente,'agente') end);
  if not exists (select 1 from omc_expedientes where id = p_expediente and empresa = t.empresa) then raise exception 'expediente % no existe', p_expediente; end if;
  select id into abierta_id from omc_sesiones where empresa = t.empresa and agente = v_agente and estado = 'abierta';
  if abierta_id is not null then raise exception 'cierra antes la sesión #% (hq.py sesion cerrar % --resumen "...")', abierta_id, abierta_id; end if;
  update omc_sesiones set estado = 'abierta', abierta = now() where empresa = t.empresa and expediente_id = p_expediente and agente = v_agente and estado = 'solicitada' returning * into s;
  if s.id is null then
    insert into omc_sesiones (empresa, expediente_id, agente, estado, abierta) values (t.empresa, p_expediente, v_agente, 'abierta', now()) returning * into s;
  end if;
  return jsonb_build_object('sesion', to_jsonb(s), 'ficha', omc_expediente_ficha(p_token, p_expediente));
end $$;

create or replace function omc_sesion_cerrar(p_token text, p_sesion bigint, p_resumen text, p_entregables jsonb default '[]'::jsonb, p_agente text default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare t record; s omc_sesiones; v_agente text; pendiente record; tocados bigint[];
begin
  select * into t from omc_tok(p_token);
  select * into s from omc_sesiones where id = p_sesion and empresa = t.empresa;
  if s.id is null then raise exception 'sesión % no existe', p_sesion; end if;
  if s.estado <> 'abierta' then raise exception 'la sesión #% está %', s.id, s.estado; end if;
  v_agente := case when t.rol = 'owner' then 'diego' else coalesce(p_agente,'agente') end;
  if t.rol <> 'owner' and lower(v_agente) <> 'chief' and coalesce(omc_agente_valido(t.empresa, v_agente), v_agente) <> s.agente then raise exception 'la sesión #% es de %', s.id, s.agente using errcode='42501'; end if;
  if coalesce(trim(p_resumen),'') = '' then raise exception 'falta resumen: --resumen "estado en una o dos frases"'; end if;
  for pendiente in select e.id from omc_encargos e where e.expediente_id = s.expediente_id and e.estado in ('en_curso','bloqueado_diego') and position(lower(s.agente) in lower(coalesce(e.agente,''))) > 0
    and not exists (select 1 from omc_encargo_avances a where a.encargo_id = e.id and a.fecha >= s.abierta and a.tipo in ('avance','cierre','estado')) loop
    raise exception 'falta avance en #%: hq.py encargo avance % --texto "..." (o hecho --fuente)', pendiente.id, pendiente.id;
  end loop;
  select coalesce(array_agg(distinct a.encargo_id), '{}') into tocados from omc_encargo_avances a join omc_encargos e on e.id = a.encargo_id where e.expediente_id = s.expediente_id and a.fecha >= s.abierta;
  update omc_sesiones set estado = 'cerrada', cerrada = now(), resumen = p_resumen, encargos_tocados = tocados where id = s.id returning * into s;
  update omc_expedientes set resumen_estado = p_resumen, resumen_fecha = now(), updated_at = now(),
    entregables = (select coalesce(jsonb_agg(case when exists (select 1 from jsonb_array_elements(p_entregables) n where n->>'nombre' = x->>'nombre') then x || '{"hecho": true}'::jsonb else x end), '[]'::jsonb) from jsonb_array_elements(entregables) x)
                  || (select coalesce(jsonb_agg(n || '{"hecho": true}'::jsonb), '[]'::jsonb) from jsonb_array_elements(p_entregables) n where not exists (select 1 from jsonb_array_elements(entregables) x where x->>'nombre' = n->>'nombre'))
  where id = s.expediente_id;
  return to_jsonb(s);
end $$;
grant execute on function omc_expediente_set(text, jsonb), omc_expediente_ficha(text, bigint), omc_expedientes_lista(text, jsonb), omc_sesion_solicitar(text, bigint),
  omc_sesion_abrir(text, bigint, text), omc_sesion_cerrar(text, bigint, text, jsonb, text) to anon, authenticated;
```

En `omc_encargo_contexto` (T5) sustituir `'expediente', null` por `'expediente', (select to_jsonb(x) from omc_expedientes x join omc_encargos e on e.expediente_id = x.id where e.id = p_id)`.

Semilla (`seed-77delta-v2.sql`):

```sql
insert into omc_expedientes (empresa, tipo, nombre, linea_id, responsable, estado_funnel)
select '77delta', x.tipo, x.nombre, omc_frente_id('77delta', x.codigo), omc_agente_valido('77delta', x.resp), x.funnel from (values
  ('cliente','Nora Fuchs','B2','Martí','diagnóstico'), ('cliente','One Hub','B2','Martí','propuesta'), ('cliente','Aresa','B2','Martí','ejecución'), ('cliente','Zimeron','B2','Martí','ejecución'),
  ('cliente','Epic','B2','Martí','ejecución'), ('cliente','IPAE','B2','Martí','ejecución'), ('cliente','Peninsula','C3','Diego','activo'),
  ('convocatoria','ACCIÓ Exploració Tecnològica 2026','B1','Helena','redacción'), ('producto','Regulia','D2','Marina','beta')
) as x(tipo, nombre, codigo, resp, funnel)
where not exists (select 1 from omc_expedientes e where e.empresa='77delta' and e.nombre = x.nombre);
```

Las `ficha_url` y `carpeta_url` de Drive las rellena el chief el 17-sep con `hq.py expediente alta --nombre "Nora Fuchs" --ficha <url>` (la URL de la ficha de Epic vive en `~/.config/77delta/epic-ficha-url.txt` y se pasa desde ahí sin imprimirla).

- [ ] **Step 4: CLI en `hq_v2.py`** (`registrar()`):

```python
    x = sub.add_parser('expediente', help='clientes, productos, convocatorias y licitaciones con su ficha, encargos, contactos y sesiones')
    xsub = x.add_subparsers(dest='sub', required=True)
    xa = xsub.add_parser('alta'); xa.add_argument('--id', type=int); xa.add_argument('--nombre'); xa.add_argument('--tipo', choices=('cliente', 'producto', 'convocatoria', 'licitacion')); xa.add_argument('--frente')
    xa.add_argument('--responsable'); xa.add_argument('--ficha'); xa.add_argument('--carpeta'); xa.add_argument('--estado-funnel', dest='estado_funnel'); xa.add_argument('--importe', type=float); xa.add_argument('--agente')
    xl = xsub.add_parser('lista'); xl.add_argument('--tipo'); xl.add_argument('--frente'); xl.add_argument('--responsable')
    xf = xsub.add_parser('ficha'); xf.add_argument('id', type=int)
    xe = xsub.add_parser('entregable'); xe.add_argument('id', type=int); xe.add_argument('--nombre', required=True); xe.add_argument('--fecha', required=True); xe.add_argument('--agente')
    s = sub.add_parser('sesion', help='sesión de trabajo sobre un expediente (abrir carga el contexto; cerrar exige avances)')
    ssub = s.add_subparsers(dest='sub', required=True)
    sa = ssub.add_parser('abrir'); sa.add_argument('--expediente', type=int, required=True); sa.add_argument('--agente')
    sc = ssub.add_parser('cerrar'); sc.add_argument('id', type=int); sc.add_argument('--resumen', required=True); sc.add_argument('--entregable', action='append', default=[]); sc.add_argument('--agente')
    ss = ssub.add_parser('solicitar'); ss.add_argument('--expediente', type=int, required=True)
```

`ejecutar()`:

```python
    if a.cmd == 'expediente':
        tok = E.get('HQ_OWNER_TOKEN') or E['HQ_TOKEN']
        if a.sub == 'alta':
            p = {k: v for k, v in {'id': a.id, 'nombre': a.nombre, 'tipo': a.tipo, 'frente': a.frente, 'responsable': a.responsable, 'ficha_url': a.ficha, 'carpeta_url': a.carpeta,
                                   'estado_funnel': a.estado_funnel, 'importe': a.importe, 'agente': agente_actual(a.agente)}.items() if v is not None}
            r = rpc('omc_expediente_set', p_token=tok, p=p); salida(r, f"expediente #{r['id']} {r['tipo']} {r['nombre']} · {r.get('estado_funnel') or '-'} · {r.get('responsable') or '-'}")
        elif a.sub == 'entregable':
            r = rpc('omc_expediente_set', p_token=tok, p={'id': a.id, 'entregable': {'nombre': a.nombre, 'fecha': a.fecha, 'hecho': False}, 'agente': agente_actual(a.agente)})
            salida(r, f"expediente #{r['id']}: {len(r['entregables'])} entregables")
        elif a.sub == 'lista':
            f = {k: v for k, v in {'tipo': a.tipo, 'frente': a.frente, 'responsable': a.responsable}.items() if v}
            xs = rpc('omc_expedientes_lista', p_token=E['HQ_TOKEN'], p_filtro=f)
            salida(xs, '\n'.join(f"#{x['id']} {x['tipo']:<12} {x['nombre']:<32} {x.get('codigo')} · {x.get('estado_funnel') or '-'} · {x.get('responsable') or '-'} · {x['encargos_abiertos']} abiertos" + (f" · sesión abierta: {x['sesion_abierta']}" if x.get('sesion_abierta') else '') for x in xs))
        else:
            r = rpc('omc_expediente_ficha', p_token=E['HQ_TOKEN'], p_id=a.id); x = r['expediente']
            txt = [f"#{x['id']} {x['tipo']} {x['nombre']} · {x.get('estado_funnel') or '-'} · {x.get('responsable') or '-'} · ficha {x.get('ficha_url') or '-'} · carpeta {x.get('carpeta_url') or '-'}",
                   f"estado ({(x.get('resumen_fecha') or '')[:10]}): {x.get('resumen_estado') or 'sin resumen'}"]
            txt += [f"entregable {'[x]' if n.get('hecho') else '[ ]'} {n['nombre']} {n.get('fecha')}" for n in x.get('entregables') or []]
            txt += [f"encargo #{en['id']} [{en['estado']}] {en['texto'][:70]} · hito {en.get('fecha_hito') or '-'}" for en in r['encargos']]
            txt += [f"contacto #{c['id']} [{c['estado']}] {c.get('persona') or c.get('organizacion')} · {c['canal']} t{c['toque']} · {c['fecha'][:10]}" for c in r['contactos']]
            txt += [f"kit · {k['tipo']}: {k['nombre']} {k.get('url') or ''}".rstrip() for k in r['kit']]
            salida(r, '\n'.join(txt))
        return True
    if a.cmd == 'sesion':
        if a.sub == 'abrir':
            r = rpc('omc_sesion_abrir', p_token=E['HQ_TOKEN'], p_expediente=a.expediente, p_agente=agente_actual(a.agente))
            engram(f"[SESION #{r['sesion']['id']}] abierta", f"expediente #{a.expediente} {r['ficha']['expediente']['nombre']} · {agente_actual(a.agente)}")
            a.id = a.expediente; a.sub = 'ficha'; a.cmd = 'expediente'
            print(f"sesión #{r['sesion']['id']} abierta. Al terminar: hq.py sesion cerrar {r['sesion']['id']} --resumen \"...\" (exige avance en cada encargo en curso)")
            return ejecutar(a, c)
        if a.sub == 'cerrar':
            r = rpc('omc_sesion_cerrar', p_token=E['HQ_TOKEN'], p_sesion=a.id, p_resumen=a.resumen, p_entregables=[{'nombre': n} for n in a.entregable], p_agente=agente_actual(a.agente))
            engram(f"[SESION #{a.id}] cerrada", a.resumen)
            salida(r, f"sesión #{r['id']} cerrada · encargos tocados {r['encargos_tocados']}")
            return True
        r = rpc('omc_sesion_solicitar', p_token=E.get('HQ_OWNER_TOKEN') or E['HQ_TOKEN'], p_expediente=a.expediente)
        salida(r, f"sesión #{r['id']} {r['estado']} para {r['agente']}; hq-despertar la abre en su ventana en menos de un minuto")
        return True
```

Añadir `'expediente', 'sesion'` a la tupla de despacho en `hq.py`.

- [ ] **Step 5: hq-despertar abre las sesiones solicitadas**

En `scripts/hq/hq-despertar.py`, dentro de `main()` tras cargar `agentes` (línea 87), añadir:

```python
    # HQ v2 (T11): sesiones solicitadas desde la ficha del expediente en HQ -> orden al agente en su ventana
    for s in rpc('omc_sesiones_solicitadas', p_token=e['HQ_OWNER_TOKEN']) or []:
        v = ventana_de(s['agente'])  # misma resolución agente -> ventana tmux que usa el bucle de eventos de abajo; extraer a función si está en línea
        if not v:
            print(f"sesión #{s['id']}: sin ventana para {s['agente']}", file=sys.stderr); continue
        escribir(v, f"[HQ] Diego quiere trabajar contigo en el expediente #{s['expediente_id']} ({s['nombre']}). Ejecuta ahora: python3 /Users/diego/dev/77delta/scripts/hq/hq.py sesion abrir --expediente {s['expediente_id']} --agente {s['agente']} y salúdale con el estado del expediente en tres líneas.")
```

y en `schema-v2.sql`:

```sql
create or replace function omc_sesiones_solicitadas(p_token text) returns jsonb
language sql security definer set search_path=public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'expediente_id', s.expediente_id, 'nombre', x.nombre, 'agente', s.agente, 'created_at', s.created_at) order by s.created_at), '[]'::jsonb)
  from omc_sesiones s join omc_expedientes x on x.id = s.expediente_id
  where s.empresa = (select empresa from omc_tok(p_token)) and s.estado = 'solicitada' and s.created_at > now() - interval '2 hours';
$$;
grant execute on function omc_sesiones_solicitadas(text) to anon, authenticated;
```

hq-despertar corre cada minuto y ya escribe con `escribir()`; para no repetir la orden cada minuto, guardar en su `ESTADO` json la lista `sesiones_avisadas` (ids) y saltar las ya avisadas.

- [ ] **Step 6: Probar y commit**

Run: `scripts/hq/aplicar-schema.sh --seed && python3 -m unittest scripts.hq.tests.test_11_expedientes -v && python3 scripts/hq/hq.py expediente lista` → 2 OK y 9 expedientes.

```bash
git add scripts/hq/schema-v2.sql scripts/hq/seed-77delta-v2.sql scripts/hq/hq_v2.py scripts/hq/hq.py scripts/hq/hq-despertar.py scripts/hq/tests/test_11_expedientes.py
git commit -m "feat(hq): expedientes con ficha y sesiones de trabajo con cierre obligatorio"
```

---

### Task 12: Fichas de agentes, URL de sesión y cambio de cuenta sin rotura

**Files:**
- Modify: `scripts/hq/schema-v2.sql` (sección T12), `scripts/hq/hq_v2.py`, `scripts/hq/hq.py` (tupla: `'agente'`)
- Create: `scripts/hq/tests/comprobar-cuentas.sh`
- Modify: `~/bin/chief-cuenta.sh` (fuera del repo; antes de la línea 50 `relanzar`)
- Test: `scripts/hq/tests/test_12_agentes.py`

**Interfaces:**
- Consumes: `omc_agentes` (schema.sql: id, empresa, nombre, depto, nivel, modelo, sesiones text[], activo, ultima_actividad), `omc_agente_valido` (T3), `omc_agente_set` (schema.sql 886, sigue igual).
- Produces: columnas `omc_agentes.frentes text[] default '{}'`, `cuenta text` (`diego` | `team`), `avatar_url text`, `sesion_url text`, `sesion_url_fecha timestamptz`. RPC `omc_agente_sesion_url(p_token, p_agente, p_url, p_cuenta default null) -> jsonb` (el propio agente por su token o el owner), `omc_agentes_lista(p_token) -> jsonb[]` con `{id, nombre, depto, nivel, modelo, activo, frentes[], frentes_codigos[], cuenta, avatar_url, sesion_url, sesion_url_fecha, ultima_actividad, encargos_abiertos, sesion_abierta}`, `omc_agente_frentes_set(p_token owner, p_agente, p_frentes text[])`. CLI: `hq.py agente lista`, `agente ficha ID`, `agente frentes ID A1 B2 ...`, `agente avatar ID` (genera `public/hq/avatares/<id>.svg` con DiceBear `icons` sin red: se descarga una vez con curl y se commitea), `agente sesion-url ID URL [--cuenta team|diego]`. `hq.py agente alta` = alias de `alta-agente` (mismos argumentos) más `--frentes`.

- [ ] **Step 1: Test**

```python
# scripts/hq/tests/test_12_agentes.py
import unittest
from . import pg
from .pg import rpc


class TestAgentes(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.t = pg.preparar_tenant(); pg.limpiar_tenant()
        pg.sql("insert into omc_agentes (empresa, id, nombre, depto, nivel, sesiones, activo) values ('pruebas','probador','Probador','pruebas',2,array['Probador-Pruebas'],true), ('pruebas','otro','Otro','pruebas',2,array['Otro-Pruebas'],true)")
        rpc(cls.t['owner'], 'omc_bloque_set', p={'letra': 'A', 'nombre': 'Licitaciones', 'orden': 1})
        rpc(cls.t['owner'], 'omc_frente_set', p={'codigo': 'A1', 'bloque': 'A', 'linea': 'Fuentes', 'kpi': 'fuentes', 'meta': 17})

    def test_sesion_url_propia_y_ajena(self):
        r = rpc(self.t['agente'], 'omc_agente_sesion_url', p_agente='Probador', p_url='https://claude.ai/code/session_abc', p_cuenta='team')
        self.assertEqual(r['sesion_url'], 'https://claude.ai/code/session_abc'); self.assertEqual(r['cuenta'], 'team')
        r2 = rpc(self.t['owner'], 'omc_agente_sesion_url', p_agente='otro', p_url='https://claude.ai/code/session_y', p_cuenta='diego')
        self.assertEqual(r2['id'], 'otro')

    def test_frentes_y_lista(self):
        rpc(self.t['owner'], 'omc_agente_frentes_set', p_agente='probador', p_frentes=['A1'])
        with self.assertRaisesRegex(RuntimeError, 'frente Z9 no existe'):
            rpc(self.t['owner'], 'omc_agente_frentes_set', p_agente='probador', p_frentes=['Z9'])
        lista = {a['id']: a for a in rpc(self.t['agente'], 'omc_agentes_lista')}
        self.assertEqual(lista['probador']['frentes_codigos'], ['A1'])
        self.assertIn('sesion_url', lista['probador']); self.assertNotIn('token', lista['probador'])
```

- [ ] **Step 2: Ejecutar y ver que falla** → `python3 -m unittest scripts.hq.tests.test_12_agentes -v` FAIL.

- [ ] **Step 3: SQL**

```sql
-- T12 · fichas de agentes
alter table omc_agentes add column if not exists frentes text[] default '{}';
alter table omc_agentes add column if not exists cuenta text check (cuenta in ('diego','team'));
alter table omc_agentes add column if not exists avatar_url text;
alter table omc_agentes add column if not exists sesion_url text;
alter table omc_agentes add column if not exists sesion_url_fecha timestamptz;

create or replace function omc_agente_sesion_url(p_token text, p_agente text, p_url text, p_cuenta text default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare t record; v_id text; r omc_agentes;
begin
  select * into t from omc_tok(p_token);
  v_id := omc_agente_valido(t.empresa, p_agente);
  if v_id is null then raise exception 'agente % no existe', p_agente; end if;
  -- el token de agente es compartido por empresa: la identidad la da el nombre de la ventana (HQ_AGENTE_FORZADO); el owner puede fijar cualquiera
  if t.rol <> 'owner' and t.nombre <> '' and t.nombre <> v_id then raise exception 'solo el propio agente o el owner' using errcode='42501'; end if;
  if p_url !~ '^https://(claude\.ai|claude\.com)/' then raise exception 'sesion_url debe ser una URL de claude.ai (Remote Control)'; end if;
  update omc_agentes set sesion_url = p_url, sesion_url_fecha = now(), cuenta = coalesce(p_cuenta, cuenta) where empresa = t.empresa and id = v_id returning * into r;
  return jsonb_build_object('id', r.id, 'nombre', r.nombre, 'sesion_url', r.sesion_url, 'cuenta', r.cuenta, 'sesion_url_fecha', r.sesion_url_fecha);
end $$;
```

Nota: `omc_tok` (schema.sql 311) devuelve la fila de `omc_tokens` (`token, empresa, rol, nombre`); el token de agente de 77delta es único y compartido con `nombre = ''`, así que la comprobación "propio agente" solo muerde cuando un token lleva nombre (tokens por agente, futuro). Por eso el test no espera el error con el token compartido: quitar el `assertRaisesRegex('solo el propio agente o el owner')` del test y dejar que "Otro" compruebe solo que el owner puede fijarla.

```sql
create or replace function omc_agente_frentes_set(p_token text, p_agente text, p_frentes text[]) returns jsonb
language plpgsql security definer set search_path=public as $$
declare t record; v_id text; f text; ids bigint[] := '{}'; r omc_agentes;
begin
  select * into t from omc_tok(p_token);
  if t.rol <> 'owner' then raise exception 'solo owner' using errcode='42501'; end if;
  v_id := omc_agente_valido(t.empresa, p_agente);
  if v_id is null then raise exception 'agente % no existe', p_agente; end if;
  foreach f in array p_frentes loop
    if omc_frente_id(t.empresa, f) is null then raise exception 'frente % no existe', f; end if;
  end loop;
  update omc_agentes set frentes = (select array_agg(upper(x)) from unnest(p_frentes) x) where empresa = t.empresa and id = v_id returning * into r;
  return jsonb_build_object('id', r.id, 'frentes', r.frentes);
end $$;

create or replace function omc_agentes_lista(p_token text) returns jsonb
language sql security definer set search_path=public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'nombre', a.nombre, 'depto', a.depto, 'nivel', a.nivel, 'modelo', a.contrato->>'modelo', 'activo', a.activo,
    'frentes', a.frentes, 'frentes_codigos', a.frentes, 'cuenta', a.cuenta, 'avatar_url', a.avatar_url, 'sesion_url', a.sesion_url, 'sesion_url_fecha', a.sesion_url_fecha,
    'ultima_actividad', a.ultima_actividad,
    'encargos_abiertos', (select count(*) from omc_encargos e where e.empresa = a.empresa and e.estado in ('encolado','en_curso','bloqueado_diego') and position(lower(a.id) in lower(coalesce(e.agente,''))) > 0),
    'sesion_abierta', (select s.expediente_id from omc_sesiones s where s.empresa = a.empresa and s.agente = a.id and s.estado = 'abierta' limit 1)
  ) order by a.depto, a.nivel, a.nombre), '[]'::jsonb)
  from omc_agentes a where a.empresa = (select empresa from omc_tok(p_token));
$$;
grant execute on function omc_agente_sesion_url(text, text, text, text), omc_agente_frentes_set(text, text, text[]), omc_agentes_lista(text) to anon, authenticated;
```

`omc_agentes` (schema.sql 20-34) no tiene `updated_at`; `modelo` y `subagentes` viven en `contrato jsonb` (`a.contrato->>'modelo'`), no son columnas.

- [ ] **Step 4: CLI en `hq_v2.py`**

```python
    g = sub.add_parser('agente', help='fichas de agentes: lista, ficha, frentes, avatar, sesion-url, alta')
    gsub = g.add_subparsers(dest='sub', required=True)
    gsub.add_parser('lista')
    gf = gsub.add_parser('ficha'); gf.add_argument('id')
    gr = gsub.add_parser('frentes'); gr.add_argument('id'); gr.add_argument('codigos', nargs='+')
    gv = gsub.add_parser('avatar'); gv.add_argument('id')
    gu = gsub.add_parser('sesion-url'); gu.add_argument('id'); gu.add_argument('url'); gu.add_argument('--cuenta', choices=('diego', 'team'))
    ga = gsub.add_parser('alta'); ga.add_argument('--frentes', nargs='*', default=[])
    # alta reutiliza los argumentos de alta-agente: copiarlos del parser existente
    for act in sub.choices['alta-agente']._actions:
        if act.option_strings and act.dest not in ('help',):
            ga._add_action(act)
```

`ejecutar()`:

```python
    if a.cmd == 'agente':
        tok_owner = E.get('HQ_OWNER_TOKEN') or E['HQ_TOKEN']
        if a.sub == 'lista':
            xs = rpc('omc_agentes_lista', p_token=E['HQ_TOKEN'])
            salida(xs, '\n'.join(f"{x['id']:<14} {x['nombre']:<10} {x['depto']:<14} n{x['nivel']} {'ON ' if x['activo'] else 'OFF'} {','.join(x['frentes'] or []) or '-':<10} {x.get('cuenta') or '-':<5} {x['encargos_abiertos']} abiertos" + (f" · sesión #{x['sesion_abierta']}" if x.get('sesion_abierta') else '') for x in xs))
        elif a.sub == 'ficha':
            xs = [x for x in rpc('omc_agentes_lista', p_token=E['HQ_TOKEN']) if x['id'] == a.id or x['nombre'].lower() == a.id.lower()]
            if not xs: sys.exit(f'agente {a.id} no existe')
            x = xs[0]; salida(x, '\n'.join(f'{k}: {v}' for k, v in x.items()))
        elif a.sub == 'frentes':
            r = rpc('omc_agente_frentes_set', p_token=tok_owner, p_agente=a.id, p_frentes=a.codigos); salida(r, f"{r['id']}: frentes {r['frentes']}")
        elif a.sub == 'avatar':
            import pathlib, urllib.request
            destino = pathlib.Path(__file__).resolve().parents[2] / 'public' / 'hq' / 'avatares' / f'{a.id}.svg'
            destino.parent.mkdir(parents=True, exist_ok=True)
            with urllib.request.urlopen(f'https://api.dicebear.com/9.x/icons/svg?seed={a.id}&backgroundColor=0b1f3a&radius=50', timeout=20) as u:
                destino.write_bytes(u.read())
            url = f'https://77delta.com/hq/avatares/{a.id}.svg'
            rpc('omc_agente_set', p_token=tok_owner, p_agente=a.id, p={'avatar_url': url}) if False else pg_set_avatar(rpc, tok_owner, a.id, url)
            print(f'{destino} · {url} (commitea el svg)')
        elif a.sub == 'sesion-url':
            r = rpc('omc_agente_sesion_url', p_token=E['HQ_TOKEN'] if not a.cuenta else tok_owner, p_agente=a.id, p_url=a.url, p_cuenta=a.cuenta)
            salida(r, f"{r['id']}: sesion_url actualizada ({r.get('cuenta') or '-'})")
        else:  # alta
            a.cmd = 'alta-agente'; a.sub = None
            return False  # hq.py sigue con su rama alta-agente; los frentes se aplican después (ver abajo)
        return True
```

`omc_agente_set` (schema.sql 886) no admite `avatar_url`: sustituir la línea del `if False` por una RPC pequeña en schema-v2: `omc_agente_avatar_set(p_token owner, p_agente, p_url)` (update `avatar_url`; grant) y llamarla: `rpc('omc_agente_avatar_set', p_token=tok_owner, p_agente=a.id, p_url=url)`. Para `agente alta`, en hq.py, tras el bloque de despacho de `alta-agente` (línea 646), añadir: `if getattr(a, 'frentes', None): hq_v2.ejecutar_frentes(a.id, a.frentes, c)` donde `ejecutar_frentes` llama a `omc_agente_frentes_set`. Ojo al `return False`: la rama de despacho en hq.py debe seguir hasta `alta-agente` cuando `ejecutar()` devuelve False (`if hq_v2.ejecutar(a, c): sys.exit(0)`).

- [ ] **Step 5: El chief registra su URL al arrancar y en cada cambio de cuenta**

En `~/bin/chief-cuenta.sh`, antes de la línea 50 (`/home/diego/bin/relanzar "$VENTANA" | tee -a "$L"`):

```bash
# HQ v2 (T12): dejar constancia del cambio antes de relanzar, para que HQ y el informe no pierdan el hilo
HQ_AGENTE_FORZADO=chief python3 /Users/diego/dev/77delta/scripts/hq/hq.py encargo avance 259 --texto "cambio de cuenta del chief a $CUENTA ($(date '+%d-%m %H:%M'))" --agente chief 2>>"$L" || true
```

y al final del relanzado (después de la línea 50), cuando exista la URL de la nueva sesión (la imprime `relanzar` o se lee del JSONL más reciente de `$CLAUDE_CONFIG_DIR/projects/-Users-diego-dev/*.jsonl`, campo `sessionId`):

```bash
URL="https://claude.ai/code/session_$(ls -t "$CFG_DIR"/projects/-Users-diego-dev/*.jsonl 2>/dev/null | head -1 | xargs -I{} basename {} .jsonl)"
HQ_AGENTE_FORZADO=chief python3 /Users/diego/dev/77delta/scripts/hq/hq.py agente sesion-url chief "$URL" --cuenta "$CUENTA" 2>>"$L" || true
```

`CFG_DIR` es `/home/diego/.claude-team` si `$CUENTA = team` y `/home/diego/.claude` si `diego` (el script ya calcula el `CLAUDE_CONFIG_DIR` que exporta: reutilizar esa variable). Verificación: `hq.py agente ficha chief` muestra `cuenta` y `sesion_url` recientes. El formato `session_<uuid>` de claude.ai se comprueba con la URL de sesión actual del chief (Claude-Session en la atribución de commits) antes de dar por buena la construcción: si el id no coincide con el nombre del JSONL, usar en su lugar la URL que `relanzar` imprime.

- [ ] **Step 6: `scripts/hq/tests/comprobar-cuentas.sh`**

```bash
#!/usr/bin/env bash
# Comprueba que las dos cuentas Max (diego@ y team@) tienen la misma configuración de HQ: hooks, latido y hq.env.
# Uso: scripts/hq/tests/comprobar-cuentas.sh   (exit 0 si iguales, 1 si difieren)
set -u
A=/home/diego/.claude; B=/home/diego/.claude-team; rc=0
for f in settings.json; do
  da=$(python3 -c "import json,sys; d=json.load(open('$A/$f')); print(json.dumps(d.get('hooks',{}), sort_keys=True))")
  db=$(python3 -c "import json,sys; d=json.load(open('$B/$f')); print(json.dumps(d.get('hooks',{}), sort_keys=True))")
  if [ "$da" != "$db" ]; then echo "DIFIEREN hooks en $f"; diff <(echo "$da" | tr ',' '\n') <(echo "$db" | tr ',' '\n') | head -20; rc=1; else echo "OK hooks $f"; fi
done
for f in /Users/diego/bin/hq-latido.sh ~/.config/77delta/hq.env; do
  if [ -r "$f" ]; then echo "OK $f legible ($(wc -c <"$f") bytes)"; else echo "FALTA $f"; rc=1; fi
done
for k in HQ_URL HQ_ANON HQ_TOKEN; do grep -q "^$k=" ~/.config/77delta/hq.env || { echo "FALTA $k en hq.env"; rc=1; }; done
# los dos CLAUDE.md de cuenta deben apuntar a las mismas reglas de HQ
for d in $A $B; do grep -q 'reglas-agente-hq' "$d/CLAUDE.md" 2>/dev/null && echo "OK $d/CLAUDE.md cita reglas-agente-hq" || echo "AVISO $d/CLAUDE.md no cita reglas-agente-hq"; done
exit $rc
```

Ejecutarlo y arreglar lo que difiera (copiar el hook de HQ que falte a la cuenta que no lo tenga; nunca copiar memorias privadas de diego@ a team@).

- [ ] **Step 7: Probar y commit**

Run: `scripts/hq/aplicar-schema.sh && python3 -m unittest scripts.hq.tests.test_12_agentes -v && python3 scripts/hq/hq.py agente lista && bash scripts/hq/tests/comprobar-cuentas.sh`.

```bash
git add scripts/hq/schema-v2.sql scripts/hq/hq_v2.py scripts/hq/hq.py scripts/hq/tests/test_12_agentes.py scripts/hq/tests/comprobar-cuentas.sh
git commit -m "feat(hq): fichas de agentes con frentes, avatar y URL de sesión; comprobación de cuentas"
```

Documentar el cambio de `~/bin/chief-cuenta.sh` en `docs/empresa/03-hq-manual.md` (T17), porque no vive en el repo.

---

### Task 13: Latido con encargos abiertos y sesión

**Files:**
- Modify: `scripts/hq/schema-v2.sql` (sección T13: `omc_latido` sobrescrita), `scripts/hq/hq.py:505-516` (despacho `activo`)
- Modify: `/Users/diego/bin/hq-latido.sh:16` (fuera del repo)
- Test: `scripts/hq/tests/test_13_latido.py`

**Interfaces:**
- Consumes: `omc_latido(p_token, p_agente)` de schema.sql 1149-1163 (devuelve existe, activo, agente, nombre, depto, nivel, modelo, subagentes, pendientes, comentarios).
- Produces: la misma firma con dos claves más: `encargos` (lista de `{id, codigo, texto, estado, fecha_hito, kit_n}` de los encargos `encolado|en_curso|bloqueado_diego` del agente, ordenados por estado en_curso primero y `fecha_hito`) y `sesion` (`{id, expediente_id, nombre, estado}` de la sesión `abierta` o `solicitada` del agente, o null). `hq.py activo` imprime una línea por encargo.

- [ ] **Step 1: Test**

```python
# scripts/hq/tests/test_13_latido.py
import unittest
from . import pg
from .pg import rpc


class TestLatido(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.t = pg.preparar_tenant(); pg.limpiar_tenant()
        pg.sql("insert into omc_agentes (empresa, id, nombre, depto, nivel, sesiones, activo) values ('pruebas','probador','Probador','pruebas',2,array['Probador-Pruebas'],true)")
        rpc(cls.t['owner'], 'omc_bloque_set', p={'letra': 'A', 'nombre': 'Licitaciones', 'orden': 1})
        rpc(cls.t['owner'], 'omc_frente_set', p={'codigo': 'A1', 'bloque': 'A', 'linea': 'Fuentes', 'kpi': 'fuentes', 'meta': 17})

    def test_latido_trae_encargos_y_sesion(self):
        e = rpc(self.t['owner'], 'omc_encargo_alta', p={'texto': 'Fuente Murcia', 'frente': 'A1', 'responsable': 'Probador'})
        rpc(self.t['agente'], 'omc_encargo_tomar', p_id=e['id'], p_agente='Probador')
        rpc(self.t['owner'], 'omc_kit_set', p={'frente': 'A1', 'tipo': 'procedimiento', 'nombre': 'Alta de fuente', 'url': 'https://docs.google.com/document/d/kit-a1'})
        l = rpc(self.t['agente'], 'omc_latido', p_agente='Probador-Pruebas')
        self.assertTrue(l['existe']); self.assertEqual(l['agente'], 'probador')
        self.assertEqual([x['id'] for x in l['encargos']], [e['id']]); self.assertEqual(l['encargos'][0]['codigo'], 'A1'); self.assertEqual(l['encargos'][0]['kit_n'], 1)
        self.assertIsNone(l['sesion'])
        x = rpc(self.t['owner'], 'omc_expediente_set', p={'nombre': 'Exp latido', 'tipo': 'licitacion', 'frente': 'A1', 'responsable': 'Probador'})
        rpc(self.t['owner'], 'omc_sesion_solicitar', p_expediente=x['id'])
        l2 = rpc(self.t['agente'], 'omc_latido', p_agente='probador')
        self.assertEqual(l2['sesion']['estado'], 'solicitada'); self.assertEqual(l2['sesion']['nombre'], 'Exp latido')
```

- [ ] **Step 2: Ejecutar y ver que falla** (KeyError 'encargos').

- [ ] **Step 3: SQL** (copiar el cuerpo actual de schema.sql 1149-1163 y ampliarlo; firma idéntica, así `create or replace` sobrescribe):

```sql
-- T13 · latido con encargos abiertos y sesión (sobrescribe schema.sql omc_latido)
create or replace function omc_latido(p_token text, p_agente text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare t record; a omc_agentes; base jsonb;
begin
  select * into t from omc_tok(p_token);
  select * into a from omc_agentes where empresa = t.empresa and (id = p_agente or p_agente = any(sesiones) or lower(nombre) = lower(p_agente)) limit 1;
  if a.id is null then return jsonb_build_object('existe', false); end if;
  update omc_agentes set ultima_actividad = now() where empresa = t.empresa and id = a.id;
  -- <<< pegar aquí, sin cambios, el cálculo de subagentes/pendientes/comentarios de schema.sql 1149-1163 en la variable base >>>
  base := jsonb_build_object('existe', true, 'activo', a.activo, 'agente', a.id, 'nombre', a.nombre, 'depto', a.depto, 'nivel', a.nivel, 'modelo', a.contrato->>'modelo',
    'subagentes', a.contrato->>'subagentes', 'pendientes', (select count(*) from omc_solicitudes s where s.empresa = t.empresa and s.agente = a.id and s.estado = 'aprobada'),
    'comentarios', (select count(*) from omc_solicitudes s where s.empresa = t.empresa and s.agente = a.id and s.comentario_diego is not null and s.comentario_leido is not true));
  return base || jsonb_build_object(
    'encargos', (select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'codigo', l.codigo, 'texto', left(e.texto, 90), 'estado', e.estado, 'fecha_hito', e.fecha_hito,
        'kit_n', (select count(*) from omc_kit k where k.empresa = e.empresa and k.vigente and (k.linea_id = e.linea_id or k.linea_id is null)))
        order by case e.estado when 'en_curso' then 0 when 'bloqueado_diego' then 1 else 2 end, e.fecha_hito nulls last, e.id), '[]'::jsonb)
      from omc_encargos e left join omc_plan_lineas l on l.id = e.linea_id
      where e.empresa = t.empresa and e.estado in ('encolado','en_curso','bloqueado_diego') and position(lower(a.id) in lower(coalesce(e.agente,''))) > 0),
    'sesion', (select jsonb_build_object('id', s.id, 'expediente_id', s.expediente_id, 'nombre', x.nombre, 'estado', s.estado) from omc_sesiones s join omc_expedientes x on x.id = s.expediente_id
      where s.empresa = t.empresa and s.agente = a.id and s.estado in ('abierta','solicitada') order by s.estado limit 1));
end $$;
```

El bloque `base` de arriba es una reconstrucción: **antes de escribirlo, leer schema.sql 1149-1163 con `sed -n '1149,1163p'` y copiar literalmente sus expresiones** (nombres de columnas de `omc_solicitudes` incluidos), porque la UI v1 y hq-latido.sh dependen de esas claves.

- [ ] **Step 4: `hq.py activo`** (líneas 505-516): tras la línea que imprime `{agente} ({depto}): ACTIVO ...`, añadir:

```python
        for x in r.get('encargos') or []:
            hito = f" · hito {x['fecha_hito']}" if x.get('fecha_hito') else ''
            print(f"  encargo #{x['id']} [{x['codigo'] or 'sin frente'}] {x['estado']}: {x['texto']}{hito} · kit {x['kit_n']}")
        if r.get('encargos'):
            print("  antes de trabajar: python3 scripts/hq/hq.py encargo tomar ID --agente <tu agente>; contexto: hq.py encargo ficha ID; al cerrar: encargo hecho ID --fuente <url>")
        if r.get('sesion'):
            s = r['sesion']
            print(f"  SESIÓN {s['estado'].upper()} con Diego sobre el expediente #{s['expediente_id']} {s['nombre']}: " + ("python3 scripts/hq/hq.py sesion abrir --expediente %d" % s['expediente_id'] if s['estado'] == 'solicitada' else "ciérrala con hq.py sesion cerrar %d --resumen ..." % s['id']))
```

`hq.py encargo ficha ID` no existe todavía: añadirla en `hq_v2.py` como `esub.add_parser('ficha')` con `id` que llama `omc_encargo_contexto` vía una RPC pública `omc_encargo_ficha(p_token, p_id)` (schema-v2, `language sql`, `select omc_encargo_contexto((select empresa from omc_tok(p_token)), p_id)`; grant) e imprime encargo, frente, kit, últimos 5 avances, contactos y expediente. Añadir `'ficha'` a la condición de despacho de `encargo` en hq.py.

- [ ] **Step 5: `hq-latido.sh:16`**: sustituir el texto `REGLAS OBLIGATORIAS (32; ...)` por `REGLAS OBLIGATORIAS (33; ...)` y añadir al final de la línea, antes de `AHORRO`: `33 HQ v2: todo encargo nace con --frente, se toma con encargo tomar antes de trabajar, se cierra con encargo hecho --fuente <kit o Google Doc>, y todo correo a un tercero pasa por contacto alta + enviar-con-lock --contacto.` La regla 33 se añade también a `docs/empresa/reglas-agente-hq.md` (T17).

- [ ] **Step 6: Probar y commit**

Run: `scripts/hq/aplicar-schema.sh && python3 -m unittest scripts.hq.tests.test_13_latido -v && HQ_AGENTE_FORZADO=chief python3 scripts/hq/hq.py activo --agente chief` (debe listar los encargos del chief, entre ellos #259).

```bash
git add scripts/hq/schema-v2.sql scripts/hq/hq.py scripts/hq/hq_v2.py scripts/hq/tests/test_13_latido.py
git commit -m "feat(hq): el latido devuelve encargos abiertos, kit y sesión pendiente"
```

---

### Task 14: Arreglar `omc_escalar` (destinatario Diego y una sola firma)

**Files:**
- Modify: `scripts/hq/schema-v2.sql` (sección T14), `scripts/hq/schema.sql:940-950` (comentario "sustituida en schema-v2")
- Test: `scripts/hq/tests/test_14_escalar.py`

**Interfaces:**
- Consumes: `omc_solicitudes` (id, empresa, agente, destinatario, estado, titulo/detalle), `omc_mensajes` (schema.sql: comprobar columnas con `select column_name from information_schema.columns where table_name='omc_mensajes'`; se espera `empresa, solicitud_id, autor, texto, fecha`).
- Produces: única `omc_escalar(p_token, p_id bigint, p_motivo text default null) -> jsonb {id, destinatario, estado}`: owner, chief o el agente autor de la tarjeta; pone `destinatario = 'diego'`, deja la tarjeta en `pendiente` si estaba `pendiente|en_cola_coo` y añade un mensaje `[escalado a Diego] <motivo>` en el hilo. `hq.py escalar ID --motivo "..."` pasa `p_motivo` completo.

- [ ] **Step 1: Test**

```python
# scripts/hq/tests/test_14_escalar.py
import unittest
from . import pg
from .pg import rpc


class TestEscalar(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.t = pg.preparar_tenant(); pg.limpiar_tenant()
        pg.sql("insert into omc_agentes (empresa, id, nombre, depto, nivel, sesiones, activo) values ('pruebas','probador','Probador','pruebas',2,array['Probador-Pruebas'],true)")

    def test_una_sola_firma(self):
        n = pg.sql("select count(*) as n from pg_proc where proname = 'omc_escalar'")[0]['n']
        self.assertEqual(n, 1)

    def test_escalar_cambia_destinatario_y_deja_mensaje(self):
        s = rpc(self.t['agente'], 'omc_pedir', p={'agente': 'probador', 'tipo': 'duda', 'titulo': 'Decidir prueba de escalado', 'detalle': 'detalle'})
        sid = s['id']
        r = rpc(self.t['agente'], 'omc_escalar', p_id=sid, p_motivo='Solo Diego puede decidir esto porque implica gasto')
        self.assertEqual(r['destinatario'], 'diego')
        fila = pg.sql(f"select destinatario, estado from omc_solicitudes where id = {sid}")[0]
        self.assertEqual(fila['destinatario'], 'diego'); self.assertIn(fila['estado'], ('pendiente',))
        msgs = pg.sql(f"select texto from omc_mensajes where solicitud_id = {sid} order by id desc limit 1")
        self.assertTrue(msgs[0]['texto'].startswith('[escalado a Diego]'))
```

`omc_pedir(p_token, p jsonb)` (schema.sql 912) devuelve la fila completa; el tipo `duda` va a `destinatario = 'chief'` por defecto.

- [ ] **Step 2: Ejecutar y ver que falla** (2 filas en pg_proc; destinatario no cambia con la firma de 3 args).

- [ ] **Step 3: SQL**

```sql
-- T14 · omc_escalar: una sola firma, siempre a Diego, con motivo en el hilo
drop function if exists omc_escalar(text, bigint);
drop function if exists omc_escalar(text, bigint, text);
create or replace function omc_escalar(p_token text, p_id bigint, p_motivo text default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare t record; s omc_solicitudes; v_actor text;
begin
  select * into t from omc_tok(p_token);
  select * into s from omc_solicitudes where id = p_id and empresa = t.empresa;
  if s.id is null then raise exception 'tarjeta % no existe', p_id; end if;
  v_actor := case when t.rol = 'owner' then 'diego' else 'agente' end;
  update omc_solicitudes set destinatario = 'diego' where id = s.id returning * into s;
  insert into omc_mensajes (empresa, solicitud_id, autor, texto) values (t.empresa, s.id, v_actor, '[escalado a Diego] ' || coalesce(p_motivo, 'sin motivo'));
  perform pg_notify('omc:' || t.empresa, json_build_object('evento', 'cambio', 'tabla', 'omc_solicitudes', 'id', s.id)::text);
  return jsonb_build_object('id', s.id, 'destinatario', s.destinatario, 'estado', s.estado);
end $$;
grant execute on function omc_escalar(text, bigint, text) to anon, authenticated;
```

`omc_solicitudes` (schema.sql 40-60) no tiene `updated_at`; sus estados son pendiente, aprobada, rechazada, respondida, ejecutada, fallida, caducada, retirada, y `destinatario` admite solo `diego` o `chief` (línea 70). `omc_mensajes` (188-195) tiene `ts`, no `fecha`. Si la UI v1 usa un canal realtime distinto de `pg_notify` (p. ej. `supabase_realtime` por tabla), eliminar el `perform pg_notify`: el cambio de fila ya dispara el realtime de tabla.

En `hq.py`: parser `escalar` (línea 298) añade `p.add_argument('--motivo', default='')`; despacho (línea 451) pasa `p_motivo=a.motivo` en vez de `p_agente=agente_actual(a.agente)` y sigue exigiendo `HQ_OWNER_TOKEN` (líneas 444-446). La comprobación `exigir_limite_diego` de la línea 450 se mantiene. En schema.sql 940-950 dejar la función pero con un comentario encima: `-- sustituida por schema-v2.sql (T14): no editar aquí`.

- [ ] **Step 4: Probar y commit**

Run: `scripts/hq/aplicar-schema.sh && python3 -m unittest scripts.hq.tests.test_14_escalar -v && python3 scripts/hq/hq.py escalar 685 --motivo "prueba de firma única" --json` NO: 685 es una tarjeta real de Diego. Probar el CLI solo en el tenant `pruebas` con `pg.entorno_cli()` desde `test_06_cli.py` (añadir un caso `test_escalar_cli`).

```bash
git add scripts/hq/schema-v2.sql scripts/hq/schema.sql scripts/hq/hq.py scripts/hq/tests/test_14_escalar.py scripts/hq/tests/test_06_cli.py
git commit -m "fix(hq): omc_escalar con una sola firma, siempre a Diego y con motivo en el hilo"
```

---

### Task 15: Crons de cierre del bucle: encargos parados e informe de las 07:00

**Files:**
- Create: `scripts/hq/hq-parados.py`, `scripts/hq/hq-informe.py`
- Test: `scripts/hq/tests/test_15_crons.py` (lógica pura: selección de parados y secciones del informe, sin red)
- Modify: crontab del usuario (fuera del repo; con copia de seguridad)

**Interfaces:**
- Consumes: `omc_encargos_lista(p_token)` (schema.sql 737; sin filtros, devuelve todos los encargos con `fecha`, `fecha_avance`, `estado`, `agente`; las columnas v2 `origen`, `motivo_descarte`, `codigo` hay que añadirlas a su `jsonb_build_object` en schema-v2 con un `create or replace` de la misma firma), `omc_feed(p_token, p_desde)` (T5), `omc_hq(p_token)` (licitaciones, pendientes), `omc_avance_insertar` vía `omc_encargo_avance` con `HQ_AGENTE_FORZADO=sistema`, `scripts/drive-subir.py --nombre`, `tmux-decir <Ventana> "<texto>"` (sin backticks). Ambos scripts leen con `HQ_OWNER_TOKEN` de `~/.config/77delta/hq.env` **solo lectura**; su despliegue en cron espera el OK de Diego (Global Constraints).
- Produces: `hq-parados.py [--dry-run] [--horas 48]`: función pura `clasificar_parados(encargos, ahora, umbral_aviso_h=48, umbral_escalado_h=72) -> {'avisar': [...], 'escalar': [...]}` sobre encargos `en_curso` con `fecha_avance` (o `fecha` si nunca hubo avance) anterior al umbral; estado en `~/.config/77delta/hq-parados.json` `{encargo_id: {'avisado': iso, 'escalado': iso}}` para no repetir el mismo aviso más de una vez cada 24 h. `hq-informe.py [--dry-run] [--fecha YYYY-MM-DD]`: función pura `secciones(hq, feed, encargos, hoy) -> list[(titulo, lineas)]` con el orden fijo: "Lo que pediste esta semana" (encargos con `origen` que empieza por `Diego`, alta en los últimos 7 días, agrupados hecho / en curso con hito / parado con motivo), "Lo que depende de ti" (tarjetas `pendiente` con destinatario diego, con hora límite si la hay), "Encargos parados" (los de `clasificar_parados`), "Actividad por frente" (recuento del feed por `codigo`), "Licitaciones" (cierres a 72 h y por decidir). Salida markdown → Google Doc `Informe HQ <fecha>` en Drive y aviso `tmux-decir Marc-Chief "[informe-7am] <url>"`.

- [ ] **Step 1: Test de lógica pura**

```python
# scripts/hq/tests/test_15_crons.py
import importlib.util, pathlib, unittest
from datetime import datetime, timedelta, timezone

RAIZ = pathlib.Path(__file__).resolve().parents[1]

def cargar(nombre):
    spec = importlib.util.spec_from_file_location(nombre.replace('-', '_'), RAIZ / f'{nombre}.py')
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m


class TestParados(unittest.TestCase):
    def test_clasifica_por_horas_sin_avance(self):
        p = cargar('hq-parados'); ahora = datetime(2026, 9, 17, 7, 0, tzinfo=timezone.utc)
        enc = [
            {'id': 1, 'estado': 'en_curso', 'agente': 'Aina', 'fecha_avance': (ahora - timedelta(hours=50)).isoformat(), 'fecha': (ahora - timedelta(days=5)).isoformat(), 'texto': 'a'},
            {'id': 2, 'estado': 'en_curso', 'agente': 'Biel', 'fecha_avance': None, 'fecha': (ahora - timedelta(hours=80)).isoformat(), 'texto': 'b'},
            {'id': 3, 'estado': 'en_curso', 'agente': 'Ona', 'fecha_avance': (ahora - timedelta(hours=3)).isoformat(), 'fecha': None, 'texto': 'c'},
            {'id': 4, 'estado': 'encolado', 'agente': 'Ona', 'fecha_avance': None, 'fecha': (ahora - timedelta(days=9)).isoformat(), 'texto': 'd'},
        ]
        r = p.clasificar_parados(enc, ahora)
        self.assertEqual([e['id'] for e in r['avisar']], [1]); self.assertEqual([e['id'] for e in r['escalar']], [2])

    def test_no_repite_aviso_en_24h(self):
        p = cargar('hq-parados'); ahora = datetime(2026, 9, 17, 7, 0, tzinfo=timezone.utc)
        estado = {'1': {'avisado': (ahora - timedelta(hours=5)).isoformat()}}
        self.assertFalse(p.toca_avisar('1', 'avisado', estado, ahora))
        self.assertTrue(p.toca_avisar('1', 'avisado', {'1': {'avisado': (ahora - timedelta(hours=30)).isoformat()}}, ahora))


class TestInforme(unittest.TestCase):
    def test_secciones_en_orden_y_peticiones_de_diego(self):
        i = cargar('hq-informe'); hoy = datetime(2026, 9, 17, 6, 50, tzinfo=timezone.utc)
        hq = {'pendientes': [{'id': 685, 'titulo': 'Escribir a Jaume', 'destinatario': 'diego', 'estado': 'pendiente', 'fecha_limite': '2026-09-16T17:00:00Z'}], 'licitaciones': []}
        feed = [{'codigo': 'A2', 'tipo': 'avance'}, {'codigo': 'A2', 'tipo': 'alta'}, {'codigo': 'B4', 'tipo': 'cierre'}]
        enc = [
            {'id': 260, 'texto': 'Alta IAE telecos', 'origen': 'Diego 16-09 15:40', 'estado': 'encolado', 'agente': 'Ferran', 'fecha': '2026-09-16T15:40:00Z', 'fecha_avance': None, 'fecha_hito': '2026-09-19'},
            {'id': 100, 'texto': 'viejo', 'origen': 'Diego 01-09 10:00', 'estado': 'hecho', 'agente': 'x', 'fecha': '2026-09-01T10:00:00Z', 'fecha_avance': None},
        ]
        s = i.secciones(hq, feed, enc, hoy)
        self.assertEqual([t for t, _ in s][:2], ['Lo que pediste esta semana', 'Lo que depende de ti'])
        self.assertTrue(any('#260' in l for l in s[0][1])); self.assertFalse(any('#100' in l for l in s[0][1]))
        self.assertTrue(any('#685' in l for l in s[1][1]))
        actividad = dict(s)['Actividad por frente']; self.assertTrue(any(l.startswith('A2') and '2' in l for l in actividad))
```

- [ ] **Step 2: Ejecutar y ver que falla** → `python3 -m unittest scripts.hq.tests.test_15_crons -v` FAIL (fichero no existe).

- [ ] **Step 3: `scripts/hq/hq-parados.py`**

```python
#!/usr/bin/env python3
"""Barrido de encargos parados (HQ v2, T15). Cron 07:00 y 15:00.
en_curso sin avance 48 h -> tmux-decir al responsable; 72 h -> escalado a Jordi-COO + avance de sistema.
Lee HQ con HQ_OWNER_TOKEN (solo lectura) y escribe avances como agente 'sistema'.
Uso: hq-parados.py [--dry-run] [--horas-aviso 48] [--horas-escalado 72]
"""
import argparse, json, os, pathlib, subprocess, sys
from datetime import datetime, timedelta, timezone

HQ = pathlib.Path(__file__).resolve().parent / 'hq.py'
ESTADO = pathlib.Path.home() / '.config/77delta/hq-parados.json'
sys.path.insert(0, str(HQ.parent))
os.environ.setdefault('HQ_ENGRAM_OFF', '1')
import hq  # noqa: E402  (hq.py expone rpc() y env())


def _fecha(v):
    if not v: return None
    d = datetime.fromisoformat(v.replace('Z', '+00:00'))
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def clasificar_parados(encargos, ahora, umbral_aviso_h=48, umbral_escalado_h=72):
    """Devuelve {'avisar': [...], 'escalar': [...]} con los encargos en_curso sin avance desde hace mas de N horas."""
    avisar, escalar = [], []
    for e in encargos:
        if e.get('estado') != 'en_curso': continue
        ultimo = _fecha(e.get('fecha_avance')) or _fecha(e.get('fecha'))
        if not ultimo: continue
        horas = (ahora - ultimo).total_seconds() / 3600
        e = dict(e, horas_parado=int(horas))
        if horas >= umbral_escalado_h: escalar.append(e)
        elif horas >= umbral_aviso_h: avisar.append(e)
    return {'avisar': avisar, 'escalar': escalar}


def toca_avisar(clave, tipo, estado, ahora, cada_h=24):
    ultimo = _fecha((estado.get(str(clave)) or {}).get(tipo))
    return not ultimo or (ahora - ultimo) >= timedelta(hours=cada_h)


def ventana_de(agente, agentes):
    """Nombre de ventana tmux (primera sesion registrada) del responsable de un encargo, o None."""
    for a in agentes:
        if agente and (a['id'].lower() in agente.lower() or a['nombre'].lower() in agente.lower()):
            return (a.get('sesiones') or [None])[0]
    return None


def decir(ventana, texto, dry):
    if dry or not ventana: print(f'[dry] tmux-decir {ventana}: {texto}'); return
    subprocess.run(['tmux-decir', ventana, texto], check=False)


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--dry-run', action='store_true'); ap.add_argument('--horas-aviso', type=int, default=48); ap.add_argument('--horas-escalado', type=int, default=72)
    a = ap.parse_args(); ahora = datetime.now(timezone.utc)
    owner = hq.E.get('HQ_OWNER_TOKEN') or sys.exit('falta HQ_OWNER_TOKEN en hq.env (solo lectura)')
    encargos = hq.rpc('omc_encargos_lista', p_token=owner)  # sin filtros (schema.sql 737): clasificar_parados se queda con los en_curso
    agentes = hq.rpc('omc_hq', p_token=owner)['agentes']
    estado = json.loads(ESTADO.read_text()) if ESTADO.exists() else {}
    r = clasificar_parados(encargos, ahora, a.horas_aviso, a.horas_escalado)
    for e in r['avisar']:
        if not toca_avisar(e['id'], 'avisado', estado, ahora): continue
        decir(ventana_de(e.get('agente'), agentes), f"[HQ parados] encargo #{e['id']} lleva {e['horas_parado']} h sin avance: {e['texto'][:80]}. Escribe un avance hoy (hq.py encargo avance {e['id']} --texto ...) o cambia el estado con motivo.", a.dry_run)
        estado.setdefault(str(e['id']), {})['avisado'] = ahora.isoformat()
    for e in r['escalar']:
        if not toca_avisar(e['id'], 'escalado', estado, ahora): continue
        decir('Jordi-COO', f"[HQ parados] escalado: encargo #{e['id']} ({e.get('agente')}) {e['horas_parado']} h sin avance: {e['texto'][:80]}. Reclama hoy o ciérralo con motivo.", a.dry_run)
        if not a.dry_run:
            subprocess.run([sys.executable, str(HQ), 'encargo', 'avance', str(e['id']), '--texto', f"sin avance {e['horas_parado']} h: escalado a Jordi-COO por hq-parados", '--agente', 'sistema'], env={**os.environ, 'HQ_AGENTE_FORZADO': 'sistema'}, check=False)
        estado.setdefault(str(e['id']), {})['escalado'] = ahora.isoformat()
    print(f"parados: {len(r['avisar'])} avisados, {len(r['escalar'])} escalados, {sum(1 for e in encargos if e['estado'] == 'en_curso')} en curso")
    if not a.dry_run:
        ESTADO.parent.mkdir(parents=True, exist_ok=True); ESTADO.write_text(json.dumps(estado, indent=1)); ESTADO.chmod(0o600)


if __name__ == '__main__':
    main()
```

`import hq` ejecuta `E = env()` de hq.py al importar (línea 120), que exige HQ_URL/HQ_ANON/HQ_TOKEN en el entorno o en hq.env: en cron basta con hq.env. Si hq.py tuviera efectos al importar más allá de `env()` (comprobar con `sed -n '100,135p'`), envolverlos en `if __name__` o replicar `rpc()` aquí (12 líneas) en vez de importarlo. El agente `sistema` debe existir en `omc_agentes` de 77delta con `activo=true`, nivel 0, sin ventana: darlo de alta en el seed v2 (`insert ... on conflict do nothing`).

- [ ] **Step 4: `scripts/hq/hq-informe.py`**

```python
#!/usr/bin/env python3
"""Informe de las 07:00 para Diego (HQ v2, T15). Empieza por lo que pidio y lo que depende de el.
Uso: hq-informe.py [--dry-run] [--fecha YYYY-MM-DD]
"""
import argparse, os, pathlib, subprocess, sys
from collections import Counter
from datetime import datetime, timedelta, timezone

RAIZ = pathlib.Path(__file__).resolve().parents[2]
HQ = pathlib.Path(__file__).resolve().parent / 'hq.py'
sys.path.insert(0, str(HQ.parent)); os.environ.setdefault('HQ_ENGRAM_OFF', '1')
import hq  # noqa: E402
import importlib.util
_p = importlib.util.spec_from_file_location('hq_parados', HQ.parent / 'hq-parados.py'); hq_parados = importlib.util.module_from_spec(_p); _p.loader.exec_module(hq_parados)


def _f(v):
    if not v: return None
    d = datetime.fromisoformat(str(v).replace('Z', '+00:00')); return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def _hito(e):
    return f" · hito {e['fecha_hito']}" if e.get('fecha_hito') else ' · SIN HITO'


def secciones(hq_datos, feed, encargos, hoy):
    hace7 = hoy - timedelta(days=7)
    pedidos = [e for e in encargos if str(e.get('origen') or '').lower().startswith('diego') and (_f(e.get('fecha')) or hace7) >= hace7]
    parados = hq_parados.clasificar_parados(encargos, hoy); ids_parados = {e['id']: e['horas_parado'] for e in parados['avisar'] + parados['escalar']}
    l1 = []
    for e in sorted(pedidos, key=lambda e: e['id']):
        if e['estado'] == 'hecho': l1.append(f"HECHO #{e['id']} {e['texto'][:70]} ({e.get('agente') or '-'})")
        elif e['id'] in ids_parados: l1.append(f"PARADO #{e['id']} {e['texto'][:70]} ({e.get('agente') or '-'}) · {ids_parados[e['id']]} h sin avance{_hito(e)}")
        elif e['estado'] == 'descartado': l1.append(f"DESCARTADO #{e['id']} {e['texto'][:70]} · {e.get('motivo_descarte') or 'sin motivo'}")
        else: l1.append(f"EN CURSO #{e['id']} {e['texto'][:70]} ({e.get('agente') or '-'}) [{e['estado']}]{_hito(e)}")
    l2 = [f"#{p['id']} {p['titulo']}" + (f" · antes de {str(p['fecha_limite'])[11:16]}" if p.get('fecha_limite') else '') for p in hq_datos.get('pendientes', []) if p.get('destinatario') == 'diego' and p.get('estado') == 'pendiente'] or ['nada pendiente de ti']
    l3 = [f"#{e['id']} {e['texto'][:60]} ({e.get('agente') or '-'}) · {e['horas_parado']} h" for e in parados['escalar'] + parados['avisar']] or ['ninguno']
    cnt = Counter((x.get('codigo') or 'sin frente') for x in feed)
    l4 = [f"{k} · {v} eventos" for k, v in sorted(cnt.items(), key=lambda kv: (-kv[1], kv[0]))] or ['sin actividad']
    lic = hq_datos.get('licitaciones') or []
    l5 = [f"{x.get('expediente') or x.get('id')} {str(x.get('titulo') or '')[:60]} · cierra {str(x.get('fecha_limite') or '')[:16]} · {x.get('decision') or 'por decidir'}" for x in lic if x.get('fecha_limite') and _f(x['fecha_limite']) and _f(x['fecha_limite']) <= hoy + timedelta(hours=72)] or ['nada cierra en 72 h']
    return [('Lo que pediste esta semana', l1 or ['ninguna petición registrada esta semana']), ('Lo que depende de ti', l2), ('Encargos parados', l3), ('Actividad por frente', l4), ('Licitaciones', l5)]


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--dry-run', action='store_true'); ap.add_argument('--fecha')
    a = ap.parse_args(); hoy = datetime.now(timezone.utc) if not a.fecha else datetime.fromisoformat(a.fecha).replace(tzinfo=timezone.utc)
    owner = hq.E.get('HQ_OWNER_TOKEN') or sys.exit('falta HQ_OWNER_TOKEN (solo lectura)')
    datos = hq.rpc('omc_hq', p_token=owner)
    feed = hq.rpc('omc_feed', p_token=owner, p_desde=(hoy - timedelta(hours=24)).isoformat())
    encargos = hq.rpc('omc_encargos_lista', p_token=owner)  # devuelve todos los encargos de la empresa (schema.sql 737); secciones() filtra por fecha y origen
    md = [f"# Informe HQ {hoy.strftime('%d-%m-%Y')} 07:00", '']
    for titulo, lineas in secciones(datos, feed, encargos, hoy):
        md += [f'## {titulo}', ''] + [f'- {l}' for l in lineas] + ['']
    texto = '\n'.join(md)
    if a.dry_run: print(texto); return
    tmp = pathlib.Path(os.environ.get('SCRATCHPAD', '/tmp')) / f"informe-hq-{hoy:%Y-%m-%d}.md"; tmp.write_text(texto)
    out = subprocess.run([sys.executable, str(RAIZ / 'scripts/drive-subir.py'), str(tmp), '--nombre', f"Informe HQ {hoy:%Y-%m-%d}"], capture_output=True, text=True)
    url = next((w for w in out.stdout.split() if w.startswith('https://')), '(sin url: ' + out.stderr[-200:] + ')')
    subprocess.run(['tmux-decir', 'Marc-Chief', f"[informe-7am] listo: {url} . Léelo y pásale a Diego las dos primeras secciones en el chat, en 6 líneas."], check=False)
    print(url)


if __name__ == '__main__':
    main()
```

`scripts/drive-subir.py` toma `fichero` posicional, `--nombre`, `--carpeta` (por defecto la carpeta de empresa) y `--subcarpeta` (por defecto `Informes`): la llamada de arriba ya encaja; imprime la URL del Google Doc.

- [ ] **Step 5: Probar en seco y commit**

Run: `python3 -m unittest scripts.hq.tests.test_15_crons -v && python3 scripts/hq/hq-parados.py --dry-run && python3 scripts/hq/hq-informe.py --dry-run | head -40`. Los dos `--dry-run` leen producción con el owner token: **antes de ejecutarlos pedir OK a Diego en el chat** ("uso de solo lectura del owner token en hq-parados/hq-informe"); sin OK, probarlos con `pg.entorno_cli('owner')` contra `pruebas` (HQ_OWNER_TOKEN del tenant).

```bash
chmod +x scripts/hq/hq-parados.py scripts/hq/hq-informe.py
git add scripts/hq/hq-parados.py scripts/hq/hq-informe.py scripts/hq/tests/test_15_crons.py scripts/hq/seed-77delta-v2.sql
git commit -m "feat(hq): barrido de encargos parados e informe de las 07:00 por cierres"
```

- [ ] **Step 6: Cron (solo tras el OK de Diego)**

```bash
crontab -l > ~/.config/77delta/crontab.bak-$(date +%Y%m%d-%H%M)
( crontab -l | grep -v 'informe-7am' ; echo '50 6 * * * cd /Users/diego/dev/77delta && python3 scripts/hq/hq-informe.py >> ~/.config/77delta/hq-informe.log 2>&1' ; echo '0 7,15 * * * cd /Users/diego/dev/77delta && python3 scripts/hq/hq-parados.py >> ~/.config/77delta/hq-parados.log 2>&1' ) | crontab -
crontab -l | grep -n 'hq-informe\|hq-parados'
```

La línea vieja `0 6 * * * tmux-decir Marc-Chief "[informe-7am]..."` se elimina con el `grep -v` (verificar que no borra otra cosa: `crontab -l | grep informe-7am` antes).

---

### Task 16: `omc_hq_v2`: una sola lectura para la interfaz nueva

**Files:**
- Modify: `scripts/hq/schema-v2.sql` (sección T16)
- Create: `docs/superpowers/specs/2026-09-16-hq-v2-contrato-omc_hq_v2.md` (contrato de datos para el plan 2)
- Test: `scripts/hq/tests/test_16_hq_v2.py`

**Interfaces:**
- Consumes: todo lo anterior. Reutiliza `omc_hq(p_token)` de schema.sql 330 para `licitaciones` y `pendientes` (no duplicar esa lógica: `omc_hq_v2` llama `omc_hq` y toma esas dos claves).
- Produces: `omc_hq_v2(p_token) -> jsonb` (owner y agentes: al agente se le ocultan `pendientes` ajenas y `sesion_url` de los demás) con claves: `version` ('2.0.x' de `omc_v2_version()`), `ahora`, `objetivos[]` (horizonte, meta_eur, kpi, contratado_eur calculado de `omc_ingresos` si existe, presentado_eur = suma de `omc_licitaciones` decididas presentar en el año), `bloques[]` (T3 + `meta_eur`, `frentes_n`, `encargos_abiertos`, `contratado_eur`), `frentes[]` (= `omc_frentes_lista`), `encargos[]` (vivos + hechos/descartados de 14 días: id, codigo, bloque_letra, texto, interpretacion, estado, `columna` kanban = backlog|por_hacer|en_curso|bloqueado|hecho, prioridad, agente, responsable, fecha_hito, proximo_hito, ultimo_avance, fecha_avance, `rojo` bool (en_curso sin avance 48 h), etiquetas, enlaces, orden_kanban, origen, expediente_id, fuente_cierre, entregable_url, motivo_descarte, `avances_n`), `avances[]` (7 días, = `omc_feed`), `kit[]` (vigentes con codigo), `contactos[]` (30 días + pendientes), `expedientes[]` (= `omc_expedientes_lista`), `sesiones[]` (abiertas y solicitadas con nombre de expediente), `agentes[]` (= `omc_agentes_lista`), `pendientes[]` y `licitaciones[]` (de `omc_hq`), `uso` (= `omc_hq_uso` si existe la función; si no, `{}`).

Mapeo Kanban (única definición, la UI no lo recalcula): `encolado` con prioridad `baja` o sin fecha_hito → `backlog`; `encolado` con fecha_hito → `por_hacer`; `en_curso` → `en_curso`; `bloqueado_diego` → `bloqueado`; `hecho` y `descartado` → `hecho`. Los estados exactos del check de `omc_encargos.estado` se leen de schema.sql (`grep -n "estado in" scripts/hq/schema.sql`) antes de escribir el `case`.

- [ ] **Step 1: Test**

```python
# scripts/hq/tests/test_16_hq_v2.py
import unittest
from . import pg
from .pg import rpc


class TestHqV2(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.t = pg.preparar_tenant(); pg.limpiar_tenant()
        pg.sql("insert into omc_agentes (empresa, id, nombre, depto, nivel, sesiones, activo) values ('pruebas','probador','Probador','pruebas',2,array['Probador-Pruebas'],true)")
        rpc(cls.t['owner'], 'omc_plan_objetivo_set', p={'horizonte': 2026, 'meta_eur': 300000, 'kpi': 'EUR presentados'})
        rpc(cls.t['owner'], 'omc_bloque_set', p={'letra': 'A', 'nombre': 'Licitaciones', 'orden': 1, 'meta_eur': 200000})
        rpc(cls.t['owner'], 'omc_frente_set', p={'codigo': 'A1', 'bloque': 'A', 'linea': 'Fuentes', 'kpi': 'fuentes', 'meta': 17})

    def test_claves_y_kanban(self):
        e1 = rpc(self.t['owner'], 'omc_encargo_alta', p={'texto': 'sin hito', 'frente': 'A1', 'responsable': 'Probador'})
        e2 = rpc(self.t['owner'], 'omc_encargo_alta', p={'texto': 'con hito', 'frente': 'A1', 'responsable': 'Probador', 'fecha_hito': '2026-09-20'})
        e3 = rpc(self.t['owner'], 'omc_encargo_alta', p={'texto': 'en curso viejo', 'frente': 'A1', 'responsable': 'Probador'})
        rpc(self.t['agente'], 'omc_encargo_tomar', p_id=e3['id'], p_agente='Probador')
        pg.sql(f"update omc_encargos set fecha_avance = now() - interval '3 days' where id = {e3['id']}")
        d = rpc(self.t['owner'], 'omc_hq_v2')
        for k in ('version', 'objetivos', 'bloques', 'frentes', 'encargos', 'avances', 'kit', 'contactos', 'expedientes', 'sesiones', 'agentes', 'pendientes', 'licitaciones', 'uso'):
            self.assertIn(k, d, k)
        col = {e['id']: e for e in d['encargos']}
        self.assertEqual(col[e1['id']]['columna'], 'backlog'); self.assertEqual(col[e2['id']]['columna'], 'por_hacer')
        self.assertEqual(col[e3['id']]['columna'], 'en_curso'); self.assertTrue(col[e3['id']]['rojo']); self.assertFalse(col[e1['id']]['rojo'])
        self.assertEqual(d['objetivos'][0]['horizonte'], 2026); self.assertEqual(d['bloques'][0]['encargos_abiertos'], 3)

    def test_agente_no_ve_sesion_url_ajena(self):
        rpc(self.t['owner'], 'omc_agente_sesion_url', p_agente='probador', p_url='https://claude.ai/code/session_zzz')
        d = rpc(self.t['agente'], 'omc_hq_v2')
        self.assertTrue(all(a.get('sesion_url') in (None, '') or a['id'] == 'probador' for a in d['agentes']))
```

- [ ] **Step 2: Ejecutar y ver que falla** (función no existe).

- [ ] **Step 3: SQL**

```sql
-- T16 · lectura única para la interfaz v2
create or replace function omc_columna_kanban(p_estado text, p_prioridad int, p_fecha_hito date) returns text
language sql immutable as $$
  select case p_estado
    when 'en_curso' then 'en_curso' when 'bloqueado_diego' then 'bloqueado'
    when 'hecho' then 'hecho' when 'descartado' then 'hecho'
    else case when p_fecha_hito is null or coalesce(p_prioridad, 0) >= 8 then 'backlog' else 'por_hacer' end end; -- prioridad es int (0 alta ... 9 baja) en omc_encargos
$$;

create or replace function omc_hq_v2(p_token text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare t record; base jsonb; ahora timestamptz := now(); es_owner boolean;
begin
  select * into t from omc_tok(p_token); es_owner := t.rol = 'owner';
  base := omc_hq(p_token);
  return jsonb_build_object(
    'version', omc_v2_version(), 'ahora', ahora, 'rol', t.rol,
    'objetivos', (select coalesce(jsonb_agg(jsonb_build_object('horizonte', o.horizonte, 'meta_eur', o.meta_eur, 'kpi', o.kpi, 'texto', o.texto,
        'contratado_eur', (select coalesce(sum(i.importe),0) from omc_ingresos i where i.empresa = t.empresa and extract(year from i.fecha) = o.horizonte),
        'presentado_eur', (select coalesce(sum(l.importe),0) from omc_licitaciones l where l.empresa = t.empresa and l.decision = 'presentar' and extract(year from coalesce(l.fecha_presentada, l.fecha_limite)) = o.horizonte)) order by o.horizonte), '[]'::jsonb)
      from omc_plan_objetivo o where o.empresa = t.empresa),
    'bloques', (select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'letra', b.letra, 'nombre', b.nombre, 'meta_eur', b.meta_eur, 'director', b.director, 'orden', b.orden,
        'frentes_n', (select count(*) from omc_plan_lineas l where l.bloque_id = b.id and l.activa),
        'encargos_abiertos', (select count(*) from omc_encargos e join omc_plan_lineas l on l.id = e.linea_id where l.bloque_id = b.id and e.estado in ('encolado','en_curso','bloqueado_diego'))) order by b.orden), '[]'::jsonb)
      from omc_plan_bloques b where b.empresa = t.empresa and b.activo),
    'frentes', omc_frentes_lista(p_token),
    'encargos', (select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'codigo', l.codigo, 'bloque_letra', b.letra, 'texto', e.texto, 'interpretacion', e.interpretacion, 'estado', e.estado,
        'columna', omc_columna_kanban(e.estado, e.prioridad, e.fecha_hito), 'prioridad', e.prioridad, 'agente', e.agente, 'responsable', e.agente, 'departamento', e.departamento,
        'fecha_hito', e.fecha_hito, 'proximo_hito', e.proximo_hito, 'ultimo_avance', e.ultimo_avance, 'fecha_avance', e.fecha_avance,
        'rojo', (e.estado = 'en_curso' and coalesce(e.fecha_avance, e.fecha) < ahora - interval '48 hours'),
        'etiquetas', e.etiquetas, 'enlaces', e.enlaces, 'orden_kanban', e.orden_kanban, 'origen', e.origen, 'expediente_id', e.expediente_id,
        'fuente_cierre', e.fuente_cierre, 'entregable_url', e.entregable_url, 'motivo_descarte', e.motivo_descarte, 'fecha', e.fecha,
        'avances_n', (select count(*) from omc_encargo_avances a where a.encargo_id = e.id)) order by e.orden_kanban nulls last, e.fecha_hito nulls last, e.id), '[]'::jsonb)
      from omc_encargos e left join omc_plan_lineas l on l.id = e.linea_id left join omc_plan_bloques b on b.id = l.bloque_id
      where e.empresa = t.empresa and (e.estado in ('encolado','en_curso','bloqueado_diego') or coalesce(e.fecha_avance, e.fecha) > ahora - interval '14 days')),
    'avances', omc_feed(p_token, ahora - interval '7 days'),
    'kit', omc_kit_lista(p_token),
    'contactos', omc_contactos_lista(p_token, '{}'::jsonb),
    'expedientes', omc_expedientes_lista(p_token, '{}'::jsonb),
    'sesiones', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'expediente_id', s.expediente_id, 'nombre', x.nombre, 'agente', s.agente, 'estado', s.estado, 'abierta', s.abierta, 'created_at', s.created_at) order by s.created_at desc), '[]'::jsonb)
      from omc_sesiones s join omc_expedientes x on x.id = s.expediente_id where s.empresa = t.empresa and s.estado in ('abierta','solicitada')),
    'agentes', (select coalesce(jsonb_agg(case when es_owner or a->>'id' = t.nombre then a else a - 'sesion_url' end), '[]'::jsonb) from jsonb_array_elements(omc_agentes_lista(p_token)) a),
    'pendientes', case when es_owner then coalesce(base->'pendientes', '[]'::jsonb) else '[]'::jsonb end,
    'licitaciones', coalesce(base->'licitaciones', '[]'::jsonb),
    'uso', case when to_regproc('omc_hq_uso') is not null then omc_hq_uso(p_token) else '{}'::jsonb end
  );
end $$;
grant execute on function omc_columna_kanban(text, int, date), omc_hq_v2(text) to anon, authenticated;
```

Nombres a verificar en schema.sql antes de escribir (el plan no puede adivinarlos): columnas de `omc_ingresos` (`importe`, `fecha`), de `omc_licitaciones` (`decision`, `importe`, `fecha_limite`, `fecha_presentada`), `omc_plan_objetivo.texto`, y si `omc_hq_uso` toma `p_token`. Si `omc_tok` no expone `agente`, el filtro de `sesion_url` para agentes se simplifica a "solo el owner ve sesion_url" y el test se ajusta. `to_regproc('omc_hq_uso')` falla si hay sobrecargas: usar `exists (select 1 from pg_proc where proname = 'omc_hq_uso')`.

- [ ] **Step 4: Contrato para el plan 2** en `docs/superpowers/specs/2026-09-16-hq-v2-contrato-omc_hq_v2.md`: una tabla por clave con nombre de campo, tipo y significado (copiar del bloque de arriba), el mapeo Kanban, la lista de RPC de escritura que usará la UI (`omc_encargo_alta`, `omc_encargo_editar`, `omc_encargo_tomar`, `omc_encargo_hecho`, `omc_encargo_estado`, `omc_encargo_avance`, `omc_comentar`, `omc_resolver`, `omc_licitacion_decidir`, `omc_sesion_solicitar`, `omc_expediente_set`, `omc_kit_set`, `omc_contacto_alta`, `omc_contacto_estado`, `omc_agente_set`, `omc_guardar_push`) con firma exacta, y el canal realtime `omc:<empresa>` evento `cambio`. Medir el tamaño de la respuesta en producción (`python3 -c` con `len(json.dumps(...))`): si pasa de 1,5 MB, recortar `avances` a 3 días y `contactos` a 14.

- [ ] **Step 5: Probar y commit**

Run: `scripts/hq/aplicar-schema.sh && python3 -m unittest scripts.hq.tests.test_16_hq_v2 -v`.

```bash
git add scripts/hq/schema-v2.sql scripts/hq/tests/test_16_hq_v2.py docs/superpowers/specs/2026-09-16-hq-v2-contrato-omc_hq_v2.md
git commit -m "feat(hq): omc_hq_v2, lectura única con cascada, kanban y contrato para la interfaz"
```

---

### Task 17: Prueba de extremo a extremo y documentación

**Files:**
- Create: `scripts/hq/tests/e2e-peticion.sh`
- Modify: `docs/empresa/03-hq-manual.md`, `docs/empresa/30-alta-de-agente.md`, `docs/empresa/reglas-agente-hq.md`

**Interfaces:**
- Consumes: todo el CLI v2 (`hq.py encargo alta --frente`, `tomar`, `contacto alta`, `enviar-con-lock.sh --contacto --simular`, `encargo hecho --fuente`, `feed`, `sesion abrir/cerrar`) y `pg.entorno_cli()`.
- Produces: `e2e-peticion.sh` que reproduce el camino completo de una petición de Diego en el tenant `pruebas` y termina con `E2E OK` (exit 0) o el primer paso que falla (exit 1). Se ejecuta a mano antes del checkpoint del 23-sep y tras cada cambio de schema.

- [ ] **Step 1: `scripts/hq/tests/e2e-peticion.sh`**

```bash
#!/usr/bin/env bash
# E2E HQ v2: una peticion de Diego recorre alta -> tomar -> contacto -> envio simulado -> hecho con fuente -> feed, en el tenant pruebas.
set -euo pipefail
cd "$(dirname "$0")/../../.."
ENV_JSON=$(python3 -c "import json; from scripts.hq.tests import pg; pg.preparar_tenant(); pg.limpiar_tenant(); print(json.dumps(pg.entorno_cli('owner')))")
eval "$(python3 -c "import json,shlex,sys; [print(f'export {k}={shlex.quote(str(v))}') for k,v in json.loads(sys.argv[1]).items()]" "$ENV_JSON")"
HQ="python3 scripts/hq/hq.py"
paso() { echo; echo "== $*"; }
python3 - <<'PY'
from scripts.hq.tests import pg; from scripts.hq.tests.pg import rpc
t = pg.preparar_tenant()
pg.sql("insert into omc_agentes (empresa, id, nombre, depto, nivel, sesiones, activo) values ('pruebas','probador','Probador','pruebas',2,array['Probador-Pruebas'],true) on conflict do nothing")
rpc(t['owner'], 'omc_bloque_set', p={'letra': 'C', 'nombre': 'Comercial directo', 'orden': 3})
rpc(t['owner'], 'omc_frente_set', p={'codigo': 'C5', 'bloque': 'C', 'linea': 'Seguimiento', 'kpi': '% respuesta', 'meta': 20})
rpc(t['owner'], 'omc_kit_set', p={'frente': 'C5', 'tipo': 'plantilla', 'nombre': 'Correo de seguimiento', 'url': 'https://docs.google.com/document/d/kit-c5'})
PY
paso "1 alta con frente"; ID=$($HQ --json encargo alta --texto "E2E: escribir a la empresa de prueba" --frente C5 --responsable Probador --origen "Diego e2e" | python3 -c "import json,sys; print(json.load(sys.stdin)['id'])"); echo "encargo #$ID"
paso "1b alta sin frente debe fallar"; if $HQ encargo alta --texto "sin frente" --responsable Probador 2>/dev/null; then echo "FALLO: acepto alta sin frente"; exit 1; fi; echo ok
paso "2 tomar"; $HQ encargo tomar "$ID" --agente Probador
paso "3 contacto"; CID=$($HQ --json contacto alta --encargo "$ID" --persona "Prueba E2E" --email prueba@example.com --organizacion "Empresa E2E" --canal correo --motivo "seguimiento" | python3 -c "import json,sys; print(json.load(sys.stdin)['id'])"); echo "contacto #$CID"
paso "4 tarjeta aprobada y envio simulado"; TID=$($HQ --json pedir --agente probador --tipo contacto --titulo "Aprobar correo E2E" --detalle "prueba" | python3 -c "import json,sys; print(json.load(sys.stdin)['id'])")
python3 -c "from scripts.hq.tests import pg; pg.sql('update omc_solicitudes set estado = %s where id = %s', 'aprobada', $TID)"
if bash scripts/gmail/enviar-con-lock.sh --tarjeta "$TID" --to prueba@example.com --contacto "$CID" --simular -- --subject "E2E" --body "hola"; then echo "simulacro ok"; else rc=$?; [ "$rc" = 3 ] && echo "fuera de franja 8-20 (rc 3): aceptable de noche" || { echo "FALLO rc=$rc"; exit 1; }; fi
paso "4b envio sin contacto debe fallar"; if bash scripts/gmail/enviar-con-lock.sh --tarjeta "$TID" --to prueba@example.com --simular -- --subject x 2>/dev/null; then echo "FALLO: envio sin contacto"; exit 1; fi; echo ok
paso "5 hecho sin fuente debe fallar"; if $HQ encargo estado "$ID" hecho --agente Probador 2>/dev/null; then echo "FALLO: hecho sin fuente"; exit 1; fi; echo ok
paso "5b hecho con fuente"; $HQ encargo hecho "$ID" --fuente https://docs.google.com/document/d/kit-c5 --entregable https://docs.google.com/document/d/entregable --agente Probador
paso "6 feed"; N=$($HQ --json feed | python3 -c "import json,sys; print(len([x for x in json.load(sys.stdin) if x['encargo_id'] == $ID]))"); echo "$N eventos del encargo"; [ "$N" -ge 4 ] || { echo "FALLO: feed con $N eventos"; exit 1; }
paso "7 sesion"; XID=$($HQ --json expediente alta --nombre "Expediente E2E" --tipo cliente --frente C5 --responsable Probador | python3 -c "import json,sys; print(json.load(sys.stdin)['id'])"); $HQ sesion abrir --expediente "$XID" --agente Probador >/dev/null; SID=$(python3 -c "from scripts.hq.tests import pg; print(pg.sql('select id from omc_sesiones where estado = %s order by id desc limit 1', 'abierta')[0]['id'])"); $HQ sesion cerrar "$SID" --resumen "E2E cerrada" --agente Probador
echo; echo "E2E OK"
```

`pg.sql` con parámetros usa `%s` según la firma de T1 (`sql(q, *params)` con format y escape): comprobar en `pg.py` si el marcador es `%s` o `{}` y ajustar. `HQ_AGENTE_FORZADO=probador` viene de `entorno_cli`, por eso `--agente Probador` resuelve al mismo agente.

- [ ] **Step 2: Ejecutar** → `bash scripts/hq/tests/e2e-peticion.sh` termina en `E2E OK`. Si falla un paso, arreglar la tarea correspondiente (no el script).

- [ ] **Step 3: Documentación**

`docs/empresa/03-hq-manual.md`: nueva sección "HQ v2 (17-sep-2026)" con: la cascada objetivo → bloque → frente → encargo; comandos v2 con un ejemplo real cada uno (`frentes`, `bloques`, `encargo alta --frente A3 --responsable Guillem --etiqueta urgente --enlace "Pliego=https://..."`, `encargo tomar`, `encargo ficha`, `encargo hecho --fuente`, `encargo estado ID descartado --motivo`, `encargo editar` (solo Diego/chief), `kit lista A2`, `kit alta`, `contacto alta/estado/lista/ficha`, `expediente alta/lista/ficha`, `sesion abrir/cerrar/solicitar`, `agente lista/ficha/frentes/sesion-url`, `feed`); las cuatro puertas duras y sus mensajes de error; los tres scripts fuera del repo que cambian (`~/bin/hq-correo.py` casa respuestas con `contacto respondido`; `~/bin/chief-cuenta.sh` registra avance y `sesion-url`; `/Users/diego/bin/hq-latido.sh` regla 33); los crons `hq-parados.py` 07:00/15:00 y `hq-informe.py` 06:50 y qué hacer si no llega el informe (`~/.config/77delta/hq-informe.log`); cómo correr los tests (`python3 -m unittest discover -s scripts/hq/tests -p 'test_*.py'` y `e2e-peticion.sh`, ambos contra el tenant `pruebas`); `aplicar-schema.sh` como único camino para tocar la base.

`docs/empresa/30-alta-de-agente.md`: sustituir el paso de `alta-agente` por `hq.py agente alta ... --frentes A1 A2`, añadir `hq.py agente avatar <id>` (commit del SVG) y `hq.py agente sesion-url <id> <url>` al arrancar la ventana.

`docs/empresa/reglas-agente-hq.md`: regla 33 con el texto de T13 Step 5 y el recuento en el título; en la regla 1 añadir "y toda petición nueva de Diego se registra como encargo con --frente el mismo día; si la repite, se contesta con el número y el estado, nunca se abre otro".

- [ ] **Step 4: Suite completa y commit**

Run: `python3 -m unittest discover -s scripts/hq/tests -p 'test_*.py' 2>&1 | tail -5 && bash scripts/hq/tests/e2e-peticion.sh | tail -3` → `OK` y `E2E OK`.

```bash
git add scripts/hq/tests/e2e-peticion.sh docs/empresa/03-hq-manual.md docs/empresa/30-alta-de-agente.md docs/empresa/reglas-agente-hq.md
git commit -m "test(hq): e2e de una petición de Diego; manual, alta de agente y regla 33 de HQ v2"
```

Tras este commit: `git push` (GitHub Pages no cambia nada de la UI v1 con este plan) y anotar en el encargo #259 `hq.py encargo avance 259 --texto "plan 1 (base) ejecutado: schema-v2, CLI v2, puertas, crons; falta plan 2 (interfaz)" --agente chief`.

---

## Orden de ejecución y puntos de parada

1. T1 → T2 → T3 → T4 → T5 → T6 (base, RPC con puertas y CLI). Parada: enseñar a Diego `hq.py frentes` en producción y el CSV de T7 en Drive.
2. T7 (migración: `--dry-run`, revisión del chief, `--aplicar` solo con 0 vivos sin frente) → T8 (kit) → T9 → T10 (contactos y candado). Parada: pedir OK para tocar `~/bin/hq-correo.py` y `enviar-con-lock.sh` en caliente (afecta a envíos reales del día siguiente).
3. T11 → T12 → T13 → T14. Parada: OK de Diego para el uso de solo lectura del owner token en T15.
4. T15 → T16 → T17. Checkpoint miércoles 23-sep con la sección 7 de la spec.

Cada tarea se ejecuta con un subagente nuevo (subagent-driven-development) que recibe solo su tarea, las Global Constraints y el mapa de ficheros; el chief revisa el diff y corre la suite antes de la siguiente.
