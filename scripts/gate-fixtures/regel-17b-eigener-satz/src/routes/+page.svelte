<script lang="ts">
	import { VERSAND_FEHLGESCHLAGEN } from '$lib/texte';
	let versandFehler = $state('');
	const versand = () => {
		return async ({ update, result }) => {
			if (result.type === 'error') {
				versandFehler = 'Da ging etwas schief.';
				return;
			}
			await update();
		};
	};
</script>

<p class="zeile">{versandFehler}{VERSAND_FEHLGESCHLAGEN}</p>
