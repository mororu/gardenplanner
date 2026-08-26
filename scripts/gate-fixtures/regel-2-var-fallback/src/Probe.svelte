<!--
	Fehlerprobe zu Regel 2. Der Fallback steht genau so, wie Prettier eine zu
	lange var()-Deklaration umbricht: `var(` , Tokenname und Komma landen auf
	verschiedenen Zeilen. Zeilenweise gelesen findet kein Muster diesen
	Fallback — deshalb arbeitet das Tor über den gesamten Dateitext.
	Diese Datei ist in .prettierignore, damit Prettier den Umbruch nicht
	wieder zusammenzieht und die Probe zerstört.
-->
<p class="probe">Probe</p>

<style>
	.probe {
		background-color: var(
			--ein-token-mit-einem-absichtlich-sehr-langen-namen,
			var(--surface-raised)
		);
		padding: var(--gutter);
	}
</style>
