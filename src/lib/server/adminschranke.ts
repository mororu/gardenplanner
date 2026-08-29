import { redirect } from '@sveltejs/kit';
import type { AngemeldetesMitglied } from './db/schema.ts';

/*
 * Die Adminschranke.
 *
 * Eine Funktion für vier Aufrufstellen: die load von /verwaltung und ihre drei
 * form actions. Eine Kopie je action ist genau die Stelle, an der eine
 * vergessen wird — und eine vergessene Schranke ist unsichtbar, weil die
 * Oberfläche den Knopf für Nicht-Admins ohnehin nicht zeigt.
 *
 * Der Import steht relativ und mit .ts-Endung, nicht über $lib: dieselbe Datei
 * wird über src/routes/verwaltung/+page.server.ts von scripts/smoke-zugang.ts
 * mit nacktem Node geladen, und Node kennt kein $lib.
 */

/**
 * Lässt nur eine Adminperson weiter und gibt sie zurück.
 *
 * Der Rückgabewert ist kein Beiwerk: `neuAusstellen` und `widerrufen` brauchen
 * die eigene Id, um den Selbstwiderruf abzuweisen, und die `load` gibt sie als
 * `ichId` an die Liste weiter. Käme sie aus einem zweiten Zugriff auf
 * `locals.mitglied`, liesse sich die Prüfung an einer Stelle weglassen, ohne
 * dass die Schranke selbst etwas davon merkt.
 *
 * `umbenennen` liest sie bewusst **nicht**: die eigene Zeile darf umbenannt
 * werden, ein Name ist kein Zugang.
 *
 * **Weiterleitung, keine 403.** Für jemanden ohne Adminrechte soll die
 * Verwaltung nicht existieren, nicht verboten sein: eine Fehlerseite wäre die
 * Auskunft, dass es dort etwas gibt. `redirect(303, '/')` sagt nichts —
 * derselbe Ausgang wie für einen Pfad, den es nie gab.
 *
 * `locals.mitglied` ist ausserhalb der Einlöseroute nie null; der Wächter in
 * src/hooks.server.ts hat vorher schon mit 403 abgewiesen. Die Prüfung steht
 * trotzdem hier, weil der Typ sie zulässt und ein `!` an dieser Stelle die
 * Schranke von einer Annahme abhängig machte.
 */
export function adminOderWeg(locals: App.Locals): AngemeldetesMitglied {
	const mitglied = locals.mitglied;
	if (mitglied === null || !mitglied.isAdmin) {
		redirect(303, '/');
	}
	return mitglied;
}
