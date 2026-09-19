import { aufgabentextFalten } from './aufgabentext.ts';

/*
 * Was eine Wellnessbehandlung ist — **die eine Stelle**, an der das steht.
 *
 * Gemeint ist, womit die Pflanzen gestärkt werden: Brennnesseljauche giessen,
 * Schachtelhalmbrühe spritzen, Gesteinsmehl stäuben. Der Name ist Manuels
 * (2026-09-19) und bleibt bewusst das umgangssprachliche Wort — `Pflanzen
 * stärkung` wäre das Fachwort und stünde bei zwanzig Leuten mit sehr
 * unterschiedlicher Vertrautheit für nichts.
 *
 * **Das ist ein Tagebuch, und das ist der Bruch mit dem Erntestand.** In
 * harvests wird gelöscht, was abgeerntet ist, und die Begründung dort steht
 * ausgeschrieben: eine Zeile, die stehen bliebe, müsste aus jeder Ansicht
 * gefiltert werden. Hier ist es umgekehrt, und zwar nicht aus Sammellust,
 * sondern weil diese Mittel nur in Wiederholung wirken: Schachtelhalm wird
 * vorbeugend alle zehn bis vierzehn Tage gespritzt, Jauche alle zwei bis drei
 * Wochen gegossen. Ohne `wann zuletzt` lässt sich `wann wieder` nicht sagen —
 * die Vergangenheit **ist** hier die Aussage. Beim Erntestand ist sie wertlos.
 *
 * Das Modul liegt in src/lib/ und nicht unter client/ oder server/: beide
 * Seiten lesen es. Es hängt nur von ./aufgabentext.ts und ./ernte.ts ab, damit
 * ../routes/wellness/+page.server.ts es über nacktes Node laden kann
 * (scripts/smoke-zugang.ts tut genau das).
 */

/**
 * Die Mittel zum Antippen.
 *
 * Alphabetisch, weil die Liste gesucht und nicht gelesen wird — dieselbe
 * Bauform wie KULTUREN in ./ernte.ts und mit derselben Einschränkung: sie ist
 * **kein** abschliessender Katalog, sondern ein Vorschlag an einer
 * `<datalist>`. Wer etwas anderes ausbringt, tippt es hin, und gespeichert wird
 * darum Text und kein Schlüssel.
 *
 * Gemischt aus Selbstangesetztem und Gekauftem, und das mit Absicht: Manuel
 * setzt meistens selbst an, Schachtelhalm kommt auch mal aus der Flasche
 * (2026-09-19). Die Liste unterscheidet das nicht, weil die Zeile es nicht
 * unterscheidet — was zählt, ist, was auf die Pflanze kam.
 *
 * Stand vom 2026-09-19 und ausdrücklich vorläufig; sie wird angepasst, wenn der
 * Garten es sagt.
 */
export const MITTEL = [
	'Beinwelljauche',
	'Brennnessel-Kaltauszug',
	'Brennnesseljauche',
	'Effektive Mikroorganismen',
	'Gesteinsmehl',
	'Hornspäne',
	'Kompost',
	'Mulch',
	'Rainfarnbrühe',
	'Schachtelhalmbrühe',
	'Zwiebel-Knoblauch-Tee',
] as const;

/**
 * Die Kennung der `<datalist>`, die MITTEL im Markup ausgibt.
 *
 * Eine Liste an einem Textfeld und keine Auswahl daneben — die Begründung in
 * ganzer Länge steht an KULTURLISTE in ./ernte.ts und gilt hier unverändert:
 * zwei Felder für einen Wert, und `abweisen` trägt nur zwei Texte zurück.
 */
export const MITTELLISTE = 'mittel';

/**
 * Die Längengrenze für das Mittel, in **Codepoints**.
 *
 * 60 wie bei einer Kultur und aus demselben Grund: ein Mittel ist ein Name und
 * kein Satz. `Zwiebel-Knoblauch-Tee` braucht 21, das längste der Liste
 * (`Effektive Mikroorganismen`) 25.
 */
export const MITTEL_HOECHSTLAENGE = 60;

export const MITTEL_FEHLT = 'Schreib hin, womit behandelt wurde.';

export const MITTEL_ZU_LANG = `Das ist zu lang für ein Mittel. Höchstens ${MITTEL_HOECHSTLAENGE} Zeichen.`;

