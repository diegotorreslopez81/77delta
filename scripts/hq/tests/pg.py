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
