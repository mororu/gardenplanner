<script>
	// Die Importzeile fehlt absichtlich. Ein `import '$lib/styles/knoepfe.css';`
	// hier wäre der einzige Unterschied zur Gegenprobe daneben.
	let { children } = $props();
</script>

<div class="rahmen">{@render children()}</div>

<style>
	.rahmen {
		padding: var(--gutter);
		background-color: var(--surface-base);
	}
</style>
