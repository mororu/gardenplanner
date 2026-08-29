/*
 * Die Zeitzone, die zwei Umrechnungen, die ein Datumsfeld braucht, und die
 * Überfälligkeitsrechnung.
 *
 * **Die Schwelle der Überfälligkeit steht seit Story 2.2 ebenfalls hier**, ganz
 * unten, aus demselben Grund wie die Zone: an genau einer Stelle. Sie rechnet
 * ohne Zone — die Begründung dafür steht an wochenOffenSeit.
 *
 * **Die Zeitzone steht genau einmal, und zwar hier.** Sie stand bis Story 2.1 in
 * src/lib/client/utils/date.ts, dem einzigen Ort, der einen Zeitstempel in Text
 * verwandelt (AD-6). Mit dem Monatsplan bekommt sie einen zweiten Nutzer, der
 * gerade **nicht** formatiert: der Server rechnet ein `JJJJ-MM-TT` aus einem
 * Datumsfeld in Unix-Sekunden um und braucht dafür denselben Zonenversatz. Zwei
 * Deklarationen derselben Zone liefen auseinander, und die Fälligkeit läge dann
 * um Stunden neben der Anzeige.
 *
 * Das Modul liegt in src/lib/ und nicht in src/lib/client/ oder src/lib/server/:
 * es wird von beiden Seiten gelesen. Es hängt von nichts ab — kein SvelteKit,
 * keine Umgebung, keine Verbindung —, damit
 * src/routes/monatsplan/+page.server.ts es über nacktes Node laden kann
 * (scripts/smoke-zugang.ts tut genau das).
 */

/**
 * Der Garten steht in der Schweiz, also ist Europe/Zurich der richtige Wert und
 * keine Annäherung.
 *
 * **Zwei Nutzer.** `datumLang` in ./client/utils/date.ts formatiert damit, und
 * die zwei Funktionen darunter rechnen damit. Die Zone darf nicht die des
 * Geräts sein: die Formatierung läuft serverseitig **und** im Browser, und ohne
 * festen Wert formatierte der Server in UTC und das Telefon in der Ortszeit —
 * um 01:30 im Sommer ergäbe dasselbe Datum zwei verschiedene Tage, und Svelte
 * meldete einen Hydrierungsunterschied.
 */
export const ZEITZONE = 'Europe/Zurich';

/**
 * Die Bestandteile eines Zeitpunkts in der Zone, als Zahlen.
 *
 * `hourCycle: 'h23'` ist Pflicht und keine Kosmetik: ohne ihn liefert `de-CH`
 * für Mitternacht die Stunde `24`, und jede Rechnung damit läge einen Tag
 * daneben.
 *
 * Der Formatierer wird einmal gebaut und nicht je Aufruf — Intl.DateTimeFormat
 * ist der teure Teil.
 */
const TEILE = new Intl.DateTimeFormat('en-CA', {
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
	hour: '2-digit',
	minute: '2-digit',
	second: '2-digit',
	hourCycle: 'h23',
	timeZone: ZEITZONE,
});

type Teile = {
	jahr: number;
	monat: number;
	tag: number;
	stunde: number;
	minute: number;
	sekunde: number;
};

function teileInZone(unixSekunden: number): Teile {
	const teile = new Map<string, string>();
	for (const { type, value } of TEILE.formatToParts(new Date(unixSekunden * 1000))) {
		teile.set(type, value);
	}
	const zahl = (name: string): number => Number(teile.get(name) ?? '0');
	return {
		jahr: zahl('year'),
		monat: zahl('month'),
		tag: zahl('day'),
		stunde: zahl('hour'),
		minute: zahl('minute'),
		sekunde: zahl('second'),
	};
}

/** Zwei Stellen mit führender Null — für die Form `JJJJ-MM-TT`. */
function zweistellig(zahl: number): string {
	return zahl < 10 ? `0${zahl}` : String(zahl);
}

/**
 * Der letzte Tag des laufenden Monats als Feldwert `JJJJ-MM-TT`.
 *
 * Die Vorbelegung von `Fällig bis` auf /monatsplan: ein Monatsplan gilt bis zum
 * Monatsende, und das ist der Wert, den die planende Person in neun von zehn
 * Fällen ohnehin gewählt hätte.
 *
 * Der laufende Monat wird **in der Zone** bestimmt und nicht in UTC: am 31.
 * August um 00:30 Ortszeit ist es in UTC noch der 30. August, was hier zwar
 * denselben Monat ergäbe — aber am 1. eines Monats um 00:30 wäre es in UTC noch
 * der Vormonat, und die Vorbelegung zeigte auf ein Datum in der Vergangenheit.
 *
 * `Date.UTC(jahr, monat, 0)` ist der Tag **vor** dem Ersten des Folgemonats,
 * also der letzte des laufenden — `monat` ist hier schon eins-basiert, der
 * Konstruktor null-basiert, und die Verschiebung um eins ist genau der
 * Folgemonat. Schaltjahre rechnet das von selbst richtig.
 *
 * @param jetztSekunden Der Bezugszeitpunkt in Unix-**Sekunden**.
 */
