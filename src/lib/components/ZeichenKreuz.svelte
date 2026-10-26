<script lang="ts">
	/*
		Das X — **das Zeichen fürs Abernten** auf /ernte.

		Es steht seit dem 2026-10-26 an jeder Karte der Ernteliste an der Stelle
		des Knopfs `Abgeerntet` (spec-ernte-nach-beet.md): die Karte ist einzeilig,
		und das Wort brauchte dort mehr Platz als Kultur, Name und Datum zusammen.
		Und in der Legende, die es erklärt.

		`aria-hidden` wie an jedem Zeichen dieses Produkts: der Knopf trägt seinen
		Namen selbst (`Abgeerntet {Kultur}, {Ort}`), die Legende das Wort daneben.

		`currentColor`, damit es die Farbe des Knopfs trägt — `--danger` an der
		Karte, gedämpft im gesperrten Zustand.
	*/
	const { class: klasse = '' }: { class?: string } = $props();
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
	<path d="M6 6l12 12" />
	<path d="M18 6L6 18" />
</svg>
