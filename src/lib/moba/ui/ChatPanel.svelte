<script lang="ts">
  type ChatMessage = { id: string; author: string; text: string };

  let {
    chatMessages = [],
    onChatSend,
  }: {
    chatMessages?: ChatMessage[];
    onChatSend?: (text: string) => void;
  } = $props();

  let chatDraft = $state('');

  function submitChat(event: SubmitEvent) {
    event.preventDefault();

    const message = chatDraft.trim();
    if (!message) return;

    onChatSend?.(message);
    chatDraft = '';
  }
</script>

<div class="chat-panel" aria-label="In-game chat">
  <div class="chat-header">
    <svg class="chat-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 7.5A2.5 2.5 0 0 1 7.5 5h9A2.5 2.5 0 0 1 19 7.5v6A2.5 2.5 0 0 1 16.5 16H11l-4.5 3v-3H7.5A2.5 2.5 0 0 1 5 13.5v-6Z"></path>
    </svg>
  </div>
  <div class="chat-log-wrap">
    <div class="chat-log">
      {#each chatMessages as message (message.id)}
        <div class="chat-message">
          <span class="chat-author">{message.author}:</span>
          <span>{message.text}</span>
        </div>
      {/each}
    </div>
  </div>
  <form class="chat-form" onsubmit={submitChat}>
    <input bind:value={chatDraft} type="text" maxlength="180" aria-label="Type a chat message" placeholder="Send a message..." />
    <button type="submit">Send</button>
  </form>
</div>

<style>
  .chat-panel {
    width: min(240px, 30vw);
    min-width: 200px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    pointer-events: auto;
  }

  .chat-header {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    color: #ffffff;
  }

  .chat-icon {
    width: 14px;
    height: 14px;
    display: block;
    fill: none;
    stroke: #ffffff;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
    filter: drop-shadow(0 0 6px rgba(255, 255, 255, 0.5));
  }

  .chat-log {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 120px;
    overflow: auto;
    padding-right: 2px;
  }

  .chat-message {
    font-size: 0.68rem;
    line-height: 1.45;
    color: #ffffff;
    word-break: break-word;
  }

  .chat-author {
    color: #ffffff;
    font-weight: 700;
  }

  .chat-form {
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-items: stretch;
  }

  .chat-form input {
    width: 100%;
    min-width: 0;
    border: none;
    background: transparent;
    color: #ffffff;
    padding: 4px 0;
    font-size: 16px;
    line-height: 1.3;
    outline: none;
    -webkit-text-size-adjust: 100%;
  }

  .chat-form input::placeholder {
    color: rgba(255, 255, 255, 0.7);
  }

  .chat-form button {
    border: none;
    background: transparent;
    color: #ffffff;
    font-size: 0.56rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 0;
    cursor: pointer;
    text-align: left;
  }

  @media (max-width: 768px) {
    .chat-panel {
      width: min(180px, 42vw);
      min-width: 150px;
      margin-top: 4px;
    }

    .chat-message,
    .chat-form input,
    .chat-form button,
    .chat-header {
      font-size: 0.58rem;
    }
  }
</style>
