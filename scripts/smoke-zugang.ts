/*
 * smoke — der ausgeführte Nachweis der Zusagen dieser Story.
 *
 * Dieses Projekt hat bewusst kein Testframework. Ohne dieses Skript hingen alle
 * Kernzusagen an einem curl von Hand.
 *
 * **Bauform, benannt und mit ihren Grenzen.** Das Skript stellt SvelteKit nach:
 * ein resolve-Stub, eine Cookie-Attrappe, eine eigene Wiedergabe der
 * Fehlerseite. Jede nachgestellte Grenze kann Behauptungen erzeugen, die sich
 * selbst bestätigen — das ist die Fehlerklasse, die drei Prüfrunden hier
 * gefunden haben. Der User hat entschieden, die Bauform zu behalten und die
 * Lücken einzeln zu flicken; die Empfehlung, stattdessen gegen einen echten
 * Server zu fahren, steht für eine spätere Story in der Spezifikation.
 *
 * Damit eine Behauptung nicht bloss ihre eigene Vorbereitung liest, gilt hier:
 *
 *   - Die Attrappe **zeichnet auf**, statt zu verwerfen: Cookie-Setzungen samt
 *     Optionsobjekt und jeden setHeaders-Aufruf. Der Abdruck der Fehlerfälle
 *     besteht darum nicht nur aus Status und Satz, sondern auch aus den
 *     Nebenwirkungen an der Wurfstelle. Ein setHeaders an **einer** der beiden
 *     403-Wurfstellen fällt damit auf.
 *   - Die Saat eines eingehenden Cookies wird **nicht** als Setzung gezählt —
 *     echtes SvelteKit tut das nie, und die Schwelle der gleitenden Erneuerung
 *     wäre sonst schon durch die Vorbereitung erfüllt.
 *   - Die Fehlerseite kommt aus SvelteKits **eigener** aus src/error.html
 *     erzeugter Vorlage; `svelte-kit sync` läuft dazu am Anfang.
 *   - `handleError`, `startPruefen` und `init` werden **ausgeführt**, nicht nur
 *     als vorhanden angenommen.
 *   - Die Attrappe **verhält sich wie das Original**: alles, was
 *     Produktionscode aus dem Ereignis oder aus `cookies` herausnehmen darf
 *     (`setHeaders`, `get`, `set`, `delete`), liegt als gebundene eigene
 *     Eigenschaft auf der Instanz, nicht als Prototyp-Methode. SvelteKit baut
 *     diese Objekte mit eigenen Funktionen; eine destrukturierende Route hätte
 *     das Skript sonst mit einem TypeError abgebrochen, statt geprüft zu werden.
 *   - Ein **unerwarteter Wurf ist ein Befund**, kein Absturz: der Rahmen unten
 *     benennt ihn, räumt die Wegwerfverzeichnisse weg und endet mit 1 — dasselbe
 *     Versprechen, das scripts/gate.mjs schon gibt.
 *   - Die POST-Behauptungen fahren **echte** Formulardaten: das Ereignis baut
 *     `new Request(url, { method: 'POST', body: FormData })`, damit
 *     `await request.formData()` in der action wirklich etwas zu parsen hat.
 *     Ohne Rumpf bekäme jede action eine leere Menge und die Prüfung läse nur
 *     ihre eigene Vorbereitung.
 *
 * Nicht abgedeckt bleibt respond.js — die Schicht, die den Wurf in die Vorlage
 * überführt, Kopfzeilen anhängt und Cookies ausliefert. Ihr Verhalten ist am
 * laufenden Server gemessen und in der Spezifikation festgehalten; hier steht
 * ausdrücklich keine Behauptung darüber.
 *
 * Am Ende zählt das Skript, wie viele Behauptungen tatsächlich gelaufen sind,
 * und vergleicht mit einer festen Zahl. Eine Behauptung, die in einem `if`
 * stillschweigend ausfällt, fällt damit auf.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';
import { isActionFailure, isHttpError, isRedirect, text } from '@sveltejs/kit';
import type { Cookies, Handle, RequestEvent } from '@sveltejs/kit';
import {
	sitzungAusstellen,
	sitzungLoeschen,
	sitzungsgeheimnisPruefen,
} from '../src/lib/server/auth.ts';
import { datenbank, datenschichtStarten } from '../src/lib/server/db/index.ts';
import { members, ohneTokenHash } from '../src/lib/server/db/schema.ts';
import type { AngemeldetesMitglied } from '../src/lib/server/db/schema.ts';
import { mitgliedAnlegen, mitgliederZaehlen } from '../src/lib/server/db/queries/members.ts';
import { tokenErzeugen, tokenHashen } from '../src/lib/server/token.ts';
import {
	EIGENER_ZUGANG_GESCHUETZT,
	KEIN_ZUGANG,
	MITGLIED_NICHT_ANSPRECHBAR,
	NICHT_GEFUNDEN,
	UNERWARTETER_FEHLER,
} from '../src/lib/texte.ts';
import { handle, handleError, startPruefen } from '../src/hooks.server.ts';

/**
 * So viele Behauptungen muss ein vollständiger Lauf ablegen, die Schlusszählung
 * selbst nicht mitgerechnet. Die Zahl ist Absicht und kein Zierrat: eine
 * Behauptung, die in einem `if` stillschweigend ausfällt, hinterlässt sonst
 * keine Spur, und das Skript meldete weiter grün mit weniger Deckung.
 * Wer eine Behauptung hinzufügt oder entfernt, zieht die Zahl mit.
 */
const ERWARTETE_BEHAUPTUNGEN = 185;

const HERKUNFT = 'https://garten.example.ch';
const EIN_JAHR = 60 * 60 * 24 * 365;
const GUTES_GEHEIMNIS = 'smoke-geheimnis-mit-genug-verschiedenen-zeichen-0123456789';

const wurzel = fileURLToPath(new URL('..', import.meta.url));
// migrationsFolder ist arbeitsverzeichnisrelativ; das Skript darf von überall
// aufgerufen werden.
process.chdir(wurzel);

/**
 * Jedes Wegwerfverzeichnis wird hier vermerkt, damit der Rahmen unten es auch
 * dann wegräumt, wenn mitten in der Prüfliste etwas Unerwartetes wirft. Die
 * Aufräumzeilen an den einzelnen Stellen bleiben trotzdem stehen: `force: true`
 * macht ein zweites Entfernen zum Nichts, und je früher ein Verzeichnis weg
 * ist, desto weniger kann es einen späteren Lauf verwirren.
 */
const wegwerfverzeichnisse: string[] = [];

function wegwerfVerzeichnis(vorsilbe: string): string {
	const pfad = mkdtempSync(join(tmpdir(), vorsilbe));
	wegwerfverzeichnisse.push(pfad);
	return pfad;
}

function aufraeumen(): void {
	for (const pfad of wegwerfverzeichnisse) {
		try {
			rmSync(pfad, { recursive: true, force: true });
		} catch {
			// Ein Verzeichnis, das sich nicht entfernen lässt, ist kein Befund über
			// die Zugangsschicht. Der Ablagebereich des Systems räumt selbst auf.
		}
	}
}

const arbeit = wegwerfVerzeichnis('gartenplaner-smoke-');
process.env.DATABASE_PATH = join(arbeit, 'smoke.sqlite');
process.env.SESSION_SECRET = GUTES_GEHEIMNIS;
process.env.ORIGIN = HERKUNFT;

let gescheitert = 0;
let gelaufen = 0;

function pruefen(name: string, bedingung: boolean, hinweis?: string): void {
	gelaufen += 1;
	if (bedingung) {
		console.log(`ok      ${name}`);
		return;
	}
	gescheitert += 1;
	console.error(`FEHLER  ${name}${hinweis === undefined ? '' : ` — ${hinweis}`}`);
}

function pruefenGleich(name: string, ist: unknown, soll: unknown): void {
	pruefen(name, ist === soll, `war ${JSON.stringify(ist)}, erwartet ${JSON.stringify(soll)}`);
}

/** Ein Unterprozess mit Zeitschranke und Prüfung auf einen Startfehler. */
function starten(argumente: string[], umgebung: Record<string, string | undefined>) {
	const lauf = spawnSync(process.execPath, argumente, {
		cwd: wurzel,
		encoding: 'utf8',
		env: umgebung,
		timeout: 60_000,
		stdio: ['ignore', 'pipe', 'pipe'],
	});
	pruefen(
		`Unterprozess ${argumente.join(' ').slice(0, 60)} ist gelaufen`,
		lauf.error === undefined,
		lauf.error?.message
	);
	return lauf;
}

// ---------------------------------------------------------------------------
// SvelteKits eigene Fehlerseiten-Vorlage, erzeugt aus src/error.html.
// ---------------------------------------------------------------------------
type Fehlervorlage = (werte: { status: number; message: string }) => string;

/**
 * Wird im Rahmen unten gesetzt. Als Wurf statt als Vorgabewert, damit ein
 * fehlgeschlagener Lauf von `svelte-kit sync` eine benannte Verletzung ergibt
 * und nicht eine Fehlerseite, die niemand geschrieben hat.
 */
let fehlerVorlage: Fehlervorlage | null = null;

/** Holt die aus src/error.html erzeugte Vorlage, frisch gesynct. */
async function fehlervorlageLaden(): Promise<Fehlervorlage> {
	const lauf = spawnSync(
		process.execPath,
		[join('node_modules', '@sveltejs', 'kit', 'src', 'cli.js'), 'sync'],
		{ cwd: wurzel, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120_000 }
	);
	if (lauf.error !== undefined || lauf.status !== 0) {
		throw new Error(
			`svelte-kit sync ist gescheitert (${lauf.error?.message ?? `Status ${lauf.status}`}).\n` +
				'Ohne den Lauf stammt die Fehlerseiten-Vorlage womöglich von einem älteren\n' +
				`Stand von src/error.html.\n${(lauf.stderr ?? '').trim()}`
		);
	}

	const pfad = join(wurzel, '.svelte-kit', 'generated', 'shared', 'error-template.js');
	const modul = (await import(pathToFileURL(pfad).href)) as { default: Fehlervorlage };
	return modul.default;
}

/** Die Maskierung aus SvelteKits escape_html: nur & und < tragen Bedeutung. */
function maskieren(wert: string): string {
	return wert.replace(/&/g, '&amp;').replace(/</g, '&lt;');
}

/**
 * Spiegelt static_error_page aus SvelteKit: dieselbe erzeugte Vorlage, dieselbe
 * Maskierung, dasselbe text(). Das Ergebnis ist ein echtes Response-Objekt.
 *
 * Die content-type-Kopfzeile ist hier ein Literal. Eine Behauptung darüber wäre
 * unfalsifizierbar und steht darum nicht in diesem Skript — was SvelteKit
 * tatsächlich ausliefert, ist am laufenden Server gemessen.
 */
