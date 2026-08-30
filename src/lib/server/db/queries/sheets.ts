import { asc, eq, sql } from 'drizzle-orm';
import { datenbank } from '../index.ts';
import { sheets, type NewSheet } from '../schema.ts';

/*
 * Das Repository für sheets. Die Routen benutzen ausschliesslich diese
 * benannten Funktionen — kein Drizzle-Aufruf entsteht inline in einer
 * Routendatei (AD-1, Gate-Regel 9).
 *
 * Alles synchron: better-sqlite3 gibt Werte direkt zurück.
 *
 * **Die kürzeste Datei dieser Schicht, und zwar aus einem Grund.** Die
 * Nachbarmodule tragen ihre Länge, weil sie eine Regel durchsetzen, die nicht
 * im Schema steht: ./signup-tasks.ts entscheidet an einer Stelle, wann eine
 * Zeile **frei** ist; ./tasks.ts, wann eine **offen** ist; ./members.ts, welche
 * Spalten eine load verlassen dürfen. Ein Blatt hat keinen solchen Zustand — es
 * gibt keine Sichtbarkeit, keine Zuständigkeit und keine Spalte, die
 * zurückgehalten werden müsste. Was fehlt, fehlt nicht aus Eile.
 */

/**
 * Ein Blatt in der Liste: **nur** Kennung und Titel.
 *
 * Die Liste auf /wissen zeigt Titel und sonst nichts, und der Freitext eines
 * Blatts kann achttausend Zeichen tragen. Ihn für zwanzig Zeilen mitzulesen und
 * dann in der Komponente wegzuwerfen wäre nicht bloss Verschwendung — er stünde
 * in den Seitendaten und damit im ausgelieferten HTML jeder Listenansicht.
 * Dieselbe Bauform wie die Projektionen der Nachbarmodule, mit einer anderen
 * Begründung: dort geht es um eine Spalte, die niemand sehen **darf**, hier um
 * eine, die niemand an dieser Stelle **braucht**.
 */
export type Blattzeile = {
	id: number;
	titel: string;
};

/**
 * Ein ganzes Blatt, wie die Einzelansicht es sieht.
 *
 * `createdAt` reist **nicht** mit: keine Ansicht zeigt es, und ein Zeitpunkt in
 * den Seitendaten wäre der erste Schritt zu einem „zuletzt geändert", das diese
 * Story ausdrücklich nicht baut (siehe die Begründung an der Tabelle).
 */
export type Blatt = {
	id: number;
	titel: string;
	text: string;
};

/*
 * Die Ordnung der Liste: **der Titel**.
 *
 * Nicht die Zeit, und das ist die Entscheidung. Der Pool ordnet nach
 * `created_at` (das Älteste zuerst), die Einzelaufgaben nach `termin_at` (das
 * Nächste zuerst) — beide Male, weil die Zeit dort die Frage beantwortet, mit
 * der jemand auf die Seite kommt. Auf /wissen lautet die Frage „gibt es ein
 * Blatt zu guten Nachbarn", und die beantwortet das Alphabet. Eine
 * Nachschlageliste, die sich nach jeder Änderung umsortiert, wäre ausserdem
 * genau die Historie, die es hier nicht geben soll.
 *
 * **Sortiert wird in SQL und `COLLATE NOCASE`.** Ohne das gilt SQLites
 * Byte-Ordnung, und die stellt **alle** Grossbuchstaben vor **alle** kleinen:
 * `Zwiebeln` stünde vor `anbau`. Das ist nicht der seltene Fall, sondern der
 * häufige — es genügt ein Blatt, das jemand klein anfängt, und die Liste sieht
 * kaputt aus. `NOCASE` kostet nichts und bringt SQLite keine Sortiertabelle
 * bei: es faltet ASCII-Gross auf Klein, mehr nicht.
 *
 * **Umlaute bleiben davon unberührt, und das ist benannt und hingenommen:**
 * `Ähren` steht weiterhin hinter `Zwiebeln`. Dagegen hülfe nur eine echte
 * Sortierregel für Deutsch, und die müsste jemand in SQLite hineinreichen — ein
 * Stück Gestaltung an einer Stelle, an der es niemand mehr sähe. Bei einer
 * Handvoll Blättern ist die Liste in einem Blick erfasst; der Unterschied
 * zwischen den zwei Fällen ist, dass die Grossschreibung **jeden** Titel trifft
 * und der Umlaut den ersten Buchstaben eines seltenen. Der Review zu Story 4.1
 * hat den Unterschied gefunden — der Kommentar nannte vorher nur den seltenen.
 *
 * `localeCompare` in der Route wäre ein Vergleich in der Schicht, die nicht
 * vergleicht.
 *
 * Die Id als zweites Kriterium bleibt: zwei Blätter dürfen gleich heissen, und
 * unter `NOCASE` fallen sogar `Kohl` und `kohl` zusammen.
 */
const ordnung = [sql`${sheets.titel} collate nocase asc`, asc(sheets.id)];

