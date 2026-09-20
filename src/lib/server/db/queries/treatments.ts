import { desc, eq } from 'drizzle-orm';
import { datenbank } from '../index.ts';
import { members, treatments, type NewTreatment } from '../schema.ts';

/*
 * Das Repository für treatments. Die Routen benutzen ausschliesslich diese
 * benannten Funktionen — kein Drizzle-Aufruf entsteht inline in einer
 * Routendatei (AD-1, Gate-Regel 9).
 *
 * Alles synchron: better-sqlite3 gibt Werte direkt zurück.
 *
 * **Dieses Modul setzt seit dem 2026-09-20 keine Ordnung mehr durch**, und
 * dieser Absatz sagte bis dahin das Gegenteil: „Die Regel, die dieses Modul
 * durchsetzt, ist die Ordnung, wie bei ./harvests.ts — das Tagebuch steht nach
 * dem Tag der Anwendung, jüngste zuerst."
 *
 * Die Seite ordnet jetzt **nach Beet**, und diese Ordnung steht in
 * src/lib/wellness.ts (`nachBeet`): sie ist eine Auslegung — `Beet 3` vor
 * `Beet 12` — und keine Eigenschaft der Daten. In SQL wäre sie eine
 * CASE-Kaskade über Zeichenpositionen, die niemand mehr liest.
 *
 * Was die Abfrage liefert, ist darum nur noch eine **feste** Reihenfolge und
 * keine bedeutungsvolle: jüngste zuerst, damit zwei Aufrufe dasselbe ergeben.
 * Wer sie umdreht, ändert nichts an dem, was die Seite zeigt — und das ist
 * Absicht. Bis zum 2026-09-20 hätte es die Fälligkeit still verdreht; siehe die
 * Begründung an `letzteJeStelle`, das seither selbst vergleicht.
 *
 * **Was dieses Modul ausdrücklich nicht tut, ist die Fälligkeit.** Welche
 * Zeilen wieder anstehen, entscheidet src/lib/wellness.ts auf den gelesenen
 * Zeilen, und das ist Absicht: die Frage hängt an `jetzt`, und eine Abfrage,
 * die die Uhr liest, liefert bei zwei Aufrufen in derselben Antwort zwei
 * verschiedene Stände. Dieselbe Trennung wie bei der Überfälligkeit auf `/`,
 * die in src/lib/zeit.ts gerechnet und nicht in SQL gefiltert wird.
 */

/**
 * Eine Zeile des Tagebuchs, wie die Seite sie sieht.
 *
 * `name` ist nullbar, obwohl `member_id` es nicht ist: der leftJoin liefert
 * null, wenn die Mitgliedszeile fehlt. Kein Weg der Anwendung löscht eine —
 * Zugang beenden heisst deaktivieren —, aber der Typ soll nicht behaupten, was
 * allein eine Gewohnheit ist.
 *
 * **`memberId` reist nicht mit**, wie bei der Erntezeile und aus demselben
 * Grund: es gibt nichts zu vergleichen. Wer eine Behandlung einträgt, hat sie
 * gemacht; wer einen Vertipper sieht, darf ihn wegnehmen, auch an einer fremden
 * Zeile. Eine Kennung in den Seitendaten ohne Leser wäre eine Einladung.
 *
 * `createdAt` reist mit, obwohl die Seite es heute nicht zeigt — siehe die
 * Begründung an der Spalte: es ist die einzige Auskunft darüber, wann etwas
 * nachgetragen wurde.
 */
export type Behandlungszeile = {
	id: number;
	mittel: string;
	kultur: string | null;
	ort: string | null;
	angewendetAm: number;
	intervallTage: number | null;
	name: string | null;
	createdAt: number;
};

const anzeigeSpalten = {
	id: treatments.id,
	mittel: treatments.mittel,
	kultur: treatments.kultur,
	ort: treatments.ort,
	angewendetAm: treatments.angewendetAm,
	intervallTage: treatments.intervallTage,
	name: members.name,
	createdAt: treatments.createdAt,
};

/*
 * Der jüngste Tag zuerst, dann die höhere Kennung — eine **feste** Reihenfolge,
 * keine bedeutungsvolle. Was die Seite zeigt, ordnet `nachBeet` in
 * src/lib/wellness.ts.
 *
 * Sie bleibt trotzdem hier, und zwar aus einem Grund, der sich nicht geändert
 * hat: ohne `orderBy` liefert SQLite die Zeilen in einer Reihenfolge, die es
 * selbst wählt, und zwei Aufrufe ergäben verschiedene. Der zweite Schlüssel
 * fängt dabei den Normalfall — `angewendet_am` ist ein Tagesende und für alle
 * Zeilen eines Tages derselbe Wert.
 */
const ordnung = [desc(treatments.angewendetAm), desc(treatments.id)];

/** Das ganze Tagebuch, in fester Reihenfolge. Geordnet wird in der Seite. */
export function behandlungenLesen(): Behandlungszeile[] {
	return datenbank()
		.select(anzeigeSpalten)
		.from(treatments)
		.leftJoin(members, eq(members.id, treatments.memberId))
		.orderBy(...ordnung)
		.all();
}

/** Eine einzelne Zeile — für die Rückfrage vor dem Wegnehmen. */
export function behandlungLesen(id: number): Behandlungszeile | null {
	const zeile = datenbank()
		.select(anzeigeSpalten)
		.from(treatments)
		.leftJoin(members, eq(members.id, treatments.memberId))
		.where(eq(treatments.id, id))
		.get();
	return zeile === undefined ? null : zeile;
}

