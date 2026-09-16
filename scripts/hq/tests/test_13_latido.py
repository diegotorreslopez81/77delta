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

    @classmethod
    def tearDownClass(cls):
        pg.limpiar_tenant()

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
