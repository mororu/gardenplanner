import {
	einzelaufgabenLesen,
	type Einzelaufgabe,
} from '../../lib/server/db/queries/signup-tasks.ts';

/*
 * /einzelaufgaben — wer was übernommen hat, und was noch frei ist.
 *
 * Die Importe stehen relativ und mit .ts-Endung, und die Typen kommen aus
 * @sveltejs/kit statt aus ./$types. Der Grund ist derselbe wie in
 * src/routes/einzelaufgabe/+page.server.ts und geprüft, nicht vermutet:
 * scripts/smoke-zugang.ts lädt dieses Modul mit nacktem Node, und
 * tsconfig.scripts.json kennt weder das virtuelle ./$types noch die
 * $lib-Zuordnung.
 *
 * **Diese Seite hat keine action, und das ist eine Entscheidung.** Übernommen
 * wird auf `/`, dort wo die freien Einzelaufgaben ohnehin stehen und wo die
 * Bestätigung schon wohnt. Ein zweiter Übernehmen-Weg hier wäre dieselbe
 * Interaktion ein zweites Mal geschrieben — zwei Wege in dieselbe Mutation, von
 * denen einer beim nächsten Anfassen zurückbleibt. Diese Seite **vertieft**: sie
 * zeigt zusätzlich die übernommenen, was `/` bewusst nicht tut. Sie informiert
 * nicht exklusiv, und sie handelt nicht.
 *
 * scripts/smoke-zugang.ts hält das fest: dieses Modul exportiert kein `actions`.
 *
 * **Keine Zugangsschranke und keine zweite Stufe.** Der Wächter in
 * src/hooks.server.ts hat einen Aufruf ohne gültige Sitzung schon mit 403
 * abgewiesen, und lesen darf jedes aktive Mitglied. Die load nimmt darum **kein
 * Ereignis** entgegen: sie liest weder locals noch cookies noch die Adresse.
 * Alle sehen dieselbe Liste — hier gibt es kein Gegenstück zum personenbezogenen
 * Diensthinweis auf `/`.
 */
export function load(): { einzelaufgaben: Einzelaufgabe[] } {
	return { einzelaufgaben: einzelaufgabenLesen() };
}
