/**
 * Toast system — premium notifications with zero browser alerts.
 *
 * ToastProvider mounts once in the root layout; the `useToast` hook
 * exposes push functions for: success · error · info · warning · ai.
 * Toasts animate in/out via framer-motion and auto-dismiss.
 */

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";

export type ToastKind = "success" | "error" | "info" | "warning" | "ai";

export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  message?: string;
  duration: number;
}

type PushOptions = { title: string; message?: string; duration?: number };

interface ToastApi {
  success: (o: PushOptions) => void;
  error: (o: PushOptions) => void;
  info: (o: PushOptions) => void;
  warning: (o: PushOptions) => void;
  ai: (o: PushOptions) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

const KIND_STYLES: Record<ToastKind, { icon: ReactNode; accent: string; glow: string }> = {
  success: {
    accent: "border-emerald-600/25",
    glow: "shadow-[0_12px_32px_-12px_rgba(5,150,105,0.35)]",
    icon: (
      <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  error: {
    accent: "border-rose-600/25",
    glow: "shadow-[0_12px_32px_-12px_rgba(225,29,72,0.35)]",
    icon: (
      <svg className="h-4 w-4 text-rose-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
      </svg>
    ),
  },
  info: {
    accent: "border-azure-600/30",
    glow: "shadow-[0_12px_32px_-12px_rgba(78,136,212,0.4)]",
    icon: (
      <svg className="h-4 w-4 text-azure-700" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
      </svg>
    ),
  },
  warning: {
    accent: "border-amber-600/25",
    glow: "shadow-[0_12px_32px_-12px_rgba(217,119,6,0.35)]",
    icon: (
      <svg className="h-4 w-4 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    ),
  },
  ai: {
    accent: "border-steel-500/30",
    glow: "shadow-[0_12px_32px_-12px_rgba(78,136,212,0.45)]",
    icon: (
      <svg className="h-4 w-4 text-steel-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
      </svg>
    ),
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);
  const timersRef = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (kind: ToastKind, { title, message, duration = 4200 }: PushOptions) => {
      idRef.current += 1;
      const id = idRef.current;
      setToasts((prev) => [...prev.slice(-3), { id, kind, title, message, duration }]);
      timersRef.current.set(
        id,
        setTimeout(() => dismiss(id), duration)
      );
    },
    [dismiss]
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (o) => push("success", o),
      error: (o) => push("error", o),
      info: (o) => push("info", o),
      warning: (o) => push("warning", o),
      ai: (o) => push("ai", o),
      dismiss,
    }),
    [push, dismiss]
  );

  // Clear pending timers on unmount
  useEffect(() => {
    const timers = timersRef.current;
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Viewport — top right, below any header chrome */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed right-4 top-4 z-[90] flex w-[min(92vw,360px)] flex-col gap-2"
      >
        <AnimatePresence>
          {toasts.map((t) => {
            const style = KIND_STYLES[t.kind];
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, x: 32, scale: 0.96 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 24, scale: 0.96 }}
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
                className={`glass-panel pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 ${style.accent} ${style.glow}`}
                role="status"
              >
                <span className="mt-0.5 shrink-0">{style.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-dusk-800">{t.title}</p>
                  {t.message && (
                    <p className="mt-0.5 text-xs leading-relaxed text-steel-600">{t.message}</p>
                  )}
                </div>
                <button
                  onClick={() => dismiss(t.id)}
                  className="shrink-0 rounded-md p-1 text-steel-400 transition-colors hover:bg-steel-500/10 hover:text-dusk-700"
                  aria-label="Dismiss notification"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
