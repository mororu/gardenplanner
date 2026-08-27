import { defineConfig } from 'drizzle-kit';

// Fehlerprobe: das Schema trägt eine Spalte, die in der Migrationskette fehlt.
// db:check muss das melden und mit 1 enden.
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
