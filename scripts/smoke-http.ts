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
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
	aufraeumen,
	pruefen,
	pruefenGleich,
	unerwarteterWurf,
	wegwerfVerzeichnis,
	zaehlerstand,
} from './pruefhelfer.ts';
/*
 * Der gemeinsame Prüfstand. Bau-Aktualität, freier Port, Saat, Unterprozess und
 * `holen` stehen seit dem 2026-08-31 in einem Modul, weil scripts/smoke-sicht.ts
 * (Stufe C) dieselbe Maschinerie fährt. Eine zweite Fassung wäre eine zweite
 * Wahrheit über den Umgebungsaufbau des Servers.
 */
import {
	ANFRAGE_SCHRANKE_MS,
	BROWSER_ACCEPT,
	bauPruefen,
	freierPort,
	holen,
	keksAus,
	attributWert,
	saeen,
	serverBeenden,
	serverStarten,
	wurzel,
	type Server,
} from './pruefserver.ts';
import { NAME_HOECHSTLAENGE, NAME_ZU_LANG } from '../src/lib/mitgliedsname.ts';
/*
 * Der Satz zum fehlenden Blatt-Titel kommt als **Wert** und nicht abgeschrieben.
 * Derselbe Grund wie bei NAME_ZU_LANG darüber und wie in smoke-zugang.ts: die
 * Zusage lautet nicht „dieser Wortlaut", sondern „der Server liefert genau den
 * Satz aus, den das geteilte Modul führt". Ein Literal hier wäre eine Behauptung
 * über eine Behauptung und bliebe grün, wenn die Route sich vom Modul löste.
 * Review-Befund zu Story 4.1 — die drei kurzen Meldungssätze (`Angelegt.`,
 * `Geändert.`, `Noch nichts aufgeschrieben.`) stehen dagegen weiter als Literal:
 * sie sind Oberflächentext ihrer Komponente und haben kein geteiltes Modul, aus
 * dem sie kommen könnten.
 */
import { BLATT_TITEL_FEHLT } from '../src/lib/blatttext.ts';
import {
	EINZELAUFGABE_NICHT_ANSPRECHBAR,
	KEIN_ZUGANG,
	MITGLIED_NICHT_ANSPRECHBAR,
} from '../src/lib/texte.ts';

/**
 * So viele Behauptungen muss ein vollständiger Lauf ablegen, die Schlusszählung
 * selbst nicht mitgerechnet. Wer eine hinzufügt oder entfernt, zieht die Zahl
 * mit — genau wie in scripts/smoke-zugang.ts. Eine Seite mehr in `seiten` sind
 * sieben Behauptungen mehr.
 *
 * **Diese Zahl steht nur hier.** Der Docblock behauptete bis zum Review vom
 * 2026-08-30, dieselbe stehe in README.md; sie stand dort nie. Eine Zahl an zwei
 * Stellen, von denen eine niemand rot macht, ist schlechter als eine Zahl an
 * einer — die Schlussmeldung des Laufs nennt sie ohnehin bei jedem Durchgang.
 */
const ERWARTETE_BEHAUPTUNGEN = 159;

/**
 * Ein Jahr in Sekunden — die Laufzeit aus src/lib/server/auth.ts.
 *
 * Abgeschrieben und nicht importiert, weil `LAUFZEIT_SEKUNDEN` dort modulprivat
 * ist; scripts/smoke-zugang.ts führt aus demselben Grund ein eigenes `EIN_JAHR`.
 * Die zweite Wahrheit ist benannt und in deferred-work.md notiert.
 */
const LAUFZEIT_SEKUNDEN = 60 * 60 * 24 * 365;

