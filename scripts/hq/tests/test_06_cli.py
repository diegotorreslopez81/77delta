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

    @classmethod
    def tearDownClass(cls):
        pg.limpiar_tenant()

    def test_frentes_lista(self):
        rc, out, _ = cli('agente', 'frentes')
        self.assertEqual(rc, 0); self.assertEqual(json.loads(out)[0]['codigo'], 'A3')

    def test_alta_frente_inexistente_falla_con_pista(self):
        rc, out, err = cli('owner', 'encargo', 'alta', '--texto', 'Frente que no existe', '--frente', 'Z9')
        self.assertNotEqual(rc, 0); self.assertIn('no existe', out + err)

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

    def test_alta_sin_frente_usa_v1_legado(self):
        rc, out, err = cli('owner', 'encargo', 'alta', '--texto', 'Legado CLI')
        self.assertEqual(rc, 0, err)
        e = json.loads(out)
        filas = pg.sql("select origen, linea_id from omc_encargos where id={0}", e['id'])
        self.assertEqual(filas[0]['origen'], 'legado')
        self.assertIsNone(filas[0]['linea_id'])
        pg.sql("delete from omc_encargos where id={0}", e['id'])

    def test_estado_descartado_pide_motivo(self):
        rc, out, _ = cli('owner', 'encargo', 'alta', '--texto', 'Para descartar', '--frente', 'A3'); e = json.loads(out)
        rc, out, err = cli('owner', 'encargo', 'estado', str(e['id']), 'descartado')
        self.assertNotEqual(rc, 0); self.assertIn('falta motivo', out + err)
        rc, out, err = cli('owner', 'encargo', 'estado', str(e['id']), 'descartado', '--motivo', 'duplicado')
        self.assertEqual(rc, 0, err)
