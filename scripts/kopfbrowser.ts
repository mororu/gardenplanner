/*
 * Ein kopfloser Browser über das Chrome DevTools Protocol — Stufe C, und zwar
 * **ohne fremde Abhängigkeit**.
 *
 * Der vierstufige Vorschlag aus Story 1.3 hat Stufe C dreimal an Playwright
 * gebunden, und dreimal war der Preis „eine fremde Abhängigkeit, und NFR13
 * fällt dem Sinn nach". Die Prämisse stimmte nicht: Node bringt seit 22 ein
 * globales `WebSocket` mit, Chrome spricht CDP über genau das, und der
 * Prozessstart ist `spawn`. Was hier steht, ist reines
 * Node — dieselbe Bauform wie die drei bestehenden Prüfskripte.
 *
 * NFR13 lautet seit dem 2026-08-30 präzisiert *keine fremde Abhängigkeit für
 * Prüfung*, nicht *keine Prüfung*. Dieses Modul verletzt ihn damit nicht.
 *
 * **Was es kann:** gerenderte Geometrie, berechnete Stile, emulierte
 * Medienabfragen (dunkler Modus, `prefers-reduced-motion`), ein gesetztes
 * Cookie, ein Viewport von 375px. Das ist genau die Klasse, die Befund R1 der
 * zweiten Retrospektive zu Epic 3 gerissen hat — ein Selektor, dem sein
 * Regelkörper abhandenkam, ausgeliefert, durch 755 Behauptungen gelaufen.
 *
 * **Was es nicht kann, ausgeschrieben statt verschwiegen:**
 *   - **Nur Chromium.** Playwright deckt drei Engines; das Zielgerät dieses
 *     Projekts ist ein Handy, also oft iOS Safari. Eine Zusage über Safari ist
 *     das hier nicht. Gegen den Zustand davor — gar keine Messung — ist es
 *     trotzdem ein Gewinn, und der Unterschied ist benannt.
 *   - **Keine Ansage.** Ob ein Screenreader eine Live-Region vorliest, sieht
 *     auch ein kopfloser Browser nicht. Das bleibt die Handprüfung.
 *   - **Chrome muss auf der Maschine sein.** Fehlt er, scheitert der Lauf laut
 *     und benannt, so wie `bauPruefen` bei veraltetem Bau — nicht still
 *     übersprungen. Ein übersprungener Prüflauf, der grün meldet, ist der
 *     Zustand, gegen den dieses ganze Werkzeug gebaut ist.
 */
import { spawn } from 'node:child_process';
import type { ChildProcessByStdio } from 'node:child_process';
import { existsSync } from 'node:fs';
import type { Readable } from 'node:stream';

/**
 * Wo Chrome liegen kann, in der Reihenfolge, in der gesucht wird.
 *
 * `CHROME_PFAD` steht zuerst, damit eine Maschine mit einem Chromium an einer
 * eigenen Stelle nicht diese Liste ändern muss. Die übrigen sind die üblichen
 * Orte auf macOS und Linux; die Liste ist bewusst kurz und nennt keine
 * Snap- oder Flatpak-Pfade, weil dieses Projekt auf keiner solchen Maschine
 * gebaut wird — wer eine hat, setzt die Umgebungsvariable.
 */
const CHROME_ORTE = [
	process.env.CHROME_PFAD,
	'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
	'/Applications/Chromium.app/Contents/MacOS/Chromium',
	'/usr/bin/google-chrome',
	'/usr/bin/chromium',
	'/usr/bin/chromium-browser',
] as const;

/** Der erste vorhandene Chrome, oder null. */
export function chromeFinden(): string | null {
	for (const ort of CHROME_ORTE) {
		if (ort !== undefined && ort !== '' && existsSync(ort)) return ort;
	}
	return null;
}

/** Wie lange auf die DevTools-Adresse und auf jede Antwort gewartet wird. */
const START_SCHRANKE_MS = 30_000;
const ANTWORT_SCHRANKE_MS = 15_000;

type Nachricht = { id?: number; result?: unknown; error?: { message: string } };

