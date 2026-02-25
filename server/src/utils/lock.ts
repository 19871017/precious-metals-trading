/**
 * 简单的锁工具
 * 用于防止并发操作导致的竞态条件
 */

export class SimpleLock {
  private locks: Map<string, Promise<void>> = new Map();

  /**
   * 获取锁
   * @param key 锁的键
   * @returns Promise，当锁可用时自动释放
   */
  async acquire(key: string): Promise<() => void> {
    // 等待现有锁释放
    while (this.locks.has(key)) {
      await this.locks.get(key);
    }

    // 创建新锁
    let releaseResolve: (() => void) | null = null;
    const lockPromise = new Promise<void>((resolve) => {
      releaseResolve = resolve;
    });

    this.locks.set(key, lockPromise);

    // 返回释放函数
    return () => {
      if (releaseResolve) {
        releaseResolve();
        this.locks.delete(key);
      }
    };
  }

  /**
   * 尝试获取锁（非阻塞）
   * @param key 锁的键
   * @returns 是否成功获取锁
   */
  tryAcquire(key: string): boolean {
    if (this.locks.has(key)) {
      return false;
    }

    let releaseResolve: (() => void) | null = null;
    const lockPromise = new Promise<void>((resolve) => {
      releaseResolve = resolve;
    });

    this.locks.set(key, lockPromise);
    return true;
  }

  /**
   * 执行带锁的操作
   * @param key 锁的键
   * @param fn 要执行的函数
   * @returns 函数执行结果
   */
  async runWithLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const release = await this.acquire(key);
    try {
      return await fn();
    } finally {
      release();
    }
  }
}

// 导出单例实例
export const orderLock = new SimpleLock();
export const marginLock = new SimpleLock();
export const positionLock = new SimpleLock();
