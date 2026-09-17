import { aufgabentextFalten } from './aufgabentext.ts';
/*
 * **Ein Import aus client/ in einem Modul, das auch der Server lädt** — und das
 * trägt, weil `datumLang` nichts Browserhaftes tut: es formatiert über `Intl`
 * mit fester Zone. Der Ordnername sagt, wo die Datumsformen **wohnen**, nicht
 * wer sie rufen darf; sie sind die eine Datumsform dieses Produkts, und eine
 * zweite Rechnung für die Traktandenliste schriebe in der Datei ein anderes
 * Datum als auf der Seite daneben steht.
 */
import { datumLang } from './client/utils/date.ts';

/*
 * Was ein Traktandum und was ein Protokoll ist — **die eine Stelle**, an der
 * das steht.
 *
 * Drei Leser derselben Regeln:
 *
 *   1. die actions auf /sitzungen — sie nehmen eine Eingabe an oder weisen ab;
 *   2. die Seite /sitzungen — sie zeigt dieselben Grenzen am Feld, damit der
 *      Browser abfängt, was sonst erst die action abwiese;
 *   3. scripts/smoke-zugang.ts — es prüft beide gegen dieselben Konstanten.
 *
 * Das Modul liegt in src/lib/ und nicht unter client/ oder server/: beide
 * Seiten lesen es. Es hängt nur von ./aufgabentext.ts ab, damit
 * ../routes/sitzungen/+page.server.ts es über nacktes Node laden kann
 * (scripts/smoke-zugang.ts tut genau das) — dieselbe Bauform wie ./ernte.ts.
 */

/**
 * Die Längengrenze eines Traktandums, in **Codepoints**.
 *
 * Dieselbe Zahl wie AUFGABE_HOECHSTLAENGE und nicht die 60 einer Kultur: ein
 * Traktandum ist ein Satz und kein Name — `Wasseranschluss beim oberen Beet
 * reparieren lassen, Offerte liegt vor` braucht 76. Was es **nicht** sein soll,
 * ist ein Absatz: die Liste geht an eine Sitzung, und wer dort vorliest, liest
 * einen Satz vor.
 */
export const TRAKTANDUM_HOECHSTLAENGE = 200;

export const TRAKTANDUM_FEHLT = 'Schreib hin, was besprochen werden soll.';

export const TRAKTANDUM_ZU_LANG = `Das ist zu lang für ein Traktandum. Höchstens ${TRAKTANDUM_HOECHSTLAENGE} Zeichen.`;

/**
 * Das fehlende oder unlesbare Sitzungsdatum.
 *
 * **Ein Satz für vier Zustände** — Feld fehlt, Feld leer, keine Form
 * `JJJJ-MM-TT`, unmögliches Datum wie `2026-02-31` —, aus demselben Grund wie
 * bei DATUM_FEHLT in ./texte.ts: jede Unterscheidung wäre eine Auskunft ohne
 * Handlung.
 *
 * Er steht hier und nicht dort, weil er etwas anderes sagt: `Wähle ein Datum,
 * bis zu dem die Aufgaben erledigt sein sollen` ist eine Frist, dies ist ein
 * Termin. Dieselbe Trennung, die /einzelaufgabe schon macht.
 */
export const SITZUNGSDATUM_FEHLT = 'Wähle das Datum der Sitzung.';

/**
 * Das Traktandum, das keine Zeile trifft.
 *
 * **Ein Satz für drei Zustände** — keine Kennung im Formular, keine Zahl, keine
 * Zeile dazu —, dieselbe Form und dieselbe Begründung wie
 * AUFGABE_NICHT_ANSPRECHBAR in ./texte.ts: jede Unterscheidung wäre eine
 * Auskunft darüber, welche Kennungen es gibt.
 *
 * Er steht hier und nicht dort, weil er eine Sache dieser Seite ist — wie
 * ERNTEZEILE_NICHT_ANSPRECHBAR, das aus demselben Grund in ./ernte.ts steht.
 */
export const TRAKTANDUM_NICHT_ANSPRECHBAR =
	'Dieses Traktandum gibt es nicht mehr. Lade die Seite neu.';