function fehlerseite(status: number, meldung: string): Response {
	if (fehlerVorlage === null) {
		throw new Error('Die Fehlerseiten-Vorlage ist nicht geladen — der Rahmen ist verrutscht.');
	}
	return text(fehlerVorlage({ status, message: maskieren(meldung) }), {
		headers: { 'content-type': 'text/html; charset=utf-8' },
		status,
	});
}

// ---------------------------------------------------------------------------
// Die Attrappen. Sie zeichnen auf, statt zu verwerfen.
// ---------------------------------------------------------------------------
type Optionen = {
	httpOnly?: boolean;
	sameSite?: string;
	path?: string;
	maxAge?: number;
	secure?: boolean;
};
type Setzung = { name: string; wert: string; optionen: Optionen };

class Kekse {
	#werte = new Map<string, string>();
	#setzungen: Setzung[] = [];

	/**
	 * Ein eingehendes Cookie legen, **ohne** es als Setzung zu zählen. Echtes
	 * SvelteKit zeichnet ein eingehendes Cookie nie als Setzung auf; täte die
	 * Attrappe es doch, wäre die Schwelle der gleitenden Erneuerung schon durch
	 * die Vorbereitung erfüllt und bedeutete nicht, was sie liest.
	 */
	saat(name: string, wert: string): void {
		this.#werte.set(name, wert);
	}

	/*
	 * get, set und delete sind **gebundene eigene Eigenschaften**, keine
	 * Prototyp-Methoden. SvelteKit baut `cookies` als Objekt mit eigenen
	 * Funktionen; Produktionscode darf sie deshalb aus dem Objekt herausnehmen
	 * (`const { get } = cookies`), ohne die Bindung zu verlieren. Eine Attrappe
	 * mit Prototyp-Methoden bräche an genau dieser Stelle mit einem TypeError —
	 * das Prüfskript stürzte ab, statt zu prüfen. Siehe denselben Grund bei
	 * Ereignis.setHeaders.
	 */
	get = (name: string): string | undefined => this.#werte.get(name);

	set = (name: string, wert: string, optionen: Optionen): void => {
		this.#werte.set(name, wert);
		this.#setzungen.push({ name, wert, optionen });
	};

	delete = (name: string, optionen: Optionen): void => {
		this.#werte.delete(name);
		this.#setzungen.push({ name, wert: '', optionen });
	};

	get setzungen(): readonly Setzung[] {
		return this.#setzungen;
	}

	letzteSetzung(name: string): Setzung | undefined {
		return [...this.#setzungen].reverse().find((setzung) => setzung.name === name);
	}

	alsCookies(): Cookies {
		return this as unknown as Cookies;
	}
}

/**
 * Ein erfundenes Ereignis, das jede Nebenwirkung mitschreibt: Cookie-Setzungen
 * und jeden setHeaders-Aufruf. Dasselbe Objekt bedient den Wächter **und** die
 * Einlöseroute, damit die Nebenwirkungen beider Stellen in einer Liste landen.
 */
class Ereignis {
	readonly kekse = new Kekse();
	readonly gesetzteKopfzeilen: string[] = [];
	readonly locals: Record<string, unknown> = {};
	readonly url: URL;
	readonly request: Request;
	readonly params: Record<string, string>;
	readonly cookies: Cookies;

