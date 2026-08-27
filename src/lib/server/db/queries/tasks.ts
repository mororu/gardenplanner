import { and, asc, eq, isNotNull, isNull } from 'drizzle-orm';
import { datenbank } from '../index.ts';
import { tasks, type SichtbareAufgabe } from '../schema.ts';

/*
 * Das Repository für tasks. Die Routen benutzen ausschliesslich diese benannten
 * Funktionen — kein Drizzle-Aufruf entsteht inline in einer Routendatei (AD-1,
 * Gate-Regel 9).
 *
 * Alles synchron: better-sqlite3 gibt Werte direkt zurück.
 *
 * **Beide Mutationen tragen ihre Vorbedingung in der Abfrage**, nicht in der
 * Route. Der Grund ist derselbe wie bei mitgliedDeaktivieren in ./members.ts und
 * hier zusätzlich der einzige Grund, warum es keine Transaktion braucht: siehe
 * die Begründung an aufgabeAbhaken.
 */

/*
 * Die Spaltenauswahl ohne completed_by und completed_at.
 *
 * Sie steht als Konstante und nicht dreimal ausgeschrieben, damit **jede**
 * Funktion dieser Datei dieselbe Auswahl benutzt — auch die zwei Mutationen,
 * deren Rückgabewert genauso in einer Antwort landet wie die Liste. Ein
 * `select()` oder ein `returning()` über alles wäre hier der teure Fehler: der
 * Abhakende landete über `data` beziehungsweise über den Rückgabewert der action
 * im ausgelieferten HTML, und damit fiele AD-5 still.
 *
 * `satisfies Record<keyof SichtbareAufgabe, unknown>` hält die Auswahl an den
 * Typ und weist eine **überzählige** Spalte ab, weil satisfies auf einem
 * Objektliteral zusätzliche Eigenschaften nicht zulässt. Die Gegenrichtung —
 * eine **fehlende** Spalte — fangen die Rückgabeannotationen der drei
 * Funktionen darunter. Siehe die ausführliche Begründung an SichtbareAufgabe in
 * ../schema.ts.
 */
const sichtbareSpalten = {
	id: tasks.id,
	text: tasks.text,
	createdAt: tasks.createdAt,
} satisfies Record<keyof SichtbareAufgabe, unknown>;

/**
 * Die offenen Aufgaben, älteste zuerst.
 *
 * Nur `completed_at IS NULL`: eine erledigte Aufgabe erscheint in keiner
 * Ansicht mehr, auch nicht durchgestrichen. Die durchgestrichene Zeile nach dem
 * Abhaken lebt allein in der Sitzung der abhakenden Person und ist beim nächsten
 * Laden fort — dann auch für alle anderen.
 *
 * Vollständig und ohne Nachladen: bei 40 Beeten und einer Handvoll Aufgaben pro
 * Woche gibt es nichts zu blättern.
 *
 * Die Id als zweites Ordnungskriterium ist keine Zierde. created_at hat die
 * Auflösung einer Sekunde, und zwei in derselben Sekunde erfasste Aufgaben
 * hätten sonst keine festgelegte Reihenfolge: die Liste wechselte zwischen zwei
 * Aufrufen ihre Anordnung, ohne dass sich etwas geändert hat.
 */
export function offeneAufgabenAuflisten(): SichtbareAufgabe[] {
	return datenbank()
		.select(sichtbareSpalten)
		.from(tasks)
		.where(isNull(tasks.completedAt))
		.orderBy(asc(tasks.createdAt), asc(tasks.id))
		.all();
}

/**
 * Hakt eine **offene** Aufgabe ab und gibt die getroffene Zeile zurück, oder
 * null, wenn keine getroffen wurde.
 *
 * Die Vorbedingung `completed_at IS NULL` steht in der where-Klausel, und das
 * entscheidet zugleich das Wettrennen: haken zwei Personen dieselbe Aufgabe im
 * selben Moment ab, trifft das zweite UPDATE keine Zeile und bekommt null. Der
 * erste Abhakende bleibt gespeichert, wie AD-5 es verlangt. Kein Vorab-Select,
 * keine Transaktion, keine Sperre — ein Select in der Route hätte genau hier ein
 * Zeitfenster zwischen Lesen und Schreiben.
 *
 * null bedeutet darum bewusst mehrerlei auf einmal: es gibt die Id nicht, oder
 * die Aufgabe war schon erledigt. Die Route macht daraus **einen** Satz — jede
 * Unterscheidung wäre ein Kanal, an dem sich ablesen liesse, welche Aufgaben es
 * gibt und in welchem Zustand sie sind.
 *
 * completed_by wird gesetzt und nie angezeigt. Der Zeitstempel steht in
 * Unix-Sekunden hier und nicht als $defaultFn im Schema: er entsteht beim
 * Abhaken, nicht beim Anlegen.
 */
export function aufgabeAbhaken(id: number, mitgliedId: number): SichtbareAufgabe | null {
	const zeile = datenbank()
		.update(tasks)
		.set({ completedBy: mitgliedId, completedAt: Math.floor(Date.now() / 1000) })
		.where(and(eq(tasks.id, id), isNull(tasks.completedAt)))
		.returning(sichtbareSpalten)
		.get();
	return zeile ?? null;
}

/**
 * Öffnet eine **erledigte** Aufgabe wieder und gibt die getroffene Zeile
 * zurück, oder null.
 *
 * Der Gegenzug zum Abhaken, für den Fehlgriff mit dem Handschuh: beide Spalten
 * werden wieder leer, und die Aufgabe steht beim nächsten Laden für alle wieder
 * im Pool. Es gibt **keine** zeitliche Schranke und keine Bindung an die Person,
 * die abgehakt hat — wer die Zeile sieht, darf sie öffnen. Der Preis steht in
 * README.md unter den benannt akzeptierten Risiken.
 *
 * Die Vorbedingung ist hier `IS NOT NULL`, aus demselben Grund und mit
 * demselben mehrdeutigen null: ein Wieder-Öffnen einer offenen Aufgabe ist kein
 * stiller Erfolg.
 *
 * mitgliedId nimmt diese Funktion nicht, und das ist Absicht: es gibt keine
 * Spalte, die einen Wieder-Öffnenden hielte, und es soll keine geben.
 */
export function aufgabeWiederOeffnen(id: number): SichtbareAufgabe | null {
	const zeile = datenbank()
		.update(tasks)
		.set({ completedBy: null, completedAt: null })
		.where(and(eq(tasks.id, id), isNotNull(tasks.completedAt)))
		.returning(sichtbareSpalten)
		.get();
	return zeile ?? null;
}
