<script lang="ts">
	import { enhance } from '$app/forms';
	// SubmitFunction kommt aus @sveltejs/kit, nicht aus $app/forms: dort ist nur
	// enhance selbst ausgeführt, der Typ liegt im Hauptmodul.
	import type { ActionResult, SubmitFunction } from '@sveltejs/kit';
	import { resolve } from '$app/paths';
	import { tick } from 'svelte';
	import type { PageProps } from './$types';
	import { datumLang } from '$lib/client/utils/date';
	import { EINZELAUFGABE_NICHT_ANSPRECHBAR, VERSAND_FEHLGESCHLAGEN } from '$lib/texte';

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
		if (form.art === 'abgehakt' || form.art === 'wiederGeoeffnet') {
			return `${form.meldung} ${form.text}`;
		}
		// Der Titel steht im Satz, wie der Aufgabentext beim Abhaken: die Region
		// sagt an, **was** gerade geschehen ist, nicht nur **dass**.
		if (form.art === 'uebernommen') {
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
				: form !== null && form.art === 'fehler'
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
		if (abbrechenKnopf === null) {
			zuUebernehmen = null;
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
			if (dialog === null) return;
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

<svelte:head>
	<title>Aufgaben</title>
</svelte:head>

<div class="seite">
	<h1 class="seitentitel">Aufgaben</h1>

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
		Die Startseite führt genau drei Blöcke in dieser Reihenfolge (AD-14):

		  Block 1 — Diensthinweis: „Diese Woche bist du am Tränken", nur vorhanden,
		            wenn die betrachtende Person Dienst hat. Seit Story 3.1 gebaut,
		            steht direkt unter diesem Kommentar.
		  Block 2 — freie Einzelaufgaben zum Übernehmen. Seit Story 3.2 gebaut,
		            steht zwischen dem Diensthinweis und der Marke `Offen`.
		  Block 3 — der offene Pool. Diesen füllte Story 1.4.

		Die Reihenfolge stand schon, als zwei Drittel leer waren: sie ist eine
		Entscheidung über die Aufmerksamkeit im Garten und keine Folge davon, in
		welcher Reihenfolge die Stories gebaut wurden.
	-->

	<!--
		Block 1. **Ohne eigenen Dienst fehlt er ganz** — es gibt kein {:else} und
		keinen leeren Rahmen. Ein Block, der „Diese Woche hast du keinen Dienst"
		sagte, nähme jede Woche Platz weg, um nichts mitzuteilen.

		Der ganze Block ist **ein** Link auf den Dienstplan und trägt darum keinen
		Knopf: ein Dienst ist keine Aufgabe, er ist nicht abhakbar und nicht
		wegklickbar. Vertiefen darf die Unterseite, exklusiv informieren nicht —
		der Satz hier sagt schon alles, was diese Woche zählt.

		Die linke Kante in Akzentfarbe (3px, var(--border-marker)) ist dasselbe
		Zeichen wie an der laufenden Woche auf /dienstplan: hier bist du gerade.
	-->
	{#if data.dienst !== null}
		<!-- resolve() ist Pflicht für interne Ziele (svelte/no-navigation-without-resolve) -->
		<a class="dienst" href={resolve('/dienstplan')}>
			<span class="dienst__satz">Diese Woche bist du am Tränken</span>
			<span class="dienst__datum">{data.dienst.datum}</span>
		</a>
	{/if}

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
	{#if data.einzelaufgaben.length > 0}
		<h2 class="marke" id="einzel-marke">Zum Übernehmen</h2>
		<ul class="einzelaufgaben" aria-labelledby="einzel-marke">
			{#each data.einzelaufgaben as aufgabe (aufgabe.id)}
				{@const frageHier = frage !== null && frage.id === aufgabe.id}
				<li class="karte">
					<div class="einzel__spalte">
						<!--
							Die Kennung dieser Zeile. Der Knopf darunter heisst in jeder Zeile
							`Übernehmen`; wer die Liste sieht, liest den Titel mit, wer sie mit
							einer Elementliste durchgeht, bekäme sonst dasselbe Wort ohne jede
							Auskunft, worum es geht. Derselbe Handgriff wie an den
							Zeilen-Aktionen auf /verwaltung und /dienstplan.

							`.zeile__text` bringt den Umbruch für getippten Text aus dem
							geteilten Stilblatt mit.
						-->
						<p class="einzel__titel zeile__text" id="einzel-titel-{aufgabe.id}">
							{aufgabe.titel}
						</p>
						<p class="hinweis hinweis--ziffern">{datumLang(aufgabe.terminAt)}</p>
						<!--
							`noch niemand` steht hier als Wort und nicht als Ausdruck über
							`aufgabe.uebernehmer`: die load reicht über
							freieEinzelaufgabenLesen ausschliesslich **freie** Zeilen herein,
							und eine Verzweigung über einen Wert, der hier immer null ist, wäre
							ein toter Zweig. Auf /einzelaufgaben, wo beide Zustände stehen,
							verzweigt die Zeile wirklich.
						-->
						<p class="hinweis">noch niemand</p>
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
								class="button-quiet"
								type="submit"
								id="uebernehmen-{aufgabe.id}"
								aria-labelledby="uebernehmen-{aufgabe.id} einzel-titel-{aufgabe.id}"
								disabled={imFlug}
							>
								Übernehmen
							</button>
						</form>
					{/if}

					<!--
						Die Bestätigung **ohne JavaScript**, an der Zeile, um die es geht.
						Mit JavaScript entsteht sie nie — der Rückruf oben bricht den ersten
						Versand ab, und `form` wird nie auf `fragen` gesetzt.

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
							<p class="einzel__satz" id="einzel-frage-{aufgabe.id}">
								{uebernahmeSatz(frage)}
							</p>
							<form class="einzel__knoepfe" method="POST" action="?/uebernehmen">
								<input type="hidden" name="einzelaufgabeId" value={frage.id} />
								<input type="hidden" name="bestaetigt" value="1" />
								<!-- resolve() ist Pflicht für interne Ziele (svelte/no-navigation-without-resolve) -->
								<a class="button-quiet" href={resolve('/')}>Abbrechen</a>
								<button
									class="button-quiet"
									type="submit"
									aria-describedby="einzel-frage-{aufgabe.id}"
								>
									Übernehmen
								</button>
							</form>
						</div>
					{/if}
				</li>
			{/each}
		</ul>
		<!-- resolve() ist Pflicht für interne Ziele (svelte/no-navigation-without-resolve) -->
		<a class="einzel__mehr" href={resolve('/einzelaufgaben')}>Alle Einzelaufgaben</a>
	{/if}

	<h2 class="marke" id="offen-marke">Offen</h2>
	{#if data.aufgaben.length === 0}
		<!-- Der leere Zustand sagt, was gilt — der Erfassen-Knopf steht unter dem
		     {#if}, also auch hier darunter. -->
		<p class="leer">Nichts offen.</p>
	{:else}
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
						.zeile__text stünde daneben.

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
						<span class="zeile__text" id="aufgabe-{aufgabe.id}">{aufgabe.text}</span>
						{#if istUeberfaellig}
							<p class="zeile__frist" id="frist-{aufgabe.id}">
								seit {aufgabe.wochenOffen} Wochen überfällig
							</p>
						{/if}
					</div>
				</li>
			{/each}
		</ul>
	{/if}

	<!--
		Der Erfassen-Knopf steht **hinter** dem {#if}/{:else} und damit in beiden
		Zuständen unter dem Pool — auch unter `Nichts offen.`.

		Ein <a> und kein <button>: er navigiert nur, er tut nichts. .button-primary
		trägt text-decoration: none und appearance: none und wirkt darum auch auf
		einem Anker. resolve() ist für interne Ziele Pflicht
		(svelte/no-navigation-without-resolve).

		Der einzige primäre Knopf dieser Seite: die Kästchen sind Kästchen, und es
		gibt daneben keinen zweiten Knopf.
	-->
	<a class="button-primary" href={resolve('/aufgabe')}>+ Aufgabe</a>
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
		<h2 class="abschnittstitel" id="uebernahme-titel">Einzelaufgabe übernehmen?</h2>
		<p class="bestaetigung__text" id="uebernahme-text">
			{uebernahmeSatz(zuUebernehmen)} Dein Name steht danach für alle daneben.
		</p>
		<form method="POST" action="?/uebernehmen" use:enhance={versandBestaetigen}>
			<input type="hidden" name="einzelaufgabeId" value={zuUebernehmen.id} />
			<input type="hidden" name="bestaetigt" value="1" />
			<!--
				`Abbrechen` steht zuerst und wird beim Öffnen fokussiert: ein Enter
				direkt nach dem Öffnen darf keine Zusage abgeben. Die Sichtreihenfolge
				folgt dem DOM, die Fokusreihenfolge damit der Leserichtung.
			-->
			<div class="bestaetigung__knoepfe">
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
	.dienst {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		min-height: var(--touch);
		background-color: var(--surface-raised);
		border: var(--border-hairline) solid var(--hairline);
		border-inline-start: var(--border-marker) solid var(--accent);
		border-radius: var(--radius-sm);
		padding: var(--space-3);
		color: var(--ink-primary);
		text-decoration: none;
	}

	.dienst__satz {
		font-family: var(--body-font);
		font-size: var(--body-size);
		font-weight: var(--body-weight);
		line-height: var(--body-line);
	}

	/* Das Wochendatum trägt die Nebentext-Rolle, Ziffern in Tabellenstellung */
	.dienst__datum {
		color: var(--ink-secondary);
		font-family: var(--meta-font);
		font-size: var(--meta-size);
		font-weight: var(--meta-weight);
		line-height: var(--meta-line);
		font-variant-numeric: tabular-nums;
	}

	.meldung {
		margin: 0;
		color: var(--accent);
		font-family: var(--body-font);
		font-size: var(--body-size);
		font-weight: var(--body-weight);
		line-height: var(--body-line);
	}

	.liste {
		display: flex;
		flex-direction: column;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	/*
		Kästchen links, Text rechts. Trennung zur nächsten Zeile durch Haarlinie
		oben; die erste hat keine.

		flex-start und nicht center: ein zweizeiliger Aufgabentext soll oben am
		Kästchen beginnen und nicht um dessen Mitte herum stehen.
	*/
	.zeile {
		display: flex;
		align-items: flex-start;
		gap: var(--space-3);
		min-height: var(--touch);
		padding: var(--space-3) 0;
		border-top: var(--border-hairline) solid var(--hairline);
	}

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

	.zeile__text {
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
	.zeile--erledigt .zeile__text {
		color: var(--ink-secondary);
		text-decoration: line-through;
	}

	/*
		Sichtbar für einen Screenreader, unsichtbar auf dem Schirm.

		position: absolute nimmt das Element aus dem Fluss, clip-path schneidet es
		weg. **Nicht** display: none und nicht visibility: hidden — beides nähme es
		auch aus dem Zugänglichkeitsbaum, und damit fiele die Hälfte der
		Beschriftung des Kästchens aus.

		Kein white-space: nowrap, wie es die üblichen Fassungen dieser Klasse
		tragen. Gate-Regel 1 sucht CSS-Farbnamen als ganze Wörter und liest das
		`white` in `white-space` als Farbe — gemessen, nicht vermutet. Die
		Zeile bräuchte es hier ohnehin nicht: das Element ist aus dem Fluss
		genommen und weggeschnitten, ein Umbruch darin ist folgenlos.
	*/
	.nur-vorgelesen {
		position: absolute;
		clip-path: inset(50%);
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
		.zeile__text {
			transition-property: background-color, border-color, color, opacity;
			transition-duration: var(--duration-quick);
		}
	}

	/* ---------------------------------------------------------------
	   Block 2 — die freien Einzelaufgaben
	   --------------------------------------------------------------- */
	.einzelaufgaben {
		display: flex;
		flex-direction: column;
		/* Abstand zwischen Geschwistern über gap, nie über Aussenabstände */
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	/* min-width: 0 lässt einen langen Titel brechen statt die Karte zu weiten */
	.einzel__spalte {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		min-width: 0;
	}

	.einzel__titel {
		margin: 0;
		color: var(--ink-primary);
		font-family: var(--body-font);
		font-size: var(--body-size);
		font-weight: var(--body-weight);
		line-height: var(--body-line);
	}

	/* Das Formular ist nur der Träger des Knopfs — der Knopf trägt seine Breite
	   selbst (.button-quiet ist 100% breit). */
	.einzel__form {
		margin: 0;
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

	.einzel__satz {
		margin: 0;
		color: var(--ink-primary);
		font-family: var(--body-font);
		font-size: var(--body-size);
		font-weight: var(--body-weight);
		line-height: var(--body-line);
	}

	.einzel__knoepfe {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	/*
		Der Fusslink auf die Unterseite. Ein Zeilenziel, kein Knopf: er führt
		weiter, er tut nichts — dieselbe Rolle wie ein Eintrag auf /mehr, und
		darum in der Nebentext-Grösse statt in der Knopfform. Höchstens ein
		primärer Knopf pro Seite, und das ist `+ Aufgabe` unter dem Pool.
	*/
	.einzel__mehr {
		display: flex;
		align-items: center;
		/* Trefferfeld: 44px Boden, auch für einen blossen Link */
		min-height: var(--touch);
		color: var(--accent);
		font-family: var(--action-font);
		font-size: var(--action-size);
		font-weight: var(--action-weight);
		line-height: var(--action-line);
		text-decoration: none;
	}
</style>
