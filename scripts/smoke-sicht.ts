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
import { mkdirSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
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
	MITGLIED,
	serverBeenden,
	serverStarten,
	wurzel,
	type Server,
} from './pruefserver.ts';
import {
	farbeLesen,
	gerundet,
	grundAus,
	textSchwelle,
	ueberlagern,
	verhaeltnis,
} from './kontrast.ts';
import { browserStarten, chromeFinden, type Browser } from './kopfbrowser.ts';
import { aufgabenStapelAnlegen } from '../src/lib/server/db/queries/tasks.ts';
import { blattAnlegen } from '../src/lib/server/db/queries/sheets.ts';
import { dokumentAnlegen } from '../src/lib/server/db/queries/documents.ts';
import { ablagenamenErzeugen, dateiAblegen } from '../src/lib/server/ablage.ts';
import { einzelaufgabeAusschreiben } from '../src/lib/server/db/queries/signup-tasks.ts';

/**
 * So viele Behauptungen muss ein vollständiger Lauf ablegen, die Schlusszählung
 * selbst nicht mitgerechnet. Wer eine hinzufügt oder entfernt, zieht die Zahl
 * mit — dieselbe Reibung wie in `smoke` und `smoke:http`, und aus demselben
 * Grund: eine Behauptung, die unbemerkt übersprungen wird, fällt so auf.
 */
