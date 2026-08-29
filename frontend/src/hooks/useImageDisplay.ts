"use client";

/**
 * Hook for tracking the latest AI-generated image command.
 *
 * Listens to WebSocket messages and extracts the latest
 * ImageCommandMessage for the UI to display.
 */

import { useEffect, useState } from "react";
import type { ImageCommandMessage, ServerMessage } from "@/types";

export function useImageDisplay(lastMessage: ServerMessage | null) {
  const [imageCommand, setImageCommand] = useState<ImageCommandMessage | null>(null);

  useEffect(() => {
    if (lastMessage?.type === "image_command") {
      setImageCommand(lastMessage);
    }
  }, [lastMessage]);

  return imageCommand;
}
