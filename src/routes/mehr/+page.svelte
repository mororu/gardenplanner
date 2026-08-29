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
	Person wechselt monatlich und ist nicht die Adminperson. Seit Story 3.2 kommen
	die zwei Einträge zur Einzelaufgabe dazu; `Verwaltung` steht für
	Adminpersonen darunter.

	Damit ist die Liste nie mehr leer, und der frühere {:else}-Zweig mit
	`Nichts zu verwalten.` ist weggefallen — ein toter Zweig, der beim nächsten
	Lesen erklärt werden müsste.

	**Zwei Einträge und nicht einer**, obwohl beide dieselbe Sache betreffen:
	`Einzelaufgabe ausschreiben` ist eine Handlung, `Übernommene Einzelaufgaben`
	ist eine Auskunft. Der zweite ist zugleich der Weg, der **immer** besteht —
	Block 2 auf der Startseite führt auch dorthin, fehlt aber ganz, sobald nichts
	frei ist. Ohne ihn wäre die Seite an manchen Tagen unerreichbar.
-->
<div class="seite">
	<h1 class="seitentitel">Mehr</h1>
	<p class="angemeldet">Angemeldet als {data.name}</p>

	<ul class="eintraege">
		<li>
			<!-- resolve() ist Pflicht für interne Ziele (svelte/no-navigation-without-resolve) -->
			<a class="eintrag" href={resolve('/monatsplan')}>Monatsplan ablegen</a>
		</li>
		<li>
			<!-- resolve() ist Pflicht für interne Ziele (svelte/no-navigation-without-resolve) -->
			<a class="eintrag" href={resolve('/einzelaufgabe')}>Einzelaufgabe ausschreiben</a>
		</li>
		<li>
			<!-- resolve() ist Pflicht für interne Ziele (svelte/no-navigation-without-resolve) -->
			<a class="eintrag" href={resolve('/einzelaufgaben')}>Übernommene Einzelaufgaben</a>
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
	.angemeldet {
		margin: 0;
		color: var(--ink-secondary);
		font-family: var(--body-font);
		font-size: var(--body-size);
		font-weight: var(--body-weight);
		line-height: var(--body-line);
	}

	.eintraege {
		display: flex;
		flex-direction: column;
		/* Abstand zwischen Geschwistern über gap, nie über Aussenabstände */
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	/*
		Ein Zeilenziel, kein Knopf: es führt weiter, es tut nichts. Trefferfeld
		über die ganze Zeile, weil hier — anders als beim Kästchen einer
		Aufgabenzeile — ein Fehlgriff nichts verändert.
	*/
	.eintrag {
		display: flex;
		align-items: center;
		min-height: var(--touch);
		padding: var(--space-2) var(--space-3);
		border: var(--border-hairline) solid var(--hairline);
		border-radius: var(--radius-md);
		background-color: var(--surface-raised);
		color: var(--accent);
		font-family: var(--action-font);
		font-size: var(--action-size);
		font-weight: var(--action-weight);
		line-height: var(--action-line);
		text-decoration: none;
	}
</style>
