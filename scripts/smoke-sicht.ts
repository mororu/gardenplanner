#!/usr/bin/env node
/*
 * Stufe C: die vierte Prüfschicht. Was gerendert **herauskommt**, nicht was im
 * Quelltext steht.
 *
 * Die drei bestehenden Schichten lesen Regelköpfe (`gate`), Markup und
 * Routenausgänge (`smoke`) und Antworten eines echten Servers (`smoke:http`).
 * Keine liest einen Regel**körper** gegen sein gerendertes Ergebnis. Befund R1
 * der zweiten Retrospektive zu Epic 3 lag genau in dieser Lücke: `.einmal__stand`
 * verlor beim Zusammenlegen seinen Regelkörper, der Selektor blieb stehen und
 * klebte am nächsten Rumpf, der Satz wurde falsch gesetzt **ausgeliefert** — und
 * `npm run lint` lief grün, über 755 Behauptungen hinweg.
 *
 * Die Auslösebedingung für Stufe C, am 2026-08-28 neu gefasst, lautet: *sie
 * kommt, wenn eine Geometrie- oder Fokuszusage im Betrieb bricht*. Mit R1 ist
 * sie eingetreten.
 *
 * **Und sie kostet keine Abhängigkeit.** Drei Dokumente setzten voraus, Stufe C
 * hiesse Playwright und NFR13 fiele dem Sinn nach. Das stimmte nicht: Node
 * bringt seit 22 ein globales `WebSocket` mit, Chrome spricht CDP darüber, und
 * scripts/kopfbrowser.ts ist reines Node. NFR13 lautet präzisiert *keine fremde
 * Abhängigkeit für Prüfung* — der ist gehalten. Was dieser Weg **nicht** kann,
 * steht im Kopf von kopfbrowser.ts, allen voran: nur Chromium, keine Zusage über
 * iOS Safari.
 *
 * Aufruf: erst bauen, dann prüfen.
 *   npm run build && npm run smoke:sicht
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
	aufraeumen,
	pruefen,
	pruefenGleich,
	unerwarteterWurf,
	wegwerfVerzeichnis,
	zaehlerstand,
} from './pruefhelfer.ts';
import {
	bauPruefen,
	freierPort,
	holen,
	keksAus,
	saeen,
	serverBeenden,
	serverStarten,
	type Server,
} from './pruefserver.ts';
import { browserStarten, chromeFinden, type Browser } from './kopfbrowser.ts';
import { aufgabenStapelAnlegen } from '../src/lib/server/db/queries/tasks.ts';
import { blattAnlegen } from '../src/lib/server/db/queries/sheets.ts';

/**
 * So viele Behauptungen muss ein vollständiger Lauf ablegen, die Schlusszählung
 * selbst nicht mitgerechnet. Wer eine hinzufügt oder entfernt, zieht die Zahl
 * mit — dieselbe Reibung wie in `smoke` und `smoke:http`, und aus demselben
 * Grund: eine Behauptung, die unbemerkt übersprungen wird, fällt so auf.
 */
const ERWARTETE_BEHAUPTUNGEN = 38;

/** Der Viewport, für den dieses Projekt gestaltet ist. */
const BREITE = 375;
const HOEHE = 812;

/** Das Trefferfeld-Minimum aus dem Gestaltungsrahmen. */
const TREFFER_MINIMUM = 44;

/** Der Text der frischen Aufgabe, die dieses Skript neben die überfällige legt. */
const FRISCHER_TEXT = 'Beet 7 giessen';

/*
 * Zwei Blätter für die Oberflächen aus Story 4.1. Sie tragen genau die zwei
 * Zusagen, die deren *Manual checks* nennen und die niemand abgehakt hat:
 * erhaltene Absätze und ein sehr langes Wort, das umbrechen muss.
 *
 * Der Freitext des ersten trägt zwei Absätze mit einer Leerzeile dazwischen —
 * die Faltung in `blatttextFalten` lässt genau eine Leerzeile stehen, mehr
 * nicht, und diese Form ist es, die im Browser erhalten bleiben soll.
 */
const BLATT_ABSAETZE = {
	titel: 'Gute Nachbarn',
	text: 'Zwiebeln neben Karotten halten die Fliege fern.\n\nStarkzehrer nie zweimal ins selbe Beet.',
} as const;

/*
 * Zweihundert Zeichen ohne eine einzige Trennstelle. Genau die Länge, die die
 * Prüfliste der Story nennt; `BLATT_HOECHSTLAENGE` liegt bei 8000 und ist damit
 * nicht die Grenze, die hier zählt.
 */
const BLATT_LANGWORT = {
	titel: 'Ein Wort ohne Luft',
	text: 'a'.repeat(200),
} as const;

type Kasten = { links: number; oben: number; breite: number; hoehe: number };
type Rampe = { schriftgroesse: string; zeilenhoehe: string; aussenabstand: string };

let server: Server | null = null;
let browser: Browser | null = null;

/*
 * Ein Abbruch von aussen (Strg-C, ein kill auf die lint-Kette) läuft nicht durch
 * das finally unten. Ohne diese Zeilen bliebe ein Node-Prozess auf dem Port, ein
 * Chrome ohne Fenster und zwei Wegwerfverzeichnisse stehen — derselbe Handgriff
 * wie in smoke-http.ts, und hier mit einem Prozess mehr.
 */
