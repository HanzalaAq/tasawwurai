/**
 * Lightweight WebSocket client with automatic reconnection.
 *
 * Features:
 * - Exponential backoff on disconnect (1s → 2s → 4s → … → 30s max)
 * - Typed message sending (ClientMessage)
 * - Callback-based message receiving (ServerMessage)
 */

import type { ClientMessage } from "@/types";

export type MessageHandler = (data: unknown) => void;
export type StatusHandler = (status: "connecting" | "connected" | "disconnected" | "error") => void;

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = true;

  private onMessage: MessageHandler;
  private onStatusChange: StatusHandler;

  constructor(url: string, onMessage: MessageHandler, onStatusChange: StatusHandler) {
    this.url = url;
    this.onMessage = onMessage;
    this.onStatusChange = onStatusChange;
  }

  /** Open the WebSocket connection. */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.shouldReconnect = true;
    this.onStatusChange("connecting");

    try {
      this.ws = new WebSocket(this.url);
    } catch {
      this.onStatusChange("error");
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.reconnectAttempt = 0;
      this.onStatusChange("connected");
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.onMessage(data);
      } catch {
        console.warn("[WS] Failed to parse message:", event.data);
      }
    };

    this.ws.onclose = () => {
      this.onStatusChange("disconnected");
      if (this.shouldReconnect) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      this.onStatusChange("error");
    };
  }

  /** Send a typed client message. */
  send(message: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn("[WS] Cannot send — not connected");
    }
  }

  /** Gracefully close the connection (no auto-reconnect). */
  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }

  /** Schedule a reconnection with exponential backoff. */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    const delay = Math.min(1000 * 2 ** this.reconnectAttempt, 30_000);
    this.reconnectAttempt++;

    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempt})`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
