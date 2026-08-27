import { defineConfig } from 'drizzle-kit';

/*
 * Konfiguration für drizzle-kit. Diese Datei läuft ausserhalb des Servers —
 * drizzle-kit lädt sie in einem eigenen Prozess —, darum prüft sie DATABASE_PATH
 * selbst und verlässt sich nicht auf den init-Hook aus src/hooks.server.ts.
 *
 * dbCredentials.url ist für dialect: 'sqlite' Pflicht, auch wenn `generate` die
 * Datenbank nie öffnet. Ein Vorgabewert kommt trotzdem nicht in Frage: er würde
 * beim ersten `push` oder `studio` auf eine erfundene Datei zeigen.
 */
const datenbankPfad = process.env.DATABASE_PATH?.trim();

if (!datenbankPfad) {
	// Benannte Meldung, kein Wurf: ein Stacktrace hilft hier niemandem.
	console.error(
		'DATABASE_PATH ist nicht gesetzt. drizzle-kit braucht den Pfad zur SQLite-Datei.\n' +
			'Lege .env nach dem Muster von .env.example an, zum Beispiel mit\n' +
			'  DATABASE_PATH=./data/dev.sqlite'
	);
	process.exit(1);
}

export default defineConfig({
	dialect: 'sqlite',
	// Diese zwei Werte liest scripts/db-check.ts textuell aus dieser Datei nach.
	// Wer sie hier ändert, muss sie dort mitziehen — sonst prüft db:check ein
	// anderes Schema als db:generate schreibt.
	schema: './src/lib/server/db/schema.ts',
	out: './drizzle',
	dbCredentials: { url: datenbankPfad },
});