/**
 * Prüft das Mittel: gefaltet, nicht leer, nicht zu lang.
 *
 * Gefaltet mit aufgabentextFalten — dieselbe Kette wie bei einer Kultur, einem
 * Blatttitel und einem Aufgabensatz, und aus demselben Grund: erst die
 * unsichtbaren Zeichen weg, dann Leerraum zusammenziehen, dann trimmen.
 * Umgekehrt bliebe `\u200B \u200B` ein nichtleerer „Name".
 */
export function mittelPruefen(eingabe: string): { mittel: string } | { fehler: string } {
	const mittel = aufgabentextFalten(eingabe);
	if (mittel === '') return { fehler: MITTEL_FEHLT };
	// Nach Codepoints gezählt, nicht nach UTF-16-Einheiten — wie überall in
	// dieser Kette. [...mittel] zerlegt in Codepoints.
	if ([...mittel].length > MITTEL_HOECHSTLAENGE) return { fehler: MITTEL_ZU_LANG };
	return { mittel };
}

/**
 * Die Obergrenze der Wiederholung, in Tagen.
 *
 * Ein Jahr, und damit dieselbe Zahl wie FRIST_FENSTER_TAGE in ./zeit.ts —
 * ausgeschrieben und nicht von dort geholt, weil es eine andere Grösse ist:
 * dort die Spanne, die ein Datumsfeld anbietet, hier der Abstand zweier
 * Anwendungen. Dass beide 365 sind, ist Zufall und keine Beziehung.
 *
 * Wer eine Wiederholung über einem Jahr eintrüge, meinte etwas anderes als
 * „regelmässig" — und die Zeile schwiege danach, bis niemand mehr weiss, dass
 * sie existiert.
 */
export const INTERVALL_HOECHST = 365;

export const INTERVALL_UNGUELTIG = 'Die Wiederholung ist eine ganze Zahl in Tagen — oder leer.';

export const INTERVALL_ZU_GROSS = `Das ist zu selten für eine Wiederholung. Höchstens ${INTERVALL_HOECHST} Tage.`;

/**
 * Prüft die Wiederholung: **darf leer sein**, und leer heisst null.
 *
 * Das ist die Entscheidung vom 2026-09-19 (Manuel): das Intervall wird **beim
 * Erfassen angegeben** und steht nicht als Liste je Mittel im Code. Wer die
 * Zeile schreibt, weiss es besser als eine Liste — dieselbe Begründung, aus der
 * `laufend` bei harvests an der Zeile steht und nicht an der Kultur: nicht jede
 * Brennnesseljauche will denselben Abstand, und ein selbst getipptes Mittel
 * bekäme aus einer Liste im Code überhaupt keinen.
 *
 * Leer ist der ehrliche Normalfall und keine Nachlässigkeit: Kompost
 * auszubringen wiederholt sich nicht nach Tagen, sondern nach Jahreszeit. Eine
 * Zeile ohne Wiederholung steht darum nur im Tagebuch und mahnt nie.
 */
export function intervallPruefen(
	eingabe: string
): { intervallTage: number | null } | { fehler: string } {
	const gekuerzt = eingabe.trim();
	if (gekuerzt === '') return { intervallTage: null };
	// Nur Ziffern: ein `12.5` oder ein `-3` ist keine Anzahl Tage. Die Prüfung
	// steht vor Number(), weil Number('') und Number(' ') beide 0 ergeben.
	if (!/^[0-9]+$/.test(gekuerzt)) return { fehler: INTERVALL_UNGUELTIG };
	const tage = Number(gekuerzt);
	if (!Number.isSafeInteger(tage) || tage < 1) return { fehler: INTERVALL_UNGUELTIG };
	if (tage > INTERVALL_HOECHST) return { fehler: INTERVALL_ZU_GROSS };
	return { intervallTage: tage };
}

export const DATUM_UNGUELTIG = 'Wähle den Tag, an dem behandelt wurde.';

export const DATUM_AUSSERHALB = `Das liegt in der Zukunft oder mehr als ${INTERVALL_HOECHST} Tage zurück.`;

/**
 * Wie viele Tage es **noch** bis zur nächsten Anwendung sind — negativ, wenn
 * sie überfällig ist, und null, wenn die Zeile keine Wiederholung trägt.
 *
 * Gerechnet und nicht gespeichert, wie die Überfälligkeit einer Aufgabe: eine
 * Spalte `naechste_anwendung` wäre ein zweiter Wert für dieselbe Aussage und
 * liefe beim ersten Nachtragen eines Datums gegen die erste.
 *
 * @param tageZurueckliegend Was tageZurueck(angewendetAm, jetzt) liefert.
 * @param intervallTage Die Wiederholung der Zeile, oder null.
 */
