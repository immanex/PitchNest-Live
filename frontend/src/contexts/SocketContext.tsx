import React, { createContext, useContext, useEffect, useState } from 'react';

interface SocketContextType {
  socket: WebSocket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
});

export const useSocketContext = () => useContext(SocketContext);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [socket, setSocket] = useState<WebSocket | null>(null);

  useEffect(() => {
    console.log("🔌 Connecting to PitchNest Brain...");
    
    // ✅ DYNAMIC URL FIX: Works seamlessly for Localhost, LAN IPs, and Cloud Deployments
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const hostname = window.location.hostname;
    const isLocal =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
      hostname.endsWith('.local');
    const explicitWs = import.meta.env.VITE_WS_BACKEND_URL as string | undefined;
    const onRender = hostname.includes('onrender.com');

    let WS_URL: string;
    if (explicitWs) {
      WS_URL = explicitWs;
    } else if (isLocal) {
      WS_URL = `${protocol}//${window.location.host}/ws`;
    } else if (onRender) {
      WS_URL = `${protocol}//${window.location.host}/ws`;
    } else {
      WS_URL = 'wss://pitchnestv1.onrender.com/ws';
    }

    // The backend accepts upgrades only on /ws. Preserve an explicitly
    // configured custom path, but normalize bare origins to the protected path.
    try {
      const parsed = new URL(WS_URL);
      if (!parsed.pathname || parsed.pathname === '/') parsed.pathname = '/ws';
      WS_URL = parsed.toString();
    } catch {
      console.error('Invalid VITE_WS_BACKEND_URL');
      return;
    }

    // Browser WebSockets cannot set Authorization. Offer the JWT as a protocol
    // token so it never appears in the URL, proxy logs or browser history.
    const token = localStorage.getItem('token');
    if (!token) return;

    const ws = new WebSocket(WS_URL, ['pitchnest-v1', `pitchnest-auth.${token}`]);

    ws.onopen = () => {
      console.log('✅ Connected to PitchNest Brain');
      setIsConnected(true);
      setSocket(ws);
    };

    ws.onclose = () => {
      console.log('❌ Disconnected from Brain');
      setIsConnected(false);
      setSocket(null);
    };

    ws.onerror = (error) => {
      console.error('⚠️ WebSocket Error:', error);
    };

    return () => {
      // Clean up when leaving the room
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
  }, []); // Empty array ensures this only runs ONCE now that Strict Mode is off

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};
