import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Fehlerprobe zum Drift-Schutz: `notiz` steht im Schema, aber in keiner
// Migration. Genau so baut eine Änderung grün durch und stirbt beim ersten
// Aufruf am laufenden Server.
export const probe = sqliteTable('probe', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
	notiz: text('notiz'),
});
