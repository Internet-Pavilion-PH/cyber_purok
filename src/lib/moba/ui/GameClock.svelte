<script lang="ts">
  let { seconds = 0 }: { seconds?: number } = $props();

  const formatClock = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const secondsValue = totalSeconds % 60;
    return `${minutes}:${secondsValue.toString().padStart(2, '0')}`;
  };
</script>

<div class="top-center-clock" aria-label="Game clock">
  <div class="clock-pill">
    <span class="clock-time">{formatClock(seconds)}</span>
  </div>
</div>

<style>
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

  @media (max-width: 900px) {
    .clock-pill {
      gap: 6px;
      padding: 5px 12px;
    }

    .clock-time {
      font-size: 0.9rem;
    }
  }

  @media (max-width: 640px) {
    .top-center-clock {
      top: 10px;
    }

    .clock-pill {
      padding: 4px 10px;
    }
  }
</style>
