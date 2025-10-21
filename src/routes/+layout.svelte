<script lang="ts">
	// Favicon is provided in src/app.html for the site; do not override it here.
	let { children } = $props();
</script>

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
