<script lang="ts">
	import { enhance } from '$app/forms';
	// SubmitFunction kommt aus @sveltejs/kit, nicht aus $app/forms: dort ist nur
	// enhance selbst ausgeführt, der Typ liegt im Hauptmodul.
	import type { ActionResult, SubmitFunction } from '@sveltejs/kit';
	import { resolve } from '$app/paths';
	import { tick } from 'svelte';
	import type { PageProps } from './$types';
	import { datumKasten, datumKurz, datumLang } from '$lib/client/utils/date';
	import { AUFGABE_HOECHSTLAENGE } from '$lib/aufgabentext';
	import ZeichenWinkel from '$lib/components/ZeichenWinkel.svelte';
	import ZeichenStift from '$lib/components/ZeichenStift.svelte';
	import {
		EINZELAUFGABE_NICHT_ANSPRECHBAR,
		fristZusatz,
		ERLEDIGT_KNOPF,
		MEINE_MARKE,
		UEBERNAHME_FOLGE,
		VERSAND_FEHLGESCHLAGEN,
		GRIFF_FREI_LEER,
		GRIFF_OFFEN_LEER,
		GRIFF_FREI,
		GRIFF_OFFEN,
		UEBERNEHMEN_KNOPF,
		griffUeberfaellig,
		zeileBald,
		zeileUnbesetzt,
	} from '$lib/texte';

	const { data, form }: PageProps = $props();

	/*
		Welche Zeilen in **dieser Sitzung** abgehakt wurden.

		Die sichtbare Erledigt-Darstellung hängt an diesem Zustand und **nicht** am
		`checked` des DOM-Kästchens. Das ist die zweite von zwei unabhängigen
		Sicherungen für die eine Zusage dieser Story — die Zeile bleibt an ihrem
		Platz stehen:

		  1. Der Rückruf unten ruft update({ reset: false, invalidateAll: false }).
		     Beide Vorgaben von use:enhance sind `true`, und beide würden die Zeile
		     wegnehmen: invalidateAll lädt die Liste neu (und die abgehakte Aufgabe
		     ist dann keine offene mehr), reset ruft form.reset() und setzte das
		     Kästchen auf seinen serverseitig gerenderten Zustand zurück, also auf
		     leer.
		  2. Selbst wenn eine dieser Vorgaben je zurückkäme, entscheidet dieser
		     Zustand über die Darstellung. Eine einzige Sicherung wäre eine stille
		     Zusage: sie stünde in einem Argument, das jemand beim nächsten
		     Anfassen als Rauschen entfernt.

		Der Zustand lebt nur so lange wie die Komponente. Ein Neuladen ist ein GET,
		und die abgehakte Zeile ist dann fort — für alle.
	*/
	let erledigt = $state<number[]>([]);

	/*
		Eine Sperre für die ganze Seite, plus die zwei Riegel aus Story 1.3:
		`disabled` am Kästchen ist der sichtbare und der für die Tastatur
		wirksame, greift aber erst mit dem nächsten Rendern; `cancel()` im Rückruf
		deckt das Fenster davor ab. Seitenweit und nicht je Zeile, weil bei einer
		Handvoll Aufgaben ein Doppelgriff über zwei Zeilen derselbe Fehler ist wie
		zweimal auf dieselbe.
	*/
	let imFlug = $state(false);

	/**
	 * Die vom Server zurückgegebene Frage — der Weg **ohne** JavaScript.
	 *
	 * Mit JavaScript entsteht sie nie: der Rückruf unten bricht den ersten Versand
	 * ab, es gibt also keine Antwort, die `form` auf `fragen` setzen könnte. Sie
	 * ist damit kein toter Zweig, sondern der einzige Zweig für den Fall, für den
	 * sie gebaut ist.
	 */
	const frage = $derived(
		form !== null && form.art === 'fragen'
			? { id: form.einzelaufgabeId, titel: form.titel, terminAt: form.terminAt }
			: null
	);

	/*
		**Die Frage kann ihre Zeile verlieren, und zwar ohne JavaScript.** Zwischen
		der Antwort der action und dem Rendern läuft die `load` erneut; hat in
		diesem Fenster jemand anders zugesagt, steht die Aufgabe nicht mehr in
		`data.einzelaufgaben`, und die Frage hätte keine Zeile, an der sie
		erscheinen könnte. Sie fiele damit lautlos aus — der Knopf sähe aus, als
		hätte er nichts getan.

		Der Fall ist schmal und trotzdem der richtige Ausgang des Wettrennens: wer
		zu spät kommt, liest denselben Satz wie beim zweiten Schritt.
	*/
	const frageZeile = $derived(
		frage === null ? undefined : data.einzelaufgaben.find((zeile) => zeile.id === frage.id)
	);

	/**
	 * Die Rückmeldung im Perfekt desselben Verbs, für die höfliche Live-Region.
	 *
	 * Zwei Quellen, eine Region. Ein Ausgang aus `form` gewinnt, weil er der
	 * jüngere ist: wer nach dem Ablegen abhakt, liest `Abgehakt. …` und nicht
	 * mehr die Bestätigung des Ablegens — die Adresse trägt `?abgelegt` dann zwar
	 * noch, aber sie beschreibt nicht mehr das Letzte, was geschehen ist.
	 *
	 * `data.abgelegt` ist seit Story 2.1 eine **Zahl oder null** und kein
	 * Wahrheitswert mehr: /aufgabe legt eine Zeile ab und schickt das bare
	 * `?abgelegt`, das die load als 1 liest; /monatsplan legt einen Stapel ab und
	 * schickt `?abgelegt=22`. Der Satz entsteht hier und nicht dort — die eine
	 * Zeile bleibt `Abgelegt.`, weil `1 Aufgabe abgelegt.` neben einem Griff, der
	 * genau eine Aufgabe erfasst, wie eine Zählung klänge.
	 */
	const rueckmeldung = $derived.by(() => {
		if (form === null) {
			/*
				`?ausgeschrieben` vor `?abgelegt`, und die Reihenfolge zählt nur für
				eine von Hand zusammengesetzte Adresse: die zwei Parameter kommen aus
				zwei verschiedenen Weiterleitungen und stehen nie zusammen da. Eine
				Verzweigung braucht trotzdem eine Ordnung, und die verbindlichere
				Meldung gewinnt.
			*/
			if (data.ausgeschrieben) return 'Ausgeschrieben.';
			if (data.abgelegt === null) return '';
			return data.abgelegt === 1 ? 'Abgelegt.' : `${data.abgelegt} Aufgaben abgelegt.`;
		}
		if (form.art === 'abgehakt' || form.art === 'wiederGeoeffnet' || form.art === 'geaendert') {
			return `${form.meldung} ${form.text}`;
		}
		/*
			Beim Entfernen trägt die Meldung den Text schon in sich — und das ist der
			Zweck: es gibt keinen Rückweg, und was fort ist, soll wenigstens noch
			einmal dastehen, solange der Griff frisch ist.
		*/
		if (form.art === 'entfernt') {
			return form.meldung;
		}
		// Der Titel steht im Satz, wie der Aufgabentext beim Abhaken: die Region
		// sagt an, **was** gerade geschehen ist, nicht nur **dass**.
		if (form.art === 'uebernommen' || form.art === 'abgeschlossen') {
			return `${form.meldung} ${form.titel}`;
		}
		/*
			**Der Weg ohne JavaScript braucht hier einen Satz.** Der Server hat mit
			einer Frage geantwortet, und die steht weiter unten an ihrer Zeile — aber
			die Antwort auf einen POST ist ein frisches Dokument, und der Blick
			beginnt oben. Ohne diese Zeile landete jemand nach dem Antippen von
			`Übernehmen` auf einer Seite, die aussieht wie vorher, während die Frage
			ausserhalb des Bildschirms wartet.

			Nur wenn die Zeile noch da ist: ist sie es nicht, sagt statt dessen die
			Fehlerregion darunter, was los ist.
		*/
		if (form.art === 'fragen' && frageZeile !== undefined) {
			return `Bitte bestätigen: ${form.titel}`;
		}
		return '';
	});

	/** Der eine Satz für alle vier nicht ansprechbaren Zustände. */
	/*
		Ein Wurf in einer action, abgefangen im Rückruf unten statt an die
		Fehlergrenze weitergereicht. Eigener Zustand und nicht aus `form`
		abgeleitet: bei `result.type === 'error'` läuft update() gar nicht, `form`
		bleibt also auf dem Stand davor stehen. Der nächste Versand setzt ihn
		zurück — der neue Ausgang ist der jüngere und gewinnt.
	*/
	let versandFehler = $state('');

	const fehlerOben = $derived(
		versandFehler !== ''
			? versandFehler
			: frage !== null && frageZeile === undefined
				? EINZELAUFGABE_NICHT_ANSPRECHBAR
				: form !== null && form.art === 'fehler' && form.feld === null
					? form.meldung
					: ''
	);

	let meldungKasten = $state<HTMLElement | null>(null);

	/*
		Der Fokus wird **genau einmal** geholt, und dieses Flag ist der Grund, dass
		es dabei bleibt. Es ist bewusst kein $state: gelesen wird es untracked,
		und es soll kein Rendern auslösen.
	*/
	let fokusGeholt = false;

	/**
	 * Beim Ankommen mit `?abgelegt` nimmt die Live-Region einmalig den Fokus.
	 *
	 * Eine Live-Region sagt nur **Änderungen** an. Nach dem Ablegen ist `/` eine
	 * frisch gemountete Route: `Abgelegt.` steht von Anfang an im Markup und
	 * bliebe ohne diesen Griff stumm. Das ist derselbe Grund, aus dem Story 1.3
	 * nach `aufnehmen` den Fokus setzt.
	 *
	 * Und ausdrücklich **nicht** nach dem Abhaken: dort bleibt der Daumen auf dem
	 * Kästchen, und ein Sprung liesse den nächsten Griff die falsche Zeile
	 * treffen. `form !== null` ist genau diese Grenze — nach einem Versand ist
	 * die Eigenschaft gesetzt, beim Ankommen ist sie null.
	 *
	 * `data.abgelegt === null` und nicht `!data.abgelegt`: der Wert ist seit
	 * Story 2.1 eine Zahl, und eine 0 wäre mit der Kurzform ununterscheidbar von
	 * „kein Parameter". Die load gibt zwar nie 0 — ein unlesbarer Wert fällt dort
	 * auf 1 —, aber die Bedingung soll nicht von dieser Zusage abhängen.
	 *
	 * Seit Story 3.2 gilt dasselbe für `?ausgeschrieben`: /einzelaufgabe kommt auf
	 * demselben Weg an und braucht dieselbe Ansage. Die Bedingung fragt darum nach
	 * **einer angekommenen Meldung** und nicht nach einem der zwei Parameter —
	 * ein dritter Absender fände sie dann schon vor.
	 *
	 * `meldungKasten === null` steht **vor** dem Setzen des Flags und nicht als
	 * `?.` danach: ein Durchlauf ohne gebundenes Element verbrauchte sonst das
	 * Einmal-Flag, der Fokus würde nie geholt, und `Abgelegt.` bliebe stumm —
	 * ein stiller Ausfall, den niemand sieht.
	 */
	/** Ist die Seite mit einer Meldung aus einer Weiterleitung angekommen? */
	const meldungAngekommen = $derived(data.abgelegt !== null || data.ausgeschrieben);

	$effect(() => {
		if (fokusGeholt || !meldungAngekommen || form !== null || meldungKasten === null) return;
		fokusGeholt = true;
		meldungKasten.focus();
	});

	/**
	 * Der `art`-Diskriminator eines Ausgangs.
	 *
	 * Aus `result` und nicht aus `form` — im Rückruf ist die Eigenschaft von
	 * aussen noch die alte. Dasselbe Muster wie fokusNach in
	 * ../verwaltung/+page.svelte.
	 */
	function artVon(ergebnis: ActionResult): string {
		const daten =
			ergebnis.type === 'success' || ergebnis.type === 'failure'
				? (ergebnis.data as { art?: unknown } | undefined)
				: undefined;
		return typeof daten?.art === 'string' ? daten.art : '';
	}

	/** Übernimmt den Ausgang in den Sitzungszustand. Gibt zurück, ob er sich änderte. */
	function zustandUebernehmen(ergebnis: ActionResult, id: number): boolean {
		const art = artVon(ergebnis);
		if (art === 'abgehakt' && !erledigt.includes(id)) {
			erledigt.push(id);
			return true;
		}
		if (art === 'wiederGeoeffnet' && erledigt.includes(id)) {
			erledigt = erledigt.filter((abgehakt) => abgehakt !== id);
			return true;
		}
		return false;
	}

	/**
	 * Zieht das Kästchen auf den Zustand zurück.
	 *
	 * Gebraucht genau dann, wenn der Zustand **gleich** geblieben ist: ein
	 * abgewiesener oder ein abgebrochener Versand lässt das Kästchen im DOM
	 * umgeschaltet stehen, während die Aufgabe unverändert ist. Ohne diese Zeile
	 * zeigte die Zeile einen Haken, den der Server nicht kennt — genau die Lüge,
	 * die diese Story vermeiden will. Beim geglückten Versand wechselt statt
	 * dessen der if-Zweig, und das Kästchen entsteht neu im richtigen Zustand.
	 */
	function kaestchenNachZustand(formular: HTMLFormElement, id: number): void {
		const kaestchen = formular.querySelector('input[type="checkbox"]');
		if (kaestchen instanceof HTMLInputElement) {
			kaestchen.checked = erledigt.includes(id);
		}
	}

	/**
	 * Der Rückruf je Zeile. Die Id kommt aus der Closure, damit der Zustand
	 * ohne Umweg über den DOM getroffen wird.
	 *
	 * **Kein Fokuswechsel danach**, anders als in Story 1.3: der Daumen bleibt
	 * auf dem Kästchen, und ein Sprung liesse den nächsten Griff die falsche
	 * Zeile treffen. Die Live-Region sagt den Ausgang an, ohne den Fokus zu
	 * holen.
	 */
	function versandFuer(id: number): SubmitFunction {
		return ({ cancel, formElement }) => {
			if (imFlug) {
				cancel();
				kaestchenNachZustand(formElement, id);
				return;
			}
			imFlug = true;
			versandFehler = '';
			return async ({ update, result }) => {
				/*
					try/finally: bricht update() ab — ein abgerissenes Netz, ein Fehler
					in applyAction —, bliebe imFlug sonst für immer true und **jedes**
					Kästchen dieser Liste dauerhaft disabled. Auf der Seite, auf der die
					Gemeinschaft abhakt, wäre nur ein Neuladen der Ausweg. Dieselbe
					Absicherung wie in aufgabe/+page.svelte, wo sie zuerst entstand.

					Beide Vorgaben an update() ausdrücklich aus: siehe die Begründung an
					`erledigt`.
				*/
				try {
					/*
						Ein Wurf in der action kommt als `result.type === 'error'` zurück,
						und das gereichte update() reicht ihn an applyAction weiter — die
						Fehlergrenze ersetzte dann die Seite. Statt dessen ein Satz in der
						Live-Region, die hier ohnehin steht. Der Wurf selbst bleibt
						unberührt: er hat handleError auf dem Server längst erreicht.
						Einheitlich auf allen vier Seiten, entschieden am 2026-08-28 zu
						Eintrag 32 der zurückgestellten Arbeit.
					*/
					if (result.type === 'error') {
						versandFehler = VERSAND_FEHLGESCHLAGEN;
					} else {
						await update({ reset: false, invalidateAll: false });
					}
				} finally {
					imFlug = false;
				}
				// Nach einem Wurf hat sich nichts geändert: das Kästchen zurück auf den
				// Zustand, den der Server kennt.
				if (versandFehler !== '') {
					kaestchenNachZustand(formElement, id);
					return;
				}
				const gewechselt = zustandUebernehmen(result, id);
				if (!gewechselt) kaestchenNachZustand(formElement, id);
			};
		};
	}

	/**
	 * Der Versand der zwei Zeilenformulare (Ändern, Entfernen).
	 *
	 * **Ein eigener Rückruf und nicht versandFuer**, aus einem Grund, der an
	 * genau einer Stelle sitzt: jener fährt mit `invalidateAll: false`, damit die
	 * abgehakte Zeile an ihrem Platz stehen bleibt. Hier ist das Gegenteil
	 * richtig — ein geänderter Text und eine entfernte Zeile sollen sofort für
	 * alle stimmen, und dafür muss die Liste neu geladen werden. `reset: false`
	 * bleibt: nach einer Abweisung steht das Getippte sonst nicht mehr im Feld.
	 *
	 * Der Wurf wird abgefangen wie überall (Gate-Regel 17): ein `result.type ===
	 * 'error'` gereicht an update() ersetzte die Seite durch die Fehlergrenze.
	 */
	function versandZeile(): SubmitFunction {
		return ({ cancel, formElement }) => {
			if (imFlug) {
				cancel();
				return;
			}
			imFlug = true;
			versandFehler = '';
			return async ({ update, result }) => {
				try {
					if (result.type === 'error') {
						versandFehler = VERSAND_FEHLGESCHLAGEN;
					} else {
						await update({ reset: false });
					}
				} finally {
					imFlug = false;
				}
				/*
					Geglückt: das Formular klappt zu. Es bleibt offen, wenn der Server
					abgewiesen hat — dort steht der Satz am Feld, und ein zugeklapptes
					Formular verstecke ihn. Das `open` im Markup deckt nur den Weg ohne
					JavaScript ab: ein von Hand aufgeklapptes <details> hat seinen Wert
					im DOM und nicht in dem Ausdruck, den Svelte verfolgt.
				*/
				if (versandFehler === '' && form?.art !== 'fehler') {
					formElement.closest('details')?.removeAttribute('open');
				}
			};
		};
	}

	/**
	 * Ein Antippen des Kästchens schickt sein Formular ab. Genau eine
	 * Interaktion: kein Knopf daneben, keine Rückfrage.
	 */
	function abschicken(ereignis: Event & { currentTarget: HTMLInputElement }): void {
		ereignis.currentTarget.form?.requestSubmit();
	}

	// -------------------------------------------------------------------
	// Block 2 — die freien Einzelaufgaben und die eine Bestätigung
	// -------------------------------------------------------------------
	/*
		Ein Dialog für alle Zeilen, nicht einer je Zeile — dieselbe Bauform wie die
		Widerruf-Bestätigung auf /verwaltung, und aus demselben Grund: bei einem
		Dutzend Einzelaufgaben wären das ein Dutzend Dialoge im DOM, von denen
		einer aufgeht. <dialog> bringt Esc, Fokusfang und Hintergrund selbst mit.

		**Der Dialog ist die Aufwertung, nicht die Bedingung.** Die Bestätigung
		selbst kennt der Server: ein POST ohne `bestaetigt` ändert nichts und gibt
		die Frage zurück, und ohne JavaScript rendert die Seite sie als Block an
		der Zeile. Die Begründung steht ausführlich an der action `uebernehmen` in
		der Nachbardatei.
	*/
	let dialog = $state<HTMLDialogElement | null>(null);
	let abbrechenKnopf = $state<HTMLButtonElement | null>(null);
	let zuUebernehmen = $state<{ id: number; titel: string; terminAt: number } | null>(null);

	/** Der Bestätigungssatz. Eine Fassung für Dialog und Dokument. */
	function uebernahmeSatz(aufgabe: { titel: string; terminAt: number }): string {
		return `Du übernimmst: ${aufgabe.titel}, ${datumLang(aufgabe.terminAt)}.`;
	}

	/**
	 * Öffnet den Dialog für eine Zeile.
	 *
	 * Wortgleich zur Bauform von widerrufFragen in ../verwaltung/+page.svelte,
	 * samt ihrer zwei Vorsichtsmassnahmen: tick() wartet, bis der Inhalt des
	 * Dialogs entstanden ist — er hängt an `zuUebernehmen`, und Svelte
	 * aktualisiert den DOM erst nach dieser Zuweisung. Und fehlt der
	 * Abbrechen-Knopf, wird **nicht** geöffnet: showModal() fokussierte sonst das
	 * erste fokussierbare Element, und ein Enter direkt nach dem Öffnen wäre eine
	 * Zusage, die niemand gelesen hat.
	 */
	async function uebernahmeFragen(aufgabe: {
		id: number;
		titel: string;
		terminAt: number;
	}): Promise<void> {
		if (dialog === null) return;
		zuUebernehmen = aufgabe;
		await tick();
		/*
			Fehlt der Abbrechen-Knopf, wird **nicht** geöffnet — und die Person
			bekommt trotzdem einen Satz. Der Versand ist zu diesem Zeitpunkt schon
			abgebrochen: der Knopf entsteht erst mit dem Inhalt des Dialogs, also
			erst nach der Zuweisung an `zuUebernehmen` und dem tick() darüber, und
			bis dahin ist `cancel()` in versandFragen gelaufen. Es gibt von hier
			keinen Weg zurück auf den gewöhnlichen POST.

			Darum die Fehlerregion statt der Stille: sonst wäre genau das der
			schlechteste Ausgang, gegen den der Kommentar in versandFragen steht —
			nichts geschieht, und der Knopf sieht tot aus. Ein Satz, der zum
			Neuladen rät, ist die ehrliche Antwort auf einen Dialog, der nicht
			aufgeht.
		*/
		if (abbrechenKnopf === null) {
			zuUebernehmen = null;
			versandFehler = VERSAND_FEHLGESCHLAGEN;
			return;
		}
		dialog.showModal();
		abbrechenKnopf.focus();
	}

	/**
	 * Der Rückruf am Knopf **in der Zeile**: er schickt nie ab.
	 *
	 * `cancel()` und dann der Dialog — die Frage ist mit den Daten aus `data`
	 * schon beantwortbar, und eine Rundreise zum Server nur, um sie zu stellen,
	 * wäre eine Wartezeit vor einem Dialog, der sofort dastehen kann.
	 *
	 * Das Formular darunter ist trotzdem ein echtes Formular mit literalem
	 * action="?/uebernehmen": **ohne** JavaScript läuft dieser Rückruf nicht, der
	 * POST geht durch, und der Server antwortet mit derselben Frage als Dokument.
	 */
	function versandFragen(aufgabe: { id: number; titel: string; terminAt: number }): SubmitFunction {
		return ({ cancel }) => {
			/*
				**Abgebrochen wird nur, wenn der Dialog wirklich aufgeht.** Ein
				`cancel()` ohne Dialog wäre der schlechteste Ausgang: der Versand
				unterbliebe, nichts erschiene, und der Knopf sähe tot aus. Fehlt das
				Element — nicht gebunden, aus dem DOM gefallen —, läuft statt dessen
				der gewöhnliche POST durch, und der Server antwortet mit derselben
				Frage als Dokument. Die Ausfallrichtung ist der Weg ohne JavaScript,
				und den gibt es hier ohnehin.

				Das ist die andere Antwort als beim Widerruf auf /verwaltung, wo ein
				fehlender Abbrechen-Knopf das Öffnen **verhindert**: dort ist das
				Ausbleiben der zerstörenden Handlung der sichere Ausgang, hier ist es
				das Ausbleiben der Kernhandlung.
			*/
			if (dialog === null) {
				/*
					**Auch dieser Zweig fängt den Wurf ab.** Gäbe er nichts zurück,
					führe use:enhance sein Vorgabeverhalten — und ein
					`result.type === 'error'` erreichte über applyAction die
					Fehlergrenze statt der Live-Region. Die Regel gilt für **jeden**
					Rückruf dieser Anwendung, und ein Ausfallweg ist keine Ausnahme
					davon: er ist der Weg, auf dem am ehesten etwas schiefgeht.

					`update()` mit den Vorgaben, also mit invalidateAll — der Server
					antwortet hier mit der Frage als Dokument, und die Seite muss sie
					rendern.
				*/
				return async ({ update, result }) => {
					if (result.type === 'error') {
						versandFehler = VERSAND_FEHLGESCHLAGEN;
						return;
					}
					await update();
				};
			}
			cancel();
			if (imFlug) return;
			void uebernahmeFragen(aufgabe);
		};
	}

	/**
	 * Der Rückruf am Knopf **im Dialog**: der zweite Schritt, der wirklich
	 * schreibt.
	 *
	 * `update()` mit den Vorgaben, also mit `invalidateAll: true` — anders als bei
	 * den zwei Pool-actions darüber, und das ist Absicht: die übernommene Zeile
	 * muss Block 2 verlassen, und das kann sie nur über eine frische load. Der
	 * Nebeneffekt ist benannt: eine in dieser Sitzung abgehakte Poolaufgabe
	 * verschwindet dabei aus der Liste. Sie ist erledigt, das Verschwinden ist
	 * wahr, und es ist derselbe Ausgang wie bei einem Neuladen — nur früher.
	 */
	const versandBestaetigen: SubmitFunction = ({ cancel }) => {
		if (imFlug) {
			cancel();
			return;
		}
		imFlug = true;
		versandFehler = '';
		return async ({ update, result }) => {
			/*
				Zuerst den Dialog schliessen — dieselbe Reihenfolge und dieselbe
				Begründung wie auf /verwaltung: use:enhance schickt per fetch ab, es
				gibt also keine Navigation, die ihn schlösse, und ein modaler Dialog
				macht den Rest der Seite inert. Vor update() und vor dem Fokus, weil
				close() den Fokus an das Element zurückgibt, das ihn vor showModal()
				hatte, und eine danach gesetzte Position wieder überschriebe. Auch bei
				einem Fehlschlag wird geschlossen — der Satz dazu steht oben auf der
				Seite.
			*/
			dialog?.close();
			// try/finally: bricht update() ab, bliebe imFlug sonst für immer true und
			// jedes Kästchen dieser Liste dauerhaft disabled.
			try {
				if (result.type === 'error') {
					versandFehler = VERSAND_FEHLGESCHLAGEN;
				} else {
					await update();
				}
			} finally {
				imFlug = false;
			}
			/*
				**Hier wird der Fokus gesetzt**, anders als nach dem Abhaken. Dort
				bleibt der Daumen auf dem Kästchen; hier ist der Knopf, der ihn hatte,
				nach dem Übernehmen fort — die Zeile hat Block 2 verlassen. Ohne diesen
				Griff fiele der Fokus an den Seitenanfang, und die Ansage ginge unter.
			*/
			if (artVon(result) === 'uebernommen') {
				meldungKasten?.focus();
			}
		};
	};
