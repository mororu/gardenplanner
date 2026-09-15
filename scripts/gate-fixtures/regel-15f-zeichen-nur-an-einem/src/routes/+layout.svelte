<script>
	// Der Import über den Alias — der Weg, den das echte +layout.svelte nimmt.
	import '$lib/styles/knoepfe.css';

	let { children } = $props();
</script>

<div class="rahmen">{@render children()}</div>

<style>
	.rahmen {
		padding: var(--gutter);
		background-color: var(--surface-base);
	}
</style>
