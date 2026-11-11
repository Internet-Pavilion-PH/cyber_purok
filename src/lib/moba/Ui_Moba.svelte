<script lang="ts">
  import { heroState, maxHp, maxMana } from "./entities/heroStore";
  import GameClock from "./ui/GameClock.svelte";
  import MinimapPanel from "./ui/MinimapPanel.svelte";
  import ChatPanel from "./ui/ChatPanel.svelte";
  import PlayerListPanel from "./ui/PlayerListPanel.svelte";
  import DisconnectOverlay from "./ui/DisconnectOverlay.svelte";
  import MessagePanel from "./ui/MessagePanel.svelte";

  type DebugPoint = { x: number; y: number };

  let {
    heroPosition = null,
    remoteMarkers = [],
    onlinePlayers = [],
    chatMessages = [],
    debugPoint = { x: 0, y: 0 },
    fps = 0,
    serverConnected = false,
    playerName = "Player Hero",
    onMoveInput,
    onMinimapSelect,
    onReconnect,
    onChatSend,
  }: {
    heroPosition?: { x: number; z: number } | null;
    remoteMarkers?: { id: string; name: string; x: number; z: number; color: string; pulse?: boolean }[];
    onlinePlayers?: Array<{ id: string; name: string }>;
    chatMessages?: Array<{ id: string; author: string; text: string }>;
    debugPoint?: DebugPoint;
    fps?: number;
    serverConnected?: boolean;
    playerName?: string;
    onMoveInput?: (input: { x: number; y: number }) => void;
    onMinimapSelect?: (point: { x: number; z: number }) => void;
    onReconnect?: () => void;
    onChatSend?: (text: string) => void;
  } = $props();

  const mapSize = 1000;
  const isMobile =
    typeof window !== "undefined" &&
    ((typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(navigator.userAgent)) ||
      (typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches));

  let gameSeconds = $state(0);

  $effect(() => {
    const intervalId = window.setInterval(() => {
      gameSeconds += 1;
    }, 1000);

    return () => window.clearInterval(intervalId);
  });
</script>

<div class="moba-ui" aria-label="MOBA heads-up display">
  <GameClock seconds={gameSeconds} />
  <MessagePanel seconds={gameSeconds} />

  <div class="minimap-group">
    <MinimapPanel
      heroPosition={heroPosition}
      remoteMarkers={remoteMarkers}
      debugPoint={debugPoint}
      fps={fps}
      mapSize={mapSize}
      isMobile={isMobile}
      onMinimapSelect={onMinimapSelect}
    />

    <div class="chat-stack">
      <ChatPanel chatMessages={chatMessages} onChatSend={onChatSend} />
    </div>
  </div>

  <DisconnectOverlay serverConnected={serverConnected} onReconnect={onReconnect} />
  <PlayerListPanel onlinePlayers={onlinePlayers} serverConnected={serverConnected} onReconnect={onReconnect} />
</div>

<style>
  .moba-ui {
    position: fixed;
    inset: 0;
    z-index: 20;
    pointer-events: none;
  }

  .minimap-group {
    position: absolute;
    top: 16px;
    left: 16px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    z-index: 2;
  }

  .chat-stack {
    position: relative;
    z-index: 1;
    margin-top: 6px;
    pointer-events: auto;
    align-self: flex-start;
  }

  @media (max-width: 640px) {
    .minimap-group {
      top: 10px;
      left: 10px;
    }
  }
</style>
