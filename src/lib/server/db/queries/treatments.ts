import { and, desc, eq, isNotNull, isNull, max } from 'drizzle-orm';
import { datenbank } from '../index.ts';
import type { AbgeschlosseneAnwendung } from '../../../wellness.ts';
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

/*
 * **Offen heisst `abgeschlossen_am IS NULL`** (seit dem 2026-10-12, Entscheid
 * Manuel). Die Bedingung steht einmal hier. Gelesen wird sie von
 * `behandlungenLesen`, `behandlungLesen`, `behandlungAendern`,
 * `behandlungWegnehmen`, `offeneAmOrtZaehlen` und vom UPDATE in
 * `kulturAbschliessen`.
 *
 * **Ohne sie arbeiten, ausgeschrieben:** `behandlungEintragen` schreibt eine
 * neue Zeile, die von selbst offen ist (die Spalte ist null); die
 * `max`-Abfrage in `kulturAbschliessen` liest **alle** Zeilen der Stelle,
 * offene wie abgeschlossene; `abschlussZuruecknehmen` und
 * `abgeschlosseneBehandlungenLesen` meinen ausdrücklich abgeschlossene.
 *
 * **Auch Ändern, Wegnehmen und die Vorlage zum Wiederholen lesen nur offene
 * Zeilen**, und das ist keine Vorsicht, sondern die Spec: abgeschlossene
 * Zeilen werden weder gelöscht noch kopiert. Auf /wellness stehen sie nicht
 * mehr, eine Kennung dazu kann also nur aus einer veralteten Seite kommen —
 * und die bekommt denselben Satz wie eine weggenommene Zeile.
 */
const offen = isNull(treatments.abgeschlossenAm);

/**
 * Das offene Tagebuch, in fester Reihenfolge. Geordnet wird in der Seite.
 *
 * **Nur offene Zeilen**: was abgeschlossen ist, steht im Archiv und nirgends
 * sonst. Weil `/` die fällig-Zahl aus genau dieser Funktion rechnet, gilt das
 * dort ohne einen zweiten Filter.
 */
export function behandlungenLesen(): Behandlungszeile[] {
	return datenbank()
		.select(anzeigeSpalten)
		.from(treatments)
		.leftJoin(members, eq(members.id, treatments.memberId))
		.where(offen)
		.orderBy(...ordnung)
		.all();
}

/** Eine einzelne offene Zeile — für die Rückfrage vor dem Wegnehmen und als Vorlage zum Wiederholen. */
export function behandlungLesen(id: number): Behandlungszeile | null {
	const zeile = datenbank()
		.select(anzeigeSpalten)
		.from(treatments)
		.leftJoin(members, eq(members.id, treatments.memberId))
		.where(and(eq(treatments.id, id), offen))
		.get();
	return zeile === undefined ? null : zeile;
}

/**
 * Ort und Kultur als SQL-Bedingung — **null gleich null**, sonst Zeichen für
 * Zeichen.
 *
 * Dieselbe Gleichheit wie `stelle` in src/lib/wellness.ts: `Tomaten` und
 * `tomaten` sind zwei Kulturen. SQLite vergleicht Text mit `=` binär, also
 * genau so. `= NULL` wäre in SQL nie wahr, darum der eigene Zweig.
 */
function amOrt(ort: string | null, kultur: string | null) {
	return and(
		ort === null ? isNull(treatments.ort) : eq(treatments.ort, ort),
		kultur === null ? isNull(treatments.kultur) : eq(treatments.kultur, kultur)
	);
}

/**
 * Wie viele **offene** Zeilen an diesem Ort mit dieser Kultur stehen — für die
 * Rückfrage vor dem Abschliessen. Ist es null, hat ein zweites Gerät schon
 * abgeschlossen, und die Rückfrage wäre eine Frage nach nichts.
 *
 * Nur lesend: die Rückfrage ändert die Datenbank nicht.
 */
export function offeneAmOrtZaehlen(ort: string | null, kultur: string | null): number {
	return datenbank()
		.select({ id: treatments.id })
		.from(treatments)
		.where(and(amOrt(ort, kultur), offen))
		.all().length;
}

