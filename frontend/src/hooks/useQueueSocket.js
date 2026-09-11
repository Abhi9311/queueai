import { useEffect, useRef, useState } from "react";

/**
 * Opens a WebSocket connection to /ws/queue and keeps `queueState` in sync
 * with every push from the backend. Reconnects automatically (with a short
 * backoff) if the connection drops, and exposes a simple `connected` flag
 * the UI uses to show the live/offline indicator.
 */
export function useQueueSocket() {
  const [queueState, setQueueState] = useState(null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);
  const retryDelay = useRef(1000);

  useEffect(() => {
    let cancelled = false;
    let retryTimeout;

    function connect() {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const url = `${protocol}//${window.location.host}/ws/queue`;
      const socket = new WebSocket(url);
      socketRef.current = socket;

      socket.onopen = () => {
        if (cancelled) return;
        setConnected(true);
        retryDelay.current = 1000;
      };

      socket.onmessage = (event) => {
        if (cancelled) return;
        try {
          const data = JSON.parse(event.data);
          setQueueState(data);
        } catch (err) {
          console.error("Failed to parse queue state", err);
        }
      };

      socket.onclose = () => {
        if (cancelled) return;
        setConnected(false);
        retryTimeout = setTimeout(connect, retryDelay.current);
        retryDelay.current = Math.min(retryDelay.current * 1.5, 10000);
      };

      socket.onerror = () => {
        socket.close();
      };
    }

    connect();

    return () => {
      cancelled = true;
      clearTimeout(retryTimeout);
      socketRef.current?.close();
    };
  }, []);

  return { queueState, connected };
}
