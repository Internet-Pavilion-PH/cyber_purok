import {
  parseSocketMessage,
  type ArenaPlayer,
  type ChatMessage,
  type InputMessage,
  type JoinMessage,
  type PresenceMessage,
  type StateMessage,
  type WelcomeMessage,
} from "./protocol";

export * from "./protocol";

const HEARTBEAT_INTERVAL_MS = 30_000;
const HEARTBEAT_TIMEOUT_MS = 15_000;

export function getArenaSocketUrl(): string {
  const envUrl = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env
    ?.VITE_ARENA_SOCKET_URL;
  if (envUrl) return envUrl;

  return "wss://cyberpurok_server.workers-and-artisans.workers.dev/moba";
}

export class MultiplayerSocket {
  private socket: WebSocket | null = null;
  private stateHandler: ((message: StateMessage) => void) | null = null;
  private welcomeHandler: ((message: WelcomeMessage) => void) | null = null;
  private presenceHandler: ((message: PresenceMessage) => void) | null = null;
  private chatHandler: ((message: ChatMessage) => void) | null = null;
  private guavaHandler: ((message: import("./protocol").GuavaStateMessage | import("./protocol").GuavaPickupMessage) => void) | null = null;
  private closeHandler: (() => void) | null = null;
  private errorHandler: ((event: Event) => void) | null = null;

  private pendingOptions?: {
    url?: string;
    userId?: string;
    name?: string;
    getPosition?: () => { x: number; z: number } | null;
    onState?: (message: StateMessage) => void;
    onWelcome?: (message: WelcomeMessage) => void;
    onPresence?: (message: PresenceMessage) => void;
    onChat?: (message: ChatMessage) => void;
    onGuava?: (message: import("./protocol").GuavaStateMessage | import("./protocol").GuavaPickupMessage) => void;
    onClose?: () => void;
    onError?: (event: Event) => void;
  };

  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimeout: ReturnType<typeof setTimeout> | null = null;
  private heartbeatPending = false;
  private reconnectAttempt = 0;
  private shouldReconnect = true;
  private connectionSequence = 0;

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }

    this.heartbeatPending = false;
  }

  private startHeartbeat() {
    this.stopHeartbeat();

    this.heartbeatTimer = setInterval(() => {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        return;
      }

      if (this.heartbeatPending) {
        this.socket.close();
        return;
      }

      this.heartbeatPending = true;
      this.socket.send(JSON.stringify({ type: "ping" }));

      this.heartbeatTimeout = setTimeout(() => {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
          console.warn("Socket ping timed out; closing connection.");
          this.socket.close();
        }
      }, HEARTBEAT_TIMEOUT_MS);
    }, HEARTBEAT_INTERVAL_MS);
  }

  private handlePong() {
    this.heartbeatPending = false;

    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  connect(options?: {
    url?: string;
    userId?: string;
    name?: string;
    getPosition?: () => { x: number; z: number } | null;
    onState?: (message: StateMessage) => void;
    onWelcome?: (message: WelcomeMessage) => void;
    onPresence?: (message: PresenceMessage) => void;
    onChat?: (message: ChatMessage) => void;
    onGuava?: (message: import("./protocol").GuavaStateMessage | import("./protocol").GuavaPickupMessage) => void;
    onClose?: () => void;
    onError?: (event: Event) => void;
  }) {
    this.pendingOptions = options;
    this.shouldReconnect = true;
    this.connectionSequence += 1;
    const connectionId = this.connectionSequence;

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.close();
    }

    const url = options?.url ?? getArenaSocketUrl();
    const socket = new WebSocket(url);
    this.socket = socket;

    this.stateHandler = options?.onState ?? null;
    this.welcomeHandler = options?.onWelcome ?? null;
    this.presenceHandler = options?.onPresence ?? null;
    this.chatHandler = options?.onChat ?? null;
    this.guavaHandler = options?.onGuava ?? null;
    this.closeHandler = options?.onClose ?? null;
    this.errorHandler = options?.onError ?? null;

    this.socket.onopen = () => {
      if (socket !== this.socket || this.connectionSequence !== connectionId) {
        return;
      }

      console.log("server connected");
      this.reconnectAttempt = 0;
      this.startHeartbeat();
      this.sendJoin(options?.userId, options?.name ?? "Hero", options?.getPosition?.());
    };

    this.socket.onmessage = (event) => {
      if (socket !== this.socket || this.connectionSequence !== connectionId) {
        return;
      }

      const data = parseSocketMessage(event.data);
      if (!data) {
        return;
      }

      if (data.type === "pong") {
        this.handlePong();
        return;
      }

      if (data.type === "ping") {
        if (this.socket?.readyState === WebSocket.OPEN) {
          this.socket.send(JSON.stringify({ type: "pong" }));
        }
        return;
      }

      if (data.type === "welcome") {
        this.welcomeHandler?.(data);
        return;
      }

      if (data.type === "state") {
        this.stateHandler?.(data);
        return;
      }

      if (data.type === "presence") {
        this.presenceHandler?.(data);
        return;
      }

      if (data.type === "chat") {
        this.chatHandler?.(data);
        return;
      }

      if (data.type === "guava" || data.type === "guava_pickup") {
        this.guavaHandler?.(data);
      }
    };

    this.socket.onclose = (event) => {
      if (socket !== this.socket && this.socket !== null) {
        return;
      }

      if (this.connectionSequence !== connectionId) {
        return;
      }

      this.stopHeartbeat();

      if (!this.shouldReconnect) {
        this.closeHandler?.();
        this.socket = null;
        return;
      }

      const delay = Math.min(4000, 1000 * 2 ** this.reconnectAttempt);
      this.reconnectAttempt += 1;

      console.log(`socket closed, reconnecting in ${delay}ms`);
      this.reconnectTimer = setTimeout(() => {
        if (!this.pendingOptions) return;
        this.connect(this.pendingOptions);
      }, delay);
    };

    this.socket.onerror = (event) => {
      if (socket !== this.socket || this.connectionSequence !== connectionId) {
        return;
      }

      this.errorHandler?.(event);
    };

    return this.socket;
  }

  sendJoin(userId?: string, name = "Hero", position?: { x: number; z: number } | null) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;

    const payload: JoinMessage = {
      type: "join",
      userId,
      name,
      x: position?.x,
      z: position?.z,
    };

    this.socket.send(JSON.stringify(payload));
  }

  sendInput(input: InputMessage) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify(input));
  }

  sendChat(text: string, senderName = "Hero", senderId?: string) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN || !text.trim()) return;

    this.socket.send(
      JSON.stringify({
        type: "chat",
        senderId: senderId ?? "local",
        senderName,
        text: text.trim(),
        ts: Date.now(),
      } satisfies ChatMessage),
    );
  }

  sendMove(moveX = 0, moveY = 0, yaw = 0) {
    this.sendInput({
      type: "input",
      moveX,
      moveY,
      yaw,
    });
  }

  close() {
    this.shouldReconnect = false;
    this.stopHeartbeat();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.close();
    }
  }

  get connected() {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }
}

export const createMultiplayerSocket = (options?: {
  url?: string;
  userId?: string;
  name?: string;
  onState?: (message: StateMessage) => void;
  onWelcome?: (message: WelcomeMessage) => void;
  onPresence?: (message: PresenceMessage) => void;
  onChat?: (message: ChatMessage) => void;
  onGuava?: (message: import("./protocol").GuavaStateMessage | import("./protocol").GuavaPickupMessage) => void;
  onClose?: () => void;
  onError?: (event: Event) => void;
}) => new MultiplayerSocket().connect(options);
