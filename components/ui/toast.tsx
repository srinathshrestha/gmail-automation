// Toast notification component
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

export type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

let toastListeners: Array<(toasts: Toast[]) => void> = [];
let toasts: Toast[] = [];

function notifyListeners() {
  toastListeners.forEach((listener) => listener([...toasts]));
}

export function showToast(message: string, type: ToastType = "info") {
  const id = Math.random().toString(36).substring(7);
  toasts.push({ id, message, type });
  notifyListeners();

  // Auto-remove after 5 seconds
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    notifyListeners();
  }, 5000);
}

export function ToastContainer() {
  const [currentToasts, setCurrentToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const listener = (newToasts: Toast[]) => {
      setCurrentToasts(newToasts);
    };
    toastListeners.push(listener);
    setCurrentToasts([...toasts]);

    return () => {
      toastListeners = toastListeners.filter((l) => l !== listener);
    };
  }, []);

  if (currentToasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-md">
      {currentToasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}

function ToastItem({ toast }: { toast: Toast }) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    setIsVisible(true);
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => {
        toasts = toasts.filter((t) => t.id !== toast.id);
        notifyListeners();
      }, 300);
    }, 4700);

    return () => clearTimeout(timer);
  }, [toast.id]);

  const iconMap = {
    success: "Check",
    error: "X",
    info: "Shield",
  } as const;

  const colorMap = {
    success: "border-green-500/50 bg-green-500/10",
    error: "border-destructive/50 bg-destructive/10",
    info: "border-primary/50 bg-primary/10",
  } as const;

  return (
    <Card
      className={cn(
        "transition-all duration-300",
        isVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-full",
        colorMap[toast.type]
      )}
    >
      <CardContent className="flex items-center gap-3 p-4">
        <Icon
          name={iconMap[toast.type]}
          className={cn(
            "h-5 w-5 shrink-0",
            toast.type === "success" && "text-green-500",
            toast.type === "error" && "text-destructive",
            toast.type === "info" && "text-primary"
          )}
          size={20}
        />
        <p className="text-sm flex-1">{toast.message}</p>
        <button
          onClick={() => {
            toasts = toasts.filter((t) => t.id !== toast.id);
            notifyListeners();
          }}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <Icon name="X" size={16} />
        </button>
      </CardContent>
    </Card>
  );
}

