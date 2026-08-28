import { and, asc, eq, isNotNull, isNull } from 'drizzle-orm';
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
