import { fail } from '@sveltejs/kit';

/*
 * Die eine Form, in der eine action eine Eingabe abweist.
 *
 * Bis Ende Epic 2 hatte jede Seite ihre eigene: `()` auf /, `(meldung, eingabe)`
 * auf /aufgabe, `(meldung, feld)` auf /monatsplan und `(meldung, feld,
 * nameEingabe)` auf /verwaltung — vier Signaturen und vier Nutzlastformen für
 * dieselbe Sache, gewachsen in der Reihenfolge, in der die Seiten entstanden
 * sind. Retro-Posten D2 aus Epic 2 (B5 aus Epic 1). Die Drift kostete nichts,
 * solange man eine Seite las, und alles, sobald man zwei verglich: `eingabe`
 * gegen `nameEingabe` für denselben Rückweg einer verworfenen Eingabe.
 *
 * Vorlage ist die Form von /monatsplan, um den Rückweg der Eingabe erweitert:
 *
 *   - `meldung` ist der Satz, den die Person liest. Er kommt aus einer
 *     Textkonstante, nie aus der Eingabe.
 *   - `feld` benennt, wohin die Meldung gehört, oder ist null, wenn die Seite
 *     nur eine Stelle dafür hat. Der Typ bleibt je Seite eng: der Parameter ist
 *     generisch, und `abweisen(DATUM_FEHLT, 'datum')` bindet Feld an 'datum'.
 *     Die ActionData einer Seite trägt darum weiterhin genau die Feldnamen, die
 *     ihre actions vergeben, und ein Tippfehler im Markup bleibt ein Typfehler.
 *   - `eingabe` trägt den verworfenen Text zurück ins Feld. Leer bei jeder
 *     Seite, deren Feldwert im $state der Komponente steht und einen abgewiesenen
 *     Versand darum ohnehin übersteht (/monatsplan), und bei jeder, die gar kein
 *     Feld hat (/).
 *   - `zeile` benennt, an **welche Zeile einer Liste** die Meldung gehört, oder
 *     ist null, wenn die Seite nur ein Formular hat. Seit Story 3.0.1 trägt
 *     /verwaltung je aktiver Mitgliedszeile ein Umbenennen-Formular, und `feld`
 *     allein sagt dann nur die Art der Stelle, nicht welche.
 *   - `zweiteEingabe` trägt den verworfenen Text des **anderen** Feldes zurück.
 *     Seit Story 4.1, und aus demselben Anlass, aus dem `zeile` entstand: eine
 *     Seite kam dazu, für die die bisherige Form nicht reichte. /wissen ist das
 *     erste Formular mit **zwei freien Textfeldern**, die beide ohne JavaScript
 *     zurückreisen müssen — Titel und Freitext eines Blatts. /einzelaufgabe hat
 *     ebenfalls zwei Felder, aber das zweite ist ein Datum mit `required`, `min`
 *     und `max`, das der Browser selbst prüft; ein Blatt-Freitext kann
 *     achttausend Zeichen tragen, und ihn wegen eines leeren Titels zu verlieren
 *     wäre der teuerste Fehlschlag dieser Seite.
 *
 *     **Ausdrücklich kein dritter Slot und keine Abbildung Feld → Wert.** Ein
 *     Formular mit drei freien Textfeldern gibt es nicht und soll es nicht
 *     geben; eine Abbildung machte aus einer Nutzlast, deren Felder jede Seite
 *     typisiert kennt, ein Wörterbuch, in dem ein Tippfehler wieder stumm wäre.
 *
 *     **Und ausdrücklich kein Optionsobjekt**, obwohl der Review zu Story 4.1 es
 *     vorgeschlagen hat und der Einwand berechtigt ist: `abweisen(satz, 'titel',
 *     titel, null, text)` liest sich als Rätsel, und die zwei neuen Aufrufe
 *     schreiben `null` allein, um an den fünften Platz zu kommen. Ein Objekt
 *     nähme das weg. Es kostete aber, dass **jede** der bisherigen zwölf
 *     Aufrufstellen in einem Zug umgeschrieben werden müsste — in einer Story,
 *     die von der Sache her nichts damit zu tun hat, und ohne dass eine
 *     Behauptung den Umbau abfinge. Der Handel ist bewusst so herum entschieden,
 *     und er ist die nächste Auslösebedingung: **das sechste Argument gibt es
 *     nicht.** Wer es braucht, schreibt vorher die Form um.
 *
 * **`feld` und `zeile` zusammen sind die Zuordnung, und beide müssen ohne
 * JavaScript tragen.** Eine erste Fassung von Story 3.0.1 liess die Zeile vom
 * `use:enhance`-Rückruf aus dem abgeschickten `formData` lesen — was ohne
 * JavaScript nie läuft. Die Folge war belegt: das Feld zeigte wieder den alten
 * Namen, das Formular war zugeklappt, `aria-invalid` fehlte, und der Fokus
 * sprang in eine leere Region. Eine Zuordnung, die nur der Client herstellt, ist
 * für eine Seite, die ohne JavaScript bedienbar sein soll, keine.
 *
 * Dass die meisten Seiten die Hälfte der Angaben leer lassen, ist der Preis der
 * einen Form und ausdrücklich abgenommen: eine leere Angabe kostet ein Feld in
 * der Nutzlast, eine eigene Signatur kostet die nächste Drift.
 *
 * `art: 'fehler'` ist die Unterscheidungsmarke: /verwaltung gibt aus derselben
 * action auch Erfolg mit `art: 'link'` zurück, und die Komponenten verzweigen
 * über dieses Feld, nicht über das Vorhandensein von `meldung`.
 *
 * Der Status ist immer 400 — es ist immer die Eingabe, die nicht trägt. Ein
 * fehlendes Recht wirft (403) oder leitet weiter, ein fehlender Zugang ist Sache
 * des Wächters in src/hooks.server.ts, und keiner der beiden Fälle kommt je
 * hierher.
 *
 * Liegt unter lib/server/, weil `fail` aus @sveltejs/kit kommt und die Funktion
 * nur in +page.server.ts benutzt wird. Sie ist über nacktes Node ladbar, wie die
 * Module, die sie einziehen — scripts/smoke-zugang.ts lädt sie mit.
 */
export function abweisen<Feld extends string>(
	meldung: string,
	feld: Feld | null = null,
	eingabe = '',
	zeile: number | null = null,
	zweiteEingabe = ''
) {
	return fail(400, { art: 'fehler' as const, meldung, feld, eingabe, zeile, zweiteEingabe });
}
