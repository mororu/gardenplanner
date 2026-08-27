import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/*
 * Das Schema. Es hängt von nichts ab — keine Verbindung, keine Umgebung, kein
 * SvelteKit —, damit drizzle-kit es beim Erzeugen der Migrationen laden kann.
 *
 * snake_case in der Datenbank, camelCase in TypeScript; die Abbildung macht
 * Drizzle. Zeitstempel sind Integer in Unix-Sekunden, nie ISO-Strings und nie
 * Date-Objekte.
 *
 * In diesem Stand gibt es zwei Tabellen: members aus Story 1.2 und tasks aus
 * Story 1.4. duty_weeks und signup_tasks kommen mit Epic 3. Drei getrennte
 * Tabellen ohne gemeinsame Zuständigkeitsspalte, keine Basistabelle und keine
 * Typspalte darüber (AD-3).
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
 * Ebenfalls nicht hier: due_at und jede Frist- oder Überfälligkeitslogik. Das
 * ist Epic 2, das diese Tabelle ausdrücklich noch einmal anfasst.
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
