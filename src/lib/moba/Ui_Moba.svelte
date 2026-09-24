<script lang="ts">
  import { heroState, maxHp, maxMana } from "$lib/moba/heroStore";

  type DebugPoint = { x: number; y: number };

  let {
    heroPosition = null,
    cameraMode = "debug",
    debugPoint = { x: 0, y: 0 },
    onCameraChange,
    onMoveInput,
  }: {
    heroPosition?: { x: number; z: number } | null;
    cameraMode?: "debug" | "game";
    debugPoint?: DebugPoint;
    onCameraChange?: (mode: "debug" | "game") => void;
    onMoveInput?: (input: { x: number; y: number }) => void;
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

  function setCameraMode(mode: "debug" | "game") {
    onCameraChange?.(mode);
  }

  let movePadRef: HTMLDivElement | null = null;
  let activeMovePointerId: number | null = null;

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
</script>

<div class="moba-ui" aria-label="MOBA heads-up display">
  <div class="top-center-clock" aria-label="Game clock">
    <div class="clock-pill">
    
      <span class="clock-time">{formatClock(gameSeconds)}</span>
    </div>
  </div>

  <div class="minimap-panel" aria-label="MOBA minimap">
    <div class="minimap-frame">
      <div class="minimap-grid"></div>
      <div
        class="hero-marker"
        style:--marker-x={`${normalized.x}%`}
        style:--marker-y={`${normalized.z}%`}
        aria-label="Hero location"
      ></div>
    </div>
  </div>

  <div class="bottom-center-hud" class:mobile-layout={isMobile} aria-label="Hero abilities and portrait">
    {#if !isMobile}
      <div class="portrait-panel" aria-label="Hero portrait">
        <div class="portrait-ring">
          <div class="portrait-art" aria-label="Hero portrait placeholder"></div>
        </div>
      </div>
    {/if}

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
    {:else}
      <div class="ability-column" aria-label="Hero abilities">
        <div class="ability-grid" aria-label="Quick cast abilities">
          <div class="ability-slot"><span>Q</span></div>
          <div class="ability-slot"><span>W</span></div>
          <div class="ability-slot"><span>E</span></div>
          <div class="ability-slot"><span>R</span></div>
        </div>

        <div class="resource-stack" aria-label="Hero resource bars">
          <div class="resource-bar hp">
            <span class="resource-label">HP</span>
            <div
              class="resource-fill hp-fill"
              style:width={`${Math.max(0, Math.min(100, (($heroState.currentHp / $maxHp) * 100))) }%`}
            ></div>
          </div>
          <div class="resource-bar mana">
            <span class="resource-label">MP</span>
            <div
              class="resource-fill mana-fill"
              style:width={`${Math.max(0, Math.min(100, (($heroState.currentMana / $maxMana) * 100))) }%`}
            ></div>
          </div>
        </div>
      </div>
    {/if}
  </div>

  {#if !isMobile}
    <div class="right-panel">
      <div class="debug-readout" aria-live="polite">
        <div>x: {debugPoint.x}</div>
        <div>y: {debugPoint.y}</div>
      </div>

      <div class="camera-toolbar" aria-label="Camera mode toggle">
        <button class:active={cameraMode === "debug"} onclick={() => setCameraMode("debug")}>
          Debug
        </button>
        <button class:active={cameraMode === "game"} onclick={() => setCameraMode("game")}>
          Game
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .moba-ui {
    position: fixed;
    inset: 0;
    z-index: 20;
    pointer-events: none;
  }

  .bottom-center-hud {
    position: absolute;
    left: 50%;
    bottom: 10px;
    transform: translateX(-50%);
    display: flex;
    align-items: flex-end;
    gap: 12px;
    pointer-events: none;
    z-index: 10;
  }

  .bottom-center-hud.mobile-layout {
    left: 0;
    width: 100%;
    bottom: 0;
    transform: none;
    display: block;
    pointer-events: none;
  }

  .portrait-panel {
    width: 120px;
    height: 120px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    background: rgba(64, 191, 99, 0.18);
    border: 1px solid rgba(162, 255, 183, 0.8);
    box-shadow: inset 0 0 0 1px rgba(170, 255, 186, 0.12);
  }

  .portrait-ring {
    width: 86px;
    height: 86px;
    border-radius: 7px;
    padding: 0;
    background: rgba(64, 191, 99, 0.18);
    box-shadow: none;
  }

  .portrait-art {
    width: 100%;
    height: 100%;
    border-radius: 7px;
    background: rgba(64, 191, 99, 0.18);
    border: 1px solid rgba(162, 255, 183, 0.9);
    box-shadow: inset 0 0 0 1px rgba(170, 255, 186, 0.08);
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

  .ability-column {
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: stretch;
  }

  .ability-grid {
    display: grid;
    grid-template-columns: repeat(4, 58px);
    gap: 8px;
  }

  .ability-slot {
    position: relative;
    width: 58px;
    height: 58px;
    border-radius: 7px;
    border: 1px solid rgba(162, 255, 183, 0.8);
    background: rgba(64, 191, 99, 0.18);
    box-shadow: inset 0 0 0 1px rgba(170, 255, 186, 0.08);
    display: grid;
    place-items: center;
    color: #e9fff0;
    font-weight: 700;
    font-size: 0.95rem;
    text-shadow: none;
  }

  .ability-slot::before {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: 7px;
    border: none;
  }

  .resource-stack {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
  }

  .resource-bar {
    position: relative;
    height: 12px;
    width: 100%;
    border-radius: 999px;
    overflow: hidden;
    background: rgba(11, 20, 15, 0.8);
    border: 1px solid rgba(146, 228, 170, 0.45);
  }

  .resource-label {
    position: absolute;
    left: 8px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 8px;
    letter-spacing: 0.08em;
    color: #dfffe8;
    z-index: 1;
  }

  .resource-fill {
    position: absolute;
    inset: 0 auto 0 0;
    border-radius: inherit;
  }

  .hp-fill {
    width: 72%;
    background: linear-gradient(90deg, #7efc9a 0%, #3ecf70 100%);
  }

  .mana-fill {
    width: 68%;
    background: linear-gradient(90deg, #75d3ff 0%, #2d9dfd 100%);
  }

  .right-panel {
    position: absolute;
    top: 16px;
    right: 16px;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 8px;
  }

  .camera-toolbar {
    display: flex;
    gap: 8px;
    pointer-events: auto;
  }

  .camera-toolbar button {
    padding: 6px 10px;
    border: 1px solid rgba(125, 221, 141, 0.5);
    background: rgba(12, 26, 18, 0.7);
    color: #dfffe6;
    border-radius: 999px;
    cursor: pointer;
    font: 11px/1.1 inherit;
  }

  .camera-toolbar button.active {
    background: rgba(76, 218, 105, 0.9);
    border-color: rgba(170, 255, 186, 1);
    color: #06290d;
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
    padding: 6px 16px;
    border-radius: 999px;
    border: 1px solid rgba(139, 223, 162, 0.7);
    background: rgba(10, 20, 16, 0.72);
    box-shadow: inset 0 0 0 1px rgba(170, 255, 186, 0.08), 0 8px 18px rgba(0, 0, 0, 0.2);
  }

  .clock-label {
    font-size: 9px;
    letter-spacing: 0.18em;
    color: #d7ffe4;
    text-transform: uppercase;
    opacity: 0.9;
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
    pointer-events: none;
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

  .minimap-grid {
    position: absolute;
    inset: 12px;
    border-radius: 10px;
    border: 1px solid rgba(138, 235, 170, 0.35);
    background:
      linear-gradient(rgba(10, 22, 15, 0.45), rgba(10, 22, 15, 0.45)),
      url("/map.png") center center / cover no-repeat;
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

  .debug-readout {
    padding: 10px 12px;
    border-radius: 10px;
    background: rgba(7, 20, 12, 0.72);
    border: 1px solid rgba(128, 233, 156, 0.45);
    color: #dfffe6;
    font: 12px/1.5 monospace;
    min-width: 120px;
    box-shadow: inset 0 0 14px rgba(95, 255, 142, 0.08);
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

    .clock-label {
      letter-spacing: 0.12em;
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

    .top-center-clock {
      top: 10px;
    }

    .clock-pill {
      padding: 4px 10px;
    }

    .clock-label {
      font-size: 8px;
    }
  }
</style>
