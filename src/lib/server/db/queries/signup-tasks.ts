import { and, asc, desc, eq, inArray, isNotNull, isNull, lt, or } from 'drizzle-orm';
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
	/**
	 * Abgeschlossen — seit dem 2026-09-15.
	 *
	 * Ein **Zustand** und kein Zeitpunkt, und dieselbe Zurückhaltung steht schon
	 * am fehlenden Zeitstempel der Übernahme. Die Spalte trägt die Sekunde
	 * trotzdem, weil sie zugleich die Vorbedingung in der where-Klausel ist;
	 * durch **dieses** Feld geht nur das Ja oder Nein.
	 *
	 * **Der Satz daneben hiess bis zum 2026-09-17: „wann jemand fertig wurde,
	 * beantwortet keine Frage, die diese Gemeinschaft an ihr Werkzeug stellt".
	 * Er stimmt nicht mehr.** Das Archiv stellt genau diese Frage — was ist wann
	 * getan worden —, und es bekommt den Zeitpunkt darum auch: über
	 * `AbgeschlossenerTermin` weiter unten, eine eigene Projektion neben dieser.
	 * Der Zustand hier bleibt trotzdem ein Ja oder Nein: die Leser dieses Typs
	 * sind die Rückgabe von `einzelaufgabeAbschliessen` und die Listen der
	 * offenen Termine, und keiner von ihnen zeigt eine Sekunde an.
	 *
	 * **Es bleibt dabei, dass der Zeitpunkt der Übernahme nirgends steht.** Wann
	 * jemand zugesagt hat, ist weiterhin keine Auskunft, die diese Gemeinschaft
	 * von ihrem Werkzeug erwartet — das Archiv fragt nach dem Tun, nicht nach dem
	 * Versprechen.
	 */
	erledigt: boolean;
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
	completedAt: signupTasks.completedAt,
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
	/*
	 * **`completed_at IS NULL` steht seit dem 2026-09-15 mit drin**, und ohne
	 * diese Zeile hätte die neue Spalte eine stille Lücke gerissen: ein Termin,
	 * den jemand abgeschlossen hat und dessen Zugang später endet, fiele über den
	 * zweiten Zweig wieder in die freie Liste — als wäre er nie gemacht worden.
	 * Erledigt schlägt frei.
	 */
	return and(
		isNull(signupTasks.completedAt),
		or(isNull(signupTasks.memberId), inArray(signupTasks.memberId, beendete))
	);
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
	completedAt: number | null;
};

/**
 * Eine Zeile an ihrer Id, **in jedem Zustand** — oder null.
 *
 * Die einzige Leseabfrage dieser Datei ohne Vorbedingung, und sie hat genau
 * einen Aufrufer: `einzelaufgabeAbschliessen` liest damit die Zeile nach, die es
 * gerade geschrieben hat. Sie ist bewusst **nicht exportiert** — eine Route, die
 * eine Zeile ohne Zustandsfrage liest, hätte die Frage vergessen, nicht
 * beantwortet.
 */
function zeileLesen(id: number): Einzelaufgabe | null {
	const zeile = datenbank()
		.select(anzeigeSpalten)
		.from(signupTasks)
		.leftJoin(members, eq(members.id, signupTasks.memberId))
		.where(eq(signupTasks.id, id))
		.get();
	return zeile === undefined ? null : alsEinzelaufgabe(zeile);
}

