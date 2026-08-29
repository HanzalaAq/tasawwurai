/**
 * Shared TypeScript types for the TasawwurAI frontend.
 *
 * These mirror the Pydantic models on the backend to keep
 * the protocol contract identical on both sides.
 */

// --- Enums ---

export type VisualizationAction = "new" | "update" | "none";
export type SessionAction = "start" | "pause" | "resume" | "end";
export type RenderMode = "simulation" | "image" | "both";

// --- Server → Client Messages ---

export interface FormulaItem {
  name: string;
  latex: string;
}

export interface TheoryBlock {
  title: string;
  explanation: string;
  formulas: FormulaItem[];
  key_points: string[];
}

export interface VisualizationPayload {
  type: string;
  parameters: Record<string, unknown>;
}

export interface VisualizationCommandMessage {
  type: "visualization_command";
  command_id: string;
  action: VisualizationAction;
  subject: string;
  concept: string;
  visualization: VisualizationPayload;
  theory: TheoryBlock;
  render_mode: RenderMode;
  timestamp: number;
}

export interface ImageCommandMessage {
  type: "image_command";
  prompt: string;
  image_url: string;
  subject: string;
  concept: string;
  timestamp: number;
}

export interface TranscriptSegmentMessage {
  type: "transcript_segment";
  segment_id: string;
  text: string;
  is_final: boolean;
  timestamp: number;
}

export interface ErrorMessage {
  type: "error";
  code: string;
  message: string;
}

export interface PongMessage {
  type: "pong";
  timestamp: number;
}

/** Union of all messages the server can send. */
export type ServerMessage =
  | VisualizationCommandMessage
  | ImageCommandMessage
  | TranscriptSegmentMessage
  | ErrorMessage
  | PongMessage;

// --- Client → Server Messages ---

export interface PingMessage {
  type: "ping";
  timestamp: number;
}

export interface TestMessage {
  type: "test";
  subject: string;
  concept: string;
}

export interface ParameterChangeMessage {
  type: "parameter_change";
  visualization_type: string;
  parameters: Record<string, unknown>;
}

export interface SessionControlMessage {
  type: "session_control";
  action: SessionAction;
}

export interface DemoTextMessage {
  type: "demo_text";
  text: string;
}

export interface TranscriptMessage {
  type: "transcript";
  text: string;
}

/** Union of all messages the client can send. */
export type ClientMessage =
  | PingMessage
  | TestMessage
  | ParameterChangeMessage
  | SessionControlMessage
  | DemoTextMessage
  | TranscriptMessage;

// --- Application State ---

export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

export interface Session {
  id: string;
  status: "active" | "paused" | "ended";
}