export function monatsendeAlsFeldwert(jetztSekunden: number): string {
	const { jahr, monat } = teileInZone(jetztSekunden);
	const letzter = new Date(Date.UTC(jahr, monat, 0)).getUTCDate();
	return `${jahr}-${zweistellig(monat)}-${zweistellig(letzter)}`;
}

/** Die Form, die ein `<input type="date">` schickt. Nichts anderes wird gedeutet. */
const FELDWERT = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Das **Ende** des gewählten Tages in der Zone, in Unix-Sekunden — oder null,
 * wenn der Feldwert nicht taugt.
 *
 * `Fällig bis 31. August` heisst umgangssprachlich „bis der 31. vorbei ist".
 * Mitternacht UTC läge in der Schweizer Sommerzeit zwei Stunden **vor** dem
 * Beginn des gemeinten Tages, und eine am 31. erledigte Aufgabe wäre
 * zwischendurch überfällig gewesen. Darum 23:59:59 Ortszeit.
 *
 * **Warum eine Runde genügt.** Der Zonenversatz hängt selbst vom Zeitpunkt ab,
 * den man erst sucht — im allgemeinen Fall braucht das zwei Runden. Hier nicht:
 * die Schweizer Zeitumstellung liegt um 02:00 (Frühjahr) beziehungsweise 03:00
 * (Herbst) Ortszeit, nie um 23:59. Der Versatz an der ersten Schätzung und der
 * am gesuchten Zeitpunkt sind darum immer derselbe.
 *
 * Der Rückvergleich darunter ist trotzdem da, und er trägt zwei Lasten auf
 * einmal: er belegt die eine Runde **und** weist ein unmögliches Datum ab.
 * `Date.UTC(2026, 1, 31)` rollt still auf den 3. März weiter; erst der
 * Vergleich der Bestandteile macht daraus ein null. Ein `<input type="date">`
 * schickt so etwas nie, ein POST von Hand schon.
 */
export function tagesendeInUnixSekunden(feldwert: string): number | null {
	const treffer = FELDWERT.exec(feldwert);
	if (treffer === null) return null;
	const jahr = Number(treffer[1]);
	const monat = Number(treffer[2]);
	const tag = Number(treffer[3]);

	// Die Schätzung: derselbe Wandkalender-Zeitpunkt, gelesen als UTC.
	const annahme = Math.floor(Date.UTC(jahr, monat - 1, tag, 23, 59, 59) / 1000);
	if (!Number.isFinite(annahme)) return null;

	// Der Versatz: die Zonenbestandteile der Schätzung, wieder als UTC gelesen,
	// abzüglich der Schätzung selbst.
	const inZone = teileInZone(annahme);
	const alsUtc = Math.floor(
		Date.UTC(
			inZone.jahr,
			inZone.monat - 1,
			inZone.tag,
			inZone.stunde,
			inZone.minute,
			inZone.sekunde
		) / 1000
	);
	const zeitpunkt = annahme - (alsUtc - annahme);

	const geprueft = teileInZone(zeitpunkt);
	if (
		geprueft.jahr !== jahr ||
		geprueft.monat !== monat ||
		geprueft.tag !== tag ||
		geprueft.stunde !== 23 ||
		geprueft.minute !== 59 ||
		geprueft.sekunde !== 59
	) {
		return null;
	}
	return zeitpunkt;
}

/**
 * Eine Woche in Sekunden — die Einheit, in der die zweite Zeile einer
 * überfälligen Aufgabe zählt, und der Baustein der Schwelle darunter.
 *
 * Exportiert, weil scripts/smoke-zugang.ts die Zeilen der
 * Überfälligkeitsmatrix in Wochen und Tagen sät und die Zahl sonst dort ein
 * zweites Mal stünde. Aus demselben Grund wie bei der Schwelle: zwei
 * Deklarationen derselben Grösse laufen auseinander.
 */
export const WOCHE_SEKUNDEN = 7 * 24 * 60 * 60;

