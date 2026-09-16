#!/usr/bin/env python3
"""Barrido de encargos parados (HQ v2, T15). Cron a las 7:00 y 15:00.
en_curso sin avance 48 h -> tmux-decir al responsable; 72 h -> escalado a tmux-decir Jordi-COO.
Lee HQ con HQ_OWNER_TOKEN (~/.config/77delta/hq.env), solo lectura: este cron no escribe nada en HQ
(ni avances ni cambios de estado), solo avisa por tmux-decir y guarda su propio registro de estado en
~/.config/77delta/hq-parados.json para no repetir el mismo aviso en menos de 24 h.
Uso: hq-parados.py [--dry-run] [--horas-aviso 48] [--horas-escalado 72]
"""
import argparse, json, os, pathlib, subprocess, sys
from datetime import datetime, timedelta, timezone

HQ = pathlib.Path(__file__).resolve().parent / 'hq.py'
ESTADO = pathlib.Path.home() / '.config/77delta/hq-parados.json'
sys.path.insert(0, str(HQ.parent))
os.environ.setdefault('HQ_ENGRAM_OFF', '1')
import hq  # noqa: E402  (hq.py expone rpc() y env(); E = env() se ejecuta al importar, sin efectos de red)


def _fecha(v):
    if not v: return None
    d = datetime.fromisoformat(v.replace('Z', '+00:00'))
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def clasificar_parados(encargos, ahora, umbral_aviso_h=48, umbral_escalado_h=72):
    """Devuelve {'avisar': [...], 'escalar': [...]} con los encargos en_curso sin avance desde hace mas de N horas."""
    avisar, escalar = [], []
    for e in encargos:
        if e.get('estado') != 'en_curso': continue
        ultimo = _fecha(e.get('fecha_avance')) or _fecha(e.get('fecha'))
        if not ultimo: continue
        horas = (ahora - ultimo).total_seconds() / 3600
        e = dict(e, horas_parado=int(horas))
        if horas >= umbral_escalado_h: escalar.append(e)
        elif horas >= umbral_aviso_h: avisar.append(e)
    return {'avisar': avisar, 'escalar': escalar}


def toca_avisar(clave, tipo, estado, ahora, cada_h=24):
    ultimo = _fecha((estado.get(str(clave)) or {}).get(tipo))
    return not ultimo or (ahora - ultimo) >= timedelta(hours=cada_h)


def ventana_de(agente, agentes):
    """Nombre de ventana tmux (primera sesion registrada) del responsable de un encargo, o None."""
    for a in agentes:
        if agente and (a['id'].lower() in agente.lower() or a['nombre'].lower() in agente.lower()):
            return (a.get('sesiones') or [None])[0]
    return None


def destino_aviso(agente, agentes):
    """(ventana, directo) para el aviso de 48 h: la ventana del responsable si se encuentra
    (directo=True), o Jordi-COO si el agente no casa con ninguna ventana registrada (directo=False,
    caso real encargo #75 'DevOps (alta hoy) + Pol'): sin esto un tmux-decir a None se queda mudo y
    el encargo se marca avisado igualmente, un aviso fantasma."""
    v = ventana_de(agente, agentes)
    return (v, True) if v else ('Jordi-COO', False)


def decir(ventana, texto, dry):
    if dry: print(f'[dry] tmux-decir {ventana}: {texto}'); return
    subprocess.run(['tmux-decir', ventana, texto], check=False)


TOPE_LINEAS = 25


def agrupar_escalados(lista):
    """Un unico mensaje para Jordi-COO con todos los escalados (>=72 h): cabecera con el total y una
    linea por encargo, con un tope de TOPE_LINEAS lineas y '... y M mas' si sobran. Antes cada encargo
    escalado disparaba su propio tmux-decir: en produccion salieron 52 seguidos en la misma corrida y
    saturaron la ventana de Jordi-COO. Lista vacia -> cadena vacia (nada que enviar)."""
    if not lista:
        return ''
    lineas = [f"#{e['id']} {e.get('agente') or '-'} {e['horas_parado']}h: {e['texto'][:60]}" for e in lista]
    cuerpo = lineas[:TOPE_LINEAS]
    if len(lineas) > TOPE_LINEAS:
        cuerpo.append(f"... y {len(lineas) - TOPE_LINEAS} mas")
    cabecera = f"[HQ parados] {len(lista)} encargos sin avance 72 h o mas"
    return cabecera + '\n' + '\n'.join(cuerpo)