const ERWARTETE_BEHAUPTUNGEN = 118;

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

	/*
	 * **Die Abschnitte auf `/` kommen seit dem 2026-09-17 zugeklappt ausgeliefert**
	 * (Entscheid Manuel), und dieser Lauf klappt sie nach jedem Besuch auf.
	 *
	 * Das ist keine Umgehung der Zusage, sondern die Arbeitsteilung zwischen den
	 * Schichten: **dass** sie zugeklappt geliefert werden, misst der Quelltextlauf
	 * (`smoke`) und der Serverlauf am ausgelieferten HTML (`smoke:http`). Dieser
	 * hier misst **Geometrie** — Trefferfelder, Kontraste, Fokus, Übergänge —, und
	 * in einem zugeklappten `<details>` gibt es davon nichts: der Inhalt steht
	 * nicht im Layout, jede Messung daran wäre ein Wurf oder eine Null.
	 *
	 * Ohne diesen Griff brach der Lauf am ersten Klick auf `Übernehmen` ab, weil
	 * der Knopf in einem zugeklappten Abschnitt liegt. Gemessen, nicht überlegt.
	 *
	 * Gesetzt wird `open` und nicht geklickt: ein Klick wäre eine Handlung, die
	 * der Lauf an anderer Stelle selbst prüft, und er würde den Zustand des
	 * Aufklappzeichens mitdrehen.
	 */
	const abschnitteOeffnen = async (): Promise<void> => {
		await browser!.auswerten<boolean>(`
			for (const d of document.querySelectorAll('details.abschnitt')) d.open = true;
			return true;`);
	};

	await browser.besuchen(`${adresse}/`);
	await abschnitteOeffnen();

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
	/*
	 * **Gezählt wird in der Liste des Pools** — seit dem 2026-09-20. Die Klasse
	 * `.zeile` trägt seither auch der Rückblick `Zuletzt erledigt`, und über das
	 * ganze Dokument gezählt wären es drei. Die Kennung ist dieselbe, über die
	 * der Pool überall in dieser Prüfkette geschnitten wird.
	 */
	const zeilenZahl = await browser.auswerten<number>(
		'return document.querySelectorAll(\'[aria-labelledby="offen-marke"] .zeile\').length'
	);
	pruefenGleich('genau zwei Aufgabenzeilen stehen im Pool', zeilenZahl, 2);

	/*
	 * **Und der Rückblick trägt seine eine Zeile, durchgestrichen.**
	 *
	 * Die Saat in pruefserver.ts hakt genau eine Aufgabe ab, damit dieser
	 * Abschnitt überhaupt rendert — bei null fehlt er ganz. Gemessen wird hier
	 * nicht nur, dass die Zeile da ist, sondern dass sie **aussieht wie
	 * erledigt**: die Durchstreichung ist die ganze Aussage des Abschnitts, und
	 * sie kommt aus derselben Regel, die im Pool eine eben abgehakte Zeile
	 * zeichnet. Fiele die Klasse eines Tages weg, stünde hier eine Liste, die
	 * von einer offenen nicht zu unterscheiden wäre.
	 */
	const rueckblick = await browser.auswerten<{ zeilen: number; durchgestrichen: number }>(`
		const zeilen = [...document.querySelectorAll('[aria-labelledby="zuletzt-marke"] .zeile')];
		return {
			zeilen: zeilen.length,
			durchgestrichen: zeilen.filter((zeile) => {
				const text = zeile.querySelector('.zeile__aufgabe');
				return text !== null && getComputedStyle(text).textDecorationLine.includes('line-through');
			}).length,
		};`);
	pruefenGleich(
		'der Rückblick trägt die abgehakten Zeilen, und sie sind durchgestrichen',
		`${rueckblick.zeilen}/${rueckblick.durchgestrichen}`,
		`${saat.abgehakteTexte.length}/${saat.abgehakteTexte.length}`
	);

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
	/*
	 * **Die Poolliste wird benannt und nicht als erste genommen.**
	 *
	 * Bis zum 2026-09-13 stand hier `document.querySelector('.liste')` — die
	 * erste `.liste` im Dokument, und das war der Pool, solange er die einzige
	 * war. Mit der Ernte-Registerkarte darüber trägt `/` eine zweite, und die
	 * Sonde mass plötzlich deren `li`, die keine `.zeile` sind. Sie wurde rot,
	 * und sie hatte recht: die Prüfliste darunter zählt mit `nth-of-type` **im
	 * Pool**, und welche Liste das ist, muss sie sagen statt zu raten.
	 *
	 * `aria-labelledby="offen-marke"` ist die Kennung, die der Pool ohnehin
	 * trägt — sie verbindet ihn mit seinem Griff, und es gibt genau einen.
	 */
	const nurZeilen = await browser.auswerten<boolean>(`
		const liste = document.querySelector('.liste[aria-labelledby="offen-marke"]');
		if (liste === null) throw new Error('keine Poolliste im Dokument');
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
	// Der Grund ist gemalt und nicht geerbt
	// -----------------------------------------------------------------------
	/*
	 * **Bis zum 2026-09-13 standen hier zwei Messungen**, eine je Schema, und die
	 * zweite sagte: der dunkle Block wirkt wirklich. Mit dem dunklen Modus ist
	 * sie weggefallen — es gibt kein zweites Schema mehr, dessen Wirkung man
	 * belegen könnte.
	 *
	 * Was bleibt, ist die Hälfte, die weiterhin etwas behauptet: `body` trägt
	 * eine **deckende** Fläche. Das ist nicht selbstverständlich und auch nicht
	 * bloss Kosmetik — die Kontrastrechnung dieses Projekts gibt `null` zurück,
	 * wenn kein Vorfahre einer Fläche deckend ist, und der ganze Sweep weiter
	 * unten hinge dann an der Leinwand des Browsers statt an dieser Anwendung.
	 */
	const grundfarbe = () =>
		browser!.auswerten<string>('return getComputedStyle(document.body).backgroundColor');

	await browser.besuchen(`${adresse}/`);
	await abschnitteOeffnen();
	const grund = await grundfarbe();

	pruefen(
		'die Seite hat überhaupt eine deckende Grundfarbe',
		grund !== '' && grund !== 'rgba(0, 0, 0, 0)' && !grund.startsWith('rgba'),
		`gemessen: ${JSON.stringify(grund)}`
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
	await abschnitteOeffnen();
	const mitBewegung = await dauer();

	await browser.senden('Emulation.setEmulatedMedia', {
		features: [
			{ name: 'prefers-color-scheme', value: 'light' },
			{ name: 'prefers-reduced-motion', value: 'reduce' },
		],
	});
	await browser.besuchen(`${adresse}/`);
	await abschnitteOeffnen();
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
	// Der Pfeil der Auswahl auf /traenkeplan
	// -----------------------------------------------------------------------
	/*
	 * `select.feld { appearance: auto }` nimmt das `appearance: none` der
	 * Feldrolle zurück, damit die Auswahl ihren Pfeil behält — die einzige
	 * Anzeige, dass sich hier etwas aufklappt. Kein bestehendes Skript erreicht
	 * gerechnete Darstellung; der Posten steht in deferred-work.md ausdrücklich
	 * als „das wäre Stufe C".
	 *
	 * Gemessen wird als Mitglied ohne Adminrechte: die Auswahl steht nur der
	 * Verwaltung offen, und `/traenkeplan` leitet ein Mitglied nicht weg — es sieht
	 * den Plan, nur ohne Formular. Die Behauptung sagt darum, was sie sehen kann:
	 * **wenn** eine Auswahl im Dokument steht, trägt sie ihren Pfeil.
	 */
	await browser.besuchen(`${adresse}/traenkeplan`);
	const auswahl = await browser.auswerten<{ zahl: number; erscheinung: string | null }>(`
		const el = document.querySelector('select.feld');
		return { zahl: document.querySelectorAll('select.feld').length,
		         erscheinung: el === null ? null : getComputedStyle(el).appearance };`);
	pruefen(
		'auf /traenkeplan trägt jede Auswahl ihren Pfeil, oder es steht keine im Dokument',
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

	/*
	 * **Der leere Zustand, und warum er hier vor der Saat steht.**
	 *
	 * `Noch nichts aufgeschrieben.` ist ein eigener Seitenzustand, und ein Lauf,
	 * der zwei Blätter sät, sieht ihn nie. Die Blätter entstehen darum **jetzt**,
	 * gegen dieselbe SQLite-Datei, die der Server schon offen hält — WAL erlaubt
	 * den zweiten Schreiber, und die Migrationskette lief längst. Damit trägt ein
	 * Lauf beide Zustände, statt für den zweiten einen zweiten Lauf zu brauchen.
	 */
	await browser.besuchen(`${adresse}/wissen`);
	const leerZustand = await browser.auswerten<{ leer: boolean; liste: number; satz: string }>(`
		const leer = document.querySelector('.leer');
		return {
			leer: leer !== null,
			liste: document.querySelectorAll('.blattlink').length,
			satz: leer === null ? '' : leer.textContent.trim(),
		};`);
	pruefen(
		'ohne Blatt trägt /wissen den leeren Zustand und keine Liste',
		leerZustand.leer && leerZustand.liste === 0 && leerZustand.satz !== '',
		JSON.stringify(leerZustand)
	);
	await breiteHalten('/wissen im leeren Zustand');

	const blattAbsaetze = blattAnlegen(BLATT_ABSAETZE.titel, BLATT_ABSAETZE.text);
	const blattLangwort = blattAnlegen(BLATT_LANGWORT.titel, BLATT_LANGWORT.text);
	/*
	 * **Ein abgelegtes Dokument, seit dem 2026-09-20** — sonst sähe der Sichtlauf
	 * die zweite Liste auf /wissen nie und die Seite darüber schon gar nicht.
	 * Dieselbe Klasse wie die Erntesaat im Prüfserver: eine Zusage über
	 * Gerendertes, die nichts rendert, ist keine.
	 *
	 * **Datei zuerst, dann die Zeile** — dieselbe Reihenfolge, die auch die
	 * action einhält (siehe `documents.ablage` im Schema). Der Inhalt ist die
	 * kürzeste Bytefolge, die diese Anwendung als PDF annimmt: die Kennung `%PDF-`
	 * und eine Zeile Text. Gerendert wird sie nirgends — der Sichtlauf öffnet das
	 * Dokument nicht, er misst die Seite **über** das Dokument.
	 */
	const dokumentAblage = ablagenamenErzeugen();
	const dokumentInhalt = new TextEncoder().encode('%PDF-1.4\n% Saat des Sichtlaufs\n');
	dateiAblegen(dokumentAblage, dokumentInhalt);
	const dokumentMerkblatt = dokumentAnlegen(
		'Merkblatt Brennnesseljauche',
		'brennnesseljauche.pdf',
		dokumentAblage,
		dokumentInhalt.byteLength
	);
	await browser.besuchen(`${adresse}/wissen`);

	await breiteHalten('/wissen');

	/*
	 * **Die Suche auf /wissen, von Hand abgeschickt.**
	 *
	 * Sie ist ein GET-Formular ohne `use:enhance`, und das ist eine Annahme über
	 * den Browser, die nur der Browser bestätigt: abgeschickt wird an die eigene
	 * Adresse, die load liest den Parameter, und die Liste kommt gefiltert
	 * zurück. `smoke` prüft die load und das Markup je für sich — dass die zwei
	 * zusammenfinden, steht erst hier.
	 *
	 * Gesucht wird nach einem Wort, das **nur im Freitext** eines Blatts steht.
	 * Das ist der Fall, für den diese Suche überhaupt auf dem Server liegt: eine
	 * Filterung über die Listendaten fände ihn nicht, weil der Text dort gar
	 * nicht ankommt.
	 */
	const wissenSuchwort = BLATT_ABSAETZE.text.split(/\s+/).find((wort) => wort.length > 6) ?? '';
	await browser.tippen('#wissen-suche', wissenSuchwort);
	await browser.klicken('form.suche button[type="submit"]');
	await browser.warten(
		"new URLSearchParams(location.search).get('suche') !== null",
		'die Suche steht in der Adresse'
	);

	const nachSuche = await browser.auswerten<{
		adresse: string;
		titel: string[];
		fundstellen: number;
	}>(`
		return {
			adresse: new URLSearchParams(location.search).get('suche') ?? '(keiner)',
			titel: [...document.querySelectorAll('[aria-labelledby="blaetter-marke"] .blattlink')]
				.map((el) => el.childNodes[0].textContent.trim()),
			fundstellen: document.querySelectorAll('.fundstelle').length,
		};`);
	pruefen(
		'die Suche steht in der Adresse und die Liste ist darauf zusammengeschnitten',
		nachSuche.adresse === wissenSuchwort && nachSuche.titel.join(' | ') === BLATT_ABSAETZE.titel,
		JSON.stringify(nachSuche)
	);
	/*
	 * **Und der Treffer sagt, warum er einer ist.** Das Wort steht nicht im
	 * Titel; ohne den Ausschnitt darunter sähe die Zeile aus wie ein Fehler der
	 * Suche. Gemessen wird die Zahl und nicht der Text: welcher Ausschnitt
	 * richtig ist, prüft `smoke` an der reinen Funktion, hier zählt, dass er im
	 * Bild ankommt.
	 */
	pruefen(
		'und der Texttreffer trägt genau eine sichtbare Fundstelle',
		nachSuche.fundstellen === 1,
		`${nachSuche.fundstellen} Fundstelle(n)`
	);
	await breiteHalten('/wissen mit Suche');

	// Zurück auf die ungefilterte Liste, damit die Messungen darunter wieder den
	// ganzen Bestand sehen.
	await browser.besuchen(`${adresse}/wissen`);

	/*
	 * **Der Griff behält seine Anzeige — hier gemessen statt aus dem Quelltext
	 * gelesen.**
	 *
	 * Bis zum 2026-09-16 hiess die Zusage `er rendert als list-item, das Dreieck
	 * ist da`. Seither trägt er wie jeder Aufklapper dieses Produkts einen Winkel
	 * rechts, und Gate-Regel 15 lässt das `display` genau deshalb durch: weil im
	 * Markup des `<summary>` ein Zeichen der Klasse `aufklapp` steht.
	 *
	 * **Was die Regel nicht sehen kann, misst diese Zeile.** Sie liest einen
	 * Klassennamen, kein Pixel; ein `display: none` am Zeichen käme an ihr vorbei,
	 * und der Griff sähe aus wie ein Satz Text, während das Tor grün meldet.
	 * Dieselbe Arbeitsteilung wie vorher, nur um den neuen Gegenstand herum: die
	 * Regel sagt, dass der Tausch im Quelltext stattgefunden hat, die Messung,
	 * dass er auf dem Schirm ankommt.
	 */
	const griffe = await browser.auswerten<{
		zahl: number;
		anzeige: string[];
		hoehen: number[];
		zeichen: string[];
	}>(`
		const alle = [...document.querySelectorAll('summary.zeilenform__griff')];
		return {
			zahl: alle.length,
			anzeige: alle.map((el) => getComputedStyle(el).display),
			hoehen: alle.map((el) => el.getBoundingClientRect().height),
			zeichen: alle.map((el) => {
				const z = el.querySelectorAll('.aufklapp');
				if (z.length !== 1) return z.length + ' Zeichen';
				const r = z[0].getBoundingClientRect();
				return Math.round(r.width) + 'x' + Math.round(r.height);
			}),
		};`);
	/*
	 * **Zwei seit dem 2026-09-20**: `Neues Blatt` und `Dokument ablegen`. Die Zahl
	 * steht von Hand, wie überall in dieser Kette — sie ist die Stelle, an der ein
	 * dritter Aufklapper auffällt, statt still ungemessen danebenzustehen. Die
	 * drei Behauptungen darunter messen jeden der zwei einzeln (`every`).
	 */
	pruefen('/wissen trägt genau zwei Aufklappgriffe', griffe.zahl === 2, `${griffe.zahl} Griff(e)`);
	pruefen(
		'und er trägt genau ein Aufklappzeichen mit Ausdehnung — das Dreieck ist abgelöst',
		griffe.zeichen.every((mass) => /^[1-9]\d*x[1-9]\d*$/.test(mass)) &&
			griffe.anzeige.every((wert) => wert !== 'list-item'),
		`Zeichen ${griffe.zeichen.join(', ')}, Anzeige ${griffe.anzeige.join(', ')}`
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
	 *
	 * **Drei seit dem 2026-09-20**: zwei Blätter und ein Dokument. Die
	 * Dokumentzeile trägt dieselbe Klasse, weil sie dieselbe Sache ist — eine
	 * Karte, deren ganzer Inhalt ein Ziel ist —, und sie muss dieselbe Zusage
	 * halten. Sie ist dabei der schärfere Fall: ihr Link trägt zwei Zeilen, den
	 * Titel und die Grösse darunter, und eine Regel, die die zweite aus dem
	 * Trefferfeld fallen liesse, fiele genau hier auf.
	 */
	const linkHoehen = await browser.auswerten<number[]>(`
		return [...document.querySelectorAll('.blattlink')].map((el) => el.getBoundingClientRect().height);`);
	pruefen(
		`alle drei Zeilenlinks tragen ein Trefferfeld von mindestens ${TREFFER_MINIMUM}px`,
		linkHoehen.length === 3 && linkHoehen.every((hoehe) => hoehe >= TREFFER_MINIMUM),
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

	// -----------------------------------------------------------------------
	// Interaktion auf /wissen: Abweisung, Erfolg, Fokus, Sperre
	// -----------------------------------------------------------------------
	/*
	 * **Ab hier wird geklickt und getippt.** Alles darüber war Darstellung; die
	 * Zusagen darunter sind Verhalten im Browser und tragen die Zeilen 4, 8 und 9
	 * der R5-Liste in `deferred-work.md`.
	 *
	 * Geklickt wird über die Eingabeschicht in die **gemessene Mitte** des
	 * Elements, nicht über `el.click()`. Der Unterschied ist der Punkt: ein
	 * `el.click()` trifft auch ein Element hinter einem anderen oder eines ohne
	 * Fläche, und eine Zusage über ein Trefferfeld, die so geprüft wird, prüft
	 * das Trefferfeld nicht.
	 */
	await browser.klicken('summary.zeilenform__griff');
	await browser.warten(
		"document.querySelector('details.zeilenform').open",
		'das Formular klappt auf einen Klick auf den Griff auf'
	);
	pruefen(
		'ein Klick auf den Griff klappt das Formular auf',
		await browser.auswerten<boolean>("return document.querySelector('details.zeilenform').open"),
		'das <details> blieb zu'
	);

	/*
	 * **Zwei Schichten weisen ab, und die erste war mir nicht klar.**
	 *
	 * Der erste Entwurf dieser Zeilen schickte das Formular **leer** ab und
	 * wartete auf den Fehlersatz des Servers. Er kam nie: `required` am Titelfeld
	 * lässt den Versand gar nicht los, und die Prüfliste lief in ihre Frist. Das
	 * ist kein Fehler des Produkts, sondern eine Zusage, die ich übersehen hatte
	 * — und sie steht jetzt als eigene Behauptung da.
	 *
	 * Die Abweisung des **Servers** ist damit nur mit Eingabe erreichbar, die
	 * `required` besteht und serverseitig auf leer faltet: ein Titel aus
	 * Leerzeichen. Genau diese Zeile führt die I/O-Matrix der Story auch
	 * („Titel leer / nur Leerraum / nur unsichtbare Zeichen"), und `smoke:http`
	 * prüft sie ohne JavaScript. Dies ist der Weg **mit**.
	 */
	await browser.klicken('details.zeilenform button[type="submit"]');
	const nativ = await browser.auswerten<{ gueltig: boolean; satz: string; offen: boolean }>(`
		const feld = document.querySelector('#neu-titel');
		return {
			gueltig: feld.checkValidity(),
			satz: document.querySelector('#neu-titel-fehler').textContent.trim(),
			offen: document.querySelector('details.zeilenform').open,
		};`);
	pruefen(
		'ein leerer Versand kommt nicht bis zum Server — required hält ihn im Browser auf',
		!nativ.gueltig && nativ.satz === '' && nativ.offen,
		JSON.stringify(nativ)
	);

	// Ein Titel aus Leerzeichen besteht `required` und faltet serverseitig auf
	// leer — der Weg zur Abweisung, die diese Zeile messen will.
	await browser.tippen('#neu-titel', '   ');
	await browser.tippen('#neu-text', 'Ein Text, der für sich in Ordnung ist.');
	/*
	 * **Das Formular wird während des Versands zugeklappt** — und das ist kein
	 * Kunstgriff, sondern der einzige Weg, `open={abgewiesen}` überhaupt zu
	 * messen.
	 *
	 * Der erste Entwurf klappte das `<details>` auf, schickte ab und behauptete
	 * danach „es ist offen". Die Mutation `open={abgewiesen}` **entfernt** liess
	 * die Zeile grün: ein von Hand aufgeklapptes `<details>` bleibt offen, weil
	 * `use:enhance` per fetch abschickt und keine Navigation es zumacht. Die
	 * Behauptung prüfte, dass nichts es schliesst — nicht, dass die Bindung es
	 * öffnet.
	 *
	 * Jetzt wird es mitten im Versand geschlossen. Trifft die Abweisung ein, muss
	 * die Bindung es wieder aufmachen; ohne sie bleibt es zu. Die Netzverzögerung
	 * stellt das Fenster dafür.
	 */
	await browser.verzoegern(1_500);
	await browser.klicken('details.zeilenform button[type="submit"]');
	await browser.auswerten<boolean>(`
		document.querySelector('details.zeilenform').open = false;
		return true;`);
	await browser.verzoegern(0);
	await browser.warten(
		"document.querySelector('#neu-titel-fehler').textContent.trim() !== ''",
		'die Abweisung erscheint am Titelfeld'
	);
	const abgewiesen = await browser.auswerten<{
		offen: boolean;
		satz: string;
		markiert: string | null;
		blaetter: number;
	}>(`
		const d = document.querySelector('details.zeilenform');
		const feld = document.querySelector('#neu-titel');
		return {
			offen: d.open,
			satz: document.querySelector('#neu-titel-fehler').textContent.trim(),
			markiert: feld.getAttribute('aria-invalid'),
			blaetter: document.querySelectorAll('[aria-labelledby="blaetter-marke"] .blattlink').length,
		};`);
	pruefen(
		'eine Abweisung klappt das Formular wieder auf, zeigt den Satz und markiert das Feld',
		abgewiesen.offen && abgewiesen.satz !== '' && abgewiesen.markiert === 'true',
		JSON.stringify(abgewiesen)
	);
	/*
	 * **Gezählt wird in der Blätterliste und nicht über die ganze Seite** — seit
	 * dem 2026-09-20, als die Dokumente dazukamen: `.blattlink` trägt seither
	 * auch eine Dokumentzeile, und über das Dokument sagt eine abgewiesene
	 * Blatt-Eingabe nichts. Geschnitten wird über die Kennung der Marke, wie
	 * überall in dieser Prüfkette.
	 */
	pruefenGleich(
		'und es ist kein Blatt entstanden — die Blätterliste steht unverändert bei zwei',
		abgewiesen.blaetter,
		2
	);
	await breiteHalten('/wissen mit offenem Formular und Abweisung');

	/*
	 * **Die geglückte Anlage — und wo der Fokus hier ausdrücklich nicht geprüft
	 * wird.**
	 *
	 * Der erste Entwurf dieser Zeilen verlangte, dass die Meldungsregion nach der
	 * Anlage den Fokus hält, und wurde rot: fokussiert war `<body>`. Der Befund
	 * war **meiner und nicht der des Produkts**. Der Fokusgriff steht im
	 * `use:enhance`-Rückruf des **Ändern**-Formulars auf `/wissen/[id]`; das
	 * Anlegen kommt von `/wissen`, leitet auf das frische Blatt weiter, und dort
	 * hat kein Rückruf gelaufen. Keine Seite sagt für diesen Weg einen Fokusgriff
	 * zu — die Behauptung prüfte eine Zusage, die niemand gemacht hat.
	 *
	 * Dass eine Meldung, die eine **Weiterleitung** überlebt, damit von Anfang an
	 * in ihrer Live-Region steht und deshalb nicht verlässlich vorgelesen wird,
	 * ist ein bekannter, produktweiter Posten (Retro-Punkt B2, in
	 * `deferred-work.md` festgehalten). Er wird hier nicht als Zusage behauptet
	 * und nicht als Fehler gemeldet — geprüft wird, dass der Satz **da** ist.
	 *
	 * Der Fokusgriff selbst — Zeile 9 der R5-Liste — steht darunter am
	 * Ändern-Weg, dort, wo er zugesagt ist.
	 */
	/*
	 * Die Felder tragen die verworfene Eingabe noch — `abweisen` reicht sie
	 * zurück, damit niemand zweimal tippt. Für den Erfolgsweg werden sie darum
	 * geleert und neu gefüllt, statt an das Bestehende anzuhängen.
	 */
	await browser.auswerten<boolean>(`
		for (const wahl of ['#neu-titel', '#neu-text']) {
			const el = document.querySelector(wahl);
			el.value = '';
			el.dispatchEvent(new Event('input', { bubbles: true }));
		}
		return true;`);
	await browser.tippen('#neu-titel', 'Starkzehrer');
	await browser.tippen('#neu-text', 'Kohl, Kürbis und Tomaten wollen frischen Kompost.');
	await browser.klicken('details.zeilenform button[type="submit"]');
	await browser.warten(
		"location.pathname.startsWith('/wissen/') && location.search.includes('angelegt')",
		'die Anlage leitet auf das frische Blatt'
	);
	await browser.warten(
		"document.querySelector('.meldung') !== null && document.querySelector('.meldung').textContent.trim() !== ''",
		'die Rückmeldung steht in der Region'
	);
	const angelegt = await browser.auswerten<{ satz: string; titel: string }>(`
		return {
			satz: document.querySelector('.meldung').textContent.trim(),
			titel: document.querySelector('.seitentitel').textContent.trim(),
		};`);
	pruefen(
		'die geglückte Anlage landet auf dem frischen Blatt, mit Titel und Rückmeldung',
		angelegt.titel === 'Starkzehrer' && angelegt.satz !== '',
		JSON.stringify(angelegt)
	);

	/*
	 * **Der Fokusgriff der Live-Region — Zeile 9 der R5-Liste, und hier ist sie
	 * zugesagt.**
	 *
	 * Ein geglücktes Ändern leitet auf dieselbe Adresse mit `?geaendert`, das
	 * Formular klappt zu, und der Rückruf holt den Fokus in die Rückmeldung. Ob
	 * er das **hält**, entscheidet die Reihenfolge zwischen Sveltes
	 * Effektabarbeitung und SvelteKits `reset_focus` am Ende der Navigation — und
	 * die hat bis heute niemand gemessen. Der Quelltext von SvelteKit gibt der
	 * Bauform recht (`navigate()` überspringt `reset_focus`, wenn eine
	 * Fokusverwaltung ihn überschrieben hat); ob die Reihenfolge stimmt, sagt er
	 * nicht.
	 *
	 * Hier steht sie als Messung.
	 */
	await browser.klicken('summary.zeilenform__griff');
	await browser.warten(
		"document.querySelector('details.zeilenform').open",
		'das Ändern-Formular am Blatt klappt auf'
	);
	await browser.tippen('#aendern-text', ' Und Zwiebeln danach.');
	await browser.klicken('details.zeilenform button[type="submit"]');
	await browser.warten(
		"location.search.includes('geaendert')",
		'das Ändern leitet auf dieselbe Adresse mit ?geaendert'
	);
	const fokus = await browser.auswerten<{ rolle: string; klasse: string; satz: string }>(`
		const a = document.activeElement;
		const m = document.querySelector('.meldung');
		return {
			rolle: a === null ? '(keins)' : a.tagName.toLowerCase(),
			klasse: a === null ? '' : a.className,
			satz: m === null ? '' : m.textContent.trim(),
		};`);
	pruefen(
		'nach dem geglückten Ändern hält die Meldungsregion den Fokus — SvelteKits reset_focus nimmt ihn nicht zurück',
		fokus.klasse.split(/\s+/).includes('meldung'),
		`fokussiert ist <${fokus.rolle} class="${fokus.klasse}">, Satz ${JSON.stringify(fokus.satz)}`
	);

	/*
	 * **Die Sperre gegen Doppelversand — Zeile 4 der R5-Liste.**
	 *
	 * `disabled={imFlug}` soll den Knopf für die Dauer des Versands sperren. Der
	 * Zustand ist im normalen Lauf ein Wimpernschlag lang da und darum nicht
	 * messbar; er wird hier mit einer **Netzverzögerung** aufgehalten. Ohne diesen
	 * Griff wäre die Zusage nicht prüfbar, und mit einer festen Wartezeit statt
	 * einer Bedingung wäre die Zeile sprunghaft.
	 *
	 * Gemessen wird am Blatt, nicht auf der Liste: dort steht dasselbe Formular
	 * ein zweites Mal, und der Ändern-Weg ist der, den niemand ohne JavaScript
	 * abgesichert sieht.
	 */
	await browser.klicken('summary.zeilenform__griff');
	await browser.warten(
		"document.querySelector('details.zeilenform').open",
		'das Ändern-Formular klappt für den zweiten Versand auf'
	);
	await browser.verzoegern(1_500);
	await browser.klicken('details.zeilenform button[type="submit"]');
	await browser.warten(
		'document.querySelector(\'details.zeilenform button[type="submit"]\').disabled',
		'der Knopf sperrt sich für die Dauer des Versands'
	);
	pruefen(
		'der Absendeknopf ist während des Versands gesperrt — ein zweiter Klick trägt nicht',
		await browser.auswerten<boolean>(
			'return document.querySelector(\'details.zeilenform button[type="submit"]\').disabled'
		),
		'der Knopf blieb bedienbar, während der Versand lief'
	);
	await browser.verzoegern(0);
	await browser.warten(
		"location.search.includes('geaendert') || document.querySelector('.meldung') !== null",
		'der aufgehaltene Versand kommt zu Ende'
	);

	await browser.besuchen(`${adresse}/wissen`);

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

	const aendernGriff = await browser.auswerten<{ zeichen: number; hoehe: number }>(`
		const el = document.querySelector('summary.zeilenform__griff');
		if (el === null) throw new Error('kein Griff auf dem Blatt');
		return {
			zeichen: el.querySelectorAll('.aufklapp').length,
			hoehe: el.getBoundingClientRect().height,
		};`);
	pruefen(
		`der Ändern-Griff am Blatt trägt sein Aufklappzeichen und ${TREFFER_MINIMUM}px`,
		aendernGriff.zeichen === 1 && aendernGriff.hoehe >= TREFFER_MINIMUM,
		`${aendernGriff.zeichen} Zeichen, ${Math.round(aendernGriff.hoehe)}px`
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
	// Der Bestätigungsdialog auf / — Zeilen 3 und 5 der R5-Liste
	// -----------------------------------------------------------------------
	/*
	 * **Die eine Bestätigung des Aufgabenbereichs, und die drei Zusagen an ihr.**
	 *
	 * `showModal()` legt den Fokus auf `Abbrechen`, ein Enter direkt nach dem
	 * Öffnen gibt darum **keine** Zusage ab, und nach dem Bestätigen schliesst der
	 * Dialog. Alle drei standen bis heute nur in Kommentaren: `smoke` rendert
	 * keine Komponente, `smoke:http` sieht den Dialog nur als Markup, und die
	 * dritte Zusage ist genau der Fehler, den in Story 1.3 der Mensch gefunden
	 * hat, nachdem drei Review-Schichten ihn durchgelassen hatten.
	 *
	 * Die Einzelaufgabe entsteht **jetzt**, nach dem `/`-Block weiter oben: eine
	 * Saat davor hätte dessen Zeilenmessungen einen zweiten Block über den Pool
	 * gestellt und sie stillschweigend verschoben.
	 *
	 * **Mit JavaScript gibt es hier keinen Server-Umlauf.** `versandFragen` bricht
	 * den Versand ab und öffnet den Dialog; `form.art` wird nie `fragen`, und der
	 * Knopf bleibt darum stehen. Der Weg über das Dokument — dieselbe Frage ohne
	 * JavaScript — ist der von `smoke:http`.
	 */
	/*
	 * **Gewartet wird auf den Dialog *mit seinem Inhalt*, nicht auf sein `open`** —
	 * und beim Schliessen auf den geleerten Dialog, nicht auf das blosse `!open`.
	 *
	 * Der Inhalt beider Bestätigungen hängt an einem Zustand (`zuUebernehmen`,
	 * `zuWiderrufen`) und entsteht erst mit Sveltes nächstem Durchgang. Beim
	 * Öffnen ist das harmlos: `showModal()` läuft nach einem `tick()`, der Inhalt
	 * ist also schon da. Der Rückweg ist der gefährliche. `close()` setzt `open`
	 * **sofort**, das `close`-Ereignis kommt eine Aufgabe später, und erst dessen
	 * `onclose` leert den Zustand. Wer auf `!open` wartet und sofort wieder
	 * öffnet, bekommt jene Leerung mitten in den frisch geöffneten Dialog.
	 *
	 * **Gemessen, nicht befürchtet:** dieser Lauf scheiterte am 2026-09-02 in
	 * einem von drei Durchgängen an genau dieser Stelle, auf zwei Weisen — einmal
	 * `nicht im Dokument: dialog.bestaetigung button[type="submit"]`, einmal ein
	 * Klick, der zwischen Messung und Mausereignis ins Leere fiel und den Dialog
	 * offen liess. Ein Prüflauf, der sprunghaft rot wird, ist schlimmer als
	 * keiner: er lehrt, rote Läufe zu wiederholen. Die zwei Bedingungen unten
	 * machen den Zwischenzustand unerreichbar, statt eine Wartezeit dagegen zu
	 * setzen.
	 *
	 * Sie gelten für **beide** Bestätigungen dieser Anwendung — die auf `/` und
	 * die auf `/verwaltung`, die denselben Bauplan tragen.
	 */
	const DIALOG_SCHALTER = 'dialog.bestaetigung button[type="submit"]';
	const DIALOG_BEREIT =
		`document.querySelector('dialog.bestaetigung')?.open &&` +
		` document.querySelector('${DIALOG_SCHALTER}') !== null`;
	const DIALOG_LEER =
		`!document.querySelector('dialog.bestaetigung').open &&` +
		` document.querySelector('${DIALOG_SCHALTER}') === null`;

	const einzel = einzelaufgabeAusschreiben(
		'Zaun am Nordtor nachspannen',
		Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60
	);
	/*
	 * **Ein kurzer Titel, damit die Ausrichtung überhaupt prüfbar ist.**
	 *
	 * Der Knopf steht rechts, weil `margin-inline-start: auto` ihn dorthin
	 * schiebt. Neben einem breiten Titel stünde er auch ohne diese Regel dort —
	 * die Spalte füllt dann die Zeile von allein, und eine Wache an dieser Zeile
	 * wäre grün, ohne etwas zu belegen. Gemessen am 2026-09-11: mit
	 * `Zaun am Nordtor nachspannen` blieb die Behauptung grün, als die Regel
	 * entfernt wurde. Mit diesem Titel nicht mehr.
	 */
	const kurz = einzelaufgabeAusschreiben(
		'Giessen',
		Math.floor(Date.now() / 1000) + 3 * 24 * 60 * 60
	);
	await browser.besuchen(`${adresse}/`);
	await abschnitteOeffnen();
	const uebernehmen = `#uebernehmen-${einzel.id}`;
	pruefen(
		'die ausgeschriebene Einzelaufgabe steht mit ihrem Knopf auf /',
		await browser.auswerten<boolean>(
			`return document.querySelector(${JSON.stringify(uebernehmen)}) !== null`
		),
		`${uebernehmen} fehlt im Dokument`
	);

	/*
	 * **Kleiner heisst schmaler und leiser — nicht schwerer zu treffen.**
	 *
	 * Der Knopf stand bis zum 2026-09-11 über die volle Spaltenbreite unter dem
	 * Titel und ist seither ein kompakter Knopf neben ihm. Die Anwendung wird
	 * überwiegend auf dem Telefon bedient; ein Knopf, der dabei unter das
	 * 44px-Trefferfeld fiele, wäre die eigentliche Verschlechterung. Gemessen am
	 * gerenderten Kasten bei 375px und nicht am Regelkörper: `min-height` sagt
	 * nichts über die Breite, und die ist hier die Grösse, die schrumpfen sollte.
	 */
	const kompakt = await kasten(uebernehmen);
	pruefen(
		`der kompakte Übernehmen-Knopf hält ${TREFFER_MINIMUM}px in beiden Richtungen`,
		kompakt.breite >= TREFFER_MINIMUM && kompakt.hoehe >= TREFFER_MINIMUM,
		`${Math.round(kompakt.breite)}x${Math.round(kompakt.hoehe)}px`
	);
	/*
	 * Und die Reihe aus Titel und Knopf sprengt die Spalte nicht. Der Titel dieser
	 * Saat ist kurz; was hier gemessen wird, ist darum die Bauform und nicht der
	 * Grenzfall — den trägt die Handprüfung mit einem langen Titel.
	 */
	const breiteHier = await browser.auswerten<{ dokument: number; fenster: number }>(`
		return {
			dokument: document.documentElement.scrollWidth,
			fenster: document.documentElement.clientWidth,
		};
	`);
	pruefen(
		'und die Zeile aus Titel und Knopf scrollt bei 375px nicht waagrecht',
		breiteHier.dokument <= breiteHier.fenster,
		`${breiteHier.dokument} > ${breiteHier.fenster}`
	);

	/*
	 * **Rechts ausgerichtet, gemessen und nicht am Regelkörper abgelesen.**
	 *
	 * `margin-inline-start: auto` ist der Griff; ob er wirkt, entscheidet der
	 * Flexrahmen darum herum. Gemessen wird darum die rechte Kante des Knopfs
	 * gegen die rechte Kante seiner Karte, abzüglich deren Innenabstand. Die
	 * Toleranz ist ein Pixel für gebrochene Gerätepixel — nicht mehr, sonst ginge
	 * ein verlorenes `auto` als „fast rechts" durch.
	 */
	/*
	 * **Die Kopfzeilen bei 375px — die Frage „was passiert auf dem Natel",
	 * gemessen statt beantwortet.**
	 *
	 * Bis zum 2026-09-11 stand hier ein Überblicksband aus drei Kacheln, und diese
	 * Zeile mass deren Höhen. Das Band ist fort: die Zahlen stehen jetzt in den
	 * Griffen der zwei Abschnitte und in der Zeile zum Tränkeplan. Gemessen wird
	 * dasselbe wie vorher — läuft der Inhalt über seinen Kasten hinaus, ist er
	 * verborgen, und abgeschnittener Text ist ein Fehler und keine Gestaltung.
	 *
	 * Die Höhen stehen im Namen der Behauptung. Sie sind keine Schwelle — eine Zahl
	 * als Grenze wäre bei jeder Schriftänderung rot aus dem falschen Grund —, aber
	 * sie machen sichtbar, was eine längere Beschriftung kostet. Der Umbau war
	 * dadurch belegbar: der Kopfbereich fiel von 251px auf 180px.
	 */
	const kopfzeilen = await browser.auswerten<{ hoehe: number; inhalt: number; was: string }[]>(`
		return [...document.querySelectorAll('.abschnitt__griff, .plan-zeile')].map((el) => ({
			hoehe: Math.round(el.getBoundingClientRect().height),
			inhalt: el.scrollHeight,
			was: (el.textContent ?? '').trim().split(/\\s+/).join(' ').slice(0, 40),
		}));
	`);
	const abgeschnitten = kopfzeilen.filter((k) => k.inhalt > k.hoehe + 1);
	pruefen(
		`keine Kopfzeile schneidet ihren Text ab (${kopfzeilen.map((k) => k.hoehe).join('/')}px hoch)`,
		kopfzeilen.length >= 2 && abgeschnitten.length === 0,
		abgeschnitten.map((k) => `${k.was}: ${k.inhalt} in ${k.hoehe}`).join(' | ')
	);

	const kurzKnopf = `#uebernehmen-${kurz.id}`;
	const kurzKasten = await kasten(kurzKnopf);
	const kurzKarte = await kasten(`li:has(${kurzKnopf})`);
	const innen = await browser.auswerten<number>(
		`return parseFloat(getComputedStyle(document.querySelector(${JSON.stringify(kurzKnopf)}).closest('li')).paddingRight);`
	);
	const knopfRechts = kurzKasten.links + kurzKasten.breite;
	const karteInnenRechts = kurzKarte.links + kurzKarte.breite - innen;
	pruefen(
		'der Übernehmen-Knopf steht an der rechten Kante seiner Karte',
		Math.abs(knopfRechts - karteInnenRechts) <= 1,
		`Knopf endet bei ${Math.round(knopfRechts)}, Karte innen bei ${Math.round(karteInnenRechts)}`
	);

	await browser.klicken(uebernehmen);
	await browser.warten(DIALOG_BEREIT, 'der Dialog geht auf einen Klick auf Übernehmen auf');
	const beimOeffnen = await browser.auswerten<{
		offen: boolean;
		fokusText: string;
		fokusArt: string | null;
		imDialog: boolean;
	}>(`
		const d = document.querySelector('dialog.bestaetigung');
		const a = document.activeElement;
		return {
			offen: d.open,
			fokusText: a === null ? '' : a.textContent.trim(),
			fokusArt: a === null ? null : a.getAttribute('type'),
			imDialog: a !== null && d.contains(a),
		};`);
	/*
	 * **Was diese Zeile trägt und was nicht.** Gemessen wurde: den ausdrücklichen
	 * `abbrechenKnopf.focus()` zu entfernen lässt sie **grün** — `showModal()`
	 * fokussiert von sich aus das erste fokussierbare Element, und das ist
	 * `Abbrechen`, weil es zuerst im DOM steht. Die Zusage hängt also an der
	 * **Reihenfolge**, und der Aufruf ist der Gurt zum Hosenträger. Genau die
	 * Reihenfolge zu drehen macht die Zeile rot, gemessen.
	 */
	pruefen(
		'beim Öffnen liegt der Fokus im Dialog auf Abbrechen — nicht auf der zusagenden Handlung',
		beimOeffnen.offen &&
			beimOeffnen.imDialog &&
			beimOeffnen.fokusArt === 'button' &&
			beimOeffnen.fokusText === 'Abbrechen',
		JSON.stringify(beimOeffnen)
	);

	/*
	 * Und ein Enter direkt nach dem Öffnen gibt keine Zusage ab. Es aktiviert
	 * `Abbrechen` — der Dialog schliesst, und die Einzelaufgabe steht danach
	 * **weiterhin frei** auf `/`. Die zweite Hälfte ist die eigentliche: ein Enter,
	 * das den Dialog schliesst und dabei zusagt, wäre derselbe Fehlgriff mit
	 * freundlicherem Gesicht.
	 */
	await browser.taste('Enter');
	await browser.warten(DIALOG_LEER, 'ein Enter auf Abbrechen schliesst den Dialog und leert ihn');
	/*
	 * **Der Name wird an der Einzelaufgabe gesucht und nicht im ganzen Dokument.**
	 *
	 * Bis zum 2026-09-13 las diese Sonde `document.body.textContent` — tragfähig,
	 * solange der Name des Mitglieds auf `/` nur dann vorkam, wenn jemand übernommen
	 * hatte. Die Ernte-Registerkarte nennt seither an jeder Zeile, wer sie
	 * eingetragen hat, und die Saat legt sie unter demselben Namen an: die Sonde
	 * wurde rot, obwohl niemand etwas übernommen hatte.
	 *
	 * Sie war damit von Anfang an zu weit gefasst — gemeint ist „steht ein Name
	 * an **dieser** Einzelaufgabe", und genau das misst sie jetzt, über die
	 * Karte, in der ihr Knopf liegt. Die Saat auf einen zweiten Namen
	 * umzustellen hätte die Zeile still wieder grün gemacht und die zu weite
	 * Fassung stehen gelassen.
	 */
	const nachEnter = await browser.auswerten<{ offen: boolean; knopf: boolean; name: boolean }>(`
		const knopf = document.querySelector(${JSON.stringify(uebernehmen)});
		const karte = knopf === null ? null : knopf.closest('.karte');
		return {
			offen: document.querySelector('dialog.bestaetigung').open,
			knopf: knopf !== null,
			// Der Anzeigename, seit dem 2026-10-26 der einzige, den die Karte
			// trüge (spec-notiz-und-kurzname.md) — gegen den vollen Namen geprüft
			// wäre diese Gegenprobe still bedeutungslos.
			name: karte !== null && karte.textContent.includes(${JSON.stringify(MITGLIED.anzeigename)}),
		};`);
	pruefen(
		'ein Enter direkt nach dem Öffnen sagt nichts zu — der Dialog schliesst, die Aufgabe bleibt frei',
		!nachEnter.offen && nachEnter.knopf && !nachEnter.name,
		JSON.stringify(nachEnter)
	);

	/*
	 * **Und nach dem Bestätigen schliesst der Dialog** — die Zusage, die in
	 * Story 1.3 gebrochen war. `use:enhance` schickt per fetch ab; keine
	 * Navigation schliesst das Element, und bei einem modalen Dialog wäre
	 * `Abbrechen` danach der einzige Ausweg, während die Rückmeldung dahinter
	 * liegt.
	 */
	await browser.klicken(uebernehmen);
	await browser.warten(DIALOG_BEREIT, 'der Dialog geht ein zweites Mal auf');
	await browser.klicken(DIALOG_SCHALTER);
	/*
	 * Gewartet wird auf die **Rückmeldung** und nicht auf `!open`: die Meldung ist
	 * der Ausgang des Versands, `open` ist die Zusage — und behauptet werden soll
	 * die Zusage. Auf `!open` zu warten machte aus einem gebrochenen
	 * `dialog?.close()` einen unerwarteten Wurf in einer Zeitschranke statt einer
	 * roten Behauptung mit Namen.
	 */
	await browser.warten(
		"document.querySelector('.meldung').textContent.trim() !== ''",
		'die Rückmeldung zur Übernahme steht da'
	);
	const nachZusage = await browser.auswerten<{ offen: boolean; knopf: boolean; meldung: string }>(`
		const m = document.querySelector('.meldung');
		return {
			offen: document.querySelector('dialog.bestaetigung').open,
			knopf: document.querySelector(${JSON.stringify(uebernehmen)}) !== null,
			meldung: m === null ? '' : m.textContent.trim(),
		};`);
	pruefen(
		'nach dem Bestätigen ist der Dialog zu, die Aufgabe von / verschwunden und die Rückmeldung da',
		!nachZusage.offen && !nachZusage.knopf && nachZusage.meldung !== '',
		JSON.stringify(nachZusage)
	);

	// -----------------------------------------------------------------------
	// Das Aufklappzeichen der Abschnitte — der Tausch gegen das Dreieck
	// -----------------------------------------------------------------------
	/*
	 * **Hier wird gemessen, was Gate-Regel 15 nur lesen kann.**
	 *
	 * Seit dem 2026-09-16 legen die drei Abschnittsgriffe auf `/` ihr Dreieck ab
	 * und stellen einen Winkel an dessen Stelle. Die Regel prüft den Tausch im
	 * Quelltext: sie sieht die Klasse `aufklapp` im Markup des `<summary>` und
	 * lässt das `display` daraufhin durch. Was sie nicht sehen kann, ist, ob das
	 * Zeichen am Ende **dasteht** — ein `display: none` daran käme an ihr vorbei,
	 * und der Griff sähe aus wie ein Satz Text, während das Tor grün meldet.
	 *
	 * Darum diese zwei Zeilen am gerenderten Ergebnis: das Zeichen ist da und hat
	 * eine Ausdehnung, und es sagt den Zustand — zugeklappt steht es anders als
	 * aufgeklappt. Ohne die zweite wäre ein Winkel, der sich nie bewegt, eine
	 * Anzeige, die nichts anzeigt.
	 */
	const aufklappZeichen = await browser.auswerten<{
		griffe: number;
		abschnitte: number;
		anzeige: string[];
		zeichen: number[];
		masse: string[];
	}>(`
		const griffe = [...document.querySelectorAll('summary.abschnitt__griff')];
		return {
			griffe: griffe.length,
			abschnitte: document.querySelectorAll('details:has(> summary.abschnitt__griff)').length,
			anzeige: griffe.map((g) => getComputedStyle(g).display),
			zeichen: griffe.map((g) => g.querySelectorAll('.aufklapp').length),
			masse: griffe.map((g) => {
				const z = g.querySelector('.aufklapp');
				if (z === null) return 'keines';
				const r = z.getBoundingClientRect();
				return Math.round(r.width) + 'x' + Math.round(r.height);
			}),
		};`);
	/*
	 * **Die Zahl der Griffe wird abgeleitet und nicht von Hand geführt** — seit dem
	 * 2026-09-17, und der Grund ist ein Fehlschlag desselben Tages.
	 *
	 * Sie stand hier als feste Zahl, und das trug, solange jeder Abschnitt der
	 * Seite immer da war. Der Abschnitt mit den eigenen Zusagen ist der erste, der
	 * **von den Daten abhängt**: ohne Zusage fehlt er ganz. Die Saat dieses Laufs
	 * legt keine an, im Quelltext stehen drei Abschnitte, gerendert sind es zwei —
	 * die feste Drei wurde rot, während die Zusage hielt.
	 *
	 * Verglichen wird darum gegen die Zahl der Aufklapper im selben Dokument. Das
	 * ist die Zusage, um die es geht: **jeder Aufklapper, der dasteht, hat genau
	 * ein Aufklappzeichen mit Ausdehnung.** Wie viele dastehen, entscheiden die
	 * Daten.
	 *
	 * **Gezählt wird über den Griff und nicht über eine Klasse am `<details>`** —
	 * seit dem 2026-09-20, und das ist eine Verschärfung mit Anlass. Vorher stand
	 * hier `details.abschnitt`, und das trug, solange jeder Griff dieser Form an
	 * einem Abschnitt hing. Der Rückblick im Pool hängt an keinem: er trägt die
	 * leichte Bauform `rueckblick` ohne eigenen Rahmen, aber denselben Griff, weil
	 * er dieselbe Rolle hat. Mit der alten Zählung standen drei Griffe gegen zwei
	 * Abschnitte, und die Zeile wurde rot, während die Zusage hielt — derselbe
	 * Fehlschlag wie am 2026-09-17, nur aus der anderen Richtung.
	 *
	 * `:has(> …)` fragt genau das, was gemeint ist: ein `<details>`, dessen
	 * **eigener** Griff diese Form trägt. Der Kindselektor ist dabei nicht
	 * Kosmetik — ohne ihn zählte ein Pool, in dem ein Rückblick steht, seinen
	 * Griff mit und käme doppelt vor.
	 *
	 * Die Untergrenze daneben ist kein Ersatz für eine Zahl, sondern der Schutz
	 * gegen die vakuante Wahrheit: ohne sie wäre die Zeile grün, wenn die Seite
	 * gar keinen Aufklapper mehr trüge. Sie steht bei zwei, weil `Zum Erledigen`
	 * und `Wer übernimmt` datenunabhängig sind — beide stehen auch leer da.
	 */
	pruefen(
		'jeder Aufklappgriff auf / trägt genau ein Aufklappzeichen mit Ausdehnung',
		aufklappZeichen.griffe === aufklappZeichen.abschnitte &&
			aufklappZeichen.griffe >= 2 &&
			aufklappZeichen.zeichen.every((zahl) => zahl === 1) &&
			aufklappZeichen.masse.every((mass) => /^[1-9]\d*x[1-9]\d*$/.test(mass)) &&
			aufklappZeichen.anzeige.every((wert) => wert !== 'list-item'),
		`${aufklappZeichen.griffe} Griff(e) zu ${aufklappZeichen.abschnitte} Aufklapper(n), ` +
			`Zeichen ${aufklappZeichen.zeichen.join('/')}, ` +
			`Masse ${aufklappZeichen.masse.join(' ')}, Anzeige ${aufklappZeichen.anzeige.join(' ')}`
	);

	/*
	 * Gedreht wird über `transform`, und gelesen wird der **berechnete** Wert: er
	 * ist das Ergebnis aller Wege zusammen und kennt die Lücken nicht, die ein
	 * Blick in den Quelltext hat.
	 *
	 * Der Griff wird danach wieder aufgeklappt, und das steht in derselben
	 * Behauptung. Der Kontrast-Sweep weiter unten läuft über den ganzen Baum; ein
	 * Abschnitt, den dieser Block zugeklappt zurückliesse, nähme ihm still seinen
	 * Inhalt — und eine Messung, die eine spätere Messung beschneidet, fällt
	 * niemandem auf.
	 */
	const ERSTER_GRIFF = 'summary.abschnitt__griff';
	const DREHUNG = `return getComputedStyle(document.querySelector('${ERSTER_GRIFF} .aufklapp')).transform;`;
	const drehungOffen = await browser.auswerten<string>(DREHUNG);
	await browser.klicken(ERSTER_GRIFF);
	const drehungZu = await browser.auswerten<string>(DREHUNG);
	await browser.klicken(ERSTER_GRIFF);
	const wiederOffen = await browser.auswerten<boolean>(
		`return document.querySelector('${ERSTER_GRIFF}').parentElement.open;`
	);
	pruefen(
		'das Zeichen steht zugeklappt anders als aufgeklappt — und der Abschnitt steht danach wieder offen',
		drehungOffen !== drehungZu && wiederOffen,
		`offen ${drehungOffen}, zu ${drehungZu}, danach offen: ${wiederOffen}`
	);

	// -----------------------------------------------------------------------
	// /wellness: das Tagebuch gebündelt, und eine Abweisung findet ihr Feld
	// -----------------------------------------------------------------------
	/*
	 * **Die Bündelung nach Beet > Kultur > Mittel** (spec-wellness-tagebuch-
	 * gebuendelt.md, 2026-10-12). Welche Zeilen zu welcher Karte gehören, prüft
	 * `smoke` an `buendeln` selbst; hier gemessen wird, was nur gerendert zu
	 * sehen ist: was offen steht, was die Mittelzeile sagt, wie die Einträge
	 * aufgehen, und ob eine Abweisung oder Rückfrage in einem **zugeklappten**
	 * Beet ihr Ziel noch findet — ohne JavaScript über das Server-HTML, mit
	 * JavaScript über `aufklappen` in `versand`.
	 *
	 * Die Saat (scripts/pruefserver.ts) trägt vier Behandlungen in drei Beeten:
	 * zweimal Schachtelhalmbrühe in Beet 7, Brennnesseljauche in Hochbeet 3,
	 * Kompost ohne Ort. **Die Reihenfolge der Beete ist hier ausgeschrieben** und
	 * nicht aus der Saat gerechnet: sie aus den Ortsnamen herzuleiten hiesse,
	 * `natuerlich` ein zweites Mal zu schreiben. Was jede Mittelzeile sagen muss,
	 * kommt dagegen aus der Saat — Anzahl, Wiederholung der jüngsten, und die
	 * Gruppe, in der sie steht.
	 *
	 * Die Abweisung und die Rückfrage gehen an das **zweite** Beet: das erste
	 * steht ohnehin offen, und eine Zusage über das Öffnen wäre dort grün, ohne
	 * etwas zu belegen.
	 *
	 * Gemessen wird über `checkVisibility()` — aus dem Grund, der bei /archiv
	 * steht: unter einem zugeklappten `<details>` behalten die Nachkommen in
	 * Chrome ihre Rechtecke.
	 *
	 * **Die vorgeführten Mutationen** stehen im Spec Change Log der Spec, je
	 * Behauptung mit dem, was rot wurde.
	 */
	const BEETE_DER_SAAT = ['Beet 7', 'Hochbeet 3', 'Ohne Beet'];
	await browser.besuchen(`${adresse}/wellness`);
	const tagebuchStand = await browser.auswerten<{
		beete: string[];
		offen: boolean[];
		karten: { beet: string; kultur: string; mittel: string; hinweis: string }[];
		eintraegeSichtbar: boolean;
		zweitesSichtbar: boolean;
		griffHoehen: number[];
	}>(`
		const beete = [...document.querySelectorAll('section.tagebuch details.abschnitt')];
		const karten = beete.flatMap((beet) =>
			[...beet.querySelectorAll('.karte')].map((karte) => {
				const marke = document.getElementById(karte.closest('ul').getAttribute('aria-labelledby'));
				return {
					beet: beet.querySelector('summary').textContent.trim(),
					kultur: marke === null ? '(ohne Marke)' : marke.textContent.trim(),
					mittel: karte.querySelector('.zeile__text').textContent.trim(),
					hinweis: karte.querySelector('.hinweis--ziffern').textContent.replace(/\\s+/g, ' ').trim(),
				};
			})
		);
		const erste = beete[0] ?? null;
		return {
			beete: beete.map((d) => d.querySelector('summary').textContent.trim()),
			offen: beete.map((d) => d.open),
			karten,
			eintraegeSichtbar: erste?.querySelector('.eintraege__zeile')?.checkVisibility() ?? true,
			zweitesSichtbar: beete[1]?.querySelector('.karte .zeile__text')?.checkVisibility() ?? true,
			griffHoehen: [...(erste?.querySelectorAll('details.eintraege > summary') ?? [])].map((g) =>
				Math.round(g.getBoundingClientRect().height)
			),
		};`);
	pruefenGleich(
		'/wellness: die Beete stehen in der Ordnung der Saat da, das erste offen, die übrigen zu',
		tagebuchStand.beete
			.map((beet, stelle) => `${beet} ${tagebuchStand.offen[stelle] ? 'offen' : 'zu'}`)
			.join(' | '),
		BEETE_DER_SAAT.map((beet, stelle) => `${beet} ${stelle === 0 ? 'offen' : 'zu'}`).join(' | ')
	);

	/*
	 * **Je Stelle der Saat genau eine Karte**, und ihre Zeile genau so, wie die
	 * Spec sie vorschreibt: `zuletzt {Datum} · {n}×`, und ` · alle {x} Tage` nur,
	 * wenn die jüngste Anwendung eine Wiederholung trägt. Das Datum wird nur der
	 * Form nach gelesen — es hängt am Tag des Laufs. Der Kompost ohne
	 * Wiederholung ist die Karte, an der ein immer gerenderter Anhang auffällt;
	 * die Schachtelhalmbrühe die, an der die Anzahl über 1 steht.
	 */
	const stellenDerSaat = new Map<
		string,
		{
			beet: string;
			kultur: string;
			mittel: string;
			anzahl: number;
			tage: number;
			intervallTage: number | null;
		}
	>();
	for (const behandlung of saat.behandlungen) {
		const schluessel = JSON.stringify([behandlung.mittel, behandlung.kultur, behandlung.ort]);
		const bisher = stellenDerSaat.get(schluessel);
		if (bisher === undefined) {
			stellenDerSaat.set(schluessel, {
				beet: behandlung.ort ?? 'Ohne Beet',
				kultur: behandlung.kultur ?? 'Ohne Kultur',
				mittel: behandlung.mittel,
				anzahl: 1,
				tage: behandlung.tage,
				intervallTage: behandlung.intervallTage,
			});
		} else {
			bisher.anzahl += 1;
			if (behandlung.tage < bisher.tage) {
				bisher.tage = behandlung.tage;
				bisher.intervallTage = behandlung.intervallTage;
			}
		}
	}
	const DATUM_FORM = String.raw`\d{1,2}\. \S+ \d{4}`;
	const mittelzeilenBefunde = [...stellenDerSaat.values()].flatMap((stelle) => {
		const gefunden = tagebuchStand.karten.filter(
			(karte) =>
				karte.beet === stelle.beet &&
				karte.kultur === stelle.kultur &&
				karte.mittel === stelle.mittel
		);
		const anhang = stelle.intervallTage === null ? '' : ` · alle ${stelle.intervallTage} Tage`;
		const form = new RegExp(`^zuletzt ${DATUM_FORM} · ${stelle.anzahl}×${anhang}$`);
		if (gefunden.length !== 1)
			return [`${stelle.mittel} in ${stelle.beet}: ${gefunden.length} Karten`];
		return form.test(gefunden[0].hinweis)
			? []
			: [`${stelle.mittel}: ${JSON.stringify(gefunden[0].hinweis)}`];
	});
	pruefen(
		`/wellness: je Stelle der Saat genau eine Karte, und ihre Zeile trägt Anzahl und — nur wenn gesetzt — die Wiederholung (${stellenDerSaat.size} Stellen, ${tagebuchStand.karten.length} Karten)`,
		mittelzeilenBefunde.length === 0 && tagebuchStand.karten.length === stellenDerSaat.size,
		mittelzeilenBefunde.join(' | ') || JSON.stringify(tagebuchStand.karten)
	);
	pruefen(
		'/wellness: die Einträge stehen erst nach dem Aufklappen da, und das zweite Beet ist zu',
		!tagebuchStand.eintraegeSichtbar && !tagebuchStand.zweitesSichtbar,
		JSON.stringify({
			eintraege: tagebuchStand.eintraegeSichtbar,
			zweitesBeet: tagebuchStand.zweitesSichtbar,
		})
	);
	pruefen(
		`/wellness: jeder Einträge-Griff im ersten Beet ist mindestens ${TREFFER_MINIMUM}px hoch`,
		tagebuchStand.griffHoehen.length > 0 &&
			tagebuchStand.griffHoehen.every((hoehe) => hoehe >= TREFFER_MINIMUM),
		`Höhen: ${tagebuchStand.griffHoehen.join(', ') || '(kein Griff)'}`
	);

	/*
	 * **Der Einträge-Griff ist ein `.zeilenform__griff` ausserhalb einer
	 * `.zeilenform`.** Die Drehung des Winkels hängt im Blatt an
	 * `details[open] > .zeilenform__griff .aufklapp` und damit am `<details>`
	 * irgendeiner Klasse; das wird hier gemessen statt angenommen. Geöffnet
	 * wird die Karte mit mehr als einem Eintrag — nur dort gibt es eine Linie
	 * **zwischen** zwei Einträgen, und die erste Zeile darf keine tragen: sie
	 * läge direkt unter dem Griff.
	 */
	const MEHRFACH_GRIFF = await browser.auswerten<string>(`
		const karten = [...document.querySelectorAll('section.tagebuch details.abschnitt[open] .karte')];
		const karte = karten.find((k) => k.querySelectorAll('.eintraege__zeile').length > 1);
		if (karte === undefined) return '';
		karte.querySelector('details.eintraege').id = 'mehrfach-eintraege';
		return '#mehrfach-eintraege > summary';`);
	pruefen(
		'/wellness: im ersten Beet steht eine Karte mit mehr als einem Eintrag',
		MEHRFACH_GRIFF !== '',
		'keine Karte mit zwei Einträgen im offenen Beet — die Saat trägt keine zweite Anwendung mehr?'
	);
	if (MEHRFACH_GRIFF !== '') {
		const winkel = `return getComputedStyle(document.querySelector('${MEHRFACH_GRIFF} .aufklapp')).transform;`;
		const winkelZu = await browser.auswerten<string>(winkel);
		await browser.klicken(MEHRFACH_GRIFF);
		const winkelOffen = await browser.auswerten<string>(winkel);
		const linien = await browser.auswerten<string[]>(`
			return [...document.querySelectorAll('#mehrfach-eintraege .eintraege__zeile')].map(
				(zeile) => getComputedStyle(zeile).borderTopWidth
			);`);
		pruefen(
			'/wellness: der Winkel am Einträge-Griff dreht sich beim Aufklappen',
			winkelZu !== winkelOffen,
			`zu ${winkelZu}, offen ${winkelOffen}`
		);
		pruefen(
			'/wellness: die Einträge sind nur untereinander getrennt — keine Linie über dem ersten, eine über jedem weiteren',
			linien.length > 1 &&
				parseFloat(linien[0]) === 0 &&
				linien.slice(1).every((breite) => parseFloat(breite) > 0),
			`Linien oben: ${linien.join(', ')}`
		);
	}

	/*
	 * Das Ziel im zweiten Beet: das Mittelfeld des Ändern-Formulars seiner
	 * ersten Zeile. Fehlt das Beet oder das Feld, endet das hier als benannte
	 * rote Behauptung und nicht als Wurf an einer Null — und die Messungen
	 * darunter laufen nicht, was die Schlusszählung zusätzlich rot macht.
	 */
	const ziel = await browser.auswerten<{ feld: string; id: string; wert: string } | null>(`
		const beet = document.querySelectorAll('section.tagebuch details.abschnitt')[1];
		const feld = beet?.querySelector('input[name="mittel"][id^="aendern-"]') ?? null;
		if (feld === null) return null;
		return {
			feld: feld.id,
			id: feld.form.querySelector('input[name="id"]').value,
			wert: feld.value,
		};`);
	pruefen(
		'/wellness: das zweite Beet trägt eine Zeile mit Ändern-Formular',
		ziel !== null,
		'kein zweites Beet oder kein Feld aendern-…-mittel darin'
	);

	if (ziel !== null) {
		const zielFeld = JSON.stringify(ziel.feld);
		const frageKennung = JSON.stringify(`wegnehmen-frage-${ziel.id}`);

		/*
		 * **Ohne JavaScript** — das zweite Abnahmekriterium der Spec. Ein POST
		 * ohne den Kopf von `use:enhance` bekommt von SvelteKit die ganze Seite
		 * zurück, genau die, die ein Browser ohne Skript anzeigen würde. Gelesen
		 * wird das zurückgekommene HTML: die umgebenden `<details>` müssen das
		 * Attribut `open` tragen — **vom Server**, denn ohne Skript gibt es
		 * niemanden sonst, der es setzte.
		 *
		 * Der Weg über `window` hat einen Grund im Messkopf: `auswerten` reicht
		 * einen Wert über `JSON.stringify` zurück, und ein Promise ergäbe dort
		 * `{}`. Die Antwort wird darum abgelegt und mit `warten` abgeholt.
		 */
		const ohneSkript = async (
			aktion: 'aendern' | 'wegnehmen',
			ankerKennung: string
		): Promise<{
			beet: boolean;
			mittel: boolean;
			formular: boolean;
			anker: boolean;
			fehler: string;
		}> => {
			await browser!.auswerten(`
				const feld = document.getElementById(${zielFeld});
				let daten;
				if (${JSON.stringify(aktion)} === 'aendern') {
					daten = new FormData(feld.form);
					daten.set('mittel', '   ');
				} else {
					daten = new FormData();
					daten.set('id', ${JSON.stringify(ziel.id)});
				}
				window.__ohneSkript = undefined;
				fetch('?/' + ${JSON.stringify(aktion)}, { method: 'POST', body: daten, headers: { accept: 'text/html' } })
					.then((antwort) => antwort.text())
					.then((html) => { window.__ohneSkript = html; })
					.catch((fehler) => { window.__ohneSkript = 'Wurf: ' + fehler; });
				return true;`);
			await browser!.warten(
				"typeof window.__ohneSkript === 'string'",
				`die Antwort auf ?/${aktion} ohne Skript ist da`
			);
			return browser!.auswerten(`
				const dok = new DOMParser().parseFromString(window.__ohneSkript, 'text/html');
				const anker = dok.getElementById(${JSON.stringify(ankerKennung)});
				if (anker === null) return { beet: false, mittel: false, formular: false, anker: false, fehler: '' };
				return {
					beet: anker.closest('details.abschnitt')?.hasAttribute('open') ?? false,
					mittel: anker.closest('details.eintraege')?.hasAttribute('open') ?? false,
					formular: anker.closest('details.zeilenform')?.hasAttribute('open') ?? false,
					anker: true,
					fehler: dok.getElementById(${JSON.stringify(ziel.feld + '-fehler')})?.textContent.trim() ?? '',
				};`);
		};

		const abweisungOhneSkript = await ohneSkript('aendern', ziel.feld);
		pruefen(
			'ohne JavaScript kommt eine Abweisung in einem zugeklappten Beet mit offenem Beet, offenem Mittel und offenem Formular zurück',
			abweisungOhneSkript.anker &&
				abweisungOhneSkript.beet &&
				abweisungOhneSkript.mittel &&
				abweisungOhneSkript.formular &&
				abweisungOhneSkript.fehler !== '',
			JSON.stringify(abweisungOhneSkript)
		);
		const rueckfrageOhneSkript = await ohneSkript('wegnehmen', `wegnehmen-frage-${ziel.id}`);
		pruefen(
			'ohne JavaScript kommt die Wegnehmen-Rückfrage in einem zugeklappten Beet mit offenem Beet und offenem Mittel zurück',
			rueckfrageOhneSkript.anker && rueckfrageOhneSkript.beet && rueckfrageOhneSkript.mittel,
			JSON.stringify(rueckfrageOhneSkript)
		);

		/*
		 * **Mit JavaScript.** Abgeschickt wird über `requestSubmit()`, also durch
		 * `use:enhance`. Gewartet wird nicht auf einen Text — bei der zweiten
		 * Abweisung steht derselbe Fehlersatz schon da —, sondern darauf, dass
		 * `imFlug` einmal gesetzt und wieder gelöst war: abgelesen am Knopf
		 * `Eintragen`, der als einziger Knopf der Seite immer dasteht und
		 * `disabled={imFlug}` trägt. Zwei Bildaufbauten danach, damit der Fokus
		 * nach `tick()` gesetzt ist.
		 */
		const abschickenUndAbwarten = async (ausloeser: string, was: string): Promise<void> => {
			await browser!.auswerten(`
				window.__durch = false;
				const knopf = document.querySelector('form[action="?/eintragen"] button[type="submit"]');
				let gesperrt = false;
				const beobachter = new MutationObserver(() => {
					if (knopf.disabled) gesperrt = true;
					else if (gesperrt) {
						beobachter.disconnect();
						requestAnimationFrame(() => requestAnimationFrame(() => { window.__durch = true; }));
					}
				});
				beobachter.observe(knopf, { attributes: true, attributeFilter: ['disabled'] });
				${ausloeser}
				return true;`);
			await browser!.warten('window.__durch === true', was);
		};
		const ZUKLAPPEN = `
			document.getElementById(${zielFeld}).closest('details.abschnitt').open = false;
			document.getElementById(${zielFeld}).closest('details.eintraege').open = false;
			document.activeElement?.blur();`;
		const kette = () =>
			browser!.auswerten<{
				beet: boolean;
				mittel: boolean;
				formular: boolean;
				fokus: string;
				sichtbar: boolean;
			}>(`
				const feld = document.getElementById(${zielFeld});
				return {
					beet: feld.closest('details.abschnitt').open,
					mittel: feld.closest('details.eintraege').open,
					formular: feld.closest('details.zeilenform').open,
					fokus: document.activeElement?.id ?? '(keins)',
					sichtbar: feld.checkVisibility(),
				};`);
		const kettePasst = (stand: Awaited<ReturnType<typeof kette>>) =>
			stand.beet && stand.mittel && stand.formular && stand.sichtbar && stand.fokus === ziel.feld;

		/*
		 * **(a) Eine Abweisung in einem von Hand zugeklappten Beet**, zweimal
		 * hintereinander. Die zweite ist der Fall aus dem Review: das Markup
		 * hätte dort true auf true gesetzt und damit nichts getan.
		 */
		await browser.auswerten(`${ZUKLAPPEN} return true;`);
		await abschickenUndAbwarten(
			`const feld = document.getElementById(${zielFeld}); feld.value = '   '; feld.form.requestSubmit();`,
			'die erste Abweisung mit JavaScript ist zurück'
		);
		const ersteAbweisung = await kette();
		pruefen(
			'mit JavaScript öffnet eine Abweisung im zugeklappten Beet Beet, Mittel und Formular, und der Fokus liegt im Feld',
			kettePasst(ersteAbweisung),
			`${JSON.stringify(ersteAbweisung)}, erwartet Fokus auf ${ziel.feld}`
		);
		await browser.auswerten(`${ZUKLAPPEN} return true;`);
		await abschickenUndAbwarten(
			`const feld = document.getElementById(${zielFeld}); feld.value = '   '; feld.form.requestSubmit();`,
			'die zweite Abweisung mit JavaScript ist zurück'
		);
		const zweiteAbweisung = await kette();
		pruefen(
			'und eine zweite Abweisung, nachdem das Beet wieder von Hand zugeklappt wurde, öffnet die Kette erneut',
			kettePasst(zweiteAbweisung),
			`${JSON.stringify(zweiteAbweisung)}, erwartet Fokus auf ${ziel.feld}`
		);

		/*
		 * **(b) Ein geglücktes Ändern klappt nichts zu.** Abgeschickt wird mit
		 * dem ursprünglichen Mittel, abgelesen vor der ersten Abweisung, also ohne
		 * die Saat zu verändern — spätere Messungen auf /archiv lesen sie noch.
		 * Nicht über `defaultValue`: Svelte setzt `value` als Eigenschaft, das
		 * Attribut bleibt leer, und das `required` hielte den Versand still an.
		 */
		await abschickenUndAbwarten(
			`const feld = document.getElementById(${zielFeld}); feld.value = ${JSON.stringify(ziel.wert)}; feld.form.requestSubmit();`,
			'das geglückte Ändern ist zurück'
		);
		const nachErfolg = await browser.auswerten<{
			beet: boolean;
			mittel: boolean;
			meldung: string;
		}>(`
			const feld = document.getElementById(${zielFeld});
			return {
				beet: feld.closest('details.abschnitt').open,
				mittel: feld.closest('details.eintraege').open,
				meldung: document.querySelector('.meldung').textContent.trim(),
			};`);
		pruefen(
			'nach einem geglückten Ändern im zweiten Beet bleiben Beet und Mittel offen',
			nachErfolg.beet && nachErfolg.mittel && nachErfolg.meldung !== '',
			JSON.stringify(nachErfolg)
		);

		/*
		 * **Die Rückfrage mit JavaScript**, wieder aus einem zugeklappten Beet.
		 * Kein Fokussprung (Entscheid wie auf /ernte), aber die Frage muss zu
		 * sehen sein — sonst steht eine Frage, die niemand findet, und alle
		 * anderen Knöpfe der Zeile sind fort.
		 */
		await browser.auswerten(`${ZUKLAPPEN} return true;`);
		await abschickenUndAbwarten(
			`[...document.querySelectorAll('form[action="?/wegnehmen"]')]
				.find((f) => f.querySelector('input[name="id"]').value === ${JSON.stringify(ziel.id)} &&
					f.querySelector('input[name="bestaetigt"]') === null)
				.requestSubmit();`,
			'die Rückfrage mit JavaScript ist zurück'
		);
		const rueckfrage = await browser.auswerten<{
			da: boolean;
			sichtbar: boolean;
			beet: boolean;
			mittel: boolean;
		}>(`
			const frage = document.getElementById(${frageKennung});
			if (frage === null) return { da: false, sichtbar: false, beet: false, mittel: false };
			return {
				da: true,
				sichtbar: frage.checkVisibility(),
				beet: frage.closest('details.abschnitt').open,
				mittel: frage.closest('details.eintraege').open,
			};`);
		pruefen(
			'mit JavaScript öffnet die Wegnehmen-Rückfrage im zugeklappten Beet Beet und Mittel, und die Frage ist zu sehen',
			rueckfrage.da && rueckfrage.sichtbar && rueckfrage.beet && rueckfrage.mittel,
			JSON.stringify(rueckfrage)
		);
	}

	// -----------------------------------------------------------------------
	// /wellness: eine Kultur abschliessen und rückgängig machen
	// -----------------------------------------------------------------------
	/*
	 * **Abschliessen am Kulturtitel, Rückgängig in der Meldung**
	 * (spec-wellness-abschliessen-ins-archiv.md, 2026-10-12) — mit und ohne
	 * JavaScript. Was die Abfrageschicht und die actions dabei tun, prüft
	 * `smoke` je Zeile der Matrix; hier gemessen wird, was gerendert zu sehen
	 * ist: die Kultur fort aus Tagebuch und `Steht wieder an`, die Meldung,
	 * der Knopf, und dass er das nächste Laden nicht überlebt.
	 *
	 * Ziel ist die **überfällige** Stelle der Saat (die erste Behandlung,
	 * Schachtelhalmbrühe an den Tomaten in Beet 7): sie allein füllt `Steht
	 * wieder an`, und ihr Abschluss lässt den Abschnitt darum ganz verschwinden.
	 * Jeder Teil endet mit `Rückgängig`, damit die Saat danach wieder so
	 * dasteht wie vorher — der Kontrast-Sweep unten liest /wellness noch.
	 */
	const ABSCHLUSS_ZIEL = saat.behandlungen[0];
	const zielOrt = JSON.stringify(ABSCHLUSS_ZIEL.ort ?? '');
	const zielKultur = JSON.stringify(ABSCHLUSS_ZIEL.kultur ?? '');
	/*
	 * **Die Rückfrage vor dem Abschliessen** (nachverhandelt am 12.10.2026,
	 * Manuel) wird zusätzlich an der Kultur des **zweiten** Beets gemessen
	 * (Brennnesseljauche an Kohlrabi in Hochbeet 3, die zweite Behandlung der
	 * Saat): jenes Beet steht zugeklappt, und nur dort belegt ein offenes Beet
	 * etwas — das erste steht ohnehin offen.
	 */
	const FRAGE_ZIEL = saat.behandlungen[1];
	const zweitKultur = JSON.stringify(FRAGE_ZIEL.kultur ?? 'Ohne Kultur');
	const erwarteteFrage = `${FRAGE_ZIEL.kultur ?? 'Ohne Kultur'} in ${FRAGE_ZIEL.ort ?? 'Ohne Beet'} abschliessen? Die Behandlungen verschwinden von hier und stehen danach im Archiv.`;
	const erwarteteMeldung = `Abgeschlossen: ${ABSCHLUSS_ZIEL.kultur ?? 'Ohne Kultur'}, ${ABSCHLUSS_ZIEL.ort ?? 'Ohne Beet'}.`;
	const erwarteteRueckmeldung = `Wieder offen: ${ABSCHLUSS_ZIEL.kultur ?? 'Ohne Kultur'}, ${ABSCHLUSS_ZIEL.ort ?? 'Ohne Beet'}.`;
	/**
	 * Liest aus einem Dokument (`document` oder ein geparstes), was diese
	 * Messungen brauchen. **Jeder Zugriff auf ein Feld ist abgesichert**: fehlt
	 * ein Formular oder ein Feld, kommt `false` oder null zurück und die
	 * Behauptung darunter wird benannt rot, statt dass der Lauf an einem
	 * TypeError im Browser endet.
	 */
	const STAND_LESEN = `
		const stand = (dok) => {
			const kulturForm = [...dok.querySelectorAll('form[action="?/abschliessen"]')].find(
				(f) => f.querySelector('input[name="ort"]')?.value === ${zielOrt} &&
					f.querySelector('input[name="kultur"]')?.value === ${zielKultur}
			);
			const rueck = dok.querySelector('form[action="?/zuruecknehmen"]');
			const frage = dok.getElementById('abschliessen-frage');
			const knoepfe = frage?.parentElement?.querySelector('.knoepfe') ?? null;
			const erstes = knoepfe?.firstElementChild ?? null;
			const bestaetigen = knoepfe?.querySelector('form[action="?/abschliessen"]') ?? null;
			return {
				frage: {
					text: frage === null ? null : frage.textContent.replace(/\\s+/g, ' ').trim(),
					beetOffen: frage?.closest('details.abschnitt')?.hasAttribute('open') ?? false,
					sichtbar: frage !== null && dok === document ? frage.checkVisibility() : false,
					abbrechenZuerst:
						erstes?.tagName === 'A'
							? new URL(erstes.getAttribute('href'), location.href).pathname
							: null,
					ort: bestaetigen?.querySelector('input[name="ort"]')?.value ?? null,
					kultur: bestaetigen?.querySelector('input[name="kultur"]')?.value ?? null,
					bestaetigt: bestaetigen?.querySelector('input[name="bestaetigt"]')?.value ?? null,
				},
				zweitKultur: [...dok.querySelectorAll('h4.marke')].some((h) => h.textContent.trim() === ${zweitKultur}),
				kultur: kulturForm !== undefined,
				anstehend: dok.getElementById('anstehend-marke') !== null,
				meldung: dok.querySelector('.meldung')?.textContent.trim() ?? '',
				rueckgaengig: rueck === null ? null : Object.fromEntries(new FormData(rueck)),
			};
		};`;
	type Abschlussstand = {
		frage: {
			text: string | null;
			beetOffen: boolean;
			sichtbar: boolean;
			abbrechenZuerst: string | null;
			ort: string | null;
			kultur: string | null;
			bestaetigt: string | null;
		};
		zweitKultur: boolean;
		kultur: boolean;
		anstehend: boolean;
		meldung: string;
		rueckgaengig: Record<string, string> | null;
	};
	const ohneSkriptSenden = async (
		aktion: 'abschliessen' | 'zuruecknehmen',
		felder: Record<string, string>
	): Promise<Abschlussstand> => {
		await browser!.auswerten(`
			const daten = new FormData();
			for (const [name, wert] of Object.entries(${JSON.stringify(felder)})) daten.set(name, wert);
			window.__ohneSkript = undefined;
			fetch('?/' + ${JSON.stringify(aktion)}, { method: 'POST', body: daten, headers: { accept: 'text/html' } })
				.then((antwort) => antwort.text())
				.then((html) => { window.__ohneSkript = html; })
				.catch((fehler) => { window.__ohneSkript = 'Wurf: ' + fehler; });
			return true;`);
		await browser!.warten(
			"typeof window.__ohneSkript === 'string'",
			`die Antwort auf ?/${aktion} ohne Skript ist da`
		);
		return browser!.auswerten<Abschlussstand>(`${STAND_LESEN}
			return stand(new DOMParser().parseFromString(window.__ohneSkript, 'text/html'));`);
	};

	await browser.besuchen(`${adresse}/wellness`);
	const vorAbschluss = await browser.auswerten<Abschlussstand>(
		`${STAND_LESEN} return stand(document);`
	);

	/*
	 * **Der Knopf `Abschliessen` heisst überall gleich** — sein zugänglicher
	 * Name ist das Wort. Unterscheidbar wird er über die Beschreibung, und die
	 * muss Kultur **und** Beet nennen: Tomaten in Beet 3 und in Beet 7 dürfen
	 * nicht gleich klingen. Gemessen wird die aufgelöste Beschreibung
	 * (`aria-describedby` → Texte der Ziele), dazu, dass jedes Formular beide
	 * versteckten Felder trägt. Vorgeführt: die Beet-Kennung aus
	 * `aria-describedby` genommen — die Beschreibung des Ziels hiesse dann nur
	 * `Tomaten`.
	 */
	const abschliessenKnoepfe = await browser.auswerten<
		{ felder: boolean; beschreibung: string; ort: string | null; kultur: string | null }[]
	>(`
		return [...document.querySelectorAll('form[action="?/abschliessen"]')].map((f) => {
			const knopf = f.querySelector('button');
			const ids = (knopf?.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean);
			return {
				felder: f.querySelector('input[name="ort"]') !== null && f.querySelector('input[name="kultur"]') !== null,
				beschreibung: ids.map((id) => document.getElementById(id)?.textContent.trim() ?? '?').join(' '),
				ort: f.querySelector('input[name="ort"]')?.value ?? null,
				kultur: f.querySelector('input[name="kultur"]')?.value ?? null,
			};
		});`);
	const zielBeschreibung = abschliessenKnoepfe.find(
		(knopf) =>
			knopf.ort === (ABSCHLUSS_ZIEL.ort ?? '') && knopf.kultur === (ABSCHLUSS_ZIEL.kultur ?? '')
	)?.beschreibung;
	pruefen(
		'/wellness: jeder Knopf Abschliessen trägt Ort und Kultur und eine eindeutige Beschreibung aus Kultur und Beet',
		abschliessenKnoepfe.length > 0 &&
			abschliessenKnoepfe.every((knopf) => knopf.felder) &&
			new Set(abschliessenKnoepfe.map((knopf) => knopf.beschreibung)).size ===
				abschliessenKnoepfe.length &&
			zielBeschreibung ===
				`${ABSCHLUSS_ZIEL.kultur ?? 'Ohne Kultur'} ${ABSCHLUSS_ZIEL.ort ?? 'Ohne Beet'}`,
		JSON.stringify(abschliessenKnoepfe)
	);

	/*
	 * **Ohne JavaScript.** Der POST trägt genau die zwei versteckten Felder des
	 * Formulars am Kulturtitel; die Antwort ist die ganze Seite, wie ein
	 * Browser ohne Skript sie zeigte.
	 */
	const ohneSkriptHolen = async (pfad: string): Promise<Abschlussstand> => {
		await browser!.auswerten(`
			window.__neuGeladen = undefined;
			fetch(${JSON.stringify(pfad)}, { headers: { accept: 'text/html' } })
				.then((antwort) => antwort.text())
				.then((html) => { window.__neuGeladen = html; })
				.catch((fehler) => { window.__neuGeladen = 'Wurf: ' + fehler; });
			return true;`);
		await browser!.warten("typeof window.__neuGeladen === 'string'", `${pfad} ist geholt`);
		return browser!.auswerten<Abschlussstand>(`${STAND_LESEN}
			return stand(new DOMParser().parseFromString(window.__neuGeladen, 'text/html'));`);
	};

	/*
	 * **Der erste Klick fragt nur**, ohne JavaScript: ein POST ohne
	 * `bestaetigt`. Die Antwort trägt die Frage an der Kultur, das sonst
	 * zugeklappte Beet steht offen (vom Server, sonst gibt es niemanden, der
	 * es öffnete), `Abbrechen` steht zuerst und ist ein Link, und der
	 * Bestätigen-Knopf schickt `bestaetigt=1`. Abgeschlossen ist nichts: die
	 * Kultur steht da, und die Tomaten mahnen weiter unter `Steht wieder an`.
	 */
	const ohneSkriptFrage = await ohneSkriptSenden('abschliessen', {
		ort: FRAGE_ZIEL.ort ?? '',
		kultur: FRAGE_ZIEL.kultur ?? '',
	});
	pruefen(
		'ohne JavaScript: der erste Klick fragt nur — Frage an der Kultur im offenen Beet, Abbrechen zuerst, Bestätigen mit bestaetigt=1, nichts abgeschlossen',
		ohneSkriptFrage.frage.text === erwarteteFrage &&
			ohneSkriptFrage.frage.beetOffen &&
			ohneSkriptFrage.frage.abbrechenZuerst === '/wellness' &&
			ohneSkriptFrage.frage.bestaetigt === '1' &&
			ohneSkriptFrage.zweitKultur &&
			ohneSkriptFrage.kultur &&
			ohneSkriptFrage.anstehend &&
			ohneSkriptFrage.meldung === '',
		JSON.stringify(ohneSkriptFrage)
	);
	/*
	 * **Abbrechen** ist ein Link und holt die Seite neu: danach keine Frage, und
	 * die Kultur steht offen da.
	 */
	const ohneSkriptAbgebrochen = await ohneSkriptHolen(
		ohneSkriptFrage.frage.abbrechenZuerst ?? '/wellness'
	);
	pruefen(
		'ohne JavaScript: Abbrechen lässt alles offen — keine Frage, die Kultur steht da',
		ohneSkriptAbgebrochen.frage.text === null &&
			ohneSkriptAbgebrochen.zweitKultur &&
			ohneSkriptAbgebrochen.kultur &&
			ohneSkriptAbgebrochen.anstehend,
		JSON.stringify(ohneSkriptAbgebrochen)
	);

	/*
	 * **Die Bestätigung schliesst ab** — mit genau den Feldern, die das
	 * Bestätigen-Formular der Frage trägt. Fehlt dort `bestaetigt`, fragt die
	 * action ein zweites Mal, und die Behauptung darunter ist rot.
	 */
	const ohneSkriptTomatenFrage = await ohneSkriptSenden('abschliessen', {
		ort: ABSCHLUSS_ZIEL.ort ?? '',
		kultur: ABSCHLUSS_ZIEL.kultur ?? '',
	});
	const bestaetigungsfelder: Record<string, string> = {
		ort: ohneSkriptTomatenFrage.frage.ort ?? '',
		kultur: ohneSkriptTomatenFrage.frage.kultur ?? '',
	};
	if (ohneSkriptTomatenFrage.frage.bestaetigt !== null) {
		bestaetigungsfelder.bestaetigt = ohneSkriptTomatenFrage.frage.bestaetigt;
	}
	const ohneSkriptAbgeschlossen = await ohneSkriptSenden('abschliessen', bestaetigungsfelder);
	pruefen(
		'ohne JavaScript: die Bestätigung schliesst ab — die Kultur ist fort aus Tagebuch und `Steht wieder an`, gemeldet, mit Rückgängig',
		vorAbschluss.kultur &&
			vorAbschluss.anstehend &&
			!ohneSkriptAbgeschlossen.kultur &&
			!ohneSkriptAbgeschlossen.anstehend &&
			ohneSkriptAbgeschlossen.meldung === erwarteteMeldung &&
			ohneSkriptAbgeschlossen.rueckgaengig !== null,
		JSON.stringify({ vorher: vorAbschluss, nachher: ohneSkriptAbgeschlossen })
	);

	/*
	 * **Der Knopf überlebt das nächste Laden nicht** — und die Kultur bleibt
	 * dabei abgeschlossen. Gelesen über ein GET derselben Seite.
	 */
	await browser.auswerten(`
		window.__neuGeladen = undefined;
		fetch(location.pathname, { headers: { accept: 'text/html' } })
			.then((antwort) => antwort.text())
			.then((html) => { window.__neuGeladen = html; })
			.catch((fehler) => { window.__neuGeladen = 'Wurf: ' + fehler; });
		return true;`);
	await browser.warten("typeof window.__neuGeladen === 'string'", 'die Seite ist neu geladen');
	const neuGeladen = await browser.auswerten<Abschlussstand>(`${STAND_LESEN}
		return stand(new DOMParser().parseFromString(window.__neuGeladen, 'text/html'));`);
	pruefen(
		'nach dem nächsten Laden ist Rückgängig fort, und die Kultur bleibt abgeschlossen',
		neuGeladen.rueckgaengig === null && !neuGeladen.kultur && neuGeladen.meldung === '',
		JSON.stringify(neuGeladen)
	);

	const ohneSkriptZurueck = await ohneSkriptSenden(
		'zuruecknehmen',
		ohneSkriptAbgeschlossen.rueckgaengig ?? {}
	);
	pruefen(
		'ohne JavaScript: Rückgängig bringt die Kultur und `Steht wieder an` zurück, und der Knopf ist fort',
		ohneSkriptZurueck.kultur &&
			ohneSkriptZurueck.anstehend &&
			ohneSkriptZurueck.meldung === erwarteteRueckmeldung &&
			ohneSkriptZurueck.rueckgaengig === null,
		JSON.stringify(ohneSkriptZurueck)
	);

	/*
	 * **Mit JavaScript**, über `requestSubmit()` und damit durch `use:enhance`.
	 * Gewartet wird wie oben auf das Lösen von `imFlug`, abgelesen am Knopf
	 * `Eintragen`. Die Seite ist frisch geladen, damit der Stand der Messungen
	 * ohne Skript — die nur Antworten lasen — hier nichts verdeckt.
	 */
	await browser.besuchen(`${adresse}/wellness`);
	const mitSkriptSenden = async (ausloeser: string, was: string): Promise<void> => {
		await browser!.auswerten(`
			window.__durch = false;
			const knopf = document.querySelector('form[action="?/eintragen"] button[type="submit"]');
			let gesperrt = false;
			const beobachter = new MutationObserver(() => {
				if (knopf.disabled) gesperrt = true;
				else if (gesperrt) {
					beobachter.disconnect();
					requestAnimationFrame(() => requestAnimationFrame(() => { window.__durch = true; }));
				}
			});
			beobachter.observe(knopf, { attributes: true, attributeFilter: ['disabled'] });
			${ausloeser}
			return true;`);
		await browser!.warten('window.__durch === true', was);
	};
	/*
	 * Fehlt das Formular, wird nichts abgeschickt und das Warten sofort gelöst
	 * — die Behauptung darunter ist dann rot und benannt, statt dass der Lauf
	 * an einem TypeError oder einer Zeitüberschreitung endet.
	 */
	const kopfformular = (ort: string, kultur: string) =>
		`const ziel = [...document.querySelectorAll('form[action="?/abschliessen"]')]
			.find((f) => f.querySelector('input[name="bestaetigt"]') === null &&
				f.querySelector('input[name="ort"]')?.value === ${JSON.stringify(ort)} &&
				f.querySelector('input[name="kultur"]')?.value === ${JSON.stringify(kultur)});
		if (ziel === undefined) window.__durch = true;
		else ziel.requestSubmit();`;

	/*
	 * **Der erste Klick fragt nur**, mit JavaScript, an der Kultur im
	 * zugeklappten zweiten Beet: `aufklappen` in `versand` öffnet es, die
	 * Frage ist zu sehen, und abgeschlossen ist nichts.
	 */
	await mitSkriptSenden(
		kopfformular(FRAGE_ZIEL.ort ?? '', FRAGE_ZIEL.kultur ?? ''),
		'die Rückfrage mit JavaScript ist zurück'
	);
	const mitSkriptFrage = await browser.auswerten<Abschlussstand>(
		`${STAND_LESEN} return stand(document);`
	);
	pruefen(
		'mit JavaScript: der erste Klick fragt nur — das zugeklappte Beet geht auf, die Frage ist zu sehen, nichts abgeschlossen',
		mitSkriptFrage.frage.text === erwarteteFrage &&
			mitSkriptFrage.frage.sichtbar &&
			mitSkriptFrage.frage.beetOffen &&
			mitSkriptFrage.zweitKultur &&
			mitSkriptFrage.kultur &&
			mitSkriptFrage.anstehend &&
			mitSkriptFrage.meldung === '',
		JSON.stringify(mitSkriptFrage)
	);

	/*
	 * **Abbrechen** mit JavaScript: der Link holt die Seite über den Router
	 * neu, die Antwort der action ist verworfen, die Frage fort.
	 */
	const abbrechenDa = await browser.auswerten<boolean>(
		"return document.querySelector('.bestaetigung .knoepfe a')?.checkVisibility() ?? false;"
	);
	if (abbrechenDa) {
		await browser.klicken('.bestaetigung .knoepfe a');
		await browser.warten(
			"document.getElementById('abschliessen-frage') === null",
			'die Frage ist nach Abbrechen fort'
		);
	}
	const mitSkriptAbgebrochen = await browser.auswerten<Abschlussstand>(
		`${STAND_LESEN} return stand(document);`
	);
	pruefen(
		'mit JavaScript: Abbrechen lässt alles offen — keine Frage, die Kultur steht da',
		abbrechenDa &&
			mitSkriptAbgebrochen.frage.text === null &&
			mitSkriptAbgebrochen.zweitKultur &&
			mitSkriptAbgebrochen.kultur &&
			mitSkriptAbgebrochen.anstehend,
		JSON.stringify(mitSkriptAbgebrochen)
	);
	/*
	 * Frisch laden, wie auch immer Abbrechen ausging: führte der Link woandershin,
	 * liefen die Messungen darunter sonst auf der falschen Seite und endeten in
	 * einem Wurf statt in benannten Behauptungen.
	 */
	await browser.besuchen(`${adresse}/wellness`);

	/*
	 * **Die Bestätigung schliesst ab**, mit JavaScript: erst fragen, dann das
	 * Bestätigen-Formular der Frage abschicken.
	 */
	await mitSkriptSenden(
		kopfformular(ABSCHLUSS_ZIEL.ort ?? '', ABSCHLUSS_ZIEL.kultur ?? ''),
		'die Rückfrage zu den Tomaten ist zurück'
	);
	await mitSkriptSenden(
		`const ziel = document.getElementById('abschliessen-frage')?.parentElement
			?.querySelector('form[action="?/abschliessen"]') ?? null;
		if (ziel === null) window.__durch = true;
		else ziel.requestSubmit();`,
		'das bestätigte Abschliessen mit JavaScript ist zurück'
	);
	const mitSkriptAbgeschlossen = await browser.auswerten<
		Abschlussstand & { fokusAufMeldung: boolean; knopfSichtbar: boolean }
	>(`${STAND_LESEN}
		const knopf = document.querySelector('form[action="?/zuruecknehmen"] button');
		return {
			...stand(document),
			fokusAufMeldung: document.activeElement === document.querySelector('.meldung'),
			knopfSichtbar: knopf?.checkVisibility() ?? false,
		};`);
	pruefen(
		'mit JavaScript: die Bestätigung schliesst ab — die Kultur ist fort, der Fokus liegt auf der Meldung, und Rückgängig ist zu sehen',
		!mitSkriptAbgeschlossen.kultur &&
			!mitSkriptAbgeschlossen.anstehend &&
			mitSkriptAbgeschlossen.meldung === erwarteteMeldung &&
			mitSkriptAbgeschlossen.fokusAufMeldung &&
			mitSkriptAbgeschlossen.knopfSichtbar,
		JSON.stringify(mitSkriptAbgeschlossen)
	);

	await mitSkriptSenden(
		`const rueck = document.querySelector('form[action="?/zuruecknehmen"]');
		if (rueck === null) window.__durch = true;
		else rueck.requestSubmit();`,
		'das Rückgängig mit JavaScript ist zurück'
	);
	const mitSkriptZurueck = await browser.auswerten<Abschlussstand>(
		`${STAND_LESEN} return stand(document);`
	);
	pruefen(
		'mit JavaScript: Rückgängig bringt die Kultur und `Steht wieder an` zurück, und der Knopf ist fort',
		mitSkriptZurueck.kultur &&
			mitSkriptZurueck.anstehend &&
			mitSkriptZurueck.meldung === erwarteteRueckmeldung &&
			mitSkriptZurueck.rueckgaengig === null,
		JSON.stringify(mitSkriptZurueck)
	);
	/*
	 * **Und der Fokus landet auf der Meldung**, nicht auf `body`. Der Knopf
	 * `Rückgängig` trug ihn eben noch und ist jetzt fort; ein Fokus, der mit
	 * seinem Element verschwindet, fällt an `body` zurück, und wer mit Tastatur
	 * oder Screenreader arbeitet, steht dann am Anfang der Seite. Vorgeführt:
	 * `versand` ohne Fokussprung für `zurueckgenommen`.
	 */
	const fokusNachRueckgaengig = await browser.auswerten<string>(`
		const aktiv = document.activeElement;
		return aktiv === document.querySelector('.meldung') ? 'meldung' : (aktiv?.tagName ?? '(keins)').toLowerCase();`);
	pruefenGleich(
		'mit JavaScript: nach Rückgängig liegt der Fokus auf der Meldung',
		fokusNachRueckgaengig,
		'meldung'
	);

	// -----------------------------------------------------------------------
	// /ernte: nach Beet gegliedert, Beete zu, kleine Knöpfe mit 44px
	// -----------------------------------------------------------------------
	/*
	 * **Die Ernteliste nach Beet** (spec-ernte-nach-beet.md, 2026-10-26). Welche
	 * Zeile in welches Beet und unter welche Stufe fällt, prüft `smoke` an
	 * `nachBeetGliedern` selbst; hier gemessen wird, was nur gerendert zu sehen
	 * ist: dass die Beete zu kommen und ihr Kopf den Zähler trägt, dass die zwei
	 * Knöpfe einer Karte klein aussehen und trotzdem 44px treffbar sind, wie sie
	 * vorgelesen werden, und dass Rückfrage und Umstufen ihr Beet offen halten —
	 * ohne JavaScript über das Server-HTML, mit JavaScript über den Browser.
	 *
	 * Die Saat (scripts/pruefserver.ts) trägt vier Zeilen in drei Beeten: in
	 * Hochbeet 3 Zucchini sofort und Salat langsam, in Freiland Kohlrabi
	 * langsam, ohne Ort Kürbis auf `wachsen`. **Die Reihenfolge der Beete ist
	 * hier ausgeschrieben** und nicht aus der Saat gerechnet — dieselbe
	 * Begründung wie auf /wellness: sie herzuleiten hiesse, `natuerlich` ein
	 * zweites Mal zu schreiben.
	 *
	 * Gemessen wird Sichtbarkeit über `checkVisibility()`: unter einem
	 * zugeklappten `<details>` behalten die Nachkommen in Chrome ihre Rechtecke.
	 *
	 * Vorgeführt am 2026-10-26, je eine Mutation:
	 *   - das `::before` an `.knopf-klein` entfernt: die Trefferfeld-Zeile wurde
	 *     rot (die Ränder trafen die Zeile der Karte statt den Knopf);
	 *   - `zielZeile` ohne den Zweig `fragenAbernten`: die Zeile `ohne
	 *     JavaScript` wurde rot (kein Beet offen);
	 *   - das `aufklappen` im Versand gestrichen: die Rückfrage im von Hand
	 *     zugeklappten Beet wurde rot.
	 */
	await browser.besuchen(`${adresse}/ernte`);
	const ernteStand = await browser.auswerten<{
		beete: string[];
		kartenSichtbar: boolean;
		zaehlerGewicht: number[];
	}>(`
		const beete = [...document.querySelectorAll('section.beetliste details.abschnitt')];
		return {
			beete: beete.map((d) =>
				d.querySelector('h3').textContent.trim() + ' ' + (d.open ? 'offen' : 'zu') + ' (' +
				(d.querySelector('summary .beet__zaehler')?.textContent.trim() ?? 'kein Zähler') + ')'),
			kartenSichtbar: [...document.querySelectorAll('section.beetliste .karte')].some((k) => k.checkVisibility()),
			zaehlerGewicht: [...document.querySelectorAll('section.beetliste summary .beet__zaehler')].map(
				(z) => Number(getComputedStyle(z).fontWeight)
			),
		};`);
	pruefenGleich(
		'/ernte: die Beete stehen natürlich geordnet, ohne Ort zuunterst, alle zu, und der Kopf trägt den Zähler',
		ernteStand.beete.join(' | '),
		'Freiland zu (1 langsam) | Hochbeet 3 zu (1 sofort · 1 langsam) | Ohne Beet zu (1 langsam)'
	);
	pruefen(
		'/ernte: zugeklappt ist keine Karte zu sehen, und der Zähler ist gewöhnlicher Nebentext, nicht fett',
		!ernteStand.kartenSichtbar &&
			ernteStand.zaehlerGewicht.length > 0 &&
			ernteStand.zaehlerGewicht.every((gewicht) => gewicht < 600),
		JSON.stringify(ernteStand)
	);

	/*
	 * **Klein sichtbar, 44px treffbar.** Alle Beete werden aufgeklappt, dann
	 * wird jeder Knopf einer Karte in die Mitte gerollt und an **acht** Punkten
	 * geprüft — vier Rändern und vier Ecken —, je `TREFFER_MINIMUM / 2 - 0.1`
	 * (21,9px) waagrecht und senkrecht von seiner Mitte: `elementFromPoint`
	 * dort muss den Knopf treffen. Zwischen den äussersten Messpunkten liegen
	 * damit 43,8px in jeder Richtung; das Feld, das beide trifft, ist also
	 * mindestens so breit — auf ganze Pixel gebaut heisst das 44px. Genau auf
	 * ±22px wird nicht gemessen: der Rand eines Felds gehört nur auf einer
	 * Seite dazu, und die Zeile hinge an dieser Konvention statt am Feld. Bis
	 * zum Review vom 2026-10-26 stand hier ±21px an vier Rändern, also 42px —
	 * die Behauptung sagte mehr, als sie mass.
	 *
	 * `elementFromPoint` ist dieselbe Trefferprüfung, die ein Fingertipp durchläuft — ein Mass an der Grösse des
	 * Knopfs bewiese das Trefferfeld nicht, weil es unsichtbar um ihn herum
	 * liegt. Die sichtbare Höhe muss dabei **unter** 44px liegen; sonst wäre das
	 * hier eine Prüfung gewöhnlicher Knöpfe.
	 *
	 * Vorgeführt nach dem Review: im `inset` des `::before` die Kante nicht
	 * abgezogen (Feld 42px statt 44px) — die Zeile wurde rot, an den Rändern
	 * und Ecken unten wie oben (`bei 0/21.9`, `bei -21.9/21.9`).
	 */
	const ernteKnoepfe = await browser.auswerten<{
		zahl: number;
		befunde: string[];
		namen: string[];
	}>(`
		for (const d of document.querySelectorAll('section.beetliste details.abschnitt')) d.open = true;
		const knoepfe = [...document.querySelectorAll('section.beetliste .karte button')];
		const befunde = [];
		for (const knopf of knoepfe) {
			knopf.scrollIntoView({ block: 'center', behavior: 'instant' });
			const r = knopf.getBoundingClientRect();
			const mx = r.left + r.width / 2;
			const my = r.top + r.height / 2;
			const name = knopf.getAttribute('aria-label');
			if (r.height >= ${TREFFER_MINIMUM}) befunde.push(name + ': sichtbar ' + Math.round(r.height) + 'px hoch');
			const r2 = ${TREFFER_MINIMUM / 2 - 0.1};
			for (const [dx, dy] of [[-r2, 0], [r2, 0], [0, -r2], [0, r2], [-r2, -r2], [r2, -r2], [-r2, r2], [r2, r2]]) {
				const ziel = document.elementFromPoint(mx + dx, my + dy);
				if (ziel === null || ziel.closest('button') !== knopf)
					befunde.push(name + ' bei ' + dx + '/' + dy + ': ' + (ziel === null ? 'nichts' : ziel.tagName.toLowerCase() + '.' + ziel.className));
			}
		}
		return { zahl: knoepfe.length, befunde, namen: knoepfe.map((k) => k.getAttribute('aria-label')) };`);
	pruefen(
		`/ernte: jeder der ${ernteKnoepfe.zahl} Knöpfe an einer Karte sieht kleiner aus als ${TREFFER_MINIMUM}px und wird an allen vier Rändern und Ecken ${TREFFER_MINIMUM / 2 - 0.1}px von seiner Mitte getroffen — ein Feld von ${TREFFER_MINIMUM}px auf ganze Pixel`,
		ernteKnoepfe.zahl > 0 && ernteKnoepfe.befunde.length === 0,
		ernteKnoepfe.befunde.join(' | ') || 'keine Knöpfe gefunden'
	);
	/*
	 * Wie die Knöpfe heissen — vollständig ausgeschrieben, in der Reihenfolge
	 * der Seite. Daraus lesen sich drei Zusagen auf einmal: das X heisst
	 * `Abgeerntet {Kultur}, {Ort}` (ohne Ort nur die Kultur), `Sofort` steht nur
	 * an den langsamen Karten, und der Kürbis auf `wachsen` ist eine davon.
	 */
	pruefenGleich(
		'/ernte: die Knöpfe heissen nach Kultur und Ort, und `Sofort` steht nur an den langsamen Karten — auch am Kürbis auf `wachsen`',
		ernteKnoepfe.namen.join(' | '),
		[
			'Sofort ernten Kohlrabi, Freiland',
			'Abgeerntet Kohlrabi, Freiland',
			'Abgeerntet Zucchini, Hochbeet 3',
			'Sofort ernten Salat, Hochbeet 3',
			'Abgeerntet Salat, Hochbeet 3',
			'Sofort ernten Kürbis',
			'Abgeerntet Kürbis',
		].join(' | ')
	);

	/*
	 * **Höchstens zwei Knöpfe je Karte, und kein Stift**
	 * (spec-ernte-notiz-nur-beim-erfassen.md, 2026-10-26). Die Namensliste
	 * darüber sagt es für die Saat als Ganzes; hier steht es je Karte, samt der
	 * Gegenprobe, dass im Dokument kein Formular mehr auf `?/notizAendern`
	 * zeigt — im ganzen Dokument, nicht nur an den Karten. Gezählt werden alle
	 * Knöpfe der Karte, auch die einer offenen Rückfrage — auf dieser frisch
	 * geladenen Seite steht keine. Verlangt werden genau die **vier** Karten der
	 * Saat (oben ausgeschrieben); eine leere Liste wäre sonst grün.
	 *
	 * Vorgeführt am 2026-10-26, je eine Mutation:
	 *   - den Stift wieder an die Karte gesetzt — rot (drei Knöpfe an Kohlrabi,
	 *     Salat und Kürbis);
	 *   - ein Formular auf `?/notizAendern` ausserhalb jeder Karte, über der
	 *     Liste — rot allein am Teil `stiftFormulare` (Review vom 2026-10-26);
	 *   - die Klasse `karte` an der Karte gestrichen — rot an `karten: 0`, und
	 *     die Datumsprobe darunter ebenso (leere Liste).
	 */
	const kartenKnoepfe = await browser.auswerten<{
		karten: number;
		zuViele: string[];
		stiftFormulare: number;
	}>(`
		const karten = [...document.querySelectorAll('section.beetliste .karte')];
		return {
			karten: karten.length,
			zuViele: karten
				.filter((k) => k.querySelectorAll('button').length > 2)
				.map((k) => (k.querySelector('.zeile__text')?.textContent.trim() ?? '(ohne Text)') + ': ' + k.querySelectorAll('button').length),
			stiftFormulare: document.querySelectorAll('form[action="?/notizAendern"]').length,
		};`);
	pruefen(
		'/ernte: jede der vier Karten trägt höchstens zwei Knöpfe (`Sofort`, X), und kein Formular im Dokument zeigt mehr auf ?/notizAendern',
		kartenKnoepfe.karten === 4 &&
			kartenKnoepfe.zuViele.length === 0 &&
			kartenKnoepfe.stiftFormulare === 0,
		JSON.stringify(kartenKnoepfe)
	);

	/*
	 * **Das Datum an der Karte ohne Jahr** (Matrix „Datum" der
	 * spec-ernte-notiz-nur-beim-erfassen.md): die Namenszeile jeder Karte ist
	 * `{Anzeigename} · {Tag}. {Monat}`, und keine trägt eine vierstellige Zahl —
	 * an genau den vier Karten der Saat.
	 * Welcher Tag es ist, prüft smoke an `datumOhneJahr` selbst; hier steht die
	 * Gestalt am gerenderten Dokument.
	 *
	 * Vorgeführt am 2026-10-26: an der Karte wieder `datumKurz` — die Zeile
	 * wurde rot, mit `… · 26. Okt. 2026` in der Meldung.
	 */
	const kartenDatum = await browser.auswerten<string[]>(`
		return [...document.querySelectorAll('section.beetliste .karte .ernte__text > p:last-child')]
			.map((p) => p.textContent.replace(/\\s+/g, ' ').trim());`);
	pruefen(
		'/ernte: an jeder Karte steht `{Name} · {Tag}. {Monat}` — ohne Jahr',
		kartenDatum.length === 4 &&
			kartenDatum.every((zeile) => /^\S.* · \d{1,2}\. [A-Za-zÄÖÜäöü]+\.?$/u.test(zeile)) &&
			kartenDatum.every((zeile) => !/\d{4}/.test(zeile)),
		JSON.stringify(kartenDatum)
	);

	/*
	 * **Die Notiz an der Karte** (spec-notiz-und-kurzname.md, 2026-10-26).
	 *
	 * Erst das Gerenderte der Saat: Kohlrabi trägt eine Notiz, und sie steht
	 * klein unter der Kultur und über `{Name} · {Datum}`; Salat trägt keine und
	 * hat keine Notizzeile (Matrix „Notiz leer"). Die Namenszeile nennt den
	 * Anzeigenamen des Mitglieds und nicht den vollen Namen (Matrix „Kurzname
	 * gesetzt" am gerenderten Dokument).
	 */
	const notizSaat = await browser.auswerten<{
		kohlrabi: string;
		davor: boolean;
		danach: string;
		salat: number;
	}>(`
		const karteVon = (kultur) => [...document.querySelectorAll('section.beetliste .karte')]
			.find((k) => k.querySelector('.zeile__text').textContent.trim() === kultur);
		const kohlrabi = karteVon('Kohlrabi');
		const notiz = kohlrabi?.querySelector('.ernte__notiz') ?? null;
		return {
			kohlrabi: notiz?.textContent.trim() ?? '',
			davor: notiz?.previousElementSibling?.classList.contains('zeile__text') ?? false,
			danach: notiz?.nextElementSibling?.textContent.trim() ?? '',
			salat: karteVon('Salat')?.querySelectorAll('.ernte__notiz').length ?? -1,
		};`);
	pruefen(
		'/ernte: die Notiz steht klein unter der Kultur und über Anzeigename · Datum, und eine Karte ohne Notiz hat keine Notizzeile',
		notizSaat.kohlrabi === 'frühe Sorte, sehr gross' &&
			notizSaat.davor &&
			notizSaat.danach.startsWith(`${MITGLIED.anzeigename} · `) &&
			!notizSaat.danach.includes(MITGLIED.name) &&
			notizSaat.salat === 0,
		JSON.stringify(notizSaat)
	);

	/*
	 * **Matrix „Kein Ändern"** (spec-ernte-notiz-nur-beim-erfassen.md,
	 * 2026-10-26): ein gebauter POST auf `?/notizAendern`, wie ihn die Seite bis
	 * zu diesem Tag schickte — mit Kennung, Abdruck und neuer Notiz an
	 * Kohlrabi. SvelteKit kennt die action nicht und antwortet selbst mit 404
	 * (gemessen am 2026-10-26 mit @sveltejs/kit 2.70.3), und die Notiz steht
	 * danach unverändert an der Karte. Die Matrix der Spec lässt auch 400 zu;
	 * die Probe verlangt, was gemessen ist — antwortet ein späteres SvelteKit
	 * anders, wird sie rot und der neue Status ist zu prüfen, nicht still
	 * hinzunehmen. Ohne den Kopf von `use:enhance`, wie ein Browser ohne Skript.
	 *
	 * Vorgeführt am 2026-10-26: die alte action `notizAendern` samt
	 * `ernteNotizSetzen` wieder eingesetzt — die Zeile wurde rot (Status 200,
	 * Notiz `überschrieben`).
	 */
	const kohlrabiFuerNotiz = await browser.auswerten<string>(`
		const knopf = [...document.querySelectorAll('section.beetliste .karte button')]
			.find((k) => k.getAttribute('aria-label') === 'Abgeerntet Kohlrabi, Freiland');
		return knopf?.form.querySelector('input[name="id"]').value ?? '';`);
	await browser.auswerten(`
		const daten = new FormData();
		daten.set('id', ${JSON.stringify(kohlrabiFuerNotiz)});
		daten.set('bekannteNotiz', 'frühe Sorte, sehr gross');
		daten.set('notiz', 'überschrieben');
		window.__keinAendern = undefined;
		fetch('?/notizAendern', { method: 'POST', body: daten, headers: { accept: 'text/html' } })
			.then((antwort) =>
				fetch(location.pathname, { headers: { accept: 'text/html' } })
					.then((neu) => neu.text())
					.then((html) => { window.__keinAendern = { status: antwort.status, html }; }))
			.catch((fehler) => { window.__keinAendern = { status: -1, html: 'Wurf: ' + fehler }; });
		return true;`);
	await browser.warten(
		'window.__keinAendern !== undefined',
		'die Antwort auf ?/notizAendern und die neu geholte Liste sind da'
	);
	const keinAendern = await browser.auswerten<{ status: number; notiz: string | null }>(`
		const dok = new DOMParser().parseFromString(window.__keinAendern.html, 'text/html');
		const notiz = dok.getElementById(${JSON.stringify(`ernte-${kohlrabiFuerNotiz}`)})?.querySelector('.ernte__notiz') ?? null;
		return { status: window.__keinAendern.status, notiz: notiz === null ? null : notiz.textContent.trim() };`);
	pruefen(
		'/ernte: ein gebauter POST auf ?/notizAendern trifft keine action (404), und die Notiz bleibt',
		kohlrabiFuerNotiz !== '' &&
			keinAendern.status === 404 &&
			keinAendern.notiz === 'frühe Sorte, sehr gross',
		JSON.stringify({ id: kohlrabiFuerNotiz, ...keinAendern })
	);

	/*
	 * **Welche Karten danach eine Notizzeile tragen** — ausgeschrieben, weil der
	 * Kontrast-Sweep weiter unten sie misst: Kohlrabi aus der Saat (die Probe
	 * oben schreibt nichts, wenn sie grün ist) und Mangold, den die
	 * Eintragen-Probe weiter unten mit einer Notiz anlegt. Zucchini, Salat und
	 * Kürbis tragen keine. Bis zum 2026-10-26 setzten die Proben zur
	 * Notiz-Änderung hier Notizen an Zucchini und räumten sie wieder ab; seit
	 * spec-ernte-notiz-nur-beim-erfassen.md gibt es nichts mehr aufzuräumen.
	 *
	 * **Ohne frisches Laden weiter.** Bis dahin lud die Probe mit JavaScript
	 * /ernte hier neu. Die Proben bis zur nächsten, die selbst neu lädt
	 * (`Mit JavaScript: Umstufen`), lesen aus dem Dokument nur die Kennungen
	 * an den Knöpfen — die stehen unabhängig davon, welches Beet offen ist —
	 * und messen das HTML, das ihr eigener POST zurückbringt. Den Zustand der
	 * Seite im Browser brauchen sie nicht.
	 */
	/*
	 * **Ohne JavaScript: die Rückfrage öffnet genau ihr Beet** — das zweite
	 * Abnahmekriterium der Spec. Ein POST ohne den Kopf von `use:enhance`
	 * bekommt die ganze Seite zurück, genau die, die ein Browser ohne Skript
	 * anzeigt; gelesen wird das zurückgekommene HTML. Gefragt wird an Kohlrabi,
	 * dem ersten Beet: ein Beet weiter unten offen zu finden bewiese nichts über
	 * die übrigen. Der Weg über `window` ist derselbe wie auf /wellness.
	 */
	const kohlrabiId = await browser.auswerten<string>(`
		const knopf = [...document.querySelectorAll('section.beetliste .karte button')]
			.find((k) => k.getAttribute('aria-label') === 'Abgeerntet Kohlrabi, Freiland');
		return knopf?.form.querySelector('input[name="id"]').value ?? '';`);
	await browser.auswerten(`
		const daten = new FormData();
		daten.set('id', ${JSON.stringify(kohlrabiId)});
		window.__ohneSkript = undefined;
		fetch('?/abernten', { method: 'POST', body: daten, headers: { accept: 'text/html' } })
			.then((antwort) => antwort.text())
			.then((html) => { window.__ohneSkript = html; })
			.catch((fehler) => { window.__ohneSkript = 'Wurf: ' + fehler; });
		return true;`);
	await browser.warten(
		"typeof window.__ohneSkript === 'string'",
		'die Antwort auf ?/abernten ohne Skript ist da'
	);
	const ernteOhneSkript = await browser.auswerten<{ frage: boolean; offen: string[] }>(`
		const dok = new DOMParser().parseFromString(window.__ohneSkript, 'text/html');
		return {
			frage: dok.getElementById(${JSON.stringify(`abernten-frage-${kohlrabiId}`)}) !== null,
			offen: [...dok.querySelectorAll('section.beetliste details.abschnitt')]
				.filter((d) => d.hasAttribute('open'))
				.map((d) => d.querySelector('h3').textContent.trim()),
		};`);
	pruefen(
		'/ernte ohne JavaScript: die Rückfrage zum Abernten steht an der Zeile, und genau ihr Beet kommt offen',
		kohlrabiId !== '' &&
			ernteOhneSkript.frage &&
			ernteOhneSkript.offen.length === 1 &&
			ernteOhneSkript.offen[0] === 'Freiland',
		JSON.stringify({ id: kohlrabiId, ...ernteOhneSkript })
	);

	/*
	 * **Ohne JavaScript: Umstufen öffnet genau sein Beet** (Befund aus dem
	 * Review vom 2026-10-26: die Behauptung mit JavaScript darunter klappt das
	 * Beet vor dem Klick von Hand auf und belegt `zielZeile` darum nicht). Ein
	 * POST auf `?/umstufen` ohne den Kopf von `use:enhance`, Salat auf
	 * `sofort`; im zurückgekommenen HTML muss genau Hochbeet 3 offen sein und
	 * Salat dort unter `Sofort ernten` stehen.
	 *
	 * **Das ändert die Saat**, und das ist ausgeschrieben: ab hier ist Hochbeet 3
	 * nicht mehr gemischt (zweimal sofort). Der Kontrast-Sweep weiter unten
	 * braucht davon nichts — er sieht `--reif-stehen` an Kürbis ohne Ort, die
	 * Kanten in --reif-sofort an Zucchini, Salat und Kohlrabi, und beide kleinen
	 * Knöpfe an Kürbis. Was er nicht mehr sieht, ist ein gemischtes Beet; das
	 * belegt der Zähler `1 sofort · 1 langsam` oben, gemessen vor jeder
	 * Änderung.
	 *
	 * Vorgeführt am 2026-10-26: `form.art === 'umgestuft' ||` aus `zielZeile`
	 * gestrichen — diese Zeile wurde rot (kein Beet offen).
	 */
	const salatId = await browser.auswerten<string>(`
		const knopf = [...document.querySelectorAll('section.beetliste .karte button')]
			.find((k) => k.getAttribute('aria-label') === 'Sofort ernten Salat, Hochbeet 3');
		return knopf?.form.querySelector('input[name="id"]').value ?? '';`);
	await browser.auswerten(`
		const daten = new FormData();
		daten.set('id', ${JSON.stringify(salatId)});
		daten.set('status', 'sofort');
		window.__ohneSkript = undefined;
		fetch('?/umstufen', { method: 'POST', body: daten, headers: { accept: 'text/html' } })
			.then((antwort) => antwort.text())
			.then((html) => { window.__ohneSkript = html; })
			.catch((fehler) => { window.__ohneSkript = 'Wurf: ' + fehler; });
		return true;`);
	await browser.warten(
		"typeof window.__ohneSkript === 'string'",
		'die Antwort auf ?/umstufen ohne Skript ist da'
	);
	const umstufenOhneSkript = await browser.auswerten<{ offen: string[]; sofort: string[] }>(`
		const dok = new DOMParser().parseFromString(window.__ohneSkript, 'text/html');
		const beet = [...dok.querySelectorAll('section.beetliste details.abschnitt')]
			.find((d) => d.querySelector('h3').textContent.trim() === 'Hochbeet 3');
		const marke = beet === undefined ? undefined
			: [...beet.querySelectorAll('h4')].find((h) => h.textContent.trim() === 'Sofort ernten');
		const liste = marke === undefined ? null : dok.querySelector('ul[aria-labelledby="' + marke.id + '"]');
		return {
			offen: [...dok.querySelectorAll('section.beetliste details.abschnitt')]
				.filter((d) => d.hasAttribute('open'))
				.map((d) => d.querySelector('h3').textContent.trim()),
			sofort: liste === null ? [] : [...liste.querySelectorAll('.karte .zeile__text')].map((p) => p.textContent.trim()),
		};`);
	pruefen(
		'/ernte ohne JavaScript: nach `Sofort` an Salat kommt genau Hochbeet 3 offen, und Salat steht dort unter `Sofort ernten`',
		salatId !== '' &&
			umstufenOhneSkript.offen.join(' | ') === 'Hochbeet 3' &&
			umstufenOhneSkript.sofort.includes('Salat'),
		JSON.stringify({ id: salatId, ...umstufenOhneSkript })
	);

	/*
	 * **Mit JavaScript: Umstufen im selben Beet, und das Beet bleibt offen.**
	 * Frisch geladen (alle Beete zu), Freiland **von Hand** aufgeklappt und der
	 * Knopf `Sofort` an Kohlrabi geklickt — über die gemessene Mitte, wie ein
	 * Finger. Gewartet wird auf die Rückmeldung; danach muss Kohlrabi im selben
	 * Beet unter `Sofort ernten` stehen und das Beet weiterhin offen sein.
	 *
	 * **Was diese Zeile belegt und was nicht:** dass Svelte ein offenes Beet nach
	 * dem Umstufen nicht unter der Hand zuklappt (`istOffen` liest den Zustand
	 * des Browsers). Dass das Beet ohne Zutun aufgeht, belegt sie **nicht** —
	 * es war schon offen; das tun die Zeile ohne JavaScript darüber und die
	 * Zeile zum Eintragen darunter.
	 *
	 * Das ändert die Saat ein zweites Mal: Kohlrabi steht ab hier auf `sofort`.
	 * Die Rückfrage zu Kohlrabi darunter braucht nur sein X, das jede Karte
	 * trägt.
	 */
	await browser.besuchen(`${adresse}/ernte`);
	await browser.auswerten(`
		const beet = [...document.querySelectorAll('section.beetliste details.abschnitt')]
			.find((d) => d.querySelector('h3').textContent.trim() === 'Freiland');
		beet.open = true;
		[...beet.querySelectorAll('button')]
			.find((k) => k.getAttribute('aria-label') === 'Sofort ernten Kohlrabi, Freiland').id = 'sofort-unter-probe';
		return true;`);
	await browser.klicken('#sofort-unter-probe');
	await browser.warten(
		"document.querySelector('.meldung').textContent.includes('Kohlrabi')",
		'die Rückmeldung zum Umstufen von Kohlrabi ist da'
	);
	const nachUmstufen = await browser.auswerten<{ offen: boolean; sofort: string[] }>(`
		const beet = [...document.querySelectorAll('section.beetliste details.abschnitt')]
			.find((d) => d.querySelector('h3').textContent.trim() === 'Freiland');
		const marke = [...beet.querySelectorAll('h4')].find((h) => h.textContent.trim() === 'Sofort ernten');
		const liste = marke === undefined ? null : document.querySelector('ul[aria-labelledby="' + marke.id + '"]');
		return {
			offen: beet.open,
			sofort: liste === null ? [] : [...liste.querySelectorAll('.karte .zeile__text')].map((p) => p.textContent.trim()),
		};`);
	pruefen(
		'/ernte mit JavaScript: nach `Sofort` steht Kohlrabi im selben Beet unter `Sofort ernten`, und das von Hand geöffnete Beet bleibt offen',
		nachUmstufen.offen && nachUmstufen.sofort.includes('Kohlrabi'),
		JSON.stringify(nachUmstufen)
	);

	/*
	 * **Mit JavaScript: die Rückfrage aus einem von Hand zugeklappten Beet.**
	 * Abgeschickt über `requestSubmit()`, also durch `use:enhance`, nachdem das
	 * Beet wieder zugeklappt wurde. Die Frage muss danach zu sehen sein —
	 * sonst steht eine Frage, die niemand findet, und das X der Zeile ist fort.
	 */
	await browser.auswerten(`
		const knopf = [...document.querySelectorAll('section.beetliste .karte button')]
			.find((k) => k.getAttribute('aria-label') === 'Abgeerntet Kohlrabi, Freiland');
		knopf.closest('details').open = false;
		knopf.form.requestSubmit();
		return true;`);
	await browser.warten(
		`document.getElementById(${JSON.stringify(`abernten-frage-${kohlrabiId}`)}) !== null`,
		'die Rückfrage zu Kohlrabi mit JavaScript ist da'
	);
	const frageSichtbar = await browser.auswerten<{ sichtbar: boolean; offen: boolean }>(`
		const frage = document.getElementById(${JSON.stringify(`abernten-frage-${kohlrabiId}`)});
		return { sichtbar: frage.checkVisibility(), offen: frage.closest('details').open };`);
	pruefen(
		'/ernte mit JavaScript: die Rückfrage im zugeklappten Beet öffnet das Beet, und die Frage ist zu sehen',
		frageSichtbar.sichtbar && frageSichtbar.offen,
		JSON.stringify(frageSichtbar)
	);

	/*
	 * **Mit JavaScript: eine neu eingetragene Zeile öffnet ihr Beet** (Befund
	 * aus dem Review vom 2026-10-26: sonst landete sie unsichtbar in einem
	 * zugeklappten Beet, und die Meldung oben sagte nur, dass es sie gibt).
	 * Freiland wird vorher von Hand zugeklappt; damit hat `istOffen` den
	 * gemerkten Zustand `zu`, und aufgehen kann es nur über `aufklappen` im
	 * Versand. Eingetragen wird Mangold in Freiland, abgeschickt über
	 * `requestSubmit()` des Formulars, also durch `use:enhance`.
	 *
	 * Das ändert die Saat ein drittes Mal: Freiland trägt ab hier zwei Zeilen.
	 *
	 * Vorgeführt am 2026-10-26: `form.art === 'eingetragen' ||` aus `zielZeile`
	 * gestrichen — diese Zeile wurde rot (Freiland blieb zu).
	 */
	await browser.auswerten(`
		const beet = [...document.querySelectorAll('section.beetliste details.abschnitt')]
			.find((d) => d.querySelector('h3').textContent.trim() === 'Freiland');
		beet.open = false;
		document.querySelector('details.zeilenform').open = true;
		document.getElementById('neu-kultur').value = 'Mangold';
		document.getElementById('neu-ort').value = 'Freiland';
		document.getElementById('neu-notiz').value = '  zuerst  die  grossen ';
		document.querySelector('input[name="status"][value="stehen"]').checked = true;
		document.getElementById('neu-kultur').form.requestSubmit();
		return true;`);
	await browser.warten(
		"document.querySelector('.meldung').textContent.includes('Mangold')",
		'die Rückmeldung zum Eintragen von Mangold ist da'
	);
	const nachEintragen = await browser.auswerten<{
		offen: boolean;
		sichtbar: boolean;
		notiz: string;
	}>(`
		const beet = [...document.querySelectorAll('section.beetliste details.abschnitt')]
			.find((d) => d.querySelector('h3').textContent.trim() === 'Freiland');
		const karte = [...beet.querySelectorAll('.karte')].find((k) =>
			k.querySelector('.zeile__text').textContent.trim() === 'Mangold');
		return {
			offen: beet.open,
			sichtbar: karte?.checkVisibility() ?? false,
			notiz: karte?.querySelector('.ernte__notiz')?.textContent.trim() ?? '',
		};`);
	/*
	 * Seit dem 2026-10-26 mit einer Notiz aus dem gerenderten Formular
	 * (`#neu-notiz`): sie steht gefaltet an der neuen Karte.
	 */
	pruefen(
		'/ernte mit JavaScript: nach dem Eintragen geht das zugeklappte Beet der neuen Zeile auf, und die Zeile ist zu sehen — mit der Notiz aus dem Formular',
		nachEintragen.offen && nachEintragen.sichtbar && nachEintragen.notiz === 'zuerst die grossen',
		JSON.stringify(nachEintragen)
	);

	// -----------------------------------------------------------------------
	// Die zweite Sitzung: als Adminperson
	// -----------------------------------------------------------------------
	/*
	 * **Ab hier fährt der Lauf mit Adminrechten**, und das haben zwei Abschnitte
	 * nötig: der Kontrast-Sweep, weil `/verwaltung` einer Mitgliedssitzung
	 * verschlossen ist, und der Widerruf-Dialog danach.
	 *
	 * Beide stehen darum **am Ende** des Laufs, und der Dialog zuletzt: er
	 * beendet den Zugang von `Manu Mitglied`, und danach ist `--danger` nirgends
	 * mehr gerendert — die Abdeckungszeile des Sweeps würde rot.
	 *
	 * Jede Messung oberhalb fährt als Mitglied ohne Adminrechte.
	 */
	const adminEingeloest = await holen(port, `/i/${saat.adminToken}`);
	const adminSetzung = adminEingeloest.headers.getSetCookie()[0] ?? '';
	const adminKeks = keksAus(adminSetzung);
	pruefen(
		'der Einlösepfad hat auch der Adminperson eine Sitzung gestellt',
		adminEingeloest.status === 303 && adminKeks !== 'sitzung=',
		`Status ${adminEingeloest.status}, Setzung ${JSON.stringify(adminSetzung)}`
	);
	/*
	 * Gleicher Name, gleiche Domain, gleicher Pfad — die Setzung **ersetzt** den
	 * Keks des Mitglieds, statt einen zweiten daneben zu legen. Dass der Tausch
	 * wirklich gegriffen hat, ist keine Annahme, sondern gemessen: den Keks des
	 * Mitglieds hier stehen zu lassen beendet den Lauf mit dem benannten Wurf
	 * `keine Zeile für Manu Mitglied auf /verwaltung` — die Adminschranke weist
	 * eine Sitzung ohne Adminrechte ab, und die Suche unten findet nichts.
	 */
	await browser.senden('Network.setCookie', {
		name: 'sitzung',
		value: adminKeks.slice('sitzung='.length),
		domain: '127.0.0.1',
		path: '/',
		httpOnly: true,
		sameSite: 'Lax',
	});

	// -----------------------------------------------------------------------
	// Kontrast über den ganzen Baum, in beiden Modi — Zeile 7 der R5-Liste
	// -----------------------------------------------------------------------
	/*
	 * **Das Hindernis, an dem diese Zeile zwei Epics lang hing, gibt es nicht
	 * mehr.**
	 *
	 * NFR9 verlangt 4.5:1 für Text und 3:1 für Bedienelement-Umrisse, in Hell und
	 * Dunkel. Getragen hat das eine Tabelle in DESIGN.md und ein halbes Dutzend
	 * Zahlen in Kommentaren — alle von Hand gerechnet, keine gemessen. Eintrag 44
	 * der zurückgestellten Arbeit nannte als Hindernis eine fehlende
	 * *maschinenlesbare Aussage darüber, welche Paare überhaupt zusammen
	 * vorkommen*, und die Triage vor Epic 3 hat den Satz übernommen.
	 *
	 * Die Aussage gibt es seit dem 2026-08-31: **der gerenderte DOM ist sie.** Ein
	 * Token muss nicht ausgerechnet werden, wenn ein Browser es auflöst; welcher
	 * Vordergrund auf welchem Grund steht, muss nicht behauptet werden, wenn die
	 * Seite es zeigt. Das Hindernis war nie die Rechnung — es war die fehlende
	 * vierte Prüfschicht.
	 *
	 * Gemessen wird über **jede** `+page.svelte` des Baums, eingesammelt aus dem
	 * Verzeichnisbaum und nicht aus einer Liste (dieselbe Bauform wie die
	 * Live-Region-Wache in `smoke` und Gate-Regel 14/15), dazu die Fehlerseite
	 * über einen Pfad, den es nicht gibt. Seit dem 2026-09-13 jede Seite
	 * **einmal** — es gibt nur noch ein Erscheinungsbild.
	 *
	 * **Was dieser Sweep nicht sieht, ausgeschrieben statt verschwiegen:**
	 *   - Was nicht gerendert ist. Ein geschlossener `<dialog>` ist
	 *     `display: none`, seine Flächen sind darum nicht gemessen — sie sind
	 *     dieselben Paare wie die der Karten, und die Abdeckungszeile unten
	 *     belegt, dass jedes Token vorkommt.
	 *   - `::placeholder` und andere Pseudoelemente. Sie haben keinen eigenen
	 *     Knoten und damit keinen eigenen Textinhalt, an dem eine Messung
	 *     ansetzen könnte.
	 *   - Zustände, die dieser Lauf nicht herstellt. Ein Zustand, dessen Farbe
	 *     niemand hier sichtbar macht, fällt aus der Messung — genau darum ist
	 *     die **Abdeckung eine eigene Behauptung** und nicht eine Hoffnung: alle
	 *     Farbtokens aus `TOKENS` müssen in mindestens einem gemessenen Paar
	 *     vorkommen. Die Zahl steht dort und nicht hier — sie ist am 2026-09-13
	 *     von elf auf fünfzehn gestiegen.
	 *   - Den Fokusring. Er hängt an `:focus-visible`, und ein berechneter Stil
	 *     zeigt ihn nur am fokussierten Element. Seine Farbe ist `--accent`, und
	 *     die ist als Umriss des Kästchens ohnehin gemessen.
	 *   - **Was in einem anderen Aufklapper als `details.abschnitt` liegt.** Seit
	 *     dem 2026-10-26 klappt der Messkopf vor dem Messen jeden Abschnitt auf:
	 *     die Beete auf /ernte kommen zugeklappt (spec-ernte-nach-beet.md), und
	 *     ohne diesen Schritt fielen alle Karten, alle Stufenkanten und beide
	 *     kleinen Knöpfe aus der Messung — vorgeführt am selben Tag: ohne
	 *     diesen Schritt wurden die Abdeckungszeile (an beiden --reif-Token)
	 *     und die Zeile zu den Zustandsmarken rot. Mitgemessen sind damit auch die
	 *     zugeklappten Beete auf /wellness und die Legende auf /ernte. Nicht
	 *     geöffnet werden `details.zeilenform` (die Formulare) und
	 *     `details.eintraege` (die Einträge im Tagebuch): sie öffnen hiesse,
	 *     Zustände zu messen, die erst nach einem Griff entstehen, und das ist
	 *     eine eigene Frage.
	 */
	const TOKENS = [
		'--surface-base',
		'--surface-raised',
		'--ink-primary',
		'--ink-secondary',
		'--hairline',
		'--surface-open',
		'--surface-griff',
		'--accent',
		'--accent-ink',
		'--overdue',
		'--danger',
		'--reif-sofort',
		'--reif-stehen',
	] as const;

	/*
	 * **Der Messkopf gibt Zeichenketten zurück und rechnet nicht.**
	 *
	 * Die Arithmetik steht in `scripts/kontrast.ts` und hat dort einen eigenen
	 * Selbsttest gegen Werte von aussen (Schwarz auf Weiss ist 21:1) und gegen
	 * die veröffentlichte Tabelle aus DESIGN.md. Eine Rechnung im Seitenkontext
	 * wäre die eine Stelle der Prüfkette, die niemand gegen bekannte Werte halten
	 * kann — und eine falsch gerechnete Leuchtdichte sieht aus wie ein
	 * Kontrastwert.
	 *
	 * Drei Entscheide stecken darin, jeder mit einem Grund:
	 *
	 *   - **Nur Elemente mit eigenem Text.** Gemessen wird die Farbe, die einen
	 *     Buchstaben malt; ein Container, der seine Kinder umschliesst, malt
	 *     keinen. Ohne diese Grenze zählte jede Verschachtelung dasselbe Paar
	 *     mehrfach.
	 *   - **Weggeschnittenes zählt nicht.** `.nur-vorgelesen` steht mit
	 *     `clip-path: inset(50%)` im Dokument und trägt Text für Screenreader.
	 *     `checkVisibility()` hält es für sichtbar, ein Auge sieht es nicht, und
	 *     ein Kontrastwert darüber wäre eine Aussage über nichts. Gesucht wird
	 *     die **Ursache** (ein Schnitt an ihm oder einem Vorfahren) und nicht der
	 *     Klassenname — eine zweite Klasse mit demselben Kunstgriff fällt damit
	 *     vom ersten Tag an mit heraus.
	 *   - **Gesperrte Bedienelemente zählen nicht.** WCAG 1.4.3 nimmt inaktive
	 *     Bedienelemente ausdrücklich aus, und `:disabled` färbt in diesem
	 *     Projekt bewusst gedämpft. Ein `disabled` am Vorfahren (ein
	 *     `<fieldset>`) zählt mit.
	 *
	 * Ein **durchsichtiger** Umriss ist keiner: `.nav-bar__ziel` trägt eine Kante
	 * in `transparent`, damit die 2px-Markierung des aktiven Ziels die Zeile
	 * nicht verschiebt. Der erste Entwurf dieses Kopfes zählte sie als Verstoss
	 * mit dem Verhältnis 1 — gemessen und behoben, statt die Zahl zu erklären.
	 */
	const MESSKOPF = `
		for (const d of document.querySelectorAll('details.abschnitt')) d.open = true;
		const INTERAKTIV = 'a[href], button, input, select, textarea, summary,' +
			' [role="button"], [tabindex]:not([tabindex="-1"])';
		const pfad = (el) => {
			const klassen = typeof el.className === 'string' && el.className.trim() !== ''
				? '.' + el.className.trim().split(/\\s+/).join('.') : '';
			return el.tagName.toLowerCase() + klassen;
		};
		const sichtbar = (el) => el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
		const weggeschnitten = (el) => {
			let k = el;
			while (k !== null) {
				if (getComputedStyle(k).clipPath !== 'none') return true;
				k = k.parentElement;
			}
			return false;
		};
		const grundVon = (el) => {
			const stapel = [];
			let k = el;
			let bild = false;
			let durchscheinend = false;
			while (k !== null) {
				const s = getComputedStyle(k);
				if (s.backgroundImage !== 'none') bild = true;
				if (parseFloat(s.opacity) < 1) durchscheinend = true;
				stapel.push(s.backgroundColor);
				if (k === document.documentElement) break;
				k = k.parentElement;
			}
			return { stapel, bild, durchscheinend };
		};
		const funde = [];
		for (const el of document.querySelectorAll('body *')) {
			const eigenerText = [...el.childNodes]
				.filter((knoten) => knoten.nodeType === 3)
				.map((knoten) => knoten.textContent)
				.join('')
				.replace(/\\s+/g, ' ')
				.trim();
			if (eigenerText === '') continue;
			if (!sichtbar(el) || weggeschnitten(el) || el.closest(':disabled') !== null) continue;
			const s = getComputedStyle(el);
			const g = grundVon(el);
			funde.push({ art: 'text', wo: pfad(el), text: eigenerText.slice(0, 40),
				vordergrund: s.color, stapel: g.stapel, bild: g.bild, durchscheinend: g.durchscheinend,
				groesse: parseFloat(s.fontSize), gewicht: parseInt(s.fontWeight, 10) });
		}
		for (const el of document.querySelectorAll(INTERAKTIV)) {
			if (!sichtbar(el) || el.closest(':disabled') !== null) continue;
			const s = getComputedStyle(el);
			const g = grundVon(el.parentElement === null ? el : el.parentElement);
			const kanten = [];
			for (const seite of ['Top', 'Right', 'Bottom', 'Left']) {
				const stil = s['border' + seite + 'Style'];
				if (parseFloat(s['border' + seite + 'Width']) <= 0) continue;
				if (stil === 'none' || stil === 'hidden') continue;
				kanten.push(['border-' + seite.toLowerCase(), s['border' + seite + 'Color']]);
			}
			if (parseFloat(s.outlineWidth) > 0 && s.outlineStyle !== 'none') {
				kanten.push(['outline', s.outlineColor]);
			}
			for (const [name, farbe] of kanten) {
				const marke = el.dataset.stufe !== undefined && name === 'border-left';
				funde.push({ art: marke ? 'zustandsmarke' : 'umriss',
					wo: pfad(el) + ' ' + name, text: marke ? el.dataset.stufe : '',
					vordergrund: farbe,
					stapel: g.stapel, bild: g.bild, durchscheinend: g.durchscheinend,
					groesse: 0, gewicht: 0 });
			}
		}
		/*
		 * **Die Kanten der Behälter und Trennlinien — gemessen, aber nicht an 3:1
		 * gehalten.**
		 *
		 * Seit dem 2026-09-11 trägt --hairline keinen einzigen Bedienelement-Umriss
		 * mehr (Entscheid (a)). Damit fiel es aus jedem gemessenen Paar heraus und die
		 * Abdeckungszeile wurde rot — zu Recht: die Sonde las Kanten ausschliesslich
		 * an interaktiven Knoten und war für Karten, Dialog und Listentrennlinien
		 * blind. Diese Schleife schliesst den Fleck.
		 *
		 * Die Funde tragen die Art trennlinie und **nicht** umriss: die 3:1-Schwelle
		 * aus NFR9 gilt für Bedienelemente, nicht für Dekor. Sie zählen für die
		 * Abdeckung und für die Herkunftsprüfung der Farben — eine Trennlinie in
		 * einer Farbe, die in keinem Token steht, fällt weiterhin auf.
		 *
		 * Kein Backtick in diesem Block: er steht innerhalb des Template-Literals
		 * MESSKOPF, und ein Backtick beendete es mitten im Satz.
		 */
		for (const el of document.querySelectorAll('body *')) {
			if (el.matches(INTERAKTIV) || el.closest(':disabled') !== null) continue;
			if (!sichtbar(el)) continue;
			const s = getComputedStyle(el);
			const g = grundVon(el.parentElement === null ? el : el.parentElement);
			for (const seite of ['Top', 'Right', 'Bottom', 'Left']) {
				const stil = s['border' + seite + 'Style'];
				if (parseFloat(s['border' + seite + 'Width']) <= 0) continue;
				if (stil === 'none' || stil === 'hidden') continue;
				const marke = el.dataset.stufe !== undefined && seite === 'Left';
				funde.push({ art: marke ? 'zustandsmarke' : 'trennlinie',
					wo: pfad(el) + ' border-' + seite.toLowerCase(),
					text: marke ? el.dataset.stufe : '',
					vordergrund: s['border' + seite + 'Color'],
					stapel: g.stapel, bild: g.bild, durchscheinend: g.durchscheinend,
					groesse: 0, gewicht: 0 });
			}
		}
		/*
		 * Die Tokens werden **im Browser aufgelöst** und nicht als Hexwert
		 * abgeholt: getPropertyValue gibt den geschriebenen Text zurück, und ein
		 * Vergleich zwischen "#2f6b3f" und "rgb(47, 107, 63)" wäre eine zweite
		 * Farbschreibweise in der Prüfkette. Die Sonde nimmt denselben Weg wie
		 * jede Farbe der Seite.
		 */
		const sonde = document.createElement('span');
		sonde.style.cssText = 'position:absolute;visibility:hidden';
		document.body.appendChild(sonde);
		const tokens = {};
		for (const name of ${JSON.stringify(TOKENS)}) {
			sonde.style.color = 'var(' + name + ')';
			tokens[name] = getComputedStyle(sonde).color;
		}
		sonde.remove();
		return { funde, tokens, ort: location.pathname };`;

	type Fund = {
		art: 'text' | 'umriss' | 'trennlinie' | 'zustandsmarke';
		wo: string;
		text: string;
		vordergrund: string;
		stapel: string[];
		bild: boolean;
		durchscheinend: boolean;
		groesse: number;
		gewicht: number;
	};
	type Messung = { funde: Fund[]; tokens: Record<string, string>; ort: string };

	/*
	 * **Die Seiten kommen aus dem Verzeichnisbaum, die Werte für dynamische
	 * Abschnitte aus einer Zuordnung — und dass die vollständig ist, ist eine
	 * Behauptung.**
	 *
	 * Eine neue Seite mit `[etwas]` im Pfad fiele sonst still aus dem Sweep, und
	 * genau diese Klasse Fehler hat Story 4.1 zweimal getroffen: zwei Seiten mit
	 * Formular, in keiner Liste eingetragen, aus zwei geteilten Prüfungen heraus.
	 */
	const seitenVerzeichnisse = readdirSync(join(wurzel, 'src', 'routes'), {
		recursive: true,
		withFileTypes: true,
	})
		.filter((eintrag) => eintrag.isFile() && eintrag.name === '+page.svelte')
		.map((eintrag) =>
			relative(join(wurzel, 'src', 'routes'), eintrag.parentPath)
				.split(sep)
				.filter((teil) => teil !== '')
				.join('/')
		)
		.sort();
	/*
	 * **Die Zuordnung geht seit dem 2026-09-20 je Route und nicht je
	 * Platzhalter**, und das ist eine Verschärfung mit Anlass.
	 *
	 * Bis dahin stand hier `{ '[id]': <eine Blatt-Id> }`: **ein** Wert für
	 * **jedes** `[id]` im ganzen Baum. Das trug, solange es eine einzige Route
	 * mit diesem Abschnitt gab. Mit /wissen/dokument/[id] gibt es zwei, und die
	 * Ids kommen aus verschiedenen Tabellen — die Blatt-Id 3 in den Dokumentpfad
	 * gesetzt ergibt einen 404, und der Sweep hätte eine Fehlerseite gemessen
	 * und für eine Seite gehalten.
	 *
	 * Geprüft wird darum jetzt, dass **jede** Route mit einem dynamischen
	 * Abschnitt hier einen Eintrag hat, und zwar genau einen. Eine neue solche
	 * Route fällt damit weiterhin auf — und zusätzlich fällt auf, wenn eine
	 * bestehende ihren eigenen Wert braucht.
	 */
	const DYNAMISCHE_PFADE: Record<string, string> = {
		'wissen/[id]': `wissen/${blattAbsaetze}`,
		'wissen/dokument/[id]': `wissen/dokument/${dokumentMerkblatt}`,
	};
	const mitPlatzhalter = seitenVerzeichnisse.filter((pfad) => /\[[^\]]+\]/.test(pfad)).sort();
	pruefen(
		`alle fünfzehn Seiten sind aus dem Verzeichnisbaum abgeleitet (gefunden: ${seitenVerzeichnisse.length}), und jede dynamische Route hat ihren Wert`,
		seitenVerzeichnisse.length === 15 &&
			mitPlatzhalter.join(' ') === Object.keys(DYNAMISCHE_PFADE).sort().join(' '),
		`dynamisch im Baum: ${mitPlatzhalter.join(' ') || '(keine)'}, zugeordnet: ${Object.keys(DYNAMISCHE_PFADE).join(' ')}`
	);
	/*
	 * Die Fehlerseite steht als fünfzehnte, über einen Pfad, den es nicht gibt. Sie
	 * ist keine `+page.svelte` und käme aus dem Verzeichnisbaum darum nie —
	 * gestaltet ist sie trotzdem, und ihre Zusage („lesbarer Kontrast auch für
	 * die Statuszeile", Spec 1.2) hat bis heute nichts gemessen.
	 */
	const KONTRAST_ROUTEN = [
		...seitenVerzeichnisse.map((pfad) => '/' + (DYNAMISCHE_PFADE[pfad] ?? pfad)),
		'/gibtsnicht',
	];

	/*
	 * **Ein Lauf statt zwei, seit dem 2026-09-13.** Der Sweep nahm bis dahin ein
	 * Schema entgegen und lief einmal je Modus; mit dem Wegfall des dunklen
	 * Modus gibt es nur noch eines zu messen. `wie` bleibt als Wortbaustein der
	 * Meldungen erhalten, damit die Zeilen unverändert lesbar sind.
	 */
	const kontrastSweep = async () => {
		const wie = 'auf der ganzen Seite';
		const stumm: string[] = [];
		const textBefunde: string[] = [];
		const umrissBefunde: string[] = [];
		const fremdeFarben: string[] = [];
		const markenBefunde: string[] = [];
		const markenGesehen: string[] = [];
		const gesehen = new Set<string>();
		let paare = 0;
		let tokenwerte: Record<string, string> = {};

		for (const route of KONTRAST_ROUTEN) {
			await browser!.besuchen(`${adresse}${route}`);
			const messung = await browser!.auswerten<Messung>(MESSKOPF);
			tokenwerte = messung.tokens;
			const tokenmenge = new Set(Object.values(messung.tokens));
			/*
			 * Die Farben, die als Zustandsmarke durchgehen (seit dem 2026-10-26 zwei) — **abgeleitet aus
			 * dem Tokenblock über ihr Namenspräfix** und nicht hier aufgezählt. Eine
			 * Liste von Hand wäre genau die Stelle, an der eine vierte Ampelfarbe
			 * später still an der Prüfung vorbeiliefe.
			 */
			const ampel = new Set(
				Object.entries(messung.tokens)
					.filter(([name]) => name.startsWith('--reif-'))
					.map(([, farbe]) => farbe)
			);
			const textFunde = messung.funde.filter((fund) => fund.art === 'text').length;
			if (messung.ort !== route || textFunde === 0) {
				stumm.push(`${route} -> gelandet auf ${messung.ort}, ${textFunde} Textfund(e)`);
				continue;
			}
			for (const fund of messung.funde) {
				const vorne = farbeLesen(fund.vordergrund);
				const grund = grundAus(fund.stapel);
				const ziel = fund.art === 'text' ? textBefunde : umrissBefunde;
				/*
				 * **Ein Umriss ohne Deckung malt nichts.** `.nav-bar__ziel` trägt eine
				 * Kante in `transparent`, damit die 2px-Markierung des aktiven Ziels die
				 * Zeile nicht verschiebt — sie ist Platzhalter und kein Umriss. Der erste
				 * Lauf dieses Sweeps meldete sie auf allen elf Seiten mit dem Verhältnis
				 * 1; gemessen und ausgenommen, statt die Zahl zu erklären. Eine
				 * **teilweise** durchsichtige Kante bleibt gemessen und wird über ihren
				 * Grund gelegt.
				 */
				if (fund.art !== 'text' && vorne !== null && vorne.a === 0) continue;
				if (vorne === null || grund === null || fund.bild || fund.durchscheinend) {
					ziel.push(
						`${route} ${fund.wo}: nicht messbar — ${fund.vordergrund} auf ${fund.stapel.join(' auf ')}` +
							`${fund.bild ? ', Hintergrundbild' : ''}${fund.durchscheinend ? ', Deckung unter 1' : ''}`
					);
					continue;
				}
				/*
				 * **Jede gemessene Farbe muss aus dem Tokenblock kommen.**
				 *
				 * Gate-Regel 1 verbietet ein Farbliteral im Quelltext. Sie kann nicht
				 * sehen, was **gar keine** Deklaration hat: ein `<a>` ohne Farbregel
				 * bekommt sie vom Vorgabestilblatt des Browsers. Genau das hat diese
				 * Zeile am 2026-09-02 gefunden — zwei Verweise im Fliesstext in
				 * Chromes `#0000EE`, im Dunkeln `#9E9EFF`, beides Farben, die dieses
				 * Projekt nie gewählt hat.
				 */
				for (const wert of [fund.vordergrund, ...fund.stapel]) {
					const farbe = farbeLesen(wert);
					if (farbe === null || farbe.a === 0) continue;
					if (tokenmenge.has(wert)) gesehen.add(wert);
					else fremdeFarben.push(`${route} ${fund.wo} ${JSON.stringify(fund.text)}: ${wert}`);
				}
				const gemalt = vorne.a === 1 ? vorne : ueberlagern(vorne, grund);
				const wert = gerundet(verhaeltnis(gemalt, grund));
				if (fund.art === 'text') {
					paare += 1;
					const schwelle = textSchwelle(fund.groesse, fund.gewicht);
					if (wert < schwelle) {
						textBefunde.push(
							`${route} ${fund.wo} ${JSON.stringify(fund.text)}: ${wert} < ${schwelle}`
						);
					}
					continue;
				}
				paare += 1;
				/*
				 * **Die Zustandsmarke — gemessen, gedruckt, und nicht an den 3:1
				 * gehalten.** Seit dem 2026-09-13, und das ist die einzige Ausnahme
				 * dieser Zeile; die vorige (`--hairline`) war am 2026-09-11
				 * ersatzlos gefallen, weil sie einen Befund verdeckte statt einen
				 * Unterschied zu benennen. Diese hier benennt einen:
				 *
				 * NFR9 und WCAG 1.4.11 verlangen Kontrast für das, was zum Erkennen
				 * **nötig** ist. Was diese Zeile ist, sagt ihr Wort; dass sie ein
				 * Bedienelement ist, sagt ihr eigener Umriss in --ink-secondary, und
				 * der wird zwei Zeilen weiter oben weiterhin gegen 3:1 gehalten. Der
				 * Streifen ist die dritte Auskunft über dieselbe Sache, und er darf
				 * darum so gelb sein, wie er auf diesem Grund sein kann.
				 *
				 * **Die Ausnahme bezahlt sich mit zwei Wachen.** Hier: nur die
				 * --reif-Token (seit dem 2026-10-26 zwei) kommen hinein, jede andere Farbe an einem
				 * [data-stufe] fällt auf. Und im Zugangslauf: jede Stufe behält ihr
				 * Wort neben dem Streifen. Fällt das Wort, fällt die Begründung.
				 */
				if (fund.art === 'zustandsmarke') {
					markenGesehen.push(fund.text);
					if (!ampel.has(fund.vordergrund)) {
						markenBefunde.push(
							`${route} ${fund.wo} (${fund.text}): ${fund.vordergrund} ist kein --reif-Token, gemessen ${wert}`
						);
					}
					continue;
				}
				// Dekor: gezählt und auf Farbherkunft geprüft, nicht an NFR9 gehalten.
				if (fund.art === 'trennlinie') continue;
				if (wert < 3) umrissBefunde.push(`${route} ${fund.wo}: ${wert} < 3`);
			}
		}

		pruefen(
			`alle ${KONTRAST_ROUTEN.length} Seiten sind ${wie} erreicht und tragen messbaren Text`,
			stumm.length === 0,
			stumm.join(' | ')
		);
		pruefen(
			`${wie} erreicht jeder gerenderte Text seine Schwelle nach WCAG 1.4.3 (${paare} Paare gemessen)`,
			textBefunde.length === 0,
			[...new Set(textBefunde)].join(' | ')
		);
		/*
		 * **Ohne Ausnahme — seit dem 2026-09-11.**
		 *
		 * Bis dahin nahm diese Zeile die Umrisse in `--hairline` aus und führte
		 * ihre Zahl im eigenen Namen mit. Der Grund war ein offener Befund: der
		 * Kontrast-Sweep vom 2026-09-02 hatte gemessen, dass `--hairline` den Umriss
		 * von vier Bedienelementen trug — `.skip`, `.feld`, `.button-quiet` und
		 * `.eintrag` auf `/mehr` — und zwar bei 1.25 bis 1.44:1, wo NFR9 3:1
		 * verspricht. **DESIGN.md widersprach sich dazu selbst:** die
		 * Komponentenliste schrieb `1px solid {colors.hairline}` für `input` und
		 * `button-quiet` vor, der Absatz zur Kontrasttabelle behauptete zwei Seiten
		 * später, jeder Umriss eines Bedienelements nutze den Akzent und liege
		 * „weit über der Schwelle".
		 *
		 * Entscheid (a) hat die vier Kanten auf `--ink-secondary` gehoben (4.71:1
		 * hell, 6.90:1 dunkel) und DESIGN.md richtiggestellt. Damit ist die Ausnahme
		 * gegenstandslos und **entfernt statt verengt**: diese Zeile beisst jetzt
		 * für jede Farbe.
		 *
		 * **Was sie weiterhin nicht misst, und warum das kein Loch ist:** die Sonde
		 * liest nur `INTERAKTIV` (oben), also Bedienelemente. Die Haarlinie an einer
		 * Karte, am Dialog und an den Trennlinien der Listen kommt hier nie vor —
		 * sie identifiziert kein Bedienelement, und für sie gilt die 3:1-Schwelle
		 * nicht. Deaktivierte Bedienelemente überspringt die Sonde ebenfalls
		 * (`el.closest(':disabled')`), im Einklang mit WCAG 1.4.11.
		 */
		pruefen(
			`${wie} erreicht jeder Umriss eines Bedienelements 3:1`,
			umrissBefunde.length === 0,
			[...new Set(umrissBefunde)].join(' | ')
		);
		pruefen(
			`${wie} stammt jede gemessene Farbe aus dem Tokenblock — keine kommt aus dem Vorgabestilblatt des Browsers`,
			fremdeFarben.length === 0,
			[...new Set(fremdeFarben)].join(' | ')
		);
		/*
		 * **Die Abdeckung ist eine eigene Behauptung.**
		 *
		 * Ein Sweep, der nichts findet, ist grün. Diese Zeile schliesst das aus:
		 * jedes Farbtoken aus TOKENS muss in mindestens einem gemessenen Paar
		 * vorkommen — als Vordergrund oder als deckender Grund. Ein Zustand, den
		 * dieser Lauf nicht herstellt (die überfällige Zeile, die unbesetzte
		 * Dienstwoche, der zerstörende Knopf), fällt damit auf, statt still zu
		 * fehlen.
		 *
		 * Im hellen Modus tragen `--surface-raised` und `--accent-ink` **denselben
		 * Wert** (`#ffffff`); die Zeile kann die zwei dort nicht auseinanderhalten
		 * und behauptet das auch nicht — sie prüft Werte, nicht Namen.
		 */
		const ungesehen = Object.entries(tokenwerte)
			.filter(([, wert]) => !gesehen.has(wert))
			.map(([name, wert]) => `${name} (${wert})`);
		/*
		 * **Die Gegenrechnung zur Ausnahme zwei Bildschirme weiter oben.** Die
		 * Zustandsmarke ist von den 3:1 befreit; damit diese Befreiung nicht zum
		 * Loch wird, darf ausser den --reif-Token (seit dem 2026-10-26 zwei) nichts hindurch — und es
		 * muss überhaupt welche geben. Eine Ausnahme, die auf null Funden sitzt,
		 * ist eine Ausnahme, die niemand mehr prüft.
		 */
		pruefen(
			`${wie} trägt jede der ${markenGesehen.length} Zustandsmarken eine Farbe aus --reif-* (${[...new Set(markenGesehen)].sort().join('/')})`,
			markenBefunde.length === 0 && markenGesehen.length > 0,
			markenGesehen.length === 0
				? 'keine einzige Zustandsmarke gerendert — die Ausnahme sitzt auf nichts'
				: [...new Set(markenBefunde)].join(' | ')
		);
		pruefen(
			`${wie} kommt jedes der ${TOKENS.length} Farbtokens in mindestens einem gemessenen Paar vor`,
			ungesehen.length === 0,
			`nicht gesehen: ${ungesehen.join(', ')}`
		);
	};

	/*
	 * **Ein Zustand, den der Sweep sonst nie zu sehen bekäme.**
	 *
	 * Die oben ausgeschriebene Einzelaufgabe ist inzwischen übernommen — der
	 * Bestätigungspfad hat sie genommen. Damit stünde auf keiner Seite mehr eine
	 * **freie** Karte, und `--surface-open` käme in keinem gemessenen Paar vor.
	 *
	 * Das ist nicht theoretisch: genau so wurde die Abdeckungszeile am 2026-09-11
	 * rot, als die getönte Fläche dazukam. Sie ist dafür gebaut, und die Antwort
	 * darauf ist, den Zustand **herzustellen** — nicht, das Token aus der Liste zu
	 * nehmen. Dieselbe Lehre wie beim Diensthinweis eine Woche zuvor.
	 */
	einzelaufgabeAusschreiben(
		'Hochbeet 4 neu aufschichten',
		Math.floor(Date.now() / 1000) + 14 * 24 * 60 * 60
	);

	await kontrastSweep();

	// -----------------------------------------------------------------------
	// Derselbe Dialog auf /verwaltung — der Rest von Zeile 5 der R5-Liste
	// -----------------------------------------------------------------------
	/*
	 * **Warum dieselbe Prüfliste ein zweites Mal läuft.**
	 *
	 * Der Fehler von Story 1.3 stand nicht auf `/`, sondern hier: nach einem
	 * Antippen von `Widerrufen` blieb der Dialog offen stehen, und weil ein
	 * modaler Dialog den Rest der Seite inert macht, kam man nur über `Abbrechen`
	 * wieder heraus — die Rückmeldung lag unerreichbar dahinter. Der Block auf `/`
	 * misst denselben Bauplan an einer **anderen** Komponente und sagt über diese
	 * nichts; die beiden Fassungen unterscheiden sich sogar (siehe beim Fokus).
	 *
	 * Er steht **nach** dem Sweep: der Widerruf nimmt `--danger` von der Seite.
	 */
	await browser.besuchen(`${adresse}/verwaltung`);

	/*
	 * **Welche Zeile widerrufen wird, wird am Namen entschieden.**
	 *
	 * Nicht an ihrer Stellung in der Liste und nicht an einer Id, die dieses
	 * Skript aus der Saat mitschleppt: die Ordnung der Liste ist eine Zusage der
	 * Abfrageschicht, und hinge die Auswahl daran, beendete dieser Lauf bei einer
	 * geänderten Sortierung still den falschen Zugang — hier wäre das die eigene
	 * Adminsitzung. Dieselbe Klammer wie bei den Aufgabenzeilen weiter oben.
	 *
	 * Mitgenommen wird das Aufnahmedatum der Zeile, weil der Dialog es nennt und
	 * es der einzige Wert ist, der zwei gleichnamige Zeilen auseinanderhält.
	 */
	const fremdeZeile = await browser.auswerten<{ knopfId: string; datum: string }>(`
		const zeilen = [...document.querySelectorAll('.zeile')];
		const zeile = zeilen.find((z) => {
			const name = z.querySelector('.zeile__name');
			return name !== null && name.textContent.includes('Manu Mitglied');
		});
		if (zeile === undefined) throw new Error('keine Zeile für Manu Mitglied auf /verwaltung');
		const knopf = zeile.querySelector('button[id^="widerrufen-"]');
		const hinweis = zeile.querySelector('.hinweis');
		return {
			knopfId: knopf === null ? '' : knopf.id,
			datum: hinweis === null ? '' : hinweis.textContent.trim().replace('Aufgenommen am ', ''),
		};`);
	pruefen(
		'die Zeile von Manu Mitglied steht auf /verwaltung mit ihrem Widerrufen-Knopf',
		fremdeZeile.knopfId !== '' && fremdeZeile.datum !== '',
		JSON.stringify(fremdeZeile)
	);
	const widerrufen = `#${fremdeZeile.knopfId}`;

	await browser.klicken(widerrufen);
	await browser.warten(
		DIALOG_BEREIT,
		'der Widerruf-Dialog geht auf einen Klick auf Einladung widerrufen auf'
	);
	const beimWiderruf = await browser.auswerten<{
		offen: boolean;
		text: string;
		fokusText: string;
		fokusArt: string | null;
		imDialog: boolean;
	}>(`
		const d = document.querySelector('dialog.bestaetigung');
		const t = d.querySelector('.bestaetigung__text');
		const a = document.activeElement;
		return {
			offen: d.open,
			text: t === null ? '' : t.textContent.replace(/\\s+/g, ' ').trim(),
			fokusText: a === null ? '' : a.textContent.trim(),
			fokusArt: a === null ? null : a.getAttribute('type'),
			imDialog: a !== null && d.contains(a),
		};`);
	/*
	 * **Der Dialog nennt die Zeile, die angeklickt wurde** — mit Namen und mit
	 * dem Aufnahmedatum, das in derselben Zeile steht. Solange der Inhalt
	 * unbedingt im Markup stand, trug er den Satz „, aufgenommen am , kommt
	 * danach nicht mehr herein" mit zwei leeren Stellen; er ist heute an
	 * `zuWiderrufen` gebunden, und das ist die Bindung, die hier gemessen wird.
	 * Das Datum kommt aus der Zeile und nicht aus einer eigenen Rechnung dieses
	 * Skripts — sonst prüfte die Zeile die Datumsformatierung mit, und die gehört
	 * ihr nicht.
	 */
	pruefen(
		'der Dialog nennt Namen und Aufnahmedatum der angeklickten Zeile',
		beimWiderruf.text.includes('Manu Mitglied') &&
			beimWiderruf.text.includes(`aufgenommen am ${fremdeZeile.datum}`),
		JSON.stringify(beimWiderruf)
	);
	/*
	 * **Was diese Zeile trägt — und worin sie sich von der auf `/` unterscheidet.**
	 *
	 * Gemessen wurde jede Hälfte einzeln: `abbrechenKnopf.focus()` zu entfernen
	 * lässt sie **grün** (`showModal()` fokussiert das erste fokussierbare
	 * Element, und das ist `Abbrechen`), die Knopfreihenfolge zu drehen ebenso
	 * grün (der ausdrückliche Aufruf holt den Fokus zurück). Rot wird sie erst,
	 * wenn **beides** zugleich fällt. Anders als auf `/` hängt die Zusage hier
	 * also an zwei Gurten statt an einem — die Zeile prüft, dass wenigstens einer
	 * hält, und mehr behauptet sie nicht.
	 */
	pruefen(
		'beim Öffnen liegt der Fokus im Dialog auf Abbrechen — nicht auf der zerstörenden Handlung',
		beimWiderruf.offen &&
			beimWiderruf.imDialog &&
			beimWiderruf.fokusArt === 'button' &&
			beimWiderruf.fokusText === 'Abbrechen',
		JSON.stringify(beimWiderruf)
	);

	/*
	 * Und ein Enter direkt nach dem Öffnen beendet keinen Zugang. Die zweite
	 * Hälfte ist die eigentliche: ein Enter, das den Dialog schliesst und dabei
	 * widerruft, wäre derselbe Fehlgriff mit freundlicherem Gesicht — und hier
	 * gibt es keinen Weg zurück.
	 */
	await browser.taste('Enter');
	await browser.warten(
		DIALOG_LEER,
		'ein Enter auf Abbrechen schliesst den Widerruf-Dialog und leert ihn'
	);
	const nachEnterHier = await browser.auswerten<{
		offen: boolean;
		knopf: boolean;
		beendet: boolean;
	}>(`
		return {
			offen: document.querySelector('dialog.bestaetigung').open,
			knopf: document.querySelector(${JSON.stringify(widerrufen)}) !== null,
			beendet: document.body.textContent.includes('Zugang beendet.'),
		};`);
	pruefen(
		'ein Enter direkt nach dem Öffnen widerruft nichts — der Dialog schliesst, die Zeile bleibt aktiv',
		!nachEnterHier.offen && nachEnterHier.knopf && !nachEnterHier.beendet,
		JSON.stringify(nachEnterHier)
	);

	/*
	 * **Und nach dem Widerruf schliesst der Dialog** — die Zusage, die in
	 * Story 1.3 an genau dieser Stelle gebrochen war.
	 *
	 * Gewartet wird auf die **Rückmeldung** und nicht auf den geschlossenen
	 * Dialog. Der Unterschied ist der Befund dieser Zeile: wartete sie auf
	 * `!open`, dann liefe die Mutation „`dialog?.close()` entfernt" in eine
	 * Zeitschranke und der Lauf endete mit einem unerwarteten Wurf statt mit
	 * einer roten Behauptung. Die Rückmeldung ist der Ausgang des Versands,
	 * `open` ist die Zusage — und geprüft wird die Zusage.
	 */
	await browser.klicken(widerrufen);
	await browser.warten(DIALOG_BEREIT, 'der Widerruf-Dialog geht ein zweites Mal auf');
	await browser.klicken(DIALOG_SCHALTER);
	await browser.warten(
		"document.querySelector('.meldung').textContent.trim() !== ''",
		'die Rückmeldung zum Widerruf steht da'
	);
	const nachWiderruf = await browser.auswerten<{
		offen: boolean;
		knopf: boolean;
		beendet: boolean;
		meldung: string;
	}>(`
		return {
			offen: document.querySelector('dialog.bestaetigung').open,
			knopf: document.querySelector(${JSON.stringify(widerrufen)}) !== null,
			beendet: document.body.textContent.includes('Zugang beendet.'),
			meldung: document.querySelector('.meldung').textContent.trim(),
		};`);
	pruefen(
		'nach dem Widerruf ist der Dialog zu, die Zeile beendet und die Rückmeldung erreichbar',
		!nachWiderruf.offen &&
			!nachWiderruf.knopf &&
			nachWiderruf.beendet &&
			nachWiderruf.meldung.includes('Manu Mitglied'),
		JSON.stringify(nachWiderruf)
	);

	/*
	 * Der Fokus liegt danach in der Rückmeldung und nicht im Nichts. `close()`
	 * gibt ihn an den Knopf zurück, der den Dialog geöffnet hat — und den nimmt
	 * dieselbe Antwort aus dem Dokument. Ohne den Griff in `fokusNach` stünde er
	 * darum auf `<body>`, und die Region, die gerade den Ausgang meldet, wäre für
	 * die Tastatur hinter der ganzen Seite. Dieselbe Zusage wie am Blatt weiter
	 * oben, hier auf der Seite mit der zerstörenden Aktion.
	 */
	const fokusNachWiderruf = await browser.auswerten<{ art: string; klasse: string }>(`
		const a = document.activeElement;
		return {
			art: a === null ? '(keins)' : a.tagName.toLowerCase(),
			klasse: a === null ? '' : a.className,
		};`);
	pruefen(
		'und die Rückmeldung hält den Fokus — der öffnende Knopf, an den close() ihn gäbe, ist fort',
		fokusNachWiderruf.klasse.split(/\s+/).includes('meldung'),
		`fokussiert ist <${fokusNachWiderruf.art} class="${fokusNachWiderruf.klasse}">`
	);

	// -----------------------------------------------------------------------
	// /archiv: die Suche filtert, und ein zugeklappter Monat geht dafür auf
	// -----------------------------------------------------------------------
	/*
	 * **Die Zusage, die nur im Browser messbar ist.** Die Suche auf /archiv
	 * filtert im Browser über die geladene Liste; am ausgelieferten HTML ist
	 * davon nichts zu sehen, und `smoke` und `smoke:http` können sie darum
	 * nicht berühren. Was hier gemessen wird, ist die Kette aus drei Teilen, die
	 * einzeln je für sich richtig sein können und zusammen trotzdem nichts
	 * nützen: der Filter lässt etwas weg, die Trefferzahl sagt wie viel, und der
	 * Aufklapper gibt das Gefundene frei.
	 *
	 * **Der dritte Teil ist der Grund, warum die zwei Änderungen zusammengehören.**
	 * Ein zugeklappter Monat und eine Suche, die ihn nicht öffnet, ergeben eine
	 * Seite, die auf ein getipptes Wort hin leer aussieht — die Treffer sind da,
	 * sie stehen nur hinter einem Griff. Darum wird hier ausdrücklich erst
	 * zugeklappt und dann gesucht.
	 *
	 * Gemessen wird über `getClientRects()` und nicht über das `open`-Attribut:
	 * gefragt ist, ob die Zeile **zu sehen** ist, und das ist die Frage, die ein
	 * Attribut nur mittelbar beantwortet.
	 */
	await browser.besuchen(`${adresse}/archiv`);
	const [gefundenText, weggelassenText] = saat.abgehakteTexte;
	// Ein Wort aus dem einen Text, das im anderen nicht vorkommt — die zwei Texte
	// der Saat haben ausdrücklich keines gemeinsam.
	const suchwort = 'schnecken';

	/*
	 * **`checkVisibility()` und nicht `getClientRects()`**, und das ist gemessen
	 * und nicht gewählt: ein zugeklapptes `<details>` versteckt seinen Inhalt in
	 * Chrome über `content-visibility: hidden`, und darunter behalten die
	 * Nachkommen ihre Rechtecke aus dem letzten Aufbau. Der erste Entwurf dieser
	 * Messung zählte darum nach dem Zuklappen unverändert zwei sichtbare Zeilen —
	 * eine Wache, die grün geblieben wäre, wenn die Aufklapper gar nicht
	 * funktionierten. `checkVisibility()` beantwortet genau die gestellte Frage.
	 */
	/*
	 * **`ausDemPool` seit dem 2026-10-11**, als die Wellnessbehandlungen ins
	 * Archiv kamen. Seit dem 2026-10-12 steht dort je abgeschlossene Kultur eine
	 * Zeile, und die Saat in scripts/pruefserver.ts trägt eine davon — im
	 * laufenden Monat, neben den zwei abgehakten Aufgaben. **Der Grund für den
	 * Filter:** die zwei Behauptungen über die Poolzeilen sagen „genau diese
	 * zwei abgehakten Aufgaben stehen im offenen Monat". Über alle sichtbaren
	 * Zeilen gelesen, hinge das davon ab, was die Saat sonst noch ins Archiv
	 * legt — heute die Bohnen in Beet 2, morgen vielleicht ein Termin —, und
	 * jede neue Saatzeile machte sie rot, ohne dass am Pool etwas falsch wäre.
	 * Darum lesen sie nur die Zeilen mit dem Herkunftswort `Aufgabe`; die
	 * Suche nach `schnecken` liest weiter alle, denn dort ist genau ein Treffer
	 * die Zusage, gleich welcher Art.
	 *
	 * **Die Grenze von `herkunftVon`:** es liest das letzte Stück nach einem `·`
	 * in der Datumszeile. Das trägt, solange das Herkunftswort dort zuletzt
	 * steht (`{datumKurz} · {herkunft}`) und `datumKurz` selbst kein `·`
	 * enthält — heute `15. Sep 2026`. Bekäme die Zeile ein drittes Stück
	 * dahinter, läse diese Messung jenes statt der Herkunft.
	 */
	const sichtbareZeilen = () =>
		browser!.auswerten<{
			sichtbar: string[];
			ausDemPool: string[];
			herkunft: string[];
			zusatz: string[];
			ansage: string;
		}>(`
			const karten = [...document.querySelectorAll('.karte')].filter((karte) => {
				const text = karte.querySelector('.zeile__text');
				return text !== null && text.checkVisibility();
			});
			const herkunftVon = (karte) =>
				(karte.querySelector('.hinweis--ziffern')?.textContent ?? '').split('·').at(-1).trim();
			const textVon = (karte) => karte.querySelector('.zeile__text').textContent.trim();
			const region = document.querySelector('#archiv-treffer');
			return {
				sichtbar: karten.map(textVon),
				ausDemPool: karten.filter((karte) => herkunftVon(karte) === 'Aufgabe').map(textVon),
				herkunft: karten.map(herkunftVon),
				zusatz: karten.map((karte) => karte.querySelector('.archiv__zusatz')?.textContent.trim() ?? ''),
				ansage: region === null ? '(fehlt)' : region.textContent.trim(),
			};`);

	const vorDerSuche = await sichtbareZeilen();
	pruefenGleich(
		'ohne Suche stehen beide abgehakten Zeilen offen da — und die Region sagt nichts',
		`${[...vorDerSuche.ausDemPool].sort().join(' | ')} / ${vorDerSuche.ansage || '(leer)'}`,
		`${[gefundenText, weggelassenText].sort().join(' | ')} / (leer)`
	);

	await browser.klicken('details.monat > summary');
	await browser.warten(
		"[...document.querySelectorAll('.karte .zeile__text')].every((el) => !el.checkVisibility())",
		'der Monat ist zugeklappt'
	);

	await browser.tippen('#archiv-suche', suchwort);
	await browser.warten(
		"document.querySelector('#archiv-treffer').textContent.trim() !== ''",
		'die Trefferansage steht'
	);
	const nachDerSuche = await sichtbareZeilen();
	pruefenGleich(
		'die Suche öffnet den zugeklappten Monat, zeigt ihren Treffer und lässt den anderen weg',
		`${nachDerSuche.sichtbar.join(' | ')} / ${nachDerSuche.ansage}`,
		`${gefundenText} / 1 Treffer`
	);

	/*
	 * **Und die Suche findet den Monat**, seit dem 2026-09-20.
	 *
	 * Bis dahin durchsuchte sie Text, Übernehmer und Herkunftswort und
	 * ausdrücklich **nicht** das Datum — mit der Begründung, nach dem Monat
	 * suche man, indem man ihn aufklappt. Das war eine Annahme über die Leute,
	 * und sie war falsch (Befund Manuel): wer ein Suchfeld über einer nach
	 * Monaten geordneten Liste sieht, tippt einen Monat hinein.
	 *
	 * Gemessen wird gegen den Monatsnamen, den die Seite **selbst** über die
	 * Gruppe schreibt, und nicht gegen einen hier gerechneten: so hält die Zeile
	 * auch am Monatsanfang, und sie prüft genau die Zusage — findbar ist, was
	 * dasteht.
	 */
	await browser.auswerten(`
		const feld = document.querySelector('#archiv-suche');
		feld.value = '';
		feld.dispatchEvent(new Event('input', { bubbles: true }));
		return true;`);
	const monatUeberDerGruppe = await browser.auswerten<string>(
		"return document.querySelector('.monat .marke').textContent.trim()"
	);
	await browser.tippen('#archiv-suche', monatUeberDerGruppe);
	await browser.warten(
		"document.querySelector('#archiv-treffer').textContent.trim() !== ''",
		'die Trefferansage zum Monat steht'
	);
	const nachMonat = await sichtbareZeilen();
	pruefenGleich(
		`die Suche findet auch den Monat, unter dem die Zeilen stehen (${monatUeberDerGruppe})`,
		[...nachMonat.ausDemPool].sort().join(' | '),
		[gefundenText, weggelassenText].sort().join(' | ')
	);

	/*
	 * **Die Suche nach dem Herkunftswort `Wellness`**, seit dem 2026-10-11
	 * (spec-wellness-im-archiv.md), und seit dem 2026-10-12 nach den
	 * Abschlüssen (spec-wellness-abschliessen-ins-archiv.md). Gefunden werden
	 * muss genau **eine** Zeile: die abgeschlossenen Bohnen der Saat, mit Text
	 * `{Beet} · {Kultur}`, ihrer Mittelzeile und dem Wort `Wellness`. Die vier
	 * offenen Behandlungen der Saat stehen nicht im Archiv — eine load, die sie
	 * wieder einzeln läse, machte die Treffermenge grösser und diese Zeile rot.
	 *
	 * **Die erwarteten Texte kommen aus der Saat** (`saat.abschluss`), wo sie
	 * ausgeschrieben stehen; die Regel selbst prüft scripts/smoke-zugang.ts an
	 * der load.
	 *
	 * **Gewartet wird auf das Ergebnis, nicht auf irgendeine Ansage.** Die
	 * Region trug eben noch die Trefferzahl der Monatssuche; „nicht leer" sähe
	 * dann den alten Stand. Die Bedingung ist darum: es sind Zeilen sichtbar
	 * und alle tragen `Wellness` — oder die Region sagt `Nichts gefunden.`,
	 * damit ein Fehler als rote Behauptung endet und nicht als
	 * Zeitüberschreitung. Ein Zwischenstand beim Tippen erfüllt die erste
	 * Hälfte nicht vorzeitig: jedes Präfix von `Wellness` trifft alle
	 * Wellnesszeilen, die Treffermenge schrumpft also nie unter die gesuchte.
	 */
	const suchfeldLeeren = () =>
		browser!.auswerten(`
			const feld = document.querySelector('#archiv-suche');
			feld.value = '';
			feld.dispatchEvent(new Event('input', { bubbles: true }));
			return true;`);
	const nurWellnessSichtbar = `(() => {
			const region = document.querySelector('#archiv-treffer').textContent.trim();
			if (region === 'Nichts gefunden.') return true;
			const herkunft = [...document.querySelectorAll('.karte')]
				.filter((karte) => karte.querySelector('.zeile__text')?.checkVisibility())
				.map((karte) =>
					(karte.querySelector('.hinweis--ziffern')?.textContent ?? '').split('·').at(-1).trim()
				);
			return region !== '' && herkunft.length > 0 && herkunft.every((wort) => wort === 'Wellness');
		})()`;
	await suchfeldLeeren();
	await browser.tippen('#archiv-suche', 'Wellness');
	await browser.warten(nurWellnessSichtbar, 'die Suche zeigt nur noch Wellnesszeilen');
	const nachWellness = await sichtbareZeilen();
	pruefenGleich(
		'die Suche nach Wellness zeigt genau den Abschluss der Saat — Beet · Kultur, die Mittel mit Anzahl, das Herkunftswort',
		`${nachWellness.sichtbar.join(' | ')} / ${nachWellness.zusatz.join(' | ')} / ${nachWellness.herkunft.join(',')} / ${nachWellness.ansage}`,
		`${saat.abschluss.text} / ${saat.abschluss.zusatz} / Wellness / 1 Treffer`
	);

	/*
	 * **Und die Suche findet die Mittel eines Abschlusses** (Spec: „Die Suche
	 * im Archiv findet auch die Mittel dieser Zeile"). `Beinwell` steht nur in
	 * der Mittelzeile — nicht im Text, nicht im Herkunftswort, nicht im Datum
	 * —, also findet es die Zeile genau dann, wenn `durchsuchbar` den Zusatz
	 * mitliest. Vorgeführt: `zeile.zusatz` aus `durchsuchbar` genommen, und die
	 * Region sagt `Nichts gefunden.`.
	 */
	await suchfeldLeeren();
	await browser.tippen('#archiv-suche', saat.abschluss.mittelwort);
	await browser.warten(nurWellnessSichtbar, 'die Suche nach dem Mittel ist ausgewertet');
	const nachMittel = await sichtbareZeilen();
	pruefenGleich(
		`die Suche nach einem Mittel (${saat.abschluss.mittelwort}) findet die Abschlusszeile`,
		`${nachMittel.sichtbar.join(' | ')} / ${nachMittel.ansage}`,
		`${saat.abschluss.text} / 1 Treffer`
	);

	/*
	 * **Und das Suchfeld ist wirklich grösser als ein gewöhnliches Feld.**
	 *
	 * `.feld--suche` hebt die Mindesthöhe um `--space-4` über `--touch` und die
	 * Schrift auf `--section-size` (Entscheid Manuel, 2026-09-20: viel grösser
	 * machen). Gemessen wird gegen **das Trefferminimum** und nicht gegen eine
	 * feste Pixelzahl: was die Regel zusagt, ist „deutlich über dem Boden", und
	 * eine Zahl hier wäre eine zweite Wahrheit über einen Wert, der aus zwei
	 * Tokens entsteht.
	 */
	const suchfeld = await browser.auswerten<{ hoehe: number; schrift: number }>(`
		const f = document.querySelector('#archiv-suche');
		return {
			hoehe: Math.round(f.getBoundingClientRect().height),
			schrift: Math.round(parseFloat(getComputedStyle(f).fontSize)),
		};`);
	pruefen(
		`das Suchfeld steht deutlich über dem Trefferminimum (${suchfeld.hoehe}px, Schrift ${suchfeld.schrift}px)`,
		suchfeld.hoehe > TREFFER_MINIMUM && suchfeld.schrift > 16,
		JSON.stringify(suchfeld)
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
