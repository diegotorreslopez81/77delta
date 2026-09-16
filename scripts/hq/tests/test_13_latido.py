import unittest
from . import pg
from .pg import rpc


class TestLatido(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.t = pg.preparar_tenant(); pg.limpiar_tenant()
        pg.sql("insert into omc_agentes (empresa, id, nombre, depto, nivel, sesiones, activo) values ('pruebas','probador','Probador','pruebas',2,array['Probador-Pruebas'],true)")
        pg.sql("insert into omc_agentes (empresa, id, nombre, depto, nivel, sesiones, activo) values ('pruebas','segundo','Segundo','pruebas',2,array['Segundo-Pruebas'],true)")
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

    def test_latido_no_trae_encargos_de_otro_agente(self):
        propio = rpc(self.t['owner'], 'omc_encargo_alta', p={'texto': 'Fuente Segundo', 'frente': 'A1', 'responsable': 'Segundo'})
        rpc(self.t['agente'], 'omc_encargo_tomar', p_id=propio['id'], p_agente='Segundo')
        l = rpc(self.t['agente'], 'omc_latido', p_agente='probador')
        self.assertNotIn(propio['id'], [x['id'] for x in l['encargos']])

    def test_encargo_ficha_devuelve_encargo_frente_avances(self):
        e = rpc(self.t['owner'], 'omc_encargo_alta', p={'texto': 'Ficha completa', 'frente': 'A1', 'responsable': 'Segundo'})
        rpc(self.t['agente'], 'omc_encargo_tomar', p_id=e['id'], p_agente='Segundo')
        f = rpc(self.t['agente'], 'omc_encargo_ficha', p_id=e['id'])
        self.assertEqual(f['encargo']['id'], e['id'])
        self.assertEqual(f['frente']['codigo'], 'A1')
        self.assertIsInstance(f['avances'], list)

    def test_encargo_ficha_id_ajeno_no_filtra_datos(self):
        with self.assertRaisesRegex(RuntimeError, 'no existe en esta empresa'):
            rpc(self.t['agente'], 'omc_encargo_ficha', p_id=999999999)
        ajeno = pg.sql("select min(id) as id from omc_encargos where empresa <> 'pruebas'")
        if ajeno and ajeno[0]['id'] is not None:
            with self.assertRaisesRegex(RuntimeError, 'no existe en esta empresa'):
                rpc(self.t['agente'], 'omc_encargo_ficha', p_id=ajeno[0]['id'])
