import { aufgabentextFalten } from './aufgabentext.ts';

/*
 * Was eine Erntezeile ist — **die eine Stelle**, an der das steht.
 *
 * Vier Leser derselben Regeln, und der vierte ist der Grund für das Modul:
 *
 *   1. die actions auf /ernte — sie nehmen einen Status aus dem Formular an
 *      oder weisen ab;
 *   2. die Abfrageschicht in ./server/db/queries/harvests.ts — sie ordnet die
 *      Liste nach der Dringlichkeit, und zwar aus **dieser** Reihenfolge;
 *   3. die Seite /ernte — drei Abschnitte, je Status einer, mit Titel und Satz;
 *   4. die Startseite — dieselben Farben und dieselben Wörter an der
 *      Registerkarte.
 *
 * Der zweite ist der heikle: die Ordnung der Liste ist in SQL eine
 * CASE-Kaskade, und die entsteht aus ERNTESTATUS. Eine zweite Liste im
 * Abfragemodul liefe still auseinander — die Zeilen stünden dann in einer
 * anderen Reihenfolge, als die Seite ihre Abschnitte setzt, und niemand sähe
 * warum.
 *
 * Das Modul liegt in src/lib/ und nicht unter client/ oder server/: beide
 * Seiten lesen es. Es hängt nur von ./aufgabentext.ts ab, damit
 * ../routes/ernte/+page.server.ts es über nacktes Node laden kann
 * (scripts/smoke-zugang.ts tut genau das).
 */

/**
 * Die drei Stufen, **in der Reihenfolge, in der sie auf der Seite stehen**.
 *
 * Die Reihenfolge ist nicht Geschmack, sondern die Aussage der Seite: wer sie
 * öffnet, soll oben lesen, was heute nicht warten kann. Sie ist zugleich die
 * Sortierung der Abfrage — der Rang einer Zeile ist ihr Platz in diesem Array.
 *
 * **Die gespeicherten Werte sind Verben und keine Farben.** In der Spalte steht
 * `sofort`, nicht `rot`. Eine Datenbank, die Farben speichert, hat die
 * Gestaltung verschluckt: wer die Stufe „kann noch stehen" später gelb statt
 * orange malt, müsste Daten wandern lassen. Die Farbe fällt in der Komponente,
 * und zwar auf ein bestehendes Token (siehe die Begründung dort).
 */
export const ERNTESTATUS = ['sofort', 'stehen', 'wachsen'] as const;

export type Erntestatus = (typeof ERNTESTATUS)[number];

/**
 * Wie eine Stufe heisst und was sie bedeutet.
 *
 * `titel` ist die Überschrift des Abschnitts, `satz` die Erklärung darunter,
 * `kurz` die Beschriftung des Knopfs, mit dem eine Zeile **in** diese Stufe
 * wandert. Drei Wörter für dieselbe Sache, und das ist Absicht: eine
 * Überschrift trägt den ganzen Gedanken, ein Knopf an einer Zeile nicht — bei
 * 375px stehen zwei davon nebeneinander.
 *
 * Der Satz zu `sofort` nennt das Beispiel mit, weil es die Stufe erst
 * entscheidbar macht: „optimal reif" allein sagt niemandem, ab wann eine
 * Zucchini zu gross ist.
 */
export const ERNTETEXT: Record<Erntestatus, { titel: string; satz: string; kurz: string }> = {
	sofort: {
		titel: 'Sofort ernten',
		satz: 'Optimal reif oder kurz vor überreif. Liegenlassen kostet Qualität — Zucchini über zwanzig Zentimeter, dicke Bohnen, Salat, der zu schiessen beginnt.',
		kurz: 'Sofort ernten',
	},
	stehen: {
		titel: 'Kann noch stehen',
		satz: 'Schon geniessbar, wächst aber ohne Qualitätsverlust weiter. Ernten nach Bedarf.',
		kurz: 'Kann stehen',
	},
	wachsen: {
		titel: 'Noch wachsen lassen',
		satz: 'Nicht anfassen, es lohnt sich noch nicht.',
		kurz: 'Wachsen lassen',
	},
};

/**
 * Der Satz, der an jeder Zeile mit Dauerernte steht.
 *
 * Er ist **fest** und wird nicht gerechnet: es gibt keine Spalte „zuletzt
 * gepflückt" und keinen Vergleich gegen heute. Entschieden am 2026-09-13 — ein
 * Datum an dieser Stelle verlangte einen zweiten Griff („gepflückt"), den
 * niemand zuverlässig drückt, und eine Mahnung, die davon abhinge, wäre nach
 * zwei Wochen eine Lüge über jede Zeile.
 */
export const DAUERERNTE_SATZ = 'Alle zwei bis drei Tage durchgehen.';

/** Die Beschriftung des Häkchens, das denselben Vermerk setzt. */
export const DAUERERNTE_WORT = 'Laufend ernten';

/**
 * Sagt, ob ein Wert aus dem Formular eine der drei Stufen ist.
 *
 * `unknown` und nicht FormDataEntryValue: das Typprüf-Programm der Skripte
 * (tsconfig.scripts.json) zieht bewusst kein DOM-lib, und dieses Modul liegt
 * über scripts/smoke-zugang.ts darin.
 */
export function istErntestatus(roh: unknown): roh is Erntestatus {
	return typeof roh === 'string' && (ERNTESTATUS as readonly string[]).includes(roh);
}

