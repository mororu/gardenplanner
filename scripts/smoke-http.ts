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
 * Auslösebedingung gebunden.
 *
 * **Genau eine POST-Behauptung**, und der Grund für die Ausnahme ist zugleich
 * ihre Rechtfertigung. Die form actions selbst sind in scripts/smoke-zugang.ts
 * mit echten Formulardaten belegt; was dort niemand sehen kann, ist das
 * **Dokument**, das ein Browser ohne JavaScript auf einen abgewiesenen POST
 * zurückbekommt. Genau daran hängt seit Story 3.0.1 eine ausdrückliche Zusage der
 * README — aufgeklapptes Formular, verworfene Eingabe im Feld, Kante daran, Satz
 * darunter —, und sie stand hier zuerst ungedeckt: das `open` am <details>
 * entfernt lief grün durch die ganze Kette. Deshalb eine, und nur für diesen
 * Weg. Dass es technisch geht, war schon vorher gemessen: ORIGIN wird unten auf
 * **genau** den Port gesetzt, auf dem der Server lauscht, und ein Origin-Kopf an
 * der Anfrage passiert SvelteKits CSRF-Schranke.
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
import { NAME_HOECHSTLAENGE, NAME_ZU_LANG } from '../src/lib/mitgliedsname.ts';
import { KEIN_ZUGANG, MITGLIED_NICHT_ANSPRECHBAR } from '../src/lib/texte.ts';

/**
 * So viele Behauptungen muss ein vollständiger Lauf ablegen, die Schlusszählung
 * selbst nicht mitgerechnet. Wer eine hinzufügt oder entfernt, zieht die Zahl
 * mit — genau wie in scripts/smoke-zugang.ts. Eine Seite mehr in `seiten` sind
 * sieben Behauptungen mehr, und dieselbe Zahl steht in README.md.
 */
const ERWARTETE_BEHAUPTUNGEN = 106;

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
 * Ein POST an eine form action, so wie ihn ein Browser **ohne** JavaScript
 * schickt: `application/x-www-form-urlencoded`, kein `x-sveltekit-action`.
 *
 * Der `origin`-Kopf ist Pflicht und kein Beiwerk: SvelteKit weist jeden POST ab,
 * dessen Herkunft nicht auf ORIGIN passt. Er trägt darum denselben Wert, der dem
 * Unterprozess oben in die Umgebung gesetzt wird — dieselbe Zeichenkette, nicht
 * eine zweite, die ihr gleicht.
 *
 * `redirect: 'manual'` aus demselben Grund wie in holen: eine 303, der jemand
 * folgt, ist keine gemessene 303.
 */
