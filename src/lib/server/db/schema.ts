import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/*
 * Das Schema. Es hängt von nichts ab — keine Verbindung, keine Umgebung, kein
 * SvelteKit —, damit drizzle-kit es beim Erzeugen der Migrationen laden kann.
 *
 * snake_case in der Datenbank, camelCase in TypeScript; die Abbildung macht
 * Drizzle. Zeitstempel sind Integer in Unix-Sekunden, nie ISO-Strings und nie
 * Date-Objekte.
 *
 * In diesem Stand gibt es vier Tabellen: members aus Story 1.2, tasks aus
 * Story 1.4 (seit Story 2.1 um due_at erweitert), duty_weeks aus Story 3.1 und
 * signup_tasks aus Story 3.2. Story 2.2 hat an tasks **nichts** geändert: die
 * Überfälligkeit wird gerechnet und nicht gespeichert, und die Rechnung steht
 * in src/lib/zeit.ts. Getrennte Tabellen ohne gemeinsame
 * Zuständigkeitsspalte, keine Basistabelle und keine Typspalte darüber (AD-3):
 * die drei Aufgabenarten sind verschieden verbindlich, und genau das soll das
 * Schema zeigen — nachlesbar an **einer** Spalte:
 *
 *   tasks         keine Mitgliedsspalte für die Zuständigkeit  namenlos
 *   signup_tasks  member_id **nullbar**                        null oder eine
 *   duty_weeks    member_id **nicht nullbar**                  genau eine
 */
export const members = sqliteTable('members', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
	/*
	 * Nur der SHA-256-Hash des Einladungstokens, 64 Hex-Zeichen. Der Klartext
	 * wird nie gespeichert, nie geloggt und nie ausgeliefert — er erscheint genau
	 * einmal auf der Konsole von scripts/create-admin.ts.
	 *
	 * unique, weil zwei Mitglieder mit demselben Token bedeuten würden, dass ein
	 * Link zwei Identitäten öffnet.
	 */
	inviteTokenHash: text('invite_token_hash').notNull().unique(),
	isAdmin: integer('is_admin', { mode: 'boolean' }).notNull().default(false),
	/*
	 * Zugang beenden heisst deaktivieren, nicht löschen: die Historie bleibt.
	 * Der Wächter in src/hooks.server.ts liest diesen Wert bei jedem Aufruf neu.
	 */
	isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
	/*
	 * Der Zeitstempel steht über $defaultFn im Schema und nicht in der
	 * Einfügefunktion. Sonst müsste jede künftige Einfügestelle ihn wiederholen,
	 * und eine wird ihn vergessen.
	 */
	createdAt: integer('created_at')
		.notNull()
		.$defaultFn(() => Math.floor(Date.now() / 1000)),
});

// Zeilentypen kommen aus dem Schema, nie aus handgeschriebenen Interfaces.
export type Member = typeof members.$inferSelect;
export type NewMember = typeof members.$inferInsert;

/**
 * Das angemeldete Mitglied, wie es der Wächter in locals legt: **ohne** die
 * Hash-Spalte.
 *
 * Die vollständige Zeile in locals zu legen hiesse, den invite_token_hash in
 * jede Load-Funktion und damit in Reichweite jedes künftigen `return { … }` zu
 * tragen. Der Hash ist kein Anzeigewert, und ein Leck daraus wäre still: er
 * sähe in einer JSON-Antwort wie eine beliebige Kennung aus. Die Projektion
 * kostet nichts und nimmt Story 1.3 die Gelegenheit.
 */
export type AngemeldetesMitglied = Omit<Member, 'inviteTokenHash'>;

/**
 * Wirft die Hash-Spalte weg.
 *
 * Die zweite Stelle mit derselben Spaltenliste ist `ohneHashSpalte` in
 * ./queries/members.ts — die Spaltenauswahl für jede Abfrage, deren Ergebnis
 * eine load-Funktion verlässt. Die beiden sind gegeneinander abgesichert und
 * nicht bloss gleich geschrieben: dort hält ein
 * `satisfies Record<keyof AngemeldetesMitglied, unknown>` die Auswahl an diesen
 * Typ, und hier hält die Rückgabeannotation dieselbe Funktion. Eine neue Spalte
 * im Schema fällt darum in **beiden** auf, nicht nur in der, an die gerade
 * jemand gedacht hat.
 */
export function ohneTokenHash(mitglied: Member): AngemeldetesMitglied {
	// Bewusst ausgeschrieben und nicht über eine Auslassung gebildet: eine neue
	// Spalte soll hier auffallen, statt still mitzureisen.
	return {
		id: mitglied.id,
		name: mitglied.name,
		isAdmin: mitglied.isAdmin,
		isActive: mitglied.isActive,
		createdAt: mitglied.createdAt,
	};
}

