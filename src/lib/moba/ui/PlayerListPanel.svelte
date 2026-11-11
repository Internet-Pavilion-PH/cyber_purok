<script lang="ts">
  let {
    onlinePlayers = [],
    serverConnected = false,
    onReconnect,
  }: {
    onlinePlayers?: Array<{ id: string; name: string; guavaCount?: number }>;
    serverConnected?: boolean;
    onReconnect?: () => void;
  } = $props();
</script>

<aside class="right-panel" aria-label="Online players">
  <div class="players-panel">
    <div class="connection-status" aria-live="polite">
      {#if !serverConnected}
        <span class="status-dot offline"></span>
        <span class="status-label">Server offline</span>
        <button class="reconnect-button" type="button" onclick={onReconnect}>Reconnect</button>
      {:else}
        <svg class="status-icon" viewBox="0 0 24 24" aria-hidden="true">
          <circle class="status-head" cx="12" cy="7" r="4.2"></circle>
          <path class="status-body" d="M5 18c1.3-3 4.1-4.5 7-4.5s5.7 1.5 7 4.5"></path>
        </svg>
        <span class="status-count">{onlinePlayers.length}</span>
      {/if}
    </div>
    {#if !serverConnected}
      <div class="player-empty">Waiting for arena sync…</div>
    {:else if onlinePlayers.length === 0}
      <div class="player-empty">No players yet</div>
    {:else}
      <ul class="player-list">
        {#each onlinePlayers as player (player.id)}
          <li class="player-item">
            <span class="player-dot"></span>
            <span>{player.guavaCount != null && player.guavaCount > 0 ? `${player.name} — ${player.guavaCount}` : player.name}</span>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</aside>

<style>
  .right-panel {
    position: absolute;
    top: 16px;
    right: 16px;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 8px;
    z-index: 4;
  }

  .players-panel {
    width: min(110px, 18vw);
    min-width: 90px;
    padding: 4px 0 0;
    border-radius: 8px;
    background: transparent;
    border: none;
    box-shadow: none;
    color: #ebfff1;
  }

  .connection-status {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
    font-size: 0.58rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #d7ffe3;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: inline-block;
    box-shadow: 0 0 10px rgba(126, 252, 154, 0.8);
  }

  .status-dot.offline {
    background: #ff7b7b;
    box-shadow: 0 0 10px rgba(255, 123, 123, 0.8);
  }

  .status-icon {
    width: 14px;
    height: 14px;
    display: inline-block;
    overflow: visible;
    flex-shrink: 0;
  }

  .status-head,
  .status-body {
    fill: none;
    stroke: #7efc9a;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
    filter: drop-shadow(0 0 6px rgba(126, 252, 154, 0.8));
  }

  .status-count {
    color: #d7ffe3;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    line-height: 1;
  }

  .status-label {
    flex: 1;
    white-space: nowrap;
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

  .player-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .player-item {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 1px 2px;
    border-radius: 6px;
    background: transparent;
    border: none;
    font-size: 0.68rem;
    line-height: 1.1;
    color: #f2fff4;
  }

  .player-item span:last-child {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .player-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #7efc9a;
    box-shadow: 0 0 10px rgba(126, 252, 154, 0.8);
    flex-shrink: 0;
  }

  .player-empty {
    font-size: 0.82rem;
    color: rgba(235, 255, 241, 0.75);
    background: transparent;
    border: none;
    border-radius: 0;
    padding: 4px 4px;
  }

  @media (max-width: 640px) {
    .right-panel {
      top: 10px;
      right: 10px;
    }

    .players-panel {
      width: min(90px, 22vw);
      min-width: 82px;
      padding-top: 2px;
    }

    .player-item {
      font-size: 0.62rem;
      gap: 4px;
      padding: 1px 1px;
    }
  }
</style>
