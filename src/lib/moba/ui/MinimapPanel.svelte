<script lang="ts">
  type Marker = { id: string; name: string; x: number; z: number; color: string; yaw?: number; pulse?: boolean };

  let {
    heroPosition,
    remoteMarkers = [],
    debugPoint = { x: 0, y: 0 },
    fps = 0,
    mapSize = 1000,
    isMobile = false,
    onMinimapSelect,
  }: {
    heroPosition?: { x: number; z: number; yaw?: number } | null;
    remoteMarkers?: Marker[];
    debugPoint?: { x: number; y: number };
    fps?: number;
    mapSize?: number;
    isMobile?: boolean;
    onMinimapSelect?: (point: { x: number; z: number }) => void;
  } = $props();

  const halfMap = mapSize / 2;

  let normalized = $derived(
    heroPosition
      ? {
          x: ((heroPosition.x + halfMap) / mapSize) * 100,
          z: ((-heroPosition.z + halfMap) / mapSize) * 100,
        }
      : { x: 50, z: 50 },
  );

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
    if (event.key !== 'Enter' && event.key !== ' ') return;

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
        class:remote-marker={marker.id !== 'guava'}
        class:guava-marker={marker.id === 'guava'}
        class:pulse-marker={marker.pulse}
        style:--marker-x={`${((marker.x + halfMap) / mapSize) * 100}%`}
        style:--marker-y={`${((-marker.z + halfMap) / mapSize) * 100}%`}
        style:--marker-color={marker.color}
        style:--marker-angle={`${(((marker.yaw ?? 0) * 180) / Math.PI) + 180}deg`}
        title={marker.name}
      ></div>
    {/each}
    <div
      class="hero-marker"
      style:--marker-x={`${normalized.x}%`}
      style:--marker-y={`${normalized.z}%`}
      style:--marker-angle={`${(((heroPosition?.yaw ?? 0) * 180) / Math.PI) + 180}deg`}
      aria-label="Hero location"
    ></div>
  </div>

  {#if isMobile}
    <div class="ground-coords mobile-fps" aria-live="polite">
      <div>FPS {Math.round(fps)}</div>
    </div>
  {:else}
    <div class="ground-coords" aria-live="polite">
      <div>({debugPoint.x},{debugPoint.y})</div>
      <div>FPS {Math.round(fps)}</div>
    </div>
  {/if}
</div>

<style>
  .minimap-panel {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
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
    pointer-events: auto;
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

  .ground-coords {
    display: flex;
    flex-direction: column;
    gap: 2px;
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

  .mobile-fps {
    margin-top: 2px;
  }

  .minimap-grid {
    position: absolute;
    inset: 0;
    border-radius: 10px;
    background:
      linear-gradient(rgba(10, 22, 15, 0.45), rgba(10, 22, 15, 0.45)),
      url('/images/map1.png') center center / cover no-repeat;
    background-blend-mode: multiply;
    opacity: 0.9;
  }

  .hero-marker {
    position: absolute;
    left: var(--marker-x);
    top: var(--marker-y);
    width: 7px;
    height: 10px;
    margin-left: -3.5px;
    margin-top: -5px;
    background: #b9ff6d;
    border: 1.5px solid rgba(236, 255, 210, 0.95);
    box-shadow: 0 0 0 2px rgba(185, 255, 109, 0.18), 0 0 10px rgba(169, 255, 109, 0.7);
    clip-path: polygon(50% 0%, 0% 100%, 100% 100%);
    transform: rotate(var(--marker-angle, 0deg));
    transform-origin: center;
  }

  .remote-marker {
    position: absolute;
    left: var(--marker-x);
    top: var(--marker-y);
    width: 7px;
    height: 10px;
    margin-left: -3.5px;
    margin-top: -5px;
    background: var(--marker-color);
    border: 1.5px solid rgba(255, 255, 255, 0.9);
    box-shadow: 0 0 8px var(--marker-color);
    clip-path: polygon(50% 0%, 0% 100%, 100% 100%);
    transform: rotate(var(--marker-angle, 0deg));
    transform-origin: center;
  }

  .guava-marker {
    position: absolute;
    left: var(--marker-x);
    top: var(--marker-y);
    width: 6px;
    height: 6px;
    margin-left: -3px;
    margin-top: -3px;
    background: rgba(255, 212, 0, 0.9);
    border: 1.5px solid #ffd400;
    box-shadow: 0 0 8px rgba(255, 212, 0, 0.8);
    border-radius: 50%;
    z-index: 2;
  }

  .pulse-marker {
    position: absolute;
    left: var(--marker-x);
    top: var(--marker-y);
    width: 18px;
    height: 18px;
    margin-left: -9px;
    margin-top: -9px;
    border: 2px solid rgba(255, 212, 0, 0.85);
    border-radius: 50%;
    box-shadow: 0 0 0 rgba(255, 212, 0, 0), 0 0 6px rgba(255, 212, 0, 0.25);
    background: transparent;
    animation: minimap-pulse 0.9s ease-out infinite;
    z-index: 1;
    pointer-events: none;
  }

  @keyframes minimap-pulse {
    0% {
      opacity: 0;
      transform: scale(0.4);
      border-width: 2px;
    }
    20% {
      opacity: 0.9;
      transform: scale(0.7);
      border-width: 2px;
    }
    100% {
      opacity: 0;
      transform: scale(1.8);
      border-width: 1px;
    }
  }

  @media (max-width: 900px) {
    .minimap-frame {
      width: 120px;
      height: 120px;
    }
  }

  @media (max-width: 640px) {
    .minimap-frame {
      width: 96px;
      height: 96px;
    }
  }
</style>
