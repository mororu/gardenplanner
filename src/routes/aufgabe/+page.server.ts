import { fail, redirect } from '@sveltejs/kit';
import type { Actions, RequestEvent } from '@sveltejs/kit';
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
 * Die Längengrenze des Aufgabentexts, serverseitig durchgesetzt.
 *
 * 200 Codepoints: `Tunnel 2 Blattläuse nachbehandeln` braucht 34, und 200 lassen
 * Raum für Ort und Zusatz, ohne dass die Zeile in der Liste zum Absatz wird. Die
 * Grenze ist eine Auslegung von „eine Aufgabe ist ein Satz" und keine
 * Eigenschaft der Daten — darum steht sie hier und nicht als CHECK in einer
 * Migration, die man zum Ändern erst schreiben müsste. Das `maxlength` am Feld
 * ist die Bequemlichkeit, diese Konstante die Regel: ein POST braucht kein Feld.
 *
 * **Die zwei zählen nicht dasselbe, und das ist benannt.** `maxlength` zählt
 * UTF-16-Einheiten, diese Prüfung zählt Codepoints. Ein gültiger Text aus 200
 * Codepoints, in dem ein Emoji steckt, ist im Browser 201 Einheiten und lässt
 * sich im Feld nicht zu Ende tippen — die annehmende Richtung der
 * Codepoint-Zählung ist über das echte Formular also gar nicht erreichbar. Der
 * Weg wäre ein Zähler in JavaScript; er kostet Zustand auf einer Seite, die
 * keinen hat, für einen Fall, den eine Gartenaufgabe kaum erreicht. Angenommen
 * und in README.md unter den benannt akzeptierten Risiken festgehalten.
 *
 * Die Zahl steht zweimal — hier und als Attribut im Markup. Ein Band zwischen
 * beiden zieht scripts/smoke-zugang.ts: es liest diese Konstante aus der Datei
 * und hält das `maxlength` daneben. Ohne das bliebe das Attribut beim nächsten
 * Ändern der Grenze stehen, und niemand merkte es.
 *
 * Als lokale Konstante und nicht in ../../lib/texte.ts, weil es genau eine
 * Wurfstelle gibt — dieselbe Begründung wie bei der 80 für Mitgliedsnamen.
 */
const TEXT_HOECHSTLAENGE = 200;

/** Der Text für die Überlänge. Eine Wurfstelle. */
const TEXT_ZU_LANG = `Das ist zu lang für eine Aufgabe. Höchstens ${TEXT_HOECHSTLAENGE} Zeichen.`;

/**
 * Nullbreiten-Zeichen. Sie sind unsichtbar, haben keine Breite und `trim()`
 * hält sie **nicht** für Leerraum.
 *
 * Ohne dieses Aussieben besteht ein Aufgabentext aus reinen Nullbreiten-Zeichen
 * jede Prüfung und legt eine Zeile an, die im Pool als leere Zeile mit einem
 * Kästchen daneben erscheint — ohne Aussage, was zu tun ist, und ohne
 * Bearbeiten-Aktion, die sie richtigstellen könnte. Abhaken ist dann das
 * Einzige, was bleibt.
 *
 * Wortgleich mit NULLBREITE in ../verwaltung/+page.server.ts, und die
 * Verdopplung ist billiger als eine gemeinsame Stelle: es ist eine Zeile ohne
 * Domänenwissen, und ein geteiltes Modul dafür hiesse, dass eine Änderung an der
 * einen Seite still die andere trifft.
 *
 * U+200B ZERO WIDTH SPACE, U+200C ZERO WIDTH NON-JOINER,
 * U+200D ZERO WIDTH JOINER, U+2060 WORD JOINER, U+FEFF ZERO WIDTH NO-BREAK
 * SPACE (die Form, in der eine Byte-Order-Mark beim Einfügen aus einer Datei
 * mitkommt).
 */
const NULLBREITE = /[\u200B-\u200D\u2060\uFEFF]/g;

/**
 * Der Aufgabentext, wie er in die Datenbank geht — oder null, wenn er nicht
 * taugt.
 *
 * Dieselbe Kette und dieselbe Reihenfolge wie namePruefen in
 * ../verwaltung/+page.server.ts, mit Absicht: erst die Nullbreiten-Zeichen weg,
 * dann Leerraum zusammenziehen, dann trimmen. Umgekehrt bliebe `\u200B \u200B` nach
 * dem Trimmen ein nichtleerer „Text".
 *
 * Gespeichert wird die **gefaltete** Fassung: `  Beet   25   jäten  ` wird zu
 * `Beet 25 jäten`.
 */
function textPruefen(eingabe: string): { text: string } | { fehler: string } {
	const text = eingabe.replace(NULLBREITE, '').replace(/\s+/g, ' ').trim();
	if (text === '') return { fehler: TEXT_FEHLT };
	// Nach Codepoints gezählt, nicht nach UTF-16-Einheiten: ein Emoji im Text
	// ist kein zweites Zeichen. [...text] zerlegt in Codepoints.
	if ([...text].length > TEXT_HOECHSTLAENGE) return { fehler: TEXT_ZU_LANG };
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
	 * **Ohne Zuständigen, ohne Frist.** Es gibt keine Spalte dafür und es soll
	 * keine geben; wer im Beet steht, tippt einen Satz und ist fertig.
	 *
	 * Die Meldung reist als **Query-Parameter** über die Weiterleitung: ein
	 * redirect() verwirft den Rückgabewert der action, und die Bestätigung
	 * braucht einen Träger. `?abgelegt` ist ein Wahrheitswert ohne Satz — den
	 * Satz setzt die Oberfläche auf /. Der Preis ist benannt und abgenommen: die
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
