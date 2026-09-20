import { AUFGABE_HOECHSTLAENGE, aufgabentextFalten } from './aufgabentext.ts';

/*
 * Die Regeln für ein abgelegtes Dokument — seit dem 2026-09-20.
 *
 * **Geteiltes Modul und keine Prüfung in der Route**, dieselbe Bauform und
 * derselbe Grund wie ./blatttext.ts: die Sätze haben zwei Leser — die action
 * auf /wissen, die ablegt, und `scripts/smoke-zugang.ts`, die sie gegen
 * dieselbe Eingabe hält. Eine Route, die selbst deutete, wäre die zweite
 * Wahrheit über dieselbe Regel.
 *
 * **Kein Server-Import hier drin.** Dieses Modul kennt weder `node:fs` noch die
 * Datenbank; es deutet Eingaben und sonst nichts. Was auf die Platte schreibt,
 * steht in ./server/ablage.ts, und die Trennung ist nicht Geschmack: diese
 * Datei wird von der Komponente mitgeladen (die Grenzen stehen am Feld), und
 * ein `node:fs` darin zöge die halbe Serverschicht in das Bündel für den
 * Browser.
 */

/**
 * Der Titel fehlt. Derselbe Bau wie BLATT_TITEL_FEHLT, mit einem eigenen
 * zweiten Satz: bei einem Blatt ist der Titel das Erste, was jemand tippt, bei
 * einem Dokument das Zweite — die Datei ist schon gewählt, und der Satz sagt,
 * dass ihr Name dafür nicht genügt.
 */
export const DOKUMENT_TITEL_FEHLT =
	'Gib dem Dokument einen Titel. Der Dateiname allein sagt in der Liste zu wenig.';

/** Wie bei einem Blatt: ein Titel ist eine Zeile, kein Absatz. */
export const DOKUMENT_TITEL_ZU_LANG = `Das ist zu lang für einen Titel. Höchstens ${AUFGABE_HOECHSTLAENGE} Zeichen.`;

/** Es wurde keine Datei gewählt — oder das Feld kam ohne Inhalt an. */
export const DOKUMENT_DATEI_FEHLT = 'Wähle eine PDF-Datei aus.';

/**
 * Die Obergrenze für eine abgelegte Datei, in Bytes.
 *
 * **Zwanzig Megabyte, und die Zahl ist eine Auslegung und keine Eigenschaft des
 * Formats.** Ein gescanntes Merkblatt aus dem Kopierer liegt bei zwei bis fünf,
 * ein Datenblatt mit Bildern selten über zehn. Zwanzig lässt den schlecht
 * gescannten Fall durch und stoppt das versehentlich hochgeladene Fotoalbum.
 *
 * Die Grenze ist zugleich die Schranke gegen den Speicher: eine Datei wird beim
 * Ablegen **ganz** in den Arbeitsspeicher gelesen (siehe ./server/ablage.ts),
 * und ohne Grenze entschiede die Gegenseite, wie viel davon sie belegt.
 */
export const DOKUMENT_HOECHSTGROESSE = 20 * 1024 * 1024;

/** Dieselbe Zahl, wie sie im Satz und am Feld steht. */
export const DOKUMENT_HOECHSTGROESSE_MB = DOKUMENT_HOECHSTGROESSE / (1024 * 1024);

/** Die Datei ist zu gross. */
export const DOKUMENT_ZU_GROSS = `Die Datei ist zu gross. Höchstens ${DOKUMENT_HOECHSTGROESSE_MB} MB.`;

/**
 * Es ist kein PDF.
 *
 * **Ein Satz für beide Wege der Erkennung** — die Endung und der Inhalt. Wer
 * eine `.docx` wählt, und wer eine `.pdf` wählt, die keine ist, liest dasselbe:
 * die Unterscheidung wäre eine Auskunft über die Prüfung und keine über die
 * Handlung, die hilft.
 */
export const DOKUMENT_KEIN_PDF =
	'Das ist keine PDF-Datei. Andere Formate legt dieser Garten nicht ab.';

/**
 * Der Medientyp, den diese Anwendung ablegt und ausliefert — genau einer.
 *
 * **Nur PDF, und das ist der Umfang** (Entscheid Manuel, 2026-09-20). Ein
 * Merkblatt, ein Datenblatt, eine Anleitung: das ist, was in einem Garten
 * herumliegt und aufbewahrt werden will. Jedes weitere Format bringt seine
 * eigene Frage mit — ein Bild will eine Vorschau, eine Tabelle einen Betrachter,
 * ein Word-Dokument einen Konverter —, und keine davon beantwortet diese
 * Anwendung.
 *
 * Die Enge ist zugleich die Sicherheit: eine ausgelieferte Datei mit frei
 * wählbarem Typ ist der klassische Weg, in einer Anwendung fremdes HTML oder
 * SVG zur Ausführung zu bringen. Ein PDF liefert der Browser in seinen eigenen
 * Betrachter, nicht in den Ursprung dieser Seite.
 */
