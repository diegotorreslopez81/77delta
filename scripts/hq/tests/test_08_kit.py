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

    @classmethod
    def tearDownClass(cls):
        pg.limpiar_tenant()

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
