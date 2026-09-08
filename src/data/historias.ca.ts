/** Les tres històries d'èxit amb cas complet a /ca/historias-de-exito/<slug>/. Versió catalana de historias.ts. */
export interface Historia {
  slug: string;
  /** Xifra principal, partida per al comptador del titular. */
  cifra: { valor: number; sufijo: string };
  /** Etiqueta curta sota la xifra, per a la targeta de l'índex. */
  etiqueta: string;
  /** Resta del titular, darrere de la xifra. */
  titular: string;
  /** Qui és el client. */
  cliente: string;
  /** Sector al qual pertany, tal com es mostra. */
  sector: string;
  /** Una frase per a la targeta de l'índex. */
  resumen: string;
  /** Tres mètriques verificades, a la fila sota el titular. */
  metricas: { valor: string; etiqueta: string }[];
  situacion: string;
  solucion: string;
  como: string;
  resultados: string;
}

export const historias: Historia[] = [
  {
    slug: 'clinicas-dentales-barcelona',
    cifra: { valor: 38, sufijo: '%' },
    etiqueta: 'menys absències',
    titular: 'menys absències a consulta',
    cliente: 'Tres clíniques dentals a Barcelona',
    sector: 'Clíniques i salut',
    resumen:
      'Recepcionista virtual per WhatsApp en 4 setmanes. 22 hores setmanals alliberades i ROI en menys d’un mes.',
    metricas: [
      { valor: '18% → 11%', etiqueta: 'taxa d’absències' },
      { valor: '22h/set', etiqueta: 'alliberades a recepció' },
      { valor: 'Menys d’1 mes', etiqueta: 'ROI total' },
    ],
    situacion:
      'Un grup de tres clíniques dentals a Barcelona compartia el mateix problema: el 18% dels pacients no acudia a les cites sense avís previ. La recepció comptava amb tres persones dedicades a les confirmacions telefòniques, però el ràtio de localització era baix i els forats quedaven sense cobrir.',
    solucion:
      'Vam implantar Contestia, la nostra recepcionista virtual per WhatsApp. El bot envia confirmació 24h abans amb detall de la visita, gestiona canvis proposant alternatives segons agenda real, allibera el forat si el pacient cancel·la i avisa la llista d’espera, i escala a l’equip humà només en casos clínics sensibles. Integrat amb Google Calendar i la fitxa de pacient.',
    como: 'Quatre setmanes. Setmana 1: auditoria de trucades perdudes i mapatge dels 12 escenaris habituals. Setmana 2: pilot a la clínica principal amb volum controlat. Setmana 3: integració amb calendari i fitxa de pacient. Setmana 4: desplegament a les dues clíniques restants.',
    resultados:
      'Tres mesos després del desplegament: taxa d’absències del 18% a l’11%. La recepció va recuperar 22 hores setmanals (equivalent a mitja jornada d’una persona) que es van redirigir a atenció presencial, gestió de pressupostos i captació. La satisfacció del pacient va pujar 0,8 punts sobre 10. La inversió es va amortitzar en menys d’un mes.',
  },
  {
    slug: 'distribuidora-industrial',
    cifra: { valor: 2, sufijo: 'h' },
    etiqueta: 'recuperades / comercial · dia',
    titular: 'recuperades per comercial al dia',
    cliente: 'Distribuïdora industrial amb 12 comercials',
    sector: 'Distribució i logística',
    resumen:
      'Assistent automàtic a WhatsApp per a recepció de comandes. +25% de capacitat de gestió sense augmentar plantilla.',
    metricas: [
      { valor: '2h/dia', etiqueta: 'per comercial' },
      { valor: '+25%', etiqueta: 'capacitat sense nova plantilla' },
      { valor: '0 errors', etiqueta: 'de transcripció' },
    ],
    situacion:
      'Una distribuïdora de material industrial amb 12 comercials rebia comandes per WhatsApp, trucada i correu. Els comercials dedicaven les dues primeres hores del dia a introduir manualment les comandes a l’ERP. Més del 50% de la jornada es consumia en tasques administratives, no en venda.',
    solucion:
      'Vam connectar un assistent automatitzat al número principal de WhatsApp. El sistema identifica el client per número i CIF, reconeix les referències del catàleg, verifica estoc i preu en temps real, genera la comanda a l’ERP i notifica el comercial responsable. El comercial intervé únicament en casos d’excepció: client nou, producte fora de catàleg o validació de descompte especial.',
    como: 'Sis setmanes. Anàlisi dels patrons de comanda habitual, connexió amb l’ERP, entrenament de l’assistent amb catàleg complet i nomenclatura de client, validació d’estoc i preu en temps real, desplegament progressiu client a client amb supervisió.',
    resultados:
      'Cada comercial va recuperar entre 90 minuts i 2 hores diàries. La capacitat de gestió de comandes va augmentar un 25% sense augmentar plantilla. Els errors de transcripció manual van desaparèixer. Els comercials dediquen aquestes hores a venda proactiva i atenció de clients premium.',
  },
  {
    slug: 'despacho-mercantil',
    cifra: { valor: 20, sufijo: 'h' },
    etiqueta: 'alliberades / soci · mes',
    titular: 'alliberades per soci sènior al mes',
    cliente: 'Despatx de dret mercantil de 18 professionals',
    sector: 'Despatxos professionals',
    resumen:
      'Generador de contractes sobre plantilles pròpies. Temps de resposta a client de 3 dies a 6 hores.',
    metricas: [
      { valor: '20h/mes', etiqueta: 'per soci sènior' },
      { valor: '3 dies → 6h', etiqueta: 'temps de resposta a client' },
      { valor: '5 plantilles', etiqueta: 'sistematitzades' },
    ],
    situacion:
      'Un despatx de dret mercantil amb 18 professionals redactava reiteradament contractes similars. Cada soci sènior dedicava entre 4 i 6 hores setmanals a revisar i redactar contractes que, en essència, eren variacions de cinc plantilles. Temps que no facturava a tarifa premium i que retardava el lliurament a clients urgents.',
    solucion:
      'Vam desenvolupar un generador de contractes basat en les plantilles del despatx. L’advocat respon a un qüestionari estructurat i el sistema lliura el contracte preparat per a revisió. La cerca intel·ligent sobre l’arxiu històric permet recuperar precedents en segons. El control sempre queda en el soci que signa.',
    como: 'Vuit setmanes. Anàlisi dels cinc tipus de contracte més freqüents, sistematització de les variables clau, entrenament amb arxiu històric anonimitzat, validació amb casos reals de l’últim semestre, desplegament progressiu amb sessions de calibratge.',
    resultados:
      'Cada soci sènior recupera aproximadament 20 hores mensuals, redirigides a casos de més valor o a desenvolupament de negoci. El temps mitjà de resposta a clients en contractes estàndard va passar de 3 dies a 6 hores. La satisfacció del client final va millorar notablement.',
  },
];
