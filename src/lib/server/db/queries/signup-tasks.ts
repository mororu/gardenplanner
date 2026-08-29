import { and, asc, eq, inArray, isNull, or } from 'drizzle-orm';
import { datenbank } from '../index.ts';
import { members, signupTasks, type NewSignupTask } from '../schema.ts';

/*
 * Das Repository für signup_tasks. Die Routen benutzen ausschliesslich diese
 * benannten Funktionen — kein Drizzle-Aufruf entsteht inline in einer
 * Routendatei (AD-1, Gate-Regel 9).
 *
 * Alles synchron: better-sqlite3 gibt Werte direkt zurück.
 *
 * **`is_active` steht in jeder Abfrage dieser Datei**, nicht in der Route.
 * Derselbe Grund wie bei ./members.ts und ./duty-weeks.ts, und hier zusätzlich
 * mit Zähnen: ein `.filter(…)` in einer Routendatei war ein Review-Befund aus
 * Story 3.1. Wo eine Zeile als frei gilt, entscheidet dieses Modul, und zwar an
 * **einer** Stelle — der Funktion `frei()` darunter, die alle drei Leser
 * benutzen: die zwei Leseabfragen und das UPDATE.
 */

/**
 * Eine Einzelaufgabe, wie sie eine Seite sehen darf.
 *
 * `uebernehmer` ist **null**, wenn niemand zugesagt hat — und das fasst die zwei
 * Wege dorthin zusammen: `member_id` ist leer, oder sie zeigt auf ein Mitglied,
 * dessen Zugang beendet wurde. Für die lesende Person ist beides dasselbe:
 * diese Aufgabe wartet noch, und sie darf sie nehmen. Dieselbe Bauform wie
 * `name` in ./duty-weeks.ts, mit einer anderen Folge — dort wartet die Woche auf
 * die Verwaltung, hier wartet die Aufgabe auf die Nächste.
 *
 * **`memberId` reist nicht mit**, anders als bei Dienstwoche. Dort belegt sie
 * die Auswahl im Besetzen-Formular vor; hier gibt es keine Auswahl, wer
 * übernimmt, ist immer die aufrufende Person. Eine Mitglieds-Id, die keine
 * Ansicht braucht, gehört nicht in die Seitendaten.
 */
export type Einzelaufgabe = {
	id: number;
	titel: string;
	terminAt: number;
	uebernehmer: string | null;
};

/*
 * Die Spaltenauswahl für jede lesende Abfrage dieser Datei.
 *
 * Sie steht als Konstante und nicht dreimal ausgeschrieben, aus demselben Grund
 * wie `sichtbareSpalten` in ./tasks.ts: **eine** Projektion für alle Leser. Was
 * hier nicht steht, kann keine load-Funktion verlassen — insbesondere
 * `member_id` und `created_at`, die keine Ansicht zeigt.
 *
 * `name` und `istAktiv` sind Rohstoff und keine Anzeigewerte: aus ihnen entsteht
 * in `alsEinzelaufgabe` das eine Feld `uebernehmer`, und nur das verlässt das
 * Modul.
 */
const anzeigeSpalten = {
	id: signupTasks.id,
	titel: signupTasks.titel,
	terminAt: signupTasks.terminAt,
	name: members.name,
	istAktiv: members.isActive,
};

/**
 * Wann eine Einzelaufgabe **frei** ist — die eine Stelle, an der das steht.
 *
 * Zwei Fälle, ein Ausdruck: keine Mitgliedsspalte, oder eine Mitgliedsspalte auf
 * ein beendetes Mitglied.
 *
 * **Als Unterabfrage und nicht über die angehängte Mitgliedszeile**, und das ist
 * der Punkt: der Ausdruck hängt damit an **keinem** Join und passt wörtlich in
 * die drei Stellen, die ihn brauchen — die zwei Leseabfragen darunter und die
 * where-Klausel des UPDATE in einzelaufgabeUebernehmen. Eine erste Fassung las
 * `members.is_active` aus dem `leftJoin` und konnte darum im UPDATE nicht
 * stehen, das keinen Join kennt; dort stand dieselbe Regel ein zweites Mal, in
 * einer zweiten Schreibweise. Zwei Ausdrücke mit derselben Absicht driften — und
 * der Docblock, der „dieselbe Bedingung" behauptete, wäre die Stelle gewesen, an
 * der es niemandem auffällt.
 *
 * Die Funktion und nicht eine Konstante: `datenbank()` darf erst beim Aufruf
 * laufen, nicht beim Modulladen — dieselbe Regel wie überall in dieser Schicht.
 *
 * Der `leftJoin` in den Leseabfragen bleibt, aber er trägt jetzt allein den
 * **Namen** und nicht mehr die Regel. Er ist ausdrücklich kein `innerJoin`: eine
 * Zeile auf ein beendetes Mitglied muss **erhalten bleiben**. Ein innerJoin auf
 * `is_active = 1` liesse sie verschwinden, und die Einzelaufgabe wäre fort —
 * nicht frei, sondern unsichtbar, ein stiller Datensatz, den niemand je wieder
 * anfasst. Dieselbe Begründung wie an dienstwochenLesen in ./duty-weeks.ts.
 */
