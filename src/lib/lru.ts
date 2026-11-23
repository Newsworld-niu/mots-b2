/**
 * Fixed-capacity Least Recently Used (LRU) cache backed by Map insertion order.
 */
export class LruCache<K, V> {
  private readonly map = new Map<K, V>();
  private readonly max: number;
  private readonly onEvict?: (key: K, value: V) => void;

  constructor(maxSize: number, onEvict?: (key: K, value: V) => void) {
    this.max = Number.isFinite(maxSize) ? Math.max(0, Math.floor(maxSize)) : 0;
    this.onEvict = onEvict;
  }

  get size(): number {
    return this.map.size;
  }

  has(key: K): boolean {
    return this.map.has(key);
  }

  /** Read without updating recency order. */
  peek(key: K): V | undefined {
    return this.map.get(key);
  }

  /** Read and promote key to most-recently-used position. */
  get(key: K): V | undefined {
    if (!this.map.has(key)) return undefined;
    const val = this.map.get(key)!;
    this.map.delete(key);
    this.map.set(key, val);
    return val;
  }

  /** Insert or update key as most-recently-used, evicting oldest entries beyond capacity. */
  set(key: K, value: V): this {
    if (this.max <= 0) return this;
    if (this.map.has(key)) {
      this.map.delete(key);
    }
    this.map.set(key, value);
    while (this.map.size > this.max) {
      const oldestKey = this.map.keys().next().value as K;
      const oldestVal = this.map.get(oldestKey)!;
      this.map.delete(oldestKey);
      this.onEvict?.(oldestKey, oldestVal);
    }
    return this;
  }

  delete(key: K): boolean {
    return this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  keys(): IterableIterator<K> {
    return this.map.keys();
  }

  values(): IterableIterator<V> {
    return this.map.values();
  }

  entries(): IterableIterator<[K, V]> {
    return this.map.entries();
  }
}
