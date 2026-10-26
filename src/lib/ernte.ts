import { aufgabentextFalten } from './aufgabentext.ts';
import { leerZuletzt, ortVereinheitlichen } from './beet.ts';

/*
 * Was eine Erntezeile ist — **die eine Stelle**, an der das steht.
 *
 * Vier Leser derselben Regeln, und der vierte ist der Grund für das Modul:
 *
 *   1. die actions auf /ernte — sie nehmen einen Status aus dem Formular an
 *      oder weisen ab;
 *   2. die Abfrageschicht in ./server/db/queries/harvests.ts — sie ordnet die
 *      Liste nach der Dringlichkeit, und zwar aus **dieser** Reihenfolge;
 *   3. die Seite /ernte — je Beet ein Abschnitt, darin je Stufe ein
 *      Zwischentitel (`nachBeetGliedern` unten);
 *   4. die Startseite — sie zählt die Zeilen. Farben und Wörter der Stufen
 *      trägt sie seit dem 2026-09-17 nicht mehr.
 *
 * Der zweite ist der heikle: die Ordnung der Liste ist in SQL eine
 * CASE-Kaskade, und die entsteht aus ERNTESTATUS. Eine zweite Liste im
 * Abfragemodul liefe still auseinander — die Zeilen stünden dann in einer
 * anderen Reihenfolge, als die Seite ihre Abschnitte setzt, und niemand sähe
 * warum.
 *
 * Das Modul liegt in src/lib/ und nicht unter client/ oder server/: beide
 * Seiten lesen es. Es hängt nur von ./aufgabentext.ts und ./beet.ts ab, damit
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

/**
 * Die Stufen, die die Oberfläche **anbietet** — seit dem 2026-09-14 zwei von
 * drei.
 *
 * `wachsen` ist verborgen und nicht entfernt, und der Unterschied ist die
 * ganze Absicht: die Spalte, der Rang in der Sortierung, das Farbtoken und die
 * Umstufung bleiben, wie sie sind. Was wegfällt, ist die **Wahl**: neu
 * eintragen und umstufen führen nur noch nach `sofort` oder `stehen`.
 *
 * **Bestehende Zeilen bleiben darum erreichbar.** Seit dem 2026-10-26
 * (spec-ernte-nach-beet.md) steht eine Zeile, die noch auf `wachsen` steht,
 * auf /ernte unter `Langsam ernten` — mit dessen Farbe und dessen Knopf
 * `Sofort` (siehe `anzeigestufe` unten) —, und die Startseite zählt sie mit.
 * `Noch wachsen lassen` kommt in der Oberfläche nicht mehr vor. Ohne diese
 * Eigenschaft wäre das Verbergen eine Falle: Daten, die man sieht, aber nicht
 * mehr anfassen kann — oder schlimmer, die man nicht mehr sieht.
 *
 * Die Spalte wird dafür **nicht** umgeschrieben: eine Änderung an Datenbank
 * oder actions verlangt die Spec ausdrücklich nur nach Rückfrage, und die
 * Anzeige allein deckt, was sie verlangt.
 *
 * Zurückgenommen wird das, indem `wachsen` hier wieder dazukommt. Eine Stelle.
 */
export const SICHTBARE_ERNTESTATUS = ['sofort', 'stehen'] as const;

export type Erntestatus = (typeof ERNTESTATUS)[number];

/**
 * Wie eine Stufe heisst und was sie bedeutet.
 *
 * `titel` steht in der Legende, in der Stufenwahl des Formulars und in der
 * Rückmeldung nach dem Eintragen und Umstufen, `satz` ist die Erklärung
 * daneben. `kurz` ist seit dem 2026-10-26 der **Zwischentitel** einer Stufe
 * im Beet auf /ernte (so im abgenommenen Entwurf; spec-ernte-nach-beet.md) und
 * — für `sofort` — der Anfang des vorgelesenen Namens des Knopfs `Sofort`
 * (`Sofort ernten Salat, Hochbeet 3`).
 * Mehrere Wörter für dieselbe Sache, und das ist Absicht: eine Erklärung trägt
 * den ganzen Gedanken, ein Zwischentitel in einer Karte bei 375px nicht.
 *
 * Der Satz zu `sofort` nannte bis zum 2026-10-12 ein Beispiel mit (Zucchini
 * über zwanzig Zentimeter, dicke Bohnen, schiessender Salat). Seither steht er
 * kurz, wie die zwei anderen Stufen (Entscheid Manuel in der Textdurchsicht).
 */
