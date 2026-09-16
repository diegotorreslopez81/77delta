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

    @classmethod
    def tearDownClass(cls):
        pg.sql("delete from omc_plan_lineas where empresa='pruebas'")
        pg.sql("delete from omc_plan_bloques where empresa='pruebas'")
        pg.sql("delete from omc_agentes where empresa='pruebas'")

    def tearDown(self):
        # unittest ejecuta los tests por orden alfabetico, no por orden de definicion: sin esto
        # test_helpers_frente_y_agente (crea el bloque B y el frente B1) se cuela antes que
        # test_upsert_bloque_y_frente_por_clave_natural y contamina omc_frentes_lista().
        pg.sql("delete from omc_plan_lineas where empresa='pruebas'")
        pg.sql("delete from omc_plan_bloques where empresa='pruebas'")

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