def agrupar_avisos(lista, agentes):
    """Agrupa los avisos de 48 h por la TUPLA (ventana, directo), no solo por ventana: un agente con
    ventana propia (caso real encargo #204, agente 'coo' -> ventana literal 'Jordi-COO', directo=True)
    puede compartir el mismo destino de tmux que los encargos sin ventana reconocible (directo=False,
    tambien enrutados a 'Jordi-COO' de forma fija, caso #75). Agrupar solo por ventana mezclaba ambos
    casos en un unico grupo y usaba el 'directo' del primer encargo insertado para formatear TODas las
    lineas: un aviso directo a un responsable real podia salir con el texto 'sin ventana', que es falso.
    Con la clave (ventana, directo) cada grupo conserva su propio 'directo' y su propia cabecera; si
    ambos casos comparten ventana, se generan dos mensajes tmux-decir distintos a esa misma ventana, uno
    por cada cabecera, en vez de mezclarlos. Devuelve {(ventana, directo): texto}."""
    grupos = {}
    for e in lista:
        clave = destino_aviso(e.get('agente'), agentes)
        grupos.setdefault(clave, []).append(e)
    salida = {}
    for (ventana, directo), items in grupos.items():
        if directo:
            lineas = [f"#{e['id']} {e['horas_parado']}h: {e['texto'][:60]}" for e in items]
            cabecera = f"[HQ parados] {len(items)} encargo(s) tuyos sin avance 48 h o mas"
        else:
            lineas = [f"#{e['id']} sin ventana para {e.get('agente')} ({e['horas_parado']}h): {e['texto'][:60]}" for e in items]
            cabecera = f"[HQ parados] {len(items)} encargo(s) sin ventana de agente, sin avance 48 h o mas. Reclama."
        cuerpo = lineas[:TOPE_LINEAS]
        if len(lineas) > TOPE_LINEAS:
            cuerpo.append(f"... y {len(lineas) - TOPE_LINEAS} mas")
        salida[(ventana, directo)] = cabecera + '\n' + '\n'.join(cuerpo)
    return salida


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--dry-run', action='store_true'); ap.add_argument('--horas-aviso', type=int, default=48); ap.add_argument('--horas-escalado', type=int, default=72)
    a = ap.parse_args(); ahora = datetime.now(timezone.utc)
    owner = hq.E.get('HQ_OWNER_TOKEN') or sys.exit('falta HQ_OWNER_TOKEN en hq.env (solo lectura)')
    try:
        encargos = hq.rpc('omc_encargos_lista', p_token=owner)  # sin filtros: clasificar_parados se queda con los en_curso
        agentes = hq.rpc('omc_hq', p_token=owner)['agentes']
    except Exception as ex:
        sys.exit(f'HQ no responde: {type(ex).__name__}')
    estado = json.loads(ESTADO.read_text()) if ESTADO.exists() else {}
    r = clasificar_parados(encargos, ahora, a.horas_aviso, a.horas_escalado)
    avisos = [e for e in r['avisar'] if toca_avisar(e['id'], 'avisado', estado, ahora)]
    escalados = [e for e in r['escalar'] if toca_avisar(e['id'], 'escalado', estado, ahora)]
    grupos = agrupar_avisos(avisos, agentes)
    for (ventana, _), texto in grupos.items():
        decir(ventana, texto, a.dry_run)
    for e in avisos:
        estado.setdefault(str(e['id']), {})['avisado'] = ahora.isoformat()
    texto_escalados = agrupar_escalados(escalados)
    if texto_escalados:
        decir('Jordi-COO', texto_escalados, a.dry_run)
    for e in escalados:
        estado.setdefault(str(e['id']), {})['escalado'] = ahora.isoformat()
    print(f"parados: {len(avisos)} avisados en {len(grupos)} mensaje(s), {len(escalados)} escalados en {1 if texto_escalados else 0} mensaje(s), {sum(1 for e in encargos if e['estado'] == 'en_curso')} en curso")
    if not a.dry_run:
        ESTADO.parent.mkdir(parents=True, exist_ok=True); ESTADO.write_text(json.dumps(estado, indent=1)); ESTADO.chmod(0o600)


if __name__ == '__main__':
    main()