/**
 * Die Schwelle, ab der eine offene Aufgabe überfällig ist: drei Wochen.
 *
 * **Sie steht genau einmal, und zwar hier.** AD-8 nennt sie als 21 Tage, und
 * eine zweite 21 irgendwo — in der Abfrage, in der Komponente, in einem
 * Prüfskript — wäre eine zweite Wahrheit über dieselbe Produktentscheidung.
 *
 * Geschrieben als `3 * WOCHE_SEKUNDEN` und nicht als `21 * 24 * 60 * 60`, obwohl
 * beides dieselbe Zahl ist: die Schwelle **ist** ein Vielfaches der Einheit, in
 * der die Anzeige zählt, und diese Kopplung soll man sehen. Sie ist der Grund
 * dafür, dass der kleinste Rückgabewert von wochenOffenSeit 3 ist.
 *
 * **Was mitwandert, wenn jemand die Schwelle verschiebt.** Diese Zeile ist die
 * einzige Deklaration, aber nicht die einzige Stelle, die von ihrem Wert abhängt.
 * Fällt sie unter drei Wochen, wird der kleinste Rückgabewert 1 oder 0, und dann
 * kippen still mit:
 *
 *   - die Begründung an wochenOffenSeit, dass `seit N Wochen offen` keine
 *     Beugungsregel braucht — bei 1 heisst es `seit 1 Wochen offen`;
 *   - bei 0 zusätzlich die Aussage des Satzes selbst: `seit 0 Wochen offen` unter
 *     einer Aufgabe, die gerade überfällig geworden ist;
 *   - die literalen `3` in scripts/smoke-zugang.ts, in README.md und in der
 *     Spezifikation der Story.
 *
 * Ein `Math.max(3, …)` in wochenOffenSeit wäre der falsche Riegel: er behauptete
 * eine Zahl, die dann nicht stimmt. Wer die Schwelle verschiebt, entscheidet
 * über den Satz mit.
 *
 * Gelesen wird sie von wochenOffenSeit darunter und, ausführlich begründet, von
 * scripts/smoke-zugang.ts — dort sät sie die Matrixzeilen relativ zu sich selbst,
 * damit die Prüfliste nicht grün bleibt, wenn jemand sie hier verschiebt.
 */
export const UEBERFAELLIG_SEKUNDEN = 3 * WOCHE_SEKUNDEN;

/**
 * Wie viele **ganze Wochen** eine Aufgabe schon überfällig offen ist — oder
 * null, solange sie es nicht ist.
 *
 * Der **Zählbeginn** ist `COALESCE(due_at, created_at)` aus AD-8: die Frist
 * zählt ab Fälligkeit, ersatzweise ab Anlage. Diese Funktion sieht davon nur die
 * fertige Zahl; **welche** der beiden Spalten es war, entscheidet
 * offeneAufgabenAuflisten in ./server/db/queries/tasks.ts über `??`. Die Regel
 * ist damit zweigeteilt, und das ist Absicht: die Auswahl der Spalte gehört zur
 * Zeile, die Schwelle und die Wochenrechnung gehören hierher.
 *
 * „Zählbeginn" und „Bezugszeitpunkt" sind in diesem Projekt zwei verschiedene
 * Dinge und werden nicht vermischt: der Zählbeginn ist der Zeitpunkt, **ab** dem
 * gezählt wird (die Spalte), der Bezugszeitpunkt der, **bis** zu dem gezählt
 * wird (jetzt, siehe @param jetztSekunden).
 *
 * **Der Vergleich ist strikt.** Genau an der Schwelle ist eine Aufgabe noch
 * **nicht** überfällig — `>` und nicht `>=`. Eine Grenze, die in beide
 * Richtungen gelesen werden kann, wird beim nächsten Anfassen anders gelesen.
 *
 * **Der kleinste Rückgabewert ist 3**, solange UEBERFAELLIG_SEKUNDEN bei drei
 * Wochen steht. Eine Sekunde über der Schwelle liegt die Differenz bei 21 Tagen
 * und einer Sekunde, und `Math.floor(x / WOCHE_SEKUNDEN)` ergibt darauf 3. Ein
 * Singular kann also nicht auftreten, und `seit N Wochen offen` braucht keine
 * Beugungsregel — der Satz ist immer im Plural richtig. Diese Zusage hängt an
 * der Schwelle und nicht an dieser Funktion; die Liste dessen, was bei einer
 * Verschiebung mitwandert, steht an UEBERFAELLIG_SEKUNDEN.
 *
 * **Ohne Obergrenze und ohne Kappung.** Ein vertipptes Jahresfeld (`Fällig bis`
 * nimmt jedes formgültige Datum an) erzeugt `seit ~1900 Wochen offen`, und genau
 * diese absurde Zahl ist das Diagnosesignal. Eine Kappung auf `über einem Jahr`
 * liesse einen Stapel von 1990 aussehen wie einen, der 14 Monate liegt.
 *
 * **Warum hier keine Zonenrechnung steht, obwohl der Rest dieses Moduls eine
 * braucht.** monatsendeAlsFeldwert und tagesendeInUnixSekunden rechnen
 * Kalendertage in Zeitpunkte um, und dafür ist die Zone konstitutiv. Hier werden
 * zwei **Zeitpunkte** verglichen — eine Differenz in Sekunden hat keine Zone.
 *
 * Ganz folgenlos ist das nicht, und die Grenze der Aussage steht hier: `due_at`
 * ist ein Tagesende **in der Zone**, der Vergleich läuft aber auf absoluten
 * Sekunden. Liegen Zählbeginn und Bezugszeitpunkt auf verschiedenen Seiten einer
 * der **zwei** Schweizer Umstellungen im Jahr, ist die 21-Tage-Spanne in
 * Wandkalender-Stunden um eine Stunde kürzer oder länger, und die wirksame
 * Grenze wandert um genau diese Stunde. Betroffen ist damit ein Ein-Stunden-
 * Fenster zweimal im Jahr, in dem eine Aufgabe eine Stunde früher oder später
 * überfällig wird als der Wandkalender sagt — auf Wochenauflösung ändert das
 * kein angezeigtes Ergebnis nennenswert. Wer hier teileInZone hereinzieht, macht
 * die Rechnung komplizierter und schliesst ein Fenster, das niemand sieht.
 *
 * Eine **negative** Differenz braucht keinen Sonderfall: ein Monatsplan, dessen
 * Fälligkeit in der Zukunft liegt, fällt durch denselben Vergleich wie eine
 * Aufgabe von vorgestern.
 *
 * @param bezugSekunden Der **Zählbeginn** in Unix-Sekunden: `due_at` oder
 *   ersatzweise `created_at`.
 * @param jetztSekunden Der **Bezugszeitpunkt** in Unix-Sekunden. Er kommt als
 *   Parameter herein und nicht aus `Date.now()`: dieselbe Liste soll für alle
 *   Zeilen eines Ladevorgangs an derselben Uhr gemessen werden, und der Wert
 *   entsteht serverseitig in der load (siehe ../routes/+page.server.ts).
 */
