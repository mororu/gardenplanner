import { aufgabentextFalten } from './aufgabentext.ts';
import { leerZuletzt } from './beet.ts';

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
 * Seiten lesen es. Es hängt nur von ./aufgabentext.ts und ./beet.ts ab, damit
 * ../routes/wellness/+page.server.ts es über nacktes Node laden kann
 * (scripts/smoke-zugang.ts tut genau das). Bis zum 2026-10-26 nannte dieser
 * Satz ./ernte.ts statt ./beet.ts — ein Import, den es nie gab.
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

export const KULTUR_ZU_LANG = `Das ist zu lang für eine Kultur. Höchstens ${MITTEL_HOECHSTLAENGE} Zeichen.`;

/**
 * Prüft die Kultur: **darf leer sein**, und leer heisst null.
 *
 * Das ist der Unterschied zu `kulturPruefen` auf /ernte, und er ist die ganze
 * Aussage des Feldes: dort ist die Kultur der Gegenstand der Meldung — ohne sie
 * gibt es nichts zu ernten —, hier ist sie eine Angabe über die Behandlung. Wer
 * ein abgeerntetes Beet mulcht, behandelt keine Kultur, und ein Pflichtfeld
 * zwänge ihn zu einer Erfindung, die danach als Tatsache dasteht.
 *
 * Dieselbe Grenze wie beim Mittel, und keine eigene Zahl: eine Kultur ist
 * derselbe Gegenstand wie ein Mittel — ein Name, kein Satz.
 *
 * Gefaltet mit aufgabentextFalten, wie alles in dieser Kette.
 */
export function kulturPruefen(eingabe: string): { kultur: string | null } | { fehler: string } {
	const kultur = aufgabentextFalten(eingabe);
	if (kultur === '') return { kultur: null };
	// Nach Codepoints gezählt, nicht nach UTF-16-Einheiten — wie überall hier.
	if ([...kultur].length > MITTEL_HOECHSTLAENGE) return { fehler: KULTUR_ZU_LANG };
	return { kultur };
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
	kultur: string | null;
	ort: string | null;
	angewendetAm: number;
	intervallTage: number | null;
	/**
	 * Die Kennung — **seit dem 2026-09-20 nötig, und das ist keine Bequemlichkeit.**
	 *
	 * `letzteJeStelle` wählte bis dahin die erste Zeile je Stelle und verliess
	 * sich darauf, dass die Abfrage jüngste zuerst liefert. Seit die Seite nach
	 * Beet ordnet, trägt diese Annahme nicht mehr: die Funktion vergleicht jetzt
	 * selbst, und bei zwei Behandlungen desselben Tages entscheidet die höhere
	 * Kennung. Ohne sie könnte sie den Gleichstand nicht auflösen.
	 */
	id: number;
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
 * **Die Kultur zählt seit dem 2026-09-20 mit**, und zwar aus derselben
 * Überlegung eine Stufe feiner: Schachtelhalm auf den Tomaten sagt nichts über
 * den Kohl daneben, auch wenn beide in Beet 7 stehen. Damit ist auch
 * ausgesprochen, was Manuel an jenem Tag verlangt hat — **pro Beet mehrere
 * verschiedene Behandlungen**: sie stehen nebeneinander, mahnen getrennt und
 * verdrängen einander nicht.
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
	return JSON.stringify([zeile.mittel, zeile.kultur, zeile.ort]);
}

/**
 * Je Stelle die jüngste Anwendung — die Zeilen, aus denen sich beantwortet, was
 * wieder ansteht.
 *
 * **Sie hängt seit dem 2026-09-20 nicht mehr an der Reihenfolge der Eingabe**,
 * und das ist eine zurückgenommene Entscheidung. Die erste Fassung nahm je
 * Stelle schlicht die erste Zeile und schrieb die Kopplung an die Abfrage
 * ausdrücklich hin: „Wer die Ordnung umdreht, kehrt hier die Auswahl um."
 *
 * Genau das stand an dem Tag an, an dem die Seite nach Beet ordnen sollte — und
 * eine Kopplung, die beim ersten Umsortieren zur Falle wird, ist keine gute
 * Kopplung, auch wenn sie ausgeschrieben war. Die Funktion vergleicht jetzt
 * selbst: der spätere Tag gewinnt, und bei zwei Behandlungen **desselben** Tages
 * die höhere Kennung. Das ist kein Randfall, sondern der Normalfall —
 * `angewendet_am` ist ein Tagesende und für alle Zeilen eines Tages derselbe
 * Wert.
 *
 * Die Reihenfolge der Rückgabe ist die der Eingabe, auf die ausgewählten Zeilen
 * eingedampft: wer nach Beet sortiert hereingibt, bekommt nach Beet sortiert
 * zurück.
 */
