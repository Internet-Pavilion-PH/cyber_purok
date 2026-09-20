<script lang="ts">
  type DebugPoint = { x: number; y: number };

  let {
    heroPosition = null,
    cameraMode = "debug",
    debugPoint = { x: 0, y: 0 },
    onCameraChange,
  }: {
    heroPosition?: { x: number; z: number } | null;
    cameraMode?: "debug" | "game";
    debugPoint?: DebugPoint;
    onCameraChange?: (mode: "debug" | "game") => void;
  } = $props();

  const mapSize = 1000;
  const halfMap = mapSize / 2;

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
</script>

<div class="moba-ui" aria-label="MOBA heads-up display">
  <div class="top-brand" aria-label="Cyber_Purok logo">
    <img src="/cyber_purok.png" alt="Cyber_Purok" />
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
</div>

<style>
  .moba-ui {
    position: fixed;
    inset: 0;
    z-index: 20;
    pointer-events: none;
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

  .top-brand {
    position: absolute;
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 3;
    pointer-events: none;
  }

  .top-brand img {
    display: block;
    width: 160px;
    height: auto;
    filter: drop-shadow(0 0 10px rgba(170, 255, 186, 0.4));
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
    background: rgba(16, 43, 20, 0.45);
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
</style>
