<script lang="ts">
	import { onMount } from 'svelte';

	const SESSION_KEY = 'cyberpurok-pwa-install-shown';

	let deferredPrompt: {
		prompt: () => Promise<void>;
		userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
	} | null = null;
	let showInstallDialog = $state(false);

	function markSessionShown() {
		if (typeof sessionStorage !== 'undefined') {
			sessionStorage.setItem(SESSION_KEY, 'true');
		}
	}

	function shouldShowPrompt() {
		if (typeof sessionStorage === 'undefined') {
			return true;
		}
		return sessionStorage.getItem(SESSION_KEY) !== 'true';
	}

	function handleBeforeInstallPrompt(event: Event) {
		event.preventDefault();
		deferredPrompt = event as unknown as typeof deferredPrompt;
	}

	async function installApp() {
		if (!deferredPrompt) return;

		try {
			deferredPrompt.prompt();
			await deferredPrompt.userChoice;
		} finally {
			markSessionShown();
			deferredPrompt = null;
			showInstallDialog = false;
		}
	}

	function dismissInstallDialog() {
		markSessionShown();
		showInstallDialog = false;
	}

	onMount(() => {
		if (typeof window === 'undefined' || !shouldShowPrompt()) {
			return;
		}

		const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
		if (isStandalone) {
			markSessionShown();
			return;
		}

		const handleAppInstalled = () => {
			markSessionShown();
			deferredPrompt = null;
			showInstallDialog = false;
		};

		window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
		window.addEventListener('appinstalled', handleAppInstalled);

		const installTimer = window.setTimeout(() => {
			if (deferredPrompt && shouldShowPrompt()) {
				showInstallDialog = true;
				markSessionShown();
			}
		}, 60000);

		return () => {
			window.clearTimeout(installTimer);
			window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
			window.removeEventListener('appinstalled', handleAppInstalled);
		};
	});
</script>

{#if showInstallDialog}
	<div class="install-overlay" aria-live="polite">
		<div class="install-dialog" role="dialog" aria-modal="true" aria-labelledby="install-title">
			<h2 id="install-title">Install Cyber Purok</h2>
			<p>Add this app to your home screen for quicker access and a smoother experience.</p>
			<div class="install-actions">
				<button class="primary" onclick={installApp}>Install</button>
				<button class="secondary" onclick={dismissInstallDialog}>Not now</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.install-overlay {
		position: fixed;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(9, 15, 18, 0.6);
		backdrop-filter: blur(6px);
		z-index: 9999;
	}

	.install-dialog {
		width: min(440px, calc(100vw - 32px));
		padding: 1.5rem;
		border-radius: 16px;
		background: rgba(16, 22, 28, 0.96);
		border: 1px solid rgba(110, 255, 179, 0.4);
		box-shadow: 0 18px 50px rgba(0, 0, 0, 0.35);
		color: #f6f8fb;
		font-family: Arial, sans-serif;
	}

	.install-dialog h2 {
		margin: 0 0 0.75rem;
		font-size: clamp(1.35rem, 2vw, 2rem);
		color: #9af7c1;
	}

	.install-dialog p {
		margin: 0 0 1.25rem;
		line-height: 1.5;
		color: #dfeaf7;
	}

	.install-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
	}

	button {
		border: none;
		border-radius: 10px;
		padding: 0.8rem 1.1rem;
		font-size: 0.96rem;
		font-weight: 600;
		cursor: pointer;
		transition: transform 0.15s ease;
	}

	button:hover {
		transform: translateY(-1px);
	}

	button.primary {
		background: linear-gradient(135deg, #15d18b, #3dd6ff);
		color: #071410;
	}

	button.secondary {
		background: rgba(255, 255, 255, 0.08);
		color: #f6f8fb;
	}
</style>
