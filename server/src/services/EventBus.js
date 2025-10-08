class EventBus {
  constructor(redis) {
    this.redis = redis;
    this.enabled = !!redis;
    this.channel = 'poets-codex-events';
  }
  async publish(event) {
    if (!this.enabled) return;
    try {
      await this.redis.publish(this.channel, JSON.stringify({
        ...event,
        ts: new Date().toISOString()
      }));
    } catch (e) {
      // non-fatal
    }
  }
}

module.exports = EventBus;
