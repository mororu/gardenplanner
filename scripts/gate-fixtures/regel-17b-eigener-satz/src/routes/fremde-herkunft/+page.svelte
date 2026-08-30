<!--
	Die zweite Haelfte desselben Verstosses: der Rueckruf ist tadellos, aber der
	Satz kommt aus einer eigenen Datei statt aus dem geteilten Modul. Ein erster
	Entwurf des Umzugs liess die Herkunft weg und haette das durchgelassen.
-->
<script lang="ts">
	import { VERSAND_FEHLGESCHLAGEN } from './eigene-texte';
	let versandFehler = $state('');
	const versand = () => {
		return async ({ update, result }) => {
			if (result.type === 'error') {
				versandFehler = VERSAND_FEHLGESCHLAGEN;
				return;
			}
			await update();
		};
	};
</script>

<p class="zeile">{versandFehler}</p>
