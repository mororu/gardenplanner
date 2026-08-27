import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/*
 * Das Schema. Es hängt von nichts ab — keine Verbindung, keine Umgebung, kein
 * SvelteKit —, damit drizzle-kit es beim Erzeugen der Migrationen laden kann.
 *
 * snake_case in der Datenbank, camelCase in TypeScript; die Abbildung macht
 * Drizzle. Zeitstempel sind Integer in Unix-Sekunden, nie ISO-Strings und nie
 * Date-Objekte.
 *
 * In dieser Story gibt es genau eine Tabelle: tasks kommt mit Story 1.4,
 * duty_weeks und signup_tasks mit Epic 3.
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

/** Wirft die Hash-Spalte weg. Die einzige Stelle, die das tut. */
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
