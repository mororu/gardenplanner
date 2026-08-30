<!--
	Gegenprobe zu Regel 1, zusammengesetzte Bezeichner.

	Der Zerleger von Regel 1 kennt den Bindestrich nicht und zerlegt
	`white-space` in `white` und `space`. Bis zum 2026-08-30 fiel das nicht auf,
	weil keine Regel im Baum eine solche Hälfte trug; Story 4.1 brachte
	`white-space: pre-wrap` für den Freitext eines Blatts, und die Regel meldete
	`white`.

	Hier stehen fünf Fallen, die **nicht** fallen dürfen:

	  - `white-space` — ein Farbname als linke Hälfte eines Eigenschaftsnamens;
	  - `--surface-white` — ein Farbname als rechte Hälfte einer Custom Property,
	    also mit dem Trennzeichen links;
	  - `Canvas` als rechte Hälfte von `--flaeche-Canvas` — dieselbe Falle für
	    die Systemfarben, die denselben Zerleger benutzen;
	  - `--surface_white` — dieselbe Falle mit **Unterstrich** statt Bindestrich.
	    Eine Custom Property darf ihn führen, und wer Bindestriche vermeidet,
	    schreibt genau so. Die erste Fassung der Wache sah nur den Bindestrich;
	    der Review zu Story 4.1 hat die Lücke gefunden;
	  - `-webkit-tap-highlight-color` — ein Herstellerpräfix, in dem `highlight`
	    eine **echte Systemfarbe** ist. Es ist damit keine harmlose Zugabe,
	    sondern die vierte scharfe Falle: ohne die Wache meldet die Regel es.

	Ohne die Wache fallen hier fünf Verstösse — `white`, `Canvas`, `white`,
	`white` und `highlight`. Mit ihr keiner.

	Erwartet sind **null** Verstösse zu Regel 1. Die scharfe Gegenrichtung — ein
	echter Farbname als Wert — steht in regel-1-farbliteral-und-mass und in
	regel-1c-systemfarbe; hier ginge sie unter.
-->
<p class="probe">Probe</p>

<style>
	.probe {
		background-color: var(--surface-white);
		border-color: var(--flaeche-Canvas);
		outline-color: var(--surface_white);
		white-space: pre-wrap;
		-webkit-tap-highlight-color: var(--accent);
	}
</style>
