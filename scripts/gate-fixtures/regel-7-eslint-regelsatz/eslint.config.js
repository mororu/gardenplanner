import svelte from 'eslint-plugin-svelte';
import svelteParser from 'svelte-eslint-parser';
import ts from 'typescript-eslint';

/*
 * Fehlerprobe zu Regel 7 — und der Befund aus Iteration 1 im Original.
 *
 * In eslint-plugin-svelte 3 und typescript-eslint 8 sind `configs.recommended`
 * Flat-Config-*Arrays*. `.rules` darauf ist `undefined`, und
 * `{ ...undefined }` ist ein gültiges, leeres Objekt — also fällt niemandem
 * etwas auf: eslint läuft durch, meldet null Fehler, und auf .svelte-Dateien
 * hängt keine einzige svelte/*- oder @typescript-eslint/*-Regel. Ein {#each}
 * ohne Key oder ein {@html} liefe unbemerkt durch.
 */
/** @type {import('eslint').Linter.Config[]} */
export default [
	{
		files: ['**/*.svelte'],
		plugins: { svelte, '@typescript-eslint': ts.plugin },
		processor: 'svelte/svelte',
		languageOptions: {
			parser: svelteParser,
			parserOptions: {
				parser: ts.parser,
				svelteConfig: { compilerOptions: { runes: true } },
			},
		},
		rules: {
			...svelte.configs.recommended.rules,
			...ts.configs.recommended.rules,
		},
	},
];
