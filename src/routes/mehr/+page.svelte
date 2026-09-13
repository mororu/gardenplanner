<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';

	const { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Mehr</title>
</svelte:head>

<!--
	Mehr — die seltenen Handlungen. Seit Story 2.1 steht darunter **immer**
	mindestens ein Eintrag: `Monatsplan ablegen` gilt allen, denn die planende
	Person wechselt monatlich und ist nicht die Adminperson. Seit dem 2026-09-13
	steht `Wissen` darunter; `Verwaltung` steht für Adminpersonen zuunterst.

	Damit ist die Liste nie mehr leer, und der frühere {:else}-Zweig mit
	`Nichts zu verwalten.` ist weggefallen — ein toter Zweig, der beim nächsten
	Lesen erklärt werden müsste.

	**Die zwei Einträge zur Einzelaufgabe sind am 2026-09-13 weggefallen**, und
	das ist die Rücknahme einer Begründung, die nicht mehr stimmte. Sie standen
	hier, weil dies der Weg sein sollte, der **immer** besteht: Block 2 auf der
	Startseite führte auch dorthin, fehlte aber ganz, sobald keine Einzelaufgabe
	frei war. Seit dem 2026-09-11 ist das nicht mehr so — der Abschnitt steht auch
	leer da, und `+ Einzelaufgabe` und `Alle Einzelaufgaben` liegen ausserhalb
	seines {#if}. Damit waren die Einträge hier nicht mehr der sichere Weg,
	sondern der zweite, und ein Ziel an zwei Orten ist eine Frage mehr für jeden,
	der es sucht.

	**Die Begründung ist stehengeblieben, nachdem ihre Voraussetzung fiel** — die
	häufigste Fehlerklasse dieses Projekts, hier einmal nicht am Code, sondern am
	Kommentar. Wer den nächsten Eintrag von hier nimmt, prüft zuerst, ob sein
	anderer Weg wirklich **immer** da ist, und nicht bloss meistens.
-->
<div class="seite">
	<h1 class="seitentitel">Mehr</h1>
	<p class="fliesstext fliesstext--gedaempft">Angemeldet als {data.name}</p>

	<ul class="liste liste--getrennt">
		<li>
			<!-- resolve() ist Pflicht für interne Ziele (svelte/no-navigation-without-resolve) -->
			<a class="eintrag" href={resolve('/monatsplan')}>Monatsplan ablegen</a>
		</li>
		<li>
			<!--
				`Wissen` steht seit dem 2026-09-13 hier und nicht mehr in der Leiste:
				`Ernte` hat dort seinen Platz genommen. Der Massstab ist, wie oft man
				hingeht — ein Blatt schlägt man ein paar Mal im Jahr nach, was reif ist,
				sieht man in der Saison bei jedem Gang durch den Garten nach. Die
				Begründung in ganzer Länge steht in $lib/components/NavBar.svelte.

				Damit ist dies der **einzige** Weg zu den Blättern, und das ist der
				Unterschied zu den zwei Einträgen darüber: `Alle Einzelaufgaben` hat in
				Block 2 auf `/` einen zweiten, der nur manchmal da ist.
			-->
			<!-- resolve() ist Pflicht für interne Ziele (svelte/no-navigation-without-resolve) -->
			<a class="eintrag" href={resolve('/wissen')}>Wissen</a>
		</li>
		{#if data.istAdmin}
			<li>
				<!--
					Für Nicht-Admins fehlt dieser Eintrag **ganz**: kein ausgegrauter
					Punkt, keine Erklärung, warum er nicht anklickbar ist. Für jemanden
					ohne Adminrechte soll die Verwaltung nicht existieren, nicht verboten
					sein — und `Monatsplan ablegen` darüber verrät nicht, dass es mehr
					gäbe.
				-->
				<a class="eintrag" href={resolve('/verwaltung')}>Verwaltung</a>
			</li>
		{/if}
	</ul>
</div>

<style>
	/*
		Ein Zeilenziel, kein Knopf: es führt weiter, es tut nichts. Trefferfeld
		über die ganze Zeile, weil hier — anders als beim Kästchen einer
		Aufgabenzeile — ein Fehlgriff nichts verändert.
	*/
</style>
