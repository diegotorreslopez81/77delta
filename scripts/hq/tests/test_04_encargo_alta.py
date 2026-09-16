import unittest
from . import pg
from .pg import rpc


class TestEncargoAlta(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.t = pg.preparar_tenant()
        pg.limpiar_tenant()
        pg.sql("insert into omc_agentes (empresa, id, nombre, depto, nivel, sesiones, activo) values "
               "('pruebas','sales-licita','Guillem','licitaciones',2,array['Guillem-Licitaciones'],true), ('pruebas','chief','Marc','direccion',1,array['Marc-Chief'],true)")
        rpc(cls.t['owner'], 'omc_bloque_set', p={'letra': 'A', 'nombre': 'Licitaciones', 'orden': 1})
        rpc(cls.t['owner'], 'omc_frente_set', p={'codigo': 'A3', 'bloque': 'A', 'linea': 'Ofertas en curso', 'kpi': 'EUR', 'meta': 1})

    @classmethod
    def tearDownClass(cls):
        pg.limpiar_tenant()

    def test_alta_sin_frente_se_rechaza(self):
        with self.assertRaisesRegex(RuntimeError, 'falta frente'):
            rpc(self.t['owner'], 'omc_encargo_alta', p={'texto': 'Preparar oferta X'})
        with self.assertRaisesRegex(RuntimeError, 'frente Z9 no existe'):
            rpc(self.t['owner'], 'omc_encargo_alta', p={'texto': 'Preparar oferta X', 'frente': 'Z9'})

    def test_alta_con_frente_crea_encargo_y_avance_de_alta(self):
        e = rpc(self.t['owner'], 'omc_encargo_alta', p={'texto': 'Preparar oferta X', 'frente': 'a3', 'responsable': 'guillem', 'etiquetas': ['oferta', 'urgente'],
                                                         'enlaces': [{'titulo': 'pliego', 'url': 'https://docs.google.com/document/d/1'}], 'origen': 'Diego 16-09 15:30'})
        self.assertEqual(e['codigo'], 'A3'); self.assertEqual(e['agente'], 'sales-licita'); self.assertEqual(e['estado'], 'encolado')
        self.assertEqual(e['etiquetas'], ['oferta', 'urgente']); self.assertEqual(e['creado_por'], 'diego')
        av = pg.sql("select tipo, autor from omc_encargo_avances where encargo_id={0}", e['id'])
        self.assertEqual([(a['tipo'], a['autor']) for a in av], [('alta', 'diego')])

    def test_responsable_desconocido_se_rechaza(self):
        with self.assertRaisesRegex(RuntimeError, 'responsable nadie no es un agente'):
            rpc(self.t['owner'], 'omc_encargo_alta', p={'texto': 'x', 'frente': 'A3', 'responsable': 'nadie'})

    def test_encargo_set_sin_id_sin_frente_se_rechaza(self):
        # T7: migracion aplicada el 16-sep y constraint omc_encargos_frente_obligatorio activa.
        # La ventana de compatibilidad v1 (alta legado sin frente) queda cerrada con error claro.
        with self.assertRaisesRegex(RuntimeError, 'falta frente'):
            rpc(self.t['owner'], 'omc_encargo_set', p={'texto': 'Aviso legado sin frente'})

    def test_encargo_set_sin_id_con_frente_delega_en_alta(self):
        r = rpc(self.t['owner'], 'omc_encargo_set', p={'texto': 'Via set con frente', 'frente': 'A3'})
        self.assertEqual(r['codigo'], 'A3')
        av = pg.sql("select tipo from omc_encargo_avances where encargo_id={0}", r['id'])
        self.assertEqual([a['tipo'] for a in av], ['alta'])

    def test_avance_queda_en_historial_inmutable(self):
        e = rpc(self.t['owner'], 'omc_encargo_alta', p={'texto': 'Avanzable', 'frente': 'A3', 'responsable': 'Guillem'})
        r = rpc(self.t['agente'], 'omc_encargo_avance', p_id=e['id'], p_texto='Leído el pliego', p_agente='Guillem')
        self.assertEqual(r['ultimo_avance'], 'Leído el pliego')
        rpc(self.t['agente'], 'omc_encargo_avance', p_id=e['id'], p_texto='Como chief, ok', p_agente='chief')
        n = pg.sql("select count(*) as n from omc_encargo_avances where encargo_id={0} and tipo='avance'", e['id'])[0]['n']
        self.assertEqual(int(n), 2)
        with self.assertRaisesRegex(RuntimeError, 'append-only'):
            pg.sql("delete from omc_encargo_avances where encargo_id={0}", e['id'])
        with self.assertRaisesRegex(RuntimeError, 'append-only'):
            pg.sql("update omc_encargo_avances set texto='manipulado' where encargo_id={0}", e['id'])
        with self.assertRaisesRegex(RuntimeError, 'no autorizado'):
            rpc(self.t['agente'], 'omc_encargo_avance', p_id=e['id'], p_texto='intruso', p_agente='otro')
