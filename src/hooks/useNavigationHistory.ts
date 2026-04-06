import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export function useNavigationHistory() {
  const location = useLocation();
  const navigate = useNavigate();
  const backStack = useRef<string[]>([]);
  const forwardStack = useRef<string[]>([]);
  const skipRecord = useRef(false);
  const prevPath = useRef(location.pathname);
  const [, rerender] = useState(0);

  useEffect(() => {
    const current = location.pathname;
    if (current === prevPath.current) return;

    if (skipRecord.current) {
      skipRecord.current = false;
    } else {
      backStack.current.push(prevPath.current);
      forwardStack.current = [];
    }
    prevPath.current = current;
    rerender((n) => n + 1);
  }, [location.pathname]);

  const goBack = useCallback(() => {
    const prev = backStack.current.pop();
    if (prev == null) return;
    forwardStack.current.push(prevPath.current);
    skipRecord.current = true;
    navigate(prev);
  }, [navigate]);

  const goForward = useCallback(() => {
    const next = forwardStack.current.pop();
    if (next == null) return;
    backStack.current.push(prevPath.current);
    skipRecord.current = true;
    navigate(next);
  }, [navigate]);

  return {
    canGoBack: backStack.current.length > 0,
    canGoForward: forwardStack.current.length > 0,
    goBack,
    goForward,
  };
}
