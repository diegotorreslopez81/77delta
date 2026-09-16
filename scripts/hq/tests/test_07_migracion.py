import importlib.util, unittest
from pathlib import Path

ruta = Path(__file__).resolve().parents[1] / 'migrar-encargos-frente.py'
spec = importlib.util.spec_from_file_location('migrar', ruta); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)


class TestClasificar(unittest.TestCase):
    def test_reglas_por_texto(self):
        casos = [('Cubrir las fuentes de todas las CCAA en el motor', 'ariadna', '', 'A1'), ('Leer el art. 76 del pliego antes de proponer', 'guillem', '', 'A2'),
                 ('Base de colaboradores para UTE', 'biel', '', 'A4'), ('Sobre digital de la oferta de San Fernando', 'laia', '', 'A3'),
                 ('Memoria ACCIÓ Exploració', 'helena', '', 'B1'), ('Ficha del Cupó IA de Nora Fuchs', 'martí', '', 'B2'), ('Kit Digital y CDTI', 'clara', '', 'B3'),
                 ('Inscripción FUNDAE bonificada', 'ferran', '', 'B4'), ('Reunión con el ayuntamiento', 'biel', '', 'C1'), ('Contrato menor de formación', 'biel', '', 'C2'),
                 ('Propuesta a Peninsula', 'diego', '', 'C3'), ('Auditoría LeakAI para clínica', 'ona', '', 'C4'), ('Campaña LinkedIn Swarmix segundo toque', 'aina', '', 'C5'),
                 ('Landing de Licita producto', 'joana', '', 'D1'), ('Stripe de Regulia', 'marina', '', 'D2'), ('Contestia pricing', 'diego', '', 'D3'),
                 ('Alta en epígrafes IAE de telecos', 'ferran', '', 'E1'), ('Solvencia y facturación de NGA', 'teresa', '', 'E2'),
                 ('Relanzar la ventana tmux del agente', 'pol', '', 'E3'), ('Informe de las 7 desde HQ', 'chief', '', 'E4'), ('Firma de correo con la marca', 'mireia', '', 'E5')]
        for texto, resp, depto, esperado in casos:
            with self.subTest(texto=texto):
                self.assertEqual(m.clasificar(texto, resp, depto)[0], esperado)

    def test_fallback_por_responsable_y_departamento(self):
        self.assertEqual(m.clasificar('cosa sin palabras clave', 'guillem', ''), ('A3', 'responsable:guillem'))
        self.assertEqual(m.clasificar('cosa sin palabras clave', 'desconocido', 'grants'), ('B3', 'departamento:grants'))
        self.assertEqual(m.clasificar('cosa sin palabras clave', '', ''), (None, 'sin regla'))

    def test_orden_de_reglas_el_especifico_gana(self):
        self.assertEqual(m.clasificar('licitación: leer art. 76 del pliego', 'guillem', '')[0], 'A2')
        self.assertEqual(m.clasificar('landing de Licita producto', 'mireia', '')[0], 'D1')

    def test_departamento_canonico(self):
        self.assertEqual(m.depto_canonico('sales', 'A3'), 'licitaciones'); self.assertEqual(m.depto_canonico('bizdev', 'C5'), 'comercial')
        self.assertEqual(m.depto_canonico('', 'E4'), 'hq'); self.assertEqual(m.depto_canonico('grants', 'B1'), 'subvenciones')
