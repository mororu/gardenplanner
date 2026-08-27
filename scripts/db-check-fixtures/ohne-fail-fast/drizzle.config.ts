import { defineConfig } from 'drizzle-kit';

// Fehlerprobe: kein Fail-Fast, sondern ein erfundener Vorgabewert. Genau die
// Mutation, die in Iteration 3 alle Tore grün liess — der eingefrorene Block
// verbietet jeden Vorgabewert für eine Umgebungsvariable.
const datenbankPfad = process.env.DATABASE_PATH?.trim() ?? './data/dev.sqlite';

export default defineConfig({
	dialect: 'sqlite',
	schema: './src/lib/server/db/schema.ts',
	out: './drizzle',
	dbCredentials: { url: datenbankPfad },
});
