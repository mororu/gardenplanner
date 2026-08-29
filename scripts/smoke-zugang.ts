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
 * Lücken einzeln zu flicken.
 *
 * Seit Story 3.0 steht die Empfehlung nicht mehr nur da: scripts/smoke-http.ts
 * fährt den **gebauten** Baum auf einem freien Port und misst dieselben Grenzen
 * an echten Antworten. Die zwei Skripte ersetzen einander nicht — dieses hier
 * kommt an Innenwerte, an die über HTTP niemand herankommt (der Inhalt eines
 * Optionsobjekts bei cookies.set, der Wurf einer action, die Reihenfolge in
 * einer load), und jenes an alles, was erst zwischen resolve und Steckdose
 * entsteht. Wo beide dieselbe Zusage berühren, gilt die Messung am Server.
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
 *     Versprechen, das scripts/gate.mjs schon gibt. Das Benennen, das Zählen und
 *     das Wegräumen liegen seit Story 3.0 in scripts/pruefhelfer.ts, damit die
 *     zwei Prüfskripte gleich melden.
 *   - Die POST-Behauptungen fahren **echte** Formulardaten: das Ereignis baut
 *     `new Request(url, { method: 'POST', body: FormData })`, damit
 *     `await request.formData()` in der action wirklich etwas zu parsen hat.
 *     Ohne Rumpf bekäme jede action eine leere Menge und die Prüfung läse nur
 *     ihre eigene Vorbereitung.
 *
 * Nicht abgedeckt bleibt hier respond.js — die Schicht, die den Wurf in die
 * Vorlage überführt, Kopfzeilen anhängt und Cookies ausliefert. Hier steht
 * ausdrücklich keine Behauptung darüber; sie stehen seit Story 3.0 in
 * scripts/smoke-http.ts, ausgeführt statt festgehalten.
 *
 * Am Ende zählt das Skript, wie viele Behauptungen tatsächlich gelaufen sind,
 * und vergleicht mit einer festen Zahl. Eine Behauptung, die in einem `if`
 * stillschweigend ausfällt, fällt damit auf.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
	aufraeumen,
	pruefen,
	pruefenGleich,
	unerwarteterWurf,
	wegwerfVerzeichnis,
	zaehlerstand,
} from './pruefhelfer.ts';
import Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';
import { isActionFailure, isHttpError, isRedirect, text } from '@sveltejs/kit';
import type { Cookies, Handle, RequestEvent, ServerLoadEvent } from '@sveltejs/kit';
import {
	sitzungAusstellen,
	sitzungLoeschen,
	sitzungsgeheimnisPruefen,
} from '../src/lib/server/auth.ts';
import { PLAN_HOECHSTZAHL } from '../src/lib/aufgabentext.ts';
import { datenbank, datenschichtStarten } from '../src/lib/server/db/index.ts';
import {
	DIENSTART_TRAENKEN,
	dutyWeeks,
	members,
	ohneTokenHash,
	tasks,
} from '../src/lib/server/db/schema.ts';
import type { AngemeldetesMitglied, NewTask } from '../src/lib/server/db/schema.ts';
import {
	mitgliedAnlegen,
	mitgliedDeaktivieren,
	mitgliederZaehlen,
	mitgliedUmbenennen,
} from '../src/lib/server/db/queries/members.ts';
/*
 * Die Dienstplan-Schicht aus Story 3.1. Sie kommt als **Wert** herein und wird
 * ausgeführt, nicht beschrieben: dass eine beendete Person als unbesetzt
 * erscheint und ihr Datensatz trotzdem stehenbleibt, ist keine Zusage der
 * Oberfläche, sondern eine der Abfrage.
 */
import {
	dienstwocheBesetzen,
	dienstwochenLesen,
	eigeneDienstwoche,
} from '../src/lib/server/db/queries/duty-weeks.ts';
import {
	aufgabenStapelAnlegen,
	offeneAufgabenAuflisten,
} from '../src/lib/server/db/queries/tasks.ts';
import { tokenErzeugen, tokenHashen } from '../src/lib/server/token.ts';
/*
 * Aus zeit.ts kommen seit Story 2.2 fünf Werte herein, und zwei davon sind
 * Grössen und keine Funktionen: die Schwelle und die Woche. Die Zeilen der
 * Überfälligkeitsmatrix werden **relativ zu ihnen** gesät, und der Tag wird aus
 * der Woche gerechnet. Eine 21 oder eine 604800 im Prüfskript wäre eine zweite
 * Wahrheit über dieselbe Produktentscheidung — und eine Prüfliste, die grün
 * bleibt, wenn jemand die Schwelle in zeit.ts verschiebt, prüfte die falsche
 * Zusage.
 */
import {
	FRIST_FENSTER_TAGE,
	fristfenster,
	isoWocheVon,
	istImFristfenster,
	istWoche,
	monatsendeAlsFeldwert,
	montagDerWoche,
	tagesendeInUnixSekunden,
	UEBERFAELLIG_SEKUNDEN,
	WOCHE_SEKUNDEN,
	wochenOffenSeit,
	wochendatum,
	wochenfenster,
	wochenImJahr,
	wochenSchluessel,
} from '../src/lib/zeit.ts';
/*
 * zeilenErkennen kommt als **Wert** herein und nicht nur als Text: die Zahl
 * unter dem Textfeld auf /monatsplan ist eine Zusage der Akzeptanzkriterien
 * (`24 Aufgaben erkannt` bei 27 Zeilen, davon drei leeren), und die einzige
 * Stelle, an der sie ohne einen Browser ausführbar zu belegen ist, ist die
 * Funktion selbst. Textlich geprüft wird daneben, dass Zähler und action
 * wirklich diese Funktion rufen.
 */
import { zeilenErkennen } from '../src/lib/aufgabentext.ts';
/*
 * Die Namensregel kommt als **Wert** herein und nicht als abgeschriebener Satz.
 *
 * Seit Story 3.0.1 hat sie drei Leser — die actions aufnehmen und umbenennen auf
 * /verwaltung und scripts/create-admin.ts —, und die Zusage lautet nicht „dieser
 * Wortlaut", sondern „alle drei werfen dieselbe Regel". Ein NAME_FEHLT als
 * Literal in diesem Skript wäre die vierte Kopie und bliebe grün, wenn eine der
 * drei Wurfstellen sich vom Modul löste. Die Grenze steht aus demselben Grund
 * nicht als 81 im Skript: sie wird aus NAME_HOECHSTLAENGE gerechnet.
 */
import { NAME_FEHLT, NAME_HOECHSTLAENGE, NAME_ZU_LANG } from '../src/lib/mitgliedsname.ts';
import {
	AUFGABE_NICHT_ANSPRECHBAR,
	DATUM_FEHLT,
	EIGENER_ZUGANG_GESCHUETZT,
	FRIST_AUSSERHALB,
	KEIN_ZUGANG,
	MITGLIED_NICHT_ANSPRECHBAR,
	NICHT_GEFUNDEN,
	UNERWARTETER_FEHLER,
	WOCHE_NICHT_ANSPRECHBAR,
} from '../src/lib/texte.ts';
import { handle, handleError, startPruefen } from '../src/hooks.server.ts';

/**
 * So viele Behauptungen muss ein vollständiger Lauf ablegen, die Schlusszählung
 * selbst nicht mitgerechnet. Die Zahl ist Absicht und kein Zierrat: eine
 * Behauptung, die in einem `if` stillschweigend ausfällt, hinterlässt sonst
 * keine Spur, und das Skript meldete weiter grün mit weniger Deckung.
 * Wer eine Behauptung hinzufügt oder entfernt, zieht die Zahl mit.
 */
const ERWARTETE_BEHAUPTUNGEN = 495;

const HERKUNFT = 'https://garten.example.ch';
const EIN_JAHR = 60 * 60 * 24 * 365;
const GUTES_GEHEIMNIS = 'smoke-geheimnis-mit-genug-verschiedenen-zeichen-0123456789';

const wurzel = fileURLToPath(new URL('..', import.meta.url));
// migrationsFolder ist arbeitsverzeichnisrelativ; das Skript darf von überall
// aufgerufen werden.
process.chdir(wurzel);

