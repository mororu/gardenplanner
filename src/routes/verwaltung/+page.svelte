<script lang="ts">
	import { tick } from 'svelte';
	import { enhance } from '$app/forms';
	// SubmitFunction kommt aus @sveltejs/kit, nicht aus $app/forms: dort ist nur
	// enhance selbst ausgeführt, der Typ liegt im Hauptmodul.
	import type { ActionResult, SubmitFunction } from '@sveltejs/kit';
	import { datumLang } from '$lib/client/utils/date';
	import type { ActionData, PageProps } from './$types';

	const { data, form }: PageProps = $props();

	/*
		Der Einmal-Link steht in **lokalem** Zustand und nicht in `form`.

		An `form` gehängt war er von jedem weiteren Formularergebnis der Seite
		gelöscht: wer aufnimmt und danach irgendeinen Knopf antippt — auch einen,
		der mit einem Fehlschlag endet —, hatte den Link verloren, bevor er ihn
		weitergeben konnte. Und er ist per Entwurf nicht wiederherstellbar; in
		members steht nur der Hash.

		Die Zusage des eingefrorenen Blocks bleibt trotzdem gültig, weil dieser
		Zustand nur so lange lebt wie die Komponente:

		  - Der Anfangswert kommt aus `form`. Das läuft auch **serverseitig**, und
		    das ist nötig: ohne JavaScript ist die POST-Antwort ein vollständiges
		    Dokument, und die Anzeige muss darin stehen.
		  - Der Effekt darunter übernimmt jeden **späteren** geglückten Link (der
		    Weg mit use:enhance, bei dem die Komponente bestehen bleibt).
		  - Ein Neuladen ist ein GET: neue Komponente, `form` ist null, der Link
		    ist fort. Kein Speicher, kein Cookie, keine Adresse trägt ihn.
	*/
	type EinmalLink = { art: 'aufgenommen' | 'neuAusgestellt'; name: string; link: string };

	function linkAus(ergebnis: ActionData): EinmalLink | null {
		if (ergebnis === null) return null;
		if (ergebnis.art !== 'aufgenommen' && ergebnis.art !== 'neuAusgestellt') return null;
		return { art: ergebnis.art, name: ergebnis.name, link: ergebnis.link };
	}

	/*
		Der Anfangswert liest `form` **absichtlich** nur einmal, beim Aufbau der
		Komponente. Svelte weist darauf hin, weil das in den meisten Fällen ein
		Versehen ist; hier ist es der Zweck — daraus soll gerade kein abgeleiteter
		Wert werden, der jedem späteren `form` folgt und dabei den Link löscht.
		Der Effekt darunter übernimmt jeden späteren Link von Hand.
	*/
	// svelte-ignore state_referenced_locally
	let einmalLink = $state<EinmalLink | null>(linkAus(form));

	$effect(() => {
		const neu = linkAus(form);
		// Nur setzen, nie löschen: der Fehlschlag einer anderen action darf einen
		// Link nicht wegnehmen, den niemand zurückholen kann.
		if (neu !== null) einmalLink = neu;
	});

	/** Die Rückmeldung im Perfekt desselben Verbs, für die höfliche Live-Region. */
	const rueckmeldung = $derived.by(() => {
		if (form === null) return '';
		if (form.art === 'aufgenommen' || form.art === 'neuAusgestellt') {
			return `${form.meldung} Der Einladungslink für ${form.name} steht oben — nur jetzt.`;
		}
		if (form.art === 'widerrufen') return `${form.meldung} ${form.name} hat keinen Zugang mehr.`;
		return '';
	});

	/** Die Meldung eines Fehlschlags, der nicht an das Namensfeld gehört. */
	const fehlerOben = $derived(
		form !== null && form.art === 'fehler' && form.feld === null ? form.meldung : ''
	);

	/** Die Meldung am Namensfeld, im Formular selbst. */
	const fehlerAmNamen = $derived(
		form !== null && form.art === 'fehler' && form.feld === 'name' ? form.meldung : ''
	);

	/** Die Eingabe bleibt nach einem Fehlschlag stehen. */
	const nameEingabe = $derived(form !== null && form.art === 'fehler' ? form.nameEingabe : '');

	// -------------------------------------------------------------------
	// Versand: eine Sperre für die ganze Seite, plus Fokus danach
	// -------------------------------------------------------------------
	/*
		Zwei Antippen auf einem langsamen Telefon legten zwei Mitglieder an, und
		angezeigt wurde nur der Link des zweiten — das erste Mitglied hätte dann
		einen lebenden Link, den niemand kennt. Die Sperre gilt für die **ganze
		Seite** und nicht je Formular: bei zwanzig Zeilen liegen zwanzig
		Formulare nebeneinander, und zwei verschiedene Aktionen gleichzeitig
		unterwegs sind derselbe Fehler.

		Zwei Riegel, weil einer eine Lücke hat: `disabled` am Knopf ist der
		sichtbare und der für die Tastatur wirksame, greift aber erst mit dem
		nächsten Rendern. `cancel()` im Rückruf deckt das Fenster davor ab.
	*/
	let imFlug = $state(false);

	let einmalKasten = $state<HTMLElement | null>(null);
	let meldungKasten = $state<HTMLElement | null>(null);
	let fehlerKasten = $state<HTMLElement | null>(null);

	/**
	 * Setzt den Fokus dorthin, wo die Antwort steht.
	 *
	 * Ohne das steht der Fokus nach dem Versand weiter am Knopf: die
	 * Einmal-Anzeige erscheint oben am Seitenanfang, und bei zwanzig Mitgliedern
	 * liegt die Rückmeldung zu einer Zeilenaktion weit ausserhalb des
	 * Sichtfelds. Der Ausgang kommt aus `result` und nicht aus `form` — im
	 * Rückruf ist die Eigenschaft von aussen noch die alte.
	 */
	function fokusNach(ergebnis: ActionResult): void {
		const daten =
			ergebnis.type === 'success' || ergebnis.type === 'failure'
				? (ergebnis.data as { art?: unknown } | undefined)
				: undefined;
		const art = typeof daten?.art === 'string' ? daten.art : '';

		if (art === 'aufgenommen' || art === 'neuAusgestellt') {
			einmalKasten?.focus();
			return;
		}
		if (art === 'fehler') {
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
		return async ({ update, result }) => {
			/*
				Zuerst den Dialog schliessen.

				use:enhance schickt per fetch ab, es gibt also keine Navigation, die
				ihn schliessen würde: nach einem Antippen von `Widerrufen` blieb er
				offen stehen, und weil ein modaler Dialog den Rest der Seite inert
				macht, kam man nur über `Abbrechen` wieder heraus — während die
				Rückmeldung unerreichbar dahinter lag.

				Unbedingt und nicht nur beim Widerruf: solange der Dialog offen ist,
				ist er der einzige Ort, von dem überhaupt abgeschickt werden kann,
				und auf einem geschlossenen Dialog tut close() nichts.

				Vor update() und vor fokusNach(): close() gibt den Fokus an das
				Element zurück, das ihn vor showModal() hatte, und würde eine danach
				gesetzte Fokusposition wieder überschreiben. Auch bei einem
				Fehlschlag wird geschlossen — der Satz dazu steht oben auf der Seite.
			*/
			dialog?.close();
			/*
				try/finally: bricht update() ab, bliebe imFlug sonst für immer true und
				alle drei Knöpfe dieser Seite dauerhaft disabled — Aufnehmen, Neu
				ausstellen und Widerrufen zugleich. Dieselbe Absicherung wie in
				aufgabe/+page.svelte, wo sie zuerst entstand.
			*/
			try {
				await update();
			} finally {
				imFlug = false;
			}
			// Nach dem Rendern, sonst gibt es das Ziel noch nicht.
			await tick();
			fokusNach(result);
		};
	};

	// -------------------------------------------------------------------
	// Link kopieren
	// -------------------------------------------------------------------
	/*
		Der Kopierstand hängt am Link und nicht an einem Zeitpunkt: nach einem
		zweiten Aufnehmen wäre ein stehengebliebenes „Kopiert." eine Lüge über den
		neuen Link.
	*/
	let kopierstand = $state<{ link: string; satz: string } | null>(null);

	/**
	 * Kopiert den gerade angezeigten Link.
	 *
	 * Über eine eigene Funktion statt inline im Markup: `einmalLink` ist
	 * veränderlicher Zustand, und eine Verengung auf „nicht null" hält über eine
	 * Closure hinweg nicht. Hier wird der Wert im Moment des Antippens gelesen —
	 * was auch sachlich richtig ist, denn zwischen Rendern und Antippen kann ein
	 * neuer Link angekommen sein.
	 */
	function angezeigtenLinkKopieren(): void {
		if (einmalLink === null) return;
		void linkKopieren(einmalLink.link);
	}

	async function linkKopieren(link: string): Promise<void> {
		try {
			await navigator.clipboard.writeText(link);
			kopierstand = { link, satz: 'Kopiert.' };
		} catch {
			// navigator.clipboard gibt es nur auf einer sicheren Herkunft. Der
			// Rückfall nennt darum eine Handlung, die im Feld auch geht: antippen,
			// nicht tippen — in ein readonly-Feld lässt sich gerade nicht tippen.
			kopierstand = {
				link,
				satz: 'Kopieren ging nicht. Tippe das Feld an — der Link ist dann markiert.',
			};
		}
	}

	// -------------------------------------------------------------------
	// Die Widerruf-Bestätigung
	// -------------------------------------------------------------------
	/*
		Ein Dialog für alle Zeilen, nicht einer je Zeile: bei zwanzig Mitgliedern
		wären das zwanzig Dialoge im DOM, von denen neunzehn nie aufgehen.
		<dialog> bringt Esc, Fokusfang und Hintergrund von sich aus mit.
	*/
	let dialog = $state<HTMLDialogElement | null>(null);
	let abbrechenKnopf = $state<HTMLButtonElement | null>(null);
	let zuWiderrufen = $state<{ id: number; name: string; createdAt: number } | null>(null);

	async function widerrufFragen(mitglied: {
		id: number;
		name: string;
		createdAt: number;
	}): Promise<void> {
		// Ohne Dialog wird nicht widerrufen. Der Knopf in der Zeile ist
		// type="button" und schickt nichts ab; ohne die Bestätigung passiert
		// darum nichts — die richtige Ausfallrichtung. Vor allem bleibt
		// zuWiderrufen dann leer, statt eine Id zu tragen, die niemand bestätigt
		// hat.
		if (dialog === null) return;
		zuWiderrufen = mitglied;
		/*
			tick() wartet, bis der Inhalt des Dialogs entstanden ist. Er hängt an
			zuWiderrufen, und Svelte aktualisiert den DOM erst nach dieser
			Zuweisung — ohne das Warten gäbe es `Abbrechen` hier noch nicht.
		*/
		await tick();
		/*
			showModal() fokussiert das erste fokussierbare Element. Damit lag der
			Fokus in einer früheren Fassung auf `Widerrufen`: ein Enter direkt nach
			dem Öffnen beendete einen Zugang ohne weiteres Zutun. `Abbrechen` steht
			deshalb zuerst im DOM und wird zusätzlich ausdrücklich fokussiert.

			Fehlt der Knopf, wird **nicht geöffnet**. Ein `abbrechenKnopf?.focus()`
			wäre hier falsch: es tut still nichts, und übrig bliebe ein offener
			Dialog, dessen Fokus auf der zerstörenden Aktion liegt. Lieber keine
			Bestätigung als eine gefährliche.
		*/
		if (abbrechenKnopf === null) {
			zuWiderrufen = null;
			return;
		}
		dialog.showModal();
		abbrechenKnopf.focus();
	}
</script>

<svelte:head>
	<title>Verwaltung</title>
</svelte:head>

<div class="seite">
	<h1 class="seitentitel">Verwaltung</h1>

	<!--
		Die zwei Live-Regionen stehen **immer** im Markup, auch leer.

		Ein Element, das erst mit seinem Text in den DOM kommt, liest ein
		Screenreader in der Regel nicht vor: die Region muss schon da sein, wenn
		sich ihr Inhalt ändert. Leer nehmen beide keinen Platz ein — siehe die
		:empty-Regel unten, die sie aus dem Fluss nimmt, statt sie mit
		display: none aus dem Baum zu werfen.
	-->
	<p class="meldung live" role="status" aria-live="polite" tabindex="-1" bind:this={meldungKasten}>
		{rueckmeldung}
	</p>
	<p class="fehler live" role="alert" aria-live="assertive" tabindex="-1" bind:this={fehlerKasten}>
		{fehlerOben}
	</p>

	{#if einmalLink !== null}
		<!--
			Die Einmal-Anzeige. Sie steht direkt unter dem Titel, weil sie das
			Einzige auf dieser Seite ist, das nicht wiederkommt.
		-->
		<section class="einmal" aria-labelledby="einmal-titel" tabindex="-1" bind:this={einmalKasten}>
			<h2 class="abschnittstitel" id="einmal-titel">Einladungslink</h2>
			<p class="einmal__name">
				{einmalLink.art === 'aufgenommen' ? 'Neu aufgenommen' : 'Neu ausgestellt für'}:
				{einmalLink.name}
			</p>

			<div>
				<label class="feld__beschriftung" for="einladungslink">Link zum Weitergeben</label>
				<input
					class="feld"
					id="einladungslink"
					type="text"
					readonly
					value={einmalLink.link}
					onfocus={(ereignis) => ereignis.currentTarget.select()}
				/>
			</div>

			<button class="button-quiet" type="button" onclick={angezeigtenLinkKopieren}>
				Link kopieren
			</button>
			{#if kopierstand !== null && kopierstand.link === einmalLink.link}
				<p class="einmal__stand" role="status">{kopierstand.satz}</p>
			{/if}

			<p class="einmal__warnung">
				Dieser Link ist nur jetzt zu sehen und danach nicht wiederherstellbar. Gib ihn von Hand
				weiter — die Anwendung verschickt nichts. Ist er verloren, stelle einen neuen aus.
			</p>
		</section>
	{/if}

	<!-- Das Aufnahmeformular trägt den einzigen primären Knopf dieser Seite. -->
	<form
		class="aufnahme"
		method="POST"
		action="?/aufnehmen"
		aria-labelledby="aufnahme-titel"
		use:enhance={versand}
	>
		<h2 class="abschnittstitel" id="aufnahme-titel">Mitglied aufnehmen</h2>
		<div>
			<label class="feld__beschriftung" for="name">Name</label>
			<input
				class="feld"
				id="name"
				name="name"
				type="text"
				autocomplete="off"
				required
				maxlength="80"
				value={nameEingabe}
				aria-invalid={fehlerAmNamen === '' ? undefined : 'true'}
				aria-describedby={fehlerAmNamen === '' ? undefined : 'name-fehler'}
			/>
		</div>
		{#if fehlerAmNamen !== ''}
			<p class="fehler" id="name-fehler">{fehlerAmNamen}</p>
		{/if}
		<button class="button-primary" type="submit" disabled={imFlug}>Aufnehmen</button>
	</form>

	<h2 class="abschnittstitel" id="mitglieder-titel">Mitglieder</h2>
	<ul class="liste" aria-labelledby="mitglieder-titel">
		{#each data.mitglieder as mitglied (mitglied.id)}
			<li class="zeile">
				<p class="zeile__name">
					{mitglied.name}
					{#if mitglied.id === data.ichId}<span class="zeile__marke">— Du</span>{/if}
				</p>
				<!--
					Der Aufnahmezeitpunkt ist nicht Zierrat: auf `name` gibt es keine
					Eindeutigkeitsbedingung, zwei Mitglieder dürfen gleich heissen.
					Ohne dieses Datum nennt der Bestätigungsdialog nur den Namen, und
					der Widerruf könnte die falsche Zeile treffen. Zugleich ist es der
					einzige Wert aus ohneHashSpalte, der sonst ungezeigt in jede
					ausgelieferte Seite reiste.
				-->
				<p class="zeile__meta">Aufgenommen am {datumLang(mitglied.createdAt)}</p>

				{#if !mitglied.isActive}
					<!-- Beendet steht im **Text**, nicht in einer Farbe. -->
					<p class="zeile__meta">Zugang beendet.</p>
				{:else if mitglied.id !== data.ichId}
					<div class="zeile__knoepfe">
						<form method="POST" action="?/neuAusstellen" use:enhance={versand}>
							<input type="hidden" name="mitgliedId" value={mitglied.id} />
							<button class="button-quiet" type="submit" disabled={imFlug}>
								Link neu ausstellen
							</button>
						</form>
						<!--
							type="button": dieser Knopf öffnet nur die Bestätigung.
							Abgeschickt wird aus dem Dialog. Ohne JavaScript widerruft
							damit nichts — die richtige Ausfallrichtung für eine
							zerstörende Aktion.
						-->
						<button
							class="button-quiet button-quiet--zerstoerend"
							type="button"
							onclick={() =>
								widerrufFragen({
									id: mitglied.id,
									name: mitglied.name,
									createdAt: mitglied.createdAt,
								})}
						>
							Einladung widerrufen
						</button>
					</div>
				{/if}
			</li>
		{/each}
	</ul>
</div>

<!-- Der eine wiederverwendete Dialog. Eine der zwei erlaubten Bestätigungen. -->
<dialog
	class="bestaetigung"
	bind:this={dialog}
	aria-labelledby="widerruf-titel"
	aria-describedby="widerruf-text"
	onclose={() => (zuWiderrufen = null)}
>
	<!--
		Der Inhalt entsteht erst mit der gewählten Zeile.

		Vorher stand er immer im Markup und füllte Name und Datum mit leeren
		Zeichenketten: der ausgelieferte Quelltext trug den Satz „, aufgenommen am
		, kommt danach nicht mehr herein" — unsichtbar, weil das Element
		geschlossen ist, aber gelesen von jedem, der in den Quelltext schaut.
		Ebenso trug das versteckte Feld ein leeres mitgliedId. Das Element selbst
		bleibt stehen, weil bind:this es braucht; nur sein Inhalt ist bedingt.
	-->
	{#if zuWiderrufen !== null}
		<h2 class="abschnittstitel" id="widerruf-titel">Einladung widerrufen?</h2>
		<p class="bestaetigung__text" id="widerruf-text">
			{zuWiderrufen.name}, aufgenommen am {datumLang(zuWiderrufen.createdAt)}, kommt danach nicht
			mehr herein, und der Link führt auf die Fehlerseite. Der Name bleibt in der Liste stehen;
			gelöscht wird nichts, und es gibt keinen Weg zurück.
		</p>
		<form method="POST" action="?/widerrufen" use:enhance={versand}>
			<input type="hidden" name="mitgliedId" value={zuWiderrufen.id} />
			<!--
				`Abbrechen` steht zuerst und wird beim Öffnen fokussiert: ein Enter
				direkt nach dem Öffnen darf keinen Zugang beenden. Die Sichtreihenfolge
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
				<button class="button-quiet button-quiet--zerstoerend" type="submit" disabled={imFlug}>
					Widerrufen
				</button>
			</div>
		</form>
	{/if}
</dialog>

<style>
	.seite {
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
	}

	/* Genau ein h1 pro Seite, und nur dieses trägt die display-Rolle */
	.seitentitel {
		margin: 0;
		color: var(--ink-primary);
		font-family: var(--display-font);
		font-size: var(--display-size);
		font-weight: var(--display-weight);
		line-height: var(--display-line);
		letter-spacing: var(--display-tracking);
	}

	/* Abschnittstitel in der section-Rolle — keine zweite display-Grösse */
	.abschnittstitel {
		margin: 0;
		color: var(--ink-primary);
		font-family: var(--section-font);
		font-size: var(--section-size);
		font-weight: var(--section-weight);
		line-height: var(--section-line);
		letter-spacing: var(--section-tracking);
	}

	/*
		Eine leere Live-Region bleibt im Baum und verlässt nur den Fluss. Mit
		display: none wäre sie für einen Teil der Hilfsmittel gar nicht vorhanden
		und die Ansage fiele wieder aus; so ändert sich nur ihr Inhalt, und genau
		das hören sie.
	*/
	.live:empty {
		position: absolute;
		block-size: 0;
		inline-size: 0;
		overflow: hidden;
	}

	/* Tiefe nur tonal: aufgehellte Fläche plus Haarlinie, kein Schatten. */
	.einmal {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding: var(--space-4);
		border: var(--border-hairline) solid var(--hairline);
		border-radius: var(--radius-lg);
		background-color: var(--surface-raised);
	}

	.einmal__name {
		margin: 0;
		color: var(--ink-primary);
		font-family: var(--task-font);
		font-size: var(--task-size);
		font-weight: var(--task-weight);
		line-height: var(--task-line);
	}

	.einmal__stand,
	.einmal__warnung {
		margin: 0;
		color: var(--ink-secondary);
		font-family: var(--meta-font);
		font-size: var(--meta-size);
		font-weight: var(--meta-weight);
		line-height: var(--meta-line);
	}

	.meldung {
		margin: 0;
		color: var(--accent);
		font-family: var(--body-font);
		font-size: var(--body-size);
		font-weight: var(--body-weight);
		line-height: var(--body-line);
	}

	/*
		Der Fehlersatz ist keine Farbaussage: er steht als Satz da und trägt
		darum die gewöhnliche Textfarbe. Rot ist in dieser Anwendung dem
		zerstörenden Knopf vorbehalten und sagt „das hier zerstört etwas", nicht
		„das hier ging schief".
	*/
	.fehler {
		margin: 0;
		color: var(--ink-primary);
		font-family: var(--body-font);
		font-size: var(--body-size);
		font-weight: var(--body-weight);
		line-height: var(--body-line);
	}

	.aufnahme {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.liste {
		display: flex;
		flex-direction: column;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	/* Trennung zur nächsten Zeile durch Haarlinie oben; die erste hat keine. */
	.zeile {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		min-height: var(--touch);
		padding: var(--space-3) 0;
		border-top: var(--border-hairline) solid var(--hairline);
	}

	.zeile:first-child {
		border-top: 0;
	}

	.zeile__name {
		margin: 0;
		color: var(--ink-primary);
		font-family: var(--task-font);
		font-size: var(--task-size);
		font-weight: var(--task-weight);
		line-height: var(--task-line);
	}

	.zeile__marke {
		color: var(--ink-secondary);
	}

	.zeile__meta {
		margin: 0;
		color: var(--ink-secondary);
		font-family: var(--meta-font);
		font-size: var(--meta-size);
		font-weight: var(--meta-weight);
		line-height: var(--meta-line);
	}

	.zeile__knoepfe {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	/*
		<dialog> bringt Zentrierung, Fokusfang, Esc und den Hintergrund selbst
		mit. Gesetzt wird nur, was der Browser sonst in Systemfarben malt — in
		einer Komponente ist jede Systemfarbe falsch, weil hier beide Modi
		gestaltet sind.
	*/
	.bestaetigung {
		max-width: var(--measure);
		margin: auto;
		padding: var(--space-4);
		border: var(--border-hairline) solid var(--hairline);
		border-radius: var(--radius-lg);
		background-color: var(--surface-raised);
		color: var(--ink-primary);
	}

	/*
		Auch der Hintergrund kommt aus einem Token. Die Vorgabe des Browsers ist
		ein halbdurchsichtiges Schwarz und damit eine Farbe, die der Rahmen
		nirgends kennt — im dunklen Modus verschluckt sie die ohnehin dunkle
		Seite. Die Deckkraft macht das Durchscheinen; eine Alpha-Farbe wäre ein
		Literal und hier zu Recht verboten.
	*/
	.bestaetigung::backdrop {
		background-color: var(--ink-primary);
		opacity: 0.6;
	}

	.bestaetigung__text {
		margin: var(--space-3) 0 var(--space-4);
		color: var(--ink-primary);
		font-family: var(--body-font);
		font-size: var(--body-size);
		font-weight: var(--body-weight);
		line-height: var(--body-line);
	}

	.bestaetigung__knoepfe {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
</style>