for (const zeichen of ['SIGINT', 'SIGTERM'] as const) {
	process.on(zeichen, () => {
		void browser?.schliessen();
		void serverBeenden(server);
		aufraeumen();
		process.exit(1);
	});
}

try {
	bauPruefen('smoke:sicht');

	/*
	 * Chrome muss da sein, und sein Fehlen ist eine **Behauptung** und keine
	 * stille Vorbedingung: ein Prüflauf, der sich selbst überspringt und grün
	 * meldet, ist genau der Zustand, gegen den dieses Werkzeug gebaut ist. Wer
	 * einen Chromium an einer eigenen Stelle hat, setzt CHROME_PFAD.
	 */
	const chrome = chromeFinden();
	pruefen(
		'ein Chrome oder Chromium ist auf dieser Maschine gefunden',
		chrome !== null,
		'keiner der bekannten Orte trägt eine ausführbare Datei — CHROME_PFAD setzen'
	);
	if (chrome === null) {
		console.error(
			'\nsmoke:sicht misst gerendertes Ergebnis und braucht dafür einen Browser.\n' +
				'Es bringt bewusst keinen mit — eine fremde Abhängigkeit für Prüfung wäre\n' +
				'ein Bruch von NFR13. Entweder Chrome installieren oder den Pfad nennen:\n' +
				'  CHROME_PFAD=/pfad/zu/chromium npm run smoke:sicht'
		);
		const stand = zaehlerstand();
		console.error(
			`\nsmoke:sicht: ${stand.gescheitert} von ${stand.gelaufen} Behauptung(en) nicht erfüllt.`
		);
		aufraeumen();
		process.exit(1);
	}

	const arbeit = wegwerfVerzeichnis('smoke-sicht-');
	const datenbankPfad = join(arbeit, 'sicht.sqlite');
	const profil = join(arbeit, 'chrome-profil');
	mkdirSync(profil, { recursive: true });
	process.env.DATABASE_PATH = datenbankPfad;

	const saat = saeen();
	/*
	 * Eine **frische** Aufgabe neben der überfälligen aus der geteilten Saat.
	 *
	 * Sie steht hier und nicht in `saeen()`: jene Saat ist mit smoke:http geteilt,
	 * und dort hängen Behauptungen daran, wie viele Zeilen `/` trägt. Eine zweite
	 * Zeile dort einzuziehen wäre eine Änderung an einem fremden Prüflauf.
	 *
	 * Gebraucht wird sie für die Zusage, die Story 2.2 aufgeworfen hat: eine
	 * überfällige Zeile ist **höher** als eine frische, weil `.zeile__spalte` zwei
	 * Kinder trägt — und das Trefferfeld muss trotzdem in **beiden** 44px
	 * erreichen, ohne die Zeilenhöhe aufzublähen. Ohne zwei Zeilen im selben
	 * Dokument ist das kein Vergleich, sondern eine Einzelmessung.
	 */
	aufgabenStapelAnlegen([FRISCHER_TEXT], Math.floor(Date.now() / 1000));
	const blattAbsaetze = blattAnlegen(BLATT_ABSAETZE.titel, BLATT_ABSAETZE.text);
	const blattLangwort = blattAnlegen(BLATT_LANGWORT.titel, BLATT_LANGWORT.text);

	const port = await freierPort();
	server = await serverStarten(port, datenbankPfad);

	// Eine Sitzung über den echten Einlösepfad, nicht über ein selbstgebautes
	// Cookie: ein von Hand signierter Keks wäre eine zweite Wahrheit über auth.ts.
	const eingeloest = await holen(port, `/i/${saat.mitgliedToken}`);
	const setzung = eingeloest.headers.getSetCookie()[0] ?? '';
	const keks = keksAus(setzung);
	pruefen(
		'der Einlösepfad hat eine Sitzung gestellt',
		eingeloest.status === 303 && keks !== 'sitzung=',
		`Status ${eingeloest.status}, Setzung ${JSON.stringify(setzung)}`
	);

	browser = await browserStarten(chrome, profil);

	/*
	 * Das Cookie in den Browser, und der Viewport auf 375px. `mobile: true` ist
	 * kein Beiwerk: es setzt die Meta-Viewport-Auswertung in Gang, und ohne das
	 * mässe der Lauf eine Desktopbreite mit einem schmalen Fenster — nicht
	 * dasselbe.
	 */
	await browser.senden('Network.setCookie', {
		name: 'sitzung',
		value: keks.slice('sitzung='.length),
		domain: '127.0.0.1',
		path: '/',
		httpOnly: true,
		sameSite: 'Lax',
	});
	await browser.senden('Emulation.setDeviceMetricsOverride', {
		width: BREITE,
		height: HOEHE,
		deviceScaleFactor: 2,
		mobile: true,
	});

	const adresse = `http://127.0.0.1:${port}`;
	await browser.besuchen(`${adresse}/`);

	/*
	 * Der Messkopf, einmal in die Seite gelegt. Er gibt **Zahlen und Zeichenketten**
	 * zurück, nie ein DOMRect: nur strukturklonbare Werte kommen über den Draht,
	 * und ein halb übertragenes Objekt wäre eine Messung, die aussieht wie eine.
	 */
	const KASTEN = (auswahl: string) => `
		const el = document.querySelector(${JSON.stringify(auswahl)});
		if (el === null) throw new Error('nicht im Dokument: ' + ${JSON.stringify(auswahl)});
		const r = el.getBoundingClientRect();
		return { links: r.left, oben: r.top, breite: r.width, hoehe: r.height };`;

	const RAMPE = (auswahl: string) => `
		const el = document.querySelector(${JSON.stringify(auswahl)});
		if (el === null) throw new Error('nicht im Dokument: ' + ${JSON.stringify(auswahl)});
		const s = getComputedStyle(el);
		return { schriftgroesse: s.fontSize, zeilenhoehe: s.lineHeight, aussenabstand: s.margin };`;

	const kasten = (auswahl: string) => browser!.auswerten<Kasten>(KASTEN(auswahl));
	const rampe = (auswahl: string) => browser!.auswerten<Rampe>(RAMPE(auswahl));

	// -----------------------------------------------------------------------
	// Die Seite trägt bei 375px überhaupt
	// -----------------------------------------------------------------------
	const breiten = await browser.auswerten<{ dokument: number; fenster: number }>(`
		return { dokument: document.documentElement.scrollWidth, fenster: window.innerWidth };`);
	pruefenGleich('der Viewport ist wirklich 375px breit', breiten.fenster, BREITE);
	pruefen(
		'und nichts scrollt waagerecht — das Dokument ist nicht breiter als das Fenster',
		breiten.dokument <= breiten.fenster,
		`Dokument ${breiten.dokument}px, Fenster ${breiten.fenster}px`
	);

	// -----------------------------------------------------------------------
	// Beide Zeilen sind da, und die überfällige ist die höhere
	// -----------------------------------------------------------------------
	const zeilenZahl = await browser.auswerten<number>(
		'return document.querySelectorAll(".zeile").length'
	);
	pruefenGleich('genau zwei Aufgabenzeilen stehen im Dokument', zeilenZahl, 2);

	/*
	 * **Eine stille Vorbedingung wird eine Behauptung.**
	 *
	 * Unten wird über `.zeile:nth-of-type(n)` gegriffen, und `nth-of-type` zählt
	 * unter Geschwistern **desselben Elementtyps** — nicht unter denen, die die
	 * Klasse tragen. Solange jedes `li` der Liste eine `.zeile` ist, sind die zwei
	 * Zählweisen gleich; ein `li` anderer Art in derselben Liste verschöbe die
	 * Indizes, und dieser Lauf mässe still die falsche Zeile. Genau die Klasse
	 * Fehler, die `smoke` als Reihenfolgefalle schon einmal getroffen hat.
	 *
	 * Der Selbstreview dieses Skripts hat nachgemessen, dass die Bedingung heute
	 * hält. Sie steht jetzt als Zeile da, statt vorausgesetzt zu werden.
	 */
	const nurZeilen = await browser.auswerten<boolean>(`
		const liste = document.querySelector('.liste');
		if (liste === null) throw new Error('keine .liste im Dokument');
		return [...liste.querySelectorAll(':scope > li')].every((li) => li.classList.contains('zeile'));`);
	pruefen(
		'jedes li der Liste ist eine .zeile — damit zählt nth-of-type dasselbe wie die Klasse',
		nurZeilen,
		'ein li anderer Art in der Liste verschiebt die Indizes dieser Prüfliste'
	);

	/*
	 * **Und die Schrift ist wirklich da.**
	 *
	 * Jede Messung unten ist Geometrie, und Geometrie hängt an der Schrift. Wäre
	 * die selbst gehostete Datei nicht geladen, mässe dieser Lauf den Umbruch
	 * einer Ersatzschrift — falsch, aber plausibel, und darum grün. Sie wiegt hier
	 * besonders, weil der Browser mit abgeschalteter Namensauflösung nach draussen
	 * fährt: eine Schrift aus einem CDN wäre zwangsläufig nicht da.
	 *
	 * **Welches Signal das trägt, ist gemessen und nicht geraten** — und die zwei
	 * naheliegenden tragen es nicht. Der erste Entwurf dieser Zeile las
	 * `document.fonts.status`, und die Mutation „alle Schrift-Adressen ins Leere
	 * zeigen lassen" blieb **grün**: jener Stand meldet `loaded`, sobald alle
	 * Ladevorgänge abgeschlossen sind — die gescheiterten eingeschlossen.
	 * `document.fonts.check()` meldet ebenso in beiden Fällen `true`. Ein
	 * Breitenvergleich auf einem Canvas weicht sogar in beiden Fällen ab, nur
	 * verschieden, und taugt darum auch nicht.
	 *
	 * Was trägt, ist die **Liste der FontFace-Einträge**: mit heiler Schrift stehen
	 * dort vier, mit kaputter keine. Gemessen am 2026-08-31 in beiden Zuständen.
	 */
	const schrift = await browser.auswerten<{ geladen: string[]; familie: string }>(`
		const el = document.querySelector('.zeile__aufgabe');
		if (el === null) throw new Error('keine .zeile__aufgabe im Dokument');
		return {
			geladen: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family),
			familie: getComputedStyle(el).fontFamily,
		};`);
	const ersteFamilie = schrift.familie.split(',')[0].replace(/["']/g, '').trim();
	pruefen(
		'die selbst gehostete Schrift ist wirklich geladen — die Geometrie unten ist keine Ersatzschrift',
		schrift.geladen.includes(ersteFamilie),
		`gesucht "${ersteFamilie}", geladen: ${schrift.geladen.join(', ') || '(keine)'}`
	);

	/*
	 * Welche Zeile welche ist, wird am **Text** entschieden und nicht an ihrer
	 * Stellung. Die Ordnung der Liste ist eine Zusage der Abfrageschicht und
	 * gehört nicht in diese Messung: hinge die Zuordnung an der Reihenfolge,
	 * würde diese Prüfliste bei einer geänderten Sortierung stillschweigend die
	 * falsche Zeile messen — genau die Falle, die `smoke` schon einmal getroffen
	 * hat (Reihenfolgefalle, deferred-work.md).
	 */
	const zeilenIndex = await browser.auswerten<{ frisch: number; ueberfaellig: number }>(`
		const zeilen = [...document.querySelectorAll('.zeile')];
		const finde = (text) => zeilen.findIndex((z) => z.textContent.includes(text));
		return { frisch: finde(${JSON.stringify(FRISCHER_TEXT)}),
		         ueberfaellig: finde(${JSON.stringify(saat.ueberfaelligText)}) };`);
	pruefen(
		'die frische und die überfällige Zeile sind je an ihrem Text gefunden',
		zeilenIndex.frisch >= 0 &&
			zeilenIndex.ueberfaellig >= 0 &&
			zeilenIndex.frisch !== zeilenIndex.ueberfaellig,
		JSON.stringify(zeilenIndex)
	);

	const frisch = await kasten(`.zeile:nth-of-type(${zeilenIndex.frisch + 1})`);
	const ueberfaellig = await kasten(`.zeile:nth-of-type(${zeilenIndex.ueberfaellig + 1})`);
	pruefen(
		'die überfällige Zeile ist höher als die frische — die zweite Textzeile hat Platz',
		ueberfaellig.hoehe > frisch.hoehe,
		`frisch ${frisch.hoehe}px, überfällig ${ueberfaellig.hoehe}px`
	);

	// -----------------------------------------------------------------------
	// Das Trefferfeld: 44px, in beiden Zeilenarten
	// -----------------------------------------------------------------------
	/*
	 * Die Zusage lautet „Trefferfeld ≥ 44px, **ohne die Zeilenhöhe
	 * aufzublähen**" — die negativen Aussenabstände an `.treffer`. Beide Hälften
	 * sind hier gemessen: die Grösse des Treffers und die Höhe der Zeile, die ihn
	 * trägt. Bis heute trug das allein die Handprüfung bei 375px.
	 */
	for (const [name, index] of [
		['die frische Zeile', zeilenIndex.frisch],
		['die überfällige Zeile', zeilenIndex.ueberfaellig],
	] as const) {
		const treffer = await kasten(`.zeile:nth-of-type(${index + 1}) .treffer`);
		pruefen(
			`${name} trägt ein Trefferfeld von mindestens ${TREFFER_MINIMUM}px in beiden Richtungen`,
			treffer.breite >= TREFFER_MINIMUM && treffer.hoehe >= TREFFER_MINIMUM,
			`${Math.round(treffer.breite)}x${Math.round(treffer.hoehe)}px`
		);
	}

	const trefferFrisch = await kasten(`.zeile:nth-of-type(${zeilenIndex.frisch + 1}) .treffer`);
	pruefen(
		'und der Treffer bläht die frische Zeile nicht auf — sie bleibt niedriger als er hoch ist plus ein Innenabstand',
		frisch.hoehe < trefferFrisch.hoehe * 2,
		`Zeile ${Math.round(frisch.hoehe)}px, Treffer ${Math.round(trefferFrisch.hoehe)}px`
	);

	/*
	 * Und das Kästchen bleibt am Anfang der **ersten** Textzeile
	 * (`align-items: flex-start` an `.zeile`). Gemessen an der überfälligen Zeile,
	 * weil nur dort zwei Textzeilen übereinander stehen: wäre die Ausrichtung auf
	 * `center` zurückgedreht, sässe das Kästchen zwischen den beiden Textzeilen.
	 * Die Schwelle ist die Mitte der Zeile — mehr braucht die Aussage nicht, und
	 * eine engere hinge an der Schrifthöhe.
	 */
	const kaestchen = await kasten(`.zeile:nth-of-type(${zeilenIndex.ueberfaellig + 1}) .kaestchen`);
	const kaestchenMitte = kaestchen.oben + kaestchen.hoehe / 2;
	const zeileMitte = ueberfaellig.oben + ueberfaellig.hoehe / 2;
	pruefen(
		'das Kästchen steht in der überfälligen Zeile über deren Mitte — am Anfang der ersten Textzeile',
		kaestchenMitte < zeileMitte,
		`Kästchen-Mitte ${Math.round(kaestchenMitte)}px, Zeilen-Mitte ${Math.round(zeileMitte)}px`
	);

	// -----------------------------------------------------------------------
	// Die R1-Klasse: ein Regelkörper erreicht sein gerendertes Ergebnis
	// -----------------------------------------------------------------------
	/*
	 * **Das ist der Befund, der Stufe C ausgelöst hat.**
	 *
	 * `.zeile__frist` ist ein `<p>` in einem Flexcontainer mit `gap` — dieselbe
	 * Gestalt wie `.einmal__stand`, das seinen Regelkörper verlor. Fällt der Rumpf
	 * weg, kommt die Vorgabe des Browsers zurück: `margin: 16px 0` und die
	 * Fliesstextgrösse. Beides ist hier gemessen, und zwar gegen eine **Sonde**,
	 * die die Tokens selbst auflöst, statt gegen abgeschriebene Zahlen. Eine
	 * geänderte Rampe bricht die Behauptung damit nicht; ein verlorener Rumpf
	 * schon.
	 */
	const soll = await browser.auswerten<Rampe>(`
		const sonde = document.createElement('p');
		sonde.style.cssText = 'position:absolute;visibility:hidden;margin:0;' +
			'font-family:var(--meta-font);font-size:var(--meta-size);' +
			'font-weight:var(--meta-weight);line-height:var(--meta-line)';
		document.body.appendChild(sonde);
		const s = getComputedStyle(sonde);
		const raus = { schriftgroesse: s.fontSize, zeilenhoehe: s.lineHeight, aussenabstand: s.margin };
		sonde.remove();
		return raus;`);
	const frist = await rampe(`.zeile:nth-of-type(${zeilenIndex.ueberfaellig + 1}) .zeile__frist`);
	pruefenGleich(
		'der Fristsatz trägt die meta-Schriftgrösse, wie sie das Token auflöst',
		frist.schriftgroesse,
		soll.schriftgroesse
	);
	pruefenGleich('und die meta-Zeilenhöhe', frist.zeilenhoehe, soll.zeilenhoehe);
	pruefenGleich(
		'und keinen Aussenabstand — die Vorgabe des Browsers für ein <p> ist zurückgedrängt',
		frist.aussenabstand,
		'0px'
	);

	/*
	 * Die Gegenrichtung: der Aufgabentext trägt die **task**-Rampe und nicht die
	 * meta. Ohne diese Zeile wäre die Prüfung oben auch dann grün, wenn beide
	 * Rampen zusammenfielen — und genau das war Befund R3, dieselbe Zeile in zwei
	 * Höhen. Hier gemessen statt am Quelltext gelesen.
	 */
	const aufgabentext = await rampe(`.zeile:nth-of-type(${zeilenIndex.frisch + 1}) .zeile__aufgabe`);
	pruefen(
		'der Aufgabentext ist grösser gesetzt als der Fristsatz — zwei Rampen, nicht eine',
		parseFloat(aufgabentext.schriftgroesse) > parseFloat(frist.schriftgroesse),
		`Aufgabe ${aufgabentext.schriftgroesse}, Frist ${frist.schriftgroesse}`
	);

	// -----------------------------------------------------------------------
	// Beide Erscheinungsbilder, gemessen statt angesehen
	// -----------------------------------------------------------------------
	/*
	 * „Geprüft in Hell **und** Dunkel" stand bis heute auf jeder Prüfliste und
	 * wurde von keiner ausgeführten Behauptung gedeckt. Der Vergleich ist absichtlich
	 * schwach — er sagt nicht, welche Farbe richtig ist, sondern dass der dunkle
	 * Block überhaupt wirkt. Ein Kontrastwert wäre die nächste Stufe und braucht
	 * eine Aussage darüber, welche Paare zusammen vorkommen; die steht nirgends in
	 * maschinenlesbarer Form (Retro Epic 1, B-Befund zum Gate).
	 */
	const grundfarbe = () =>
		browser!.auswerten<string>('return getComputedStyle(document.body).backgroundColor');

	await browser.senden('Emulation.setEmulatedMedia', {
		features: [{ name: 'prefers-color-scheme', value: 'light' }],
	});
	await browser.besuchen(`${adresse}/`);
	const hell = await grundfarbe();

	await browser.senden('Emulation.setEmulatedMedia', {
		features: [{ name: 'prefers-color-scheme', value: 'dark' }],
	});
	await browser.besuchen(`${adresse}/`);
	const dunkel = await grundfarbe();

	pruefen(
		'die Seite hat im hellen Modus überhaupt eine Grundfarbe',
		hell !== '' && hell !== 'rgba(0, 0, 0, 0)',
		`gemessen: ${JSON.stringify(hell)}`
	);
	pruefen(
		'und im dunklen eine andere — der Dunkel-Block wirkt wirklich',
		dunkel !== hell && dunkel !== 'rgba(0, 0, 0, 0)',
		`hell ${hell}, dunkel ${dunkel}`
	);

	// -----------------------------------------------------------------------
	// Die einzige Animation, und ihre Abschaltung
	// -----------------------------------------------------------------------
	/*
	 * Der Übergang am Kästchen ist in `no-preference` gekapselt — die Abwesenheit
	 * von Bewegung ist der Standardfall. Bis heute war das eine Textprüfung über
	 * den Quelltext; hier ist es gemessen, in beiden Richtungen.
	 */
	const dauer = () =>
		browser!.auswerten<string>(
			'return getComputedStyle(document.querySelector(".kaestchen")).transitionDuration'
		);

	await browser.senden('Emulation.setEmulatedMedia', {
		features: [
			{ name: 'prefers-color-scheme', value: 'light' },
			{ name: 'prefers-reduced-motion', value: 'no-preference' },
		],
	});
	await browser.besuchen(`${adresse}/`);
	const mitBewegung = await dauer();

	await browser.senden('Emulation.setEmulatedMedia', {
		features: [
			{ name: 'prefers-color-scheme', value: 'light' },
			{ name: 'prefers-reduced-motion', value: 'reduce' },
		],
	});
	await browser.besuchen(`${adresse}/`);
	const ohneBewegung = await dauer();

	pruefen(
		'bei no-preference trägt das Kästchen einen Übergang mit Dauer',
		parseFloat(mitBewegung) > 0,
		`gemessen: ${JSON.stringify(mitBewegung)}`
	);
	pruefenGleich(
		'und bei reduce keinen — die Bewegung ist die Ausnahme, nicht die Vorgabe',
		parseFloat(ohneBewegung),
		0
	);

	// -----------------------------------------------------------------------
	// Der Pfeil der Auswahl auf /dienstplan
	// -----------------------------------------------------------------------
	/*
	 * `select.feld { appearance: auto }` nimmt das `appearance: none` der
	 * Feldrolle zurück, damit die Auswahl ihren Pfeil behält — die einzige
	 * Anzeige, dass sich hier etwas aufklappt. Kein bestehendes Skript erreicht
	 * gerechnete Darstellung; der Posten steht in deferred-work.md ausdrücklich
	 * als „das wäre Stufe C".
	 *
	 * Gemessen wird als Mitglied ohne Adminrechte: die Auswahl steht nur der
	 * Verwaltung offen, und `/dienstplan` leitet ein Mitglied nicht weg — es sieht
	 * den Plan, nur ohne Formular. Die Behauptung sagt darum, was sie sehen kann:
	 * **wenn** eine Auswahl im Dokument steht, trägt sie ihren Pfeil.
	 */
	await browser.besuchen(`${adresse}/dienstplan`);
	const auswahl = await browser.auswerten<{ zahl: number; erscheinung: string | null }>(`
		const el = document.querySelector('select.feld');
		return { zahl: document.querySelectorAll('select.feld').length,
		         erscheinung: el === null ? null : getComputedStyle(el).appearance };`);
	pruefen(
		'auf /dienstplan trägt jede Auswahl ihren Pfeil, oder es steht keine im Dokument',
		auswahl.zahl === 0 || auswahl.erscheinung === 'auto',
		`${auswahl.zahl} Auswahl(en), appearance ${JSON.stringify(auswahl.erscheinung)}`
	);

	// -----------------------------------------------------------------------
	// Die zwei Oberflächen aus Story 4.1
	// -----------------------------------------------------------------------
	/*
	 * **Diese Prüfung löst eine Zusage ein, die nie abgehakt wurde.**
	 *
	 * Die Spec zu Story 4.1 verlangt unter *Manual checks*: `/wissen` und
	 * `/wissen/<id>` bei 375px in hellem **und** dunklem Erscheinungsbild,
	 * Trefferfelder ≥ 44px, kein waagerechtes Scrollen, erhaltene Absätze, und ein
	 * Blatt mit einem 200-Zeichen-Wort bricht um. Ihr Spec Change Log verzeichnet
	 * keine Durchführung — Zeile 8 der R5-Liste in `deferred-work.md`.
	 *
	 * Was hier gemessen wird, ist der maschinelle Teil davon. **Nicht** gemessen
	 * ist der Weg ohne JavaScript — den deckt `smoke:http` seit Story 4.1 mit
	 * eigenen Behauptungen — und nicht die Farbwirkung: die Tokens sind global,
	 * und dass der Dunkel-Block wirkt, steht oben schon. Was der dunkle Modus
	 * hier eigenständig tragen kann, ist die **Geometrie**: ein Token, das im
	 * Dunkeln eine andere Grösse hätte, brächte den Umbruch zum Kippen.
	 *
	 * Die Medienabfragen werden ausdrücklich gesetzt und nicht vom Vorgängerblock
	 * geerbt — dort steht `reduce`, und eine Messung, deren Zustand von der
	 * Reihenfolge der Blöcke abhängt, ist eine Messung, die man einmal umstellt
	 * und danach nicht mehr versteht.
	 */
	await browser.senden('Emulation.setEmulatedMedia', {
		features: [
			{ name: 'prefers-color-scheme', value: 'light' },
			{ name: 'prefers-reduced-motion', value: 'no-preference' },
		],
	});
	await browser.besuchen(`${adresse}/wissen`);

	/*
	 * **Gemessen wird gegen die 375 und nicht gegen `window.innerWidth`** — und
	 * das ist ein Fund aus der Mutationsprobe dieses Blocks, nicht Vorsicht auf
	 * Vorrat.
	 *
	 * Mit `mobile: true` wertet Chrome das Meta-Viewport aus, und läuft Inhalt
	 * über, **wächst der Layout-Viewport mit**: die Mutation „overflow-wrap
	 * entfernt" ergab ein Dokument von 1813px in einem Fenster von 1500px. Ein
	 * Vergleich `dokument <= fenster` prüft damit zwei Zahlen, die sich gemeinsam
	 * bewegen — er hat jene Mutation nur gefangen, weil die eine schneller wuchs
	 * als die andere. Gegen die feste Breite ist es eine Aussage, gegen
	 * `innerWidth` war es eine Hoffnung.
	 *
	 * Beide Hälften stehen in **einer** Behauptung: der Viewport ist noch 375, und
	 * nichts liegt darüber. Getrennt wären es zwei Zeilen, von denen eine ohne die
	 * andere nichts sagt.
	 */
	const breiteHalten = async (wo: string) => {
		const gemessen = await browser!.auswerten<{ dokument: number; fenster: number }>(`
			return { dokument: document.documentElement.scrollWidth, fenster: window.innerWidth };`);
		pruefen(
			`${wo} bleibt bei ${BREITE}px — der Viewport ist unverändert, und nichts läuft darüber`,
			gemessen.fenster === BREITE && gemessen.dokument <= BREITE,
			`Dokument ${gemessen.dokument}px, Fenster ${gemessen.fenster}px, erwartet beide ≤ ${BREITE}`
		);
	};

	await breiteHalten('/wissen');

	/*
	 * **Der Griff behält sein Dreieck — hier gemessen statt aus dem Quelltext
	 * gelesen.**
	 *
	 * Gate-Regel 15 verbietet ein `display` an der Klasse eines `<summary>` und
	 * benennt selbst, was sie nicht sehen kann: ein `display`, das ohne
	 * Klassennamen kommt (`summary { … }`, `details > summary`) oder geerbt wird.
	 * Der **berechnete** Wert kennt diese Lücke nicht — er ist das Ergebnis aller
	 * Wege zusammen. Die zwei Prüfungen ergänzen sich also und doppeln sich
	 * nicht: die Regel sagt, wo der Fehler herkam, diese Zeile, dass er nicht da
	 * ist.
	 */
	const griffe = await browser.auswerten<{ zahl: number; anzeige: string[]; hoehen: number[] }>(`
		const alle = [...document.querySelectorAll('summary.zeilenform__griff')];
		return {
			zahl: alle.length,
			anzeige: alle.map((el) => getComputedStyle(el).display),
			hoehen: alle.map((el) => el.getBoundingClientRect().height),
		};`);
	pruefen('/wissen trägt genau einen Aufklappgriff', griffe.zahl === 1, `${griffe.zahl} Griff(e)`);
	pruefen(
		'und er rendert als list-item — das Dreieck ist da, auf allen Wegen zugleich geprüft',
		griffe.anzeige.every((wert) => wert === 'list-item'),
		`gemessen: ${griffe.anzeige.join(', ')}`
	);
	pruefen(
		`und sein Trefferfeld ist mindestens ${TREFFER_MINIMUM}px hoch`,
		griffe.hoehen.every((hoehe) => hoehe >= TREFFER_MINIMUM),
		`gemessen: ${griffe.hoehen.map((h) => Math.round(h)).join(', ')}px`
	);

	/*
	 * Jeder Blattlink ist ein Trefferfeld. Er ist kein Knopf und sieht auch nicht
	 * wie einer aus — aber er ist die einzige Art, ein Blatt zu öffnen, und die
	 * 44px gelten für jedes Ziel und nicht nur für Knöpfe.
	 */
	const linkHoehen = await browser.auswerten<number[]>(`
		return [...document.querySelectorAll('.blattlink')].map((el) => el.getBoundingClientRect().height);`);
	pruefen(
		`beide Blattlinks tragen ein Trefferfeld von mindestens ${TREFFER_MINIMUM}px`,
		linkHoehen.length === 2 && linkHoehen.every((hoehe) => hoehe >= TREFFER_MINIMUM),
		`${linkHoehen.length} Link(s), Höhen ${linkHoehen.map((h) => Math.round(h)).join(', ')}px`
	);

	/*
	 * Und das Formular ist **zu**. `open={abgewiesen}` lässt es der Server
	 * entscheiden; ohne Abweisung gehört es geschlossen, sonst stünde die Liste
	 * unter einem aufgeklappten Formular, das niemand geöffnet hat.
	 */
	const formularZu = await browser.auswerten<boolean>(`
		const d = document.querySelector('details.zeilenform');
		if (d === null) throw new Error('kein details.zeilenform auf /wissen');
		return !d.open;`);
	pruefen(
		'und das Anlegen-Formular ist zu — es klappt nur nach einer Abweisung auf',
		formularZu,
		'das <details> stand offen, ohne dass eine Abweisung anstand'
	);

	// Auch im dunklen Erscheinungsbild darf nichts waagerecht laufen.
	await browser.senden('Emulation.setEmulatedMedia', {
		features: [{ name: 'prefers-color-scheme', value: 'dark' }],
	});
	await browser.besuchen(`${adresse}/wissen`);
	await breiteHalten('/wissen im dunklen Erscheinungsbild');

	await browser.senden('Emulation.setEmulatedMedia', {
		features: [{ name: 'prefers-color-scheme', value: 'light' }],
	});

	/*
	 * **Die Absätze bleiben, wie sie getippt wurden.**
	 *
	 * Das ist die einzige Formatierungszusage der Story. `smoke:http` prüft, dass
	 * `white-space: pre-wrap` im ausgelieferten Stilblatt steht; ob es **wirkt**,
	 * sieht es nicht. Gemessen wird darum gegen einen Klon derselben Zeile mit
	 * `white-space: normal`: bricht der Text an seinen Umbrüchen, ist er höher als
	 * derselbe Text ohne sie. Eine feste Zahl von Zeilenhöhen wäre die schwächere
	 * Fassung — sie hinge an der Schrift und an der Fensterbreite.
	 */
	await browser.besuchen(`${adresse}/wissen/${blattAbsaetze}`);
	const absaetze = await browser.auswerten<{ mit: number; ohne: number; regel: string }>(`
		const el = document.querySelector('.blatt__text');
		if (el === null) throw new Error('kein .blatt__text auf dem Blatt');
		const mit = el.getBoundingClientRect().height;
		const klon = el.cloneNode(true);
		klon.style.whiteSpace = 'normal';
		klon.style.position = 'absolute';
		klon.style.visibility = 'hidden';
		klon.style.width = getComputedStyle(el).width;
		el.parentNode.appendChild(klon);
		const ohne = klon.getBoundingClientRect().height;
		klon.remove();
		return { mit, ohne, regel: getComputedStyle(el).whiteSpace };`);
	pruefenGleich('der Freitext rendert mit pre-wrap', absaetze.regel, 'pre-wrap');
	pruefen(
		'und die Absätze bleiben wirklich erhalten — mit Umbrüchen höher als ohne',
		absaetze.mit > absaetze.ohne,
		`mit ${Math.round(absaetze.mit)}px, ohne ${Math.round(absaetze.ohne)}px`
	);

	const aendernGriff = await browser.auswerten<{ anzeige: string; hoehe: number }>(`
		const el = document.querySelector('summary.zeilenform__griff');
		if (el === null) throw new Error('kein Griff auf dem Blatt');
		const s = getComputedStyle(el);
		return { anzeige: s.display, hoehe: el.getBoundingClientRect().height };`);
	pruefen(
		`der Ändern-Griff am Blatt rendert als list-item und trägt ${TREFFER_MINIMUM}px`,
		aendernGriff.anzeige === 'list-item' && aendernGriff.hoehe >= TREFFER_MINIMUM,
		`display ${aendernGriff.anzeige}, ${Math.round(aendernGriff.hoehe)}px`
	);

	/*
	 * **Und das Wort ohne Luft bricht um.**
	 *
	 * `overflow-wrap: anywhere` an `.blatt__text` ist die Zusage; ohne sie schöbe
	 * ein Wort von zweihundert Zeichen die Seite bei 375px seitlich aus dem Bild.
	 * Gemessen wird beides: dass das Dokument nicht breiter wird **und** dass der
	 * Absatz selbst innerhalb des Fensters bleibt. Die zweite Hälfte ist nötig,
	 * weil ein überlaufender Absatz in einem Container mit `overflow: hidden`
	 * das Dokument unberührt liesse und trotzdem abgeschnitten wäre.
	 */
	await browser.besuchen(`${adresse}/wissen/${blattLangwort}`);
	await breiteHalten('ein Blatt mit einem 200-Zeichen-Wort');
	const langwort = await browser.auswerten<{ textbreite: number; zeilen: number }>(`
		const el = document.querySelector('.blatt__text');
		if (el === null) throw new Error('kein .blatt__text auf dem Blatt');
		const k = el.getBoundingClientRect();
		const zeilenhoehe = parseFloat(getComputedStyle(el).lineHeight);
		return { textbreite: k.right, zeilen: Math.round(k.height / zeilenhoehe) };`);
	pruefen(
		'und der Absatz bleibt im Fenster, statt unter einem overflow zu verschwinden',
		langwort.textbreite <= BREITE,
		`rechte Kante ${Math.round(langwort.textbreite)}px, erwartet ≤ ${BREITE}px`
	);
	pruefen(
		'das Wort ist also wirklich umgebrochen — es steht auf mehr als einer Zeile',
		langwort.zeilen > 1,
		`gemessen: ${langwort.zeilen} Zeile(n)`
	);

	// -----------------------------------------------------------------------
	// Der Browser hat nichts zu beklagen
	// -----------------------------------------------------------------------
	/*
	 * Eine Seite, die im Betrieb eine Ausnahme wirft, ist kaputt, auch wenn jede
	 * Messung oben passt. Gesammelt wird über die ganze Sitzung, aus dem
	 * **Protokoll** und nicht aus Chromes Fehlerausgabe.
	 *
	 * Der erste Entwurf las jene, und der Lauf wurde rot über sechs
	 * `CVDisplayLinkCreateWithCGDisplay failed` — Plattformrauschen von macOS,
	 * ohne jeden Bezug zur Seite. Es mit einer Ausschlussliste zu erschlagen wäre
	 * der Anfang einer Liste, die irgendwann auch echte Fehler wegfiltert. Die
	 * Quelle war falsch, nicht der Filter zu schwach.
	 */
	const gemeckert = browser.seitenfehler();
	pruefenGleich(
		'die Seite hat während des ganzen Laufs keine Ausnahme und kein console.error erzeugt',
		gemeckert.join(' | ') || '(nichts)',
		'(nichts)'
	);

	const abgelegt = zaehlerstand().gelaufen;
	pruefenGleich(
		`alle ${ERWARTETE_BEHAUPTUNGEN} Behauptungen sind gelaufen`,
		abgelegt,
		ERWARTETE_BEHAUPTUNGEN
	);
} catch (fehler) {
	unerwarteterWurf('smoke:sicht', fehler);
} finally {
	await browser?.schliessen();
	await serverBeenden(server);
	aufraeumen();
}

const stand = zaehlerstand();
if (stand.gescheitert > 0) {
	console.error(
		`\nsmoke:sicht: ${stand.gescheitert} von ${stand.gelaufen} Behauptung(en) nicht erfüllt.`
	);
	process.exit(1);
}
console.log(
	`\nsmoke:sicht: ${stand.gelaufen} Behauptungen am gerenderten Ergebnis im kopflosen Browser belegt.`
);