/**
 * Die leere Sammlung, aus der jemand eine Liste ziehen will.
 *
 * Der Satz nennt die Handlung, die fehlt, und nicht den Zustand: `Keine
 * Traktanden` sagte dasselbe und liesse offen, was zu tun ist.
 */
export const TRAKTANDEN_LEER =
	'Es steht nichts an. Schreib zuerst auf, was besprochen werden soll.';

/**
 * Die Höchstgrösse eines Protokolls, in Bytes.
 *
 * Zehn Megabyte, und die Zahl ist gemessen an dem, was sie durchlassen soll:
 * ein getipptes Protokoll von vier Seiten wiegt als PDF unter 200 KB, ein
 * eingescanntes mit Unterschriften ein paar Megabyte. Die Grenze fängt darum
 * nicht das Protokoll ab, sondern das versehentlich hochgeladene Fotoalbum —
 * und sie hält die Ablage auf einem VPS light in einer Grössenordnung, die eine
 * Sicherung noch verkraftet.
 *
 * **Sie steht zusätzlich in der Route und nicht nur hier**: ein `maxlength` am
 * Feld gibt es für eine Datei nicht, der Browser prüft nichts, und die Grenze
 * muss darum in der action greifen, nachdem die Bytes schon angekommen sind.
 */
export const PROTOKOLL_HOECHSTGROESSE = 10 * 1024 * 1024;

/** Dieselbe Zahl in Megabyte, für den Satz und für die Seite. */
export const PROTOKOLL_HOECHSTGROESSE_MB = PROTOKOLL_HOECHSTGROESSE / (1024 * 1024);

export const PROTOKOLL_FEHLT = 'Wähle die PDF-Datei des Protokolls.';

/**
 * Keine PDF-Datei.
 *
 * Der Satz nennt den **Grund** und nicht die Prüfung: welcher Medientyp gemeldet
 * wurde, hilft niemandem. Warum überhaupt nur PDF, steht an `istPdf` unten.
 */
export const PROTOKOLL_KEIN_PDF = 'Das ist keine PDF-Datei. Protokolle werden als PDF abgelegt.';

export const PROTOKOLL_ZU_GROSS = `Diese Datei ist grösser als ${PROTOKOLL_HOECHSTGROESSE_MB} MB. Speichere das Protokoll kleiner ab.`;

/**
 * Prüft ein Traktandum: gefaltet, nicht leer, nicht zu lang.
 *
 * Gefaltet wird mit aufgabentextFalten — dieselbe Kette wie bei einem
 * Aufgabensatz, einem Blatttitel und einer Kultur, und aus demselben Grund:
 * erst die unsichtbaren Zeichen weg, dann Leerraum zusammenziehen, dann
 * trimmen. Umgekehrt bliebe eine Folge aus unsichtbaren Zeichen ein
 * nichtleerer „Satz".
 */
export function traktandumPruefen(eingabe: string): { text: string } | { fehler: string } {
	const text = aufgabentextFalten(eingabe);
	if (text === '') return { fehler: TRAKTANDUM_FEHLT };
	// Nach Codepoints gezählt, nicht nach UTF-16-Einheiten — wie überall in
	// dieser Kette. [...text] zerlegt in Codepoints.
	if ([...text].length > TRAKTANDUM_HOECHSTLAENGE) return { fehler: TRAKTANDUM_ZU_LANG };
	return { text };
}

/**
 * Die ersten Bytes einer PDF-Datei: `%PDF-`.
 *
 * **Gelesen wird der Inhalt und nicht der gemeldete Typ.** Der `type` eines
 * hochgeladenen Objekts kommt aus dem Browser, der ihn aus der Dateiendung
 * rät — er lässt sich von einem selbstgebauten Aufruf frei setzen, und eine
 * Prüfung darauf wäre eine Frage an die Person, die man gerade prüfen will.
 * Diese fünf Bytes stehen in jeder PDF-Datei an ihrem Anfang.
 *
 * **Sie sind keine Sicherheitsschranke, und das ist ausgeschrieben**, damit es
 * niemand dafür hält: wer will, hängt sie vor beliebige Bytes. Was sie
 * verlässlich abfängt, ist der Fehlgriff — das Word-Dokument, das Foto vom
 * Flipchart. Dagegen, dass die abgelegte Datei im Browser der lesenden Person
 * etwas ausführt, hilft nicht dieser Vergleich, sondern wie die Ausgabe sie
 * ausliefert: fester Content-Type und `Content-Disposition: attachment`, siehe
 * ../routes/sitzungen/[id]/+server.ts.
 */