const arbeit = wegwerfVerzeichnis('gartenplaner-smoke-');
process.env.DATABASE_PATH = join(arbeit, 'smoke.sqlite');
process.env.SESSION_SECRET = GUTES_GEHEIMNIS;
process.env.ORIGIN = HERKUNFT;

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
	 *   mit multipart-Formulardaten. Ein Wert darf ein Blob sein: nur so lässt
	 *   sich der Fall „das Feld ist da, ist aber kein String" überhaupt
	 *   ausführen — ein Datei-Upload auf ein Textfeld.
	 *
	 * Ohne den dritten Parameter baute diese Attrappe nur `new Request(this.url)`
	 * — ohne Methode und ohne Rumpf. Eine form action, die `await
	 * request.formData()` ruft, bekäme darauf eine leere Menge und wäre nicht
	 * von einer geprüft, sondern nur ausgeführt. Der Rumpf entsteht aus einem
	 * echten FormData, damit ihn `request.formData()` auch wirklich parst.
	 */
	constructor(pfad: string, keks?: string, formular?: Record<string, string | Blob>) {
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

	/*
	 * Derselbe Cast für die load-Funktionen, die ein ServerLoadEvent deklarieren.
	 * Er geht ebenfalls über unknown, und die Aussage darin ist dieselbe: parent,
	 * depends und untrack fehlen dieser Attrappe, und behauptet wird damit, dass
	 * keine load sie braucht. Ruft eine sie je doch, bricht der Aufruf mit einem
	 * TypeError, und der Rahmen unten macht daraus eine benannte Verletzung.
	 */
	alsServerLoadEvent(): ServerLoadEvent {
		return this as unknown as ServerLoadEvent;
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

/*
 * Die Startseite aus Story 1.4. Ihre load nimmt seit Story 1.5 ein Ereignis und
 * deklariert dafür ein ServerLoadEvent — der Typ hier sagt dasselbe, nicht ein
 * RequestEvent, das eine andere Form hat.
 *
 * Dass sie daraus **allein die Adresse** liest, war bis Story 1.5 durch die
 * Signatur belegt: sie nahm gar kein Ereignis. Dieser Beleg ist mit der
 * Verbreiterung verlorengegangen und steht jetzt als eigene, ausgeführte
 * Behauptung unten — mit einem Ereignis, dessen locals und cookies beim Lesen
 * werfen.
 */
type StartseitenModul = {
	load: (ereignis: ServerLoadEvent) => unknown;
	actions: Record<string, Aktion>;
};
let startseitenModul: StartseitenModul | null = null;

async function startseiteLaden(): Promise<StartseitenModul> {
	startseitenModul ??=
		(await import('../src/routes/+page.server.ts')) as unknown as StartseitenModul;
	return startseitenModul;
}

/*
 * Der Dienstplan aus Story 3.1. Er hat beides: eine load, die jedes aktive
 * Mitglied lesen darf, und **eine** action hinter der Adminschranke.
 */
type DienstplanModul = {
	load: (ereignis: ServerLoadEvent) => unknown;
	actions: Record<string, Aktion>;
};
let dienstplanModul: DienstplanModul | null = null;

async function dienstplanLaden(): Promise<DienstplanModul> {
	dienstplanModul ??=
		(await import('../src/routes/dienstplan/+page.server.ts')) as unknown as DienstplanModul;
	return dienstplanModul;
}

/*
 * Die Erfassenseite aus Story 1.5. Sie hat **keine** load — die Seite zeigt ein
 * leeres Feld und hat nichts zu laden —, und der Typ hier sagt das mit: fügt
 * jemand eine load hinzu, ohne sie zu prüfen, fällt das hier auf.
 */
type AufgabeModul = { actions: Record<string, Aktion> };
let aufgabeModul: AufgabeModul | null = null;

async function aufgabeLaden(): Promise<AufgabeModul> {
	aufgabeModul ??=
		(await import('../src/routes/aufgabe/+page.server.ts')) as unknown as AufgabeModul;
	return aufgabeModul;
}

/*
 * Die Massen-Eingabe aus Story 2.1. Anders als /aufgabe bringt sie eine load
 * mit — sie gibt die Vorbelegung des Datumsfeldes —, und die nimmt **kein**
 * Ereignis: sie liest weder locals noch cookies noch die Adresse.
 *
 * Der Typ hier belegt das **nicht**. `as unknown as MonatsplanModul` löscht jede
 * Beziehung zum echten Modul; er beschreibt, wie dieses Skript das Modul
 * benutzt, und nicht, wie das Modul aussieht. Was trägt, ist der Aufruf weiter
 * unten: `monatsplan.load()` fährt **ohne Argument**. Fordert die load je ein
 * Ereignis, greift sie auf `undefined` zu und wirft — und der Rahmen unten macht
 * daraus eine benannte Verletzung statt eines stillen Durchlaufs.
 */
type MonatsplanModul = {
	load: () => unknown;
	actions: Record<string, Aktion>;
};
let monatsplanModul: MonatsplanModul | null = null;

async function monatsplanLaden(): Promise<MonatsplanModul> {
	monatsplanModul ??=
		(await import('../src/routes/monatsplan/+page.server.ts')) as unknown as MonatsplanModul;
	return monatsplanModul;
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
	formular?: Record<string, string | Blob>
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

/**
 * Legt eine Aufgabe an — mit **ausdrücklichem** created_at.
 *
 * Direkt über Drizzle und nicht über die Repository-Funktion aufgabeAnlegen,
 * die es seit Story 1.5 gibt: die nimmt **kein** created_at entgegen, weil der
 * Zeitstempel dort aus dem Schema kommt ($defaultFn). Genau das braucht diese
 * Hilfe aber. Gate-Regel 9 verbietet den direkten Zugriff nur unter src/routes/.
 *
 * Der Zeitstempel steht hier statt aus $defaultFn zu kommen, damit die
 * Reihenfolge der Liste prüfbar ist: die drei Aufgaben werden **nicht** in der
 * Reihenfolge ihres created_at eingefügt. Ohne das liesse sich „älteste zuerst"
 * nicht von „nach Id" unterscheiden, und eine Sortierung nach der Id wäre grün.
 *
 * `dueAt` ist optional, weil eine vor Ort erfasste Aufgabe keine Frist hat —
 * genau die Lücke, die Story 2.2 mit COALESCE(due_at, created_at) abfängt. Wer
 * eine Planaufgabe säen will, gibt den dritten Wert mit.
 */
function aufgabeSaen(text: string, createdAt: number, dueAt?: number): number {
	return datenbank()
		.insert(tasks)
		.values({ text, createdAt, dueAt } satisfies NewTask)
		.returning({ id: tasks.id })
		.get().id;
}

/** Die vollständige Aufgabenzeile als Zeichenkette — samt Erledigt-Spalten. */
function aufgabenAbdruck(id: number): string {
	const zeile = datenbank().select().from(tasks).where(eq(tasks.id, id)).get();
	return JSON.stringify(zeile ?? null);
}

/** Die vollständige Aufgabe zu einer Id, oder null. */
function aufgabeLesen(id: number) {
	return datenbank().select().from(tasks).where(eq(tasks.id, id)).get() ?? null;
}

/**
 * Steht in diesen Daten irgendwo eine Erledigt-Spalte?
 *
 * Gesucht wird nach dem **Feldnamen**, nicht nach einem Wert: completed_by ist
 * bei einer offenen Aufgabe null, und eine Projektion, die das Feld aufnimmt,
 * fiele bei einer Wertsuche nicht auf — sie würde erst dann auffallen, wenn
 * wirklich jemand abgehakt hat und die Zeile trotzdem noch in der Liste steht.
 * AD-5 verbietet die Zuordnung und nicht bloss ihren sichtbaren Wert.
 */
function nenntErledigt(daten: unknown): boolean {
	return /completed/i.test(JSON.stringify(daten));
}

/**
 * Die Ids der offenen Aufgaben in der Reihenfolge, in der die load sie liefert.
 *
 * `nurIds` schneidet die Antwort auf die Zeilen zu, die der fragende Block
 * **selbst gesät** hat. Ohne diesen Filter sagt jede Reihenfolgebehauptung
 * etwas über den ganzen Tabelleninhalt zu, und das ist mehr, als sie meint:
 * ein späterer Block, der Aufgaben mit älterem created_at anlegt, stellt sie
 * vor alles Frühere und macht die festen Id-Ketten rot, ohne dass an der
 * Sortierung etwas falsch wäre. Genau das tut der Story-2.2-Block mit seinen
 * bis zu 60 Tage alten Zeitstempeln; er filtert aus demselben Grund über
 * `gesaeteIds`, und seit dieser Fassung tun es die älteren Ketten auch.
 *
 * Zugesagt ist damit die **relative** Reihenfolge der eigenen Zeilen. Dass eine
 * fremde dazwischensteht, ist keine gebrochene Zusage — dass eine eigene fehlt
 * oder an falscher Stelle steht, weiterhin schon.
 */
function offeneReihenfolge(
	ausgang: Routenausgang,
	nurIds?: readonly (number | undefined)[]
): string {
	const zeilen = (wertVon(ausgang).aufgaben ?? []) as { id: number }[];
	const eigene = nurIds === undefined ? null : new Set(nurIds);
	return zeilen
		.map((zeile) => zeile.id)
		.filter((id) => eigene === null || eigene.has(id))
		.join(' | ');
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
	// Der fehlende-Verzeichnis-Zweig — und zwar vor allem anderen
	// -----------------------------------------------------------------------
	/*
	 * src/lib/server/db/index.ts prüft mit existsSync, ob das Verzeichnis der
	 * Datenbank da ist, und wirft sonst mit dem Verzeichnis im Text. Auf genau
	 * diesem Zweig ruht die /data/db-Konstruktion des Betriebsstapels: das
	 * Named Volume hängt auf /data, die Datei liegt unter /data/db/db.sqlite,
	 * und ein verlorenes Volume lässt /data/db fehlen. Der Container endet dann
	 * laut, statt still eine leere Datenbank anzulegen und der Gemeinschaft
	 * `Nichts offen.` ohne jeden Hinweis auf den Datenverlust zu zeigen.
	 *
	 * Gedeckt hat das bis hierher nichts: jeder DATABASE_PATH dieses Skripts
	 * zeigt in ein vorhandenes Verzeichnis, der Zweig wurde nie betreten. Wer
	 * den Wächter durch ein mkdirSync(…, { recursive: true }) ersetzte, bekam
	 * grünes lint, grünes check — und den stillen Leerstart zurück.
	 *
	 * Diese Behauptung steht **vor** datenschichtStarten() und muss dort
	 * bleiben. Die Schicht merkt sich ihre Verbindung, ein zweiter Aufruf tut
	 * nichts; nach dem ersten erfolgreichen Start ist dieser Zweig im selben
	 * Prozess nicht mehr auszulösen. Das ist kein stilles Risiko: rutscht die
	 * Behauptung je dahinter, wirft startPruefen nicht mehr und sie wird rot.
	 */
	{
		const gemerkterPfad = process.env.DATABASE_PATH;
		const fehlendesVerzeichnis = join(arbeit, 'kein-solches-verzeichnis');
		process.env.DATABASE_PATH = join(fehlendesVerzeichnis, 'db.sqlite');
		let fehlendMeldung: string | null = null;
		try {
			startPruefen();
		} catch (fehler) {
			fehlendMeldung = fehler instanceof Error ? fehler.message : String(fehler);
		}
		process.env.DATABASE_PATH = gemerkterPfad;
		pruefen(
			'startPruefen wirft, wenn das Verzeichnis der Datenbank fehlt, und nennt das Verzeichnis',
			fehlendMeldung !== null && fehlendMeldung.includes(fehlendesVerzeichnis),
			fehlendMeldung ?? 'kein Wurf — der existsSync-Wächter in db/index.ts greift nicht mehr'
		);
	}

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

	// DATABASE_PATH fehlt in dieser Aufzählung mit Absicht: sein Fehlen und sein
	// Zeigen ins Leere sind beide geprüft, aber weiter oben — die Datenschicht
	// merkt sich ihre Verbindung und wirft hier unten nicht mehr.
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
		laufOhneNamen.status === 1 && laufOhneNamen.stderr.includes(NAME_FEHLT),
		`Status ${laufOhneNamen.status}, stderr ${JSON.stringify(laufOhneNamen.stderr)}`
	);
	pruefenGleich(
		'create-admin ohne Namen legt keine Datenbankdatei an',
		readdirSync(ohneNamen).length,
		0
	);
	rmSync(ohneNamen, { recursive: true, force: true });

	/*
	 * Die zwei Namen, die das Skript bis Story 3.0.1 **durchliess**.
	 *
	 * Es prüfte mit einer eigenen Kette — `.replace(/\s+/g, ' ').trim()` und ein
	 * Vergleich auf die leere Zeichenkette —, also ohne Nullbreiten-Sieb und ohne
	 * Längengrenze. Ein Name aus reinen Nullbreiten-Zeichen legte damit das erste,
	 * einzige und mit Adminrechten ausgestattete Mitglied als leere Lücke an; die
	 * Oberfläche wies denselben Namen seit Story 1.3 ab. Das ist der ausgeführte
	 * Beweis dafür, dass die Regel ein geteiltes Modul sein muss.
	 *
	 * Behauptet wird zugleich die Reihenfolge: der Abbruch fällt **vor**
	 * datenschichtStarten, es entsteht also keine Datei. Ohne diese Hälfte bliebe
	 * eine Prüfung, die erst nach dem Anlegen der Datenbank abwiese, grün.
	 */
	for (const [wie, argument, satz] of [
		['aus Nullbreiten-Zeichen', '\u200B\u200C\u200D\u2060\uFEFF', NAME_FEHLT],
		['über 80 Zeichen', 'A'.repeat(NAME_HOECHSTLAENGE + 1), NAME_ZU_LANG],
	] as const) {
		const verzeichnis = wegwerfVerzeichnis('gartenplaner-smoke-name-');
		const lauf = starten(['scripts/create-admin.ts', argument], {
			...process.env,
			DATABASE_PATH: join(verzeichnis, 'db.sqlite'),
			ORIGIN: HERKUNFT,
		});
		pruefen(
			`create-admin weist einen Namen ${wie} ab, bevor die Datenschicht startet`,
			lauf.status === 1 && lauf.stderr.includes(satz) && readdirSync(verzeichnis).length === 0,
			`Status ${lauf.status}, ${readdirSync(verzeichnis).length} Datei(en), stderr ${JSON.stringify(lauf.stderr.slice(0, 120))}`
		);
		rmSync(verzeichnis, { recursive: true, force: true });
	}

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
	// Die Adminschranke: load und alle vier actions
	// -----------------------------------------------------------------------
	const vorSchranke = mitgliederZaehlen();
	const veraVorSchranke = zeileAbdruck(vera.id);

	wegGeleitet(
		'Nicht-Admin auf die load von /verwaltung: 303 auf /',
		await routenausgang(() =>
			verwaltung.load(alsMitglied('/verwaltung', nicoLocals).alsRequestEvent())
		)
	);

	for (const aktion of ['aufnehmen', 'neuAusstellen', 'widerrufen', 'umbenennen'] as const) {
		// Die Formulardaten sind vollständig und gültig: was hier abgewiesen
		// wird, ist allein die fehlende Adminschaft. Ohne adminOderWeg in dieser
		// action entstünde ein Mitglied beziehungsweise änderte sich eine Zeile.
		wegGeleitet(
			`Nicht-Admin auf die action ${aktion}: 303 auf /`,
			await routenausgang(() =>
				verwaltung.actions[aktion](
					alsMitglied('/verwaltung', nicoLocals, {
						name: 'Eve Eindringling',
						neuerName: 'Eve Eindringling',
						mitgliedId: String(vera.id),
					}).alsRequestEvent()
				)
			)
		);
	}

	pruefenGleich(
		'die fünf abgewiesenen Aufrufe haben kein Mitglied angelegt',
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
		textFeld(datenVon(leererName), 'eingabe'),
		'   '
	);

	/*
	 * Namen, die trim() besteht und die trotzdem keiner sind.
	 *
	 * Nullbreiten-Zeichen haben keine Breite und sind für trim() kein Leerraum:
	 * ein Name aus ihnen legte eine Zeile ohne lesbaren Namen an, mit einem
	 * lebenden Einladungslink und ohne jede Aussage, wer das ist. Seit Story 3.0.1
	 * gibt es dafür ein Umbenennen; endgültig ist der Fehler damit nicht mehr,
	 * aber er stünde bis zu seiner Entdeckung im Dienstplan vor allen.
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
	// Umbenennen: ein anderer Name, derselbe Zugang — Story 3.0.1
	// -----------------------------------------------------------------------
	/*
	 * Die Zeile wird **gelesen**, bevor und nachdem sie umbenannt wird, und zwar
	 * vollständig samt Hash. Die Zusage der Story ist nicht „der Name ändert
	 * sich", sondern „nur der Name ändert sich": ein Umbenennen, das den Zugang
	 * neu ausstellte oder die Zeile ersetzte, nähme der Person ab Story 3.1 alle
	 * künftigen Dienstwochen — genau der Umweg, für den es diese action gibt.
	 */
	const zita = mitgliedAnlegen({
		name: 'Zita Achermann',
		inviteTokenHash: tokenHashen(tokenErzeugen()),
		isAdmin: false,
	});
	const zitaVorher = datenbank().select().from(members).where(eq(members.id, zita.id)).get();

	/**
	 * Die Namen einer frisch geladenen Liste in ihrer Reihenfolge, und der Platz
	 * einer **Id** darin.
	 *
	 * Über die Id und nicht über den Namen: auf `name` gibt es ausdrücklich keine
	 * Eindeutigkeitsbedingung, zwei Mitglieder dürfen gleich heissen. Eine Suche
	 * über den Namen fände dann die falsche Zeile — und ausgerechnet diese
	 * Behauptung dreht sich um einen Namen, der sich ändert.
	 */
	const listeLaden = async (): Promise<{ id: number; name: string; isActive: boolean }[]> => {
		const geladen = wertVon(
			await routenausgang(() =>
				verwaltung.load(alsMitglied('/verwaltung', veraLocals).alsRequestEvent())
			)
		);
		return (geladen.mitglieder ?? []) as { id: number; name: string; isActive: boolean }[];
	};
	const platzInDerListe = async (id: number): Promise<number> =>
		(await listeLaden()).findIndex((reihe) => reihe.id === id);

	const platzVorUmbenennen = await platzInDerListe(zita.id);
	const umbenannt = await routenausgang(() =>
		verwaltung.actions.umbenennen(
			alsMitglied('/verwaltung', veraLocals, {
				mitgliedId: String(zita.id),
				neuerName: '  Anna   Meier ',
			}).alsRequestEvent()
		)
	);
	pruefenGleich(
		'umbenennen gelingt und gibt den gefalteten Namen zurück',
		umbenannt.art === 'wert' ? textFeld(wertVon(umbenannt), 'name') : `Ausgang ${umbenannt.art}`,
		'Anna Meier'
	);

	const zitaNachher = datenbank().select().from(members).where(eq(members.id, zita.id)).get();
	pruefenGleich('der neue Name steht in der Zeile', zitaNachher?.name, 'Anna Meier');
	/*
	 * Alles ausser dem Namen, als ein Abdruck. Ein Feld einzeln zu behaupten
	 * liesse jedes künftige Feld still durchrutschen; `ohneNamen` nimmt darum die
	 * ganze Zeile und schneidet genau die eine Spalte heraus, die sich ändern
	 * darf.
	 */
	const ohneNamensspalte = (zeile: typeof zitaVorher) =>
		JSON.stringify({ ...(zeile ?? {}), name: '(egal)' });
	pruefenGleich(
		'Id, Hash, Adminrecht, Aktivsein und Aufnahmezeitpunkt bleiben unberührt',
		ohneNamensspalte(zitaNachher),
		ohneNamensspalte(zitaVorher)
	);

	/*
	 * Die Liste sortiert nach Namen (de-CH), also verschiebt ein Umbenennen die
	 * Zeile.
	 *
	 * Behauptet wird **zweierlei zugleich und keine Richtung**: der Platz hat sich
	 * geändert, und die aktive Gruppe steht danach vollständig in der Ordnung von
	 * de-CH. Eine festgeschriebene Richtung („der Platz wird kleiner") hinge an
	 * der Saat: benennte jemand die Zeile in einen Namen um, der sie auf ihrem
	 * Platz liesse, wäre die Behauptung rot, obwohl das Umbenennen stimmt. Und die
	 * Bewegung allein wäre zu schwach — eine Liste, die irgendwie umsortiert,
	 * erfüllte sie auch.
	 */
	const listeNachUmbenennen = await listeLaden();
	const platzNachUmbenennen = listeNachUmbenennen.findIndex((reihe) => reihe.id === zita.id);
	const aktiveNachUmbenennen = listeNachUmbenennen
		.filter((reihe) => reihe.isActive)
		.map((reihe) => reihe.name);
	pruefen(
		'die Zeile steht danach an ihrer neuen alphabetischen Stelle',
		platzVorUmbenennen >= 0 &&
			platzNachUmbenennen >= 0 &&
			platzNachUmbenennen !== platzVorUmbenennen &&
			aktiveNachUmbenennen.join(' | ') ===
				[...aktiveNachUmbenennen].sort(new Intl.Collator('de-CH').compare).join(' | '),
		`vorher ${platzVorUmbenennen}, nachher ${platzNachUmbenennen}, Folge ${aktiveNachUmbenennen.join(' | ')}`
	);

	/*
	 * Die eigene Zeile. Anders als bei neuAusstellen und widerrufen ist das
	 * **erlaubt**: ein Name ist kein Zugang, ein Selbst-Umbenennen sperrt
	 * niemanden aus, und es gibt genau eine Adminperson, die es sonst täte.
	 *
	 * Dafür steht hier eine **eigene** Adminperson und nicht Vera. Ein
	 * Selbstumbenennen von Vera machte veraLocals veraltet — die Attrappe trüge
	 * weiter den alten Namen, während die Datenbank den neuen führt —, und die
	 * Behauptung über /mehr weiter unten läse dann ihre eigene Vorbereitung statt
	 * des echten Zustands. Genau die Reihenfolgefalle, vor der die
	 * Epic-3-Vorbereitung warnt.
	 */
	const selma = mitgliedAnlegen({
		name: 'Selma Widmer',
		inviteTokenHash: tokenHashen(tokenErzeugen()),
		isAdmin: true,
	});
	const selbstUmbenannt = await routenausgang(() =>
		verwaltung.actions.umbenennen(
			alsMitglied('/verwaltung', ohneTokenHash(selma), {
				mitgliedId: String(selma.id),
				neuerName: 'Selma Brunner',
			}).alsRequestEvent()
		)
	);
	pruefen(
		'umbenennen auf die eigene Zeile gelingt — kein EIGENER_ZUGANG_GESCHUETZT',
		selbstUmbenannt.art === 'wert' &&
			textFeld(wertVon(selbstUmbenannt), 'name') === 'Selma Brunner' &&
			textFeld(datenVon(selbstUmbenannt), 'meldung') !== EIGENER_ZUGANG_GESCHUETZT,
		`Ausgang ${selbstUmbenannt.art}: ${JSON.stringify(datenVon(selbstUmbenannt))}`
	);
	pruefenGleich(
		'und die eigene Zeile trägt den neuen Namen',
		datenbank().select().from(members).where(eq(members.id, selma.id)).get()?.name,
		'Selma Brunner'
	);

	// Derselbe Name noch einmal: ein Erfolg und keine Abweisung. Die Person hat
	// bekommen, was sie wollte; eine Meldung wäre die Aufforderung, etwas zu
	// ändern, das schon stimmt.
	const unveraendert = await routenausgang(() =>
		verwaltung.actions.umbenennen(
			alsMitglied('/verwaltung', veraLocals, {
				mitgliedId: String(zita.id),
				neuerName: 'Anna Meier',
			}).alsRequestEvent()
		)
	);
	pruefen(
		'ein unveränderter Name ist ein Erfolg, keine Abweisung',
		unveraendert.art === 'wert' && textFeld(wertVon(unveraendert), 'name') === 'Anna Meier',
		`Ausgang ${unveraendert.art}`
	);

	/*
	 * Die drei Namen, die keine sind — dieselbe Regel wie bei aufnehmen, weil es
	 * dieselbe Funktion ist. Behauptet wird jedes Mal die Marke `neuerName` und
	 * nicht bloss der Satz: `name` gehört dem Aufnahmeformular, und unter einer
	 * gemeinsamen Marke trüge die Aufnahme die Kante und den verworfenen Namen.
	 */
	for (const [wie, eingabe, satz] of [
		['aus Leerzeichen', '   ', NAME_FEHLT],
		['aus Nullbreiten-Zeichen', '\u200B\u200C\u200D\u2060\uFEFF', NAME_FEHLT],
		['über 80 Zeichen', 'A'.repeat(NAME_HOECHSTLAENGE + 1), NAME_ZU_LANG],
	] as const) {
		const vorher = zeileAbdruck(zita.id);
		const ausgang = await routenausgang(() =>
			verwaltung.actions.umbenennen(
				alsMitglied('/verwaltung', veraLocals, {
					mitgliedId: String(zita.id),
					neuerName: eingabe,
				}).alsRequestEvent()
			)
		);
		pruefen(
			`ein neuer Name ${wie} wird mit 400 am Feld neuerName abgewiesen`,
			ausgang.art === 'fehlschlag' &&
				ausgang.status === 400 &&
				ausgang.daten.feld === 'neuerName' &&
				ausgang.daten.meldung === satz,
			`Ausgang ${ausgang.art}: ${JSON.stringify(datenVon(ausgang))}`
		);
		pruefenGleich(
			`ein neuer Name ${wie} lässt die Zeile unverändert`,
			zeileAbdruck(zita.id),
			vorher
		);
		pruefenGleich(
			`ein neuer Name ${wie} kommt unverändert zum Feld zurück`,
			textFeld(datenVon(ausgang), 'eingabe'),
			eingabe
		);
		/*
		 * **Die Zeile kommt vom Server**, nicht aus einem Client-Zustand.
		 *
		 * Ohne sie wäre die Zuordnung an JavaScript gebunden: der Rückruf müsste
		 * die mitgliedId aus dem formData lesen, und ohne JavaScript läuft kein
		 * Rückruf. Das Feld zeigte dann wieder den alten Namen, das Formular wäre
		 * zu, aria-invalid fehlte und der Fokus spränge in eine leere Region —
		 * belegt, und der Grund für das vierte Argument von abweisen.
		 */
		pruefenGleich(
			`ein neuer Name ${wie} nennt die abgewiesene Zeile`,
			datenVon(ausgang).zeile,
			zita.id
		);
	}

	/*
	 * **Beides ungültig zugleich** — die Id nicht ansprechbar und der Name leer.
	 *
	 * Das ist der Beleg für die Reihenfolge Id-vor-Name in der action, und ohne
	 * ihn deckt sie keine Behauptung. Umgedreht wäre der Ausgang `feld:
	 * 'neuerName'` mit einer Zeile, die es nicht gibt: die Oberfläche fände keine,
	 * an der sie den Satz anbringen könnte, und die abgewiesene Eingabe
	 * verschwände spurlos. Der Satz über das nicht ansprechbare Mitglied gehört
	 * nach oben, ohne Feld und ohne Zeile.
	 */
	for (const [wie, mitgliedId] of [
		['nicht numerisch', 'abc'],
		['unbekannt', '999999'],
		['schon beendet', String(emmaId)],
	] as const) {
		const beidesFalsch = await routenausgang(() =>
			verwaltung.actions.umbenennen(
				alsMitglied('/verwaltung', veraLocals, {
					mitgliedId,
					neuerName: '   ',
				}).alsRequestEvent()
			)
		);
		pruefen(
			`Id ${wie} und Name leer zugleich: die Zeile gewinnt, ohne Feld und ohne Zeile`,
			beidesFalsch.art === 'fehlschlag' &&
				beidesFalsch.daten.meldung === MITGLIED_NICHT_ANSPRECHBAR &&
				beidesFalsch.daten.feld === null &&
				beidesFalsch.daten.zeile === null,
			`Ausgang ${beidesFalsch.art}: ${JSON.stringify(datenVon(beidesFalsch))}`
		);
	}

	/*
	 * **Die Bedingung im UPDATE selbst**, an der Repository-Funktion gemessen.
	 *
	 * Die Route fragt seit dem Review vorher, ob die Zeile ansprechbar ist, und
	 * fängt damit jede Abweisung ab, die über eine action liefe: über sie ist die
	 * Bedingung `is_active = 1` im UPDATE nicht mehr erreichbar. Gemessen — nach
	 * dem Einbau der Vorprüfung blieb die ganze Kette grün, als die Bedingung aus
	 * mitgliedUmbenennen entfernt wurde.
	 *
	 * Sie steht trotzdem dort, und diese Behauptung ist ihr Nachweis: die
	 * Vorprüfung entscheidet, **welchen Satz** die Person liest, die Bedingung im
	 * UPDATE, **ob** geschrieben wird. Zwischen beiden liegt ein Fenster, in dem
	 * ein Widerruf laufen kann — und dann darf kein Name mehr in eine beendete
	 * Zeile geschrieben werden. Der eingefrorene Block verlangt die Bedingung
	 * ausdrücklich in der Query und nicht in der Route.
	 */
	const emmaVorSchreibversuch = zeileAbdruck(emmaId);
	pruefenGleich(
		'mitgliedUmbenennen trifft eine beendete Zeile nicht — is_active = 1 steht im UPDATE',
		mitgliedUmbenennen(emmaId, 'Emma Neu'),
		null
	);
	pruefenGleich(
		'und die beendete Zeile ist danach unverändert',
		zeileAbdruck(emmaId),
		emmaVorSchreibversuch
	);

	// Und die Grenze selbst: genau 80 Zeichen gehen durch, 81 nicht.
	const genauAchtzigNeu = await routenausgang(() =>
		verwaltung.actions.umbenennen(
			alsMitglied('/verwaltung', veraLocals, {
				mitgliedId: String(zita.id),
				neuerName: 'E'.repeat(NAME_HOECHSTLAENGE),
			}).alsRequestEvent()
		)
	);
	pruefen(
		'genau 80 Zeichen werden auch beim Umbenennen angenommen',
		genauAchtzigNeu.art === 'wert' &&
			textFeld(wertVon(genauAchtzigNeu), 'name').length === NAME_HOECHSTLAENGE,
		`Ausgang ${genauAchtzigNeu.art}`
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
	const felder = new Set<string>();
	/*
	 * `neuerName` steht in **jedem** Formular dieser Schleife, auch dort, wo die
	 * action ihn gar nicht liest. Ohne ihn führe umbenennen bei einer beendeten
	 * Zeile in den Namensfehler statt in den, den diese Schleife prüft — und die
	 * Behauptung läse dann ihre eigene Vorbereitung.
	 */
	for (const [wie, formular] of [
		['unbekannt', { mitgliedId: '999999' }],
		['fehlend', {}],
		['nicht numerisch', { mitgliedId: 'abc' }],
		['schon beendet', { mitgliedId: String(emmaId) }],
	] as const) {
		for (const aktion of ['widerrufen', 'neuAusstellen', 'umbenennen'] as const) {
			const ausgang = await routenausgang(() =>
				verwaltung.actions[aktion](
					alsMitglied('/verwaltung', veraLocals, {
						...formular,
						neuerName: 'Ein tadelloser Name',
					}).alsRequestEvent()
				)
			);
			abgewiesen(`${aktion}, mitgliedId ${wie}`, ausgang, MITGLIED_NICHT_ANSPRECHBAR);
			saetze.add(textFeld(datenVon(ausgang), 'meldung'));
			// Ohne Feld: der Satz gehört in die Live-Region oben und nicht an ein
			// Namensfeld, das zu einer Zeile gehörte, die es womöglich nicht gibt.
			felder.add(JSON.stringify(datenVon(ausgang).feld ?? null));
		}
	}
	pruefen(
		'alle vier Zustände und alle drei actions tragen denselben Satz',
		saetze.size === 1,
		`${saetze.size} verschiedene Sätze`
	);
	pruefen(
		'und keiner von ihnen benennt ein Feld',
		felder.size === 1 && felder.has('null'),
		`Felder: ${JSON.stringify([...felder])}`
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

	/*
	 * **Die Attrappe muss mit der Datenbank übereinstimmen**, sonst liest die
	 * Behauptung darunter ihre eigene Vorbereitung.
	 *
	 * locals.mitglied ist hier ein Abzug, den der Wächter im echten Betrieb bei
	 * jedem Aufruf frisch legt — in diesem Skript aber einmal am Anfang. Benennt
	 * eine Behauptung dazwischen Vera um, führt veraLocals weiter den alten Namen,
	 * die Datenbank den neuen, und `mehrAlsAdmin.name === 'Vera'` bleibt grün,
	 * ohne noch etwas über den echten Zustand zu sagen. Genau die Reihenfolgefalle,
	 * vor der die Epic-3-Vorbereitung warnt; das Selbstumbenennen oben läuft
	 * deshalb auf einer eigenen Adminperson.
	 */
	pruefenGleich(
		'die Attrappe veraLocals führt denselben Namen wie die Datenbank',
		veraLocals.name,
		datenbank().select().from(members).where(eq(members.id, vera.id)).get()?.name
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

	// =======================================================================
	// / — Story 1.4: offene Aufgaben sehen und abhaken.
	//
	// Die Kernschleife, ausgeführt gegen dieselbe Datenbank. Geprüft wird die
	// Serverseite: load, beide actions und die Spalten danach. Was allein im
	// Browser lebt — die stehenbleibende Zeile, der Übergang, die Live-Region —
	// deckt keine Prüfung dieses Projekts; der Posten steht in
	// deferred-work.md. Die zwei Textprüfungen am Ende sind der schmale Ersatz
	// für die eine Zusage, die sonst nur an einem Argument hinge.
	// =======================================================================
	const startseite = await startseiteLaden();

	/*
	 * Die load von / an einer Adresse, als eine bestimmte Person.
	 *
	 * Seit Story 1.5 nimmt sie ein Ereignis, und der Pfad trägt eine Aussage:
	 * `?abgelegt` ist die Bestätigung, die eine Weiterleitung überlebt hat.
	 *
	 * **Seit Story 3.1 trägt das Ereignis ein locals.mitglied.** Bis dahin trug
	 * es ausdrücklich keines, und die Behauptung darunter belegte, dass die load
	 * es auch nicht anfasst. Der Diensthinweis ist personenbezogen und hat das
	 * gebrochen; was an seine Stelle getreten ist, steht ausführlich bei
	 * `dieselbeListeFuerAlle` weiter unten — die Aufgabenliste bleibt gemessen
	 * für alle dieselbe (AD-2), und `cookies` bleibt gemessen unberührt.
	 *
	 * Voreingestellt ist **Nico ohne Adminrechte**: die Startseite gehört allen,
	 * und eine Prüfliste, die sie gewohnheitsmässig als Adminperson lädt, prüfte
	 * den häufigen Fall nie.
	 */
	const startseiteLadenAn = (pfad: string, wer: AngemeldetesMitglied = nicoLocals) =>
		routenausgang(() => startseite.load(alsMitglied(pfad, wer).alsServerLoadEvent()));

	/*
	 * Drei Aufgaben, ausdrücklich **nicht** in der Reihenfolge ihres created_at
	 * eingefügt: die Ids laufen spaet < frueh < mittel, die Liste muss trotzdem
	 * frueh, mittel, spaet liefern. Eine Sortierung nach der Id wäre damit rot.
	 */
	const jetzt = Math.floor(Date.now() / 1000);
	const spaet = aufgabeSaen('Randen ernten, Beet 12', jetzt - 100);
	const frueh = aufgabeSaen('Beet 25 Nüsslisalat jäten', jetzt - 300);
	const mittel = aufgabeSaen('Tomaten ausgeizen, Beete 3 bis 7', jetzt - 200);
	/*
	 * Jede Reihenfolgebehauptung dieses Blocks fragt nur nach **diesen** Ids.
	 * Der Grund steht bei offeneReihenfolge: ein späterer Block mit älteren
	 * Zeitstempeln stellt sich sonst vor sie und macht sie rot, obwohl die
	 * Sortierung stimmt.
	 */
	const dreiGesaete = [frueh, mittel, spaet] as const;

	const erstesLaden = await startseiteLadenAn('/');
	pruefenGleich(
		'die load von / gibt die offenen Aufgaben, älteste zuerst',
		offeneReihenfolge(erstesLaden, dreiGesaete),
		`${frueh} | ${mittel} | ${spaet}`
	);
	/*
	 * **Die verhandelte Zusage, in zwei Hälften — und beide ausgeführt.**
	 *
	 * Bis Story 3.1 stand hier eine Behauptung: „die load von / liest aus dem
	 * Ereignis nur die Adresse — weder locals noch Cookies". Sie war ausgeführt
	 * und nicht behauptet — das Ereignis warf, sobald jemand eines der beiden
	 * Felder **anfasste** —, und sie ist mit dem Diensthinweis unhaltbar
	 * geworden: der ist personenbezogen, und die load liest locals.mitglied.
	 *
	 * Gestrichen ist sie deshalb **nicht**. Ihr Grund gilt weiter: läse die load
	 * die Identität und richtete die **Liste** danach, entstünde ein Weg, auf dem
	 * der Pool für zwei Personen verschieden aussähe — und der namenlose Pool ist
	 * genau das Gegenteil (AD-2). Was bleibt, ist die schärfere Fassung:
	 *
	 *   1. `cookies` bleibt unberührt — dasselbe werfende Feld, eine Hälfte
	 *      weniger;
	 *   2. zwei Aufrufe mit **verschiedenen** locals.mitglied geben eine
	 *      wortgleiche Aufgabenliste. Das ist mehr als die alte Behauptung sagte:
	 *      sie schloss von „liest die Identität nicht" auf „kann nicht
	 *      unterscheiden", diese misst das Ergebnis selbst.
	 */
	const abtasten = alsMitglied('/', nicoLocals);
	Object.defineProperty(abtasten, 'cookies', {
		configurable: true,
		get() {
			throw new Error('die load hat cookies gelesen');
		},
	});
	let angefasst = '';
	try {
		startseite.load(abtasten.alsServerLoadEvent());
	} catch (fehler) {
		angefasst = fehler instanceof Error ? fehler.message : String(fehler);
	}
	pruefen(
		'die load von / fasst die Cookies nicht an — die Sitzung ist Sache des Wächters',
		angefasst === '' && erstesLaden.art === 'wert',
		angefasst === '' ? `Ausgang ${erstesLaden.art}` : angefasst
	);

	/*
	 * Die zweite Hälfte. Sie steht hier und nicht erst im Dienstplan-Block,
	 * obwohl sie dessen Zusage mitträgt: sie gehört zur load von /, und wer diese
	 * Datei nach „AD-2" durchsieht, soll beide Hälften nebeneinander finden.
	 */
	const alsNico = wertVon(await startseiteLadenAn('/', nicoLocals));
	const alsVera = wertVon(await startseiteLadenAn('/', veraLocals));
	pruefen(
		'zwei Personen bekommen von / dieselbe Aufgabenliste — der Pool bleibt namenlos',
		JSON.stringify(alsNico.aufgaben) === JSON.stringify(alsVera.aufgaben),
		`${JSON.stringify(alsNico.aufgaben).slice(0, 120)} gegen ${JSON.stringify(alsVera.aufgaben).slice(0, 120)}`
	);
	pruefen(
		'die Seitendaten tragen weder completed_by noch completed_at',
		!nenntErledigt(wertVon(erstesLaden)),
		JSON.stringify(wertVon(erstesLaden)).slice(0, 160)
	);

	// -----------------------------------------------------------------------
	// Abhaken: jedes Mitglied darf jede Aufgabe (AD-2)
	// -----------------------------------------------------------------------
	/*
	 * Nico hakt ab, und Nico ist **kein** Admin. Das ist keine Beiläufigkeit:
	 * eine Adminschranke, die versehentlich auf dieser Seite landete, fiele in
	 * der Oberfläche nicht auf, weil dort für alle dasselbe Kästchen steht.
	 */
	const abgehakt = await routenausgang(() =>
		startseite.actions.abhaken(
			alsMitglied('/', nicoLocals, { aufgabeId: String(mittel) }).alsRequestEvent()
		)
	);
	pruefen(
		'abhaken gelingt für ein Mitglied ohne Adminrechte und nennt den Aufgabentext',
		abgehakt.art === 'wert' &&
			textFeld(wertVon(abgehakt), 'text') === 'Tomaten ausgeizen, Beete 3 bis 7',
		`Ausgang ${abgehakt.art}`
	);
	pruefen(
		'der Rückgabewert von abhaken trägt keine Erledigt-Spalte',
		!nenntErledigt(wertVon(abgehakt)),
		JSON.stringify(wertVon(abgehakt))
	);

	const mittelErledigt = aufgabeLesen(mittel);
	pruefenGleich('completed_by trägt die Id des Abhakenden', mittelErledigt?.completedBy, nico.id);
	pruefen(
		'completed_at steht in Unix-Sekunden und liegt bei jetzt',
		typeof mittelErledigt?.completedAt === 'number' &&
			mittelErledigt.completedAt >= jetzt &&
			mittelErledigt.completedAt < jetzt + 300,
		JSON.stringify(mittelErledigt?.completedAt)
	);

	const nachAbhaken = await startseiteLadenAn('/');
	pruefenGleich(
		'die abgehakte Zeile fehlt in einer frischen load — auch für alle anderen',
		offeneReihenfolge(nachAbhaken, dreiGesaete),
		`${frueh} | ${spaet}`
	);
	/*
	 * Und die Seitendaten nennen den Abhakenden auch danach nicht: weder als
	 * Feldnamen noch als Zeitstempel. Der Zeitstempel ist prüfbar, weil die drei
	 * created_at ausdrücklich in der Vergangenheit liegen und sich von
	 * completed_at unterscheiden — dasselbe Muster wie die Suche nach den
	 * Token-Hashes in der Liste von /verwaltung.
	 */
	pruefen(
		'auch nach dem Abhaken steht in den Seitendaten kein Erledigt-Wert',
		!nenntErledigt(wertVon(nachAbhaken)) &&
			!JSON.stringify(wertVon(nachAbhaken)).includes(String(mittelErledigt?.completedAt)),
		JSON.stringify(wertVon(nachAbhaken))
	);

	// -----------------------------------------------------------------------
	// Das Wettrennen: der erste gewinnt und bleibt gespeichert
	// -----------------------------------------------------------------------
	const aufgabenSaetze = new Set<string>();
	const mittelVorZweitem = aufgabenAbdruck(mittel);
	const zweitesAbhaken = await routenausgang(() =>
		startseite.actions.abhaken(
			alsMitglied('/', veraLocals, { aufgabeId: String(mittel) }).alsRequestEvent()
		)
	);
	abgewiesen(
		'ein zweites abhaken auf dieselbe Zeile wird abgewiesen',
		zweitesAbhaken,
		AUFGABE_NICHT_ANSPRECHBAR
	);
	aufgabenSaetze.add(textFeld(datenVon(zweitesAbhaken), 'meldung'));
	pruefenGleich(
		'und lässt den ersten Abhakenden unverändert',
		aufgabenAbdruck(mittel),
		mittelVorZweitem
	);

	// -----------------------------------------------------------------------
	// Wieder öffnen: auch eine fremde Zeile, ohne Zeitschranke
	// -----------------------------------------------------------------------
	const wiederGeoeffnet = await routenausgang(() =>
		startseite.actions.wiederOeffnen(
			alsMitglied('/', veraLocals, { aufgabeId: String(mittel) }).alsRequestEvent()
		)
	);
	pruefen(
		'wiederOeffnen gelingt — auch für jemanden, der nicht abgehakt hat',
		wiederGeoeffnet.art === 'wert',
		`Ausgang ${wiederGeoeffnet.art}`
	);
	const mittelWiederOffen = aufgabeLesen(mittel);
	pruefen(
		'completed_by und completed_at sind wieder leer',
		mittelWiederOffen?.completedBy === null && mittelWiederOffen?.completedAt === null,
		JSON.stringify(mittelWiederOffen)
	);
	pruefenGleich(
		'die Zeile steht danach wieder an ihrem Platz nach created_at',
		offeneReihenfolge(await startseiteLadenAn('/'), dreiGesaete),
		`${frueh} | ${mittel} | ${spaet}`
	);

	const fruehVorher = aufgabenAbdruck(frueh);
	const offeneGeoeffnet = await routenausgang(() =>
		startseite.actions.wiederOeffnen(
			alsMitglied('/', veraLocals, { aufgabeId: String(frueh) }).alsRequestEvent()
		)
	);
	abgewiesen(
		'wiederOeffnen auf eine offene Aufgabe wird abgewiesen',
		offeneGeoeffnet,
		AUFGABE_NICHT_ANSPRECHBAR
	);
	aufgabenSaetze.add(textFeld(datenVon(offeneGeoeffnet), 'meldung'));
	pruefenGleich('und ändert nichts', aufgabenAbdruck(frueh), fruehVorher);

	// -----------------------------------------------------------------------
	// Nicht ansprechbar: vier Zustände, ein Satz
	// -----------------------------------------------------------------------
	const aufgabenVorher = JSON.stringify(datenbank().select().from(tasks).all());
	for (const [wie, formular] of [
		['unbekannt', { aufgabeId: '999999' }],
		['fehlend', {}],
		['nicht numerisch', { aufgabeId: 'abc' }],
	] as const) {
		for (const aktion of ['abhaken', 'wiederOeffnen'] as const) {
			const ausgang = await routenausgang(() =>
				startseite.actions[aktion](alsMitglied('/', veraLocals, { ...formular }).alsRequestEvent())
			);
			abgewiesen(`${aktion}, aufgabeId ${wie}`, ausgang, AUFGABE_NICHT_ANSPRECHBAR);
			aufgabenSaetze.add(textFeld(datenVon(ausgang), 'meldung'));
		}
	}
	pruefen(
		'alle vier Zustände und beide actions tragen denselben Satz',
		aufgabenSaetze.size === 1,
		`${aufgabenSaetze.size} verschiedene Sätze: ${JSON.stringify([...aufgabenSaetze])}`
	);
	pruefenGleich(
		'und keiner von ihnen hat die Aufgabentabelle angefasst',
		JSON.stringify(datenbank().select().from(tasks).all()),
		aufgabenVorher
	);

	/*
	 * Ohne Mitglied in locals: derselbe Satz, und nichts geändert.
	 *
	 * Auf dem gewachten Pfad unerreichbar — der Wächter hat vorher mit 403
	 * abgewiesen —, aber der Typ lässt null zu, und ein `!` in der action wäre
	 * eine Annahme über eine andere Datei. Diese zwei Behauptungen sind das
	 * Einzige, was diesen Zweig überhaupt ausführt.
	 */
	const ohneMitglied = await routenausgang(() =>
		startseite.actions.abhaken(
			alsMitglied('/', null, { aufgabeId: String(frueh) }).alsRequestEvent()
		)
	);
	abgewiesen(
		'abhaken ohne Mitglied in locals wird abgewiesen',
		ohneMitglied,
		AUFGABE_NICHT_ANSPRECHBAR
	);
	pruefenGleich(
		'und hat die Aufgabentabelle nicht angefasst',
		JSON.stringify(datenbank().select().from(tasks).all()),
		aufgabenVorher
	);

	// -----------------------------------------------------------------------
	// Sortierstabilität: zwei Aufgaben mit demselben created_at
	// -----------------------------------------------------------------------
	/*
	 * Der Tiebreak asc(tasks.id) in offeneAufgabenAuflisten war bislang
	 * ungetestet: created_at hat Sekundenauflösung, und die drei Aufgaben oben
	 * liegen 100 Sekunden auseinander — nie gleich. Ohne zwei Aufgaben mit
	 * demselben Wert bewies keine Probe, dass der zweite Ordnungsschlüssel
	 * überhaupt etwas tut. Zwei Ladevorgänge hintereinander zeigen zugleich,
	 * dass die Reihenfolge stabil bleibt und nicht zwischen zwei Aufrufen
	 * wechselt.
	 */
	const geteilterZeitpunkt = jetzt - 500;
	const zwillingEins = aufgabeSaen('Kompost wenden', geteilterZeitpunkt);
	const zwillingZwei = aufgabeSaen('Laub rechen', geteilterZeitpunkt);
	const fuenfGesaete = [zwillingEins, zwillingZwei, ...dreiGesaete] as const;
	pruefenGleich(
		'zwei Aufgaben mit demselben created_at stehen nach aufsteigender Id',
		offeneReihenfolge(await startseiteLadenAn('/'), fuenfGesaete),
		`${zwillingEins} | ${zwillingZwei} | ${frueh} | ${mittel} | ${spaet}`
	);
	pruefenGleich(
		'und die Reihenfolge bleibt über einen zweiten Ladevorgang stabil',
		offeneReihenfolge(await startseiteLadenAn('/'), fuenfGesaete),
		`${zwillingEins} | ${zwillingZwei} | ${frueh} | ${mittel} | ${spaet}`
	);

	/*
	 * Zwei **Textprüfungen** an src/routes/+page.svelte — und sie sind
	 * ausdrücklich als solche benannt, nicht als ausgeführter Nachweis.
	 *
	 * Die Svelte-Schicht ist von keiner Prüfung dieses Projekts gedeckt (es gibt
	 * bewusst kein Komponenten-Testwerkzeug, siehe deferred-work.md). Zwei
	 * Zusagen dieser Story hängen aber an genau einer Textstelle und wären ohne
	 * diese zwei Zeilen still zu brechen:
	 *
	 *   - update({ reset: false, invalidateAll: false }) — beide Vorgaben von
	 *     use:enhance sind true, und beide nehmen die abgehakte Zeile weg. Wer
	 *     das Argument beim nächsten Anfassen als Rauschen entfernt, bricht das
	 *     Akzeptanzkriterium „die Zeile bleibt an ihrem Platz", und alles bleibt
	 *     grün.
	 *   - kein <label> — ein Label schaltet sein Bedienelement, und damit wäre
	 *     der Aufgabentext antippbar. Das ist im eingefrorenen Block ein Never.
	 */
	/*
	 * Beide Prüfungen laufen auf der Datei **ohne Kommentare**, und das ist
	 * keine Kosmetik: die Komponente erklärt an beiden Stellen ausführlich, was
	 * dort zu stehen hat und was nicht — sie nennt das Argument und die
	 * verbotene Label-Form wörtlich. Auf dem Rohtext hätten sich beide
	 * Behauptungen also an der eigenen Begründung erfüllt und wären grün
	 * geblieben, während der Code sie bricht. Gemessen: die Mutation
	 * `update({ reset: false })` liess einen Lauf auf dem Rohtext durchgehen.
	 */
	const startseitenCode = readFileSync(join(wurzel, 'src', 'routes', '+page.svelte'), 'utf8')
		.replace(/<!--[\s\S]*?-->/g, ' ')
		.replace(/\/\*[\s\S]*?\*\//g, ' ')
		.replace(/(^|[^:])\/\/[^\n]*/g, '$1');
	pruefen(
		'der Rückruf in +page.svelte ruft update({ reset: false, invalidateAll: false })',
		/update\(\{\s*reset:\s*false,\s*invalidateAll:\s*false\s*\}\)/.test(startseitenCode),
		'die Zusage „die Zeile bleibt stehen" hängt an diesem Argument'
	);
	pruefen(
		'und die Startseite trägt kein <label> — der Aufgabentext bleibt toter Text',
		!/<label\b/.test(startseitenCode)
	);

	// =======================================================================
	// /aufgabe — Story 1.5: eine Aufgabe vor Ort erfassen.
	//
	// Ein Feld, ein Knopf, keine Wahl. Geprüft wird die Serverseite: die eine
	// action, die Prüfkette davor, die Zeile danach und die Weiterleitung, mit
	// der die Bestätigung auf / ankommt. Die action bekommt ein Ereignis
	// **ohne** locals.mitglied — sie liest keine Identität, und es gibt keine
	// Spalte, die einen Erfassenden hielte (AD-2, AD-5).
	// =======================================================================
	const aufgabe = await aufgabeLaden();

	/*
	 * Die Matrixzeile „Ohne Cookie": /aufgabe hat **keine** eigene Schranke, und
	 * genau das ist zu belegen. Der Wächter ist pfadagnostisch — er schützt jeden
	 * Pfad ausser /i/… —, aber „pfadagnostisch" ist eine Aussage über Code, die
	 * erst dann eine Behauptung ist, wenn sie für diesen Pfad ausgeführt wurde.
	 * Eine Route, die den Wächter je umginge, fiele in der Oberfläche nicht auf.
	 */
	abweisungOderRot('ohne Zugang: /aufgabe ohne Cookie', await aufrufen('/aufgabe'));

	pruefen(
		'/aufgabe bringt keine load mit — die Seite zeigt ein leeres Feld',
		!('load' in aufgabe),
		Object.keys(aufgabe).sort().join(', ')
	);

	/** Ein Versand an ?/ablegen, ohne jede Identität im Ereignis. */
	const ablegenMit = (formular: Record<string, string | Blob>) =>
		routenausgang(() =>
			aufgabe.actions.ablegen(new Ereignis('/aufgabe', undefined, formular).alsRequestEvent())
		);

	/** Wie viele Zeilen in tasks stehen — die Zahl, die ein Fehlschlag nicht ändern darf. */
	const aufgabenZaehlen = () => datenbank().select({ id: tasks.id }).from(tasks).all().length;

	// -----------------------------------------------------------------------
	// Ablegen: eine Zeile, gefalteter Text, 303 auf /?abgelegt
	// -----------------------------------------------------------------------
	/*
	 * Der Text kommt mit Leerraum vorn, hinten und doppelt in der Mitte herein.
	 * Gespeichert werden muss die **gefaltete** Fassung — dieselbe Kette wie beim
	 * Mitgliedsnamen, und ohne diese Eingabe bewiese die Probe nur, dass ein
	 * schon sauberer Text sauber ankommt.
	 */
	const vorAblage = aufgabenZaehlen();
	const jetztAblage = Math.floor(Date.now() / 1000);
	const abgelegtAusgang = await ablegenMit({ text: '  Tunnel 2   Blattläuse nachbehandeln  ' });
	pruefen(
		'ablegen leitet mit 303 auf /?abgelegt — die Meldung reist im Parameter',
		abgelegtAusgang.art === 'weiter' &&
			abgelegtAusgang.status === 303 &&
			abgelegtAusgang.ort === '/?abgelegt',
		abgelegtAusgang.art === 'weiter'
			? `${abgelegtAusgang.status} auf ${abgelegtAusgang.ort}`
			: `Ausgang ${abgelegtAusgang.art}`
	);
	pruefenGleich('und legt genau eine Zeile an', aufgabenZaehlen(), vorAblage + 1);

	const neueAufgabe =
		datenbank()
			.select()
			.from(tasks)
			.where(eq(tasks.text, 'Tunnel 2 Blattläuse nachbehandeln'))
			.get() ?? null;
	pruefen(
		'der Text steht getrimmt und mit einfachen Leerzeichen in der Zeile',
		neueAufgabe !== null,
		JSON.stringify(datenbank().select({ text: tasks.text }).from(tasks).all())
	);
	pruefen(
		'created_at steht in Unix-Sekunden und kommt aus dem Schema, nicht aus der Route',
		typeof neueAufgabe?.createdAt === 'number' &&
			neueAufgabe.createdAt >= jetztAblage &&
			neueAufgabe.createdAt < jetztAblage + 300,
		JSON.stringify(neueAufgabe?.createdAt)
	);
	pruefen(
		'completed_by und completed_at sind leer — eine neue Aufgabe ist offen und niemandes',
		neueAufgabe?.completedBy === null && neueAufgabe?.completedAt === null,
		JSON.stringify(neueAufgabe)
	);

	/*
	 * Und sie steht in der Liste von / — als **jüngste zuletzt**, weil
	 * offeneAufgabenAuflisten nach created_at aufsteigend sortiert und ihr
	 * Zeitstempel der grösste ist.
	 */
	const nachAblage = await startseiteLadenAn('/?abgelegt');
	pruefenGleich(
		'die neue Aufgabe steht in der load von / — jüngste zuletzt',
		offeneReihenfolge(nachAblage, [...fuenfGesaete, neueAufgabe?.id]),
		`${zwillingEins} | ${zwillingZwei} | ${frueh} | ${mittel} | ${spaet} | ${neueAufgabe?.id}`
	);
	pruefen(
		'die Seitendaten der Erfassung tragen weder completed_by noch completed_at',
		!nenntErledigt(wertVon(nachAblage)),
		JSON.stringify(wertVon(nachAblage)).slice(0, 160)
	);

	// -----------------------------------------------------------------------
	// Der Parameter: eine Zahl, kein Satz
	// -----------------------------------------------------------------------
	/*
	 * Seit Story 2.1 ist `abgelegt` eine Zahl oder null. Das bare `?abgelegt`,
	 * das /aufgabe schickt, bleibt gültig und bedeutet 1 — der Satz `Abgelegt.`
	 * auf / hängt daran. Ein unlesbarer Wert fällt auf dieselbe 1: die Adresse ist
	 * von Hand veränderbar, und eine Fehlerseite für eine verunstaltete
	 * Bestätigung wäre lauter als der Anlass.
	 */
	pruefenGleich(
		'mit barem ?abgelegt gibt die load von / abgelegt: 1',
		wertVon(nachAblage).abgelegt,
		1
	);
	pruefenGleich(
		'ohne den Parameter gibt sie abgelegt: null',
		wertVon(await startseiteLadenAn('/')).abgelegt,
		null
	);
	pruefenGleich(
		'mit ?abgelegt=22 gibt sie die Zahl 22',
		wertVon(await startseiteLadenAn('/?abgelegt=22')).abgelegt,
		22
	);
	for (const [wie, adresse] of [
		['ein Wort', '/?abgelegt=viele'],
		['eine Null', '/?abgelegt=0'],
		['eine negative Zahl', '/?abgelegt=-3'],
		['eine Kommazahl', '/?abgelegt=2.5'],
	] as const) {
		pruefenGleich(
			`mit ?abgelegt als ${wie} fällt die load auf 1 zurück`,
			wertVon(await startseiteLadenAn(adresse)).abgelegt,
			1
		);
	}
	pruefen(
		'die Zahl trägt keinen Satz — der gehört zur Oberfläche',
		!/[Aa]bgelegt\./.test(JSON.stringify(wertVon(nachAblage))),
		JSON.stringify(wertVon(nachAblage)).slice(0, 160)
	);

	// -----------------------------------------------------------------------
	// Abgewiesen: sechs Eingaben, ein Satz, keine Zeile
	// -----------------------------------------------------------------------
	/*
	 * Nullbreiten-Zeichen sind für trim() kein Leerraum. Ein Aufgabentext aus
	 * ihnen legte eine Zeile an, die im Pool als leere Zeile neben einem Kästchen
	 * steht — ohne Aussage, was zu tun ist, und ohne Bearbeiten-Aktion, die das
	 * richtigstellte. Abhaken wäre das Einzige, was bliebe.
	 *
	 * Der Blob ist der Fall „das Feld ist da, ist aber kein String": ein
	 * Datei-Upload auf ein Textfeld. Er fällt auf denselben Satz wie ein leeres
	 * Feld — jede Unterscheidung wäre eine Auskunft ohne Handlung.
	 */
	const ablageSaetze = new Set<string>();
	for (const [wie, formular] of [
		['leer', { text: '' }],
		['nur Leerzeichen', { text: '   ' }],
		['nur Nullbreiten-Zeichen', { text: '\u200B\u200C\u200D\u2060\uFEFF' }],
		['aus Umbruch und Tabulator', { text: '\n\t' }],
		['ohne das Feld', {}],
		['kein String, sondern ein Blob', { text: new Blob(['Beet 25 jäten']) }],
	] as const) {
		const vorher = aufgabenZaehlen();
		const ausgang = await ablegenMit({ ...formular });
		pruefen(
			`ablegen ${wie} ergibt 400 am Feld text`,
			ausgang.art === 'fehlschlag' && ausgang.status === 400 && ausgang.daten.feld === 'text',
			`Ausgang ${ausgang.art}`
		);
		pruefenGleich(`ablegen ${wie} legt keine Zeile an`, aufgabenZaehlen(), vorher);
		ablageSaetze.add(textFeld(datenVon(ausgang), 'meldung'));
	}
	pruefen(
		'alle sechs abgewiesenen Eingaben tragen denselben Satz',
		ablageSaetze.size === 1,
		`${ablageSaetze.size} verschiedene Sätze: ${JSON.stringify([...ablageSaetze])}`
	);

	const nurLeerzeichen = await ablegenMit({ text: '   ' });
	pruefenGleich(
		'die Eingabe kommt unverändert zum Feld zurück und bleibt dort stehen',
		textFeld(datenVon(nurLeerzeichen), 'eingabe'),
		'   '
	);

	// -----------------------------------------------------------------------
	// Die Grenze: 200 Codepoints gehen durch, 201 nicht
	// -----------------------------------------------------------------------
	/*
	 * Einschliessend, und beide Seiten der Kante werden ausgeführt. Gezählt wird
	 * nach **Codepoints**: die 201 stehen als 200 Buchstaben plus ein Emoji da,
	 * das in UTF-16 zwei Einheiten belegt — mit `.length` statt [...text] wäre
	 * schon der gültige Text von 200 Zeichen plus Emoji abgewiesen worden.
	 */
	const vorGrenze = aufgabenZaehlen();
	const genauZweihundert = await ablegenMit({ text: 'A'.repeat(200) });
	pruefen(
		'genau 200 Codepoints werden angelegt — die Grenze ist einschliessend',
		genauZweihundert.art === 'weiter' && genauZweihundert.status === 303,
		`Ausgang ${genauZweihundert.art}`
	);
	pruefenGleich('und die Zeile steht in der Tabelle', aufgabenZaehlen(), vorGrenze + 1);

	const einsZuViel = await ablegenMit({ text: 'A'.repeat(201) });
	pruefen(
		'201 Codepoints werden mit 400 am Feld text abgewiesen',
		einsZuViel.art === 'fehlschlag' &&
			einsZuViel.status === 400 &&
			einsZuViel.daten.feld === 'text',
		`Ausgang ${einsZuViel.art}`
	);
	pruefenGleich('und legen keine Zeile an', aufgabenZaehlen(), vorGrenze + 1);
	pruefen(
		'der Satz zur Überlänge nennt die Grenze und ist ein anderer als der für fehlenden Text',
		textFeld(datenVon(einsZuViel), 'meldung').includes('200') &&
			!ablageSaetze.has(textFeld(datenVon(einsZuViel), 'meldung')),
		JSON.stringify(textFeld(datenVon(einsZuViel), 'meldung'))
	);

	const knappDrueber = await ablegenMit({ text: `${'A'.repeat(200)}\u{1F33F}` });
	pruefen(
		'200 Buchstaben plus ein Emoji sind 201 Codepoints und werden abgewiesen',
		knappDrueber.art === 'fehlschlag' && knappDrueber.status === 400,
		`Ausgang ${knappDrueber.art}`
	);

	/*
	 * Gegenprobe: ein Text **mit** einem Nullbreiten-Zeichen darin, der nach dem
	 * Aussieben lesbar bleibt, muss durchgehen — sonst wäre die Prüfung zu breit
	 * und wiese Texte ab, die aus einem Chat eingefügt wurden.
	 */
	const mitUnsichtbaremText = await ablegenMit({ text: 'Beet\u200B 25   jäten' });
	pruefen(
		'ein lesbarer Text mit einem Nullbreiten-Zeichen darin wird gesäubert und angenommen',
		mitUnsichtbaremText.art === 'weiter' && mitUnsichtbaremText.status === 303,
		`Ausgang ${mitUnsichtbaremText.art}`
	);
	pruefen(
		'und steht gesäubert und gefaltet in der Tabelle',
		datenbank().select().from(tasks).where(eq(tasks.text, 'Beet 25 jäten')).get() !== undefined,
		JSON.stringify(datenbank().select({ text: tasks.text }).from(tasks).all())
	);

	/*
	 * Die **Textprüfungen** dieser Story, ausdrücklich als solche benannt.
	 *
	 * Sie decken vier Zeilen der Matrix, die sonst gar nicht liefen — „Nach dem
	 * Ablegen" (die Live-Region sagt `Abgelegt.` und nimmt einmalig den Fokus),
	 * „Abhaken nach dem Ablegen" (die Rückmeldung des Abhakens ersetzt sie),
	 * „Doppeltipp auf Ablegen" (genau eine Zeile entsteht) und „Leeres Feld"
	 * insoweit, als der Satz auch **angesagt** werden muss — dazu die Zusagen des
	 * eingefrorenen Blocks, die sonst nur am Augenschein hingen.
	 *
	 * **Warum Text und nicht ausgeführt.** Diese Zusagen leben im Browser: eine
	 * Live-Region, ein Fokusgriff, eine Sperre über zwei Renderdurchgänge, die
	 * Verdrahtung eines Formularfeldes an eine action. Die Svelte-Schicht deckt in
	 * diesem Projekt kein ausgeführtes Werkzeug (es gibt bewusst keines, siehe
	 * deferred-work.md), und ein Rendern von Hand wäre eine zweite Umsetzung
	 * derselben Regel.
	 *
	 * **Warum die Vorrangregel nicht als reine Funktion herausgezogen ist.** Sie
	 * ist eine Zeile in einem $derived.by, das zwei Komponenten-Eigenschaften
	 * liest. Ein eigenes Modul dafür hätte genau einen Aufrufer — dieses Skript —
	 * und wäre damit Produktionscode, den keine Route benutzt. Dieselbe Abwägung
	 * steht in der Architektur hinter idLesen, das in zwei Routen wortgleich
	 * dasteht, statt in einem geteilten Modul zu liegen.
	 *
	 * Der Preis ist benannt: eine Textprüfung belegt, dass die Stelle **dasteht**,
	 * nicht, dass sie **wirkt**. Sie ist der Riegel gegen das stille Entfernen,
	 * nicht der Nachweis des Verhaltens.
	 *
	 * Alle laufen auf der Datei **ohne Kommentare**, aus demselben Grund wie die
	 * zwei Prüfungen der Startseite oben: die Komponenten erklären wörtlich, was
	 * dort zu stehen hat, und auf dem Rohtext erfüllten sich die Behauptungen an
	 * der eigenen Begründung.
	 *
	 * Und sie sind, wo immer es geht, gegen den **Umbruch** unempfindlich: der
	 * geprüfte Ausschnitt wird vorher auf einfache Leerzeichen geglättet. Sonst
	 * machte ein reiner Formatierungslauf von Prettier die Prüfliste rot, und die
	 * nächste Person löste das, indem sie die Behauptung abschwächt.
	 */
	const kommentarfrei = (quelle: string) =>
		quelle
			.replace(/<!--[\s\S]*?-->/g, ' ')
			.replace(/\/\*[\s\S]*?\*\//g, ' ')
			.replace(/(^|[^:])\/\/[^\n]*/g, '$1');
	const erfassenCode = kommentarfrei(
		readFileSync(join(wurzel, 'src', 'routes', 'aufgabe', '+page.svelte'), 'utf8')
	);
	const erfassenServer = kommentarfrei(
		readFileSync(join(wurzel, 'src', 'routes', 'aufgabe', '+page.server.ts'), 'utf8')
	);
	// Das geteilte Modul, in dem die Textregel seit Story 2.1 steht.
	const aufgabentextModul = kommentarfrei(
		readFileSync(join(wurzel, 'src', 'lib', 'aufgabentext.ts'), 'utf8')
	);

	/**
	 * Der klammerbalancierte Rumpf des ersten `{…}`-Blocks ab `von`, auf einfache
	 * Leerzeichen geglättet. Leer, wenn es keinen gibt.
	 *
	 * Balanciert und nicht `[^}]*`: ein Rumpf mit einer Zeichenkettenschablone
	 * darin (`${form.meldung}`) trägt selbst Klammern, und eine Suche bis zur
	 * ersten schliessenden schnitte mitten hinein.
	 */
	const glatterRumpf = (quelle: string, von: number): string => {
		const auf = von < 0 ? -1 : quelle.indexOf('{', von);
		if (auf < 0) return '';
		let tiefe = 0;
		for (let i = auf; i < quelle.length; i += 1) {
			if (quelle[i] === '{') tiefe += 1;
			else if (quelle[i] === '}') {
				tiefe -= 1;
				if (tiefe === 0)
					return quelle
						.slice(auf + 1, i)
						.replace(/\s+/g, ' ')
						.trim();
			}
		}
		return '';
	};

	/** Die Namen der fehlenden Teile einer Liste aus [Name, gefunden]. */
	const fehlendeTeile = (teile: readonly (readonly [string, boolean])[]) =>
		teile.filter(([, gefunden]) => !gefunden).map(([name]) => name);

	// -----------------------------------------------------------------------
	// /aufgabe: die Verdrahtung des Formulars
	// -----------------------------------------------------------------------
	/*
	 * Der teure Fehler, gegen den diese Behauptung steht: `name="text"` in
	 * `name="aufgabentext"` umbenannt. `formular.get('text')` gibt dann immer
	 * null, **jeder** Versand endet mit 400 „Ohne Text entsteht keine Aufgabe",
	 * und die ganze Prüfliste bleibt grün — die Behauptungen oben bauen ihr
	 * FormData selbst und kennen das Markup nicht. Dasselbe gilt für jedes andere
	 * Glied der Kette: ohne `value={eingabe}` ist die Eingabe nach einem
	 * Fehlschlag fort, ohne die id am Satz zeigt aria-describedby ins Leere, ohne
	 * use:enhance greift die Doppelsperre nie.
	 */
	const verdrahtung = [
		['name="text" am Feld', /<input\b[^>]*\bname="text"/.test(erfassenCode)],
		['value={eingabe} am Feld', /<input\b[^>]*\bvalue=\{eingabe\}/.test(erfassenCode)],
		[
			"aria-describedby auf 'text-fehler'",
			/<input\b[^>]*\baria-describedby=\{[^}]*'text-fehler'/.test(erfassenCode),
		],
		['id="text-fehler" am Fehlersatz', /<p\b[^>]*\bid="text-fehler"/.test(erfassenCode)],
		['use:enhance={versand} am Formular', /<form\b[^>]*use:enhance=\{versand\}/.test(erfassenCode)],
	] as const;
	pruefen(
		'das Formular auf /aufgabe ist vollständig verdrahtet',
		fehlendeTeile(verdrahtung).length === 0,
		`fehlt: ${fehlendeTeile(verdrahtung).join(', ')}`
	);

	// -----------------------------------------------------------------------
	// /aufgabe: die Zusagen des eingefrorenen Blocks
	// -----------------------------------------------------------------------
	const zusagen = [
		[
			'sichtbare <label for="text"> mit Text',
			/<label\b[^>]*\bfor="text"[^>]*>\s*\S[^<]*<\/label>/.test(erfassenCode),
		],
		['kein placeholder', !/\bplaceholder\b/.test(erfassenCode)],
		['kein Zurück-Knopf und kein Zurück-Link', !/(<a\b|[Zz]ur[üu]ck)/.test(erfassenCode)],
		['kein <textarea>', !/<textarea\b/.test(erfassenCode)],
		['genau ein Eingabefeld', (erfassenCode.match(/<input\b/g) ?? []).length === 1],
		['genau ein button-primary', (erfassenCode.match(/button-primary/g) ?? []).length === 1],
	] as const;
	pruefen(
		'/aufgabe hält die Never-Zusagen: ein Feld, ein Knopf, keine Wahl',
		fehlendeTeile(zusagen).length === 0,
		`verletzt: ${fehlendeTeile(zusagen).join(', ')}`
	);

	/*
	 * Der Fehlersatz steht **immer** im Markup, auch leer, und ist eine
	 * Live-Region. Bedingt gerendert wäre er ein Element, das erst mit seinem Text
	 * in den DOM kommt — und mit use:enhance gibt es keine Navigation, die den
	 * Fehlschlag ansagte. Die Zusage der README, ein abgewiesener Versand sage
	 * „zweierlei auf einmal", hängt an genau dieser Zeile.
	 */
	const fehlersatzTag = /<p\b[^>]*\bid="text-fehler"[^>]*>/.exec(erfassenCode)?.[0] ?? '';
	pruefen(
		'der Fehlersatz auf /aufgabe ist eine immer vorhandene Live-Region',
		/class="fehler live"/.test(fehlersatzTag) &&
			/aria-live=/.test(fehlersatzTag) &&
			!/\{#if fehlerAmText/.test(erfassenCode),
		fehlersatzTag === '' ? 'kein <p id="text-fehler"> gefunden' : fehlersatzTag
	);

	// -----------------------------------------------------------------------
	// /aufgabe: die Doppelsperre und das Band zur Längengrenze
	// -----------------------------------------------------------------------
	const sperre = [
		['let imFlug = $state(false)', /\blet imFlug = \$state\(false\);/.test(erfassenCode)],
		['cancel() im Rückruf', /\bcancel\(\);/.test(erfassenCode)],
		[
			'disabled={imFlug} am Knopf',
			/<button[^>]*class="button-primary"[^>]*disabled=\{imFlug\}/.test(erfassenCode),
		],
	] as const;
	pruefen(
		'/aufgabe trägt die Doppelsperre vollständig — die drei zusammen sind sie, einzeln nicht',
		fehlendeTeile(sperre).length === 0,
		`fehlt: ${fehlendeTeile(sperre).join(', ')}`
	);

	/*
	 * Die 200 steht zweimal: als Konstante und als Attribut im Markup. Ohne dieses
	 * Band bliebe das Attribut beim nächsten Ändern der Grenze stehen — ein Feld,
	 * das bei 200 Zeichen abschneidet, während die Route 300 annähme, oder
	 * umgekehrt eine Route, die abweist, was das Feld noch zulässt.
	 *
	 * Die Konstante liegt seit Story 2.1 nicht mehr in der Routendatei, sondern
	 * als AUFGABE_HOECHSTLAENGE in src/lib/aufgabentext.ts: /monatsplan wirft
	 * dieselbe Grenze für jede Zeile seines Stapels, und zwei Zahlen wären zwei
	 * Wahrheiten über dieselbe Regel. Diese Regex zeigt darum auf das geteilte
	 * Modul.
	 */
	pruefenGleich(
		'das maxlength am Feld hält die Grenze aus AUFGABE_HOECHSTLAENGE',
		/<input\b[^>]*\bmaxlength="(\d+)"/.exec(erfassenCode)?.[1] ?? '(kein maxlength)',
		/const AUFGABE_HOECHSTLAENGE = (\d+);/.exec(aufgabentextModul)?.[1] ?? '(keine Konstante)'
	);

	// -----------------------------------------------------------------------
	// /aufgabe: keine Identität
	// -----------------------------------------------------------------------
	const identitaet = /\b(locals|mitglied|zustaendig|zuständig)/i;
	const identitaetFund = [
		identitaet.exec(erfassenCode)?.[0],
		identitaet.exec(erfassenServer)?.[0],
	].filter((treffer) => treffer !== undefined);
	pruefen(
		'auf /aufgabe kommt keine Identität vor — weder locals noch ein Mitglied',
		identitaetFund.length === 0,
		`gefunden: ${identitaetFund.join(', ')}`
	);

	// -----------------------------------------------------------------------
	// /: der Erfassen-Knopf, die Meldung und der Fokusgriff
	// -----------------------------------------------------------------------
	/*
	 * Verortet und nicht nur gezählt. Schöbe man den Anker in den {:else}-Zweig,
	 * zählte weiter genau ein button-primary und die href-Regex träfe weiter —
	 * und der leere Pool stünde wieder ohne Knopf da, also genau der Zustand, den
	 * diese Story beseitigt. Der Bereich des {#if} wird klammerbalanciert
	 * geschnitten, weil im {:else}-Zweig ein zweites {#if} steckt.
	 */
	const poolVon = startseitenCode.indexOf('{#if data.aufgaben.length === 0}');
	let poolBis = -1;
	for (let tiefe = 0, i = poolVon; poolVon >= 0 && i < startseitenCode.length;) {
		const auf = startseitenCode.indexOf('{#if', i);
		const zu = startseitenCode.indexOf('{/if}', i);
		if (zu < 0) break;
		if (auf >= 0 && auf < zu) {
			tiefe += 1;
			i = auf + 4;
			continue;
		}
		tiefe -= 1;
		i = zu + 5;
		if (tiefe === 0) {
			poolBis = zu;
			break;
		}
	}
	const imPool = poolVon < 0 || poolBis < 0 ? '' : startseitenCode.slice(poolVon, poolBis);
	const nachPool = poolBis < 0 ? '' : startseitenCode.slice(poolBis);
	pruefen(
		'der Erfassen-Knopf steht hinter dem {#if} des Pools und damit in beiden Zuständen',
		poolVon >= 0 &&
			poolBis > poolVon &&
			!imPool.includes('button-primary') &&
			/<a[^>]*class="button-primary"[^>]*href=\{resolve\('\/aufgabe'\)\}/.test(nachPool),
		poolBis < 0
			? 'der {#if}-Block des Pools liess sich nicht schneiden'
			: `im {#if}: ${imPool.includes('button-primary') ? 'ja' : 'nein'}, dahinter: ${
					nachPool.includes('button-primary') ? 'ja' : 'nein'
				}`
	);
	pruefenGleich(
		'und / trägt genau einen button-primary',
		(startseitenCode.match(/button-primary/g) ?? []).length,
		1
	);

	/*
	 * `tabindex="-1"` sieht an einem <p> wie ein Versehen aus. Ohne es ist
	 * meldungKasten.focus() ein stiller Leerlauf: die Prüfung des $effect darunter
	 * bliebe grün, und `Abgelegt.` würde nie angesagt. Es gehört darum mit
	 * bind:this in **eine** Behauptung — die zwei sind zusammen der Fokusgriff.
	 */
	const meldungsTag = /<p\b[^>]*class="meldung live"[^>]*>/.exec(startseitenCode)?.[0] ?? '';
	pruefen(
		'die Meldungsregion auf / trägt tabindex="-1" und bind:this={meldungKasten}',
		/tabindex="-1"/.test(meldungsTag) && /bind:this=\{meldungKasten\}/.test(meldungsTag),
		meldungsTag === '' ? 'kein <p class="meldung live"> gefunden' : meldungsTag
	);

	const rueckmeldungRumpf = glatterRumpf(
		startseitenCode,
		startseitenCode.indexOf('const rueckmeldung')
	);
	pruefen(
		'auf / entstehen beide Sätze aus der Zahl: 1 ergibt `Abgelegt.`, sonst `N Aufgaben abgelegt.`',
		/if \(\s*data\.abgelegt === null\s*\) return '';\s*return data\.abgelegt === 1 \s*\? 'Abgelegt\.' \s*: `\$\{data\.abgelegt\} Aufgaben abgelegt\.`;/.test(
			rueckmeldungRumpf
		),
		rueckmeldungRumpf === '' ? 'rueckmeldung nicht gefunden' : rueckmeldungRumpf
	);
	pruefen(
		'und eine Rückmeldung des Abhakens gewinnt gegen den Parameter',
		/if \(\s*form === null\s*\) \{[\s\S]*?\}\s*if \(\s*form\.art === 'abgehakt'/.test(
			rueckmeldungRumpf
		),
		rueckmeldungRumpf === '' ? 'rueckmeldung nicht gefunden' : rueckmeldungRumpf
	);

	/*
	 * Am Bezeichner verankert und nicht an der Position: `$effect` kommt in dieser
	 * Datei heute einmal vor, und eine Prüfung, die den **ersten** nimmt, prüfte
	 * beim zweiten still den falschen.
	 */
	let fokusEffekt = '';
	for (const treffer of startseitenCode.matchAll(/\$effect\(/g)) {
		const rumpf = glatterRumpf(startseitenCode, treffer.index ?? 0);
		if (rumpf.includes('fokusGeholt')) {
			fokusEffekt = rumpf;
			break;
		}
	}
	const fokusTeile = [
		['nur mit dem Parameter', /data\.abgelegt === null/.test(fokusEffekt)],
		['nie nach einem Versand', /form !== null/.test(fokusEffekt)],
		['nur mit gebundenem Element', /meldungKasten === null/.test(fokusEffekt)],
		['und holt den Fokus', /meldungKasten\.focus\(\)/.test(fokusEffekt)],
	] as const;
	pruefen(
		'der fokussierende $effect hängt an demselben Wahrheitswert und verbraucht das Flag nicht ins Leere',
		fokusEffekt !== '' && fehlendeTeile(fokusTeile).length === 0,
		fokusEffekt === ''
			? 'kein $effect mit fokusGeholt gefunden'
			: `fehlt: ${fehlendeTeile(fokusTeile).join(', ')} — Rumpf: ${fokusEffekt}`
	);
	// =======================================================================
	// /monatsplan — Story 2.1: den Monatsplan in einem Zug ablegen.
	//
	// Geprüft wird die Serverseite: die load mit der Vorbelegung, die eine
	// action, ihre vier Prüfungen in ihrer Reihenfolge und der Stapel danach.
	// Die action bekommt ein Ereignis **ohne** locals.mitglied — sie liest keine
	// Identität, und es gibt keine Spalte, die einen Erfassenden hielte (AD-2,
	// AD-5). Ein Monatsplan ist namenlos wie der Rest des Pools.
	// =======================================================================
	const monatsplan = await monatsplanLaden();

	/*
	 * Die Matrixzeile „Ohne Cookie": /monatsplan hat **keine** eigene Schranke,
	 * und genau das ist zu belegen. Der Wächter ist pfadagnostisch, aber
	 * „pfadagnostisch" ist eine Aussage über Code, die erst dann eine Behauptung
	 * ist, wenn sie für diesen Pfad ausgeführt wurde. Es gibt keine zentrale
	 * Liste geschützter Pfade — jede Route bringt ihre eigene Zeile mit.
	 */
	abweisungOderRot('ohne Zugang: /monatsplan ohne Cookie', await aufrufen('/monatsplan'));

	// -----------------------------------------------------------------------
	// Die load: nur die Vorbelegung, und die ist das Monatsende
	// -----------------------------------------------------------------------
	/*
	 * Das Monatsende wird hier **unabhängig** gerechnet und nicht über
	 * monatsendeAlsFeldwert: eine Behauptung, die dieselbe Funktion ruft, die sie
	 * prüft, liest nur ihre eigene Vorbereitung. Der laufende Monat kommt aus Intl
	 * mit der Zone, der letzte Tag aus dem Tag-0-Trick des Folgemonats.
	 */
	const monatsendeUnabhaengig = (unixSekunden: number): string => {
		const inZone = new Intl.DateTimeFormat('en-CA', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			timeZone: 'Europe/Zurich',
		}).format(new Date(unixSekunden * 1000));
		const [jahr, monat] = inZone.split('-').map(Number);
		const letzter = new Date(Date.UTC(jahr, monat, 0)).getUTCDate();
		return `${jahr}-${String(monat).padStart(2, '0')}-${String(letzter).padStart(2, '0')}`;
	};

	/*
	 * Vor **und** nach der load gemessen, und beide Werte gelten.
	 *
	 * Eine einzige Messung daneben wäre eine Behauptung mit einem Zeitfenster: am
	 * letzten Tag eines Monats um 23:59:59 kann die load noch im alten Monat
	 * laufen und die Vergleichsrechnung schon im neuen. Der Lauf wäre dann einmal
	 * im Jahr zufällig rot, und die nächste Person schwächte die Behauptung ab,
	 * statt sie zu lesen.
	 */
	const vorLoad = Math.floor(Date.now() / 1000);
	const planDaten = wertVon(await routenausgang(() => monatsplan.load()));
	const nachLoad = Math.floor(Date.now() / 1000);
	pruefenGleich(
		'die load von /monatsplan gibt genau drei Felder',
		Object.keys(planDaten).sort().join(', '),
		'faelligBisFrueheste, faelligBisSpaeteste, faelligBisVorgabe'
	);
	const erlaubteVorgaben = [monatsendeUnabhaengig(vorLoad), monatsendeUnabhaengig(nachLoad)];
	pruefen(
		'und die Vorgabe ist der letzte Tag des laufenden Monats als JJJJ-MM-TT',
		erlaubteVorgaben.includes(textFeld(planDaten, 'faelligBisVorgabe')),
		`war ${JSON.stringify(textFeld(planDaten, 'faelligBisVorgabe'))}, erwartet ${JSON.stringify(erlaubteVorgaben)}`
	);

	// -----------------------------------------------------------------------
	// Das Fenster an `Fällig bis` — Eintrag 31, entschieden am 2026-08-28
	// -----------------------------------------------------------------------
	/*
	 * Gemessen wird an **festen** Uhren und nicht an der laufenden. Das ist hier
	 * nicht Bequemlichkeit, sondern die einzige Fassung ohne Zeitfenster: eine
	 * Grenzprobe an der echten Uhr wäre einmal im Jahr rot, wenn zwischen dem
	 * Bauen des Datums und dem Aufruf Mitternacht liegt. fristfenster und
	 * istImFristfenster nehmen den Bezugszeitpunkt beide als Parameter, genau
	 * damit das geht.
	 *
	 * Die erwarteten Daten stehen **literal** und sind nicht gerechnet: eine
	 * Behauptung, die dieselbe Tagesarithmetik ruft, die sie prüft, liest nur ihre
	 * eigene Vorbereitung.
	 */
	pruefenGleich(
		'FRIST_FENSTER_TAGE ist die Zahl, die hier ausgefahren wird',
		FRIST_FENSTER_TAGE,
		365
	);

	const UHR_2026 = Math.floor(Date.UTC(2026, 8, 30, 10, 0, 0) / 1000);
	const fenster2026 = fristfenster(UHR_2026);
	pruefenGleich(
		'das Fenster um den 30. September 2026 reicht vom 30. September 2025',
		fenster2026.frueheste,
		'2025-09-30'
	);
	pruefenGleich('… bis zum 30. September 2027', fenster2026.spaeteste, '2027-09-30');

	/*
	 * Die zweite Uhr steht über einem Schalttag, und sie ist der Beleg für die
	 * Zusage „365 Tage, nicht ein Kalenderjahr": 365 Tage vor dem 1. März 2028
	 * liegt der **2.** März 2027, weil der 29. Februar 2028 dazwischenliegt. Wer
	 * FRIST_FENSTER_TAGE durch eine Jahresrechnung ersetzte, machte hier den 1.
	 * März 2027 daraus und diese Zeile rot.
	 */
	const UHR_2028 = Math.floor(Date.UTC(2028, 2, 1, 10, 0, 0) / 1000);
	pruefenGleich(
		'über einen Schalttag hinweg zählt das Fenster Tage und keine Jahre',
		fristfenster(UHR_2028).frueheste,
		'2027-03-02'
	);

	/*
	 * Und hier schliesst sich der Kreis: **dieselben** zwei Feldwerte, die als
	 * `min` und `max` an das Datumsfeld gehen, muss die action zulassen — ein
	 * Feld, dessen eigener Grenzwert abgewiesen wird, böte etwas an, was es nicht
	 * gibt. Der Tag daneben fällt heraus.
	 *
	 * Gerechnet wird über tagesendeInUnixSekunden, weil die action genau das tut;
	 * die vier Daten selbst stehen wieder literal.
	 */
	const imFenster = (feldwert: string): boolean => {
		const tagesende = tagesendeInUnixSekunden(feldwert);
		return tagesende !== null && istImFristfenster(tagesende, UHR_2026);
	};
	const fensterProben = [
		['die untere Grenze selbst', '2025-09-30', true],
		['der Tag davor', '2025-09-29', false],
		['die obere Grenze selbst', '2027-09-30', true],
		['der Tag danach', '2027-10-01', false],
		['ein vertipptes 2016', '2016-09-30', false],
		['ein vertipptes 2062', '2062-09-30', false],
	] as const;
	for (const [wie, feldwert, soll] of fensterProben) {
		pruefenGleich(`istImFristfenster: ${wie} (${feldwert})`, imFenster(feldwert), soll);
	}

	// -----------------------------------------------------------------------
	// src/lib/zeit.ts, ausgeführt an festen Zeitpunkten
	// -----------------------------------------------------------------------
	/*
	 * Die subtilste Logik dieser Story, und die einzige, die eine laufende Uhr
	 * braucht. Gemessen, nicht vermutet: ersetzt man die zweistufige
	 * Versatzrechnung durch ein hartes `annahme - 7200`, bleibt die **ganze**
	 * Prüfliste grün — jedes gefahrene Datum oben (2026-09-30) liegt in der
	 * Sommerzeit. Zwischen Ende Oktober und Ende März wiese /monatsplan dann
	 * jeden Plan mit 400 ab, und niemand merkte es vor dem Winter.
	 *
	 * Die Erwartungswerte stehen darum als `Date.UTC(…)` da und kommen nicht aus
	 * der geprüften Funktion. Gefahren werden beide Zonen, **beide**
	 * Umstellungstage (der Wechsel liegt um 02:00 beziehungsweise 03:00 Ortszeit,
	 * nie um 23:59 — genau das begründet die eine Runde), ein Schaltjahr und die
	 * Gegenprobe dazu.
	 */
	for (const [wie, feldwert, soll] of [
		['Sommerzeit', '2026-09-30', Date.UTC(2026, 8, 30, 21, 59, 59)],
		['Winterzeit', '2026-11-30', Date.UTC(2026, 10, 30, 22, 59, 59)],
		['am Tag der Umstellung auf Sommerzeit', '2026-03-29', Date.UTC(2026, 2, 29, 21, 59, 59)],
		['am Tag der Umstellung auf Winterzeit', '2026-10-25', Date.UTC(2026, 9, 25, 22, 59, 59)],
		['am Schalttag', '2028-02-29', Date.UTC(2028, 1, 29, 22, 59, 59)],
	] as const) {
		pruefenGleich(
			`tagesendeInUnixSekunden trifft das Tagesende in Europe/Zurich ${wie}`,
			tagesendeInUnixSekunden(feldwert),
			Math.floor(soll / 1000)
		);
	}
	pruefenGleich(
		'und gibt null für den 29. Februar eines Nicht-Schaltjahrs',
		tagesendeInUnixSekunden('2027-02-29'),
		null
	);

	/*
	 * monatsendeAlsFeldwert an **festen** Bezugszeitpunkten.
	 *
	 * Der dritte ist der eigentliche Prüfgegenstand: 31. August 2026, 22:30 UTC
	 * ist in Europe/Zurich schon der 1. September. Wer den laufenden Monat aus UTC
	 * läse, bekäme `2026-08-31` und damit eine Vorgabe in der Vergangenheit. Das
	 * Fenster, in dem sich Zone und UTC überhaupt unterscheiden, ist rund zwei
	 * Stunden im Monat — ohne festen Zeitpunkt liefe diese Behauptung praktisch
	 * nie in den Fall hinein, den sie prüft.
	 */
	for (const [wie, bezug, soll] of [
		['im Schaltjahr-Februar', Date.UTC(2024, 1, 10, 12), '2024-02-29'],
		['im Dezember', Date.UTC(2026, 11, 1, 12), '2026-12-31'],
		['wenn die Zone schon im Folgemonat steht', Date.UTC(2026, 7, 31, 22, 30), '2026-09-30'],
	] as const) {
		pruefenGleich(
			`monatsendeAlsFeldwert trifft das Monatsende ${wie}`,
			monatsendeAlsFeldwert(Math.floor(bezug / 1000)),
			soll
		);
	}

	/*
	 * Die Höchstzahl, die der Browser sperrt, ist **dieselbe**, die diese
	 * Prüfliste unten mit 100 und 101 Zeilen ausfährt. Ohne diese Zeile stünde die
	 * geteilte Konstante neben zwei Literalen, die zufällig übereinstimmen.
	 */
	pruefenGleich('PLAN_HOECHSTZAHL ist die Zahl, die unten ausgefahren wird', PLAN_HOECHSTZAHL, 100);

	/** Ein Versand an ?/ablegen auf /monatsplan, ohne jede Identität im Ereignis. */
	const planAblegenMit = (formular: Record<string, string | Blob>) =>
		routenausgang(() =>
			monatsplan.actions.ablegen(new Ereignis('/monatsplan', undefined, formular).alsRequestEvent())
		);

	/*
	 * Das erwartete due_at, ebenfalls **unabhängig** gerechnet: der 30. September
	 * 2026 liegt in der Sommerzeit (UTC+2), sein Tagesende 23:59:59 Ortszeit ist
	 * also 21:59:59 UTC. Über tagesendeInUnixSekunden gerechnet läse diese
	 * Behauptung nur ihre eigene Vorbereitung.
	 */
	const TAGESENDE_30_09_2026 = Math.floor(Date.UTC(2026, 8, 30, 21, 59, 59) / 1000);
	const MITTERNACHT_30_09_2026 = Math.floor(Date.UTC(2026, 8, 30, 0, 0, 0) / 1000);

	// -----------------------------------------------------------------------
	// Ein Stapel von drei Zeilen: ein due_at, gefaltete Texte, 303 mit Zahl
	// -----------------------------------------------------------------------
	/*
	 * Der Text kommt so herein, wie er beim Einfügen aus einer Notiz aussieht:
	 * Leerraum vorn und hinten, doppelte Leerzeichen in der Mitte, Leerzeilen
	 * dazwischen, eine Zeile aus reinen Nullbreiten-Zeichen und ein
	 * Nullbreiten-Zeichen mitten in einem Wort. Ohne diese Eingabe bewiese die
	 * Probe nur, dass ein schon sauberer Plan sauber ankommt.
	 */
	const vorStapel = aufgabenZaehlen();
	const jetztStapel = Math.floor(Date.now() / 1000);
	const stapel = await planAblegenMit({
		faelligBis: '2026-09-30',
		zeilen:
			'  Nüsslisalat   säen, Beete 24 und 25  \n' +
			'\n' +
			'   \n' +
			'Tomaten\u200B abräumen, Tunnel 1\n' +
			'\u200B\u200C\u200D\u2060\uFEFF\n' +
			'Wintersalat pflanzen, Beet 30\n',
	});
	pruefen(
		'ein Stapel leitet mit 303 auf /?abgelegt=3 — die Zahl reist im Parameter',
		stapel.art === 'weiter' && stapel.status === 303 && stapel.ort === '/?abgelegt=3',
		stapel.art === 'weiter' ? `${stapel.status} auf ${stapel.ort}` : `Ausgang ${stapel.art}`
	);
	pruefenGleich('und legt genau drei Zeilen an', aufgabenZaehlen(), vorStapel + 3);

	/*
	 * Gesucht wird über den **Text** und nicht über das due_at: eine Suche über
	 * die Spalte, deren Wert gleich danach behauptet wird, läse nur ihre eigene
	 * Vorbereitung — sie fände bei einem falschen due_at schlicht null Zeilen,
	 * und `every` über eine leere Menge ist wahr.
	 */
	const stapelTexte = [
		'Nüsslisalat säen, Beete 24 und 25',
		'Tomaten abräumen, Tunnel 1',
		'Wintersalat pflanzen, Beet 30',
	];
	const stapelZeilen = datenbank()
		.select()
		.from(tasks)
		.all()
		.filter((zeile) => stapelTexte.includes(zeile.text));
	pruefenGleich(
		'die drei Texte stehen gefaltet und gesäubert in der Tabelle, leere Zeilen fielen weg',
		stapelZeilen.length,
		3
	);
	pruefenGleich(
		'alle drei tragen **denselben** due_at — ein Monatsplan hat eine Frist, nicht drei',
		new Set(stapelZeilen.map((zeile) => zeile.dueAt)).size,
		1
	);
	pruefen(
		'und der liegt auf dem Tagesende in Europe/Zurich, nicht auf Mitternacht UTC',
		stapelZeilen.length === 3 &&
			stapelZeilen.every((zeile) => zeile.dueAt === TAGESENDE_30_09_2026) &&
			TAGESENDE_30_09_2026 !== MITTERNACHT_30_09_2026,
		JSON.stringify(stapelZeilen.map((zeile) => zeile.dueAt))
	);
	pruefen(
		'die Erledigt-Spalten sind leer — eine neue Aufgabe ist offen und niemandes',
		stapelZeilen.every((zeile) => zeile.completedBy === null && zeile.completedAt === null),
		JSON.stringify(stapelZeilen)
	);
	pruefen(
		'created_at kommt aus dem Schema, nicht aus dem Stapel — und ist nicht das due_at',
		stapelZeilen.every(
			(zeile) =>
				zeile.createdAt >= jetztStapel &&
				zeile.createdAt < jetztStapel + 300 &&
				zeile.createdAt !== zeile.dueAt
		),
		JSON.stringify(stapelZeilen.map((zeile) => zeile.createdAt))
	);

	/*
	 * Die eine Vorbedingung, die aufgabenStapelAnlegen **selbst** prüft, direkt
	 * gefahren — die action erreicht sie nie, weil sie den leeren Stapel schon
	 * abfängt, und genau darum hing sie an nichts.
	 *
	 * `values([])` erzeugt ein INSERT ohne VALUES-Klausel und wirft. Ein Wurf aus
	 * der Datenschicht wäre für die aufrufende Person eine Fehlerseite statt eines
	 * Satzes; nimmt jemand die Wache heraus, wird diese Zeile rot, statt dass es
	 * erst der nächste Aufrufer merkt. Gate-Regel 9 verbietet den direkten Zugriff
	 * nur unter src/routes/.
	 */
	const vorLeerstapel = aufgabenZaehlen();
	pruefenGleich(
		'aufgabenStapelAnlegen gibt für einen leeren Stapel die leere Liste zurück, statt zu werfen',
		JSON.stringify(aufgabenStapelAnlegen([], TAGESENDE_30_09_2026)),
		'[]'
	);
	pruefenGleich('und legt dabei keine Zeile an', aufgabenZaehlen(), vorLeerstapel);

	// -----------------------------------------------------------------------
	// due_at steht ab jetzt in den Seitendaten — Story 2.2 rechnet darauf
	// -----------------------------------------------------------------------
	const planaufgabeId = aufgabeSaen('Knoblauch stecken, Beet 8', jetztStapel, TAGESENDE_30_09_2026);
	const mitFrist = await startseiteLadenAn('/');
	const gesaeteZeile = (
		(wertVon(mitFrist).aufgaben ?? []) as { id: number; dueAt?: unknown }[]
	).find((zeile) => zeile.id === planaufgabeId);
	pruefenGleich(
		'die load von / reicht due_at heraus — Story 2.2 rechnet darauf',
		gesaeteZeile?.dueAt,
		TAGESENDE_30_09_2026
	);
	pruefen(
		'und trägt trotzdem weder completed_by noch completed_at',
		!nenntErledigt(wertVon(mitFrist)),
		JSON.stringify(wertVon(mitFrist)).slice(0, 160)
	);

	// -----------------------------------------------------------------------
	// Abgewiesen: zwölf Eingaben, das richtige Feld, keine einzige Zeile
	// -----------------------------------------------------------------------
	/*
	 * Die Reihenfolge der Prüfungen ist Teil der Zusage: erst das Datum, dann ob
	 * Zeilen da sind, dann die Höchstzahl, dann die Zeilenlänge. Darum steht in
	 * jeder Zeile, welches Feld die Meldung trägt — ein Vertauschen der Prüfungen
	 * macht die Zeile „ohne das Feld faelligBis" rot, obwohl der Status derselbe
	 * bliebe.
	 *
	 * Der Blob ist der Fall „das Feld ist da, ist aber kein String": ein
	 * Datei-Upload auf ein Textfeld.
	 */
	const zweiZuLang = `Beet 25 jäten\n${'A'.repeat(201)}\n${'B'.repeat(201)}`;
	const hundertEins = Array.from({ length: 101 }, (_, i) => `Aufgabe ${i + 1}`).join('\n');
	const planAbweisungen = [
		['ohne Zeilen', { faelligBis: '2026-09-30', zeilen: '' }, 'zeilen'],
		['mit reinem Leerraum', { faelligBis: '2026-09-30', zeilen: '   \n\t\n  ' }, 'zeilen'],
		[
			'mit reinen Nullbreiten-Zeichen',
			{ faelligBis: '2026-09-30', zeilen: '\u200B\u200C\u200D\u2060\uFEFF' },
			'zeilen',
		],
		['ohne das Feld zeilen', { faelligBis: '2026-09-30' }, 'zeilen'],
		[
			'mit einem Blob statt Zeilen',
			{ faelligBis: '2026-09-30', zeilen: new Blob(['Beet 25 jäten']) },
			'zeilen',
		],
		['ohne das Feld faelligBis', { zeilen: 'Beet 25 jäten' }, 'datum'],
		['mit leerem faelligBis', { faelligBis: '', zeilen: 'Beet 25 jäten' }, 'datum'],
		[
			'mit faelligBis als 30.09.2026',
			{ faelligBis: '30.09.2026', zeilen: 'Beet 25 jäten' },
			'datum',
		],
		[
			'mit dem unmöglichen 2026-02-31',
			{ faelligBis: '2026-02-31', zeilen: 'Beet 25 jäten' },
			'datum',
		],
		[
			'mit einem Blob statt eines Datums',
			{ faelligBis: new Blob(['2026-09-30']), zeilen: 'Beet 25 jäten' },
			'datum',
		],
		[
			'mit zwei Zeilen zu 201 Codepoints',
			{ faelligBis: '2026-09-30', zeilen: zweiZuLang },
			'zeilen',
		],
		['mit 101 Zeilen', { faelligBis: '2026-09-30', zeilen: hundertEins }, 'zeilen'],
	] as const;
	const planSaetze = new Map<string, string>();
	for (const [wie, formular, feld] of planAbweisungen) {
		const vorher = aufgabenZaehlen();
		const ausgang = await planAblegenMit({ ...formular });
		pruefen(
			`ablegen ${wie} ergibt 400 am Feld ${feld}`,
			ausgang.art === 'fehlschlag' && ausgang.status === 400 && ausgang.daten.feld === feld,
			ausgang.art === 'fehlschlag'
				? `${ausgang.status} am Feld ${JSON.stringify(ausgang.daten.feld)}`
				: `Ausgang ${ausgang.art}`
		);
		pruefenGleich(`ablegen ${wie} legt keine Zeile an`, aufgabenZaehlen(), vorher);
		planSaetze.set(wie, textFeld(datenVon(ausgang), 'meldung'));
	}
	pruefen(
		'alle fünf Datums-Abweisungen tragen denselben Satz — jede Unterscheidung wäre ein Kanal',
		new Set(
			planAbweisungen
				.filter(([, , feld]) => feld === 'datum')
				.map(([wie]) => planSaetze.get(wie) ?? '')
		).size === 1,
		JSON.stringify([...planSaetze])
	);
	/*
	 * Und dieser eine Satz ist der aus src/lib/texte.ts. Seit die Komponente ihn
	 * ebenfalls sagt, steht er dort und nicht mehr als Literal in der Route; ohne
	 * diese Zeile bliebe die Prüfliste grün, wenn eine der zwei Wurfstellen sich
	 * vom Modul löste — dieselbe Klammer wie bei NAME_FEHLT.
	 */
	pruefenGleich(
		'und es ist DATUM_FEHLT aus dem geteilten Modul',
		planSaetze.get('mit leerem faelligBis') ?? '',
		DATUM_FEHLT
	);
	pruefen(
		'der Satz zur Überlänge nennt die Zahl der zu langen Zeilen und die Grenze 200',
		(planSaetze.get('mit zwei Zeilen zu 201 Codepoints') ?? '').includes('2 Zeilen') &&
			(planSaetze.get('mit zwei Zeilen zu 201 Codepoints') ?? '').includes('200'),
		JSON.stringify(planSaetze.get('mit zwei Zeilen zu 201 Codepoints'))
	);
	pruefen(
		'der Satz zur Höchstzahl nennt die 100',
		(planSaetze.get('mit 101 Zeilen') ?? '').includes('100'),
		JSON.stringify(planSaetze.get('mit 101 Zeilen'))
	);

	/*
	 * Die Abweisung wegen des Fensters steht **ausserhalb** der Matrix darüber,
	 * und zwar mit Absicht: sie trägt am selben Feld einen **anderen** Satz. Die
	 * Zeile darüber behauptet, dass alle fünf Formfehler denselben Satz tragen —
	 * hier ist die Unterscheidung gerade erwünscht, weil sie zu einer anderen
	 * Handlung führt. Ein Datum, das keine Form hat, muss gewählt werden; eines
	 * mit vertippter Jahreszahl muss korrigiert werden.
	 *
	 * Die zwei Daten liegen so weit draussen, dass keine laufende Uhr sie je ins
	 * Fenster holt — die Grenze selbst ist oben an fester Uhr gemessen.
	 */
	const fensterAbweisungen = [
		['mit dem vertippten 1990-01-01', '1990-01-01'],
		['mit dem vertippten 2062-01-01', '2062-01-01'],
	] as const;
	for (const [wie, feldwert] of fensterAbweisungen) {
		const vorher = aufgabenZaehlen();
		const ausgang = await planAblegenMit({ faelligBis: feldwert, zeilen: 'Beet 25 jäten' });
		pruefen(
			`ablegen ${wie} ergibt 400 am Feld datum`,
			ausgang.art === 'fehlschlag' && ausgang.status === 400 && ausgang.daten.feld === 'datum',
			ausgang.art === 'fehlschlag'
				? `${ausgang.status} am Feld ${JSON.stringify(ausgang.daten.feld)}`
				: `Ausgang ${ausgang.art}`
		);
		pruefenGleich(`ablegen ${wie} legt keine Zeile an`, aufgabenZaehlen(), vorher);
		pruefenGleich(
			`ablegen ${wie} trägt den Satz über die Jahreszahl`,
			textFeld(datenVon(ausgang), 'meldung'),
			FRIST_AUSSERHALB
		);
	}
	pruefen(
		'und dieser Satz ist ein anderer als der der fünf Formfehler',
		FRIST_AUSSERHALB !== (planSaetze.get('mit leerem faelligBis') ?? ''),
		`Formfehler sagt ${JSON.stringify(planSaetze.get('mit leerem faelligBis'))}`
	);

	// -----------------------------------------------------------------------
	// Die zwei Grenzen sind einschliessend: 200 Codepoints und 100 Zeilen
	// -----------------------------------------------------------------------
	const vorGenau = aufgabenZaehlen();
	const genauZweihundertJeZeile = await planAblegenMit({
		faelligBis: '2026-09-30',
		zeilen: `${'A'.repeat(200)}\n${'B'.repeat(200)}`,
	});
	pruefen(
		'zwei Zeilen zu genau 200 Codepoints gehen durch — die Grenze ist einschliessend',
		genauZweihundertJeZeile.art === 'weiter' &&
			genauZweihundertJeZeile.status === 303 &&
			genauZweihundertJeZeile.ort === '/?abgelegt=2',
		genauZweihundertJeZeile.art === 'weiter'
			? `${genauZweihundertJeZeile.status} auf ${genauZweihundertJeZeile.ort}`
			: `Ausgang ${genauZweihundertJeZeile.art}`
	);
	pruefenGleich('und stehen beide in der Tabelle', aufgabenZaehlen(), vorGenau + 2);

	const vorHundert = aufgabenZaehlen();
	const genauHundert = await planAblegenMit({
		faelligBis: '2026-09-30',
		zeilen: Array.from({ length: 100 }, (_, i) => `Hundertplan ${i + 1}`).join('\n'),
	});
	pruefen(
		'genau 100 Zeilen gehen durch und melden die 100 im Parameter',
		genauHundert.art === 'weiter' &&
			genauHundert.status === 303 &&
			genauHundert.ort === '/?abgelegt=100',
		genauHundert.art === 'weiter'
			? `${genauHundert.status} auf ${genauHundert.ort}`
			: `Ausgang ${genauHundert.art}`
	);
	pruefenGleich('und alle hundert stehen in der Tabelle', aufgabenZaehlen(), vorHundert + 100);

	// -----------------------------------------------------------------------
	// Eine Zeile, und zwei gleiche Zeilen
	// -----------------------------------------------------------------------
	const vorEinzeln = aufgabenZaehlen();
	const einzeln = await planAblegenMit({ faelligBis: '2026-09-30', zeilen: 'Etiketten erneuern' });
	pruefen(
		'genau eine Zeile leitet auf /?abgelegt=1 — auf / steht dann `Abgelegt.`',
		einzeln.art === 'weiter' && einzeln.status === 303 && einzeln.ort === '/?abgelegt=1',
		einzeln.art === 'weiter' ? `${einzeln.status} auf ${einzeln.ort}` : `Ausgang ${einzeln.art}`
	);
	pruefenGleich('und legt genau eine Zeile an', aufgabenZaehlen(), vorEinzeln + 1);

	/*
	 * Zwei Mal derselbe Satz sind zwei Aufgaben: es gibt zwei Tunnel, und die
	 * planende Person meint womöglich beide. Eine Entdopplung müsste entscheiden,
	 * welche zwei Zeilen „dieselbe" sind — dieselbe Abwägung wie beim Doppeltipp
	 * auf /aufgabe, und dieselbe Antwort.
	 */
	const vorDoppelt = aufgabenZaehlen();
	const doppelt = await planAblegenMit({
		faelligBis: '2026-09-30',
		zeilen: 'Tunnel lüften\nTunnel lüften',
	});
	pruefen(
		'zwei wortgleiche Zeilen ergeben zwei Aufgaben — es wird nicht entdoppelt',
		doppelt.art === 'weiter' && doppelt.ort === '/?abgelegt=2',
		doppelt.art === 'weiter' ? `auf ${doppelt.ort}` : `Ausgang ${doppelt.art}`
	);
	pruefenGleich('und beide stehen in der Tabelle', aufgabenZaehlen(), vorDoppelt + 2);
	pruefenGleich(
		'beide tragen denselben Text',
		datenbank().select().from(tasks).where(eq(tasks.text, 'Tunnel lüften')).all().length,
		2
	);

	/*
	 * /aufgabe bleibt unangetastet: dieselbe action, dasselbe bare `?abgelegt`,
	 * und **kein** Datumsfeld. Ohne diese Zeile liesse sich das gemeinsame Modul
	 * so umbauen, dass die eine Route mitwandert und niemand es merkt.
	 */
	const aufgabeNachStory = await ablegenMit({ text: 'Giesskannen einwintern' });
	pruefen(
		'/aufgabe leitet weiterhin auf das bare /?abgelegt',
		aufgabeNachStory.art === 'weiter' && aufgabeNachStory.ort === '/?abgelegt',
		aufgabeNachStory.art === 'weiter'
			? `auf ${aufgabeNachStory.ort}`
			: `Ausgang ${aufgabeNachStory.art}`
	);
	pruefen(
		'und die so erfasste Aufgabe hat **keine** Frist',
		datenbank().select().from(tasks).where(eq(tasks.text, 'Giesskannen einwintern')).get()
			?.dueAt === null,
		JSON.stringify(
			datenbank().select().from(tasks).where(eq(tasks.text, 'Giesskannen einwintern')).get()
		)
	);

	// -----------------------------------------------------------------------
	// /monatsplan: die Textprüfungen
	// -----------------------------------------------------------------------
	/*
	 * Aus demselben Grund wie auf /aufgabe und /: die zwei Schritte, der Zähler,
	 * der Fokusgriff und die Doppelsperre leben im Browser, und die Svelte-Schicht
	 * deckt in diesem Projekt kein ausgeführtes Werkzeug. Jede dieser Zusagen
	 * hängt an genau einer Textstelle. Der Preis ist benannt: eine Textprüfung
	 * belegt, dass die Stelle **dasteht**, nicht, dass sie **wirkt**.
	 */
	const planCode = kommentarfrei(
		readFileSync(join(wurzel, 'src', 'routes', 'monatsplan', '+page.svelte'), 'utf8')
	);
	const planServer = kommentarfrei(
		readFileSync(join(wurzel, 'src', 'routes', 'monatsplan', '+page.server.ts'), 'utf8')
	);

	/*
	 * Die zwei Schritte liegen im selben {#if}. Geschnitten wird am {:else},
	 * damit „genau ein primärer Knopf" **je Schritt** prüfbar ist: über die ganze
	 * Datei gezählt sind es zwei, und eine reine Zählung liesse zwei Knöpfe in
	 * einem Schritt durchgehen.
	 */
	const schrittGrenze = planCode.indexOf('{:else}');
	const schrittEins = schrittGrenze < 0 ? '' : planCode.slice(0, schrittGrenze);
	const schrittZwei = schrittGrenze < 0 ? '' : planCode.slice(schrittGrenze);
	pruefen(
		'je Schritt genau ein button-primary — Weiter im ersten, das Verb mit der Zahl im zweiten',
		schrittGrenze > 0 &&
			(schrittEins.match(/button-primary/g) ?? []).length === 1 &&
			(schrittZwei.match(/button-primary/g) ?? []).length === 1 &&
			/>Weiter</.test(schrittEins) &&
			/\{ablegenText\}/.test(schrittZwei),
		schrittGrenze < 0
			? 'kein {:else} gefunden — die zwei Schritte liegen nicht mehr in einem {#if}'
			: `Schritt 1: ${(schrittEins.match(/button-primary/g) ?? []).length}, Schritt 2: ${
					(schrittZwei.match(/button-primary/g) ?? []).length
				}`
	);

	const planVerdrahtung = [
		[
			'literales action="?/ablegen" am Formular',
			/<form\b[^>]*action="\?\/ablegen"/.test(schrittZwei),
		],
		['use:enhance={versand} am Formular', /<form\b[^>]*use:enhance=\{versand\}/.test(schrittZwei)],
		[
			'verstecktes Feld name="faelligBis"',
			/<input\b[^>]*type="hidden"[^>]*\bname="faelligBis"[^>]*\bvalue=\{faelligBis\}/.test(
				schrittZwei
			),
		],
		[
			'verstecktes Feld name="zeilen"',
			/<input\b[^>]*type="hidden"[^>]*\bname="zeilen"[^>]*\bvalue=\{zeilenFeldwert\}/.test(
				schrittZwei
			),
		],
	] as const;
	pruefen(
		'das Formular auf /monatsplan ist vollständig verdrahtet',
		fehlendeTeile(planVerdrahtung).length === 0,
		`fehlt: ${fehlendeTeile(planVerdrahtung).join(', ')}`
	);

	const planZusagen = [
		['kein placeholder', !/\bplaceholder\b/.test(planCode)],
		[
			'sichtbare Beschriftung `Fällig bis`',
			/<label\b[^>]*\bfor="faellig-bis"[^>]*>\s*Fällig bis\s*<\/label>/.test(planCode),
		],
		[
			'sichtbare Beschriftung `Eine Aufgabe pro Zeile`',
			/<label\b[^>]*\bfor="plan-zeilen"[^>]*>\s*Eine Aufgabe pro Zeile\s*<\/label>/.test(planCode),
		],
		['genau ein Textfeld für den ganzen Plan', (planCode.match(/<textarea\b/g) ?? []).length === 1],
		['kein Eingabefeld je Zeile im Prüfschritt', !/<textarea\b/.test(schrittZwei)],
		[
			'im Prüfschritt stehen nur die zwei versteckten Felder',
			(schrittZwei.match(/<input\b/g) ?? []).length === 2,
		],
		['kein Zurück-Link und kein Anker', !/<a\b/.test(planCode)],
		['kein dynamisches action={…}', !/action=\{/.test(planCode)],
		['kein Rot', !/danger/.test(planCode)],
	] as const;
	pruefen(
		'/monatsplan hält die Never-Zusagen: ein Textfeld, kein Editor je Zeile, kein Rot',
		fehlendeTeile(planZusagen).length === 0,
		`verletzt: ${fehlendeTeile(planZusagen).join(', ')}`
	);

	/*
	 * Das `×` ist ein echtes <button type="button"> und kein <span> mit
	 * Klick-Handler: nur ein Knopf ist mit der Tastatur erreichbar und meldet sich
	 * einem Screenreader als Knopf. Sein zugänglicher Name entsteht über
	 * aria-labelledby aus dem sichtbaren Zeilentext **und** einem verborgenen
	 * Verb — dasselbe Muster wie das Kästchen auf `/`.
	 */
	const kreuzTeile = [
		[
			'<button type="button"> und kein <span>',
			/<button\b[^>]*class="entfernen"[^>]*type="button"/.test(schrittZwei),
		],
		[
			'Name aus Zeilentext plus verborgenem Verb',
			/aria-labelledby="plan-zeile-\{zeile\.id\} plan-verb-\{zeile\.id\}"/.test(schrittZwei),
		],
		[
			'das verborgene Verb heisst `, entfernen`',
			/<span class="nur-vorgelesen" id="plan-verb-\{zeile\.id\}">, entfernen<\/span>/.test(
				schrittZwei
			),
		],
		[
			'eine eigene Kennung am Knopf — daran hängt der Fokusgriff beim Entfernen',
			/<button[^>]*\bid="plan-entfernen-\{zeile\.id\}"/.test(schrittZwei),
		],
		['kein onclick an einem <span>', !/<span\b[^>]*onclick/.test(planCode)],
	] as const;
	pruefen(
		'das × ist ein echter Knopf mit zugänglichem Namen',
		fehlendeTeile(kreuzTeile).length === 0,
		`fehlt: ${fehlendeTeile(kreuzTeile).join(', ')}`
	);

	/*
	 * Der Zähler ist ausdrücklich **keine** Live-Region: er ändert sich bei jedem
	 * Tastendruck, und ein Screenreader spräche dann bei jedem Buchstaben. Der
	 * Fehlersatz dagegen **ist** eine, und er steht immer im Markup.
	 */
	const zaehlerTag = /<p\b[^>]*class="zaehler"[^>]*>/.exec(planCode)?.[0] ?? '';
	const zaehlerTeile = [
		['ein <p class="zaehler"> mit eigener Kennung', /\bid="plan-zaehler"/.test(zaehlerTag)],
		['keine Live-Region', zaehlerTag !== '' && !/aria-live=/.test(zaehlerTag)],
		['keine status-Rolle', !/role="status"/.test(zaehlerTag)],
		[
			'dieselbe Zerlegung wie der Server',
			/zeilenErkennen\(planText\)/.test(planCode) && /zeilenErkennen/.test(planServer),
		],
		[
			'er sagt die Höchstzahl, statt nur den Knopf zu sperren',
			/höchstens \$\{PLAN_HOECHSTZAHL\} Aufgaben auf einmal\./.test(planCode),
		],
	] as const;
	pruefen(
		'der Zähler ist keine Live-Region, liest dieselbe Funktion wie der Server und nennt die Grenze',
		fehlendeTeile(zaehlerTeile).length === 0,
		`fehlt: ${fehlendeTeile(zaehlerTeile).join(', ')} — Tag: ${zaehlerTag}`
	);

	/*
	 * **Beide Felder sind beschrieben und markiert.**
	 *
	 * Der Zähler ist die eine Zahl, die ein Akzeptanzkriterium wörtlich nennt;
	 * ohne das aria-describedby am Textfeld begegnete ihr, wer mit einem
	 * Screenreader durch das Formular geht, nirgends. Und ohne die
	 * aria-invalid-Verdrahtung markierte eine Abweisung mit `feld: 'zeilen'`
	 * **nichts** — der Rückruf springt bei jeder Abweisung nach Schritt 1 zurück,
	 * dort ist das Feld sichtbar, und die Kante ist der Hinweis, wo.
	 *
	 * Am Datumsfeld dasselbe, plus sein eigener Satz: das `required` dort ist
	 * wirkungslos, weil Schritt 1 kein `<form>` ist (die Behauptung darüber sagt
	 * das ausdrücklich), und ohne den Satz käme ein geleertes Feld bis in den
	 * Prüfschritt.
	 */
	const feldTeile = [
		[
			'das Textfeld beschreibt sich über den Zähler',
			/<textarea[\s\S]*?aria-describedby=\{zeilenBeschreibung\}/.test(planCode) &&
				/const zeilenBeschreibung = \$derived\(\s*fehlerAnZeilen \? 'plan-zaehler plan-fehler' : 'plan-zaehler'\s*\);/.test(
					planCode
				),
		],
		[
			'und markiert sich bei einer Abweisung an den Zeilen',
			/<textarea[\s\S]*?aria-invalid=\{fehlerAnZeilen \? 'true' : undefined\}/.test(planCode),
		],
		[
			'das Datumsfeld trägt seinen eigenen Satz',
			/<p class="hinweis live" id="plan-datum-hinweis">\{datumHinweis\}<\/p>/.test(planCode) &&
				/aria-describedby=\{datumBeschreibung === '' \? undefined : datumBeschreibung\}/.test(
					planCode
				),
		],
		[
			'und markiert sich, solange das Datum nicht taugt oder ausser Reichweite liegt',
			/aria-invalid=\{fehlerAmDatum \|\| faelligAm === null \|\| !datumImFenster\s*\?\s*'true'\s*:\s*undefined\}/.test(
				planCode
			),
		],
	] as const;
	pruefen(
		'beide Felder auf /monatsplan sind beschrieben und markieren sich bei einer Abweisung',
		fehlendeTeile(feldTeile).length === 0,
		`fehlt: ${fehlendeTeile(feldTeile).join(', ')}`
	);

	/*
	 * Und die Zahl selbst, **ausgeführt**: 27 Zeilen, davon drei leere, ergeben
	 * 24. Das ist die eine Zahl, die ein Akzeptanzkriterium wörtlich nennt, und
	 * die Behauptung darüber hing bis hierher an der Textprüfung oben — die sagt
	 * nur, dass beide Seiten dieselbe Funktion rufen, nicht was sie zählt.
	 *
	 * Die drei leeren Zeilen sind absichtlich verschieden leer: eine ganz leere,
	 * eine aus Leerraum und eine aus einem Nullbreiten-Zeichen. Mit nur einer
	 * ganz leeren bliebe die Zeile grün, wenn die Faltung aus zeilenErkennen
	 * fiele.
	 */
	const siebenundzwanzig = [
		...Array.from({ length: 12 }, (_, nummer) => `Beet ${nummer + 1} jäten`),
		'',
		...Array.from({ length: 12 }, (_, nummer) => `Tunnel ${nummer + 1} lüften`),
		'   \t ',
		'​​',
	];
	const erkannteZeilen = zeilenErkennen(siebenundzwanzig.join('\n'));
	pruefenGleich(
		'27 Zeilen, davon drei leere, ergeben 24 erkannte Aufgaben',
		String(erkannteZeilen.length),
		'24'
	);
	pruefen(
		'und die Faltung greift auch hier — kein doppelter Leerraum überlebt',
		erkannteZeilen.every((zeile) => zeile === zeile.trim() && !/\s\s/.test(zeile)),
		erkannteZeilen.find((zeile) => zeile !== zeile.trim() || /\s\s/.test(zeile)) ?? '(keine)'
	);

	const planFehlersatzTag = /<p\b[^>]*\bid="plan-fehler"[^>]*>/.exec(planCode)?.[0] ?? '';
	pruefen(
		'der Fehlersatz auf /monatsplan ist eine immer vorhandene Live-Region',
		/class="fehler live"/.test(planFehlersatzTag) &&
			/aria-live=/.test(planFehlersatzTag) &&
			!/\{#if fehler/.test(planCode),
		planFehlersatzTag === '' ? 'kein <p id="plan-fehler"> gefunden' : planFehlersatzTag
	);

	/*
	 * Der Fokusgriff auf die Überschrift. Das `tabindex="-1"` sieht an einem <h1>
	 * wie ein Versehen aus: ohne es ist focus() ein stiller Leerlauf, und der
	 * Schrittwechsel bliebe für einen Screenreader stumm. Es gehört darum mit
	 * bind:this und dem Aufruf in **eine** Behauptung.
	 */
	const planTitelTag = /<h1\b[^>]*class="seitentitel"[^>]*>/.exec(planCode)?.[0] ?? '';
	pruefen(
		'die Überschrift trägt tabindex="-1" und bind:this, und der Schrittwechsel holt den Fokus',
		/tabindex="-1"/.test(planTitelTag) &&
			/bind:this=\{titelKasten\}/.test(planTitelTag) &&
			/titelKasten\?\.focus\(\)/.test(planCode) &&
			/'Prüfen'/.test(planCode),
		planTitelTag === '' ? 'kein <h1 class="seitentitel"> gefunden' : planTitelTag
	);

	const planSperre = [
		['let imFlug = $state(false)', /\blet imFlug = \$state\(false\);/.test(planCode)],
		['cancel() im Rückruf', /\bcancel\(\);/.test(planCode)],
		[
			'disabled am primären Knopf',
			/<button[^>]*class="button-primary"[^>]*disabled=\{imFlug/.test(schrittZwei),
		],
		/*
			Die Zusage ist nicht „try steht vor update", sondern „update läuft im
			try, und das finally gibt die Sperre zurück". Die erste Fassung prüfte
			die Nachbarschaft der zwei Zeilen und wurde rot, als das Abfangen eines
			Wurfs dazwischentrat — ohne dass die Zusage gebrochen war.
		*/
		[
			'try/finally um update()',
			/try \{[\s\S]*?await update\([\s\S]*?\} finally \{\s*imFlug = false;/.test(planCode),
		],
	] as const;
	pruefen(
		'/monatsplan trägt die Doppelsperre vollständig — die drei zusammen sind sie, einzeln nicht',
		fehlendeTeile(planSperre).length === 0,
		`fehlt: ${fehlendeTeile(planSperre).join(', ')}`
	);

	/*
	 * `Weiter` ist ein type="button" ohne Formular: ohne JavaScript tut er nichts,
	 * und es entsteht **nichts** — die richtige Ausfallrichtung, benannt
	 * akzeptiert. Ein type="submit" hier wäre eine stille Teil-Anlage.
	 *
	 * Gesperrt aus **drei** Gründen, und alle drei stehen in einer Behauptung:
	 * keine Zeile, mehr Zeilen als PLAN_HOECHSTZAHL, kein brauchbares Datum.
	 * Fiele einer davon, käme die Person bis in den Prüfschritt und erst der POST
	 * wiese ab — bei den Zeilen mit einer Liste von 500 Einträgen vor sich, beim
	 * Datum mit einem Satz, der mitten in einer Präposition endet.
	 */
	const weiterTeile = [
		[
			'type="button" ohne Formular',
			/<button class="button-primary" type="button" disabled=\{weiterGesperrt\}/.test(
				schrittEins
			) && !/<form\b/.test(schrittEins),
		],
		[
			'gesperrt ohne Zeile, über der Höchstzahl, ohne Datum und ausser Reichweite',
			/const weiterGesperrt = \$derived\(\s*erkannt\.length === 0 \|\| zuVieleZeilen \|\| faelligAm === null \|\| !datumImFenster\s*\);/.test(
				planCode
			),
		],
		[
			'die Höchstzahl kommt aus dem geteilten Modul und nicht als Zahl',
			/import \{[^}]*PLAN_HOECHSTZAHL[^}]*\} from '\$lib\/aufgabentext';/.test(planCode) &&
				/erkannt\.length > PLAN_HOECHSTZAHL/.test(planCode),
		],
	] as const;
	pruefen(
		'`Weiter` steht ausserhalb jedes Formulars und sperrt aus allen drei Gründen',
		fehlendeTeile(weiterTeile).length === 0,
		`fehlt: ${fehlendeTeile(weiterTeile).join(', ')}`
	);

	/*
	 * Der primäre Knopf des Prüfschritts sperrt bei **null** verbliebenen Zeilen.
	 *
	 * Die Doppelsperre-Behauptung oben liest nur `disabled={imFlug` und bliebe
	 * grün, wenn der zweite Teil der Bedingung fiele. Dann trüge der Knopf
	 * `0 Aufgaben ablegen` und schickte einen Stapel ohne Zeilen — die action
	 * wiese ihn ab, aber die Person liefe erst in einen Fehlersatz, wo der Knopf
	 * gar nichts hätte anbieten dürfen.
	 */
	pruefen(
		'der primäre Knopf des Prüfschritts sperrt, wenn alle Zeilen entfernt sind',
		/<button[^>]*class="button-primary"[^>]*disabled=\{imFlug \|\| zeilenListe\.length === 0\}/.test(
			schrittZwei
		),
		schrittZwei.slice(Math.max(0, schrittZwei.indexOf('button-primary') - 40), 200)
	);

	/*
	 * `Zurück zum Text` und die Zusage, die daran hängt: das Textfeld bleibt
	 * unverändert, und die entfernten Zeilen sind wieder da.
	 *
	 * Getragen wird sie von zwei Stellen zugleich, darum stehen sie in **einer**
	 * Behauptung: `zurueck` wechselt nur den Schritt und rührt weder `planText`
	 * noch `zeilenListe` an, und `weiter` baut die Prüfliste bei jedem Hingang
	 * **neu** aus dem Textfeld. Fiele eine der beiden, käme die Person mit einer
	 * gestutzten Liste zurück, ohne dass ihr Text sich geändert hätte — und
	 * hätte keinen Weg mehr, die entfernte Zeile wiederzubekommen.
	 *
	 * Ein `type="button"` und `button-quiet`: der Knopf verlässt die Seite nicht
	 * und ist nicht der primäre dieses Schritts.
	 */
	const zurueckTeile = [
		[
			'der Knopf mit onclick={zurueck}',
			/<button class="button-quiet" type="button" disabled=\{imFlug\} onclick=\{zurueck\}/.test(
				schrittZwei
			) && />Zurück zum Text</.test(schrittZwei),
		],
		[
			'zurueck quittiert den alten Ausgang und wechselt sonst nur den Schritt',
			/function zurueck\(\): void \{\s*quittieren\(\);\s*void schrittWechseln\(1\);\s*\}/.test(
				planCode
			),
		],
		[
			'weiter baut die Prüfliste neu aus dem Textfeld',
			/zeilenListe = erkannt\.map\(/.test(planCode),
		],
	] as const;
	pruefen(
		'`Zurück zum Text` lässt den Text stehen und bringt die entfernten Zeilen zurück',
		fehlendeTeile(zurueckTeile).length === 0,
		`fehlt: ${fehlendeTeile(zurueckTeile).join(', ')}`
	);

	/*
	 * **Der Fehlersatz wird quittiert.**
	 *
	 * `form` ist eine Eigenschaft und lässt sich nicht zurücksetzen; ohne das Flag
	 * wäre der Satz unlöschbar und stünde als `role="alert"` über einem Inhalt,
	 * den die Person längst korrigiert hat: abweisen lassen, zurückgehen, Zeile
	 * kürzen, `Weiter` — und der alte Satz steht immer noch da.
	 *
	 * Die vier Teile tragen die Zusage zusammen: das Flag, die Ableitung durch
	 * das Flag hindurch, die zwei Felder, die bei jeder Eingabe quittieren, und
	 * das Zurücksetzen vor dem nächsten Versand. Fiele das letzte, bliebe ein
	 * wortgleicher zweiter Fehlschlag stumm.
	 */
	const quittungTeile = [
		['let quittiert = $state(false)', /\blet quittiert = \$state\(false\);/.test(planCode)],
		[
			'der Satz hängt am Flag',
			/const fehlschlag = \$derived\(\s*!quittiert && form !== null && form\.art === 'fehler' \? form : null\s*\);/.test(
				planCode
			),
		],
		[
			'beide Felder quittieren bei einer Eingabe',
			(planCode.match(/oninput=\{quittieren\}/g) ?? []).length === 2,
		],
		[
			'weiter quittiert vor dem Wechsel',
			/function weiter\(\): void \{\s*quittieren\(\);/.test(planCode),
		],
		[
			'und vor dem Versand geht das Flag zurück',
			/imFlug = true;\s*quittiert = false;/.test(planCode),
		],
	] as const;
	pruefen(
		'der Fehlersatz auf /monatsplan wird quittiert und steht nicht über korrigiertem Inhalt',
		fehlendeTeile(quittungTeile).length === 0,
		`fehlt: ${fehlendeTeile(quittungTeile).join(', ')}`
	);

	/*
	 * **Das Entfernen der letzten Zeile lässt den Fokus nicht fallen**, und der
	 * Prüfschritt hat einen leeren Zustand.
	 *
	 * Das `×` zerstört sich beim Drücken selbst; ohne den Griff fiele der Fokus
	 * auf den Seitenrumpf, und wer vier Zeilen hintereinander entfernen will,
	 * hangelt sich jedes Mal neu durch die Seite. Derselbe Stolperer, den
	 * schrittWechseln für den Schrittwechsel schon abfängt.
	 *
	 * Und bei null verbliebenen Zeilen sagt ein Satz, wo der Weg hinaus ist —
	 * sonst stünde dort ein gesperrter Knopf über einer leeren Liste.
	 */
	const entfernenTeile = [
		[
			'der Nachfolger an derselben Stelle bekommt den Fokus',
			/const nachfolger = zeilenListe\[stelle\] \?\? zeilenListe\[stelle - 1\];/.test(planCode) &&
				/document\.getElementById\(`plan-entfernen-\$\{nachfolger\.id\}`\)\?\.focus\(\)/.test(
					planCode
				),
		],
		[
			'und die Überschrift, wenn keine Zeile mehr übrig ist',
			/if \(nachfolger === undefined\) \{\s*titelKasten\?\.focus\(\);/.test(planCode),
		],
		[
			'der leere Zustand nennt den Weg hinaus',
			/\{#if zeilenListe\.length === 0\}\s*<p class="leer">[^<]*Zurück zum Text[^<]*<\/p>/.test(
				schrittZwei
			),
		],
		[
			'und der Zwischentext endet nie in einer Präposition',
			/if \(zeilenListe\.length === 0\) return 'Keine Aufgabe mehr übrig\.';/.test(planCode) &&
				/faelligLang === ''\s*\?\s*`\$\{anzahl\}, noch ohne Frist`/.test(planCode),
		],
	] as const;
	pruefen(
		'das Entfernen lässt den Fokus nicht fallen, und der leere Prüfschritt sagt, wie es weitergeht',
		fehlendeTeile(entfernenTeile).length === 0,
		`fehlt: ${fehlendeTeile(entfernenTeile).join(', ')}`
	);

	/*
	 * **Die Seite sagt, dass sie JavaScript braucht.**
	 *
	 * Die sichere Hälfte der Zusage ist gebaut — `Weiter` ist ein `type="button"`
	 * ohne Formular, es entsteht **nichts** —, aber /mehr bietet den Eintrag seit
	 * dieser Story allen an. Ohne diesen Satz tippte jemand vierzig Zeilen und
	 * drückte einen Knopf, der nichts tut. Das `<noscript>` ist das einzige im
	 * ganzen Baum; die Behauptung nagelt es an dieser Seite fest.
	 */
	const noscriptTeile = [
		['ein <noscript> auf dieser Seite', /<noscript>/.test(planCode)],
		['es sagt, dass JavaScript fehlt', /Diese Seite braucht JavaScript\./.test(planCode)],
		['und nennt den Weg, der ohne geht', /\+ Aufgabe/.test(planCode)],
	] as const;
	pruefen(
		'/monatsplan sagt ohne JavaScript, was gilt und was stattdessen geht',
		fehlendeTeile(noscriptTeile).length === 0,
		`fehlt: ${fehlendeTeile(noscriptTeile).join(', ')}`
	);

	// -----------------------------------------------------------------------
	// /monatsplan: keine Identität, keine Zuständigkeit
	// -----------------------------------------------------------------------
	const planIdentitaet = /\b(locals|mitglied|zustaendig|zuständig)/i;
	const planIdentitaetFund = [
		planIdentitaet.exec(planCode)?.[0],
		planIdentitaet.exec(planServer)?.[0],
	].filter((treffer) => treffer !== undefined);
	pruefen(
		'auf /monatsplan kommt keine Identität vor — ein Monatsplan ist namenlos',
		planIdentitaetFund.length === 0,
		`gefunden: ${planIdentitaetFund.join(', ')}`
	);

	// -----------------------------------------------------------------------
	// /mehr: der Eintrag gilt allen, und der leere Zustand ist fort
	// -----------------------------------------------------------------------
	const mehrCode = kommentarfrei(
		readFileSync(join(wurzel, 'src', 'routes', 'mehr', '+page.svelte'), 'utf8')
	);
	const verwaltungsVon = mehrCode.indexOf('{#if data.istAdmin}');
	pruefen(
		'`Monatsplan ablegen` steht auf /mehr vor dem {#if data.istAdmin} und gilt damit allen',
		verwaltungsVon > 0 &&
			/<a class="eintrag" href=\{resolve\('\/monatsplan'\)\}>Monatsplan ablegen<\/a>/.test(
				mehrCode.slice(0, verwaltungsVon)
			) &&
			/<a class="eintrag" href=\{resolve\('\/verwaltung'\)\}>Verwaltung<\/a>/.test(
				mehrCode.slice(verwaltungsVon)
			),
		verwaltungsVon < 0 ? 'kein {#if data.istAdmin} gefunden' : mehrCode.slice(0, verwaltungsVon)
	);
	/*
	 * Festgenagelt wird der **leere Zustand**, nicht die Syntax. Eine frühere
	 * Fassung verbot zusätzlich jeden `{:else}`-Zweig auf /mehr — auch einen, der
	 * mit dem leeren Zustand nichts zu tun hätte. Eine Behauptung, die mehr
	 * verbietet, als sie zusagt, wird beim nächsten roten Lauf abgeschwächt statt
	 * gelesen.
	 */
	pruefen(
		'und `Nichts zu verwalten.` ist fort — die Liste ist nie mehr leer',
		!/Nichts zu verwalten/.test(mehrCode) && !/class="leer"/.test(mehrCode),
		mehrCode.slice(verwaltungsVon < 0 ? 0 : verwaltungsVon, 400)
	);

	// =======================================================================
	// / — Story 2.2: überfällige Aufgaben erkennen.
	//
	// Jede Zeile der I/O-Matrix ausgeführt. Der Block sät Aufgaben mit
	// Zeitstempeln von bis zu 60 Tagen; die stehen nach created_at **vor** allen
	// bisher gesäten. Bis zur Triage vom 2026-08-28 hing daran seine Position:
	// weiter oben eingefügt machte er die Sortierbehauptungen der Stories 1.4
	// und 1.5 rot, ohne dass an der Sortierung etwas falsch wäre. Seither
	// fragen jene Ketten über `dreiGesaete`/`fuenfGesaete` nur noch nach ihren
	// eigenen Zeilen — dieselbe Vorkehrung, die dieser Block mit `gesaeteIds`
	// schon traf. **Der Block darf jetzt überall stehen, und der nächste, der
	// alte Zeitstempel sät, ebenfalls.**
	//
	// Gemessen wird zweimal, und die zwei Messungen haben verschiedene Aufgaben:
	//
	//   - **gegen offeneAufgabenAuflisten mit fester Uhr**: dort ist jede Zeile
	//     der Matrix auf die Sekunde genau prüfbar, insbesondere die Schwelle
	//     selbst. Es ist derselbe Codeweg, den die load nimmt — sie gibt nichts
	//     hinein als diese eine Zahl.
	//   - **gegen die load von /**: dort läuft die echte Uhr. Ihre Sekunde lässt
	//     sich nicht festhalten, und tickt sie zwischen dem Säen und dem Laden
	//     über die Grenze, wäre eine Behauptung „genau an der Schwelle → null"
	//     gelegentlich rot, ohne dass etwas kaputt ist. Alle Zeilen hier liegen
	//     darum fern jeder Wochengrenze; die eine, die es nicht kann, trägt eine
	//     ausdrücklich benannte Toleranz.
	//
	// Zwei Zeilen der Matrix — „in dieser Sitzung abgehakt" und „in derselben
	// Sitzung wieder geöffnet" — sind Verhalten im Browser und von keinem
	// ausgeführten Werkzeug dieses Projekts gedeckt (deferred-work.md). Sie
	// hängen an genau einer Textstelle und stehen darum als **Textprüfung** am
	// Ende dieses Blocks, ausdrücklich als solche benannt.
	// =======================================================================
	/*
	 * Der Tag wird aus der **importierten** Woche abgeleitet und nicht als
	 * `24 * 60 * 60` daneben geschrieben. Der Grund ist derselbe, den der
	 * Importkommentar oben für die Schwelle nennt: eine Grösse, die in zeit.ts
	 * schon steht, ein zweites Mal hier zu deklarieren, ist eine zweite Wahrheit.
	 * Die Matrixzeilen sind darum in Wochen und in daraus gerechneten Tagen gesät.
	 */
	const TAG_SEKUNDEN = WOCHE_SEKUNDEN / 7;

	/*
	 * wochenOffenSeit an **festen** Zeitpunkten — der einzige Ort, an dem die
	 * strikte Grenze auf die Sekunde prüfbar ist.
	 *
	 * Die Erwartungswerte stehen als Literale da und kommen nicht aus der
	 * geprüften Funktion. Die 3 in der zweiten Zeile ist zugleich die Begründung
	 * dafür, dass `seit N Wochen überfällig` keine Beugungsregel braucht: sie ist der
	 * **kleinste** mögliche Rückgabewert, ein Singular kann nicht auftreten.
	 * Gemessen, nicht vermutet: ersetzt man das `<=` in wochenOffenSeit durch ein
	 * `<`, wird die erste Zeile rot — genau an der Schwelle ist eine Aufgabe noch
	 * nicht überfällig.
	 */
	const PROBE_JETZT = Math.floor(Date.UTC(2026, 7, 28, 12) / 1000);
	for (const [wie, bezug, soll] of [
		['genau an der Schwelle mit null', PROBE_JETZT - UEBERFAELLIG_SEKUNDEN, null],
		['eine Sekunde darüber mit 3', PROBE_JETZT - UEBERFAELLIG_SEKUNDEN - 1, 3],
		['bei negativer Differenz mit null', PROBE_JETZT + 5 * TAG_SEKUNDEN, null],
	] as const) {
		pruefenGleich(`wochenOffenSeit antwortet ${wie}`, wochenOffenSeit(bezug, PROBE_JETZT), soll);
	}

	/*
	 * Die Saat: sieben offene Aufgaben, eine erledigte.
	 *
	 * Der Bezug ist einmal created_at und einmal due_at, und zwei Zeilen fahren
	 * beide gegeneinander aus: `planVorFrist` liegt 29 Tage, ist aber erst in
	 * fünf Tagen fällig (die Monatsplan-Ausnahme), und `planNachFrist` liegt 60
	 * Tage bei einer Fälligkeit vor 25 — dort muss 3 herauskommen und nicht 8,
	 * sonst gewinnt created_at über due_at.
	 *
	 * `BEZUG_1990` ist **unabhängig** gerechnet und kommt nicht aus
	 * tagesendeInUnixSekunden: der 1. Januar 1990 liegt in der Winterzeit
	 * (UTC+1), sein Tagesende 23:59:59 Ortszeit ist also 22:59:59 UTC. Über die
	 * Funktion gerechnet läse diese Behauptung nur ihre eigene Vorbereitung.
	 */
	const jetztFest = Math.floor(Date.now() / 1000);
	const BEZUG_1990 = Math.floor(Date.UTC(1990, 0, 1, 22, 59, 59) / 1000);
	const wochen1990 = Math.floor((jetztFest - BEZUG_1990) / WOCHE_SEKUNDEN);

	const anSchwelle = aufgabeSaen('Beet 4 hacken', jetztFest - UEBERFAELLIG_SEKUNDEN);
	const knappDarueber = aufgabeSaen('Beet 5 hacken', jetztFest - UEBERFAELLIG_SEKUNDEN - 1);
	const vierteWoche = aufgabeSaen('Himbeeren aufbinden', jetztFest - 4 * WOCHE_SEKUNDEN);
	const ohneFrist = aufgabeSaen('Schnecken sammeln', jetztFest - 30 * TAG_SEKUNDEN);
	const planVorFrist = aufgabeSaen(
		'Zwiebeln stecken',
		jetztFest - 29 * TAG_SEKUNDEN,
		jetztFest + 5 * TAG_SEKUNDEN
	);
	const planNachFrist = aufgabeSaen(
		'Hecke schneiden',
		jetztFest - 60 * TAG_SEKUNDEN,
		jetztFest - 25 * TAG_SEKUNDEN
	);
	const vertipptesJahr = aufgabeSaen('Rasen mähen', jetztFest - 5 * TAG_SEKUNDEN, BEZUG_1990);
	const laengstErledigt = aufgabeSaen('Kürbis ernten, Beet 1', jetztFest - 40 * TAG_SEKUNDEN);
	/*
	 * Die erledigte Zeile bekommt ihre zwei Spalten direkt und nicht über
	 * aufgabeAbhaken: die action setzte den Zeitstempel auf **jetzt**, und die
	 * Zeile wäre dann eine gerade erledigte statt einer, die seit 40 Tagen läge.
	 * Gate-Regel 9 verbietet den direkten Zugriff nur unter src/routes/.
	 *
	 * **Beide** Spalten, und das ist keine Sorgfaltsübung: aufgabeAbhaken setzt in
	 * Produktion immer completed_by **und** completed_at, ein Zustand mit nur
	 * einem der beiden kommt in der Anwendung nicht vor. Mit leerem completed_by
	 * wäre die Behauptung „eine erledigte Aufgabe steht gar nicht in der Liste"
	 * auch gegen eine Abfrage grün, die versehentlich auf completed_by filtert —
	 * sie prüfte dann einen Zustand, den es nicht gibt.
	 */
	datenbank()
		.update(tasks)
		.set({ completedBy: nico.id, completedAt: jetztFest - 30 * TAG_SEKUNDEN })
		.where(eq(tasks.id, laengstErledigt))
		.run();

	const mitFesterUhr = new Map(
		offeneAufgabenAuflisten(jetztFest).map((zeile) => [zeile.id, zeile.wochenOffen])
	);
	for (const [wie, id, soll] of [
		['genau an der Schwelle keine Zahl trägt', anSchwelle, null],
		['eine Sekunde darüber bei 3 anfängt', knappDarueber, 3],
		['in der vollen vierten Woche 4 sagt', vierteWoche, 4],
		['ohne Frist ab created_at zählt', ohneFrist, 4],
		['mit Fälligkeit in der Zukunft keine Zahl trägt', planVorFrist, null],
		['nach der Fälligkeit ab due_at zählt und nicht ab created_at', planNachFrist, 3],
		['ein vertipptes Jahr ungekappt durchreicht', vertipptesJahr, wochen1990],
	] as const) {
		pruefenGleich(`offeneAufgabenAuflisten ${wie}`, mitFesterUhr.get(id), soll);
	}
	/*
	 * Der erste Konjunkt von AD-8, und die Behauptung prüft **auch ihre eigene
	 * Vorbereitung**: dass die Zeile wirklich in dem Zustand steht, den
	 * aufgabeAbhaken in Produktion herstellt. Ohne diesen ersten Punkt liesse sich
	 * die Saat still auf einen unmöglichen Zustand verkürzen (nur completed_at),
	 * und die Zeile behauptete etwas über eine Zeile, die es so nie gibt.
	 */
	const erledigteZeile = aufgabeLesen(laengstErledigt);
	const erledigtTeile = [
		[
			'die Saat trägt beide Erledigt-Spalten, wie aufgabeAbhaken sie setzt',
			erledigteZeile?.completedBy === nico.id &&
				erledigteZeile?.completedAt === jetztFest - 30 * TAG_SEKUNDEN,
		],
		['und die Zeile steht nicht in der Liste', !mitFesterUhr.has(laengstErledigt)],
	] as const;
	pruefen(
		'eine erledigte Aufgabe steht gar nicht in der Liste — der erste Konjunkt von AD-8',
		fehlendeTeile(erledigtTeile).length === 0,
		`verletzt: ${fehlendeTeile(erledigtTeile).join(', ')}`
	);
	/*
	 * Die Kappung, die es nicht gibt. Ohne diese Zeile wäre ein
	 * `Math.min(wochen, 52)` in wochenOffenSeit grün, solange die Tabelle oben nur
	 * gegen `wochen1990` vergleicht — die absurde Zahl **ist** das Diagnosesignal
	 * für ein vertipptes Jahresfeld, und eine Obergrenze liesse einen Stapel von
	 * 1990 aussehen wie einen, der 14 Monate liegt.
	 */
	pruefen(
		'und die Zahl aus dem vertippten Jahr liegt über 1800 Wochen',
		wochen1990 > 1800,
		`${wochen1990} Wochen`
	);

	/*
	 * **Die Sortierung reagiert nicht auf Überfälligkeit.** Die sieben Ids laufen
	 * in der Einfügereihenfolge aufsteigend, ihre created_at aber in einer ganz
	 * anderen — und die zwei Zeilen ohne Zahl (anSchwelle, planVorFrist) stehen
	 * mitten drin. „Überfällige zuerst" und „nach Id" sind damit beide rot.
	 * Geprüft wird nur die relative Reihenfolge der hier gesäten Zeilen; die
	 * älteren aus den Blöcken davor stehen dahinter und gehören nicht zur Zusage.
	 */
	const gesaeteIds = new Set([
		anSchwelle,
		knappDarueber,
		vierteWoche,
		ohneFrist,
		planVorFrist,
		planNachFrist,
		vertipptesJahr,
	]);
	pruefenGleich(
		'überfällige Zeilen stehen an ihrem nach created_at sortierten Platz, nicht oben',
		offeneAufgabenAuflisten(jetztFest)
			.map((zeile) => zeile.id)
			.filter((id) => gesaeteIds.has(id))
			.join(' | '),
		`${planNachFrist} | ${ohneFrist} | ${planVorFrist} | ${vierteWoche} | ${knappDarueber} | ${anSchwelle} | ${vertipptesJahr}`
	);

	// -----------------------------------------------------------------------
	// Dieselben Zeilen, gemessen an der echten Uhr der load
	// -----------------------------------------------------------------------
	const ueberfaelligLaden = await startseiteLadenAn('/');
	const nachUeberfaelligLoad = Math.floor(Date.now() / 1000);
	const ausLoad = new Map(
		((wertVon(ueberfaelligLaden).aufgaben ?? []) as { id: number; wochenOffen?: unknown }[]).map(
			(zeile) => [zeile.id, zeile.wochenOffen]
		)
	);
	pruefenGleich(
		'die load von / reicht wochenOffen heraus — dieselben Zahlen an der echten Uhr',
		[knappDarueber, vierteWoche, ohneFrist, planVorFrist, planNachFrist]
			.map((id) => `${id}:${JSON.stringify(ausLoad.get(id))}`)
			.join(' | '),
		[
			`${knappDarueber}:3`,
			`${vierteWoche}:4`,
			`${ohneFrist}:4`,
			`${planVorFrist}:null`,
			`${planNachFrist}:3`,
		].join(' | ')
	);
	/*
	 * Die eine Zeile mit einer **benannten** Toleranz, und sie ist so schmal wie
	 * möglich: steht die Uhr der load noch auf derselben Sekunde wie die Saat, ist
	 * `null` die einzige zugelassene Antwort. Erst wenn nachweislich eine Sekunde
	 * getickt ist, kommt die 3 dazu — dann ist sie richtig. Die exakte Grenze
	 * belegen die drei Aufrufe von wochenOffenSeit oben und die feste Uhr darüber;
	 * hier soll sie nur nicht als Zufallsprobe stehen.
	 */
	const erlaubtSchwelle: unknown[] = nachUeberfaelligLoad === jetztFest ? [null] : [null, 3];
	pruefen(
		'und die Zeile an der Schwelle trägt auch dort keine Zahl',
		erlaubtSchwelle.includes(ausLoad.get(anSchwelle)),
		`war ${JSON.stringify(ausLoad.get(anSchwelle))}, erlaubt ${JSON.stringify(erlaubtSchwelle)} — gesät bei ${jetztFest}, geladen bis ${nachUeberfaelligLoad}`
	);
	pruefen(
		'und die Seitendaten tragen weiterhin weder completed_by noch completed_at',
		!nenntErledigt(wertVon(ueberfaelligLaden)),
		JSON.stringify(wertVon(ueberfaelligLaden)).slice(0, 160)
	);

	// =======================================================================
	// /dienstplan und der Diensthinweis auf / — Story 3.1.
	//
	// Drei Schichten, jede eigens: die ISO-Wochenrechnung als reine Funktion,
	// die Abfrageschicht gegen dieselbe Datenbank, und die zwei Routen darüber.
	//
	// Die Wochenrechnung steht zuerst und ohne Datenbank, weil alles darunter
	// auf ihr steht: wäre sie am Jahreswechsel um eine Woche daneben, würden die
	// Behauptungen über Besetzen und Diensthinweis **trotzdem grün** — sie
	// besetzten und läsen dann eben einträchtig die falsche Woche. Ein
	// Prüfblock, dessen Fehler sich selbst deckt, prüft nichts.
	// =======================================================================
	const dienstplan = await dienstplanLaden();

	/*
	 * Feste Zeitpunkte statt `Date.now()`.
	 *
	 * Die Wochenrechnung ist die eine Stelle dieses Projekts, an der ein Lauf am
	 * falschen Tag ein anderes Ergebnis gäbe — und der interessante Fall, der
	 * Jahreswechsel, tritt an genau vier Tagen im Jahr ein. Eine Prüfliste, die
	 * ihn nur dann sieht, sieht ihn nie.
	 *
	 * Die Werte sind Mittagszeitpunkte in UTC: in Europe/Zurich ist das derselbe
	 * Kalendertag, im Sommer wie im Winter, und die Zeile sagt damit genau das,
	 * was sie behauptet.
	 */
	const mittagsAm = (iso: string) => Math.floor(Date.parse(`${iso}T12:00:00Z`) / 1000);

	const wochenTeile = [
		/*
		 * Der Jahreswechsel, in beide Richtungen. ISO-Woche 1 ist die Woche mit
		 * dem ersten Donnerstag; daraus folgen die zwei Fälle, an denen eine naive
		 * Rechnung scheitert: ein Januartag, der noch zum Vorjahr zählt, und ein
		 * Dezembertag, der schon zum Folgejahr zählt.
		 */
		[
			'1.1.2027 (Freitag) gehört zur Woche 53 des ISO-Jahres 2026',
			JSON.stringify(isoWocheVon(mittagsAm('2027-01-01'))) === '{"jahr":2026,"woche":53}',
		],
		[
			'30.12.2019 (Montag) gehört schon zur Woche 1 von 2020',
			JSON.stringify(isoWocheVon(mittagsAm('2019-12-30'))) === '{"jahr":2020,"woche":1}',
		],
		[
			'1.1.2023 (Sonntag) gehört noch zur Woche 52 von 2022',
			JSON.stringify(isoWocheVon(mittagsAm('2023-01-01'))) === '{"jahr":2022,"woche":52}',
		],
		/*
		 * **Die Zone entscheidet, nicht UTC.** Montag 00:30 Ortszeit ist in UTC
		 * noch Sonntag 22:30. Ohne Zonenrechnung zeigte der Diensthinweis in der
		 * Nacht zum Montag noch die Woche davor — und niemand bemerkte es, weil
		 * um halb eins nachts niemand den Dienstplan öffnet. Die Gegenprobe eine
		 * Stunde davor gehört dazu: eine Rechnung, die **immer** die neue Woche
		 * nennt, erfüllte die erste Zeile allein.
		 */
		[
			'Montag 00:30 Ortszeit zählt schon zur neuen Woche',
			isoWocheVon(Math.floor(Date.parse('2026-08-30T22:30:00Z') / 1000)).woche === 36,
		],
		[
			'Sonntag 23:30 Ortszeit zählt noch zur alten — die Gegenprobe',
			isoWocheVon(Math.floor(Date.parse('2026-08-30T21:30:00Z') / 1000)).woche === 35,
		],
		/* 2026 ist ein 53-Wochen-Jahr, 2025 keines. */
		['2026 hat 53 Wochen', wochenImJahr(2026) === 53],
		['2025 hat 52 — die Gegenprobe', wochenImJahr(2025) === 52],
		/*
		 * istWoche ist die Formschranke der action. Woche 53 gibt es in 2026 und
		 * nicht in 2025; wer nur `woche <= 53` prüfte, liesse die zweite durch.
		 */
		['Woche 53/2026 gibt es', istWoche({ jahr: 2026, woche: 53 })],
		['Woche 53/2025 gibt es nicht', !istWoche({ jahr: 2025, woche: 53 })],
		['Woche 0 gibt es nirgends', !istWoche({ jahr: 2026, woche: 0 })],
		/*
		 * Die Faltung. Sie steht in zeit.ts, weil Server und Komponente denselben
		 * Schlüssel bilden müssen — die abgewiesene Zeile reist als **eine** Zahl.
		 */
		[
			'der Wochenschlüssel faltet Jahr und Woche',
			wochenSchluessel({ jahr: 2026, woche: 36 }) === 202636,
		],
		[
			'und er ist über den Jahreswechsel hinweg monoton',
			wochenSchluessel({ jahr: 2026, woche: 53 }) < wochenSchluessel({ jahr: 2027, woche: 1 }),
		],
		[
			'das Wochendatum nennt Montag und Sonntag',
			wochendatum({ jahr: 2026, woche: 36 }) === '31. August bis 6. September',
		],
		[
			'und es reicht über den Jahreswechsel',
			wochendatum({ jahr: 2026, woche: 53 }) === '28. Dezember bis 3. Januar',
		],
	] as const;
	pruefen(
		'die ISO-Wochenrechnung hält am Jahreswechsel und an der Zonengrenze',
		fehlendeTeile(wochenTeile).length === 0,
		`falsch: ${fehlendeTeile(wochenTeile).join(', ')}`
	);

	/*
	 * Das Fenster. Geprüft wird **die Form der Folge**, nicht eine feste Zahl:
	 * drei Monate sind je nach Startpunkt 13 oder 14 Wochen, und eine
	 * festgenagelte 13 hier wäre eine zweite Wahrheit über eine Rechnung, die
	 * bewusst kalenderverankert ist. (Der Kommentar sagte bis zur Review von
	 * Story 3.1 „12 bis 14" und widersprach damit der Behauptung zwei Zeilen
	 * darunter, die 13 als Untergrenze führt.)
	 *
	 * Der Startpunkt liegt im November, damit die Folge **über den Jahreswechsel**
	 * läuft — dort scheitert eine Rechnung, die einfach die Wochennummer
	 * hochzählt, statt in Tagen zu gehen.
	 */
	const fensterAm = mittagsAm('2026-11-15');
	const fenster = wochenfenster(fensterAm);
	/*
	 * Die Montage in Tagen. Sie kommen aus montagDerWoche in zeit.ts und werden
	 * hier **nicht** nachgerechnet: eine zweite Wochenrechnung im Prüfskript wäre
	 * genau die zweite Wahrheit, gegen die das Modul steht — und sie könnte
	 * denselben Fehler machen wie die geprüfte und ihn damit decken.
	 */
	const montage = fenster.map((eintrag) => montagDerWoche(eintrag) / TAG_SEKUNDEN);
	/*
	 * Dasselbe Fenster, vom **Montag** derselben Woche aus gefragt. Der
	 * Bezugszeitpunkt kommt aus montagDerWoche und nicht aus einer eigenen
	 * Rechnung — dieselbe Regel wie bei den Montagen darüber.
	 */
	const fensterVomMontag = wochenfenster(montagDerWoche(isoWocheVon(fensterAm)) + 12 * 60 * 60);
	const fensterTeile = [
		[
			'es beginnt mit der laufenden Woche',
			wochenSchluessel(fenster[0] ?? { jahr: 0, woche: 0 }) ===
				wochenSchluessel(isoWocheVon(fensterAm)),
		],
		['drei Monate ergeben 13 oder 14 Wochen', fenster.length >= 13 && fenster.length <= 14],
		/*
		 * **Keine Lücke und keine Dublette — die Zeile, die den Jahreswechsel
		 * wirklich prüft.** Die Wochennummer springt dort von 53 auf 1; ein
		 * Vergleich der Nummern fiele darauf herein, ein Vergleich der Montage in
		 * Tagen nicht.
		 */
		[
			'zwischen zwei aufeinanderfolgenden Wochen liegen genau sieben Tage',
			montage.every((tag, i) => i === 0 || tag - (montage[i - 1] ?? tag) === 7),
		],
		['es läuft über den Jahreswechsel', fenster.some((eintrag) => eintrag.jahr === 2027)],
		/*
		 * **Die Verankerung am Montag, gemessen statt begründet.** Der 15.11.2026
		 * ist ein Sonntag; `fensterVomMontag` fragt vom Montag derselben Woche.
		 * Beide Aufrufe müssen dieselbe Folge geben — sonst hängt die Grenze am
		 * Wochentag des Aufrufs, und der Plan würde im Lauf einer Woche kürzer,
		 * ohne dass jemand etwas getan hätte.
		 *
		 * Die benannte Mutation (Fenster wieder an heute verankert) fiel schon
		 * über die 13-oder-14-Zeile. Diese hier fängt die Nachbarin, die dort
		 * durchkam: nur die **Grenze** vom Aufruftag statt vom Montag zu rechnen
		 * gab an diesem Sonntag 14 statt 13 Wochen und blieb grün.
		 */
		[
			'vom Montag derselben Woche aus gefragt kommt dieselbe Folge',
			fensterVomMontag.length === fenster.length &&
				fensterVomMontag.every(
					(eintrag, i) => wochenSchluessel(eintrag) === wochenSchluessel(fenster[i] ?? eintrag)
				),
		],
	] as const;
	pruefen(
		'das Wochenfenster ist lückenlos und reicht über den Jahreswechsel',
		fehlendeTeile(fensterTeile).length === 0,
		`falsch: ${fehlendeTeile(fensterTeile).join(', ')} (${fenster.length} Wochen)`
	);

	// -----------------------------------------------------------------------
	// Die Abfrageschicht: besetzen, ersetzen, und was ein beendeter Zugang tut
	// -----------------------------------------------------------------------
	/*
	 * Gesät wird **relativ zum Fenster**, das die Abfrage selbst nennt, und nicht
	 * auf feste Wochennummern. Eine Prüfliste mit `{ jahr: 2026, woche: 40 }`
	 * darin wäre im Oktober 2026 grün und danach für immer rot — nicht, weil
	 * etwas kaputt ginge, sondern weil das Fenster weitergewandert ist.
	 */
	const jetztFuerDienst = Math.floor(Date.now() / 1000);
	const planFenster = wochenfenster(jetztFuerDienst);
	const laufende = planFenster[0] ?? isoWocheVon(jetztFuerDienst);
	const naechste = planFenster[1] ?? laufende;
	const spaetere = planFenster[2] ?? laufende;

	/*
	 * Eine **eigene** Adminperson und eine eigene zu beendende Person für diesen
	 * Block.
	 *
	 * Der Grund ist die Reihenfolgefalle, die die Triage vom 2026-08-28 als G2
	 * benannt hat und die Story 3.0.1 schon einmal getroffen hat: Vera und Nico
	 * tragen die Behauptungen der Stories 1.3 und 1.4, und dieser Block **beendet
	 * einen Zugang** — täte er das an Nico, fielen weiter unten Behauptungen über
	 * eine aktive Mitgliederliste um, ohne dass an ihnen etwas falsch wäre.
	 */
	const tilde = mitgliedAnlegen({
		name: 'Tilde',
		inviteTokenHash: tokenHashen(tokenErzeugen()),
		isAdmin: true,
	});
	const rasmus = mitgliedAnlegen({
		name: 'Rasmus',
		inviteTokenHash: tokenHashen(tokenErzeugen()),
		isAdmin: false,
	});
	const gehende = mitgliedAnlegen({
		name: 'Gehende',
		inviteTokenHash: tokenHashen(tokenErzeugen()),
		isAdmin: false,
	});
	/*
	 * Von `gehende` gibt es bewusst **keine** locals-Attrappe: ihr Zugang wird in
	 * diesem Block beendet, und danach kommt sie am Wächter in
	 * src/hooks.server.ts gar nicht mehr vorbei. Eine Attrappe, die sie trotzdem
	 * durch eine load trüge, prüfte einen Weg, den es nicht gibt.
	 */
	const tildeLocals = ohneTokenHash(tilde);
	const rasmusLocals = ohneTokenHash(rasmus);

	/** Die Zeilen von duty_weeks zu einer Woche — für Behauptungen über die Zahl. */
	const dienstZeilen = (woche: { jahr: number; woche: number }) =>
		datenbank()
			.select()
			.from(dutyWeeks)
			.all()
			.filter(
				(zeile) =>
					zeile.art === DIENSTART_TRAENKEN &&
					zeile.isoJahr === woche.jahr &&
					zeile.isoWoche === woche.woche
			);

	/** Der Name, den der Plan für eine Woche nennt — oder null. */
	const nameInWoche = (woche: { jahr: number; woche: number }) =>
		dienstwochenLesen([woche])[0]?.name ?? null;

	pruefen(
		'der Plan gibt für jede Woche des Fensters einen Eintrag, auch die unbesetzten',
		dienstwochenLesen(planFenster).length === planFenster.length,
		`${dienstwochenLesen(planFenster).length} Einträge auf ${planFenster.length} Wochen`
	);
	pruefen(
		'und in genau der Reihenfolge, in der das Fenster sie nennt',
		dienstwochenLesen(planFenster)
			.map((eintrag) => wochenSchluessel(eintrag))
			.join('|') === planFenster.map((eintrag) => wochenSchluessel(eintrag)).join('|')
	);
	pruefenGleich('eine Woche ohne Zeile heisst niemand', nameInWoche(naechste), null);

	pruefenGleich(
		'besetzen gibt den Namen zurück',
		dienstwocheBesetzen(naechste, rasmus.id)?.name,
		'Rasmus'
	);
	pruefenGleich('und der Plan nennt ihn', nameInWoche(naechste), 'Rasmus');
	pruefenGleich('genau eine Zeile ist entstanden', dienstZeilen(naechste).length, 1);

	/*
	 * **Neu besetzen ist Ersetzen, nicht Anlegen.** Die Zahl darunter ist die
	 * eigentliche Behauptung: ohne die Eindeutigkeit über (Art, Jahr, Woche)
	 * stünden hier zwei Zeilen, der Plan zeigte eine davon, und die andere bliebe
	 * unsichtbar liegen.
	 */
	const zeileVorher = dienstZeilen(naechste)[0];
	pruefenGleich(
		'neu besetzen gibt den neuen Namen zurück',
		dienstwocheBesetzen(naechste, gehende.id)?.name,
		'Gehende'
	);
	pruefenGleich('der Plan nennt jetzt die andere Person', nameInWoche(naechste), 'Gehende');
	pruefenGleich('und es ist immer noch genau eine Zeile', dienstZeilen(naechste).length, 1);
	pruefenGleich(
		'dieselbe Zeile — kein neuer Datensatz',
		dienstZeilen(naechste)[0]?.id,
		zeileVorher?.id
	);
	pruefenGleich(
		'und ihr created_at ist unberührt geblieben',
		dienstZeilen(naechste)[0]?.createdAt,
		zeileVorher?.createdAt
	);

	pruefenGleich(
		'dieselbe Person noch einmal einzutragen gelingt und weist nicht ab',
		dienstwocheBesetzen(naechste, gehende.id)?.name,
		'Gehende'
	);

	/*
	 * **Zugang beenden macht die Woche unbesetzt — und löscht nichts.**
	 *
	 * Die zwei Behauptungen gehören zusammen und sind einzeln nichts wert: dass
	 * der Plan `null` sagt, wäre auch bei einem DELETE wahr, und dass die Zeile
	 * steht, wäre auch bei einer Anzeige des toten Namens wahr. Erst beide
	 * zusammen sind die Zusage aus den Akzeptanzkriterien.
	 */
	/*
	 * **Vor dem Beenden**: die laufende Woche geht auf dieselbe Person. Sie
	 * trägt gleich die Behauptung über eigeneDienstwoche, und die muss an einer
	 * Zeile hängen, die auf die beendete Person **zeigt** — sonst misst sie
	 * nichts. Genau das war der Fehler, den die Review von Story 3.1 gefunden
	 * hat: das Besetzen stand hinter dem Deaktivieren, war damit ein No-op, und
	 * `eigeneDienstwoche` gab null zurück, weil die Person dort nie eingetragen
	 * war — nicht, weil unbesetzt niemandes Dienst ist.
	 */
	pruefenGleich(
		'die laufende Woche geht auf dieselbe Person, solange ihr Zugang lebt',
		dienstwocheBesetzen(laufende, gehende.id)?.name,
		'Gehende'
	);

	mitgliedDeaktivieren(gehende.id);
	pruefenGleich(
		'nach dem Beenden des Zugangs steht die Woche als unbesetzt',
		nameInWoche(naechste),
		null
	);
	pruefenGleich(
		'der Datensatz bleibt aber stehen — nichts wird gelöscht',
		dienstZeilen(naechste).length,
		1
	);
	pruefenGleich(
		'und er zeigt weiterhin auf dieselbe Person',
		dienstZeilen(naechste)[0]?.memberId,
		gehende.id
	);
	pruefenGleich(
		'eine beendete Person lässt sich nicht neu eintragen',
		dienstwocheBesetzen(spaetere, gehende.id),
		null
	);
	pruefenGleich('und es entsteht dabei keine Zeile', dienstZeilen(spaetere).length, 0);
	pruefenGleich('eine unbekannte Id ebenso wenig', dienstwocheBesetzen(spaetere, 9_999_999), null);

	/*
	 * Die schmale Auskunft für den Diensthinweis. Sie geht über dieselbe Abfrage
	 * — und die Reihenfolge hier ist die Behauptung.
	 *
	 * **Zuerst die beendete Person.** Die laufende Woche zeigt in diesem
	 * Augenblick auf `gehende`: die Zeile steht, der Fremdschlüssel stimmt, allein
	 * `is_active` ist 0. Gäbe eigeneDienstwoche hier etwas zurück, bekäme jemand
	 * ohne Zugang einen Diensthinweis auf der Startseite. Diese Zeile ist die
	 * einzige der Kette, die eine zweite Abfrage mit eigener — oder fehlender —
	 * Aktiv-Prüfung auffliegen lässt; sie wird rot, wenn man `is_active` aus
	 * dienstwochenLesen nimmt.
	 */
	pruefenGleich(
		'eigeneDienstwoche gibt der beendeten Person nichts — unbesetzt ist niemandes Dienst',
		eigeneDienstwoche(gehende.id, jetztFuerDienst),
		null
	);
	pruefenGleich(
		'und die Zeile, an der das gemessen wurde, zeigt weiterhin auf sie',
		dienstZeilen(laufende)[0]?.memberId,
		gehende.id
	);

	// Danach übernimmt eine aktive Person dieselbe Woche — dasselbe UPDATE wie
	// jeder Tausch, hier zugleich der Aufbau für die zwei Zeilen darunter.
	dienstwocheBesetzen(laufende, rasmus.id);
	pruefen(
		'eigeneDienstwoche nennt die laufende Woche der zuständigen Person',
		wochenSchluessel(
			eigeneDienstwoche(rasmus.id, jetztFuerDienst)?.woche ?? { jahr: 0, woche: 0 }
		) === wochenSchluessel(laufende)
	);
	pruefenGleich('und gibt jedem anderen null', eigeneDienstwoche(tilde.id, jetztFuerDienst), null);

	// -----------------------------------------------------------------------
	// Die Route /dienstplan: load für alle, action hinter der Adminschranke
	// -----------------------------------------------------------------------
	const planAlsAdmin = wertVon(
		await routenausgang(() =>
			dienstplan.load(alsMitglied('/dienstplan', tildeLocals).alsServerLoadEvent())
		)
	);
	const planAlsMitglied = wertVon(
		await routenausgang(() =>
			dienstplan.load(alsMitglied('/dienstplan', rasmusLocals).alsServerLoadEvent())
		)
	);

	/*
	 * **Der Plan gehört allen, die Auswahl nicht.**
	 *
	 * Die Namensliste des Vereins geht nicht in das ausgelieferte HTML von
	 * jemandem, der sie nicht braucht — und die zwei Behauptungen darüber sind
	 * bewusst getrennt: dass beide **denselben Plan** sehen, ist der Zweck der
	 * Seite, und dass nur eine die Auswahl bekommt, ist die Schranke. Eine load,
	 * die einem Nicht-Admin gar nichts gäbe, erfüllte die zweite und verletzte
	 * die erste.
	 */
	pruefen(
		'beide sehen denselben Plan — der Dienstplan gehört allen',
		JSON.stringify(planAlsAdmin.wochen) === JSON.stringify(planAlsMitglied.wochen),
		`${JSON.stringify(planAlsAdmin.wochen).slice(0, 120)}`
	);
	pruefen(
		'die Adminperson bekommt die Auswahl der aktiven Mitglieder',
		Array.isArray(planAlsAdmin.mitglieder) &&
			planAlsAdmin.mitglieder.length > 0 &&
			planAlsAdmin.istAdmin === true
	);
	pruefen(
		'ein Mitglied ohne Adminrechte bekommt sie nicht — kein Name reist mit',
		Array.isArray(planAlsMitglied.mitglieder) &&
			planAlsMitglied.mitglieder.length === 0 &&
			planAlsMitglied.istAdmin === false,
		JSON.stringify(planAlsMitglied.mitglieder).slice(0, 160)
	);
	pruefen(
		'die Auswahl führt keine beendeten Zugänge',
		!JSON.stringify(planAlsAdmin.mitglieder).includes('Gehende'),
		JSON.stringify(planAlsAdmin.mitglieder).slice(0, 200)
	);
	pruefen(
		'die load von /dienstplan gibt keinen einzigen Token-Hash heraus',
		!hashes.some((hash) => JSON.stringify(planAlsAdmin).includes(hash))
	);
	pruefen(
		'sie nennt die laufende Woche als denselben gefalteten Schlüssel wie zeit.ts',
		planAlsAdmin.laufendeWoche === wochenSchluessel(isoWocheVon(Math.floor(Date.now() / 1000)))
	);

	/*
	 * Die Adminschranke der action. Sie steht in der action und nicht in der
	 * load: lesen darf jede, besetzen nicht — und ein POST braucht keinen Knopf,
	 * also genügt es nicht, das Formular wegzulassen.
	 */
	const besetzenAls = (wer: AngemeldetesMitglied | null, formular: Record<string, string>) =>
		routenausgang(() =>
			dienstplan.actions.besetzen?.(alsMitglied('/dienstplan', wer, formular).alsRequestEvent())
		);
	const wocheFormular = (woche: { jahr: number; woche: number }, mitgliedId: string) => ({
		jahr: String(woche.jahr),
		woche: String(woche.woche),
		mitgliedId,
	});

	const vorDemVersuch = dienstZeilen(spaetere).length;
	wegGeleitet(
		'besetzen weist ein Mitglied ohne Adminrechte mit 303 weg',
		await besetzenAls(rasmusLocals, wocheFormular(spaetere, String(rasmus.id)))
	);
	wegGeleitet(
		'und ohne Mitglied in locals ebenso',
		await besetzenAls(null, wocheFormular(spaetere, String(rasmus.id)))
	);
	pruefenGleich(
		'beide Versuche haben nichts angelegt',
		dienstZeilen(spaetere).length,
		vorDemVersuch
	);

	/*
	 * **Die Woche wird vor dem Mitglied geprüft.** Die Behauptung darunter ist
	 * die einzige, die das misst: beide Angaben sind zugleich untauglich, und
	 * genau dann entscheidet die Reihenfolge, welchen Satz die Person liest.
	 * Stünde die Namensprüfung vorn, trüge die Antwort ein Feld und einen
	 * Wochenschlüssel, den die Liste nicht enthält — und die Oberfläche fände
	 * keine Stelle für den Satz.
	 */
	abgewiesen(
		'eine Woche ausserhalb des Fensters wird abgewiesen',
		await besetzenAls(tildeLocals, wocheFormular({ jahr: 2043, woche: 5 }, String(rasmus.id))),
		WOCHE_NICHT_ANSPRECHBAR
	);
	abgewiesen(
		'eine Woche in der Vergangenheit ebenso — das Fenster beginnt heute',
		await besetzenAls(
			tildeLocals,
			wocheFormular({ jahr: laufende.jahr - 1, woche: 1 }, String(rasmus.id))
		),
		WOCHE_NICHT_ANSPRECHBAR
	);
	abgewiesen(
		'eine fehlende Woche fällt auf denselben Satz',
		await besetzenAls(tildeLocals, { jahr: String(laufende.jahr), mitgliedId: String(rasmus.id) }),
		WOCHE_NICHT_ANSPRECHBAR
	);
	abgewiesen(
		'eine nicht numerische ebenso',
		await besetzenAls(tildeLocals, {
			jahr: String(laufende.jahr),
			woche: 'zwölf',
			mitgliedId: String(rasmus.id),
		}),
		WOCHE_NICHT_ANSPRECHBAR
	);
	abgewiesen(
		'Woche und Mitglied zugleich untauglich: es antwortet die Woche',
		await besetzenAls(tildeLocals, { jahr: '2043', woche: '5', mitgliedId: 'nein' }),
		WOCHE_NICHT_ANSPRECHBAR
	);

	const ohneFeld = datenVon(
		await besetzenAls(tildeLocals, wocheFormular({ jahr: 2043, woche: 5 }, String(rasmus.id)))
	);
	pruefen(
		'der Satz über die Woche trägt weder Feld noch Zeile — er gehört nach oben',
		ohneFeld.feld === null && ohneFeld.zeile === null,
		JSON.stringify(ohneFeld)
	);

	/*
	 * Das nicht ansprechbare Mitglied. Anders als die Woche trägt es **Feld und
	 * Zeile**: der Satz gehört an die Auswahl genau dieser Wochenzeile, und ohne
	 * den Wochenschlüssel in der Antwort fände die Oberfläche sie ohne JavaScript
	 * nicht.
	 */
	const beendeterVersuch = await besetzenAls(
		tildeLocals,
		wocheFormular(spaetere, String(gehende.id))
	);
	abgewiesen(
		'ein beendeter Zugang lässt sich nicht eintragen',
		beendeterVersuch,
		MITGLIED_NICHT_ANSPRECHBAR
	);
	const beendeteDaten = datenVon(beendeterVersuch);
	pruefen(
		'und der Satz nennt Feld und Woche, damit er an der Zeile stehen kann',
		beendeteDaten.feld === 'mitgliedId' && beendeteDaten.zeile === wochenSchluessel(spaetere),
		JSON.stringify(beendeteDaten)
	);
	abgewiesen(
		'eine unbekannte Mitglieds-Id fällt auf denselben Satz',
		await besetzenAls(tildeLocals, wocheFormular(spaetere, '9999999')),
		MITGLIED_NICHT_ANSPRECHBAR
	);
	abgewiesen(
		'eine fehlende ebenso',
		await besetzenAls(tildeLocals, {
			jahr: String(spaetere.jahr),
			woche: String(spaetere.woche),
		}),
		MITGLIED_NICHT_ANSPRECHBAR
	);
	pruefenGleich(
		'keiner dieser vier Versuche hat eine Zeile angelegt',
		dienstZeilen(spaetere).length,
		vorDemVersuch
	);

	const gelungen = await besetzenAls(tildeLocals, wocheFormular(spaetere, String(rasmus.id)));
	pruefen(
		'die Adminperson besetzt die Woche und bekommt den Namen zurück',
		gelungen.art === 'wert' && gelungen.wert.art === 'besetzt' && gelungen.wert.name === 'Rasmus',
		gelungen.art === 'wert' ? JSON.stringify(gelungen.wert) : `Ausgang ${gelungen.art}`
	);
	pruefen('und die Antwort trägt keinen Token', !traegtToken(wertVon(gelungen)));

	/*
	 * **Die eigene Zeile ist hier kein Sonderfall.** Anders als bei Widerruf und
	 * Neuausstellen auf /verwaltung gibt es keinen Selbstschutz: eine Adminperson
	 * darf sich selbst zum Tränken eintragen, und EIGENER_ZUGANG_GESCHUETZT kommt
	 * in dieser action nicht vor. Ein Dienst ist kein Zugang.
	 */
	const selbstEingetragen = await besetzenAls(
		tildeLocals,
		wocheFormular(spaetere, String(tilde.id))
	);
	pruefen(
		'die Adminperson darf sich selbst eintragen — ein Dienst ist kein Zugang',
		selbstEingetragen.art === 'wert' && selbstEingetragen.wert.name === 'Tilde',
		selbstEingetragen.art === 'wert'
			? JSON.stringify(selbstEingetragen.wert)
			: `Ausgang ${selbstEingetragen.art}`
	);

	// -----------------------------------------------------------------------
	// Der Diensthinweis auf /
	// -----------------------------------------------------------------------
	/*
	 * Drei Zeilen der Matrix, ausgeführt an derselben load: eigener Dienst, kein
	 * eigener Dienst, und der eigene Dienst nach dem Beenden des Zugangs.
	 *
	 * **`null` und nicht ein leerer Text** ist die Zusage: der Block fehlt ganz,
	 * er ist nicht leer. Ein `dienst: { datum: '' }` sähe in der Komponente wie
	 * ein Block ohne Datum aus, und die Akzeptanzkriterien sagen ausdrücklich
	 * „nicht leer, sondern nicht vorhanden".
	 */
	const startseiteAls = async (wer: AngemeldetesMitglied) =>
		wertVon(await startseiteLadenAn('/', wer));
	const mitDienst = await startseiteAls(rasmusLocals);
	const ohneDienst = await startseiteAls(tildeLocals);
	pruefen(
		'wer diese Woche Dienst hat, bekommt den Block samt Wochendatum',
		mitDienst.dienst !== null &&
			typeof (mitDienst.dienst as { datum?: unknown }).datum === 'string' &&
			(mitDienst.dienst as { datum: string }).datum === wochendatum(laufende),
		JSON.stringify(mitDienst.dienst)
	);
	pruefenGleich(
		'wer keinen hat, bekommt null — der Block fehlt ganz, er ist nicht leer',
		ohneDienst.dienst,
		null
	);
	pruefen(
		'und die Aufgabenliste ist für beide dieselbe',
		JSON.stringify(mitDienst.aufgaben) === JSON.stringify(ohneDienst.aufgaben)
	);

	// -----------------------------------------------------------------------
	// Fünf Textprüfungen an src/routes/+page.svelte — als solche benannt
	// -----------------------------------------------------------------------
	/*
	 * Sie laufen auf `startseitenCode`, also auf der Datei **ohne** Kommentare:
	 * die Komponente erklärt an jeder dieser Stellen ausführlich, was dort zu
	 * stehen hat — sie nennt `!istErledigt`, `seit 4 Wochen überfällig`, das
	 * abhaken-Kästchen und die verbotene Verschachtelung wörtlich. Auf dem Rohtext
	 * hätten sich die Behauptungen an der eigenen Begründung erfüllt.
	 *
	 * Drei von ihnen greifen ausdrücklich **nicht** über die ganze Datei, sondern
	 * über einen geschnittenen Bereich — ein Formular, den Spaltencontainer, einen
	 * Regelrumpf. Der Grund ist gemessen und nicht vermutet: eine Suche über die
	 * ganze Datei sagt nichts über Elementzugehörigkeit und nichts über
	 * Reihenfolge, und zwei Mutationen liefen damit grün durch die ganze Kette.
	 * Sie stehen unten an ihrer jeweiligen Behauptung.
	 */

	/** Der Rumpf des ersten `<form>`-Elements mit dieser literalen action, oder ''. */
	const formularMit = (quelle: string, aktion: string): string => {
		const stelle = quelle.indexOf(`action="?/${aktion}"`);
		if (stelle < 0) return '';
		const auf = quelle.lastIndexOf('<form', stelle);
		const zu = quelle.indexOf('</form>', stelle);
		return auf < 0 || zu < 0 ? '' : quelle.slice(auf, zu);
	};

	/** Der geglättete Rumpf einer CSS-Regel, oder '' — kein irreführendes -1. */
	const regelRumpf = (quelle: string, selektor: string): string => {
		const stelle = quelle.indexOf(`${selektor} {`);
		return stelle < 0 ? '' : glatterRumpf(quelle, stelle);
	};

	/*
	 * Die Bedingung. Sie deckt die zwei Matrixzeilen ab, die eine Sitzung
	 * brauchen: abgehakt (die zweite Zeile verschwindet) und in derselben Sitzung
	 * wieder geöffnet (sie kommt mit unveränderter Zahl zurück, weil `data` nie neu
	 * geladen wird).
	 */
	const fristTeile = [
		[
			'die Bedingung hängt an !istErledigt und an wochenOffen',
			/\{@const istUeberfaellig = !istErledigt && aufgabe\.wochenOffen !== null\}/.test(
				startseitenCode
			),
		],
		[
			'die zweite Zeile hängt an derselben Bedingung',
			/\{#if istUeberfaellig\}/.test(startseitenCode),
		],
	] as const;
	pruefen(
		'die Überfälligkeitszeile hängt an !istErledigt und verschwindet beim Abhaken',
		fehlendeTeile(fristTeile).length === 0,
		`fehlt: ${fehlendeTeile(fristTeile).join(', ')}`
	);

	/*
	 * **Die Beschreibung hängt am richtigen Kästchen**, und geprüft wird das je
	 * Formular und nicht über die Datei.
	 *
	 * Gemessen: schiebt man das `aria-describedby` vom abhaken- auf das
	 * wiederOeffnen-Kästchen, bleibt eine Suche über die ganze Datei grün — dort
	 * ist `istUeberfaellig` aber konstruktionsbedingt immer false (es enthält
	 * `!istErledigt`, und das Formular rendert nur bei `istErledigt`), das Attribut
	 * wird nie ausgegeben, und eine überfällige Aufgabe verliert ihre Beschreibung
	 * vollständig. Darum: im abhaken-Formular muss es stehen, im
	 * wiederOeffnen-Formular darf es nicht vorkommen.
	 */
	const abhakenFormular = formularMit(startseitenCode, 'abhaken');
	const wiederOeffnenFormular = formularMit(startseitenCode, 'wiederOeffnen');
	const beschreibungTeile = [
		[
			'beide Formularbereiche sind geschnitten',
			abhakenFormular !== '' && wiederOeffnenFormular !== '',
		],
		[
			'aria-describedby steht im Formular mit action="?/abhaken"',
			/aria-describedby=\{istUeberfaellig \? `frist-\$\{aufgabe\.id\}` : undefined\}/.test(
				abhakenFormular
			),
		],
		[
			'und kommt im wiederOeffnen-Formular nicht vor',
			wiederOeffnenFormular !== '' && !/aria-describedby/.test(wiederOeffnenFormular),
		],
	] as const;
	pruefen(
		'aria-describedby sitzt am abhaken-Kästchen und nirgends sonst',
		fehlendeTeile(beschreibungTeile).length === 0,
		`fehlt: ${fehlendeTeile(beschreibungTeile).join(', ')}`
	);

	/*
	 * **Die zweite Zeile steht unter dem Text, nicht über ihm** — und sie steht im
	 * Spaltencontainer.
	 *
	 * Gemessen: stellt man den `{#if istUeberfaellig}`-Block **vor** den
	 * Aufgabentext, bleibt jede Suche über die ganze Datei grün, und
	 * `seit N Wochen überfällig` steht über der Aufgabe. Behauptet wird darum die
	 * Reihenfolge **innerhalb** des geschnittenen Containers. Der erste `</div>`
	 * nach dem Container schliesst ihn auch: darin liegen nur ein <span> und ein
	 * <p>, kein weiteres <div>.
	 */
	const spalteVon = startseitenCode.indexOf('<div class="zeile__spalte">');
	const spalteBis = spalteVon < 0 ? -1 : startseitenCode.indexOf('</div>', spalteVon);
	const spaltenRumpf =
		spalteVon < 0 || spalteBis < 0 ? '' : startseitenCode.slice(spalteVon, spalteBis);
	const textStelle = spaltenRumpf.indexOf('<span class="zeile__text"');
	const fristStelle = spaltenRumpf.indexOf('<p class="zeile__frist"');
	const reihenfolgeTeile = [
		['der Spaltencontainer ist geschnitten', spaltenRumpf !== ''],
		['der Aufgabentext liegt darin', textStelle >= 0],
		['das <p> liegt darin und nicht daneben', fristStelle >= 0],
		[
			'und der Aufgabentext kommt vor dem <p>',
			textStelle >= 0 && fristStelle >= 0 && textStelle < fristStelle,
		],
	] as const;
	pruefen(
		'die Überfälligkeitszeile steht im Spaltencontainer unter dem Aufgabentext',
		fehlendeTeile(reihenfolgeTeile).length === 0,
		`fehlt: ${fehlendeTeile(reihenfolgeTeile).join(', ')}`
	);

	/*
	 * **Die Regel, die das „unter" überhaupt herstellt.** Ohne sie war der
	 * Spaltencontainer von keiner Behauptung berührt: nimmt man
	 * `flex-direction: column` heraus, steht die zweite Zeile wieder **neben** dem
	 * Text, und die Reihenfolgeprüfung darüber bleibt grün, weil sie den DOM und
	 * nicht das Layout liest.
	 */
	const spaltenRegel = regelRumpf(startseitenCode, '.zeile__spalte');
	const spaltenRegelTeile = [
		['die Regel .zeile__spalte steht im <style>', spaltenRegel !== ''],
		['sie ist ein Flexcontainer', /display: flex;/.test(spaltenRegel)],
		['in Spaltenrichtung', /flex-direction: column;/.test(spaltenRegel)],
		['mit gap aus --space-1', /gap: var\(--space-1\);/.test(spaltenRegel)],
		['und sie darf schrumpfen', /min-width: 0;/.test(spaltenRegel)],
	] as const;
	pruefen(
		'.zeile__spalte stellt die Spalte her — column, gap und min-width',
		fehlendeTeile(spaltenRegelTeile).length === 0,
		`fehlt: ${fehlendeTeile(spaltenRegelTeile).join(', ')}`
	);

	/*
	 * Die Gestaltung der zweiten Zeile. Der Fund der Regel ist der **erste**
	 * Punkt der Liste und nicht bloss eine Wache am Abzeichen-Punkt: bei
	 * umbenannter Klasse ist der Rumpf leer, jeder Regex darauf falsch, und die
	 * Meldung sagte sonst „die Farbe kommt aus --overdue fehlt", obwohl die Regel
	 * schlicht nicht gefunden wurde.
	 */
	const fristRegel = regelRumpf(startseitenCode, '.zeile__frist');
	const gestaltungsTeile = [
		['die Regel .zeile__frist steht im <style>', fristRegel !== ''],
		[
			'ein <p> mit Klasse und Id',
			/<p class="zeile__frist" id="frist-\{aufgabe\.id\}">/.test(startseitenCode),
		],
		[
			'der Satz steht wörtlich im Markup',
			/seit \{aufgabe\.wochenOffen\} Wochen überfällig/.test(startseitenCode),
		],
		['die Farbe kommt aus --overdue', /color: var\(--overdue\);/.test(fristRegel)],
		['die Grösse aus der meta-Rolle', /font-size: var\(--meta-size\);/.test(fristRegel)],
		[
			'kein Abzeichen: keine Fläche, kein Rahmen, kein Radius, kein Innenabstand',
			fristRegel !== '' && !/background|border|radius|padding/.test(fristRegel),
		],
		[
			'und der Aufgabentext bleibt allein in #aufgabe-{id}',
			/<span class="zeile__text" id="aufgabe-\{aufgabe\.id\}">\{aufgabe\.text\}<\/span>/.test(
				startseitenCode
			),
		],
	] as const;
	pruefen(
		'die zweite Zeile ist ein <p> in Lehmbraun, trägt den Text und liegt nicht im Namen des Kästchens',
		fehlendeTeile(gestaltungsTeile).length === 0,
		`fehlt: ${fehlendeTeile(gestaltungsTeile).join(', ')}`
	);

	// -----------------------------------------------------------------------
	// Drei Behauptungen über den Baum
	// -----------------------------------------------------------------------
	/*
	 * Alle drei laufen auf dem **kommentarfreien** Text. Der Grund steht in
	 * queries/tasks.ts und in schema.ts: die Docblocks dort nennen `is_overdue`,
	 * Cron und Hintergrundjob wörtlich, weil sie begründen, warum es sie nicht
	 * gibt — auf dem Rohtext wären die Behauptungen an dieser Begründung rot
	 * geworden.
	 *
	 * Gelesen wird src/, drizzle/ **und scripts/**. Das dritte ist keine
	 * Vollständigkeitsübung: der Importkommentar oben nennt genau dieses Skript
	 * als den Ort, an dem eine zweite 21 am leichtesten entsteht, und eine
	 * Baumsuche, die es auslässt, prüfte alles ausser der eigentlichen Gefahr.
	 */
	const baumdateien = (verzeichnis: string) =>
		existsSync(verzeichnis)
			? readdirSync(verzeichnis, { recursive: true, withFileTypes: true })
					.filter((eintrag) => eintrag.isFile())
					.map((eintrag) => join(eintrag.parentPath, eintrag.name))
			: [];
	const baum = [
		...baumdateien(join(wurzel, 'src')),
		...baumdateien(join(wurzel, 'drizzle')),
		...baumdateien(join(wurzel, 'scripts')),
	].map((datei) => ({
		pfad: datei.slice(wurzel.length),
		text: kommentarfrei(readFileSync(datei, 'utf8')),
	}));
	const ZEIT_MODUL = join('src', 'lib', 'zeit.ts');

	/*
	 * **Die Schwelle steht genau einmal**, und die Behauptung deckt beide Formen
	 * ab, in denen eine zweite entstehen könnte: eine zweite Deklaration der
	 * Konstante und ein nackter Ausdruck daneben. Die Spec-Zusage lautet „keine
	 * zweite 21 irgendwo", und ein `21 * 24 * 60 * 60` oder ein ausgerechnetes
	 * 1814400 in einer Route wäre genau das — von der Deklarationssuche allein
	 * aber unbemerkt. Beide Muster sind ausserhalb von zeit.ts verboten; in
	 * zeit.ts kommt seit dem Umschreiben auf `3 * WOCHE_SEKUNDEN` selbst keines
	 * davon mehr vor.
	 */
	const SCHWELLE_ROH = /21\s*\*\s*24\s*\*\s*60\s*\*\s*60|\b1814400\b|3\s*\*\s*WOCHE_SEKUNDEN/;
	const schwelleTeile = [
		[
			'genau eine Deklaration, und zwar in src/lib/zeit.ts',
			baum
				.filter((datei) => /UEBERFAELLIG_SEKUNDEN\s*=/.test(datei.text))
				.map((datei) => datei.pfad)
				.join(', ') === ZEIT_MODUL,
		],
		[
			'kein nackter 21-Tage-Ausdruck ausserhalb von zeit.ts',
			!baum.some((datei) => datei.pfad !== ZEIT_MODUL && SCHWELLE_ROH.test(datei.text)),
		],
		['und der Baum wurde wirklich gelesen', baum.length > 30],
	] as const;
	pruefen(
		'die Schwelle steht in src/, drizzle/ und scripts/ genau einmal — als Konstante und als Zahl',
		fehlendeTeile(schwelleTeile).length === 0,
		`verletzt: ${fehlendeTeile(schwelleTeile).join(', ')}`
	);

	/*
	 * **Keine Überfälligkeitsspalte** — und die Behauptung ist genau so weit
	 * gefasst, wie sie tragen kann. Gesucht wird in der Schemadatei und in der
	 * Migrationskette, nicht im ganzen Baum: `--overdue` ist ein Farbtoken in
	 * src/app.html und `var(--overdue)` steht in der Komponente, eine Suche nach
	 * `overdue` über src/ wäre also von der richtigen Lösung rot. Mitgesucht wird
	 * die deutsche Benennung, weil eine Spalte `ueberfaellig_seit` dieselbe zweite
	 * Wahrheit wäre wie ein englisches is_overdue.
	 */
	const SPALTENVERBOT = /is_?overdue|overdue|ueberfaellig|überfällig/i;
	const schemadateien = baum.filter(
		(datei) =>
			datei.pfad === join('src', 'lib', 'server', 'db', 'schema.ts') || datei.pfad.endsWith('.sql')
	);
	const spaltenTeile = [
		['Schema und Migrationen sind gelesen', schemadateien.length >= 4],
		[
			'keine Spalte, die Überfälligkeit speichert',
			!schemadateien.some((datei) => SPALTENVERBOT.test(datei.text)),
		],
	] as const;
	pruefen(
		'weder das Schema noch die Migrationskette kennt eine Überfälligkeitsspalte',
		fehlendeTeile(spaltenTeile).length === 0,
		`verletzt: ${fehlendeTeile(spaltenTeile).join(', ')}`
	);

	/*
	 * **Kein Timer zieht die Zahl nach.** Die Zusage nennt keinen bestimmten
	 * Aufruf, sondern jeden Weg, auf dem die Wochenzahl sich ohne Ladevorgang
	 * ändern könnte — `setInterval` ist nur der naheliegendste. Gesucht wird
	 * darum in src/ nach allen fünf Terminplanern, die eine Browser- oder
	 * Node-Umgebung anbietet; scripts/ ist ausgenommen, weil ein Prüfskript
	 * legitim warten dürfte und die Zusage über die Anwendung spricht.
	 */
	const TERMINPLANER = /setInterval|setTimeout|setImmediate|requestAnimationFrame|queueMicrotask/;
	const anwendung = baum.filter((datei) => datei.pfad.startsWith(join('src', '')));
	const timerTeile = [
		['src/ ist gelesen', anwendung.length > 20],
		[
			'kein Terminplaner in der Anwendung',
			!anwendung.some((datei) => TERMINPLANER.test(datei.text)),
		],
	] as const;
	pruefen(
		'kein Timer in src/ zieht die Wochenzahl nach — sie entsteht allein in der load',
		fehlendeTeile(timerTeile).length === 0,
		`verletzt: ${fehlendeTeile(timerTeile).join(', ')}`
	);
	// -----------------------------------------------------------------------
	// Die Nacharbeit aus den Retrospektiven zu Epic 1 und 2
	// -----------------------------------------------------------------------
	/*
	 * Vier Behauptungen über Zusammengelegtes.
	 *
	 * Sie prüfen kein Verhalten, sondern eine **Zahl**: wie oft dieselbe Sache im
	 * Baum steht. Das ist ungewöhnlich für dieses Skript und hier der Punkt. Die
	 * Retrospektive zu Epic 2 hat die Drift nicht gefunden, weil etwas kaputt war,
	 * sondern weil jemand zwei Seiten nebeneinandergelegt und gezählt hat — und
	 * genau deshalb ist sie zwei Epics lang gewachsen: von drei Kopien auf vier,
	 * von drei abweisen-Formen auf vier. Epic 3 bringt zwei weitere Seiten mit;
	 * ohne eine Zahl, die rot wird, stünden dort acht und sechs.
	 *
	 * Gelesen wird kommentarfrei. Die Begründungen zu dieser Nacharbeit nennen die
	 * alten Formen wörtlich — auf dem Rohtext wären die Behauptungen an ihrer
	 * eigenen Begründung rot geworden.
	 */
	const quelltext = (...teile: string[]) =>
		kommentarfrei(readFileSync(join(wurzel, ...teile), 'utf8'));
	/*
	 * Die Seite `/dienstplan` steht **hinten** und nicht in alphabetischer
	 * Ordnung, und das
	 * ist kein Versehen: die Behauptungen darunter greifen /verwaltung über den
	 * Index `[3]`. Eine neue Seite vorn hinein zu schieben verschöbe jene
	 * stillschweigend auf /monatsplan, und sie blieben grün, während sie die
	 * falsche Datei läsen. Anhängen ist die einzige Reihenfolge, die das nicht
	 * kann. Story 3.2 hängt /einzelaufgaben ebenso hinten an.
	 */
	const seitenServer = [
		['/', quelltext('src', 'routes', '+page.server.ts')],
		['/aufgabe', quelltext('src', 'routes', 'aufgabe', '+page.server.ts')],
		['/monatsplan', quelltext('src', 'routes', 'monatsplan', '+page.server.ts')],
		['/verwaltung', quelltext('src', 'routes', 'verwaltung', '+page.server.ts')],
		['/dienstplan', quelltext('src', 'routes', 'dienstplan', '+page.server.ts')],
	] as const;
	const seitenKomponenten = [
		['/', quelltext('src', 'routes', '+page.svelte')],
		['/aufgabe', quelltext('src', 'routes', 'aufgabe', '+page.svelte')],
		['/monatsplan', quelltext('src', 'routes', 'monatsplan', '+page.svelte')],
		['/verwaltung', quelltext('src', 'routes', 'verwaltung', '+page.svelte')],
		['/dienstplan', quelltext('src', 'routes', 'dienstplan', '+page.svelte')],
	] as const;

	const abweisenTeile = [
		[
			'die eine Form steht in src/lib/server/abweisen.ts',
			/export function abweisen</.test(quelltext('src', 'lib', 'server', 'abweisen.ts')),
		],
		[
			'keine Seite erklärt eine eigene',
			!seitenServer.some(([, text]) => /function abweisen\s*[(<]/.test(text)),
		],
		[
			'alle fünf ziehen sie aus dem Modul',
			seitenServer.every(([, text]) =>
				/import \{ abweisen \} from '[^']*\/abweisen\.ts';/.test(text)
			),
		],
	] as const;
	pruefen(
		'abweisen hat eine Form und eine Wurfstelle, nicht vier',
		fehlendeTeile(abweisenTeile).length === 0,
		`verletzt: ${fehlendeTeile(abweisenTeile).join(', ')}`
	);

	/*
	 * **Die Namensregel hat eine Wurfstelle und drei Leser.**
	 *
	 * Der Nachweis, dass eine Mutation an der Regel alle drei zugleich rot macht,
	 * liegt in den ausgeführten Behauptungen: aufnehmen, umbenennen und
	 * create-admin werfen dieselben zwei Sätze und dieselbe Grenze. Diese Zeile
	 * hält die Bedingung fest, unter der das so bleibt — dass keiner der drei sich
	 * eine eigene Kopie zurückholt. Ohne sie liefe die Drift zurück, die
	 * scripts/create-admin.ts bis Story 3.0.1 vorgeführt hat: eine zweite Kette,
	 * die einen Namen durchliess, den die Oberfläche abwies.
	 *
	 * Gelesen wird kommentarfrei — die drei Dateien erklären an genau diesen
	 * Stellen wörtlich, was dort früher stand.
	 */
	const NAMENSMODUL = /import \{[^}]*namePruefen[^}]*\} from '[^']*\/mitgliedsname\.ts';/;
	const verwaltungServer = seitenServer[3][1];
	const adminSkript = quelltext('scripts', 'create-admin.ts');
	const namensregelTeile = [
		[
			'die Regel steht in src/lib/mitgliedsname.ts',
			/export function namePruefen\(/.test(quelltext('src', 'lib', 'mitgliedsname.ts')),
		],
		[
			/*
			 * Deklaration in **beiden** Formen. `function namePruefen` allein liesse
			 * eine Kopie als Pfeilfunktion durch — `const namePruefen = (…) => …` —,
			 * und genau die schriebe jemand hin, der sich die Regel „schnell nach
			 * nebenan holt". Gezählt wird auf dem kommentarfreien Baum: die
			 * Begründungen in mitgliedsname.ts, in der Route und im Admin-Skript
			 * nennen den alten Zustand wörtlich.
			 */
			'genau eine Deklaration im ganzen Baum, als Funktion wie als Pfeil',
			baum.filter((datei) => /(?:function|const)\s+namePruefen\s*[(=<]/.test(datei.text)).length ===
				1,
		],
		[
			'/verwaltung zieht sie aus dem Modul und ruft sie in beiden actions',
			NAMENSMODUL.test(verwaltungServer) &&
				(verwaltungServer.match(/namePruefen\(/g) ?? []).length === 2,
		],
		[
			'scripts/create-admin.ts zieht sie aus dem Modul, statt selbst zu falten',
			NAMENSMODUL.test(adminSkript) && !/\.replace\(/.test(adminSkript),
		],
		[
			'und die Grenze steht nur dort — keine zweite Deklaration',
			baum.filter((datei) => /NAME_HOECHSTLAENGE = \d+/.test(datei.text)).length === 1,
		],
		[
			/*
			 * **Keine nackte 80 im Markup.** Das maxlength beider Namensfelder auf
			 * /verwaltung kommt über data.namensgrenze aus derselben Konstante. Ein
			 * Literal dort wäre dieselbe Driftklasse, gegen die dieses Modul gebaut
			 * wurde, nur eine Schicht höher: ein Feld, das bei 80 abschneidet,
			 * während die Regel 100 zuliesse — oder umgekehrt eine Regel, die
			 * abweist, was das Feld noch zulässt.
			 */
			'und kein Namensfeld trägt sie als Literal',
			!/maxlength="\d+"/.test(seitenKomponenten[3][1]) &&
				(seitenKomponenten[3][1].match(/maxlength=\{data\.namensgrenze\}/g) ?? []).length === 2,
		],
	] as const;
	pruefen(
		'die Namensregel hat eine Wurfstelle und drei Leser, nicht drei Kopien',
		fehlendeTeile(namensregelTeile).length === 0,
		`verletzt: ${fehlendeTeile(namensregelTeile).join(', ')}`
	);

	/*
	 * Die Seitenform steht in bedienelemente.css und **nirgends sonst**. Gesucht
	 * wird der Regelkopf `.name {`, nicht das Wort: `class="fehler live"` im
	 * Markup ist keine Kopie, sondern die Benutzung.
	 */
	const SEITENFORM = [
		['.seite', /^[ \t]*\.seite\s*\{/m],
		['.seitentitel', /^[ \t]*\.seitentitel\s*\{/m],
		['.fehler', /^[ \t]*\.fehler\s*\{/m],
		['.live:empty', /^[ \t]*\.live:empty\s*\{/m],
	] as const;
	const STILBLATT = join('src', 'lib', 'styles', 'bedienelemente.css');
	const unterSrc = baum.filter((datei) => datei.pfad.startsWith(join('src', '')));
	const formTeile = SEITENFORM.map(([name, muster]) => {
		const treffer = unterSrc.filter((datei) => muster.test(datei.text)).map((d) => d.pfad);
		return [
			`${name} steht genau einmal, im geteilten Stilblatt (gefunden: ${treffer.join(', ') || 'nirgends'})`,
			treffer.length === 1 && treffer[0].endsWith(STILBLATT),
		] as const;
	});
	pruefen(
		'die Seitenform liegt an einer Stelle — keine Kopie je Seite',
		fehlendeTeile(formTeile).length === 0,
		`verletzt: ${fehlendeTeile(formTeile).join(' | ')}`
	);

	// -----------------------------------------------------------------------
	// Jede gerenderte Route gehört zu einem Eintrag der Navigationsleiste
	// -----------------------------------------------------------------------
	/*
	 * Eintrag 28 der zurückgestellten Arbeit, gelöst am 2026-08-29: /aufgabe,
	 * /monatsplan und /verwaltung gehören zu einem Ziel, ohne unter dessen Pfad
	 * zu liegen, und trugen darum **keine** Markierung.
	 *
	 * Diese Behauptung prüft nicht die Zuordnung — die ist eine
	 * Gestaltungsentscheidung und steht begründet in der Komponente. Sie prüft
	 * die **Vollständigkeit**: dass keine gerenderte Route durch das Raster
	 * fällt. Genau das ist die Klasse des Fehlers, den es zu wiederholen gäbe —
	 * Story 3.2 legt zwei neue Routen an, und ohne diese Zeile fiele erst in der
	 * Handprüfung auf, dass die Leiste dort wieder schweigt.
	 *
	 * Die Routen kommen aus dem **Baum** und nicht aus einer Liste im Skript: ein
	 * zweites Verzeichnis der Routen wäre die zweite Wahrheit, die still
	 * veraltet. Gesucht wird nach +page.svelte, also nach dem, was jemand
	 * wirklich zu sehen bekommt; /i/[token] ist ein +server.ts und rendert
	 * nichts.
	 */
	const ROUTEN_WURZEL = join(wurzel, 'src', 'routes');
	const gerenderteRouten = baumdateien(ROUTEN_WURZEL)
		.filter((datei) => datei.endsWith('+page.svelte'))
		.map((datei) => {
			const rest = datei.slice(ROUTEN_WURZEL.length).replace(/\+page\.svelte$/, '');
			const pfad = rest.replace(/\/$/, '');
			return pfad === '' ? '/' : pfad;
		})
		.sort();

	const navCode = readFileSync(join(wurzel, 'src', 'lib', 'components', 'NavBar.svelte'), 'utf8');
	/*
	 * Gelesen wird der **Rumpf des ziele-Arrays** und nicht die ganze Datei: der
	 * Docblock darüber nennt /aufgabe, /monatsplan und /verwaltung wörtlich, und
	 * eine Suche über den Rohtext erfüllte sich an der eigenen Begründung.
	 */
	const zieleVon = navCode.indexOf('const ziele = [');
	const zieleBis = zieleVon < 0 ? -1 : navCode.indexOf('];', zieleVon);
	const zieleRumpf = zieleVon < 0 || zieleBis < 0 ? '' : navCode.slice(zieleVon, zieleBis);
	const genannteRouten = [...zieleRumpf.matchAll(/'(\/[^']*)'/g)].map((treffer) => treffer[1]);

	const navTeile = [
		['der Rumpf des ziele-Arrays ist geschnitten', zieleRumpf !== ''],
		['die Leiste kennt vier Ziele', (zieleRumpf.match(/beschriftung:/g) ?? []).length === 4],
		...gerenderteRouten.map(
			(route) => [`${route} gehört zu einem Eintrag`, genannteRouten.includes(route)] as const
		),
	] as const;
	pruefen(
		'jede gerenderte Route steht in der Navigationsleiste — als Ziel oder als zugehörig',
		fehlendeTeile(navTeile).length === 0,
		`verletzt: ${fehlendeTeile(navTeile).join(', ')} — gefunden im Baum: ${gerenderteRouten.join(', ')}, genannt: ${genannteRouten.join(', ')}`
	);

	/*
	 * Und die zwei Aussagen, die aria-current trägt. `page` heisst „das hier ist
	 * die angezeigte Seite", `true` heisst „das hier ist der laufende Eintrag" —
	 * auf /aufgabe wäre ein `page` am Eintrag `Aufgaben` eine Falschaussage.
	 * Ohne diese Zeile bliebe die Prüfliste grün, wenn jemand beide Fälle auf
	 * `page` zusammenzöge, und die Unterscheidung wäre still weg.
	 */
	const ariaTeile = [
		[
			'die Marke kommt aus einer Funktion und nicht aus einem Ausdruck im Markup',
			/aria-current=\{aktivMarke\(ziel\)\}/.test(navCode),
		],
		['die eigene Seite trägt page', /return 'page';/.test(navCode)],
		['der Abschnitt trägt true', /\? 'true' : undefined/.test(navCode)],
	] as const;
	pruefen(
		'aria-current unterscheidet die angezeigte Seite vom laufenden Abschnitt',
		fehlendeTeile(ariaTeile).length === 0,
		`fehlt: ${fehlendeTeile(ariaTeile).join(', ')}`
	);

	/*
	 * Ein Wurf in einer action ersetzt die Seite nicht mehr durch die
	 * Fehlergrenze. Die Behauptung nagelt beide Hälften fest: den abgefangenen
	 * Fall und den Satz, den er zeigt — ein `if` ohne Satz wäre ein stiller
	 * Fehlschlag, und ein eigener Satz je Seite wäre die nächste Drift.
	 */
	const wurfTeile = seitenKomponenten.map(
		([name, text]) =>
			[
				`${name} fängt result.type === 'error' ab und zeigt den geteilten Satz`,
				/if \(result\.type === 'error'\) \{/.test(text) &&
					/versandFehler = VERSAND_FEHLGESCHLAGEN;/.test(text) &&
					// Der Import wird über den **Namen** geprüft und nicht über die ganze
					// Zeile: /monatsplan zieht seit dem Fenster an `Fällig bis` drei
					// Namen aus demselben Modul, und eine Behauptung über die Form der
					// Importzeile prüfte die Zeichensetzung statt der Herkunft.
					/import \{[^}]*\bVERSAND_FEHLGESCHLAGEN\b[^}]*\} from '\$lib\/texte';/.test(text),
			] as const
	);
	pruefen(
		'alle fünf use:enhance-Rückrufe fangen einen Wurf ab, mit einem Satz für alle',
		fehlendeTeile(wurfTeile).length === 0,
		`verletzt: ${fehlendeTeile(wurfTeile).join(', ')}`
	);

	/*
	 * Der Feldfehler auf /verwaltung, wortgleich zur Behauptung über
	 * /monatsplan weiter oben — das war der Sinn des Retro-Postens: dieselbe
	 * Bauform an beiden Stellen, und beide gemessen.
	 */
	const verwaltungCode = seitenKomponenten[3][1];

	/*
	 * **Die Verdrahtung des Umbenennen-Formulars**, aus demselben Grund wie die
	 * gleichnamige Behauptung über /aufgabe: die ausgeführten Behauptungen bauen
	 * ihr FormData selbst und blieben grün, wenn das Feld im Markup anders hiesse
	 * oder das versteckte mitgliedId fehlte. Im Browser endete dann jedes
	 * Umbenennen mit „Ohne Namen geht es nicht" beziehungsweise mit dem Satz über
	 * das nicht ansprechbare Mitglied — und keine Zeile dieser Liste würde rot.
	 *
	 * `action` steht als **Literal** und nicht in einer Variablen (AD-9); dass
	 * der Name auf eine wirklich vorhandene action zeigt, prüft Regel 11 von
	 * scripts/gate.mjs.
	 *
	 * Der geschnittene Bereich ist das Formular selbst und nicht die ganze Datei:
	 * `name="mitgliedId"` steht auch in den zwei anderen Formularen der Seite,
	 * und eine Suche über alles bliebe grün, wenn ausgerechnet hier das
	 * versteckte Feld fehlte.
	 */
	/*
	 * Der geschnittene Bereich beginnt am **<details>** und nicht am `<form>` oder
	 * gar am `action`-Attribut. Zwei Zusagen stehen vor dem Attribut, und beide
	 * gehören zur Bedienbarkeit ohne JavaScript: `method="POST"` — ohne es fiele
	 * das Formular still auf GET zurück, die Umbenennung liefe ins Leere und die
	 * abgeschickten Werte stünden in der Adresszeile — und das `open` am
	 * <details>, das die abgewiesene Zeile aufgeklappt lässt.
	 */
	const verwaltungGlatt = verwaltungCode.replace(/\s+/g, ' ');
	const umbenennenVon = verwaltungCode.indexOf('<details class="umbenennen"');
	const umbenennenBis = verwaltungCode.indexOf('</form>', umbenennenVon);
	const umbenennenFormular =
		umbenennenVon < 0 || umbenennenBis < 0
			? ''
			: verwaltungCode.slice(umbenennenVon, umbenennenBis).replace(/\s+/g, ' ');
	const umbenennenTeile = [
		['das Formular ist da', umbenennenFormular !== ''],
		[
			/*
			 * **Das <details> klappt am Fehlschlag dieser Zeile auf.** Ohne `open`
			 * liefert der Server nach einer Abweisung ein zugeklapptes Formular: die
			 * verworfene Eingabe, die Kante am Feld und das Ziel des Fokusgriffs sind
			 * im Dokument, aber verborgen — und ohne JavaScript gibt es nichts, was
			 * es nachträglich aufklappte. Gemessen: diese Mutation lief zuerst grün
			 * durch die ganze Kette, weil der Schnitt am <form> begann. Am
			 * **ausgelieferten** HTML misst sie scripts/smoke-http.ts.
			 */
			'open={fehlerHier} — die abgewiesene Zeile bleibt offen',
			/<details class="umbenennen" open=\{fehlerHier\}>/.test(umbenennenFormular),
		],
		['method="POST"', /<form\b[^>]*\bmethod="POST"/.test(umbenennenFormular)],
		['action="?/umbenennen" als Literal', /action="\?\/umbenennen"/.test(umbenennenFormular)],
		['use:enhance={versand}', /use:enhance=\{versand\}/.test(umbenennenFormular)],
		[
			'das versteckte mitgliedId trägt die Id der Zeile',
			/<input type="hidden" name="mitgliedId" value=\{mitglied\.id\} \/>/.test(umbenennenFormular),
		],
		['das Feld heisst neuerName', /<input\b[^>]*\bname="neuerName"/.test(umbenennenFormular)],
		[
			/*
			 * Die value-Bindung, Vorbild `value={eingabe}` auf /aufgabe. Ohne sie ist
			 * die verworfene Eingabe nach einem Fehlschlag fort und das Feld zeigt
			 * wieder den alten Namen — wer sich vertippt hat, tippt alles neu.
			 */
			'value hängt am Fehlschlag und fällt sonst auf den Namen der Zeile',
			/value=\{fehlerHier \? neuerNameEingabe : mitglied\.name\}/.test(umbenennenFormular),
		],
		[
			'aria-invalid hängt am Fehlschlag dieser Zeile',
			/aria-invalid=\{fehlerHier \? 'true' : undefined\}/.test(umbenennenFormular),
		],
		[
			'und das Feld zeigt im Fehlerfall auf den Satz dieser Zeile',
			/aria-describedby=\{fehlerHier \? `neuer-name-fehler-\$\{mitglied\.id\}` : undefined\}/.test(
				umbenennenFormular
			),
		],
		[
			// Ohne den Knopf gibt es ohne JavaScript keinen Weg abzuschicken, und
			// ohne disabled greift die seitenweite Doppelsperre hier nicht.
			'ein Absendeknopf, gesperrt solange ein Versand unterwegs ist',
			/<button class="button-quiet" type="submit" disabled=\{imFlug\}>/.test(umbenennenFormular),
		],
	] as const;
	pruefen(
		'das Umbenennen-Formular auf /verwaltung ist vollständig verdrahtet',
		fehlendeTeile(umbenennenTeile).length === 0,
		`fehlt: ${fehlendeTeile(umbenennenTeile).join(', ')}`
	);

	/*
	 * Der Satz zur Zeile: immer im Markup, nie hinter einem {#if}.
	 *
	 * Gelesen wird der **Tag** über ein umbruch- und reihenfolgeunabhängiges
	 * Muster — `[^>]*` frisst auch Zeilenumbrüche. Eine frühere Fassung endete auf
	 * `aria-live="assertive" >` und traf nur wegen des Leerzeichens, das Prettiers
	 * Faltung dort hinterlässt: ein Umformatieren hätte sie rot gemacht, und die
	 * nächste Person hätte sie abgeschwächt statt gelesen.
	 *
	 * Die zweite Hälfte ist die eigentliche Zusage und war die Lücke: der Tag
	 * allein sagt nichts darüber, ob er **bedingt** gerendert wird. In ein {#if}
	 * gewickelt kommt das Element erst mit seinem Text in den DOM, und ein
	 * Screenreader liest es dann in der Regel nicht vor — genau der Rückfall, den
	 * Retro-Posten B2 aufgelöst hat.
	 */
	const zeilenFehlerTag =
		/<p\b[^>]*\bid="neuer-name-fehler-\{mitglied\.id\}"[^>]*>/.exec(verwaltungCode)?.[0] ?? '';
	const zeilenSatzTeile = [
		['der Tag ist da', zeilenFehlerTag !== ''],
		['class="fehler live"', /class="fehler live"/.test(zeilenFehlerTag)],
		['role="alert"', /role="alert"/.test(zeilenFehlerTag)],
		['aria-live="assertive"', /aria-live="assertive"/.test(zeilenFehlerTag)],
		[
			'nicht hinter einem {#if}',
			!/\{#if fehlerHier/.test(verwaltungCode) && !/\{#if fehlerAmNeuenNamen/.test(verwaltungCode),
		],
		[
			/*
			 * Und der **Rumpf** gilt nur der abgewiesenen Zeile. `{fehlerAmNeuenNamen}`
			 * allein stünde in jeder aktiven Zeile: zwanzig assertive Regionen, die im
			 * selben Augenblick denselben Satz ansagen, und keine von ihnen sagt, um
			 * wessen Namen es geht — der Zeilenbezug, für den `abweisen` sein viertes
			 * Argument bekommen hat, wäre damit im Markup wieder verspielt. Gemessen:
			 * die Mutation lief grün, weil hier nur der Tag gelesen wurde.
			 *
			 * Gelesen auf dem geglätteten Text und mit `\s*` hinter dem `>`: ob
			 * Prettier den Tag faltet oder auf eine Zeile zieht, ist keine gebrochene
			 * Zusage.
			 */
			'und der Satz gilt nur der abgewiesenen Zeile',
			/id="neuer-name-fehler-\{mitglied\.id\}"[^>]*>\s*\{fehlerHier \? fehlerAmNeuenNamen : ''\}/.test(
				verwaltungGlatt
			),
		],
	] as const;
	pruefen(
		'der Satz zur Zeile auf /verwaltung ist eine immer vorhandene Live-Region',
		fehlendeTeile(zeilenSatzTeile).length === 0,
		`fehlt: ${fehlendeTeile(zeilenSatzTeile).join(', ')} (Tag: ${zeilenFehlerTag || 'keiner'})`
	);

	/*
	 * Die drei Zusagen der Komponente, die sonst an genau einer Zeile hängen und
	 * still zu brechen wären. Alle drei waren einmal grün zu mutieren.
	 */
	const verwaltungRueckmeldung = glatterRumpf(
		verwaltungCode,
		verwaltungCode.indexOf('const rueckmeldung')
	);
	const beendetVon = verwaltungCode.indexOf('{#if !mitglied.isActive}');
	const beendetBis = verwaltungCode.indexOf('{:else}', beendetVon);
	const aktivWieder = verwaltungCode.indexOf('{#if mitglied.isActive', beendetBis);
	const details = verwaltungCode.indexOf('<details class="umbenennen"');
	const fokusRumpf = glatterRumpf(verwaltungCode, verwaltungCode.indexOf('function fokusNach'));
	const zusagenTeile = [
		[
			/*
			 * Die Marke `feld === 'name'` an nameEingabe. Ohne sie trägt ein
			 * abgewiesenes Umbenennen seinen verworfenen Namen ins **Aufnahmefeld**,
			 * und wer danach aufnimmt, nimmt jemanden unter dem Namen auf, den er
			 * eben zu ändern versucht hat.
			 */
			"nameEingabe liest nur Fehlschläge mit der Marke 'name'",
			/const nameEingabe = \$derived\( form !== null && form\.art === 'fehler' && form\.feld === 'name' \?/.test(
				verwaltungGlatt
			),
		],
		[
			// Ohne diesen Zweig sagt ein geglücktes Umbenennen gar nichts an, während
			// fokusNach den Fokus trotzdem in die dann leere Meldungsregion schickt.
			"rueckmeldung kennt den Zweig 'umbenannt'",
			/form\.art === 'umbenannt'/.test(verwaltungRueckmeldung),
		],
		[
			/*
			 * **Der Fokus nach einer Abweisung geht an das Feld dieser Zeile.**
			 *
			 * Nicht in die obere Region: die ist in diesem Fall leer und über
			 * `.live:empty` aus dem Fluss genommen — der Fokus landete im Nichts,
			 * während der Satz, der ihn erklärt, weit weg am Feld steht. Umgekehrt
			 * als nach einem geglückten Umbenennen, das die Zeile an ihre neue
			 * alphabetische Stelle verschiebt; dort bliebe der Fokus auf einer
			 * fremden Zeile stehen. Beides sind benannte Festlegungen der Story und
			 * hängen an je einer Zeile in fokusNach.
			 */
			'fokusNach springt bei einer abgewiesenen Zeile an deren Feld',
			/document\.getElementById\(`neuer-name-\$\{zeile\}`\)\?\.focus\(\)/.test(fokusRumpf) &&
				/meldungKasten\?\.focus\(\)/.test(fokusRumpf),
		],
		[
			/*
			 * Eine beendete Zeile trägt kein Umbenennen-Formular. Serverseitig hält
			 * das die Bedingung is_active = 1 in der Query; im Markup hängt es allein
			 * daran, dass das <details> im {:else}-Zweig steht und nicht daneben.
			 */
			'eine beendete Zeile trägt kein Umbenennen-Formular',
			beendetVon >= 0 &&
				beendetBis > beendetVon &&
				aktivWieder > beendetBis &&
				details > beendetBis &&
				details < aktivWieder &&
				(verwaltungCode.match(/<details class="umbenennen"/g) ?? []).length === 1,
		],
	] as const;
	pruefen(
		'die vier Einzelzusagen der Verwaltungskomponente stehen',
		fehlendeTeile(zusagenTeile).length === 0,
		`fehlt: ${fehlendeTeile(zusagenTeile).join(', ')}`
	);

	const nameFehlerTag = /<p\b[^>]*\bid="name-fehler"[^>]*>/.exec(verwaltungCode)?.[0] ?? '';
	pruefen(
		'der Satz am Namensfeld auf /verwaltung ist eine immer vorhandene Live-Region',
		/class="fehler live"/.test(nameFehlerTag) &&
			/aria-live=/.test(nameFehlerTag) &&
			!/\{#if fehlerAmNamen/.test(verwaltungCode),
		nameFehlerTag === '' ? 'kein <p id="name-fehler"> gefunden' : nameFehlerTag
	);

	// -----------------------------------------------------------------------
	// Textprüfungen an den zwei Komponenten von Story 3.1
	// -----------------------------------------------------------------------
	/*
	 * Sie laufen auf dem **kommentarfreien** Text: beide Dateien erklären an
	 * genau diesen Stellen wörtlich, was dort steht und warum — auf dem Rohtext
	 * wären die Behauptungen an ihrer eigenen Begründung grün geworden.
	 *
	 * Was sie **nicht** sind: ein Ersatz für den ausgeführten Nachweis. Das
	 * ausgelieferte HTML misst scripts/smoke-http.ts an einem echten Server; hier
	 * steht, was ohne einen Browser überhaupt prüfbar ist — die Verdrahtung.
	 */
	const dienstplanCode = seitenKomponenten[4][1];
	const startseiteCodeDienst = seitenKomponenten[0][1];

	const besetzenVon = dienstplanCode.indexOf('<details class="besetzen"');
	const besetzenBis = dienstplanCode.indexOf('</form>', besetzenVon);
	const besetzenFormular =
		besetzenVon < 0 || besetzenBis < 0
			? ''
			: dienstplanCode.slice(besetzenVon, besetzenBis).replace(/\s+/g, ' ');
	const besetzenTeile = [
		['das Formular ist da', besetzenFormular !== ''],
		['method="POST"', /<form\b[^>]*\bmethod="POST"/.test(besetzenFormular)],
		/*
		 * Literal und nicht `action={…}`: ein dynamisches action machte
		 * Gate-Regel 11 blind, und ohne JavaScript fiele das Formular auf die
		 * Standard-action der Seite zurück.
		 */
		['action="?/besetzen" als Literal', /action="\?\/besetzen"/.test(besetzenFormular)],
		['use:enhance={versand}', /use:enhance=\{versand\}/.test(besetzenFormular)],
		/*
		 * **Beide** versteckten Felder. Eine Woche braucht zwei Zahlen; fehlte
		 * eines, endete jeder Versand im Satz über die nicht ansprechbare Woche.
		 */
		[
			'das versteckte jahr aus der Zeile',
			/<input type="hidden" name="jahr" value=\{eintrag\.jahr\} \/>/.test(besetzenFormular),
		],
		[
			'das versteckte woche aus der Zeile',
			/<input type="hidden" name="woche" value=\{eintrag\.woche\} \/>/.test(besetzenFormular),
		],
		['die Auswahl heisst mitgliedId', /<select\b[^>]*\bname="mitgliedId"/.test(besetzenFormular)],
		['sie ist required', /<select\b[^>]*\brequired/.test(besetzenFormular)],
		/*
		 * Die Kante am Feld und der Verweis auf den Satz hängen an **dieser**
		 * Zeile, nicht am blossen Vorhandensein eines Fehlers.
		 */
		[
			'aria-invalid hängt an fehlerHier',
			/aria-invalid=\{fehlerHier \? 'true' : undefined\}/.test(besetzenFormular),
		],
		[
			'aria-describedby zeigt auf den Satz dieser Woche',
			/aria-describedby=\{fehlerHier \? `besetzen-fehler-\$\{dieseWoche\}` : undefined\}/.test(
				besetzenFormular
			),
		],
		[
			'die schon zuständige Person steht vorgewählt',
			/selected=\{mitglied\.id === eintrag\.mitgliedId\}/.test(besetzenFormular),
		],
		[
			'der Knopf sperrt während des Versands',
			/<button class="button-quiet" type="submit" disabled=\{imFlug\}>/.test(besetzenFormular),
		],
		/*
		 * `open` hängt am Fehlschlag und nicht an einem eigenen Zustand: nur so
		 * steht das Formular nach einer Abweisung noch offen — und zwar auch ohne
		 * JavaScript, weil die Zeile vom Server kommt.
		 */
		[
			'<details open={fehlerHier}> — ohne JavaScript aufgeklappt',
			/<details class="besetzen" open=\{fehlerHier\}>/.test(besetzenFormular),
		],
	] as const;
	pruefen(
		'das Besetzen-Formular auf /dienstplan ist vollständig verdrahtet',
		fehlendeTeile(besetzenTeile).length === 0,
		`fehlt: ${fehlendeTeile(besetzenTeile).join(', ')}`
	);

	/*
	 * **Das Formular steht hinter der Adminmarke, und die Auswahl mit ihm.**
	 *
	 * Geprüft wird die Verschachtelung und nicht bloss das Vorkommen von
	 * `data.istAdmin`: ein `{#if}` irgendwo in der Datei erfüllte eine
	 * Vorkommensprüfung, ohne das Formular zu decken.
	 */
	const adminMarke = dienstplanCode.indexOf('{#if data.istAdmin}');
	pruefen(
		'das Besetzen-Formular liegt hinter {#if data.istAdmin}',
		adminMarke >= 0 && besetzenVon > adminMarke,
		`Marke bei ${adminMarke}, Formular bei ${besetzenVon}`
	);
	pruefen(
		'/dienstplan erklärt genau ein Besetzen-Formular — je Zeile eines aus einem Block',
		(dienstplanCode.match(/<details class="besetzen"/g) ?? []).length === 1
	);

	const planTeile = [
		/*
		 * Unbesetzt trägt **das Wort**. Ohne diese Zeile bliebe die Zusage an der
		 * Farbe allein hängen, und ein Screenreader läse eine leere Zelle.
		 */
		["das Wort '— unbesetzt —' steht im Markup", /— unbesetzt —/.test(dienstplanCode)],
		[
			'und es hängt am fehlenden Namen, nicht an einer Farbe',
			/\{eintrag\.name \?\? '— unbesetzt —'\}/.test(dienstplanCode),
		],
		[
			'die Farbe kommt zusätzlich, über eine eigene Klasse',
			/class:woche__name--unbesetzt=\{eintrag\.name === null\}/.test(dienstplanCode) &&
				/\.woche__name--unbesetzt \{[^}]*color: var\(--warn\)/.test(dienstplanCode),
		],
		/*
		 * Ziffern in Tabellenstellung — UX-DR: eine Wochenliste, deren Zahlen
		 * springen, liest sich schlecht. An **beiden** Zahlenzeilen, Nummer und
		 * Datum.
		 */
		[
			'die Wochennummer steht in Tabellenstellung',
			/\.woche__nummer \{[^}]*font-variant-numeric: tabular-nums/.test(dienstplanCode),
		],
		[
			'das Wochendatum ebenso',
			/\.woche__datum \{[^}]*font-variant-numeric: tabular-nums/.test(dienstplanCode),
		],
		/*
		 * Die Wochenrechnung wird **importiert** und nicht nachgebaut. Ein
		 * `jahr * 100 + woche` in der Komponente wäre die zweite Faltung, und der
		 * Fehlersatz landete an keiner Zeile.
		 */
		[
			'die Komponente zieht Datum und Schlüssel aus zeit.ts',
			/import \{ wochendatum, wochenSchluessel \} from '\$lib\/zeit';/.test(dienstplanCode),
		],
		[
			'und faltet den Schlüssel nicht selbst',
			!/jahr \* 100/.test(dienstplanCode) && !/\$\{[^}]*jahr[^}]*\}-\$\{/.test(dienstplanCode),
		],
		/* Die Liste ist keyed — sonst zeigte ein offenes <details> nach dem
		   Neubesetzen auf eine andere Woche. */
		[
			'der each-Block ist über den Wochenschlüssel keyed',
			/\{#each data\.wochen as eintrag \(schluessel\(eintrag\)\)\}/.test(dienstplanCode),
		],
	] as const;
	pruefen(
		'/dienstplan trägt das Wort, die Tabellenstellung und die eine Wochenrechnung',
		fehlendeTeile(planTeile).length === 0,
		`fehlt: ${fehlendeTeile(planTeile).join(', ')}`
	);

	/*
	 * Der Satz zur Zeile — dieselbe Bauform wie auf /verwaltung: **ausserhalb**
	 * des <details>, weil ein geschlossenes seinen Inhalt vor dem Screenreader
	 * verbirgt, und **immer** im Markup, weil eine Region, die im selben
	 * Augenblick sichtbar wird und ihren Text bekommt, nicht verlässlich
	 * vorgelesen wird (Retro-Posten B2).
	 */
	/*
	 * Über den Attributnamen geschnitten und nicht über eine feste Reihenfolge:
	 * Prettier bricht ein <p> mit vier Attributen auf mehrere Zeilen um, und ein
	 * Muster, das die Reihenfolge festschreibt, wäre beim nächsten Formatierlauf
	 * rot, ohne dass eine Zusage gebrochen wäre.
	 */
	const planFehlerTreffer = /<p\b[^>]*id="besetzen-fehler-\{dieseWoche\}"[\s\S]*?<\/p>/.exec(
		dienstplanCode
	);
	const planFehlerTag = (planFehlerTreffer?.[0] ?? '').replace(/\s+/g, ' ');
	pruefen(
		'der Satz zur Woche auf /dienstplan ist eine immer vorhandene Live-Region',
		planFehlerTag !== '' &&
			/role="alert"/.test(planFehlerTag) &&
			/aria-live=/.test(planFehlerTag) &&
			/\{fehlerHier \? fehlerAnDerAuswahl : ''\}/.test(planFehlerTag) &&
			(planFehlerTreffer?.index ?? -1) > dienstplanCode.indexOf('</details>'),
		planFehlerTag === '' ? 'kein <p id="besetzen-fehler-…"> gefunden' : planFehlerTag
	);

	/*
	 * **Der Diensthinweis auf / fehlt ganz oder gar nicht.**
	 *
	 * Die zweite Zeile ist die eigentliche: ein `{:else}` an diesem `{#if}` wäre
	 * genau der leere Block, den die Akzeptanzkriterien ausschliessen — „nicht
	 * leer, sondern nicht vorhanden".
	 */
	const dienstBlock =
		/\{#if data\.dienst !== null\}[\s\S]*?\{\/if\}/.exec(startseiteCodeDienst)?.[0] ?? '';
	const hinweisTeile = [
		['der Block hängt an {#if data.dienst !== null}', dienstBlock !== ''],
		['und hat kein {:else} — er fehlt ganz oder gar nicht', !/\{:else\}/.test(dienstBlock)],
		[
			'er trägt den Satz aus den Akzeptanzkriterien',
			/Diese Woche bist du am Tränken/.test(dienstBlock),
		],
		['und das Wochendatum daneben', /\{data\.dienst\.datum\}/.test(dienstBlock)],
		/*
		 * Der ganze Block ist ein Link auf den Dienstplan — und **kein** Formular
		 * und kein Knopf: ein Dienst ist keine Aufgabe, er ist nicht abhakbar und
		 * nicht wegklickbar.
		 */
		[
			'er ist als Ganzes ein Link auf /dienstplan',
			/<a class="dienst" href=\{resolve\('\/dienstplan'\)\}>/.test(dienstBlock),
		],
		[
			'und trägt weder Knopf noch Kästchen noch Formular',
			!/<button/.test(dienstBlock) && !/<input/.test(dienstBlock) && !/<form/.test(dienstBlock),
		],
		/*
		 * Die 3px-Kante in der Akzentfarbe ist das Zeichen aus UX-DR9 und
		 * zugleich der Grund, aus dem das Token --border-marker seit Story 1.1
		 * deklariert und bis hierher unbenutzt im Baum stand.
		 */
		[
			'die linke Kante misst --border-marker in der Akzentfarbe',
			/\.dienst \{[^}]*border-inline-start: var\(--border-marker\) solid var\(--accent\)/.test(
				startseiteCodeDienst
			),
		],
		/*
		 * Er steht **vor** dem Pool — Block 1 vor Block 3 aus AD-14. Der
		 * Diensthinweis ist die Aussage, die beim Öffnen zuerst zählt.
		 */
		[
			'und er steht vor der Marke des Aufgaben-Pools',
			startseiteCodeDienst.indexOf('{#if data.dienst !== null}') > 0 &&
				startseiteCodeDienst.indexOf('{#if data.dienst !== null}') <
					startseiteCodeDienst.indexOf('<h2 class="marke"'),
		],
	] as const;
	pruefen(
		'der Diensthinweis auf / fehlt ganz oder gar nicht — und ist kein Bedienelement',
		fehlendeTeile(hinweisTeile).length === 0,
		`fehlt: ${fehlendeTeile(hinweisTeile).join(', ')}`
	);
} catch (fehler) {
	unerwarteterWurf('smoke', fehler);
} finally {
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
		`\nsmoke: ${stand.gescheitert} von ${stand.gelaufen} Behauptung(en) nicht erfüllt.`
	);
	process.exit(1);
}
console.log(
	`\nsmoke: ${stand.gelaufen} Behauptungen der Zugangs- und Aufgabenschicht ausgeführt belegt.`
);
