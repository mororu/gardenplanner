#!/usr/bin/env node
/*
 * Kontrast, gerechnet statt abgeschrieben.
 *
 * **Was hier entschieden ist.** Zeile 7 der R5-Liste in `deferred-work.md`
 * verlangt Kontrast 4.5:1 für Text und 3:1 für Bedienelement-Umrisse, in beiden
 * Modi (NFR9). Getragen hat das bis heute eine Tabelle in DESIGN.md und ein
 * halbes Dutzend Zahlen in Kommentaren — alle von Hand gerechnet, keine
 * gemessen. Der Eintrag, der die Prüfung zurückstellte, nannte als Hindernis
 * eine fehlende **maschinenlesbare Aussage darüber, welche Paare zusammen
 * vorkommen**.
 *
 * Die Aussage gibt es seit dem 2026-08-31: **der gerenderte DOM ist sie**. Ein
 * kopfloser Chromium löst jedes Token auf, komponiert jede halbdurchsichtige
 * Fläche und sagt, welcher Vordergrund auf welchem Grund wirklich steht.
 * `smoke:sicht` liest das ab; dieses Modul rechnet.
 *
 * **Warum die Rechnung hier und nicht im Seitenkontext steht.** Der Messkopf
 * in der Seite gibt Zeichenketten zurück — `rgb(…)`, ein Stapel von
 * Hintergründen, eine Schriftgrösse. Alles Weitere ist Arithmetik, und
 * Arithmetik im Seitenkontext wäre die eine Stelle der Prüfkette, die niemand
 * gegen bekannte Werte halten kann. Hier ist sie ein reines Modul mit einem
 * eigenen Selbsttest (`npm run kontrast:selftest`) — dieselbe Bauform wie
 * `gate:selftest` und `db:check:selftest`.
 *
 * Frei von Projektimporten ausser dem Prüfkern, und der nur für den Selbsttest.
 */

/** Eine Farbe in sRGB, Kanäle 0–255, Deckung 0–1. */
export type Farbe = { r: number; g: number; b: number; a: number };

/**
 * Liest eine Farbe, wie ein Browser sie über `getComputedStyle` herausgibt.
 *
 * Chromium liefert heute `rgb(28, 34, 27)` und `rgba(0, 0, 0, 0)`; die
 * Schreibweise mit Leerzeichen und Schrägstrich (`rgb(28 34 27 / 0.5)`) ist
 * dieselbe Farbe in neuerer Notation und wird mitgelesen, damit ein Wechsel der
 * Chrome-Fassung diese Prüfkette nicht still auf `null` fallen lässt.
 * `transparent` ist die Kurzform von `rgba(0, 0, 0, 0)`.
 *
 * Alles andere gibt **null** und keine Ersatzfarbe: eine geratene Farbe wäre
 * eine Messung, die aussieht wie eine. Der Rufer macht daraus einen benannten
 * Befund.
 */
export function farbeLesen(text: string): Farbe | null {
	const wert = text.trim().toLowerCase();
	if (wert === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };

	const treffer = /^rgba?\(([^)]*)\)$/.exec(wert);
	if (treffer === null) return null;

	// Beide Schreibweisen: Kommas oder Leerzeichen, die Deckung hinter / oder Komma.
	const teile = treffer[1].split(/[\s,/]+/).filter((teil) => teil !== '');
	if (teile.length < 3 || teile.length > 4) return null;

	const zahlen = teile.map((teil) =>
		teil.endsWith('%') ? Number.parseFloat(teil) / 100 : Number.parseFloat(teil)
	);
	if (zahlen.some((zahl) => !Number.isFinite(zahl))) return null;

	const [r, g, b] = zahlen;
	const a = zahlen.length === 4 ? zahlen[3] : 1;
	if (r < 0 || g < 0 || b < 0 || r > 255 || g > 255 || b > 255 || a < 0 || a > 1) return null;
	return { r, g, b, a };
}

