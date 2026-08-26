import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import svelteParser from 'svelte-eslint-parser';
import ts from 'typescript-eslint';

// In eslint-plugin-svelte 3 und typescript-eslint 8 sind die empfohlenen
// Konfigurationen Flat-Config-*Arrays*. `...svelte.configs.recommended.rules`
// wäre undefined und damit ein stiller No-op — darum die Regeln aus allen
// Einträgen des Arrays zusammenlegen.
/** @param {readonly import('eslint').Linter.Config[]} configs */
const regelnAus = (configs) => Object.assign({}, ...configs.map((config) => config.rules ?? {}));

const tsRegeln = regelnAus(ts.configs.recommended);
const svelteRegeln = regelnAus(svelte.configs.recommended);

/** @type {import('eslint').Linter.Config[]} */
export default [
	js.configs.recommended,
	{
		// Serverseitige TypeScript-Dateien und Skripte — Node-Globals
		files: ['**/*.ts'],
		ignores: ['src/lib/client/**/*.ts'],
		plugins: { '@typescript-eslint': ts.plugin },
		languageOptions: {
			parser: ts.parser,
			globals: { ...globals.node },
		},
		rules: { ...tsRegeln },
	},
	{
		// Clientseitige TypeScript-Dateien — Browser-Globals
		files: ['src/lib/client/**/*.ts'],
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
		// Ohne diesen Prozessor greifen die Kommentar-Direktiven in .svelte-Dateien
		// nicht: ein <!-- eslint-disable … --> im Markup bliebe wirkungslos.
		processor: 'svelte/svelte',
		languageOptions: {
			parser: svelteParser,
			parserOptions: {
				parser: ts.parser,
				// Bewusst nur das Nötige und ausschliesslich serialisierbare Werte:
				// svelte.config.js enthält Funktionen, und eslint --print-config
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
		files: ['**/*.js', '**/*.mjs'],
		languageOptions: {
			globals: { ...globals.node },
		},
	},
	{
		ignores: ['.claude/', '.svelte-kit/', 'build/', 'node_modules/'],
	},
];
