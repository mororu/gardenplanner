import { and, asc, desc, eq, isNotNull, isNull } from 'drizzle-orm';
import { datenbank } from '../index.ts';
import { tasks, type NewTask, type SichtbareAufgabe } from '../schema.ts';
import { wochenOffenSeit } from '../../../zeit.ts';

/*
 * Das Repository für tasks. Die Routen benutzen ausschliesslich diese benannten
 * Funktionen — kein Drizzle-Aufruf entsteht inline in einer Routendatei (AD-1,
 * Gate-Regel 9).
 *
 * Alles synchron: better-sqlite3 gibt Werte direkt zurück.
 *
 * **Beide Zustandswechsel tragen ihre Vorbedingung in der Abfrage**, nicht in
 * der Route. Der Grund ist derselbe wie bei mitgliedDeaktivieren in ./members.ts
 * und hier zusätzlich der einzige Grund, warum es keine Transaktion braucht:
 * siehe die Begründung an aufgabeAbhaken. Das Anlegen hat keine Vorbedingung —
 * eine neue Aufgabe kollidiert mit nichts.
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
	dueAt: tasks.dueAt,
	createdAt: tasks.createdAt,
} satisfies Record<keyof SichtbareAufgabe, unknown>;

/**
 * SichtbareAufgabe — und die zwei Erledigt-Spalten ausdrücklich **verboten**.
 *
 * Die Rückgabeannotation `SichtbareAufgabe` allein trägt die Zusage nicht.
 * TypeScript ist strukturell, und eine vollständige Task-Zeile hat alle Felder
 * von SichtbareAufgabe **plus** zwei: sie ist damit zuweisbar. Ein `returning()`
 * über alles fiel deshalb weder `npm run check` noch `npm run lint` auf —
 * gemessen, nicht vermutet. Die Zusage hing am Augenschein.
 *
 * `Partial<Record<…, never>>` schliesst die Lücke von der anderen Seite: die
 * zwei Felder dürfen fehlen (eine richtig projizierte Zeile hat sie nicht), aber
 * kein Wert passt hinein. Eine Zeile mit `completedBy: number | null` ist damit
 * nicht mehr zuweisbar, und der teure Fehler wird zum Typfehler.
 *
 * Der Typ steht als Rückgabeannotation an **allen** Abfragen dieser Datei, denn
 * alle drei Ergebnisse landen in einer Antwort. Nach aussen bleibt er
 * SichtbareAufgabe: die zwei verbotenen Felder sind optional und stehen keiner
 * Zuweisung an SichtbareAufgabe im Weg.
 */
type NurSichtbar = SichtbareAufgabe & Partial<Record<'completedBy' | 'completedAt', never>>;

/**
 * Eine offene Aufgabe samt abgeleiteter Wochenzahl — der Zeilentyp der Liste.
 *
 * Der Typ ist **exportiert**, NurSichtbar darüber nicht: dieser hier steht in
 * der Rückgabeannotation der load von / und muss darum von aussen benennbar
 * sein. NurSichtbar bleibt modulintern, weil ihn niemand ausserhalb dieser Datei
 * braucht.
 *
 * `wochenOffen` ist die Zahl der ganzen Wochen, die die Aufgabe über der
 * Schwelle offen liegt, oder null — die Rechnung steht in
 * ../../../zeit.ts. Das Feld heisst deutsch, und das ist nicht nur Stil:
 * scripts/smoke-zugang.ts sucht in den Seitendaten nach dem Muster
 * `/completed/i` (AD-5), und ein englischer Name wie `weeksOverdue` liesse diese
 * Wache zwar durch, aber jeder Nachbar in diesem Modul heisst deutsch.
 *
 * Es ist **kein** Erledigt-Zustand und keine Sortierhilfe: die Liste ordnet
 * weiter nach created_at, und überfällige Zeilen stehen an ihrem Platz.
 */
export type OffeneAufgabe = NurSichtbar & { wochenOffen: number | null };

