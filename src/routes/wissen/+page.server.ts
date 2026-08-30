import { redirect } from '@sveltejs/kit';
import type { Actions, RequestEvent } from '@sveltejs/kit';
import { AUFGABE_HOECHSTLAENGE } from '../../lib/aufgabentext.ts';
import { BLATT_HOECHSTLAENGE, blattTextPruefen, blattTitelPruefen } from '../../lib/blatttext.ts';
import { abweisen } from '../../lib/server/abweisen.ts';
import {
	blaetterLesen,
	blattAnlegen,
	type Blattzeile,
} from '../../lib/server/db/queries/sheets.ts';

/*
 * /wissen — die Blätter, alphabetisch, und das Formular für ein neues.
 *
 * Die Importe stehen relativ und mit .ts-Endung, und die Typen kommen aus
 * @sveltejs/kit statt aus ./$types. Der Grund ist derselbe wie in den
 * Nachbarrouten und geprüft, nicht vermutet: scripts/smoke-zugang.ts lädt
 * dieses Modul mit nacktem Node, und tsconfig.scripts.json kennt weder das
 * virtuelle ./$types noch die $lib-Zuordnung.
 *
 * **Keine eigene Zugangsschranke und keine zweite Stufe.** Der Wächter in
 * src/hooks.server.ts hat einen Aufruf ohne gültige Sitzung schon mit 403
 * abgewiesen, und lesen wie schreiben darf jedes aktive Mitglied. Die action
 * liest `locals` gar nicht, und das ist die Aussage der Story: ein Blatt gehört
 * der Gemeinschaft, nicht der Person, die es getippt hat. Wer anlegt, wird
 * nirgends gespeichert — es gibt keine Autorenspalte (siehe schema.ts).
 *
 * Die Mutation ist eine form action mit use:enhance (AD-9). Kein +server.ts,
 * kein JSON-Endpunkt, und im Markup ein **literales** action="?/anlegen" — ein
 * dynamisches action={…} würde Gate-Regel 11 blind machen.
 *
 * **Diese Seite hat kein Ändern und keine Löschen-Aktion.** Geändert wird am
 * Blatt selbst, auf /wissen/[id], wo der Text ohnehin schon steht; ein zweiter
 * Änderungsweg von der Liste aus hiesse, den ganzen Freitext jedes Blatts ins
 * ausgelieferte HTML der Liste zu legen. Gelöscht wird gar nicht — das ist
 * keine Auslassung dieser Story, sondern ihr Umfang: die Abnahmekriterien
 * kennen Lesen, Anlegen und Ändern, und eine zerstörende Aktion ausserhalb der
 * Verwaltung wäre die erste im Produkt.
 */

/*
 * Die vier Sätze zu Titel und Text stehen **nicht** hier, sondern in
 * ../../lib/blatttext.ts: sie haben zwei Wurfstellen — diese action und
 * `aendern` auf /wissen/[id] —, und zwei Routen, die je selbst deuteten, wären
 * die Drift, gegen die das geteilte Modul steht. Dieselbe Bauform wie
 * NAME_FEHLT in ../../lib/mitgliedsname.ts.
 */

/**
 * Die Liste und die zwei Längengrenzen.
 *
 * Sie nimmt **kein Ereignis** entgegen, und das ist die Aussage: sie liest
 * weder locals noch cookies noch die Adresse. Alle sehen dieselbe Liste — es
 * gibt keine persönliche Sicht auf Wissen, und darum auch kein Gegenstück zum
 * personenbezogenen Diensthinweis auf `/`.
 *
 * **Kein `?angelegt` in dieser load.** Nach dem Anlegen leitet die action auf
 * das frische Blatt weiter und nicht auf die Liste: wer gerade etwas
 * aufgeschrieben hat, will es dastehen sehen. Der Satz `Angelegt.` steht darum
 * auf /wissen/[id].
 *
 * Die zwei Grenzen reisen mit, statt im Markup als Literal zu stehen —
 * dieselbe Bauform wie `titelGrenze` auf /einzelaufgabe und `namensgrenze` auf
 * /verwaltung, und derselbe Grund: ein `maxlength="200"` neben einem Server,
 * der aus der Konstante prüft, sind zwei Zahlen über eine Regel.
 */
