/*
 * Die Zeitzone und die zwei Umrechnungen, die ein Datumsfeld braucht.
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
