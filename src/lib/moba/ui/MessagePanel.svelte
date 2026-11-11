<script lang="ts">
  import messageTemplates from '../messageTemplates.json';

  type Props = {
    seconds?: number;
    announcement?: string;
  };

  let { seconds = 0, announcement = "" }: Props = $props();

  const activeMessage = $derived.by(() => {
    if (announcement) return { text: announcement };

    const current = messageTemplates.find((template) => {
      return seconds >= template.at && seconds < template.at + template.duration;
    });

    return current ?? null;
  });
</script>

{#if activeMessage}
  <div class="message-panel" aria-live="polite">
    <div class="message-box">
      {activeMessage.text}
    </div>
  </div>
{/if}

<style>
  .message-panel {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    pointer-events: none;
    z-index: 25;
  }

  .message-box {
    max-width: min(80vw, 640px);
    padding: 18px 26px;
    border-radius: 16px;
    background: rgba(96, 155, 125, 0.371);
    border: 1px solid rgba(111, 255, 178, 0.4);
    box-shadow: 0 0 28px rgba(111, 255, 178, 0.22);
    color: #ebfff1;
    font-size: clamp(1rem, 2vw, 1.8rem);
    line-height: 1.3;
    letter-spacing: 0.08em;
    text-transform: lowercase;
    text-align: center;
    backdrop-filter: blur(4px);
    animation: fadeInUp 0.5s ease-out;
  }

  @keyframes fadeInUp {
    0% {
      opacity: 0;
      transform: translateY(18px) scale(0.96);
    }
    100% {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
</style>
