<script lang="ts">
	import { VERSAND_FEHLGESCHLAGEN } from '$lib/texte';
	let versandFehler = $state('');
	const versand = () => {
		return async ({ update, result }: { update: () => Promise<void> }) => {
			await update();
		};
	};
</script>

<p class="zeile">{versandFehler}{VERSAND_FEHLGESCHLAGEN}</p>
