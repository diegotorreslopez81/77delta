import unittest
from . import pg
from .pg import rpc


class TestAgentes(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.t = pg.preparar_tenant(); pg.limpiar_tenant()
        pg.sql("insert into omc_agentes (empresa, id, nombre, depto, nivel, sesiones, activo) values ('pruebas','probador','Probador','pruebas',2,array['Probador-Pruebas'],true), ('pruebas','otro','Otro','pruebas',2,array['Otro-Pruebas'],true)")
        rpc(cls.t['owner'], 'omc_bloque_set', p={'letra': 'A', 'nombre': 'Licitaciones', 'orden': 1})
        rpc(cls.t['owner'], 'omc_frente_set', p={'codigo': 'A1', 'bloque': 'A', 'linea': 'Fuentes', 'kpi': 'fuentes', 'meta': 17})

    @classmethod
    def tearDownClass(cls):
        pg.limpiar_tenant()

    def test_sesion_url_propia_y_ajena(self):
        # Nota (T12, concern): el brief de esta tarea comparaba t.nombre (de omc_tokens) contra el agente
        # declarado para exigir "solo el propio agente o el owner", asumiendo nombre=''. En producción
        # (77delta) y en el tenant de pruebas (pg.preparar_tenant) el token de rol 'agente' siempre tiene
        # nombre no vacío ('agentes' y 'pruebas-agente' respectivamente) y nunca coincide con ningún id de
        # agente real, así que esa comparación bloquearía SIEMPRE el camino "propio agente". Se resuelve del
        # lado del código existente (omc_agente_sesion_url ya no compara t.nombre): la identidad la da
        # p_agente declarado y validado por omc_agente_valido, igual que omc_kit_set (T8) y
        # omc_encargo_tomar ya hacen con p->>'agente'. Por eso cualquier ventana con el token de agente
        # puede fijar la sesion_url de cualquier agente activo declarando p_agente.
        r = rpc(self.t['agente'], 'omc_agente_sesion_url', p_agente='Probador', p_url='https://claude.ai/code/session_abc', p_cuenta='team')
        self.assertEqual(r['sesion_url'], 'https://claude.ai/code/session_abc'); self.assertEqual(r['cuenta'], 'team')
        r2 = rpc(self.t['owner'], 'omc_agente_sesion_url', p_agente='otro', p_url='https://claude.ai/code/session_y', p_cuenta='diego')
        self.assertEqual(r2['id'], 'otro')
        with self.assertRaisesRegex(RuntimeError, 'sesion_url debe ser una URL de claude.ai'):
            rpc(self.t['owner'], 'omc_agente_sesion_url', p_agente='otro', p_url='https://evil.example/x')
        with self.assertRaisesRegex(RuntimeError, 'agente fantasma no existe'):
            rpc(self.t['owner'], 'omc_agente_sesion_url', p_agente='fantasma', p_url='https://claude.ai/code/session_z')

    def test_frentes_y_lista(self):
        rpc(self.t['owner'], 'omc_agente_frentes_set', p_agente='probador', p_frentes=['A1'])
        with self.assertRaisesRegex(RuntimeError, 'frente Z9 no existe'):
            rpc(self.t['owner'], 'omc_agente_frentes_set', p_agente='probador', p_frentes=['Z9'])
        with self.assertRaisesRegex(RuntimeError, 'solo owner'):
            rpc(self.t['agente'], 'omc_agente_frentes_set', p_agente='probador', p_frentes=['A1'])
        lista = {a['id']: a for a in rpc(self.t['agente'], 'omc_agentes_lista')}
        self.assertEqual(lista['probador']['frentes_codigos'], ['A1'])
        self.assertIn('sesion_url', lista['probador']); self.assertNotIn('token', lista['probador'])

    def test_avatar_solo_owner(self):
        r = rpc(self.t['owner'], 'omc_agente_avatar_set', p_agente='probador', p_url='https://77delta.com/hq/avatares/probador.svg')
        self.assertEqual(r['avatar_url'], 'https://77delta.com/hq/avatares/probador.svg')
        with self.assertRaisesRegex(RuntimeError, 'solo owner'):
            rpc(self.t['agente'], 'omc_agente_avatar_set', p_agente='probador', p_url='https://77delta.com/hq/avatares/otro.svg')
