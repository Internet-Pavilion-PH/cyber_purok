export type ArenaPlayer = {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  hp: number;
};

export type WelcomeMessage = {
  type: "welcome";
  you: string;
};

export type StateMessage = {
  type: "state";
  players: ArenaPlayer[];
};

export type PresenceMessage = {
  type: "presence";
  count: number;
  ids: string[];
  you: string;
};

export type SocketMessage = WelcomeMessage | StateMessage | PresenceMessage;

export type InputMessage = {
  type: "input";
  moveX?: number;
  moveY?: number;
  yaw?: number;
};

export type JoinMessage = {
  type: "join";
  userId?: string;
  name?: string;
};

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
  private closeHandler: (() => void) | null = null;
  private errorHandler: ((event: Event) => void) | null = null;

  connect(options?: {
    url?: string;
    userId?: string;
    name?: string;
    onState?: (message: StateMessage) => void;
    onWelcome?: (message: WelcomeMessage) => void;
    onPresence?: (message: PresenceMessage) => void;
    onClose?: () => void;
    onError?: (event: Event) => void;
  }) {
    this.close();

    const url = options?.url ?? getArenaSocketUrl();
    this.socket = new WebSocket(url);

    this.stateHandler = options?.onState ?? null;
    this.welcomeHandler = options?.onWelcome ?? null;
    this.presenceHandler = options?.onPresence ?? null;
    this.closeHandler = options?.onClose ?? null;
    this.errorHandler = options?.onError ?? null;

    this.socket.onopen = () => {
      console.log("server connected");
      this.sendJoin(options?.userId, options?.name ?? "Hero");
    };

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as SocketMessage;

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
        }
      } catch (error) {
        console.error("Failed to parse multiplayer socket message:", error);
      }
    };

    this.socket.onclose = () => {
      this.closeHandler?.();
    };

    this.socket.onerror = (event) => {
      this.errorHandler?.(event);
    };

    return this.socket;
  }

  sendJoin(userId?: string, name = "Hero") {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;

    const payload: JoinMessage = {
      type: "join",
      userId,
      name,
    };

    this.socket.send(JSON.stringify(payload));
  }

  sendInput(input: InputMessage) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify(input));
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
    if (this.socket) {
      this.socket.close();
      this.socket = null;
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
  onClose?: () => void;
  onError?: (event: Event) => void;
}) => new MultiplayerSocket().connect(options);
