import { redirect } from '@sveltejs/kit';
import type { Actions, RequestEvent, ServerLoadEvent } from '@sveltejs/kit';
import { abweisen } from '../../lib/server/abweisen.ts';
import { adminOderWeg } from '../../lib/server/adminschranke.ts';
import {
	dienstwocheAustragen,
	dienstwocheEintragen,
	dienstwocheBesetzen,
	dienstwochenLesen,
	type Dienstwoche,
} from '../../lib/server/db/queries/duty-weeks.ts';
import {
	aktiveMitgliederAuflisten,
	type MitgliedFuerAuswahl,
} from '../../lib/server/db/queries/members.ts';
import { isoWocheVon, istWoche, wochenfenster, wochenSchluessel } from '../../lib/zeit.ts';
import { MITGLIED_NICHT_ANSPRECHBAR, WOCHE_NICHT_ANSPRECHBAR } from '../../lib/texte.ts';

/*
 * /traenkeplan — wer wann am Tränken ist, drei Monate im Voraus.
 *
 * Die Importe stehen relativ und mit .ts-Endung, und die Typen kommen aus
 * @sveltejs/kit statt aus ./$types. Der Grund ist derselbe wie in
 * src/routes/verwaltung/+page.server.ts und geprüft, nicht vermutet:
 * scripts/smoke-zugang.ts lädt dieses Modul mit nacktem Node, und
 * tsconfig.scripts.json kennt weder das virtuelle ./$types noch die
 * $lib-Zuordnung.
 *
 * **Zwei Stufen, aber nur eine davon an der Seite.** Der Wächter in
 * src/hooks.server.ts hat einen Aufruf ohne gültige Sitzung schon mit 403
 * abgewiesen; **lesen** darf den Plan danach jedes aktive Mitglied, und das ist
 * der Zweck der Seite — ein Tränkeplan, den nur die Verwaltung sieht, nimmt
 * niemandem die Nachfrage im Chat ab. Die zweite Stufe hängt allein an der
 * **action**: besetzen beginnt mit adminOderWeg. Es gibt darum bewusst kein
 * adminOderWeg in der load.
 *
 * Die Mutation ist eine form action mit use:enhance (AD-9), literales
 * action="?/besetzen" — ein dynamisches action={…} würde Gate-Regel 11 blind
 * machen.
 */

/**
 * Liest eine Zahl aus dem Formular, oder null.
 *
 * Die vierte bewusste Kopie von `idLesen` (siehe ../verwaltung/+page.server.ts
 * und ../+page.server.ts), hier zusätzlich für Jahr und Woche gebraucht und
 * darum neutral benannt. Die Verdopplung bleibt billiger als eine gemeinsame
 * Stelle: fünf Zeilen ohne Domänenwissen, und ein geteiltes Modul dafür hiesse,
 * dass eine Änderung an der einen Seite still die anderen trifft.
 */
function zahlLesen(roh: unknown): number | null {
	// `unknown` und nicht FormDataEntryValue: das Typprüf-Programm der Skripte
	// (tsconfig.scripts.json) zieht bewusst kein DOM-lib, und dieses Modul liegt
	// über scripts/smoke-zugang.ts darin.
	if (typeof roh !== 'string') return null;
	const gekuerzt = roh.trim();
	if (!/^[0-9]+$/.test(gekuerzt)) return null;
	const zahl = Number(gekuerzt);
	return Number.isSafeInteger(zahl) && zahl > 0 ? zahl : null;
}

/**
 * Der Plan, die eigene Rolle und — nur für Adminpersonen — die Auswahl.
 *
 * **Der Bezugszeitpunkt entsteht hier**, als `Math.floor(Date.now() / 1000)`,
 * und geht an wochenfenster. Er entsteht ausdrücklich **nicht** im Browser: ein
 * `Date.now()` in der Komponente liefe einmal serverseitig beim Rendern und
 * einmal beim Hydrieren, und in der Nacht zum Montag ergäbe dasselbe
 * Fenster zwei verschiedene Listen — Svelte meldete einen
 * Hydrierungsunterschied. Derselbe Grund wie bei der Überfälligkeit auf `/`.
 *
 * **`mitglieder` ist leer, wenn die lesende Person keine Adminrechte hat**, und
 * das ist keine Sparsamkeit, sondern die Zusage selbst: die Namensliste des
 * Vereins geht nicht ins ausgelieferte HTML von jemandem, der sie nicht
 * braucht. Die Oberfläche zeigt das Besetzen-Formular an derselben Marke, und
 * damit gibt es keinen Weg, auf dem der Knopf fehlt, die Auswahl aber
 * mitreist.
 *
 * Die Auswahl kommt als `MitgliedFuerAuswahl` — Kennung und Name, sonst nichts
 * — und die Aktiv-Bedingung steht in `aktiveMitgliederAuflisten` und nicht
 * hier. Ein `.filter()` an dieser Stelle wäre beides falsch: es holte Zeilen,
 * um sie wegzuwerfen, und schriebe eine Regel in eine Routendatei, die die
 * Abfrageschicht schon trägt.
 */
