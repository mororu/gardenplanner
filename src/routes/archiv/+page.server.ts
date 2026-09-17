import {
	erledigteAufgabenAuflisten,
	type ErledigteAufgabe,
} from '../../lib/server/db/queries/tasks.ts';

/*
 * /archiv — was in diesem Garten schon getan ist.
 *
 * Die Importe stehen relativ und mit .ts-Endung, und die Typen kommen aus
 * @sveltejs/kit statt aus ./$types. Der Grund ist derselbe wie in den
 * Nachbarrouten und geprüft, nicht vermutet: scripts/smoke-zugang.ts lädt dieses
 * Modul mit nacktem Node, und tsconfig.scripts.json kennt weder das virtuelle
 * ./$types noch die $lib-Zuordnung.
 *
 * **Diese Seite hat keine action, und das ist eine Entscheidung** — dieselbe wie
 * auf /einzelaufgaben, mit einem eigenen Grund. Eine erledigte Aufgabe ist
 * Historie (FR14): sie lässt sich nicht ändern, nicht löschen und nicht von hier
 * aus wieder öffnen. Den Weg zurück gibt es, aber er steht dort, wo der Fehlgriff
 * passiert — auf `/`, wo die eben abgehakte Zeile noch durchgestrichen dasteht
 * und `wiederOeffnen` daneben. Ein zweiter Weg von hier aus wäre nicht bloss
 * dieselbe Mutation ein zweites Mal geschrieben, sondern eine Einladung, im
 * Archiv aufzuräumen.
 *
 * scripts/smoke-zugang.ts hält das fest: dieses Modul exportiert kein `actions`.
 *
 * **Keine Zugangsschranke und keine zweite Stufe.** Der Wächter in
 * src/hooks.server.ts hat einen Aufruf ohne gültige Sitzung schon mit 403
 * abgewiesen, und lesen darf jedes aktive Mitglied. Die load nimmt darum **kein
 * Ereignis** entgegen: sie liest weder locals noch cookies noch die Adresse.
 * Alle sehen dieselbe Liste — es gibt hier nichts Personenbezogenes, und das ist
 * bei dieser Seite mehr als eine Bequemlichkeit: die Zeilen tragen keinen Namen,
 * weil die Abfrage `completed_by` gar nicht erst herausreicht (AD-5).
 *
 * **Kein Bezugszeitpunkt in den Seitendaten**, anders als bei der load von `/`.
 * Dort reist `jetzt` mit, weil die Überfälligkeit gegen eine Uhr gerechnet wird;
 * hier ändert sich nichts dadurch, dass Zeit vergeht. Die Monatsgruppen bildet
 * die Komponente aus den Zeitstempeln selbst.
 */
export function load(): { erledigte: ErledigteAufgabe[] } {
	return { erledigte: erledigteAufgabenAuflisten() };
}