/**
 * Der offene Pool. Eine Aufgabe, die jedes Mitglied abhaken darf.
 *
 * **Keine Spalte für eine vorab zuständige Person** — und das ist keine
 * Auslassung, sondern der Kern von AD-2. Namen an allem macht das Werkzeug zum
 * Dienstplan und vertreibt die spontan Kommenden: wer am Samstag im Garten
 * steht, soll eine Aufgabe erledigen können, ohne zu prüfen, ob sie ihm
 * zugeteilt war. Eine spätere Story, die eine solche Spalte „nachträgt", nimmt
 * dem Pool seinen Zweck. Wer eine Zuständigkeit braucht, baut sie in
 * signup_tasks (Epic 3), nicht hier.
 *
 * due_at steht seit Story 2.1 hier — der Monatsplan setzt es einmal für den
 * ganzen Stapel. Eine Überfälligkeits**spalte** gibt es nicht und soll es nicht
 * geben: die Überfälligkeit wird seit Story 2.2 **zur Anzeigezeit gerechnet**,
 * aus dueAt ?? createdAt gegen den Zeitpunkt, den die load von / mitgibt. Die
 * Schwelle und die Rechnung stehen in src/lib/zeit.ts (wochenOffenSeit), die
 * Ableitung je Zeile in ./queries/tasks.ts (offeneAufgabenAuflisten). Es gibt
 * keinen Cron und keinen Hintergrundjob — zwei Wahrheiten liefen auseinander,
 * sobald ein Job einmal nicht läuft.
 */
export const tasks = sqliteTable('tasks', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	/*
	 * Der ganze Inhalt einer Aufgabe: ein Satz, den jemand im Garten liest.
	 * Kein Titel plus Beschreibung, kein Beet-Bezug, keine Kategorie — jeder
	 * Aufwand pro Beet oder pro Pflanze ist bei 40+ Beeten Ausschlusskriterium.
	 */
	text: text('text').notNull(),
	/*
	 * Wer abgehakt hat. Gesetzt, aber **nirgends angezeigt** (AD-5): nicht im
	 * Text, nicht als Titel-Attribut, nicht in einem data-Attribut und nicht in
	 * den Seitendaten. Darum kommt die Spalte in SichtbareAufgabe unten gar
	 * nicht vor — siehe die Begründung dort.
	 *
	 * Der Fremdschlüssel ist tragfähig, weil Zugang beenden deaktiviert statt
	 * löscht: die Mitgliedszeile bleibt stehen, und die Historie eines
	 * ausgetretenen Mitglieds bricht nicht auf.
	 *
	 * nullable, weil eine offene Aufgabe niemanden hat.
	 */
	completedBy: integer('completed_by').references(() => members.id),
	/*
	 * Wann abgehakt wurde, in Unix-Sekunden. Zugleich **die** Unterscheidung
	 * zwischen offen und erledigt: die Abfragen in ./queries/tasks.ts tragen
	 * `completed_at IS NULL` beziehungsweise `IS NOT NULL` als Vorbedingung in
	 * der where-Klausel. Es gibt bewusst kein Statusfeld daneben — zwei Quellen
	 * für denselben Zustand geraten auseinander.
	 *
	 * Kein $defaultFn: der Wert entsteht nicht beim Anlegen, sondern beim
	 * Abhaken, und dort setzt ihn aufgabeAbhaken.
	 */
	completedAt: integer('completed_at'),
	/*
	 * Bis wann die Aufgabe erledigt sein soll, in Unix-Sekunden — und zwar auf
	 * dem **Ende** des gewählten Tages in Europe/Zurich (src/lib/zeit.ts), nicht
	 * auf Mitternacht UTC: `Fällig bis 31. August` heisst umgangssprachlich „bis
	 * der 31. vorbei ist".
	 *
	 * Gesetzt vom Monatsplan, und zwar **einmal für den ganzen Stapel** — ein
	 * Monatsplan hat ein Fälligkeitsdatum, nicht eines pro Zeile.
	 *
	 * nullable und ohne $defaultFn, weil eine vor Ort über /aufgabe erfasste
	 * Aufgabe keine Frist hat: sie entsteht nicht beim Anlegen, sondern kommt vom
	 * Stapel. Genau diese Lücke fängt die Überfälligkeitsrechnung seit Story 2.2
	 * mit `dueAt ?? createdAt` ab — die Frist zählt ab Fälligkeit, ersatzweise ab
	 * Anlage. Eine Planaufgabe mit Fälligkeit am Monatsende ist damit auch dann
	 * nicht überfällig, wenn sie schon 30 Tage liegt.
	 *
	 * **Kein Index**, und das ist eine Entscheidung und keine Auslassung: die
	 * Überfälligkeit entsteht nicht in SQL, sondern in TypeScript über
	 * `dueAt ?? createdAt` (siehe ./queries/tasks.ts) — ein Index auf einer der
	 * beiden Spalten griffe darauf ohnehin nicht, und die Liste ist ein voller
	 * Durchlauf ohne Blättern. Zwanzig Leute und eine Handvoll Aufgaben je Woche
	 * ergeben eine Tabelle, die auf Jahre in eine Speicherseite passt; ein Index
	 * kostete dort mehr Schreibarbeit, als er an Lesearbeit spart.
	 */
	dueAt: integer('due_at'),
	/*
	 * Wie bei members über $defaultFn im Schema und nicht in der
	 * Einfügefunktion. Zugleich die Sortierung der Liste: älteste zuerst.
	 */
	createdAt: integer('created_at')
		.notNull()
		.$defaultFn(() => Math.floor(Date.now() / 1000)),
});

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;

