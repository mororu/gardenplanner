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

/**
 * So viele Behauptungen muss ein vollständiger Lauf ablegen, die Schlusszählung
 * selbst nicht mitgerechnet. Wer eine hinzufügt oder entfernt, zieht die Zahl
 * mit — dieselbe Reibung wie in `smoke` und `smoke:http`, und aus demselben
 * Grund: eine Behauptung, die unbemerkt übersprungen wird, fällt so auf.
 */
const ERWARTETE_BEHAUPTUNGEN = 25;

/** Der Viewport, für den dieses Projekt gestaltet ist. */
const BREITE = 375;
const HOEHE = 812;

/** Das Trefferfeld-Minimum aus dem Gestaltungsrahmen. */
const TREFFER_MINIMUM = 44;

/** Der Text der frischen Aufgabe, die dieses Skript neben die überfällige legt. */
const FRISCHER_TEXT = 'Beet 7 giessen';

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
