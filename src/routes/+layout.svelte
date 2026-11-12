<script lang="ts">
	import PwaInstallPrompt from '$lib/ui/PwaInstallPrompt.svelte';

	// Favicon is provided in src/app.html for the site; do not override it here.
	let { children } = $props();
</script>

{@render children?.()}
<PwaInstallPrompt />

<style>
	/* Global resets and prevent Safari mobile touch/zoom artifacts */
	:global(html, body) {
		margin: 0;
		padding: 0;
		height: 100%;
		width: 100%;
		overflow: hidden;
		-webkit-text-size-adjust: 100%;
		text-size-adjust: 100%;
		-webkit-tap-highlight-color: transparent;
		overflow: hidden;
		overscroll-behavior: none;
	}

	:global(body)::-webkit-scrollbar {
		display: none;
	}

	:global(html) {
		scrollbar-width: none;
	}

	:global(*, *::before, *::after) {
		-webkit-tap-highlight-color: transparent;
	}

	:global(button, input, textarea, select) {
		font: inherit;
		font-size: 16px;
		-webkit-appearance: none;
		appearance: none;
		touch-action: manipulation;
	}
</style>
