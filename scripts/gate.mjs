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
 * Die acht Regeln:
 *   1. In .svelte und .css unter src/ kein Farbliteral (Hex, rgb(), rgba(),
 *      hsl(), hsla(), oklch(), color() …, CSS-Farbname) und kein rohes
 *      px/rem-Literal ausser 0. Ausgenommen ist allein der Token-Block in
 *      app.html.
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
import { join, relative, resolve } from 'node:path';
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

/** @param {string} text */
const ohneKommentare = (text) =>
	text.replace(/\/\*[\s\S]*?\*\//g, ausgeblendet).replace(/<!--[\s\S]*?-->/g, ausgeblendet);

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
 * Für .css ist das die ganze Datei, für .svelte die <style>-Blöcke und die
 * style-Attribute im Markup. Regel 1 gilt nur für CSS, nicht für Markup oder
 * Skript — dort ist ein `#` eine Sprungmarke und keine Farbe.
 * @param {string} datei
 * @param {string} text
 * @returns {{ inhalt: string, versatz: number }[]}
 */
const cssAbschnitte = (datei, text) => {
	if (datei.endsWith('.css')) return [{ inhalt: text, versatz: 0 }];
	if (!datei.endsWith('.svelte')) return [];

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
 * Ein Token gilt als Farb-Token, wenn sein Wert im :root-Block eine Farbe ist.
 * Damit leitet Regel 4 ihre Menge aus den Werten ab und nicht aus einer im
 * Skript gepflegten Namensliste, die beim nächsten neuen Token veralten würde.
 * @param {string} wert
 */
const istFarbwert = (wert) => {
	const gekürzt = wert.trim().toLowerCase().replace(/;$/, '');
	if (farbnamen.has(gekürzt)) return true;
	if (/^#[0-9a-f]{3,8}$/.test(gekürzt)) return true;
	return /^(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix)\s*\(/.test(gekürzt);
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
		const text = ohneKommentare(roh);

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

		// ----- Regel 1: Farb- und Massliterale in CSS -----
		// app.html trägt den Token-Block und ist die einzige Ausnahme.
		if (datei === shell) continue;

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
				if (!farbnamen.has(treffer[0].toLowerCase())) continue;
				melden(
					1,
					datei,
					zeileAb(treffer.index ?? 0),
					`CSS-Farbname ${treffer[0]} — der Wert gehört in den Token-Block von src/app.html`
				);
			}

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
			`${ergebnis.hinweise.length} Hinweis(e), acht Regeln erfüllt.`
	);
	return 0;
};

// ---------------------------------------------------------------------------
// Selbsttest: je eine Fehlerprobe pro Regel
// ---------------------------------------------------------------------------

/** @type {{ regel: number, verzeichnis: string, art: 'Verstoss' | 'Hinweis', beschreibung: string }[]} */
const proben = [
	{
		regel: 1,
		verzeichnis: 'regel-1-farbliteral-und-mass',
		art: 'Verstoss',
		beschreibung: 'rgb(), CSS-Farbname und padding: 13px in einer Komponente, Hex in einer .css',
	},
	{
		regel: 2,
		verzeichnis: 'regel-2-var-fallback',
		art: 'Verstoss',
		beschreibung: 'von Prettier über drei Zeilen umbrochenes var() mit Fallback',
	},
	{
		regel: 3,
		verzeichnis: 'regel-3-token-nicht-deklariert',
		art: 'Verstoss',
		beschreibung: 'Token nur in einem Kommentar erwähnt und Token in einem Nicht-:root-Selektor',
	},
	{
		regel: 4,
		verzeichnis: 'regel-4a-farbe-nur-hell',
		art: 'Verstoss',
		beschreibung: 'Farb-Token nur im Hell-Block, kein Wert im Dunkel-Block',
	},
	{
		regel: 4,
		verzeichnis: 'regel-4b-dunkel-block-kaputt',
		art: 'Verstoss',
		beschreibung: 'unbalancierter Dunkel-Block',
	},
	{
		regel: 5,
		verzeichnis: 'regel-5-manifest-farbe',
		art: 'Verstoss',
		beschreibung: 'theme_color im Manifest weicht von --accent ab',
	},
	{
		regel: 6,
		verzeichnis: 'regel-6-icon-pfad',
		art: 'Verstoss',
		beschreibung: 'Manifest verweist auf ein Icon, das es nicht gibt',
	},
	{
		regel: 7,
		verzeichnis: 'regel-7-eslint-regelsatz',
		art: 'Verstoss',
		beschreibung: 'eslint.config.js mit dem No-op ...configs.recommended.rules',
	},
	{
		regel: 8,
		verzeichnis: 'regel-8-token-unbenutzt',
		art: 'Hinweis',
		beschreibung: 'Token, das keine Komponente benutzt',
	},
];

const selbsttest = () => {
	let fehlt = 0;
	console.log(
		`gate --selftest: ${proben.length} Fehlerproben gegen die acht Regeln ` +
			`(erwartet: ${erwarteteSvelteRegeln} svelte/*- und ${erwarteteTsRegeln} @typescript-eslint/*-Regeln je Komponente)\n`
	);

	for (const { regel, verzeichnis, art, beschreibung } of proben) {
		const ziel = join(probenWurzel, verzeichnis);
		if (!existsSync(ziel)) {
			console.error(`FEHLT   regel ${regel}  ${verzeichnis} — Fehlerprobe nicht vorhanden`);
			fehlt += 1;
			continue;
		}
		const ergebnis = torPrüfen(ziel);
		const befunde = art === 'Hinweis' ? ergebnis.hinweise : ergebnis.verstösse;
		const treffer = befunde.filter((befund) => befund.regel === regel);
		if (treffer.length === 0) {
			console.error(
				`FEHLT   regel ${regel}  ${verzeichnis} — kein ${art} zu Regel ${regel} gefunden ` +
					`(${beschreibung}). Das Tor hat die Verletzung durchgelassen.`
			);
			fehlt += 1;
			continue;
		}
		console.log(`bissig  regel ${regel}  ${verzeichnis} — ${treffer[0].meldung}`);
	}

	if (fehlt > 0) {
		console.error(
			`\ngate --selftest: ${fehlt} von ${proben.length} Fehlerproben nicht gefunden — ` +
				'das Tor prüft weniger, als es behauptet.'
		);
		return 1;
	}
	console.log(
		`\ngate --selftest: alle ${proben.length} Fehlerproben gefunden, jede der acht Regeln beisst nachweislich.`
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