/**
 * Eine erledigte Aufgabe samt dem Zeitpunkt, an dem sie abgehakt wurde — der
 * Zeilentyp des Archivs.
 *
 * **Die einzige Projektion dieser Datei, die `completed_at` herausreicht**, und
 * darum steht hier die Begründung, warum das AD-5 nicht bricht. AD-5 verbietet
 * jede Zuordnung einer erledigten Aufgabe zu einer **Person**; das ist
 * `completed_by`, und diese Spalte bleibt hier ausgeschlossen wie überall
 * sonst. Der Zeitpunkt ist keine Person: er sagt, **wann** im Gartenjahr etwas
 * getan wurde, und genau diese Auskunft ist der Zweck des Archivs. Dass
 * SichtbareAufgabe in ../schema.ts beide Spalten auslässt, hat für die zwei
 * verschiedene Gründe — `completed_by` wegen AD-5, `completed_at`, weil es in
 * jeder Liste offener Aufgaben leer ist und dort nichts bedeutet. Der zweite
 * Grund fällt hier weg, der erste nicht.
 *
 * **Das Feld heisst `erledigtAm` und nicht `completedAt`**, und das ist keine
 * Kosmetik: scripts/smoke-zugang.ts durchsucht die Seitendaten nach dem Muster
 * `/completed/i` und macht daraus die Wache für AD-5. Ein durchgereichtes
 * `completedAt` machte sie rot — richtigerweise, denn sie kann nicht wissen,
 * welche der zwei Spalten gemeint ist. Der deutsche Name hält die Wache scharf
 * für das, wogegen sie steht, und folgt zugleich der Hausregel für
 * Domänenfelder; `wochenOffen` an OffeneAufgabe darüber steht aus demselben
 * Grund deutsch da.
 *
 * `number` und nicht `number | null`: die Abfrage liest ausschliesslich Zeilen
 * mit `completed_at IS NOT NULL`. Wie diese Zusage aus der where-Klausel in den
 * Typ kommt, steht an erledigteAufgabenAuflisten.
 */
type Archivzeile = SichtbareAufgabe & { erledigtAm: number };

/**
 * Archivzeile — und `completed_by` ausdrücklich **verboten**.
 *
 * Dieselbe Bauform und dieselbe Begründung wie NurSichtbar darüber: die
 * Rückgabeannotation allein trägt die Zusage nicht, weil TypeScript strukturell
 * ist und eine vollständige Task-Zeile zuweisbar wäre. `completed_at` steht hier
 * **nicht** im Verbot, denn genau dieses Feld reicht diese Projektion heraus —
 * unter seinem deutschen Namen, siehe oben.
 */
export type ErledigteAufgabe = Archivzeile & Partial<Record<'completedBy', never>>;

/**
 * Legt eine Aufgabe an und gibt die erzeugte Zeile zurück.
 *
 * Der Text kommt **fertig geprüft** herein: gefaltet, getrimmt, nicht leer und
 * innerhalb der Längengrenze. Die Prüfkette steht in
 * ../../../../routes/aufgabe/+page.server.ts, an derselben Stelle und mit
 * derselben Begründung wie die 80 für Mitgliedsnamen — sie ist eine Auslegung
 * von „eine Aufgabe ist ein Satz" und keine Eigenschaft der Daten. Diese
 * Funktion nimmt hin, was sie bekommt: eine zweite Prüfstelle wäre eine zweite
 * Wahrheit über dieselbe Regel.
 *
 * createdAt kommt aus dem Schema ($defaultFn, Unix-Sekunden), nicht von hier —
 * derselbe Grund wie bei mitgliedAnlegen in ./members.ts. completedBy und
 * completedAt bleiben leer: eine neue Aufgabe ist offen, und niemand hat sie
 * abgehakt.
 *
 * `satisfies NewTask` auf dem Objektliteral, damit eine später ergänzte
 * Pflichtspalte hier auffällt statt zur Laufzeit.
 *
 * `returning(sichtbareSpalten)` und **nicht** `returning()` — und der Grund ist
 * hier ein **anderer** als bei den zwei Zustandswechseln darunter. Deren
 * Rückgabewert landet über eine action wirklich in einer Antwort; dieser nicht:
 * `ablegen` verwirft ihn und wirft danach den Redirect. Der Grund ist die
 * Symmetrie der Datei. Jede Funktion hier gibt dieselbe Projektion zurück, und
 * nur so ist „diese Datei reicht completed_by nie heraus" eine Eigenschaft des
 * Moduls statt einer Aussage über die heutigen Aufrufer. Die erste Route, die
 * den Rückgabewert **doch** anzeigt — eine Bestätigung mit dem Text der eben
 * abgelegten Aufgabe wäre die naheliegende —, träfe sonst auf eine Ausnahme,
 * die niemand erwartet. Die Rückgabeannotation NurSichtbar macht daraus einen
 * Typfehler statt einer Prüfung von Hand.
 */
