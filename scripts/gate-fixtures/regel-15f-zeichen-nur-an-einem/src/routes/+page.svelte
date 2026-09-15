<!--
	Fehlerprobe zu Regel 15: zwei Griffe teilen sich eine Klasse, aber nur einer
	traegt ein eigenes Zeichen. Eine CSS-Regel trifft beide — der zweite stuende
	ohne jede Anzeige da.

	Erwartet ist ein Treffer.
-->
<div class="karte">
	<details>
		<summary class="griff">
			<span>Mit Zeichen</span>
			<svg class="aufklapp" viewBox="0 0 24 24" aria-hidden="true">
				<path d="m9 5.5 7 6.5-7 6.5" />
			</svg>
		</summary>
		<p>Inhalt</p>
	</details>
	<details>
		<summary class="griff">Ohne Zeichen</summary>
		<p>Inhalt</p>
	</details>
</div>
