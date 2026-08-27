<!--
	Zweiter Teil der Gegenprobe: derselbe Import über einen **relativen** Pfad.
	Regel 10 fragt nach der Existenz eines Imports, nicht nach seiner Form —
	beide Wege laden die Datei wirklich, also müssen beide zählen.
-->
<script>
	import '../lib/styles/knoepfe.css';
</script>

<p class="probe">Probe</p>

<style>
	.probe {
		color: var(--accent);
	}
</style>
