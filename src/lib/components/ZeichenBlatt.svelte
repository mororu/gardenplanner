<script lang="ts">
	/*
		Das Blatt der Wellnessbehandlung.

		**Eine Komponente und kein Schnipsel**, seit es zwei Leser hat: der Eintrag
		auf /mehr und die Zeile mit Pfeil auf `/`. Als Ausschnitt lebte es in
		seiner Datei; die zweite Kopie eines Pfades mit zwölf Zahlen darin liefe
		beim ersten Nachzeichnen auseinander. Dieselbe Begründung wie an
		./ZeichenStift.svelte und ./ZeichenWinkel.svelte — und derselbe Weg: es hat
		am 2026-09-19 als Ausschnitt auf /mehr begonnen und ist hierher gezogen,
		als der zweite Ort dazukam.

		**Es trägt keine Aussage.** Die steht als Wort daneben, wie DESIGN.md es
		verlangt: bei zwanzig Leuten mit sehr unterschiedlicher Vertrautheit ist
		ein Wort verlässlicher als ein Piktogramm. Was das Zeichen leistet, ist das
		Wiederfinden — auf /mehr unter fünf gebauten Dingen (Kalenderblatt, Buch,
		Dokument, Kiste, Schlüssel) ist es das einzige organische, auf `/` neben
		Kanne und Korb das einzige, das keine Gerätschaft ist.

		**Die Auswahl ist noch nicht von Manuel abgenommen** (Stand 2026-09-20).
		Verworfen sind ein Tropfen und eine Giesskanne: beide lesen sich als
		Wasser, und Wasser ist in diesem Produkt der Tränkeplan.

		**Die Klasse kommt von aussen und hat keinen Vorgabewert**, wie bei den
		zwei Nachbarn: beide Leser setzen heute `zeichen--gross`, und eine Vorgabe
		verstellte den Blick darauf, dass das eine Entscheidung des Ortes ist und
		keine des Zeichens.

		Derselbe Zeichensatz wie an den anderen: 24er-Raster, Strich in
		currentColor, keine Füllung, `aria-hidden`.
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
	<path d="M11 20.5A7 7 0 0 1 9.8 6.6C15.5 5.5 17 5 19 2.5c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10Z" />
	<path d="M2.5 21.5c0-3 1.9-5.4 5.1-6 2.4-.5 4.9-2 5.9-3" />
</svg>
