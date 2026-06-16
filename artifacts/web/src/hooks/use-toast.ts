import * as React from "react";

export type ToastVariant = "default" | "success" | "destructive";

export interface ToastItem {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
}

type State = { toasts: ToastItem[] };

let counter = 0;
let memoryState: State = { toasts: [] };
const listeners: Array<(state: State) => void> = [];

function setState(next: State) {
  memoryState = next;
  listeners.forEach((l) => l(memoryState));
}

// Imperative API — call from anywhere (mutation callbacks, etc.).
export function toast(input: Omit<ToastItem, "id">): string {
  const id = `t${++counter}`;
  setState({ toasts: [{ ...input, id }, ...memoryState.toasts].slice(0, 4) });
  return id;
}

export function dismissToast(id: string): void {
  setState({ toasts: memoryState.toasts.filter((t) => t.id !== id) });
}

export function useToast() {
  const [state, set] = React.useState<State>(memoryState);
  React.useEffect(() => {
    listeners.push(set);
    return () => {
      const i = listeners.indexOf(set);
      if (i > -1) listeners.splice(i, 1);
    };
  }, []);
  return { toasts: state.toasts, toast, dismiss: dismissToast };
}
