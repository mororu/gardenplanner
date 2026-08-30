<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { tick } from 'svelte';
	import type { PageProps } from './$types';
	import { VERSAND_FEHLGESCHLAGEN } from '$lib/texte';

	/*
		/wissen — die Blätter, alphabetisch, und das Formular für ein neues.

		Die Bauform ist die von /dienstplan und /verwaltung: ein aufklappbares
		<details> für das Formular, dessen `open` am Fehlschlag hängt, und eine
		Live-Region, die immer im Markup steht. Der ausführliche Grund für jedes
		dieser Stücke steht dort; hier stehen nur die Unterschiede.

		**Ein einziges Formular und keines je Zeile.** /verwaltung und /dienstplan
		tragen ihres an jeder Zeile einer Liste und brauchen darum `zeile` in der
		Antwort, um zu wissen, welches aufklappt. Hier steht es einmal unter der
		Liste: das Anlegen gehört zu keinem Blatt, sondern zur Seite. `zeile` bleibt
		in jeder Abweisung dieser Route null.
	*/

	const { data, form }: PageProps = $props();

	/*
		Ein Wurf in der action kommt als `result.type === 'error'` zurück. Der Satz
		steht in derselben Live-Region wie ein Fehlschlag der action; einheitlich
		auf allen Seiten, entschieden am 2026-08-28 zu Eintrag 32 der
		zurückgestellten Arbeit.
	*/
	let versandFehler = $state('');

	/** Die Meldung am Titelfeld. */
	const fehlerAmTitel = $derived(
		form !== null && form.art === 'fehler' && form.feld === 'titel' ? form.meldung : ''
	);

	/** Die Meldung am Textfeld. */
	const fehlerAmText = $derived(
		form !== null && form.art === 'fehler' && form.feld === 'text' ? form.meldung : ''
	);

	/** Die Meldung eines Fehlschlags, der an kein Feld gehört. */
	const fehlerOben = $derived(
		versandFehler !== ''
			? versandFehler
			: form !== null && form.art === 'fehler' && form.feld === null
				? form.meldung
				: ''
	);

	/*
		Das Formular steht offen, sobald irgendetwas abgewiesen wurde — und zwar vom
		**Server** entschieden, nicht von einem Client-Zustand. Ohne JavaScript läuft
		kein use:enhance-Rückruf, und ein zugeklapptes Formular mit einem Fehlersatz
		darunter wäre eine Meldung über etwas, das man nicht sieht.
	*/
	const abgewiesen = $derived(form !== null && form.art === 'fehler');

	/*
		Die verworfenen Eingaben, serverseitig zurückgetragen — der Titel über
		`eingabe`, der Freitext über `zweiteEingabe`. **Beide**, aus jeder
		Abweisung: ein Blatt-Freitext kann achttausend Zeichen tragen, und ihn wegen
		eines leeren Titels zu verlieren wäre der teuerste Fehlschlag dieser Seite.
		Der zweite Rückweg in ../../lib/server/abweisen.ts ist für genau diese Seite
		entstanden.
	*/
	const titelWert = $derived(form !== null && form.art === 'fehler' ? form.eingabe : '');
	const textWert = $derived(form !== null && form.art === 'fehler' ? form.zweiteEingabe : '');

	let imFlug = $state(false);
	let fehlerKasten = $state<HTMLElement | null>(null);

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
				der Knopf dauerhaft disabled. Dieselbe Absicherung wie in
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
			/*
				Ein geglücktes Anlegen führt fort — die action leitet auf das frische
				Blatt weiter, und ein Fokus auf ein Element dieser Seite wäre einer auf
				etwas, das es gleich nicht mehr gibt. Zu setzen bleibt der Fokus darum
				nur im Fehlerfall, und zwar an das Feld, an dem der Satz steht.
			*/
			if (versandFehler !== '') {
				fehlerKasten?.focus();
				return;
			}
			if (result.type !== 'failure') return;
			const daten = result.data as { feld?: unknown } | undefined;
			const feld = typeof daten?.feld === 'string' ? daten.feld : null;
			if (feld === 'titel' || feld === 'text') {
				document.getElementById(`neu-${feld}`)?.focus();
				return;
			}
			fehlerKasten?.focus();
		};
	};
</script>

<svelte:head>
	<title>Wissen</title>
</svelte:head>

