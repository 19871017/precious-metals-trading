import { PoolClient } from 'pg';
import { query } from '../config/database';
import logger from '../utils/logger';

export interface AuditLogEntry {
  userId: number;
  operation: string;
  amount: number;
  beforeBalance: number;
  afterBalance: number;
  orderId?: number;
  positionId?: number;
  description?: string;
  metadata?: any;
  createdBy?: string;
}

export interface AuditLog extends AuditLogEntry {
  id: number;
  createdAt: Date;
}

export enum AuditOperation {
  DEPOSIT = 'DEPOSIT',
  WITHDRAW = 'WITHDRAW',
  FREEZE = 'FREEZE',
  UNFREEZE = 'UNFREEZE',
  COMMISSION = 'COMMISSION',
  PROFIT_LOSS = 'PROFIT_LOSS',
  MARGIN_FREEZE = 'MARGIN_FREEZE',
  MARGIN_RELEASE = 'MARGIN_RELEASE',
}

export class AuditLogService {
  async createAuditLog(
    client: PoolClient,
    log: AuditLogEntry
  ): Promise<void> {
    await client.query(
      `INSERT INTO audit_logs (
        user_id, operation_type, amount, before_balance, after_balance,
        related_order_id, related_position_id, description, metadata, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        log.userId,
        log.operation,
        log.amount,
        log.beforeBalance,
        log.afterBalance,
        log.orderId || null,
        log.positionId || null,
        log.description || '',
        JSON.stringify(log.metadata || {}),
        log.createdBy || 'SYSTEM',
      ]
    );

    logger.info(
      `Audit log created: user=${log.userId}, operation=${log.operation}, amount=${log.amount}`
    );
  }

  async getAuditLogsByUser(
    userId: number,
    limit: number = 100,
    offset: number = 0
  ): Promise<AuditLog[]> {
    const result = await query(
      `SELECT * FROM audit_logs
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return result.rows;
  }

  async getAuditLogsByOperation(
    operation: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<AuditLog[]> {
    const result = await query(
      `SELECT * FROM audit_logs
       WHERE operation_type = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [operation, limit, offset]
    );

    return result.rows;
  }

  async getAuditLogsByOrder(orderId: number): Promise<AuditLog[]> {
    const result = await query(
      `SELECT * FROM audit_logs
       WHERE related_order_id = $1
       ORDER BY created_at DESC`,
      [orderId]
    );

    return result.rows;
  }

  async getAuditLogsByPosition(positionId: number): Promise<AuditLog[]> {
    const result = await query(
      `SELECT * FROM audit_logs
       WHERE related_position_id = $1
       ORDER BY created_at DESC`,
      [positionId]
    );

    return result.rows;
  }

  async getAuditLogSummary(userId: number): Promise<{
    totalDeposits: number;
    totalWithdraws: number;
    totalCommissions: number;
    totalProfitLoss: number;
    lastOperationTime: Date | null;
  }> {
    const result = await query(
      `SELECT
         operation_type,
         SUM(amount) as total_amount,
         MAX(created_at) as last_operation_time
       FROM audit_logs
       WHERE user_id = $1
       GROUP BY operation_type`,
      [userId]
    );

    const summary = {
      totalDeposits: 0,
      totalWithdraws: 0,
      totalCommissions: 0,
      totalProfitLoss: 0,
      lastOperationTime: null as Date | null,
    };

    for (const row of result.rows) {
      switch (row.operation_type) {
        case AuditOperation.DEPOSIT:
          summary.totalDeposits = parseFloat(row.total_amount);
          break;
        case AuditOperation.WITHDRAW:
          summary.totalWithdraws = parseFloat(row.total_amount);
          break;
        case AuditOperation.COMMISSION:
          summary.totalCommissions = parseFloat(row.total_amount);
          break;
        case AuditOperation.PROFIT_LOSS:
          summary.totalProfitLoss = parseFloat(row.total_amount);
          break;
      }

      if (
        !summary.lastOperationTime ||
        row.last_operation_time > summary.lastOperationTime
      ) {
        summary.lastOperationTime = row.last_operation_time;
      }
    }

    return summary;
  }
}

export const auditLogService = new AuditLogService();
