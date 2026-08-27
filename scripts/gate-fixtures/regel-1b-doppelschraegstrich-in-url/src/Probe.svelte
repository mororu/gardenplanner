<!--
	Gegenprobe zur Zeilenkommentar-Ausblendung.

	In CSS ist `//` kein Kommentar, sondern der Anfang einer schemarelativen
	Adresse. Eine Ausblendung, die den Zeilenrest in jeder Datei leert, hat genau
	hier das Farbliteral mitgenommen und Regel 1 zum Schweigen gebracht — belegt
	in Iteration 3.

	Beide Zeilen unten tragen darum eine `//`-Adresse **und** ein Farbliteral in
	derselben Zeile. Regel 1 muss trotzdem feuern.
-->
<p class="probe">Probe</p>

<style>
	.probe {
		background-image: url(//cdn.example.com/x.png);
		color: var(--accent);
	}

	/* Adresse und Farbliteral in EINER Zeile — darauf kommt es an. */
	.probe-zwei { background-image: url(//cdn.example.com/y.png); color: #ff0000; }
</style>
