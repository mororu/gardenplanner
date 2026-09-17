<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import type { ActionResult, SubmitFunction } from '@sveltejs/kit';
	import { tick } from 'svelte';
	import type { PageProps } from './$types';
	import { VERSAND_FEHLGESCHLAGEN } from '$lib/texte';
	import { wochendatum, wochenSchluessel } from '$lib/zeit';
	import ZeichenWinkel from '$lib/components/ZeichenWinkel.svelte';

	/*
		/traenkeplan — die Wochen der nächsten drei Monate mit je einer Person.

		Die Bauform ist die von /verwaltung: keyed {#each}, je Zeile ein
		aufklappbares Formular in einem <details>, dessen `open` am Fehlschlag
		hängt, und eine Live-Region je Zeile, die immer im Markup steht. Der
		ausführliche Grund für jedes dieser Stücke steht dort; hier stehen nur die
		Unterschiede.
	*/

	const { data, form }: PageProps = $props();

	/*
		Der Wochenschlüssel je Zeile kommt aus **derselben** Faltung wie auf dem
		Server — wochenSchluessel in $lib/zeit.ts. Eine zweite Faltung hier (`${jahr}-${woche}`,
		`jahr * 53 + woche`) liefe still auseinander, und der Fehlersatz landete an
		keiner Zeile.
	*/
	const schluessel = (woche: { jahr: number; woche: number }): number => wochenSchluessel(woche);

	/*
		Die Rückmeldung eines geglückten Besetzens — **mit der Woche**.

		Die Antwort trägt `woche` als blosse Zahl, nicht den gefalteten Schlüssel:
		aus `202701` wieder `1` zu machen hiesse, die Faltung umzukehren, und die
		hat bewusst keine Umkehrfunktion (siehe wochenSchluessel in $lib/zeit.ts).
		Der Satz nennt sie, weil dreizehn bis vierzehn Zeilen gleich aussehen und
		der Fokus nach oben springt: ohne die KW sagt die Meldung, dass etwas
		geklappt hat, aber nicht was.
	*/
	const rueckmeldung = $derived(
		form !== null && form.art === 'besetzt'
			? `${form.meldung} ${form.name} ist für KW ${form.woche} eingetragen.`
			: form !== null && form.art === 'ausgetragen'
				? form.meldung
				: ''
	);

	/*
		**Welche Zeile gerade nach einer Bestätigung fragt — oder null.**

		Der Wert kommt aus der Antwort des Servers und nicht aus einem Zustand im
		Browser: die Frage ist eine Eigenschaft der action, nicht des Geräts, und
		ohne JavaScript entsteht sie als vollständiges Dokument. Dieselbe Bauform
		wie beim Übernehmen auf `/`.
	*/
	const frageWoche = $derived(form !== null && form.art === 'fragenAustragen' ? form.zeile : null);

	/*
		Ein Wurf in der action kommt als `result.type === 'error'` zurück. Der Satz
		steht in derselben Live-Region wie ein Fehlschlag der action; einheitlich
		auf allen Seiten, entschieden am 2026-08-28 zu Eintrag 32 der
		zurückgestellten Arbeit.
	*/
	let versandFehler = $state('');

	/** Die Meldung an der Auswahl einer Zeile. */
	const fehlerAnDerAuswahl = $derived(
		form !== null && form.art === 'fehler' && form.feld === 'mitgliedId' ? form.meldung : ''
	);

	/*
		**Welche** Woche abgewiesen wurde — oder null. Der Wert kommt aus der
		Antwort des Servers und nicht aus einem Client-Zustand, den ein
		use:enhance-Rückruf füllte: ohne JavaScript läuft kein Rückruf, und alles,
		was an ihm hinge — das aufgeklappte Formular, `aria-invalid`, der Fokus —,
		fiele lautlos weg. Die Begründung in ganzer Länge steht in
		verwaltung/+page.svelte.
	*/
	const fehlerWoche = $derived(
		form !== null && form.art === 'fehler' && form.feld === 'mitgliedId' ? form.zeile : null
	);

	/** Die Meldung eines Fehlschlags, der an kein Feld gehört. */
	const fehlerOben = $derived(
		versandFehler !== ''
			? versandFehler
			: form !== null && form.art === 'fehler' && form.feld === null
				? form.meldung
				: ''
	);

	// -------------------------------------------------------------------
	// Versand: eine Sperre für die ganze Seite, plus Fokus danach
	// -------------------------------------------------------------------

	let imFlug = $state(false);
	let meldungKasten = $state<HTMLElement | null>(null);
	let fehlerKasten = $state<HTMLElement | null>(null);

	/**
	 * Setzt den Fokus dorthin, wo die Antwort steht.
	 *
	 * Nach einer Abweisung an die Auswahl **dieser** Woche: dort steht der Satz,
	 * und die obere Region ist in diesem Fall leer und über `.live:empty` aus dem
	 * Fluss genommen. Nach einem geglückten Besetzen an die Rückmeldung oben —
	 * die Zeile bleibt zwar stehen, anders als beim Umbenennen auf /verwaltung,
	 * aber das Formular klappt zu und der Fokus hätte kein Ziel mehr.
	 *
	 * Über die Id statt über ein bind:this je Zeile — vierzehn Bindungen für
	 * einen Griff wären der teurere Weg zum selben Element.
	 */
	function fokusNach(ergebnis: ActionResult): void {
		/*
			`redirect` und `error` tragen keine Daten und **keinen Fokus**. Ein
			redirect entsteht hier auf genau einem Weg: adminOderWeg weist ab, weil
			die Adminrechte seit dem Laden der Seite fort sind. Danach navigiert
			update() fort, und ein Griff in die Erfolgsregion dieser Seite wäre ein
			Fokus auf ein Element, das es gleich nicht mehr gibt — angesagt als
			Erfolg, obwohl nichts geschehen ist.
		*/
		if (ergebnis.type !== 'success' && ergebnis.type !== 'failure') return;

		const daten = ergebnis.data as { art?: unknown; zeile?: unknown } | undefined;
		const art = typeof daten?.art === 'string' ? daten.art : '';

		if (art === 'fehler') {
			const woche = typeof daten?.zeile === 'number' ? daten.zeile : null;
			if (woche !== null) {
				document.getElementById(`auswahl-${woche}`)?.focus();
				return;
			}
			fehlerKasten?.focus();
			return;
		}
		meldungKasten?.focus();
	}

	const versand: SubmitFunction = ({ cancel }) => {
		if (imFlug) {
			cancel();
			return;
		}
		imFlug = true;
		versandFehler = '';
		return async ({ update, result }) => {
			/*
				try/finally: bricht update() ab, bliebe imFlug sonst für immer true und
				jeder Knopf dieser Seite dauerhaft disabled. Dieselbe Absicherung wie in
				aufgabe/+page.svelte, wo sie zuerst entstand.
			*/
			try {
				if (result.type === 'error') {
					versandFehler = VERSAND_FEHLGESCHLAGEN;
				} else {
					await update();
				}
			} finally {
				imFlug = false;
			}
			// Nach dem Rendern, sonst gibt es das Ziel noch nicht.
			await tick();
			// Ein abgefangener Wurf steht in derselben Region wie ein Fehlschlag der
			// action; fokusNach findet ihn nur nicht, weil in `result` keine Daten
			// stehen. Derselbe Weg, eine Zeile davor.
			if (versandFehler !== '') {
				fehlerKasten?.focus();
				return;
			}
			fokusNach(result);
		};
	};
