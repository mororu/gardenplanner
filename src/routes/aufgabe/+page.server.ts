import { fail, redirect } from '@sveltejs/kit';
import type { Actions, RequestEvent } from '@sveltejs/kit';
import { AUFGABE_HOECHSTLAENGE, aufgabentextFalten } from '../../lib/aufgabentext.ts';
import { aufgabeAnlegen } from '../../lib/server/db/queries/tasks.ts';

/*
 * /aufgabe — eine Aufgabe vor Ort erfassen. Ein Feld, ein Knopf, keine Wahl.
 *
 * Die Importe stehen relativ und mit .ts-Endung, und die Typen kommen aus
 * @sveltejs/kit statt aus ./$types. Der Grund ist derselbe wie in
 * src/routes/+page.server.ts:14-19 und geprüft, nicht vermutet:
 * scripts/smoke-zugang.ts lädt dieses Modul mit nacktem Node, und
 * tsconfig.scripts.json kennt weder das virtuelle ./$types noch die
 * $lib-Zuordnung.
 *
 * **Keine load.** Die Seite hat nichts zu laden: sie zeigt ein leeres Feld.
 *
 * **Keine eigene Zugangsschranke.** Der Wächter in src/hooks.server.ts schützt
 * jeden Pfad ausser /i/… und hat einen Aufruf ohne gültige Sitzung schon mit 403
 * abgewiesen. Es gibt hier auch keine zweite Stufe: erfassen darf jedes aktive
 * Mitglied, und die action liest locals gar nicht — es gibt keine Spalte, die
 * einen Erfassenden hielte, und es soll keine geben (AD-2, AD-5).
 *
 * Die Mutation ist eine form action mit use:enhance (AD-9). Kein +server.ts,
 * kein JSON-Endpunkt, und im Markup ein **literales** action="?/ablegen" — ein
 * dynamisches action={…} würde Gate-Regel 11 blind machen.
 */

/** Der Text für den einen Fall, den nur diese Seite kennt. Eine Wurfstelle. */
const TEXT_FEHLT = 'Ohne Text entsteht keine Aufgabe. Schreib in einem Satz, was zu tun ist.';

/**
 * Der Text für die Überlänge. Eine Wurfstelle.
 *
 * Die Grenze selbst steht nicht mehr hier, sondern als AUFGABE_HOECHSTLAENGE in
 * ../../lib/aufgabentext.ts. Der Kommentar an dieser Stelle begründete die
 * lokale Konstante bis Story 2.1 mit „genau eine Wurfstelle"; seit /monatsplan
 * dieselbe Grenze für jede Zeile seines Stapels wirft, sind es **zwei
 * Wurfstellen, darum geteilt**. Eine zweite Zahl in der zweiten Route wäre eine
 * zweite Wahrheit über dieselbe Regel — und der Zähler auf /monatsplan
 * verspräche eine Zahl, die der Server nicht einlöst.
 *
 * Der Satz bleibt lokal: er nennt ein Feld und ist die Auslegung dieser Seite.
 * scripts/smoke-zugang.ts hält das `maxlength` im Markup gegen die Konstante im
 * geteilten Modul.
 */
const TEXT_ZU_LANG = `Das ist zu lang für eine Aufgabe. Höchstens ${AUFGABE_HOECHSTLAENGE} Zeichen.`;

/**
 * Der Aufgabentext, wie er in die Datenbank geht — oder null, wenn er nicht
 * taugt.
 *
 * Gefaltet wird in aufgabentextFalten in ../../lib/aufgabentext.ts: erst die
 * Nullbreiten-Zeichen weg, dann Leerraum zusammenziehen, dann trimmen.
 * Gespeichert wird die **gefaltete** Fassung: `  Beet   25   jäten  ` wird zu
 * `Beet 25 jäten`.
 *
 * Was hier bleibt, ist die **Deutung**: leer und zu lang ergeben die zwei Sätze
 * dieser Seite. Auf /monatsplan macht dieselbe Faltung andere Sätze — dort geht
 * es um die Zahl der zu langen Zeilen eines Stapels, nicht um das eine Feld.
 */
