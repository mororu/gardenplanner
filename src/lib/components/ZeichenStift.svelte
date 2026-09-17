<script lang="ts">
	/*
		Der Stift eines Ändern-Griffs — **das Aufklappzeichen**.

		Er steht seit dem 2026-09-15 an der Stelle, an der ein `<summary>` sonst das
		Wort `Ändern` trüge: jenes kostete 59px Zeilenbreite, und die fehlten dem
		Aufgabentext — gemessen brachen drei von fünf Zeilen dadurch um, die Liste
		wuchs um 27 Prozent. Seit dem 2026-09-16 steht er **allein**, ohne das
		Dreieck davor (Befund von Manuel: zwei Aufforderungen an derselben Stelle,
		und der Stift sagt genauer, was passiert).

		**Der Einwand ist benannt und nicht übergangen.** DESIGN.md begründet
		`Keine Symbole ohne Text` damit, dass bei zwanzig Leuten mit sehr
		unterschiedlicher Vertrautheit ein Wort verlässlicher ist als ein
		Piktogramm. Getragen wird die Ausnahme davon, dass das Wort **nicht weg
		ist**, sondern nur nicht gemalt wird: neben dem Zeichen steht es in
		`.nur-vorgelesen` für Screenreader und für die Tastaturausgabe. Diese
		Komponente bringt es **nicht** mit — sie malt, und wer sie setzt, schreibt
		das Wort daneben, das an seiner Stelle passt (`Ändern`, `Ergänzen`).

		**Eine Komponente und kein Schnipsel**, seit ihn zwei Routen brauchen: die
		Startseite an jeder Aufgabenzeile, `/sitzungen` an jedem Traktandum. Ein
		Schnipsel lebt in seiner Datei; die zweite Kopie eines Pfades mit acht
		Zahlen darin liefe beim ersten Nachzeichnen auseinander. Dieselbe
		Begründung wie an ./ZeichenWinkel.svelte.

		**Die Klasse kommt von aussen und hat keinen Vorgabewert** — aus demselben
		Grund wie dort: Gate-Regel 15 erlaubt einem Griff nur dann, sein Dreieck
		abzulegen, wenn im Markup desselben `<summary>` ein `aufklapp` steht. Mit
		einer Vorgabe stünde dort `<ZeichenStift />` und die Regel sähe nichts.

		Derselbe Zeichensatz wie am Winkel und am Übernehmen-Knopf: 24er-Raster,
		Strich in currentColor, keine Füllung, `aria-hidden`.
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
	<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" />
	<path d="M14.5 5.5l4 4" />
</svg>
