import { query, dbAvailable } from '../config/database';
import logger from '../utils/logger';

/**
 * 止盈止损服务
 * 检查并执行持仓的止盈止损订单
 */
export class StopLossTakeProfitService {
  private checkingInterval: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL = 1000; // 每秒检查一次

  /**
   * 启动止盈止损检查
   */
  start(): void {
    if (this.checkingInterval) {
      logger.warn('止盈止损服务已经在运行');
      return;
    }

    this.checkingInterval = setInterval(() => {
      this.checkAndExecuteStopLossTakeProfit();
    }, this.CHECK_INTERVAL);

    logger.info('止盈止损服务已启动');
  }

  /**
   * 停止止盈止损检查
   */
  stop(): void {
    if (this.checkingInterval) {
      clearInterval(this.checkingInterval);
      this.checkingInterval = null;
      logger.info('止盈止损服务已停止');
    }
  }

  /**
   * 检查并执行止盈止损
   */
  private async checkAndExecuteStopLossTakeProfit(): Promise<void> {
    try {
      // 检查数据库是否可用
      if (!dbAvailable) {
        return;
      }

      // 获取所有活跃的持仓
      const positions = await query(
        `SELECT * FROM positions WHERE status = 1 AND (stop_loss IS NOT NULL OR take_profit IS NOT NULL)`
      );

      if (positions.rows.length === 0) {
        return;
      }

      // 获取当前市场价格
      const symbolPrices = new Map<string, number>();
      for (const position of positions.rows) {
        if (!symbolPrices.has(position.symbol)) {
          const marketData = await query(
            `SELECT last_price FROM market_data WHERE symbol = $1 ORDER BY updated_at DESC LIMIT 1`,
            [position.symbol]
          );
          if (marketData.rows.length > 0) {
            symbolPrices.set(position.symbol, marketData.rows[0].last_price);
          }
        }
      }

      // 检查每个持仓是否触发止盈止损
      for (const position of positions.rows) {
        const currentPrice = symbolPrices.get(position.symbol);

        if (!currentPrice) {
          logger.warn(`无法获取 ${position.symbol} 的当前价格，跳过检查`);
          continue;
        }

        await this.checkPosition(position, currentPrice);
      }
    } catch (error) {
      // 只在非数据库连接错误时记录日志
      if (error && typeof error === 'object' && 'code' in error && error.code !== 'ECONNREFUSED') {
        logger.error('止盈止损检查失败:', error);
      }
    }
  }

  /**
   * 检查单个持仓是否触发止盈止损
   */
  private async checkPosition(position: any, currentPrice: number): Promise<void> {
    const { id, symbol, direction, entry_price, quantity, stop_loss, take_profit } = position;

    let shouldClose = false;
    let closeReason = '';
    let exitPrice = currentPrice;

    // 检查止损
    if (stop_loss !== null && stop_loss !== undefined) {
      if (direction === 'BUY' && currentPrice <= stop_loss) {
        shouldClose = true;
        closeReason = '止损触发';
        exitPrice = stop_loss;
      } else if (direction === 'SELL' && currentPrice >= stop_loss) {
        shouldClose = true;
        closeReason = '止损触发';
        exitPrice = stop_loss;
      }
    }

    // 检查止盈
    if (!shouldClose && take_profit !== null && take_profit !== undefined) {
      if (direction === 'BUY' && currentPrice >= take_profit) {
        shouldClose = true;
        closeReason = '止盈触发';
        exitPrice = take_profit;
      } else if (direction === 'SELL' && currentPrice <= take_profit) {
        shouldClose = true;
        closeReason = '止盈触发';
        exitPrice = take_profit;
      }
    }

    if (shouldClose) {
      await this.closePosition(position, exitPrice, closeReason);
    }
  }

  /**
   * 执行平仓
   */
  private async closePosition(position: any, exitPrice: number, reason: string): Promise<void> {
    const client = await (query as any).pool.connect();

    try {
      await client.query('BEGIN');

      // 检查持仓是否仍然有效
      const positionCheck = await client.query(
        `SELECT * FROM positions WHERE id = $1 AND status = 1 FOR UPDATE`,
        [position.id]
      );

      if (positionCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        logger.info(`持仓 ${position.id} 已经被平仓，跳过`);
        return;
      }

      const positionData = positionCheck.rows[0];

      // 计算盈亏
      let profit: number;
      if (positionData.direction === 'BUY') {
        profit = (exitPrice - positionData.entry_price) * positionData.quantity;
      } else {
        profit = (positionData.entry_price - exitPrice) * positionData.quantity;
      }

      // 释放保证金
      const marginToRelease = positionData.margin;

      // 更新持仓状态
      await client.query(
        `UPDATE positions SET
         status = 2,
         exit_price = $1,
         profit = $2,
         closed_at = CURRENT_TIMESTAMP,
         close_reason = $3
         WHERE id = $4`,
        [exitPrice, profit, reason, position.id]
      );

      // 更新账户余额
      await client.query(
        `UPDATE accounts SET
         frozen_margin = frozen_margin - $1,
         balance = balance + $1 + $2,
         total_profit = total_profit + $2
         WHERE user_id = $3`,
        [marginToRelease, profit, position.user_id]
      );

      // 更新相关订单状态
      await client.query(
        `UPDATE orders SET status = 2, closed_at = CURRENT_TIMESTAMP, exit_price = $1, profit = $2
         WHERE position_id = $3 AND status = 1`,
        [exitPrice, profit, position.id]
      );

      await client.query('COMMIT');

      logger.info(`止盈止损平仓成功`, {
        position_id: position.id,
        user_id: position.user_id,
        symbol: position.symbol,
        exit_price: exitPrice,
        profit,
        reason
      });
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`止盈止损平仓失败`, { position_id: position.id, error });
      throw error;
    } finally {
      client.release();
    }
  }
}

// 导出单例实例
export const stopLossTakeProfitService = new StopLossTakeProfitService();
