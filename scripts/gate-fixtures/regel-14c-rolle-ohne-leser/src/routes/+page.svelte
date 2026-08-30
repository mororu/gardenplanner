<!--
	Fehlerprobe zu Regel 14, Form c: die geteilte Rolle `.zeile` steht im
	Stilblatt und wird von keinem Markup benutzt — die Seite ist auf ihre eigene
	Klasse zurueckgedreht. Die lokale Regel traegt bewusst einen **anderen**
	Regelkoerper, damit Form a nicht mitzaehlt.

	Erwartet ist genau ein Treffer.
-->
<p class="eigene">zurueckgedreht</p>

<style>
	.eigene {
		margin: 0;
		font-family: var(--body-font);
	}
</style>
