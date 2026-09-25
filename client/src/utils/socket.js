import { io } from 'socket.io-client';

const getSocketUrl = () => {
  if (import.meta.env.DEV) {
    return 'http://localhost:3001';
  }
  // On production local network deployment, point to backend on port 3001 of the accessing host IP
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  return `${protocol}//${hostname}:3001`;
};

export const socket = io(getSocketUrl(), {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
});
