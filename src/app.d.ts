// Siehe https://svelte.dev/docs/kit/types#app.d.ts
//
// Der Import steht absichtlich relativ und ohne Endung: diese Datei liegt in
// beiden Typprüf-Programmen (tsconfig.json und tsconfig.scripts.json), und $lib
// kennt nur das erste.
import type { AngemeldetesMitglied } from './lib/server/db/schema';

// PageData, PageState und Platform füllen die Stories 1.4 und 1.5, sobald es
// Aufgaben gibt. App.Error bleibt bei der Vorgabe { message: string } — mehr
// braucht keine der beiden Fehlerhüllen.
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			/**
			 * Das angemeldete Mitglied, gesetzt vom Wächter in src/hooks.server.ts.
			 * null nur auf der Einlöseroute /i/<token>, die den Wächter umgeht —
			 * überall sonst hat ein Aufruf ohne gültige Sitzung die 403 schon
			 * bekommen und erreicht keinen load und keine form action.
			 *
			 * Ohne die Spalte invite_token_hash: sie ist kein Anzeigewert und hat in
			 * keiner Load-Funktion etwas zu suchen. Siehe ohneTokenHash in
			 * src/lib/server/db/schema.ts.
			 */
			mitglied: AngemeldetesMitglied | null;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
