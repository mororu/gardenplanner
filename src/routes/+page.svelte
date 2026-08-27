<svelte:head>
	<title>Aufgaben</title>
</svelte:head>

<!--
	Startseite. Sie führt später genau drei Blöcke in dieser Reihenfolge:
	Diensthinweis, freie Einzelaufgaben, offener Pool. Dieses Gerüst zeigt nur
	den leeren Zustand des Pools; die Blöcke kommen mit den Stories 1.4 und 1.5.
-->
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

	/* Genau ein h1 pro Seite, und nur dieses trägt die display-Rolle */
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