export function aufgabeAnlegen(text: string): NurSichtbar {
	return datenbank()
		.insert(tasks)
		.values({ text } satisfies NewTask)
		.returning(sichtbareSpalten)
		.get();
}

/**
 * Legt einen **ganzen Stapel** Aufgaben mit demselben Fälligkeitsdatum an und
 * gibt die erzeugten Zeilen zurück.
 *
 * Das ist der Monatsplan: die planende Person überträgt 20 bis 40 Zeilen in
 * einem Zug, und alle tragen dasselbe due_at — ein Monatsplan hat **ein**
 * Fälligkeitsdatum, nicht eines pro Zeile.
 *
 * **Ein Aufruf, ein INSERT, keine Transaktion.** `values([…])` erzeugt ein
 * einziges mehrzeiliges INSERT, und ein einzelnes Statement ist in SQLite von
 * sich aus atomar: entweder stehen alle Zeilen da oder keine. Eine Transaktion
 * darum herum umschlösse genau eine Anweisung und wäre eine Zusage, die schon
 * gilt. Eine Schleife mit einem INSERT je Zeile wäre der Gegenentwurf und
 * bräuchte die Transaktion dann wirklich — sie ist der teurere Weg zu demselben
 * Ergebnis.
 *
 * **Diese Bauform trägt nur, weil PLAN_HOECHSTZAHL bei 100 steht**, und diese
 * Kopplung steht sonst nirgends: ein mehrzeiliges INSERT bindet zwei Parameter
 * je Zeile (text, due_at), bei 100 Zeilen also 200. SQLite lässt je nach Build
 * 999 oder 32 766 Parameter je Anweisung zu — 200 liegen unter **beiden**
 * Schranken. Wer die Höchstzahl in ../../../aufgabentext.ts je über 499 hebt,
 * muss diese Funktion mitanfassen: sie bräuchte dann eine Zerlegung in Blöcke
 * und damit doch eine Transaktion, weil aus einer Anweisung mehrere würden.
 *
 * Die Texte kommen **fertig geprüft** herein: gefaltet, nicht leer, jeder
 * innerhalb der Längengrenze, und ihre Zahl innerhalb der Höchstzahl. Die
 * Prüfkette steht in ../../../../routes/monatsplan/+page.server.ts, aus
 * demselben Grund wie bei aufgabeAnlegen darüber: eine zweite Prüfstelle wäre
 * eine zweite Wahrheit über dieselbe Regel. Diese Funktion nimmt hin, was sie
 * bekommt.
 *
 * **Eine** Vorbedingung prüft sie trotzdem selbst, und zwar die, deren Bruch
 * nicht in einer falschen Zeile endete, sondern in ungültigem SQL: `values([])`
 * erzeugt ein INSERT ohne VALUES-Klausel und wirft. Die Route fängt den leeren
 * Stapel schon ab, aber nichts verband die zwei Stellen — und ein Wurf aus der
 * Datenschicht wäre für die aufrufende Person eine Fehlerseite statt eines
 * Satzes. Ein leerer Stapel legt hier darum nichts an und gibt die leere Liste
 * zurück: das ist die wahrheitsgemässe Antwort auf „lege keine Zeile an".
 *
 * `faelligAm` ist das **Tagesende** in Europe/Zurich in Unix-Sekunden; die
 * Umrechnung macht tagesendeInUnixSekunden in ../../../zeit.ts, nicht diese
 * Funktion. Sie steht als **eine** Zahl im Parameter und nicht je Zeile, weil
 * genau das die Zusage ist, die geprüft werden soll.
 *
 * createdAt kommt aus dem Schema ($defaultFn), completedBy und completedAt
 * bleiben leer: eine neue Aufgabe ist offen und niemandes. `satisfies NewTask[]`
 * auf den Zeilenobjekten, damit eine später ergänzte Pflichtspalte hier auffällt
 * statt zur Laufzeit.
 *
 * `returning(sichtbareSpalten)` wie jede Funktion dieser Datei — auch hier
 * verwirft die action den Rückgabewert und wirft den Redirect. Der Grund ist
 * die Symmetrie: „diese Datei reicht completed_by nie heraus" soll eine
 * Eigenschaft des Moduls sein und keine Aussage über die heutigen Aufrufer.
 */