export function wochenOffenSeit(bezugSekunden: number, jetztSekunden: number): number | null {
	const verstrichen = jetztSekunden - bezugSekunden;
	if (verstrichen <= UEBERFAELLIG_SEKUNDEN) return null;
	return Math.floor(verstrichen / WOCHE_SEKUNDEN);
}

/*
 * ---------------------------------------------------------------------------
 * Die ISO-Kalenderwoche. Neu mit Story 3.1.
 *
 * Sie steht hier und nicht in der Route oder der Komponente, aus demselben
 * Grund wie die Zone und die Schwelle darüber: eine zweite Wochenrechnung wäre
 * eine zweite Wahrheit über denselben Kalender. Der Dienstplan rechnet damit
 * das Fenster der nächsten drei Monate, die Startseite die laufende Woche, und
 * die Datenschicht speichert das Ergebnis als zwei Integer.
 *
 * **Warum ISO und nicht irgendeine Wochenzählung.** ISO 8601 legt beides fest,
 * was hier gebraucht wird: die Woche beginnt am Montag, und Woche 1 ist die
 * Woche mit dem ersten Donnerstag des Jahres. Ohne diese zweite Regel hätte der
 * Jahreswechsel zwei Antworten — der 1. Januar 2027 ist ein Freitag und gehört
 * zur Woche 53 des Jahres 2026. Genau darum reist das **ISO-Jahr** als eigene
 * Zahl mit und ist nicht das Kalenderjahr des Datums.
 *
 * **Gerechnet wird auf dem Wandkalender der Zone, nicht auf UTC.** Am Montag um
 * 00:30 Ortszeit ist es in UTC noch Sonntag, und die laufende Woche läge dann
 * eine daneben — der Diensthinweis auf / zeigte in der Nacht zum Montag noch
 * die Woche davor. teileInZone oben liefert die Bestandteile; von dort an
 * rechnet alles auf reinen Kalendertagen ohne Zeitanteil.
 * ---------------------------------------------------------------------------
 */

/** Ein Tag in Sekunden — der Baustein der Wochenrechnung. */
const TAG_SEKUNDEN = 24 * 60 * 60;

/** Ein Kalendertag ohne Zeitanteil, als Tageszahl seit dem 1.1.1970. */
function tageszahl(jahr: number, monat: number, tag: number): number {
	return Math.floor(Date.UTC(jahr, monat - 1, tag) / 1000 / TAG_SEKUNDEN);
}

