type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

type CacheLookup<T> = {
  value: T;
  stale: boolean;
  expiresAt: number;
};

export class MemoryCache {
  private entries = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | null {
    const entry = this.getEntry<T>(key);

    if (!entry) {
      return null;
    }

    if (entry.stale) {
      return null;
    }

    return entry.value as T;
  }

  getEntry<T>(key: string): CacheLookup<T> | null {
    const entry = this.entries.get(key);

    if (!entry) {
      return null;
    }

    return {
      value: entry.value as T,
      stale: entry.expiresAt <= Date.now(),
      expiresAt: entry.expiresAt,
    };
  }

  set<T>(key: string, value: T, ttlMs: number) {
    this.entries.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  async getOrSet<T>(
    key: string,
    ttlMs: number,
    factory: () => Promise<T>
  ): Promise<T> {
    const cachedValue = this.get<T>(key);

    if (cachedValue !== null) {
      return cachedValue;
    }

    const value = await factory();
    this.set(key, value, ttlMs);
    return value;
  }
}

export const memoryCache = new MemoryCache();
