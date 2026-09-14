"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: ToastItem[];
  showToast: (toast: Omit<ToastItem, "id">) => string;
  dismissToast: (id: string) => void;
  toast: {
    success: (message: string, title?: string) => string;
    error: (message: string, title?: string) => string;
    warning: (message: string, title?: string) => string;
    info: (message: string, title?: string) => string;
  };
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    ({ type, title, message, duration = 5000 }: Omit<ToastItem, "id">) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const newToast: ToastItem = { id, type, title, message, duration };

      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          dismissToast(id);
        }, duration);
      }

      return id;
    },
    [dismissToast]
  );

  const toast = {
    success: useCallback(
      (message: string, title?: string) => showToast({ type: "success", message, title }),
      [showToast]
    ),
    error: useCallback(
      (message: string, title?: string) => showToast({ type: "error", message, title }),
      [showToast]
    ),
    warning: useCallback(
      (message: string, title?: string) => showToast({ type: "warning", message, title }),
      [showToast]
    ),
    info: useCallback(
      (message: string, title?: string) => showToast({ type: "info", message, title }),
      [showToast]
    ),
  };

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast, toast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-md w-full pointer-events-none p-2 sm:p-0"
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: () => void;
}) {
  const [isEntering, setIsEntering] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsEntering(false), 50);
    return () => clearTimeout(timer);
  }, []);

  const config = {
    success: {
      border: "border-emerald-500/30 bg-emerald-50/95 dark:bg-emerald-950/90 text-emerald-900 dark:text-emerald-100",
      icon: <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />,
      defaultTitle: "Success",
    },
    error: {
      border: "border-rose-500/30 bg-rose-50/95 dark:bg-rose-950/90 text-rose-900 dark:text-rose-100",
      icon: <AlertCircle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />,
      defaultTitle: "Error",
    },
    warning: {
      border: "border-amber-500/30 bg-amber-50/95 dark:bg-amber-950/90 text-amber-900 dark:text-amber-100",
      icon: <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />,
      defaultTitle: "Warning",
    },
    info: {
      border: "border-blue-500/30 bg-blue-50/95 dark:bg-blue-950/90 text-blue-900 dark:text-blue-100",
      icon: <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />,
      defaultTitle: "Notice",
    },
  }[toast.type];

  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-lg backdrop-blur-md transition-all duration-300 ${
        config.border
      } ${
        isEntering
          ? "translate-y-4 opacity-0 scale-95"
          : "translate-y-0 opacity-100 scale-100"
      }`}
      role="alert"
    >
      {config.icon}
      <div className="flex-1 text-sm min-w-0">
        <h4 className="font-semibold leading-tight mb-0.5">
          {toast.title || config.defaultTitle}
        </h4>
        <p className="text-xs opacity-90 break-words leading-relaxed">{toast.message}</p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="p-1 rounded-md opacity-70 hover:opacity-100 transition-opacity hover:bg-black/5 dark:hover:bg-white/10 shrink-0 -mr-1 -mt-1"
        aria-label="Close notification"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