/**
 * Der Wochentag nach ISO: Montag 1 bis Sonntag 7.
 *
 * `getUTCDay()` zählt Sonntag als 0; `((tag + 6) % 7) + 1` verschiebt das auf
 * die ISO-Zählung, ohne eine Fallunterscheidung für den Sonntag zu brauchen.
 */
function isoWochentag(tageszahl: number): number {
	return ((new Date(tageszahl * TAG_SEKUNDEN * 1000).getUTCDay() + 6) % 7) + 1;
}

/**
 * Ein Wochenschlüssel: ISO-Jahr und ISO-Woche. Genau das, was in `duty_weeks`
 * steht — und die zwei Zahlen, aus denen `wochenSchluessel` unten eine macht.
 */
export type Woche = { jahr: number; woche: number };

/**
 * Der Montag einer Woche als Tageszahl.
 *
 * Der Rückweg von einem beliebigen Tag zum Wochenanfang: `wochentag - 1` Tage
 * zurück. Für einen Montag ist das null, für einen Sonntag sechs.
 */
function montagVon(tageszahl: number): number {
	return tageszahl - (isoWochentag(tageszahl) - 1);
}

/**
 * Die ISO-Woche eines Kalendertags.
 *
 * **Der Donnerstag entscheidet.** ISO 8601 legt Woche 1 als die Woche mit dem
 * ersten Donnerstag des Jahres fest; gleichwertig: die Woche, die den 4. Januar
 * enthält. Der Donnerstag derselben Woche liegt darum immer im richtigen
 * ISO-Jahr, auch wenn der Montag noch im Dezember steht — und aus **seinem**
 * Kalenderjahr kommt das ISO-Jahr. Ohne diesen Umweg zählte der 31. Dezember
 * 2026 (ein Donnerstag) als Woche 53 von 2026 richtig, der 1. Januar 2027 (ein
 * Freitag derselben Woche) aber als Woche 1 von 2027 falsch.
 *
 * Die Wochennummer ist dann die Zahl der ganzen Wochen zwischen dem 4. Januar
 * jenes ISO-Jahres und diesem Donnerstag, plus eins.
 */
function isoWocheVonTageszahl(tag: number): Woche {
	// Der Donnerstag dieser Woche: Montag plus drei Tage.
	const donnerstag = montagVon(tag) + 3;
	const jahr = new Date(donnerstag * TAG_SEKUNDEN * 1000).getUTCFullYear();
	// Der 4. Januar liegt nach ISO immer in Woche 1 — der einzige Kalendertag,
	// von dem das ohne Fallunterscheidung gilt.
	const ersterDonnerstag = montagVon(tageszahl(jahr, 1, 4)) + 3;
	const woche = Math.round((donnerstag - ersterDonnerstag) / 7) + 1;
	return { jahr, woche };
}

/**
 * Die ISO-Woche, in der ein Zeitpunkt liegt — **in der Zone** gerechnet.
 *
 * @param unixSekunden Der Zeitpunkt in Unix-**Sekunden**. Er kommt als
 *   Parameter herein und nicht aus `Date.now()`, aus demselben Grund wie bei
 *   wochenOffenSeit: dieselbe Seite soll an derselben Uhr gemessen werden, und
 *   der Wert entsteht serverseitig in der load.
 */
export function isoWocheVon(unixSekunden: number): Woche {
	const { jahr, monat, tag } = teileInZone(unixSekunden);
	return isoWocheVonTageszahl(tageszahl(jahr, monat, tag));
}

/**
 * Die Zahl der Wochen in einem ISO-Jahr: 52 oder 53.
 *
 * Gebraucht wird sie nicht für die Anzeige, sondern als **Formprüfung** einer
 * von aussen hereingereichten Woche: `?woche=99` gibt es nicht. Die Antwort
 * steht im 28. Dezember — er liegt nach ISO immer in der letzten Woche des
 * Jahres, so wie der 4. Januar immer in der ersten.
 */
export function wochenImJahr(jahr: number): number {
	return isoWocheVonTageszahl(tageszahl(jahr, 12, 28)).woche;
}

