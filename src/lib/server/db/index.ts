import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq, isNotNull } from 'drizzle-orm';
import { ortVereinheitlichen } from '../../beet.ts';
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
 * Öffnet die Datenbank, setzt die Pragmas, fährt die Migrationskette hoch und
 * bringt die Orte vorhandener Zeilen in die eine Schreibweise
 * (`orteVereinheitlichen`, unten).
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

	try {
		orteVereinheitlichen(geöffnet);
	} catch (fehler) {
		throw new Error(
			`Die Orte in ${pfad} liessen sich nicht in die eine Schreibweise bringen: ${meldung(fehler)}\n` +
				'Die Umschreibung lief in einer Transaktion; kein Ort ist verändert.',
			{ cause: fehler }
		);
	}

	datenschicht = geöffnet;
}

/**
 * Bringt den Ort jeder vorhandenen Zeile in `harvests` und `treatments` in die
 * eine Schreibweise von `ortVereinheitlichen` (src/lib/beet.ts) — `42` und
 * `B42` werden `Beet 42` (spec-beet-schreibweise.md, 2026-10-26). Zurück kommt
 * die Zahl der umgeschriebenen Zeilen.
 *
 * **Warum beim Start und nicht als Migration unter drizzle/:** SQLite kennt
 * keine Regex, und eine Fassung mit GLOB wäre die zweite Kopie der Regel neben
 * src/lib/beet.ts — zwei Fassungen, die beim ersten Nachbessern
 * auseinanderlaufen. Der Schritt ist **idempotent**: er schreibt nur Zeilen, deren
 * Ort sich ändert, und nach einem Lauf ist das keine mehr. Er läuft darum bei
 * jedem Start und kostet danach ein Lesen beider Tabellen; beide tragen eine
 * Handvoll bis wenige hundert Zeilen.
 *
 * **Alle Zeilen, auch abgeschlossene:** `amOrt` in queries/treatments.ts
 * vergleicht exakt. Bliebe eine abgeschlossene Zeile auf `42`, fände
 * `abschlussZuruecknehmen` sie unter `Beet 42` nicht mehr.
 *
 * In **einer** Transaktion über beide Tabellen: ein Fehler mitten im Lauf
 * hinterlässt keine halb umgeschriebene Datei. Vor dem ersten Ausrollen dieser
 * Umschreibung gehört eine Sicherung gezogen (scripts/backup.sh) — der Schritt
 * ist nicht umkehrbar, weil er die frühere Schreibweise nicht aufhebt.
 *
 * Hingenommen (Spec Change Log): fallen zwei frühere Stellen zusammen und
 * tragen Abschlüsse mit gleichem Zeitpunkt, stehen sie im Archiv als einer.
 */
export function orteVereinheitlichen(handle: Datenschicht): number {
	return handle.transaction((tx) => {
		let umgeschrieben = 0;
		const ernte = tx
			.select({ id: schema.harvests.id, ort: schema.harvests.ort })
			.from(schema.harvests)
			.where(isNotNull(schema.harvests.ort))
			.all();
		for (const zeile of ernte) {
			if (zeile.ort === null) continue;
			const ort = ortVereinheitlichen(zeile.ort);
			if (ort === zeile.ort) continue;
			tx.update(schema.harvests).set({ ort }).where(eq(schema.harvests.id, zeile.id)).run();
			umgeschrieben += 1;
		}
		const behandlungen = tx
			.select({ id: schema.treatments.id, ort: schema.treatments.ort })
			.from(schema.treatments)
			.where(isNotNull(schema.treatments.ort))
			.all();
		for (const zeile of behandlungen) {
			if (zeile.ort === null) continue;
			const ort = ortVereinheitlichen(zeile.ort);
			if (ort === zeile.ort) continue;
			tx.update(schema.treatments).set({ ort }).where(eq(schema.treatments.id, zeile.id)).run();
			umgeschrieben += 1;
		}
		return umgeschrieben;
	});
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
