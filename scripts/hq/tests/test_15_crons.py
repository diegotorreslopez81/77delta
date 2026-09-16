import importlib.util, pathlib, unittest
from datetime import datetime, timedelta, timezone

RAIZ = pathlib.Path(__file__).resolve().parents[1]


def cargar(nombre):
    spec = importlib.util.spec_from_file_location(nombre.replace('-', '_'), RAIZ / f'{nombre}.py')
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m


class TestParados(unittest.TestCase):
    def test_clasifica_por_horas_sin_avance(self):
        p = cargar('hq-parados'); ahora = datetime(2026, 9, 17, 7, 0, tzinfo=timezone.utc)
        enc = [
            {'id': 1, 'estado': 'en_curso', 'agente': 'Aina', 'fecha_avance': (ahora - timedelta(hours=50)).isoformat(), 'fecha': (ahora - timedelta(days=5)).isoformat(), 'texto': 'a'},
            {'id': 2, 'estado': 'en_curso', 'agente': 'Biel', 'fecha_avance': None, 'fecha': (ahora - timedelta(hours=80)).isoformat(), 'texto': 'b'},
            {'id': 3, 'estado': 'en_curso', 'agente': 'Ona', 'fecha_avance': (ahora - timedelta(hours=3)).isoformat(), 'fecha': None, 'texto': 'c'},
            {'id': 4, 'estado': 'encolado', 'agente': 'Ona', 'fecha_avance': None, 'fecha': (ahora - timedelta(days=9)).isoformat(), 'texto': 'd'},
        ]
        r = p.clasificar_parados(enc, ahora)
        self.assertEqual([e['id'] for e in r['avisar']], [1]); self.assertEqual([e['id'] for e in r['escalar']], [2])

    def test_no_repite_aviso_en_24h(self):
        p = cargar('hq-parados'); ahora = datetime(2026, 9, 17, 7, 0, tzinfo=timezone.utc)
        estado = {'1': {'avisado': (ahora - timedelta(hours=5)).isoformat()}}
        self.assertFalse(p.toca_avisar('1', 'avisado', estado, ahora))
        self.assertTrue(p.toca_avisar('1', 'avisado', {'1': {'avisado': (ahora - timedelta(hours=30)).isoformat()}}, ahora))

    def test_destino_aviso_ventana_directa_o_jordi_coo(self):
        p = cargar('hq-parados')
        agentes = [{'id': 'aina', 'nombre': 'Aina', 'sesiones': ['Aina-Comercial']}]
        self.assertEqual(p.destino_aviso('Aina', agentes), ('Aina-Comercial', True))
        self.assertIsNone(p.ventana_de('DevOps (alta hoy) + Pol', agentes))
        self.assertEqual(p.destino_aviso('DevOps (alta hoy) + Pol', agentes), ('Jordi-COO', False))


class TestInforme(unittest.TestCase):
    def test_secciones_en_orden_y_peticiones_de_diego(self):
        i = cargar('hq-informe'); hoy = datetime(2026, 9, 17, 6, 50, tzinfo=timezone.utc)
        hq = {'pendientes': [{'id': 685, 'titulo': 'Escribir a Jaume', 'destinatario': 'diego', 'estado': 'pendiente', 'vence': '2026-09-16T17:00:00Z'}], 'licitaciones': []}
        feed = [{'codigo': 'A2', 'tipo': 'avance'}, {'codigo': 'A2', 'tipo': 'alta'}, {'codigo': 'B4', 'tipo': 'cierre'}]
        enc = [
            {'id': 260, 'texto': 'Alta IAE telecos', 'origen': 'Diego 16-09 15:40', 'estado': 'encolado', 'agente': 'Ferran', 'fecha': '2026-09-16T15:40:00Z', 'fecha_avance': None, 'fecha_hito': '2026-09-19'},
            {'id': 100, 'texto': 'viejo', 'origen': 'Diego 01-09 10:00', 'estado': 'hecho', 'agente': 'x', 'fecha': '2026-09-01T10:00:00Z', 'fecha_avance': None},
        ]
        s = i.secciones(hq, feed, enc, hoy)
        self.assertEqual([t for t, _ in s][:2], ['Lo que pediste esta semana', 'Lo que depende de ti'])
        self.assertTrue(any('#260' in l for l in s[0][1])); self.assertFalse(any('#100' in l for l in s[0][1]))
        self.assertTrue(any('#685' in l for l in s[1][1]))
        actividad = dict(s)['Actividad por frente']; self.assertTrue(any(l.startswith('A2') and '2' in l for l in actividad))