/**
 * Schliesst eine Kultur in einem Beet ab: alle **offenen** Zeilen mit diesem
 * Ort und dieser Kultur bekommen **einen** gemeinsamen Zeitpunkt (Entscheid
 * Manuel, 2026-10-12). Zurück kommt der Zeitpunkt und die Zahl der Zeilen;
 * null, wenn keine offen war — dann hat ein zweites Gerät schon abgeschlossen.
 *
 * **Der Zeitpunkt ist eindeutig je Ort und Kultur.** Ort, Kultur und Zeitpunkt
 * sind der Schlüssel eines Abschlusses (Archivzeile, `Rückgängig`). Zwei
 * Abschlüsse derselben Kultur in derselben Sekunde — abschliessen, neu
 * eintragen, wieder abschliessen — flössen sonst zu einem zusammen, und ein
 * `Rückgängig` des zweiten öffnete auch den ersten. Liegt schon ein Abschluss
 * auf oder nach `jetzt`, nimmt dieser eine Sekunde danach.
 *
 * In einer Transaktion, damit zwischen dem Lesen des letzten Abschlusses und
 * dem Schreiben kein zweiter dazwischenkommt; better-sqlite3 führt sie
 * synchron aus.
 */
export function kulturAbschliessen(
	ort: string | null,
	kultur: string | null,
	jetzt: number
): { abgeschlossenAm: number; anzahl: number } | null {
	return datenbank().transaction((tx) => {
		const bisher = tx
			.select({ letzter: max(treatments.abgeschlossenAm) })
			.from(treatments)
			.where(amOrt(ort, kultur))
			.get();
		const letzter = bisher?.letzter ?? null;
		const abgeschlossenAm = letzter !== null && letzter >= jetzt ? letzter + 1 : jetzt;
		const zeilen = tx
			.update(treatments)
			.set({ abgeschlossenAm })
			.where(and(amOrt(ort, kultur), offen))
			.returning({ id: treatments.id })
			.all();
		return zeilen.length === 0 ? null : { abgeschlossenAm, anzahl: zeilen.length };
	});
}

/**
 * Nimmt **einen** Abschluss zurück: genau die Zeilen mit diesem Ort, dieser
 * Kultur und diesem Zeitpunkt werden wieder offen. Zurück kommt ihre Zahl; 0
 * heisst, den Abschluss gibt es nicht (mehr).
 *
 * Ein früherer Abschluss derselben Kultur trägt einen anderen Zeitpunkt und
 * bleibt, wo er ist — siehe die Eindeutigkeit an `kulturAbschliessen`.
 */
export function abschlussZuruecknehmen(
	ort: string | null,
	kultur: string | null,
	abgeschlossenAm: number
): number {
	return datenbank()
		.update(treatments)
		.set({ abgeschlossenAm: null })
		.where(and(amOrt(ort, kultur), eq(treatments.abgeschlossenAm, abgeschlossenAm)))
		.returning({ id: treatments.id })
		.all().length;
}

/**
 * Alle abgeschlossenen Zeilen, in fester Reihenfolge. Gebündelt wird in
 * src/lib/wellness.ts (`abschluesseBuendeln`), und dort steht auch der Typ
 * `AbgeschlosseneAnwendung` mit der Begründung, warum er weder Namen noch
 * Wiederholung noch `createdAt` trägt — die Auswahl hier unten liest sie
 * darum gar nicht.
 */
export function abgeschlosseneBehandlungenLesen(): AbgeschlosseneAnwendung[] {
	const zeilen = datenbank()
		.select({
			id: treatments.id,
			mittel: treatments.mittel,
			kultur: treatments.kultur,
			ort: treatments.ort,
			angewendetAm: treatments.angewendetAm,
			abgeschlossenAm: treatments.abgeschlossenAm,
		})
		.from(treatments)
		.where(isNotNull(treatments.abgeschlossenAm))
		.orderBy(desc(treatments.abgeschlossenAm), ...ordnung)
		.all();
	// Die Bedingung oben schliesst null aus; der Typ weiss das nicht.
	return zeilen.flatMap((zeile) =>
		zeile.abgeschlossenAm === null ? [] : [{ ...zeile, abgeschlossenAm: zeile.abgeschlossenAm }]
	);
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
 * die Handlung. **Das ist nicht dasselbe wie Abschliessen** (seit dem
 * 2026-10-12, `kulturAbschliessen`): ein Abschluss sagt, dass eine Kultur im
 * Beet fertig ist, und lässt alle Zeilen stehen — sie ziehen ins Archiv.
 * Wegnehmen sagt, dass eine Zeile nie hätte dastehen sollen. Darum trifft es
 * nur **offene** Zeilen: eine abgeschlossene wird nicht gelöscht.
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
 * false heisst: es gibt die Zeile nicht mehr als offene — jemand hat sie
 * weggenommen oder ihre Kultur abgeschlossen.
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
		.where(and(eq(treatments.id, id), offen))
		.returning({ id: treatments.id })
		.get();
	return zeile !== undefined;
}

export function behandlungWegnehmen(id: number): { mittel: string; ort: string | null } | null {
	const zeile = datenbank()
		.delete(treatments)
		.where(and(eq(treatments.id, id), offen))
		.returning({ mittel: treatments.mittel, ort: treatments.ort })
		.get();
	return zeile === undefined ? null : zeile;
}