/**
 * Die Aufgabe, wie sie eine Seite sehen darf: **ohne** completedBy und
 * completedAt.
 *
 * AD-5 verbietet nicht nur die Anzeige, sondern jede Zuordnung. Die Liste zeigt
 * ohnehin nur offene Aufgaben, dort sind beide Spalten leer — die Spalten aus
 * dem Typ herauszulassen macht aus einer Zusage der Oberfläche eine Eigenschaft
 * des Typs: die Seite **kann** den Abhakenden nicht ausliefern, weil das Feld
 * nicht existiert. Dasselbe Muster wie invite_token_hash in den Stories 1.2
 * und 1.3.
 *
 * Die Absicherung schliesst beide Richtungen, und beide Hälften stehen in
 * ./queries/tasks.ts an der einen Spaltenauswahl:
 *   - eine **überzählige** Spalte fängt dort das
 *     `satisfies Record<keyof SichtbareAufgabe, unknown>` auf dem
 *     Objektliteral — insbesondere completedBy und completedAt, die in diesem
 *     Typ gerade nicht vorkommen;
 *   - eine **fehlende** Spalte fängt die Rückgabeannotation jeder der drei
 *     Abfragefunktionen, weil das projizierte Zeilenergebnis dann nicht mehr
 *     auf SichtbareAufgabe passt.
 * Anders als bei members steht hier **keine** Handfunktion wie ohneTokenHash
 * daneben: kein Weg der Anwendung hält je eine vollständige Task-Zeile, die zu
 * verengen wäre. Jede Abfrage projiziert schon in der Datenbank.
 */
export type SichtbareAufgabe = Omit<Task, 'completedBy' | 'completedAt'>;

/**
 * Der Dienstplan. Eine Woche, eine zuständige Person — und diese Verbindlichkeit
 * steht im Schema, nicht in einer Regel der Oberfläche.
 *
 * **Der Gegenentwurf zu tasks.** Dort gibt es bewusst keine Zuständigkeitsspalte
 * (AD-2): der Pool ist namenlos, jede greift, was sie schafft. Hier trägt eine
 * Sache genau einen Namen, **bevor** sie getan wird. Die zwei Tabellen sehen
 * einander darum nicht ähnlich, und eine gemeinsame Basistabelle mit einer
 * Typspalte hätte den Unterschied verdeckt, um den es geht (AD-4).
 *
 * **Woche statt Datum.** Ein Tränkedienst gilt für eine Kalenderwoche, nicht für
 * einen Tag. Ein gespeicherter Montag müsste bei jeder Anzeige zurück in eine
 * Woche gerechnet werden, und über den Jahreswechsel — ISO-Woche 1 beginnt im
 * Dezember — liefen die zwei Rechnungen auseinander. Die Rechnung selbst steht
 * an einer Stelle, in src/lib/zeit.ts (isoWocheVon, wochenfenster).
 */
