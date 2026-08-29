/*
 * smoke:selftest — der Nachweis, dass der geteilte Prüfkern beisst.
 *
 * **Warum es das gibt.** Seit Story 3.0 entscheidet `scripts/pruefhelfer.ts`
 * allein über Rot und Grün für beide Prüfskripte — 373 Behauptungen in
 * `smoke` und 76 in `smoke:http`. Damit ist er der einzige ungeprüfte Code in
 * der ganzen ausgeführten Prüfkette, und sein Ausfall sähe **wie ein grüner
 * Lauf** aus, nicht wie ein Absturz: nimmt jemand das `gescheitert += 1` aus
 * `pruefen`, meldet jede gebrochene Zusage weiter „FEHLER" auf die
 * Fehlerausgabe, die Schlusszählung bleibt grün — und `npm run lint` endet mit
 * 0. Gemessen an einer Kopie, nicht vermutet.
 *
 * Die zwei anderen Prüfwerkzeuge des Projekts haben genau aus diesem Grund je
 * einen Selbsttest (`gate:selftest`, `db:check:selftest`). Dieser hier
 * schliesst die dritte Lücke und läuft in derselben Kette.
 *
 * **Warum das nicht im Kreis läuft.** Dieses Skript benutzt `pruefen`, um zu
 * melden — aber es *beobachtet* nicht sich selbst, sondern **Unterprozesse**:
 * jede Probe ist ein eigener Node-Lauf, und behauptet wird über seinen
 * Exit-Code und seine Ausgabe. Ein entwaffnetes `pruefen` könnte die eigene
 * Meldung dieses Skripts verfälschen, aber nicht den Exit-Code eines fremden
 * Prozesses — und genau der ist die Zusage. Dieselbe Bauform wie bei
 * `db:check --selftest`, wo die Proben ebenfalls als Unterprozess laufen,
 * damit der Exit-Code beobachtet ist und nicht bloss die Befundliste.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { aufraeumen } from './pruefhelfer.ts';

/*
 * **Dieses Skript meldet nicht über den Prüfling.**
 *
 * Der erste Entwurf benutzte `pruefen` aus `pruefhelfer.ts`, um seine eigenen
 * Befunde auszugeben — und die Gegenprobe hat ihn sofort widerlegt: nimmt man
 * das `gescheitert += 1` aus `pruefen`, verschwindet damit auch der Exit-Code
 * **dieses** Skripts, und der Selbsttest meldete „der geteilte Prüfkern beisst
 * nachweislich" über einen Kern, der nicht mehr beisst. Gemessen, nicht
 * ausgedacht.
 *
 * Darum stehen Zähler und Ausgabe hier eigenständig. Das ist die einzige
 * gewollte Verdopplung im Prüfwerkzeug dieses Projekts, und sie hat einen
 * Grund, der ohne sie nicht zu haben ist: was geprüft wird, darf nicht zugleich
 * das Urteil sprechen. Das Ausgabeformat bleibt wortgleich, damit ein roter
 * Lauf sich liest wie jeder andere.
 */
let eigeneBefunde = 0;
let eigeneBehauptungen = 0;

function behaupten(name: string, bedingung: boolean, hinweis?: string): void {
	eigeneBehauptungen += 1;
	if (bedingung) {
		console.log(`ok      ${name}`);
		return;
	}
	eigeneBefunde += 1;
	console.error(`FEHLER  ${name}${hinweis === undefined ? '' : ` — ${hinweis}`}`);
}

function behauptenGleich(name: string, ist: unknown, soll: unknown): void {
	behaupten(name, ist === soll, `war ${JSON.stringify(ist)}, erwartet ${JSON.stringify(soll)}`);
}

/** Wer eine Behauptung hinzufügt oder entfernt, zieht die Zahl mit. */
const ERWARTETE_BEHAUPTUNGEN = 14;

const wurzel = fileURLToPath(new URL('..', import.meta.url));
process.chdir(wurzel);

const helferUrl = pathToFileURL(fileURLToPath(new URL('./pruefhelfer.ts', import.meta.url))).href;

type Probe = { status: number | null; ausgabe: string; fehlerausgabe: string };

/**
 * Fährt einen Rumpf, der den Prüfkern benutzt, als eigenen Node-Prozess.
 *
 * `--input-type=module` und ein dynamischer Import über eine file-URL: dieselbe
 * Form, mit der `scripts/smoke-zugang.ts` den init-Hook im Unterprozess
 * beobachtet. So braucht keine Probe eine eigene Datei im Baum, die formatiert,
 * gelintet und typgeprüft werden müsste.
 */
function probe(rumpf: string): Probe {
	const lauf = spawnSync(
		process.execPath,
		[
			'--input-type=module',
			'--eval',
			`const h = await import(${JSON.stringify(helferUrl)});\n${rumpf}`,
		],
		{ cwd: wurzel, encoding: 'utf8', timeout: 30_000, stdio: ['ignore', 'pipe', 'pipe'] }
	);
	return {
		status: lauf.status,
		ausgabe: lauf.stdout ?? '',
		fehlerausgabe: lauf.stderr ?? '',
	};
}

