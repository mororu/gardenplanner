/*
 * Wie Beete geordnet werden — **die eine Stelle für „Beet 3 vor Beet 12"**.
 *
 * Zwei Leser: das Tagebuch auf /wellness (`nachBeet` in ./wellness.ts) und die
 * Ernteliste auf /ernte (`nachBeetGliedern` in ./ernte.ts). Beide gliedern nach
 * demselben Garten, und zwei Fassungen der Ordnung liefen beim ersten
 * Nachbessern auseinander: dasselbe Beet stünde auf zwei Seiten an zwei
 * verschiedenen Stellen.
 *
 * Gezogen am 2026-10-26 aus ./wellness.ts (spec-ernte-nach-beet.md), wo beide
 * Funktionen privat standen. Das Modul hat keine Abhängigkeit, damit beide
 * Leser über nacktes Node ladbar bleiben (scripts/smoke-zugang.ts lädt sie so).
 */

/**
 * Vergleicht zwei freiwillige Angaben: null steht zuunterst, sonst natürlich.
 *
 * Gibt 0 zurück, wenn beide gleich sind — so lässt sich eine Sortierkette mit
 * `||` bauen, wie in `nachBeet` in ./wellness.ts.
 *
 * **Zeilen ohne Ort stehen zuunterst.** Sie gelten für den ganzen Garten und
 * gehören damit unter und nicht zwischen die Beete; oben stünden sie wie ein
 * Beet mit leerem Namen.
 */
export function leerZuletzt(a: string | null, b: string | null): number {
	if (a === b) return 0;
	if (a === null) return 1;
	if (b === null) return -1;
	return natuerlich(a, b);
}

/**
 * Vergleicht zwei Ortsangaben so, wie ein Mensch sie ordnen würde: `Beet 3` vor
 * `Beet 12`.
 *
 * Zerlegt wird in abwechselnde Ziffern- und Nicht-Ziffern-Stücke. Zwei
 * Ziffernstücke vergleichen sich als **Zahlen**, alles andere über
 * `localeCompare` mit `de-CH` (damit `Ö` neben `O` landet und nicht hinter
 * `Z`). Stücke unterschiedlicher Art fallen auf den Zeichenvergleich zurück —
 * `Beet 3` gegen `Beet A` hat keine natürliche Ordnung, nur eine festgelegte.
 *
 * **Gleich heisst hier nicht identisch:** `Beet 03` und `Beet 3` ergeben 0, weil
 * sich ihre Ziffern als Zahlen gleich sind. Wer nach dieser Ordnung gruppiert,
 * gruppiert darum über eine Zuordnung und nicht über „gleich wie die Zeile
 * davor" — siehe `buendeln` in ./wellness.ts.
 *
 * Sehr lange Ziffernfolgen (mehr als sechzehn Stellen) verlieren als Zahl an
 * Genauigkeit. Das ist benannt und in Kauf genommen: eine Beetnummer mit
 * siebzehn Stellen ist kein Ort, sondern ein Tippfehler, und zwei davon stehen
 * dann nebeneinander statt in einer bestimmten Reihenfolge.
 */
export function natuerlich(a: string, b: string): number {
	const teile = (wert: string): string[] => wert.match(/\d+|\D+/g) ?? [];
	const links = teile(a);
	const rechts = teile(b);
	for (let i = 0; i < Math.min(links.length, rechts.length); i += 1) {
		const l = links[i];
		const r = rechts[i];
		if (l === r) continue;
		const beideZahlen = /^\d/.test(l) && /^\d/.test(r);
		const vergleich = beideZahlen ? Number(l) - Number(r) : l.localeCompare(r, 'de-CH');
		if (vergleich !== 0) return vergleich;
	}
	return links.length - rechts.length;
}
