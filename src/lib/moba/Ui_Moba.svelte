<script lang="ts">
  import { heroState, maxHp, maxMana } from "$lib/moba/heroStore";

  type DebugPoint = { x: number; y: number };

  let {
    heroPosition = null,
    remoteMarkers = [],
    onlinePlayers = [],
    debugPoint = { x: 0, y: 0 },
    serverConnected = false,
    onMoveInput,
    onMinimapSelect,
    onReconnect,
  }: {
    heroPosition?: { x: number; z: number } | null;
    remoteMarkers?: { id: string; name: string; x: number; z: number; color: string }[];
    onlinePlayers?: Array<{ id: string; name: string }>;
    debugPoint?: DebugPoint;
    serverConnected?: boolean;
    onMoveInput?: (input: { x: number; y: number }) => void;
    onMinimapSelect?: (point: { x: number; z: number }) => void;
    onReconnect?: () => void;
  } = $props();

  const mapSize = 1000;
  const halfMap = mapSize / 2;

  const isMobile =
    typeof window !== "undefined" &&
    ((typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(navigator.userAgent)) ||
      (typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches));

  let gameSeconds = $state(0);

  const formatClock = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  $effect(() => {
    const intervalId = window.setInterval(() => {
      gameSeconds += 1;
    }, 1000);

    return () => window.clearInterval(intervalId);
  });

  let normalized = $derived(
    heroPosition
      ? {
          x: ((heroPosition.x + halfMap) / mapSize) * 100,
          z: ((-heroPosition.z + halfMap) / mapSize) * 100,
        }
      : { x: 50, z: 50 },
  );

  let movePadRef: HTMLDivElement | null = $state(null);
  let activeMovePointerId: number | null = $state(null);

  function updateMoveInput(clientX: number, clientY: number) {
    if (!movePadRef) return;

    const rect = movePadRef.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const maxRadius = rect.width / 2 - 18;
    const distance = Math.min(Math.hypot(dx, dy), maxRadius);
    const angle = Math.atan2(dy, dx);
    const clampedX = Math.cos(angle) * distance;
    const clampedY = Math.sin(angle) * distance;
    const normalizedX = rect.width === 0 ? 0 : clampedX / maxRadius;
    const normalizedY = rect.height === 0 ? 0 : clampedY / maxRadius;

    const thumb = movePadRef.querySelector(".move-pad-thumb") as HTMLDivElement | null;
    if (thumb) {
      const thumbOffsetX = (normalizedX * (maxRadius - 8)) * 0.9;
      const thumbOffsetY = (normalizedY * (maxRadius - 8)) * 0.9;
      thumb.style.transform = `translate(-50%, -50%) translate(${thumbOffsetX}px, ${thumbOffsetY}px)`;
    }

    onMoveInput?.({ x: normalizedX, y: -normalizedY });
  }

  function handleMovePadStart(event: PointerEvent) {
    activeMovePointerId = event.pointerId;
    movePadRef?.setPointerCapture?.(event.pointerId);
    updateMoveInput(event.clientX, event.clientY);
  }

  function handleMovePadMove(event: PointerEvent) {
    if (activeMovePointerId !== event.pointerId) return;
    updateMoveInput(event.clientX, event.clientY);
  }

  function handleMovePadEnd(event?: PointerEvent) {
    if (event && activeMovePointerId !== null && activeMovePointerId !== event.pointerId) return;
    activeMovePointerId = null;
    const thumb = movePadRef?.querySelector(".move-pad-thumb") as HTMLDivElement | null;
    if (thumb) {
      thumb.style.transform = "translate(-50%, -50%)";
    }
    onMoveInput?.({ x: 0, y: 0 });
  }

  function handleMinimapClick(event: MouseEvent) {
    const frame = event.currentTarget as HTMLElement | null;
    if (!frame) return;

    const rect = frame.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;

    const worldX = (px - 0.5) * mapSize;
    const worldZ = (0.5 - py) * mapSize;

    onMinimapSelect?.({ x: worldX, z: worldZ });
  }

  function handleMinimapKeydown(event: KeyboardEvent) {
    if (event.key !== "Enter" && event.key !== " ") return;

    const frame = event.currentTarget as HTMLElement | null;
    if (!frame) return;

    event.preventDefault();
    const rect = frame.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const worldX = ((cx - rect.left) / rect.width - 0.5) * mapSize;
    const worldZ = (0.5 - (cy - rect.top) / rect.height) * mapSize;

    onMinimapSelect?.({ x: worldX, z: worldZ });
  }
</script>

