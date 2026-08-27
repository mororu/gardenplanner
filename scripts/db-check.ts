/*
 * db:check — hält Schema, Migrationskette und drizzle.config.ts zusammen.
 *
 * Ohne diese Prüfung baut eine neue Spalte in schema.ts grün durch und stirbt
 * erst beim ersten Aufruf am laufenden Server: weder eslint noch svelte-check
 * noch vite build lesen drizzle/. Darum ruft npm run lint dieses Skript.
 *
 * Drei Prüfungen, und jede **führt etwas aus**, statt Text zu durchsuchen. Die
 * frühere Fassung verglich drizzle.config.ts mit zwei `includes`; ein
 * erfundener Vorgabewert (`?? './data/dev.sqlite'`) liess beide passen und
 * alles grün, obwohl der eingefrorene Block genau das verbietet. `dialect` war
 * von gar keiner Prüfung gedeckt.
 *
 *   1. Fail-Fast: der Generator wird mit der echten Konfiguration und **ohne**
 *      DATABASE_PATH aus einem Wegwerfverzeichnis gefahren. Erwartet wird Exit
 *      ungleich 0 mit einer Meldung, die DATABASE_PATH benennt.
 *   2. Die Konfiguration wird geladen und ihr Ausfuhrwert gelesen: dialect,
 *      schema und out kommen von dort und nicht aus Konstanten in diesem Skript.
 *   3. Drift: drizzle/ in ein Wegwerfverzeichnis kopieren, den echten Generator
 *      darauf laufen lassen und die Ausgabe lesen.
 *
 * Aufruf:
 *   node scripts/db-check.ts [zielverzeichnis]   prüft ein Projekt (Vorgabe: dieses)
 *   node scripts/db-check.ts --selftest          prüft das Tor gegen die Fehlerproben
 *
 * Zwei gemessene Eigenheiten von drizzle-kit 0.31.10 bestimmen die Form:
 *   - `--config` verträgt keine weitere Flagge ("You can't use both --config and
 *     other cli options"). Prüfung 1 fährt darum die Konfiguration allein und
 *     aus einem Wegwerfverzeichnis, damit nichts ins Projekt geschrieben wird;
 *     Prüfung 3 fährt ohne Konfiguration mit Flaggen.
 *   - Es setzt vor --out ein './' und kann darum keinen absoluten Pfad
 *     verarbeiten; und es endet auch nach einem ENOENT mit Exit 0. Darum liegt
 *     das Wegwerfverzeichnis unter .svelte-kit/, und der Erfolg von Prüfung 3
 *     ist an der Zeile "No schema changes" festgemacht.
 */
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const eigenesProjekt = fileURLToPath(new URL('..', import.meta.url));
const probenWurzel = join(eigenesProjekt, 'scripts', 'db-check-fixtures');
const drizzleKit = join(eigenesProjekt, 'node_modules', 'drizzle-kit', 'bin.cjs');
/** Für alle drei spawnSync-Aufrufe an drizzle-kit — ein hängender Prozess soll den Lauf nicht unbegrenzt blockieren. */
const SPAWN_TIMEOUT_MS = 120_000;

/** Ein Befund ist eine benannte Meldung, nie ein Stacktrace. */
type Befund = { pruefung: string; meldung: string };

function meldungVon(fehler: unknown): string {
	return fehler instanceof Error ? fehler.message : String(fehler);
}

/**
 * Prüfung 1 — der Fail-Fast der Konfiguration.
 *
 * Aus einem Wegwerfverzeichnis, damit ein schreibender Generator nichts im
 * Projekt anrührt: `--config` allein schreibt in das `out` der Konfiguration,
 * und das ist arbeitsverzeichnisrelativ.
 */