export function letzteJeStelle<T extends Anwendung>(zeilen: T[]): T[] {
	const juengste = new Map<string, T>();
	for (const zeile of zeilen) {
		const schluessel = stelle(zeile);
		const bisher = juengste.get(schluessel);
		if (
			bisher === undefined ||
			zeile.angewendetAm > bisher.angewendetAm ||
			(zeile.angewendetAm === bisher.angewendetAm && zeile.id > bisher.id)
		) {
			juengste.set(schluessel, zeile);
		}
	}
	const gewaehlt = new Set([...juengste.values()].map((zeile) => zeile.id));
	return zeilen.filter((zeile) => gewaehlt.has(zeile.id));
}

/**
 * Die Ordnung der Seite: **nach Beet** (Entscheid Manuel, 2026-09-20).
 *
 * Wer im Garten steht, steht in einem Beet und will wissen, was dort schon war
 * — nicht, was irgendwo zuletzt geschah. Die frühere Ordnung (jüngste zuerst)
 * beantwortete die Frage eines Tagebuchs, diese beantwortet die Frage eines
 * Menschen mit einer Giesskanne.
 *
 * **Natürlich und nicht alphabetisch**: `Beet 3` steht vor `Beet 12`. Eine
 * Zeichenkettensortierung stellte `Beet 12` davor, weil `1` vor `3` kommt, und
 * das ist bei vierzig durchnummerierten Beeten kein Schönheitsfehler, sondern
 * eine Liste, in der man sein Beet nicht findet. Zerlegt wird darum in Ziffern-
 * und Nicht-Ziffern-Stücke; Zahlen vergleichen sich als Zahlen, alles andere
 * über `localeCompare` mit `de-CH` (damit `Ö` neben `O` landet und nicht hinter
 * `Z`).
 *
 * **Zeilen ohne Ort stehen zuunterst.** Sie gelten für den ganzen Garten und
 * gehören damit unter und nicht zwischen die Beete; oben stünden sie wie ein
 * Beet mit leerem Namen.
 *
 * Innerhalb eines Beets: erst die Kultur (ohne Angabe zuunterst, aus demselben
 * Grund), dann der jüngste Tag, dann die höhere Kennung. Damit hat die Liste
 * eine feste Reihenfolge — ohne den letzten Schlüssel stünden zwei Behandlungen
 * desselben Tages zwischen zwei Aufrufen verschieden.
 *
 * **Die Ordnung steht hier und nicht in der Abfrage**, anders als beim
 * Erntestand. Sie ist eine Auslegung („Beet 3 vor Beet 12") und keine
 * Eigenschaft der Daten — dieselbe Begründung, aus der die Fälligkeit nicht in
 * SQL gefiltert wird. In SQL wäre sie ausserdem eine CASE-Kaskade über
 * Zeichenpositionen, die niemand mehr liest.
 */
export function nachBeet<T extends { kultur: string | null; ort: string | null } & Anwendung>(
	zeilen: T[]
): T[] {
	return [...zeilen].sort(
		(a, b) =>
			leerZuletzt(a.ort, b.ort) ||
			leerZuletzt(a.kultur, b.kultur) ||
			b.angewendetAm - a.angewendetAm ||
			b.id - a.id
	);
}

/*
 * `leerZuletzt` und `natuerlich` standen bis zum 2026-10-26 hier, privat. Seit
 * die Ernteliste ebenfalls nach Beet gliedert, liegen sie in ./beet.ts — eine
 * Stelle für „Beet 3 vor Beet 12" (spec-ernte-nach-beet.md).
 */

/** Ein Mittel an einer Kultur in einem Beet — eine Karte im Tagebuch. */
export type Mittelbuendel<T extends Anwendung> = {
	/** Mittel, Kultur und Ort, wie `stelle` sie bildet — eindeutig, als Schlüssel. */
	schluessel: string;
	mittel: string;
	/** Die jüngste Anwendung; aus ihr kommen Datum und Wiederholung der Karte. */
	letzte: T;
	/** Alle Anwendungen dieses Mittels hier, jüngste zuerst — ihre Zahl ist die Anzahl der Karte. */
	eintraege: T[];
};