function abschicken(
	port: number,
	pfad: string,
	keks: string,
	felder: Record<string, string>
): Promise<Response> {
	return fetch(`http://127.0.0.1:${port}${pfad}`, {
		method: 'POST',
		headers: {
			accept: BROWSER_ACCEPT,
			cookie: keks,
			origin: `http://127.0.0.1:${port}`,
			'content-type': 'application/x-www-form-urlencoded',
		},
		body: new URLSearchParams(felder).toString(),
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
	 *
	 * **Der Dienstplan kam mit Story 3.1 dazu — und nicht von selbst.** Die Story
	 * baute daneben einen eigenen Block für den Dienstplan und liess die Seite
	 * hier fehlen; sie ging darum ohne `<title>` in Betrieb, weil diese Schleife
	 * die einzige Stelle ist, die den Titel überhaupt misst. Die Lehre steht in
	 * der Liste selbst: **jede** gerenderte Seite gehört hier hinein, und der Ort
	 * dafür ist diese Zeile, nicht ein zweiter Block weiter unten.
	 */
	const seiten = [
		{ pfad: '/', titel: 'Aufgaben' },
		{ pfad: '/verwaltung', titel: 'Verwaltung' },
		{ pfad: '/mehr', titel: 'Mehr' },
		{ pfad: '/monatsplan', titel: 'Monatsplan' },
		{ pfad: '/aufgabe', titel: 'Aufgabe' },
		{ pfad: '/dienstplan', titel: 'Dienstplan' },
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

	// --- Das Fenster an `Fällig bis`, am ausgelieferten Feld gemessen ---------
	/*
	 * Eintrag 31, entschieden am 2026-08-28: `Fällig bis` nimmt nur noch ein Datum
	 * an, das höchstens ein Jahr von heute entfernt liegt. Die Regel selbst misst
	 * `smoke` an fester Uhr; hier wird gemessen, was wirklich **ausgeliefert**
	 * wird — genau der Unterschied, für den Story 3.0 dieses Skript gebaut hat.
	 *
	 * Die zwei erwarteten Tage werden **unabhängig** gerechnet: heute in der Zone,
	 * dann 365 Tage in Millisekunden davor und danach. Über fristfenster gerechnet
	 * läse diese Behauptung nur ihre eigene Vorbereitung.
	 *
	 * Vor **und** nach der Anfrage gemessen, und beide Werte gelten — dieselbe
	 * Vorsicht wie bei der Vorbelegung in `smoke`: fiele Mitternacht dazwischen,
	 * wäre der Lauf einmal im Jahr zufällig rot.
	 */
	const tagInZone = (jetztMs: number): string =>
		new Intl.DateTimeFormat('en-CA', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			timeZone: 'Europe/Zurich',
		}).format(new Date(jetztMs));
	const TAG_MS = 24 * 60 * 60 * 1000;
	const vorAbruf = Date.now();
	const planAntwort = await holen(port, '/monatsplan', { keks: adminKeks });
	const planHtml = await planAntwort.text();
	const nachAbruf = Date.now();

	const datumsfeld = /<input\b[^>]*\bid="faellig-bis"[^>]*>/.exec(planHtml)?.[0] ?? '';
	pruefen(
		'das ausgelieferte Datumsfeld steht genau einmal im HTML',
		(planHtml.match(/\bid="faellig-bis"/g) ?? []).length === 1,
		`gefunden: ${(planHtml.match(/\bid="faellig-bis"/g) ?? []).length}`
	);
	const grenzeAus = (name: string): string =>
		new RegExp(`\\b${name}="([^"]*)"`).exec(datumsfeld)?.[1] ?? '';
	for (const [name, richtung] of [
		['min', -1],
		['max', 1],
	] as const) {
		const erlaubt = [
			tagInZone(vorAbruf + richtung * 365 * TAG_MS),
			tagInZone(nachAbruf + richtung * 365 * TAG_MS),
		];
		pruefen(
			`das ausgelieferte Feld trägt ${name} = heute ${richtung < 0 ? 'minus' : 'plus'} 365 Tage`,
			erlaubt.includes(grenzeAus(name)),
			`war ${JSON.stringify(grenzeAus(name))}, erwartet eines aus ${JSON.stringify(erlaubt)}`
		);
	}
	/*
	 * Die Vorbelegung muss **innerhalb** der eigenen Grenzen liegen. Das ist keine
	 * Selbstverständlichkeit, sondern die Zusage, dass alle drei Werte an
	 * derselben Uhr entstehen: käme die Vorgabe aus einer zweiten Messung, stünde
	 * am Monatsersten um 00:30 ein Vorgabewert im Feld, den seine eigene
	 * Obergrenze verbietet — und der Browser meldete es nicht, weil Schritt 1 kein
	 * `<form>` ist.
	 */
	const vorgabe = grenzeAus('value');
	pruefen(
		'und die Vorbelegung liegt zwischen den beiden Grenzen',
		vorgabe !== '' && vorgabe >= grenzeAus('min') && vorgabe <= grenzeAus('max'),
		`Vorgabe ${JSON.stringify(vorgabe)} zwischen ${JSON.stringify(grenzeAus('min'))} und ${JSON.stringify(grenzeAus('max'))}`
	);

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
			//
			// Erst den Tag schneiden, dann in ihm nach `value` suchen — ein Muster
			// `name="mitgliedId"[^>]*value=` schriebe die Reihenfolge der Attribute
			// fest, gegen die Zusage zwei Absätze weiter oben.
			'jedes mit dem versteckten mitgliedId und einer echten Id',
			jedes((_, rumpf) =>
				/\bvalue="[0-9]+"/.test(/<input\b[^>]*\bname="mitgliedId"[^>]*>/.exec(rumpf)?.[0] ?? '')
			),
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

	/*
	 * **Und die Abweisung ohne JavaScript** — die andere Hälfte, und die, an der
	 * die stärkste Zusage dieser Anwendung hängt.
	 *
	 * Die Behauptung darüber misst, dass ein Browser das Formular überhaupt
	 * abschicken **kann**. Diese hier misst, was er nach einer Abweisung
	 * zurückbekommt, und dafür gibt es keinen anderen Ort: `smoke` ruft die action
	 * direkt und sieht kein Dokument, und die Zusage lautet nicht „die action
	 * weist ab", sondern „das Dokument kommt mit dem aufgeklappten Formular, der
	 * verworfenen Eingabe, der Kante am Feld und dem Satz darunter fertig aus dem
	 * Server". Ohne JavaScript gibt es nichts, was davon etwas nachholte.
	 *
	 * Ein POST mit einem zu langen Namen, weil ein Name aus 81 Zeichen im Dokument
	 * unverwechselbar wiederzufinden ist — anders als ein Name aus Leerzeichen.
	 * Abgewiesen wird er **vor** dem UPDATE, die Saat bleibt also unberührt und
	 * die Behauptungen danach lesen denselben Zustand wie die davor.
	 */
	const abgewieseneZeile =
		/<input\b[^>]*\bname="mitgliedId"[^>]*>/
			.exec(umbenennenFormulare[0]?.[1] ?? '')?.[0]
			?.match(/\bvalue="([0-9]+)"/)?.[1] ?? '';
	const zuLangerName = 'Z'.repeat(NAME_HOECHSTLAENGE + 1);
	const abweisung = await abschicken(port, '/verwaltung?/umbenennen', adminKeks, {
		mitgliedId: abgewieseneZeile,
		neuerName: zuLangerName,
	});
	const abweisungHtml = await abweisung.text();
	/*
	 * Das `class` wird mit `[ "]` abgeschlossen und nicht mit `"` allein: Svelte
	 * hängt jeder Komponentenklasse seinen Bereichs-Hash an
	 * (`class="umbenennen svelte-…"`). Ein Muster auf `class="umbenennen"` wäre
	 * grün, solange es die Datei liest, und rot am ausgelieferten HTML — die
	 * Fehlerklasse, gegen die dieses ganze Skript steht, nur andersherum.
	 */
	const aufgeklappte = [
		...abweisungHtml.matchAll(
			/<details\b[^>]*\bclass="umbenennen[ "][^>]*\bopen\b[^>]*>([\s\S]*?)<\/details>/g
		),
	];
	const offenerRumpf = aufgeklappte[0]?.[1] ?? '';
	/*
	 * Alle Live-Regionen der Liste, je Zeile eine — gezählt wird, wie viele den
	 * Satz tragen.
	 *
	 * Über die Regionen und **nicht** über das ganze Dokument: SvelteKit legt das
	 * Ergebnis der action zusätzlich als Nutzlast für die Hydratation ab, der Satz
	 * steht dort ein zweites Mal, und eine Zählung über alles wäre nie 1. Gemessen
	 * — die erste Fassung dieser Behauptung fiel genau darüber.
	 */
	const satzRegionen = [
		...abweisungHtml.matchAll(/<p\b[^>]*\bid="neuer-name-fehler-([0-9]+)"[^>]*>([\s\S]*?)<\/p>/g),
	];
	const satzRegion = satzRegionen.find((treffer) => treffer[1] === abgewieseneZeile)?.[2] ?? '';
	const abweisungsTeile = [
		['die Zeilen-Id war überhaupt zu finden', abgewieseneZeile !== ''],
		['die Antwort ist ein 400', abweisung.status === 400],
		[
			// Kein JSON: ohne JavaScript ist die Antwort auf einen POST ein
			// vollständiges Dokument, sonst stünde die Person vor einer Nutzlast.
			'und ein HTML-Dokument',
			(abweisung.headers.get('content-type') ?? '').startsWith('text/html'),
		],
		[
			// Genau eines: die abgewiesene Zeile steht offen, jede andere zu.
			'genau ein aufgeklapptes <details> im ganzen Dokument',
			aufgeklappte.length === 1,
		],
		[
			'darin die verworfene Eingabe und nicht der alte Name',
			offenerRumpf.includes(`value="${zuLangerName}"`),
		],
		['das Feld trägt aria-invalid="true"', /aria-invalid="true"/.test(offenerRumpf)],
		[
			'und zeigt auf den Satz dieser Zeile',
			offenerRumpf.includes(`aria-describedby="neuer-name-fehler-${abgewieseneZeile}"`),
		],
		['der Satz steht in der Live-Region dieser Zeile', satzRegion.includes(NAME_ZU_LANG)],
		[
			// Und **nur** dort. Hinge der Rumpf der Region nicht an der Zeile, trüge
			// ihn jede aktive Zeile — hier wären das zwei von zwei.
			'und in keiner der anderen Zeilen',
			satzRegionen.length === 2 &&
				satzRegionen.filter((treffer) => (treffer[2] ?? '').includes(NAME_ZU_LANG)).length === 1,
		],
	] as const;
	pruefen(
		'ein abgewiesenes Umbenennen kommt ohne JavaScript fertig aus dem Server',
		fehlendeTeile(abweisungsTeile).length === 0,
		`fehlt: ${fehlendeTeile(abweisungsTeile).join(', ')} (Status ${abweisung.status}, ${aufgeklappte.length} offen)`
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

	/*
	 * Die Seite `/dienstplan` über HTTP — Story 3.1.
	 *
	 * Zwei Zusagen, die nur hier prüfbar sind, weil sie am ausgelieferten
	 * Dokument hängen und nicht am Rückgabewert einer load:
	 *
	 *   1. der Plan gehört allen — ein Mitglied ohne Adminrechte bekommt 200 und
	 *      sieht die Wochen;
	 *   2. die Namensliste des Vereins steht **nicht** in seinem HTML. Die load
	 *      gibt ihm `mitglieder: []`, und scripts/smoke-zugang.ts belegt das an
	 *      ihrem Rückgabewert — aber erst hier steht, dass auch die Komponente
	 *      keinen Namen aus einer anderen Quelle nachträgt.
	 */
	const planOhneRechte = await holen(port, '/dienstplan', { keks: mitgliedKeks });
	const planOhneRechteHtml = await planOhneRechte.text();
	const planAlsAdmin = await holen(port, '/dienstplan', { keks: adminKeks });
	const planAlsAdminHtml = await planAlsAdmin.text();

	pruefenGleich('/dienstplan gehört allen und antwortet mit 200', planOhneRechte.status, 200);
	pruefen(
		'/dienstplan trägt seinen Titel — die Gegenprobe gegen eine leere Antwort',
		planOhneRechteHtml.includes('>Dienstplan<')
	);
	pruefen(
		'und die Wochen stehen darin, mit Kalenderwoche',
		/KW\s*[0-9]+/.test(planOhneRechteHtml),
		planOhneRechteHtml.slice(0, 200)
	);
	/*
	 * Eine frisch gesäte Datenbank hat keine besetzte Woche. Das Wort ist damit
	 * die Zusage aus den Akzeptanzkriterien **und** die Gegenprobe dagegen, dass
	 * eine unbesetzte Woche einfach leer bliebe.
	 */
	pruefen(
		'eine unbesetzte Woche trägt das Wort und nicht nur eine Farbe',
		planOhneRechteHtml.includes('— unbesetzt —')
	);
	pruefen(
		'ohne Adminrechte steht kein Besetzen-Formular im HTML',
		!/action="\?\/besetzen"/.test(planOhneRechteHtml)
	);
	/*
	 * **Und kein Name der anderen.** Die Auswahl führt jedes aktive Mitglied; wer
	 * sie nicht bekommen soll, darf auch keinen einzigen dieser Namen im Dokument
	 * stehen haben. Geprüft am Namen der Adminperson, weil er in einer Saat mit
	 * zwei Zeilen der einzige ist, den das Mitglied nicht ohnehin selbst trägt.
	 */
	pruefen(
		'und kein Name aus der Mitgliederliste',
		!planOhneRechteHtml.includes('Vera Verwaltung'),
		planOhneRechteHtml.slice(0, 200)
	);

	pruefenGleich('dieselbe Anfrage als Adminperson bekommt 200', planAlsAdmin.status, 200);
	/*
	 * Die Gegenprobe. Ohne sie hinge die Behauptung darüber an einer Seite, die
	 * das Formular vielleicht **niemandem** ausliefert — und bliebe grün, wenn
	 * das Besetzen ganz fehlte.
	 */
	const besetzenFormulare = [
		...planAlsAdminHtml.matchAll(/<form\b[^>]*action="\?\/besetzen"[^>]*>([\s\S]*?)<\/form>/g),
	];
	const jedesBesetzen = (pruefung: (ganzes: string, rumpf: string) => boolean) =>
		besetzenFormulare.length > 0 &&
		besetzenFormulare.every((treffer) => pruefung(treffer[0], treffer[1] ?? ''));
	const planTeile = [
		/*
		 * Ein Formular je Woche des Fensters — 13 oder 14, kalenderabhängig. Die
		 * Spanne steht hier und keine feste Zahl: eine 13 wäre in der Hälfte des
		 * Jahres rot, ohne dass etwas kaputt wäre.
		 */
		[
			'ein Formular je Wochenzeile',
			besetzenFormulare.length >= 13 && besetzenFormulare.length <= 14,
		],
		[
			'jedes mit method="POST" — sonst fiele es ohne JavaScript auf GET zurück',
			jedesBesetzen((ganzes) => /<form\b[^>]*\bmethod="POST"/i.test(ganzes)),
		],
		[
			// Erst den Tag schneiden, dann in ihm nach `value` suchen — ein Muster
			// `name="jahr"[^>]*value=` schriebe die Reihenfolge der Attribute fest.
			'jedes mit einem versteckten jahr und einer echten Zahl',
			jedesBesetzen((_, rumpf) =>
				/\bvalue="[0-9]{4}"/.test(/<input\b[^>]*\bname="jahr"[^>]*>/.exec(rumpf)?.[0] ?? '')
			),
		],
		[
			'jedes mit einem versteckten woche und einer echten Zahl',
			jedesBesetzen((_, rumpf) =>
				/\bvalue="[0-9]{1,2}"/.test(/<input\b[^>]*\bname="woche"[^>]*>/.exec(rumpf)?.[0] ?? '')
			),
		],
		[
			'jedes mit der Auswahl name="mitgliedId"',
			jedesBesetzen((_, rumpf) => /<select\b[^>]*\bname="mitgliedId"/.test(rumpf)),
		],
		[
			'und jedes mit einem Absendeknopf',
			jedesBesetzen((_, rumpf) => /<button\b[^>]*\btype="submit"/.test(rumpf)),
		],
		[
			// Die Auswahl trägt die Namen: ohne sie wäre das Formular ohne
			// JavaScript unbedienbar, weil es nichts zu wählen gäbe.
			'die Auswahl führt die aktiven Mitglieder namentlich',
			planAlsAdminHtml.includes('Vera Verwaltung') && planAlsAdminHtml.includes('Manu Mitglied'),
		],
	] as const;
	pruefen(
		'/dienstplan liefert der Adminperson das Besetzen-Formular aus — ohne JavaScript bedienbar',
		fehlendeTeile(planTeile).length === 0,
		`fehlt: ${fehlendeTeile(planTeile).join(', ')} (${besetzenFormulare.length} Formular(e))`
	);
	pruefen(
		'weder Hash noch Klartext-Token stehen im ausgelieferten Dienstplan',
		!saat.hashes.some((hash) => planAlsAdminHtml.includes(hash)) &&
			!saat.klartexte.some((token) => planAlsAdminHtml.includes(token))
	);

	/*
	 * **Besetzen ohne JavaScript, ausgeführt.** Ein POST auf die action mit den
	 * Werten des ersten Formulars; danach steht der Name im neu geladenen Plan.
	 *
	 * Die Werte kommen aus dem ausgelieferten HTML und nicht aus einer eigenen
	 * Wochenrechnung im Skript: geprüft werden soll, dass **dieses** Formular
	 * trägt, und eine zweite Rechnung hier könnte dieselbe Woche verfehlen und
	 * die Behauptung aus dem falschen Grund rot machen.
	 */
	const erstesFormular = besetzenFormulare[0]?.[1] ?? '';
	const wertAus = (feld: string) =>
		new RegExp(`\\bvalue="([0-9]+)"`).exec(
			new RegExp(`<input\\b[^>]*\\bname="${feld}"[^>]*>`).exec(erstesFormular)?.[0] ?? ''
		)?.[1] ?? '';
	const erstesMitglied = /<option value="([0-9]+)"/.exec(erstesFormular)?.[1] ?? '';
	const besetzt = await abschicken(port, '/dienstplan?/besetzen', adminKeks, {
		jahr: wertAus('jahr'),
		woche: wertAus('woche'),
		mitgliedId: erstesMitglied,
	});
	const nachBesetzen = await holen(port, '/dienstplan', { keks: mitgliedKeks });
	const nachBesetzenHtml = await nachBesetzen.text();
	/*
	 * **Und die Vorbelegung der Auswahl — nur hier prüfbar.**
	 *
	 * `scripts/smoke-zugang.ts` liest im Markup ein
	 * `selected={mitglied.id === eintrag.mitgliedId}`; ob Svelte daraus im
	 * ausgelieferten HTML wirklich ein `selected` am richtigen `<option>` macht,
	 * sagt das nicht. Ohne diese Zeile stünde die Zusage „die schon zuständige
	 * Person steht vorgewählt" allein am Quelltext — und ohne JavaScript ist das
	 * ausgelieferte `selected` das Einzige, was sie überhaupt einlöst.
	 */
	const nachBesetzenAdmin = await holen(port, '/dienstplan', { keks: adminKeks });
	const nachBesetzenAdminHtml = await nachBesetzenAdmin.text();
	const besetzteZeile =
		/<form\b[^>]*action="\?\/besetzen"[^>]*>([\s\S]*?)<\/form>/.exec(nachBesetzenAdminHtml)?.[1] ??
		'';
	const vorgewaehlt = /<option\b[^>]*\bselected\b[^>]*>/.exec(besetzteZeile)?.[0] ?? '';

	const besetzenAusfuehrbar = [
		['die Formularwerte waren im HTML zu finden', wertAus('jahr') !== '' && erstesMitglied !== ''],
		['der POST endet nicht in einem Fehler', besetzt.status < 400],
		[
			// Vorher stand die erste Woche als unbesetzt da — die Behauptung oben
			// hat das gemessen. Jetzt trägt sie einen Namen.
			'und der Plan nennt danach einen Namen statt des Worts',
			(nachBesetzenHtml.match(/— unbesetzt —/g) ?? []).length <
				(planOhneRechteHtml.match(/— unbesetzt —/g) ?? []).length,
		],
		['die Auswahl dieser Zeile trägt ein selected', vorgewaehlt !== ''],
		[
			// Und zwar an **der** Person, die eingetragen wurde — nicht an
			// irgendeiner. Ein `selected` an der ersten Option wäre die Mutation,
			// die eine blosse Vorkommensprüfung nicht sieht.
			'und zwar an der eingetragenen Person',
			vorgewaehlt.includes(`value="${erstesMitglied}"`),
		],
		[
			// Genau eines: zwei selected in einem <select> ohne multiple wären ein
			// Zustand, den der Browser willkürlich auflöst.
			'genau eines, nicht mehrere',
			(besetzteZeile.match(/<option\b[^>]*\bselected\b/g) ?? []).length === 1,
		],
		[
			// Die Aufforderung `Bitte wählen` steht nur an einer unbesetzten Woche.
			// Ist die Woche besetzt, wäre sie eine leere erste Zeile, die required
			// gegen die Vorbelegung stellte.
			'und die Aufforderung `Bitte wählen` ist aus dieser Zeile verschwunden',
			!besetzteZeile.includes('Bitte wählen'),
		],
	] as const;
	pruefen(
		'eine Woche lässt sich ohne JavaScript besetzen — der Plan zeigt es danach allen',
		fehlendeTeile(besetzenAusfuehrbar).length === 0,
		`fehlt: ${fehlendeTeile(besetzenAusfuehrbar).join(', ')} (Status ${besetzt.status})`
	);
	/*
	 * Die Adminschranke der action, über HTTP. `smoke` prüft sie am
	 * Rückgabewert; hier steht, dass ein echter POST ohne Adminrechte auf `/`
	 * landet und nicht etwa auf einer Fehlerseite, die die Existenz der Aktion
	 * verriete.
	 */
	const besetzenOhneRechte = await abschicken(port, '/dienstplan?/besetzen', mitgliedKeks, {
		jahr: wertAus('jahr'),
		woche: wertAus('woche'),
		mitgliedId: erstesMitglied,
	});
	pruefenGleich(
		'ein POST auf ?/besetzen ohne Adminrechte wird mit 303 weggeleitet',
		besetzenOhneRechte.status,
		303
	);
	pruefenGleich(
		'und die Wegleitung zeigt auf / — die Aktion existiert für sie nicht',
		besetzenOhneRechte.headers.get('location'),
		'/'
	);

	/*
	 * **Der Diensthinweis auf `/`, im ausgelieferten Dokument.**
	 *
	 * Bis zur Review von Story 3.1 endete der Nachweis am Rückgabewert der load:
	 * `smoke` behauptete `dienst.datum`, und alles über das Rendern war ein Regex
	 * über den Quelltext der Komponente. Beides zusammen liesse einen Block, der
	 * die Daten bekommt und sie nicht anzeigt, unbemerkt durch — und der Block ist
	 * das Erste, was auf der Startseite steht.
	 *
	 * Gemessen an **beiden** Rollen im selben Zustand: die Adminperson ist eben
	 * für die laufende Woche eingetragen worden, das Mitglied nicht. Der Block ist
	 * darum nicht bloss vorhanden, sondern vorhanden **für die richtige Person**.
	 */
	/*
	 * **Wer eingetragen wurde, wird gelesen und nicht geraten.** Der POST oben
	 * nahm die erste <option> der Auswahl, und deren Reihenfolge macht die
	 * Kollation in aktiveMitgliederAuflisten — nicht die Reihenfolge der Saat.
	 * Ein hier eingetippter Name wäre grün, bis jemand die Sortierung anfasst,
	 * und dann rot aus dem falschen Grund.
	 */
	const eingetragenerName = (
		new RegExp(`<option value="${erstesMitglied}"[^>]*>([^<]*)<`).exec(erstesFormular)?.[1] ?? ''
	).trim();
	const startseiteMitDienst = await holen(port, '/', { keks: mitgliedKeks });
	const startseiteMitDienstHtml = await startseiteMitDienst.text();
	const startseiteOhneDienst = await holen(port, '/', { keks: adminKeks });
	const startseiteOhneDienstHtml = await startseiteOhneDienst.text();
	const hinweisTeile = [
		['der Name war überhaupt zu lesen', eingetragenerName !== ''],
		[
			'der Satz steht im Dokument der zuständigen Person',
			startseiteMitDienstHtml.includes('Diese Woche bist du am Tränken'),
		],
		[
			// Der Block ist als Ganzes ein Link auf den Plan — ein Dienst ist keine
			// Aufgabe, es gibt keinen Knopf daran.
			//
			// `\.?\/dienstplan`, weil resolve() in der Ausgabe `./dienstplan`
			// schreibt und nicht `/dienstplan`. Gemessen, nicht angenommen: die
			// erste Fassung dieser Zeile suchte den absoluten Pfad und wurde rot,
			// obwohl der Link stimmte. Genau dafür gibt es dieses Skript.
			'als Link auf den Dienstplan',
			/<a\b[^>]*\bclass="dienst[ "][^>]*\bhref="\.?\/dienstplan"/.test(startseiteMitDienstHtml),
		],
		[
			// Und kein Bedienelement darin: ein Dienst ist nicht abhakbar.
			'ohne Knopf oder Kästchen darin',
			!/<a\b[^>]*\bclass="dienst[ "][\s\S]*?<\/a>/.test(startseiteMitDienstHtml) ||
				!/<(?:button|input)\b/.test(
					/<a\b[^>]*\bclass="dienst[ "][\s\S]*?<\/a>/.exec(startseiteMitDienstHtml)?.[0] ?? ''
				),
		],
		[
			// Mit dem Wochendatum daneben, sonst sagt der Satz nicht, welche Woche.
			'mit dem Wochendatum',
			/<span\b[^>]*\bclass="dienst__datum[ "][^>]*>[^<]*[0-9]{1,2}\./.test(startseiteMitDienstHtml),
		],
		[
			// Und **ganz** fort bei der anderen Person: kein leerer Rahmen, kein
			// Platzhalter. Die Gegenprobe zum {#if} ohne {:else}.
			'und im Dokument der anderen Person fehlt er ganz',
			!startseiteOhneDienstHtml.includes('Diese Woche bist du am Tränken') &&
				!/\bclass="dienst[ "]/.test(startseiteOhneDienstHtml),
		],
	] as const;
	pruefen(
		'der Diensthinweis steht im ausgelieferten HTML — und nur bei der zuständigen Person',
		fehlendeTeile(hinweisTeile).length === 0,
		`fehlt: ${fehlendeTeile(hinweisTeile).join(', ')}`
	);

	/*
	 * **Die laufende Woche ist genau eine Zeile — im Dokument, nicht im
	 * Rückgabewert.**
	 *
	 * `laufendeWoche` war ausschliesslich am Wert der load belegt. Die
	 * Markierung umzudrehen (`!==` statt `===`) oder das `class:`-Directive zu
	 * streichen liess die ganze Kette grün: der Plan hätte jede Woche oder keine
	 * hervorgehoben. Der Verbraucher gehört mitgemessen, nicht nur der Erzeuger.
	 */
	const laufendZeilen = [
		...nachBesetzenAdminHtml.matchAll(/<li\b[^>]*\bclass="[^"]*\bwoche--laufend\b[^"]*"[^>]*>/g),
	];
	const markenZeilen = [
		...nachBesetzenAdminHtml.matchAll(/<span\b[^>]*\bclass="woche__marke[ "][^>]*>([^<]*)</g),
	];
	const laufendTeile = [
		['genau eine Zeile trägt die Marke der laufenden Woche', laufendZeilen.length === 1],
		['und genau ein „diese Woche" steht dazu', markenZeilen.length === 1],
		[
			// Und zwar an der **ersten** Zeile: das Fenster beginnt mit der
			// laufenden Woche, rückwirkend besetzen geht nicht.
			'und es ist die erste Zeile des Plans',
			nachBesetzenAdminHtml.indexOf('woche--laufend') <
				nachBesetzenAdminHtml.indexOf(
					'woche__nummer',
					nachBesetzenAdminHtml.indexOf('woche--laufend') + 1
				),
		],
	] as const;
	pruefen(
		'die laufende Woche ist im ausgelieferten Plan genau einmal markiert',
		fehlendeTeile(laufendTeile).length === 0,
		`fehlt: ${fehlendeTeile(laufendTeile).join(', ')} (${laufendZeilen.length} Zeile(n))`
	);

	/*
	 * **Das ISO-Jahr steht an jeder Zeile.** Aus der Review von Story 3.1: der
	 * Plan nannte nirgends ein Jahr, und über den Jahreswechsel standen `KW 53`
	 * und `KW 1` untereinander, ohne dass etwas sagte, welches Jahr gemeint ist.
	 * `wochendatum` lässt das Jahr bewusst weg; diese Zeile ist der Grund, warum
	 * es das darf.
	 */
	const jahresZeilen = [
		...nachBesetzenAdminHtml.matchAll(
			/<span\b[^>]*\bclass="woche__jahr[ "][^>]*>\s*([0-9]{4})\s*</g
		),
	];
	pruefen(
		'jede Wochenzeile nennt ihr ISO-Jahr',
		jahresZeilen.length === besetzenFormulare.length && jahresZeilen.length > 0,
		`${jahresZeilen.length} Jahresangaben auf ${besetzenFormulare.length} Zeilen`
	);

	/*
	 * **Das Dokument eines Nicht-Admins, nachdem eine Woche besetzt ist.**
	 *
	 * Die Zusage „die Namensliste geht nicht ins HTML von jemandem, der sie nicht
	 * braucht" war nur am **leeren** Plan gemessen — vor dem POST, als überhaupt
	 * kein Name irgendwo stand. Danach steht einer im Plan, und zwar zu Recht:
	 * wer zuständig ist, ist öffentlich. Was auch dann nicht dort stehen darf,
	 * ist die **Auswahl** — das Formular, die <option>-Liste, die anderen Namen.
	 */
	const nichtAdminTeile = [
		[
			'der Name der zuständigen Person steht da — die Gegenprobe',
			eingetragenerName !== '' && nachBesetzenHtml.includes(eingetragenerName),
		],
		['aber kein Besetzen-Formular', !/action="\?\/besetzen"/.test(nachBesetzenHtml)],
		['keine Auswahl', !/<select\b/.test(nachBesetzenHtml)],
		['und keine <option> mit einem anderen Namen', !/<option\b/.test(nachBesetzenHtml)],
		[
			// Die Adminperson steht in keiner Dienstwoche und dürfte darum nirgends
			// auftauchen — der Rest der Namensliste ist fort.
			'und der Name aus der Auswahl, der keine Woche hat, fehlt',
			!nachBesetzenHtml.includes('Vera Verwaltung'),
		],
		[
			'weder Hash noch Klartext-Token',
			!saat.hashes.some((hash) => nachBesetzenHtml.includes(hash)) &&
				!saat.klartexte.some((token) => nachBesetzenHtml.includes(token)),
		],
	] as const;
	pruefen(
		'ein besetzter Plan zeigt dem Mitglied den Namen, aber nie die Auswahl',
		fehlendeTeile(nichtAdminTeile).length === 0,
		`fehlt: ${fehlendeTeile(nichtAdminTeile).join(', ')}`
	);

	/*
	 * **Ein abgewiesenes Besetzen, ohne JavaScript.**
	 *
	 * Dieselbe Zusage wie beim Umbenennen weiter oben, und aus der Review von
	 * Story 3.1: für /dienstplan gab es sie nur als Regex über den Quelltext der
	 * Komponente und als Rückgabewert der action — beides sieht kein Dokument.
	 * Eine Regression, in der der Satz nur noch in der Hydratationsnutzlast
	 * landet oder in der mehr als eine Zeile aufgeht, wäre unsichtbar geblieben.
	 *
	 * Abgewiesen mit einer Mitglieds-Id, die es nicht gibt: die Woche bleibt
	 * ansprechbar, damit die Antwort einen Wochenschlüssel trägt und an einer
	 * Zeile landen kann. Der Datenstand bleibt unberührt.
	 */
	const abgewieseneWoche = `${wertAus('jahr')}${wertAus('woche').padStart(2, '0')}`;
	const besetzenAbweisung = await abschicken(port, '/dienstplan?/besetzen', adminKeks, {
		jahr: wertAus('jahr'),
		woche: wertAus('woche'),
		mitgliedId: '9999999',
	});
	const besetzenAbweisungHtml = await besetzenAbweisung.text();
	const offeneBesetzen = [
		...besetzenAbweisungHtml.matchAll(
			/<details\b[^>]*\bclass="besetzen[ "][^>]*\bopen\b[^>]*>([\s\S]*?)<\/details>/g
		),
	];
	const besetzenRegionen = [
		...besetzenAbweisungHtml.matchAll(
			/<p\b[^>]*\bid="besetzen-fehler-([0-9]+)"[^>]*>([\s\S]*?)<\/p>/g
		),
	];
	const besetzenRegion =
		besetzenRegionen.find((treffer) => treffer[1] === abgewieseneWoche)?.[2] ?? '';
	const abweisungBesetzenTeile = [
		[
			'der Wochenschlüssel war zu bilden',
			abgewieseneWoche !== '' && !abgewieseneWoche.startsWith('undefined'),
		],
		['die Antwort ist ein 400', besetzenAbweisung.status === 400],
		[
			'und ein HTML-Dokument',
			(besetzenAbweisung.headers.get('content-type') ?? '').startsWith('text/html'),
		],
		['genau ein aufgeklapptes <details> im ganzen Dokument', offeneBesetzen.length === 1],
		[
			'die Auswahl darin trägt aria-invalid="true"',
			/aria-invalid="true"/.test(offeneBesetzen[0]?.[1] ?? ''),
		],
		[
			'und zeigt auf den Satz dieser Woche',
			(offeneBesetzen[0]?.[1] ?? '').includes(
				`aria-describedby="besetzen-fehler-${abgewieseneWoche}"`
			),
		],
		[
			'der Satz steht in der Live-Region dieser Woche',
			besetzenRegion.includes(MITGLIED_NICHT_ANSPRECHBAR),
		],
		[
			// Und **nur** dort. Trüge die Region den Satz ohne Bezug zur Woche,
			// stünde er in allen dreizehn bis vierzehn.
			'und in keiner der anderen Wochen',
			besetzenRegionen.length > 1 &&
				besetzenRegionen.filter((treffer) =>
					(treffer[2] ?? '').includes(MITGLIED_NICHT_ANSPRECHBAR)
				).length === 1,
		],
	] as const;
	pruefen(
		'ein abgewiesenes Besetzen kommt ohne JavaScript fertig aus dem Server',
		fehlendeTeile(abweisungBesetzenTeile).length === 0,
		`fehlt: ${fehlendeTeile(abweisungBesetzenTeile).join(', ')} (Status ${besetzenAbweisung.status}, ${offeneBesetzen.length} offen)`
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
