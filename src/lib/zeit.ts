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
