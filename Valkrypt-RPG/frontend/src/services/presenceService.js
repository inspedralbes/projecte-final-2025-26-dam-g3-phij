const HEARTBEAT_INTERVAL_MS = 15000;

class PresenceService {
  constructor() {
    this.timer = null;
    this.boundVisibility = () => {
      if (document.visibilityState === 'visible') {
        this.heartbeat();
      }
    };
  }

  getUserId() {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      return user?.id || user?._id || '';
    } catch {
      return '';
    }
  }

  getToken() {
    return localStorage.getItem('token') || '';
  }

  async heartbeat() {
    const userId = this.getUserId();
    const token = this.getToken();
    if (!userId || !token) return;

    try {
      await fetch('/api/social/presence/heartbeat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ userId })
      });
    } catch {
      // silent: presence heartbeat should not break UX
    }
  }

  start() {
    if (this.timer) return;
    this.heartbeat();
    this.timer = setInterval(() => this.heartbeat(), HEARTBEAT_INTERVAL_MS);
    document.addEventListener('visibilitychange', this.boundVisibility);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    document.removeEventListener('visibilitychange', this.boundVisibility);
  }
}

export const presenceService = new PresenceService();