export const dutyWeeks = sqliteTable(
	'duty_weeks',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		/*
		 * Die Dienstart. Sie steht als Spalte, obwohl in diesem Epic allein der
		 * Tränkedienst eine Oberfläche bekommt: eine zweite Art braucht dann keine
		 * Schemaänderung und keine Migration, sondern nur eine Ansicht. Der einzige
		 * heute geschriebene Wert steht als DIENSTART_TRAENKEN darunter — ein
		 * Literal in einer Route wäre die zweite Wahrheit darüber.
		 *
		 * Kein Fremdschlüssel auf eine Arten-Tabelle: eine Tabelle mit einer Zeile
		 * ist ein Wert, keine Beziehung.
		 */
		art: text('art').notNull(),
		/*
		 * Das **ISO**-Jahr, nicht das Kalenderjahr des Montags. Die beiden fallen
		 * am Jahreswechsel auseinander: der 1. Januar 2027 gehört zur Woche 53 des
		 * ISO-Jahres 2026. Wer hier das Kalenderjahr einträgt, legt dieselbe Woche
		 * zweimal an.
		 */
		isoJahr: integer('iso_jahr').notNull(),
		/** Die ISO-Kalenderwoche, 1 bis 52 oder 53. */
		isoWoche: integer('iso_woche').notNull(),
		/*
		 * Wer zuständig ist — **nicht nullbar**, und das ist der Kern.
		 *
		 * Eine nullbare Spalte hiesse: es gibt eine Zeile für eine Woche, die
		 * niemandem gehört. Dann wäre „unbesetzt" ein Zustand, den man **anlegen**
		 * kann, und der Dienstplan bekäme leere Datensätze, die niemand je wieder
		 * anfasst. Unbesetzt entsteht statt dessen auf genau zwei Wegen, und beide
		 * sind Abwesenheit: gar keine Zeile, oder eine Zeile auf ein beendetes
		 * Mitglied.
		 *
		 * Der Fremdschlüssel ist tragfähig, weil Zugang beenden deaktiviert statt
		 * löscht — dieselbe Begründung wie bei tasks.completed_by. Die künftigen
		 * Dienstwochen eines ausgetretenen Mitglieds bleiben darum als Datensatz
		 * stehen und werden als unbesetzt **dargestellt**, bis die Verwaltung sie
		 * neu besetzt.
		 */
		memberId: integer('member_id')
			.notNull()
			.references(() => members.id),
		/* Wie bei members und tasks über $defaultFn im Schema. */
		createdAt: integer('created_at')
			.notNull()
			.$defaultFn(() => Math.floor(Date.now() / 1000)),
	},
	/*
	 * **Genau eine Person je Woche** — die Zusage der Story, durchgesetzt von der
	 * Datenbank und nicht von einer Prüfung in der Route.
	 *
	 * Ein Tausch ist damit zwangsläufig ein UPDATE derselben Zeile: ein zweites
	 * INSERT für dieselbe Woche fällt hier auf, statt still eine zweite
	 * zuständige Person anzulegen, von denen die Liste dann eine zeigt und die
	 * andere verschweigt.
	 *
	 * Über die drei Spalten zusammen und nicht über Jahr und Woche allein: eine
	 * zweite Dienstart hätte in derselben Woche eine eigene zuständige Person.
	 */
	(tabelle) => [
		uniqueIndex('duty_weeks_art_jahr_woche').on(tabelle.art, tabelle.isoJahr, tabelle.isoWoche),
	]
);

export type DutyWeek = typeof dutyWeeks.$inferSelect;
export type NewDutyWeek = typeof dutyWeeks.$inferInsert;

/**
 * Die einzige heute geschriebene Dienstart.
 *
 * Sie steht als Konstante neben der Tabelle und nicht als Literal in der Route:
 * die Spalte trägt einen Wert, den Abfrage und Einfügung gleich schreiben
 * müssen, und zwei Schreibweisen ergäben zwei Dienstpläne, von denen einer leer
 * aussieht.
 */
export const DIENSTART_TRAENKEN = 'traenken';

/**
 * Die ausgeschriebene Einzelaufgabe. Setzlinge abholen, den Anhänger fahren —
 * etwas Unregelmässiges, das genau **eine** Person übernimmt, und für alle
 * sichtbar, ob und wer.
 *
 * **Die mittlere der drei Verbindlichkeiten** (AD-4), und sie steht in der
 * Nullbarkeit einer einzigen Spalte. tasks hat für die Zuständigkeit gar keine
 * Spalte: der Pool ist namenlos, jede greift, was sie schafft. duty_weeks hat
 * eine **nicht nullbare**: eine Dienstwoche ohne zuständige Person ist kein
 * Datensatz, sondern seine Abwesenheit. Hier ist sie **nullbar**, denn beide
 * Zustände sind echte Zustände derselben Sache: ausgeschrieben und noch frei,
 * oder ausgeschrieben und übernommen. Genau dieser Unterschied ist der Grund,
 * warum es keine Basistabelle über den drei Arten gibt — sie hätte ihn verdeckt.
 *
 * **Kein Erledigt-Zustand.** Es gibt kein completed_at und kein Abhaken: eine
 * Einzelaufgabe ist getan, wenn der Termin vorbei ist, und wer sie übernommen
 * hat, hat das vor allen zugesagt. Ein Häkchen daneben wäre eine zweite
 * Verbindlichkeit über derselben Sache.
 */