/**
 * Trägt eine Behandlung ein.
 *
 * Der Name kommt als Argument mit und wird **nicht** zurückgelesen: die
 * eintragende Person ist die angemeldete, ihr Name steht der Route ohnehin
 * schon zur Verfügung, und ein zweiter Lesevorgang ergäbe dasselbe. Dieselbe
 * Bauform wie ernteEintragen.
 *
 * **Kein Abgleich gegen eine bestehende Zeile.** Zweimal am selben Tag dasselbe
 * Mittel auf dasselbe Beet ist unwahrscheinlich, aber kein Fehler — und ein
 * abgewiesenes „gibt es schon" wäre eine Hürde vor der Handlung, die diese
 * Seite ermöglichen soll. Dieselbe Abwägung wie bei den Blättern auf /wissen.
 */
export function behandlungEintragen(
	eingabe: {
		mittel: string;
		kultur: string | null;
		ort: string | null;
		angewendetAm: number;
		intervallTage: number | null;
	},
	mitglied: { id: number; name: string }
): Behandlungszeile {
	const zeile = datenbank()
		.insert(treatments)
		.values({ ...eingabe, memberId: mitglied.id } satisfies NewTreatment)
		.returning({
			id: treatments.id,
			mittel: treatments.mittel,
			kultur: treatments.kultur,
			ort: treatments.ort,
			angewendetAm: treatments.angewendetAm,
			intervallTage: treatments.intervallTage,
			createdAt: treatments.createdAt,
		})
		.get();
	return { ...zeile, name: mitglied.name };
}

/**
 * Nimmt eine Zeile weg — das **zweite von drei** DELETEs dieses Produkts
 * ausserhalb der Verwaltung, neben ernteAbernten und blattLoeschen.
 *
 * Die drei meinen Verschiedenes, und der Unterschied gehört hierhin
 * geschrieben, damit niemand das eine für das andere hält: eine Erntezeile
 * wegzunehmen ist der **normale Ausgang** ihres Lebens — sie ist abgeerntet.
 * Eine Behandlung wegzunehmen ist immer eine **Richtigstellung**: sie ist
 * geschehen, und was hier verschwindet, ist die falsche Auskunft darüber, nicht
 * die Handlung. Darum gibt es kein `abgeschlossen` und keinen zweiten Zustand —
 * es gibt nichts abzuschliessen.
 *
 * Das dritte, blattLoeschen in ./sheets.ts, ist wieder etwas anderes und als
 * einziges mit einer Schranke versehen — die Aufstellung im Ganzen steht dort.
 *
 * Es gibt **keine** Bedingung auf die eintragende Person, wie beim Abernten:
 * wer sieht, dass eine Zeile falsch ist, soll sie wegnehmen dürfen, ohne die
 * Person zu suchen, die sie geschrieben hat. Die Rückfrage in der action ist
 * das Gegengewicht.
 *
 * Zurück kommt, was die Rückmeldung braucht — die Zeile ist danach fort und
 * lässt sich nicht mehr lesen.
 */
/**
 * Ändert eine Behandlung — alle vier Angaben auf einmal (Entscheid Manuel,
 * 2026-09-20).
 *
 * **Auch das Datum.** Der naheliegende Einwand wäre, den Tag festzuhalten, weil
 * er eine geschehene Handlung benennt — aber genau daran vertippt man sich: wer
 * am Montag einträgt, was er am Samstag gemacht hat, und das Feld auf `heute`
 * stehen lässt, hat eine Zeile, die um zwei Tage falsch liegt und die nächste
 * Fälligkeit mit sich zieht. Ohne Ändern bliebe nur Wegnehmen und neu
 * Eintragen, und das schriebe einen fremden Namen an die Zeile.
 *
 * **`member_id` bleibt unangetastet.** Der Name an der Zeile sagt, wer
 * behandelt hat, und das ändert sich durch eine Richtigstellung nicht. Wer eine
 * fremde Zeile korrigiert, tut das für die Person, nicht an ihrer Stelle — und
 * ein Tagebuch, in dem der Name beim Tippfehler wechselt, verliert genau die
 * Auskunft, für die er dasteht.
 *
 * **Ohne Vorbedingung auf den alten Stand**, wie beim Umstufen auf /ernte:
 * zwei Leute, die dieselbe Zeile richtigstellen, sind kein Wettrennen, das
 * jemand verlieren müsste.
 *
 * false heisst: es gibt die Zeile nicht mehr — jemand hat sie weggenommen.
 */
export function behandlungAendern(
	id: number,
	eingabe: {
		mittel: string;
		kultur: string | null;
		ort: string | null;
		angewendetAm: number;
		intervallTage: number | null;
	}
): boolean {
	const zeile = datenbank()
		.update(treatments)
		.set(eingabe)
		.where(eq(treatments.id, id))
		.returning({ id: treatments.id })
		.get();
	return zeile !== undefined;
}

export function behandlungWegnehmen(id: number): { mittel: string; ort: string | null } | null {
	const zeile = datenbank()
		.delete(treatments)
		.where(eq(treatments.id, id))
		.returning({ mittel: treatments.mittel, ort: treatments.ort })
		.get();
	return zeile === undefined ? null : zeile;
}
