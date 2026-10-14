import { io, Socket } from 'socket.io-client';

export type ConnectionState =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'RECONNECTING'
  | 'SUSPENDED'
  | 'CLOSING';

export type ConnectionStateListener = (state: ConnectionState) => void;

class ChatConnectionManager {
  private socket: Socket | null = null;
  private state: ConnectionState = 'DISCONNECTED';
  private stateListeners = new Set<ConnectionStateListener>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 20;
  private idleTimer: any = null;
  private idleTimeoutMs = 120000; // 2 minutes background suspension
  private activeSubscribers = 0;
  private readonly tabId = typeof window !== 'undefined' ? Math.random().toString(36).substring(2, 9) : 'tab-srv';
  private broadcastChannel: BroadcastChannel | null = null;
  private tabEventListeners = new Set<(event: { type: string; payload: any }) => void>();
  private customEventListeners = new Map<string, Set<(...args: any[]) => void>>();

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel('mcom_chat_tab_bus');
        this.broadcastChannel.onmessage = (event) => {
          // Ignore echoes sent by this same tab
          if (event.data?.originTabId === this.tabId) return;
          if (event.data?.type) {
            this.tabEventListeners.forEach((fn) => {
              try {
                fn(event.data);
              } catch (e) {
                console.error('[ChatConnection] tab event listener error:', e);
              }
            });
          }
        };
      } catch (e) {
        console.warn('[ChatConnection] BroadcastChannel unavailable:', e);
      }
    }
  }

  broadcastTabEvent(type: string, payload: any) {
    try {
      this.broadcastChannel?.postMessage({ type, payload, originTabId: this.tabId });
    } catch {
      // Ignore fallback
    }
  }

  onTabEvent(listener: (event: { type: string; payload: any }) => void): () => void {
    this.tabEventListeners.add(listener);
    return () => this.tabEventListeners.delete(listener);
  }

  private getSocketUrl(): string {
    const raw =
      import.meta.env.VITE_BACKEND_URL ||
      (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/api\/v1\/?$/, '') : '') ||
      'http://localhost:3010';
    return raw.replace(/\/api\/v1\/?$/, '');
  }

  private getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('auth_token');
  }

  getState(): ConnectionState {
    return this.state;
  }

  private setState(newState: ConnectionState) {
    if (this.state === newState) return;
    this.state = newState;
    this.stateListeners.forEach((listener) => {
      try {
        listener(newState);
      } catch (e) {
        console.error('[ChatConnection] listener error:', e);
      }
    });
  }

  onStateChange(listener: ConnectionStateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.state);
    return () => this.stateListeners.delete(listener);
  }

  connect(): Socket | null {
    const token = this.getToken();
    if (!token) {
      this.setState('DISCONNECTED');
      return null;
    }

    if (this.socket && (this.socket.connected || this.state === 'CONNECTING')) {
      return this.socket;
    }

    this.setState('CONNECTING');
    const baseUrl = this.getSocketUrl();

    this.socket = io(`${baseUrl}/chat`, {
      auth: { token: `Bearer ${token}` },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 15000,
      randomizationFactor: 0.5,
      autoConnect: true,
      timeout: 20000,
    });

    this.setupSocketHandlers();
    this.setupWindowLifecycle();

    return this.socket;
  }

  private setupSocketHandlers() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      this.reconnectAttempts = 0;
      this.setState('CONNECTED');
      // Re-register any active custom event listeners on the new/reconnected socket
      this.customEventListeners.forEach((listeners, ev) => {
        listeners.forEach((listener) => {
          this.socket?.on(ev, listener);
        });
      });
    });

    this.socket.on('disconnect', (reason) => {
      if (reason === 'io client disconnect') {
        this.setState('DISCONNECTED');
      } else {
        this.setState('RECONNECTING');
      }
    });

    this.socket.on('connect_error', (err) => {
      console.warn('[ChatConnection] connect_error:', err.message);
      if (err.message.includes('Unauthorized') || err.message.includes('jwt')) {
        this.setState('DISCONNECTED');
        this.disconnect();
      } else {
        this.setState('RECONNECTING');
      }
    });

    this.socket.io.on('reconnect_attempt', (attempt) => {
      this.reconnectAttempts = attempt;
      this.setState('RECONNECTING');
    });

    this.socket.io.on('reconnect_failed', () => {
      this.setState('DISCONNECTED');
    });
  }

  private setupWindowLifecycle() {
    if (typeof window === 'undefined') return;

    // Reset idle timer on user activity
    const handleActivity = () => {
      if (this.idleTimer) clearTimeout(this.idleTimer);
      if (this.state === 'SUSPENDED') {
        this.resume();
      }
      this.idleTimer = setTimeout(() => {
        this.suspendIfIdle();
      }, this.idleTimeoutMs);
    };

    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        handleActivity();
      }
    });

    window.addEventListener('focus', handleActivity);
    window.addEventListener('online', () => {
      if (this.state === 'DISCONNECTED' || this.state === 'RECONNECTING') {
        this.connect();
      }
    });
  }

  private suspendIfIdle() {
    // Only suspend if no components are actively holding focus
    if (document.hidden && this.socket && this.socket.connected) {
      this.setState('SUSPENDED');
      this.socket.disconnect();
    }
  }

  resume() {
    if (this.state === 'SUSPENDED' || (this.socket && !this.socket.connected)) {
      this.connect();
    }
  }

  disconnect() {
    this.setState('CLOSING');
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.setState('DISCONNECTED');
  }

  getSocket(): Socket | null {
    if (!this.socket && this.getToken()) {
      return this.connect();
    }
    return this.socket;
  }

  emit(event: string, data?: any, callback?: (response: any) => void) {
    const s = this.getSocket();
    if (!s) return;
    if (callback) {
      s.emit(event, data, callback);
    } else {
      s.emit(event, data);
    }
  }

  on(event: string, callback: (...args: any[]) => void): () => void {
    if (!this.customEventListeners.has(event)) {
      this.customEventListeners.set(event, new Set());
    }
    this.customEventListeners.get(event)!.add(callback);

    if (this.socket) {
      this.socket.on(event, callback);
    }

    return () => {
      this.customEventListeners.get(event)?.delete(callback);
      if (this.socket) {
        this.socket.off(event, callback);
      }
    };
  }

  subscribe(): () => void {
    this.activeSubscribers++;
    if (this.activeSubscribers === 1 && this.state === 'DISCONNECTED') {
      this.connect();
    }

    return () => {
      this.activeSubscribers = Math.max(0, this.activeSubscribers - 1);
    };
  }
}

export const chatConnection = new ChatConnectionManager();
