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

    @classmethod
    def tearDownClass(cls):
        pg.limpiar_tenant()

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

    def test_expediente_ficha_id_ajeno_no_filtra_datos(self):
        # C1 (revisión final plan 1): el CTE x de omc_expediente_ficha sí filtraba por empresa, pero las
        # subconsultas de encargos/contactos/sesiones sólo filtraban por p_id, sin correlar con x. Un
        # token de OTRA empresa pidiendo el id de un expediente de 'pruebas' con hijos recibía
        # 'expediente': null pero 'encargos': [...] con los datos reales. Fixture propio, como el de T13
        # (test_encargo_ficha_id_ajeno_no_filtra_datos) y T16 (test_omc_hq_v2_no_filtra_datos_de_otra_empresa):
        # aquí se crea un tenant sintético 'pruebas-otra-c1' (nunca 77delta) sólo para tener un token de
        # otra empresa.
        x = rpc(self.t['owner'], 'omc_expediente_set', p={'nombre': 'Fuga C1', 'tipo': 'cliente', 'frente': 'B2', 'responsable': 'Martí'})
        e = rpc(self.t['owner'], 'omc_encargo_alta', p={'texto': 'Hijo de Fuga C1', 'frente': 'B2', 'responsable': 'Martí', 'expediente_id': x['id']})
        otra = 'pruebas-otra-c1'
        try:
            pg.sql("insert into omc_empresas (id, nombre, plan_usd) values ('{0}', 'Tenant ajeno C1', 0) on conflict (id) do nothing", otra)
            pg.sql("insert into omc_tokens (empresa, rol, nombre) values ('{0}', 'agente', 'otra-c1')", otra)
            token_otro = pg.sql("select token from omc_tokens where empresa = '{0}' and rol = 'agente'", otra)[0]['token']
            try:
                r = rpc(token_otro, 'omc_expediente_ficha', p_id=x['id'])
            except RuntimeError:
                r = None  # una excepción también es un resultado correcto (fail-closed)
            self.assertIsNone(r, 'un token ajeno no debe ver un objeto (ni con listas vacías) del expediente de otra empresa')
        finally:
            pg.sql("delete from omc_empresas where id = '{0}'", otra)
            pg.sql("alter table omc_encargo_avances disable trigger omc_avances_inmutables; "
                   "delete from omc_encargo_avances where encargo_id = {0}; "
                   "alter table omc_encargo_avances enable trigger omc_avances_inmutables;", e['id'])
            pg.sql("delete from omc_encargos where id = {0}", e['id'])
            pg.sql("delete from omc_expedientes where id = {0}", x['id'])