</script>

<!--
	**Die drei Zeichen als Schnipsel und nicht dreimal als SVG.**

	Das Personenzeichen steht an zwei Orten — im Griff von `Wer übernimmt` und im
	Zusage-Knopf jeder Zeile darunter —, und zwei gleiche SVG-Blöcke in derselben
	Datei sind dasselbe, worauf Gate-Regel 14 im Stilblatt anschlägt: eine Rolle
	an zwei Stellen. Die Regel liest kein Markup, aber der Grund gilt hier wie
	dort.

	Alle drei im Zeichensatz, der schon im Baum war: 24er-Raster, Strich in
	`currentColor`, keine Füllung, `aria-hidden`. Sie tragen keine Aussage — die
	steht als Wort daneben, und DESIGN.md verlangt das ausdrücklich.

	Die Auswahl ist Manuels (2026-09-15): Korb für die Ernte, Person für die
	Zusage, Häkchenliste für den Pool. Gewählt aus drei Sätzen, die als Blatt 4
	des Gestaltungsrahmens nebeneinander standen.

	**Die Spritzkanne kam am 2026-09-17 dazu** (Entscheid Manuel): bis dahin trug
	die Zeile zum Tränkeplan als einzige kein Zeichen und stand damit in einer
	Reihe, in der alle anderen eines haben. Sie ist im selben Raster gezeichnet
	und trägt dieselbe Zusage — keine Aussage, die nicht daneben als Wort steht.

	**Die Kanne und nicht ein Tropfen**: ein Tropfen heisst Wasser, die Kanne
	heisst jemand giesst. Die Zeile zählt unbesetzte Wochen — fehlende Personen,
	nicht fehlendes Wasser. Zwischenstand vom selben Tag, eine Stunde alt; der
	Tropfen stand nie ausgeliefert da.

	**Die Kanne zeigt nach links und hat den Bügel rechts** (zweite Fassung,
	2026-09-17, auf Manuels Befund). Die erste hatte das Rohr rechts oben und den
	Griff obenauf; bei 22px lagen Rohr und Bügel dort so nah beieinander, dass
	die Form eher nach Kanne mit Deckel aussah. Jetzt steht das Rohr frei auf der
	einen Seite und der Bügel frei auf der anderen — dieselbe Silhouette, die man
	von einer Giesskanne im Regal kennt.

	**Das Fähnchen am Griff der eigenen Zusagen** (Entscheid Manuel, 2026-09-17,
	zweite Fassung). Es sagt `ich habe mich gemeldet` und steht damit neben dem
	Knopf `Ich mach's`, mit dem man sich meldet.

	Der Griff trug dafür einen halben Tag lang das **Häkchen** vom
	`Erledigt`-Knopf in seinen eigenen Zeilen. Das war konsequent und sagte
	trotzdem das Falsche: der Abschnitt zeigt, was noch **offen** ist, und ein
	Häkchen heisst erledigt. Es steht jetzt wieder allein am Knopf, wo es
	hingehört.

	Ein zweites Personenzeichen neben dem von `Wer übernimmt` wäre die dritte
	Möglichkeit gewesen und die schlechteste — zwei gleiche Zeichen auf einer
	Seite unterscheiden nichts.