/**
 * Die Kulturen zum Antippen.
 *
 * Alphabetisch, weil die Liste gesucht und nicht gelesen wird. Sie ist
 * **keine** abschliessende Aufzählung, sondern ein Vorschlag: sie hängt als
 * `<datalist>` an einem gewöhnlichen Textfeld (siehe KULTURLISTE darunter), und
 * wer etwas anbaut, das hier fehlt, tippt es einfach. Darum gibt es auch keine
 * Pflege in der Verwaltung — eine Tabelle für zwanzig Wörter, die sich im Jahr
 * einmal ändern, wäre teurer als das Feld, in das man sie ohnehin tippen kann.
 *
 * Die Liste ist der Stand vom 2026-09-13 und ausdrücklich als vorläufig
 * abgenommen; sie wird angepasst, wenn der Garten es sagt.
 */
export const KULTUREN = [
	'Bohnen',
	'Cherrytomaten',
	'Erbsen',
	'Fenchel',
	'Gurken',
	'Kartoffeln',
	'Kohlrabi',
	'Kräuter',
	'Kürbis',
	'Lauch',
	'Mais',
	'Mangold',
	'Radieschen',
	'Rote Bete',
	'Rüebli',
	'Salat',
	'Spinat',
	'Tomaten',
	'Zucchini',
	'Zwiebeln',
] as const;

/**
 * Die Kennung der `<datalist>`, die KULTUREN im Markup ausgibt.
 *
 * **Eine Liste an einem Textfeld und keine Auswahl daneben.** Gewollt war
 * „antippen, und wer etwas anderes anbaut, schreibt es hin" — ein `<select>`
 * mit einem Eintrag `Etwas anderes` plus einem zweiten Feld leistet das auch,
 * aber es sind zwei Felder für einen Wert, und ein abgewiesener Versand müsste
 * beide zurücktragen. `abweisen` trägt zwei Texte zurück, und der zweite ist
 * hier schon vom Ort belegt (siehe die Begründung an abweisen selbst: einen
 * dritten Platz gibt es nicht und soll es nicht geben).
 *
 * Mit der Liste am Textfeld ist die Kultur **ein** Feld: antippen wählt aus den
 * zwanzig Vorschlägen, tippen schreibt irgendetwas, und der verworfene Wert
 * reist über `eingabe` zurück. Wo ein Browser `<datalist>` nicht kennt, bleibt
 * ein gewöhnliches Textfeld — die Vorschläge fehlen, die Seite nicht.
 */
export const KULTURLISTE = 'kulturen';

/**
 * Die Längengrenze für Kultur und Ort, in **Codepoints**.
 *
 * 60 und nicht AUFGABE_HOECHSTLAENGE: eine Kultur ist kein Satz, sondern ein
 * Name — `Cherrytomaten` braucht 13, `Rote Bete` 9. Die 200 einer Aufgabenzeile
 * liessen hier einen ganzen Absatz zu, und die Zeile auf der Startseite hat
 * neben Ort, Datum und Namen keinen Platz dafür.
 */
export const ERNTE_HOECHSTLAENGE = 60;

export const KULTUR_FEHLT = 'Schreib hin, was reif ist.';

export const KULTUR_ZU_LANG = `Das ist zu lang für eine Kultur. Höchstens ${ERNTE_HOECHSTLAENGE} Zeichen.`;

export const ORT_ZU_LANG = `Das ist zu lang für einen Ort. Höchstens ${ERNTE_HOECHSTLAENGE} Zeichen.`;

export const STATUS_FEHLT = 'Sag noch, wie dringend es ist.';

/**
 * Prüft die Kultur: gefaltet, nicht leer, nicht zu lang.
 *
 * Gefaltet wird mit aufgabentextFalten — dieselbe Kette wie bei einem
 * Aufgabensatz und einem Blatttitel, und aus demselben Grund: erst die
 * unsichtbaren Zeichen weg, dann Leerraum zusammenziehen, dann trimmen.
 * Umgekehrt bliebe `\u200B \u200B` ein nichtleerer „Name".
 */
export function kulturPruefen(eingabe: string): { kultur: string } | { fehler: string } {
	const kultur = aufgabentextFalten(eingabe);
	if (kultur === '') return { fehler: KULTUR_FEHLT };
	// Nach Codepoints gezählt, nicht nach UTF-16-Einheiten — wie überall in
	// dieser Kette. [...kultur] zerlegt in Codepoints.
	if ([...kultur].length > ERNTE_HOECHSTLAENGE) return { fehler: KULTUR_ZU_LANG };
	return { kultur };
}

/**
 * Prüft den Ort: **darf leer sein**, und leer heisst null.
 *
 * Das ist der ganze Unterschied zur Kultur daneben. Ein Beet anzugeben ist
 * freiwillig, weil die Angabe oft nichts hinzufügt — wer `Obstwiese` liest,
 * weiss es ohnehin, und ein Pflichtfeld hier wäre eine Hürde vor der Handlung,
 * die diese Seite ermöglichen soll.
 */
export function ortPruefen(eingabe: string): { ort: string | null } | { fehler: string } {
	const ort = aufgabentextFalten(eingabe);
	if (ort === '') return { ort: null };
	if ([...ort].length > ERNTE_HOECHSTLAENGE) return { fehler: ORT_ZU_LANG };
	return { ort };
}
