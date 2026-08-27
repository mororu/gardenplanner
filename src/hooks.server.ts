import { error } from '@sveltejs/kit';
import type { Handle, HandleServerError, ServerInit } from '@sveltejs/kit';
import { sitzungAusstellen, sitzungLesen, sitzungsgeheimnisPruefen } from './lib/server/auth.ts';
import { datenschichtStarten } from './lib/server/db/index.ts';
import { mitgliedNachId } from './lib/server/db/queries/members.ts';
import { ohneTokenHash } from './lib/server/db/schema.ts';
import { herkunftLesen } from './lib/server/herkunft.ts';
import { KEIN_ZUGANG, NICHT_GEFUNDEN, UNERWARTETER_FEHLER } from './lib/texte.ts';

/*
 * Die Importe stehen relativ und mit .ts-Endung, nicht über $lib: dieselbe
 * Datei wird von scripts/smoke-zugang.ts mit nacktem Node geladen, und Node
 * kennt kein $lib. Aus demselben Grund kommt hier kein $env/* und kein $app/*
 * vor — die Umgebung wird über process.env gelesen.
 */

/**
 * Die Einlöseroute umgeht den Wächter — sie ist der einzige Weg herein.
 *
 * Der Schrägstrich am Ende ist mitgedacht: dieser Hook läuft vor SvelteKits
 * Pfadnormalisierung, und ein gültiger Link, den jemand mit angehängtem / aus
 * einem Chat kopiert, würde sonst mit 403 abgewiesen.
 */
const EINLOESEPFAD = /^\/i\/[^/]+\/?$/;

/**
 * Alles, was beim Start stimmen muss — und der werfende Teil des init-Hooks.
 *
 * Diese Funktion ist ausdrücklich von `init` getrennt, damit sie prüfbar ist:
 * ein Hook, der Meldung und Exit selbst erzeugt, lässt sich nur im
 * Unterprozess beobachten, und dass die drei Aufrufe überhaupt verdrahtet sind,
 * beobachtete vorher nichts. Einen Aufruf in ein schluckendes catch zu wickeln
 * blieb unentdeckt. scripts/smoke-zugang.ts ruft diese Funktion direkt.
 *
 * Sie wirft, sie meldet nicht — Meldung und Exit macht der Hook.
 */
export function startPruefen(): void {
	datenschichtStarten();
	sitzungsgeheimnisPruefen();
	herkunftLesen();
}

/**
 * Fail-Fast beim Start, nicht beim Modulladen.
 *
 * Der Analyseschritt von `vite build` importiert jedes Servermodul einmal, ruft
 * init aber nie. Stünden die Prüfungen beim Modulladen, wäre `npm run build` im
 * frisch geklonten Zustand ohne .env unmöglich — gemessen. Hier laufen sie
 * genau einmal, bevor die erste Antwort entsteht.
 *
 * Keine Prüfung hat einen Vorgabewert, und keine wirft nach aussen: der Prozess
 * gibt die benannte Meldung aus und endet, nie mit einem Stacktrace.
 */
export const init: ServerInit = () => {
	try {
		startPruefen();
	} catch (fehler) {
		console.error(fehler instanceof Error ? fehler.message : String(fehler));
		process.exit(1);
	}
};

/**
 * Der Wächter.
 *
 * Er steht hier und nicht in einem Layout-Load, weil ein Layout-Load für jede
 * neue Route eine neue Gelegenheit hätte, vergessen zu werden — und weil ein
 * Pfad ohne Route gar keinen Load hat, "beliebiger Pfad → 403" damit also
 * verloren wäre.
 *
 * Bei jedem Aufruf kommen Mitglied und is_active frisch aus der Datenbank, nie
 * nur aus dem Cookie: ein Widerruf muss sofort wirken, und die Cookie-Laufzeit
 * ist ein Jahr. Die Prüfung kostet eine indizierte SQLite-Abfrage, synchron.
 *
 * Der Preis der einen Fehlermeldung ist benannt: dieser Wurf verlässt SvelteKit
 * über handle_fatal_error → static_error_page, die Antwort trägt darum weder
 * Titel- noch Navigationsleiste (sie kommt aus src/error.html) und keine
 * set-cookie-Kopfzeile. Beides gemessen an 2.70.3, beides verkraftbar.
 */
