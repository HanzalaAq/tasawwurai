"use client";

/**
 * Hook for tracking the current visualization state.
 *
 * Listens to WebSocket messages and extracts the latest
 * VisualizationCommandMessage for the UI to render.
 */

import { useEffect, useState } from "react";
import type { ServerMessage, VisualizationCommandMessage } from "@/types";

export function useVisualization(lastMessage: ServerMessage | null) {
  const [command, setCommand] = useState<VisualizationCommandMessage | null>(null);

  useEffect(() => {
    if (lastMessage?.type === "visualization_command") {
      setCommand(lastMessage);
    }
  }, [lastMessage]);

  return command;
}
