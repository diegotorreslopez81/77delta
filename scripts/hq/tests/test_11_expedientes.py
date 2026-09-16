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
