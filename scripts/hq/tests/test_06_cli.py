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

    def test_alta_sin_frente_se_rechaza(self):
        rc, out, err = cli('owner', 'encargo', 'alta', '--texto', 'Legado CLI')
        self.assertNotEqual(rc, 0)
        self.assertIn('falta frente', out + err)
        n = pg.sql("select count(*) as n from omc_encargos where texto='Legado CLI'")[0]['n']
        self.assertEqual(int(n), 0)

    def test_estado_descartado_pide_motivo(self):
        rc, out, _ = cli('owner', 'encargo', 'alta', '--texto', 'Para descartar', '--frente', 'A3'); e = json.loads(out)
        rc, out, err = cli('owner', 'encargo', 'estado', str(e['id']), 'descartado')
        self.assertNotEqual(rc, 0); self.assertIn('falta motivo', out + err)
        rc, out, err = cli('owner', 'encargo', 'estado', str(e['id']), 'descartado', '--motivo', 'duplicado')
        self.assertEqual(rc, 0, err)

    def test_alta_con_id_no_permite_estado_hecho(self):
        # I1 (revisión final plan 1): 'encargo alta --id N --estado hecho' iba directo a omc_encargo_set,
        # que no validaba nada, saltándose las puertas de omc_encargo_estado/omc_encargo_hecho a una
        # opción de distancia en el mismo CLI. 'hecho' y 'descartado' ya no son choices válidas de
        # '--estado' en 'encargo alta', así que esto falla en el propio parser (rc de argparse), antes
        # de llegar a la base.
        rc, out, err = cli('owner', 'encargo', 'alta', '--texto', 'CLI cierre por alta', '--frente', 'A3', '--responsable', 'Guillem')
        self.assertEqual(rc, 0, err); e = json.loads(out)
        rc, out, err = cli('owner', 'encargo', 'alta', '--id', str(e['id']), '--estado', 'hecho')
        self.assertNotEqual(rc, 0, out + err)
        actual = pg.sql("select estado from omc_encargos where id={0}", e['id'])[0]['estado']
        self.assertEqual(actual, 'encolado')

    def test_alta_de_diego_marca_origen(self):
        # I4 (revisión final plan 1): --de-diego evita que quien da el alta (chief/COO, no Diego en
        # persona) tenga que teclear --origen a mano para que 'Lo que pediste esta semana' del informe
        # de las 07:00 (hq-informe.py) lo detecte.
        rc, out, err = cli('owner', 'encargo', 'alta', '--texto', 'Pedido de Diego', '--frente', 'A3', '--de-diego')
        self.assertEqual(rc, 0, err); e = json.loads(out)
        self.assertTrue(e['origen'].startswith('Diego '), e['origen'])

    def test_alta_de_diego_no_pisa_origen_explicito(self):
        rc, out, err = cli('owner', 'encargo', 'alta', '--texto', 'Origen explícito', '--frente', 'A3', '--de-diego', '--origen', 'Aina 17-09 10:00')
        self.assertEqual(rc, 0, err); e = json.loads(out)
        self.assertEqual(e['origen'], 'Aina 17-09 10:00')

    def test_escalar_cli(self):
        # T14: hq.py escalar pasa --motivo a omc_escalar (p_motivo), sin --agente (la firma vieja de 3
        # args con p_agente ya no existe). Requiere rol owner: escalar necesita HQ_OWNER_TOKEN.
        s = rpc(self.t['agente'], 'omc_pedir', p={'tipo': 'duda', 'titulo': 'Escalar por CLI', 'detalle': 'detalle'})
        rc, out, err = cli('owner', 'escalar', str(s['id']), '--motivo', 'prueba de firma unica')
        self.assertEqual(rc, 0, err)
        r = json.loads(out)
        self.assertEqual(r['destinatario'], 'diego')

    def test_escalar_cli_sin_motivo_cae_en_sin_motivo(self):
        # Ronda 1 (revisor T14): --motivo default='' llegaba a omc_escalar como cadena vacía, que no
        # activa el coalesce(p_motivo, 'sin motivo') de la RPC (solo NULL lo activa). Con default=None
        # el CLI sin --motivo debe dejar el mensaje '[escalado a Diego] sin motivo'.
        s = rpc(self.t['agente'], 'omc_pedir', p={'tipo': 'duda', 'titulo': 'Escalar sin motivo CLI', 'detalle': 'detalle'})
        rc, out, err = cli('owner', 'escalar', str(s['id']))
        self.assertEqual(rc, 0, err)
        msg = pg.sql(f"select texto from omc_mensajes where solicitud_id = {s['id']} order by id desc limit 1")
        self.assertEqual(msg[0]['texto'], '[escalado a Diego] sin motivo')
