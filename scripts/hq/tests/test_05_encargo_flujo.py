import unittest
from . import pg
from .pg import rpc


class TestEncargoFlujo(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.t = pg.preparar_tenant()
        pg.limpiar_tenant()
        pg.sql("insert into omc_agentes (empresa, id, nombre, depto, nivel, sesiones, activo) values ('pruebas','sales-licita','Guillem','licitaciones',2,array['Guillem-Licitaciones'],true)")
        rpc(cls.t['owner'], 'omc_bloque_set', p={'letra': 'A', 'nombre': 'Licitaciones', 'orden': 1})
        cls.f = rpc(cls.t['owner'], 'omc_frente_set', p={'codigo': 'A3', 'bloque': 'A', 'linea': 'Ofertas en curso', 'kpi': 'EUR', 'meta': 1})
        pg.sql("insert into omc_kit (empresa, linea_id, tipo, nombre, url, vigente, actualizado_por) values ('pruebas', {0}, 'plantilla', 'Plantilla oferta', 'https://example.com/kit/oferta', true, 'test')", cls.f['id'])

    @classmethod
    def tearDownClass(cls):
        pg.limpiar_tenant()

    def nuevo(self, texto='Oferta'):
        return rpc(self.t['owner'], 'omc_encargo_alta', p={'texto': texto, 'frente': 'A3', 'responsable': 'Guillem'})

    def test_tomar_agente_no_autorizado_se_rechaza(self):
        e = self.nuevo()
        with self.assertRaisesRegex(RuntimeError, 'no autorizado'):
            rpc(self.t['agente'], 'omc_encargo_tomar', p_id=e['id'], p_agente='intruso')

    def test_tomar_sin_responsable_asigna_al_agente_que_toma(self):
        e = rpc(self.t['owner'], 'omc_encargo_alta', p={'texto': 'Sin responsable', 'frente': 'A3'})
        self.assertEqual(e['agente'], '')
        ctx = rpc(self.t['agente'], 'omc_encargo_tomar', p_id=e['id'], p_agente='Guillem')
        self.assertEqual(ctx['encargo']['estado'], 'en_curso')
        self.assertEqual(ctx['encargo']['agente'], 'sales-licita')

    def test_tomar_pasa_a_en_curso_y_devuelve_contexto(self):
        e = self.nuevo()
        ctx = rpc(self.t['agente'], 'omc_encargo_tomar', p_id=e['id'], p_agente='Guillem')
        self.assertEqual(ctx['encargo']['estado'], 'en_curso'); self.assertEqual(ctx['frente']['codigo'], 'A3')
        self.assertEqual([k['nombre'] for k in ctx['kit']], ['Plantilla oferta'])
        self.assertEqual([a['tipo'] for a in ctx['avances']], ['estado', 'alta'])

    def test_hecho_exige_fuente_valida(self):
        e = self.nuevo()
        with self.assertRaisesRegex(RuntimeError, 'fuente no válida'):
            rpc(self.t['agente'], 'omc_encargo_hecho', p_id=e['id'], p_fuente='lo hice bien', p_agente='Guillem')
        with self.assertRaisesRegex(RuntimeError, 'usa omc_encargo_hecho'):
            rpc(self.t['agente'], 'omc_encargo_estado', p_id=e['id'], p_estado='hecho', p_agente='Guillem')
        r = rpc(self.t['agente'], 'omc_encargo_hecho', p_id=e['id'], p_fuente='https://example.com/kit/oferta', p_entregable='https://docs.google.com/document/d/abc', p_agente='Guillem')
        self.assertEqual(r['estado'], 'hecho'); self.assertEqual(r['fuente_cierre'], 'https://example.com/kit/oferta')
        e2 = self.nuevo()
        r2 = rpc(self.t['agente'], 'omc_encargo_hecho', p_id=e2['id'], p_fuente='https://docs.google.com/document/d/xyz/edit', p_agente='Guillem')
        self.assertEqual(r2['estado'], 'hecho')
        tipos = [a['tipo'] for a in pg.sql("select tipo from omc_encargo_avances where encargo_id={0} order by id", e['id'])]
        self.assertEqual(tipos, ['alta', 'cierre'])

    def test_descartar_exige_motivo(self):
        e = self.nuevo()
        with self.assertRaisesRegex(RuntimeError, 'falta motivo'):
            rpc(self.t['owner'], 'omc_encargo_estado', p_id=e['id'], p_estado='descartado')
        r = rpc(self.t['owner'], 'omc_encargo_estado', p_id=e['id'], p_estado='descartado', p_motivo='duplicado de #1')
        self.assertEqual(r['motivo_descarte'], 'duplicado de #1')

    def test_encargo_set_no_deja_cerrar_saltando_las_puertas(self):
        # I1 (revision final plan 1): omc_encargo_set (la funcion detras de 'hq.py encargo alta --id N')
        # aceptaba estado='hecho'/'descartado' en su rama de update sin exigir fuente ni motivo, saltandose
        # las puertas de omc_encargo_hecho/omc_encargo_estado por una via distinta a la misma columna.
        e = self.nuevo()
        with self.assertRaisesRegex(RuntimeError, 'usa encargo hecho'):
            rpc(self.t['owner'], 'omc_encargo_set', p={'id': e['id'], 'estado': 'hecho'})
        with self.assertRaisesRegex(RuntimeError, 'usa encargo hecho'):
            rpc(self.t['owner'], 'omc_encargo_set', p={'id': e['id'], 'estado': 'descartado'})
        actual = pg.sql("select estado from omc_encargos where id={0}", e['id'])[0]['estado']
        self.assertEqual(actual, 'encolado')

    def test_editar_solo_owner_y_comentario_queda_en_feed(self):
        e = self.nuevo('Editable')
        with self.assertRaisesRegex(RuntimeError, 'solo owner'):
            rpc(self.t['agente'], 'omc_encargo_editar', p_id=e['id'], p={'texto': 'x'})
        r = rpc(self.t['owner'], 'omc_encargo_editar', p_id=e['id'], p={'texto': 'Editado', 'etiquetas': ['a'], 'orden_kanban': 3, 'comentario': 'Prioridad alta, Guillem'})
        self.assertEqual(r['texto'], 'Editado'); self.assertEqual(r['orden_kanban'], 3)
        feed = rpc(self.t['agente'], 'omc_feed')
        mio = [f for f in feed if f['encargo_id'] == e['id']]
        self.assertEqual(mio[0]['tipo'], 'comentario_diego'); self.assertEqual(mio[0]['codigo'], 'A3')