function failFastPruefen(ziel: string): Befund[] {
	const konfigPfad = join(ziel, 'drizzle.config.ts');
	if (!existsSync(konfigPfad)) {
		return [{ pruefung: 'Fail-Fast', meldung: 'drizzle.config.ts fehlt.' }];
	}

	const wegwerf = mkdtempSync(join(tmpdir(), 'gartenplaner-db-check-failfast-'));
	try {
		const umgebung: Record<string, string | undefined> = { ...process.env };
		delete umgebung.DATABASE_PATH;

		const lauf = spawnSync(process.execPath, [drizzleKit, 'generate', '--config', konfigPfad], {
			cwd: wegwerf,
			encoding: 'utf8',
			env: umgebung,
			stdio: ['ignore', 'pipe', 'pipe'],
			timeout: SPAWN_TIMEOUT_MS,
		});

		if (lauf.error !== undefined) {
			return [
				{
					pruefung: 'Fail-Fast',
					meldung: `Der Generator liess sich nicht starten: ${lauf.error.message}`,
				},
			];
		}

		const ausgabe = `${lauf.stdout ?? ''}${lauf.stderr ?? ''}`;
		const befunde: Befund[] = [];

		if (lauf.status === 0) {
			befunde.push({
				pruefung: 'Fail-Fast',
				meldung:
					'drizzle.config.ts läuft ohne DATABASE_PATH durch. Es gibt bewusst keinen\n' +
					'Vorgabewert: ein erfundener Pfad legt still eine zweite, leere Datenbank an,\n' +
					'und der eingefrorene Block der Spezifikation verbietet ihn ausdrücklich.\n' +
					'Erwartet wird ein Abbruch mit benannter Meldung.',
			});
		} else if (!ausgabe.includes('DATABASE_PATH')) {
			// Abgebrochen wurde, aber nicht nachweislich wegen der fehlenden Variablen.
			// Der Fail-Fast gilt damit als nicht belegt: der Abbruch kann genauso gut
			// von einer anderen Stelle kommen (das Wegwerfverzeichnis trägt kein
			// Schema), und ein erfundener Vorgabewert wäre so nicht zu sehen.
			befunde.push({
				pruefung: 'Fail-Fast',
				meldung:
					'drizzle.config.ts bricht ohne DATABASE_PATH ab, aber ohne eine Meldung, die\n' +
					'DATABASE_PATH benennt — der Fail-Fast ist damit nicht belegt. Erwartet wird\n' +
					'eine benannte Meldung, bevor irgendetwas anderes scheitert. Ausgabe war:\n' +
					`${ausgabe.trim() || '(leer)'}`,
			});
		}

		if (/^\s+at /m.test(ausgabe)) {
			befunde.push({
				pruefung: 'Fail-Fast',
				meldung: 'drizzle.config.ts wirft einen Stacktrace statt einer benannten Meldung.',
			});
		}

		// Nichts darf im Wegwerfverzeichnis entstanden sein: der Abbruch kommt vor
		// jedem Schreibzugriff.
		if (readdirSync(wegwerf).length > 0) {
			befunde.push({
				pruefung: 'Fail-Fast',
				meldung: `Der Abbruch kam zu spät — im Arbeitsverzeichnis entstand ${readdirSync(wegwerf).join(', ')}.`,
			});
		}

		return befunde;
	} finally {
		rmSync(wegwerf, { recursive: true, force: true });
	}
}

type Konfiguration = { dialect: string; schema: string; out: string };

/**
 * Prüfung 2 — die Konfiguration laden und ihren Ausfuhrwert lesen.
 *
 * Damit kommen dialect, schema und out von dort und nicht aus Konstanten in
 * diesem Skript; wer sie in der Konfiguration ändert, ändert damit auch, was
 * Prüfung 3 vergleicht. DATABASE_PATH wird für das Laden gesetzt, weil der
 * Fail-Fast sonst zuschlägt — geprüft ist er in Prüfung 1.
 */
function konfigurationLesen(ziel: string): { konfig: Konfiguration | null; befunde: Befund[] } {
	const konfigPfad = join(ziel, 'drizzle.config.ts');
	const lauf = spawnSync(
		process.execPath,
		[
			'--input-type=module',
			'-e',
			`const m = await import(${JSON.stringify(pathToFileURL(konfigPfad).href)});` +
				'process.stdout.write(JSON.stringify(m.default));',
		],
		{
			cwd: ziel,
			encoding: 'utf8',
			env: { ...process.env, DATABASE_PATH: join(ziel, 'nur-zum-laden.sqlite') },
			stdio: ['ignore', 'pipe', 'pipe'],
			timeout: SPAWN_TIMEOUT_MS,
		}
	);

	if (lauf.error !== undefined || lauf.status !== 0) {
		return {
			konfig: null,
			befunde: [
				{
					pruefung: 'Konfiguration',
					meldung:
						'drizzle.config.ts liess sich nicht laden: ' +
						`${lauf.error?.message ?? `Status ${lauf.status}`}\n${(lauf.stderr ?? '').trim()}`,
				},
			],
		};
	}

	let gelesen: Partial<Konfiguration>;
	try {
		gelesen = JSON.parse(lauf.stdout) as Partial<Konfiguration>;
	} catch (fehler) {
		return {
			konfig: null,
			befunde: [
				{
					pruefung: 'Konfiguration',
					meldung: `Der Ausfuhrwert von drizzle.config.ts ist kein JSON: ${meldungVon(fehler)}`,
				},
			],
		};
	}

	const befunde: Befund[] = [];
	if (gelesen.dialect !== 'sqlite') {
		befunde.push({
			pruefung: 'Konfiguration',
			meldung: `dialect ist ${JSON.stringify(gelesen.dialect)}, erwartet 'sqlite'.`,
		});
	}
	if (typeof gelesen.schema !== 'string' || !existsSync(resolve(ziel, gelesen.schema))) {
		befunde.push({
			pruefung: 'Konfiguration',
			meldung: `schema zeigt auf ${JSON.stringify(gelesen.schema)} — dort liegt keine Datei.`,
		});
	}
	if (typeof gelesen.out !== 'string') {
		befunde.push({ pruefung: 'Konfiguration', meldung: 'out fehlt in der Konfiguration.' });
	}

	if (befunde.length > 0) return { konfig: null, befunde };
	return { konfig: gelesen as Konfiguration, befunde };
}

