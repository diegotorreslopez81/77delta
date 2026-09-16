import subprocess, sys, unittest
from pathlib import Path
from . import pg
from .pg import rpc

HQ = str(Path(__file__).resolve().parents[1] / 'hq.py'); SH = str(Path(__file__).resolve().parent / 'test_10_candado.sh')


class TestCandado(unittest.TestCase):
    @classmethod
    def tearDownClass(cls):
        # sin esto, el encargo de prueba (frente C5) sobrevive al proceso y revienta el setUpClass de
        # test_03_frentes en la siguiente ejecucion de la suite (delete de omc_plan_lineas contra un
        # encargo que la deja sin frente, cosa que el constraint de T4 no permite).
        pg.limpiar_tenant()

    def test_candado_exige_contacto_y_rechaza_html(self):
        t = pg.preparar_tenant(); pg.limpiar_tenant()
        pg.sql("insert into omc_agentes (empresa, id, nombre, depto, nivel, sesiones, activo) values ('pruebas','bdr','Aina','comercial',3,array['Aina-BDR'],true)")
        rpc(t['owner'], 'omc_bloque_set', p={'letra': 'C', 'nombre': 'Comercial', 'orden': 3})
        rpc(t['owner'], 'omc_frente_set', p={'codigo': 'C5', 'bloque': 'C', 'linea': 'Prospección', 'kpi': '%', 'meta': 20})
        e = rpc(t['owner'], 'omc_encargo_alta', p={'texto': 'Campaña', 'frente': 'C5', 'responsable': 'Aina'})
        c = rpc(t['agente'], 'omc_contacto_alta', p={'encargo': e['id'], 'persona': 'Nil', 'email': 'nil@example.com', 'canal': 'correo', 'motivo': 'm', 'agente': 'Aina'})
        c2 = rpc(t['agente'], 'omc_contacto_alta', p={'encargo': e['id'], 'persona': 'Otra', 'email': 'otra@example.com', 'canal': 'correo', 'motivo': 'm', 'agente': 'Aina'})
        tarjeta = rpc(t['agente'], 'omc_pedir', p={'agente': 'bdr', 'tipo': 'contacto', 'titulo': 'Enviar prueba', 'detalle': 'test'})
        pg.sql("update omc_solicitudes set estado='aprobada' where id={0}", tarjeta['id'])
        env = pg.entorno_cli('agente'); env['HQ_AGENTE_FORZADO'] = 'Aina'
        p = subprocess.run(['bash', SH, str(tarjeta['id']), str(c['id']), str(c2['id'])], env=env, capture_output=True, text=True)
        self.assertEqual(p.returncode, 0, p.stdout + p.stderr)
