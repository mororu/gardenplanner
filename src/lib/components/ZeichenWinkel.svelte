<script lang="ts">
	/*
		Der Winkel eines Aufklappgriffs — **das Aufklappzeichen**.

		Er steht seit dem 2026-09-16 an der Stelle, an der ein `<summary>` sonst
		sein Dreieck malt: rechts aussen statt links vorn. Der Befund, der ihn
		gebracht hat, steht an `.abschnitt__griff` im geteilten Stilblatt.

		**Eine Komponente und kein Schnipsel**, seit ihn zwei Routen brauchen: die
		Startseite an drei Abschnittsgriffen, `/ernte` an der Legende. Ein
		Schnipsel lebt in seiner Datei; die zweite Kopie eines Pfades mit sechs
		Zahlen darin liefe beim ersten Nachzeichnen auseinander.

		**Die Klasse kommt von aussen und hat keinen Vorgabewert.** Das ist
		Absicht: Gate-Regel 15 erlaubt einem Griff nur dann, sein Dreieck
		abzulegen, wenn im Markup desselben `<summary>` ein `aufklapp` steht. Mit
		einer Vorgabe stünde dort `<ZeichenWinkel />` und die Regel sähe nichts —
		sie liest das Markup und nicht die Vorgabewerte einer Komponente. Wer den
		Winkel ohne Klasse setzt, bekommt darum kein stilles Ergebnis, sondern
		einen roten Lauf.

		**Er zeigt nach unten und nicht nach rechts.** Der erste Entwurf zeigte zu
		nach rechts; als einzelner Haken an der rechten Kante las sich das als
		Pfeilspitze, also als Verweis auf eine andere Seite — die Ernte-Zeilen auf
		`/` tragen dort wirklich einen. Befund von Manuel, 2026-09-16. Unten und
		oben ist die Form, die jeder Aufklapper trägt, und in **beiden** Zuständen
		ein Winkel.

		Die Drehung steht nicht hier, sondern am Griff: sie hängt am `[open]` des
		`<details>`, und das sieht nur der Vorfahr.
	*/
	const { class: klasse }: { class: string } = $props();
</script>

<svg
	class="zeichen {klasse}"
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="2"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
>
	<path d="m5.5 9 6.5 7 6.5-7" />
</svg>