/** Eine Kultur in einem Beet — ein Zwischentitel, kein Behälter. */
export type Kulturbuendel<T extends Anwendung> = {
	schluessel: string;
	kultur: string | null;
	mittel: Mittelbuendel<T>[];
};

/** Ein Beet — ein Abschnitt im Tagebuch. */
export type Beetbuendel<T extends Anwendung> = {
	schluessel: string;
	ort: string | null;
	kulturen: Kulturbuendel<T>[];
};

/**
 * Das Tagebuch gebündelt: **Beet > Kultur > Mittel** (Entscheid Manuel,
 * 2026-10-12). Je Mittel eine Karte mit der letzten Anwendung und der Anzahl;
 * die Einzeleinträge stehen darunter.
 *
 * Der Grund ist die Wiederholung selbst: Schachtelhalm alle 14 Tage ergibt bis
 * zum Herbst ein Dutzend Karten mit demselben Wort, und die Liste beantwortete
 * „was war in Beet 3?" erst nach dem Scrollen über alle.
 *
 * **Diese Funktion sortiert nicht selbst.** Sie legt `nachBeet` darüber und
 * bündelt in der Reihenfolge, in der die Zeilen von dort kommen — jede Gruppe
 * steht an der Stelle ihrer ersten Zeile. Daraus folgt alles, was die Seite
 * zusagt, ohne eine zweite Sortierlogik:
 *   - Beete und Kulturen stehen natürlich geordnet, ohne Ort bzw. ohne Kultur
 *     zuunterst — die Ordnung von `nachBeet`.
 *   - Innerhalb einer Kultur ordnet `nachBeet` nach Tag absteigend und dann
 *     nach Kennung absteigend. Die erste Zeile eines Mittels ist damit seine
 *     jüngste, und die Mittel stehen nach ihrer jüngsten Anwendung, die
 *     jüngste zuerst. Dieselbe Wahl wie in `letzteJeStelle`: der spätere Tag
 *     gewinnt, bei Gleichstand die höhere Kennung.
 *   - Die Einträge eines Mittels stehen jüngste zuerst.
 *
 * **Gebündelt wird Zeichen für Zeichen**, mit demselben Schlüssel wie `stelle`:
 * `Schachtelhalm` und `schachtelhalm` sind zwei Karten, und die Begründung
 * steht dort. Verglichen wird über eine Zuordnung und nicht über „gleich wie
 * die Zeile davor": `natuerlich` (./beet.ts) hält `Beet 03` und `Beet 3` für gleich, ihre
 * Zeilen können darum in `nachBeet` ineinander verschränkt stehen, und ein
 * Vergleich mit dem Vorgänger schnitte ein Beet dann in mehrere Stücke.
 */
export function buendeln<T extends Anwendung>(zeilen: T[]): Beetbuendel<T>[] {
	const beete = new Map<string, Beetbuendel<T>>();
	const kulturen = new Map<string, Kulturbuendel<T>>();
	const mittel = new Map<string, Mittelbuendel<T>>();
	for (const zeile of nachBeet(zeilen)) {
		const beetSchluessel = JSON.stringify([zeile.ort]);
		let beet = beete.get(beetSchluessel);
		if (beet === undefined) {
			beet = { schluessel: beetSchluessel, ort: zeile.ort, kulturen: [] };
			beete.set(beetSchluessel, beet);
		}
		const kulturSchluessel = JSON.stringify([zeile.ort, zeile.kultur]);
		let kultur = kulturen.get(kulturSchluessel);
		if (kultur === undefined) {
			kultur = { schluessel: kulturSchluessel, kultur: zeile.kultur, mittel: [] };
			kulturen.set(kulturSchluessel, kultur);
			beet.kulturen.push(kultur);
		}
		const mittelSchluessel = stelle(zeile);
		const buendel = mittel.get(mittelSchluessel);
		if (buendel === undefined) {
			const neu = {
				schluessel: mittelSchluessel,
				mittel: zeile.mittel,
				letzte: zeile,
				eintraege: [zeile],
			};
			mittel.set(mittelSchluessel, neu);
			kultur.mittel.push(neu);
		} else {
			buendel.eintraege.push(zeile);
		}
	}
	return [...beete.values()];
}