/** Prüfung 3 — Schema gegen Migrationskette, über den echten Generator. */
function driftPruefen(ziel: string, konfig: Konfiguration): Befund[] {
	const kette = resolve(ziel, konfig.out);
	if (!existsSync(join(kette, 'meta', '_journal.json'))) {
		return [
			{
				pruefung: 'Drift',
				meldung:
					`${konfig.out}/meta/_journal.json fehlt — es gibt keine Migrationskette.\n` +
					'Erzeugen mit: npm run db:generate',
			},
		];
	}

	const sqlDateien = (verzeichnis: string) =>
		readdirSync(verzeichnis)
			.filter((name) => name.endsWith('.sql'))
			.sort();

	const vorhanden = sqlDateien(kette);
	if (vorhanden.length === 0) {
		return [
			{
				pruefung: 'Drift',
				meldung: `Unter ${konfig.out}/ liegt keine .sql-Datei. Erzeugen mit: npm run db:generate`,
			},
		];
	}

	// Wegwerfverzeichnis im Ablagebereich des Systems, nie im geprüften Projekt:
	// eine Prüfung, die im Projekt Verzeichnisse hinterlässt, ist keine Prüfung.
	// Der --out-Pfad wird arbeitsverzeichnisrelativ übergeben, weil drizzle-kit
	// vor --out ein './' setzt und keinen absoluten Pfad verarbeitet.
	const arbeit = mkdtempSync(join(tmpdir(), 'gartenplaner-db-check-drift-'));
	const zielKette = join(arbeit, 'drizzle');

	try {
		cpSync(kette, zielKette, { recursive: true });

		const lauf = spawnSync(
			process.execPath,
			[
				drizzleKit,
				'generate',
				'--dialect',
				konfig.dialect,
				'--schema',
				konfig.schema,
				'--out',
				relative(ziel, zielKette).split(sep).join('/'),
			],
			{
				cwd: ziel,
				encoding: 'utf8',
				// stdin geschlossen: fragt drizzle-kit nach einer Umbenennung, soll es
				// scheitern und nicht warten. Ein hängendes lint ist schlimmer als ein
				// rotes.
				stdio: ['ignore', 'pipe', 'pipe'],
				timeout: SPAWN_TIMEOUT_MS,
			}
		);

		if (lauf.error !== undefined) {
			return [
				{
					pruefung: 'Drift',
					meldung: `Der Generator liess sich nicht starten: ${lauf.error.message}`,
				},
			];
		}

		const ausgabe = `${lauf.stdout ?? ''}${lauf.stderr ?? ''}`.trim();
		const neu = sqlDateien(zielKette).filter((name) => !vorhanden.includes(name));

		if (neu.length > 0) {
			return [
				{
					pruefung: 'Drift',
					meldung:
						`${konfig.schema} ist der Migrationskette vorausgelaufen: der Generator schreibt\n` +
						`${neu.length} weitere Datei(en) (${neu.join(', ')}).\n` +
						'Nachziehen mit: npm run db:generate — und die erzeugten Dateien mitliefern.\n' +
						'Ohne das baut die Änderung grün und stirbt beim ersten Aufruf.',
				},
			];
		}

		if (!ausgabe.includes('No schema changes')) {
			return [
				{
					pruefung: 'Drift',
					meldung:
						'drizzle-kit generate hat den Abgleich nicht bestätigt. Ausgabe war:\n' +
						`${ausgabe || '(leer)'}\n` +
						'Bei einer Umbenennung fragt der Generator zurück — dann von Hand\n' +
						'npm run db:generate laufen lassen und die Antwort geben.',
				},
			];
		}

		return [];
	} finally {
		rmSync(arbeit, { recursive: true, force: true });
	}
}

/** Alle drei Prüfungen über ein Projekt. */
function pruefen(ziel: string): Befund[] {
	const befunde: Befund[] = [...failFastPruefen(ziel)];
	const { konfig, befunde: konfigBefunde } = konfigurationLesen(ziel);
	befunde.push(...konfigBefunde);
	if (konfig !== null) befunde.push(...driftPruefen(ziel, konfig));
	return befunde;
}

