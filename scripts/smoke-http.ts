/*
 * smoke:http — der ausgeführte Nachweis an einem echten Server.
 *
 * **Warum es dieses zweite Skript gibt.** scripts/smoke-zugang.ts stellt
 * SvelteKit nach: ein resolve-Stub, eine Cookie-Attrappe, eine eigene Wiedergabe
 * der Fehlerseite. Jede nachgestellte Grenze kann Behauptungen erzeugen, die
 * sich selbst bestätigen, und drei Prüfrunden haben genau diese Klasse dort
 * gefunden. Drei Fehler kamen in Story 1.3 trotz voller Prüfkette und dreier
 * Review-Schichten bis zur Benutzung durch; **zwei** davon waren Eigenschaften
 * des ausgelieferten HTML, die keine Attrappe je zu Gesicht bekommt — der dritte
 * war Verhalten im Browser und bleibt auch hier ungedeckt.
 *
 * Dieses Skript startet darum den **gebauten** Baum als Unterprozess auf einem
 * freien Port gegen eine Wegwerf-Datenbank und misst, was über die Steckdose
 * kommt: Status, Kopfzeilen, set-cookie und Bytes. Nichts davon entscheidet das
 * Skript selbst.
 *
 * **Was hier bewusst nicht steht.** Kein Browser und kein Testframework — das
 * Verhalten im Browser (Fokusfang eines dialog, Live-Regionen, Wischgesten)
 * bleibt ungedeckt und ist als Stufe C in deferred-work.md an eine eigene
 * Auslösebedingung gebunden. Und keine POST-Behauptung: die form actions sind in
 * scripts/smoke-zugang.ts mit echten Formulardaten belegt, und die
 * Akzeptanzkriterien dieser Story fragen keine. Der Vollständigkeit halber, weil
 * eine frühere Fassung dieses Kommentars das Gegenteil behauptete: technisch
 * stünde dem nichts im Weg — ORIGIN wird unten auf **genau** den Port gesetzt,
 * auf dem der Server lauscht, und ein Origin-Kopf an der Anfrage passierte
 * SvelteKits CSRF-Schranke. Gemessen.
 *
 * **Zwei Dinge, die erst der echte Server gezeigt hat**, beide beim Bau dieses
 * Skripts gemessen und darum hier als Behauptung festgehalten:
 *
 *   1. Der content-type der Abweisung hängt am Accept-Kopf. Ohne
 *      `Accept: text/html` antwortet SvelteKits Fatal-Pfad mit
 *      `application/json` und dem Satz im Feld `message`; erst mit dem Kopf
 *      eines Browsers kommt die Hülle aus src/error.html. Wer nur die eine
 *      Fassung misst, prüft die falsche Zusage — beide stehen unten.
 *   2. Die Referrer-Policy erreicht die 403 der **Einlöseroute** sehr wohl,
 *      nur die des Wächters nicht. Der Kommentar in src/hooks.server.ts hat
 *      beide als ungedeckt geführt und ausgerechnet die tokentragende die
 *      „unangenehmere" genannt; gemessen ist sie die gedeckte. Der Unterschied
 *      hat einen Grund: der Wurf der Einlöseroute liegt **innerhalb** von
 *      resolve und kommt als Antwort zurück durch mitKopfzeilen, der des
 *      Wächters entsteht daneben. Beide Zustände stehen unten als Behauptung,
 *      damit ein Rückfall in die eine wie in die andere Richtung auffällt.
 *
 * Am Ende zählt das Skript, wie viele Behauptungen tatsächlich gelaufen sind,
 * und vergleicht mit einer festen Zahl — wie smoke, und aus demselben Grund:
 * eine Behauptung, die in einem `if` stillschweigend ausfällt, hinterlässt sonst
 * keine Spur. Dass der geteilte Prüfkern selbst beisst, belegt
 * scripts/pruefhelfer-selftest.ts.
 */
