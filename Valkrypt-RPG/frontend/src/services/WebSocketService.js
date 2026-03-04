export class WebSocketService {
  constructor(url) {
    // default to same host where app is served, using ws or wss matching protocol
    if (!url) {
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
      url = `${proto}://${window.location.host}/ws`;
    }
    this.url = url;
    this.ws = null;
    this.listeners = new Map();
    this.queue = [];
  }

  connect() {
    return new Promise((resolve, reject) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }
      this.ws = new WebSocket(this.url);
      this.ws.onopen = () => {
        this.flushQueue();
        resolve();
        this.emit('connect');
      };
      this.ws.onmessage = (e) => this.handleMessage(e.data);
      this.ws.onerror = (e) => this.emit('error', e);
      this.ws.onclose = () => this.emit('disconnect');
    });
  }

  disconnect() {
    if (this.ws) this.ws.close();
    this.ws = null;
  }

  send(msg) {
    const text = JSON.stringify(msg);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(text);
    } else {
      this.queue.push(text);
    }
  }

  flushQueue() {
    while (this.queue.length) {
      const m = this.queue.shift();
      this.ws.send(m);
    }
  }

  handleMessage(data) {
    try {
      const msg = JSON.parse(data);
      this.emit(msg.type, msg);
    } catch (e) {
      console.error('ws parse error', e);
    }
  }

  on(event, cb) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(cb);
    return () => this.off(event, cb);
  }

  off(event, cb) {
    if (!this.listeners.has(event)) return;
    const arr = this.listeners.get(event);
    const idx = arr.indexOf(cb);
    if (idx > -1) arr.splice(idx, 1);
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(cb => cb(data));
    }
  }

  // convenience helpers
  joinRoom(roomCode, userId, username) {
    this.send({ type: 'joinRoom', roomCode, userId, username });
  }
  leaveRoom(roomCode) { this.send({ type: 'leaveRoom', roomCode }); }
  sendAction(roomCode, userId, username, action, message) {
    this.send({ type: 'gameAction', roomCode, userId, username, payload: { action, message } });
  }
  sendChat(roomCode, username, message) {
    this.send({ type: 'chatMessage', roomCode, username, payload: { message } });
  }
  startGame(roomCode, userId, username) { this.send({ type: 'startGame', roomCode, userId, username }); }
}

export const wsService = new WebSocketService();
