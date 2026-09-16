import unittest
from . import pg
from .pg import rpc


class TestEscalar(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.t = pg.preparar_tenant(); pg.limpiar_tenant()
        pg.sql("insert into omc_agentes (empresa, id, nombre, depto, nivel, sesiones, activo) values ('pruebas','probador','Probador','pruebas',2,array['Probador-Pruebas'],true)")

    def test_una_sola_firma(self):
        n = pg.sql("select count(*) as n from pg_proc where proname = 'omc_escalar'")[0]['n']
        self.assertEqual(n, 1)

    def test_escalar_cambia_destinatario_y_deja_mensaje(self):
        s = rpc(self.t['agente'], 'omc_pedir', p={'agente': 'probador', 'tipo': 'duda', 'titulo': 'Decidir prueba de escalado', 'detalle': 'detalle'})
        sid = s['id']
        r = rpc(self.t['agente'], 'omc_escalar', p_id=sid, p_motivo='Solo Diego puede decidir esto porque implica gasto')
        self.assertEqual(r['destinatario'], 'diego')
        fila = pg.sql(f"select destinatario, estado from omc_solicitudes where id = {sid}")[0]
        self.assertEqual(fila['destinatario'], 'diego'); self.assertIn(fila['estado'], ('pendiente',))
        msgs = pg.sql(f"select texto from omc_mensajes where solicitud_id = {sid} order by id desc limit 1")
        self.assertTrue(msgs[0]['texto'].startswith('[escalado a Diego]'))
