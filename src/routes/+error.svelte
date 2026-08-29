<script lang="ts">
	import { page } from '$app/state';
	import { KEIN_ZUGANG, NICHT_GEFUNDEN, UNERWARTETER_FEHLER } from '$lib/texte';

	/*
		Diese Hülle greift für Fehler innerhalb des Routings — etwa einen
		unbekannten Pfad bei gültiger Sitzung. Dort ist der Rahmen sichtbar, weil
		+layout.svelte darüber liegt.

		Die 403 dieser Story kommt hier nie an: sowohl der Wurf aus handle in
		src/hooks.server.ts als auch der aus der Einlöseroute verlässt SvelteKit
		über handle_fatal_error und wird mit src/error.html beantwortet. Gemessen
		an 2.70.3.

		Darum hängt die Auswahl an der **Meldung** und nicht am nackten Status 403.
		Ein `page.status === 403 ? KEIN_ZUGANG : …` zeigte bei jeder künftigen 403
		aus einer Route fälschlich "Dieser Link gilt nicht mehr", obwohl der Link
		tadellos gilt. Story 1.3 war der erwartete erste Fall dieser Art und ist es
		nicht geworden: `/verwaltung` ohne Adminrechte **leitet weiter** statt zu
		werfen, weil die Verwaltung für Nicht-Admins nicht existieren soll, nicht
		verboten sein. Die Falle bleibt trotzdem entschärft, statt auf den nächsten
		Anlass zu warten.

		Die Meldung aus dem Wurf ist immer die genauere Auskunft; die Statuszweige
		darunter greifen nur, wenn gar keine da ist — eine leere Meldung fällt auf
		einen Satz zurück und nie auf ein leeres <h1>.
	*/
	const satz = $derived.by(() => {
		const meldung = page.error?.message.trim();
		if (meldung !== undefined && meldung !== '') return meldung;
		if (page.status === 404) return NICHT_GEFUNDEN;
		if (page.status === 403) return KEIN_ZUGANG;
		return UNERWARTETER_FEHLER;
	});
</script>

<svelte:head>
	<title>{satz}</title>
</svelte:head>

<div class="abweisung">
	<h1 class="seitentitel">{satz}</h1>
	<!-- Der Status steht als Zahl da, nie als Farbe: kein Zustand hängt an einem Farbwert. -->
	<p class="fliesstext fliesstext--gedaempft">Fehler {page.status}</p>
</div>

<style>
	.abweisung {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		max-width: var(--measure);
	}
</style>