-->
{#snippet zeichenKanne()}
	<svg
		class="zeichen zeichen--gross"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<path d="M9 10.5h9v6.5a3 3 0 0 1-3 3h-3a3 3 0 0 1-3-3v-6.5Z" />
		<path d="M9 13.5 4 10" />
		<path d="M2.5 11.5 5.5 7.5" />
		<path d="M18 12.5a2.5 2.5 0 0 1 0 5" />
	</svg>
{/snippet}

{#snippet zeichenKorb()}
	<svg
		class="zeichen zeichen--gross"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<path d="M3.5 9.5h17l-1.8 10H5.3l-1.8-10Z" />
		<path d="M8 9.5 10.5 3.5" />
		<path d="M16 9.5 13.5 3.5" />
	</svg>
{/snippet}

{#snippet zeichenPerson(zusatz: string)}
	<svg
		class="zeichen {zusatz}"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		aria-hidden="true"
	>
		<circle cx="12" cy="8" r="4" />
		<path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
	</svg>
{/snippet}

{#snippet zeichenHaken()}
	<svg
		class="zeichen"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<path d="M4.5 12.5 9.5 17.5 19.5 6.5" />
	</svg>
{/snippet}

{#snippet zeichenFahne()}
	<svg
		class="zeichen zeichen--gross"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<path d="M6 21V3.5" />
		<path d="M6 4.5h11.5l-2.5 4 2.5 4H6" />
	</svg>
{/snippet}

{#snippet zeichenListe()}
	<svg
		class="zeichen zeichen--gross"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<path d="M3.5 7 5 8.5 7.5 6" />
		<path d="M3.5 15 5 16.5 7.5 14" />
		<path d="M11 7.5h9.5" />
		<path d="M11 15.5h9.5" />
	</svg>
{/snippet}

<svelte:head>
	<title>Übersicht</title>
</svelte:head>

<div class="seite">
	<!--
		**Der Seitentitel steht da und ist nicht zu sehen** (2026-09-13, auf
		Manuels Ansage: im Dashboard soll er zuoberst weg).

		Sichtbar hat er hier nichts mehr zu sagen: die Titelleiste nennt den Ort,
		die Navigationsleiste markiert das aktive Ziel, und die drei Abschnitte
		tragen ihre eigenen Überschriften. Ein Wort, das alle drei wiederholt,
		kostet nur Höhe.

		**Ersatzlos streichen wäre trotzdem falsch gewesen.** Diese Seite hätte dann
		kein h1 mehr, ihre Gliederung begänne bei h2, und wer sie über die
		Überschriftenliste eines Screenreaders ansteuert, landete in einem Abschnitt
		statt auf der Seite. `.nur-vorgelesen` löst genau das: fort aus dem Bild, da
		für die Ansage.
	-->
	<h1 class="nur-vorgelesen">Übersicht</h1>

	<!--
		Die zwei Live-Regionen stehen **immer** im Markup, auch leer: ein Element,
		das erst mit seinem Text in den DOM kommt, liest ein Screenreader in der
		Regel nicht vor. Leer nehmen beide keinen Platz ein — die :empty-Regel
		unten nimmt sie aus dem Fluss, statt sie mit display: none aus dem Baum zu
		werfen.

		Der Fokus wird hier in **einem** Fall geholt und in allen anderen nicht:

		  - beim Ankommen von /aufgabe mit `?abgelegt`, weil die Seite dann frisch
		    gemountet ist und eine Live-Region nur Änderungen ansagt — darum trägt
		    die Meldungsregion ein tabindex="-1" (siehe den Effekt oben);
		  - **nicht** nach dem Abhaken und nicht nach dem Wieder-Öffnen: dort
		    bleibt der Daumen auf dem Kästchen, und ein Sprung liesse den nächsten
		    Griff die falsche Zeile treffen.

		Die Fehlerregion holt den Fokus nie: sie meldet einen Ausgang eines
		Versands, und der Daumen soll auch dann bleiben, wo er ist.
	-->
	<p class="meldung live" role="status" aria-live="polite" tabindex="-1" bind:this={meldungKasten}>
		{rueckmeldung}
	</p>
	<p class="fehler live" role="alert" aria-live="assertive">{fehlerOben}</p>

	<!--
		Die Startseite führt genau drei Blöcke in dieser Reihenfolge (AD-14), und
		seit dem 2026-09-11 ein Überblicksband davor:

		  Block 0 — das Band. **Keine eigene Aufgabenart**, sondern drei Zahlen über
		            das, was die Blöcke darunter und /traenkeplan ohnehin zeigen. AD-14
		            lässt es ausdrücklich zu, solange es nie exklusiv informiert —
		            jede Kachel verweist auf die Stelle, die vertieft.
		  Block 1 — Diensthinweis: „Diese Woche bist du am Tränken", nur vorhanden,
		            wenn die betrachtende Person Dienst hat. Seit Story 3.1 gebaut,
		            steht direkt unter diesem Kommentar.
		  Block 2 — freie Einzelaufgaben zum Übernehmen, `Wer übernimmt`. Seit
		            Story 3.2 gebaut.
		  Block 3 — der offene Pool, `Zum Erledigen`. Diesen füllte Story 1.4.

		Die Reihenfolge stand schon, als zwei Drittel leer waren: sie ist eine
		Entscheidung über die Aufmerksamkeit im Garten und keine Folge davon, in
		welcher Reihenfolge die Stories gebaut wurden.

		**Seit dem 2026-09-15 stehen die zwei letzten getauscht: Block 3 vor
		Block 2.** Das weicht von der Reihenfolge in AD-14 ab, und zwar bewusst
		(Entscheid Manuel). Der Grund liegt in dem, was die beiden verlangen: der
		Pool ist der Vorrat an Arbeit, die jederzeit jemand mitnehmen kann, und
		wer auf die Seite kommt, um etwas zu tun, findet ihn jetzt zuerst.
		`Wer übernimmt` fragt dagegen nach einer Zusage auf einen Termin — die
		schwerere Frage, und sie steht danach.

		**Die Nummern sind Namen und keine Plätze.** Sie zeigen auf AD-14 und
		bleiben darum, wie sie sind; würden sie mitwandern, zeigte jeder ältere
		Kommentar und jede Wache, die von „Block 2" spricht, plötzlich woanders
		hin.
	-->

	<!--
		Block 1. **Ohne eigenen Dienst fehlt er ganz** — es gibt kein {:else} und
		keinen leeren Rahmen. Ein Block, der „Diese Woche hast du keinen Dienst"
		sagte, nähme jede Woche Platz weg, um nichts mitzuteilen.

		Der ganze Block ist **ein** Link auf den Tränkeplan und trägt darum keinen
		Knopf: ein Dienst ist keine Aufgabe, er ist nicht abhakbar und nicht
		wegklickbar. Vertiefen darf die Unterseite, exklusiv informieren nicht —
		der Satz hier sagt schon alles, was diese Woche zählt.

		**Seit dem 2026-09-13 eine gefüllte Akzentfläche** und keine Karte mit
		Kante mehr. Der Grund ist ein Befund von Manuel: als weisse Karte mit
		3px-Kante stand der Block in einer Reihe mit dem Tränkeplan darunter und
		mit jeder anderen Karte der Seite — wer ihn überblättert, verpasst seinen
		Dienst. Die Fläche trägt die Aussage jetzt selbst.

		**Der Akzent bedeutet dabei unverändert *hier kann gehandelt werden*** und
		nicht *Achtung*: der Block ist ein Link auf den Tränkeplan. Er ist die
		einzige gefüllte Fläche oberhalb der Knöpfe, und das bleibt so — eine
		zweite nähme ihm genau das, was ihn hier trägt.

		Die Marke darüber ist kein Schmuck: DESIGN.md verbietet Farbe als einzigen
		Träger eines Zustands, und ohne sie unterschiede sich dieser Block in
		Graustufen allein durch seine Füllung von einem Knopf.
	-->
	{#if data.dienst !== null}
		<!-- resolve() ist Pflicht für interne Ziele (svelte/no-navigation-without-resolve) -->
		<a class="dienst" href={resolve('/traenkeplan')}>
			<span class="dienst__marke">Du bist dran</span>
			<span class="dienst__satz">Diese Woche bist du am Tränken</span>
			<span class="hinweis hinweis--ziffern">{data.dienst.datum}</span>
		</a>
	{/if}

	<!--
		**Was ich selbst zugesagt habe, und zwar für diese Woche.**

		Bis zum 2026-09-14 verliess eine übernommene Einzelaufgabe diese Seite
		ganz: sie trägt einen Namen, damit ist sie geregelt, und `/` beantwortet
		die Frage `was ist noch offen`. Das stimmt — nur beantwortet dieselbe
		Seite seit dem Diensthinweis noch eine zweite Frage, nämlich `was habe ich
		diese Woche zu tun`. Für den Tränkedienst gab es eine Zeile, für die
		eigene Zusage nichts; wer am Montag übernahm, sah es ab Dienstag nirgends.

		**Keine gefüllte Fläche.** Die gehört dem Diensthinweis darüber und ihm
		allein — eine zweite nähme ihm genau das, was ihn dort trägt. Was die zwei
		verbindet, ist die Kante links in Akzentfarbe: dasselbe Zeichen wie an der
		laufenden Woche im Tränkeplan, `hier bist du gerade`. Sie hat den Umbau zum
		Aufklapper am 2026-09-17 überlebt und ist dort das einzige, was diesen
		Abschnitt von den zwei anderen unterscheidet.

		Bei null Zusagen fehlt der Block ganz, wie der Diensthinweis darüber. Ein
		`Du hast nichts zugesagt` nähme jede Woche Platz, um nichts mitzuteilen.
	-->
	{#if data.zusagen.length > 0}
		<!--
			**Die Kachel ist seit dem 2026-09-15 kein Verweis mehr.** Sie war als
			Ganzes ein Link auf /einzelaufgaben; mit dem Erledigt-Knopf an jedem Punkt
			geht das nicht mehr — ein Knopf in einem Link ist ungültiges Markup, und
			ein Browser macht daraus, was er will. Der Weg zu allen Terminen steht
			eine Kachel weiter unten als `Alle Termine` und fehlt damit nicht.

			**Seit dem 2026-09-17 ein Aufklapper wie die zwei Abschnitte darunter**
			(Entscheid Manuel). Damit ist die Seite in einer Form: Zeichen, Zahl,
			Titel — und wer den Abschnitt wegklappt, sieht im Griff weiterhin, wie
			viel er zugesagt hat. Genau das verlangt AD-14, und genau darum trägt der
			Griff eine Zahl: ein zugeklappter Abschnitt darf seinen Inhalt verbergen,
			nicht seine Lage.

			**`.meine` ist von der Kachel übriggeblieben und trägt nur noch die Kante
			links.** Fläche, Radius und Umriss kommen aus `.abschnitt`; das
			3px-Akzentstück ist dasselbe Zeichen wie an der laufenden Woche im
			Tränkeplan — hier bist du gerade — und es ist der einzige Unterschied zu
			den zwei anderen Abschnitten. Er ist gewollt: die zwei zeigen, was
			irgendwer tun könnte, dieser zeigt, was **ich** zugesagt habe.

			**Zugeklappt ausgeliefert**, wie die zwei darunter, und der Zustand wird
			nirgends gespeichert. Die Zahl im Griff sagt auch zugeklappt, wie viel ich
			zugesagt habe — die Begründung in ganzer Länge steht am Abschnitt `Zum
			Erledigen`.
		-->
		<details class="abschnitt meine">
			<summary class="abschnitt__griff">
				<h2 class="griff__satz" id="meine-marke">
					{@render zeichenFahne()}
					<span class="kopfzahl">{data.zusagen.length}</span>
					<span class="griff__titel">{MEINE_MARKE}</span>
				</h2>
				<ZeichenWinkel class="aufklapp" />
			</summary>
			<div class="abschnitt__inhalt">
				<ul class="meine__punkte" aria-labelledby="meine-marke">
					{#each data.zusagen as zusage (zusage.id)}
						<li>
							<div class="meine__zeile">
								<span class="zeile__spalte">
									<span class="zeile__text" id="zusage-{zusage.id}">{zusage.titel}</span>
									<span
										class="hinweis hinweis--ziffern"
										class:einzel__verstrichen={zusage.lage === 'verstrichen'}
									>
										{datumKurz(zusage.terminAt)}{fristZusatz(zusage.lage)}
									</span>
								</span>
								<!--
								**Genau eine Interaktion, keine Rückfrage** — wie das Abhaken im
								Pool. Das Übernehmen darunter wird bestätigt, weil eine Zusage
								andere bindet; ein Abschluss meldet nur, dass die eigene Zusage
								eingelöst ist.

								`aria-labelledby` nennt erst den Knopf, dann den Titel: in einer
								Elementliste stünde sonst dreimal dasselbe Wort ohne Auskunft,
								worum es geht. Derselbe Handgriff wie am Zusage-Knopf.
							-->
								<form method="POST" action="?/abschliessen" use:enhance={versandZeile()}>
									<input type="hidden" name="einzelaufgabeId" value={zusage.id} />
									<button
										class="button-quiet button-quiet--kompakt"
										type="submit"
										id="erledigt-{zusage.id}"
										aria-labelledby="erledigt-{zusage.id} zusage-{zusage.id}"
										disabled={imFlug}
									>
										{@render zeichenHaken()}
										{ERLEDIGT_KNOPF}
									</button>
								</form>
							</div>
						</li>
					{/each}
				</ul>
			</div>
		</details>
	{/if}

	<!--
		**Zwei Zeilen mit Pfeil, und sie sind seit dem 2026-09-17 dieselbe Bauform**
		(Entscheid Manuel): die unbesetzten Tränkewochen und der Erntestand. Beide
		sagen dasselbe — hier sind so viele, und dahinter liegt eine eigene Seite.

		**Sie sind kein Aufklapper, obwohl sie wie die Griffe eine Zahl tragen:**
		es gibt hier nichts aufzuklappen. Der Pfeil sagt das, das Dreieck der
		Griffe fehlt.

		**Der Titel steht vor der Zahl, und die Zahl in derselben Schriftrolle wie
		er.** Bis zum 2026-09-17 stand an der Tränkezeile die Zahl voran und das
		Wort klein daneben — eine dritte Form neben den Griffen darunter, die ihren
		Titel vorn und ihren Zähler klein dahinter tragen. Jetzt lesen sich beide
		Zeilen wie eine Überschrift mit Umfang, und zwar dieselbe.

		Bei null fehlt die jeweilige Zeile **ganz** — eine Zeile `0 Tränkewochen
		unbesetzt` verlangte Aufmerksamkeit für eine Nicht-Lage. Dieselbe Haltung
		wie beim Diensthinweis darüber.
	-->
	{#if data.ueberblick.unbesetzt > 0}
		<!-- resolve() ist Pflicht für interne Ziele (svelte/no-navigation-without-resolve) -->
		<a class="plan-zeile" href={resolve('/traenkeplan')}>
			{@render zeichenKanne()}
			<span class="kopfzahl">{data.ueberblick.unbesetzt}</span>
			<span class="griff__titel">
				{zeileUnbesetzt(data.ueberblick.unbesetzt)}
				<!--
					**Die Warnung trägt das Wort und die Farbe, nicht die Farbe allein.**
					DESIGN.md verbietet Farbe als einzigen Träger eines Zustands; der Satz
					sagt es auch in Graustufen.
				-->
				{#if data.ueberblick.unbesetztBald > 0}
					<span class="plan-zeile__bald">{zeileBald(data.ueberblick.unbesetztBald)}</span>
				{/if}
			</span>
			<span class="plan-zeile__pfeil" aria-hidden="true">→</span>
		</a>
	{/if}

	<!--
		Die Ernte. Sie steht zwischen Tränkeplan und Einzelaufgaben, weil sie
		dazwischen gehört: der Tränkeplan sagt, wer dran ist, die Ernte, was heute
		im Garten zu holen wäre, und die Einzelaufgaben, was jemand übernehmen
		kann.

		**Seit dem 2026-09-17 eine Zeile mit Pfeil und kein Aufklapper mehr**
		(Entscheid Manuel). Bis dahin standen hier der ganze Erntestand als Liste
		und darunter ein Knopf `+ Ernten` — die Seite trug damit zweimal dieselben
		Zeilen, einmal hier und einmal auf /ernte, und der Abschnitt war der
		längste der Startseite.

		Der Verlust ist benannt und angenommen: **die Dringlichkeit steht auf `/`
		nicht mehr**. Wer die Übersicht öffnet, liest, dass es etwas zu ernten
		gibt und wie viel — welche Kultur, in welchem Beet und wie dringend, steht
		einen Griff weiter. Genau dafür ist /ernte da, und dort ist es auch der
		einzige Stand. Zwei Orte für dieselbe Liste waren die teurere Hälfte.

		Was damit ebenfalls fort ist: die drei Stufenfarben auf dieser Seite, das
		Zeichen der Dauerernte und der Knopf `+ Ernten`. Eintragen beginnt jetzt
		über die Leiste — `Ernte` steht dort, und die Seite öffnet mit der
		Aufforderung `+ Reifes eintragen`.
	-->
	{#if data.ueberblick.reif > 0}
		<!-- resolve() ist Pflicht für interne Ziele (svelte/no-navigation-without-resolve) -->
		<a class="plan-zeile" href={resolve('/ernte')}>
			{@render zeichenKorb()}
			<!--
				`Zum Ernten` und nicht `Ernten`: das Wort stand als Griff über einer
				Liste und benannte den Abschnitt. Als Zeile mit Pfeil sagt es, wohin
				sie führt und was dort wartet — dieselbe Wendung wie `Tränkewochen
				unbesetzt` darüber.
			-->
			<span class="kopfzahl">{data.ueberblick.reif}</span>
			<span class="griff__titel">Zum Ernten</span>
			<span class="plan-zeile__pfeil" aria-hidden="true">→</span>
		</a>
	{/if}

	<!--
		Derselbe Aufklapper wie über den Einzelaufgaben darunter — ein Abschnitt,
		zwei Abschnitte, eine Bauform.

		**Zugeklappt geliefert, seit dem 2026-09-17 — und das kehrt eine
		Entscheidung um, die hier lange stand** (Entscheid Manuel).

		Bis dahin trugen die Abschnitte `open`, und die Begründung war AD-14: man
		soll beim Öffnen der Seite sehen, was zu tun ist. Ein zugeklappter
		Abschnitt bräche das.

		**Die Voraussetzung dieser Begründung ist heute weggefallen.** Sie stimmte,
		solange der Griff nur einen Titel trug: dann verbarg ein zugeklappter
		Abschnitt tatsächlich, dass etwas ansteht. Seit die fünf Zeilen Zeichen,
		**Zahl** und Titel tragen, steht die Lage im Griff — `3 Zum Erledigen`
		sagt zugeklappt dasselbe wie aufgeklappt. Was das Zuklappen verbirgt, ist
		der Inhalt, nicht die Lage, und genau diese Unterscheidung verlangt AD-14.

		Der Gewinn ist der Überblick: die ganze Seite passt jetzt ohne Blättern
		aufs Telefon — fünf Zeilen mit fünf Zahlen, und man klappt auf, was einen
		gerade angeht.

		Der Zustand wird **nicht** gespeichert: beim nächsten Laden steht wieder
		alles zugeklappt. Kein Griff wirkt über den Besuch hinaus, in keine der
		beiden Richtungen.

		Der Knopf `+ Aufgabe` steht **ausserhalb**: er legt etwas an, statt etwas
		anzuzeigen, und muss auch dann erreichbar sein, wenn jemand die Liste
		weggeklappt hat.
	-->
	<details class="abschnitt">
		<summary class="abschnitt__griff">
			<h2 class="griff__satz" id="offen-marke">
				{@render zeichenListe()}
				{#if data.ueberblick.offen === 0}
					<span class="kopfwort">{GRIFF_OFFEN_LEER}</span>
				{:else}
					<span class="kopfzahl">{data.ueberblick.offen}</span>
					<span class="griff__titel">{GRIFF_OFFEN}</span>
					{#if data.ueberblick.ueberfaellig > 0}
						<span class="kopffrist">{griffUeberfaellig(data.ueberblick.ueberfaellig)}</span>
					{/if}
				{/if}
			</h2>
			<ZeichenWinkel class="aufklapp" />
		</summary>
		<div class="abschnitt__inhalt">
			{#if data.aufgaben.length > 0}
				<ul class="liste" aria-labelledby="offen-marke">
					{#each data.aufgaben as aufgabe (aufgabe.id)}
						{@const istErledigt = erledigt.includes(aufgabe.id)}
						<!--
					Überfällig heisst zweierlei auf einmal (AD-8), und beide Konjunkte
					stehen hier: `completed_at IS NULL` erfüllt schon die Abfrage — was in
					`data.aufgaben` steht, ist offen —, und `wochenOffen !== null` ist die
					fertige Zahl aus den Seitendaten.

					Die Rechnung dahinter ist zweigeteilt, und diese Komponente kennt
					keinen ihrer Teile: welche Spalte den Zählbeginn liefert, entscheidet
					offeneAufgabenAuflisten in src/lib/server/db/queries/tasks.ts über
					`dueAt ?? createdAt`; die Schwelle und die Wochenrechnung stehen in
					src/lib/zeit.ts. Hier wird nur noch entschieden, ob die Zahl **jetzt**
					gezeigt wird.

					`!istErledigt` zieht den ersten Konjunkt in **diese Sitzung** hinein.
					In der Datenbank fällt er mit dem Abhaken weg; in der Oberfläche nicht,
					weil der Rückruf mit invalidateAll: false fährt und die Zeile samt
					unverändertem `data` an ihrem Platz stehen bleibt. Bliebe die zweite
					Zeile stehen, behauptete `seit 4 Wochen überfällig` eine offene Frist
					über eine Aufgabe, die gerade erledigt wurde — eine Falschaussage. Beim
					Wieder-Öffnen kommt sie von selbst zurück, mit unveränderter Zahl:
					`data` wurde nie neu geladen.

					**Der Preis dieser Bedingung ist ein Höhensprung**, und er ist hier
					benannt, weil er der Zusage aus Story 1.4 etwas wegnimmt.
					Verschwindet die zweite Zeile, schrumpft die Zeile um deren Höhe plus
					gap, und **alle Zeilen darunter rutschen nach oben** — genau im Moment
					des Antippens. „Die Zeile bleibt an ihrem Platz stehen, so ist ein
					Fehlgriff sofort sichtbar" gilt damit nur noch für die angetippte
					Zeile selbst; wer unmittelbar danach die nächste treffen will, greift
					auf eine Liste, die sich unter dem Daumen verschoben hat. Die
					Alternative — den Platz der zweiten Zeile freihalten — kostete jede
					frische Zeile die Höhe einer Zeile, die sie nie zeigt, und wurde
					darum nicht gebaut.

					**Was die Zahl zählt, ist nicht die Liegedauer — und der Wortlaut sagt
					das.** Bei einer Planaufgabe zählt `seit N Wochen überfällig` die Wochen
					**seit der Fälligkeit** und nicht die, die die Aufgabe schon liegt: eine
					vor 60 Tagen angelegte Aufgabe mit Fälligkeit vor 25 Tagen zeigt
					`seit 3 Wochen überfällig` und nicht `seit 8 Wochen überfällig`.

					Bis zum 2026-08-29 hiess der Satz `seit N Wochen offen`, und genau
					dieser Absatz stand hier als Warnung vor seiner Doppeldeutigkeit: bei
					der Planaufgabe war „offen" schlicht falsch, sie liegt seit 8,5 Wochen
					offen und nicht seit 3. `überfällig` ist in **beiden** Fällen wahr —
					bei der Planaufgabe seit der Fälligkeit, bei der vor Ort erfassten seit
					der Anlage, die laut AD-8 die Ersatzfrist **ist**. Der Satz steht
					wörtlich so in den Akzeptanzkriterien des Epics und in DESIGN.md.
				-->
						{@const istUeberfaellig = !istErledigt && aufgabe.wochenOffen !== null}
						<li class="zeile" class:zeile--erledigt={istErledigt}>
							<!--
						Zwei getrennte Formulare mit **literalem** action, bedingt
						gerendert — nicht ein Formular mit wechselndem Ziel. Gate-Regel 11
						liest action="?/name" textuell und vergleicht mit den actions der
						Nachbardatei; ein dynamisches action={…} würde sie blind machen.

						Das Kästchen ist ein echtes <input type="checkbox">, kein <div> mit
						Klick-Handler, und trägt **kein** <label for>: ein Label schaltet
						sein Bedienelement, und damit wäre der Aufgabentext antippbar — im
						Beet der Weg zur versehentlich erledigten Aufgabe. Die Beschriftung
						entsteht über aria-labelledby auf dem Kästchen, das auf den
						sichtbaren Text **und** ein verborgenes Verb zeigt: der Screenreader
						liest „<Aufgabentext>, erledigen" mit der Rolle Kontrollkästchen,
						und der Text bleibt ein toter <span>.
					-->
							{#if istErledigt}
								<form
									class="zeile__form"
									method="POST"
									action="?/wiederOeffnen"
									use:enhance={versandFuer(aufgabe.id)}
								>
									<input type="hidden" name="aufgabeId" value={aufgabe.id} />
									<span class="treffer">
										<input
											class="kaestchen"
											type="checkbox"
											checked
											disabled={imFlug}
											aria-labelledby="aufgabe-{aufgabe.id} verb-{aufgabe.id}"
											onchange={abschicken}
										/>
										<span class="haken" aria-hidden="true"></span>
									</span>
									<span class="nur-vorgelesen" id="verb-{aufgabe.id}">, wieder öffnen</span>
								</form>
							{:else}
								<form
									class="zeile__form"
									method="POST"
									action="?/abhaken"
									use:enhance={versandFuer(aufgabe.id)}
								>
									<input type="hidden" name="aufgabeId" value={aufgabe.id} />
									<span class="treffer">
										<input
											class="kaestchen"
											type="checkbox"
											disabled={imFlug}
											aria-labelledby="aufgabe-{aufgabe.id} verb-{aufgabe.id}"
											aria-describedby={istUeberfaellig ? `frist-${aufgabe.id}` : undefined}
											onchange={abschicken}
										/>
										<span class="haken" aria-hidden="true"></span>
									</span>
									<span class="nur-vorgelesen" id="verb-{aufgabe.id}">, erledigen</span>
								</form>
							{/if}
							<!--
						Der Spaltencontainer ist keine Zierde, sondern die einzige Stelle,
						an der die zweite Zeile **unter** dem Text landen kann: .zeile ist
						ein Flexcontainer in Zeilenrichtung, und ein Geschwister von
						.zeile__aufgabe stünde daneben.

						Die zweite Zeile liegt ausdrücklich **neben** #aufgabe-{id} und
						nicht darin: das Kästchen holt seinen Namen über aria-labelledby
						aus diesem Element, und ein verschachteltes <p> machte aus
						`Beet 25 jäten, erledigen` ein
						`Beet 25 jäten seit 4 Wochen überfällig, erledigen`. Die Überfälligkeit
						ist eine **Beschreibung** des Kästchens (aria-describedby) und kein
						Teil seines Namens — ein Screenreader liest sie nach einer Pause und
						lässt sie in einer Elementliste weg.

						Das aria-describedby sitzt am **abhaken**-Kästchen und nur dort. Das
						ist keine Auslassung: istUeberfaellig enthält `!istErledigt`, und
						das wiederOeffnen-Formular wird nur bei `istErledigt` gerendert —
						die zwei Bedingungen schliessen sich aus, das Attribut wäre dort
						konstant undefined und das <p> mit der Zielkennung existierte gar
						nicht. Ein aria-describedby am wiederOeffnen-Kästchen zeigte damit
						auf eine leere Kennung, und die Beschreibung fiele **ganz** aus.
					-->
							<div class="zeile__spalte">
								<span class="zeile__aufgabe zeile__text" id="aufgabe-{aufgabe.id}"
									>{aufgabe.text}</span
								>
								{#if istUeberfaellig}
									<p class="zeile__frist" id="frist-{aufgabe.id}">
										seit {aufgabe.wochenOffen} Wochen überfällig
									</p>
								{/if}
							</div>
							<!--
						Ändern und Entfernen, und **nur an einer offenen Zeile**. Eine
						abgehakte ist Historie (FR14); die Vorbedingung steht ohnehin in der
						where-Klausel beider Abfragen, aber ein Griff, der immer abwiese,
						wäre ein Versprechen ohne Deckung.

						`open={fehlerHier}` deckt den Weg **ohne JavaScript** ab: die Antwort
						auf einen abgewiesenen POST ist ein frisches Dokument, und ohne
						dieses Attribut stünde der Satz in einem zugeklappten Aufklapper.
						Dieselbe Bauform wie das Umbenennen auf /verwaltung.

						**Zwei Formulare und nicht eines mit zwei Knöpfen.** Gate-Regel 11
						liest `action="?/name"` textuell; ein `formaction` am zweiten Knopf
						wäre für sie unsichtbar, und ein dynamisches action={…} ebenso.
					-->
							{#if !istErledigt}
								{@const fehlerHier =
									form !== null &&
									form.art === 'fehler' &&
									form.feld === 'text' &&
									form.zeile === aufgabe.id}
								<details class="aendern" open={fehlerHier}>
									<!--
										**Ein Zeichen statt des Wortes**, auf Manuels Entscheid vom
										2026-09-15 — die Begründung in ganzer Länge steht seit dem
										2026-09-17 an der Komponente $lib/components/ZeichenStift.svelte,
										wohin der Stift gezogen ist, als /sitzungen ihn ebenfalls brauchte.

										Das Wort steht **hier** und nicht dort: die Komponente malt, und
										an dieser Stelle heisst die Handlung `Ändern`. `aufklapp` markiert
										das Zeichen, das an diesem Griff die Stelle des Dreiecks einnimmt —
										Gate-Regel 15 liest die Klasse im Markup, und ohne sie darf keine
										Regel dem Griff sein Dreieck nehmen.
									-->
									<summary class="aendern__griff">
										<ZeichenStift class="aufklapp" />
										<span class="nur-vorgelesen">Ändern</span>
									</summary>
									<div class="aendern__formulare">
										<form method="POST" action="?/aendern" use:enhance={versandZeile()}>
											<input type="hidden" name="aufgabeId" value={aufgabe.id} />
											<!--
											Der bekannte Text geht mit und steht in der where-Klausel:
											zwei Leute mit derselben Liste im Browser, beide tippen — ohne
											ihn gewönne lautlos der zweite Versand.
										-->
											<input type="hidden" name="bekannterText" value={aufgabe.text} />
											<label class="feld__beschriftung" for="text-{aufgabe.id}">
												Text der Aufgabe
											</label>
											<input
												class="feld"
												id="text-{aufgabe.id}"
												name="text"
												type="text"
												maxlength={AUFGABE_HOECHSTLAENGE}
												value={fehlerHier ? form.eingabe : aufgabe.text}
												aria-invalid={fehlerHier ? 'true' : undefined}
												aria-describedby={fehlerHier ? `text-fehler-${aufgabe.id}` : undefined}
											/>
											{#if fehlerHier}
												<p class="fehler hinweis--am-feld" id="text-fehler-{aufgabe.id}">
													{form.meldung}
												</p>
											{/if}
											<div class="knoepfe">
												<button class="button-primary" type="submit" disabled={imFlug}>
													Speichern
												</button>
											</div>
										</form>
										<!--
										Endgültig, und ohne Rückfrage: der überlegte Schritt ist das
										Aufklappen. Der Knopf trägt dafür die zerstörende Form, die
										DESIGN.md genau dafür vorsieht — Rot in Text und Umriss, nie
										als Fläche.
									-->
										<form method="POST" action="?/entfernen" use:enhance={versandZeile()}>
											<input type="hidden" name="aufgabeId" value={aufgabe.id} />
											<input type="hidden" name="bekannterText" value={aufgabe.text} />
											<button
												class="button-quiet button-quiet--zerstoerend"
												type="submit"
												disabled={imFlug}
											>
												Entfernen
											</button>
										</form>
									</div>
								</details>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
			<!--
			Der Erfassen-Knopf steht **hinter** dem {#if} um die Liste und damit in
			beiden Zuständen — auch wenn der Griff darüber `Nichts offen.` sagt. Das war
			ein eigener Befund und bleibt es.

			Ein <a> und kein <button>: er navigiert nur, er tut nichts. .button-primary
			trägt text-decoration: none und appearance: none und wirkt darum auch auf
			einem Anker. resolve() ist für interne Ziele Pflicht
			(svelte/no-navigation-without-resolve).

			**Seit dem 2026-09-11 steht er im Aufklapper und nicht dahinter.** Der Preis
			ist benannt und nicht verschwiegen: wer den Pool zuklappt, kommt von dieser
			Seite nicht mehr zum Erfassen — dieser Knopf ist der einzige Weg nach
			`/aufgabe` im ganzen Baum. Getragen wird das davon, dass der Zustand nirgends
			gespeichert ist: jedes Laden stellt den offenen Abschnitt wieder her.
		-->
			<a class="button-primary" href={resolve('/aufgabe')}>+ Aufgabe</a>
		</div>
	</details>

	<!--
		Block 2. **Ohne eine freie Einzelaufgabe fehlt er ganz** — wie Block 1 und
		aus demselben Grund: eine Marke über einer leeren Liste nähme Platz weg, um
		nichts mitzuteilen. Anders als Block 3, der `Nichts offen.` sagt: der Pool
		ist der Gegenstand dieser Seite und darf nicht verschwinden.

		Eine **übernommene** Einzelaufgabe steht hier nicht mehr. Sie trägt einen
		Namen und ist damit geregelt; wer wissen will, wer was übernommen hat,
		findet es auf /einzelaufgaben. Der Fusslink führt dorthin — die Unterseite
		vertieft, sie informiert nicht exklusiv.
	-->
	<!--
			Der Titel nennt beides: **was** es ist und **was man damit tut**. `Zum
			Übernehmen` allein sagte nicht, worum es sich handelt, `Einzelaufgaben`
			allein nicht, dass hier etwas zu holen ist.

		**Offen geliefert, und das ist keine Kleinigkeit.** AD-14 verlangt, dass man
		beim Öffnen der Seite sieht, was zu tun ist. Ein zugeklappter Abschnitt
		bräche das — `open` hält die Zusage, und zugleich darf jede Person den
		Abschnitt wegklappen, wenn sie ihn gerade nicht braucht. Der Zustand wird
		**nicht** gespeichert: beim nächsten Laden steht wieder alles offen, und
		damit kann kein einmaliger Griff dauerhaft verbergen, dass etwas ansteht.
		-->
	<details class="abschnitt">
		<summary class="abschnitt__griff">
			<h2 class="griff__satz" id="einzel-marke">
				{@render zeichenPerson('zeichen--gross')}
				{#if data.ueberblick.frei === 0}
					<span class="kopfwort">{GRIFF_FREI_LEER}</span>
				{:else}
					<span class="kopfzahl">{data.ueberblick.frei}</span>
					<span class="griff__titel">{GRIFF_FREI}</span>
				{/if}
			</h2>
			<ZeichenWinkel class="aufklapp" />
		</summary>
		<div class="abschnitt__inhalt">
			{#if data.einzelaufgaben.length > 0}
				<ul class="liste liste--getrennt" aria-labelledby="einzel-marke">
					{#each data.einzelaufgaben as aufgabe (aufgabe.id)}
						{@const frageHier = frage !== null && frage.id === aufgabe.id}
						{@const kasten = datumKasten(aufgabe.terminAt)}
						<!--
					`karte--offen` ohne Bedingung: dieser Block führt ausschliesslich freie
					Einzelaufgaben (die load holt nur die), und eine Bedingung, die immer
					wahr ist, behauptete eine Unterscheidung, die es hier nicht gibt.
					Dieselbe Fläche wie auf /einzelaufgaben — derselbe Zustand, dieselbe
					Farbe, sonst lernte man sie zweimal.
				-->
						<li class="karte karte--offen">
							<!--
						**Eine Reihe, nicht zwei Blöcke übereinander.** Der Knopf stand bis
						zum 2026-09-11 über die volle Spaltenbreite unter dem Titel und
						nahm auf dem Telefon — dem Hauptgerät dieser Anwendung — Höhe weg,
						die die Liste braucht. Jetzt steht er daneben.

						`align-items: flex-start`: bei einem langen Titel, der bei 375px
						über drei Zeilen läuft, soll der Knopf oben bleiben und nicht in
						die Mitte rutschen.
					-->
							<div class="einzel__reihe">
								<!--
									**Der Datumskasten steht vor dem Titel**, seit dem 2026-09-15: die
									Zeilen dieses Abschnitts unterscheiden sich in erster Linie durch
									ihren Termin, und eine Spalte gleich gesetzter Zahlen liest sich
									schneller als ein Datum im Fliesstext.

									`aria-hidden`, und das lange Datum steht daneben in
									`.nur-vorgelesen`: `17` über `Sept.` ergibt vorgelesen
									`siebzehn Sept Punkt`, und was den Kasten lesbar macht, ist seine
									Anordnung — die hört niemand.

									**Eckig und keine Pille.** DESIGN.md schliesst die vollständig
									gerundete Form aus, sie signalisiert ein Abzeichen; das hier ist
									ein Datum. `--radius-sm` ist der Radius, den dasselbe Dokument
									„fast eckig" nennt.
								-->
								<p class="datumskasten" aria-hidden="true">
									<span class="datumskasten__tag">{kasten.tag}</span>
									<span class="datumskasten__monat">{kasten.monat}</span>
								</p>
								<div class="zeile__spalte">
									<!--
							Die Kennung dieser Zeile. Der Knopf darunter heisst in jeder Zeile
							`Übernehmen`; wer die Liste sieht, liest den Titel mit, wer sie mit
							einer Elementliste durchgeht, bekäme sonst dasselbe Wort ohne jede
							Auskunft, worum es geht. Derselbe Handgriff wie an den
							Zeilen-Aktionen auf /verwaltung und /traenkeplan.

							`.zeile__text` bringt den Umbruch für getippten Text aus dem
							geteilten Stilblatt mit.
						-->
									<p class="fliesstext zeile__text" id="einzel-titel-{aufgabe.id}">
										{aufgabe.titel}
									</p>
									<!--
							**Das Wort trägt die Dringlichkeit, die Farbe nur den einen Fall.**
							Bis zum 2026-09-14 stand hier allein das Datum, in demselben Grau
							für eine Aufgabe diese Woche wie für eine im Oktober. `diese Woche`
							bleibt in der Nebentextfarbe — das Wort genügt; `überfällig`
							bekommt --overdue, dasselbe Token und dieselbe Aussage wie am
							Fristsatz der Poolzeile.

							**Nicht --warn**, obwohl es naheläge: dessen Kommentar im Tokenblock
							nennt die unbesetzte Dienstwoche als seinen einzigen Zweck, und
							genau diese Doppelnutzung hat am 2026-09-13 die Ernte-Ampel
							gekostet.
						-->
									<p class="hinweis" class:einzel__verstrichen={aufgabe.lage === 'verstrichen'}>
										<!--
											Das lange Datum nur für die Ansage: sichtbar steht es im Kasten
											links, und zweimal dasselbe Datum in einer Zeile wäre Rauschen.
										-->
										<span class="nur-vorgelesen">{datumLang(aufgabe.terminAt)}</span>noch niemand{fristZusatz(
											aufgabe.lage
										)}
									</p>
									<!--
							`noch niemand` steht als Wort und nicht als Ausdruck über
							`aufgabe.uebernehmer`: die load reicht über
							freieEinzelaufgabenLesen ausschliesslich **freie** Zeilen herein,
							und eine Verzweigung über einen Wert, der hier immer null ist, wäre
							ein toter Zweig. Auf /einzelaufgaben, wo beide Zustände stehen,
							verzweigt die Zeile wirklich.

							Es steht seit dem 2026-09-15 in derselben Zeile wie die Lage des
							Termins: der Kasten links trägt das Datum, und zwei Hinweiszeilen
							untereinander wären eine mehr, als die Zeile zu sagen hat.
						-->
								</div>

								<!--
						**Entweder der Knopf oder die Frage, nie beides.** Steht die Frage
						zu dieser Zeile offen, ist der Knopf darüber fort: er schickte
						dieselbe action ein zweites Mal ab und stellte damit nur dieselbe
						Frage noch einmal. Zwei Knöpfe mit derselben Beschriftung in einer
						Zeile, von denen einer bestätigt und der andere nachfragt, sind
						ausserdem für jede Person, die sie einzeln vorgelesen bekommt,
						ununterscheidbar.

						Nach dem Hydrieren eines Frage-Dokuments gilt dasselbe: `form.art`
						steht dann weiterhin auf `fragen`, und ohne diese Bedingung öffnete
						ein Griff an den Knopf den Dialog **über** der schon sichtbaren
						Frage — dieselbe Bestätigung zweimal.

						Ein echtes Formular mit literalem action="?/uebernehmen" — Gate-Regel
						11 liest den Namen textuell. Der Rückruf bricht den Versand ab und
						öffnet den Dialog; **ohne** JavaScript läuft er nicht, der POST geht
						durch, und der Server antwortet mit derselben Frage als Dokument.
					-->
								{#if !frageHier}
									<form
										class="einzel__form"
										method="POST"
										action="?/uebernehmen"
										use:enhance={versandFragen(aufgabe)}
									>
										<input type="hidden" name="einzelaufgabeId" value={aufgabe.id} />
										<button
											class="button-quiet button-quiet--kompakt"
											type="submit"
											id="uebernehmen-{aufgabe.id}"
											aria-labelledby="uebernehmen-{aufgabe.id} einzel-titel-{aufgabe.id}"
											disabled={imFlug}
										>
											<!--
									**Das Zeichen steht neben dem Wort, nicht an seiner Stelle.**
									Ein Kopf mit Schultern, weil Übernehmen in diesem System genau
									eines heisst: die Sache bekommt einen Namen (AD-4). Ein Häkchen
									sagte `erledigt` und bedeutet im Kästchen der Aufgabenzeile
									schon etwas anderes; ein `+` sagte `anlegen` und steht am
									primären Knopf.

									`aria-hidden`, weil das Wort daneben den Namen schon trägt —
									sonst hörte man die Handlung zweimal. `currentColor`, damit es
									im deaktivierten Zustand mit der Schrift mitgeht.
								-->
											{@render zeichenPerson('')}
											{UEBERNEHMEN_KNOPF}
										</button>
									</form>
								{/if}
							</div>

							<!--
						Die Bestätigung **ohne JavaScript**, an der Zeile, um die es geht.
						Sie steht **ausserhalb** der Reihe: sie gehört nicht neben den Titel,
						sondern unter die ganze Zeile — sie ist eine Frage an die Person, kein
						Bedienelement der Kopfzeile.
						Mit JavaScript entsteht sie im Regelfall nie — der Rückruf oben bricht
						den ersten Versand ab, und `form` wird dann nicht auf `fragen` gesetzt.
						Die Ausnahme ist sein Ausfallweg: ist `dialog` nicht gebunden, läuft
						der gewöhnliche POST, und dann steht diese Frage im Dokument. Genau so
						soll es sein — sie ist dort die einzige Bestätigung, die es gibt.

						Ohne use:enhance, denn sie ist der Weg für den Fall, in dem es kein
						enhance gibt. `Abbrechen` ist ein Link auf `/` und kein Knopf: er
						verwirft die Antwort der action, indem er die Seite neu holt, und tut
						sonst nichts.

						`Abbrechen` steht zuerst, wie im Dialog: die Reihenfolge im DOM ist
						die Fokusreihenfolge, und die zusagende Handlung soll nicht die
						erste sein, die ein Enter trifft.
					-->
							{#if frageHier && frage !== null}
								<div class="einzel__frage">
									<!--
								**Derselbe Satz und dieselbe Folge wie im Dialog.** `uebernahmeSatz`
								nennt, was übernommen wird; `UEBERNAHME_FOLGE` sagt, warum das
								verbindlich ist. Der zweite Teil ist Substanz und keine Zierde —
								er ist der Grund, warum diese eine Handlung im ganzen
								Aufgabenbereich eine Bestätigung bekommt —, und darum steht er
								auf **beiden** Wegen. Entschieden im Review vom 2026-08-30; die
								Behauptung darüber hält fest, dass die zwei Wege denselben Text
								tragen.

								Die Überschrift bleibt dem Dialog: sie benennt ein Fenster, nicht
								den Vorgang. Hier trägt die Zeile selbst den Zusammenhang.
							-->
									<p class="fliesstext" id="einzel-frage-{aufgabe.id}">
										{uebernahmeSatz(frage)}
										{UEBERNAHME_FOLGE}
									</p>
									<form class="knoepfe" method="POST" action="?/uebernehmen">
										<input type="hidden" name="einzelaufgabeId" value={frage.id} />
										<input type="hidden" name="bestaetigt" value="1" />
										<!-- resolve() ist Pflicht für interne Ziele (svelte/no-navigation-without-resolve) -->
										<a class="button-quiet" href={resolve('/')}>Abbrechen</a>
										<button
											class="button-quiet"
											type="submit"
											aria-describedby="einzel-frage-{aufgabe.id}"
										>
											{UEBERNEHMEN_KNOPF}
										</button>
									</form>
								</div>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}

			<!--
				**Die zwei Wege stehen im selben Aufklapper wie die Liste.**

				Bis zum 2026-09-11 waren es zwei getrennte Dinge, und beide hiessen
				`Einzelaufgaben` — ein Abschnitt mit der Liste und darunter ein zweiter
				Aufklapper mit den Handlungen. Zwei gleich benannte Aufklapper
				untereinander sind für jede Person, die sie einzeln vorgelesen bekommt,
				ununterscheidbar.

				**Seit dem 2026-09-17 liegt die Liste in einem zugeklappten Aufklapper**,
				und das ist eine Umkehr: bis dahin stand hier, `open` am Abschnitt sei die
				Bedingung, unter der die Unterscheidung trägt. Sie trägt weiterhin — nur
				trägt sie jetzt für die Person, die **aufgeklappt** hat, und für die
				zugeklappte Ansicht sagt der Griff mit seiner Zahl, was dahinter liegt.
				Die Begründung für das Zuklappen in ganzer Länge steht am Abschnitt `Zum
				Erledigen`.

				**Und der Abschnitt steht jetzt auch ohne eine einzige freie
				Einzelaufgabe.** Das ist eine Umkehr der alten Zusage „fehlt ganz oder gar
				nicht", und sie ist der Preis dafür, dass die zwei Wege hier drin liegen:
				verschwände der Abschnitt, verschwänden sie mit — die Sackgasse von
				vorher. Der Pool darüber macht es seit Story 1.4 genauso: Marke steht,
				und statt der Liste ein Satz.
			-->
			<div class="knoepfe">
				<!--
				**Ein primärer Knopf je Abschnitt, nicht je Seite.**

				DESIGN.md schrieb bis zum 2026-09-11 „höchstens einer pro Seite", und das
				stimmte, solange `/` eine einzige Handlung trug. Seit die zwei Abschnitte
				eigene Aufklapper sind, hat jeder seine eigene: hier ausschreiben, im Pool
				erfassen. Sie stehen nie nebeneinander und konkurrieren darum nicht — was
				die Regel meinte.

				`+ Einzelaufgabe` und nicht `Einzelaufgabe ausschreiben`: dieselbe Form wie
				`+ Aufgabe` im Abschnitt darunter, weil es dieselbe Art Handlung ist.

				resolve() ist Pflicht für interne Ziele
				(svelte/no-navigation-without-resolve).
			-->
				<a class="button-primary" href={resolve('/einzelaufgabe')}>+ Termin planen</a>
				<a class="eintrag" href={resolve('/einzelaufgaben')}>Alle Termine</a>
			</div>
		</div>
	</details>
</div>

<!--
	Der eine wiederverwendete Dialog. Die zweite der zwei erlaubten Bestätigungen
	— die erste ist der Widerruf einer Einladung auf /verwaltung. Anderswo gibt es
	keine, und das Abhaken im Pool bleibt ausdrücklich eine einzige Interaktion
	ohne Rückfrage.
-->
<dialog
	class="bestaetigung"
	bind:this={dialog}
	aria-labelledby="uebernahme-titel"
	aria-describedby="uebernahme-text"
	onclose={() => (zuUebernehmen = null)}
>
	<!--
		Der Inhalt entsteht erst mit der gewählten Zeile. Stünde er immer im
		Markup, trüge der ausgelieferte Quelltext den Satz `Du übernimmst: , .` —
		unsichtbar, weil das Element geschlossen ist, und trotzdem gelesen von
		jedem, der hineinschaut. Dieselbe Lehre wie auf /verwaltung. Das Element
		selbst bleibt stehen, weil bind:this es braucht; nur sein Inhalt ist
		bedingt.
	-->
	{#if zuUebernehmen !== null}
		<h2 class="abschnittstitel" id="uebernahme-titel">Übernimmst du das?</h2>
		<p class="bestaetigung__text" id="uebernahme-text">
			{uebernahmeSatz(zuUebernehmen)}
			{UEBERNAHME_FOLGE}
		</p>
		<form method="POST" action="?/uebernehmen" use:enhance={versandBestaetigen}>
			<input type="hidden" name="einzelaufgabeId" value={zuUebernehmen.id} />
			<input type="hidden" name="bestaetigt" value="1" />
			<!--
				`Abbrechen` steht zuerst und wird beim Öffnen fokussiert: ein Enter
				direkt nach dem Öffnen darf keine Zusage abgeben. Die Sichtreihenfolge
				folgt dem DOM, die Fokusreihenfolge damit der Leserichtung.
			-->
			<div class="knoepfe">
				<button
					class="button-quiet"
					type="button"
					bind:this={abbrechenKnopf}
					onclick={() => dialog?.close()}
				>
					Abbrechen
				</button>
				<button class="button-quiet" type="submit" disabled={imFlug}>Übernehmen</button>
			</div>
		</form>
	{/if}
</dialog>

<style>
	/*
		Der Diensthinweis. Eine Zeile auf erhabener Fläche mit 3px linker Kante in
		der Akzentfarbe, fast eckigem Radius und Haarlinie ringsum (UX-DR9).

		Er ist als Ganzes ein Link, und darum steht hier `text-decoration: none` und
		die Tintenfarbe statt der Linkfarbe: unterstrichen und farbig sähe der ganze
		Block aus wie ein Satz Linktext. Dass er ein Ziel hat, sagt seine Fläche —
		und die Kante links, die ihn von jedem anderen Block der Seite unterscheidet.

		`--radius-sm` und nicht `--radius-md`: fast eckig, damit die 3px-Kante als
		gerade Linie liest und nicht als angeschnittener Bogen.
	*/
	/*
	 * Der Satz im Griff eines Abschnitts: Zahl und Wort nebeneinander.
	 *
	 * **Die Zahl ist die Überschrift.** Bis zum 2026-09-11 stand über den beiden
	 * Abschnitten ein Band mit denselben drei Zahlen, und darunter wiederholten
	 * zwei Marken dieselben Listen mit anderen Worten — zwei Überschriften für
	 * dieselbe Sache. Gemessen hat das 251px Kopfbereich gekostet; so sind es 180.
	 *
	 * Der eigentliche Gewinn ist aber nicht der Platz: **ein zugeklappter Abschnitt
	 * verbirgt jetzt seinen Inhalt, nicht mehr seine Lage.** `1 Einzelaufgabe
	 * offen` steht auch im zugeklappten Griff, und damit hält AD-14 unabhängig
	 * davon, ob jemand den Abschnitt offen lässt.
	 *
	 * **Kein `display: inline` mehr.** Es stand hier, weil ein Block als erstes
	 * Kind eines `<summary>` sich unter dessen Dreieck setzte statt daneben. Das
	 * Dreieck ist seit dem 2026-09-16 fort und der Griff ein Flexbehälter; ein
	 * Flexkind wird ohnehin blockiert, die Zeile hätte also nichts mehr getragen
	 * als eine überholte Begründung.
	 *
	 * `min-inline-size: 0` dafür neu: ohne das weicht ein Flexkind nicht unter
	 * seine Inhaltsbreite zurück, und ein langer Titel schöbe den Winkel aus der
	 * Zeile.
	 */
	/*
		**Ein Flexbehälter mit demselben Abstand wie `.plan-zeile`** — seit dem
		2026-09-17, und der Grund ist gemessen und nicht vermutet.

		Bis dahin war dies ein gewöhnlicher Block, seine Kinder standen als
		Inline-Kästen nebeneinander, und der Abstand zwischen ihnen war der
		**Leerraum im Quelltext**: ein Leerzeichen, rund 5.7px. Die zwei Zeilen mit
		Pfeil daneben sind Flexbehälter mit `gap: var(--space-2)`, also 8px. Bei
		375px gemessen begannen die Titel darum an zwei verschiedenen Stellen —
		74.7px in den Griffen, 92.9px in den Zeilen.

		**Und `min-inline-size` an der Zahl war dort wirkungslos.** Die Eigenschaft
		gilt für nicht ersetzte Inline-Kästen nicht; der Platz für zwei Ziffern
		stand in den Zeilen und fehlte in den Griffen, ohne dass irgendetwas rot
		wurde. Als Flex-Kind greift sie, und die fünf Titel beginnen an derselben
		Stelle.
	*/
	.griff__satz {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		flex: 1 1 auto;
		min-inline-size: 0;
		margin: 0;
	}

	/*
	 * Zahl und Wort einer Kopfzeile. **`kopf` und nicht `griff`**, weil beides
	 * nicht nur in den zwei Aufklapp-Griffen steht, sondern auch in der Zeile zum
	 * Tränkeplan — und die klappt nichts auf. Ein Name, der dort `griff` hiesse,
	 * behauptete ein Verhalten, das die Zeile nicht hat.
	 *
	 * Geteilt und nicht kopiert: zwei gleiche Regelkörper an zwei Orten sind das,
	 * worauf Gate-Regel 14 anschlägt.
	 */
	/*
		Die eigene Zusage. Fläche, Kante und Radius wie an der Ernte-Zeile — das
		ist die Form für `das hier führt woandershin`, und sie führt auf
		/einzelaufgaben, wo die übernommenen Zeilen mit ihren Namen stehen.

		Die 3px-Kante links in Akzentfarbe ist dasselbe Zeichen wie an der
		laufenden Woche im Tränkeplan: hier bist du gerade. Der Diensthinweis trug
		sie bis zum 2026-09-13 ebenfalls und ist seither eine gefüllte Fläche —
		die beiden stehen damit untereinander, ohne sich zu gleichen.
	*/
	/*
		Was von der Kachel mit den eigenen Zusagen übrig ist: **eine Kante**.

		Seit dem 2026-09-17 ist der Block ein `.abschnitt` wie die zwei darunter,
		und Fläche, Umriss, Radius und `overflow` kommen von dort. Diese Regel
		trägt allein das 3px-Akzentstück links — dasselbe Zeichen wie an der
		laufenden Woche im Tränkeplan: hier bist du gerade. Der Diensthinweis trug
		es bis zum 2026-09-13 ebenfalls und ist seither eine gefüllte Fläche; die
		drei stehen damit untereinander, ohne sich zu gleichen.

		**Eine Deklaration und kein Zwilling.** Die frühere Fassung wiederholte
		Fläche, Umriss und Radius von `.abschnitt` — genau der Regelkörper, auf den
		Gate-Regel 14 anschlägt, sobald zwei Klassen ihn teilen. Jetzt steht hier
		nur noch, was diesen Abschnitt von den anderen unterscheidet.
	*/
	.meine {
		border-inline-start: var(--border-marker) solid var(--accent);
	}

	/*
		**Die zwei Pixel, die die Akzentkante kostet, gibt der Griff zurück.**

		`.abschnitt` trägt links eine Haarlinie, `.meine` an ihrer Stelle die
		3px-Marke. Alles darin rückt damit um die Differenz nach rechts — gemessen
		bei 375px: das Zeichen dieses Griffs sass bei 31px, das der anderen vier
		bei 29px. Zwei Pixel sieht man einzeln nicht und in einer Reihe von fünf
		schon.

		Gerechnet aus den zwei Kantentoken und nicht als Zahl hingeschrieben: wer
		`--border-marker` verschiebt, verschiebt diesen Ausgleich mit.
	*/
	.meine > .abschnitt__griff {
		padding-inline-start: calc(var(--space-3) - (var(--border-marker) - var(--border-hairline)));
	}

	/*
		Punkt und Knopf nebeneinander. `align-items: flex-start`, damit der Knopf
		bei einem zweizeiligen Titel oben bleibt und nicht in die Mitte rutscht —
		dieselbe Überlegung wie an der Zeile der freien Termine.
	*/
	.meine__zeile {
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
	}

	/* Der Knopf steht rechts und gibt nicht nach — die Begründung steht an
	   `.einzel__form`, wo derselbe Fehler gemessen wurde. */
	.meine__zeile form {
		flex: none;
		margin: 0;
		margin-inline-start: auto;
	}

	/*
		Die Punkte. Der Innenabstand macht Platz für das Aufzählungszeichen —
		`list-style-position: inside` zöge die zweite Zeile eines langen Titels
		unter den Punkt statt unter den Text.
	*/
	.meine__punkte {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		margin: 0;
		padding-inline-start: var(--space-4);
		list-style: disc;
	}

	/*
		**Kein `display` am `<li>`** — und das ist hier keine Formsache, sondern
		die ganze Zeile: ein `display: flex` ersetzt `list-item`, und mit ihm
		verschwindet das Aufzählungszeichen. Gesehen am gerenderten Baum am
		2026-09-14; im Quelltext sieht die Regel aus wie jede andere.

		Gestapelt wird darum an den zwei Kindern, nicht am Listenpunkt selbst.
	*/
	.meine__punkte li {
		min-width: 0;
	}

	.meine__punkte .zeile__text {
		display: block;
	}

	.meine__punkte .hinweis {
		display: block;
		margin-block-start: var(--space-1);
	}

	/*
		Der verstrichene Termin — dasselbe Token und dieselbe Aussage wie am
		Fristsatz der Poolzeile. Nur die Farbe wechselt; die Schriftrolle bleibt
		die des Hinweises, an dem sie hängt.
	*/
	.einzel__verstrichen {
		color: var(--overdue);
	}

	/*
		Die Überschrift eines Abschnittsgriffs — der Titel, nicht die Zahl.

		**Das kehrt die Entscheidung vom 2026-09-11 um**, und zwar bewusst. Damals
		wurde die Zahl zur Überschrift, weil die Griffe vorher zwei Überschriften
		für dieselbe Sache trugen. Seit die Abschnitte nach ihrer Frage heissen
		(`Wer übernimmt`, `Zum Erledigen`), trägt der Titel die Aussage und die
		Zahl den Umfang — `2 Wer übernimmt` liest sich als Satz falsch, und eine
		Zahl in Überschriftgrösse vor einer Frage betont das Falsche.

		Was von jener Entscheidung bleibt, ist ihr eigentlicher Gewinn und er ist
		unberührt: **ein zugeklappter Abschnitt verbirgt seinen Inhalt, nicht seine
		Lage.** Die Zahl steht weiterhin im Griff, nur kleiner und in einem Kasten.
	*/
	/*
		**Die Rolle `action` und nicht `section`** — seit dem 2026-09-17, auf
		Manuels Befund, die Titel seien in dieser Ansicht zu gross.

		`section` sind 20px und die Rolle der **Seitengliederung**: die Titelleiste,
		der Titel eines Abschnitts auf /ernte oder /sitzungen, wo einer oder zwei
		davon stehen. Auf `/` stehen **fünf** untereinander, und fünf Überschriften
		in 20px sind kein Aufbau mehr, sondern eine Wand.

		`action` sind 16px in derselben Schrift und demselben Gewicht — die Rolle
		des Knopftextes, und das passt hier besser, als es zunächst klingt: diese
		fünf Zeilen sind Griffe. Drei klappen auf, zwei führen weg; jede ist etwas,
		das man antippt.

		**Keine neue Zahl und keine neue Rolle.** Die Rampe in src/app.html bleibt
		unberührt; wer `--section-size` verschöbe, verschöbe die Titelleiste und
		jeden Abschnittstitel des Produkts mit. Hier wechselt nur, welche der
		bestehenden Rollen diese fünf Zeilen tragen.

		`line-height` kommt trotzdem aus `section` und nicht aus `action`: dessen
		1.0 ist für einen Knopf gedacht, dessen Höhe der Knopf selbst setzt. Ein
		Titel, der umbricht — `Tränkewochen unbesetzt` tut das bei 375px —, klebte
		damit zusammen.
	*/
	.griff__titel {
		color: var(--ink-primary);
		font-family: var(--action-font);
		font-size: var(--action-size);
		font-weight: var(--action-weight);
		line-height: var(--section-line);
		letter-spacing: var(--section-tracking);
	}

	/*
		**Die Zahl — eine für alle vier, vorn, in der Grösse des Titels.**

		Die vier sind die zwei Zeilen mit Pfeil (Tränkeplan, Ernte) und die zwei
		Abschnittsgriffe (`Zum Erledigen`, `Wer übernimmt`). Sie sagen dasselbe —
		wie viele —, und seit dem 2026-09-17 sehen sie gleich aus. Entscheid
		Manuel.

		**Das nimmt zwei frühere Entscheidungen zurück, und beide sind benannt.**
		Am 2026-09-15 bekamen die Griffe einen kleinen Zähler in Nebentextfarbe,
		weil „was der Abschnitt ist, sagt das Wort"; die Zeilen behielten ihre
		grosse Zahl. Das waren zwei Formen für eine Sache, und auf einer Seite,
		die alle vier untereinander zeigt, liest sich das als Rangordnung, die es
		nicht gibt. Am selben Tag stand die Begründung, `2 Wer übernimmt` lese
		sich als Satz falsch — das stimmt, und es wiegt weniger als vier Zeilen,
		die man nebeneinander vergleichen kann. Die Zahl wird nicht mitgelesen,
		sie wird abgelesen.

		**Eine blosse Zahl und kein Kasten.** Das bleibt von der Entscheidung vom
		2026-09-15 übrig und gilt unverändert: der Datumskasten an einer Zeile
		darunter trägt die Aussage seiner Zeile, diese Zahl zählt nur. Zwei Kästen
		derselben Form für zwei verschieden wichtige Dinge liessen den einen wie
		den anderen aussehen.

		`tabular-nums`, weil vier davon untereinander stehen und eine springende
		Ziffernbreite genau dort auffällt (UX-DR).
	*/
	.kopfzahl {
		/*
			**Platz für zwei Ziffern, auch wenn nur eine dasteht** (Entscheid Manuel,
			2026-09-17). Ohne ihn beginnt der Titel je nach Zahl an einer anderen
			Stelle, und fünf Zeilen untereinander stehen dann treppenförmig.

			`2ch` und keine Zahl aus der Abstandsrampe: `ch` ist die Breite der
			Ziffer Null, und zusammen mit `tabular-nums` darüber ist das **genau**
			zwei Ziffern — kein geschätzter Wert, der bei der nächsten Schriftart
			daneben liegt. Ein Wert aus der Rampe wäre hier die ungenauere Schraube.

			Die Zahl steht rechtsbündig darin: die Einer liegen damit untereinander
			und der Abstand zum Titel ist immer derselbe. Bei dreistelligen Zahlen —
			die es in diesem Garten nicht gibt, aber die Regel soll nicht daran
			hängen — wächst das Feld, statt abzuschneiden.
		*/
		min-inline-size: 2ch;
		text-align: end;
		font-family: var(--action-font);
		font-size: var(--action-size);
		font-weight: var(--action-weight);
		line-height: var(--section-line);
		letter-spacing: var(--section-tracking);
		color: var(--ink-primary);
		font-variant-numeric: tabular-nums;
	}

	.kopfwort {
		font-family: var(--meta-font);
		font-size: var(--meta-size);
		font-weight: var(--meta-weight);
		line-height: var(--meta-line);
		color: var(--ink-secondary);
	}

	/*
	 * Der Zusatz zur Überfälligkeit, in derselben Farbe wie der Fristsatz an der
	 * Zeile — dieselbe Sache, dieselbe Farbe. Kein eigener Umbruch mehr: er steht
	 * hinter dem Wort statt darunter, und genau das spart die dritte Zeile.
	 */
	/*
		Der Zusatz zur Überfälligkeit im Griff.

		**Die Schriftrolle steht seit dem 2026-09-15 hier** und nicht mehr in der
		Umgebung: bis dahin lag dieses Element in `.kopfwort` und erbte dessen
		meta-Rolle. Mit dem Umbau auf Titel und Zähler ist es ein direktes Kind der
		Überschrift geworden und erbte deren Grösse — der Satz stand in
		Überschriftgrösse und brach über zwei Zeilen um. Gesehen am gerenderten
		Baum, nicht im Quelltext.
	*/
	.kopffrist {
		color: var(--overdue);
		font-family: var(--meta-font);
		font-size: var(--meta-size);
		font-weight: var(--meta-weight);
		line-height: var(--meta-line);
	}

	/*
	 * Die zwei Zeilen mit Pfeil — Tränkeplan und Ernte.
	 *
	 * **Sie sehen anders aus als die Griffe darunter, weil sie etwas anderes
	 * tun.** Die Griffe klappen einen Abschnitt dieser Seite auf; diese Zeilen
	 * führen auf eine andere Seite. Gleiche Form bei verschiedenem Verhalten wäre
	 * die Falle — wer einmal gelernt hat, dass eine Zeile mit Zahl aufklappt,
	 * erwartet das auch hier.
	 *
	 * Darum: kein Dreieck, sondern ein Pfeil am Ende, Akzentfarbe wie jeder andere
	 * Verweis, und eine Kante wie am Diensthinweis darüber — der führt ebenfalls
	 * auf den Tränkeplan, und beide sehen deshalb gleich aus.
	 *
	 * **`center` und nicht `baseline`**, seit dem 2026-09-17 und aus zwei
	 * Gründen: die Ernte-Zeile trägt vorn ein Zeichen, und ein SVG hat keine
	 * Grundlinie — der Browser nimmt dann seine Unterkante, und das Zeichen sässe
	 * zu tief. Und an der Tränkezeile steht die Warnung als zweite Zeile unter dem
	 * Titel; Zahl und Pfeil gehören dann in die Mitte der zwei Zeilen und nicht an
	 * die obere.
	 */
	.plan-zeile {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--touch);
		padding: var(--space-2) var(--space-3);
		border: var(--border-hairline) solid var(--ink-secondary);
		border-radius: var(--radius-md);
		background-color: var(--surface-raised);
		color: var(--ink-primary);
		text-decoration: none;
	}

	/*
		Der Pfeil ist grösser als der Knopftext, und zwar absichtlich: er ist das
		einzige Zeichen, das diese Zeile von den zwei Griffen darüber
		unterscheidet — gleiche Kachel, anderes Verhalten. Das Dreieck der Griffe
		malt der Browser, seine Grösse ist nicht unsere; dieser Pfeil kann sich
		darum nicht auf ein Gegengewicht verlassen, das wir setzen.
	*/
	/*
		Die Warnung, wenn diese oder nächste Woche jemand fehlt.

		**`--overdue` und nicht mehr `--warn`**, seit dem 2026-09-17 (Befund
		Manuel: das Gold liest sich als Beige und nicht als Warnung). `--warn` ist
		#856500 — ein dunkles Gold, und auf 13px daneben kaum von der Tinte zu
		unterscheiden; `--overdue` ist #98481d, Rostlehm, und genau der Ton, den
		`· 2 überfällig` im Pool-Griff derselben Seite trägt.

		**Damit tragen die zwei dringenden Zustände auf `/` dieselbe Farbe**, und
		das ist eine Rücknahme: bis heute unterschied sie der Farbton — Rostlehm
		gegen Gold, 1.18:1 zueinander. Was die Unterscheidung wirklich trägt, hat
		derselbe Kommentar schon vorher benannt und gilt unverändert: **die Wörter
		sind verschieden, und sie stehen in verschiedenen Blöcken.** Was die Farbe
		jetzt sagt, ist das, was beide gemeinsam haben — hier drängt etwas.

		`--danger` wäre der klarere Rotton gewesen und ist es nicht geworden:
		DESIGN.md reserviert ihn für Zerstörendes, und eine unbesetzte Woche ist
		keine Gefahr, sondern eine Lücke.

		**`--warn` bleibt, wo es herkommt**: am `— unbesetzt —` im Tränkeplan. Wer
		es dort auch rot will, ändert das Token selbst — und damit die
		veröffentlichte Kontrasttabelle in DESIGN.md, an der `kontrast:selftest`
		hängt.
	*/
	/*
		**Die Schriftrolle steht seit dem 2026-09-17 hier.** Bis dahin lag dieses
		Element in `.kopfwort` und erbte dessen meta-Rolle; jetzt liegt es im
		Titel und erbte dessen Grösse — der Satz stünde in Überschriftgrösse und
		bräche über zwei Zeilen um. Derselbe Vorfall wie bei `.kopffrist` oben,
		und dieselbe Lösung.
	*/
	.plan-zeile__bald {
		display: block;
		color: var(--overdue);
		font-family: var(--meta-font);
		font-size: var(--meta-size);
		font-weight: var(--meta-weight);
		line-height: var(--meta-line);
	}

	.plan-zeile__pfeil {
		margin-inline-start: auto;
		color: var(--accent);
		font-family: var(--section-font);
		font-size: var(--section-size);
		line-height: var(--section-line);
	}

	/*
	 * Der Diensthinweis, gefüllt.
	 *
	 * **Die Kante ist kein Umriss mehr, sondern nur noch die Form der Füllung**,
	 * und darum liegt sie auf --accent und nicht auf --ink-secondary. Der Grund,
	 * aus dem sie bis zum 2026-09-13 auf --ink-secondary lag, ist damit
	 * erledigt und nicht übergangen: NFR9 verlangt 3:1 für den Umriss eines
	 * Bedienelements, **weil** der Umriss das Element identifiziert. Hier tut das
	 * die Fläche — --accent-ink auf --accent hält 6.05:1, und der Block hebt sich
	 * mit derselben Zahl vom Grund ab. Ein Umriss in einer dritten Farbe hätte
	 * nichts mehr zu identifizieren.
	 *
	 * Die Kante steht trotzdem da: ohne sie verschöbe sich der Block gegenüber
	 * jedem anderen Element um eine Haarlinie, und dieselbe Überlegung steht seit
	 * Story 1.3 an .button-primary.
	 *
	 * --radius-md und nicht mehr --radius-sm: der fast eckige Radius war für die
	 * gerade 3px-Kante da, und die gibt es hier nicht mehr.
	 */
	.dienst {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		min-height: var(--touch);
		background-color: var(--accent);
		border: var(--border-hairline) solid var(--accent);
		border-radius: var(--radius-md);
		padding: var(--space-3) var(--space-4);
		color: var(--accent-ink);
		text-decoration: none;
	}

	/*
	 * Die Marke über dem Satz. Sie trägt die Rolle label wie jede andere Marke
	 * der Anwendung, aber nicht deren Farbe: --ink-secondary wäre auf dem Grün
	 * unlesbar. --accent-ink und keine abgeschwächte Fassung davon — die
	 * Anwendung setzt nirgends `opacity` auf Text, und eine halbdurchsichtige
	 * Schrift müsste der Kontrast-Sweep komponiert nachmessen. Die Stufung
	 * zwischen Marke, Satz und Datum trägt die Schriftgrösse.
	 */
	.dienst__marke {
		color: var(--accent-ink);
		font-family: var(--label-font);
		font-size: var(--label-size);
		font-weight: var(--label-weight);
		line-height: var(--label-line);
		letter-spacing: var(--label-tracking);
		text-transform: uppercase;
	}

	/*
	 * Der Satz steht in der section-Rolle und nicht mehr in body: er ist auf der
	 * gefüllten Fläche die Aussage und nicht ein Absatz darin.
	 */
	.dienst__satz {
		font-family: var(--section-font);
		font-size: var(--section-size);
		font-weight: var(--section-weight);
		line-height: var(--section-line);
		letter-spacing: var(--section-tracking);
	}

	/*
	 * Das Datum im gefüllten Block. `.hinweis` setzt --ink-secondary, und das ist
	 * auf dem Grün unlesbar; die Schriftrolle (meta) bleibt, nur die Farbe kippt.
	 */
	.dienst .hinweis {
		color: var(--accent-ink);
	}

	/*
		Kästchen links, Text rechts. Trennung zur nächsten Zeile durch Haarlinie
		oben; die erste hat keine.

		flex-start und nicht center: ein zweizeiliger Aufgabentext soll oben am
		Kästchen beginnen und nicht um dessen Mitte herum stehen.
	*/
	/*
		`flex-wrap` seit dem 2026-09-13: der Ändern-Aufklapper sitzt rechts in der
		Zeile und nimmt aufgeklappt die volle Breite, indem er auf eine eigene
		Zeile umbricht. Ohne das Umbrechen stünde das Formular in der schmalen
		Spalte, die der Griff belegt.
	*/
	.zeile {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: var(--space-3);
		min-height: var(--touch);
		padding: var(--space-3) 0;
		border-top: var(--border-hairline) solid var(--hairline);
	}

	/*
		**Die Spalte nimmt den freien Platz.** Ohne das steht der Griff mit seiner
		vollen Breite in der Umbruchrechnung, und die Zeile bricht ihn auf eine
		eigene Zeile um — je nach Länge des Aufgabentexts, also unvorhersehbar.

		Die Basis ist null und nicht `auto`: über den Umbruch entscheidet der
		Browser an den Basisgrössen, bevor er freien Platz verteilt. Mit `auto`
		wäre die Basis die Textbreite, und damit hinge es wieder an der Länge.

		**Der Preis ist gemessen und benannt** (2026-09-14): der Griff belegt 59px
		der Zeilenbreite, und ein langer Aufgabentext bricht dadurch eine Zeile
		früher um — `Wege zwischen den Beeten jäten` wird bei 390px zweizeilig.
		Die Alternative war ein Griff auf eigener Zeile, und der kostete dieselbe
		Höhe bei **jeder** Zeile statt nur bei den langen.

		Die Regel steht am Kind von `.zeile` und nicht an `.zeile__spalte` selbst:
		dieselbe Klasse trägt die Spalte in der Ernte-Zeile, und dort schiebt
		bereits der Pfeil mit `margin-inline-start: auto`.
	*/
	.zeile > .zeile__spalte {
		flex: 1 1 0;
	}

	/*
		**Im Änderungsmodus bleiben nur Feld und Handlung stehen.**

		Kästchen, Aufgabentext und Fristsatz treten zurück, sobald das Formular
		offen ist: was dann zählt, ist der Text im Feld, und der steht zweimal da,
		wenn die Zeile daneben stehenbleibt. Der Griff bleibt sichtbar — er ist der
		einzige Weg zurück, und ein Formular ohne Ausgang wäre eine Falle.

		**`:has()` und kein Zustand in der Komponente**, weil das Aufklappen ohne
		JavaScript funktionieren muss: das `open` eines `<details>` steht im DOM
		und nicht in einem Svelte-Ausdruck. Die Alternative wäre, das `<details>
		` im Markup vor die Zeile zu ziehen und mit `~` zu arbeiten — dann läse ein
		Screenreader `Ändern` vor dem Aufgabentext. `:has()` kostet Safari unter
		15.4 und Firefox unter 121; beide sind älter als dieses Projekt.
	*/
	.zeile:has(.aendern[open]) > .zeile__form,
	.zeile:has(.aendern[open]) > .zeile__spalte {
		display: none;
	}

	.aendern {
		margin-inline-start: auto;
	}

	.aendern[open] {
		flex-basis: 100%;
	}

	/*
		**Griff und Formularbereich stehen seit dem 2026-09-17 im geteilten
		Stilblatt** als `.aendern__griff` und `.aendern__formulare`: /sitzungen
		trägt denselben Stift an jedem Traktandum, und die zweite Kopie derselben
		zwölf Deklarationen wäre Retro-Posten D1. Die Begründung samt Safari-Fall
		steht dort. Hier bleibt allein, was diese Zeile angeht — wo der Griff in
		ihrer Flex-Zeile sitzt.
	*/

	.zeile:first-child {
		border-top: 0;
	}

	/* Das Formular ist nur der Träger des Kästchens und nimmt keine Breite. */
	.zeile__form {
		display: flex;
		flex: none;
	}

	/*
		Das Trefferfeld: 44px gross, obwohl das Kästchen 22px zeigt.

		Die negativen Aussenabstände ziehen die Differenz wieder heraus, sodass die
		Zeilenhöhe **nicht** wächst — sonst wäre jede Zeile 44px plus Innenabstand
		hoch und die Liste doppelt so lang. Nach links greift das Feld in den
		Seitenrand (--gutter, 16px) hinein: der Daumen findet dort mehr Fläche, und
		das Kästchen selbst bleibt am linken Rand der Spalte ausgerichtet.
	*/
	.treffer {
		position: relative;
		display: flex;
		flex: none;
		align-items: center;
		justify-content: center;
		inline-size: var(--touch);
		block-size: var(--touch);
		margin-block: calc((var(--touch) - var(--task-box)) / -2);
		margin-inline-start: calc((var(--touch) - var(--task-box)) / -2);
	}

	/*
		22px sichtbar, 2px Umriss im Akzent, Radius sm — fast eckig, damit ein
		Kästchen als Kästchen erkennbar bleibt (DESIGN.md, task-box).

		appearance: none, weil der Browser sonst Umriss, Radius und Farbe selbst
		malt, und zwar in Systemfarben, die dieser Rahmen nirgends kennt.
	*/
	.kaestchen {
		flex: none;
		inline-size: var(--task-box);
		block-size: var(--task-box);
		margin: 0;
		border: var(--border-active) solid var(--accent);
		border-radius: var(--radius-sm);
		background-color: transparent;
		appearance: none;
		cursor: pointer;
	}

	.kaestchen:checked {
		background-color: var(--accent);
	}

	/*
		Der Haken als eigenes Element und nicht als ::after auf dem Kästchen:
		Pseudoelemente auf einem <input> sind nicht überall verlässlich, und ein
		Haken, der bei einem Teil der Gruppe fehlt, nimmt dem gefüllten Kästchen
		die halbe Aussage.

		Zwei Kanten in --accent-ink, um 45 Grad gedreht — das ist der Haken. Die
		Verschiebung um -55% statt -50% hebt ihn optisch in die Mitte des
		gedrehten Kastens.
	*/
	.haken {
		position: absolute;
		inset-block-start: 50%;
		inset-inline-start: 50%;
		inline-size: var(--space-1);
		block-size: var(--space-2);
		border-inline-end: var(--border-active) solid var(--accent-ink);
		border-block-end: var(--border-active) solid var(--accent-ink);
		opacity: 0;
		transform: translate(-50%, -55%) rotate(45deg);
		pointer-events: none;
	}

	.kaestchen:checked + .haken {
		opacity: 1;
	}

	/*
		Die Spalte rechts vom Kästchen: Aufgabentext, darunter die
		Überfälligkeitszeile.

		Ein Spaltencontainer und nicht zwei Geschwister in .zeile — die ist ein
		Flexcontainer in Zeilenrichtung, und ein zweites Element darin stünde
		**neben** dem Text.

		min-width: 0 hebt die Vorgabe `min-width: auto` eines Flexkindes auf. Damit
		darf die Spalte unter ihre Inhaltsbreite schrumpfen, statt die Zeile
		aufzuspannen: ohne die Zeile schöbe ein langes Wort ohne Trennstelle die
		ganze Zeile breiter, und das Kästchen links wanderte mit aus dem Blickfeld.

		Was min-width: 0 **nicht** tut, ist umbrechen — das besorgt die Regel
		`overflow-wrap: anywhere` an .zeile__text in bedienelemente.css. Die zwei
		gehören zusammen: min-width: 0 erlaubt der Spalte zu schrumpfen, und erst
		`anywhere` gibt dem langen Wort eine Trennstelle, an der es das auch kann.
		Wer eine der beiden entfernt, bekommt den seitlichen Überlauf zurück.
	*/
	.zeile__spalte {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		min-width: 0;
	}

	/*
		Die Aufgaben-Rampe. Sie gilt für den **Aufgabentext** und nur für ihn.

		Bis zum 2026-08-30 hiess diese Regel `.zeile__text` — derselbe Name wie der
		Umbruchhelfer im geteilten Blatt, und damit trug eine Klasse zwei Rollen.
		Die Folge stand ausgeliefert im Baum: der Titel einer freien Einzelaufgabe
		trägt `class="fliesstext zeile__text"`, und der Bereichshash von Svelte gab
		dieser lokalen Regel den Vorrang vor dem globalen `.fliesstext`. Dieselbe
		Zeile stand darum auf / in der task-Rampe und auf /einzelaufgaben in der
		body-Rampe — `line-height: 1.45` gegen `1.55`. Vor der Zusammenlegung der
		geteilten Rollen gewann `.einzel__titel` per Quelltextreihenfolge, also
		die body-Rampe; die Darstellung auf / hatte sich still geändert.

		Posten R3 der zweiten Retrospektive zu Epic 3. Aufgelöst über den Namen und
		nicht über die Spezifität: `.zeile__text` ist jetzt allein der Umbruch aus
		dem geteilten Blatt, den beide Textarten brauchen, und die Rampe hat einen
		Namen, der sagt, für welche Textart sie gilt.
	*/
	.zeile__aufgabe {
		color: var(--ink-primary);
		font-family: var(--task-font);
		font-size: var(--task-size);
		font-weight: var(--task-weight);
		line-height: var(--task-line);
	}

	/*
		Überfällig: eine zweite Textzeile in der meta-Rolle, Lehmbraun aus
		--overdue.

		**Absichtlich kein Rot.** Eine Aufgabe, die vier Wochen liegt, ist kein
		Fehler und keine Gefahr; --danger bleibt allein dem Zerstörenden vorbehalten.
		Und **kein Abzeichen**: kein gefüllter Hintergrund, kein Pillen-Radius, keine
		eigene Fläche — die Zeile bleibt eine ganz normale Aufgabenzeile.

		Der **Text** trägt die Aussage, die Farbe nie allein (UX-DR8): bei
		ausgeschalteter Farbdarstellung oder Farbfehlsichtigkeit steht
		`seit N Wochen überfällig` unverändert da.

		Diese Regel steht ausdrücklich **nicht** in der Übergangsliste unten. Beim
		Abhaken wird die Zeile aus dem DOM genommen und nicht überblendet — ein
		transition auf color liefe hier ins Leere und suggerierte einen Zustand, den
		es nicht gibt.
	*/
	.zeile__frist {
		margin: 0;
		color: var(--overdue);
		font-family: var(--meta-font);
		font-size: var(--meta-size);
		font-weight: var(--meta-weight);
		line-height: var(--meta-line);
	}

	/*
		Erledigt heisst **drei** Dinge auf einmal: Durchstreichung, gefülltes
		Kästchen mit Haken und gedämpfte Schrift. Kein Zustand hängt allein an der
		Farbe — die Dämpfung ist die letzte der drei und nie die einzige.
	*/
	.zeile--erledigt .zeile__aufgabe {
		color: var(--ink-secondary);
		text-decoration: line-through;
	}

	/*
		Die **einzige** Animation der Anwendung.

		Gekapselt in no-preference und nicht umgekehrt: damit ist die Abwesenheit
		von Bewegung der Standardfall, und Bewegung die Ausnahme, die ausdrücklich
		eingeschaltet wird. Die umgekehrte Schreibweise — Übergang immer, in
		`reduce` wieder abschalten — hat dasselbe Ergebnis, aber jede künftige
		Animation müsste daran denken. Diese ist die Vorlage.

		Die Dauer kommt aus --duration-quick (140ms). Ein rohes 140ms an dieser
		Stelle weist Gate-Regel 1 ab.
	*/
	@media (prefers-reduced-motion: no-preference) {
		.kaestchen,
		.haken,
		.zeile__aufgabe {
			transition-property: background-color, border-color, color, opacity;
			transition-duration: var(--duration-quick);
		}
	}

	/* Das Formular ist nur der Träger des Knopfs — der Knopf trägt seine Breite
	   selbst (.button-quiet ist 100% breit). */
	/*
		Rechts in der Reihe, nicht direkt neben dem Titel: `margin-inline-start:
		auto` schiebt den Knopf an die Kante der Karte, und damit stehen die Knöpfe
		aller Zeilen untereinander auf einer Linie. Neben einem kurzen Titel klebend
		sprängen sie von Zeile zu Zeile.
	*/
	/*
		Das Formular um den Zusage-Knopf.

		**`flex: none` seit dem 2026-09-15**, und der Grund ist gemessen: die
		Vorgabe `0 1 auto` liess das Formular nachgeben, sobald der Datumskasten
		links dazukam — es schrumpfte auf 82px, und der Knopf darin brach `Ich
		mach's` auf zwei Zeilen um. Der Knopf selbst steht längst auf `flex: 0 0
		auto`; das half nichts, weil nicht er nachgab, sondern seine Hülle.

		**Kein `white-space: nowrap` am Knopf** als Gegenmittel: Gate-Regel 1 sucht
		CSS-Farbnamen als ganze Wörter und liest das `white` darin als Farbe. Das
		steht so an `.nur-vorgelesen` im geteilten Blatt und gilt hier genauso —
		die Ursache zu beheben ist ohnehin das Richtige.
	*/
	.einzel__form {
		flex: none;
		margin: 0;
		margin-inline-start: auto;
	}

	/*
		Der Weg **ohne** JavaScript, an der Zeile, um die es geht. Abgesetzt durch
		eine Haarlinie darüber statt durch eine zweite Fläche: die Karte ist schon
		erhaben, und eine erhabene Fläche in einer erhabenen wäre eine Tiefe, die
		der Rahmen nicht kennt.
	*/
	.einzel__frage {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		border-top: var(--border-hairline) solid var(--hairline);
		padding-top: var(--space-2);
	}

	/*
		Die Kopfzeile einer Einzelaufgabe: Titelspalte und Knopf nebeneinander.

		`align-items: center` stellt den Knopf auf die Mitte der Textspalte. Bis zum
		2026-09-11 stand hier `flex-start`, damit er bei einem mehrzeiligen Titel
		oben bleibt — im Gebrauch sah das aus, als gehörte er zur ersten Zeile
		statt zur Zeile als Ganzes. Die Spalte trägt `min-width: 0` aus
		`.zeile__spalte` und darf darum schrumpfen; der Knopf trägt
		`flex: 0 0 auto` aus dem Modifikator und bleibt vollständig.

		Der Fusslink `.einzel__mehr` stand hier bis zum 2026-09-11 und ist in den
		Aufklapper unter der Liste gezogen — die Begründung, warum er kein Knopf
		sein durfte, gilt dort weiter: er führt weiter, er tut nichts, und der eine
		primäre Knopf der Seite ist `+ Aufgabe` unter dem Pool.
	*/
	/*
		Der Datumskasten.

		**Eckig und keine Pille** (--radius-sm, der Radius, den DESIGN.md „fast
		eckig" nennt): eine vollständig gerundete Form signalisiert dort ein
		Abzeichen, und beides gibt es in diesem Entwurf nicht. Entscheid Manuel,
		2026-09-15.

		Fläche und Kante wie an einer Karte, damit der Kasten auf der getönten
		Fläche der freien Zeile als eigener Gegenstand liest und nicht als Loch.
		`flex: none`, sonst zöge ihn ein langer Titel schmal.

		Die Breite ist nicht gesetzt: zwei- und einstellige Tage ergeben
		verschieden breite Kästen, und das ist der ehrlichere Zustand — eine feste
		Breite wäre eine Zahl, die aus keiner Rampe kommt.
	*/
	.datumskasten {
		display: flex;
		flex: none;
		flex-direction: column;
		align-items: center;
		margin: 0;
		padding: var(--space-1) var(--space-2);
		border: var(--border-hairline) solid var(--hairline);
		border-radius: var(--radius-sm);
		background-color: var(--surface-raised);
	}

	.datumskasten__tag {
		color: var(--ink-primary);
		font-family: var(--section-font);
		font-size: var(--section-size);
		font-weight: var(--section-weight);
		line-height: var(--section-line);
		font-variant-numeric: tabular-nums;
	}

	.datumskasten__monat {
		color: var(--ink-secondary);
		font-family: var(--meta-font);
		font-size: var(--meta-size);
		font-weight: var(--meta-weight);
		line-height: var(--meta-line);
	}

	/*
		Ein verstrichener Termin faerbt den Tag mit — dieselbe Farbe und dieselbe
		Aussage wie das Wort `überfällig` daneben. Der Monat bleibt Nebentext: der
		Kasten soll die Aufmerksamkeit an einer Stelle halten und nicht als Ganzes
		leuchten.
	*/
	.einzel__reihe:has(.einzel__verstrichen) .datumskasten__tag {
		color: var(--overdue);
	}

	.einzel__reihe {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
</style>
