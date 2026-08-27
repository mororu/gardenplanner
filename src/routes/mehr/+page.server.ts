import { redirect } from '@sveltejs/kit';
import type { ServerLoadEvent } from '@sveltejs/kit';

/*
 * /mehr — der Einstieg zu den seltenen Handlungen.
 *
 * Die Importe stehen relativ und mit .ts-Endung, und der Typ kommt aus
 * @sveltejs/kit statt aus ./$types. Der Grund ist derselbe wie in
 * src/routes/i/[token]/+server.ts und geprüft, nicht vermutet:
 * scripts/smoke-zugang.ts lädt dieses Modul, und tsconfig.scripts.json kennt
 * weder das virtuelle ./$types noch die $lib-Zuordnung.
 *
 * Diese Seite hat **keine** Adminschranke — sie gehört allen. Nur der Eintrag
 * `Verwaltung` fehlt für Nicht-Admins, und zwar ganz: kein ausgegrauter Punkt,
 * keine Erklärung, warum er nicht anklickbar ist. Für jemanden ohne
 * Adminrechte soll die Verwaltung nicht existieren, nicht verboten sein.
 */
export function load({ locals }: ServerLoadEvent): { name: string; istAdmin: boolean } {
	const mitglied = locals.mitglied;
	// Unerreichbar: der Wächter in src/hooks.server.ts hat einen Aufruf ohne
	// gültige Sitzung schon mit 403 abgewiesen. Die Prüfung steht hier, weil der
	// Typ null zulässt — und ein `!` machte diese Seite von einer Annahme über
	// eine andere Datei abhängig.
	if (mitglied === null) {
		redirect(303, '/');
	}

	// Nur die zwei Werte, die die Seite zeigt. Nichts aus der Mitgliedszeile
	// reist mit, was die Seite nicht anzeigt.
	return { name: mitglied.name, istAdmin: mitglied.isAdmin };
}
