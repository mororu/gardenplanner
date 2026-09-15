<script lang="ts">
	import { resolve } from '$app/paths';
	import { datumLang } from '$lib/client/utils/date';
	import type { PageProps } from './$types';

	const { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Terminierte Aufgaben</title>
</svelte:head>

<!--
	/einzelaufgaben — alle, freie wie übernommene.

	**Keine Aktion auf dieser Seite.** Übernommen wird auf `/`, wo die freien
	Einzelaufgaben ohnehin stehen; die Begründung steht in der Nachbardatei. Diese
	Seite beantwortet die eine Frage, die `/` bewusst nicht beantwortet: ob und
	von wem etwas übernommen ist. Sie vertieft — sie informiert nicht exklusiv und
	sie handelt nicht.
-->
<div class="seite">
	<h1 class="seitentitel">Terminierte Aufgaben</h1>

	<!--
		Der Satz nennt den Weg zur Handlung **und ist er**: übernommen wird auf der
		Startseite, und wer hier eine freie Zeile sieht, soll nicht raten müssen,
		wohin. Ohne den Link wäre eine freie Einzelaufgabe auf dieser Seite eine
		Sackgasse — sichtbar, aber unerreichbar.

		resolve() ist Pflicht für interne Ziele (svelte/no-navigation-without-resolve).
	-->
	<p class="hinweis">
		Wer übernimmt, sagt vor allen zu. Freie stehen mit ihrem Knopf auf der
		<a href={resolve('/')}>Startseite</a>.
	</p>

	{#if data.einzelaufgaben.length === 0}
		<!-- Der leere Zustand sagt, was gilt, und nennt den Weg heraus. -->
		<p class="leer">Nichts ausgeschrieben.</p>
	{:else}
		<!--
			Die Liste trägt einen zugänglichen Namen über die Marke — sonst heisst sie
			„Liste mit 7 Einträgen". Dieselbe Bauform wie `Offen` und
			`Zum Übernehmen` auf `/`; die Marke steht sichtbar da und ist keine
			verborgene Beschriftung.
		-->
		<h2 class="marke" id="alle-marke">Alle terminierten Aufgaben</h2>
		<ul class="liste liste--getrennt" aria-labelledby="alle-marke">
			{#each data.einzelaufgaben as aufgabe (aufgabe.id)}
				<!--
					Die Fläche wechselt mit demselben Ausdruck, der weiter unten das Wort
					wählt — eine Bedingung, nicht zwei. Zwei Ausdrücke für denselben
					Zustand sind die Stelle, an der Farbe und Wort auseinanderlaufen.
				-->
				<li class="karte karte--eng" class:karte--offen={aufgabe.uebernehmer === null}>
					<!--
						`.zeile__text` bringt den Umbruch für getippten Text aus dem
						geteilten Stilblatt mit: zweihundert Zeichen ohne Leerzeichen
						liefen bei 375px sonst aus der Box.
					-->
					<p class="fliesstext zeile__text">{aufgabe.titel}</p>
					<p class="hinweis hinweis--ziffern">{datumLang(aufgabe.terminAt)}</p>
					<!--
						**Der Name trägt das Wort, nicht die Farbe.** `noch niemand` steht in
						der Nebentext-Rolle und ausdrücklich nicht in `--warn`: jenes Token
						sagt „diese Dienstwoche ist unbesetzt und wartet auf die Verwaltung".
						Eine freie Einzelaufgabe wartet auf niemand Bestimmten und ist kein
						Missstand — sie ist der Normalzustand direkt nach dem Ausschreiben.
						Eine Warnfarbe daran hiesse, dass etwas schiefliegt.

						**Seit dem 2026-09-11 trägt die Karte zusätzlich eine getönte Fläche**
						(`--surface-open`). Das ändert an diesem Absatz nichts: die Tönung ist
						auch keine Warnfarbe, sondern ein ruhiger Grünstich, und das Wort
						bleibt der Träger. Die Fläche macht die freie Zeile in einer langen
						Liste auffindbar, ohne sie anzuklagen.
					-->
					{#if aufgabe.uebernehmer === null}
						<p class="hinweis">noch niemand</p>
					{:else}
						<p class="fliesstext">{aufgabe.uebernehmer}</p>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</div>
