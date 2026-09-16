import unittest
from . import pg
from .pg import rpc


class TestHqV2(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.t = pg.preparar_tenant(); pg.limpiar_tenant()
        pg.sql("insert into omc_agentes (empresa, id, nombre, depto, nivel, sesiones, activo) values ('pruebas','probador','Probador','pruebas',2,array['Probador-Pruebas'],true)")
        rpc(cls.t['owner'], 'omc_plan_objetivo_set', p={'horizonte': 2026, 'titulo': 'Contratado a 31 de diciembre', 'meta': 300000, 'unidad': 'EUR'})
        rpc(cls.t['owner'], 'omc_bloque_set', p={'letra': 'A', 'nombre': 'Licitaciones', 'orden': 1, 'meta_eur': 200000})
        rpc(cls.t['owner'], 'omc_frente_set', p={'codigo': 'A1', 'bloque': 'A', 'linea': 'Fuentes', 'kpi': 'fuentes', 'meta': 17})

    def test_claves_y_kanban(self):
        e1 = rpc(self.t['owner'], 'omc_encargo_alta', p={'texto': 'sin hito', 'frente': 'A1', 'responsable': 'Probador'})
        e2 = rpc(self.t['owner'], 'omc_encargo_alta', p={'texto': 'con hito', 'frente': 'A1', 'responsable': 'Probador', 'fecha_hito': '2026-09-20'})
        e3 = rpc(self.t['owner'], 'omc_encargo_alta', p={'texto': 'en curso viejo', 'frente': 'A1', 'responsable': 'Probador'})
        rpc(self.t['agente'], 'omc_encargo_tomar', p_id=e3['id'], p_agente='Probador')
        pg.sql(f"update omc_encargos set fecha_avance = now() - interval '3 days' where id = {e3['id']}")
        d = rpc(self.t['owner'], 'omc_hq_v2')
        for k in ('version', 'objetivos', 'bloques', 'frentes', 'encargos', 'avances', 'kit', 'contactos', 'expedientes', 'sesiones', 'agentes', 'pendientes', 'licitaciones', 'uso'):
            self.assertIn(k, d, k)
        col = {e['id']: e for e in d['encargos']}
        self.assertEqual(col[e1['id']]['columna'], 'backlog'); self.assertEqual(col[e2['id']]['columna'], 'por_hacer')
        self.assertEqual(col[e3['id']]['columna'], 'en_curso'); self.assertTrue(col[e3['id']]['rojo']); self.assertFalse(col[e1['id']]['rojo'])
        self.assertEqual(d['objetivos'][0]['horizonte'], 2026); self.assertEqual(d['bloques'][0]['encargos_abiertos'], 3)

    def test_agente_no_ve_sesion_url_ajena(self):
        rpc(self.t['owner'], 'omc_agente_sesion_url', p_agente='probador', p_url='https://claude.ai/code/session_zzz')
        d = rpc(self.t['agente'], 'omc_hq_v2')
        self.assertTrue(all(a.get('sesion_url') in (None, '') or a['id'] == 'probador' for a in d['agentes']))
        self.assertEqual(d['pendientes'], []); self.assertEqual(d['licitaciones'], []); self.assertEqual(d['uso'], {})
