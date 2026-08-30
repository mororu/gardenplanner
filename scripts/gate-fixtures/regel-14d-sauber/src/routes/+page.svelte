<!--
	Gegenprobe zu Regel 14: die geteilte Rolle wird benutzt, die lokale Regel
	traegt einen anderen Regelkoerper, und im Blatt steht kein Zwilling.

	Dazu zwei Fallen, die **nicht** fallen duerfen: eine lokale Regel mit nur
	einer Deklaration (unter der Zaehlschwelle) und eine Klasse, die ueber die
	Svelte-Direktive class: benutzt wird statt ueber ein Attribut.

	Erwartet sind null Treffer.
-->
<p class="zeile">geteilt</p>
<p class="eigene" class:hervor={true}>eigen</p>

<style>
	.eigene {
		margin: 0;
		font-family: var(--body-font);
	}

	.hervor {
		color: var(--accent);
	}
</style>
