"use client";

/**
 * Hook for managing a WebSocket connection to the backend.
 *
 * Provides:
 * - connectionStatus: current state of the connection
 * - send(): send a typed message to the server
 * - lastMessage: the most recent server message (parsed)
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { WebSocketClient } from "@/lib/websocket";
import type { ClientMessage, ConnectionStatus, ServerMessage } from "@/types";

const BACKEND_WS_BASE = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

export function useWebSocket(sessionId: string) {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [lastMessage, setLastMessage] = useState<ServerMessage | null>(null);
  const clientRef = useRef<WebSocketClient | null>(null);

  // Create the client once
  useEffect(() => {
    const url = `${BACKEND_WS_BASE}/ws/session/${sessionId}`;

    const client = new WebSocketClient(
      url,
      // onMessage
      (raw) => {
        setLastMessage(raw as ServerMessage);
      },
      // onStatusChange
      (s) => {
        setStatus(s);
      }
    );

    clientRef.current = client;
    client.connect();

    return () => {
      client.disconnect();
      clientRef.current = null;
    };
  }, [sessionId]);

  const send = useCallback((message: ClientMessage) => {
    clientRef.current?.send(message);
  }, []);

  return { status, lastMessage, send };
}
