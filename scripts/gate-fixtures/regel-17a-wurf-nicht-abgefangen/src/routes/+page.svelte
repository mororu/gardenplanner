<!--
	Fehlerprobe zu Regel 17: der Rueckruf laeuft, faengt aber result.type
	=== 'error' nicht ab. Ein Wurf in der action ersetzt die Seite dann durch
	die Fehlergrenze.

	Erwartet ist ein Treffer.
-->
<script lang="ts">
	import { VERSAND_FEHLGESCHLAGEN } from '$lib/texte';
	let versandFehler = $state('');
	const versand = () => {
		return async ({ update, result }) => {
			await update();
		};
	};
</script>

<p class="zeile">{versandFehler}</p>