/**
 * Der Montag einer ISO-Woche, als Unix-Sekunden auf **Mitternacht UTC** des
 * Kalendertags.
 *
 * Der Wert ist ein Kalendertag und kein Zeitpunkt in der Zone: gebraucht wird
 * er, um daraus wieder Tag und Monat zu lesen (siehe `wochendatum`). Eine
 * Zonenrechnung darauf wäre ein Zeitpunkt, den niemand meint.
 *
 * **Exportiert für scripts/smoke-zugang.ts**, und zwar aus demselben Grund wie
 * WOCHE_SEKUNDEN und UEBERFAELLIG_SEKUNDEN weiter oben: die Prüfliste behauptet
 * über das Wochenfenster, dass zwischen zwei aufeinanderfolgenden Wochen genau
 * sieben Tage liegen — die Zeile, die den Jahreswechsel wirklich prüft, weil die
 * Wochennummer dort von 53 auf 1 springt. Ohne diesen Export müsste das Skript
 * den Montag selbst rechnen, und das wäre die zweite Wochenrechnung, gegen die
 * dieses Modul steht. Keine Route und keine Komponente ruft sie.
 */
export function montagDerWoche({ jahr, woche }: Woche): number {
	const ersterDonnerstag = montagVon(tageszahl(jahr, 1, 4)) + 3;
	const donnerstag = ersterDonnerstag + (woche - 1) * 7;
	return (donnerstag - 3) * TAG_SEKUNDEN;
}

/**
 * Ist das ein Wochenschlüssel, den es im Kalender gibt?
 *
 * Die Schranke einer von aussen hereingereichten Woche — ein POST braucht kein
 * Formular. Sie prüft die **Form**, nicht die Zuständigkeit: ob die Woche im
 * angezeigten Fenster liegt, entscheidet die Route über `wochenfenster`.
 */
export function istWoche({ jahr, woche }: Woche): boolean {
	if (!Number.isSafeInteger(jahr) || !Number.isSafeInteger(woche)) return false;
	// Der Bereich fängt ein vertipptes oder böswilliges Jahr ab, bevor
	// tageszahl() daraus ein NaN macht.
	if (jahr < 1970 || jahr > 9999) return false;
	return woche >= 1 && woche <= wochenImJahr(jahr);
}

/**
 * Die Wochen der nächsten drei Monate, beginnend mit der laufenden.
 *
 * **Kalender-verankert und nicht auf 13 festgenagelt.** Drei Monate sind je
 * nach Startpunkt 13 oder 14 Wochen; eine feste Zahl wäre im Februar zu lang
 * und im Sommer zu kurz.
 *
 * **Gezählt wird ab dem Montag der laufenden Woche, nicht ab heute.** Das ist
 * der Unterschied zwischen einem Fenster, das an einem Sonntag fünfzehn Wochen
 * lang ist, und einem, das jeden Tag der Woche dieselbe Länge hat: die Grenze
 * hinge sonst am Wochentag des Aufrufs, und der Plan würde im Lauf einer Woche
 * um eine Zeile kürzer, ohne dass jemand etwas getan hätte. Gemessen, nicht
 * vermutet — ein Aufruf an einem Sonntag gab fünfzehn Wochen.
 *
 * Die Grenze ist derselbe Wochentag drei Monate später, und `Date.UTC` rollt
 * einen 31. Mai + 3 Monate still auf den 31. August weiter, was hier stimmt —
 * ein 30. November + 3 Monate landete auf dem 30. Februar und rollte auf den
 * 1. oder 2. März. Das verschiebt die Grenze um höchstens zwei Tage und damit
 * nie um mehr als eine Woche.
 *
 * Aufgenommen wird jede Woche, deren **Montag** auf oder vor der Grenze liegt.
 * Der Montag und nicht das Wochenende: sonst fiele eine Woche heraus, die
 * grösstenteils noch im Fenster liegt.
 *
 * @param jetztSekunden Der Bezugszeitpunkt in Unix-Sekunden.
 */
export function wochenfenster(jetztSekunden: number): Woche[] {
	const { jahr, monat, tag } = teileInZone(jetztSekunden);
	const start = montagVon(tageszahl(jahr, monat, tag));
	// Der Montag zurück in Kalenderbestandteile, um drei Monate daraufzurechnen.
	// Reine UTC-Arithmetik: `start` ist ein Kalendertag, kein Zeitpunkt.
	const alsTag = new Date(start * TAG_SEKUNDEN * 1000);
	const grenze = tageszahl(alsTag.getUTCFullYear(), alsTag.getUTCMonth() + 4, alsTag.getUTCDate());

	const wochen: Woche[] = [];
	for (let montag = start; montag <= grenze; montag += 7) {
		wochen.push(isoWocheVonTageszahl(montag));
	}
	return wochen;
}