/**
 * Legt `vorne` über `hinten` — die Alpha-Komposition, die der Browser malt.
 *
 * Gerechnet wird ohne Rundung auf ganze Kanäle: ein halbdurchsichtiges Schwarz
 * auf Weiss ergibt 127.5 und nicht 128, und die Leuchtdichte rechnet ohnehin
 * in Gleitkomma weiter. Wer hier rundete, brächte einen Fehler von einem
 * Kanalschritt in jede zusammengesetzte Fläche.
 */
export function ueberlagern(vorne: Farbe, hinten: Farbe): Farbe {
	const a = vorne.a + hinten.a * (1 - vorne.a);
	if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
	const mischen = (v: number, h: number) => (v * vorne.a + h * hinten.a * (1 - vorne.a)) / a;
	return {
		r: mischen(vorne.r, hinten.r),
		g: mischen(vorne.g, hinten.g),
		b: mischen(vorne.b, hinten.b),
		a,
	};
}

/**
 * Die relative Leuchtdichte nach WCAG 2.
 *
 * Die Schwelle 0.03928 steht so in der veröffentlichten Formel. Rechnerisch
 * wäre 0.04045 der genaue Knick der Kurve, und der Unterschied betrifft
 * einzig Kanalwerte um 10 von 255 — er steht hier trotzdem in der
 * veröffentlichten Fassung, damit gerechnete Werte mit den Tabellen
 * vergleichbar bleiben, gegen die dieses Modul geprüft wird.
 *
 * Eine halbdurchsichtige Farbe hat keine Leuchtdichte: sie muss vorher über
 * ihren Grund gelegt werden. Der Wurf ist Absicht — ein stilles Weiterrechnen
 * mit einem Alpha, das niemand aufgelöst hat, ergäbe eine plausible falsche
 * Zahl.
 */
