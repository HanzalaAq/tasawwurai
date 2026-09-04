/**
 * ConnectionBadge — connection state indicator.
 *
 * Now a thin wrapper over the shared StatusChip language so every
 * status in the app speaks the same visual dialect.
 */

import type { ConnectionStatus } from "@/types";
import { StatusChip } from "@/components/ui/StatusChip";

const STATUS_VARIANT: Record<ConnectionStatus, Parameters<typeof StatusChip>[0]["variant"]> = {
  connecting: "connecting",
  connected: "connected",
  disconnected: "disconnected",
  error: "error",
};

interface Props {
  status: ConnectionStatus;
}

export function ConnectionBadge({ status }: Props) {
  return <StatusChip variant={STATUS_VARIANT[status]} size="xs" />;
}
