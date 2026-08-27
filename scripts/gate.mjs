#!/usr/bin/env node
/*
 * Das Tor. Es prüft die Invarianten des Gestaltungsrahmens, die weder eslint
 * noch svelte-check noch vite build sehen: ein umbenanntes Token bricht die
 * Darstellung, während alle drei grün melden.
 *
 * Dieses Projekt hat bewusst kein Testframework — damit ist dieses Skript der
 * Testersatz, und ein Prüfskript, das seine eigene Wirksamkeit nicht beweist,
 * täuscht Sicherheit vor. Darum gibt es `--selftest`: scripts/gate-fixtures/
 * enthält je ein Kleinprojekt mit einer absichtlichen Verletzung pro Regel,
 * und der Selbsttest scheitert, sobald eine davon nicht gefunden wird.
 *
 * Aufruf:
 *   node scripts/gate.mjs [zielverzeichnis]   prüft ein Projekt (Vorgabe: dieses)
 *   node scripts/gate.mjs --selftest          prüft das Tor gegen die Fehlerproben
 *
 * Die elf Regeln:
 *   1. In .svelte und .css unter src/ kein Farbliteral (Hex, rgb(), rgba(),
 *      hsl(), hsla(), oklch(), color() …, CSS-Farbname) und kein rohes
 *      px/rem-Literal ausser 0. Farbliteral heisst auch **Systemfarbe**
 *      (Canvas, GrayText …): in einer Komponente ist sie immer falsch, in .html
 *      ist nur die Auswahl aus systemfarbenErlaubt zugelassen. In .html unter
 *      src/ ausser app.html gilt der Farbteil der Regel — src/error.html trägt
 *      Gestaltungswerte und wurde vorher von keiner Regel gelesen, und sie ist
 *      ausschliesslich in Systemfarben gestaltet. Ausgenommen ist allein der
 *      Token-Block in app.html.
 *   2. Kein var() mit Fallback-Wert — der Fallback verdeckt genau Regel 3.
 *   3. Jedes in src/ benutzte var(--x) ist im :root-Block von app.html
 *      deklariert.
 *   4. Beide Richtungen: jedes Farb-Token aus :root hat einen Wert im
 *      Dunkel-Block, und kein Token existiert nur im Dunkel-Block.
 *   5. Die theme-color-Metas und die Farben im Manifest stimmen mit den
 *      zugehörigen Tokens überein.
 *   6. Jeder Icon- und Manifest-Pfad aus app.html und aus dem Manifest
 *      existiert unter static/.
 *   7. Für jede .svelte-Datei liefert `eslint --print-config` mindestens so
 *      viele svelte/*- und @typescript-eslint/*-Regeln, wie die Plugins in
 *      ihren recommended-Arrays führen.
 *   8. Tokens, die nirgends benutzt werden, sind ein Hinweis, kein Fehler.
 *   9. Unter src/routes/ kein Import von drizzle-orm, kein Import von
 *      better-sqlite3 und kein Import des Datenbank-Handles — weder als
 *      $lib/server/db noch als $lib/server/db/index noch über einen relativen
 *      Pfad auf db/index.ts. Ein reines `import type` ist ausgenommen —
 *      TypeScript löscht die Anweisung beim Bauen.
 *      Datenzugriff läuft ausschliesslich über die benannten Funktionen aus
 *      src/lib/server/db/queries/*.ts.
 *  10. Jede .css unter src/lib/styles/ wird von mindestens einer Datei unter
 *      src/routes/ importiert. Ein Stilblatt, das niemand einbindet, ist
 *      vollständig unsichtbar für eslint, svelte-check und vite build: die
 *      Datei ist gültig, sie wird nur nie geladen. Belegt hat das die gelöschte
 *      Importzeile von bedienelemente.css — gate blieb grün, bei unveränderter
 *      Hinweiszahl, während alle 44px-Trefferfelder, das einzige Rot und die
 *      16px, die iOS am Hineinzoomen hindern, aus der Auslieferung fielen.
 *  11. Jedes action="?/name" im Markup unter src/routes/ hat einen
 *      gleichnamigen Eintrag in der actions der Nachbar-+page.server.ts.
 *      Belegt: ein verschriebener Name passiert check, eslint und smoke grün,
 *      und der Knopf tut am laufenden Server nichts. Das Prüfskript ruft die
 *      actions über den Namensindex und umgeht SvelteKits Auflösung, kann diese
 *      Klasse also grundsätzlich nicht fangen.
 *
 * Zwei Eigenschaften der Umsetzung sind nicht verhandelbar, weil frühere
 * Fassungen genau daran vorbeigeschaut haben:
 *   - Die Analyse läuft über den gesamten Dateitext, nie zeilenweise. Prettier
 *     bricht lange var(...) um; zeilenweise gelesen blieb das Tor danach grün.
 *   - CSS-Kommentare werden vor jeder Auswertung ausgeblendet (durch Leerraum
 *     ersetzt, damit Offsets und Zeilennummern stimmen). Eine Erwähnung in
 *     einem Kommentar ist keine Deklaration.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import sveltePlugin from 'eslint-plugin-svelte';
import tsPlugin from 'typescript-eslint';

const projektWurzel = fileURLToPath(new URL('..', import.meta.url));
const probenWurzel = join(projektWurzel, 'scripts', 'gate-fixtures');
const dunkelMarke = '@media (prefers-color-scheme: dark)';
const geprüfteEndungen = ['.svelte', '.css', '.html', '.ts', '.js'];

/**
 * Die 148 CSS-Farbnamen. `transparent` und `currentcolor` stehen bewusst nicht
 * darin: beide bezeichnen keinen Gestaltungswert, sondern die Abwesenheit eines
 * Werts, und beide werden gebraucht (etwa `solid transparent` für eine Kante,
 * die immer liegt).
 */
const farbnamen = new Set(
	`aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue
	blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk
	crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki
	darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen
	darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue
	dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite
	gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki
	lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan
	lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen
	lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen
	magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen
	mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream
	mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid
	palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum
	powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown
	seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen
	steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow
	yellowgreen`
		.split(/\s+/)
		.filter(Boolean)
);

// ---------------------------------------------------------------------------
// Textwerkzeuge. Alle Ersetzungen tauschen Zeichen gegen Leerzeichen aus und
// lassen Zeilenumbrüche stehen, damit Offsets und Zeilennummern gültig bleiben.
// ---------------------------------------------------------------------------

/** @param {string} treffer */
const ausgeblendet = (treffer) => treffer.replace(/[^\n]/g, ' ');

/**
 * Blendet Blockkommentare und HTML-Kommentare aus. Diese zwei Formen sind in
 * jeder hier geprüften Dateiart wirklich Kommentare, also darf das überall
 * laufen.
 * @param {string} text
 */
