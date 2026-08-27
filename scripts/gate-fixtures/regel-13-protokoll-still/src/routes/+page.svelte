<!--
	Gegenprobe zu Regel 11: alles, was **nicht** fallen darf.

	  - drei action="?/…", alle drei serverseitig vorhanden
	  - ein Formular **ohne** action-Attribut: das ist die Standard-action und
	    braucht keinen Namen
	  - ein action mit einer fremden Adresse: keine SvelteKit-Aktion, also nicht
	    Gegenstand dieser Regel
	  - ein `action="?/gibtsNicht"` in einem **Kommentar**, siehe unten

	Erwartet sind null Regel-11-Treffer.
-->
<!-- Ein verschriebener Name in einem Kommentar ist kein Markup:
     action="?/gibtsNichtImKommentar" darf nicht fallen. -->
<form method="POST" action="?/aufnehmen">
	<input name="name" type="text" />
	<button type="submit">Aufnehmen</button>
</form>

<form method="POST" action="?/neuAusstellen">
	<input name="mitgliedId" type="hidden" value="1" />
	<button type="submit">Link neu ausstellen</button>
</form>

<form method="POST" action="?/widerrufen">
	<input name="mitgliedId" type="hidden" value="1" />
	<button type="submit">Einladung widerrufen</button>
</form>

<form method="POST">
	<button type="submit">Standard-action ohne Namen</button>
</form>

<form method="POST" action="https://beispiel.example.ch/formular">
	<button type="submit">Fremdes Ziel</button>
</form>

<style>
	form {
		padding: var(--gutter);
		color: var(--ink-primary);
	}
</style>
