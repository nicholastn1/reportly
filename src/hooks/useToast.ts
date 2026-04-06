import { useState, useEffect, useCallback } from "react";

export function useToast(duration = 4000) {
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), duration);
      return () => clearTimeout(timer);
    }
  }, [toast, duration]);

  const showToast = useCallback((msg: string) => setToast(msg), []);

  return { toast, showToast };
}
