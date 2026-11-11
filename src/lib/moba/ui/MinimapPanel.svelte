<script lang="ts">
  type Marker = { id: string; name: string; x: number; z: number; color: string; pulse?: boolean };

  let {
    heroPosition,
    remoteMarkers = [],
    debugPoint = { x: 0, y: 0 },
    fps = 0,
    mapSize = 1000,
    isMobile = false,
    onMinimapSelect,
  }: {
    heroPosition?: { x: number; z: number } | null;
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
      url('/images/map.png') center center / cover no-repeat;
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

  .remote-marker,
  .guava-marker {
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

  .guava-marker {
    width: 12px;
    height: 12px;
    margin-left: -6px;
    margin-top: -6px;
    background: transparent;
    border: 2px solid #ffd400;
    box-shadow: none;
  }

  .pulse-marker {
    animation: minimap-pulse 0.9s ease-in-out infinite alternate;
  }

  @keyframes minimap-pulse {
    0% {
      opacity: 0.5;
      transform: scale(0.82);
    }
    50% {
      opacity: 1;
      transform: scale(1.12);
    }
    100% {
      opacity: 0.7;
      transform: scale(0.96);
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