/**
 * Zwei Zahlen als eine: `2026` und `36` werden `202636`.
 *
 * Der Grund ist eng und benannt: `abweisen` in ./server/abweisen.ts trägt die
 * abgewiesene Zeile als **eine** Zahl (`zeile: number | null`), weil auf
 * /verwaltung eine Mitglieds-Id dort steht. Eine Woche braucht zwei. Statt den
 * geteilten Typ für einen Sonderfall aufzuweiten, reist der Schlüssel gefaltet
 * — monoton, eindeutig und in der Komponente je Zeile mit demselben Ausdruck
 * vergleichbar.
 *
 * Die Faltung steht **hier** neben der Wochenrechnung und nicht in der Route:
 * die Komponente bildet denselben Schlüssel, und zwei Faltungen liefen
 * auseinander. Es gibt bewusst keine Umkehrfunktion — der Schlüssel dient dem
 * Vergleich, nie dem Rechnen.
 */
export function wochenSchluessel({ jahr, woche }: Woche): number {
	return jahr * 100 + woche;
}

/** Die Wochentage als Text, für das Wochendatum darunter. */
const WOCHENDATUM_TAG = new Intl.DateTimeFormat('de-CH', {
	day: 'numeric',
	month: 'long',
	timeZone: 'UTC',
});

/**
 * Die Woche in Alltagssprache: `31. August bis 6. September`.
 *
 * **`timeZone: 'UTC'` und nicht ZEITZONE**, anders als bei `datumLang` in
 * ./client/utils/date.ts: montagDerWoche liefert Mitternacht UTC eines
 * Kalendertags. In Europe/Zurich gelesen wäre das 01:00 oder 02:00 desselben
 * Tages — hier zufällig derselbe Tag, aber die Rechnung stimmte aus dem
 * falschen Grund. Der Wert **ist** ein Kalendertag, und UTC ist die Lesart, in
 * der er entstanden ist.
 *
 * Ohne Jahr — **und das trägt nur, weil die Wochenzeile es nennt.** Auf
 * /dienstplan steht das ISO-Jahr als eigene Angabe neben `KW n`; diese Funktion
 * darf es darum weglassen, ohne dass `28. Dezember bis 3. Januar` offenliesse,
 * welches Jahr gemeint ist. Die Begründung stand hier schon, bevor die Angabe
 * existierte, und war bis zur Review von Story 3.1 schlicht falsch: der Plan
 * nannte nirgends ein Jahr. Wer die Angabe aus der Wochenzeile nimmt, nimmt
 * diesem Absatz seinen Grund — `smoke:http` behauptet sie darum je Zeile.
 */
export function wochendatum(woche: Woche): string {
	const montag = montagDerWoche(woche);
	const sonntag = montag + 6 * TAG_SEKUNDEN;
	return `${WOCHENDATUM_TAG.format(new Date(montag * 1000))} bis ${WOCHENDATUM_TAG.format(
		new Date(sonntag * 1000)
	)}`;
}

/*
 * ---------------------------------------------------------------------------
 * Das Fenster, in dem eine Frist liegen darf.
 *
 * Entschieden am 2026-08-28 und bis dahin als Eintrag 31 zurückgestellt: `Fällig
 * bis` nahm jedes formgültige Datum an, und ein vertipptes Jahr legte bis zu
 * hundert sofort überfällige Aufgaben an, die keine Löschen-Aktion aufräumt.
 *
 * **Die Zahl steht hier**, neben ZEITZONE und UEBERFAELLIG_SEKUNDEN, weil sie
 * von derselben Art ist: eine Produktentscheidung über Zeit, die genau einmal
 * geschrieben gehört. Sie steht **unten** und nicht oben bei der Schwelle, weil
 * sie auf der Tagesarithmetik der Kalenderwoche aufsetzt — tageszahl und
 * montagVon stehen darüber, und eine zweite Tagesrechnung wäre genau die zweite
 * Wahrheit, gegen die dieses Modul steht.
 * ---------------------------------------------------------------------------
 */