import { spawn } from 'node:child_process';
import type { ChildProcessByStdio } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import type { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import {
	aufraeumen,
	pruefen,
	pruefenGleich,
	unerwarteterWurf,
	wegwerfVerzeichnis,
	zaehlerstand,
} from './pruefhelfer.ts';
import { datenschichtStarten } from '../src/lib/server/db/index.ts';
import { mitgliedAnlegen } from '../src/lib/server/db/queries/members.ts';
import { tokenErzeugen, tokenHashen } from '../src/lib/server/token.ts';
import { KEIN_ZUGANG } from '../src/lib/texte.ts';

/**
 * So viele Behauptungen muss ein vollständiger Lauf ablegen, die Schlusszählung
 * selbst nicht mitgerechnet. Wer eine hinzufügt oder entfernt, zieht die Zahl
 * mit — genau wie in scripts/smoke-zugang.ts. Eine Seite mehr in `seiten` sind
 * sieben Behauptungen mehr, und dieselbe Zahl steht in README.md.
 */
const ERWARTETE_BEHAUPTUNGEN = 77;

const GUTES_GEHEIMNIS = 'smoke-http-geheimnis-mit-genug-verschiedenen-zeichen-0123456789';

/**
 * Der Accept-Kopf eines Browsers, wortgleich mit dem, was Safari und Firefox
 * für ein Dokument schicken. Er steht als Konstante und nicht als `text/html`
 * an jeder Anfrage, weil genau dieser Kopf entscheidet, ob SvelteKit auf dem
 * Fatal-Pfad HTML oder JSON liefert.
 */
const BROWSER_ACCEPT = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';

/**
 * Ein Jahr in Sekunden — die Laufzeit aus src/lib/server/auth.ts.
 *
 * Abgeschrieben und nicht importiert, weil `LAUFZEIT_SEKUNDEN` dort modulprivat
 * ist; scripts/smoke-zugang.ts führt aus demselben Grund ein eigenes `EIN_JAHR`.
 * Die zweite Wahrheit ist benannt und in deferred-work.md notiert.
 */
const LAUFZEIT_SEKUNDEN = 60 * 60 * 24 * 365;

/** Keine einzelne Anfrage darf die Prüfkette anhalten. */
const ANFRAGE_SCHRANKE_MS = 15_000;

const wurzel = fileURLToPath(new URL('..', import.meta.url));
// migrationsFolder ist arbeitsverzeichnisrelativ, und der Unterprozess erbt das
// Arbeitsverzeichnis. Das Skript darf trotzdem von überall aufgerufen werden.
process.chdir(wurzel);

// ---------------------------------------------------------------------------
// Der Bau. Ohne ihn misst dieses Skript nichts.
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
function juengsteAenderung(pfad: string): number {
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
const BAU_EINGABEN = [
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
function bauPruefen(): void {
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
		'\nsmoke:http misst den **gebauten** Baum und baut ihn bewusst nicht selbst —\n' +
			'ein Skript, das seinen eigenen Prüfgegenstand herstellt, verdeckt jeden\n' +
			'Baufehler. Erst bauen, dann prüfen:\n' +
			'  npm run build && npm run smoke:http'
	);
	// Dieselbe Schlusszeile wie jeder andere rote Lauf: wer sie vermisst, sucht
	// nach einem Absturz, wo eine benannte Vorbedingung fehlschlug.
	const stand = zaehlerstand();
	console.error(
		`\nsmoke:http: ${stand.gescheitert} von ${stand.gelaufen} Behauptung(en) nicht erfüllt.`
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
function freierPort(): Promise<number> {
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

type Saat = {
	adminToken: string;
	mitgliedToken: string;
	hashes: string[];
	klartexte: string[];
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
function saeen(): Saat {
	datenschichtStarten();

	const adminToken = tokenErzeugen();
	const mitgliedToken = tokenErzeugen();
	const adminHash = tokenHashen(adminToken);
	const mitgliedHash = tokenHashen(mitgliedToken);

	mitgliedAnlegen({ name: 'Vera Verwaltung', inviteTokenHash: adminHash, isAdmin: true });
	mitgliedAnlegen({ name: 'Manu Mitglied', inviteTokenHash: mitgliedHash, isAdmin: false });

	return {
		adminToken,
		mitgliedToken,
		hashes: [adminHash, mitgliedHash],
		klartexte: [adminToken, mitgliedToken],
	};
}

// ---------------------------------------------------------------------------
// Der Unterprozess.
// ---------------------------------------------------------------------------

type Server = {
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
function serverStarten(port: number, datenbankPfad: string): Promise<Server> {
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
function serverBeenden(server: Server | null): Promise<void> {
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
// Anfragen und Auswertung.
// ---------------------------------------------------------------------------

type Anfrage = { keks?: string; accept?: string };

function holen(port: number, pfad: string, wie: Anfrage = {}): Promise<Response> {
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

/**
 * Die Hülle, wie sie aus src/error.html entstehen muss.
 *
 * Die Ersetzung steht hier ein zweites Mal und liest ausdrücklich **nicht**
 * SvelteKits erzeugte Vorlage aus .svelte-kit/. Der Vergleich soll die Vorlage
 * gegen die Antwort halten, nicht die Erzeugung gegen sich selbst. Gelesen wird
 * beim Aufruf und nicht beim Modulladen: eine fehlende Datei soll ein benannter
 * Befund im Rahmen unten sein und kein roher Wurf daneben.
 *
 * Die Meldung wird maskiert wie bei SvelteKit — `&` und `<`, nachgelesen in
 * dessen escape_html_dict. Ohne diesen Schritt wäre die Byte-Gleichheit
 * stillschweigend an die Bedingung geknüpft, dass kein Satz je ein `&` trägt,
 * und der erste, der eines bekäme, bekäme ein falsches Rot. Die
 * Sonderbehandlung einzelner Ersatzzeichen aus derselben Quelle ist ausgelassen:
 * sie erreicht keinen Satz aus src/lib/texte.ts.
 *
 * Die Ersatzwerte stehen als Funktion, damit ein `$&` im Satz nicht als
 * Rückverweis gelesen wird.
 */
function huelle(status: number, meldung: string): string {
	const vorlage = readFileSync(join(wurzel, 'src', 'error.html'), 'utf8');
	const maskiert = meldung.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
	return vorlage
		.replaceAll('%sveltekit.error.message%', () => maskiert)
		.replaceAll('%sveltekit.status%', () => String(status));
}

/**
 * Ausgeglichene Kommentarmarken.
 *
 * Der Fehler, den diese Prüfung fängt, ist am 2026-08-27 passiert: ein
 * %sveltekit.head% stand in einem HTML-Kommentar, der eingesetzte Kopfbereich
 * brachte eigene Kommentarmarken mit, deren Ende schloss den Kommentar
 * vorzeitig — und der Rest der Entwicklerprosa stand sichtbar über der
 * Titelleiste. Gate-Regel 12 hält die Quelle sauber; hier wird das **Ergebnis**
 * gemessen.
 *
 * Skript- und Stilblöcke bleiben aussen vor, auch unabgeschlossene: ein `-->` in
 * einer eingebetteten Zeichenkette ist kein aufgebrochener Kommentar, und ein
 * Fehlalarm an dieser Stelle wäre schlimmer als die kleine Lücke.
 *
 * Benannte Grenze: ein `-->` in einem **Attributwert** (`<div data-x="-->">`)
 * gälte weiter als Kommentarende und ergäbe einen Fehlalarm. Die Form kommt im
 * Baum nicht vor, und ein halber HTML-Parser wäre hier mehr Risiko als Nutzen.
 */
function kommentareAusgeglichen(html: string): boolean {
	const nurMarkup = html
		.replace(/<script\b[^>]*>[\s\S]*?(<\/script>|$)/gi, '')
		.replace(/<style\b[^>]*>[\s\S]*?(<\/style>|$)/gi, '');

	let i = 0;
	for (;;) {
		const auf = nurMarkup.indexOf('<!--', i);
		const zu = nurMarkup.indexOf('-->', i);
		if (auf === -1 && zu === -1) return true;
		// Ein Anfang ohne Ende, oder ein Ende, das vor seinem Anfang steht.
		if (zu === -1 || auf === -1 || zu < auf) return false;
		i = zu + 3;
	}
}

/**
 * Ein Attribut aus einer set-cookie-Zeile.
 *
 * Benannte Grenze: getrennt wird hart an `;`. Ein Cookie-**Wert** mit Semikolon
 * zerfiele damit still — den gibt es hier nicht, weil der Wert ein JWT aus
 * base64url-Teilen ist.
 */
function traegtAttribut(setzung: string, attribut: string): boolean {
	return setzung.split(';').some((teil) => teil.trim().toLowerCase() === attribut.toLowerCase());
}

function attributWert(setzung: string, attribut: string): string | null {
	for (const teil of setzung.split(';')) {
		const [name, ...rest] = teil.split('=');
		if (name.trim().toLowerCase() === attribut.toLowerCase()) return rest.join('=').trim();
	}
	return null;
}

/** Der Cookie-Kopf für die nächste Anfrage, aus einer set-cookie-Zeile. */
function keksAus(setzung: string): string {
	return `sitzung=${(attributWert(setzung, 'sitzung') ?? '').trim()}`;
}

// ===========================================================================
// Die Prüfliste.
// ===========================================================================

let server: Server | null = null;

/*
 * Ein Abbruch von aussen (Strg-C, ein kill auf die lint-Kette) läuft nicht durch
 * das finally unten. Ohne diese Zeilen bliebe dann ein Node-Prozess auf dem Port
 * stehen und ein Wegwerfverzeichnis samt SQLite-Datei liegen.
 */
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
	process.on(signal, () => {
		server?.kind.kill('SIGKILL');
		aufraeumen();
		process.exit(1);
	});
}

try {
	bauPruefen();

	const arbeit = wegwerfVerzeichnis('gartenplaner-smoke-http-');
	const datenbankPfad = join(arbeit, 'smoke-http.sqlite');
	process.env.DATABASE_PATH = datenbankPfad;
	const saat = saeen();

	const port = await freierPort();
	server = await serverStarten(port, datenbankPfad);

	// --- Start ---------------------------------------------------------------
	const adresse = server.gemeldeteAdresse();
	pruefen(
		'der gebaute Server meldet eine Adresse auf stdout',
		adresse !== null,
		`stdout: ${server.ausgabe().trim() || '(leer)'}`
	);
	// Der Port aus der gemeldeten Adresse statt der Adresse selbst: die Aussage
	// ist "derselbe Port", und ein Schrägstrich mehr oder weniger in adapter-nodes
	// Formatierung soll sie nicht rot machen. URL.canParse statt new URL, damit
	// eine unerwartete Form eine rote Behauptung ergibt und keinen Abbruch.
	pruefenGleich(
		'er lauscht auf genau dem angeforderten Port — die Portsonde hat ihr Rennen gewonnen',
		adresse !== null && URL.canParse(adresse) ? new URL(adresse).port : adresse,
		String(port)
	);

	// --- Einlösen über HTTP ---------------------------------------------------
	const eingeloest = await holen(port, `/i/${saat.adminToken}`);
	pruefenGleich('das Einlösen antwortet mit 303', eingeloest.status, 303);
	pruefenGleich('die 303 zeigt auf /', eingeloest.headers.get('location'), '/');

	const setzungen = eingeloest.headers.getSetCookie();
	pruefenGleich('das Einlösen setzt genau ein Cookie', setzungen.length, 1);
	const setzung = setzungen[0] ?? '';
	pruefen(
		'das gesetzte Cookie heisst sitzung',
		setzung.startsWith('sitzung='),
		`war ${JSON.stringify(setzung.slice(0, 40))}`
	);
	pruefen('das Cookie trägt HttpOnly', traegtAttribut(setzung, 'HttpOnly'), setzung);
	pruefenGleich('das Cookie trägt SameSite=Lax', attributWert(setzung, 'SameSite'), 'Lax');
	pruefenGleich('das Cookie trägt Path=/', attributWert(setzung, 'Path'), '/');
	pruefenGleich(
		'das Cookie läuft ein Jahr',
		attributWert(setzung, 'Max-Age'),
		String(LAUFZEIT_SEKUNDEN)
	);
	pruefen(
		'das Cookie trägt Secure — NODE_ENV ist nicht development',
		traegtAttribut(setzung, 'Secure'),
		setzung
	);
	// Das Sitzungs-Cookie hängt an der member_id, nicht am Token. Stünde der
	// Klartext darin, wäre der Einmal-Charakter des Links dahin.
	pruefen(
		'im Cookie steht kein Klartext-Token',
		!saat.klartexte.some((token) => setzung.includes(token)),
		'der Klartext des Einladungstokens steht in der set-cookie-Zeile'
	);

	const adminKeks = keksAus(setzung);

	// --- Angemeldet -----------------------------------------------------------
	const startseite = await holen(port, '/', { keks: adminKeks });
	pruefenGleich('mit dem erhaltenen Cookie antwortet / mit 200', startseite.status, 200);
	pruefen(
		'die Startseite kommt als HTML',
		(startseite.headers.get('content-type') ?? '').startsWith('text/html'),
		startseite.headers.get('content-type') ?? '(keine)'
	);
	pruefenGleich(
		'der normale Pfad trägt die Referrer-Policy aus hooks.server.ts',
		startseite.headers.get('referrer-policy'),
		'no-referrer'
	);

	// --- Die Abweisung des Wächters, Browser-Pfad -----------------------------
	const abgewiesen = await holen(port, '/');
	const abgewiesenRumpf = await abgewiesen.text();
	pruefenGleich('ohne Cookie antwortet / mit 403', abgewiesen.status, 403);
	pruefenGleich(
		'die Abweisung kommt als HTML',
		abgewiesen.headers.get('content-type'),
		'text/html; charset=utf-8'
	);
	pruefenGleich(
		'ihr Rumpf ist Byte für Byte die aus src/error.html gebaute Hülle',
		abgewiesenRumpf,
		huelle(403, KEIN_ZUGANG)
	);
	pruefen(
		'der vorgeschriebene Satz steht im title',
		abgewiesenRumpf.includes(`<title>${KEIN_ZUGANG}</title>`)
	);
	pruefen('derselbe Satz steht im h1', abgewiesenRumpf.includes(`<h1>${KEIN_ZUGANG}</h1>`));
	pruefen('die Hülle nennt den Status im Text', abgewiesenRumpf.includes('Fehler 403'));
	/*
	 * Diese Behauptung schreibt einen **Mangel** fest, und das ist Absicht: die
	 * 403 des Wächters ist die einzige Antwort, die die Kopfzeile nicht erreicht,
	 * weil ihr Wurf neben resolve liegt. Wer die Lücke schliesst, bekommt hier
	 * ein Rot — das wäre eine Verbesserung und kein Rückfall, und die Behauptung
	 * gehört dann umgedreht statt entfernt.
	 */
	pruefenGleich(
		'die 403 des Wächters trägt **keine** Referrer-Policy — sie entsteht neben resolve',
		abgewiesen.headers.get('referrer-policy'),
		null
	);
	pruefenGleich('die Abweisung setzt kein Cookie', abgewiesen.headers.getSetCookie().length, 0);

	// --- Dieselbe Abweisung ohne Browser-Accept -------------------------------
	const alsJson = await holen(port, '/', { accept: '*/*' });
	const jsonRumpf = await alsJson.text();
	pruefenGleich('ohne HTML im Accept bleibt es bei 403', alsJson.status, 403);
	pruefen(
		'ohne HTML im Accept antwortet der Fatal-Pfad als JSON',
		(alsJson.headers.get('content-type') ?? '').startsWith('application/json'),
		alsJson.headers.get('content-type') ?? '(keine)'
	);
	// Von Hand ausgewertet statt über .json(): ein unerwarteter Rumpf soll diese
	// eine Behauptung rot machen und nicht die restliche Prüfliste abbrechen.
	let jsonMeldung: unknown;
	try {
		jsonMeldung = (JSON.parse(jsonRumpf) as { message?: unknown }).message;
	} catch {
		jsonMeldung = `(kein JSON: ${jsonRumpf.slice(0, 60)})`;
	}
	pruefenGleich('im JSON steht derselbe eine Satz', jsonMeldung, KEIN_ZUGANG);

	// --- Die Abweisung der Einlöseroute ---------------------------------------
	const unbekannt = await holen(port, '/i/dieses-token-gibt-es-nicht');
	const unbekanntRumpf = await unbekannt.text();
	pruefenGleich('ein unbekanntes Token wird mit 403 abgewiesen', unbekannt.status, 403);
	pruefenGleich(
		'auch sie kommt als HTML',
		unbekannt.headers.get('content-type'),
		'text/html; charset=utf-8'
	);
	pruefenGleich(
		'ihr Rumpf ist von dem des Wächters nicht zu unterscheiden',
		unbekanntRumpf,
		abgewiesenRumpf
	);
	pruefenGleich(
		'die 403 der Einlöseroute trägt die Referrer-Policy sehr wohl — ihr Wurf liegt in resolve',
		unbekannt.headers.get('referrer-policy'),
		'no-referrer'
	);

	// --- Das ausgelieferte HTML -----------------------------------------------
	/*
	 * Der Kern dieser Story. Alle gerenderten Seiten, je fünf Abwesenheiten — und
	 * je eine Gegenprobe, damit keine von ihnen sich an einer leeren Antwort
	 * selbst bestätigt: der erwartete Titel muss dastehen.
	 *
	 * /monatsplan und /aufgabe stehen mit in der Liste, obwohl die
	 * Akzeptanzkriterien nur drei Seiten nennen. Die Prüfung kostet je eine
	 * Anfrage, und eine ungeprüfte gerenderte Seite ist genau der Ort, an dem die
	 * nächste Kommentarmarke aufbricht.
	 */
	const seiten = [
		{ pfad: '/', titel: 'Aufgaben' },
		{ pfad: '/verwaltung', titel: 'Verwaltung' },
		{ pfad: '/mehr', titel: 'Mehr' },
		{ pfad: '/monatsplan', titel: 'Monatsplan' },
		{ pfad: '/aufgabe', titel: 'Aufgabe' },
	];

	for (const seite of seiten) {
		const antwort = await holen(port, seite.pfad, { keks: adminKeks });
		const html = await antwort.text();

		pruefenGleich(`${seite.pfad} antwortet der Adminperson mit 200`, antwort.status, 200);
		pruefen(
			`${seite.pfad} trägt ihren Titel — die Gegenprobe gegen eine leere Antwort`,
			html.includes(`<title>${seite.titel}</title>`)
		);
		pruefen(
			`${seite.pfad} trägt keinen unersetzten SvelteKit-Platzhalter`,
			!/%sveltekit\.[a-z.]+%/i.test(html),
			(/%sveltekit\.[a-z.]+%/i.exec(html) ?? [])[0]
		);
		pruefen(`${seite.pfad} hat ausgeglichene Kommentarmarken`, kommentareAusgeglichen(html));
		pruefen(
			`${seite.pfad} trägt kein Bruchstück des Bestätigungstexts`,
			!html.includes(', aufgenommen am') && !html.includes('name="mitgliedId" value=""')
		);
		pruefen(
			`${seite.pfad} trägt keinen Token-Hash`,
			!saat.hashes.some((hash) => html.includes(hash))
		);
		pruefen(
			`${seite.pfad} trägt kein Klartext-Token`,
			!saat.klartexte.some((token) => html.includes(token))
		);
	}

	// --- Die Adminweiche über HTTP --------------------------------------------
	const mitgliedEingeloest = await holen(port, `/i/${saat.mitgliedToken}`);
	pruefenGleich(
		'auch das Mitglied ohne Adminrechte löst mit 303 ein',
		mitgliedEingeloest.status,
		303
	);
	const mitgliedSetzungen = mitgliedEingeloest.headers.getSetCookie();
	// Ohne diese Behauptung wäre der Keks unten still leer, und die drei
	// folgenden Befunde nennten die falsche Ursache.
	pruefenGleich('auch dabei kommt genau ein Cookie', mitgliedSetzungen.length, 1);
	const mitgliedKeks = keksAus(mitgliedSetzungen[0] ?? '');

	const verwaltungOhneRechte = await holen(port, '/verwaltung', { keks: mitgliedKeks });
	pruefenGleich(
		'/verwaltung weist ein Mitglied ohne Adminrechte mit 303 weg',
		verwaltungOhneRechte.status,
		303
	);
	pruefenGleich(
		'die Wegleitung zeigt auf / — die Verwaltung existiert für sie nicht',
		verwaltungOhneRechte.headers.get('location'),
		'/'
	);

	const verwaltungAlsAdmin = await holen(port, '/verwaltung', { keks: adminKeks });
	pruefenGleich('dieselbe Anfrage als Adminperson bekommt 200', verwaltungAlsAdmin.status, 200);

	/*
	 * **Das Umbenennen ohne JavaScript** — die einzige Deckung, die dieser Zusage
	 * entspricht.
	 *
	 * scripts/smoke-zugang.ts ruft die action direkt und baut sein FormData
	 * selbst; es sieht das ausgelieferte Markup nie. Seine Textprüfungen lesen die
	 * Svelte-Datei, nicht das, was der Server daraus macht. Erst hier steht, was
	 * ein Browser ohne JavaScript wirklich bekäme: ein <form> mit method="POST",
	 * einer literalen action, dem Feld und der versteckten Zeilen-Id. Fehlt eines
	 * davon, ist die Aktion ohne JavaScript nicht bedienbar — und genau das hat
	 * die README behauptet, ohne dass es je gemessen war.
	 *
	 * Die Reihenfolge der Attribute wird **nicht** festgeschrieben: geprüft wird
	 * je Vorkommen, nicht ein zusammenhängender Abdruck. Ein Umsortieren durch
	 * Prettier oder Svelte ist keine gebrochene Zusage.
	 */
	/** Die Namen der fehlenden Teile einer Liste aus [Name, gefunden]. */
	const fehlendeTeile = (teile: readonly (readonly [string, boolean])[]) =>
		teile.filter(([, gefunden]) => !gefunden).map(([name]) => name);

	const verwaltungHtml = await verwaltungAlsAdmin.text();
	/*
	 * Je Formular **eigens** geschnitten, Tag und Rumpf zusammen.
	 *
	 * Eine Suche über das ganze Dokument war hier zuerst falsch und blieb es
	 * unbemerkt: `name="mitgliedId"` steht auch im Formular von `neuAusstellen`,
	 * und die Behauptung blieb grün, nachdem das versteckte Feld aus dem
	 * Umbenennen-Formular entfernt war. Gemessen. Genau die Fehlerklasse, gegen
	 * die dieser Nachweis steht — ein Muster, das seine Zusage anderswo erfüllt
	 * findet, prüft nichts.
	 */
	const umbenennenFormulare = [
		...verwaltungHtml.matchAll(/<form\b[^>]*action="\?\/umbenennen"[^>]*>([\s\S]*?)<\/form>/g),
	];
	const jedes = (pruefung: (ganzes: string, rumpf: string) => boolean) =>
		umbenennenFormulare.length > 0 &&
		umbenennenFormulare.every((treffer) => pruefung(treffer[0], treffer[1] ?? ''));
	const noJsTeile = [
		// Zwei aktive Mitglieder in der Saat, also zwei Formulare: die Gegenprobe
		// dagegen, dass die Zusagen darunter an einer leeren Menge hängen.
		['ein Formular je aktiver Zeile', umbenennenFormulare.length === 2],
		[
			'jedes mit method="POST" — sonst fiele es ohne JavaScript auf GET zurück',
			jedes((ganzes) => /<form\b[^>]*\bmethod="POST"/i.test(ganzes)),
		],
		[
			'jedes mit dem Feld name="neuerName"',
			jedes((_, rumpf) => /<input\b[^>]*\bname="neuerName"/.test(rumpf)),
		],
		[
			// Mit einer **echten** Zahl darin: ein value="" wäre ein Formular, das
			// seine Zeile nicht benennt, und jeder Versand endete im Satz über das
			// nicht ansprechbare Mitglied.
			'jedes mit dem versteckten mitgliedId und einer echten Id',
			jedes((_, rumpf) => /<input\b[^>]*\bname="mitgliedId"[^>]*\bvalue="[0-9]+"/.test(rumpf)),
		],
		[
			'und jedes mit einem Absendeknopf',
			jedes((_, rumpf) => /<button\b[^>]*\btype="submit"/.test(rumpf)),
		],
	] as const;
	pruefen(
		'/verwaltung liefert das Umbenennen-Formular aus — ohne JavaScript bedienbar',
		fehlendeTeile(noJsTeile).length === 0,
		`fehlt: ${fehlendeTeile(noJsTeile).join(', ')} (${umbenennenFormulare.length} Formular(e))`
	);

	const mehrOhneRechte = await holen(port, '/mehr', { keks: mitgliedKeks });
	const mehrOhneRechteHtml = await mehrOhneRechte.text();
	pruefenGleich('/mehr gehört allen und antwortet mit 200', mehrOhneRechte.status, 200);
	pruefen(
		'/mehr trägt ohne Adminrechte keinen Verwaltungs-Eintrag',
		!mehrOhneRechteHtml.includes('>Verwaltung<')
	);

	const mehrAlsAdmin = await holen(port, '/mehr', { keks: adminKeks });
	pruefen(
		'/mehr trägt ihn für die Adminperson sehr wohl — die Gegenprobe',
		(await mehrAlsAdmin.text()).includes('>Verwaltung<')
	);

	// --- Was der Server dabei selbst gesagt hat -------------------------------
	/*
	 * Die billigste Ausbeute des ganzen Aufbaus: handleError schreibt jeden
	 * unerwarteten Wurf ab 500 auf die Fehlerausgabe. Ohne diese Behauptung
	 * bliebe ein Server, der während des Laufs Ausnahmen protokolliert, hinter
	 * lauter grünen Statuscodes unsichtbar.
	 */
	pruefenGleich(
		'der Server hat während des ganzen Laufs nichts auf die Fehlerausgabe gesagt',
		server.fehlerausgabe().trim(),
		''
	);
} catch (fehler) {
	unerwarteterWurf('smoke:http', fehler);
	// Die Fehlerausgabe des Servers ist bei einem Abbruch oft die eigentliche
	// Ursache — "fetch failed" allein sagt nichts.
	const gesagt = server?.fehlerausgabe().trim() ?? '';
	if (gesagt !== '') {
		console.error(`         Der Server sagte dazu:\n${gesagt}`);
	}
} finally {
	await serverBeenden(server);
	aufraeumen();
}

// Eine Behauptung, die in einem if stillschweigend ausfällt, fällt hier auf.
// Der Stand wird **vor** der Schlussbehauptung gelesen: sie zählt sich selbst
// nicht mit, sonst wäre die Zahl immer um eins daneben.
const abgelegt = zaehlerstand().gelaufen;
pruefen(
	`alle ${ERWARTETE_BEHAUPTUNGEN} Behauptungen sind gelaufen`,
	abgelegt === ERWARTETE_BEHAUPTUNGEN,
	`es liefen ${abgelegt}`
);

const stand = zaehlerstand();
if (stand.gescheitert > 0) {
	console.error(
		`\nsmoke:http: ${stand.gescheitert} von ${stand.gelaufen} Behauptung(en) nicht erfüllt.`
	);
	process.exit(1);
}
console.log(
	`\nsmoke:http: ${stand.gelaufen} Behauptungen am gebauten Server über HTTP ausgeführt belegt.`
);
