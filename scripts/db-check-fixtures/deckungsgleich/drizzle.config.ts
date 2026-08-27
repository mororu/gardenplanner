import { defineConfig } from 'drizzle-kit';

// Gegenprobe: Schema und Migrationskette sind deckungsgleich, der Fail-Fast ist
// vorhanden. db:check muss hier schweigen und mit 0 enden.
const datenbankPfad = process.env.DATABASE_PATH?.trim();

if (!datenbankPfad) {
	console.error('DATABASE_PATH ist nicht gesetzt.');
	process.exit(1);
}

export default defineConfig({
	dialect: 'sqlite',
	schema: './src/lib/server/db/schema.ts',
	out: './drizzle',
	dbCredentials: { url: datenbankPfad },
});