/**
 * Wie weit eine Frist höchstens von heute entfernt liegen darf: ein Jahr in
 * **jede** Richtung, hart abgewiesen.
 *
 * **Warum ein Fenster und nicht „Vergangenheit abweisen".** Ein Monatsplan wird
 * auch dann nachgetragen, wenn der Monat schon halb vorbei ist; eine harte
 * Grenze bei heute bräche diesen legitimen Fall. Eine blosse Warnung wäre die
 * schlechteste Fassung — wegklickbar, auf der einzigen Handlung ohne
 * Rückgängig. Das Fenster tut beides nicht und fängt trotzdem jeden plausiblen
 * Vertipper: `1990`, `2016` und `2062` liegen alle draussen.
 *
 * **Symmetrisch, obwohl der Schaden es nicht ist.** Eine Frist ein Jahr zurück
 * legt bis zu PLAN_HOECHSTZAHL sofort überfällige Aufgaben an, eine ein Jahr
 * voraus ist bloss sinnlos. Zwei Grenzen mit zwei Sätzen wären der teurere Weg
 * zum selben Ergebnis; die Asymmetrie steht darum hier im Kommentar und nicht
 * im Code.
 *
 * **365 und nicht „ein Kalenderjahr".** Gezählt wird in Tagen, nicht in
 * Jahren: ein Schaltjahr verschöbe die Grenze um einen Tag, und dieser Tag
 * entscheidet über nichts. Die runde Zahl ist ehrlicher als eine Rechnung, die
 * Genauigkeit vortäuscht, wo keine gebraucht wird.
 *
 * Zwei Leser, und sie lesen dieselbe Zahl auf zwei Wegen: fristfenster darunter
 * macht daraus die zwei Feldwerte für `min`/`max` am Datumsfeld,
 * istImFristfenster die Prüfung in der action. Das Feld ist die Bequemlichkeit,
 * die action die Instanz — dasselbe Verhältnis wie `maxlength` zu
 * AUFGABE_HOECHSTLAENGE.
 */
export const FRIST_FENSTER_TAGE = 365;

/** Ein Kalendertag als Feldwert `JJJJ-MM-TT` — die Umkehrung von tageszahl. */
function feldwertVonTageszahl(tag: number): string {
	const datum = new Date(tag * TAG_SEKUNDEN * 1000);
	return `${datum.getUTCFullYear()}-${zweistellig(datum.getUTCMonth() + 1)}-${zweistellig(
		datum.getUTCDate()
	)}`;
}

/** Der Kalendertag, auf den ein Zeitpunkt **in der Zone** fällt. */
function tageszahlInZone(unixSekunden: number): number {
	const { jahr, monat, tag } = teileInZone(unixSekunden);
	return tageszahl(jahr, monat, tag);
}

/**
 * Die Grenzen des Fensters als Feldwerte — genau die zwei Zeichenketten, die
 * als `min` und `max` an das Datumsfeld gehen.
 *
 * Sie entstehen auf dem **Server** und nicht im Browser, aus demselben Grund
 * wie die Vorbelegung daneben: sonst rechnete der Server in UTC und das Gerät
 * in der Ortszeit, und am Monatsersten um 00:30 stünden zwei verschiedene
 * Grenzen im Feld.
 *
 * @param jetztSekunden Der Bezugszeitpunkt in Unix-Sekunden.
 */
export function fristfenster(jetztSekunden: number): { frueheste: string; spaeteste: string } {
	const heute = tageszahlInZone(jetztSekunden);
	return {
		frueheste: feldwertVonTageszahl(heute - FRIST_FENSTER_TAGE),
		spaeteste: feldwertVonTageszahl(heute + FRIST_FENSTER_TAGE),
	};
}

/**
 * Liegt eine Frist im Fenster?
 *
 * Gerechnet wird auf **Kalendertagen in der Zone** und nicht auf einer
 * Sekundendifferenz. Der Unterschied ist der Grund, warum diese Funktion neben
 * der Tagesarithmetik steht und nicht neben wochenOffenSeit: dort werden zwei
 * Zeitpunkte verglichen, und eine Differenz in Sekunden hat keine Zone. Hier
 * wird ein **Tag** mit einem **Tag** verglichen, und dieselbe Grenze soll den
 * ganzen Tag über an derselben Stelle liegen — eine Sekundenrechnung liesse die
 * Grenze im Lauf des Tages um Stunden wandern, weil `faelligAm` das Tagesende
 * ist und `jetzt` irgendwann davor liegt.
 *
 * Die Grenztage selbst liegen **drinnen**: `<=` und nicht `<`. Sie sind genau
 * die Tage, die `fristfenster` als `min` und `max` an das Feld schreibt, und
 * ein Datumsfeld lässt seine eigenen Grenzwerte zu. Eine strengere Prüfung als
 * das Feld wäre eine Abweisung dessen, was die Oberfläche gerade angeboten hat.
 *
 * @param faelligAmSekunden Die Frist als Tagesende in der Zone, wie
 *   tagesendeInUnixSekunden sie liefert.
 * @param jetztSekunden Der Bezugszeitpunkt in Unix-Sekunden.
 */
export function istImFristfenster(faelligAmSekunden: number, jetztSekunden: number): boolean {
	const abstand = Math.abs(tageszahlInZone(faelligAmSekunden) - tageszahlInZone(jetztSekunden));
	return abstand <= FRIST_FENSTER_TAGE;
}