export type Browser = {
	/** Ein CDP-Aufruf in der Sitzung der geöffneten Seite. */
	senden: (
		methode: string,
		parameter?: Record<string, unknown>
	) => Promise<Record<string, unknown>>;
	/** Ein Ausdruck im Seitenkontext, als Wert zurück. */
	auswerten: <T>(ausdruck: string) => Promise<T>;
	/** Eine Adresse laden und auf das Ende des Ladens warten. */
	besuchen: (adresse: string) => Promise<void>;
	/** Ein echter Klick in die Mitte des Elements, über die Eingabeschicht. */
	klicken: (auswahl: string) => Promise<void>;
	/** Das Element fokussieren und Text hineintippen, Zeichen für Zeichen. */
	tippen: (auswahl: string, text: string) => Promise<void>;
	/** Eine Taste drücken und loslassen (`Enter`, `Escape`, `Tab`). */
	taste: (name: 'Enter' | 'Escape' | 'Tab') => Promise<void>;
	/** Warten, bis ein Ausdruck im Seitenkontext wahr wird. */
	warten: (ausdruck: string, was: string, fristMs?: number) => Promise<void>;
	/** Netzverzögerung setzen — für Zusagen, die nur während eines Versands gelten. */
	verzoegern: (millisekunden: number) => Promise<void>;
	/** Alles, was Chrome auf die Fehlerausgabe gesagt hat — Plattformrauschen inklusive. */
	fehlerausgabe: () => string;
	/**
	 * Was die **Seite** zu beklagen hatte: geworfene Ausnahmen und
	 * `console.error`.
	 *
	 * Chromes eigene Fehlerausgabe ist dafür die falsche Quelle. Ein erster
	 * Entwurf las sie, und auf macOS meldete der kopflose Browser sechsmal
	 * `CVDisplayLinkCreateWithCGDisplay failed` — Plattformrauschen ohne jeden
	 * Bezug zur Seite. Wer das mit einer Ausschlussliste erschlägt, filtert
	 * irgendwann auch echte Fehler weg. Diese Liste kommt darum aus dem
	 * Protokoll und trägt nur, was im Seitenkontext geschah.
	 */
	seitenfehler: () => string[];
	schliessen: () => Promise<void>;
};

/**
 * Startet Chrome kopflos, öffnet eine Seite und hängt sich an sie.
 *
 * Das Profil liegt in einem Wegwerfverzeichnis, das der Rufer stellt und
 * aufräumt — dasselbe Muster wie bei der Wegwerf-Datenbank. Ohne eigenes Profil
 * fasst Chrome das des Benutzers an, und ein Prüflauf, der die Sitzungen des
 * Menschen anrührt, ist ein Fehler und kein Prüflauf.
 *
 * `--headless=new` und nicht das alte `--headless`: die alte Fassung ist eine
 * eigene Rendering-Betriebsart mit eigenen Abweichungen, die neue ist derselbe
 * Renderer wie im Fenster. Für ein Skript, das **Geometrie** messen soll, ist
 * das der ganze Punkt.
 */