export function load({ locals }: ServerLoadEvent): {
	wochen: Dienstwoche[];
	laufendeWoche: number;
	istAdmin: boolean;
	/**
	 * Die eigene Mitglieds-Id, damit das Markup die eigene Zeile erkennt.
	 *
	 * Sie ist kein Geheimnis und keine Erweiterung der Angriffsfläche: `wochen`
	 * trägt `mitgliedId` je Woche ohnehin, seit es diese Seite gibt. Was hier
	 * dazukommt, ist allein der Vergleichspunkt — und die Berechtigung hängt
	 * nicht an ihm, sondern an der `where`-Klausel des DELETE.
	 */
	eigeneId: number;
	mitglieder: MitgliedFuerAuswahl[];
} {
	const mitglied = locals.mitglied;
	// Unerreichbar: der Wächter hat vorher mit 403 abgewiesen. Die Prüfung steht
	// hier, weil der Typ null zulässt — und ein `!` machte diese Seite von einer
	// Annahme über eine andere Datei abhängig.
	if (mitglied === null) {
		redirect(303, '/');
	}

	const jetztSekunden = Math.floor(Date.now() / 1000);
	const istAdmin = mitglied.isAdmin;
	return {
		wochen: dienstwochenLesen(wochenfenster(jetztSekunden)),
		// Die laufende Woche als gefalteter Schlüssel, damit die Komponente sie
		// hervorheben kann, ohne selbst zu rechnen — die Wochenrechnung steht an
		// einer Stelle, und das gilt auch für den Vergleich.
		laufendeWoche: wochenSchluessel(isoWocheVon(jetztSekunden)),
		istAdmin,
		eigeneId: mitglied.id,
		mitglieder: istAdmin ? aktiveMitgliederAuflisten() : [],
	};
}

/*
 * Wie diese Seite abweist — die Funktion steht in ../../lib/server/abweisen.ts
 * und ist für alle fünf Seiten dieselbe.
 *
 * `feld` ist hier immer `'mitgliedId'` oder null, `eingabe` bleibt leer: die
 * Auswahl ist ein <select> über bestehende Namen und keine getippte Eingabe,
 * die zurückreisen müsste.
 *
 * **`zeile` trägt den Wochenschlüssel**, nicht eine Zeilen-Id — `jahr * 100 +
 * woche`, gefaltet von wochenSchluessel in ../../lib/zeit.ts. Der Typ von
 * abweisen ist `number | null`, eine Woche braucht aber zwei Zahlen; die
 * Faltung ist der Preis dafür, den geteilten Typ nicht für einen Sonderfall
 * aufzuweiten. Die Begründung in ganzer Länge steht an wochenSchluessel.
 */
