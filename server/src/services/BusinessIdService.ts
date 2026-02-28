import redis from '../utils/redis';
import logger from '../utils/logger';
import { generateBusinessId, clearIdempotency, checkIdempotency } from '../middleware/idempotency';

export interface BusinessIdRecord {
  businessId: string;
  operationType: string;
  userId: string | number;
  resourceType: string;
  resourceId: string | number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: any;
  error?: string;
  createdAt: number;
  updatedAt: number;
  ttl: number;
}

export interface BusinessIdOptions {
  operationType: string;
  userId: string | number;
  resourceType: string;
  resourceId?: string | number;
  ttl?: number;
}

const DEFAULT_TTL = 86400; // 24小时

/**
 * 业务ID服务
 * 用于生成和管理唯一业务ID，防止重复操作
 */
export class BusinessIdService {
  private readonly prefix = 'bizid';
  private readonly lockTimeout = 30000; // 30秒

  /**
   * 生成业务ID
   */
  async generateBusinessId(
    options: BusinessIdOptions
  ): Promise<string> {
    const { operationType, userId, resourceType, resourceId } = options;

    let businessId: string;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      businessId = this.createBusinessId(operationType, userId, resourceType);
      attempts++;

      const existing = await this.getBusinessIdRecord(businessId);
      if (!existing) {
        break;
      }

      if (attempts >= maxAttempts) {
        throw new Error(`无法生成唯一业务ID，已尝试 ${maxAttempts} 次`);
      }

      await this.sleep(10);
    } while (true);

    return businessId;
  }

  /**
   * 创建业务ID
   */
  private createBusinessId(
    operationType: string,
    userId: string | number,
    resourceType: string
  ): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 11);
    const shortHash = Buffer.from(
      `${operationType}:${userId}:${resourceType}`
    ).toString('base64').substring(0, 8);

    return `BIZ${timestamp}${random}${shortHash}`.toUpperCase();
  }

  /**
   * 检查业务ID是否存在
   */
  async checkBusinessId(
    businessId: string
  ): Promise<BusinessIdRecord | null> {
    return await this.getBusinessIdRecord(businessId);
  }

  /**
   * 保存业务ID记录
   */
  async saveBusinessIdRecord(
    businessId: string,
    options: BusinessIdOptions,
    result?: any
  ): Promise<void> {
    const { operationType, userId, resourceType, resourceId, ttl = DEFAULT_TTL } = options;

    const record: BusinessIdRecord = {
      businessId,
      operationType,
      userId,
      resourceType,
      resourceId: resourceId || businessId,
      status: 'pending',
      result,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ttl,
    };

    const key = this.getBusinessIdKey(businessId);
    await redis.set(key, JSON.stringify(record), 'EX', ttl);

    logger.debug('[BusinessIdService] 业务ID记录已保存', { businessId, operationType });
  }

  /**
   * 更新业务ID状态
   */
  async updateBusinessIdStatus(
    businessId: string,
    status: BusinessIdRecord['status'],
    result?: any,
    error?: string
  ): Promise<void> {
    const record = await this.getBusinessIdRecord(businessId);

    if (!record) {
      throw new Error(`业务ID记录不存在: ${businessId}`);
    }

    record.status = status;
    record.updatedAt = Date.now();

    if (result !== undefined) {
      record.result = result;
    }

    if (error !== undefined) {
      record.error = error;
    }

    const key = this.getBusinessIdKey(businessId);
    await redis.set(key, JSON.stringify(record), 'EX', record.ttl);

    logger.debug('[BusinessIdService] 业务ID状态已更新', {
      businessId,
      status,
    });
  }

  /**
   * 获取业务ID记录
   */
  async getBusinessIdRecord(
    businessId: string
  ): Promise<BusinessIdRecord | null> {
    try {
      const key = this.getBusinessIdKey(businessId);
      const data = await redis.get(key);

      if (!data) {
        return null;
      }

      return JSON.parse(data) as BusinessIdRecord;
    } catch (error) {
      logger.error('[BusinessIdService] 获取业务ID记录失败', {
        businessId,
        error,
      });
      throw error;
    }
  }

  /**
   * 删除业务ID记录
   */
  async deleteBusinessIdRecord(businessId: string): Promise<void> {
    const key = this.getBusinessIdKey(businessId);
    await redis.del(key);

    logger.debug('[BusinessIdService] 业务ID记录已删除', { businessId });
  }

  /**
   * 检查并防止重复操作
   */
  async checkDuplicateOperation(
    options: BusinessIdOptions
  ): Promise<{ isDuplicate: boolean; businessId: string; existingRecord?: BusinessIdRecord }> {
    let businessId: string | null = null;
    let existingRecord: BusinessIdRecord | null = null;
    let attempts = 0;
    const maxAttempts = 5;

    do {
      businessId = this.createBusinessId(
        options.operationType,
        options.userId,
        options.resourceType
      );
      attempts++;

      existingRecord = await this.getBusinessIdRecord(businessId);

      if (!existingRecord) {
        await this.saveBusinessIdRecord(businessId, options);
        return {
          isDuplicate: false,
          businessId,
        };
      }

      if (existingRecord.status === 'completed' && existingRecord.result) {
        logger.info('[BusinessIdService] 检测到重复操作，返回已缓存结果', {
          businessId,
          operationType: options.operationType,
        });

        return {
          isDuplicate: true,
          businessId,
          existingRecord,
        };
      }

      if (attempts >= maxAttempts) {
        throw new Error(`无法生成唯一业务ID，已尝试 ${maxAttempts} 次`);
      }

      await this.sleep(10);
    } while (true);
  }

  /**
   * 获取业务ID键
   */
  private getBusinessIdKey(businessId: string): string {
    return `${this.prefix}:${businessId}`;
  }

  /**
   * 获取用户操作历史键
   */
  private getUserOperationsKey(
    userId: string | number,
    operationType: string
  ): string {
    return `${this.prefix}:user:${userId}:ops:${operationType}`;
  }

  /**
   * 睡眠
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const businessIdService = new BusinessIdService();