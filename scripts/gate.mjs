#!/usr/bin/env node
/*
 * Tor für die Invarianten des Gestaltungsrahmens, die weder eslint noch
 * svelte-check noch vite build sehen. Ein umbenanntes Token bricht die
 * Darstellung, während alle drei grün melden — genau diese Lücke schliesst
 * dieses Skript. Endet mit Exit 1 und nennt Datei und Zeile, wenn eines gilt:
 *
 *   1. Ein Hex-Farbwert steht in einer .svelte-Datei.
 *   2. Ein var(--x, …) trägt einen Fallback — der Fallback verdeckt Regel 3.
 *   3. Ein in src/ benutztes var(--x) ist im Hell-Block von src/app.html nicht
 *      deklariert, oder ein Token ist nur im Dunkel-Block deklariert. Beides
 *      lässt eine Fläche unbemalt, ohne dass ein anderes Werkzeug es merkt.
 *   4. eslint --print-config meldet für eine .svelte-Datei weniger als die
 *      vollen Regelsätze von eslint-plugin-svelte und typescript-eslint.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const wurzel = fileURLToPath(new URL('..', import.meta.url));
const quelle = join(wurzel, 'src');
const shell = join(quelle, 'app.html');
const dunkelMarke = '@media (prefers-color-scheme: dark)';

const geprüfteEndungen = ['.svelte', '.css', '.html', '.ts', '.js'];

/** @type {{ datei: string, zeile: number, meldung: string }[]} */
const verstösse = [];

/**
 * @param {string} verzeichnis
 * @returns {string[]}
 */
const dateienUnter = (verzeichnis) =>
	readdirSync(verzeichnis, { withFileTypes: true }).flatMap((eintrag) => {
		const pfad = join(verzeichnis, eintrag.name);
		if (eintrag.isDirectory()) return dateienUnter(pfad);
		return geprüfteEndungen.some((endung) => eintrag.name.endsWith(endung)) ? [pfad] : [];
	});

/**
 * @param {string} datei
 * @param {number} zeile
 * @param {string} meldung
 */
const melden = (datei, zeile, meldung) => {
	verstösse.push({ datei: relative(wurzel, datei), zeile, meldung });
};