export const handle: Handle = async ({ event, resolve }) => {
	if (EINLOESEPFAD.test(event.url.pathname)) {
		event.locals.mitglied = null;
		return mitKopfzeilen(await resolve(event));
	}

	const mitgliedId = await sitzungLesen(event.cookies);
	const mitglied = mitgliedId === null ? null : mitgliedNachId(mitgliedId);

	// Vier Fälle, ein Ausgang: kein Cookie, Cookie manipuliert oder abgelaufen,
	// Cookie gültig aber Mitgliedszeile weg, Mitglied deaktiviert. Das Cookie
	// bleibt liegen.
	//
	// Der dritte Fall steht nicht in der Matrix, weil kein Weg der Anwendung eine
	// Zeile löscht — Zugang beenden heisst deaktivieren, damit die Historie
	// bleibt. Ein Eingriff von Hand an der Datenbank erzeugt ihn trotzdem, und
	// mitgliedNachId gibt dann null: derselbe Ausgang, ununterscheidbar von den
	// anderen. Siehe die Aufstellung in src/lib/texte.ts.
	if (mitglied === null || !mitglied.isActive) {
		error(403, KEIN_ZUGANG);
	}

	// Ohne die Hash-Spalte: sie ist kein Anzeigewert und hat in keiner
	// Load-Funktion etwas zu suchen.
	event.locals.mitglied = ohneTokenHash(mitglied);
	// Gleitende Erneuerung: wer die Anwendung benutzt, bleibt angemeldet.
	await sitzungAusstellen(event.cookies, mitglied.id);

	return mitKopfzeilen(await resolve(event));
};

/**
 * Referrer-Policy auf jede ausgelieferte Antwort: die Identität steht im Pfad
 * von /i/<token>, und ein Referrer würde sie an jeden Ziel-Host weitergeben.
 *
 * Die 303 der Einlöseroute trägt sie mit: SvelteKit fängt den Wurf von
 * redirect() schon in render_endpoint und gibt die Antwort durch resolve zurück
 * — am laufenden Server bestätigt, samt set-cookie.
 *
 * **Zwei** Antworten erreicht die Kopfzeile nicht, und die zweite ist die
 * unangenehmere: die 403 des Wächters und die 403 der Einlöseroute. Beide
 * entstehen auf dem Fatal-Pfad, ausserhalb von resolve, und dort fällt jede über
 * setHeaders oder die Antwort gesetzte Kopfzeile weg. Die zweite ist genau die
 * tokentragende Anfrage — dort steht das Token im Pfad des Dokuments, das der
 * Browser anzeigt.
 *
 * Unschädlich bleibt es nur, weil src/error.html keinen einzigen externen
 * Verweis trägt: es gibt nichts nachzuladen, das einen Referrer mitnehmen
 * könnte. Damit das auch dann gilt, wenn dort je etwas dazukommt, steht in der
 * Vorlage zusätzlich <meta name="referrer" content="no-referrer">, und
 * scripts/smoke-zugang.ts behauptet beides.
 */
function mitKopfzeilen(antwort: Response): Response {
	antwort.headers.set('Referrer-Policy', 'no-referrer');
	return antwort;
}

/**
 * Für alles, was SvelteKit nicht schon aus dem Rumpf eines error()-Wurfs
 * beantwortet — also nicht für die 403 des Wächters und nicht für die der
 * Einlöseroute, wohl aber für einen unbekannten Pfad (404) und für jeden
 * unerwarteten Wurf (500).
 *
 * Ein 404 bekommt seinen eigenen Satz. Er mit "Etwas ist schiefgelaufen" zu
 * beantworten wäre eine Lüge: bei gültiger Sitzung liefert /gibtsnicht einen
 * 404, und schiefgegangen ist dabei nichts. Der englische Vorgabetext
 * "Not Found" ist ebenso keine Option, die Oberfläche ist durchgehend deutsch.
 *
 * Protokolliert wird ohne den Klartext eines Tokens: der Pfad wird gekürzt,
 * bevor er ins Protokoll geht. Ein 404 ist Alltag und keine Fehlermeldung wert,
 * darum geht nur alles ab 500 auf die Fehlerausgabe.
 */
export const handleError: HandleServerError = ({ error: fehler, event, status }) => {
	const pfad = event.url.pathname.startsWith('/i/') ? '/i/<Token entfernt>' : event.url.pathname;

	if (status === 404) {
		return { message: NICHT_GEFUNDEN };
	}

	console.error(
		`Unerwarteter Fehler ${status} auf ${pfad}: ` +
			(fehler instanceof Error ? fehler.message : String(fehler))
	);
	return { message: UNERWARTETER_FEHLER };
};