export function load(): {
	blaetter: Blattzeile[];
	titelGrenze: number;
	textGrenze: number;
} {
	return {
		blaetter: blaetterLesen(),
		titelGrenze: AUFGABE_HOECHSTLAENGE,
		textGrenze: BLATT_HOECHSTLAENGE,
	};
}

/*
 * Wie diese Seite abweist — die Funktion selbst steht in
 * ../../lib/server/abweisen.ts und ist für alle Seiten dieselbe.
 *
 * `feld` benennt, wohin die Meldung gehört: diese Seite hat zwei Felder, und
 * eine Meldung über den Freitext gehört an das Textfeld, nicht an den Titel.
 *
 * **Beide Eingaben reisen zurück, aus jeder Abweisung** — der Titel über
 * `eingabe`, der Freitext über `zweiteEingabe`. Das ist der Anlass, aus dem der
 * zweite Rückweg entstanden ist: ein Blatt-Freitext kann achttausend Zeichen
 * tragen, und ihn wegen eines leeren Titels zu verlieren wäre der teuerste
 * Fehlschlag dieser Seite. Ohne JavaScript wird die Seite neu gerendert, und
 * was nicht zurückreist, ist fort.
 *
 * Ein abgewiesener Versand legt **nichts** an: blattAnlegen wird auf diesem Weg
 * nie erreicht.
 */
export const actions = {
	/**
	 * Legt ein Blatt an und leitet auf **das Blatt** weiter.
	 *
	 * **Die Reihenfolge der Prüfungen folgt den Feldern**, von oben nach unten:
	 * erst der Titel, dann der Text. Dieselbe Ordnung wie auf /einzelaufgabe und
	 * aus demselben Grund — zwei gleichrangige Felder stehen nebeneinander, und
	 * wer eines übersieht, soll den Satz an der Stelle finden, an der sein Auge
	 * ohnehin steht.
	 *
	 * Weitergeleitet wird auf `/wissen/<id>?angelegt` und nicht auf die Liste.
	 * Das ist die Ausnahme zur Regel „Formularseiten leiten auf die Liste
	 * zurück", und sie hat einen Grund: die Liste zeigt nur Titel, und wer
	 * gerade zwei Absätze getippt hat, sähe dort nichts als eine Zeile mehr. Der
	 * Satz `Angelegt.` — das Verb des Knopfs im Perfekt — steht auf der
	 * Zielseite.
	 *
	 * 303 und nicht 302: nach einem POST ist die Folgeanfrage ausdrücklich ein
	 * GET.
	 */
	anlegen: async ({ request }: RequestEvent) => {
		const formular = await request.formData();

		// Ein fehlendes Feld und ein Nicht-String (ein Datei-Upload) fallen auf
		// dieselbe leere Eingabe zusammen — und damit auf denselben Satz wie ein
		// leeres Feld. Jede Unterscheidung wäre eine Auskunft ohne Handlung.
		const rohTitel = formular.get('titel');
		const getippterTitel = typeof rohTitel === 'string' ? rohTitel : '';
		const rohText = formular.get('text');
		const getippterText = typeof rohText === 'string' ? rohText : '';

		const gepruefterTitel = blattTitelPruefen(getippterTitel);
		if ('fehler' in gepruefterTitel) {
			return abweisen(gepruefterTitel.fehler, 'titel', getippterTitel, null, getippterText);
		}

		const gepruefterText = blattTextPruefen(getippterText);
		if ('fehler' in gepruefterText) {
			return abweisen(gepruefterText.fehler, 'text', getippterTitel, null, getippterText);
		}

		const id = blattAnlegen(gepruefterTitel.titel, gepruefterText.text);

		// Nach dem redirect läuft hier nichts mehr: redirect() wirft.
		redirect(303, `/wissen/${id}?angelegt`);
	},
} satisfies Actions;