const deklaration = /(--[\w-]+)\s*:/g;
const hex = /#[0-9a-fA-F]{3,8}\b/g;
const fallback = /var\(\s*--[\w-]+\s*,/g;
const benutzung = /var\(\s*(--[\w-]+)/g;

// ---------------------------------------------------------------------------
// src/app.html ist die einzige Quelle der Tokens. Der Dunkel-Block wird über
// die Klammertiefe abgegrenzt, damit auch Regeln nach ihm richtig zugeordnet
// werden.
// ---------------------------------------------------------------------------
const shellText = readFileSync(shell, 'utf8');
const zeileVon = (index) => shellText.slice(0, index).split('\n').length;

const dunkelStart = shellText.indexOf(dunkelMarke);
let dunkelEnde = dunkelStart;
if (dunkelStart < 0) {
	melden(shell, 1, `kein Block ${dunkelMarke} gefunden — der dunkle Modus hat keine Token-Werte`);
} else {
	let tiefe = 0;
	for (let i = shellText.indexOf('{', dunkelStart); i < shellText.length; i++) {
		if (shellText[i] === '{') tiefe++;
		else if (shellText[i] === '}' && --tiefe === 0) {
			dunkelEnde = i + 1;
			break;
		}
	}
}

const dunkelText = dunkelStart < 0 ? '' : shellText.slice(dunkelStart, dunkelEnde);
const hellText =
	dunkelStart < 0 ? shellText : shellText.slice(0, dunkelStart) + shellText.slice(dunkelEnde);

const hellTokens = new Set([...hellText.matchAll(deklaration)].map((treffer) => treffer[1]));

// Ein Token, das nur der dunkle Modus kennt, lässt die helle Darstellung leer
for (const treffer of dunkelText.matchAll(deklaration)) {
	if (hellTokens.has(treffer[1])) continue;
	melden(
		shell,
		zeileVon(dunkelStart + (treffer.index ?? 0)),
		`Token ${treffer[1]} ist nur im dunklen Block deklariert, nicht im :root-Block`
	);
}

// ---------------------------------------------------------------------------
// Dateien unter src/ gegen die drei Textregeln prüfen
// ---------------------------------------------------------------------------
const dateien = dateienUnter(quelle).sort();

for (const datei of dateien) {
	readFileSync(datei, 'utf8')
		.split('\n')
		.forEach((inhalt, index) => {
			const zeile = index + 1;

			// 1. Hex-Werte gehören in den Token-Block, nicht in eine Komponente
			if (datei.endsWith('.svelte')) {
				for (const treffer of inhalt.matchAll(hex)) {
					const stellen = treffer[0].length - 1;
					const davor = treffer.index ? inhalt[treffer.index - 1] : '';
					// &#8211; ist eine Entität, kein Farbwert
					if (davor === '&' || ![3, 4, 6, 8].includes(stellen)) continue;
					melden(datei, zeile, `Hex-Wert ${treffer[0]} — der Wert gehört in src/app.html`);
				}
			}

			// 2. Ein Fallback verdeckt genau den Fehler, den Regel 3 finden soll
			for (const treffer of inhalt.matchAll(fallback)) {
				melden(datei, zeile, `var() mit Fallback: ${treffer[0]}…) — Fallback entfernen`);
			}

			// 3. Jedes benutzte Token muss im Hell-Block deklariert sein
			for (const treffer of inhalt.matchAll(benutzung)) {
				if (hellTokens.has(treffer[1])) continue;
				melden(datei, zeile, `Token ${treffer[1]} ist in src/app.html nicht deklariert`);
			}
		});
}

// ---------------------------------------------------------------------------
// 4. Beide Regelsätze müssen auf .svelte-Dateien tatsächlich hängen
// ---------------------------------------------------------------------------
const probe = dateien.find((datei) => datei.endsWith('.svelte'));
if (!probe) {
	melden(quelle, 1, 'keine .svelte-Datei gefunden — die eslint-Probe kann nicht laufen');
} else {
	const ausgabe = execFileSync('npx', ['eslint', '--print-config', relative(wurzel, probe)], {
		cwd: wurzel,
		encoding: 'utf8',
		maxBuffer: 32 * 1024 * 1024,
	});
	/** @type {{ rules?: Record<string, unknown> }} */
	const konfiguration = JSON.parse(ausgabe);
	const regeln = Object.entries(konfiguration.rules ?? {});
	/** @param {string} präfix */
	const aktiv = (präfix) =>
		regeln.filter(([name, wert]) => {
			if (!name.startsWith(präfix)) return false;
			const schwere = Array.isArray(wert) ? wert[0] : wert;
			return schwere !== 0 && schwere !== 'off';
		}).length;

	const svelteRegeln = aktiv('svelte/');
	const tsRegeln = aktiv('@typescript-eslint/');
	// Nicht auf null prüfen, sondern auf die vollen Regelsätze: eine einzelne
	// von Hand gesetzte Regel würde eine Null-Prüfung bestehen, während der
	// Regelsatz aus eslint-plugin-svelte still fehlt. Die Schwellen sind die
	// der Akzeptanzkriterien, die Versionen sind exakt gepinnt.
	if (svelteRegeln <= 20) {
		melden(
			probe,
			1,
			`eslint --print-config meldet nur ${svelteRegeln} aktive svelte/*-Regeln ` +
				'(erwartet mehr als 20) — der Regelsatz von eslint-plugin-svelte hängt nicht, ' +
				'zu reparieren in eslint.config.js'
		);
	}
	if (tsRegeln <= 10) {
		melden(
			probe,
			1,
			`eslint --print-config meldet nur ${tsRegeln} aktive @typescript-eslint/*-Regeln ` +
				'(erwartet mehr als 10) — der Regelsatz von typescript-eslint hängt nicht, ' +
				'zu reparieren in eslint.config.js'
		);
	}
	console.log(
		`gate: ${relative(wurzel, probe)} — ${svelteRegeln} svelte/*-Regeln, ` +
			`${tsRegeln} @typescript-eslint/*-Regeln aktiv`
	);
}

if (verstösse.length > 0) {
	for (const { datei, zeile, meldung } of verstösse) {
		console.error(`${datei}:${zeile}: ${meldung}`);
	}
	console.error(`gate: ${verstösse.length} Verstoss/Verstösse gefunden.`);
	process.exit(1);
}

console.log(
	`gate: ${dateien.length} Dateien geprüft, ${hellTokens.size} Tokens deklariert, alles gut.`
);