<div class="seite">
	<h1 class="seitentitel">Wissen</h1>

	<!--
		Die Live-Region des Seitenkopfs. Sie steht **immer** im Markup und ist über
		`.live:empty` aus dem Fluss genommen, solange sie leer ist — Retro-Posten
		B2: eine Region, die im selben Augenblick entsteht und ihren Text bekommt,
		wird nicht verlässlich vorgelesen.

		Nur eine, anders als auf /dienstplan: die Erfolgsmeldung steht auf dem
		angelegten Blatt, weil die action dorthin weiterleitet.
	-->
	<p class="fehler live" bind:this={fehlerKasten} role="alert" aria-live="assertive" tabindex="-1">
		{fehlerOben}
	</p>

	<p class="hinweis">
		Ein Blatt gilt für den ganzen Garten, nicht für ein Beet. Wer eines ändert, ändert es für alle —
		es gibt keine Versionen und keinen Autor.
	</p>

	{#if data.blaetter.length === 0}
		<!-- Der leere Zustand sagt, was gilt, und der Weg heraus steht darunter. -->
		<p class="leer">Noch nichts aufgeschrieben.</p>
	{:else}
		<!--
			Die Liste trägt einen zugänglichen Namen über die Marke — sonst heisst sie
			„Liste mit 7 Einträgen". Dieselbe Bauform wie `Offen` auf `/` und
			`Alle Einzelaufgaben` auf /einzelaufgaben.
		-->
		<h2 class="marke" id="blaetter-marke">Blätter</h2>
		<ul class="liste liste--getrennt" aria-labelledby="blaetter-marke">
			{#each data.blaetter as blatt (blatt.id)}
				<li class="karte karte--eng">
					<!--
						Der Titel **ist** der Link, und der Link füllt die Karte: das
						Trefferfeld ist damit die ganze Zeile und nicht ein Wort darin.
						`.zeile__text` bringt den Umbruch für getippten Text aus dem
						geteilten Stilblatt mit — zweihundert Zeichen ohne Leerzeichen
						liefen bei 375px sonst aus der Box.

						resolve() ist Pflicht für interne Ziele
						(svelte/no-navigation-without-resolve); ein dynamisches Segment
						reist als zweites Argument mit, nicht als zusammengebaute
						Zeichenkette.
					-->
					<a class="blattlink zeile__text" href={resolve('/wissen/[id]', { id: String(blatt.id) })}>
						{blatt.titel}
					</a>
				</li>
			{/each}
		</ul>
	{/if}

	<!--
		Das Anlegen. Ein <details> und keine eigene Seite: Nachschlagen und
		Ergänzen sind dieselbe Bewegung, und <details> bringt das Auf und Zu ohne
		JavaScript mit. Die Bauform ist die geteilte `.zeilenform` aus Epic 3 —
		dritte Wurfstelle nach /verwaltung und /dienstplan.

		Das <form> trägt ein **literales** action="?/anlegen": Gate-Regel 11 leitet
		die Route aus dem Verzeichnis der Datei ab und hält den Namen gegen die
		actions der Nachbardatei. Ein dynamisches action={…} machte sie blind.
	-->
	<details class="zeilenform" open={abgewiesen}>
		<summary class="zeilenform__griff">Neues Blatt</summary>
		<form class="zeilenform__formular" method="POST" action="?/anlegen" use:enhance={versand}>
			<div>
				<label class="feld__beschriftung" for="neu-titel">Titel</label>
				<input
					class="feld"
					id="neu-titel"
					name="titel"
					type="text"
					required
					maxlength={data.titelGrenze}
					value={titelWert}
					aria-invalid={fehlerAmTitel !== '' ? 'true' : undefined}
					aria-describedby={fehlerAmTitel !== '' ? 'neu-titel-fehler' : undefined}
				/>
				<!--
					Der Satz steht ausserhalb des Feldes und immer im Markup, mit
					`.live:empty` aus dem Fluss, solange er leer ist — dieselbe Bauform
					wie an jeder anderen Feldmeldung des Produkts.
				-->
				<p class="fehler live" id="neu-titel-fehler" role="alert" aria-live="assertive">
					{fehlerAmTitel}
				</p>
			</div>
			<div>
				<label class="feld__beschriftung" for="neu-text">Text</label>
				<!--
					`.feld textfeld` — die Mindesthöhe und das senkrechte Ziehen kommen
					seit dieser Story aus dem geteilten Stilblatt und nicht mehr lokal aus
					/monatsplan.

					Kein Editor und keine Werkzeugleiste: ein Textfeld, Absätze und
					Zeilenumbrüche, sonst nichts. Was hier steht, steht auf dem Blatt.

					Der führende Umbruch vor dem Wert ist Pflicht: ein HTML-Parser verwirft
					den ersten Zeilenumbruch direkt nach dem Starttag, und ein
					zurückgetragener Text, der mit einer Leerzeile beginnt, käme sonst um
					genau diese Zeile gekürzt zurück. Die Begründung in ganzer Länge steht
					in der Nachbarseite.
				-->
				<textarea
					class="feld textfeld"
					id="neu-text"
					name="text"
					required
					maxlength={data.textGrenze}
					aria-invalid={fehlerAmText !== '' ? 'true' : undefined}
					aria-describedby={fehlerAmText !== '' ? 'neu-text-fehler' : undefined}
					>{'\n' + textWert}</textarea
				>
				<p class="fehler live" id="neu-text-fehler" role="alert" aria-live="assertive">
					{fehlerAmText}
				</p>
			</div>
			<button class="button-quiet" type="submit" disabled={imFlug}>Anlegen</button>
		</form>
	</details>
</div>

<style>
	/*
		Der Titel als Zeilenziel. Die Karte bringt Fläche, Kante und Innenabstand
		mit; hier bleibt, was den Link zum Trefferfeld über die volle Breite macht.

		`display: block` und `min-height` statt eines Innenabstands: die Karte hat
		ihren schon, und zwei Abstände übereinander rissen die Zeile auseinander.
		Die 44px sind der Boden aus UX-DR13 — mit Handschuhen im Beet trifft man
		keine Textzeile.

		Ohne Unterstreichung, weil die ganze Zeile ein Ziel ist und eine Karte
		voller unterstrichener Titel wie ein Formular aussähe; die Akzentfarbe und
		die action-Rolle sagen, dass hier etwas passiert.
	*/
	.blattlink {
		display: block;
		align-content: center;
		min-height: var(--touch);
		color: var(--accent);
		font-family: var(--action-font);
		font-size: var(--action-size);
		font-weight: var(--action-weight);
		line-height: var(--action-line);
		text-decoration: none;
	}
</style>
