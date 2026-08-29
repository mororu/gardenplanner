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
 *
 * Dass zwei Seiten zwei der drei Angaben leer lassen, ist der Preis der einen
 * Form und ausdrücklich abgenommen: eine leere Angabe kostet ein Feld in der
 * Nutzlast, eine eigene Signatur kostet die nächste Drift.
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
	eingabe = ''
) {
	return fail(400, { art: 'fehler' as const, meldung, feld, eingabe });
}
