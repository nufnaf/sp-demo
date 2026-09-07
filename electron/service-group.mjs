// Readiness is all-or-nothing; a failed start releases only processes we own.
export class ServiceGroup {
  constructor(services) { this.services = services; }
  start() {
    this.starting ??= (async () => {
      const starts = this.services.map((service) => service.start());
      try {
        const results = await Promise.all(starts);
        return { owned: results.some((result) => result.owned) };
      } catch (error) {
        await this.stop();
        await Promise.allSettled(starts);
        throw error;
      }
    })();
    return this.starting;
  }
  async stop() { await Promise.all(this.services.map((service) => service.stop())); }
}