function textPruefen(eingabe: string): { text: string } | { fehler: string } {
	const text = aufgabentextFalten(eingabe);
	if (text === '') return { fehler: TEXT_FEHLT };
	// Nach Codepoints gezählt, nicht nach UTF-16-Einheiten: ein Emoji im Text
	// ist kein zweites Zeichen. [...text] zerlegt in Codepoints.
	if ([...text].length > AUFGABE_HOECHSTLAENGE) return { fehler: TEXT_ZU_LANG };
	return { text };
}

/**
 * Ein Fehlschlag mit 400.
 *
 * `eingabe` trägt das Getippte zurück, damit es im Feld stehenbleibt.
 *
 * `feld` benennt, wohin die Meldung gehört — und die Komponente **liest es
 * heute nicht**. Sie muss nicht: diese Seite hat genau ein Feld, jede Meldung
 * dieser action gehört dorthin, und eine Verzweigung über einen Wert, der immer
 * derselbe ist, wäre ein toter Zweig. Anders als auf /verwaltung, wo eine
 * Meldung an das Namensfeld und eine andere an den Seitenkopf gehört; dort
 * unterscheidet die Oberfläche wirklich.
 *
 * Es steht trotzdem da, aus zwei Gründen: es ist der von der Spezifikation
 * festgelegte Rückgabewert dieser action, und es ist die Stelle, an der ein
 * zweites Feld — käme je eines — die Zuordnung schon vorfände, statt sie
 * nachrüsten zu müssen. Geprüft wird es in scripts/smoke-zugang.ts, das jede
 * Abweisung auf `feld: 'text'` festnagelt.
 *
 * Ein abgewiesener Versand legt **nichts** an: aufgabeAnlegen wird auf diesem
 * Weg nie erreicht.
 */
function abweisen(meldung: string, eingabe: string) {
	return fail(400, { art: 'fehler' as const, meldung, feld: 'text' as const, eingabe });
}

export const actions = {
	/**
	 * Legt eine Aufgabe ab und leitet auf die Liste zurück.
	 *
	 * **Ohne Zuständigen, ohne Frist.** Für einen Zuständigen gibt es keine Spalte
	 * und es soll keine geben (AD-2, AD-5). Für eine Frist gibt es seit Story 2.1
	 * eine — `due_at`, gesetzt vom Monatsplan für den ganzen Stapel —, und diese
	 * action lässt sie ausdrücklich **leer**: wer im Beet steht, tippt einen Satz
	 * und ist fertig, und diese Seite bekommt darum kein Datumsfeld. Genau die
	 * Lücke fängt Story 2.2 mit COALESCE(due_at, created_at) ab.
	 *
	 * Die Meldung reist als **Query-Parameter** über die Weiterleitung: ein
	 * redirect() verwirft den Rückgabewert der action, und die Bestätigung
	 * braucht einen Träger. `?abgelegt` steht ohne Wert und ohne Satz — die load
	 * von / liest daraus die Zahl 1 (seit Story 2.1 trägt der Parameter eine
	 * Zahl, weil /monatsplan einen ganzen Stapel meldet), und den Satz
	 * `Abgelegt.` setzt die Oberfläche. Der Preis ist benannt und abgenommen: die
	 * Adresse trägt den Parameter sichtbar, ein Neuladen wiederholt die Meldung,
	 * und wer die Adresse von Hand eintippt, sieht sie auch. Ein Flash-Cookie
	 * wäre der Gegenentwurf und führte ein zweites Cookie neben dem
	 * Sitzungs-Cookie ein, das eine load schreibend wieder löschen müsste.
	 *
	 * 303 und nicht 302: nach einem POST ist die Folgeanfrage ausdrücklich ein
	 * GET.
	 */
	ablegen: async ({ request }: RequestEvent) => {
		const formular = await request.formData();
		const roh = formular.get('text');
		// Ein fehlendes Feld und ein Nicht-String (ein Datei-Upload) fallen auf
		// dieselbe leere Eingabe zusammen — und damit auf denselben Satz wie ein
		// leeres Feld. Jede Unterscheidung wäre eine Auskunft ohne Handlung.
		const getippt = typeof roh === 'string' ? roh : '';
		const geprueft = textPruefen(getippt);
		if ('fehler' in geprueft) {
			return abweisen(geprueft.fehler, getippt);
		}

		aufgabeAnlegen(geprueft.text);

		// Nach dem redirect läuft hier nichts mehr: redirect() wirft.
		redirect(303, '/?abgelegt');
	},
} satisfies Actions;
