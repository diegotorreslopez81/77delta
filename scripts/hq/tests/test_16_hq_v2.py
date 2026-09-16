import datetime
import json
import unittest
from . import pg
from .pg import rpc


class TestHqV2(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.t = pg.preparar_tenant(); pg.limpiar_tenant()
        pg.sql("insert into omc_agentes (empresa, id, nombre, depto, nivel, sesiones, activo) values ('pruebas','probador','Probador','pruebas',2,array['Probador-Pruebas'],true)")
        rpc(cls.t['owner'], 'omc_plan_objetivo_set', p={'horizonte': 2026, 'titulo': 'Contratado a 31 de diciembre', 'meta': 300000, 'unidad': 'EUR'})
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

    def test_licitaciones_filtra_cierre_a_7_dias(self):
        limite = (datetime.date.today() - datetime.timedelta(days=7)).isoformat()
        pg.sql("insert into omc_licitaciones (empresa, expediente, organo, objeto, resumen_corto, cierre, decision) "
               "values ('pruebas','EXP-VIEJO','Organo pruebas','Objeto viejo','Resumen viejo', current_date - 30, 'Pendiente')")
        pg.sql("insert into omc_licitaciones (empresa, expediente, organo, objeto, resumen_corto, cierre, decision) "
               "values ('pruebas','EXP-SIN-CIERRE','Organo pruebas','Objeto sin cierre','Resumen sin cierre', null, 'Pendiente')")
        d = rpc(self.t['owner'], 'omc_hq_v2')
        expedientes = {x['expediente'] for x in d['licitaciones']}
        self.assertNotIn('EXP-VIEJO', expedientes)
        self.assertIn('EXP-SIN-CIERRE', expedientes)
        for x in d['licitaciones']:
            self.assertTrue(x['cierre'] is None or x['cierre'] >= limite, x)
        campos = set(d['licitaciones'][0].keys()) if d['licitaciones'] else set()
        self.assertEqual(campos, {'expediente', 'organo', 'objeto', 'resumen_corto', 'importe', 'cierre', 'enlace', 'decision'})

    def test_omc_hq_v2_no_filtra_datos_de_otra_empresa(self):
        # Fuga entre empresas (revisor T16, ronda 1): fixture propio como el de T13
        # (test_encargo_ficha_id_ajeno_no_filtra_datos), pero aqui se inserta una fila marcada en un
        # tenant sintetico 'pruebas-ajena' (nunca en 77delta) porque no hay ningun otro tenant real en la
        # base salvo 'pruebas' y '77delta'. Se vuelca toda la respuesta a texto y se busca el marcador: si
        # omc_hq_v2 tuviera algun filtro por empresa mal puesto, el marcador apareceria en algun sitio.
        otra = 'pruebas-ajena'
        marcador = 'FUGA-AJENA-MARCADOR-T16'
        try:
            pg.sql("insert into omc_empresas (id, nombre, plan_usd) values ('{0}', 'Tenant ajeno de prueba', 0) on conflict (id) do nothing", otra)
            pg.sql("insert into omc_encargos (empresa, texto, estado) values ('{0}', '{1}', 'descartado')", otra, marcador)
            pg.sql("insert into omc_kit (empresa, tipo, nombre) values ('{0}', 'regla', '{1}')", otra, marcador)
            pg.sql("insert into omc_contactos (empresa, canal, motivo) values ('{0}', 'correo', '{1}')", otra, marcador)
            pg.sql("insert into omc_expedientes (empresa, tipo, nombre) values ('{0}', 'cliente', '{1}')", otra, marcador)
            pg.sql("insert into omc_licitaciones (empresa, expediente, resumen_corto) values ('{0}', '{1}', '{1}')", otra, marcador)
            pg.sql("insert into omc_agentes (empresa, id, nombre, depto, nivel, sesiones, activo) values ('{0}','fuga-ajena','{1}','pruebas',2,array['Fuga-Ajena'],true)", otra, marcador)

            d = rpc(self.t['owner'], 'omc_hq_v2')
            volcado = json.dumps(d)
            self.assertNotIn(marcador, volcado)
        finally:
            for tabla in ('omc_encargos', 'omc_kit', 'omc_contactos', 'omc_expedientes', 'omc_licitaciones', 'omc_agentes'):
                pg.sql("delete from {0} where empresa = '{1}'", tabla, otra)
            pg.sql("delete from omc_empresas where id = '{0}'", otra)

    def test_agente_no_ve_sesion_url_ajena(self):
        rpc(self.t['owner'], 'omc_agente_sesion_url', p_agente='probador', p_url='https://claude.ai/code/session_zzz')
        d = rpc(self.t['agente'], 'omc_hq_v2')
        self.assertTrue(all(a.get('sesion_url') in (None, '') or a['id'] == 'probador' for a in d['agentes']))
        self.assertEqual(d['pendientes'], []); self.assertEqual(d['licitaciones'], []); self.assertEqual(d['uso'], {})