export function tageBisWieder(
	tageZurueckliegend: number,
	intervallTage: number | null
): number | null {
	return intervallTage === null ? null : intervallTage - tageZurueckliegend;
}

/**
 * Steht eine Zeile wieder an?
 *
 * **Der Stichtag zählt mit** (`<= 0`): wer alle vierzehn Tage spritzt, ist am
 * vierzehnten Tag dran und nicht am fünfzehnten. Ein `< 0` liesse den Tag, den
 * die Person selbst gewählt hat, still verstreichen.
 *
 * Eine Zeile ohne Wiederholung steht nie an — sie ist Tagebuch und keine
 * Abmachung.
 */
export function istWiederDran(tageZurueckliegend: number, intervallTage: number | null): boolean {
	const offen = tageBisWieder(tageZurueckliegend, intervallTage);
	return offen !== null && offen <= 0;
}

/**
 * Das Wenige, das eine Zeile tragen muss, damit die Fälligkeit sie lesen kann.
 *
 * Absichtlich keine Kennung und kein Name: die Funktionen darunter wählen aus,
 * sie erzeugen nichts. Die Abfrageschicht liefert mehr, und das darf sie —
 * dieses Modul soll die Datenbank nicht kennen.
 */
export type Anwendung = {
	mittel: string;
	ort: string | null;
	angewendetAm: number;
	intervallTage: number | null;
};

/**
 * Eine Stelle ist ein **Mittel an einem Ort** — der Schlüssel, unter dem die
 * Wiederholung gezählt wird.
 *
 * Die Frage, die dahintersteht: wenn Beet 7 mit Schachtelhalm gespritzt wurde,
 * ist dann Beet 3 auch bedient? Nein — also zählt der Ort mit. Zwei Zeilen
 * `Schachtelhalmbrühe` ohne Ortsangabe sind hingegen dieselbe Stelle, und das
 * ist richtig so: wer keinen Ort nennt, meint den Garten.
 *
 * **Verglichen wird Zeichen für Zeichen.** `Brennnesseljauche` und
 * `brennnesseljauche` sind damit zwei Stellen, und `Beet 7` und `Beet7` auch.
 * Der Preis ist benannt und nicht versteckt: eine abweichende Schreibweise
 * lässt eine Behandlung doppelt anstehen. Dagegen hilft die Vorschlagsliste am
 * Feld, nicht eine Normalisierung hier — die müsste entscheiden, welche der
 * zwei Schreibweisen sie anzeigt, und läge bei `Beet 7` / `Beet sieben` ohnehin
 * daneben.
 */
function stelle(zeile: Anwendung): string {
	return JSON.stringify([zeile.mittel, zeile.ort]);
}

/**
 * Je Stelle die jüngste Anwendung — die Zeilen, aus denen sich beantwortet, was
 * wieder ansteht.
 *
 * **Setzt voraus, dass die Zeilen jüngste zuerst ankommen**, genau so, wie
 * behandlungenLesen sie ordnet (`angewendet_am` absteigend, dann `id`
 * absteigend). Die Funktion nimmt je Stelle schlicht die erste und vergleicht
 * keine Daten: der zweite Schlüssel der Ordnung ist es, der zwei Behandlungen
 * desselben Tages auseinanderhält, und den könnte sie hier nicht nachbilden,
 * ohne die Kennung zu kennen, die sie bewusst nicht sieht.
 *
 * Die Kopplung ist damit ausgeschrieben statt stillschweigend: wer die Ordnung
 * in ./server/db/queries/treatments.ts umdreht, kehrt hier die Auswahl um — und
 * die Seite zeigte dann die **älteste** Behandlung als die letzte.
 *
 * Die Reihenfolge der Rückgabe ist die der Eingabe, auf die ausgewählten Zeilen
 * eingedampft.
 */
export function letzteJeStelle<T extends Anwendung>(zeilenJuengsteZuerst: T[]): T[] {
	const gesehen = new Set<string>();
	return zeilenJuengsteZuerst.filter((zeile) => {
		const schluessel = stelle(zeile);
		if (gesehen.has(schluessel)) return false;
		gesehen.add(schluessel);
		return true;
	});
}