/**
 * Alle Blätter, alphabetisch — Kennung und Titel.
 *
 * Die Liste für /wissen. Sie nimmt **kein Ereignis** entgegen: sie liest weder
 * locals noch cookies noch die Adresse. Alle sehen dieselbe Liste, und ein Blatt
 * ist für alle dasselbe — es gibt keine persönliche Sicht auf Wissen.
 */
export function blaetterLesen(): Blattzeile[] {
	return datenbank()
		.select({ id: sheets.id, titel: sheets.titel })
		.from(sheets)
		.orderBy(...ordnung)
		.all();
}

/**
 * Ein Blatt an seiner Id — oder null, wenn es die Id nicht gibt.
 *
 * null ist hier **einfacher** als in den Nachbarmodulen und heisst genau eines:
 * es gibt kein Blatt mit dieser Kennung. Es gibt keinen zweiten Weg dorthin, weil
 * ein Blatt keinen Zustand hat, der es unansprechbar machte — nichts ist
 * erledigt, übernommen oder beendet. Die Route macht daraus einen 404.
 */
export function blattLesen(id: number): Blatt | null {
	const zeile = datenbank()
		.select({ id: sheets.id, titel: sheets.titel, text: sheets.text })
		.from(sheets)
		.where(eq(sheets.id, id))
		.get();
	return zeile === undefined ? null : zeile;
}

/**
 * Legt ein Blatt an und gibt seine Kennung zurück.
 *
 * Titel und Text kommen **fertig geprüft** herein: der Titel gefaltet,
 * getrimmt, nicht leer und innerhalb von AUFGABE_HOECHSTLAENGE; der Text
 * gefaltet, getrimmt, nicht leer und innerhalb von BLATT_HOECHSTLAENGE.
 *
 * Die Prüfkette steht in ../../../blatttext.ts und **nicht** in der Route —
 * anders als bei aufgabeAnlegen in ./tasks.ts und einzelaufgabeAusschreiben in
 * ./signup-tasks.ts, deren Regel je genau eine Wurfstelle hat. Ein Blatt hat
 * zwei: `anlegen` auf /wissen und `aendern` auf /wissen/[id] werfen dieselben
 * vier Sätze, und zwei Routen, die je selbst deuteten, wären die Drift, gegen
 * die das geteilte Modul steht. Die Absicht ist dieselbe wie dort — eine
 * zweite Prüfstelle wäre eine zweite Wahrheit über dieselbe Regel —, nur liegt
 * die eine Stelle hier eine Schicht höher.
 *
 * Zurück kommt **nur die Id**, und nicht die Zeile: die Route braucht sie für
 * die Weiterleitung auf das frisch angelegte Blatt, und was dort steht, liest
 * die load der Zielseite ohnehin neu. Eine mitgegebene Zeile wäre ein Wert, den
 * niemand liest.
 *
 * `createdAt` kommt aus dem Schema ($defaultFn), nicht von hier — derselbe
 * Grund wie überall in dieser Schicht.
 *
 * `satisfies NewSheet` auf dem Objektliteral, damit eine später ergänzte
 * Pflichtspalte hier auffällt statt zur Laufzeit.
 */
export function blattAnlegen(titel: string, text: string): number {
	const zeile = datenbank()
		.insert(sheets)
		.values({ titel, text } satisfies NewSheet)
		.returning({ id: sheets.id })
		.get();
	return zeile.id;
}

/**
 * Ändert ein Blatt und sagt, ob es die Zeile gab.
 *
 * **Die Vorbedingung steht in der where-Klausel des UPDATE**, nicht als Select
 * davor in der Route — dieselbe Bauform und derselbe Grund wie bei
 * aufgabeAbhaken in ./tasks.ts und einzelaufgabeUebernehmen in
 * ./signup-tasks.ts. Hier ist es allein die Kennung: ein Blatt hat keinen
 * Zustand, der das Ändern verwehrte.
 *
 * **Das gleichzeitige Ändern durch zwei Personen ist ausdrücklich kein
 * Wettrennen, das dieses Modul entscheidet.** Wer zuletzt ablegt, gewinnt, und
 * der vorige Stand ist fort — genau das sagt „es gibt keine Versionen" zu. Ein
 * Vergleich gegen den beim Öffnen gelesenen Stand bräuchte eine Spalte, die es
 * nicht geben soll, und ergäbe eine Meldung „inzwischen geändert", die niemand
 * auflösen könnte. Bei zwanzig Leuten und einer Handvoll Blätter ist der Fall
 * gedacht und nicht beobachtet.
 *
 * false heisst: es gibt kein Blatt mit dieser Kennung — die Zeile ist zwischen
 * dem Öffnen der Seite und dem Absenden fortgekommen. Die Route macht daraus
 * einen Satz, keinen 404: die Person hat gerade getippt, und ihre Eingabe soll
 * im Formular stehen bleiben.
 */
export function blattAendern(id: number, titel: string, text: string): boolean {
	const zeile = datenbank()
		.update(sheets)
		.set({ titel, text })
		.where(eq(sheets.id, id))
		.returning({ id: sheets.id })
		.get();
	return zeile !== undefined;
}
