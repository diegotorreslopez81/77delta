import unittest
from . import pg


class TestTenant(unittest.TestCase):
    def test_tenant_pruebas_existe_con_dos_tokens(self):
        t = pg.preparar_tenant()
        self.assertEqual(len(t['owner']), len(t['agente']))
        self.assertNotEqual(t['owner'], t['agente'])
        filas = pg.sql("select count(*) as n from omc_tokens where empresa='pruebas'")
        self.assertEqual(int(filas[0]['n']), 2)

    def test_schema_v2_aplicado(self):
        filas = pg.sql("select 1 from pg_proc where proname='omc_v2_version'")
        self.assertEqual(len(filas), 1, 'aplica scripts/hq/aplicar-schema.sh')
