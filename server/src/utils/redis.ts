import { createClient, RedisClientType } from 'redis';

export class RedisClient {
  private client: RedisClientType | null = null;
  private isConnected: boolean = false;

  constructor() {
    this.connect();
  }

  private async connect() {
    try {
      this.client = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              console.error('Redis重连次数超过限制');
              return new Error('重连失败');
            }
            return Math.min(retries * 100, 3000);
          }
        }
      });

      this.client.on('error', (err) => console.error('Redis错误:', err));
      this.client.on('connect', () => {
        console.log('Redis连接成功');
        this.isConnected = true;
      });

      await this.client.connect();
    } catch (error) {
      console.error('Redis连接失败:', error);
      this.isConnected = false;
    }
  }

  async set(key: string, value: string, mode?: string, seconds?: number): Promise<void> {
    if (!this.client || !this.isConnected) {
      throw new Error('Redis未连接');
    }
    if (mode === 'EX' && seconds !== undefined) {
      await this.client.setEx(key, seconds, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.client || !this.isConnected) {
      throw new Error('Redis未连接');
    }
    return await this.client.get(key);
  }

  async del(key: string): Promise<number> {
    if (!this.client || !this.isConnected) {
      throw new Error('Redis未连接');
    }
    return await this.client.del(key);
  }

  async mget(keys: string[]): Promise<(string | null)[]> {
    if (!this.client || !this.isConnected) {
      throw new Error('Redis未连接');
    }
    return await this.client.mGet(keys);
  }

  async exists(key: string): Promise<number> {
    if (!this.client || !this.isConnected) {
      throw new Error('Redis未连接');
    }
    return await this.client.exists(key);
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      throw new Error('Redis未连接');
    }
    return await this.client.expire(key, seconds);
  }

  async ttl(key: string): Promise<number> {
    if (!this.client || !this.isConnected) {
      throw new Error('Redis未连接');
    }
    return await this.client.ttl(key);
  }

  async hset(key: string, field: string, value: string): Promise<number> {
    if (!this.client || !this.isConnected) {
      throw new Error('Redis未连接');
    }
    return await this.client.hSet(key, field, value);
  }

  async hget(key: string, field: string): Promise<string | undefined> {
    if (!this.client || !this.isConnected) {
      throw new Error('Redis未连接');
    }
    return await this.client.hGet(key, field);
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    if (!this.client || !this.isConnected) {
      throw new Error('Redis未连接');
    }
    return await this.client.hGetAll(key);
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
      console.log('Redis连接已关闭');
    }
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }
}

const redisInstance = new RedisClient();
export default redisInstance;