// ---------------------------------------------------------------------------
// Anfragen und Auswertung.
// ---------------------------------------------------------------------------

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
	bauPruefen('smoke:http');

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
		{ pfad: '/einzelaufgabe', titel: 'Einzelaufgabe' },
		{ pfad: '/einzelaufgaben', titel: 'Einzelaufgaben' },
		{ pfad: '/wissen', titel: 'Wissen' },
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
			`${seite.pfad} trägt kein Bruchstück eines Bestätigungstexts`,
			!html.includes(', aufgenommen am') &&
				!html.includes('name="mitgliedId" value=""') &&
				// Der zweite Dialog, seit Story 3.2. Sein Inhalt ist bedingt gerendert;
				// stünde er immer im Markup, trüge jedes ausgelieferte Dokument den
				// Satz `Du übernimmst: , .` — unsichtbar und trotzdem lesbar.
				!html.includes('Du übernimmst: ,') &&
				!html.includes('name="einzelaufgabeId" value=""')
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

	// --- Der Satz über der überfälligen Zeile, am ausgelieferten HTML ---------
	/*
	 * Eintrag 39, entschieden am 2026-08-28: der Satz heisst `seit N Wochen
	 * überfällig` und nicht mehr `seit N Wochen offen`. Hier wird er zum ersten
	 * Mal am **ausgelieferten** HTML gemessen und nicht am Quelltext.
	 *
	 * Gesucht wird der ganze Absatz und nicht nur die Zeichenkette: die Zusage ist
	 * `<p class="zeile__frist">` mit dem Satz darin, unter dem Aufgabentext. Eine
	 * blosse Volltextsuche wäre auch dann grün, wenn der Satz im Kästchen-Namen
	 * landete — genau der Fehler, gegen den die Komponente an dieser Stelle
	 * ausführlich argumentiert.
	 */
	const startseiteHtml = await (await holen(port, '/', { keks: adminKeks })).text();
	pruefen(
		'die überfällige Zeile steht auf dem ausgelieferten /',
		startseiteHtml.includes(saat.ueberfaelligText),
		`gesucht: ${JSON.stringify(saat.ueberfaelligText)}`
	);
	/*
	 * `class="zeile__frist svelte-…"`: Svelte hängt seine Bereichsklasse an, und
	 * ein `class="zeile__frist"` am Stück fände darum nichts. Gesucht wird die
	 * Klasse als **Wort** im Attribut — dieselbe Lesart, die ein Browser hat.
	 */
	const fristAbsatz = /<p class="[^"]*\bzeile__frist\b[^"]*"[^>]*>([\s\S]*?)<\/p>/.exec(
		startseiteHtml
	);
	pruefenGleich(
		'und darunter ein <p class="zeile__frist"> mit dem Satz und der Zahl',
		(fristAbsatz?.[1] ?? '').replace(/\s+/g, ' ').trim(),
		`seit ${saat.ueberfaelligWochen} Wochen überfällig`
	);
	pruefen(
		'das Wort „offen" steht nirgends in diesem Satz — der Wortlaut ist umgestellt',
		!/seit \d+ Wochen offen/.test(startseiteHtml),
		(/seit \d+ Wochen offen/.exec(startseiteHtml) ?? [])[0]
	);

	// --- Die Navigationsleiste markiert auch auf einer Formularroute ----------
	/*
	 * Eintrag 28 der zurückgestellten Arbeit, gelöst am 2026-08-29. `smoke` hält
	 * die Zuordnungsliste gegen die Routen im Baum; hier wird gemessen, was
	 * wirklich ausgeliefert wird — und zwar in **beiden** Lesarten von
	 * aria-current.
	 *
	 * Geschnitten wird je der eine <a>, der die Beschriftung trägt: eine Suche
	 * über die ganze Seite fände auch ein aria-current an einem anderen Element
	 * und bliebe grün, wenn die Markierung am falschen Eintrag hinge.
	 */
	const navZiel = (html: string, beschriftung: string): string =>
		(new RegExp(`<a\\b[^>]*>\\s*${beschriftung}\\s*</a>`).exec(html) ?? [''])[0];
	const navMarke = (html: string, beschriftung: string): string =>
		(/aria-current="([^"]*)"/.exec(navZiel(html, beschriftung)) ?? ['', ''])[1];

	const aufgabeHtml = await (await holen(port, '/aufgabe', { keks: adminKeks })).text();
	pruefen(
		'die Navigationsleiste steht auf /aufgabe überhaupt im ausgelieferten HTML',
		navZiel(aufgabeHtml, 'Aufgaben') !== '',
		'kein <a> mit der Beschriftung Aufgaben gefunden'
	);
	pruefenGleich(
		'auf /aufgabe ist der Eintrag Aufgaben der laufende Abschnitt, nicht die Seite',
		navMarke(aufgabeHtml, 'Aufgaben'),
		'true'
	);
	pruefenGleich(
		'und auf / ist derselbe Eintrag die angezeigte Seite',
		navMarke(startseiteHtml, 'Aufgaben'),
		'page'
	);
	pruefenGleich(
		'auf /aufgabe trägt genau ein Eintrag eine Marke',
		(aufgabeHtml.match(/aria-current="/g) ?? []).length,
		1
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
			// Der Abdruck des Namens, den diese Seite gesehen hat. Er entscheidet in
			// der where-Klausel des UPDATE, ob geschrieben wird — ohne ihn drehte ein
			// veralteter zweiter Tab eine neuere Umbenennung still zurück. Geprüft
			// wird auf einen **nichtleeren** Wert: ein value="" träfe nie einen
			// gespeicherten Namen, und jeder Versand endete im Satz über das nicht
			// ansprechbare Mitglied.
			'jedes mit dem versteckten bekannterName und einem echten Namen',
			jedes((_, rumpf) =>
				/\bvalue="[^"]+"/.test(/<input\b[^>]*\bname="bekannterName"[^>]*>/.exec(rumpf)?.[0] ?? '')
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
	const abgewiesenerAbdruck =
		/<input\b[^>]*\bname="bekannterName"[^>]*>/
			.exec(umbenennenFormulare[0]?.[1] ?? '')?.[0]
			?.match(/\bvalue="([^"]*)"/)?.[1] ?? '';
	const abweisung = await abschicken(port, '/verwaltung?/umbenennen', adminKeks, {
		mitgliedId: abgewieseneZeile,
		bekannterName: abgewiesenerAbdruck,
		neuerName: zuLangerName,
	});
	const abweisungHtml = await abweisung.text();
	/*
	 * Das `class` wird mit `[ "]` abgeschlossen und nicht mit `"` allein: Svelte
	 * hängt jeder Komponentenklasse seinen Bereichs-Hash an
	 * (`class="zeilenform svelte-…"`). Ein Muster auf `class="zeilenform"` wäre
	 * grün, solange es die Datei liest, und rot am ausgelieferten HTML — die
	 * Fehlerklasse, gegen die dieses ganze Skript steht, nur andersherum.
	 */
	const aufgeklappte = [
		...abweisungHtml.matchAll(
			/<details\b[^>]*\bclass="zeilenform[ "][^>]*\bopen\b[^>]*>([\s\S]*?)<\/details>/g
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

	// --- Jede Zeilen-Aktion nennt ihre Zeile ----------------------------------
	/*
	 * Zurückgestellt aus Story 3.0.1 und noch einmal aus dem Review zu Story 3.1,
	 * beide Male mit derselben Auflage: „gehört in einem Zug gelöst, nicht an
	 * einer Stelle." Gelöst am 2026-08-29 für alle vier Zeilenarten zugleich.
	 *
	 * Die Beschriftungen wiederholen sich je Zeile wortgleich — `Umbenennen`,
	 * `Neuer Name`, `Namen speichern`, `Link neu ausstellen`,
	 * `Einladung widerrufen` auf /verwaltung, `Besetzen`, `Zuständig`,
	 * `Eintragen` auf /dienstplan. Wer die Seite **sieht**, liest die Kennung der
	 * Zeile mit; wer sie mit einer Elementliste durchgeht, las zwanzigmal
	 * dasselbe Wort.
	 *
	 * Gemessen wird am ausgelieferten HTML und nicht am Quelltext, und zwar aus
	 * einem bestimmten Grund: die Kennungen tragen den Zeilenschlüssel als
	 * Interpolation (`mitglied-name-{id}`, `woche-{schluessel}`). Am Quelltext
	 * stünde da eine geschweifte Klammer, und ob daraus im Dokument wirklich ein
	 * **auflösbarer** Verweis wird, sähe man nicht. Ein aria-labelledby, das ins
	 * Leere zeigt, ist stiller als gar keins: der Screenreader liest dann den
	 * Rest, und das kann ein leerer Name sein.
	 */
	/*
	 * **Eine benannte Ausnahme.** Der Bestätigungsdialog auf /verwaltung trägt
	 * `aria-labelledby="widerruf-titel"`, und sein `<h2>` mit dieser Kennung
	 * entsteht erst mit der gewählten Zeile — das Element selbst bleibt stehen,
	 * weil `bind:this` es braucht. Im ausgelieferten Dokument zeigt der Verweis
	 * darum ins Leere, und das ist richtig so: der Dialog ist geschlossen, und
	 * sein Inhalt stünde sonst als leerer Satz im Quelltext jedes Besuchers.
	 * Wer ihn öffnet, hat die Überschrift.
	 */
	const VERWEIS_AUSNAHMEN = new Set(['widerruf-titel']);
	const verweiseLoesenAuf = (html: string): string[] => {
		const vorhanden = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((treffer) => treffer[1]));
		return [...html.matchAll(/\baria-labelledby="([^"]+)"/g)]
			.flatMap((treffer) => treffer[1].split(/\s+/))
			.filter(
				(kennung) => kennung !== '' && !vorhanden.has(kennung) && !VERWEIS_AUSNAHMEN.has(kennung)
			);
	};
	/*
	 * Die Griffe, Felder und Knöpfe der Zeilen — an ihrer Kennung erkannt. Die
	 * Abschnittsüberschriften der Seite (`mitglieder-titel`, `aufnahme-titel`)
	 * tragen ebenfalls ein aria-labelledby und sind ausdrücklich **einteilig**:
	 * eine Liste heisst `Mitglieder` und nicht `Mitglieder Mitglieder`.
	 */
	for (const [wo, html, praefixe] of [
		[
			'/verwaltung',
			verwaltungHtml,
			[
				'umbenennen-griff-',
				'neuer-name-label-',
				'namen-speichern-',
				'neu-ausstellen-',
				'widerrufen-',
			],
		],
		['/dienstplan', planAlsAdminHtml, ['besetzen-griff-', 'auswahl-label-', 'eintragen-']],
	] as const) {
		const zeilenVerweise = [...html.matchAll(/\baria-labelledby="([^"]+)"/g)]
			.map((treffer) => treffer[1])
			.filter((verweis) => praefixe.some((praefix) => verweis.startsWith(praefix)));
		pruefen(
			`auf ${wo} trägt jede Art von Zeilen-Aktion einen Verweis`,
			praefixe.every((praefix) => zeilenVerweise.some((verweis) => verweis.startsWith(praefix))),
			`fehlt: ${praefixe.filter((praefix) => !zeilenVerweise.some((v) => v.startsWith(praefix))).join(', ')}`
		);
		pruefenGleich(
			`und jeder Verweis auf ${wo} löst sich im ausgelieferten Dokument auf`,
			verweiseLoesenAuf(html).join(', '),
			''
		);
		/*
		 * Jeder Zeilen-Verweis nennt **zuerst sich selbst und dann die Zeile**. Die
		 * eigene Kennung zuerst, damit die sichtbare Beschriftung der Anfang des
		 * Namens bleibt: wer die Seite per Sprache bedient, sagt, was er sieht.
		 * Ohne diese Zeile bliebe die Prüfung grün, wenn ein Verweis nur auf die
		 * Zeile zeigte — dann hiesse der Knopf `Anna Meier`, und niemand wüsste,
		 * was er tut.
		 */
		pruefen(
			`und nennt auf ${wo} erst sich selbst, dann die Zeile`,
			zeilenVerweise.every((verweis) => {
				const teile = verweis.split(/\s+/);
				return teile.length === 2 && praefixe.some((praefix) => teile[0].startsWith(praefix));
			}),
			`nicht in dieser Form: ${zeilenVerweise.filter((v) => v.split(/\s+/).length !== 2).join(' | ')}`
		);
	}
	/*
	 * Und die zwei Griffe namentlich, weil sie die zwei sind, die die Einträge
	 * nennen: der `<summary>`, der auf /verwaltung `Umbenennen` heisst und auf
	 * /dienstplan `Besetzen`.
	 */
	pruefen(
		'der Umbenennen-Griff zeigt auf sich und auf den Namen der Zeile',
		/<summary[^>]*\bid="umbenennen-griff-(\d+)"[^>]*aria-labelledby="umbenennen-griff-\1 mitglied-name-\1"/.test(
			verwaltungHtml
		),
		(/<summary[^>]*umbenennen-griff[^>]*>/.exec(verwaltungHtml) ?? [''])[0]
	);
	pruefen(
		'der Besetzen-Griff zeigt auf sich und auf die Kalenderwoche',
		/<summary[^>]*\bid="besetzen-griff-(\d+)"[^>]*aria-labelledby="besetzen-griff-\1 woche-\1"/.test(
			planAlsAdminHtml
		),
		(/<summary[^>]*besetzen-griff[^>]*>/.exec(planAlsAdminHtml) ?? [''])[0]
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
			// Seit dem Review vom 2026-08-30 trägt es die **geteilte** Rolle
			// `hinweis hinweis--ziffern` statt einer eigenen Klasse: der Regelkörper
			// war byte-gleich mit ihr, und die SEITENFORM-Wache in smoke-zugang.ts
			// hält ihn jetzt an einer Stelle.
			'mit dem Wochendatum',
			/<span\b[^>]*\bclass="hinweis hinweis--ziffern"[^>]*>[^<]*[0-9]{1,2}\./.test(
				startseiteMitDienstHtml
			),
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
			/<details\b[^>]*\bclass="zeilenform[ "][^>]*\bopen\b[^>]*>([\s\S]*?)<\/details>/g
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

	// --- Die Einzelaufgabe, ohne JavaScript von Anfang bis Ende --------------
	/*
	 * **Der Kern von Story 3.2 an einem echten Server.** Drei Schritte, so wie
	 * ein Browser ohne JavaScript sie geht: ausschreiben, fragen, zusagen.
	 *
	 * `smoke` belegt die zwei Schritte am Rückgabewert der action. Was es nicht
	 * sehen kann, ist das **Dokument** dazwischen: ob der Bestätigungssatz
	 * wirklich ausgeliefert wird, ob die Marke `bestaetigt` im Formular steht und
	 * ob der zweite POST daraus wirklich eine Zusage macht. Genau die Klasse, für
	 * die Story 3.0 dieses Skript gebaut hat — und hier trägt sie mehr als
	 * anderswo: ohne diese Zeilen hinge die einzige Bestätigung des
	 * Aufgabenbereichs an JavaScript, und niemand hätte es gemerkt.
	 *
	 * Der Termin kommt aus dem `min` des ausgelieferten Feldes und nicht aus
	 * einer eigenen Rechnung: geprüft werden soll, dass **dieses** Formular
	 * trägt.
	 */
	/*
	 * **Der leere Zustand zuerst, gemessen statt begründet.** Zu diesem Zeitpunkt
	 * ist noch keine Einzelaufgabe ausgeschrieben, und Block 2 muss darum **ganz**
	 * fehlen — nicht leer sein. `smoke` prüft dieselbe Zusage am Quelltext des
	 * `{#if}`; ob daraus im ausgelieferten Dokument wirklich nichts wird, sagt das
	 * nicht. Die Zeile steht **vor** dem Ausschreiben, weil sie danach nicht mehr
	 * zu haben wäre.
	 */
	const leeresBlock2 = await (await holen(port, '/', { keks: mitgliedKeks })).text();
	pruefen(
		'ohne freie Einzelaufgabe fehlt Block 2 im ausgelieferten Dokument ganz',
		!leeresBlock2.includes('Zum Übernehmen') &&
			!leeresBlock2.includes('einzel-marke') &&
			!leeresBlock2.includes('noch niemand'),
		leeresBlock2.includes('Zum Übernehmen') ? 'die Marke steht da' : 'ein Rest steht da'
	);

	const ausschreibenHtml = await (await holen(port, '/einzelaufgabe', { keks: adminKeks })).text();
	const terminMin =
		/<input\b[^>]*\bname="termin"[^>]*\bmin="([0-9-]+)"/.exec(ausschreibenHtml)?.[1] ?? '';
	const terminMax =
		/<input\b[^>]*\bname="termin"[^>]*\bmax="([0-9-]+)"/.exec(ausschreibenHtml)?.[1] ?? '';
	const einzelTitel = 'Setzlinge bei der Gärtnerei abholen';

	/*
	 * **Nicht am Fensterrand posten.** `terminMax` ist der letzte zulässige Tag,
	 * gelesen aus einem GET von davor. Fällt zwischen dem GET und dem POST
	 * Mitternacht in Europe/Zurich, hat sich das Fenster um einen Tag verschoben,
	 * der Server antwortet mit FRIST_AUSSERHALB, und der Lauf wäre einmal je
	 * Nacht zufällig rot. Geschickt wird darum ein Tag **in** der Mitte; die zwei
	 * Grenzen selbst sind eine Zeile weiter unten am ausgelieferten Feld gemessen,
	 * und die Schranke in der action belegt `smoke` an fester Uhr.
	 */
	const terminMitte = new Intl.DateTimeFormat('en-CA', {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		timeZone: 'Europe/Zurich',
	}).format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
	const ausgeschrieben = await abschicken(port, '/einzelaufgabe?/ausschreiben', adminKeks, {
		titel: einzelTitel,
		termin: terminMitte,
	});
	/*
	 * **Das Dokument mit dem Parameter, und nicht nur der Location-Kopf.** Die
	 * Weiterleitung sagt, wohin geschickt wird; ob die Startseite daraus eine
	 * Bestätigung macht, sagt sie nicht. Ein Tippfehler im Parameternamen liesse
	 * die Zeile darunter grün, und wer ausschreibt, landete auf einer Seite ohne
	 * jede Rückmeldung.
	 */
	const bestaetigungHtml = await (
		await holen(port, '/?ausgeschrieben', { keks: adminKeks })
	).text();
	const startseiteHtmlEinzel = await (await holen(port, '/', { keks: mitgliedKeks })).text();
	const ausschreibenTeile = [
		[
			'das Dokument /?ausgeschrieben trägt den Satz `Ausgeschrieben.`',
			bestaetigungHtml.includes('Ausgeschrieben.'),
		],
		[
			'und /ohne Parameter trägt ihn nicht — die Gegenprobe',
			!startseiteHtmlEinzel.includes('Ausgeschrieben.'),
		],
		[
			'das Terminfeld trägt ein Fenster',
			terminMin !== '' && terminMax !== '' && terminMin < terminMax,
		],
		['der POST endet in einer Weiterleitung', ausgeschrieben.status === 303],
		[
			'und zwar auf /?ausgeschrieben — nicht auf ?abgelegt',
			(ausgeschrieben.headers.get('location') ?? '') === '/?ausgeschrieben',
		],
		['danach steht der Titel auf der Startseite', startseiteHtmlEinzel.includes(einzelTitel)],
		['mit dem Wort `noch niemand`', startseiteHtmlEinzel.includes('noch niemand')],
		[
			'und einem Knopf `Übernehmen`',
			/<button\b[^>]*type="submit"[^>]*>\s*Übernehmen\s*</.test(startseiteHtmlEinzel),
		],
		[
			// SvelteKit liefert interne Ziele **relativ** aus (`./einzelaufgaben`),
			// weil resolve() gegen die Basis auflöst. Das Muster lässt beide Formen
			// zu und nagelt den Pfad fest, nicht die Schreibweise davor.
			'die Zeile führt auf die Unterseite',
			/href="\.?\/einzelaufgaben"/.test(startseiteHtmlEinzel),
		],
	] as const;
	pruefen(
		'eine Einzelaufgabe lässt sich ohne JavaScript ausschreiben und steht danach auf /',
		fehlendeTeile(ausschreibenTeile).length === 0,
		`fehlt: ${fehlendeTeile(ausschreibenTeile).join(', ')} (Status ${ausgeschrieben.status})`
	);

	/*
	 * **Schritt 1: fragen — und nichts ändern.** Die Antwort auf einen POST ohne
	 * `bestaetigt` ist ein vollständiges Dokument mit dem Satz, und die Gegenprobe
	 * daneben ist die eigentliche Zusage: das Wort `noch niemand` steht danach
	 * immer noch da.
	 */
	const uebernahmeFolge =
		/export const UEBERNAHME_FOLGE = '([^']*)';/.exec(
			readFileSync(join(wurzel, 'src', 'lib', 'texte.ts'), 'utf8')
		)?.[1] ?? '';
	const einzelId =
		/<input\b[^>]*\bname="einzelaufgabeId"[^>]*\bvalue="([0-9]+)"/.exec(
			startseiteHtmlEinzel
		)?.[1] ?? '';
	const gefragtAntwort = await abschicken(port, '/?/uebernehmen', mitgliedKeks, {
		einzelaufgabeId: einzelId,
	});
	const gefragtHtml = await gefragtAntwort.text();
	const nachFrageHtml = await (await holen(port, '/', { keks: mitgliedKeks })).text();
	const frageTeile = [
		['die Id stand im ausgelieferten Formular', einzelId !== ''],
		[
			'die Antwort ist ein HTML-Dokument',
			(gefragtAntwort.headers.get('content-type') ?? '').startsWith('text/html'),
		],
		[
			'sie trägt den Bestätigungssatz mit Titel und Termin',
			new RegExp(`Du übernimmst: ${einzelTitel}, [0-9]`).test(gefragtHtml),
		],
		[
			'und ein Formular mit der Marke bestaetigt',
			/<input\b[^>]*\bname="bestaetigt"[^>]*\bvalue="1"/.test(gefragtHtml),
		],
		[
			'genau eine Frage im ganzen Dokument',
			(gefragtHtml.match(/Du übernimmst:/g) ?? []).length === 1,
		],
		/*
		 * **Und die Folge steht im ausgelieferten Dokument, nicht nur im Markup.**
		 *
		 * `smoke-zugang.ts` prüft, dass beide Bestätigungswege `{UEBERNAHME_FOLGE}`
		 * im Quelltext lesen — den **Wert** sieht es dort nicht. Diese Zeile sucht
		 * den Satz am Dokument, das über HTTP herauskommt, und schliesst damit die
		 * Hälfte, die Posten S2 der zweiten Retrospektive zu Epic 3 offen nannte:
		 * die Entscheidung, dass die Folge Substanz ist und keine Aufwertung, war
		 * von keiner **ausgeführten** Behauptung gedeckt.
		 *
		 * Der Wortlaut kommt aus texte.ts und steht hier nicht als zweites
		 * Literal — sonst wäre die Behauptung genau die Verdopplung, gegen die die
		 * Konstante steht.
		 */
		[
			'und die Folge der Zusage steht darin, aus der einen Konstante',
			uebernahmeFolge !== '' && gefragtHtml.includes(uebernahmeFolge),
		],
		[
			// Die Gegenprobe: gefragt ist nicht zugesagt. Ohne sie bliebe die Zeile
			// grün, wenn der erste POST schon schriebe.
			'und nichts ist geschrieben — die Aufgabe steht weiterhin als frei da',
			nachFrageHtml.includes('noch niemand') && !nachFrageHtml.includes('Manu Mitglied'),
		],
	] as const;
	pruefen(
		'der erste POST fragt nur — die Bestätigung kommt ohne JavaScript aus dem Server',
		fehlendeTeile(frageTeile).length === 0,
		`fehlt: ${fehlendeTeile(frageTeile).join(', ')} (Status ${gefragtAntwort.status})`
	);

	/*
	 * **Schritt 2: zusagen.** Derselbe POST mit der Marke. Danach trägt die
	 * Einzelaufgabe einen Namen, sie ist von `/` verschwunden und steht auf
	 * /einzelaufgaben — die drei Zeilen der Akzeptanzkriterien, an drei
	 * ausgelieferten Dokumenten gemessen.
	 */
	const zugesagt = await abschicken(port, '/?/uebernehmen', mitgliedKeks, {
		einzelaufgabeId: einzelId,
		bestaetigt: '1',
	});
	const nachZusageHtml = await (await holen(port, '/', { keks: mitgliedKeks })).text();
	const unterseiteHtml = await (
		await holen(port, '/einzelaufgaben', { keks: mitgliedKeks })
	).text();
	const zusageTeile = [
		['der POST endet nicht in einem Fehler', zugesagt.status < 400],
		['die Startseite zeigt die Einzelaufgabe nicht mehr', !nachZusageHtml.includes(einzelTitel)],
		['und damit auch keinen Knopf `Übernehmen` mehr', !/>\s*Übernehmen\s*</.test(nachZusageHtml)],
		['die Unterseite zeigt sie', unterseiteHtml.includes(einzelTitel)],
		['mit dem Namen der zusagenden Person', unterseiteHtml.includes('Manu Mitglied')],
		['und ohne `noch niemand` an dieser Zeile', !unterseiteHtml.includes('noch niemand')],
		[
			/*
			 * Die Unterseite handelt nicht: kein Formular, kein Knopf. Gemessen wird
			 * der **Seitenbereich** und nicht das ganze Dokument — die geteilte Hülle
			 * aus +layout.svelte liegt darum herum, und ein künftiger Knopf dort
			 * machte diese Zeile aus einem Grund rot, der mit dieser Seite nichts zu
			 * tun hat.
			 */
			'die Unterseite trägt kein Formular und keinen Knopf',
			(() => {
				// Vom Seitentitel bis zum Ende des Hauptbereichs — die Hülle aus
				// +layout.svelte (Titelleiste, Navigationsleiste) bleibt draussen.
				const von = unterseiteHtml.indexOf('<h1 class="seitentitel');
				const bis = unterseiteHtml.indexOf('</main>');
				const seite = von >= 0 && bis > von ? unterseiteHtml.slice(von, bis) : '';
				return seite !== '' && !/<form\b/.test(seite) && !/<button\b/.test(seite);
			})(),
		],
		[
			'weder Hash noch Klartext-Token',
			!saat.hashes.some((hash) => unterseiteHtml.includes(hash)) &&
				!saat.klartexte.some((token) => unterseiteHtml.includes(token)),
		],
	] as const;
	pruefen(
		'der zweite POST sagt zu — und die Einzelaufgabe wechselt die Seite',
		fehlendeTeile(zusageTeile).length === 0,
		`fehlt: ${fehlendeTeile(zusageTeile).join(', ')} (Status ${zugesagt.status})`
	);

	/*
	 * **Beide Zustände nebeneinander, an einem ausgelieferten /einzelaufgaben.**
	 *
	 * Bis zum Review vom 2026-08-30 wurde diese Seite in diesem Lauf zweimal
	 * geholt — im `seiten`-Durchlauf mit **leerer** Tabelle und hier oben erst
	 * **nach** der Zusage, als die einzige Einzelaufgabe schon einen Namen trug.
	 * Es gab keinen Moment mit einer freien Zeile, und darum war der `{#if}`, der
	 * die einzige Auskunft dieser Seite trägt, von keiner Behauptung berührt: der
	 * Zweig liess sich kollabieren, und `smoke` **und** `smoke:http` blieben beide
	 * grün. Gemessen als ausgeführte Mutation, nicht vermutet.
	 *
	 * **Ausgeschrieben wird als Nicht-Adminperson**, und das schliesst zugleich
	 * die zweite Lücke: der ganze `seiten`-Durchlauf und der erste
	 * Ausschreiben-POST fahren mit `adminKeks`, während die zentrale Zusage der
	 * Route lautet, sie habe keine eigene Zugangsschranke und ausschreiben dürfe
	 * jedes aktive Mitglied. Diese Zusage war nur auf Unit-Ebene gedeckt.
	 */
	const zweiterTitel = 'Kompost umsetzen am Samstag';
	const alsMitgliedGeholt = await holen(port, '/einzelaufgabe', { keks: mitgliedKeks });
	const zweitAusgeschrieben = await abschicken(port, '/einzelaufgabe?/ausschreiben', mitgliedKeks, {
		titel: zweiterTitel,
		termin: terminMitte,
	});
	const beideHtml = await (await holen(port, '/einzelaufgaben', { keks: mitgliedKeks })).text();
	// Der Seitenbereich ohne die geteilte Hülle — dieselbe Schnittform wie oben.
	const beideSeite = (() => {
		const von = beideHtml.indexOf('<h1 class="seitentitel');
		const bis = beideHtml.indexOf('</main>');
		return von >= 0 && bis > von ? beideHtml.slice(von, bis) : '';
	})();
	const beideTeile = [
		[
			'eine Nicht-Adminperson bekommt /einzelaufgabe ausgeliefert',
			alsMitgliedGeholt.status === 200,
		],
		[
			'und darf ausschreiben — dieselbe Weiterleitung wie die Adminperson',
			zweitAusgeschrieben.status === 303 &&
				(zweitAusgeschrieben.headers.get('location') ?? '') === '/?ausgeschrieben',
		],
		['der Seitenbereich ist überhaupt geschnitten', beideSeite !== ''],
		['die übernommene Zeile steht da', beideSeite.includes(einzelTitel)],
		['die freie ebenso', beideSeite.includes(zweiterTitel)],
		['die übernommene trägt den Namen der zusagenden Person', beideSeite.includes('Manu Mitglied')],
		[
			'die freie trägt `noch niemand` — und zwar genau einmal',
			beideSeite.split('noch niemand').length - 1 === 1,
		],
		[
			'die freie steht **vor** der übernommenen — geordnet wird nach Termin, dann Id',
			beideSeite.indexOf(einzelTitel) < beideSeite.indexOf(zweiterTitel),
		],
	] as const;
	pruefen(
		'/einzelaufgaben zeigt beide Zustände nebeneinander — und ausschreiben darf jedes Mitglied',
		fehlendeTeile(beideTeile).length === 0,
		`fehlt: ${fehlendeTeile(beideTeile).join(', ')} (Status ${alsMitgliedGeholt.status}/${zweitAusgeschrieben.status})`
	);

	/*
	 * **Der verlorene Griff, als Dokument.** Dieselbe Zusage wie beim abgewiesenen
	 * Besetzen weiter oben und aus demselben Grund: `smoke` misst den
	 * Rückgabewert der action, und der sagt nichts darüber, ob der Satz jemals
	 * ausgeliefert wird. Wer zu spät kommt, muss ihn ohne JavaScript im Dokument
	 * lesen — die Live-Region wird bei einem frischen Dokument nicht angesagt, der
	 * Satz steht aber im Rumpf.
	 *
	 * Geschickt wird derselbe POST ein zweites Mal: die Aufgabe ist jetzt
	 * übernommen, und die Vorbedingung im UPDATE trifft keine Zeile mehr.
	 */
	const zuSpaet = await abschicken(port, '/?/uebernehmen', adminKeks, {
		einzelaufgabeId: einzelId,
		bestaetigt: '1',
	});
	const zuSpaetHtml = await zuSpaet.text();
	const zuSpaetTeile = [
		['die Antwort ist ein 400', zuSpaet.status === 400],
		['und ein HTML-Dokument', (zuSpaet.headers.get('content-type') ?? '').startsWith('text/html')],
		['der Satz steht im Rumpf', zuSpaetHtml.includes(EINZELAUFGABE_NICHT_ANSPRECHBAR)],
		[
			'er steht in der oberen Fehlerregion',
			/<p class="fehler live"[^>]*>[^<]*Diese Einzelaufgabe lässt sich nicht ansprechen/.test(
				zuSpaetHtml
			),
		],
		[
			// Und keine Frage daneben: ein abgewiesener zweiter Schritt stellt sie
			// nicht noch einmal.
			'und keine Bestätigungsfrage daneben',
			!zuSpaetHtml.includes('Du übernimmst:'),
		],
	] as const;
	pruefen(
		'wer zu spät zusagt, liest den Satz ohne JavaScript im Dokument',
		fehlendeTeile(zuSpaetTeile).length === 0,
		`fehlt: ${fehlendeTeile(zuSpaetTeile).join(', ')} (Status ${zuSpaet.status})`
	);

	// --- Ein Blatt, ohne JavaScript von Anfang bis Ende ----------------------
	/*
	 * **Der Kern von Story 4.1 an einem echten Server**, und er ist hier zu
	 * Hause und nicht in `smoke`: die eine Zusage des Blatts lautet „Absätze und
	 * Zeilenumbrüche bleiben beim Anzeigen erhalten", und *anzeigen* heisst
	 * ausgeliefertes HTML. `smoke` sieht den gefalteten Wert in der Datenbank; ob
	 * daraus im Dokument wirklich zwei Absätze werden statt einer Zeile, sagt es
	 * nicht.
	 *
	 * Dazu die zweite Zusage, die nur hier messbar ist: der Freitext kommt aus
	 * einem Formular, das jedes Mitglied ausfüllen darf, und er darf im Dokument
	 * **kein Markup** werden. Ein Blatt wäre sonst die Stelle, an der eine Person
	 * Skript in die Seite jeder anderen schreibt.
	 *
	 * Drei Schritte, so wie ein Browser ohne JavaScript sie geht: anlegen, lesen,
	 * ändern.
	 */
	const leeresWissen = await (await holen(port, '/wissen', { keks: mitgliedKeks })).text();
	pruefen(
		'ohne Blatt trägt /wissen den leeren Zustand und keine Liste',
		leeresWissen.includes('Noch nichts aufgeschrieben.') &&
			!leeresWissen.includes('blaetter-marke'),
		leeresWissen.includes('blaetter-marke') ? 'die Marke steht da' : 'der Satz fehlt'
	);

	const blattText = 'Kohl mag Sellerie.\n\nZwiebel mag Karotte.\n<script>alert(1)</script>';
	const angelegtesBlatt = await abschicken(port, '/wissen?/anlegen', mitgliedKeks, {
		titel: 'Gute Nachbarn',
		text: blattText,
	});
	const blattOrt = angelegtesBlatt.headers.get('location') ?? '';
	pruefen(
		'anlegen darf jedes Mitglied und leitet mit 303 auf das frische Blatt',
		angelegtesBlatt.status === 303 && /^\/wissen\/[0-9]+\?angelegt$/.test(blattOrt),
		`${angelegtesBlatt.status} auf ${blattOrt}`
	);

	const blattHtml = await (await holen(port, blattOrt, { keks: mitgliedKeks })).text();
	const blattTeile = [
		['der Satz Angelegt. hat die Weiterleitung überlebt', blattHtml.includes('Angelegt.')],
		['der Titel steht als Seitentitel', blattHtml.includes('<title>Gute Nachbarn</title>')],
		[
			// Der Umbruch steht im ausgelieferten Text, nicht als <br> und nicht als
			// zweiter Absatz: das Zerlegen wäre eine zweite Auslegung derselben
			// Umbrüche neben der Faltung.
			'die Leerzeile zwischen den Absätzen steht im Dokument',
			/Kohl mag Sellerie\.\n\nZwiebel mag Karotte\./.test(blattHtml),
		],
		['die Rolle steht am Absatz', /class="[^"]*blatt__text/.test(blattHtml)],
		[
			/*
			 * Die scharfe Zeile: das Markup steht als Zeichen da und nicht als
			 * Element.
			 *
			 * Geprüft wird die **spitze Klammer**, nicht ein ganzer maskierter
			 * Satz: Svelte maskiert in einem Textknoten `&` und `<` und lässt `>`
			 * stehen — gemessen, nicht vermutet. Ein Erwartungswert mit
			 * `&gt;` darin wäre rot, obwohl nichts falsch ist, und der nächste
			 * rote Lauf schwächte dann die Behauptung ab, statt sie zu lesen. Was
			 * zählt, ist genau dieses Paar: die öffnende Klammer ist maskiert, und
			 * im Dokument steht kein zweites script-Element.
			 */
			'das getippte Markup ist Text geworden und kein Element',
			blattHtml.includes('&lt;script') && !/<script>alert\(1\)/.test(blattHtml),
		],
	] as const;
	pruefen(
		'das ausgelieferte Blatt trägt seine Absätze und macht aus Markup Text',
		fehlendeTeile(blattTeile).length === 0,
		`fehlt: ${fehlendeTeile(blattTeile).join(', ')}`
	);

	/*
	 * **Und die Regel selbst, im ausgelieferten Stilblatt.**
	 *
	 * Die erste Fassung dieser Behauptung stand als `||` in der Liste darüber:
	 * `white-space: pre-wrap` im HTML **oder** die Klasse am Absatz. Zwei Reviewer
	 * haben unabhängig gefunden, dass die linke Hälfte tot ist — svelte.config.js
	 * setzt kein inlineStyleThreshold, SvelteKits Vorgabe ist 0, und
	 * Komponenten-CSS geht als eigenes <link> hinaus, nie inline. Die Behauptung
	 * fiel damit auf „die Klasse steht im Markup" zusammen und konnte die
	 * Regression, nach der sie benannt ist, gar nicht sehen: wer
	 * `white-space: pre-wrap` aus der Regel löscht, liefert beide Absätze als eine
	 * durchlaufende Zeile — und die Klasse steht weiter da.
	 *
	 * Gemessen wird darum am **selben Weg, den der Browser geht**: die
	 * Stilblatt-Adressen aus dem <head> des Dokuments holen und in dem, was
	 * zurückkommt, die Deklaration suchen. Das ist die einzige Stelle im ganzen
	 * Prüfwerkzeug, die die einzige Formatierungszusage dieser Story wirklich
	 * belegt — smoke-zugang liest dafür den Quelltext der Komponente, und ein
	 * Quelltext ist kein ausgeliefertes Blatt.
	 */
	/*
	 * Die Attributreihenfolge ist **nicht** festgelegt: SvelteKit schreibt
	 * `href` vor `rel`. Der Schnitt greift darum das ganze <link>-Element und
	 * liest die zwei Attribute daraus, statt eine Reihenfolge zu behaupten — die
	 * erste Fassung tat es und fand null Adressen.
	 */
	const stilAdressen = [...blattHtml.matchAll(/<link\b[^>]*>/g)]
		.map((treffer) => treffer[0])
		.filter((element) => /rel="stylesheet"/.test(element))
		.map((element) => /href="([^"]+)"/.exec(element)?.[1] ?? '')
		.filter((adresse) => adresse !== '');
	let ausgelieferteStile = '';
	for (const adresse of stilAdressen) {
		// Die Adressen stehen relativ zum Dokument; ein führender Schrägstrich
		// fehlt bei SvelteKits Auslieferung interner Ziele.
		const pfad = adresse.startsWith('http')
			? adresse
			: adresse.startsWith('/')
				? adresse
				: `/${adresse.replace(/^\.\//, '')}`;
		if (pfad.startsWith('http')) continue;
		ausgelieferteStile += await (await holen(port, pfad)).text();
	}
	pruefen(
		'die Absatzregel steht im ausgelieferten Stilblatt und nicht nur im Quelltext',
		stilAdressen.length > 0 && /white-space:\s*pre-wrap/.test(ausgelieferteStile),
		`${stilAdressen.length} Stilblatt-Adresse(n) im Dokument, ${ausgelieferteStile.length} Zeichen gelesen`
	);

	/*
	 * **Die Abweisung beim Ändern, ohne JavaScript** — dieselbe Bauform wie die
	 * beim Anlegen weiter unten, und der Review zu Story 4.1 hat gefordert, dass
	 * es sie gibt: bis dahin war der Rückweg **beider** Eingaben nur für das
	 * Anlegen gerendert. Am Blatt ist er wertvoller, denn dort steht schon ein
	 * Text, den die Person geändert hat — geht er verloren, ist die Fassung fort,
	 * die es noch nirgends gibt.
	 */
	const blattPfad = blattOrt.split('?')[0] ?? '';
	const aendernAbgewiesen = await abschicken(port, `${blattPfad}?/aendern`, mitgliedKeks, {
		titel: '  ',
		text: 'Ein neuer Absatz.\n\nUnd noch einer, gerade getippt.',
	});
	const aendernAbweisungHtml = await aendernAbgewiesen.text();
	const aendernAbweisungTeile = [
		['der Status ist 400', aendernAbgewiesen.status === 400],
		['das Formular kommt offen zurück', /<details[^>]*\bopen\b/.test(aendernAbweisungHtml)],
		[
			'der gerade getippte Text steht wieder im Feld — nicht der gespeicherte',
			aendernAbweisungHtml.includes('Und noch einer, gerade getippt.'),
		],
		['und der Satz steht dabei', aendernAbweisungHtml.includes(BLATT_TITEL_FEHLT)],
	] as const;
	pruefen(
		'auch das Ändern trägt eine Abweisung ohne JavaScript — offen, mit beiden Eingaben',
		fehlendeTeile(aendernAbweisungTeile).length === 0,
		`fehlt: ${fehlendeTeile(aendernAbweisungTeile).join(', ')} (Status ${aendernAbgewiesen.status})`
	);

	/*
	 * Die Liste zeigt den Titel und **nicht** den Freitext: er kann achttausend
	 * Zeichen tragen, und für eine Titelliste hat er im Dokument nichts zu
	 * suchen. Hier gemessen und nicht am Rückgabewert der load — was die Seite
	 * ausliefert, entscheidet die Komponente und nicht die Projektion allein.
	 */
	const listeHtml = await (await holen(port, '/wissen', { keks: mitgliedKeks })).text();
	pruefen(
		'die Liste trägt den Titel und nicht den Freitext',
		listeHtml.includes('Gute Nachbarn') &&
			!listeHtml.includes('Zwiebel mag Karotte') &&
			!listeHtml.includes('Noch nichts aufgeschrieben.'),
		listeHtml.includes('Zwiebel mag Karotte')
			? 'der Freitext steht in der Liste'
			: 'der Titel fehlt'
	);

	/*
	 * Ändern, und zwar durch **eine andere Person** als die anlegende: wer
	 * ändert, ändert für alle, und es gibt keinen Autor, der es verwehren
	 * könnte. Die Adminperson steht hier für „irgendein anderes Mitglied" — die
	 * Route kennt den Unterschied nicht, und genau das ist die Zusage.
	 */
	const geaendertesBlatt = await abschicken(port, `${blattOrt.split('?')[0]}?/aendern`, adminKeks, {
		titel: 'Gute Nachbarn im Beet',
		text: 'Kohl mag Sellerie.',
	});
	pruefen(
		'ändern darf auch, wer das Blatt nicht angelegt hat',
		geaendertesBlatt.status === 303 &&
			geaendertesBlatt.headers.get('location') === `${blattOrt.split('?')[0]}?geaendert`,
		`${geaendertesBlatt.status} auf ${geaendertesBlatt.headers.get('location')}`
	);
	const nachAendern = await (
		await holen(port, `${blattOrt.split('?')[0]}?geaendert`, { keks: mitgliedKeks })
	).text();
	pruefen(
		'die anlegende Person sieht den neuen Stand, und der alte ist fort',
		nachAendern.includes('Geändert.') &&
			nachAendern.includes('Gute Nachbarn im Beet') &&
			!nachAendern.includes('Zwiebel mag Karotte'),
		nachAendern.includes('Zwiebel mag Karotte') ? 'der alte Text steht noch da' : 'der neue fehlt'
	);

	/*
	 * Eine Kennung, die es nicht gibt, ist ein 404 mit der Fehlerseite — nicht
	 * eine leere Blattseite und nicht ein 500.
	 */
	const unbekanntesBlatt = await holen(port, '/wissen/999999', { keks: mitgliedKeks });
	const unbekanntHtml = await unbekanntesBlatt.text();
	pruefen(
		'eine unbekannte Kennung ist über HTTP ein 404 mit dem Satz der Fehlerseite',
		unbekanntesBlatt.status === 404 && unbekanntHtml.includes('Diese Seite gibt es nicht.'),
		`${unbekanntesBlatt.status}: ${unbekanntHtml.slice(0, 120)}`
	);
	pruefenGleich(
		'und eine nicht numerische ebenso',
		(await holen(port, '/wissen/abc', { keks: mitgliedKeks })).status,
		404
	);

	/*
	 * Die Abweisung, ohne JavaScript: das Formular kommt **offen** zurück, beide
	 * Eingaben stehen wieder drin, und angelegt wurde nichts. Ohne das
	 * `open`-Attribut vom Server stünde der Fehlersatz unter einem zugeklappten
	 * Formular.
	 */
	const abgewiesenesBlatt = await abschicken(port, '/wissen?/anlegen', mitgliedKeks, {
		titel: '   ',
		text: blattText,
	});
	const blattAbweisungHtml = await abgewiesenesBlatt.text();
	const abweisungTeile = [
		['der Status ist 400', abgewiesenesBlatt.status === 400],
		['das Formular kommt offen zurück', /<details[^>]*\bopen\b/.test(blattAbweisungHtml)],
		['der lange Text steht wieder im Feld', blattAbweisungHtml.includes('Zwiebel mag Karotte')],
		['und der Satz steht dabei', blattAbweisungHtml.includes(BLATT_TITEL_FEHLT)],
	] as const;
	pruefen(
		'eine Abweisung trägt auch ohne JavaScript — offen, mit beiden Eingaben',
		fehlendeTeile(abweisungTeile).length === 0,
		`fehlt: ${fehlendeTeile(abweisungTeile).join(', ')}`
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