function frei() {
	const beendete = datenbank()
		.select({ id: members.id })
		.from(members)
		.where(eq(members.isActive, false));
	return or(isNull(signupTasks.memberId), inArray(signupTasks.memberId, beendete));
}

/**
 * Die Ordnung jeder Liste dieser Datei: **der Termin**, dann die Id.
 *
 * Anders als der Pool, der nach `created_at` ordnet. Eine Poolaufgabe trägt
 * keine Frist, und eine Liste, die sich zwischen zwei Aufrufen umsortiert, wäre
 * dort der Fehler. Eine Einzelaufgabe trägt einen Termin, und danach entscheidet
 * eine Person, ob sie sie nimmt — das Nächste zuerst.
 *
 * Die Id als zweites Kriterium ist keine Zierde: `termin_at` ist ein Tagesende,
 * zwei Aufgaben am selben Tag tragen denselben Wert, und ihre Reihenfolge wäre
 * sonst nicht festgelegt — die Liste wechselte zwischen zwei Aufrufen ihre
 * Anordnung, ohne dass sich etwas geändert hat.
 */
const ordnung = [asc(signupTasks.terminAt), asc(signupTasks.id)];

type Anzeigezeile = {
	id: number;
	titel: string;
	terminAt: number;
	name: string | null;
	istAktiv: boolean | null;
};

/** Faltet Name und Aktiv-Zustand auf das eine Feld, das die Seite sieht. */
function alsEinzelaufgabe(zeile: Anzeigezeile): Einzelaufgabe {
	return {
		id: zeile.id,
		titel: zeile.titel,
		terminAt: zeile.terminAt,
		// `=== true` und nicht `!!`: istAktiv ist bei fehlender Mitgliedszeile null,
		// und null soll hier dasselbe bedeuten wie false, nicht etwas Drittes.
		uebernehmer: zeile.istAktiv === true ? zeile.name : null,
	};
}

/**
 * Schreibt eine Einzelaufgabe aus und gibt die erzeugte Zeile zurück.
 *
 * Titel und Termin kommen **fertig geprüft** herein: der Titel gefaltet,
 * getrimmt, nicht leer und innerhalb der Längengrenze; der Termin als Tagesende
 * in Unix-Sekunden und innerhalb des Fensters. Die Prüfkette steht in
 * ../../../../routes/einzelaufgabe/+page.server.ts, an derselben Stelle und mit
 * derselben Begründung wie bei aufgabeAnlegen in ./tasks.ts — eine zweite
 * Prüfstelle wäre eine zweite Wahrheit über dieselbe Regel.
 *
 * `member_id` bleibt leer: eine frisch ausgeschriebene Einzelaufgabe hat
 * niemanden. Wer sie ausschreibt, übernimmt sie damit **nicht** — das ist der
 * Unterschied zum Aufgaben-Pool, in dem Erfassen und Tun ohnehin niemandem
 * zugeschrieben werden, und der Grund, warum die action locals gar nicht liest.
 *
 * `createdAt` kommt aus dem Schema ($defaultFn), nicht von hier — derselbe Grund
 * wie überall in dieser Schicht.
 *
 * `satisfies NewSignupTask` auf dem Objektliteral, damit eine später ergänzte
 * Pflichtspalte hier auffällt statt zur Laufzeit.
 */
export function einzelaufgabeAusschreiben(titel: string, terminAt: number): Einzelaufgabe {
	const zeile = datenbank()
		.insert(signupTasks)
		.values({ titel, terminAt } satisfies NewSignupTask)
		.returning({
			id: signupTasks.id,
			titel: signupTasks.titel,
			terminAt: signupTasks.terminAt,
		})
		.get();
	// Der Übernehmer ist zwangsläufig null — die Zeile ist gerade erst entstanden.
	// Ausgeschrieben statt über einen zweiten Lesevorgang, der dasselbe ergäbe.
	return { ...zeile, uebernehmer: null };
}

/**
 * Alle Einzelaufgaben, das Nächste zuerst — freie wie übernommene.
 *
 * Die Liste für `/einzelaufgaben`. Sie zeigt **beide** Zustände, weil genau das
 * die Auskunft ist, die dort gesucht wird: ob und von wem etwas übernommen ist.
 * Auf `/` steht der Ausschnitt darunter.
 */