const PDF_KENNUNG = '%PDF-';

/** Sagt, ob diese Bytes mit der PDF-Kennung beginnen. */
export function istPdf(bytes: Uint8Array): boolean {
	if (bytes.length < PDF_KENNUNG.length) return false;
	for (let i = 0; i < PDF_KENNUNG.length; i += 1) {
		if (bytes[i] !== PDF_KENNUNG.charCodeAt(i)) return false;
	}
	return true;
}

/**
 * Die Traktandenliste als Text, so wie sie in der Ablage liegt.
 *
 * **Die eine Stelle, an der aus der Sammlung ein Dokument wird** — seit dem
 * 2026-09-17. Sie steht hier und nicht in der action, weil sie eine Auslegung
 * ist und keine Ablaufsteuerung: was auf einer Traktandenliste steht und in
 * welcher Ordnung, ist dieselbe Art Entscheidung wie die Längengrenze darüber,
 * und scripts/smoke-zugang.ts prüft sie hier gegen dieselben Eingaben, mit denen
 * die action sie füttert.
 *
 * **Reiner Text und keine PDF.** Eine PDF verlangte eine Bibliothek, die dieses
 * Projekt nicht hat und für ein Dokument aus fünf Zeilen auch nicht bekommen
 * sollte; was hier entsteht, lässt sich lesen, ausdrucken, in eine Mail kopieren
 * und in zehn Jahren noch öffnen. Die Protokolle daneben bleiben PDF, weil sie
 * von aussen kommen und unterschrieben sind.
 *
 * **Kein Sitzungsdatum** (Entscheid Manuel): die Liste trägt den Tag, an dem sie
 * gezogen wurde, und sonst keinen. Wann die Sitzung stattfindet, weiss die
 * Einladung — dieses Werkzeug verwaltet keine Sitzungstermine, und ein Feld
 * dafür stellte eine Frage, die beim Aufschreiben eines Punktes niemand
 * beantworten kann.
 *
 * Die Herkunft steht an jedem Punkt, in derselben Fassung wie auf der Seite:
 * `Name · Datum`. Wer am Tisch sitzt und einen Punkt nicht versteht, sieht,
 * wen er fragen kann.
 *
 * @param punkte In der Ordnung, in der sie auf der Seite stehen — zuerst
 *   Aufgeschriebenes zuoberst. Diese Funktion sortiert **nicht**: zwei
 *   Ordnungen über derselben Liste liefen auseinander, und die der Abfrage ist
 *   die, die alle sehen.
 * @param gezogenAm Der Zeitpunkt in Unix-**Sekunden**.
 */
export function traktandenlisteSchreiben(
	punkte: readonly { text: string; name: string | null; createdAt: number }[],
	gezogenAm: number
): string {
	const kopf = `Traktanden\nGezogen am ${datumLang(gezogenAm)}\n`;
	/*
	 * Nummeriert, weil an einer Sitzung jemand sagt „zum dritten Punkt" — eine
	 * Liste mit Strichen zwingt dazu, mit dem Finger mitzuzählen. Die Zahl steht
	 * an der ersten Zeile, die Herkunft eingerückt darunter; ein Punkt ohne
	 * Namen kann nur aus einem Eingriff von Hand an der Datenbank stammen und
	 * wird wie auf der Seite als `unbekannt` geschrieben.
	 */
	const zeilen = punkte.map(
		(punkt, stelle) =>
			`${stelle + 1}. ${punkt.text}\n   ${punkt.name ?? 'unbekannt'} · ${datumLang(punkt.createdAt)}`
	);
	/*
	 * Der abschliessende Umbruch ist kein Zierrat: eine Textdatei ohne ihn endet
	 * mitten in der Zeile, und mancher Editor hängt beim nächsten Öffnen still
	 * einen an — dann unterscheidet sich die Datei von dem, was hier stand.
	 */
	return `${kopf}\n${zeilen.join('\n\n')}\n`;
}
