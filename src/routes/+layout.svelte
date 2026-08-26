<script lang="ts">
	import type { Snippet } from 'svelte';
	import '$lib/styles/fonts.css';
	import NavBar from '$lib/components/NavBar.svelte';
	import TitleBar from '$lib/components/TitleBar.svelte';

	const { children }: { children: Snippet } = $props();
</script>

<!--
	Reihenfolge im DOM: Titelleiste, Navigation, Inhalt. Ab 37.5rem steht die
	Navigation im Fluss oben und deckt sich damit mit der Sichtreihenfolge;
	darunter liegt sie fest am unteren Rand und ist aus dem Fluss genommen.
	Kein order, kein grid-area — die Tastaturreihenfolge bleibt die Leserichtung.
-->
<TitleBar />
<NavBar />

<main class="inhalt">
	{@render children()}
</main>

<style>
	.inhalt {
		/* Eine Spalte, höchstens 37.5rem, zentriert */
		max-width: var(--measure);
		margin: 0 auto;
		/* Rhythmus: Titelleiste · 24px · Seitentitel, unten 32px vor der Leiste */
		padding: var(--space-5) var(--gutter)
			calc(var(--space-6) + var(--touch) + env(safe-area-inset-bottom, 0px));
	}

	@media (min-width: 37.5rem) {
		.inhalt {
			/* Die Leiste steht oben im Fluss, unten muss nichts freibleiben */
			padding-bottom: var(--space-6);
		}
	}
</style>