/** Der Schlussblock, den beide Prüfskripte wortgleich führen. */
const SCHLUSS = `
const stand = h.zaehlerstand();
if (stand.gescheitert > 0) {
	console.error('probe: ' + stand.gescheitert + ' von ' + stand.gelaufen + ' nicht erfüllt.');
	process.exit(1);
}
console.log('probe: ' + stand.gelaufen + ' Behauptungen belegt.');
`;

try {
	// --- Probe 1: eine erfüllte Zusage bleibt grün ---------------------------
	const gruen = probe(
		`h.pruefen('eine erfüllte Zusage', true);\nh.pruefenGleich('und noch eine', 1, 1);${SCHLUSS}`
	);
	behauptenGleich('eine Prüfliste ohne Befund endet mit 0', gruen.status, 0);
	behaupten(
		'sie meldet keine FEHLER-Zeile',
		!gruen.fehlerausgabe.includes('FEHLER'),
		gruen.fehlerausgabe
	);
	behaupten(
		'sie zählt beide Behauptungen',
		gruen.ausgabe.includes('probe: 2 Behauptungen belegt.'),
		gruen.ausgabe
	);

	// --- Probe 2: eine gebrochene Zusage macht rot ---------------------------
	// Das ist die Behauptung, die den demonstrierten Ausfall fängt: ohne
	// `gescheitert += 1` in pruefen bliebe der Exit-Code hier 0.
	const rot = probe(
		`h.pruefen('eine erfüllte Zusage', true);\nh.pruefen('eine gebrochene Zusage', false, 'der Hinweis');${SCHLUSS}`
	);
	behauptenGleich('eine Prüfliste mit einem Befund endet mit 1', rot.status, 1);
	behaupten(
		'der Befund steht auf der Fehlerausgabe',
		rot.fehlerausgabe.includes('FEHLER  eine gebrochene Zusage'),
		rot.fehlerausgabe
	);
	behaupten(
		'der Hinweis steht daneben',
		rot.fehlerausgabe.includes('— der Hinweis'),
		rot.fehlerausgabe
	);
	behaupten(
		'die Schlussmeldung nennt 1 von 2',
		rot.fehlerausgabe.includes('probe: 1 von 2 nicht erfüllt.'),
		rot.fehlerausgabe
	);

	// --- Probe 3: pruefenGleich vergleicht wirklich --------------------------
	const ungleich = probe(`h.pruefenGleich('zwei ungleiche Werte', 'ist', 'soll');${SCHLUSS}`);
	behauptenGleich('pruefenGleich macht bei Ungleichheit rot', ungleich.status, 1);
	behaupten(
		'die Meldung nennt Ist und Soll',
		ungleich.fehlerausgabe.includes('war "ist", erwartet "soll"'),
		ungleich.fehlerausgabe
	);

	// --- Probe 4: ein unerwarteter Wurf ist ein Befund -----------------------
	const wurf = probe(`h.unerwarteterWurf('probe', new TypeError('etwas ging schief'));${SCHLUSS}`);
	behauptenGleich('ein unerwarteter Wurf endet mit 1', wurf.status, 1);
	behaupten(
		'er wird benannt statt als Stacktrace ausgeworfen',
		wurf.fehlerausgabe.includes('VERSTOSS probe  unerwarteter Wurf (TypeError): etwas ging schief'),
		wurf.fehlerausgabe
	);
	behaupten(
		'er zählt als gescheitert, aber nicht als gelaufene Behauptung',
		wurf.fehlerausgabe.includes('probe: 1 von 0 nicht erfüllt.'),
		wurf.fehlerausgabe
	);

	// --- Probe 5: das Wegwerfverzeichnis wird wirklich weggeräumt ------------
	const verzeichnis = probe(
		`const p = h.wegwerfVerzeichnis('gartenplaner-selftest-');\nconsole.log('PFAD ' + p);\nh.aufraeumen();${SCHLUSS}`
	);
	const gemeldeterPfad = /PFAD (.+)/.exec(verzeichnis.ausgabe)?.[1]?.trim() ?? '';
	behaupten(
		'die Probe hat ein Wegwerfverzeichnis angelegt',
		gemeldeterPfad !== '',
		verzeichnis.ausgabe
	);
	behaupten(
		'aufraeumen hat es wirklich entfernt',
		gemeldeterPfad !== '' && !existsSync(gemeldeterPfad),
		gemeldeterPfad
	);
} catch (fehler) {
	// Bewusst ohne unerwarteterWurf: dieses Skript prüft genau diese Funktion
	// und darf sich zum Melden nicht auf sie stützen.
	console.error(
		`VERSTOSS smoke:selftest  unerwarteter Wurf: ${fehler instanceof Error ? fehler.message : String(fehler)}`
	);
	process.exitCode = 1;
} finally {
	aufraeumen();
}

const abgelegt = eigeneBehauptungen;
behaupten(
	`alle ${ERWARTETE_BEHAUPTUNGEN} Behauptungen sind gelaufen`,
	abgelegt === ERWARTETE_BEHAUPTUNGEN,
	`es liefen ${abgelegt}`
);

if (eigeneBefunde > 0 || process.exitCode === 1) {
	console.error(
		`\nsmoke:selftest: ${eigeneBefunde} von ${eigeneBehauptungen} Behauptung(en) nicht erfüllt.`
	);
	process.exit(1);
}
console.log(
	`\nsmoke:selftest: ${eigeneBehauptungen} Behauptungen — der geteilte Prüfkern beisst nachweislich.`
);
