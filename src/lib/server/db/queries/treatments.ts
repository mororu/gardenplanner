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
 * **Die Regel, die dieses Modul durchsetzt, ist die Ordnung**, wie bei
 * ./harvests.ts — nur ist sie hier eine andere und einfachere: das Tagebuch
 * steht nach dem Tag der Anwendung, jüngste zuerst. Keine Stufen, keine
 * Kaskade, kein Rang.
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
	ort: string | null;
	angewendetAm: number;
	intervallTage: number | null;
	name: string | null;
	createdAt: number;
};

const anzeigeSpalten = {
	id: treatments.id,
	mittel: treatments.mittel,
	ort: treatments.ort,
	angewendetAm: treatments.angewendetAm,
	intervallTage: treatments.intervallTage,
	name: members.name,
	createdAt: treatments.createdAt,
};

/*
 * Der jüngste Tag zuerst. `desc(id)` als zweiter Schlüssel, damit zwei
 * Behandlungen **desselben Tages** eine feste Reihenfolge haben — und das ist
 * hier kein Randfall wie bei harvests, sondern der Normalfall: `angewendet_am`
 * ist ein Tagesende, also für alle Zeilen eines Tages derselbe Wert. Ohne den
 * zweiten Schlüssel stünden sie zwischen zwei Aufrufen verschieden.
 */
const ordnung = [desc(treatments.angewendetAm), desc(treatments.id)];

/** Das ganze Tagebuch, jüngste Anwendung zuerst. */
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
			ort: treatments.ort,
			angewendetAm: treatments.angewendetAm,
			intervallTage: treatments.intervallTage,
			createdAt: treatments.createdAt,
		})
		.get();
	return { ...zeile, name: mitglied.name };
}

/**
 * Nimmt eine Zeile weg — das **zweite** DELETE dieses Produkts ausserhalb der
 * Verwaltung, neben ernteAbernten.
 *
 * Die beiden meinen Verschiedenes, und der Unterschied gehört hierhin
 * geschrieben, damit niemand das eine für das andere hält: eine Erntezeile
 * wegzunehmen ist der **normale Ausgang** ihres Lebens — sie ist abgeerntet.
 * Eine Behandlung wegzunehmen ist immer eine **Richtigstellung**: sie ist
 * geschehen, und was hier verschwindet, ist die falsche Auskunft darüber, nicht
 * die Handlung. Darum gibt es kein `abgeschlossen` und keinen zweiten Zustand —
 * es gibt nichts abzuschliessen.
 *
 * Es gibt **keine** Bedingung auf die eintragende Person, wie beim Abernten:
 * wer sieht, dass eine Zeile falsch ist, soll sie wegnehmen dürfen, ohne die
 * Person zu suchen, die sie geschrieben hat. Die Rückfrage in der action ist
 * das Gegengewicht.
 *
 * Zurück kommt, was die Rückmeldung braucht — die Zeile ist danach fort und
 * lässt sich nicht mehr lesen.
 */
export function behandlungWegnehmen(id: number): { mittel: string; ort: string | null } | null {
	const zeile = datenbank()
		.delete(treatments)
		.where(eq(treatments.id, id))
		.returning({ mittel: treatments.mittel, ort: treatments.ort })
		.get();
	return zeile === undefined ? null : zeile;
}
