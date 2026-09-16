import json, subprocess, sys, unittest
from pathlib import Path
from . import pg
from .pg import rpc

HQ = str(Path(__file__).resolve().parents[1] / 'hq.py')


class TestContactos(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.t = pg.preparar_tenant(); pg.limpiar_tenant()
        pg.sql("insert into omc_agentes (empresa, id, nombre, depto, nivel, sesiones, activo) values ('pruebas','bdr','Aina','comercial',3,array['Aina-BDR'],true)")
        rpc(cls.t['owner'], 'omc_bloque_set', p={'letra': 'C', 'nombre': 'Comercial', 'orden': 3})
        rpc(cls.t['owner'], 'omc_frente_set', p={'codigo': 'C5', 'bloque': 'C', 'linea': 'Prospección', 'kpi': '%', 'meta': 20})
        cls.e = rpc(cls.t['owner'], 'omc_encargo_alta', p={'texto': 'Campaña clínicas', 'frente': 'C5', 'responsable': 'Aina'})

    @classmethod
    def tearDownClass(cls):
        pg.limpiar_tenant()

    def test_alta_hereda_frente_y_cuenta_toques(self):
        c1 = rpc(self.t['agente'], 'omc_contacto_alta', p={'encargo': self.e['id'], 'persona': 'Nil Vidal', 'email': 'nil@example.com', 'organizacion': 'Clínica X', 'canal': 'correo', 'motivo': 'presentar LeakAI', 'agente': 'Aina'})
        self.assertEqual(c1['linea_id'], self.e['linea_id']); self.assertEqual(c1['toque'], 1); self.assertEqual(c1['estado'], 'previsto')
        rpc(self.t['agente'], 'omc_contacto_estado', p_id=c1['id'], p_estado='enviado', p_proximo='2026-09-23')
        c2 = rpc(self.t['agente'], 'omc_contacto_alta', p={'encargo': self.e['id'], 'persona': 'Nil Vidal', 'email': 'nil@example.com', 'canal': 'correo', 'motivo': 'segundo toque', 'agente': 'Aina'})
        self.assertEqual(c2['toque'], 2)
        with self.assertRaisesRegex(RuntimeError, 'máximo dos toques'):
            rpc(self.t['agente'], 'omc_contacto_alta', p={'encargo': self.e['id'], 'persona': 'Nil Vidal', 'email': 'nil@example.com', 'canal': 'correo', 'motivo': 'tercero', 'agente': 'Aina'})

    def test_correo_exige_email_y_alta_exige_encargo(self):
        with self.assertRaisesRegex(RuntimeError, 'falta email'):
            rpc(self.t['agente'], 'omc_contacto_alta', p={'encargo': self.e['id'], 'persona': 'X', 'canal': 'correo', 'motivo': 'm'})
        with self.assertRaisesRegex(RuntimeError, 'falta encargo'):
            rpc(self.t['agente'], 'omc_contacto_alta', p={'persona': 'X', 'canal': 'linkedin', 'motivo': 'm'})

    def test_casar_respuesta_y_pendientes(self):
        c = rpc(self.t['agente'], 'omc_contacto_alta', p={'encargo': self.e['id'], 'persona': 'Marta', 'email': 'marta@example.com', 'canal': 'correo', 'motivo': 'demo', 'agente': 'Aina'})
        rpc(self.t['agente'], 'omc_contacto_estado', p_id=c['id'], p_estado='enviado', p_proximo='2026-01-01')
        pend = rpc(self.t['agente'], 'omc_contactos_lista', p_filtro={'pendientes': True})
        self.assertIn(c['id'], [x['id'] for x in pend])
        r = rpc(self.t['agente'], 'omc_contacto_casar', p_email='MARTA@example.com', p_ref='<msg-1@example.com>')
        self.assertEqual(r['id'], c['id']); self.assertEqual(r['estado'], 'respondido'); self.assertEqual(r['respuesta_ref'], '<msg-1@example.com>')
        self.assertIsNone(rpc(self.t['agente'], 'omc_contacto_casar', p_email='nadie@example.com', p_ref='x'))
        ctx = rpc(self.t['agente'], 'omc_encargo_tomar', p_id=self.e['id'], p_agente='Aina')
        self.assertTrue(any(x['id'] == c['id'] for x in ctx['contactos']))

    def test_cli_alta_y_ficha(self):
        env = pg.entorno_cli('agente'); env['HQ_AGENTE_FORZADO'] = 'Aina'
        p = subprocess.run([sys.executable, HQ, '--json', 'contacto', 'alta', '--encargo', str(self.e['id']), '--persona', 'Pau', '--canal', 'linkedin', '--motivo', 'saludo'], env=env, capture_output=True, text=True)
        self.assertEqual(p.returncode, 0, p.stderr); c = json.loads(p.stdout)
        p = subprocess.run([sys.executable, HQ, '--json', 'contacto', 'ficha', str(c['id'])], env=env, capture_output=True, text=True)
        self.assertEqual(json.loads(p.stdout)['persona'], 'Pau')