	/**
	 * @param formular fehlt für ein GET; steht dafür, wird die Anfrage ein POST
	 *   mit multipart-Formulardaten.
	 *
	 * Ohne den dritten Parameter baute diese Attrappe nur `new Request(this.url)`
	 * — ohne Methode und ohne Rumpf. Eine form action, die `await
	 * request.formData()` ruft, bekäme darauf eine leere Menge und wäre nicht
	 * von einer geprüft, sondern nur ausgeführt. Der Rumpf entsteht aus einem
	 * echten FormData, damit ihn `request.formData()` auch wirklich parst.
	 */
	constructor(pfad: string, keks?: string, formular?: Record<string, string>) {
		this.url = new URL(`${HERKUNFT}${pfad}`);
		if (formular === undefined) {
			this.request = new Request(this.url);
		} else {
			const daten = new FormData();
			for (const [feld, wert] of Object.entries(formular)) daten.set(feld, wert);
			this.request = new Request(this.url, { method: 'POST', body: daten });
		}
		this.params = { token: pfad.replace(/^\/i\//, '').replace(/\/+$/, '') };
		this.cookies = this.kekse.alsCookies();
		if (keks !== undefined) this.kekse.saat('sitzung', keks);
	}

	/*
	 * setHeaders ist eine **gebundene eigene Eigenschaft**, keine
	 * Prototyp-Methode — und das ist keine Kosmetik.
	 *
	 * SvelteKit baut das RequestEvent als Objekt mit eigenen Funktionen. Darum
	 * ist `export async function GET({ params, cookies, setHeaders })` dort
	 * gültig und idiomatisch, und genau so ist die Einlöseroute geschrieben: sie
	 * destrukturiert. Eine Prototyp-Methode verliert beim Destrukturieren ihre
	 * Bindung; die Attrappe hätte an dieser Stelle mit einem TypeError
	 * abgebrochen, statt eine Behauptung rot zu machen — gemessen, als eine
	 * Mutation in eben diesem Stil geschrieben wurde. Alles, was
	 * Produktionscode aus dem Ereignis herausnehmen darf, gehört deshalb als
	 * eigene Eigenschaft auf die Instanz.
	 */
	setHeaders = (neue: Record<string, string>): void => {
		for (const [name, wert] of Object.entries(neue)) {
			this.gesetzteKopfzeilen.push(`${name.toLowerCase()}: ${wert}`);
		}
	};

	alsRequestEvent(): RequestEvent {
		return this as unknown as RequestEvent;
	}

	/** Alle aufgezeichneten Nebenwirkungen als eine sortierte Zeichenkette. */
	nebenwirkungen(): string {
		const setzungen = this.kekse.setzungen.map(
			({ name, wert, optionen }) =>
				`cookie ${name}=${wert.length > 0 ? '<wert>' : '<leer>'} ${JSON.stringify(optionen)}`
		);
		return [...setzungen, ...this.gesetzteKopfzeilen].sort().join('\n');
	}
}

type Ausgang =
	| { art: 'antwort'; antwort: Response; mitglied: unknown; ereignis: Ereignis }
	| { art: 'abweisung'; status: number; meldung: string; antwort: Response; ereignis: Ereignis };

let routenModul: { GET: (ereignis: RequestEvent) => Promise<Response> } | null = null;

async function routeAufrufen(ereignis: Ereignis): Promise<Response> {
	if (routenModul === null) {
		routenModul = (await import('../src/routes/i/[token]/+server.ts')) as {
			GET: (ereignis: RequestEvent) => Promise<Response>;
		};
	}
	try {
		return await routenModul.GET(ereignis.alsRequestEvent());
	} catch (fehler) {
		if (isRedirect(fehler)) {
			// Spiegelt redirect_response aus SvelteKit.
			return new Response(undefined, {
				status: fehler.status,
				headers: { location: fehler.location },
			});
		}
		throw fehler;
	}
}

/** Ein Aufruf durch den echten Wächter; auf /i/ ruft resolve die echte Route. */
async function aufrufen(pfad: string, keks?: string): Promise<Ausgang> {
	const ereignis = new Ereignis(pfad, keks);

	try {
		const antwort = await handle({
			event: ereignis.alsRequestEvent(),
			resolve: (weiter: RequestEvent) =>
				weiter.url.pathname.startsWith('/i/')
					? routeAufrufen(ereignis)
					: Promise.resolve(
							new Response('Nichts offen.', {
								status: 200,
								headers: { 'content-type': 'text/html' },
							})
						),
		} as unknown as Parameters<Handle>[0]);
		return { art: 'antwort', antwort, mitglied: ereignis.locals.mitglied, ereignis };
	} catch (fehler) {
		if (isHttpError(fehler)) {
			return {
				art: 'abweisung',
				status: fehler.status,
				meldung: fehler.body.message,
				antwort: fehlerseite(fehler.status, fehler.body.message),
				ereignis,
			};
		}
		throw fehler;
	}
}

/*
 * Ein Platzhalter für den Fall, dass ein Aufruf anders ausgeht als behauptet.
 *
 * 599 statt 0: die Response-Klasse lässt nur 200 bis 599 zu, und ein Wurf hier
 * hätte das Skript mit einem Stacktrace abgebrochen — mitten in der Prüfliste,
 * vor der Schlusszählung. Genau das ist bei einer Mutationsprobe passiert.
 * Der Platzhalter trägt einen eigenen Rumpf, damit auch der Abdruck darüber rot
 * wird und nicht bloss die eine Behauptung.
 */
const PLATZHALTER_STATUS = 599;

/** Erwartet eine durchgelassene Antwort. Meldet selbst rot, wenn nicht. */
function antwortOderRot(name: string, ausgang: Ausgang): Ausgang & { art: 'antwort' } {
	pruefen(
		name,
		ausgang.art === 'antwort',
		ausgang.art === 'abweisung' ? `abgewiesen mit ${ausgang.status}` : undefined
	);
	return ausgang.art === 'antwort'
		? ausgang
		: {
				art: 'antwort',
				antwort: new Response('(abgewiesen)', { status: PLATZHALTER_STATUS }),
				mitglied: null,
				ereignis: ausgang.ereignis,
			};
}

/** Erwartet eine Abweisung. Meldet selbst rot, wenn nicht. */
function abweisungOderRot(name: string, ausgang: Ausgang): Ausgang & { art: 'abweisung' } {
	pruefen(
		name,
		ausgang.art === 'abweisung' && ausgang.status === 403 && ausgang.meldung === KEIN_ZUGANG,
		ausgang.art === 'antwort'
			? `durchgelassen mit ${ausgang.antwort.status}`
			: `${ausgang.status}: ${ausgang.meldung}`
	);
	return ausgang.art === 'abweisung'
		? ausgang
		: {
				art: 'abweisung',
				status: PLATZHALTER_STATUS,
				meldung: '(durchgelassen)',
				antwort: new Response('(durchgelassen)', { status: PLATZHALTER_STATUS }),
				ereignis: ausgang.ereignis,
			};
}

/**
 * Der Abdruck eines Fehlerfalls: Status, alle Kopfzeilen und die Rumpfbytes der
 * Antwort **plus** jede Nebenwirkung, die an der Wurfstelle aufgezeichnet wurde.
 *
 * Der zweite Teil ist der Grund, dass dieser Vergleich etwas prüft. Ohne ihn
 * wäre der Abdruck eine reine Funktion über Status und Satz — beides schon
 * einzeln behauptet, der Vergleich also nur ein Zweitsymptom. Mit ihm fällt ein
 * setHeaders oder ein sitzungLoeschen an **einer** der beiden Wurfstellen auf.
 */
async function abdruck(ausgang: Ausgang & { art: 'abweisung' }): Promise<string> {
	const kopfzeilen = [...ausgang.antwort.headers]
		.map(([name, wert]) => `${name}: ${wert}`)
		.sort()
		.join('\n');
	const rumpf = Buffer.from(await ausgang.antwort.clone().arrayBuffer());
	return [
		`status ${ausgang.status}`,
		kopfzeilen,
		`nebenwirkungen:\n${ausgang.ereignis.nebenwirkungen()}`,
		rumpf.toString('base64'),
	].join('\n---\n');
}

// ---------------------------------------------------------------------------
// Die Routenmodule von /verwaltung und /mehr, direkt gerufen.
//
// Direkt und nicht durch den Wächter: die Adminschranke sitzt in der Route, und
// der Wächter kennt is_admin gar nicht. Was hier geprüft wird, ist genau die
// Schranke — vier Aufrufstellen, von denen jede einzeln vergessen werden kann.
// ---------------------------------------------------------------------------
type Aktion = (ereignis: RequestEvent) => Promise<unknown>;
type VerwaltungsModul = {
	load: (ereignis: RequestEvent) => unknown;
	actions: Record<string, Aktion>;
};
type MehrModul = { load: (ereignis: RequestEvent) => unknown };

let verwaltungsModul: VerwaltungsModul | null = null;
let mehrModul: MehrModul | null = null;

/*
 * Die zwei Casts gehen über `unknown`, und das ist eine Aussage: die echten
 * load-Funktionen nehmen ein ServerLoadEvent, das Ereignis oben ist ein
 * RequestEvent ohne parent, depends und untrack. Behauptet wird damit, dass
 * diese drei Angebote von keiner der beiden load-Funktionen gebraucht werden —
 * was für eine synchrone Repository-Abfrage stimmt. Ruft eine load sie je doch,
 * bricht der Aufruf mit einem TypeError, und der Rahmen unten macht daraus eine
 * benannte Verletzung statt eines stillen Durchlaufs.
 */
async function verwaltungLaden(): Promise<VerwaltungsModul> {
	verwaltungsModul ??=
		(await import('../src/routes/verwaltung/+page.server.ts')) as unknown as VerwaltungsModul;
	return verwaltungsModul;
}

async function mehrLaden(): Promise<MehrModul> {
	mehrModul ??= (await import('../src/routes/mehr/+page.server.ts')) as unknown as MehrModul;
	return mehrModul;
}

/**
 * Die drei Ausgänge, die eine load oder eine action nehmen kann.
 *
 * `redirect()` wirft, `fail()` gibt zurück — beides muss beobachtbar sein, sonst
 * liesse sich eine 303 nicht von einem stillen Erfolg unterscheiden.
 */
type Routenausgang =
	| { art: 'wert'; wert: Record<string, unknown> }
	| { art: 'weiter'; status: number; ort: string }
	| { art: 'fehlschlag'; status: number; daten: Record<string, unknown> };

async function routenausgang(lauf: () => unknown): Promise<Routenausgang> {
	try {
		const ergebnis = await lauf();
		if (isActionFailure(ergebnis)) {
			return {
				art: 'fehlschlag',
				status: ergebnis.status,
				daten: (ergebnis.data ?? {}) as Record<string, unknown>,
			};
		}
		return { art: 'wert', wert: (ergebnis ?? {}) as Record<string, unknown> };
	} catch (fehler) {
		if (isRedirect(fehler)) {
			return { art: 'weiter', status: fehler.status, ort: fehler.location };
		}
		throw fehler;
	}
}

/** Ein Ereignis mit gesetztem locals.mitglied — so, wie der Wächter es ablegt. */
function alsMitglied(
	pfad: string,
	mitglied: AngemeldetesMitglied | null,
	formular?: Record<string, string>
): Ereignis {
	const ereignis = new Ereignis(pfad, undefined, formular);
	ereignis.locals.mitglied = mitglied;
	return ereignis;
}

/** Behauptet eine Weiterleitung mit 303 auf `/` — die Antwort der Adminschranke. */
function wegGeleitet(name: string, ausgang: Routenausgang): void {
	pruefen(
		name,
		ausgang.art === 'weiter' && ausgang.status === 303 && ausgang.ort === '/',
		ausgang.art === 'weiter' ? `${ausgang.status} auf ${ausgang.ort}` : `Ausgang ${ausgang.art}`
	);
}

/** Behauptet einen Fehlschlag mit 400 und genau diesem Satz. */
function abgewiesen(name: string, ausgang: Routenausgang, satz: string): void {
	pruefen(
		name,
		ausgang.art === 'fehlschlag' && ausgang.status === 400 && ausgang.daten.meldung === satz,
		ausgang.art === 'fehlschlag'
			? `${ausgang.status}: ${JSON.stringify(ausgang.daten.meldung)}`
			: `Ausgang ${ausgang.art}`
	);
}

/** Die vollständige Mitgliedszeile als Zeichenkette — samt Hash, für Vergleiche. */
function zeileAbdruck(id: number): string {
	const zeile = datenbank().select().from(members).where(eq(members.id, id)).get();
	return JSON.stringify(zeile ?? null);
}

/** Der Rückgabewert einer geglückten load oder action, oder ein leeres Objekt. */
function wertVon(ausgang: Routenausgang): Record<string, unknown> {
	return ausgang.art === 'wert' ? ausgang.wert : {};
}

/** Die Daten eines Fehlschlags, oder ein leeres Objekt. */
function datenVon(ausgang: Routenausgang): Record<string, unknown> {
	return ausgang.art === 'fehlschlag' ? ausgang.daten : {};
}

/**
 * Trägt dieser Rückgabewert irgendwo ein Token?
 *
 * Gesucht wird nach der **Form, in der ein Token den Server verlässt**: als
 * Feld `link` oder als Pfad `/i/<43 Zeichen>`. Ein nacktes
 * `/[A-Za-z0-9_-]{43}/` wäre hier falsch und war es: die zurückgegebene
 * Eingabe eines 81 Zeichen langen Namens erfüllt dieses Muster von selbst, und
 * die Behauptung wurde rot, ohne dass etwas ausgelaufen war. Ein Prüfmuster,
 * das auf harmlosen Eingaben anschlägt, wird beim nächsten roten Lauf
 * abgeschwächt statt gelesen.
 */
function traegtToken(daten: Record<string, unknown>): boolean {
	const text = JSON.stringify(daten);
	return 'link' in daten || /\/i\/[A-Za-z0-9_-]{43}/.test(text);
}

/** Ein Feld als Zeichenkette; alles andere wird zur leeren Zeichenkette. */
function textFeld(daten: Record<string, unknown>, feld: string): string {
	const wert = daten[feld];
	return typeof wert === 'string' ? wert : '';
}

/** Alle Token-Hashes der Datenbank. Für die Suche im ausgelieferten Zustand. */
function alleHashes(): string[] {
	return datenbank()
		.select({ hash: members.inviteTokenHash })
		.from(members)
		.all()
		.map((zeile) => zeile.hash);
}

/**
 * Behauptet die **fünf** Attribute des einzigen Zugangsmittels der Anwendung.
 * `secure` gehört dazu: es war das eine ungeprüfte, und `secure: false` liess in
 * Iteration 3 alle Tore grün.
 */
function cookieAttributePruefen(wo: string, setzung: Setzung | undefined): void {
	if (setzung === undefined) {
		for (const was of [
			'gesetzt',
			'httpOnly',
			'sameSite lax',
			'path /',
			'maxAge ein Jahr',
			'secure',
		]) {
			pruefen(`${wo}: ${was}`, false, 'keine Setzung aufgezeichnet');
		}
		return;
	}
	pruefen(`${wo}: gesetzt`, setzung.wert.length > 0);
	pruefenGleich(`${wo}: httpOnly`, setzung.optionen.httpOnly, true);
	pruefenGleich(`${wo}: sameSite lax`, setzung.optionen.sameSite, 'lax');
	pruefenGleich(`${wo}: path /`, setzung.optionen.path, '/');
	pruefenGleich(`${wo}: maxAge ein Jahr`, setzung.optionen.maxAge, EIN_JAHR);
	// secure hängt an NODE_ENV: in der Entwicklung muss es fehlen, sonst kommt
	// das Cookie über http://localhost nie an. Hier läuft NODE_ENV nicht auf
	// 'development', also muss es stehen.
	pruefenGleich(`${wo}: secure ausserhalb der Entwicklung`, setzung.optionen.secure, true);
}

/** Fängt console.error ein, um Protokollzeilen behaupten zu können. */
async function protokollMitschreiben(lauf: () => Promise<void> | void): Promise<string> {
	const zeilen: string[] = [];
	const echt = console.error;
	console.error = (...teile: unknown[]) => {
		zeilen.push(teile.map((teil) => String(teil)).join(' '));
	};
	try {
		await lauf();
	} finally {
		console.error = echt;
	}
	return zeilen.join('\n');
}

// ===========================================================================
// Der Rahmen. Jeder unerwartete Wurf wird hier eine benannte Verletzung, die
// Wegwerfverzeichnisse werden weggeräumt, und der Prozess endet mit 1.
//
// gate.mjs verspricht dasselbe ausdrücklich: "Auch ein unerwarteter Fehler ist
// ein benannter Verstoss, nie ein Stacktrace." Dieses Skript ist derselbe
// Testersatz und hielt es nicht — ein TypeError in der Attrappe lieferte einen
// nackten Stacktrace, null benannte Zeilen und keine Schlusszählung.
// ===========================================================================
try {
	fehlerVorlage = await fehlervorlageLaden();

	// -----------------------------------------------------------------------
	// Datenschicht auf leerer Datei
	// -----------------------------------------------------------------------
	datenschichtStarten();
	pruefenGleich('leeres System hat null Mitglieder', mitgliederZaehlen(), 0);

	const annaToken = tokenErzeugen();
	const anna = mitgliedAnlegen({
		name: 'Anna',
		inviteTokenHash: tokenHashen(annaToken),
		isAdmin: true,
	});
	pruefen('Datenschicht startet auf leerer Datei', anna.id > 0);
	pruefenGleich('is_admin kommt als echtes boolean zurück', anna.isAdmin, true);
	pruefenGleich('is_active steht ohne Angabe auf true', anna.isActive, true);

	// -----------------------------------------------------------------------
	// startPruefen und init — ausgeführt, nicht angenommen
	// -----------------------------------------------------------------------
	let startGeworfen: string | null = null;
	try {
		startPruefen();
	} catch (fehler) {
		startGeworfen = fehler instanceof Error ? fehler.message : String(fehler);
	}
	pruefen(
		'startPruefen läuft mit vollständiger Umgebung durch',
		startGeworfen === null,
		startGeworfen ?? undefined
	);

	for (const [was, name] of [
		['SESSION_SECRET', 'SESSION_SECRET'],
		['ORIGIN', 'ORIGIN'],
	] as const) {
		const gemerkt = process.env[was];
		delete process.env[was];
		let meldung: string | null = null;
		try {
			startPruefen();
		} catch (fehler) {
			meldung = fehler instanceof Error ? fehler.message : String(fehler);
		}
		process.env[was] = gemerkt;
		pruefen(
			`startPruefen wirft ohne ${name} und benennt die Variable`,
			meldung !== null && meldung.includes(name),
			meldung ?? 'kein Wurf'
		);
	}

	// Der Hook selbst: nur im Unterprozess beobachtbar, weil er beendet. Damit
	// fällt auch auf, wenn jemand process.exit(1) entfernt oder den Aufruf in ein
	// schluckendes catch wickelt.
	const initUmgebung: Record<string, string | undefined> = {
		...process.env,
		DATABASE_PATH: join(arbeit, 'init-probe.sqlite'),
	};
	delete initUmgebung.ORIGIN;
	const initLauf = starten(
		[
			'--input-type=module',
			'-e',
			`const m = await import(${JSON.stringify(pathToFileURL(join(wurzel, 'src', 'hooks.server.ts')).href)});` +
				'await m.init();' +
				"console.log('init ist durchgelaufen');",
		],
		initUmgebung
	);
	pruefenGleich('der init-Hook endet ohne ORIGIN mit Exit 1', initLauf.status, 1);
	pruefen(
		'der init-Hook nennt die fehlende Variable',
		(initLauf.stderr ?? '').includes('ORIGIN'),
		JSON.stringify((initLauf.stderr ?? '').slice(0, 120))
	);
	pruefen(
		'der init-Hook gibt keinen Stacktrace aus',
		!/^\s+at /m.test(`${initLauf.stdout ?? ''}${initLauf.stderr ?? ''}`)
	);
	pruefen(
		'der init-Hook läuft nicht weiter, wenn eine Prüfung fehlschlägt',
		!(initLauf.stdout ?? '').includes('init ist durchgelaufen')
	);

	// -----------------------------------------------------------------------
	// Einlösen über den echten Wächter samt Route
	// -----------------------------------------------------------------------
	const eingeloest = antwortOderRot(
		'gültiges Token wird eingelöst',
		await aufrufen(`/i/${annaToken}`)
	);
	pruefenGleich('Einlösen antwortet 303', eingeloest.antwort.status, 303);
	pruefenGleich('Einlösen leitet auf / weiter', eingeloest.antwort.headers.get('location'), '/');
	pruefenGleich(
		'die tokentragende Antwort trägt Referrer-Policy: no-referrer',
		eingeloest.antwort.headers.get('referrer-policy'),
		'no-referrer'
	);
	cookieAttributePruefen('Einlöseroute', eingeloest.ereignis.kekse.letzteSetzung('sitzung'));
	pruefenGleich(
		'die Einlöseroute setzt genau ein Cookie',
		eingeloest.ereignis.kekse.setzungen.length,
		1
	);

	const gueltigerKeks = eingeloest.ereignis.kekse.get('sitzung');
	pruefen('das Einlösen hinterlässt einen Keks', gueltigerKeks !== undefined);

	// Mit Schrägstrich am Ende: der Bypass greift, die Route löst dasselbe Token ein.
	const mitSchraegstrich = antwortOderRot(
		'Link mit Schrägstrich am Ende wird eingelöst',
		await aufrufen(`/i/${annaToken}/`)
	);
	pruefenGleich('auch dort 303', mitSchraegstrich.antwort.status, 303);

	// -----------------------------------------------------------------------
	// Zweites Gerät.
	//
	// Hier wird ausdrücklich **nicht** behauptet, dass die zwei Kekse
	// verschieden aussehen: iat und exp sind sekundengenau, zwei Einlösungen im
	// selben Sekundenfenster ergeben ein byte-identisches JWT. Behauptet wird,
	// was die Zusage wirklich ausmacht — jede Einlösung stellt ihr eigenes
	// Cookie aus, und beide werden angenommen, ohne dass die erste erlischt.
	// Dass der Signierer nicht einfach einen festen Wert liefert, belegt der
	// Vergleich zweier Sitzungen für zwei verschiedene Mitglieder darunter.
	// -----------------------------------------------------------------------
	const zweitesGeraet = antwortOderRot(
		'dasselbe Token auf einem zweiten Gerät',
		await aufrufen(`/i/${annaToken}`)
	);
	pruefenGleich(
		'die zweite Einlösung stellt ihr eigenes Cookie aus',
		zweitesGeraet.ereignis.kekse.setzungen.length,
		1
	);
	const keksZwei = zweitesGeraet.ereignis.kekse.get('sitzung');
	const durchZwei = antwortOderRot('zweites Gerät kommt durch', await aufrufen('/', keksZwei));
	const durchEins = antwortOderRot(
		'die erste Sitzung bleibt gültig',
		await aufrufen('/', gueltigerKeks)
	);
	pruefenGleich('zweites Gerät sieht die Liste', durchZwei.antwort.status, 200);
	pruefenGleich('erstes Gerät sieht die Liste', durchEins.antwort.status, 200);

	const berta = mitgliedAnlegen({
		name: 'Berta',
		inviteTokenHash: tokenHashen(tokenErzeugen()),
		isAdmin: false,
	});
	const keksAnna = new Kekse();
	const keksBerta = new Kekse();
	await sitzungAusstellen(keksAnna.alsCookies(), anna.id);
	await sitzungAusstellen(keksBerta.alsCookies(), berta.id);
	pruefen(
		'zwei Mitglieder bekommen verschiedene Sitzungen — der Signierer liefert keinen festen Wert',
		keksAnna.get('sitzung') !== keksBerta.get('sitzung')
	);

	// -----------------------------------------------------------------------
	// Wiederkehr: locals, Kopfzeile, gleitende Erneuerung
	// -----------------------------------------------------------------------
	const mitglied = durchEins.mitglied as Record<string, unknown> | null;
	pruefenGleich('locals.mitglied ist gesetzt', mitglied?.id, anna.id);
	pruefenGleich('locals.mitglied trägt den Namen', mitglied?.name, 'Anna');
	pruefen(
		'locals.mitglied trägt die Hash-Spalte nicht',
		mitglied !== null && !('inviteTokenHash' in mitglied),
		JSON.stringify(Object.keys(mitglied ?? {}))
	);
	pruefenGleich(
		'Referrer-Policy: no-referrer auf dem gewachten Pfad',
		durchEins.antwort.headers.get('referrer-policy'),
		'no-referrer'
	);
	// Genau eine Setzung: die Saat des eingehenden Cookies zählt nicht mit, sonst
	// wäre die Schwelle schon durch die Vorbereitung erfüllt.
	pruefenGleich(
		'der Wächter erneuert das Cookie genau einmal',
		durchEins.ereignis.kekse.setzungen.length,
		1
	);
	cookieAttributePruefen('gleitende Erneuerung', durchEins.ereignis.kekse.letzteSetzung('sitzung'));
	pruefenGleich(
		'der Wächter setzt auf dem Erfolgspfad keine eigene Kopfzeile über setHeaders',
		durchEins.ereignis.gesetzteKopfzeilen.length,
		0
	);

	// sitzungLoeschen behält dieselben Attribute — sonst löscht der Browser ein
	// anderes Cookie als das gesetzte.
	const loeschKekse = new Kekse();
	sitzungLoeschen(loeschKekse.alsCookies());
	const geloescht = loeschKekse.letzteSetzung('sitzung');
	pruefenGleich('sitzungLoeschen setzt maxAge 0', geloescht?.optionen.maxAge, 0);
	pruefenGleich('sitzungLoeschen behält path /', geloescht?.optionen.path, '/');
	pruefenGleich('sitzungLoeschen behält httpOnly', geloescht?.optionen.httpOnly, true);
	pruefenGleich('sitzungLoeschen behält secure', geloescht?.optionen.secure, true);

	// -----------------------------------------------------------------------
	// Widerruf einer bereits **lebenden** Sitzung.
	// -----------------------------------------------------------------------
	const doraToken = tokenErzeugen();
	const dora = mitgliedAnlegen({
		name: 'Dora',
		inviteTokenHash: tokenHashen(doraToken),
		isAdmin: false,
	});
	const doraKekse = new Kekse();
	await sitzungAusstellen(doraKekse.alsCookies(), dora.id);
	const doraKeks = doraKekse.get('sitzung');
	const doraVorher = antwortOderRot(
		'lebende Sitzung: Aufruf gelingt vor dem Widerruf',
		await aufrufen('/', doraKeks)
	);
	pruefenGleich('lebende Sitzung sieht die Liste', doraVorher.antwort.status, 200);

	datenbank().update(members).set({ isActive: false }).where(eq(members.id, dora.id)).run();

	const doraNachher = abweisungOderRot(
		'lebende Sitzung: derselbe Keks wird nach dem Widerruf abgewiesen',
		await aufrufen('/', doraKeks)
	);
	const doraZweiterVersuch = abweisungOderRot(
		'und beim zweiten Versuch ebenso',
		await aufrufen('/', doraKeks)
	);
	const doraEinloesen = abweisungOderRot(
		'widerrufenes gespeichertes Token wird von der Einlöseroute abgewiesen',
		await aufrufen(`/i/${doraToken}`)
	);

	// -----------------------------------------------------------------------
	// Der Einlösepfad umgeht den Wächter
	// -----------------------------------------------------------------------
	const bypass = antwortOderRot(
		'Einlösepfad ohne Cookie erreicht die Route statt der 403',
		await aufrufen(`/i/${annaToken}/`)
	);
	pruefenGleich('dort ist locals.mitglied null', bypass.mitglied, null);
	const zuTief = abweisungOderRot(
		'ein tieferer Pfad unter /i/ umgeht den Wächter nicht',
		await aufrufen('/i/eins/zwei')
	);

	// -----------------------------------------------------------------------
	// Die Fälle ohne Zugang
	// -----------------------------------------------------------------------
	const ohneKeks = abweisungOderRot('ohne Zugang: kein Cookie', await aufrufen('/'));
	const kaputterKeks = abweisungOderRot(
		'ohne Zugang: Cookie manipuliert',
		await aufrufen('/', `${(gueltigerKeks ?? '').slice(0, -4)}xxxx`)
	);
	const unbekanntesToken = abweisungOderRot(
		'ohne Zugang: Token unbekannt',
		await aufrufen(`/i/${tokenErzeugen()}`)
	);

	const geloeschteZeile = new Kekse();
	await sitzungAusstellen(geloeschteZeile.alsCookies(), 999_999);
	const zeileWeg = abweisungOderRot(
		'ohne Zugang: Cookie gültig, Mitgliedszeile weg',
		await aufrufen('/', geloeschteZeile.get('sitzung'))
	);

	// Keine Nebenwirkung an einer Wurfstelle: kein Cookie, keine Kopfzeile.
	// Diese zwei Behauptungen lesen aufgezeichnete Nebenwirkungen, nicht ein
	// Literal aus fehlerseite() — ein sitzungLoeschen vor dem Wurf fällt auf.
	for (const [name, fall] of [
		['Wächter', ohneKeks],
		['Einlöseroute', unbekanntesToken],
	] as const) {
		pruefenGleich(
			`${name}: die Wurfstelle setzt kein Cookie`,
			fall.ereignis.kekse.setzungen.length,
			0
		);
		pruefenGleich(
			`${name}: die Wurfstelle registriert keine Kopfzeile`,
			fall.ereignis.gesetzteKopfzeilen.length,
			0
		);
	}

	// Abdruck über echte Antwortobjekte **samt aufgezeichneten Nebenwirkungen**.
	const abdruecke = await Promise.all(
		[ohneKeks, kaputterKeks, unbekanntesToken, doraNachher].map(abdruck)
	);
	pruefen(
		'die vier Fälle ohne Zugang sind ununterscheidbar, samt Kopfzeilen und Nebenwirkungen',
		new Set(abdruecke).size === 1,
		`${new Set(abdruecke).size} verschiedene Abdrücke`
	);
	pruefen(
		'auch fehlende Mitgliedszeile, zweiter Versuch, widerrufenes Token und tiefer Pfad fallen zusammen',
		new Set([
			...abdruecke,
			await abdruck(zeileWeg),
			await abdruck(doraZweiterVersuch),
			await abdruck(doraEinloesen),
			await abdruck(zuTief),
		]).size === 1
	);

	// Der Satz muss in der einzigen sichtbaren Zeile stehen.
	const seite = await ohneKeks.antwort.clone().text();
	const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(seite);
	pruefenGleich('das gerenderte h1 trägt genau den vorgeschriebenen Satz', h1?.[1], KEIN_ZUGANG);
	pruefen(
		'die gerenderte Fehlerseite ist ein HTML-Dokument',
		seite.trimStart().toLowerCase().startsWith('<!doctype html>')
	);

	// -----------------------------------------------------------------------
	// handleError — ausgeführt
	// -----------------------------------------------------------------------
	const vierNullVier = new Ereignis('/gibtsnicht');
	let vierNullVierAntwort: unknown;
	const vierNullVierProtokoll = await protokollMitschreiben(async () => {
		vierNullVierAntwort = await handleError({
			error: new Error('Not Found'),
			event: vierNullVier.alsRequestEvent(),
			status: 404,
			message: 'Not Found',
		});
	});
	pruefenGleich(
		'handleError gibt einem unbekannten Pfad seinen eigenen Satz',
		(vierNullVierAntwort as { message?: string } | undefined)?.message,
		NICHT_GEFUNDEN
	);
	pruefenGleich('ein 404 landet nicht in der Fehlerausgabe', vierNullVierProtokoll, '');

	const fuenfHundert = new Ereignis('/');
	let fuenfHundertAntwort: unknown;
	const fuenfHundertProtokoll = await protokollMitschreiben(async () => {
		fuenfHundertAntwort = await handleError({
			error: new Error('kaputt'),
			event: fuenfHundert.alsRequestEvent(),
			status: 500,
			message: 'Internal Error',
		});
	});
	pruefenGleich(
		'handleError gibt statt "Internal Error" einen deutschen Satz zurück',
		(fuenfHundertAntwort as { message?: string } | undefined)?.message,
		UNERWARTETER_FEHLER
	);
	pruefen(
		'ein 500 wird protokolliert',
		fuenfHundertProtokoll.includes('500') && fuenfHundertProtokoll.includes('kaputt'),
		JSON.stringify(fuenfHundertProtokoll)
	);

	// Die Token-Schwärzung: der Klartext darf in keiner Protokollzeile stehen.
	const tokenImPfad = tokenErzeugen();
	const mitToken = new Ereignis(`/i/${tokenImPfad}`);
	const tokenProtokoll = await protokollMitschreiben(async () => {
		await handleError({
			error: new Error('kaputt'),
			event: mitToken.alsRequestEvent(),
			status: 500,
			message: 'Internal Error',
		});
	});
	pruefen(
		'handleError schreibt kein Klartext-Token ins Protokoll',
		!tokenProtokoll.includes(tokenImPfad),
		JSON.stringify(tokenProtokoll)
	);
	pruefen(
		'handleError protokolliert den Pfad geschwärzt',
		tokenProtokoll.includes('/i/'),
		JSON.stringify(tokenProtokoll)
	);

	// -----------------------------------------------------------------------
	// src/error.html — die rahmenlose Minimalseite
	// -----------------------------------------------------------------------
	const vorlage = readFileSync(join(wurzel, 'src', 'error.html'), 'utf8');
	pruefen('src/error.html steht auf lang="de"', vorlage.includes('<html lang="de">'));
	pruefenGleich('src/error.html hat genau ein h1', (vorlage.match(/<h1\b/g) ?? []).length, 1);
	pruefen(
		'src/error.html füllt das h1 aus dem Rumpf des Wurfs',
		vorlage.includes('%sveltekit.error.message%')
	);
	pruefen(
		'src/error.html verweist auf nichts von draussen',
		!/<link\b/.test(vorlage) && !/@import/.test(vorlage) && !/\ssrc=/.test(vorlage)
	);
	pruefen(
		'src/error.html trägt keine Titel- und keine Navigationsleiste',
		!/title-bar|nav-bar/.test(vorlage)
	);
	pruefen(
		'src/error.html trägt meta referrer no-referrer',
		/<meta\s+name="referrer"\s+content="no-referrer"/.test(vorlage)
	);
	// Hex-Werte und GrayText prüft Regel 1 des Tors, mit Fehlerproben dahinter.
	// Hier steht darum nur, was das Tor nicht liest.

	// -----------------------------------------------------------------------
	// SESSION_SECRET: die Prüfung selbst ausführen
	// -----------------------------------------------------------------------
	for (const [wie, wert] of [
		['leer', ''],
		['31 Zeichen', 'a'.repeat(30) + 'b'],
		['32 gleiche Zeichen', 'a'.repeat(32)],
	] as const) {
		process.env.SESSION_SECRET = wert;
		let geworfen = false;
		try {
			sitzungsgeheimnisPruefen();
		} catch {
			geworfen = true;
		}
		pruefen(`SESSION_SECRET ${wie} wird abgewiesen`, geworfen);
	}
	process.env.SESSION_SECRET = GUTES_GEHEIMNIS;
	let gutGeworfen = false;
	try {
		sitzungsgeheimnisPruefen();
	} catch {
		gutGeworfen = true;
	}
	pruefen('ein brauchbares SESSION_SECRET wird angenommen', !gutGeworfen);

	// -----------------------------------------------------------------------
	// create-admin
	// -----------------------------------------------------------------------
	const ohneNamen = wegwerfVerzeichnis('gartenplaner-smoke-ohne-namen-');
	const laufOhneNamen = starten(['scripts/create-admin.ts'], {
		...process.env,
		DATABASE_PATH: join(ohneNamen, 'db.sqlite'),
		ORIGIN: HERKUNFT,
	});
	pruefen(
		'create-admin ohne Namen endet mit 1 und einer Meldung',
		laufOhneNamen.status === 1 && laufOhneNamen.stderr.includes('Es fehlt der Name'),
		`Status ${laufOhneNamen.status}, stderr ${JSON.stringify(laufOhneNamen.stderr)}`
	);
	pruefenGleich(
		'create-admin ohne Namen legt keine Datenbankdatei an',
		readdirSync(ohneNamen).length,
		0
	);
	rmSync(ohneNamen, { recursive: true, force: true });

	const ohneHerkunft = wegwerfVerzeichnis('gartenplaner-smoke-ohne-origin-');
	const umgebungOhneOrigin: Record<string, string | undefined> = {
		...process.env,
		DATABASE_PATH: join(ohneHerkunft, 'db.sqlite'),
	};
	delete umgebungOhneOrigin.ORIGIN;
	const laufOhneOrigin = starten(['scripts/create-admin.ts', 'Dora'], umgebungOhneOrigin);
	pruefen(
		'create-admin ohne ORIGIN endet mit 1 und legt keine Datenbank an',
		laufOhneOrigin.status === 1 && readdirSync(ohneHerkunft).length === 0,
		`Status ${laufOhneOrigin.status}`
	);
	rmSync(ohneHerkunft, { recursive: true, force: true });

	for (const [wie, wert] of [
		['Pfad', `${HERKUNFT}/app?x=1`],
		['Fragment', `${HERKUNFT}#irgendwo`],
	] as const) {
		const verzeichnis = wegwerfVerzeichnis('gartenplaner-smoke-origin-');
		const lauf = starten(['scripts/create-admin.ts', 'Dora'], {
			...process.env,
			DATABASE_PATH: join(verzeichnis, 'db.sqlite'),
			ORIGIN: wert,
		});
		pruefen(
			`create-admin weist ein ORIGIN mit ${wie} ab, bevor ein Token entsteht`,
			lauf.status === 1 && readdirSync(verzeichnis).length === 0,
			`Status ${lauf.status}, stderr ${JSON.stringify(lauf.stderr.slice(0, 120))}`
		);
		rmSync(verzeichnis, { recursive: true, force: true });
	}

	const mitNamen = wegwerfVerzeichnis('gartenplaner-smoke-admin-');
	const adminDb = join(mitNamen, 'db.sqlite');
	const adminUmgebung = { ...process.env, DATABASE_PATH: adminDb, ORIGIN: HERKUNFT };
	const laufAdmin = starten(['scripts/create-admin.ts', 'Anna', 'Meier'], adminUmgebung);
	pruefen(
		'create-admin endet mit 0',
		laufAdmin.status === 0,
		`Status ${laufAdmin.status}, stderr ${JSON.stringify(laufAdmin.stderr)}`
	);

	const linkZeilen = laufAdmin.stdout.split('\n').filter((zeile) => zeile.includes('/i/'));
	pruefenGleich('create-admin gibt genau eine Link-Zeile aus', linkZeilen.length, 1);

	const laufZweimal = starten(['scripts/create-admin.ts', 'Berta'], adminUmgebung);
	pruefen(
		'ein zweiter Lauf von create-admin wird abgewiesen',
		laufZweimal.status === 1 && laufZweimal.stderr.includes('erste'),
		`Status ${laufZweimal.status}, stderr ${JSON.stringify(laufZweimal.stderr)}`
	);

	if (linkZeilen.length === 1 && existsSync(adminDb)) {
		const klartext = linkZeilen[0].trim().replace(`${HERKUNFT}/i/`, '');
		pruefen('das Klartext-Token ist base64url aus 32 Byte', /^[A-Za-z0-9_-]{43}$/.test(klartext));

		const gelesen = new Database(adminDb, { readonly: true });
		const zeilen = gelesen
			.prepare('SELECT id, name, invite_token_hash, is_admin, is_active FROM members')
			.all() as {
			id: number;
			name: string;
			invite_token_hash: string;
			is_admin: number;
			is_active: number;
		}[];
		gelesen.close();

		pruefenGleich('nach dem Zweitlauf steht genau ein Mitglied in members', zeilen.length, 1);
		const zeile = zeilen[0];
		pruefenGleich('der Name kommt aus allen Argumenten', zeile.name, 'Anna Meier');
		pruefenGleich('create-admin legt is_admin = 1 an', zeile.is_admin, 1);
		pruefenGleich('das erste Mitglied ist aktiv', zeile.is_active, 1);
		pruefen(
			'in members steht ein 64-stelliger Hex-Hash',
			/^[0-9a-f]{64}$/.test(zeile.invite_token_hash)
		);
		pruefenGleich(
			'der Hash gehört zum ausgegebenen Token',
			zeile.invite_token_hash,
			tokenHashen(klartext)
		);
		pruefen('in members steht nirgends der Klartext', !JSON.stringify(zeile).includes(klartext));
		pruefen(
			'auch die Datenbankdatei enthält den Klartext nicht',
			!readFileSync(adminDb, 'latin1').includes(klartext)
		);
		pruefen(
			'der Hash steht dagegen in der Datenbankdatei',
			readFileSync(adminDb, 'latin1').includes(zeile.invite_token_hash)
		);
	} else {
		for (const was of [
			'das Klartext-Token ist base64url aus 32 Byte',
			'nach dem Zweitlauf steht genau ein Mitglied in members',
			'der Name kommt aus allen Argumenten',
			'create-admin legt is_admin = 1 an',
			'das erste Mitglied ist aktiv',
			'in members steht ein 64-stelliger Hex-Hash',
			'der Hash gehört zum ausgegebenen Token',
			'in members steht nirgends der Klartext',
			'auch die Datenbankdatei enthält den Klartext nicht',
			'der Hash steht dagegen in der Datenbankdatei',
		]) {
			pruefen(was, false, 'die Link-Zeile von create-admin war nicht auswertbar');
		}
	}
	rmSync(mitNamen, { recursive: true, force: true });

	// =======================================================================
	// /verwaltung und /mehr — Story 1.3.
	//
	// Die Routenmodule werden direkt gerufen, mit gesetztem locals.mitglied.
	// Das ist die Grenze, an der die Adminschranke sitzt: der Wächter kennt
	// is_admin nicht, und eine action ohne Schranke fällt in der Oberfläche
	// nicht auf, weil Nicht-Admins den Knopf ohnehin nicht sehen.
	// =======================================================================
	const verwaltung = await verwaltungLaden();
	const mehr = await mehrLaden();

	const veraToken = tokenErzeugen();
	const vera = mitgliedAnlegen({
		name: 'Vera',
		inviteTokenHash: tokenHashen(veraToken),
		isAdmin: true,
	});
	const nico = mitgliedAnlegen({
		name: 'Nico',
		inviteTokenHash: tokenHashen(tokenErzeugen()),
		isAdmin: false,
	});
	const veraLocals = ohneTokenHash(vera);
	const nicoLocals = ohneTokenHash(nico);

	// -----------------------------------------------------------------------
	// Die Adminschranke: load und alle drei actions
	// -----------------------------------------------------------------------
	const vorSchranke = mitgliederZaehlen();
	const veraVorSchranke = zeileAbdruck(vera.id);

	wegGeleitet(
		'Nicht-Admin auf die load von /verwaltung: 303 auf /',
		await routenausgang(() =>
			verwaltung.load(alsMitglied('/verwaltung', nicoLocals).alsRequestEvent())
		)
	);

	for (const aktion of ['aufnehmen', 'neuAusstellen', 'widerrufen'] as const) {
		// Die Formulardaten sind vollständig und gültig: was hier abgewiesen
		// wird, ist allein die fehlende Adminschaft. Ohne adminOderWeg in dieser
		// action entstünde ein Mitglied beziehungsweise änderte sich eine Zeile.
		wegGeleitet(
			`Nicht-Admin auf die action ${aktion}: 303 auf /`,
			await routenausgang(() =>
				verwaltung.actions[aktion](
					alsMitglied('/verwaltung', nicoLocals, {
						name: 'Eve Eindringling',
						mitgliedId: String(vera.id),
					}).alsRequestEvent()
				)
			)
		);
	}

	pruefenGleich(
		'die vier abgewiesenen Aufrufe haben kein Mitglied angelegt',
		mitgliederZaehlen(),
		vorSchranke
	);
	pruefenGleich(
		'und die angesprochene Zeile ist unverändert',
		zeileAbdruck(vera.id),
		veraVorSchranke
	);

	// -----------------------------------------------------------------------
	// Aufnehmen: der Klartext verlässt den Server genau einmal
	// -----------------------------------------------------------------------
	// Das Ereignis wird festgehalten: die Kopfzeilen, die die action über
	// setHeaders anmeldet, stehen nur darauf.
	const aufnahmeEreignis = alsMitglied('/verwaltung', veraLocals, { name: '  Emma   Studer ' });
	const aufnahme = await routenausgang(() =>
		verwaltung.actions.aufnehmen(aufnahmeEreignis.alsRequestEvent())
	);
	const aufnahmeLink = textFeld(wertVon(aufnahme), 'link');
	const emmaToken = aufnahmeLink.replace(`${HERKUNFT}/i/`, '');

	pruefen(
		'aufnehmen gibt einen Klartext-Link zurück',
		aufnahme.art === 'wert' && aufnahmeLink !== '',
		`Ausgang ${aufnahme.art}`
	);
	pruefen(
		'der Link steht auf der Herkunft und trägt ein base64url-Token',
		new RegExp(`^${HERKUNFT}/i/[A-Za-z0-9_-]{43}$`).test(aufnahmeLink),
		JSON.stringify(aufnahmeLink)
	);
	pruefenGleich(
		'der Name kommt getrimmt und mit einfachen Leerzeichen an',
		textFeld(wertVon(aufnahme), 'name'),
		'Emma Studer'
	);

	const emma = datenbank()
		.select()
		.from(members)
		.where(eq(members.inviteTokenHash, tokenHashen(emmaToken)))
		.get();
	pruefenGleich('das aufgenommene Mitglied hat is_admin = 0', emma?.isAdmin, false);
	pruefenGleich('das aufgenommene Mitglied ist aktiv', emma?.isActive, true);
	pruefen(
		'in members steht ein 64-stelliger Hex-Hash',
		/^[0-9a-f]{64}$/.test(emma?.inviteTokenHash ?? ''),
		JSON.stringify(emma?.inviteTokenHash)
	);

	/*
	 * Die Rohdatei-Suche geht über **alle** Dateien der Datenbank, nicht nur
	 * über die Hauptdatei: die Verbindung läuft in WAL, und ein eben
	 * geschriebener Wert steht zuerst in smoke.sqlite-wal. Eine Suche allein in
	 * smoke.sqlite fände weder den Klartext noch den Hash und wäre damit eine
	 * Behauptung, die immer grün ist.
	 */
	const rohdaten = readdirSync(arbeit)
		.filter((datei) => datei.startsWith('smoke.sqlite'))
		.map((datei) => readFileSync(join(arbeit, datei), 'latin1'))
		.join('\n');
	pruefen('der Klartext steht in keiner Datenbankdatei', !rohdaten.includes(emmaToken));
	// Positive Gegenprobe: ohne sie wäre die Zeile darüber auch bei einer
	// leeren Suchmenge grün.
	pruefen(
		'der Hash steht dagegen in einer Datenbankdatei',
		rohdaten.includes(emma?.inviteTokenHash ?? 'kein-hash')
	);

	/*
	 * no-store auf der Antwort, die Klartext trägt.
	 *
	 * Es ist die einzige Kopfzeile, die die Zusage „nie gespeichert" überhaupt
	 * trägt: ohne sie darf der Browser die POST-Antwort im Verlauf und im
	 * Plattenzwischenspeicher behalten — und ohne JavaScript ist diese Antwort
	 * ein vollständiges HTML-Dokument mit dem Link darin.
	 */
	pruefenGleich(
		'aufnehmen meldet cache-control: no-store an',
		aufnahmeEreignis.gesetzteKopfzeilen.join('\n'),
		'cache-control: no-store'
	);

	const nachAufnahme = await routenausgang(() =>
		verwaltung.load(alsMitglied('/verwaltung', veraLocals).alsRequestEvent())
	);
	pruefen(
		'ein Neuladen der Seite kennt den Klartext nicht mehr',
		!JSON.stringify(wertVon(nachAufnahme)).includes(emmaToken)
	);

	// -----------------------------------------------------------------------
	// Leerer Name: kein Mitglied, kein Token
	// -----------------------------------------------------------------------
	const vorLeer = mitgliederZaehlen();
	const leererName = await routenausgang(() =>
		verwaltung.actions.aufnehmen(
			alsMitglied('/verwaltung', veraLocals, { name: '   ' }).alsRequestEvent()
		)
	);
	pruefen(
		'ein Name aus Leerzeichen ergibt einen Fehlschlag mit 400 am Feld name',
		leererName.art === 'fehlschlag' &&
			leererName.status === 400 &&
			leererName.daten.feld === 'name',
		`Ausgang ${leererName.art}`
	);
	pruefenGleich('und legt kein Mitglied an', mitgliederZaehlen(), vorLeer);
	pruefen('und lässt kein Token nach draussen', !traegtToken(datenVon(leererName)));
	pruefenGleich(
		'die Eingabe kommt unverändert zum Feld zurück',
		textFeld(datenVon(leererName), 'nameEingabe'),
		'   '
	);

	/*
	 * Namen, die trim() besteht und die trotzdem keiner sind.
	 *
	 * Nullbreiten-Zeichen haben keine Breite und sind für trim() kein Leerraum:
	 * ein Name aus ihnen legte eine Zeile ohne lesbaren Namen an, mit einem
	 * lebenden Einladungslink und ohne jede Aussage, wer das ist. Es gibt keine
	 * Umbenennen-Aktion, der Fehler wäre endgültig.
	 *
	 * Die Überlänge steht daneben, weil beide dieselbe Stelle prüfen und beide
	 * dieselbe Zusage tragen: kein Mitglied, kein Token.
	 */
	for (const [wie, eingabe] of [
		['aus Nullbreiten-Zeichen', '\u200B\u200C\u200D\u2060\uFEFF'],
		['aus Nullbreite mit Leerzeichen', ' \u200B \uFEFF '],
		['über 80 Zeichen', 'A'.repeat(81)],
		['über 80 Zeichen nach dem Zusammenziehen', `${'B'.repeat(40)}   ${'C'.repeat(41)}`],
	] as const) {
		const vorher = mitgliederZaehlen();
		const ausgang = await routenausgang(() =>
			verwaltung.actions.aufnehmen(
				alsMitglied('/verwaltung', veraLocals, { name: eingabe }).alsRequestEvent()
			)
		);
		pruefen(
			`ein Name ${wie} wird mit 400 am Feld name abgewiesen`,
			ausgang.art === 'fehlschlag' && ausgang.status === 400 && ausgang.daten.feld === 'name',
			`Ausgang ${ausgang.art}`
		);
		pruefenGleich(`ein Name ${wie} legt kein Mitglied an`, mitgliederZaehlen(), vorher);
		pruefen(`ein Name ${wie} lässt kein Token nach draussen`, !traegtToken(datenVon(ausgang)));
	}

	// Gegenprobe: ein Name **mit** einem Nullbreiten-Zeichen darin, der nach dem
	// Aussieben lesbar bleibt, muss durchgehen — sonst wäre die Prüfung zu breit
	// und wiese Namen ab, die aus einem Chat eingefügt wurden.
	const mitUnsichtbarem = await routenausgang(() =>
		verwaltung.actions.aufnehmen(
			alsMitglied('/verwaltung', veraLocals, {
				name: 'Ida\u200BLenz',
			}).alsRequestEvent()
		)
	);
	pruefenGleich(
		'ein lesbarer Name mit einem Nullbreiten-Zeichen darin wird gesäubert und angenommen',
		textFeld(wertVon(mitUnsichtbarem), 'name'),
		'IdaLenz'
	);

	// Und die Grenze selbst: genau 80 Zeichen sind erlaubt, 81 nicht.
	const genauAchtzig = await routenausgang(() =>
		verwaltung.actions.aufnehmen(
			alsMitglied('/verwaltung', veraLocals, { name: 'D'.repeat(80) }).alsRequestEvent()
		)
	);
	pruefen(
		'genau 80 Zeichen werden angenommen — die Grenze liegt bei 81',
		genauAchtzig.art === 'wert' && textFeld(wertVon(genauAchtzig), 'name').length === 80,
		`Ausgang ${genauAchtzig.art}`
	);

	// -----------------------------------------------------------------------
	// Link neu ausstellen: der alte Link stirbt, der neue lebt
	// -----------------------------------------------------------------------
	const emmaId = emma?.id ?? 0;
	const alterHash = emma?.inviteTokenHash ?? '';
	const neuEreignis = alsMitglied('/verwaltung', veraLocals, { mitgliedId: String(emmaId) });
	const neuAusgestellt = await routenausgang(() =>
		verwaltung.actions.neuAusstellen(neuEreignis.alsRequestEvent())
	);
	pruefenGleich(
		'neuAusstellen meldet cache-control: no-store an',
		neuEreignis.gesetzteKopfzeilen.join('\n'),
		'cache-control: no-store'
	);
	const neuerLink = textFeld(wertVon(neuAusgestellt), 'link');
	const emmaTokenNeu = neuerLink.replace(`${HERKUNFT}/i/`, '');
	pruefen(
		'neuAusstellen gibt einen neuen Klartext-Link zurück',
		neuAusgestellt.art === 'wert' && neuerLink !== '' && emmaTokenNeu !== emmaToken,
		`Ausgang ${neuAusgestellt.art}`
	);

	const emmaNachNeu = datenbank().select().from(members).where(eq(members.id, emmaId)).get();
	pruefen(
		'der neue Hash ersetzt den alten',
		emmaNachNeu?.inviteTokenHash === tokenHashen(emmaTokenNeu) &&
			emmaNachNeu?.inviteTokenHash !== alterHash,
		JSON.stringify(emmaNachNeu?.inviteTokenHash)
	);
	pruefen(
		'Id und Name bleiben — es ist ein UPDATE derselben Zeile',
		emmaNachNeu?.id === emmaId && emmaNachNeu?.name === 'Emma Studer',
		JSON.stringify({ id: emmaNachNeu?.id, name: emmaNachNeu?.name })
	);

	abweisungOderRot(
		'der alte Link wird von der Einlöseroute abgewiesen',
		await aufrufen(`/i/${emmaToken}`)
	);
	const neuEingeloest = antwortOderRot(
		'der neue Link wird eingelöst',
		await aufrufen(`/i/${emmaTokenNeu}`)
	);
	pruefenGleich('und zwar mit 303', neuEingeloest.antwort.status, 303);

	// -----------------------------------------------------------------------
	// Widerrufen: deaktivieren, nicht löschen
	// -----------------------------------------------------------------------
	const widerrufEreignis = alsMitglied('/verwaltung', veraLocals, { mitgliedId: String(emmaId) });
	const widerrufen = await routenausgang(() =>
		verwaltung.actions.widerrufen(widerrufEreignis.alsRequestEvent())
	);
	// Gegenprobe zu den zwei Behauptungen darüber: eine Antwort ohne Geheimnis
	// braucht die Kopfzeile nicht, und ein pauschales setHeaders in allen drei
	// actions wäre kein Nachweis, sondern eine Gewohnheit.
	pruefenGleich(
		'widerrufen meldet keine Kopfzeile an — es steht kein Klartext in der Antwort',
		widerrufEreignis.gesetzteKopfzeilen.length,
		0
	);
	pruefen(
		'widerrufen gelingt und nennt den Namen',
		widerrufen.art === 'wert' && textFeld(wertVon(widerrufen), 'name') === 'Emma Studer',
		`Ausgang ${widerrufen.art}`
	);

	const emmaNachWiderruf = datenbank().select().from(members).where(eq(members.id, emmaId)).get();
	pruefenGleich('is_active steht danach auf false', emmaNachWiderruf?.isActive, false);
	pruefen(
		'Name und Hash stehen unverändert — gelöscht und geleert wird nichts',
		emmaNachWiderruf?.name === 'Emma Studer' &&
			emmaNachWiderruf?.inviteTokenHash === emmaNachNeu?.inviteTokenHash,
		JSON.stringify(emmaNachWiderruf)
	);
	abweisungOderRot(
		'der Link ergibt nach dem Widerruf die Fehlerseite',
		await aufrufen(`/i/${emmaTokenNeu}`)
	);

	// -----------------------------------------------------------------------
	// Auf sich selbst: abgewiesen in der action, nicht nur in der Oberfläche
	// -----------------------------------------------------------------------
	const selbstSaetze = new Set<string>();
	for (const aktion of ['widerrufen', 'neuAusstellen'] as const) {
		const vorher = zeileAbdruck(vera.id);
		const ausgang = await routenausgang(() =>
			verwaltung.actions[aktion](
				alsMitglied('/verwaltung', veraLocals, { mitgliedId: String(vera.id) }).alsRequestEvent()
			)
		);
		abgewiesen(`${aktion} auf die eigene Id wird abgewiesen`, ausgang, EIGENER_ZUGANG_GESCHUETZT);
		pruefenGleich(`${aktion} auf die eigene Id ändert nichts`, zeileAbdruck(vera.id), vorher);
		selbstSaetze.add(textFeld(datenVon(ausgang), 'meldung'));
	}
	/*
	 * Ein Satz für beide Wurfstellen — und einer, der auf beide passt.
	 *
	 * Die frühere Fassung sagte „kannst du hier nicht beenden" und war damit
	 * beim Neuausstellen eine Ablehnung für eine Handlung, die niemand versucht
	 * hat. Diese Behauptung hält den einen Satz fest; dass er kein Verb der
	 * einen Aktion nennt, prüft die Zeile darunter.
	 */
	pruefen(
		'beide Selbst-actions tragen denselben Satz',
		selbstSaetze.size === 1,
		`${selbstSaetze.size} verschiedene Sätze: ${JSON.stringify([...selbstSaetze])}`
	);
	pruefen(
		'und der Satz nennt kein Verb, das nur auf eine der beiden actions passt',
		!/\bbeenden\b|\bwiderruf/i.test(EIGENER_ZUGANG_GESCHUETZT) &&
			!/\bausstell/i.test(EIGENER_ZUGANG_GESCHUETZT),
		JSON.stringify(EIGENER_ZUGANG_GESCHUETZT)
	);

	// -----------------------------------------------------------------------
	// Nicht ansprechbar: vier Zustände, ein Satz
	// -----------------------------------------------------------------------
	const tabelleVorher = JSON.stringify(datenbank().select().from(members).all());
	const saetze = new Set<string>();
	for (const [wie, formular] of [
		['unbekannt', { mitgliedId: '999999' }],
		['fehlend', {}],
		['nicht numerisch', { mitgliedId: 'abc' }],
		['schon beendet', { mitgliedId: String(emmaId) }],
	] as const) {
		for (const aktion of ['widerrufen', 'neuAusstellen'] as const) {
			const ausgang = await routenausgang(() =>
				verwaltung.actions[aktion](
					alsMitglied('/verwaltung', veraLocals, { ...formular }).alsRequestEvent()
				)
			);
			abgewiesen(`${aktion}, mitgliedId ${wie}`, ausgang, MITGLIED_NICHT_ANSPRECHBAR);
			saetze.add(textFeld(datenVon(ausgang), 'meldung'));
		}
	}
	pruefen(
		'alle vier Zustände und beide actions tragen denselben Satz',
		saetze.size === 1,
		`${saetze.size} verschiedene Sätze`
	);
	pruefenGleich(
		'und keiner von ihnen hat die Tabelle angefasst',
		JSON.stringify(datenbank().select().from(members).all()),
		tabelleVorher
	);

	// -----------------------------------------------------------------------
	// Ohne Mitglied in locals: derselbe Ausgang wie ohne Adminrechte
	// -----------------------------------------------------------------------
	/*
	 * Der Zweig `locals.mitglied === null` in adminOderWeg und in
	 * mehr/+page.server.ts. Er ist auf dem gewachten Pfad unerreichbar — der
	 * Wächter hat vorher mit 403 abgewiesen —, aber der Typ lässt null zu, und
	 * ein `!` an einer der beiden Stellen wäre eine Annahme über eine andere
	 * Datei. Diese zwei Behauptungen sind das Einzige, was diesen Zweig
	 * überhaupt ausführt.
	 */
	wegGeleitet(
		'die load von /verwaltung leitet ohne Mitglied in locals weiter',
		await routenausgang(() => verwaltung.load(alsMitglied('/verwaltung', null).alsRequestEvent()))
	);
	wegGeleitet(
		'die load von /mehr leitet ohne Mitglied in locals weiter',
		await routenausgang(() => mehr.load(alsMitglied('/mehr', null).alsRequestEvent()))
	);

	// -----------------------------------------------------------------------
	// Die Namensfolge: de-CH, nicht SQLites BINARY
	// -----------------------------------------------------------------------
	/*
	 * Drei Namen, die BINARY und de-CH verschieden ordnen. BINARY vergleicht
	 * UTF-8-Bytes: Grossbuchstaben (0x41…) liegen vor Kleinbuchstaben (0x61…),
	 * und ein mehrbytiges `Ä` (0xC3 0x84) hinter allem. Die drei Behauptungen
	 * darunter nennen darum konkrete Paare und nicht bloss „sortiert" — ein
	 * Vergleich der Ausgabe gegen denselben Collator wäre ein Selbstgespräch.
	 */
	const ueli = mitgliedAnlegen({
		name: 'Ueli Zwygart',
		inviteTokenHash: tokenHashen(tokenErzeugen()),
		isAdmin: true,
	});
	const ueliLocals = ohneTokenHash(ueli);
	for (const name of ['Ärni Zbinden', 'Zoe Ackermann', 'zoe Ackermann', 'oskar meier']) {
		mitgliedAnlegen({ name, inviteTokenHash: tokenHashen(tokenErzeugen()), isAdmin: false });
	}

	// -----------------------------------------------------------------------
	// Die Liste und /mehr — und in keiner von beiden ein Token-Hash
	// -----------------------------------------------------------------------
	const liste = wertVon(
		await routenausgang(() =>
			verwaltung.load(alsMitglied('/verwaltung', veraLocals).alsRequestEvent())
		)
	);
	const zeilen = (liste.mitglieder ?? []) as { id: number; isActive: boolean; name: string }[];

	/** Der Platz eines Namens in der ausgelieferten Liste, oder -1. */
	const platzVon = (name: string) => zeilen.findIndex((zeile) => zeile.name === name);

	pruefen(
		'Ärni Zbinden steht vor Zoe Ackermann — nicht nach UTF-8-Bytes sortiert',
		platzVon('Ärni Zbinden') >= 0 && platzVon('Ärni Zbinden') < platzVon('Zoe Ackermann'),
		`Ärni auf ${platzVon('Ärni Zbinden')}, Zoe auf ${platzVon('Zoe Ackermann')}`
	);
	pruefen(
		'oskar meier steht vor Ueli Zwygart — Kleinschreibung sortiert mit, nicht hinten an',
		platzVon('oskar meier') >= 0 && platzVon('oskar meier') < platzVon('Ueli Zwygart'),
		`oskar auf ${platzVon('oskar meier')}, Ueli auf ${platzVon('Ueli Zwygart')}`
	);
	/*
	 * Zwei Namen, die sich **nur** in der Grossschreibung unterscheiden.
	 *
	 * Behauptet wird ihre **Nachbarschaft** und nicht, welcher von beiden vorn
	 * steht. Die Richtung ist eine Festlegung der Kollation — de-CH stellt von
	 * sich aus klein vor gross —, und sie festzuschreiben hiesse, eine
	 * Willkürlichkeit zur Zusage zu machen. Was der Fehler war, ist die
	 * **Trennung**: unter BINARY liegen alle kleingeschriebenen Namen hinter
	 * allen grossgeschriebenen, und die zwei Zoes stehen an entgegengesetzten
	 * Enden der Liste. Zwei Zeilen, die nebeneinander gehören, sind dann nicht
	 * zusammen zu lesen.
	 *
	 * Eine erste Fassung dieser Behauptung nannte eine Richtung und war falsch
	 * — die Mutation auf caseFirst hat das gezeigt, indem sie **grün** blieb,
	 * bis die Namen sich wirklich nur in der Schreibung unterschieden, und dann
	 * die falsche Richtung offenlegte.
	 */
	pruefen(
		'Zoe Ackermann und zoe Ackermann stehen unmittelbar nebeneinander — die Grossschreibung trennt nicht',
		platzVon('Zoe Ackermann') >= 0 &&
			platzVon('zoe Ackermann') >= 0 &&
			Math.abs(platzVon('Zoe Ackermann') - platzVon('zoe Ackermann')) === 1,
		`Zoe auf ${platzVon('Zoe Ackermann')}, zoe auf ${platzVon('zoe Ackermann')}`
	);
	// Und die ganze Folge, damit eine Sortierung nach einer anderen Spalte auffällt.
	const aktiveNamen = zeilen.filter((zeile) => zeile.isActive).map((zeile) => zeile.name);
	pruefenGleich(
		'die aktive Gruppe steht vollständig in der Ordnung von de-CH',
		aktiveNamen.join(' | '),
		[...aktiveNamen].sort(new Intl.Collator('de-CH').compare).join(' | ')
	);

	/*
	 * ichId kommt aus der load und nicht aus einer Konstante.
	 *
	 * Zwei Adminpersonen rufen dieselbe load und müssen zwei verschiedene Werte
	 * bekommen. Eine einzelne Behauptung gegen eine bekannte Id liesse sich mit
	 * genau dieser Zahl als Literal erfüllen.
	 */
	const listeUeli = wertVon(
		await routenausgang(() =>
			verwaltung.load(alsMitglied('/verwaltung', ueliLocals).alsRequestEvent())
		)
	);
	pruefenGleich('die load gibt Vera ihre eigene Id als ichId', liste.ichId, vera.id);
	pruefenGleich('und Ueli seine — ichId ist keine Konstante', listeUeli.ichId, ueli.id);
	pruefen(
		'die Liste führt aktive und beendete Mitglieder',
		zeilen.some((zeile) => zeile.isActive) && zeilen.some((zeile) => !zeile.isActive),
		JSON.stringify(zeilen.map((zeile) => zeile.isActive))
	);
	pruefen(
		'die Liste stellt die aktiven vor die beendeten',
		zeilen.findIndex((zeile) => !zeile.isActive) ===
			zeilen.filter((zeile) => zeile.isActive).length,
		JSON.stringify(zeilen.map((zeile) => zeile.isActive))
	);

	const hashes = alleHashes();
	const listeAlsText = JSON.stringify(liste);
	pruefen(
		'die load von /verwaltung gibt keinen einzigen Token-Hash heraus',
		hashes.length > 0 && !hashes.some((hash) => listeAlsText.includes(hash)),
		`${hashes.length} Hashes geprüft`
	);

	const mehrAlsAdmin = wertVon(
		await routenausgang(() => mehr.load(alsMitglied('/mehr', veraLocals).alsRequestEvent()))
	);
	const mehrAlsNicht = wertVon(
		await routenausgang(() => mehr.load(alsMitglied('/mehr', nicoLocals).alsRequestEvent()))
	);
	pruefen(
		'/mehr gibt einer Adminperson istAdmin = true samt Namen',
		mehrAlsAdmin.istAdmin === true && mehrAlsAdmin.name === 'Vera',
		JSON.stringify(mehrAlsAdmin)
	);
	pruefen(
		'/mehr gibt einem Nicht-Admin istAdmin = false samt Namen',
		mehrAlsNicht.istAdmin === false && mehrAlsNicht.name === 'Nico',
		JSON.stringify(mehrAlsNicht)
	);
	pruefen(
		'die load von /mehr gibt keinen einzigen Token-Hash heraus',
		!hashes.some((hash) =>
			`${JSON.stringify(mehrAlsAdmin)}${JSON.stringify(mehrAlsNicht)}`.includes(hash)
		)
	);
} catch (fehler) {
	/*
	 * Ein unerwarteter Wurf ist ein Befund wie jeder andere und wird benannt.
	 *
	 * Ausgegeben werden Art und Meldung und — auf einer eigenen, beschrifteten
	 * Zeile — die innerste Quellstelle aus dem Stapel. Ein vollständiger
	 * Stacktrace bleibt aussen vor, wie überall in diesem Projekt; eine einzelne
	 * Fundstelle ist keine Ablage, sondern der Unterschied zwischen einer
	 * Meldung, mit der man arbeiten kann, und einer, die nur "ist keine Funktion"
	 * sagt.
	 */
	gescheitert += 1;
	const art = fehler instanceof Error ? fehler.name : typeof fehler;
	const meldung = fehler instanceof Error ? fehler.message : String(fehler);
	console.error(`VERSTOSS smoke  unerwarteter Wurf (${art}): ${meldung}`);

	const stelle =
		fehler instanceof Error && typeof fehler.stack === 'string'
			? (fehler.stack.split('\n').find((zeile) => zeile.trim().startsWith('at ')) ?? '')
			: '';
	if (stelle.trim() !== '') {
		console.error(`         Fundstelle: ${stelle.trim()}`);
	}
	console.error(
		'         Die Prüfliste ist damit abgebrochen — die Schlusszählung darunter\n' +
			'         sagt, wie viele Behauptungen noch gelaufen sind.'
	);
} finally {
	aufraeumen();
}

// Eine Behauptung, die in einem if stillschweigend ausfällt, fällt hier auf.
const abgelegt = gelaufen;
pruefen(
	`alle ${ERWARTETE_BEHAUPTUNGEN} Behauptungen sind gelaufen`,
	abgelegt === ERWARTETE_BEHAUPTUNGEN,
	`es liefen ${abgelegt}`
);

if (gescheitert > 0) {
	console.error(`\nsmoke: ${gescheitert} von ${gelaufen} Behauptung(en) nicht erfüllt.`);
	process.exit(1);
}
console.log(`\nsmoke: ${gelaufen} Behauptungen der Zugangsschicht ausgeführt belegt.`);
