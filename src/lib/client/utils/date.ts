import { ZEITZONE } from '../../zeit.ts';

/*
 * Zeitangaben.
 *
 * Die einzige Stelle, die einen Zeitstempel in Text verwandelt. Zeitstempel
 * liegen als SQLite-Integer in Unix-Sekunden in der Datenbank; nirgends steht
 * ein ISO-String, nirgends reist ein Date-Objekt durch eine Load-Funktion.
 *
 * **Die Zeitzone steht fest, ist nicht die des Geräts — und steht seit Story
 * 2.1 nicht mehr hier.** Sie ist nach ../../zeit.ts gezogen, weil sie zwei
 * Nutzer hat: diese Formatierung und die Umrechnung eines Datumsfeldes in
 * Unix-Sekunden in src/routes/monatsplan/+page.server.ts. Zwei Deklarationen
 * derselben Zone liefen auseinander, und die Fälligkeit läge dann um Stunden
 * neben der Anzeige.
 *
 * Der Grund für den festen Wert bleibt derselbe: diese Datei wird aus einer
 * Komponente gerufen, die serverseitig gerendert **und** im Browser hydriert
 * wird. Ohne festen Wert formatierte der Server in UTC und das Telefon in der
 * Ortszeit: um 01:30 im Sommer ergäbe dasselbe Datum zwei verschiedene Tage,
 * und Svelte meldete einen Hydrierungsunterschied. Der Garten steht in der
 * Schweiz, also ist Europe/Zurich der richtige Wert und keine Annäherung.
 */

/**
 * Ein Datum in Alltagssprache: `27. August 2026`.
 *
 * Der Formatierer wird einmal gebaut und nicht je Aufruf: bei zwanzig Zeilen
 * sind das zwanzig Intl-Instanzen, und Intl.DateTimeFormat ist der teure Teil.
 */
const LANGES_DATUM = new Intl.DateTimeFormat('de-CH', {
	day: 'numeric',
	month: 'long',
	year: 'numeric',
	timeZone: ZEITZONE,
});

/**
 * @param unixSekunden Zeitstempel in Unix-**Sekunden**, so wie er in der
 *   Datenbank steht — nicht in Millisekunden.
 */
export function datumLang(unixSekunden: number): string {
	return LANGES_DATUM.format(new Date(unixSekunden * 1000));
}

/*
 * Der Tag und der Monat getrennt — für den Datumskasten an einer Zeile.
 *
 * **Zwei Felder und keine Zeichenkette**, weil die zwei im Kasten
 * untereinander stehen und verschieden gesetzt sind: die Zahl gross, der Monat
 * klein. Eine fertige Zeichenkette müsste die Komponente wieder zerlegen, und
 * die Zerlegung wäre eine zweite Datumsrechnung neben dieser hier.
 *
 * `Intl` mit derselben Zone wie das lange Datum darüber — ein Datum, das im
 * Kasten anders ausfiele als im Satz daneben, wäre schlimmer als gar keiner.
 */
const KURZES_DATUM = new Intl.DateTimeFormat('de-CH', {
	day: 'numeric',
	month: 'short',
	timeZone: ZEITZONE,
});

/** Tag und Monat eines Termins, getrennt für den Datumskasten. */
export function datumKasten(unixSekunden: number): { tag: string; monat: string } {
	const teile = KURZES_DATUM.formatToParts(new Date(unixSekunden * 1000));
	return {
		tag: teile.find((teil) => teil.type === 'day')?.value ?? '',
		monat: teile.find((teil) => teil.type === 'month')?.value ?? '',
	};
}

/*
 * Der Monat mit seinem Jahr — die Überschrift einer Archivgruppe.
 *
 * Derselbe Formatierer-einmal-bauen-Grund wie oben, und dieselbe Zone: ein
 * Abhaken am 1. Oktober um 00:30 gehört in die Gruppe `Oktober 2026` und nicht
 * in die des Vortags, wie es eine Rechnung in UTC ergäbe.
 *
 * **Das Jahr steht mit dabei, obwohl es im Archiv meist dasselbe ist.** Ohne
 * Jahr hiessen zwei Gruppen `September`, sobald der Garten ins zweite Jahr geht,
 * und die Zeichenkette taugte dann auch nicht mehr als Gruppenschlüssel — die
 * Komponente gruppiert über genau diesen Wert und legte zwei Septembers
 * zusammen.
 */
const MONAT_UND_JAHR = new Intl.DateTimeFormat('de-CH', {
	month: 'long',
	year: 'numeric',
	timeZone: ZEITZONE,
});

/**
 * Ein Monat in Alltagssprache: `September 2026`.
 *
 * @param unixSekunden Zeitstempel in Unix-**Sekunden**, so wie er in der
 *   Datenbank steht — nicht in Millisekunden.
 */
export function monatUndJahr(unixSekunden: number): string {
	return MONAT_UND_JAHR.format(new Date(unixSekunden * 1000));
}