export function einzelaufgabenLesen(): Einzelaufgabe[] {
	return datenbank()
		.select(anzeigeSpalten)
		.from(signupTasks)
		.leftJoin(members, eq(members.id, signupTasks.memberId))
		.orderBy(...ordnung)
		.all()
		.map(alsEinzelaufgabe);
}

/**
 * Die **freien** Einzelaufgaben, das Nächste zuerst.
 *
 * Der Block 2 auf `/`. Gefiltert wird in der Abfrage und nicht danach in
 * JavaScript: die Regel, wann eine Zeile frei ist, steht in `frei` und wird von
 * dieser Funktion, von freieEinzelaufgabeLesen und — als Vorbedingung im UPDATE
 * — von einzelaufgabeUebernehmen benutzt. Drei Leser, eine Regel.
 */
export function freieEinzelaufgabenLesen(): Einzelaufgabe[] {
	return datenbank()
		.select(anzeigeSpalten)
		.from(signupTasks)
		.leftJoin(members, eq(members.id, signupTasks.memberId))
		.where(frei())
		.orderBy(...ordnung)
		.all()
		.map(alsEinzelaufgabe);
}

/**
 * Eine **freie** Einzelaufgabe an ihrer Id — oder null.
 *
 * Der erste Schritt des Übernehmens: die Bestätigung nennt Titel und Termin, und
 * die kommen aus der Datenbank statt aus dem abgeschickten Formular. Ein
 * Bestätigungssatz, dessen Text der Absender mitschickt, bestätigt nichts.
 *
 * null bedeutet bewusst mehrerlei auf einmal: es gibt die Id nicht, oder die
 * Aufgabe ist schon übernommen. Die Route macht daraus **einen** Satz — jede
 * Unterscheidung wäre ein Kanal, an dem sich ablesen liesse, welche Aufgaben es
 * gibt und in welchem Zustand sie sind.
 */
export function freieEinzelaufgabeLesen(id: number): Einzelaufgabe | null {
	const zeile = datenbank()
		.select(anzeigeSpalten)
		.from(signupTasks)
		.leftJoin(members, eq(members.id, signupTasks.memberId))
		.where(and(eq(signupTasks.id, id), frei()))
		.get();
	return zeile === undefined ? null : alsEinzelaufgabe(zeile);
}

/**
 * Übernimmt eine **freie** Einzelaufgabe und gibt sie zurück, oder null, wenn
 * keine Zeile getroffen wurde.
 *
 * **Die Vorbedingung steht in der where-Klausel des UPDATE**, nicht als Select
 * davor in der Route — dieselbe Bauform und derselbe Grund wie bei
 * aufgabeAbhaken in ./tasks.ts: das entscheidet zugleich das Wettrennen. Greifen
 * zwei Personen im selben Moment nach derselben Aufgabe, trifft das zweite
 * UPDATE keine Zeile und bekommt null. Ein Vorab-Select hätte genau hier ein
 * Fenster zwischen Lesen und Schreiben, in dem die zweite die erste
 * überschriebe — und die erste hätte vor allen zugesagt und stünde nirgends.
 *
 * Die Bedingung ist buchstäblich **derselbe Ausdruck** wie in den Leseabfragen —
 * `frei()`, ein Aufruf, keine zweite Schreibweise. Die Zeile eines beendeten
 * Mitglieds ist damit übernehmbar, und zwar zwangsläufig: sie wird von derselben
 * Regel als frei angezeigt. Eine Aufgabe, die aussieht wie frei und es beim
 * Antippen nicht ist, wäre die schlechtere Lüge — und sie entstünde genau dann,
 * wenn hier und dort zwei Ausdrücke stünden.
 *
 * Der Rückgabewert trägt Titel und Termin, weil die Rückmeldung sie nennt, und
 * `uebernehmer` als fertigen Namen: er ist zwangsläufig die aufrufende Person,
 * und ein zweiter Lesevorgang dafür wäre eine Rundreise für einen Wert, den die
 * Aufrufstelle schon hält.
 */
export function einzelaufgabeUebernehmen(
	id: number,
	mitglied: { id: number; name: string }
): Einzelaufgabe | null {
	const zeile = datenbank()
		.update(signupTasks)
		.set({ memberId: mitglied.id })
		.where(and(eq(signupTasks.id, id), frei()))
		.returning({
			id: signupTasks.id,
			titel: signupTasks.titel,
			terminAt: signupTasks.terminAt,
		})
		.get();
	return zeile === undefined ? null : { ...zeile, uebernehmer: mitglied.name };
}
