/**
 * ConnectionStatus badge.
 *
 * Shows the current WebSocket connection state with a colored indicator.
 */

import type { ConnectionStatus } from "@/types";

const STATUS_CONFIG: Record<ConnectionStatus, { label: string; color: string }> = {
  connecting: { label: "Connecting…", color: "bg-yellow-400" },
  connected: { label: "Connected", color: "bg-green-400" },
  disconnected: { label: "Disconnected", color: "bg-gray-400" },
  error: { label: "Error", color: "bg-red-400" },
};

interface Props {
  status: ConnectionStatus;
}

export function ConnectionBadge({ status }: Props) {
  const { label, color } = STATUS_CONFIG[status];

  return (
    <div className="flex items-center gap-2 text-sm text-gray-300">
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} />
      {label}
    </div>
  );
}