</script>

<svelte:head>
	<title>Tränkeplan</title>
</svelte:head>

<div class="seite">
	<h1 class="seitentitel">Tränkeplan</h1>

	<!--
		Die zwei Live-Regionen des Seitenkopfs. Beide stehen **immer** im Markup und
		sind über `.live:empty` aus dem Fluss genommen, solange sie leer sind —
		Retro-Posten B2: eine Region, die im selben Augenblick entsteht und ihren
		Text bekommt, wird nicht verlässlich vorgelesen.
	-->
	<p class="meldung live" bind:this={meldungKasten} role="status" aria-live="polite" tabindex="-1">
		{rueckmeldung}
	</p>
	<p class="fehler live" bind:this={fehlerKasten} role="alert" aria-live="assertive" tabindex="-1">
		{fehlerOben}
	</p>

	<ul class="liste liste--getrennt">
		{#each data.wochen as eintrag (schluessel(eintrag))}
			{@const dieseWoche = schluessel(eintrag)}
			{@const fehlerHier = fehlerAnDerAuswahl !== '' && fehlerWoche === dieseWoche}
			{@const istLaufend = dieseWoche === data.laufendeWoche}
			<li class="karte" class:woche--laufend={istLaufend}>
				<div class="woche__kopf">
					<div class="woche__spalte">
						<!--
							Die Wochennummer trägt `tabular-nums` (UX-DR: Ziffern in
							Tabellenstellung). Eine Wochenliste, deren Zahlen springen, liest
							sich schlecht — und hier stehen vierzehn davon untereinander.

							**Das ISO-Jahr steht daneben, an jeder Zeile.** Es ist die einzige
							Stelle des Plans, die es nennt: `wochendatum` lässt es weg, und ab
							Mitte Oktober läuft das Fenster immer über den Jahreswechsel. Ohne
							diese Zahl stünde `KW 53 / 28. Dezember bis 3. Januar` über `KW 1 /
							4. Januar bis 10. Januar`, und nichts sagte, welches Jahr gemeint
							ist. Es steht an **allen** Zeilen und nicht nur an denen um die
							Grenze: eine Angabe, die mal da ist und mal nicht, liest sich als
							Aussage über die Zeile, und das wäre sie nicht.
						-->
						<!--
							Die Kennung dieser Zeile — und der Grund, warum sie eine hat.

							Die drei Bedienelemente darunter tragen Beschriftungen, die sich
							über alle vierzehn Wochen **wortgleich** wiederholen: `Besetzen`
							oder `Neu besetzen`, `Zuständig`, `Eintragen`. Wer den Plan sieht,
							liest die Kalenderwoche darüber mit; wer ihn mit einer
							Elementliste durchgeht, bekam bis zum 2026-08-29 vierzehnmal
							dasselbe Wort ohne jede Auskunft, welche Woche gemeint ist.

							Die drei zeigen darum mit aria-labelledby **auf sich selbst und
							dann hierher**: `Besetzen KW 36 2026`. Derselbe Handgriff wie an
							den Zeilen-Aktionen auf /verwaltung, in einem Zug gelöst — der
							Posten war aus Story 3.0.1 und noch einmal aus Story 3.1
							zurückgestellt, beide Male mit der Auflage „gehört in einem Zug
							gelöst, nicht an einer Stelle".
						-->
						<p class="woche__nummer" id="woche-{dieseWoche}">
							KW {eintrag.woche}
							<span class="woche__jahr">{eintrag.jahr}</span>
							{#if istLaufend}<span class="woche__marke">diese Woche</span>{/if}
						</p>
						<p class="hinweis hinweis--ziffern">{wochendatum(eintrag)}</p>
					</div>
					<!--
						Unbesetzt trägt **das Wort**, die Farbe kommt dazu. Kein Zustand
						hängt allein an der Farbe — dieselbe Regel wie bei überfällig auf /,
						und die zwei tragen zwei Token: --overdue dort, --warn hier.
					-->
					<p class="woche__name" class:woche__name--unbesetzt={eintrag.name === null}>
						{eintrag.name ?? '— unbesetzt —'}
					</p>
				</div>

				<!--
					**Austragen steht nur an der eigenen Zeile** — an fremden entsteht gar
					kein Markup, auch kein deaktivierter Knopf. Die Berechtigung hängt
					trotzdem nicht daran: sie steht in der `where`-Klausel des DELETE, und
					ein POST braucht keinen Knopf.

					**Entweder der Knopf oder die Frage, nie beides.** Steht die Frage zu
					dieser Zeile offen, ist der Knopf fort: er schickte dieselbe action
					noch einmal und stellte damit nur dieselbe Frage.

					Ein echtes Formular mit literalem action="?/austragen" — Gate-Regel 11
					liest den Namen textuell. Ohne JavaScript läuft derselbe Weg: der erste
					POST liefert die Frage als Dokument, der zweite schreibt.
				-->
				<!--
					**Eintragen steht an jeder freien Woche, für jede Person.** Bis zum
					2026-09-11 füllte sich der Plan nur, wenn die Verwaltung ihn füllte;
					jetzt trägt sich ein, wer kann.

					Ohne Rückfrage: es nimmt niemandem etwas weg, und wer sich vertut,
					trägt sich mit dem Knopf daneben wieder aus. Die zwei Schranken stehen
					tiefer — die Person ist die angemeldete, und die Woche muss frei sein;
					das entscheidet die Eindeutigkeit in der Abfrage.
				-->
				{#if eintrag.name === null}
					<form class="woche__austragen" method="POST" action="?/eintragen" use:enhance={versand}>
						<input type="hidden" name="jahr" value={eintrag.jahr} />
						<input type="hidden" name="woche" value={eintrag.woche} />
						<button
							class="button-quiet button-quiet--kompakt"
							type="submit"
							id="eintragen-{dieseWoche}"
							aria-labelledby="eintragen-{dieseWoche} woche-{dieseWoche}"
						>
							Ich übernehme
						</button>
					</form>
				{/if}

				{#if eintrag.mitgliedId === data.eigeneId}
					{#if frageWoche === dieseWoche}
						<div class="woche__frage">
							<p class="fliesstext" id="austragen-frage-{dieseWoche}">
								KW {eintrag.woche} wieder freigeben? Wer will, darf sie dann nehmen.
							</p>
							<div class="knoepfe">
								<!-- `Abbrechen` steht zuerst: die Reihenfolge im DOM ist die
								     Fokusreihenfolge, und die zusagende Handlung soll nicht die
								     erste sein. Ein Link und kein Knopf — er verwirft die Antwort
								     der action, indem er die Seite neu holt. -->
								<a class="button-quiet" href={resolve('/traenkeplan')}>Abbrechen</a>
								<form method="POST" action="?/austragen" use:enhance={versand}>
									<input type="hidden" name="jahr" value={eintrag.jahr} />
									<input type="hidden" name="woche" value={eintrag.woche} />
									<input type="hidden" name="bestaetigt" value="1" />
									<button
										class="button-quiet button-quiet--zerstoerend"
										type="submit"
										aria-describedby="austragen-frage-{dieseWoche}"
									>
										Austragen
									</button>
								</form>
							</div>
						</div>
					{:else}
						<form class="woche__austragen" method="POST" action="?/austragen" use:enhance={versand}>
							<input type="hidden" name="jahr" value={eintrag.jahr} />
							<input type="hidden" name="woche" value={eintrag.woche} />
							<button
								class="button-quiet button-quiet--kompakt"
								type="submit"
								id="austragen-{dieseWoche}"
								aria-labelledby="austragen-{dieseWoche} woche-{dieseWoche}"
							>
								Austragen
							</button>
						</form>
					{/if}
				{/if}

				{#if data.istAdmin}
					<!--
						Das Besetzen steht nur im Markup einer Adminperson. Die Auswahl
						führt die Namen aller aktiven Mitglieder, und die haben im
						ausgelieferten HTML von jemandem ohne Adminrechte nichts zu suchen —
						darum entscheidet **dieselbe** Marke über Formular und Auswahl, und
						die load liefert `mitglieder` sonst leer.

						Die action prüft es trotzdem noch einmal: ein POST braucht keinen
						Knopf.
					-->
					<details class="zeilenform" open={fehlerHier}>
						<summary
							class="zeilenform__griff"
							id="besetzen-griff-{dieseWoche}"
							aria-labelledby="besetzen-griff-{dieseWoche} woche-{dieseWoche}"
						>
							<span>{eintrag.name === null ? 'Besetzen' : 'Neu besetzen'}</span>
							<ZeichenWinkel class="aufklapp" />
						</summary>
						<form
							class="zeilenform__formular"
							method="POST"
							action="?/besetzen"
							use:enhance={versand}
						>
							<input type="hidden" name="jahr" value={eintrag.jahr} />
							<input type="hidden" name="woche" value={eintrag.woche} />
							<div>
								<label
									class="feld__beschriftung"
									id="auswahl-label-{dieseWoche}"
									for="auswahl-{dieseWoche}"
								>
									Zuständig
								</label>
								<!--
									Die schon zuständige Person steht vorgewählt: neu besetzt wird
									fast immer, um **eine** Zeile zu ändern, und eine leere
									Auswahl hiesse, sie jedes Mal neu zu suchen. Ist die Woche
									unbesetzt, steht die Aufforderung als deaktivierte erste
									Zeile — ein `required` ohne gültige Vorauswahl.
								-->
								<select
									class="feld"
									id="auswahl-{dieseWoche}"
									name="mitgliedId"
									required
									aria-labelledby="auswahl-label-{dieseWoche} woche-{dieseWoche}"
									aria-invalid={fehlerHier ? 'true' : undefined}
									aria-describedby={fehlerHier ? `besetzen-fehler-${dieseWoche}` : undefined}
								>
									{#if eintrag.mitgliedId === null}
										<option value="" selected disabled>Bitte wählen</option>
									{/if}
									{#each data.mitglieder as mitglied (mitglied.id)}
										<option value={mitglied.id} selected={mitglied.id === eintrag.mitgliedId}>
											{mitglied.name}
										</option>
									{/each}
								</select>
							</div>
							<button
								class="button-quiet"
								type="submit"
								id="eintragen-{dieseWoche}"
								aria-labelledby="eintragen-{dieseWoche} woche-{dieseWoche}"
								disabled={imFlug}
							>
								Eintragen
							</button>
						</form>
					</details>
					<!--
						Der Satz steht **ausserhalb** des <details> und immer im Markup: ein
						geschlossenes <details> verbirgt seinen Inhalt vor dem Screenreader,
						und eine Live-Region, die im selben Augenblick sichtbar wird und
						ihren Text bekommt, wird nicht verlässlich vorgelesen.
					-->
					<p
						class="fehler live"
						id="besetzen-fehler-{dieseWoche}"
						role="alert"
						aria-live="assertive"
					>
						{fehlerHier ? fehlerAnDerAuswahl : ''}
					</p>
				{/if}
			</li>
		{/each}
	</ul>
</div>

<style>
	/*
		Die laufende Woche trägt dieselbe 3px-Kante wie der Diensthinweis auf / —
		derselbe Gedanke an zwei Orten: hier bist du gerade.
	*/
	.woche--laufend {
		border-inline-start: var(--border-marker) solid var(--accent);
	}

	.woche__kopf {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-3);
	}

	/* min-width: 0 lässt einen langen Namen brechen statt die Zeile zu weiten */
	.woche__spalte {
		min-width: 0;
	}

	/*
		Ziffern in Tabellenstellung. Vierzehn Wochennummern stehen untereinander,
		und eine proportionale 1 verschöbe jede Zeile gegen ihre Nachbarin.
	*/
	.woche__nummer {
		margin: 0;
		font-family: var(--body-font);
		font-size: var(--body-size);
		font-weight: var(--body-weight);
		line-height: var(--body-line);
		font-variant-numeric: tabular-nums;
	}

	/*
		Das ISO-Jahr neben der Wochennummer. Nebentext-Rolle: es beantwortet eine
		Frage, die sich nur an vier Zeilen im Jahr stellt, und soll die
		Wochennummer nicht zerteilen.

		**Bleibt lokal, und das ist gemessen und nicht vergessen.** Es ist
		`.hinweis hinweis--ziffern` **ohne** `line-height` und ohne `margin: 0` —
		als Span in der Zeile von `.woche__nummer` würde ein eigenes `line-height`
		die Zeilenbox der Wochennummer zerteilen. Zwei Eigenschaften Unterschied
		bei einem inline gesetzten Element sind kein Duplikat, sondern eine andere
		Regel; vermerkt in deferred-work.md zum Review vom 2026-08-30.

		Hier standen bis zum 2026-08-30 **zwei** Kommentarblöcke übereinander, der
		zweite aus einem späteren Durchgang, und der behauptete „eine Eigenschaft
		Unterschied" — es sind zwei, das `margin: 0` fehlt ebenso. Posten R8 der
		zweiten Retrospektive zu Epic 3: verschmolzen und nachgezählt.
	*/
	.woche__jahr {
		color: var(--ink-secondary);
		font-family: var(--meta-font);
		font-size: var(--meta-size);
		font-weight: var(--meta-weight);
		font-variant-numeric: tabular-nums;
	}

	.woche__marke {
		color: var(--accent);
		font-family: var(--meta-font);
		font-size: var(--meta-size);
		font-weight: var(--meta-weight);
	}

	/*
		min-width: 0 und overflow-wrap: ein Name ohne Trennstelle weitete sonst als
		Flex-Element die ganze Zeile, und der Plan bräche bei 375px aus.
	*/
	.woche__name {
		margin: 0;
		min-width: 0;
		overflow-wrap: anywhere;
		font-family: var(--body-font);
		font-size: var(--body-size);
		font-weight: var(--body-weight);
		line-height: var(--body-line);
		text-align: end;
	}

	/*
		Das Wort trägt die Aussage, die Farbe kommt dazu — nie die Farbe allein.

		**`--overdue` seit dem 2026-09-17** (Entscheid Manuel). Bis dahin stand hier
		`--warn`, ein dunkles Gold, das sich als Beige las statt als Warnung; mit
		diesem Wechsel hat jenes Token seinen letzten Leser verloren und ist aus
		src/app.html verschwunden.

		Damit tragen die unbesetzte Woche hier und die Warnung an der Tränkezeile
		auf `/` denselben Ton — sie sagen auch dasselbe. Was sie von `überfällig`
		im Pool-Griff unterscheidet, sind die Wörter und die Orte, nicht mehr die
		Farbe; so stand es schon vorher im Tokenblock als das, was die Aussage
		wirklich trägt.
	*/
	.woche__name--unbesetzt {
		color: var(--overdue);
	}
</style>
