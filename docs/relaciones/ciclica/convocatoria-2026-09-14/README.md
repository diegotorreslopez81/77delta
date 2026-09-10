# Convocatòria Cíclica · dilluns 14-09-2026 12:00-12:30

Ordre de Diego (tarjeta 372, 10-09 nit): "Manda email convocatoria". Comunicació a tercer: surt entre 8 i 20h, o sigui divendres 11-09 a partir de les 09:00.

## Pla
1. **Via A (preferida):** Pol/Guillem renoven el consentiment OAuth de gdrive-pdata (diego@77delta.com, autoritzat per Diego a la 320) divendres a primera hora. Amb el token viu es crea l'esdeveniment al calendari de Diego amb Meet i convidats (joaquim.arcas@ciclica.eu); la invitació de Google ÉS la convocatòria. Aina no escriu res més.
2. **Via B (si a les 10:00 no hi ha token):** Aina envia `correu-aina.txt` des d'aina@77delta.com, en resposta al fil existent amb Joaquim, cc diego@77delta.com i els dos companys de Cíclica que Joaquim va posar en còpia, amb enllaç Jitsi `https://meet.jit.si/CiclicaNGA-2026-09-14` i el fitxer `invitacio.ics` adjunt.

Un sol emissor. Si surt la A, la B no s'envia (doble missatge del 9-sep).

## Decisió del chief (10-09 23:50)
- Surt divendres 11-09 (Diada). La regla de Jordi és per a correu comercial en fred a entitats catalanes; això és logística d'una reunió que Joaquim ha demanat ("a l'enllaç que ens digueu"). Esperar a dilluns = enllaç el mateix matí de la reunió. Jordi informat.
- Assistents: Joaquim + Ander Bilbao Figuero + Guillem Herrera (ciclica.eu) + Diego. Aina afegeix les dues línies ATTENDEE a invitacio.ics amb els correus exactes del fil i els posa en còpia.

## Estat a les 00:05 del 11-09 (Aina) · QUÈ JA ESTÀ FET

Si obres això divendres al matí, **els fitxers ja estan llestos i no cal editar res**:

- **`{{ENLLAC}}` ja NO existeix.** Substituït per `https://meet.jit.si/CiclicaNGA-2026-09-14` als
  dos fitxers, `invitacio.ics` i `correu-aina.txt`. No busquis el placeholder: no hi és.
- **`invitacio.ics` ja té els quatre assistents**: Joaquim, Diego, Ander Bilbao Figuero i Guillem
  Herrera. Els dos últims afegits amb els correus literals de les capçaleres del correu de Joaquim
  del 10-09 a les 08:41, **no construïts per patró**: `ander.bilbao@ciclica.eu` i
  `guillem.herrera@ciclica.eu`. Autoritzat per Marc i Jordi. Commit `c86085b`.
- **CRLF preservats** (editat en binari): 18 línies CRLF, cap solta. Un `.ics` amb salts Unix el
  rebutgen alguns clients i el fallada seria invisible fins que algú intentés afegir la cita.

### L'enllaç: què està comprovat i què no

Comprovat per API: **HTTP 200**, serveix l'aplicació de Jitsi (`JitsiMeetJS` present), **sense mur
de registre** ni missatge de sala invàlida, i el nom de sala no té cap caràcter problemàtic.

**No comprovat:** que la sala **obri** de veritat. Jitsi és una SPA i això necessita navegador; el
10-09 a la nit l'escriptori estava ocupat. Matís que baixa el risc: a `meet.jit.si` **les sales es
creen en entrar**, no existeixen abans, així que no hi ha res a pre-crear ni res que es pugui
"trencar" sol. Decisió de Marc: si divendres l'escriptori és lliure, es confirma en pantalla; si
no, **amb el 200 ja val**.

### Què queda per fer divendres

1. **Abans de les 09:00: res.** No surt cap comunicació.
2. **Si algú diu que l'OAuth està fet:** Aina **no escriu res**. La invitació de Google és la
   convocatòria. Qui la creï ha d'incloure **els tres** de Cíclica, no només Joaquim.
3. **Si a les 10:00 ningú ho ha dit:** via B. `correu-aina.txt` des d'`aina@77delta.com`, **en
   resposta al fil existent** amb Joaquim (`--reply-to` amb el seu X-GM-MSGID, perquè sigui fil de
   debò i no un "Re:" enganxat), amb `cc diego@77delta.com` + `ander.bilbao@ciclica.eu` +
   `guillem.herrera@ciclica.eu`, i `invitacio.ics` adjunt.
4. **Un sol emissor, mai els dos.**