export const actions = {
	/**
	 * Besetzt eine Woche — und **dieselbe** action besetzt sie neu.
	 *
	 * Ein Tausch ist das Ersetzen des Namens, keine Verhandlung: es gibt kein
	 * Anfragen, kein Annehmen und keine zweite action dafür. Die Datenschicht
	 * schreibt über die Eindeutigkeit (Art, Jahr, Woche) entweder eine neue
	 * Zeile oder die bestehende um; die Route sieht davon nur, dass es geklappt
	 * hat.
	 *
	 * **Die Woche wird vor dem Mitglied geprüft**, aus demselben Grund wie bei
	 * `umbenennen` auf /verwaltung: eine Abweisung muss an einer Zeile
	 * anzubringen sein. Ohne ansprechbare Woche gibt es keine Zeile, an der ein
	 * Satz über das Mitglied stehen könnte — die Antwort trüge einen
	 * Wochenschlüssel, den die Liste nicht enthält, und die Oberfläche fände
	 * keine Stelle dafür.
	 *
	 * **Geprüft wird gegen das angezeigte Fenster und nicht nur auf Form.** Ein
	 * POST braucht kein Formular: ohne diese Schranke liesse sich eine Woche im
	 * Jahr 2043 besetzen, die niemand je zu Gesicht bekommt, und der Datensatz
	 * bliebe unsichtbar stehen. Rückwirkendes Besetzen fällt durch dieselbe
	 * Schranke — das Fenster beginnt mit der laufenden Woche.
	 */
	besetzen: async ({ locals, request }: RequestEvent) => {
		adminOderWeg(locals);

		const formular = await request.formData();
		const jahr = zahlLesen(formular.get('jahr'));
		const woche = zahlLesen(formular.get('woche'));
		// Fehlend, nicht numerisch, kalendarisch unmöglich und ausserhalb des
		// Fensters fallen auf denselben Satz — ohne Feld und ohne Zeile, damit er
		// in der Live-Region oben steht. Jede Unterscheidung wäre ein
		// Aufzählungskanal.
		if (jahr === null || woche === null || !istWoche({ jahr, woche })) {
			return abweisen(WOCHE_NICHT_ANSPRECHBAR);
		}
		const schluessel = wochenSchluessel({ jahr, woche });
		const jetztSekunden = Math.floor(Date.now() / 1000);
		const imFenster = wochenfenster(jetztSekunden).some(
			(eintrag) => wochenSchluessel(eintrag) === schluessel
		);
		if (!imFenster) {
			return abweisen(WOCHE_NICHT_ANSPRECHBAR);
		}

		const mitgliedId = zahlLesen(formular.get('mitgliedId'));
		if (mitgliedId === null) {
			return abweisen(MITGLIED_NICHT_ANSPRECHBAR, 'mitgliedId', '', schluessel);
		}

		// Unbekannt und beendet fallen hier zusammen. `is_active = 1` steht in der
		// Abfrage, nicht hier.
		const besetzt = dienstwocheBesetzen({ jahr, woche }, mitgliedId);
		if (besetzt === null) {
			return abweisen(MITGLIED_NICHT_ANSPRECHBAR, 'mitgliedId', '', schluessel);
		}

		// Ein Mitglied, das schon zuständig war, ist ein Erfolg und keine
		// Abweisung: die Person hat bekommen, was sie wollte, und eine Meldung
		// darüber wäre eine Aufforderung, etwas zu ändern, das schon stimmt.
		//
		// **`woche` reist mit, und zwar als blosse Zahl.** Die Rückmeldung nennt
		// die Kalenderwoche — dreizehn bis vierzehn Zeilen sehen gleich aus, und
		// der Fokus springt nach dem Absenden nach oben in die Live-Region. Der
		// gefaltete `schluessel` taugt dafür nicht: er ist zum Vergleichen da,
		// nicht zum Lesen, und `wochenSchluessel` hat bewusst keine Umkehrung.
		// `zeile` trägt ihn trotzdem, damit Erfolg und Abweisung dieselbe Form
		// haben und die Komponente beide über dasselbe Feld einer Zeile zuordnen
		// kann.
		return {
			art: 'besetzt' as const,
			meldung: 'Besetzt.',
			name: besetzt.name,
			woche,
			zeile: schluessel,
		};
	},

	/**
	 * Gibt die **eigene** Woche wieder frei — in zwei Schritten, an einer action.
	 *
	 * **Warum überhaupt bestätigt wird.** Seit `eintragen` daneben steht, kommt man
	 * aus eigener Kraft zurück — solange die Woche frei geblieben ist. Genau das
	 * ist der Vorbehalt: wer sich austrägt, gibt die Woche frei, und die nächste
	 * Person darf sie nehmen. Rückgängig ist die Handlung darum nicht durch
	 * Wiederholen, sondern nur, wenn niemand zugegriffen hat. Sie ist dieselbe Bauform wie das Übernehmen
	 * auf `/`: ein POST ohne `bestaetigt` ändert nichts und fragt, erst der zweite
	 * schreibt. Ohne JavaScript ist die Antwort auf den ersten POST ein
	 * vollständiges Dokument mit der Frage an der Zeile.
	 *
	 * **Kein adminOderWeg.** Diese Handlung gehört jedem Mitglied — aber nur für
	 * die eigene Woche, und diese Schranke steht in der `where`-Klausel des DELETE
	 * (`dienstwocheAustragen`). Eine Prüfung hier wäre die zweite Wahrheit darüber,
	 * wem eine Woche gehört.
	 *
	 * **Dieselbe Fensterprüfung wie besetzen.** Ein POST braucht kein Formular;
	 * ohne sie liesse sich eine Woche austragen, die die Seite gar nicht zeigt.
	 *
	 * Fehlende, unlesbare, kalendarisch unmögliche, fremde und schon unbesetzte
	 * Woche fallen auf **einen** Satz. Wer an einer fremden Woche scheitert, erfährt
	 * nicht einmal, dass es sie gibt.
	 */
	austragen: async ({ locals, request }: RequestEvent) => {
		const mitglied = locals.mitglied;
		// Unerreichbar: der Wächter hat vorher mit 403 abgewiesen. Die Prüfung steht
		// hier, weil der Typ null zulässt — ohne Identität gibt es niemanden, der
		// sich austrüge, und verändert wird nichts.
		if (mitglied === null) {
			return abweisen(WOCHE_NICHT_ANSPRECHBAR);
		}

		const formular = await request.formData();
		const jahr = zahlLesen(formular.get('jahr'));
		const woche = zahlLesen(formular.get('woche'));
		if (jahr === null || woche === null || !istWoche({ jahr, woche })) {
			return abweisen(WOCHE_NICHT_ANSPRECHBAR);
		}
		const schluessel = wochenSchluessel({ jahr, woche });
		const jetztSekunden = Math.floor(Date.now() / 1000);
		const imFenster = wochenfenster(jetztSekunden).some(
			(eintrag) => wochenSchluessel(eintrag) === schluessel
		);
		if (!imFenster) {
			return abweisen(WOCHE_NICHT_ANSPRECHBAR);
		}

		// Schritt 1: fragen. `has` und nicht ein Wertvergleich — das Feld ist eine
		// Marke, kein Wert.
		if (!formular.has('bestaetigt')) {
			// Gelesen wird die **eigene** Woche: die Frage darf nur entstehen, wo auch
			// geschrieben werden könnte. Der Vergleich steht hier und nicht in einer
			// Abfrage, weil dienstwochenLesen ohnehin mitgliedId liefert.
			const eigene = dienstwochenLesen([{ jahr, woche }]).find(
				(eintrag) => eintrag.mitgliedId === mitglied.id
			);
			if (eigene === undefined) {
				return abweisen(WOCHE_NICHT_ANSPRECHBAR);
			}
			return { art: 'fragenAustragen' as const, zeile: schluessel, woche: eigene.woche };
		}

		// Schritt 2: schreiben. Unbekannt, schon unbesetzt und fremd fallen hier
		// zusammen — die Bedingung steht in der Abfrage.
		const frei = dienstwocheAustragen({ jahr, woche }, mitglied.id);
		if (frei === null) {
			return abweisen(WOCHE_NICHT_ANSPRECHBAR);
		}

		return {
			art: 'ausgetragen' as const,
			meldung: `KW ${frei.woche} ist wieder unbesetzt.`,
			zeile: schluessel,
		};
	},

	/**
	 * Trägt die **eigene** Person in eine **freie** Woche ein.
	 *
	 * **Kein adminOderWeg** — das ist der Unterschied zu `besetzen` daneben, und er
	 * ist der Zweck dieser action: bis zum 2026-09-11 konnte sich niemand selbst
	 * eintragen, und der Plan füllte sich nur, wenn die Verwaltung ihn füllte.
	 *
	 * **Zwei Schranken, und beide stehen tiefer als hier.** Die Person ist die
	 * angemeldete (`locals.mitglied`), nicht eine aus dem Formular — ein Feld
	 * `mitgliedId` gibt es hier bewusst nicht, sonst trüge eine Person eine andere
	 * ein. Und die Woche muss **frei** sein; das entscheidet die Eindeutigkeit in
	 * `dienstwocheEintragen` und nicht ein Select in dieser Route.
	 *
	 * Ohne Rückfrage: eintragen nimmt niemandem etwas weg, und wer sich vertut,
	 * trägt sich mit der Handlung daneben wieder aus.
	 *
	 * Schon besetzt, unbekanntes oder beendetes Mitglied und das verlorene
	 * Wettrennen fallen auf **einen** Satz.
	 */
	eintragen: async ({ locals, request }: RequestEvent) => {
		const mitglied = locals.mitglied;
		// Unerreichbar: der Wächter hat vorher mit 403 abgewiesen.
		if (mitglied === null) {
			return abweisen(WOCHE_NICHT_ANSPRECHBAR);
		}

		const formular = await request.formData();
		const jahr = zahlLesen(formular.get('jahr'));
		const woche = zahlLesen(formular.get('woche'));
		if (jahr === null || woche === null || !istWoche({ jahr, woche })) {
			return abweisen(WOCHE_NICHT_ANSPRECHBAR);
		}
		const schluessel = wochenSchluessel({ jahr, woche });
		const jetztSekunden = Math.floor(Date.now() / 1000);
		const imFenster = wochenfenster(jetztSekunden).some(
			(eintrag) => wochenSchluessel(eintrag) === schluessel
		);
		if (!imFenster) {
			return abweisen(WOCHE_NICHT_ANSPRECHBAR);
		}

		const eingetragen = dienstwocheEintragen({ jahr, woche }, mitglied.id);
		if (eingetragen === null) {
			return abweisen(WOCHE_NICHT_ANSPRECHBAR);
		}

		return {
			art: 'besetzt' as const,
			meldung: 'Eingetragen.',
			name: eingetragen.name,
			woche,
			zeile: schluessel,
		};
	},
} satisfies Actions;
