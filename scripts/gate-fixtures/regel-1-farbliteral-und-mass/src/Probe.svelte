<!--
	Fehlerprobe zu Regel 1. Fünf Verletzungen, die eine reine Hex-Suche in
	.svelte-Dateien alle durchgelassen hätte: eine Farbfunktion, ein
	CSS-Farbname, ein rohes rem-Mass, ein rohes px-Mass — und in probe.css ein
	Hex in einer .css-Datei.

	Zwei Stellen dürfen dagegen nicht fallen und belegen die Ausnahmen: das
	erlaubte 0px und der Umbruchpunkt 37.5rem in der Medienabfrage.
-->
<p class="probe">Probe</p>

<style>
	.probe {
		color: rgb(220 38 38);
		border: 0.0625rem solid rebeccapurple;
		padding: 13px;
		margin-bottom: 0px;
		background-color: var(--surface-raised);
	}

	/* Der Umbruchpunkt darf als Zahl in der Medienabfrage stehen: eine
	   Medienabfrage kann keine Custom Property lesen. */
	@media (min-width: 37.5rem) {
		.probe {
			padding: var(--gutter);
		}
	}
</style>