export function aufgabenStapelAnlegen(texte: string[], faelligAm: number): NurSichtbar[] {
	if (texte.length === 0) return [];
	return datenbank()
		.insert(tasks)
		.values(texte.map((text) => ({ text, dueAt: faelligAm })) satisfies NewTask[])
		.returning(sichtbareSpalten)
		.all();
}

/**
 * Die offenen Aufgaben, älteste zuerst — jede mit ihrer Wochenzahl.
 *
 * Nur `completed_at IS NULL`: eine erledigte Aufgabe erscheint in keiner
 * Ansicht mehr, auch nicht durchgestrichen. Die durchgestrichene Zeile nach dem
 * Abhaken lebt allein in der Sitzung der abhakenden Person und ist beim nächsten
 * Laden fort — dann auch für alle anderen. Das ist zugleich der erste Konjunkt
 * von AD-8: was hier steht, ist offen, und nur darum darf `wochenOffen`
 * überhaupt einen Wert tragen.
 *
 * Vollständig und ohne Nachladen: bei 40 Beeten und einer Handvoll Aufgaben pro
 * Woche gibt es nichts zu blättern.
 *
 * Die Id als zweites Ordnungskriterium ist keine Zierde. created_at hat die
 * Auflösung einer Sekunde, und zwei in derselben Sekunde erfasste Aufgaben
 * hätten sonst keine festgelegte Reihenfolge: die Liste wechselte zwischen zwei
 * Aufrufen ihre Anordnung, ohne dass sich etwas geändert hat.
 *
 * **Das orderBy reagiert bewusst nicht auf Überfälligkeit.** „Überfällige
 * zuerst" wäre eine andere Story: die Zeile bleibt eine ganz normale
 * Aufgabenzeile an ihrem nach created_at sortierten Platz, und wer die Liste
 * zwei Wochen später wieder aufschlägt, findet sie dort, wo sie war. Eine
 * Umsortierung nach einem Zustand, der sich von selbst ändert, liesse die Liste
 * ohne Zutun anders aussehen.
 *
 * **`dueAt ?? createdAt` ist dieselbe Regel wie AD-8s
 * `COALESCE(due_at, created_at)`**: die Frist zählt ab Fälligkeit, ersatzweise
 * ab Anlage. Eine vor Ort über /aufgabe erfasste Aufgabe hat keine Frist und
 * wird 21 Tage nach ihrer Erfassung überfällig; eine Planaufgabe mit Fälligkeit
 * am Monatsende wird es 21 Tage nach dem Monatsende, auch wenn sie schon 30 Tage
 * liegt.
 *
 * **Warum die Ableitung in TypeScript entsteht und nicht als SQL-COALESCE.**
 * sichtbareSpalten oben ist **eine** Projektion für **alle fünf** Funktionen
 * dieser Datei. Ein Überfälligkeits-Ausdruck darin landete auch im `returning()`
 * von aufgabeAnlegen, aufgabenStapelAnlegen, aufgabeAbhaken und
 * aufgabeWiederOeffnen, wo er nichts bedeutet — eine gerade angelegte Aufgabe
 * ist nie überfällig, eine gerade abgehakte gar nicht mehr offen. Zudem weist
 * das `satisfies Record<keyof SichtbareAufgabe, unknown>` jede Zusatzspalte ab,
 * solange SichtbareAufgabe sie nicht kennt: der SQL-Weg verlangte, den Zeilentyp
 * der **Tabelle** um ein abgeleitetes Feld zu erweitern oder eine zweite
 * Projektion neben die erste zu stellen. AD-8 verbietet eine `is_overdue`-Spalte,
 * einen Cron und einen Job; eine Ableitung im Repository ist keines davon, und
 * „berechnet zur Anzeigezeit" ist erfüllt.
 *
 * Der Preis dieser Entscheidung ist benannt: die Wochenzahl entsteht in
 * JavaScript, es gibt also keinen Weg, überfällige Aufgaben in SQL zu filtern
 * oder zu zählen, falls das je gebraucht wird.
 *
 * @param jetztSekunden Der Bezugszeitpunkt in Unix-**Sekunden**. Er kommt als
 *   Parameter herein und nicht aus einem `Date.now()` in dieser Funktion: die
 *   ganze Liste soll an **einer** Uhr gemessen sein, und der Wert entsteht
 *   serverseitig in der load von / — ein Date.now() im Browser erzeugte einen
 *   Hydrierungsunterschied.
 */