/** Faltet Name und Aktiv-Zustand auf das eine Feld, das die Seite sieht. */
function alsEinzelaufgabe(zeile: Anzeigezeile): Einzelaufgabe {
	return {
		id: zeile.id,
		titel: zeile.titel,
		terminAt: zeile.terminAt,
		// `=== true` und nicht `!!`: istAktiv ist bei fehlender Mitgliedszeile null,
		// und null soll hier dasselbe bedeuten wie false, nicht etwas Drittes.
		uebernehmer: zeile.istAktiv === true ? zeile.name : null,
		// Der Zeitpunkt bleibt in der Datenschicht, nach draussen geht das Ja.
		erledigt: zeile.completedAt !== null,
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
	// Übernehmer und Erledigt sind zwangsläufig leer — die Zeile ist gerade erst
	// entstanden. Ausgeschrieben statt über einen zweiten Lesevorgang, der
	// dasselbe ergäbe.
	return { ...zeile, uebernehmer: null, erledigt: false };
}

/**
 * Die **offenen** Einzelaufgaben, das Nächste zuerst — freie wie übernommene.
 *
 * Die Liste für `/einzelaufgaben`. Sie zeigt beide Zustände der Übernahme, weil
 * genau das die Auskunft ist, die dort gesucht wird: ob und von wem etwas
 * übernommen ist. Auf `/` steht der Ausschnitt darunter.
 *
 * **`completed_at IS NULL` steht seit dem 2026-09-17 dabei** (Entscheid Manuel),
 * und damit heisst die Liste nicht mehr „alle": ein abgeschlossener Termin
 * verlässt sie und steht im Archiv. Vorher stand er hier weiter mitten unter den
 * offenen und war von ihnen **nicht zu unterscheiden** — die Komponente zeigt
 * `erledigt` nirgends an. Wer die Seite aufschlug, um zu sehen, was noch
 * ansteht, las erledigte Arbeit mit.
 *
 * Damit ist dies die dritte Abfrage dieser Datei mit derselben Vorbedingung
 * (neben `frei()` und `eigeneEinzelaufgabenLesen`) — und zugleich die Stelle,
 * an der die Zusage aus dem Schema-Docblock zu signup_tasks.completed_at
 * umgezogen ist: ein abgeschlossener Termin bleibt stehen, aber nicht mehr
 * hier.
 */
export function einzelaufgabenLesen(): Einzelaufgabe[] {
	return datenbank()
		.select(anzeigeSpalten)
		.from(signupTasks)
		.leftJoin(members, eq(members.id, signupTasks.memberId))
		.where(isNull(signupTasks.completedAt))
		.orderBy(...ordnung)
		.all()
		.map(alsEinzelaufgabe);
}

/**
 * Ein abgeschlossener Termin, wie ihn das Archiv sieht.
 *
 * **Eine eigene Projektion neben `Einzelaufgabe`**, aus demselben Grund wie
 * `ErledigteAufgabe` neben `SichtbareAufgabe` in ./tasks.ts: jede sagt, was ihre
 * Leser sehen dürfen. Der Unterschied ist genau ein Feld in jede Richtung —
 * `erledigtAm` kommt dazu, `erledigt` fällt weg. Ein Ja, das immer Ja ist,
 * beantwortet in einer Liste abgeschlossener Termine keine Frage.
 *
 * **`terminAt` fehlt, und das ist eine Entscheidung.** Im Archiv zählt, wann
 * etwas getan wurde, nicht bis wann es zu tun war; zwei Daten an derselben Zeile
 * wären eine Frage mehr für jeden, der sie liest („welches ist welches?"). Wer
 * den Termin sucht, sucht ihn, solange er offen ist — dort steht er.
 *
 * `uebernehmer` wird gefaltet wie überall in dieser Datei, mit einer Folge, die
 * hier eine andere ist: fällt der Name weg, weil ein Zugang endete, wird die
 * Zeile dadurch **nicht** wieder frei — sie ist getan. Sie steht dann ohne Namen
 * im Archiv, und das ist die wahrheitsgemässe Auskunft: gemacht wurde es, von
 * wem, weiss das Werkzeug nicht mehr.
 */
export type AbgeschlossenerTermin = {
	id: number;
	titel: string;
	uebernehmer: string | null;
	erledigtAm: number;
};

/**
 * Die **abgeschlossenen** Termine, der zuletzt abgeschlossene zuerst.
 *
 * Die zweite Hälfte des Archivs; die erste liest `erledigteAufgabenAuflisten` in
 * ./tasks.ts. Die zwei bleiben **getrennte Abfragen aus getrennten Modulen**,
 * und das ist AD-3 und AD-4: die Aufgabenarten haben keine Basistabelle und
 * keine gemeinsame Zuständigkeitsspalte, weil sie verschieden verbindlich sind.
 * Zusammengeführt wird erst in der load von /archiv — dort, wo aus zwei Arten
 * **eine Ansicht** wird, und nicht in einer Schicht, die den Unterschied
 * einebnete.
 *
 * Absteigend wie das Archiv der Aufgaben, und aus demselben Grund: ein Archiv
 * liest man von heute rückwärts. Die Ordnung dieser Datei (`ordnung`, nach dem
 * Termin aufsteigend) gilt hier ausdrücklich **nicht** — sie ordnet, was noch
 * bevorsteht.
 *
 * Der leere Zweig im flatMap ist unerreichbar: die where-Klausel schliesst ihn
 * aus. Er steht trotzdem da statt einer Zusicherung mit `as`, aus demselben
 * Grund wie in ./tasks.ts — fiele das `isNotNull` eines Tages heraus, liefe eine
 * Zeile mit `erledigtAm: null` still durch einen Typ, der `number` verspricht.
 */
export function abgeschlosseneEinzelaufgabenLesen(): AbgeschlossenerTermin[] {
	return datenbank()
		.select(anzeigeSpalten)
		.from(signupTasks)
		.leftJoin(members, eq(members.id, signupTasks.memberId))
		.where(isNotNull(signupTasks.completedAt))
		.orderBy(desc(signupTasks.completedAt), desc(signupTasks.id))
		.all()
		.flatMap((zeile) =>
			zeile.completedAt === null
				? []
				: [
						{
							id: zeile.id,
							titel: zeile.titel,
							uebernehmer: zeile.istAktiv === true ? zeile.name : null,
							erledigtAm: zeile.completedAt,
						},
					]
		);
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
	// Erledigt ist hier zwangsläufig falsch: übernommen wird nur, was frei ist,
	// und frei() schliesst Abgeschlossenes aus.
	return zeile === undefined ? null : { ...zeile, uebernehmer: mitglied.name, erledigt: false };
}

/**
 * Die Einzelaufgaben, die **diese Person** übernommen hat und deren Termin vor
 * `vorSekunden` liegt — also die Zusagen, die jetzt gelten.
 *
 * **Warum es diese Abfrage gibt.** Eine übernommene Einzelaufgabe verlässt die
 * Startseite: sie trägt einen Namen, damit ist sie geregelt, und `/` beantwortet
 * die Frage „was ist noch offen". Das stimmt — beantwortet aber nicht die
 * zweite Frage, die dieselbe Seite beantwortet, seit es den Diensthinweis gibt:
 * **was habe ich diese Woche zu tun.** Wer am Montag etwas übernimmt, sah es ab
 * Dienstag nirgends mehr. Der Tränkedienst hatte seine Zeile, die eigene Zusage
 * nicht.
 *
 * `vorSekunden` ist die Grenze und kommt von aussen — die Route rechnet sie aus
 * dem Wochenfenster, das sie ohnehin schon hat. Diese Funktion kennt weder
 * Woche noch Zeitzone; sie vergleicht zwei Zahlen. Ein Termin, der schon
 * verstrichen ist, fällt damit ausdrücklich **mit** hinein: eine Zusage, deren
 * Frist abgelaufen ist, ist der dringendere Fall und nicht der erledigte.
 *
 * Kein `frei()` und kein Aktiv-Zustand in der where-Klausel: gefragt ist nach
 * den Zeilen **einer bestimmten** Person, und wer diese Seite sieht, hat eine
 * gültige Sitzung. `completed_at IS NULL` steht seit dem 2026-09-15 dabei — was
 * abgeschlossen ist, steht nicht mehr auf der Liste dessen, was zu tun ist. Der leftJoin trägt den Namen wie in jeder Abfrage dieser
 * Datei — hier ist es der eigene, und die Zeile zeigt ihn nicht.
 */
export function eigeneEinzelaufgabenLesen(
	mitgliedId: number,
	vorSekunden: number
): Einzelaufgabe[] {
	return datenbank()
		.select(anzeigeSpalten)
		.from(signupTasks)
		.leftJoin(members, eq(members.id, signupTasks.memberId))
		.where(
			and(
				eq(signupTasks.memberId, mitgliedId),
				isNull(signupTasks.completedAt),
				lt(signupTasks.terminAt, vorSekunden)
			)
		)
		.orderBy(...ordnung)
		.all()
		.map(alsEinzelaufgabe);
}

/**
 * Schliesst einen **eigenen, offenen** Termin ab und gibt die Zeile zurück,
 * oder null.
 *
 * **Zwei Vorbedingungen, und beide stehen in der where-Klausel**, also im selben
 * Statement wie das Schreiben:
 *
 *   - `member_id = mitgliedId` — abschliessen darf, wer übernommen hat. Nicht
 *     aus Misstrauen, sondern weil es sonst keine Aussage wäre: `Erledigt` an
 *     einer fremden Zeile hiesse „ich glaube, jemand anderes hat das gemacht".
 *     Wer irrtümlich zugesagt hat, kann das heute ohnehin nicht zurücknehmen;
 *     die Lücke ist alt und wird von dieser Funktion weder grösser noch kleiner.
 *   - `completed_at IS NULL` — ein zweites Abschliessen trifft keine Zeile und
 *     bekommt null, statt den Zeitpunkt des ersten zu überschreiben.
 *
 * **Es gibt bewusst keinen Rückweg**, und das ist der eine Unterschied zur
 * Poolaufgabe, die `aufgabeWiederOeffnen` kennt. Dort ist der Fehlgriff die
 * Regel — ein Kästchen am Daumen, im Garten, mit Handschuhen. Hier liegt der
 * Knopf in der eigenen Kachel hinter einem Titel, den man gelesen hat. Sollte
 * sich das als falsch erweisen, ist das Gegenstück dieselbe Bauform mit
 * `IS NOT NULL` — es fehlt nicht aus Versehen.
 *
 * Das null ist wie überall in dieser Datei mehrdeutig: die Zeile gibt es nicht,
 * sie gehört jemand anderem, oder sie ist schon abgeschlossen. Alle drei enden
 * in derselben Handlung — die Liste neu laden.
 */
export function einzelaufgabeAbschliessen(id: number, mitgliedId: number): Einzelaufgabe | null {
	const zeile = datenbank()
		.update(signupTasks)
		.set({ completedAt: Math.floor(Date.now() / 1000) })
		.where(
			and(
				eq(signupTasks.id, id),
				eq(signupTasks.memberId, mitgliedId),
				isNull(signupTasks.completedAt)
			)
		)
		.returning({ id: signupTasks.id, titel: signupTasks.titel })
		.get();
	if (zeile === undefined) return null;
	/*
	 * Der Rückgabewert wird **neu gelesen** und nicht aus dem UPDATE gebaut: die
	 * Projektion dieser Datei nimmt den Namen über einen leftJoin auf members,
	 * und ein `returning` kennt keinen Join. Eine von Hand zusammengesetzte Zeile
	 * wäre die zweite Stelle, an der `Einzelaufgabe` entsteht.
	 *
	 * **Gelesen wird über `zeileLesen` und seit dem 2026-09-17 nicht mehr über
	 * `einzelaufgabenLesen`.** Jene Liste führt seither nur noch die offenen, und
	 * die eben abgeschlossene Zeile ist darin zwangsläufig nicht mehr zu finden:
	 * der `find` gäbe undefined und diese Funktion null — also „nichts
	 * getroffen", obwohl das UPDATE gerade eine Zeile getroffen hat. Die Route
	 * machte daraus einen Fehlersatz nach einer geglückten Handlung.
	 */
	return zeileLesen(zeile.id);
}