export const signupTasks = sqliteTable('signup_tasks', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	/*
	 * Worum es geht, in einem Satz — dieselbe Auslegung wie bei tasks.text und
	 * durch dieselbe Kette geprüft: aufgabentextFalten und AUFGABE_HOECHSTLAENGE
	 * in src/lib/aufgabentext.ts. Kein Titel plus Beschreibung, kein Ort, keine
	 * Kategorie.
	 */
	titel: text('titel').notNull(),
	/*
	 * Wann sie fällig ist, in Unix-Sekunden auf dem **Ende** des gewählten Tages
	 * in Europe/Zurich — dieselbe Umrechnung wie bei tasks.due_at, über
	 * tagesendeInUnixSekunden in src/lib/zeit.ts.
	 *
	 * **notNull, anders als due_at.** Eine Poolaufgabe darf ohne Frist entstehen:
	 * wer im Beet steht, tippt einen Satz und ist fertig. Eine Einzelaufgabe ohne
	 * Termin wäre dagegen keine: „jemand holt irgendwann Setzlinge" ist genau die
	 * Unverbindlichkeit, gegen die diese Tabelle steht. Der Termin ist Teil
	 * dessen, was übernommen wird — er steht im Bestätigungssatz.
	 */
	terminAt: integer('termin_at').notNull(),
	/*
	 * Wer übernommen hat — **nullbar**, und das ist der Kern dieser Tabelle.
	 *
	 * null heisst: ausgeschrieben, noch frei. Ein Wert heisst: diese Person hat
	 * zugesagt, und ihr Name steht daneben. Es gibt genau einen Übernehmer und
	 * keine Warteliste; ein zweiter müsste die Spalte überschreiben, und genau
	 * das verhindert die Vorbedingung im UPDATE (./queries/signup-tasks.ts).
	 *
	 * Der Fremdschlüssel ist tragfähig, weil Zugang beenden deaktiviert statt
	 * löscht — dieselbe Begründung wie bei tasks.completed_by und
	 * duty_weeks.member_id. Die Zeile eines ausgetretenen Mitglieds bleibt darum
	 * stehen; **dargestellt** wird die Einzelaufgabe wieder als frei, und die
	 * Nächste kann sie nehmen. Das ist die andere Folge als beim Dienstplan, wo
	 * dieselbe Lage auf `— unbesetzt —` fällt und auf die Verwaltung wartet: eine
	 * Einzelaufgabe darf sich jede holen, eine Dienstwoche teilt die Verwaltung
	 * zu.
	 *
	 * Es gibt bewusst **keine** Zeitmarke der Übernahme daneben. Sie stünde in
	 * keiner Ansicht und beantwortete keine Frage; wer wann zugesagt hat, ist
	 * keine Auskunft, die diese Gemeinschaft von ihrem Werkzeug erwartet.
	 */
	memberId: integer('member_id').references(() => members.id),
	/* Wie bei members, tasks und duty_weeks über $defaultFn im Schema. */
	createdAt: integer('created_at')
		.notNull()
		.$defaultFn(() => Math.floor(Date.now() / 1000)),
});

/*
 * **Kein Index**, und das ist eine Entscheidung wie bei tasks und keine
 * Auslassung. Die Listen ordnen nach termin_at und lesen den Namen über einen
 * leftJoin auf members.id — der Primärschlüssel der anderen Seite, der ohnehin
 * einen Index hat. Was ein Index auf termin_at spart, ist die Sortierung einer
 * Tabelle, die auf Jahre in eine Speicherseite passt: zwanzig Leute schreiben
 * eine Handvoll Einzelaufgaben im Jahr aus, und es gibt kein Blättern und keine
 * Filterung in SQL. Er kostete dafür Schreibarbeit an jeder Zeile.
 *
 * Die Auslösebedingung ist benannt: eine Ansicht, die nach Zeitraum **filtert**
 * statt alles zu lesen — etwa ein Archiv vergangener Termine. Dann liest die
 * Abfrage einen Ausschnitt statt der ganzen Tabelle, und ein Index auf
 * termin_at trägt zum ersten Mal etwas.
 */

export type SignupTask = typeof signupTasks.$inferSelect;
export type NewSignupTask = typeof signupTasks.$inferInsert;