export function offeneAufgabenAuflisten(jetztSekunden: number): OffeneAufgabe[] {
	return datenbank()
		.select(sichtbareSpalten)
		.from(tasks)
		.where(isNull(tasks.completedAt))
		.orderBy(asc(tasks.createdAt), asc(tasks.id))
		.all()
		.map((zeile) => ({
			...zeile,
			wochenOffen: wochenOffenSeit(zeile.dueAt ?? zeile.createdAt, jetztSekunden),
		}));
}

/*
 * Die Spaltenauswahl des Archivs: dieselben vier wie oben, dazu der Zeitpunkt
 * des Abhakens unter seinem deutschen Namen.
 *
 * Sie steht **neben** sichtbareSpalten und ersetzt sie nicht. Eine einzige
 * Projektion für alle sechs Funktionen dieser Datei wäre der bequemere Weg
 * gewesen und der falsche: `erledigtAm` landete dann im `returning()` von
 * aufgabeAnlegen, aufgabenStapelAnlegen, aufgabeAbhaken und
 * aufgabeWiederOeffnen, wo es entweder leer ist oder — beim Abhaken — den
 * Zeitpunkt in die Antwort einer action trüge, die ihn nirgends zeigt. Zwei
 * Projektionen sind hier billiger als eine breite: jede sagt, was ihre Leser
 * sehen dürfen.
 *
 * `satisfies Record<keyof Archivzeile, unknown>` hält die Auswahl an den Typ und
 * weist eine überzählige Spalte ab — insbesondere `completed_by`, das in
 * Archivzeile nicht vorkommt. Die Gegenrichtung fängt die Rückgabeannotation der
 * Funktion darunter.
 */
const archivSpalten = {
	...sichtbareSpalten,
	erledigtAm: tasks.completedAt,
} satisfies Record<keyof Archivzeile, unknown>;

