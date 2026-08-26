<!--
	Titelleiste: volle Breite, akzentgefüllt, nur der Produktname.
	Keine Knöpfe, keine Navigation, kein Konto-Menü. Klebt nicht, scrollt mit weg.
-->
<header class="title-bar">
	<span class="title-bar__name">Gemeinschaftsgarten</span>
</header>

<style>
	.title-bar {
		display: flex;
		padding: var(--space-3) var(--gutter);
		background-color: var(--accent);
		color: var(--accent-ink);
	}

	.title-bar__name {
		/* Auf dieselbe Spaltenbreite wie der Inhalt ausgerichtet */
		width: 100%;
		max-width: var(--measure);
		margin-inline: auto;
		font-family: var(--section-font);
		font-size: var(--section-size);
		font-weight: var(--section-weight);
		line-height: var(--section-line);
		letter-spacing: var(--section-tracking);
	}
</style>