export function leuchtdichte(farbe: Farbe): number {
	if (farbe.a !== 1) {
		throw new Error(
			`Leuchtdichte einer halbdurchsichtigen Farbe (a=${farbe.a}) ist nicht bestimmt`
		);
	}
	const kanal = (wert: number) => {
		const anteil = wert / 255;
		return anteil <= 0.03928 ? anteil / 12.92 : ((anteil + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * kanal(farbe.r) + 0.7152 * kanal(farbe.g) + 0.0722 * kanal(farbe.b);
}

/**
 * Das Kontrastverhältnis zweier **deckender** Farben, immer ≥ 1.
 *
 * Die Reihenfolge ist gleichgültig; das Verhältnis ist symmetrisch. Wer eine
 * halbdurchsichtige Farbe hineingibt, bekommt den Wurf aus `leuchtdichte`.
 */
export function verhaeltnis(eine: Farbe, andere: Farbe): number {
	const a = leuchtdichte(eine);
	const b = leuchtdichte(andere);
	const hell = Math.max(a, b);
	const dunkel = Math.min(a, b);
	return (hell + 0.05) / (dunkel + 0.05);
}

/**
 * Der deckende Grund aus einem Stapel von Hintergründen — oder null.
 *
 * Der Stapel kommt aus der Seite und steht **von vorn nach hinten**: das
 * Element selbst zuerst, dann seine Vorfahren bis zur Wurzel. Gelegt wird von
 * hinten nach vorn, und sobald die Deckung 1 erreicht, ist der Rest des
 * Stapels ohne Wirkung.
 *
 * **null heisst: der Grund ist nicht bestimmt.** Das passiert, wenn kein
 * Vorfahre eine deckende Fläche hat — dann malt der Browser die Leinwand
 * darunter, und welche Farbe die hat, ist eine Aussage über den Browser und
 * nicht über diese Anwendung. `body` trägt `--surface-base` deckend, der Fall
 * tritt also nicht ein; er wird gemeldet und nicht geraten.
 */
export function grundAus(stapel: readonly string[]): Farbe | null {
	let ergebnis: Farbe = { r: 0, g: 0, b: 0, a: 0 };
	for (const text of [...stapel].reverse()) {
		const farbe = farbeLesen(text);
		if (farbe === null) return null;
		ergebnis = ueberlagern(farbe, ergebnis);
	}
	return ergebnis.a === 1 ? ergebnis : null;
}

/**
 * Die Schwelle für einen Text nach WCAG 1.4.3: 3:1 für **grosse** Schrift,
 * sonst 4.5:1.
 *
 * Grosse Schrift ist ab 24px, oder ab 18.66px bei Gewicht 700 und mehr. Die
 * Zahlen stehen so in der Richtlinie (18.66px ist 14pt, 24px ist 18pt) und
 * sind darum keine Wahl dieses Projekts. Gewicht wird gegen 700 gehalten und
 * nicht gegen `bold`: der berechnete Wert eines Browsers ist immer eine Zahl.
 */
export function textSchwelle(groessePx: number, gewicht: number): number {
	const gross = groessePx >= 24 || (groessePx >= 18.66 && gewicht >= 700);
	return gross ? 3 : 4.5;
}

/** Auf zwei Stellen, so wie Kontrastwerte überall in diesem Projekt stehen. */
export function gerundet(wert: number): number {
	return Math.round(wert * 100) / 100;
}

// ---------------------------------------------------------------------------
// Der Selbsttest. `npm run kontrast:selftest`
// ---------------------------------------------------------------------------
/*
 * **Warum dieses Modul einen eigenen Selbsttest hat.**
 *
 * Es ist der erste Prüfcode dieses Projekts, der *rechnet*. Alle anderen
 * vergleichen: eine Zeichenkette gegen ein Muster, eine Zahl gegen eine
 * Schwelle, ein Attribut gegen ein erwartetes Paar. Eine Rechnung kann
 * plausibel falsch sein — ein vertauschter Kanalfaktor, ein Gamma auf der
 * falschen Seite der Kurve, ein Alpha, das niemand auflöst —, und das Ergebnis
 * sieht dann aus wie ein Kontrastwert. Ein Prüfskript, das 4.9 statt 4.4
 * ausrechnet, ist schlimmer als keines: es meldet grün über eine gebrochene
 * Zusage.
 *
 * Geprüft wird gegen **zwei** Quellen, und die Trennung ist der Punkt:
 *
 *   - **Anker von aussen.** Schwarz auf Weiss ist 21:1, `#767676` auf Weiss ist
 *     4.54:1 — das steht in jeder Kontrasttabelle der Welt und stammt nicht aus
 *     diesem Projekt. Ohne diese drei Zeilen prüfte der Selbsttest die eigene
 *     Rechnung gegen die eigenen Zahlen.
 *   - **Die veröffentlichte Tabelle aus DESIGN.md**, zwanzig von Hand
 *     gerechnete Werte über zehn Paarungen in zwei Modi. Sie sind hier die
 *     Vorgabe, nicht das Ergebnis: stimmen sie, haben zwei voneinander
 *     unabhängige Rechnungen dasselbe herausbekommen.
 *
 * **Was diese Tabelle nicht behauptet.** Die Hexwerte darin stammen aus
 * DESIGN.md und nicht aus `src/app.html`. Der Selbsttest sagt also, dass die
 * *Dokumentation* rechnerisch stimmt — nicht, dass die Tokens im Quelltext
 * noch dieselben Werte tragen. Diese zweite Aussage macht der Sweep in
 * `smoke:sicht`, der die Tokens im Browser auflöst und jedes **gerenderte**
 * Paar gegen seine Schwelle hält. Wer ein Token ändert, ändert damit die
 * Tabelle in DESIGN.md — und diese Vorgabe hier bricht. Das ist dieselbe
 * gewollte Reibung wie `ERWARTETE_BEHAUPTUNGEN`.
 */

/** Die zwölf Paarungen der Tabelle „Kontrast, geprüft statt behauptet". */
const DOKUMENTIERT = [
	['Fliesstext auf Grund', 'ink', 'base', 14.74, 15.43],
	['Nebentext auf Grund', 'ink2', 'base', 4.71, 6.9],
	['Akzent als Text auf Karte', 'accent', 'raised', 6.37, 7.43],
	['Titelleistenschrift auf Akzent', 'accentInk', 'accent', 6.37, 8.34],
	['Überfällig auf Karte', 'overdue', 'raised', 5.46, 6.92],
	['Unbesetzt auf Karte', 'warn', 'raised', 5.63, 8.7],
	['Unbesetzt auf Grund', 'warn', 'base', 5.11, 9.58],
	['Zerstörend auf Karte', 'danger', 'raised', 7.07, 6.48],
	['Zerstörend auf Grund', 'danger', 'base', 6.42, 7.13],
	/*
	 * **Zahlengleich mit „Nebentext auf Grund", und trotzdem eine eigene Zeile.**
	 * Seit Entscheid (a) vom 2026-09-11 trägt `--ink-secondary` zwei Rollen: den
	 * Nebentext und den Umriss jedes Bedienelements, das nicht den Akzent nutzt.
	 * Die Tabelle in DESIGN.md führt beide, weil sie an verschiedenen Schwellen
	 * hängen — 4.5 für Text, 3.0 für den Umriss —, und diese Vorgabe bildet die
	 * Tabelle ab und nicht die Menge der verschiedenen Farbpaare. Wer die Zeile
	 * streicht, weil sie „doppelt" ist, entkoppelt Vorgabe und Tabelle.
	 */
	['Bedienelement-Umriss auf Grund', 'ink2', 'base', 4.71, 6.9],
	/*
	 * Die **engste** Paarung des Systems, und der Grund, warum --surface-open so
	 * hell ist: der Nebentext steht auf der getönten Karte bei 4.57:1 und damit
	 * nur knapp über der 4.5 aus NFR9. Eine Tönung eine Spur dunkler fällt durch —
	 * #eaf0e7 ergibt 4.48, gerechnet mit genau dieser Datei. Wer den Wert anfasst,
	 * rechnet zuerst diese Zeile.
	 */
	['Nebentext auf offener Karte', 'ink2', 'open', 4.57, 5.03],
	/*
	 * Die Haarlinie liegt **auf der Karte** — das ist nachgemessen und nicht
	 * abgelesen: DESIGN.md nennt die zwei Zahlen 1.38 und 1.30 ohne den Grund
	 * dazu, und auf `--surface-base` ergeben dieselben Tokens 1.25 (hell) und
	 * 1.44 (dunkel). Gemeint ist also die Linie in der Liste, und die liegt auf
	 * der Karte.
	 *
	 * **Seit dem 2026-09-11 ist das ihre einzige Rolle.** Vorher trug sie auch den
	 * Umriss von fünf Bedienelementen und verfehlte dort die 3:1 aus NFR9;
	 * Entscheid (a) hat die auf `--ink-secondary` gehoben. Die 1.38 bleibt damit
	 * richtig und ist kein offener Befund mehr — eine Trennlinie muss die Schwelle
	 * nicht erreichen.
	 */
	['Haarlinie auf Karte', 'hair', 'raised', 1.38, 1.3],
] as const;

/** Die Tokenwerte, wie DESIGN.md sie ausschreibt. */
const HELL = {
	base: '#f5f4ef',
	raised: '#ffffff',
	ink: '#1c221b',
	ink2: '#66705f',
	hair: '#dcdcd2',
	open: '#edf2ea',
	accent: '#2f6b3f',
	accentInk: '#ffffff',
	overdue: '#9a5a12',
	warn: '#a05300',
	danger: '#a32e22',
} as const;
const DUNKEL = {
	base: '#12160f',
	raised: '#1a2018',
	ink: '#e9ede4',
	ink2: '#98a292',
	hair: '#2c3529',
	open: '#243324',
	accent: '#7fbb8c',
	accentInk: '#0e1410',
	overdue: '#d99b4e',
	warn: '#ffa857',
	danger: '#e8877b',
} as const;

/** Ein Hexwert als Farbe — nur für die Vorgaben dieses Selbsttests. */
function hex(wert: string): Farbe {
	const ziffern = wert.replace('#', '');
	return {
		r: Number.parseInt(ziffern.slice(0, 2), 16),
		g: Number.parseInt(ziffern.slice(2, 4), 16),
		b: Number.parseInt(ziffern.slice(4, 6), 16),
		a: 1,
	};
}

if (process.argv.includes('--selftest')) {
	const { pruefen, pruefenGleich, unerwarteterWurf, zaehlerstand } =
		await import('./pruefhelfer.ts');
	/** Wer eine Behauptung hinzufügt oder entfernt, zieht die Zahl mit. */
	const ERWARTETE_BEHAUPTUNGEN = 23;

	try {
		// ----- Anker von aussen -----
		pruefenGleich(
			'Schwarz auf Weiss ist 21:1',
			gerundet(verhaeltnis(hex('#000000'), hex('#ffffff'))),
			21
		);
		pruefenGleich(
			'Weiss auf Weiss ist 1:1 — der kleinste mögliche Wert',
			gerundet(verhaeltnis(hex('#ffffff'), hex('#ffffff'))),
			1
		);
		pruefenGleich(
			'#767676 auf Weiss ist 4.54:1 — das dunkelste Grau, das den Textboden noch hält',
			gerundet(verhaeltnis(hex('#767676'), hex('#ffffff'))),
			4.54
		);

		// ----- Die veröffentlichte Tabelle, Modus für Modus -----
		for (const [name, tokens, spalte] of [
			['im hellen Modus', HELL, 3],
			['im dunklen Modus', DUNKEL, 4],
		] as const) {
			const abweichungen = DOKUMENTIERT.filter(
				(zeile) =>
					gerundet(verhaeltnis(hex(tokens[zeile[1]]), hex(tokens[zeile[2]]))) !== zeile[spalte]
			).map(
				(zeile) =>
					`${zeile[0]}: gerechnet ${gerundet(
						verhaeltnis(hex(tokens[zeile[1]]), hex(tokens[zeile[2]]))
					)}, dokumentiert ${zeile[spalte]}`
			);
			pruefen(
				`alle ${DOKUMENTIERT.length} Paarungen aus DESIGN.md stimmen ${name}`,
				abweichungen.length === 0,
				abweichungen.join(' | ')
			);
		}

		// ----- Farben lesen -----
		pruefenGleich(
			'rgb(1, 2, 3) mit Kommas',
			JSON.stringify(farbeLesen('rgb(1, 2, 3)')),
			JSON.stringify({ r: 1, g: 2, b: 3, a: 1 })
		);
		pruefenGleich(
			'rgba(1, 2, 3, 0.5) mit Deckung',
			JSON.stringify(farbeLesen('rgba(1, 2, 3, 0.5)')),
			JSON.stringify({ r: 1, g: 2, b: 3, a: 0.5 })
		);
		pruefenGleich(
			'rgb(1 2 3 / 50%) in der neueren Schreibweise',
			JSON.stringify(farbeLesen('rgb(1 2 3 / 50%)')),
			JSON.stringify({ r: 1, g: 2, b: 3, a: 0.5 })
		);
		pruefenGleich(
			'transparent ist die Kurzform von rgba(0, 0, 0, 0)',
			JSON.stringify(farbeLesen('transparent')),
			JSON.stringify({ r: 0, g: 0, b: 0, a: 0 })
		);
		pruefenGleich(
			'ein Farbname ergibt null statt einer geratenen Farbe',
			farbeLesen('rebeccapurple'),
			null
		);
		pruefenGleich(
			'und ein Wert ausserhalb des Bereichs ebenso',
			farbeLesen('rgb(1, 2, 300)'),
			null
		);

		// ----- Überlagern -----
		pruefenGleich(
			'halbdurchsichtiges Schwarz auf Weiss ergibt 127.5 — ohne Rundung auf einen Kanalschritt',
			JSON.stringify(ueberlagern({ r: 0, g: 0, b: 0, a: 0.5 }, hex('#ffffff'))),
			JSON.stringify({ r: 127.5, g: 127.5, b: 127.5, a: 1 })
		);
		pruefen(
			'zwei halbdurchsichtige Flächen übereinander decken zu 75 Prozent',
			ueberlagern({ r: 0, g: 0, b: 0, a: 0.5 }, { r: 0, g: 0, b: 0, a: 0.5 }).a === 0.75,
			JSON.stringify(ueberlagern({ r: 0, g: 0, b: 0, a: 0.5 }, { r: 0, g: 0, b: 0, a: 0.5 }))
		);

		// ----- Der Grund aus einem Stapel -----
		pruefenGleich(
			'ein Stapel aus zwei durchsichtigen und einer deckenden Fläche ergibt die deckende',
			JSON.stringify(grundAus(['transparent', 'rgba(0, 0, 0, 0)', 'rgb(255, 255, 255)'])),
			JSON.stringify({ r: 255, g: 255, b: 255, a: 1 })
		);
		/*
		 * **Die Reihenfolge des Stapels ist die Aussage dieser Funktion**, und ohne
		 * diese Zeile prüfte sie niemand: mit einer durchsichtigen und einer
		 * deckenden Fläche kommt bei jeder Reihenfolge dasselbe heraus. Erst eine
		 * **halb** durchsichtige Fläche vorn trennt die beiden Richtungen — Rot auf
		 * Weiss ist ein rosa Grund, Weiss auf Rot ist Weiss.
		 */
		pruefenGleich(
			'ein halbdurchsichtiges Rot vor Weiss ergibt Rosa — der Stapel wird von hinten gelegt',
			JSON.stringify(grundAus(['rgba(255, 0, 0, 0.5)', 'rgb(255, 255, 255)'])),
			JSON.stringify({ r: 255, g: 127.5, b: 127.5, a: 1 })
		);
		pruefenGleich(
			'ein Stapel ohne deckende Fläche ergibt null — die Leinwand wird nicht geraten',
			grundAus(['transparent', 'rgba(0, 0, 0, 0)']),
			null
		);
		pruefenGleich(
			'und eine unlesbare Farbe im Stapel ebenso',
			grundAus(['rebeccapurple', 'rgb(255, 255, 255)']),
			null
		);

		// ----- Die Leuchtdichte einer halbdurchsichtigen Farbe ist nicht bestimmt -----
		let geworfen = '';
		try {
			leuchtdichte({ r: 0, g: 0, b: 0, a: 0.5 });
		} catch (fehler) {
			geworfen = fehler instanceof Error ? fehler.message : String(fehler);
		}
		pruefen(
			'die Leuchtdichte einer halbdurchsichtigen Farbe wirft, statt eine plausible Zahl zu liefern',
			geworfen.includes('halbdurchsichtigen'),
			`geworfen: ${JSON.stringify(geworfen)}`
		);

		// ----- Die Schwelle nach WCAG 1.4.3 -----
		pruefenGleich('16px bei Gewicht 400 verlangt 4.5:1', textSchwelle(16, 400), 4.5);
		pruefenGleich('24px verlangt nur noch 3:1 — grosse Schrift', textSchwelle(24, 400), 3);
		pruefenGleich('19px bei Gewicht 700 ebenso', textSchwelle(19, 700), 3);
		pruefenGleich('19px bei Gewicht 400 dagegen nicht', textSchwelle(19, 400), 4.5);

		pruefen(
			'das Verhältnis ist symmetrisch — die Reihenfolge der beiden Farben ist gleichgültig',
			verhaeltnis(hex('#2f6b3f'), hex('#ffffff')) === verhaeltnis(hex('#ffffff'), hex('#2f6b3f')),
			'die beiden Richtungen ergaben verschiedene Werte'
		);

		const abgelegt = zaehlerstand().gelaufen;
		pruefenGleich(
			`alle ${ERWARTETE_BEHAUPTUNGEN} Behauptungen sind gelaufen`,
			abgelegt,
			ERWARTETE_BEHAUPTUNGEN
		);
	} catch (fehler) {
		unerwarteterWurf('kontrast:selftest', fehler);
	}

	const stand = zaehlerstand();
	if (stand.gescheitert > 0) {
		console.error(
			`\nkontrast:selftest: ${stand.gescheitert} von ${stand.gelaufen} Behauptung(en) nicht erfüllt.`
		);
		process.exit(1);
	}
	console.log(
		`\nkontrast:selftest: ${stand.gelaufen} Behauptungen an der Kontrastrechnung belegt.`
	);
}
