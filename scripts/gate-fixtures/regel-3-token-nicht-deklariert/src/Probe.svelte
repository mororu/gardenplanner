<!--
	Fehlerprobe zu Regel 3. Beide benutzten Tokens sehen in app.html vorhanden
	aus: das eine steht in einem Kommentar, das andere in einem body-Selektor.
	Im :root-Block steht keines von beiden, also fehlt der Wert zur Laufzeit.
-->
<p class="probe">Probe</p>

<style>
	.probe {
		padding: var(--nur-im-kommentar);
		margin-top: var(--nur-in-einem-anderen-selektor);
		color: var(--accent);
	}
</style>