export async function browserStarten(chrome: string, profil: string): Promise<Browser> {
	const kind: ChildProcessByStdio<null, Readable, Readable> = spawn(
		chrome,
		[
			'--headless=new',
			'--remote-debugging-port=0',
			`--user-data-dir=${profil}`,
			'--no-first-run',
			'--no-default-browser-check',
			'--disable-gpu',
			// Kein Netz nach draussen: die Schriften liegen selbst gehostet im Bau,
			// und ein Prüflauf, der auf ein fremdes CDN wartet, hängt an dessen
			// Verfügbarkeit statt an der eigenen Zusage.
			'--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',
			'about:blank',
		],
		{ stdio: ['ignore', 'pipe', 'pipe'] }
	);

	let stderr = '';
	kind.stderr.setEncoding('utf8');
	kind.stderr.on('data', (stueck: string) => (stderr += stueck));

	const adresse = await new Promise<string>((erfuellen, ablehnen) => {
		const frist = setTimeout(() => {
			kind.kill('SIGKILL');
			ablehnen(
				new Error(
					`Chrome hat in ${START_SCHRANKE_MS / 1000} Sekunden keine DevTools-Adresse gemeldet.` +
						`\nstderr: ${stderr.trim() || '(leer)'}`
				)
			);
		}, START_SCHRANKE_MS);
		const schauen = () => {
			const treffer = /ws:\/\/\S+/.exec(stderr);
			if (treffer === null) return;
			clearTimeout(frist);
			kind.stderr.off('data', schauen);
			erfuellen(treffer[0]);
		};
		kind.stderr.on('data', schauen);
		kind.on('exit', (status) => {
			clearTimeout(frist);
			ablehnen(
				new Error(
					`Chrome endete mit Status ${status}, bevor er lauschte.\nstderr: ${stderr.trim()}`
				)
			);
		});
		schauen();
	});

	const draht = new WebSocket(adresse);
	await new Promise<void>((erfuellen, ablehnen) => {
		draht.addEventListener('open', () => erfuellen(), { once: true });
		draht.addEventListener('error', () => ablehnen(new Error('Der CDP-Draht ging nicht auf.')), {
			once: true,
		});
	});

	let laufendeNummer = 0;
	const offen = new Map<number, (n: Nachricht) => void>();
	/** Ereignisse, auf die gewartet wird — Methodenname → Auflöser. */
	const erwartet = new Map<string, () => void>();

	/** Ausnahmen und console.error aus dem Seitenkontext, in der Reihenfolge. */
	const seitenfehler: string[] = [];

	draht.addEventListener('message', (ereignis) => {
		const nachricht = JSON.parse(String(ereignis.data)) as Nachricht & {
			method?: string;
			params?: Record<string, unknown>;
		};
		if (nachricht.id !== undefined) {
			offen.get(nachricht.id)?.(nachricht);
			offen.delete(nachricht.id);
			return;
		}
		if (nachricht.method === undefined) return;

		if (nachricht.method === 'Runtime.exceptionThrown') {
			const einzelheiten = (nachricht.params?.exceptionDetails ?? {}) as {
				text?: string;
				exception?: { description?: string };
			};
			seitenfehler.push(
				`Ausnahme: ${einzelheiten.exception?.description ?? einzelheiten.text ?? '(ohne Text)'}`
			);
		}
		if (nachricht.method === 'Runtime.consoleAPICalled' && nachricht.params?.type === 'error') {
			const teile = (nachricht.params.args ?? []) as { value?: unknown; description?: string }[];
			seitenfehler.push(
				`console.error: ${teile.map((t) => String(t.value ?? t.description ?? '?')).join(' ')}`
			);
		}

		erwartet.get(nachricht.method)?.();
		erwartet.delete(nachricht.method);
	});

	/**
	 * Ein CDP-Aufruf. Jeder Fehler wird ein Wurf mit der Meldung des Protokolls —
	 * ein stillschweigend verworfener `error` wäre ein Prüflauf, der über eine
	 * fehlgeschlagene Messung hinwegläuft.
	 */
	const rufen = (
		methode: string,
		parameter: Record<string, unknown> = {},
		sitzung?: string
	): Promise<Record<string, unknown>> =>
		new Promise((erfuellen, ablehnen) => {
			const nummer = (laufendeNummer += 1);
			const frist = setTimeout(() => {
				offen.delete(nummer);
				ablehnen(new Error(`CDP-Aufruf ${methode} blieb ${ANTWORT_SCHRANKE_MS} ms ohne Antwort.`));
			}, ANTWORT_SCHRANKE_MS);
			offen.set(nummer, (nachricht) => {
				clearTimeout(frist);
				if (nachricht.error !== undefined) {
					ablehnen(new Error(`CDP-Aufruf ${methode} scheiterte: ${nachricht.error.message}`));
					return;
				}
				erfuellen((nachricht.result ?? {}) as Record<string, unknown>);
			});
			draht.send(
				JSON.stringify({
					id: nummer,
					method: methode,
					params: parameter,
					...(sitzung ? { sessionId: sitzung } : {}),
				})
			);
		});

	const ziel = (await rufen('Target.createTarget', { url: 'about:blank' })) as {
		targetId: string;
	};
	const angehaengt = (await rufen('Target.attachToTarget', {
		targetId: ziel.targetId,
		flatten: true,
	})) as { sessionId: string };
	const sitzung = angehaengt.sessionId;

	const senden = (methode: string, parameter: Record<string, unknown> = {}) =>
		rufen(methode, parameter, sitzung);

	await senden('Page.enable');
	await senden('Runtime.enable');
	await senden('Network.enable');

	const auswerten = async <T>(ausdruck: string): Promise<T> => {
		/*
		 * `returnByValue` verlangt einen strukturklonbaren Wert. Alles Gemessene
		 * geht darum als JSON-Zeichenkette über den Draht und wird hier gelesen:
		 * ein DOMRect ist kein klonbarer Wert, und ein halb übertragenes Objekt
		 * wäre eine Messung, die aussieht wie eine.
		 */
		const antwort = (await senden('Runtime.evaluate', {
			expression: `JSON.stringify((() => { ${ausdruck} })())`,
			returnByValue: true,
			awaitPromise: true,
		})) as {
			result: { value?: string };
			exceptionDetails?: { text: string; exception?: { description?: string } };
		};
		if (antwort.exceptionDetails !== undefined) {
			const ausnahme = antwort.exceptionDetails;
			throw new Error(
				`Der Ausdruck warf im Seitenkontext: ${ausnahme.exception?.description ?? ausnahme.text}`
			);
		}
		if (antwort.result.value === undefined)
			throw new Error('Der Ausdruck gab undefined zurück — nichts zu messen.');
		return JSON.parse(antwort.result.value) as T;
	};

	/**
	 * Laden und auf `Page.loadEventFired` warten.
	 *
	 * Ein `Page.navigate` allein erfüllt, sobald die Navigation **beginnt**. Wer
	 * danach messen will, mässe die alte Seite — und weil die Werte plausibel
	 * aussehen, fiele es nicht auf. Darum wird auf das Ereignis gewartet, und
	 * zwar mit einer Frist: eine Seite, die nie fertig lädt, soll einen benannten
	 * Wurf ergeben und nicht die Prüfkette anhalten.
	 */
	const besuchen = async (zieladresse: string): Promise<void> => {
		const geladen = new Promise<void>((erfuellen, ablehnen) => {
			const frist = setTimeout(() => {
				erwartet.delete('Page.loadEventFired');
				ablehnen(new Error(`${zieladresse} war nach ${ANTWORT_SCHRANKE_MS} ms nicht geladen.`));
			}, ANTWORT_SCHRANKE_MS);
			erwartet.set('Page.loadEventFired', () => {
				clearTimeout(frist);
				erfuellen();
			});
		});
		await senden('Page.navigate', { url: zieladresse });
		await geladen;
		/*
		 * Und einen Bildaufbau abwarten. `load` sagt, dass die Ressourcen da sind,
		 * nicht dass Svelte gehydriert und der Stil angewandt ist. Zwei
		 * verschachtelte `requestAnimationFrame` sind der billigste Weg, auf den
		 * nächsten fertigen Rahmen zu warten — und Geometrie vor dem ersten Rahmen
		 * zu messen ergibt Nullen, die wie Werte aussehen.
		 */
		await auswerten<boolean>(
			'return new Promise((g) => requestAnimationFrame(() => requestAnimationFrame(() => g(true))))'
		);
	};

	/*
	 * **Ein echter Klick und kein `el.click()`.**
	 *
	 * `el.click()` erzeugt ein Ereignis ohne Zeiger, ohne Koordinaten und ohne
	 * Trefferprüfung: es trifft auch ein Element, das hinter einem anderen liegt,
	 * ausserhalb des Fensters steht oder `pointer-events: none` trägt. Für eine
	 * Zusage über ein **Trefferfeld** wäre das die falsche Messung — genau die
	 * Klasse Fehler, gegen die dieses Skript gebaut ist. Geklickt wird darum in
	 * die gemessene Mitte, über dieselbe Eingabeschicht, die ein Finger benutzt.
	 *
	 * Vorher wird das Element in den Blick gerollt: ein Klick auf Koordinaten
	 * unterhalb des Fensters trifft, was dort gerade sichtbar ist.
	 */
	const klicken = async (auswahl: string): Promise<void> => {
		const mitte = await auswerten<{ x: number; y: number }>(`
			const el = document.querySelector(${JSON.stringify(auswahl)});
			if (el === null) throw new Error('nicht im Dokument: ' + ${JSON.stringify(auswahl)});
			el.scrollIntoView({ block: 'center', behavior: 'instant' });
			const r = el.getBoundingClientRect();
			if (r.width === 0 || r.height === 0)
				throw new Error('ohne Fläche, also nicht anklickbar: ' + ${JSON.stringify(auswahl)});
			return { x: r.left + r.width / 2, y: r.top + r.height / 2 };`);
		for (const art of ['mousePressed', 'mouseReleased'] as const) {
			await senden('Input.dispatchMouseEvent', {
				type: art,
				x: mitte.x,
				y: mitte.y,
				button: 'left',
				buttons: art === 'mousePressed' ? 1 : 0,
				clickCount: 1,
			});
		}
	};

	const tippen = async (auswahl: string, text: string): Promise<void> => {
		await auswerten<boolean>(`
			const el = document.querySelector(${JSON.stringify(auswahl)});
			if (el === null) throw new Error('nicht im Dokument: ' + ${JSON.stringify(auswahl)});
			el.focus();
			return true;`);
		// insertText und nicht Taste für Taste: der Inhalt ist hier der Gegenstand,
		// nicht die Tastaturbehandlung, und ein Umlaut über keyDown wäre eine
		// eigene Baustelle.
		await senden('Input.insertText', { text });
	};

	/** Die drei Tasten, die dieses Projekt zusagt, mit ihren Codes. */
	const TASTEN = {
		Enter: { key: 'Enter', code: 'Enter', nummer: 13, text: '\r' },
		Escape: { key: 'Escape', code: 'Escape', nummer: 27, text: '' },
		Tab: { key: 'Tab', code: 'Tab', nummer: 9, text: '' },
	} as const;

	const taste = async (name: keyof typeof TASTEN): Promise<void> => {
		const t = TASTEN[name];
		for (const art of ['keyDown', 'keyUp'] as const) {
			await senden('Input.dispatchKeyEvent', {
				type: art,
				key: t.key,
				code: t.code,
				windowsVirtualKeyCode: t.nummer,
				nativeVirtualKeyCode: t.nummer,
				...(art === 'keyDown' && t.text !== '' ? { text: t.text } : {}),
			});
		}
	};

	/*
	 * **Warten auf eine Bedingung, nicht auf eine Dauer.**
	 *
	 * Nach einem Klick läuft ein `use:enhance`-Versand, Svelte arbeitet seine
	 * Effekte ab, und mitunter navigiert SvelteKit. Ein festes `setTimeout` wäre
	 * entweder zu kurz (dann misst der Lauf den Zustand davor und wird sprunghaft
	 * rot) oder zu lang (dann kostet jede Zeile Sekunden). Gewartet wird darum auf
	 * die Bedingung selbst, und der Fehlschlag nennt, worauf gewartet wurde.
	 */
	const warten = async (ausdruck: string, was: string, fristMs = 5_000): Promise<void> => {
		const ende = Date.now() + fristMs;
		let letzterFehler = '';
		while (Date.now() < ende) {
			try {
				if (await auswerten<boolean>(`return Boolean(${ausdruck})`)) return;
			} catch (fehler) {
				// Ein Ausdruck, der während einer Navigation wirft, ist erwartbar:
				// gewartet wird auf den Zustand danach, nicht auf den dazwischen.
				letzterFehler = fehler instanceof Error ? fehler.message : String(fehler);
			}
			await new Promise((g) => setTimeout(g, 50));
		}
		throw new Error(
			`${was}: die Bedingung wurde in ${fristMs} ms nicht wahr` +
				(letzterFehler === '' ? '' : ` (letzter Wurf: ${letzterFehler})`)
		);
	};

	const verzoegern = async (millisekunden: number): Promise<void> => {
		await senden('Network.emulateNetworkConditions', {
			offline: false,
			latency: millisekunden,
			downloadThroughput: -1,
			uploadThroughput: -1,
		});
	};

	return {
		senden,
		auswerten,
		besuchen,
		klicken,
		tippen,
		taste,
		warten,
		verzoegern,
		fehlerausgabe: () => stderr,
		seitenfehler: () => [...seitenfehler],
		schliessen: async () => {
			try {
				draht.close();
			} catch {
				// Ein bereits geschlossener Draht ist kein Fehler beim Aufräumen.
			}
			await new Promise<void>((erfuellen) => {
				if (kind.exitCode !== null || kind.signalCode !== null) {
					erfuellen();
					return;
				}
				const notbremse = setTimeout(() => {
					kind.kill('SIGKILL');
					setTimeout(erfuellen, 1_000);
				}, 3_000);
				kind.once('exit', () => {
					clearTimeout(notbremse);
					erfuellen();
				});
				kind.kill('SIGTERM');
			});
		},
	};
}