export const ERNTETEXT: Record<Erntestatus, { titel: string; satz: string; kurz: string }> = {
	sofort: {
		titel: 'Sofort ernten',
		satz: 'Perfekt reif oder kurz vor überreif.',
		kurz: 'Sofort ernten',
	},
	/*
	 * **Umbenannt am 2026-09-13.** Die Stufe hiess `Kann noch stehen`, und das
	 * las sich als Erlaubnis zu warten — gemeint ist der Anfang der Ernte, nicht
	 * ihr Aufschub. Der kurze Wortlaut ist nicht die Kurzform desselben Satzes,
	 * sondern so kurz, wie die Marke an einer Zeile sein musste: dort stand er
	 * neben Kultur und Ort in Grossbuchstaben, und `Langsam anfangen zu ernten`
	 * bräche die Zeile bei 375px. Seit dem 2026-10-26 ist er der Zwischentitel
	 * der Stufe im Beet.
	 */
	stehen: {
		titel: 'Langsam anfangen zu ernten',
		satz: 'Schon geniessbar, wächst aber ohne Qualitätsverlust weiter. Ernten nach Bedarf.',
		kurz: 'Langsam ernten',
	},
	/*
	 * Erscheint seit dem 2026-10-26 nirgends mehr in der Oberfläche (Zeilen auf
	 * `wachsen` stehen unter `Langsam ernten`, siehe `anzeigestufe`). Der
	 * Eintrag bleibt, weil der Typ jede gespeicherte Stufe abdeckt — und weil
	 * die actions `eintragen` und `umstufen` den Status über `istErntestatus`
	 * prüfen, das alle drei Werte aus ERNTESTATUS annimmt. Ein POST, der
	 * `wachsen` schickt, wird darum angenommen, gespeichert und mit einem Satz
	 * aus `titel` dieser Zeile beantwortet. Die actions daran anzupassen ist
	 * eine Änderung an den actions und laut Spec erst nach Rückfrage zu
	 * machen; sie ist nicht gemacht.
	 */
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
 * Das Wort fürs Abernten — eine Stelle für drei Leser auf /ernte: den Namen des
 * X an jeder Karte (`Abgeerntet Zucchini, Beet 3`), die Zeile der Legende, die
 * das X erklärt, und den bestätigenden Knopf der Rückfrage.
 *
 * Seit dem 2026-10-26 steht das Wort nicht mehr sichtbar an der Karte
 * (spec-ernte-nach-beet.md); ein vorgelesener Name und eine Legende, die
 * verschiedene Wörter für dieselbe Handlung trügen, liefen genau dort
 * auseinander, wo man nachschlägt.
 */
export const ABERNTEN_WORT = 'Abgeerntet';

/**
 * Die Beschriftung des Knopfs an einer langsamen Karte, der sie auf `sofort`
 * stuft. Kürzer als `ERNTETEXT.sofort.kurz`, weil der Knopf neben dem X in
 * einer einzeiligen Karte steht; vorgelesen wird er mit Kultur und Ort.
 */
export const SOFORT_KNOPF = 'Sofort';

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
 * Was im Feld `Beet oder Ort` steht, bevor jemand tippt.
 *
 * **Das Wort steht schon da, die Zahl kommt dazu** (Entscheid Manuel,
 * 2026-09-17). Fast jede Angabe in diesem Garten ist ein Beet mit einer
 * Nummer, und `Beet` einzutippen ist die Arbeit, die sich an jeder Meldung
 * wiederholt.
 *
 * Es ist eine **Vorgabe und kein Präfix**: das Feld bleibt ein gewöhnliches
 * Textfeld, und wer `Obstwiese` meldet, überschreibt es. Ein festes `Beet`
 * vor einem Zahlenfeld wäre der andere Weg gewesen und hätte genau diesen
 * Fall verloren — die Angabe ist freiwillig, gerade weil sie nicht immer ein
 * Beet ist.
 *
 * Das Leerzeichen am Ende gehört dazu: der Einfügepunkt steht danach, und
 * `Beet3` wäre die Meldung, die aus einer fehlenden Lücke entsteht. Seit dem
 * 2026-10-26 speichert `ortPruefen` auch diese als `Beet 3`; die Lücke bleibt
 * trotzdem, weil das Feld zeigen soll, was gespeichert wird.
 * `ortPruefen` faltet sie weg.
 */
export const ORT_VORGABE = 'Beet ';

/**
 * Prüft den Ort: **darf leer sein**, und leer heisst null.
 *
 * Das ist der ganze Unterschied zur Kultur daneben. Ein Beet anzugeben ist
 * freiwillig, weil die Angabe oft nichts hinzufügt — wer `Obstwiese` liest,
 * weiss es ohnehin, und ein Pflichtfeld hier wäre eine Hürde vor der Handlung,
 * die diese Seite ermöglichen soll.
 *
 * **Die unangetastete Vorgabe zählt als leer**, und das ist der Preis dafür,
 * dass sie überhaupt im Feld steht: wer nichts eingibt, schickt seit dem
 * 2026-09-17 nicht mehr die leere Zeichenkette, sondern `Beet `. Ohne diese
 * Zeile trüge jede Zeile ohne Ortsangabe den Ort `Beet` — eine Auskunft, die
 * nichts sagt und in der Liste aussieht wie eine, die etwas sagt.
 *
 * Verglichen wird gegen die **gefaltete** Vorgabe und nicht gegen das Literal:
 * das Leerzeichen am Ende überlebt die Faltung nicht, und ein Vergleich gegen
 * `ORT_VORGABE` selbst träfe darum nie zu.
 *
 * **Gespeichert wird die eine Schreibweise** (seit dem 2026-10-26,
 * spec-beet-schreibweise.md): nach dem Falten schreibt `ortVereinheitlichen`
 * (./beet.ts) `42`, `B42` und `beet 42` als `Beet 42`, damit eine Nummer auf
 * /ernte und /wellness genau ein Beet ist. Die Länge wird **danach** geprüft —
 * es zählt, was gespeichert würde. Ernte und Wellness rufen beide diese
 * Funktion und lesen damit dieselbe Regel.
 */
export function ortPruefen(eingabe: string): { ort: string | null } | { fehler: string } {
	const ort = ortVereinheitlichen(aufgabentextFalten(eingabe));
	if (ort === '' || ort === aufgabentextFalten(ORT_VORGABE)) return { ort: null };
	if ([...ort].length > ERNTE_HOECHSTLAENGE) return { fehler: ORT_ZU_LANG };
	return { ort };
}

/**
 * Die Stufen, unter denen eine Zeile auf /ernte **erscheinen** kann.
 *
 * Dieselben zwei wie SICHTBARE_ERNTESTATUS, und das ist kein Zufall, sondern
 * die Regel: was nicht wählbar ist, erscheint unter der nächsten wählbaren
 * Stufe dahinter. Ein eigener Typ, damit eine Zeile auf `wachsen` in der
 * Oberfläche gar nicht erst als dritte Stufe ankommt.
 */
export type Anzeigestufe = (typeof SICHTBARE_ERNTESTATUS)[number];

/**
 * Unter welcher Stufe eine Zeile erscheint: `wachsen` unter `stehen`.
 *
 * Entscheid Manuel vom 2026-10-26 (spec-ernte-nach-beet.md): `Noch wachsen
 * lassen` verschwindet aus Legende und Oberfläche. Die Zeilen, die vor dem
 * 2026-09-14 dort landeten, sind damit grün und tragen den Knopf `Sofort` —
 * nach vorn, wie jedes Umstufen.
 */
export function anzeigestufe(status: Erntestatus): Anzeigestufe {
	return status === 'wachsen' ? 'stehen' : status;
}

/**
 * Das Wort einer Stufe im Zähler am Kopf eines Beets: `2 sofort · 1 langsam`.
 *
 * Klein und kurz, weil es im Kopf eines zugeklappten Beets neben dem Namen
 * steht — und dort ist, was AD-14 schützt: man sieht ohne Aufklappen, wo etwas
 * sofort zu ernten ist.
 */
export const ZAEHLWORT: Record<Anzeigestufe, string> = {
	sofort: 'sofort',
	stehen: 'langsam',
};

/** Eine Stufe in einem Beet — ein Zwischentitel und seine Karten. */
export type Erntestufe<T> = { stufe: Anzeigestufe; zeilen: T[] };

/** Ein Beet auf /ernte — ein Abschnitt. */
export type Erntebeet<T> = {
	/** Der Ort, wie er gespeichert ist, als Schlüssel — eindeutig, auch für null. */
	schluessel: string;
	ort: string | null;
	/** Nur die Stufen mit Zeilen, in der Reihenfolge von SICHTBARE_ERNTESTATUS. */
	stufen: Erntestufe<T>[];
	/** Der Kopf des Beets: `{n} sofort · {m} langsam`, nur die vorhandenen Teile. */
	zaehler: string;
};

/**
 * Die Ernteliste gegliedert: **Beet > Stufe > Karte** (spec-ernte-nach-beet.md,
 * 2026-10-26). Wer im Garten steht, steht in einem Beet; die Liste nach
 * Dringlichkeit über den ganzen Garten musste nach dem eigenen Ort abgesucht
 * werden.
 *
 * - **Ein Beet je Ort, Zeichen für Zeichen.** Dass `42` und `Beet 42` dasselbe
 *   Beet sind, entscheidet nicht diese Funktion, sondern das Speichern:
 *   `ortPruefen` schreibt beide als `Beet 42`, und die Zeilen von vorher sind
 *   beim Start umgeschrieben (spec-beet-schreibweise.md). Gruppiert wird hier
 *   über eine Zuordnung mit dem gespeicherten Wert als Schlüssel und nicht über
 *   die Ordnung: `natuerlich` hält `Beet 03` und `Beet 3` für gleich, und eine
 *   Gruppierung über die Ordnung legte zwei Werte zusammen, die gespeichert
 *   verschieden sind.
 * - **Natürlich geordnet**, wie das Tagebuch auf /wellness (`leerZuletzt` aus
 *   ./beet.ts): `Beet 3` vor `Beet 12`, ohne Ort zuunterst. Bei Gleichstand
 *   (`Beet 03` gegen `Beet 3`) entscheidet der Zeichenvergleich, damit zwei
 *   Aufrufe dieselbe Reihenfolge liefern.
 * - **Innerhalb eines Beets** die Stufen in der Reihenfolge von
 *   SICHTBARE_ERNTESTATUS, `wachsen` unter `stehen` (`anzeigestufe`). Die
 *   Zeilen einer Stufe stehen in der Reihenfolge, in der sie hereinkommen — die
 *   Abfrage liefert sie nach Rang und dann jüngste zuerst; eine Zeile auf
 *   `wachsen` steht damit unter den Zeilen, die wirklich auf `stehen` stehen.
 *
 * Rein und ohne Datenbank, damit scripts/smoke-zugang.ts die I/O-Matrix der
 * Spec direkt daran prüfen kann.
 */
export function nachBeetGliedern<T extends { ort: string | null; status: Erntestatus }>(
	zeilen: readonly T[]
): Erntebeet<T>[] {
	const beete = new Map<string, { ort: string | null; zeilen: T[] }>();
	for (const zeile of zeilen) {
		const schluessel = JSON.stringify([zeile.ort]);
		const beet = beete.get(schluessel);
		if (beet === undefined) beete.set(schluessel, { ort: zeile.ort, zeilen: [zeile] });
		else beet.zeilen.push(zeile);
	}
	return [...beete.entries()]
		.sort(
			([schluesselA, a], [schluesselB, b]) =>
				leerZuletzt(a.ort, b.ort) ||
				(schluesselA < schluesselB ? -1 : schluesselA > schluesselB ? 1 : 0)
		)
		.map(([schluessel, beet]) => {
			const stufen = SICHTBARE_ERNTESTATUS.map((stufe) => ({
				stufe,
				zeilen: beet.zeilen.filter((zeile) => anzeigestufe(zeile.status) === stufe),
			})).filter((gruppe) => gruppe.zeilen.length > 0);
			return {
				schluessel,
				ort: beet.ort,
				stufen,
				zaehler: stufen
					.map((gruppe) => `${gruppe.zeilen.length} ${ZAEHLWORT[gruppe.stufe]}`)
					.join(' · '),
			};
		});
}
