<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children?.()}

<style>
	/* Global resets and hide scrollbars app-wide */
	:global(html, body) {
		margin: 0;
		padding: 0;
		height: 100%;
		width: 100%;
		overflow: hidden;
	}

	:global(body)::-webkit-scrollbar {
		display: none;
	}

	:global(html) {
		scrollbar-width: none;
	}
</style>