export const PDF_TYP = 'application/pdf';

/**
 * Die ersten Bytes jeder PDF-Datei: `%PDF-`.
 *
 * **Geprüft wird der Inhalt und nicht bloss der Typ, den der Browser meldet.**
 * Jener kommt aus der Endung des Dateinamens und ist damit eine Behauptung der
 * Gegenseite — `schaedling.exe` in `merkblatt.pdf` umbenannt reist mit
 * `application/pdf` an. Die fünf Bytes sind keine Virenprüfung und geben sich
 * auch nicht dafür aus; sie stellen sicher, dass in der Ablage liegt, was die
 * Zeile daneben behauptet.
 */
const PDF_ANFANG = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);

/**
 * Der Titel, wie er in die Datenbank geht — oder der Satz, warum nicht.
 *
 * Dieselbe Faltung wie bei einem Blatt-Titel: ein Titel ist einzeilig.
 */
export function dokumentTitelPruefen(eingabe: string): { titel: string } | { fehler: string } {
	const titel = aufgabentextFalten(eingabe);
	if (titel === '') return { fehler: DOKUMENT_TITEL_FEHLT };
	// Nach Codepoints wie überall in dieser Kette.
	if ([...titel].length > AUFGABE_HOECHSTLAENGE) return { fehler: DOKUMENT_TITEL_ZU_LANG };
	return { titel };
}

/**
 * Der Dateiname, entschärft — **nie** ein Pfad und nie leer.
 *
 * Was hier passiert, ist ausdrücklich **keine** Wahl des Speicherorts: unter
 * diesem Namen wird nichts geschrieben. Die Ablage vergibt einen eigenen Namen
 * aus Zufall (siehe `documents.ablage` im Schema). Dieser hier steht an der
 * Detailseite und im `Content-Disposition` des Downloads, und beides sind
 * Stellen, an denen ein Pfadtrenner oder ein Steuerzeichen Unsinn anrichtet.
 *
 * Drei Schritte, und jeder hat seinen Fall:
 *   1. **Alles bis zum letzten Trenner weg.** Der Internet Explorer schickte
 *      einst den ganzen Pfad, und manche Automaten tun es bis heute. Aus
 *      `C:\\Ablage\\merkblatt.pdf` wird `merkblatt.pdf`.
 *   2. **Steuerzeichen weg.** Ein Zeilenumbruch in einem `Content-Disposition`
 *      ist eine eingeschleuste Kopfzeile; dass die Auslieferung den Namen
 *      zusätzlich kodiert, macht diesen Schritt nicht überflüssig, sondern zur
 *      zweiten von zwei unabhängigen Sicherungen.
 *   3. **Leerraum zusammen und aussen weg**, wie bei jedem anderen Text dieser
 *      Anwendung.
 *
 * Bleibt danach nichts übrig, steht `dokument.pdf` da: ein Name, den niemand
 * gewählt hat, ist besser als keiner — der Browser speicherte sonst unter dem
 * letzten Stück der Adresse.
 */
export function dateinamenFalten(eingabe: string): string {
	const ohnePfad = eingabe.split(/[\\/]/).at(-1) ?? '';
	// eslint-disable-next-line no-control-regex -- genau darum geht es hier
	const ohneSteuerzeichen = ohnePfad.replace(/[\u0000-\u001f\u007f]/g, '');
	const gefaltet = aufgabentextFalten(ohneSteuerzeichen);
	return gefaltet === '' ? 'dokument.pdf' : gefaltet;
}

/**
 * Ob die ersten Bytes die einer PDF-Datei sind.
 *
 * Nimmt die Bytes und nicht die Datei: so lässt sich die Regel prüfen, ohne
 * eine Datei anzulegen, und `scripts/smoke-zugang.ts` tut genau das.
 */
export function istPdfAnfang(bytes: Uint8Array): boolean {
	if (bytes.length < PDF_ANFANG.length) return false;
	return PDF_ANFANG.every((byte, stelle) => bytes[stelle] === byte);
}

/**
 * Eine Grösse in Bytes als Satz, wie er an der Zeile steht.
 *
 * **Kibibyte und Mebibyte, benannt als KB und MB.** Die Rechnung mit 1024 ist
 * die, die jedes Betriebssystem im Dateidialog zeigt; die Schreibweise `KiB`
 * wäre genauer und stünde in einer Gartenanwendung als Fremdkörper da.
 *
 * Eine Nachkommastelle ab einem Megabyte, darunter keine: `1.4 MB` ist eine
 * Auskunft, `1.4 KB` ist Rauschen.
 */
export function groesseAlsSatz(bytes: number): string {
	if (bytes < 1024) return `${bytes} Bytes`;
	if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
