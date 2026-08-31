/*
 * Der geteilte Prüfstand: gebauter Server, Wegwerf-Datenbank, Saat.
 *
 * Herausgelöst am 2026-08-31 aus scripts/smoke-http.ts, als Stufe C
 * (scripts/smoke-sicht.ts) dieselbe Maschinerie brauchte. Eine zweite Fassung
 * davon wäre genau die zweite Wahrheit, gegen die Gate-Regel 14 und drei
 * Retrospektiven stehen: die Aktualitätsprüfung des Baus, der Umgebungsaufbau
 * des Unterprozesses und die Saat müssen für beide Skripte **dieselben** sein,
 * sonst misst eines von beiden irgendwann etwas anderes als es meldet.
 *
 * Was hier steht, ist Infrastruktur und keine Behauptung — mit einer Ausnahme:
 * `bauPruefen` legt zwei Behauptungen ab und beendet den Lauf, wenn der Bau
 * fehlt oder veraltet ist. Sie steht hier, weil beide Skripte denselben
 * gebauten Baum messen und ein veralteter Bau in beiden dieselbe stille
 * Falschmeldung wäre.
 *
 * Die Prüfliste selbst bleibt in den Skripten. Dieses Modul legt nur den Stand.
 */
import { spawn } from 'node:child_process';
import type { ChildProcessByStdio } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import type { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { aufraeumen, pruefen, zaehlerstand } from './pruefhelfer.ts';
import { datenschichtStarten } from '../src/lib/server/db/index.ts';
import { mitgliedAnlegen } from '../src/lib/server/db/queries/members.ts';
import { aufgabenStapelAnlegen } from '../src/lib/server/db/queries/tasks.ts';
import { tokenErzeugen, tokenHashen } from '../src/lib/server/token.ts';
import { WOCHE_SEKUNDEN } from '../src/lib/zeit.ts';

export const GUTES_GEHEIMNIS = 'smoke-http-geheimnis-mit-genug-verschiedenen-zeichen-0123456789';

/**
 * Der Accept-Kopf eines Browsers, wortgleich mit dem, was Safari und Firefox
 * für ein Dokument schicken. Er steht als Konstante und nicht als `text/html`
 * an jeder Anfrage, weil genau dieser Kopf entscheidet, ob SvelteKit auf dem
 * Fatal-Pfad HTML oder JSON liefert.
 */
export const BROWSER_ACCEPT = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';

/** Keine einzelne Anfrage darf die Prüfkette anhalten. */
export const ANFRAGE_SCHRANKE_MS = 15_000;

export const wurzel = fileURLToPath(new URL('..', import.meta.url));
// migrationsFolder ist arbeitsverzeichnisrelativ, und der Unterprozess erbt das
// Arbeitsverzeichnis. Die Skripte dürfen trotzdem von überall aufgerufen werden.
process.chdir(wurzel);

// ---------------------------------------------------------------------------
// Der Bau. Ohne ihn misst kein Skript dieser Art etwas.
// ---------------------------------------------------------------------------

/**
 * Die jüngste Änderungszeit unter einem Pfad, rekursiv; eine Datei zählt wie ein
 * Verzeichnis.
 *
 * Ein Eintrag, der zwischen readdir und stat verschwindet, ein toter Symlink
 * und ein gar nicht vorhandener Pfad ergeben 0 statt eines Wurfs: ein Wurf in
 * der allerersten Behauptung nähme der ganzen Prüfliste den Lauf, und die Frage,
 * ob der Bau aktuell ist, hängt an keinem einzelnen Eintrag.
 */
export function juengsteAenderung(pfad: string): number {
	let eintrag;
	try {
		eintrag = statSync(pfad);
	} catch {
		return 0;
	}
	if (!eintrag.isDirectory()) return eintrag.mtimeMs;

	let juengste = 0;
	for (const kind of readdirSync(pfad, { withFileTypes: true })) {
		const zeit = juengsteAenderung(join(pfad, kind.name));
		if (zeit > juengste) juengste = zeit;
	}
	return juengste;
}

/**
 * Alles, was in den Bau eingeht.
 *
 * `src/` allein genügt nicht: eine geänderte `svelte.config.js`, eine neue
 * SvelteKit-Fassung über `package-lock.json` oder ein ausgetauschtes Icon unter
 * `static/` machen den Bau ebenso veraltet, ohne dass sich unter `src/` etwas
 * rührt. Dann mässe dieses Skript den alten Bündel und bliebe grün — genau der
 * Zustand, den die Aktualitätsprüfung ausschliessen soll.
 */
export const BAU_EINGABEN = [
	'src',
	'static',
	'svelte.config.js',
	'vite.config.ts',
	'package-lock.json',
] as const;

/**
 * Der Bau muss da **und** aktuell sein.
 *
 * Die zweite Hälfte ist die wichtigere: ein veralteter Bau liefert grüne
 * Behauptungen über Bytes, die niemand mehr schreibt. Das wäre schlimmer als
 * ein roter Lauf, weil es wie Deckung aussieht.
 *
 * Beides sind Behauptungen und keine stillen Vorbedingungen — im grünen Fall
 * laufen sie mit und zählen mit. Nur der Ausgang danach ist besonders: ohne Bau
 * gibt es nichts zu messen, also endet das Skript hier statt eine Prüfliste
 * voller Folgefehler abzuspulen.
 */
export function bauPruefen(skript: string): void {
	const eintritt = join(wurzel, 'build', 'index.js');
	const vorhanden = existsSync(eintritt);
	pruefen('der gebaute Baum liegt unter build/', vorhanden, `${eintritt} fehlt`);

	const bauZeit = vorhanden ? statSync(eintritt).mtimeMs : 0;
	const quellZeit = Math.max(...BAU_EINGABEN.map((teil) => juengsteAenderung(join(wurzel, teil))));
	const aktuell = vorhanden && bauZeit >= quellZeit;
	pruefen(
		`der Bau ist nicht älter als die jüngste Bau-Eingabe (${BAU_EINGABEN.join(', ')})`,
		aktuell,
		`build/index.js ${new Date(bauZeit).toISOString()}, Eingaben ${new Date(quellZeit).toISOString()}`
	);

	if (vorhanden && aktuell) return;

	console.error(
		`\n${skript} misst den **gebauten** Baum und baut ihn bewusst nicht selbst —\n` +
			'ein Skript, das seinen eigenen Prüfgegenstand herstellt, verdeckt jeden\n' +
			'Baufehler. Erst bauen, dann prüfen:\n' +
			`  npm run build && npm run ${skript.replace('smoke:', 'smoke:')}`
	);
	// Dieselbe Schlusszeile wie jeder andere rote Lauf: wer sie vermisst, sucht
	// nach einem Absturz, wo eine benannte Vorbedingung fehlschlug.
	const stand = zaehlerstand();
	console.error(
		`\n${skript}: ${stand.gescheitert} von ${stand.gelaufen} Behauptung(en) nicht erfüllt.`
	);
	aufraeumen();
	process.exit(1);
}

// ---------------------------------------------------------------------------
// Freier Port, Wegwerf-Datenbank, Saat.
// ---------------------------------------------------------------------------

/**
 * Ein freier Port, ermittelt durch kurzes Binden auf 0 und sofortiges
 * Freigeben.
 *
 * Zwischen Freigabe und Start des Servers liegt ein Fenster, in dem jemand
 * anderes den Port nehmen könnte. Das Fenster wird nicht weggeredet, und es
 * fällt auf **zwei** Wegen auf: entweder kann der Server gar nicht binden — dann
 * endet er mit EADDRINUSE, und serverStarten macht daraus einen benannten Befund
 * samt seiner Fehlerausgabe — oder er lauscht anderswo, dann meldet die
 * Behauptung unten den abweichenden Port. Eine Messung am falschen Prozess ist
 * damit ausgeschlossen.
 */
export function freierPort(): Promise<number> {
	return new Promise((erfuellen, ablehnen) => {
		const sonde = createServer();
		const frist = setTimeout(() => {
			sonde.close();
			ablehnen(new Error('Die Portsonde hat in 5 Sekunden nicht gebunden.'));
		}, 5_000);

		sonde.on('error', (fehler) => {
			clearTimeout(frist);
			ablehnen(fehler);
		});
		sonde.listen(0, '127.0.0.1', () => {
			const adresse = sonde.address();
			if (adresse === null || typeof adresse === 'string') {
				clearTimeout(frist);
				sonde.close();
				ablehnen(new Error('Die Portsonde hat keine Adresse zurückgegeben.'));
				return;
			}
			const port = adresse.port;
			sonde.close(() => {
				clearTimeout(frist);
				erfuellen(port);
			});
		});
	});
}

export type Saat = {
	adminToken: string;
	mitgliedToken: string;
	hashes: string[];
	klartexte: string[];
	/** Der Text der überfälligen Planaufgabe — unten am ausgelieferten `/` gesucht. */
	ueberfaelligText: string;
	/** Und die Zahl, die über ihr stehen muss. */
	ueberfaelligWochen: number;
};

/**
 * Zwei Mitglieder über die **echte** Datenschicht, nicht über SQL von Hand:
 * eine Adminperson und ein Mitglied ohne Adminrechte. Ein von Hand geschriebenes
 * INSERT wäre eine zweite Wahrheit über das Schema und bliebe grün, wenn eine
 * Spalte umzieht.
 *
 * Die Migrationskette läuft dabei mit — datenschichtStarten() fährt sie hoch,
 * bevor der Server dieselbe Datei öffnet. Der Pfad kommt aus process.env, kurz
 * zuvor gesetzt; die Datenschicht liest ihn ausdrücklich erst hier und nicht
 * beim Modulladen, sonst zöge der Import oben schon eine fremde Datenbank
 * herein.
 */
export function saeen(): Saat {
	datenschichtStarten();

	const adminToken = tokenErzeugen();
	const mitgliedToken = tokenErzeugen();
	const adminHash = tokenHashen(adminToken);
	const mitgliedHash = tokenHashen(mitgliedToken);

	mitgliedAnlegen({ name: 'Vera Verwaltung', inviteTokenHash: adminHash, isAdmin: true });
	mitgliedAnlegen({ name: 'Manu Mitglied', inviteTokenHash: mitgliedHash, isAdmin: false });

	/*
	 * Eine überfällige Planaufgabe, ebenfalls über die echte Datenschicht.
	 *
	 * Sie ist die einzige Saat dieses Skripts, die nicht dem Zugang dient, und
	 * sie hat einen genauen Grund: der Satz `seit N Wochen überfällig` war bis zum
	 * 2026-08-29 allein von einer Textprüfung über den Quelltext der Komponente
	 * gedeckt. Ob er wirklich **ausgeliefert** wird und mit welcher Zahl, hat nie
	 * etwas gemessen — genau die Klasse, für die Story 3.0 dieses Skript gebaut
	 * hat.
	 *
	 * Vier Wochen und nicht drei: an der Schwelle selbst ist eine Aufgabe noch
	 * nicht überfällig, und eine Saat, die auf die Sekunde an der Grenze liegt,
	 * hinge an der Laufzeit des Skripts. Gerechnet wird aus WOCHE_SEKUNDEN und
	 * nicht aus einer eigenen 604800 — dieselbe Klammer wie in `smoke`.
	 */
	const ueberfaelligWochen = 4;
	const ueberfaelligText = 'Tunnel 2 Blattläuse nachbehandeln';
	aufgabenStapelAnlegen(
		[ueberfaelligText],
		Math.floor(Date.now() / 1000) - ueberfaelligWochen * WOCHE_SEKUNDEN
	);

	return {
		adminToken,
		mitgliedToken,
		hashes: [adminHash, mitgliedHash],
		klartexte: [adminToken, mitgliedToken],
		ueberfaelligText,
		ueberfaelligWochen,
	};
}

// ---------------------------------------------------------------------------
// Der Unterprozess.
// ---------------------------------------------------------------------------

export type Server = {
	/*
	 * ChildProcessByStdio und nicht ChildProcessWithoutNullStreams: stdin ist
	 * 'ignore' und damit null, und der bequemere Typ verspricht dort einen
	 * Writable, den es nicht gibt.
	 */
	kind: ChildProcessByStdio<null, Readable, Readable>;
	/** Alles, was der Server bis jetzt auf stdout gesagt hat. */
	ausgabe: () => string;
	/** Alles, was er auf die Fehlerausgabe gesagt hat — unten behauptet. */
	fehlerausgabe: () => string;
	/** Die erste Listening-Zeile, oder null, wenn keine kam. */
	gemeldeteAdresse: () => string | null;
};

const LISTENING = /Listening on (\S+)/;

/**
 * Startet build/index.js und wartet, bis er seine Adresse meldet.
 *
 * Die Umgebung wird **vollständig** aufgebaut statt geerbt: das Skript läuft
 * ohne --env-file, aber die Schale, aus der es gerufen wird, kann DATABASE_PATH
 * gesetzt haben — und ein Prüflauf, der versehentlich die echte Datenbank
 * öffnet, legt dort zwei Mitglieder an. Das darf nicht davon abhängen, wie
 * jemand seine Schale eingerichtet hat.
 *
 * NODE_ENV bleibt ausdrücklich ungesetzt: dann steht `secure` am Cookie, und
 * genau das ist der Zustand im Betrieb, über den die Behauptungen unten reden.
 *
 * Jeder Ausgang dieser Funktion, der nicht erfüllt, **beendet das Kind selbst**.
 * Lehnt sie ab, bleibt die Variable des Rufers auf null, und das finally unten
 * fände nichts mehr zum Aufräumen — der Prozess hielte Port und Datenbankdatei
 * bis zum Abmelden.
 */
export function serverStarten(port: number, datenbankPfad: string): Promise<Server> {
	const kind = spawn(process.execPath, ['build/index.js'], {
		cwd: wurzel,
		env: {
			PATH: process.env.PATH,
			HOME: process.env.HOME,
			DATABASE_PATH: datenbankPfad,
			SESSION_SECRET: GUTES_GEHEIMNIS,
			ORIGIN: `http://127.0.0.1:${port}`,
			HOST: '127.0.0.1',
			PORT: String(port),
		},
		stdio: ['ignore', 'pipe', 'pipe'],
	});

	let stdout = '';
	let stderr = '';
	kind.stdout.setEncoding('utf8');
	kind.stderr.setEncoding('utf8');
	kind.stdout.on('data', (stueck: string) => (stdout += stueck));
	kind.stderr.on('data', (stueck: string) => (stderr += stueck));

	const server: Server = {
		kind,
		ausgabe: () => stdout,
		fehlerausgabe: () => stderr,
		gemeldeteAdresse: () => LISTENING.exec(stdout)?.[1] ?? null,
	};

	return new Promise((erfuellen, ablehnen) => {
		function protokoll(): string {
			return `\nstdout: ${stdout.trim() || '(leer)'}\nstderr: ${stderr.trim() || '(leer)'}`;
		}

		function fertig(): void {
			clearTimeout(schranke);
			kind.stdout.off('data', schauen);
			kind.off('exit', vorzeitigesEnde);
			kind.off('error', startfehler);
		}

		function schauen(): void {
			if (server.gemeldeteAdresse() === null) return;
			fertig();
			erfuellen(server);
		}

		function vorzeitigesEnde(status: number | null): void {
			fertig();
			ablehnen(
				new Error(
					`Der gebaute Server endete mit Status ${status}, bevor er lauschte.${protokoll()}`
				)
			);
		}

		/*
		 * spawn meldet ENOENT und EACCES erst über dieses Ereignis. Ohne Lauscher
		 * wirft Node es als unbehandeltes 'error' — ausserhalb des try unten, also
		 * ohne benannten Befund und ohne Aufräumen.
		 */
		function startfehler(fehler: Error): void {
			fertig();
			kind.kill('SIGKILL');
			ablehnen(new Error(`Der gebaute Server liess sich nicht starten: ${fehler.message}`));
		}

		const schranke = setTimeout(() => {
			fertig();
			// Ohne dieses kill bliebe ein Prozess stehen, den niemand mehr kennt:
			// der Ruf lehnt ab, `server` bleibt null, und das finally fände nichts.
			kind.kill('SIGKILL');
			ablehnen(
				new Error(
					`Der gebaute Server hat in 30 Sekunden keine Listening-Zeile gemeldet.${protokoll()}`
				)
			);
		}, 30_000);

		kind.stdout.on('data', schauen);
		kind.on('exit', vorzeitigesEnde);
		kind.on('error', startfehler);
		// Was schon vor dem Anhängen kam, wäre sonst verpasst.
		schauen();
	});
}

/**
 * Beendet den Unterprozess und wartet auf sein Ende.
 *
 * SIGTERM zuerst — adapter-node fährt darauf geordnet herunter und schliesst die
 * Datenbank. Wer darauf nicht reagiert, bekommt nach fünf Sekunden SIGKILL, und
 * die Zusage löst sich in **jedem** Fall auf: ein hängender Abbau hielte sonst
 * die ganze lint-Kette an, und zwar nach getaner Arbeit.
 */
export function serverBeenden(server: Server | null): Promise<void> {
	if (server === null) return Promise.resolve();
	const kind = server.kind;
	if (kind.exitCode !== null || kind.signalCode !== null) return Promise.resolve();

	return new Promise((erfuellen) => {
		let erledigt = false;
		function fertig(): void {
			if (erledigt) return;
			erledigt = true;
			clearTimeout(notbremse);
			erfuellen();
		}

		const notbremse = setTimeout(() => {
			kind.kill('SIGKILL');
			// Auch auf SIGKILL wird nicht endlos gewartet.
			setTimeout(fertig, 2_000);
		}, 5_000);

		kind.once('exit', fertig);
		kind.kill('SIGTERM');
		// Das Kind kann zwischen der Prüfung oben und dem Anmelden geendet sein.
		if (kind.exitCode !== null || kind.signalCode !== null) fertig();
	});
}

// ---------------------------------------------------------------------------
// Anfragen.
// ---------------------------------------------------------------------------

export type Anfrage = { keks?: string; accept?: string };

export function holen(port: number, pfad: string, wie: Anfrage = {}): Promise<Response> {
	const kopfzeilen: Record<string, string> = { accept: wie.accept ?? BROWSER_ACCEPT };
	if (wie.keks !== undefined) kopfzeilen.cookie = wie.keks;
	// redirect: 'manual' — eine 303, der jemand folgt, ist keine gemessene 303.
	// Die Zeitschranke ist kein Beiwerk: ein Server, der annimmt und nie
	// antwortet, hinge sonst die lint-Kette auf, ohne eine Zeile zu melden.
	return fetch(`http://127.0.0.1:${port}${pfad}`, {
		headers: kopfzeilen,
		redirect: 'manual',
		signal: AbortSignal.timeout(ANFRAGE_SCHRANKE_MS),
	});
}

/** Der Wert eines Attributs aus einer Set-Cookie-Zeile, oder null. */
export function attributWert(setzung: string, attribut: string): string | null {
	for (const teil of setzung.split(';')) {
		const [name, ...rest] = teil.trim().split('=');
		if (name.toLowerCase() === attribut.toLowerCase()) return rest.join('=');
	}
	return null;
}

/** Aus einer Set-Cookie-Zeile die Cookie-Kopfzeile für die nächste Anfrage. */
export function keksAus(setzung: string): string {
	return `sitzung=${(attributWert(setzung, 'sitzung') ?? '').trim()}`;
}