/**
 * Die erledigten Aufgaben, die zuletzt abgehakte zuerst.
 *
 * Das Archiv. Es beantwortet die Frage, die das Produkt bis heute schreibt und
 * nie liest: **was ist in diesem Garten schon getan worden?** Abgehakt wird auf
 * `/`, und dort verschwindet die Zeile beim nächsten Laden — seither lagen
 * `completed_at` und `completed_by` in der Tabelle, ohne dass eine einzige
 * Abfrage sie zurückgelesen hätte. Wer im Oktober den Monatsplan ablegt, sieht
 * hier, was der September wirklich gebracht hat, statt es zu schätzen.
 *
 * **Ohne Namen, und das ist der Kern.** Die Projektion trägt `completed_by`
 * nicht, der Typ verbietet es, und die Seite kann ihn darum nicht anzeigen —
 * dieselbe Kette wie bei SichtbareAufgabe und aus demselben Grund (AD-5). Ein
 * Archiv, das Namen trüge, wäre eine Leistungsabrechnung über eine
 * Nachbarschaft, und die Spec zum Überblicksband verbietet die Auswertung nach
 * Person ausdrücklich auch als Aggregat.
 *
 * **Absteigend, anders als die offene Liste.** Jene ordnet aufsteigend, damit
 * das Älteste oben liegt und niemand es übersieht; ein Archiv liest man von
 * heute rückwärts. Die Id als zweites Kriterium hat denselben Grund wie dort:
 * `completed_at` hat die Auflösung einer Sekunde, und zwei in derselben Sekunde
 * abgehakte Aufgaben hätten sonst keine festgelegte Reihenfolge — die Liste
 * wechselte zwischen zwei Aufrufen ihre Anordnung, ohne dass sich etwas geändert
 * hat.
 *
 * **Der flatMap ist keine zweite Vorbedingung.** `completed_at` ist im Schema
 * nullbar, weil eine offene Aufgabe keinen Zeitpunkt hat; die where-Klausel
 * schliesst jene Zeilen aus, aber der Zeilentyp aus Drizzle weiss davon nichts
 * und bleibt `number | null`. Der leere Zweig ist die Stelle, an der diese
 * Zusage aus SQL in den Typ übersetzt wird. Er ist **unerreichbar**, und er
 * steht trotzdem da statt einer Zusicherung mit `as`: die hätte dieselbe
 * Wirkung, aber keine Prüfung — fiele das `isNotNull` eines Tages aus der
 * where-Klausel, liefe eine Zeile mit `erledigtAm: null` still durch einen Typ,
 * der `number` verspricht, und die Seite formatierte den 1. Januar 1970.
 *
 * **Kein Blättern und kein Index**, dieselbe Entscheidung wie bei den übrigen
 * Abfragen dieser Datei und mit einer benannten Auslösebedingung: zwanzig Leute
 * haken eine Handvoll Aufgaben je Woche ab, was nach einem Gartenjahr ein paar
 * hundert Zeilen ergibt — eine Tabelle, die in wenige Speicherseiten passt, und
 * ein voller Durchlauf, der sie liest. Wer diese Seite je nach Zeitraum
 * **filtert** statt alles zu lesen, liest zum ersten Mal einen Ausschnitt, und
 * dann trägt ein Index auf `completed_at` zum ersten Mal etwas. Dieselbe
 * Auslösebedingung steht in ../schema.ts an signup_tasks.
 *
 * **Kein Bezugszeitpunkt als Parameter**, anders als bei offeneAufgabenAuflisten:
 * hier wird nichts gegen eine Uhr gerechnet. Was das Archiv zeigt, ändert sich
 * nicht dadurch, dass Zeit vergeht.
 */
