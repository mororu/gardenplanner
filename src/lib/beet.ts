/*
 * Wie Beete geordnet und geschrieben werden — **die eine Stelle für „Beet 3
 * vor Beet 12"** und, seit dem 2026-10-26, für „`42` ist `Beet 42`"
 * (`ortVereinheitlichen`, unten; ihre Leser stehen dort).
 *
 * Die Ordnung (`leerZuletzt`, `natuerlich`) hat zwei Leser: das Tagebuch auf
 * /wellness (`nachBeet` in ./wellness.ts) und die Ernteliste auf /ernte
 * (`nachBeetGliedern` in ./ernte.ts). Beide gliedern nach demselben Garten,
 * und zwei Fassungen der Ordnung liefen beim ersten Nachbessern auseinander:
 * dasselbe Beet stünde auf zwei Seiten an zwei verschiedenen Stellen. Die zwei
 * Funktionen sind am 2026-10-26 aus ./wellness.ts gezogen
 * (spec-ernte-nach-beet.md), wo sie privat standen.
 *
 * Das Modul hat keine Abhängigkeit, damit jeder Leser über nacktes Node
 * ladbar bleibt (scripts/smoke-zugang.ts lädt sie so).
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

/**
 * Bringt einen Ort in **die eine Schreibweise** — die eine Stelle der Regel
 * (spec-beet-schreibweise.md, Entscheide Manuel vom 26.10.2026).
 *
 * **Eine Nummer meint immer ein Beet.** `42`, `Beet 42`, `beet 42`, `Beet42`,
 * `B42`, `b 42` werden zu `Beet 42`; ein Doppelbeet `16/17` oder `16 / 17` zu
 * `Beet 16/17`. Eine Nummer darf einen Buchstaben tragen, der klein gesetzt
 * wird: `2a`, `B2a`, `beet 2A` werden zu `Beet 2a`. Führende Nullen fallen je
 * Teil weg (`03` → `Beet 3`, `00` → `Beet 0`), sonst blieben `Beet 3` und
 * `Beet 03` zwei Beete. Gross und Klein des Präfixes zählen nicht. Mehr als
 * ein Schrägstrich (`1/2/3`) ist kein Doppelbeet und bleibt, wie es steht.
 *
 * **Der Tunnel ohne Nummernregel:** steht am Anfang das Wort `TU` oder
 * `Tunnel`, in beliebiger Gross- und Kleinschreibung und gefolgt von nichts
 * oder einem Leerzeichen, wird es `Tunnel`; der Rest bleibt, wie er steht.
 * `TU`, `tunnel` → `Tunnel`; `TU 2`, `TUNNEL 2` → `Tunnel 2`. `Tunnelbeet`
 * und `TU2` sind keine solchen Wörter und bleiben.
 *
 * Jede andere Bezeichnung — `Sector C`, `XY` — bleibt Zeichen für Zeichen, auch
 * in Gross und Klein.
 *
 * Erwartet einen **gefalteten** Ort (`aufgabentextFalten`): Leerraum ist
 * zusammengezogen und getrimmt. Falten, leer und die Vorgabe `Beet` behandelt
 * `ortFassen` in ./ernte.ts, nicht diese Funktion. `ortFassen` ist ihr
 * einziger direkter Leser; über ihn lesen `ortPruefen` (Speichern auf /ernte
 * und /wellness), das Suchen einer Stelle auf /wellness (`stelleLesen`) und
 * die Umschreibung beim Start (`orteVereinheitlichen` in
 * ./server/db/index.ts). Eine Fassung in SQL gibt es mit Absicht nicht —
 * SQLite kennt keine Regex, und eine zweite Kopie liefe auseinander.
 */
export function ortVereinheitlichen(ort: string): string {
	const tunnel = /^(?:tu|tunnel)(?= |$)/i.exec(ort);
	if (tunnel !== null) return `Tunnel${ort.slice(tunnel[0].length)}`;
	const nummer = /^(?:beet|b)?\s*(\d+[a-z]?)(?:\s*\/\s*(\d+[a-z]?))?$/i.exec(ort);
	if (nummer === null) return ort;
	// Als Zeichenkette gekürzt und nicht über Number(): eine Ziffernfolge mit
	// mehr als sechzehn Stellen verlöre sonst Stellen.
	const teil = (roh: string): string => roh.replace(/^0+(?=\d)/, '').toLowerCase();
	const teile = [nummer[1], nummer[2]].filter((roh) => roh !== undefined).map(teil);
	return `Beet ${teile.join('/')}`;
}
