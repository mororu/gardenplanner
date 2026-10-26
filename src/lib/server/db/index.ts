import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { getTableColumns, getTableName, is, sql, type Column } from 'drizzle-orm';
import { SQLiteTable } from 'drizzle-orm/sqlite-core';
import { ortFassen } from '../../ernte.ts';
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
 * Die Tabellen des Schemas mit einer Spalte `ort` — **abgeleitet und nicht
 * aufgezählt**. Eine neue Tabelle mit Ort fällt damit von selbst unter die
 * Umschreibung beim Start; eine Liste von Hand hätte sie verloren (AGENTS.md:
 * keine von Hand geführte Liste in einer Wache).
 *
 * Gelesen wird das **Schema**, nicht die Datei: eine Spalte `ort`, die nur in
 * einer Migration steht, sähe diese Funktion nicht. `scripts/smoke-zugang.ts`
 * hält darum die Tabellen der migrierten Datei (`PRAGMA table_info`) gegen
 * diese Liste. Jede Tabelle hier braucht eine Spalte `id`, über die einzeln
 * geschrieben wird; fehlt sie, wirft die Umschreibung und benennt die Tabelle.
 */
export function tabellenMitOrt(): SQLiteTable[] {
	const werte: unknown[] = Object.values(schema);
	return werte.filter(
		(wert): wert is SQLiteTable => is(wert, SQLiteTable) && 'ort' in getTableColumns(wert)
	);
}

/**
 * Bringt den Ort jeder vorhandenen Zeile jeder Tabelle mit Ort
 * (`tabellenMitOrt`, heute `harvests` und `treatments`) in die Fassung von
 * `ortFassen` (src/lib/ernte.ts) — gefaltet, `42` und `B42` als `Beet 42`,
 * leer und `Beet` allein als null (spec-beet-schreibweise.md, 2026-10-26).
 * Dieselbe Funktion, über die gespeichert wird, nur ohne Längenprüfung: der
 * Start kann nichts abweisen. Zurück kommt die Zahl der umgeschriebenen
 * Zeilen.
 *
 * **Warum beim Start und nicht als Migration unter drizzle/:** SQLite kennt
 * keine Regex, und eine Fassung mit GLOB wäre die zweite Kopie der Regel neben
 * src/lib/beet.ts — zwei Fassungen, die beim ersten Nachbessern
 * auseinanderlaufen. Der Schritt ist **idempotent**: er schreibt nur Zeilen,
 * deren Ort sich ändert, und nach einem Lauf ist das keine mehr. Er läuft
 * darum bei jedem Start und kostet danach ein Lesen jeder Tabelle mit Ort.
 *
 * **Alle Zeilen, auch abgeschlossene:** `amOrt` in queries/treatments.ts
 * vergleicht exakt. Bliebe eine abgeschlossene Zeile auf `42`, fände
 * `abschlussZuruecknehmen` sie unter `Beet 42` nicht mehr.
 *
 * **Kein eindeutiger Index enthält `ort`** (gemessen am 2026-10-26 in
 * schema.ts: eindeutig sind nur `invite_token_hash`, `datei`, `ablage` und
 * `duty_weeks_art_jahr_woche`; `smoke-zugang.ts` prüft es an der migrierten
 * Datei mit `PRAGMA index_list`). Das Zusammenfallen von `42` und `Beet 42`
 * ist darum ein gewöhnliches UPDATE; mit einem solchen Index bräche es den
 * Start.
 *
 * In **einer** Transaktion über alle Tabellen, begonnen mit `IMMEDIATE`: ein
 * Fehler mitten im Lauf hinterlässt keine halb umgeschriebene Datei, und die
 * Schreibsperre liegt schon vor dem Lesen. Mit dem gewöhnlichen `DEFERRED`
 * schriebe ein zweiter Prozess (create-admin neben dem Server) zwischen Lesen
 * und erstem Schreiben, und unter WAL scheiterte der Lauf dann mit
 * SQLITE_BUSY_SNAPSHOT statt auf busy_timeout zu warten.
 *
 * Vor dem ersten Ausrollen dieser Umschreibung gehört eine Sicherung gezogen
 * (scripts/backup.sh, README.md unter „Betrieb und Runbook") — der Schritt
 * ist nicht umkehrbar, weil er die frühere Schreibweise nicht aufhebt.
 *
 * Hingenommen (Spec Change Log): fallen zwei frühere Stellen zusammen und
 * tragen Abschlüsse mit gleichem Zeitpunkt, stehen sie im Archiv als einer.
 */
export function orteVereinheitlichen(handle: Datenschicht): number {
	return handle.transaction(
		(tx) => {
			let umgeschrieben = 0;
			for (const tabelle of tabellenMitOrt()) {
				const spalten: Record<string, Column> = getTableColumns(tabelle);
				const id = spalten.id;
				if (id === undefined) {
					throw new Error(
						`Die Tabelle ${getTableName(tabelle)} hat einen Ort, aber keine Spalte id.`
					);
				}
				const ortSpalte = sql.identifier(spalten.ort.name);
				const idSpalte = sql.identifier(id.name);
				const zeilen = tx.all<{ id: number; ort: string }>(
					sql`SELECT ${idSpalte} AS id, ${ortSpalte} AS ort FROM ${tabelle} WHERE ${ortSpalte} IS NOT NULL`
				);
				for (const zeile of zeilen) {
					const ort = ortFassen(zeile.ort);
					if (ort === zeile.ort) continue;
					tx.run(sql`UPDATE ${tabelle} SET ${ortSpalte} = ${ort} WHERE ${idSpalte} = ${zeile.id}`);
					umgeschrieben += 1;
				}
			}
			return umgeschrieben;
		},
		{ behavior: 'immediate' }
	);
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

/**
 * Die Meldung eines geworfenen Werts, **mit ihrer Ursache**. Drizzle wickelt
 * einen SQLite-Fehler in „Failed to run the query …" und legt den eigentlichen
 * Grund (etwa einen Abbruch durch einen Auslöser) in `cause`; ohne ihn sagte
 * die Meldung nur, welche Abfrage scheiterte, und nicht warum.
 *
 * @param fehler beliebiger geworfener Wert
 */
function meldung(fehler: unknown): string {
	if (!(fehler instanceof Error)) return String(fehler);
	return fehler.cause === undefined
		? fehler.message
		: `${fehler.message} (Ursache: ${meldung(fehler.cause)})`;
}