const ohneKommentare = (text) =>
	text.replace(/\/\*[\s\S]*?\*\//g, ausgeblendet).replace(/<!--[\s\S]*?-->/g, ausgeblendet);

/**
 * Blendet **Zeilenkommentare** aus — aber nur dort, wo `//` wirklich ein
 * Kommentar sein kann, also niemals in CSS.
 *
 * Die Fassung ohne diese Einschränkung war eine Regression und ist gemessen:
 * `url(//cdn.example.com/x.png); color: #ff0000;` in einer Zeile liess Regel 1
 * schweigen, weil der Zeilenrest samt Farbliteral geleert wurde. In CSS ist `//`
 * kein Kommentar, sondern der Anfang einer schemarelativen Adresse.
 *
 * Gebraucht wird die Ausblendung trotzdem: ohne sie gäbe ein auskommentierter
 * Import unter src/routes/ einen falschen Verstoss zu Regel 9 — und wer einen
 * falschen Verstoss wegdiskutiert, diskutiert bald auch einen echten weg.
 *
 * Darum: in .css gar nicht, in .svelte und .html überall ausser in den
 * CSS-Abschnitten, in .ts und .js überall. Die Rückschau (?<![:\\]) hält
 * zusätzlich Adressen in Zeichenketten heraus.
 *
 * scripts/gate-fixtures/regel-1b-doppelschraegstrich-in-url belegt beide
 * Richtungen: die Regel greift in CSS weiterhin, und der auskommentierte Import
 * in regel-9d zählt weiterhin nicht.
 *
 * @param {string} datei
 * @param {string} text bereits ohne Block- und HTML-Kommentare
 */
const ohneZeilenkommentare = (datei, text) => {
	if (datei.endsWith('.css')) return text;

	const abschnitte = cssAbschnitte(datei, text);
	if (abschnitte.length === 0) return text.replace(/(?<![:\\])\/\/[^\n]*/g, ausgeblendet);

	// Nur ausserhalb der CSS-Abschnitte ersetzen. Die Abschnitte bleiben Zeichen
	// für Zeichen stehen, damit Regel 1 dort dieselben Offsets sieht.
	const geschützt = abschnitte
		.map(({ inhalt, versatz }) => ({ von: versatz, bis: versatz + inhalt.length }))
		.sort((a, b) => a.von - b.von);

	let ergebnis = '';
	let stelle = 0;
	for (const { von, bis } of geschützt) {
		if (von > stelle) {
			ergebnis += text.slice(stelle, von).replace(/(?<![:\\])\/\/[^\n]*/g, ausgeblendet);
		}
		ergebnis += text.slice(Math.max(stelle, von), bis);
		stelle = Math.max(stelle, bis);
	}
	ergebnis += text.slice(stelle).replace(/(?<![:\\])\/\/[^\n]*/g, ausgeblendet);
	return ergebnis;
};

/** Bedingungen von @media, @supports und @container tragen keine Tokens.
 * @param {string} text */
const ohneAtBedingungen = (text) =>
	text.replace(/@(?:media|supports|container)[^{;]*/g, ausgeblendet);

/**
 * @param {string} text
 * @param {number} index
 */
const zeileVon = (text, index) => text.slice(0, Math.max(index, 0)).split('\n').length;

/**
 * Die CSS-Abschnitte einer Datei mit ihrem Versatz im Originaltext.
 * Für .css ist das die ganze Datei, für .svelte und .html die <style>-Blöcke
 * und die style-Attribute im Markup. Regel 1 gilt nur für CSS, nicht für Markup
 * oder Skript — dort ist ein `#` eine Sprungmarke und keine Farbe.
 * @param {string} datei
 * @param {string} text
 * @returns {{ inhalt: string, versatz: number }[]}
 */
const cssAbschnitte = (datei, text) => {
	if (datei.endsWith('.css')) return [{ inhalt: text, versatz: 0 }];
	if (!datei.endsWith('.svelte') && !datei.endsWith('.html')) return [];

	/** @type {{ inhalt: string, versatz: number }[]} */
	const abschnitte = [];
	for (const treffer of text.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
		const versatz = (treffer.index ?? 0) + treffer[0].indexOf('>') + 1;
		abschnitte.push({ inhalt: treffer[1], versatz });
	}
	for (const treffer of text.matchAll(/\sstyle="([^"]*)"/g)) {
		const versatz = (treffer.index ?? 0) + treffer[0].indexOf('"') + 1;
		abschnitte.push({ inhalt: treffer[1], versatz });
	}
	return abschnitte;
};

/**
 * Blendet verschachtelte Blöcke aus, damit Deklarationen nur auf der obersten
 * Ebene eines Blocks gezählt werden.
 * @param {string} text
 */
const ohneVerschachtelung = (text) => {
	let ergebnis = '';
	let tiefe = 0;
	for (const zeichen of text) {
		if (zeichen === '{') {
			tiefe += 1;
			ergebnis += ' ';
		} else if (zeichen === '}') {
			tiefe = Math.max(tiefe - 1, 0);
			ergebnis += ' ';
		} else if (tiefe > 0) {
			ergebnis += zeichen === '\n' ? '\n' : ' ';
		} else {
			ergebnis += zeichen;
		}
	}
	return ergebnis;
};

/**
 * Schneidet den Block ab `von` per Klammertiefe.
 * @param {string} text
 * @param {number} von
 * @returns {{ innenVon: number, innenBis: number, bis: number } | null}
 */
const blockAb = (text, von) => {
	const auf = text.indexOf('{', von);
	if (auf < 0) return null;
	let tiefe = 0;
	for (let i = auf; i < text.length; i += 1) {
		if (text[i] === '{') tiefe += 1;
		else if (text[i] === '}') {
			tiefe -= 1;
			if (tiefe === 0) return { innenVon: auf + 1, innenBis: i, bis: i + 1 };
		}
	}
	return null;
};

/** @param {string} wert */
const normalisierteFarbe = (wert) => {
	const gekürzt = wert.trim().toLowerCase().replace(/;$/, '');
	const treffer = /^#([0-9a-f]{3,8})$/.exec(gekürzt);
	if (!treffer) return gekürzt;
	const ziffern = treffer[1];
	if (ziffern.length === 3 || ziffern.length === 4) {
		return `#${[...ziffern].map((z) => z + z).join('')}`;
	}
	return `#${ziffern}`;
};

/**
 * Die CSS-Systemfarben. Sie sind Farbwerte wie jeder Hex-Wert, tragen aber
 * keinen Gestaltungswert des Projekts, sondern den des Betriebssystems.
 *
 * Sie stehen hier, weil die eine Datei, für die Regel 1 auf .html erweitert
 * wurde — src/error.html —, **ausschliesslich** in Systemfarben gestaltet ist.
 * Die Regel hätte sie sonst auf eine Wertform geprüft, die sie nicht benutzt.
 */
const systemfarben = new Set(
	`accentcolor accentcolortext activetext buttonborder buttonface buttontext canvas
	canvastext field fieldtext graytext highlight highlighttext linktext mark marktext
	selecteditem selecteditemtext visitedtext`
		.split(/\s+/)
		.filter(Boolean)
);

/**
 * Die erlaubte Auswahl. Canvas und CanvasText folgen dem Schema des Systems und
 * halten in beiden Modi den Kontrast; alles andere ist entweder eine Rolle, die
 * diese Seite nicht hat, oder — wie GrayText — absichtlich kontrastarm.
 *
 * Eine Auswahl statt einer Einzelfallprüfung im Skript: wer eine weitere
 * Systemfarbe braucht, trägt sie hier ein und begründet sie an einer Stelle.
 */
const systemfarbenErlaubt = new Set(['canvas', 'canvastext']);

/**
 * Ein Token gilt als Farb-Token, wenn sein Wert im :root-Block eine Farbe ist.
 * Damit leitet Regel 4 ihre Menge aus den Werten ab und nicht aus einer im
 * Skript gepflegten Namensliste, die beim nächsten neuen Token veralten würde.
 * @param {string} wert
 */
const istFarbwert = (wert) => {
	const gekürzt = wert.trim().toLowerCase().replace(/;$/, '');
	if (farbnamen.has(gekürzt)) return true;
	if (systemfarben.has(gekürzt)) return true;
	if (/^#[0-9a-f]{3,8}$/.test(gekürzt)) return true;
	return /^(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix)\s*\(/.test(gekürzt);
};

/**
 * Jeder Modul-Spezifizierer einer Datei mit seinem Versatz. Bewusst rein
 * textuell: das Tor darf keinen Parser für vier Dateiformen mitbringen, und ein
 * Import, der nur in einem Kommentar steht, ist vorher schon ausgeblendet.
 *
 * `nurTyp` markiert eine Anweisung, die mit `import type` oder `export type`
 * beginnt. TypeScript löscht sie beim Bauen; sie ist kein Modulaufruf.
 * @param {string} text
 * @returns {{ spez: string, index: number, nurTyp: boolean }[]}
 */
const importStellen = (text) => {
	/** @type {{ spez: string, index: number, nurTyp: boolean }[]} */
	const gefunden = [];
	const muster = [
		/\bfrom\s*['"]([^'"]+)['"]/g,
		/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
		/\bimport\s+['"]([^'"]+)['"]/g,
		/\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
	];
	for (const muster_ of muster) {
		for (const treffer of text.matchAll(muster_)) {
			const index = treffer.index ?? 0;
			// Rückwärts bis zum Anfang der Anweisung schauen. 400 Zeichen reichen
			// für jede von Prettier umbrochene Importliste, und ein Semikolon oder
			// eine schliessende Klammer dazwischen beendet die Suche.
			const davor = text.slice(Math.max(0, index - 400), index);
			const nurTyp = /\b(?:import|export)\s+type\b[^;)]*$/.test(davor);
			gefunden.push({ spez: treffer[1], index, nurTyp });
		}
	}
	return gefunden;
};

/**
 * Führt einen Spezifizierer auf einen projektrelativen Modulpfad ohne Endung
 * und ohne /index zurück. Damit fallen $lib/server/db, $lib/server/db/index und
 * ein relativer Pfad auf db/index.ts auf dieselbe Form zusammen — jede von
 * ihnen einzeln zu suchen hiesse, die vierte zu vergessen.
 * @param {string} ziel Wurzel des geprüften Projekts
 * @param {string} datei absoluter Pfad der importierenden Datei
 * @param {string} spez
 * @returns {string | null}
 */
const modulBasis = (ziel, datei, spez) => {
	/** @type {string} */
	let pfad;
	if (spez === '$lib') pfad = join('src', 'lib');
	else if (spez.startsWith('$lib/')) pfad = join('src', 'lib', spez.slice('$lib/'.length));
	else if (spez.startsWith('.')) pfad = relative(ziel, resolve(dirname(datei), spez));
	else return null;

	return pfad
		.split(sep)
		.join('/')
		.replace(/\.(?:ts|mts|cts|js|mjs|cjs)$/, '')
		.replace(/\/index$/, '');
};

/**
 * Die Regelsatz-Grössen aus den Plugins ableiten statt sie im Code
 * festzuschreiben: eine Zahl im Skript veraltet mit dem nächsten Update.
 * @param {readonly import('eslint').Linter.Config[]} konfigurationen
 * @param {string} präfix
 */
const regelanzahl = (konfigurationen, präfix) => {
	/** @type {Map<string, unknown>} */
	const gefunden = new Map();
	for (const konfiguration of konfigurationen) {
		for (const [name, wert] of Object.entries(konfiguration.rules ?? {})) {
			if (name.startsWith(präfix)) gefunden.set(name, wert);
		}
	}
	return [...gefunden.values()].filter((wert) => {
		const schwere = Array.isArray(wert) ? wert[0] : wert;
		return schwere !== 0 && schwere !== 'off';
	}).length;
};

const erwarteteSvelteRegeln = regelanzahl(sveltePlugin.configs.recommended, 'svelte/');
const erwarteteTsRegeln = regelanzahl(tsPlugin.configs.recommended, '@typescript-eslint/');

// ---------------------------------------------------------------------------
// Die Prüfung eines Zielverzeichnisses
// ---------------------------------------------------------------------------

/**
 * @typedef {{ regel: number, datei: string, zeile: number, meldung: string }} Befund
 * @typedef {{ verstösse: Befund[], hinweise: Befund[], dateien: number, tokens: number }} Ergebnis
 */

/**
 * @param {string} ziel Wurzel des zu prüfenden Projekts
 * @returns {Ergebnis}
 */
const torPrüfen = (ziel) => {
	/** @type {Befund[]} */
	const verstösse = [];
	/** @type {Befund[]} */
	const hinweise = [];

	/**
	 * @param {number} regel
	 * @param {string} datei
	 * @param {number} zeile
	 * @param {string} meldung
	 */
	const melden = (regel, datei, zeile, meldung) => {
		verstösse.push({ regel, datei: relative(ziel, datei) || '.', zeile, meldung });
	};

	/**
	 * Jeder Lesefehler wird ein benannter Verstoss, nie ein Stacktrace.
	 * @param {string} pfad
	 * @param {number} regel
	 * @returns {string | null}
	 */
	const lesen = (pfad, regel) => {
		try {
			return readFileSync(pfad, 'utf8');
		} catch (fehler) {
			melden(regel, pfad, 1, `nicht lesbar: ${fehler instanceof Error ? fehler.message : fehler}`);
			return null;
		}
	};

	const quelle = join(ziel, 'src');
	const routenWurzel = join(quelle, 'routes') + sep;
	const shell = join(quelle, 'app.html');
	const statisch = join(ziel, 'static');
	const manifestPfad = join(statisch, 'manifest.webmanifest');

	/**
	 * @param {string} verzeichnis
	 * @returns {string[]}
	 */
	const dateienUnter = (verzeichnis) => {
		/** @type {import('node:fs').Dirent[]} */
		let einträge;
		try {
			einträge = readdirSync(verzeichnis, { withFileTypes: true });
		} catch (fehler) {
			melden(
				0,
				verzeichnis,
				1,
				`Verzeichnis nicht lesbar: ${fehler instanceof Error ? fehler.message : fehler}`
			);
			return [];
		}
		return einträge.flatMap((eintrag) => {
			const pfad = join(verzeichnis, eintrag.name);
			if (eintrag.isDirectory()) return dateienUnter(pfad);
			return geprüfteEndungen.some((endung) => eintrag.name.endsWith(endung)) ? [pfad] : [];
		});
	};

	// -------------------------------------------------------------------
	// Token-Blöcke aus app.html. Kommentare sind hier schon ausgeblendet:
	// eine Erwähnung in einem Kommentar ist keine Deklaration.
	// -------------------------------------------------------------------
	const shellRoh = lesen(shell, 3);
	const shellText = shellRoh === null ? '' : ohneKommentare(shellRoh);

	/** @type {Map<string, string>} */
	const hellTokens = new Map();
	/** @type {Map<string, string>} */
	const dunkelTokens = new Map();

	/**
	 * @param {string} innen
	 * @returns {Map<string, string>}
	 */
	const deklarationenAus = (innen) => {
		/** @type {Map<string, string>} */
		const gefunden = new Map();
		for (const treffer of ohneVerschachtelung(innen).matchAll(/(--[\w-]+)\s*:\s*([^;]*)/g)) {
			gefunden.set(treffer[1], treffer[2].trim());
		}
		return gefunden;
	};

	if (shellRoh !== null) {
		// Der Dunkel-Block wird per Klammertiefe geschnitten. Ein fehlender,
		// leerer, doppelter oder unbalancierter Block ist selbst eine Verletzung.
		const markenStellen = [
			...shellText.matchAll(/@media\s*\(\s*prefers-color-scheme:\s*dark\s*\)/g),
		];
		let dunkelVon = -1;
		let dunkelBis = shellText.length;
		let dunkelInnen = '';

		if (markenStellen.length === 0) {
			melden(4, shell, 1, `kein Block ${dunkelMarke} — der dunkle Modus hat keine Token-Werte`);
		} else {
			if (markenStellen.length > 1) {
				melden(
					4,
					shell,
					zeileVon(shellText, markenStellen[1].index ?? 0),
					`${markenStellen.length} Blöcke ${dunkelMarke} — der Dunkel-Block muss eindeutig sein`
				);
			}
			dunkelVon = markenStellen[0].index ?? 0;
			const medienBlock = blockAb(shellText, dunkelVon);
			if (medienBlock === null) {
				melden(
					4,
					shell,
					zeileVon(shellText, dunkelVon),
					`der Block ${dunkelMarke} ist unbalanciert — die schliessende Klammer fehlt`
				);
			} else {
				dunkelBis = medienBlock.bis;
				const medienInnen = shellText.slice(medienBlock.innenVon, medienBlock.innenBis);
				const rootVon = medienInnen.search(/:root\s*\{/);
				const rootBlock = rootVon < 0 ? null : blockAb(medienInnen, rootVon);
				if (rootBlock === null) {
					melden(
						4,
						shell,
						zeileVon(shellText, dunkelVon),
						`im Block ${dunkelMarke} steht kein balancierter :root-Block`
					);
				} else {
					dunkelInnen = medienInnen.slice(rootBlock.innenVon, rootBlock.innenBis);
				}
			}
		}

		// Der Hell-Block ist der eindeutige :root-Block ausserhalb des Dunkel-Blocks.
		const hellText =
			dunkelVon < 0
				? shellText
				: shellText.slice(0, dunkelVon) +
					ausgeblendet(shellText.slice(dunkelVon, dunkelBis)) +
					shellText.slice(dunkelBis);
		const hellStellen = [...hellText.matchAll(/:root\s*\{/g)];
		if (hellStellen.length === 0) {
			melden(3, shell, 1, 'kein :root-Block gefunden — der Gestaltungsrahmen fehlt');
		} else {
			if (hellStellen.length > 1) {
				melden(
					3,
					shell,
					zeileVon(hellText, hellStellen[1].index ?? 0),
					`${hellStellen.length} :root-Blöcke im hellen Teil — der Token-Block muss eindeutig sein`
				);
			}
			const hellBlock = blockAb(hellText, hellStellen[0].index ?? 0);
			if (hellBlock === null) {
				melden(3, shell, 1, 'der :root-Block ist unbalanciert');
			} else {
				for (const [name, wert] of deklarationenAus(
					hellText.slice(hellBlock.innenVon, hellBlock.innenBis)
				)) {
					hellTokens.set(name, wert);
				}
			}
		}

		for (const [name, wert] of deklarationenAus(dunkelInnen)) dunkelTokens.set(name, wert);

		// ----- Regel 4, beide Richtungen -----
		if (markenStellen.length > 0 && dunkelTokens.size === 0) {
			melden(
				4,
				shell,
				zeileVon(shellText, Math.max(dunkelVon, 0)),
				`der Block ${dunkelMarke} deklariert kein einziges Token`
			);
		}
		for (const [name, wert] of hellTokens) {
			if (!istFarbwert(wert)) continue;
			if (dunkelTokens.has(name)) continue;
			melden(
				4,
				shell,
				1,
				`Farb-Token ${name} hat keinen Wert im Dunkel-Block — die Fläche bliebe im dunklen Modus unbemalt`
			);
		}
		for (const name of dunkelTokens.keys()) {
			if (hellTokens.has(name)) continue;
			melden(4, shell, 1, `Token ${name} existiert nur im Dunkel-Block, nicht im :root-Block`);
		}
	}

	// -------------------------------------------------------------------
	// Regeln 1, 2, 3 über alle Dateien unter src/
	// -------------------------------------------------------------------
	const dateien = existsSync(quelle) ? dateienUnter(quelle).sort() : [];
	if (dateien.length === 0) melden(0, quelle, 1, 'keine Quelldateien gefunden');

	/** @type {Set<string>} */
	const benutzteTokens = new Set();

	for (const datei of dateien) {
		const roh = lesen(datei, 0);
		if (roh === null) continue;
		// **Eine** Textfassung für alle Regeln, und die Kommentarbehandlung steckt
		// vollständig in den zwei Funktionen darüber.
		//
		// Zwei Fassungen zu halten — eine für Regel 1, eine für die übrigen — wäre
		// bequem, hätte aber zwei voneinander unabhängige Sicherungen für dieselbe
		// Eigenschaft ergeben. Gemessen: mit zwei Fassungen bleibt der Selbsttest
		// grün, obwohl die Ausblendung wieder zu weit greift, weil Regel 1 die
		// betroffene Fassung gar nicht liest. Eine Sicherung, die niemand prüfen
		// kann, ist keine.
		const text = ohneZeilenkommentare(datei, ohneKommentare(roh));

		// ----- Regel 2: var() mit Fallback, über den gesamten Dateitext -----
		for (const treffer of text.matchAll(/var\(\s*(--[\w-]+)\s*,/g)) {
			melden(
				2,
				datei,
				zeileVon(text, treffer.index ?? 0),
				`var(${treffer[1]}, …) trägt einen Fallback — der Fallback verdeckt ein fehlendes Token`
			);
		}

		// ----- Regel 3: jedes benutzte Token ist im :root-Block deklariert -----
		for (const treffer of text.matchAll(/var\(\s*(--[\w-]+)/g)) {
			benutzteTokens.add(treffer[1]);
			if (hellTokens.has(treffer[1])) continue;
			melden(
				3,
				datei,
				zeileVon(text, treffer.index ?? 0),
				`Token ${treffer[1]} ist im :root-Block von src/app.html nicht deklariert`
			);
		}

		// ----- Regel 9: kein Datenzugriff unter src/routes/ -----
		if (datei.startsWith(routenWurzel)) {
			for (const { spez, index, nurTyp } of importStellen(text)) {
				const basis = modulBasis(ziel, datei, spez);
				// better-sqlite3 gehört dazu: der Treiber umgeht Drizzle **und** das
				// Repository in einem Schritt. Eine Route, die ihn selbst öffnet, hat
				// eine zweite Verbindung ohne WAL, ohne busy_timeout und ohne
				// Migrationsstand — schlimmer als ein Drizzle-Aufruf, nicht besser.
				const form = /^drizzle-orm(?:\/|$)/.test(spez)
					? 'drizzle-orm'
					: /^better-sqlite3(?:\/|$)/.test(spez)
						? 'der SQLite-Treiber better-sqlite3'
						: basis !== null && /(?:^|\/)server\/db$/.test(basis)
							? 'das Datenbank-Handle'
							: null;
				if (form === null) continue;
				// Ein reines `import type { … }` ist kein Datenzugriff: TypeScript
				// löscht die Anweisung beim Bauen, es entsteht kein Modulaufruf und
				// keine zweite Verbindung. Eine Route darf einen Zeilentyp benennen.
				// Der Inline-Modifikator (`import { type A }`) fällt bewusst nicht
				// darunter: dort steht eine Wertanweisung, die bleiben kann.
				if (nurTyp) continue;
				melden(
					9,
					datei,
					zeileVon(text, index),
					`${form} über '${spez}' importiert — unter src/routes/ läuft Datenzugriff ` +
						'ausschliesslich über die benannten Funktionen aus src/lib/server/db/queries/*.ts'
				);
			}
		}

		// ----- Regel 1: Farb- und Massliterale in CSS -----
		// app.html trägt den Token-Block und ist die einzige Ausnahme.
		if (datei === shell) continue;

		// In .html gilt nur der Farbteil: src/error.html ist eine eigenständige
		// Minimalseite ohne Zugriff auf den Token-Block, ihre Masse stehen dort
		// notwendigerweise als Zahl.
		const nurFarben = datei.endsWith('.html');

		for (const { inhalt, versatz } of cssAbschnitte(datei, text)) {
			const zeileAb = (/** @type {number} */ index) => zeileVon(text, versatz + index);

			for (const treffer of inhalt.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
				if (![4, 5, 7, 9].includes(treffer[0].length)) continue;
				melden(
					1,
					datei,
					zeileAb(treffer.index ?? 0),
					`Farbliteral ${treffer[0]} — der Wert gehört in den Token-Block von src/app.html`
				);
			}

			for (const treffer of inhalt.matchAll(
				/\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color-mix|color)\s*\(/g
			)) {
				melden(
					1,
					datei,
					zeileAb(treffer.index ?? 0),
					`Farbliteral ${treffer[1]}(…) — der Wert gehört in den Token-Block von src/app.html`
				);
			}

			// Farbnamen und Masse nur ausserhalb der @-Bedingungen: eine
			// Medienabfrage kann keine Custom Property lesen, der Umbruchpunkt
			// muss dort als Zahl stehen.
			const ohneBedingungen = ohneAtBedingungen(inhalt);

			for (const treffer of ohneBedingungen.matchAll(/[a-zA-Z][a-zA-Z0-9]*/g)) {
				const wort = treffer[0].toLowerCase();

				if (farbnamen.has(wort)) {
					melden(
						1,
						datei,
						zeileAb(treffer.index ?? 0),
						`CSS-Farbname ${treffer[0]} — der Wert gehört in den Token-Block von src/app.html`
					);
					continue;
				}

				if (!systemfarben.has(wort)) continue;

				// Systemfarben sind der einzige erlaubte Weg für eine .html-Datei, die
				// keinen Zugriff auf den Token-Block hat — und dort nur die Auswahl
				// aus systemfarbenErlaubt. In einer Komponente sind sie immer falsch:
				// dort gibt es Tokens, und beide Modi sind gestaltet.
				if (!nurFarben) {
					melden(
						1,
						datei,
						zeileAb(treffer.index ?? 0),
						`Systemfarbe ${treffer[0]} — in einer Komponente kommt jede Farbe aus einem Token in src/app.html`
					);
					continue;
				}
				if (systemfarbenErlaubt.has(wort)) continue;
				melden(
					1,
					datei,
					zeileAb(treffer.index ?? 0),
					`Systemfarbe ${treffer[0]} steht nicht in der erlaubten Auswahl (${[...systemfarbenErlaubt].join(', ')}) — ` +
						'GrayText etwa ist die Farbe für Deaktiviertes und wird absichtlich kontrastarm gerendert'
				);
			}

			if (nurFarben) continue;

			for (const treffer of ohneBedingungen.matchAll(
				/(?<![\w.-])(\d+(?:\.\d+)?|\.\d+)(px|rem)\b/g
			)) {
				if (Number(treffer[1]) === 0) continue;
				melden(
					1,
					datei,
					zeileAb(treffer.index ?? 0),
					`rohes Mass ${treffer[0]} — jede Grösse kommt aus einem Token in src/app.html`
				);
			}
		}
	}

	// -------------------------------------------------------------------
	// Regel 5: die Farben stehen dreifach — Token, Meta, Manifest
	// -------------------------------------------------------------------
	/** @type {Record<string, unknown>} */
	let manifest = {};
	const manifestRoh = lesen(manifestPfad, 5);
	if (manifestRoh !== null) {
		try {
			manifest = JSON.parse(manifestRoh);
		} catch (fehler) {
			melden(
				5,
				manifestPfad,
				1,
				`kein gültiges JSON: ${fehler instanceof Error ? fehler.message : fehler}`
			);
		}
	}

	/** @type {Map<string, string>} */
	const themeFarben = new Map();
	for (const treffer of shellText.matchAll(/<meta\b[^>]*>/g)) {
		const tag = treffer[0];
		if (!/name=["']theme-color["']/.test(tag)) continue;
		const inhalt = /content=["']([^"']*)["']/.exec(tag);
		if (inhalt === null) {
			melden(5, shell, zeileVon(shellText, treffer.index ?? 0), 'theme-color ohne content');
			continue;
		}
		const medien = /media=["']([^"']*)["']/.exec(tag);
		const schlüssel =
			medien === null ? 'unqualifiziert' : /dark/.test(medien[1]) ? 'dunkel' : 'hell';
		themeFarben.set(schlüssel, inhalt[1]);
	}

	/** @type {{ quelle: string, wert: unknown, token: string, block: 'hell' | 'dunkel' }[]} */
	const abgleich = [
		{
			quelle: 'src/app.html: theme-color (unqualifiziert)',
			wert: themeFarben.get('unqualifiziert'),
			token: '--accent',
			block: 'hell',
		},
		{
			quelle: 'src/app.html: theme-color (prefers-color-scheme: light)',
			wert: themeFarben.get('hell'),
			token: '--accent',
			block: 'hell',
		},
		{
			quelle: 'src/app.html: theme-color (prefers-color-scheme: dark)',
			wert: themeFarben.get('dunkel'),
			token: '--accent',
			block: 'dunkel',
		},
		{
			quelle: 'static/manifest.webmanifest: theme_color',
			wert: manifest.theme_color,
			token: '--accent',
			block: 'hell',
		},
		{
			quelle: 'static/manifest.webmanifest: background_color',
			wert: manifest.background_color,
			token: '--surface-base',
			block: 'hell',
		},
	];

	for (const { quelle: name, wert, token, block } of abgleich) {
		const soll = block === 'hell' ? hellTokens.get(token) : dunkelTokens.get(token);
		if (soll === undefined) {
			melden(5, shell, 1, `${name} soll ${token} (${block}) spiegeln, das Token fehlt aber`);
			continue;
		}
		if (typeof wert !== 'string') {
			melden(5, shell, 1, `${name} fehlt — der Wert soll ${token} (${block}) spiegeln`);
			continue;
		}
		if (normalisierteFarbe(wert) === normalisierteFarbe(soll)) continue;
		melden(
			5,
			shell,
			1,
			`${name} ist ${wert}, ${token} (${block}) ist aber ${soll} — die beiden müssen übereinstimmen`
		);
	}

	// -------------------------------------------------------------------
	// Regel 6: jeder Pfad zeigt auf eine Datei, die es gibt
	// -------------------------------------------------------------------
	/** @type {{ quelle: string, pfad: string }[]} */
	const pfade = [];
	for (const treffer of shellText.matchAll(/<link\b[^>]*>/g)) {
		const href = /href=["']([^"']*)["']/.exec(treffer[0]);
		if (href === null || !href[1].startsWith('/')) continue;
		pfade.push({ quelle: 'src/app.html', pfad: href[1] });
	}
	const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
	for (const icon of icons) {
		const src =
			icon && typeof icon === 'object' ? /** @type {{ src?: unknown }} */ (icon).src : null;
		if (typeof src !== 'string' || !src.startsWith('/')) {
			melden(6, manifestPfad, 1, `Icon-Eintrag ohne brauchbaren src: ${JSON.stringify(icon)}`);
			continue;
		}
		pfade.push({ quelle: 'static/manifest.webmanifest', pfad: src });
	}
	for (const { quelle: name, pfad } of pfade) {
		let vorhanden;
		try {
			vorhanden = statSync(join(statisch, pfad)).isFile();
		} catch {
			vorhanden = false;
		}
		if (vorhanden) continue;
		melden(6, join(ziel, name), 1, `${name} verweist auf ${pfad}, unter static/ gibt es das nicht`);
	}

	// -------------------------------------------------------------------
	// Regel 7: beide Regelsätze hängen an jeder .svelte-Datei
	// -------------------------------------------------------------------
	const komponenten = dateien.filter((datei) => datei.endsWith('.svelte'));
	const eslintBinär = join(
		projektWurzel,
		'node_modules',
		'.bin',
		process.platform === 'win32' ? 'eslint.cmd' : 'eslint'
	);
	const eslintKonfig = join(ziel, 'eslint.config.js');

	if (komponenten.length === 0) {
		melden(7, quelle, 1, 'keine .svelte-Datei gefunden — Regel 7 kann nichts prüfen');
	} else if (!existsSync(eslintKonfig)) {
		melden(7, eslintKonfig, 1, 'eslint.config.js fehlt — die Regelsätze sind nicht nachweisbar');
	} else if (!existsSync(eslintBinär)) {
		melden(7, eslintBinär, 1, 'lokales eslint-Binary fehlt — npm install ausführen');
	} else {
		for (const datei of komponenten) {
			/** @type {string} */
			let ausgabe;
			try {
				ausgabe = execFileSync(
					eslintBinär,
					[
						'--no-config-lookup',
						'--config',
						eslintKonfig,
						'--print-config',
						relative(ziel, datei) || datei,
					],
					{
						cwd: ziel,
						encoding: 'utf8',
						maxBuffer: 64 * 1024 * 1024,
						stdio: ['ignore', 'pipe', 'pipe'],
					}
				);
			} catch (fehler) {
				// Die ersten zwei tragenden Zeilen aus stderr, ohne eslints Banner
				// und ohne Stacktrace — eine Meldung, mit der man arbeiten kann.
				const ausStderr =
					fehler instanceof Error && 'stderr' in fehler && typeof fehler.stderr === 'string'
						? fehler.stderr
								.split('\n')
								.map((zeile) => zeile.trim())
								.filter(
									(zeile) =>
										zeile.length > 0 &&
										!zeile.startsWith('Oops!') &&
										!zeile.startsWith('at ') &&
										/[a-zA-Z]/.test(zeile)
								)
								.slice(0, 2)
								.join(' / ')
						: '';
				const grund =
					ausStderr || (fehler instanceof Error ? fehler.message : String(fehler)) || 'unbekannt';
				melden(7, datei, 1, `eslint --print-config gescheitert: ${grund}`);
				continue;
			}

			/** @type {{ rules?: Record<string, unknown> }} */
			let konfiguration;
			try {
				konfiguration = JSON.parse(ausgabe);
			} catch (fehler) {
				melden(
					7,
					datei,
					1,
					`eslint --print-config lieferte kein JSON: ${fehler instanceof Error ? fehler.message : fehler}`
				);
				continue;
			}

			const regeln = Object.entries(konfiguration.rules ?? {});
			/** @param {string} präfix */
			const aktiv = (präfix) =>
				regeln.filter(([name, wert]) => {
					if (!name.startsWith(präfix)) return false;
					const schwere = Array.isArray(wert) ? wert[0] : wert;
					return schwere !== 0 && schwere !== 'off';
				}).length;

			const svelteAktiv = aktiv('svelte/');
			const tsAktiv = aktiv('@typescript-eslint/');
			if (svelteAktiv < erwarteteSvelteRegeln) {
				melden(
					7,
					datei,
					1,
					`nur ${svelteAktiv} von ${erwarteteSvelteRegeln} svelte/*-Regeln aktiv — der Regelsatz aus eslint-plugin-svelte hängt nicht, zu reparieren in eslint.config.js`
				);
			}
			if (tsAktiv < erwarteteTsRegeln) {
				melden(
					7,
					datei,
					1,
					`nur ${tsAktiv} von ${erwarteteTsRegeln} @typescript-eslint/*-Regeln aktiv — der Regelsatz aus typescript-eslint hängt nicht, zu reparieren in eslint.config.js`
				);
			}
		}
	}

	// -------------------------------------------------------------------
	// Regel 10: jede .css unter src/lib/styles/ ist unter src/routes/ eingebunden
	// -------------------------------------------------------------------
	/*
	 * Ein Stilblatt wirkt erst, wenn es jemand importiert — und der Import steht
	 * nach der Konvention dieses Projekts in einer Datei unter src/routes/
	 * (heute in +layout.svelte, damit er für jede Seite gilt). Fehlt er, ist die
	 * Datei weiter gültig, weiter formatiert, weiter gelintet und wird nie
	 * geladen. Genau das hat die Review demonstriert.
	 *
	 * Geprüft wird nur die **Existenz** eines Imports, nicht seine Form: $lib,
	 * relativ, mit oder ohne ?url — alle Wege zählen, weil jeder von ihnen die
	 * Datei tatsächlich lädt. Verglichen werden absolute Pfade, damit
	 * '$lib/styles/x.css' und '../../lib/styles/x.css' auf denselben Eintrag
	 * fallen.
	 */
	const stilWurzel = join(quelle, 'lib', 'styles') + sep;
	const stilblätter = dateien.filter(
		(datei) => datei.startsWith(stilWurzel) && datei.endsWith('.css')
	);

	/** @type {Set<string>} */
	const eingebundeneStilblätter = new Set();
	for (const datei of dateien) {
		if (!datei.startsWith(routenWurzel)) continue;
		const roh = lesen(datei, 10);
		if (roh === null) continue;
		const text = ohneZeilenkommentare(datei, ohneKommentare(roh));
		for (const { spez } of importStellen(text)) {
			// Ein Abfrageteil wie ?url gehört zum Vite-Aufruf, nicht zum Pfad.
			const ohneAbfrage = spez.split('?')[0];
			if (!ohneAbfrage.endsWith('.css')) continue;
			const absolut = ohneAbfrage.startsWith('$lib/')
				? join(quelle, 'lib', ohneAbfrage.slice('$lib/'.length))
				: ohneAbfrage.startsWith('.')
					? resolve(dirname(datei), ohneAbfrage)
					: null;
			// Ein Stilblatt aus node_modules ist kein Eintrag dieses Projekts.
			if (absolut !== null) eingebundeneStilblätter.add(absolut);
		}
	}

	for (const blatt of stilblätter) {
		if (eingebundeneStilblätter.has(blatt)) continue;
		melden(
			10,
			blatt,
			1,
			'wird von keiner Datei unter src/routes/ importiert — das Stilblatt ist gültig, ' +
				'wird aber nie geladen, und keine andere Prüfung der Kette sieht das'
		);
	}

	// -------------------------------------------------------------------
	// Regel 11: jedes action="?/name" hat eine gleichnamige action
	// -------------------------------------------------------------------
	/*
	 * SvelteKit löst action="?/name" zur Laufzeit gegen die actions der Route
	 * auf. Ein verschriebener Name ist damit kein Typfehler und kein
	 * Lint-Befund, sondern ein Knopf, der nichts tut: SvelteKit antwortet mit
	 * 404, und ohne JavaScript sieht die Person eine Fehlerseite. Auch
	 * scripts/smoke-zugang.ts kann das nicht fangen — es ruft die actions über
	 * den Namensindex und umgeht die Auflösung, die hier der Prüfgegenstand ist.
	 *
	 * Geprüft wird die Form action="?/name", also die des Projekts. Eine Form
	 * mit Pfad davor (action="/verwaltung?/name") kommt hier nicht vor und wird
	 * bewusst nicht gedeutet — die Route liesse sich dann nicht mehr aus dem
	 * Verzeichnis der Datei ableiten, und eine geratene Zuordnung wäre schlimmer
	 * als eine benannte Grenze.
	 */
	/**
	 * Die Namen auf der obersten Ebene des actions-Objekts einer +page.server.ts.
	 * null, wenn die Datei fehlt oder kein actions-Objekt trägt.
	 * @param {string} serverDatei
	 * @returns {Set<string> | null}
	 */
	const aktionsnamen = (serverDatei) => {
		if (!existsSync(serverDatei)) return null;
		const roh = lesen(serverDatei, 11);
		if (roh === null) return null;
		const text = ohneZeilenkommentare(serverDatei, ohneKommentare(roh));
		const stelle = text.search(/\bactions\b[^=]*=\s*\{/);
		if (stelle < 0) return null;
		const block = blockAb(text, text.indexOf('{', stelle));
		if (block === null) return null;
		// ohneVerschachtelung blendet alles tiefer als die oberste Ebene aus:
		// die destrukturierten Parameter ({ locals, request }) und die Rümpfe der
		// Pfeilfunktionen zählen damit nicht als Schlüssel.
		const oben = ohneVerschachtelung(text.slice(block.innenVon, block.innenBis));
		/** @type {Set<string>} */
		const namen = new Set();
		for (const treffer of oben.matchAll(/(?:^|[,{\s])['"]?([A-Za-z_$][\w$]*)['"]?\s*:/g)) {
			namen.add(treffer[1]);
		}
		return namen;
	};

	/** @type {Map<string, Set<string> | null>} */
	const aktionsCache = new Map();

	for (const datei of dateien) {
		if (!datei.startsWith(routenWurzel) || !datei.endsWith('.svelte')) continue;
		const roh = lesen(datei, 11);
		if (roh === null) continue;
		const text = ohneKommentare(roh);
		const treffer = [...text.matchAll(/\baction=["']\?\/([A-Za-z_$][\w$]*)["']/g)];
		if (treffer.length === 0) continue;

		const serverDatei = join(dirname(datei), '+page.server.ts');
		if (!aktionsCache.has(serverDatei)) aktionsCache.set(serverDatei, aktionsnamen(serverDatei));
		const namen = aktionsCache.get(serverDatei) ?? null;

		for (const { 1: name, index } of treffer) {
			if (namen === null) {
				melden(
					11,
					datei,
					zeileVon(text, index ?? 0),
					`action="?/${name}", aber neben dieser Komponente steht keine +page.server.ts ` +
						'mit einem actions-Objekt — der Knopf antwortet mit 404'
				);
				continue;
			}
			if (namen.has(name)) continue;
			melden(
				11,
				datei,
				zeileVon(text, index ?? 0),
				`action="?/${name}" hat keinen gleichnamigen Eintrag in den actions von ` +
					`${relative(ziel, serverDatei)} (dort: ${[...namen].sort().join(', ') || 'keine'}) — ` +
					'der Knopf antwortet mit 404 und tut nichts'
			);
		}
	}

	// -------------------------------------------------------------------
	// Regel 8: unbenutzte Tokens sind ein Hinweis, kein Fehler
	// -------------------------------------------------------------------
	for (const name of hellTokens.keys()) {
		if (benutzteTokens.has(name)) continue;
		hinweise.push({
			regel: 8,
			datei: relative(ziel, shell),
			zeile: 1,
			meldung: `Token ${name} wird nirgends benutzt — für eine spätere Story reserviert?`,
		});
	}

	return { verstösse, hinweise, dateien: dateien.length, tokens: hellTokens.size };
};

// ---------------------------------------------------------------------------
// Ausgabe
// ---------------------------------------------------------------------------

/**
 * @param {Ergebnis} ergebnis
 * @param {string} ziel
 */
const berichten = (ergebnis, ziel) => {
	for (const { regel, datei, zeile, meldung } of ergebnis.hinweise) {
		console.log(`hinweis  regel ${regel}  ${datei}:${zeile}  ${meldung}`);
	}
	for (const { regel, datei, zeile, meldung } of ergebnis.verstösse) {
		console.error(`VERSTOSS regel ${regel}  ${datei}:${zeile}  ${meldung}`);
	}
	const wo = relative(projektWurzel, ziel) || '.';
	if (ergebnis.verstösse.length > 0) {
		console.error(
			`gate (${wo}): ${ergebnis.verstösse.length} Verstoss/Verstösse in ${ergebnis.dateien} Dateien.`
		);
		return 1;
	}
	console.log(
		`gate (${wo}): ${ergebnis.dateien} Dateien und ${ergebnis.tokens} Tokens geprüft, ` +
			`${ergebnis.hinweise.length} Hinweis(e), elf Regeln erfüllt.`
	);
	return 0;
};

// ---------------------------------------------------------------------------
// Selbsttest: je eine Fehlerprobe pro Regel
// ---------------------------------------------------------------------------

/*
 * Je eine Fehlerprobe pro verbotener Form, und je Probe eine Erwartung — nicht
 * "mindestens einer". In Iteration 1 hing Regel 9 an einem einzigen Treffer je
 * Probe: die Hälfte der Regel hätte still wegfallen können, während
 * `gate:selftest` weiter "jede Regel beisst" meldete. Eine Zahl statt eines
 * "irgendwas gefunden" macht genau das sichtbar.
 *
 * Jede Zahl trägt darum ihre `begruendung`: sie zählt auf, welche Verletzungen
 * sie zusammensetzen. Eine nackte Zahl liesse sich beim nächsten roten Lauf
 * bequem hochsetzen, statt zu fragen, woher der zusätzliche Treffer kommt. Der
 * Selbsttest gibt die Begründung neben der Zahl aus, damit beides zusammen
 * gelesen wird.
 */
/** @type {{ regel: number, verzeichnis: string, art: 'Verstoss' | 'Hinweis', erwartet: number, begruendung: string, beschreibung: string }[]} */
const proben = [
	{
		regel: 1,
		verzeichnis: 'regel-1-farbliteral-und-mass',
		erwartet: 6,
		begruendung:
			'4 in Probe.svelte (rgb(), rebeccapurple, 0.0625rem, 13px) + 1 Hex in probe.css + 1 Hex in error.html',
		art: 'Verstoss',
		beschreibung:
			'rgb(), CSS-Farbname und padding: 13px in einer Komponente, Hex in einer .css ' +
			'und ein Hex in src/error.html — dort las Regel 1 vorher nichts',
	},
	{
		regel: 1,
		verzeichnis: 'regel-1b-doppelschraegstrich-in-url',
		erwartet: 3,
		begruendung:
			'je 1 Farbliteral hinter einer //-Adresse in derselben Zeile, in Probe.svelte, ' +
			'probe.css und error.html — die Gegenprobe zur Zeilenkommentar-Ausblendung',
		art: 'Verstoss',
		beschreibung: 'Farbliteral hinter url(//…) in einer Zeile; in CSS ist // kein Kommentar',
	},
	{
		regel: 1,
		verzeichnis: 'regel-1c-systemfarbe',
		erwartet: 2,
		begruendung:
			'1 GrayText in error.html (nicht in der erlaubten Auswahl) + 1 Canvas in einer ' +
			'Komponente; Canvas und CanvasText in error.html dürfen nicht fallen',
		art: 'Verstoss',
		beschreibung:
			'Systemfarbe ausserhalb der erlaubten Auswahl und Systemfarbe in einer Komponente',
	},
	{
		regel: 2,
		verzeichnis: 'regel-2-var-fallback',
		erwartet: 1,
		begruendung: '1 var() mit Fallback in Probe.svelte',
		art: 'Verstoss',
		beschreibung: 'von Prettier über drei Zeilen umbrochenes var() mit Fallback',
	},
	{
		regel: 3,
		verzeichnis: 'regel-3-token-nicht-deklariert',
		erwartet: 2,
		begruendung: '1 Token nur im Kommentar erwähnt + 1 Token in einem Nicht-:root-Selektor',
		art: 'Verstoss',
		beschreibung: 'Token nur in einem Kommentar erwähnt und Token in einem Nicht-:root-Selektor',
	},
	{
		regel: 4,
		verzeichnis: 'regel-4a-farbe-nur-hell',
		erwartet: 2,
		begruendung: '2 Farb-Token des Hell-Blocks ohne Wert im Dunkel-Block',
		art: 'Verstoss',
		beschreibung: 'Farb-Token nur im Hell-Block, kein Wert im Dunkel-Block',
	},
	{
		regel: 4,
		verzeichnis: 'regel-4b-dunkel-block-kaputt',
		erwartet: 5,
		begruendung:
			'1 unbalancierter Dunkel-Block + 4 Farb-Token, die dadurch keinen Dunkelwert haben',
		art: 'Verstoss',
		beschreibung: 'unbalancierter Dunkel-Block',
	},
	{
		regel: 5,
		verzeichnis: 'regel-5-manifest-farbe',
		erwartet: 1,
		begruendung: '1 abweichendes theme_color im Manifest',
		art: 'Verstoss',
		beschreibung: 'theme_color im Manifest weicht von --accent ab',
	},
	{
		regel: 6,
		verzeichnis: 'regel-6-icon-pfad',
		erwartet: 1,
		begruendung: '1 Icon-Pfad im Manifest ohne Datei unter static/',
		art: 'Verstoss',
		beschreibung: 'Manifest verweist auf ein Icon, das es nicht gibt',
	},
	{
		regel: 7,
		verzeichnis: 'regel-7-eslint-regelsatz',
		erwartet: 2,
		begruendung:
			'1 Komponente × 2 Regelsätze (svelte/* und @typescript-eslint/*), die beide nicht hängen',
		art: 'Verstoss',
		beschreibung: 'eslint.config.js mit dem No-op ...configs.recommended.rules',
	},
	{
		regel: 8,
		verzeichnis: 'regel-8-token-unbenutzt',
		erwartet: 1,
		begruendung: '1 Token, das keine Komponente liest',
		art: 'Hinweis',
		beschreibung: 'Token, das keine Komponente benutzt',
	},
	{
		regel: 9,
		verzeichnis: 'regel-9a-drizzle-orm',
		erwartet: 1,
		begruendung: '1 Import von drizzle-orm in einer Routendatei',
		art: 'Verstoss',
		beschreibung: 'Routendatei importiert drizzle-orm und baut die Abfrage selbst',
	},
	{
		regel: 9,
		verzeichnis: 'regel-9b-lib-server-db',
		erwartet: 1,
		begruendung: '1 Import des Handles als $lib/server/db',
		art: 'Verstoss',
		beschreibung: 'Datenbank-Handle als $lib/server/db, also ohne /index',
	},
	{
		regel: 9,
		verzeichnis: 'regel-9c-lib-server-db-index',
		erwartet: 1,
		begruendung: '1 Import des Handles als $lib/server/db/index',
		art: 'Verstoss',
		beschreibung: 'Datenbank-Handle als $lib/server/db/index, die Form aus dem Akzeptanzkriterium',
	},
	{
		regel: 9,
		verzeichnis: 'regel-9e-better-sqlite3',
		erwartet: 1,
		begruendung: '1 direkter Import des SQLite-Treibers in einer Routendatei',
		art: 'Verstoss',
		beschreibung: 'Routendatei öffnet die Datenbank selbst über better-sqlite3',
	},
	{
		regel: 9,
		verzeichnis: 'regel-9f-erlaubter-import',
		erwartet: 0,
		begruendung:
			'Gegenprobe: Abfragefunktion über Alias und über relativen Pfad sowie ein reines ' +
			'import type aus drizzle-orm — alle drei erlaubt, also null Treffer',
		art: 'Verstoss',
		beschreibung: 'erlaubte Importe unter src/routes/ dürfen nicht fallen',
	},
	{
		regel: 10,
		verzeichnis: 'regel-10-stilblatt-nicht-eingebunden',
		erwartet: 1,
		begruendung:
			'1 .css unter src/lib/styles/, die keine Datei unter src/routes/ importiert; ' +
			'die Datei selbst ist gültig und verstösst gegen keine andere Regel',
		art: 'Verstoss',
		beschreibung: 'Stilblatt vorhanden, Importzeile fehlt — die Datei wird nie geladen',
	},
	{
		regel: 10,
		verzeichnis: 'regel-10-stilblatt-eingebunden',
		erwartet: 0,
		begruendung:
			'Gegenprobe: dasselbe Stilblatt über den Alias **und** über einen relativen ' +
			'Pfad importiert, dazu eine nicht eingebundene .css ausserhalb von ' +
			'src/lib/styles/ — alle drei erlaubt, also null Treffer',
		art: 'Verstoss',
		beschreibung:
			'eingebundenes Stilblatt und .css ausserhalb von src/lib/styles/ dürfen nicht fallen',
	},
	{
		regel: 11,
		verzeichnis: 'regel-11-aktion-verschrieben',
		erwartet: 1,
		begruendung:
			'1 action="?/neuAusstellen" ohne gleichnamigen Eintrag; das action="?/aufnehmen" ' +
			'daneben ist aufgelöst und darf nicht mitzählen',
		art: 'Verstoss',
		beschreibung: 'Aktionsname im Markup, den die Nachbar-+page.server.ts nicht kennt',
	},
	{
		regel: 11,
		verzeichnis: 'regel-11-aktion-aufgeloest',
		erwartet: 0,
		begruendung:
			'Gegenprobe: drei aufgelöste Namen, ein Formular ohne action (die Standard-action), ' +
			'ein action mit fremder Adresse und ein verschriebener Name in einem Kommentar — ' +
			'nichts davon darf fallen, also null Treffer',
		art: 'Verstoss',
		beschreibung: 'aufgelöste Aktionsnamen, Standard-action und fremdes Ziel dürfen nicht fallen',
	},
	{
		regel: 9,
		verzeichnis: 'regel-9d-relativer-pfad',
		erwartet: 1,
		begruendung:
			'1 relativer Import auf db/index.ts; der auskommentierte Import daneben zählt nicht mit und belegt, dass ohneZeilenkommentare greift',
		art: 'Verstoss',
		beschreibung: 'Datenbank-Handle über einen relativen Pfad auf db/index.ts',
	},
];

const selbsttest = () => {
	let fehlt = 0;
	console.log(
		`gate --selftest: ${proben.length} Fehlerproben gegen die elf Regeln ` +
			`(erwartet: ${erwarteteSvelteRegeln} svelte/*- und ${erwarteteTsRegeln} @typescript-eslint/*-Regeln je Komponente)\n`
	);

	for (const { regel, verzeichnis, art, erwartet, begruendung, beschreibung } of proben) {
		const ziel = join(probenWurzel, verzeichnis);
		if (!existsSync(ziel)) {
			console.error(`FEHLT   regel ${regel}  ${verzeichnis} — Fehlerprobe nicht vorhanden`);
			fehlt += 1;
			continue;
		}
		const ergebnis = torPrüfen(ziel);
		const befunde = art === 'Hinweis' ? ergebnis.hinweise : ergebnis.verstösse;
		const treffer = befunde.filter((befund) => befund.regel === regel);
		if (treffer.length !== erwartet) {
			console.error(
				`FEHLT   regel ${regel}  ${verzeichnis} — ${treffer.length} statt ${erwartet} ` +
					`${art}/${art}e zu Regel ${regel} (${beschreibung}). ` +
					`Erwartet sind ${erwartet}: ${begruendung}. ` +
					(treffer.length < erwartet
						? 'Das Tor hat eine Verletzung durchgelassen.'
						: 'Das Tor meldet mehr als die Probe enthält — die Probe oder die Regel ist verrutscht.')
			);
			fehlt += 1;
			continue;
		}
		if (erwartet === 0) {
			// Gegenprobe: hier ist Schweigen der Nachweis. Eine zu breite Regel
			// bliebe sonst im Selbsttest grün und fiele erst als rätselhafter
			// Verstoss im echten Baum auf.
			console.log(`still   regel ${regel}  ${verzeichnis} — 0/0 (${begruendung})`);
			continue;
		}
		console.log(
			`bissig  regel ${regel}  ${verzeichnis} — ${treffer.length}/${erwartet} ` +
				`(${begruendung}): ${treffer[0].meldung}`
		);
	}

	if (fehlt > 0) {
		console.error(
			`\ngate --selftest: ${fehlt} von ${proben.length} Fehlerproben nicht gefunden — ` +
				'das Tor prüft weniger, als es behauptet.'
		);
		return 1;
	}
	console.log(
		`\ngate --selftest: alle ${proben.length} Fehlerproben in erwarteter Zahl gefunden, ` +
			'jede der elf Regeln beisst nachweislich.'
	);
	return 0;
};

// ---------------------------------------------------------------------------
// Einstieg
// ---------------------------------------------------------------------------
try {
	const argument = process.argv[2];
	if (argument === '--selftest') {
		process.exit(selbsttest());
	}
	const ziel = argument === undefined ? projektWurzel : resolve(process.cwd(), argument);
	process.exit(berichten(torPrüfen(ziel), ziel));
} catch (fehler) {
	// Auch ein unerwarteter Fehler ist ein benannter Verstoss, nie ein Stacktrace.
	console.error(`VERSTOSS regel 0  gate  ${fehler instanceof Error ? fehler.message : fehler}`);
	process.exit(1);
}
