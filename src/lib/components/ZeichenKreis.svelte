<script lang="ts">
	/*
		Der Kreis aus zwei Pfeilen — **das Zeichen der Dauerernte**.

		Er sagt `das kommt wieder`: eine Zeile mit diesem Zeichen ist nicht einmal
		zu ernten, sondern alle zwei bis drei Tage durchzugehen.

		**Eine Komponente und kein Schnipsel**, seit ihn zwei Routen brauchen: die
		Startseite an der Erntezeile, `/ernte` in der Legende. Auf der Startseite
		steht er seit dem 2026-09-16 **allein** — das Wort daneben ist nach
		`.nur-vorgelesen` gewandert (Entscheid Manuel). Damit trägt er dort eine
		Aussage, die sonst niemand malt, und genau deshalb erklärt ihn die Legende
		auf `/ernte`.

		`aria-hidden` wie an jedem Zeichen dieses Produkts: das Wort steht daneben
		und trägt die Aussage allein — gemalt oder nur vorgelesen.
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
	<path d="M4 9.5A7.5 7.5 0 0 1 17 5l2.5 2.5" />
	<path d="M19.5 3.5v4h-4" />
	<path d="M20 14.5A7.5 7.5 0 0 1 7 19l-2.5-2.5" />
	<path d="M4.5 20.5v-4h4" />
</svg>