function berichten(befunde: Befund[], ziel: string): number {
	const wo = relative(eigenesProjekt, ziel) || '.';
	for (const { pruefung, meldung } of befunde) {
		console.error(`BEFUND   ${pruefung}  ${meldung}`);
	}
	if (befunde.length > 0) {
		console.error(`db:check (${wo}): ${befunde.length} Befund(e).`);
		return 1;
	}
	console.log(`db:check (${wo}): Fail-Fast, Konfiguration und Migrationskette sind in Ordnung.`);
	return 0;
}

// ---------------------------------------------------------------------------
// Selbsttest. Das einzige Tor der Kette hatte keine Fehlerprobe: `abbrechen` zu
// einer Warnung zu machen liesse lint grün, während der Drift-Schutz aufhört zu
// greifen. Darum wird jede Probe als **Unterprozess** gefahren — nur so ist der
// Exit-Code beobachtet und nicht bloss die Befundliste.
// ---------------------------------------------------------------------------
const proben: {
	verzeichnis: string;
	erwartetExit: number;
	erwartetePruefung: string | null;
	beschreibung: string;
}[] = [
	{
		verzeichnis: 'deckungsgleich',
		erwartetExit: 0,
		erwartetePruefung: null,
		beschreibung: 'Gegenprobe: Schema und Kette deckungsgleich, Fail-Fast vorhanden',
	},
	{
		verzeichnis: 'drift-spalte',
		erwartetExit: 1,
		erwartetePruefung: 'Drift',
		beschreibung: 'Spalte im Schema, die in keiner Migration steht',
	},
	{
		verzeichnis: 'ohne-fail-fast',
		erwartetExit: 1,
		erwartetePruefung: 'Fail-Fast',
		beschreibung: "erfundener Vorgabewert `?? './data/dev.sqlite'` statt Abbruch",
	},
];

function selbsttest(): number {
	let fehlt = 0;
	console.log(`db:check --selftest: ${proben.length} Fehlerproben\n`);

	for (const { verzeichnis, erwartetExit, erwartetePruefung, beschreibung } of proben) {
		const ziel = join(probenWurzel, verzeichnis);
		if (!existsSync(ziel) || !statSync(ziel).isDirectory()) {
			console.error(`FEHLT   ${verzeichnis} — Fehlerprobe nicht vorhanden`);
			fehlt += 1;
			continue;
		}

		const lauf = spawnSync(process.execPath, [join('scripts', 'db-check.ts'), ziel], {
			cwd: eigenesProjekt,
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'pipe'],
			timeout: 300_000,
		});
		const ausgabe = `${lauf.stdout ?? ''}${lauf.stderr ?? ''}`;

		if (lauf.error !== undefined) {
			console.error(`FEHLT   ${verzeichnis} — Unterprozess nicht gestartet: ${lauf.error.message}`);
			fehlt += 1;
			continue;
		}
		if (lauf.status !== erwartetExit) {
			console.error(
				`FEHLT   ${verzeichnis} — Exit ${lauf.status} statt ${erwartetExit} (${beschreibung}).\n` +
					`        Ausgabe: ${ausgabe.trim().split('\n').slice(0, 4).join(' / ')}`
			);
			fehlt += 1;
			continue;
		}
		if (erwartetePruefung !== null && !ausgabe.includes(`BEFUND   ${erwartetePruefung}`)) {
			console.error(
				`FEHLT   ${verzeichnis} — kein Befund der Prüfung "${erwartetePruefung}" (${beschreibung}).\n` +
					`        Ausgabe: ${ausgabe.trim().split('\n').slice(0, 4).join(' / ')}`
			);
			fehlt += 1;
			continue;
		}
		console.log(
			`bissig  ${verzeichnis} — Exit ${lauf.status}` +
				`${erwartetePruefung === null ? ' (schweigt, wie es soll)' : `, Befund ${erwartetePruefung}`}`
		);
	}

	if (fehlt > 0) {
		console.error(
			`\ndb:check --selftest: ${fehlt} von ${proben.length} Fehlerproben nicht gefunden — ` +
				'das Tor prüft weniger, als es behauptet.'
		);
		return 1;
	}
	console.log(
		`\ndb:check --selftest: alle ${proben.length} Fehlerproben wie erwartet, ` +
			'Fail-Fast und Drift-Schutz beissen nachweislich.'
	);
	return 0;
}

// ---------------------------------------------------------------------------
try {
	const argument = process.argv[2];
	if (argument === '--selftest') {
		process.exit(selbsttest());
	}
	const ziel = argument === undefined ? eigenesProjekt : resolve(process.cwd(), argument);
	process.exit(berichten(pruefen(ziel), ziel));
} catch (fehler) {
	// Auch ein unerwarteter Fehler ist eine benannte Meldung, nie ein Stacktrace.
	console.error(`BEFUND   db:check  ${meldungVon(fehler)}`);
	process.exit(1);
}