export function erledigteAufgabenAuflisten(): ErledigteAufgabe[] {
	return datenbank()
		.select(archivSpalten)
		.from(tasks)
		.where(isNotNull(tasks.completedAt))
		.orderBy(desc(tasks.completedAt), desc(tasks.id))
		.all()
		.flatMap((zeile) =>
			zeile.erledigtAm === null ? [] : [{ ...zeile, erledigtAm: zeile.erledigtAm }]
		);
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
export function aufgabeAbhaken(id: number, mitgliedId: number): NurSichtbar | null {
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
export function aufgabeWiederOeffnen(id: number): NurSichtbar | null {
	const zeile = datenbank()
		.update(tasks)
		.set({ completedBy: null, completedAt: null })
		.where(and(eq(tasks.id, id), isNotNull(tasks.completedAt)))
		.returning(sichtbareSpalten)
		.get();
	return zeile ?? null;
}

/**
 * Ändert den Text einer **offenen** Aufgabe und gibt die getroffene Zeile
 * zurück, oder null.
 *
 * **Nur solange sie offen ist**, und das ist dieselbe Vorbedingung wie beim
 * Abhaken, aus einem anderen Grund: eine abgehakte Aufgabe ist Historie. FR14
 * sagt zu, dass die abgehakten Aufgaben einer ausgetretenen Person stehen
 * bleiben; sie im Nachhinein umzuschreiben nähme dieser Zusage ihren Inhalt.
 * Wer den Text einer erledigten Zeile ändern will, öffnet sie wieder — dann ist
 * sie offen, und dann darf er.
 *
 * **`bekannterText` ist kein Beiwerk.** Er steht in der where-Klausel wie der
 * bekannte Name bei mitgliedUmbenennen, und er schliesst dasselbe Fenster: zwei
 * Leute sehen dieselbe Zeile, beide tippen, und ohne diese Bedingung gewönne
 * stillschweigend der zweite Versand. Mit ihr bekommt der zweite null und damit
 * einen Satz statt eines lautlos überschriebenen Textes.
 *
 * Der Text kommt **fertig geprüft** herein — gefaltet, nicht leer, innerhalb der
 * Längengrenze. Die Prüfkette steht in der Route, aus demselben Grund wie bei
 * aufgabeAnlegen: eine zweite Prüfstelle wäre eine zweite Wahrheit über
 * dieselbe Regel.
 *
 * Das null ist wie überall in dieser Datei mehrdeutig — nicht vorhanden,
 * abgehakt, oder der Text hat sich inzwischen bewegt. Die Route macht daraus
 * einen Satz und keine Auskunft darüber, welcher der drei Fälle eintrat: alle
 * drei enden in derselben Handlung, nämlich die Liste neu zu laden.
 */
export function aufgabeAendern(
	id: number,
	text: string,
	bekannterText: string
): NurSichtbar | null {
	const zeile = datenbank()
		.update(tasks)
		.set({ text })
		.where(and(eq(tasks.id, id), isNull(tasks.completedAt), eq(tasks.text, bekannterText)))
		.returning(sichtbareSpalten)
		.get();
	return zeile ?? null;
}

/**
 * Entfernt eine **offene** Aufgabe und gibt die getroffene Zeile zurück, oder
 * null.
 *
 * **Hart gelöscht, und das ist entschieden und nicht übersehen** (2026-09-13).
 * Die Alternative wäre ein `deleted_at` gewesen — eine Migration, eine dritte
 * Bedingung in jeder Abfrage dieser Datei und genau jenes Statusfeld neben
 * completed_at, das der Kommentar an der Spalte im Schema ausdrücklich
 * ausschliesst. Offen und erledigt unterscheidet eine Spalte; ein drittes
 * „entfernt" machte aus der einen Wahrheit zwei.
 *
 * Getragen wird der harte Schnitt von der Vorbedingung: **nur Offenes geht
 * fort.** Eine abgehakte Zeile trägt completed_by, und damit die Historie, die
 * FR14 zusagt — die ist unerreichbar für diese Funktion. Was hier gelöscht
 * wird, hat nie jemand erledigt und hinterlässt darum auch nichts.
 *
 * `bekannterText` wie bei aufgabeAendern darüber, und hier wiegt er schwerer:
 * ohne ihn entfernte ein zweiter Versand eine Zeile, deren Text sich inzwischen
 * geändert hat — also eine andere Aufgabe als die, die jemand wegnehmen wollte.
 *
 * `returning(sichtbareSpalten)` auch beim DELETE, wie jede Funktion dieser
 * Datei. Der Rückgabewert ist hier wirklich in Gebrauch: die Route nennt den
 * entfernten Text in ihrer Rückmeldung, damit ein Fehlgriff sichtbar wird,
 * solange er noch frisch ist.
 */
export function aufgabeEntfernen(id: number, bekannterText: string): NurSichtbar | null {
	const zeile = datenbank()
		.delete(tasks)
		.where(and(eq(tasks.id, id), isNull(tasks.completedAt), eq(tasks.text, bekannterText)))
		.returning(sichtbareSpalten)
		.get();
	return zeile ?? null;
}
