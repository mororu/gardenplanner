import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Fehlerproben-Schema, absichtlich winzig und ohne Bezug zur Anwendung: die
// Probe darf nicht mitwandern, wenn members eine Spalte bekommt.
export const probe = sqliteTable('probe', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
});
