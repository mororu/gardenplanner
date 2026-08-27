<script lang="ts">
	import type { Snippet } from 'svelte';
	import '$lib/styles/fonts.css';
	// Knöpfe und Felder global, weil die Stories 1.4 und 1.5 dieselben brauchen.
	import '$lib/styles/bedienelemente.css';
	// Vorgeladen werden genau die zwei Schnitte, die die Oberfläche tatsächlich
	// benutzt: Figtree latin für Titel und Aktionen, Inter latin für alles
	// Gelesene. latin-ext springt nur für seltene Zeichen ein und bleibt
	// darum aussen vor. Die Pfade kommen aus den Paketen, nicht von einem CDN.
	import figtreeLatin from '@fontsource-variable/figtree/files/figtree-latin-wght-normal.woff2?url';
	import interLatin from '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url';
	import NavBar from '$lib/components/NavBar.svelte';
	import TitleBar from '$lib/components/TitleBar.svelte';

	const { children }: { children: Snippet } = $props();
</script>

<svelte:head>
	<link rel="preload" href={figtreeLatin} as="font" type="font/woff2" crossorigin="anonymous" />
	<link rel="preload" href={interLatin} as="font" type="font/woff2" crossorigin="anonymous" />
</svelte:head>

<!--
	Reihenfolge im DOM und damit in der Tastaturreihenfolge: Skip-Link,
	Titelleiste, Navigation, Inhalt.

	Ab 37.5rem steht die Navigation im Fluss oben; dort deckt sich die
	Sichtreihenfolge mit dem DOM. Unter 37.5rem weichen die beiden ab: die
	Leiste liegt fest am unteren Rand und erscheint deshalb sichtbar zuletzt,
	obwohl sie im DOM an zweiter Stelle steht. Das ist bewusst so und der Grund
	für den Skip-Link — mit ihm kommt man in einem Schritt am Rahmen vorbei zum
	Inhalt, ohne die vier Navigationsziele durchzutabben. Kein order, kein
	grid-area: auf einem fixierten Element wäre order wirkungslos.
-->
<a class="skip" href="#inhalt">Zum Inhalt</a>

<TitleBar />
<NavBar />

<main id="inhalt" class="inhalt" tabindex="-1">
	{@render children()}
</main>

<style>
	/*
		Der Skip-Link liegt bis zum Fokus über dem oberen Rand des Fensters und
		fährt beim Fokus herunter. Er wird nicht mit display: none versteckt —
		sonst fände ihn die Tastatur nie.
	*/
	.skip {
		position: absolute;
		inset-block-start: 0;
		inset-inline-start: var(--gutter);
		z-index: 20;
		transform: translateY(-100%);
		/* Auch der Skip-Link ist ein Trefferfeld und hält die 44px */
		display: inline-flex;
		align-items: center;
		min-height: var(--touch);
		padding: var(--space-2) var(--space-3);
		border: var(--border-hairline) solid var(--hairline);
		border-radius: 0 0 var(--radius-md) var(--radius-md);
		background-color: var(--surface-raised);
		color: var(--accent);
		font-family: var(--action-font);
		font-size: var(--action-size);
		font-weight: var(--action-weight);
		line-height: var(--action-line);
		text-decoration: none;
	}

	.skip:focus {
		transform: translateY(0);
	}

	.inhalt {
		/* Eine Spalte, höchstens 37.5rem, zentriert */
		max-width: var(--measure);
		margin: 0 auto;
		/*
			Rhythmus: Titelleiste · 24px · Seitentitel. Unten bleibt der Platz der
			fest liegenden Leiste frei, plus 32px Abstand und die Sicherheitszone
			des Geräts — sonst deckt die Leiste die letzte Zeile ab.
		*/
		padding: var(--space-5) var(--gutter)
			calc(var(--space-6) + var(--navbar-height) + env(safe-area-inset-bottom, 0px));
	}

	/* Ein Umbruchpunkt, und nur dieser. */
	@media (min-width: 37.5rem) {
		.inhalt {
			/* Die Leiste steht oben im Fluss, unten muss nichts freibleiben */
			padding-bottom: var(--space-6);
		}
	}
</style>
