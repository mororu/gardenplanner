<svelte:head>
	<title>Aufgaben — Gemeinschaftsgarten</title>
</svelte:head>

<div class="seite">
	<h1 class="seitentitel">Aufgaben</h1>
	<!-- Leerer Zustand ohne Erfassen-Knopf; der kommt mit Story 1.5 -->
	<p class="leer">Nichts offen.</p>
</div>

<style>
	.seite {
		display: flex;
		flex-direction: column;
		/* Abstand zwischen Geschwistern über gap, nie über Aussenabstände */
		gap: var(--space-4);
	}

	.seitentitel {
		margin: 0;
		color: var(--ink-primary);
		font-family: var(--display-font);
		font-size: var(--display-size);
		font-weight: var(--display-weight);
		line-height: var(--display-line);
		letter-spacing: var(--display-tracking);
	}

	.leer {
		margin: 0;
		color: var(--ink-secondary);
		font-family: var(--body-font);
		font-size: var(--body-size);
		font-weight: var(--body-weight);
		line-height: var(--body-line);
	}
</style>
