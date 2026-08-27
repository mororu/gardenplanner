<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';

	const { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Mehr</title>
</svelte:head>

<!--
	Mehr — die seltenen Handlungen. In diesem Stand steht darunter genau ein
	Eintrag, und nur für Adminpersonen.
-->
<div class="seite">
	<h1 class="seitentitel">Mehr</h1>
	<p class="angemeldet">Angemeldet als {data.name}</p>

	{#if data.istAdmin}
		<ul class="eintraege">
			<li>
				<!-- resolve() ist Pflicht für interne Ziele (svelte/no-navigation-without-resolve) -->
				<a class="eintrag" href={resolve('/verwaltung')}>Verwaltung</a>
			</li>
		</ul>
	{:else}
		<!-- Leerer Zustand im Ton von `Nichts offen.`: er sagt, was gilt, und
		     verrät nicht, dass es woanders mehr gäbe. -->
		<p class="leer">Nichts zu verwalten.</p>
	{/if}
</div>

<style>
	.seite {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
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

	.angemeldet {
		margin: 0;
		color: var(--ink-secondary);
		font-family: var(--body-font);
		font-size: var(--body-size);
		font-weight: var(--body-weight);
		line-height: var(--body-line);
	}

	.eintraege {
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

	.leer {
		margin: 0;
		color: var(--ink-secondary);
		font-family: var(--body-font);
		font-size: var(--body-size);
		font-weight: var(--body-weight);
		line-height: var(--body-line);
	}
</style>
