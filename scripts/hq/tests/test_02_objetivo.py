import json, unittest, urllib.request
from . import pg


def rpc(token, fn, **args):
    t = pg.preparar_tenant()
    args['p_token'] = token
    req = urllib.request.Request(t['url'] + '/rest/v1/rpc/' + fn, data=json.dumps(args).encode(), method='POST',
                                 headers={'apikey': t['anon'], 'Authorization': 'Bearer ' + t['anon'], 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read() or b'null')
    except urllib.error.HTTPError as e:
        raise RuntimeError(json.loads(e.read().decode()).get('message', '')) from None


class TestObjetivo(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.t = pg.preparar_tenant()
        pg.sql("delete from omc_plan_objetivo where empresa='pruebas'")

    @classmethod
    def tearDownClass(cls):
        pg.sql("delete from omc_plan_objetivo where empresa='pruebas'")

    def test_dos_horizontes_conviven(self):
        rpc(self.t['owner'], 'omc_plan_objetivo_set', p={'titulo': 'Contratado 2026', 'meta': 300000, 'unidad': 'EUR', 'fecha_limite': '2026-12-31'})
        rpc(self.t['owner'], 'omc_plan_objetivo_set', p={'horizonte': 2027, 'titulo': 'Contratado 2027', 'meta': 3000000, 'unidad': 'EUR', 'fecha_limite': '2027-12-31'})
        rpc(self.t['owner'], 'omc_plan_objetivo_set', p={'titulo': 'Contratado 2026', 'meta': 310000, 'unidad': 'EUR', 'fecha_limite': '2026-12-31'})
        todos = rpc(self.t['agente'], 'omc_plan_objetivos')
        self.assertEqual([o['horizonte'] for o in todos], [2026, 2027])
        self.assertEqual(float(todos[0]['meta']), 310000)
        uno = rpc(self.t['agente'], 'omc_plan_objetivo')
        self.assertEqual(uno['horizonte'], 2026)

    def test_agente_no_puede_fijar_objetivo(self):
        with self.assertRaisesRegex(RuntimeError, 'solo owner'):
            rpc(self.t['agente'], 'omc_plan_objetivo_set', p={'titulo': 'x', 'meta': 1})

    def test_unidad_y_fecha_vacias_usan_default_sin_reventar(self):
        r = rpc(self.t['owner'], 'omc_plan_objetivo_set', p={'horizonte': 2029, 'titulo': 'Horizonte de prueba', 'meta': 1, 'unidad': '', 'fecha_limite': ''})
        self.assertEqual(r['unidad'], 'EUR')
        self.assertIsNone(r['fecha_limite'])
