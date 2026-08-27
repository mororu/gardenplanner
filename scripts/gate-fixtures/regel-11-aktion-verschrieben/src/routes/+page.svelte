<!--
	Fehlerprobe zu Regel 11: **ein** action="?/…" ohne gleichnamigen Eintrag.

	Der erste Knopf trifft `aufnehmen` und ist in Ordnung; er steht hier, damit
	die Probe nicht bloss aus dem Fehler besteht und die Zahl etwas bedeutet.
	Der zweite ruft `neuAusstellen`, das serverseitig nicht existiert: SvelteKit
	antwortet mit 404, der Knopf tut nichts, und check, eslint und smoke bleiben
	alle grün.

	Erwartet ist 1 Regel-11-Treffer.
-->
<form method="POST" action="?/aufnehmen">
	<input name="name" type="text" />
	<button type="submit">Aufnehmen</button>
</form>

<form method="POST" action="?/neuAusstellen">
	<input name="mitgliedId" type="hidden" value="1" />
	<button type="submit">Link neu ausstellen</button>
</form>

<style>
	form {
		padding: var(--gutter);
		color: var(--ink-primary);
	}
</style>
