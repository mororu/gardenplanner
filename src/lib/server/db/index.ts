import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema.ts';

/*
 * Die Datenbankverbindung.
 *
 * Das Modulladen ist ausdrücklich nebenwirkungsfrei: kein Lesen einer
 * Umgebungsvariablen, kein Öffnen einer Datei, kein Wurf. Der Analyseschritt von
 * `vite build` importiert jedes Servermodul einmal; eine Prüfung beim Modulladen
 * machte `npm run build` im frisch geklonten Zustand unmöglich. Alles Wirksame
 * steht in datenschichtStarten(), gerufen aus dem init-Hook in
 * src/hooks.server.ts und ausdrücklich aus scripts/create-admin.ts.
 *
 * Die Schicht ist synchron: better-sqlite3 kennt kein Promise, und bei zwanzig
 * Personen auf einer SQLite-Datei ist das die richtige Bauform. Unter diesem
 * Verzeichnis kommt darum kein async, kein await und kein Promise vor.
 */

type Datenschicht = BetterSQLite3Database<typeof schema>;

let datenschicht: Datenschicht | null = null;

/**
 * Öffnet die Datenbank, setzt die Pragmas und fährt die Migrationskette hoch.
 * Mehrfach gerufen tut der zweite Aufruf nichts — ein Prozess, eine Verbindung.
 *
 * Jeder Fehlschlag wird eine benannte deutsche Meldung, nie ein Stacktrace.
 */
export function datenschichtStarten(): void {
	if (datenschicht !== null) return;

	const pfad = process.env.DATABASE_PATH?.trim();
	if (!pfad) {
		throw new Error(
			'DATABASE_PATH ist nicht gesetzt. Es gibt bewusst keinen Vorgabewert:\n' +
				'ein erfundener Pfad legt still eine zweite, leere Datenbank an.\n' +
				'Lege .env nach dem Muster von .env.example an, zum Beispiel mit\n' +
				'  DATABASE_PATH=./data/dev.sqlite'
		);
	}

	const verzeichnis = dirname(resolve(pfad));
	if (!existsSync(verzeichnis)) {
		throw new Error(
			`Das Verzeichnis für die Datenbank fehlt: ${verzeichnis}\n` +
				'SQLite legt Verzeichnisse nicht selbst an. Erstelle es einmal, zum Beispiel\n' +
				`  mkdir -p ${verzeichnis}`
		);
	}

	let verbindung: Database.Database;
	try {
		verbindung = new Database(pfad);
	} catch (fehler) {
		throw new Error(
			`Die Datenbank ${pfad} lässt sich nicht öffnen: ${meldung(fehler)}\n` +
				'Häufigste Ursache ist ein nicht schreibbares Verzeichnis.',
			{ cause: fehler }
		);
	}

	try {
		// WAL erlaubt Lesen während eines Schreibvorgangs und bleibt in der Datei
		// vermerkt — einmal setzen genügt, wir setzen es trotzdem bei jedem Start.
		verbindung.pragma('journal_mode = WAL');
		// SQLite lässt Fremdschlüssel sonst unbeachtet.
		verbindung.pragma('foreign_keys = ON');
		// Ohne busy_timeout wirft der erste gleichzeitige Schreibzugriff sofort
		// SQLITE_BUSY. create-admin neben dem laufenden Entwicklungsserver ist
		// genau dieser Fall und der Normalfall.
		verbindung.pragma('busy_timeout = 5000');
	} catch (fehler) {
		throw new Error(
			`Ein Pragma auf ${pfad} ist fehlgeschlagen: ${meldung(fehler)}\n` +
				'Ohne WAL, foreign_keys und busy_timeout startet die Anwendung nicht.',
			{ cause: fehler }
		);
	}

	const geöffnet = drizzle(verbindung, { schema });

	try {
		// Der Ordner ist arbeitsverzeichnisrelativ. Im Produktionsbau muss drizzle/
		// darum neben build/ liegen — siehe README.md.
		migrate(geöffnet, { migrationsFolder: 'drizzle' });
	} catch (fehler) {
		throw new Error(
			`Die Migrationen aus drizzle/ liefen nicht durch: ${meldung(fehler)}\n` +
				'Liegt der Ordner drizzle/ neben dem Arbeitsverzeichnis? Erzeugen mit\n' +
				'  npm run db:generate',
			{ cause: fehler }
		);
	}

	datenschicht = geöffnet;
}

/**
 * Das Drizzle-Handle. Nur die Abfragen unter queries/ rufen das auf; unter
 * src/routes/ ist der Import dieser Datei verboten und wird von Regel 9 in
 * scripts/gate.mjs abgewiesen.
 */
export function datenbank(): Datenschicht {
	if (datenschicht === null) {
		throw new Error(
			'Die Datenschicht ist nicht gestartet. datenschichtStarten() gehört in den\n' +
				'init-Hook in src/hooks.server.ts, bei Skripten an den Anfang des Ablaufs.'
		);
	}
	return datenschicht;
}

/** @param fehler beliebiger geworfener Wert */
function meldung(fehler: unknown): string {
	return fehler instanceof Error ? fehler.message : String(fehler);
}
