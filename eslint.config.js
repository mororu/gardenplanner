import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import svelteParser from 'svelte-eslint-parser';
import ts from 'typescript-eslint';

/*
 * In eslint-plugin-svelte 3.23 und typescript-eslint 8.68 sind die empfohlenen
 * Konfigurationen Flat-Config-*Arrays*. `...svelte.configs.recommended.rules`
 * wäre damit `undefined` und ein stiller No-op — genau daran hingen in
 * Iteration 1 null svelte/*- und null @typescript-eslint/*-Regeln auf
 * .svelte-Dateien. Darum werden die Regeln aus allen Einträgen des Arrays
 * zusammengelegt und unten explizit eingehängt.
 *
 * Die `files`-Zuordnung der Plugin-Konfigurationen bleibt erhalten: die
 * TypeScript-Regeln hängen an den TypeScript-Blöcken, die Svelte-Regeln am
 * Svelte-Block, und die Svelte-Dateien bekommen beide Sätze — nichts wird
 * pauschal über alle Dateien geschüttet.
 *
 * scripts/gate.mjs prüft für jede .svelte-Datei über `eslint --print-config`
 * nach, dass hier wirklich beide vollständigen Sätze ankommen.
 */

/** @param {readonly import('eslint').Linter.Config[]} configs */
const regelnAus = (configs) => Object.assign({}, ...configs.map((config) => config.rules ?? {}));

const tsRegeln = regelnAus(ts.configs.recommended);
const svelteRegeln = regelnAus(svelte.configs.recommended);

/** @type {import('eslint').Linter.Config[]} */
export default [
	js.configs.recommended,
	{
		// Serverseitige TypeScript-Dateien und Skripte — Node-Globals
		files: ['**/*.{ts,mts,cts}'],
		ignores: ['src/lib/client/**'],
		plugins: { '@typescript-eslint': ts.plugin },
		languageOptions: {
			parser: ts.parser,
			globals: { ...globals.node },
		},
		rules: { ...tsRegeln },
	},
	{
		// Clientseitige TypeScript-Dateien — Browser-Globals
		files: ['src/lib/client/**/*.{ts,mts,cts}'],
		plugins: { '@typescript-eslint': ts.plugin },
		languageOptions: {
			parser: ts.parser,
			globals: { ...globals.browser },
		},
		rules: { ...tsRegeln },
	},
	{
		// Komponenten — Browser-Globals, beide Regelsätze aktiv
		files: ['**/*.svelte'],
		plugins: { '@typescript-eslint': ts.plugin, svelte },
		// Ohne diesen Prozessor greifen die Kommentar-Direktiven im Markup nicht:
		// ein <!-- eslint-disable … --> in einer .svelte-Datei bliebe wirkungslos.
		processor: 'svelte/svelte',
		languageOptions: {
			parser: svelteParser,
			parserOptions: {
				parser: ts.parser,
				// Bewusst nur das Nötige und ausschliesslich serialisierbare Werte:
				// svelte.config.js enthält Funktionen, und `eslint --print-config`
				// bricht ab, sobald ein Funktionswert in der Konfiguration steht.
				svelteConfig: { compilerOptions: { runes: true } },
			},
			globals: { ...globals.browser },
		},
		rules: {
			...tsRegeln,
			...svelteRegeln,
		},
	},
	{
		// Konfigurations- und Werkzeugdateien in JavaScript — Node-Globals
		files: ['**/*.{js,mjs,cjs}'],
		languageOptions: {
			globals: { ...globals.node },
		},
	},
	{
		// Deckungsgleich mit .prettierignore, plus die dort schon genannten
		// _bmad/, _bmad-output/ und .claude/.
		ignores: [
			'_bmad/',
			'_bmad-output/',
			'.claude/',
			'build/',
			'.svelte-kit/',
			'node_modules/',
			'scripts/gate-fixtures/',
			'scripts/db-check-fixtures/',
		],
	},
];
