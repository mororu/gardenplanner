<script lang="ts">
	import { tick } from 'svelte';
	import { enhance } from '$app/forms';
	// SubmitFunction kommt aus @sveltejs/kit, nicht aus $app/forms: dort ist nur
	// enhance selbst ausgeführt, der Typ liegt im Hauptmodul.
	import type { ActionResult, SubmitFunction } from '@sveltejs/kit';
	import { datumLang } from '$lib/client/utils/date';
	import { VERSAND_FEHLGESCHLAGEN } from '$lib/texte';
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
		if (form.art === 'umbenannt') return `${form.meldung} Die Zeile heisst jetzt ${form.name}.`;
		return '';
	});

	/*
		Ein Wurf in einer action, abgefangen im Rückruf unten statt an die
		Fehlergrenze weitergereicht. Eigener Zustand und nicht aus `form`
		abgeleitet: bei `result.type === 'error'` läuft update() gar nicht, `form`
		bleibt also auf dem Stand davor stehen. Der nächste Versand setzt ihn
		zurück — der neue Ausgang ist der jüngere und gewinnt.
	*/
	let versandFehler = $state('');

	/** Die Meldung am Namensfeld einer Zeile, im aufgeklappten Formular selbst. */
	const fehlerAmNeuenNamen = $derived(
		form !== null && form.art === 'fehler' && form.feld === 'neuerName' ? form.meldung : ''
	);

	/**
	 * **Welche** Zeile abgewiesen wurde — oder null.
	 *
	 * Der Wert kommt aus der Antwort des Servers und **nicht** aus einem
	 * Client-Zustand, den ein use:enhance-Rückruf füllte. Genau darin liegt der
	 * Unterschied: ohne JavaScript läuft kein Rückruf, und alles, was an ihm
	 * hinge — das aufgeklappte Formular, die verworfene Eingabe im Feld,
	 * `aria-invalid`, der Fokus —, fiele lautlos weg. `form` steht dagegen auch
	 * im vollständigen HTML-Dokument, das ein POST ohne JavaScript zurückgibt.
	 */
	const fehlerZeile = $derived(
		form !== null && form.art === 'fehler' && form.feld === 'neuerName' ? form.zeile : null
	);

	/** Die Meldung eines Fehlschlags, der an kein Feld gehört. */
	const fehlerOben = $derived(
		versandFehler !== ''
			? versandFehler
			: form !== null && form.art === 'fehler' && form.feld === null
				? form.meldung
				: ''
	);

	/** Die Meldung am Namensfeld der Aufnahme, im Formular selbst. */
	const fehlerAmNamen = $derived(
		form !== null && form.art === 'fehler' && form.feld === 'name' ? form.meldung : ''
	);

	/*
		Die Eingabe bleibt nach einem Fehlschlag stehen — je Feld die eigene.

		Die Marke wird **mitgelesen** und nicht bloss `art === 'fehler'` geprüft:
		sonst trüge ein abgewiesenes Umbenennen seinen verworfenen Namen in das
		Aufnahmefeld, und wer danach aufnimmt, nähme jemanden unter dem Namen auf,
		den er eben zu ändern versucht hat.
	*/
	const nameEingabe = $derived(
		form !== null && form.art === 'fehler' && form.feld === 'name' ? form.eingabe : ''
	);

	const neuerNameEingabe = $derived(
		form !== null && form.art === 'fehler' && form.feld === 'neuerName' ? form.eingabe : ''
	);

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
				? (ergebnis.data as { art?: unknown; zeile?: unknown } | undefined)
				: undefined;
		const art = typeof daten?.art === 'string' ? daten.art : '';

		if (art === 'aufgenommen' || art === 'neuAusgestellt') {
			einmalKasten?.focus();
			return;
		}
		if (art === 'fehler') {
			/*
				Ein abgewiesenes Umbenennen: der Fokus gehört an das Feld **dieser**
				Zeile und nicht in die obere Region. Die ist in diesem Fall leer und
				über `.live:empty` aus dem Fluss genommen — der Fokus landete im
				Nichts, und der Satz, der ihn erklärt, stünde weit weg am Feld.

				Anders als nach einem geglückten Umbenennen, das die Zeile an ihre
				neue alphabetische Stelle verschiebt: dort steht die Zeile still.

				Über die Id statt über ein bind:this je Zeile — dieselbe Bauform wie
				der Fokusgriff in monatsplan/+page.svelte. Zwanzig Bindungen für einen
				Griff wären der teurere Weg zum selben Element.
			*/
			const zeile = typeof daten?.zeile === 'number' ? daten.zeile : null;
			if (zeile !== null) {
				document.getElementById(`neuer-name-${zeile}`)?.focus();
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
				jeder Knopf dieser Seite dauerhaft disabled — Aufnehmen, Umbenennen,
				Neu ausstellen und Widerrufen zugleich. Dieselbe Absicherung wie in
				aufgabe/+page.svelte, wo sie zuerst entstand.
			*/
			try {
				/*
					Ein Wurf in der action kommt als `result.type === 'error'` zurück, und
					das gereichte update() reicht ihn an applyAction weiter — die
					Fehlergrenze ersetzte dann die Seite. Statt dessen ein Satz in der
					Live-Region, die hier ohnehin steht. Der Wurf selbst bleibt unberührt:
					er hat handleError auf dem Server längst erreicht. Einheitlich auf allen
					vier Seiten, entschieden am 2026-08-28 zu Eintrag 32 der
					zurückgestellten Arbeit.
				*/
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
		Die Live-Regionen stehen **immer** im Markup, auch leer — diese zwei hier
		und seit der Auflösung von Retro-Posten B2 auch der Satz am Namensfeld
		weiter unten.

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
			<p class="zeile__name">
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

			<p class="hinweis">
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
				maxlength={data.namensgrenze}
				value={nameEingabe}
				aria-invalid={fehlerAmNamen === '' ? undefined : 'true'}
				aria-describedby={fehlerAmNamen === '' ? undefined : 'name-fehler'}
			/>
		</div>
		<!--
			Der Satz am Namensfeld steht **immer** im Markup, auch leer, und trägt
			dieselbe Bauform wie die Live-Region oben.

			Bis hierher stand er hinter einem {#if} und ohne role und aria-live. Ein
			Element, das erst mit seinem Text in den DOM kommt, liest ein
			Screenreader in der Regel nicht vor, und mit use:enhance gibt es keine
			Navigation, die den Fehlschlag sonst ansagte: wer die Aufnahme mit
			leerem Namen abschickte, bekam sichtbar eine Kante am Feld und hörte
			nichts. Retro-Posten B2 aus Epic 1, in Epic 2 als M2 wiederholt; die
			Vorlage ist der Fehlersatz auf /monatsplan.

			`assertive` und nicht `polite`: der Satz ist die Antwort auf einen eben
			abgeschickten Versand. Dass die Seite damit mehrere assertive Regionen
			hat — diese, die obere und eine je aktiver Mitgliedszeile —, ist
			unbedenklich: die drei Marken `null`, `'name'` und `'neuerName'`
			schliessen einander aus, und unter `'neuerName'` nennt die Antwort
			zusätzlich genau eine Zeile. Es spricht nie mehr als eine.

			Das aria-describedby am Feld bleibt **bedingt**: eine Beschreibung, die
			auf ein leeres Element zeigt, sagt nichts.
		-->
		<p class="fehler live" id="name-fehler" role="alert" aria-live="assertive">{fehlerAmNamen}</p>
		<button class="button-primary" type="submit" disabled={imFlug}>Aufnehmen</button>
	</form>

	<h2 class="abschnittstitel" id="mitglieder-titel">Mitglieder</h2>
	<ul class="liste" aria-labelledby="mitglieder-titel">
		{#each data.mitglieder as mitglied (mitglied.id)}
			<li class="zeile">
				<!--
					Die Kennung dieser Zeile — und der Grund, warum sie eine hat.

					Jede Zeilen-Aktion darunter trägt eine Beschriftung, die sich über
					alle Zeilen **wortgleich** wiederholt: `Umbenennen`, `Neuer Name`,
					`Namen speichern`, `Link neu ausstellen`, `Einladung widerrufen`. Wer
					die Seite sieht, liest den Zeilennamen darüber mit; wer sie mit einer
					Elementliste durchgeht, bekam bis zum 2026-08-29 zwanzigmal dasselbe
					Wort ohne jede Auskunft, wessen Zugang gemeint ist.

					Die Aktionen zeigen darum mit aria-labelledby **auf sich selbst und
					dann hierher**: `Umbenennen Anna Meier`. Die eigene Kennung steht
					zuerst, damit die sichtbare Beschriftung der Anfang des Namens bleibt
					— wer sie per Sprache bedient, sagt, was er sieht.
				-->
				<p class="zeile__name" id="mitglied-name-{mitglied.id}">
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
				<p class="hinweis">Aufgenommen am {datumLang(mitglied.createdAt)}</p>

				{#if !mitglied.isActive}
					<!-- Beendet steht im **Text**, nicht in einer Farbe. -->
					<p class="hinweis">Zugang beendet.</p>
				{:else}
					{@const fehlerHier = fehlerAmNeuenNamen !== '' && fehlerZeile === mitglied.id}
					<!--
						Umbenennen steht an **jeder** aktiven Zeile, auch an der eigenen.

						Anders als Neuausstellen und Widerrufen ist es kein Zugangsvorgang:
						ein Name ist kein Zugang, ein Selbst-Umbenennen sperrt niemanden
						aus, und es gibt genau eine Adminperson, die es sonst für sie täte.
						Die eigene Zeile bekommt darum dieses eine Formular und weiterhin
						keinen der beiden anderen Knöpfe.

						Aufgeklappt statt in einem Dialog: bei zwanzig Zeilen ist ein
						Namensfeld die häufigste und harmloseste Korrektur der Seite, und
						der eine Dialog dieser Anwendung gehört der einen zerstörenden
						Aktion. <details> bringt das Auf und Zu ohne JavaScript mit.

						`open` hängt am Fehlschlag und nicht an einem eigenen Zustand: nur
						so steht das Formular nach einer Abweisung noch offen, mit dem
						verworfenen Namen im Feld. Wer von Hand aufklappt, kämpft nicht
						dagegen — Svelte fasst das Attribut nur an, wenn der Ausdruck
						selbst sich ändert.

						Und weil der Fehlschlag die Zeile **vom Server** nennt, wirkt das
						alles auch ohne JavaScript: das Dokument, das ein POST dann
						zurückgibt, kommt mit dem offenen Formular, der verworfenen
						Eingabe und der Kante am Feld schon fertig aus dem Server.
					-->
					<details class="zeilenform" open={fehlerHier}>
						<summary
							class="zeilenform__griff"
							id="umbenennen-griff-{mitglied.id}"
							aria-labelledby="umbenennen-griff-{mitglied.id} mitglied-name-{mitglied.id}"
						>
							Umbenennen
						</summary>
						<form
							class="zeilenform__formular"
							method="POST"
							action="?/umbenennen"
							use:enhance={versand}
						>
							<input type="hidden" name="mitgliedId" value={mitglied.id} />
							<!--
								Der Abdruck dessen, was in dieser Zeile **jetzt** steht — nicht
								der Wert des Feldes daneben.

								Er entscheidet in der where-Klausel des UPDATE, ob geschrieben
								wird: nur solange der Name noch der ist, den diese Seite gesehen
								hat. Ohne ihn drehte ein zweiter Tab, der vor einer Umbenennung
								geladen wurde, den neueren Namen still auf den älteren zurück.

								Er kommt aus `mitglied.name` und bleibt darum auch nach einer
								Abweisung richtig: der Rückruf ruft `update()` ohne
								`invalidateAll: false`, ein geglücktes Umbenennen lädt die Liste
								also neu, und die nächste Abschrift ist wieder frisch.
							-->
							<input type="hidden" name="bekannterName" value={mitglied.name} />
							<div>
								<label
									class="feld__beschriftung"
									id="neuer-name-label-{mitglied.id}"
									for="neuer-name-{mitglied.id}"
								>
									Neuer Name
								</label>
								<!--
									Der bestehende Name steht im Feld: umbenannt wird fast immer,
									um einen Tippfehler zu beheben, und ein leeres Feld hiesse,
									ihn ganz neu zu tippen. Nach einer Abweisung steht statt
									dessen die verworfene Eingabe darin.
								-->
								<input
									class="feld"
									id="neuer-name-{mitglied.id}"
									name="neuerName"
									type="text"
									autocomplete="off"
									required
									maxlength={data.namensgrenze}
									value={fehlerHier ? neuerNameEingabe : mitglied.name}
									aria-labelledby="neuer-name-label-{mitglied.id} mitglied-name-{mitglied.id}"
									aria-invalid={fehlerHier ? 'true' : undefined}
									aria-describedby={fehlerHier ? `neuer-name-fehler-${mitglied.id}` : undefined}
								/>
							</div>
							<button
								class="button-quiet"
								type="submit"
								id="namen-speichern-{mitglied.id}"
								aria-labelledby="namen-speichern-{mitglied.id} mitglied-name-{mitglied.id}"
								disabled={imFlug}
							>
								Namen speichern
							</button>
						</form>
					</details>
					<!--
						Der Satz steht **ausserhalb** des <details> und immer im Markup.

						Ausserhalb, weil ein geschlossenes <details> seinen Inhalt vor dem
						Screenreader verbirgt: eine Live-Region, die im selben Augenblick
						sichtbar wird und ihren Text bekommt, wird nicht verlässlich
						vorgelesen. Immer im Markup, aus demselben Grund wie die zwei
						Regionen oben und der Satz am Aufnahmefeld — Retro-Posten B2.

						Welche Zeile ihn trägt, sagt die **Antwort des Servers** — `zeile`
						aus `form`, gelesen über fehlerZeile. Nicht die abgeschickte
						mitgliedId aus einem use:enhance-Rückruf: den gibt es ohne
						JavaScript nicht, und der Satz stünde dann an keiner Zeile. Die
						Begründung in ganzer Länge steht bei fehlerZeile.
					-->
					<p
						class="fehler live"
						id="neuer-name-fehler-{mitglied.id}"
						role="alert"
						aria-live="assertive"
					>
						{fehlerHier ? fehlerAmNeuenNamen : ''}
					</p>
				{/if}

				{#if mitglied.isActive && mitglied.id !== data.ichId}
					<div class="knoepfe">
						<form method="POST" action="?/neuAusstellen" use:enhance={versand}>
							<input type="hidden" name="mitgliedId" value={mitglied.id} />
							<button
								class="button-quiet"
								type="submit"
								id="neu-ausstellen-{mitglied.id}"
								aria-labelledby="neu-ausstellen-{mitglied.id} mitglied-name-{mitglied.id}"
								disabled={imFlug}
							>
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
							id="widerrufen-{mitglied.id}"
							aria-labelledby="widerrufen-{mitglied.id} mitglied-name-{mitglied.id}"
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
			<div class="knoepfe">
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

	.einmal__stand,
	.aufnahme {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
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
</style>