/**
 * Eine abgeschlossene Zeile, wie das Archiv sie braucht — der **eine** Typ
 * dafür: `abgeschlosseneBehandlungenLesen` in
 * src/lib/server/db/queries/treatments.ts liefert genau ihn.
 *
 * **Ohne Namen, ohne Wiederholung und ohne `createdAt`** (Spec, _Never_: den
 * Namen der eintragenden Person nicht ins Archiv, `intervallTage` und
 * `createdAt` nicht in die Archiv-Seitendaten). Was die Abfrage nicht liefert,
 * kann die load nicht weiterreichen — wer hier ein Feld ergänzt, öffnet diesen
 * Weg.
 */
export type AbgeschlosseneAnwendung = {
	id: number;
	mittel: string;
	kultur: string | null;
	ort: string | null;
	angewendetAm: number;
	abgeschlossenAm: number;
};

/** Ein Abschluss: eine Kultur in einem Beet, zu einem Zeitpunkt abgeschlossen. */
export type Abschluss = {
	/** Die kleinste Kennung darin — eindeutig, weil jede Zeile zu genau einem Abschluss gehört. */
	ersteId: number;
	ort: string | null;
	kultur: string | null;
	abgeschlossenAm: number;
	/** Je Mittel die Anzahl, das Mittel mit der jüngsten Anwendung zuerst. */
	mittel: { mittel: string; anzahl: number }[];
};

/**
 * Bündelt abgeschlossene Zeilen zu Abschlüssen — **je Ort, Kultur und
 * Zeitpunkt einer** (Entscheid Manuel, 2026-10-12).
 *
 * Der Zeitpunkt gehört in den Schlüssel: wer Tomaten in Beet 3 abschliesst
 * und im nächsten Jahr wieder, hat zwei Abschlüsse und im Archiv zwei Zeilen.
 * `kulturAbschliessen` sorgt dafür, dass zwei Abschlüsse derselben Kultur
 * nie denselben Zeitpunkt tragen.
 *
 * **Gezählt wird Zeichen für Zeichen**, wie in `stelle`: `Schachtelhalm` und
 * `schachtelhalm` sind zwei Mittel. Die Mittel stehen nach ihrer jüngsten
 * Anwendung, die jüngste zuerst, bei Gleichstand die höhere Kennung — dieselbe
 * Wahl wie in `letzteJeStelle`.
 *
 * **Diese Funktion verlässt sich auf keine Eingabeordnung**: sie vergleicht
 * selbst, aus dem Grund, der an `letzteJeStelle` steht. Die Abschlüsse kommen
 * jüngster zuerst zurück, bei Gleichstand die kleinere erste Kennung zuerst.
 */
export function abschluesseBuendeln(zeilen: AbgeschlosseneAnwendung[]): Abschluss[] {
	const gruppen = new Map<
		string,
		{
			abschluss: Abschluss;
			juengste: Map<string, { angewendetAm: number; id: number; anzahl: number }>;
		}
	>();
	for (const zeile of zeilen) {
		const schluessel = JSON.stringify([zeile.ort, zeile.kultur, zeile.abgeschlossenAm]);
		let gruppe = gruppen.get(schluessel);
		if (gruppe === undefined) {
			gruppe = {
				abschluss: {
					ersteId: zeile.id,
					ort: zeile.ort,
					kultur: zeile.kultur,
					abgeschlossenAm: zeile.abgeschlossenAm,
					mittel: [],
				},
				juengste: new Map(),
			};
			gruppen.set(schluessel, gruppe);
		}
		gruppe.abschluss.ersteId = Math.min(gruppe.abschluss.ersteId, zeile.id);
		const bisher = gruppe.juengste.get(zeile.mittel);
		if (bisher === undefined) {
			gruppe.juengste.set(zeile.mittel, {
				angewendetAm: zeile.angewendetAm,
				id: zeile.id,
				anzahl: 1,
			});
		} else {
			bisher.anzahl += 1;
			if (
				zeile.angewendetAm > bisher.angewendetAm ||
				(zeile.angewendetAm === bisher.angewendetAm && zeile.id > bisher.id)
			) {
				bisher.angewendetAm = zeile.angewendetAm;
				bisher.id = zeile.id;
			}
		}
	}
	return [...gruppen.values()]
		.map(({ abschluss, juengste }) => ({
			...abschluss,
			mittel: [...juengste.entries()]
				.sort(([, a], [, b]) => b.angewendetAm - a.angewendetAm || b.id - a.id)
				.map(([mittel, { anzahl }]) => ({ mittel, anzahl })),
		}))
		.sort((a, b) => b.abgeschlossenAm - a.abgeschlossenAm || a.ersteId - b.ersteId);
}
