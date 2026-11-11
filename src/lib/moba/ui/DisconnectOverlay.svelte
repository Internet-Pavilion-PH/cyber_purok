<script lang="ts">
  let { serverConnected = false, onReconnect }: { serverConnected?: boolean; onReconnect?: () => void } = $props();
</script>

{#if !serverConnected}
  <div class="disconnect-overlay" aria-live="polite">
    <div class="disconnect-card">
      <div class="disconnect-label">Connection lost</div>
      <div class="disconnect-title">Arena server disconnected</div>
      <p class="disconnect-copy">Your hero remains in the arena, but remote players are temporarily unavailable while the connection reconnects.</p>
      <button class="reconnect-button large" type="button" onclick={onReconnect}>Reconnect now</button>
    </div>
  </div>
{/if}

<style>
  .disconnect-overlay {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    background: rgba(6, 12, 9, 0.48);
    backdrop-filter: blur(2px);
    z-index: 30;
    pointer-events: none;
  }

  .disconnect-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 20px 28px;
    border-radius: 18px;
    border: 1px solid rgba(162, 255, 188, 0.45);
    background: rgba(12, 22, 16, 0.72);
    box-shadow: 0 18px 32px rgba(0, 0, 0, 0.28);
    text-align: center;
    pointer-events: auto;
  }

  .disconnect-label {
    font-size: 0.6rem;
    font-weight: 700;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: #ffb4a9;
  }

  .disconnect-title {
    font-size: clamp(1.1rem, 2vw, 2rem);
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #ebfff1;
    text-shadow: 0 0 18px rgba(150, 255, 166, 0.25);
  }

  .disconnect-copy {
    max-width: 34rem;
    margin: 0;
    font-size: 0.9rem;
    line-height: 1.5;
    color: rgba(235, 255, 241, 0.82);
  }

  .reconnect-button {
    border: 1px solid rgba(163, 255, 187, 0.8);
    border-radius: 999px;
    background: rgba(14, 33, 20, 0.7);
    color: #ebfff1;
    font-size: 0.56rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 4px 8px;
    cursor: pointer;
  }

  .reconnect-button.large {
    font-size: 0.72rem;
    padding: 8px 18px;
    background: rgba(23, 63, 35, 0.9);
    box-shadow: 0 0 24px rgba(115, 255, 148, 0.2);
  }
</style>