<div class="moba-ui" aria-label="MOBA heads-up display">
  <div class="top-center-clock" aria-label="Game clock">
    <div class="clock-pill">
    
      <span class="clock-time">{formatClock(gameSeconds)}</span>
    </div>
  </div>

  <div class="minimap-panel" aria-label="MOBA minimap">
    <div
      class="minimap-frame"
      onclick={handleMinimapClick}
      onkeydown={handleMinimapKeydown}
      role="button"
      tabindex="0"
      aria-label="Minimap"
    >
      <div class="minimap-grid"></div>
      {#each remoteMarkers as marker (marker.id)}
        <div
          class="remote-marker"
          style:--marker-x={`${((marker.x + halfMap) / mapSize) * 100}%`}
          style:--marker-y={`${((-marker.z + halfMap) / mapSize) * 100}%`}
          style:--marker-color={marker.color}
          title={marker.name}
        ></div>
      {/each}
      <div
        class="hero-marker"
        style:--marker-x={`${normalized.x}%`}
        style:--marker-y={`${normalized.z}%`}
        aria-label="Hero location"
      ></div>
    </div>

    {#if !isMobile}
      <div class="ground-coords" aria-live="polite">({debugPoint.x},{debugPoint.y})</div>
    {/if}
  </div>

  {#if isMobile}
    <div class="mobile-controls" aria-label="Mobile controls">
      <div
        bind:this={movePadRef}
        class="move-pad"
        aria-label="Movement controls"
        onpointerdown={handleMovePadStart}
        onpointermove={handleMovePadMove}
        onpointerup={handleMovePadEnd}
        onpointercancel={handleMovePadEnd}
      >
        <div class="move-pad-thumb"></div>
      </div>

      <div class="action-pad" aria-label="Action controls">
        <button class="action-button" type="button" aria-label="Attack button">A</button>
      </div>
    </div>
  {/if}

  {#if !serverConnected}
    <div class="disconnect-overlay" aria-live="polite">
      <div class="disconnect-card">
        <div class="disconnect-title">You are disconnected from the server</div>
        <button class="reconnect-button large" type="button" onclick={onReconnect}>Reconnect</button>
      </div>
    </div>
  {/if}

  <aside class="right-panel" aria-label="Online players">
    <div class="players-panel">
      <div class="connection-status" aria-live="polite">
        {#if !serverConnected}
          <span class="status-dot offline"></span>
          <span class="status-label">Server offline</span>
          <button class="reconnect-button" type="button" onclick={onReconnect}>Reconnect</button>
        {:else}
          <span class="status-dot online"></span>
          <span class="status-label">Online {onlinePlayers.length}</span>
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
              <span>{player.name}</span>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </aside>
</div>

<style>
  .moba-ui {
    position: fixed;
    inset: 0;
    z-index: 20;
    pointer-events: none;
  }

  .minimap-panel,
  .minimap-frame {
    pointer-events: auto;
  }

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

  .status-dot.online {
    background: #7efc9a;
    box-shadow: 0 0 10px rgba(126, 252, 154, 0.8);
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

  .reconnect-button.large {
    font-size: 0.72rem;
    padding: 8px 18px;
    background: rgba(23, 63, 35, 0.9);
    box-shadow: 0 0 24px rgba(115, 255, 148, 0.2);
  }

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

  .disconnect-title {
    font-size: clamp(1.1rem, 2vw, 2rem);
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #ebfff1;
    text-shadow: 0 0 18px rgba(150, 255, 166, 0.25);
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

  .top-center-clock {
    position: absolute;
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 3;
    pointer-events: none;
  }

  .clock-pill {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0;
    border-radius: 999px;
    border: none;
    background: transparent;
    box-shadow: none;
  }

  .clock-time {
    font-size: 1.1rem;
    font-weight: 700;
    color: #eafff0;
    letter-spacing: 0.08em;
    text-shadow: 0 0 12px rgba(135, 255, 161, 0.45);
  }

  .minimap-panel {
    position: absolute;
    top: 16px;
    left: 16px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    pointer-events: none;
  }

  .ground-coords {
    color: #ebfff1;
    font: 12px/1.4 monospace;
    letter-spacing: 0.04em;
    text-shadow: 0 0 8px rgba(123, 255, 159, 0.22);
    background: transparent;
    border: none;
    padding: 0;
    min-width: 0;
    box-shadow: none;
  }

  .minimap-frame {
    position: relative;
    width: 180px;
    height: 180px;
    border-radius: 14px;
    background: linear-gradient(180deg, rgba(9, 27, 14, 0.9), rgba(10, 18, 13, 0.75));
    border: 1px solid rgba(121, 220, 150, 0.7);
    box-shadow: 0 0 0 1px rgba(84, 200, 118, 0.2), 0 18px 30px rgba(0, 0, 0, 0.28);
    overflow: hidden;
    transition: width 0.2s ease, height 0.2s ease;
  }

  .minimap-frame::before {
    content: "";
    position: absolute;
    inset: 0;
    background:
      linear-gradient(rgba(72, 203, 119, 0.08), rgba(72, 203, 119, 0.02)),
      repeating-linear-gradient(
        0deg,
        rgba(119, 221, 150, 0.06),
        rgba(119, 221, 150, 0.06) 1px,
        transparent 1px,
        transparent 12px
      ),
      repeating-linear-gradient(
        90deg,
        rgba(119, 221, 150, 0.06),
        rgba(119, 221, 150, 0.06) 1px,
        transparent 1px,
        transparent 12px
      );
  }

  .mobile-controls {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 12;
  }

  .move-pad {
    position: absolute;
    left: 18px;
    bottom: 22px;
    width: 110px;
    height: 110px;
    border-radius: 50%;
    border: 2px solid rgba(170, 255, 186, 0.7);
    background: rgba(11, 25, 17, 0.46);
    box-shadow: inset 0 0 0 1px rgba(170, 255, 186, 0.12), 0 0 24px rgba(67, 214, 97, 0.15);
    pointer-events: auto;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
  }

  .move-pad::before {
    content: "";
    position: absolute;
    inset: 18px;
    border-radius: 50%;
    border: 1px solid rgba(170, 255, 186, 0.26);
  }

  .move-pad-thumb {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: rgba(177, 255, 170, 0.8);
    border: 2px solid rgba(255, 255, 255, 0.8);
    box-shadow: 0 0 18px rgba(142, 255, 170, 0.35);
    transform: translate(-50%, -50%);
    transition: transform 0.04s linear;
  }

  .action-pad {
    position: absolute;
    right: 18px;
    bottom: 22px;
    width: 86px;
    height: 86px;
    display: grid;
    place-items: center;
    pointer-events: auto;
  }

  .action-button {
    width: 68px;
    height: 68px;
    border-radius: 50%;
    border: 2px solid rgba(170, 255, 186, 0.9);
    background: radial-gradient(circle at 30% 30%, rgba(169, 255, 184, 0.9), rgba(64, 191, 99, 0.8));
    color: #072d13;
    font-weight: 800;
    font-size: 1.2rem;
    box-shadow: 0 0 24px rgba(123, 255, 151, 0.28), inset 0 0 12px rgba(255, 255, 255, 0.18);
    cursor: pointer;
  }

  .minimap-grid {
    position: absolute;
    inset: 0px;
    border-radius: 10px;
    border: 0px solid transparent;
    background:
      linear-gradient(rgba(10, 22, 15, 0.45), rgba(10, 22, 15, 0.45)),
      url("/images/map.png") center center / cover no-repeat;
    background-blend-mode: multiply;
    opacity: 0.9;
  }

  .hero-marker {
    position: absolute;
    left: var(--marker-x);
    top: var(--marker-y);
    width: 10px;
    height: 10px;
    margin-left: -5px;
    margin-top: -5px;
    border-radius: 50%;
    background: #b9ff6d;
    border: 2px solid rgba(236, 255, 210, 0.95);
    box-shadow: 0 0 0 3px rgba(185, 255, 109, 0.18), 0 0 12px rgba(169, 255, 109, 0.7);
    transform: translateZ(0);
  }

  .remote-marker {
    position: absolute;
    left: var(--marker-x);
    top: var(--marker-y);
    width: 10px;
    height: 10px;
    margin-left: -5px;
    margin-top: -5px;
    border-radius: 50%;
    background: var(--marker-color);
    border: 2px solid rgba(255, 255, 255, 0.9);
    box-shadow: 0 0 10px var(--marker-color);
  }

  @media (max-width: 900px) {
    .minimap-frame {
      width: 120px;
      height: 120px;
    }

    .clock-pill {
      gap: 6px;
      padding: 5px 12px;
    }

    .clock-time {
      font-size: 0.9rem;
    }
  }

  @media (max-width: 640px) {
    .minimap-panel {
      top: 10px;
      left: 10px;
    }

    .minimap-frame {
      width: 96px;
      height: 96px;
    }

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

    .top-center-clock {
      top: 10px;
    }

    .clock-pill {
      padding: 4px 10px;
    }

  }
</style>
