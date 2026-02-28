import { Router } from 'express';
import { accountService } from '../services/AccountService';
import { transactionManager } from '../config/TransactionManager';
import logger from '../utils/logger';

export function createAccountRouter(): Router {
  const router = Router();

  /**
   * POST /account/balance/update
   * 原子化更新账户余额
   */
  router.post('/balance/update', async (req, res) => {
    try {
      const { userId, amount, operation, relatedOrderId, relatedPositionId, description, metadata, strictMode } = req.body;

      const result = await accountService.updateBalanceAtomic({
        userId,
        amount,
        operation,
        relatedOrderId,
        relatedPositionId,
        description,
        metadata,
        strictMode,
      });

      res.json({
        code: 0,
        message: '余额更新成功',
        data: result,
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error('[AccountAPI] 更新余额失败:', error);

      res.status(400).json({
        code: 400,
        message: error.message || '更新余额失败',
        data: null,
        timestamp: Date.now(),
      });
    }
  });

  /**
   * POST /account/balance/batch-update
   * 批量原子化更新账户余额
   */
  router.post('/balance/batch-update', async (req, res) => {
    try {
      const { requests } = req.body;

      if (!Array.isArray(requests)) {
        return res.status(400).json({
          code: 400,
          message: 'requests must be an array',
          data: null,
          timestamp: Date.now(),
        });
      }

      const results = await accountService.batchUpdateBalanceAtomic(requests);

      res.json({
        code: 0,
        message: '批量更新完成',
        data: {
          total: results.length,
          success: results.filter((r) => r.success).length,
          failed: results.filter((r) => !r.success).length,
          results,
        },
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error('[AccountAPI] 批量更新余额失败:', error);

      res.status(400).json({
        code: 400,
        message: error.message || '批量更新失败',
        data: null,
        timestamp: Date.now(),
      });
    }
  });

  /**
   * POST /account/freeze
   * 冻结资金
   */
  router.post('/freeze', async (req, res) => {
    try {
      const { userId, amount, reason, relatedOrderId, relatedPositionId } = req.body;

      const result = await accountService.freezeBalanceAtomic(
        userId,
        amount,
        reason,
        relatedOrderId,
        relatedPositionId
      );

      res.json({
        code: 0,
        message: '冻结成功',
        data: result,
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error('[AccountAPI] 冻结失败:', error);

      res.status(400).json({
        code: 400,
        message: error.message || '冻结失败',
        data: null,
        timestamp: Date.now(),
      });
    }
  });

  /**
   * POST /account/unfreeze
   * 解冻资金
   */
  router.post('/unfreeze', async (req, res) => {
    try {
      const { userId, amount, reason, relatedOrderId, relatedPositionId } = req.body;

      const result = await accountService.unfreezeBalanceAtomic(
        userId,
        amount,
        reason,
        relatedOrderId,
        relatedPositionId
      );

      res.json({
        code: 0,
        message: '解冻成功',
        data: result,
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error('[AccountAPI] 解冻失败:', error);

      res.status(400).json({
        code: 400,
        message: error.message || '解冻失败',
        data: null,
        timestamp: Date.now(),
      });
    }
  });

  /**
   * POST /account/transfer
   * 转账
   */
  router.post('/transfer', async (req, res) => {
    try {
      const { fromUserId, toUserId, amount, reason } = req.body;

      const result = await accountService.transferBalanceAtomic(
        fromUserId,
        toUserId,
        amount,
        reason
      );

      res.json({
        code: 0,
        message: '转账成功',
        data: result,
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error('[AccountAPI] 转账失败:', error);

      res.status(400).json({
        code: 400,
        message: error.message || '转账失败',
        data: null,
        timestamp: Date.now(),
      });
    }
  });

  /**
   * GET /account/check-balance
   * 检查余额
   */
  router.get('/check-balance/:userId', async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const { amount } = req.query;

      if (!amount) {
        return res.status(400).json({
          code: 400,
          message: 'amount parameter is required',
          data: null,
          timestamp: Date.now(),
        });
      }

      const result = await accountService.checkBalance(userId, parseFloat(amount as string));

      res.json({
        code: 0,
        message: 'success',
        data: result,
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error('[AccountAPI] 检查余额失败:', error);

      res.status(400).json({
        code: 400,
        message: error.message || '检查余额失败',
        data: null,
        timestamp: Date.now(),
      });
    }
  });

  /**
   * GET /account/info/:userId
   * 获取账户信息
   */
  router.get('/info/:userId', async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);

      const info = await accountService.getAccountInfo(userId);

      res.json({
        code: 0,
        message: 'success',
        data: info,
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error('[AccountAPI] 获取账户信息失败:', error);

      res.status(400).json({
        code: 400,
        message: error.message || '获取账户信息失败',
        data: null,
        timestamp: Date.now(),
      });
    }
  });

  /**
   * GET /account/verify/:userId
   * 验证余额一致性
   */
  router.get('/verify/:userId', async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);

      const verification = await accountService.verifyBalanceConsistency(userId);

      res.json({
        code: 0,
        message: 'success',
        data: verification,
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error('[AccountAPI] 验证余额一致性失败:', error);

      res.status(400).json({
        code: 400,
        message: error.message || '验证余额一致性失败',
        data: null,
        timestamp: Date.now(),
      });
    }
  });

  /**
   * POST /transaction/test
   * 测试事务
   */
  router.post('/transaction/test', async (req, res) => {
    try {
      const { userId, amount } = req.body;

      const result = await transactionManager.executeTransaction(
        async (client) => {
          const account = await client.query(
            'SELECT * FROM accounts WHERE user_id = $1 FOR UPDATE',
            [userId]
          );

          if (!account.rows[0]) {
            throw new Error('账户不存在');
          }

          const beforeBalance = account.rows[0].balance;

          await client.query(
            'UPDATE accounts SET balance = balance + $1 WHERE user_id = $2',
            [amount, userId]
          );

          const afterAccount = await client.query(
            'SELECT balance FROM accounts WHERE user_id = $1',
            [userId]
          );

          return {
            beforeBalance,
            afterBalance: afterAccount.rows[0].balance,
            amount,
          };
        }
      );

      res.json({
        code: 0,
        message: '事务测试成功',
        data: result,
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error('[AccountAPI] 事务测试失败:', error);

      res.status(400).json({
        code: 400,
        message: error.message || '事务测试失败',
        data: null,
        timestamp: Date.now(),
      });
    }
  });

  /**
   * POST /transaction/batch-test
   * 批量事务测试
   */
  router.post('/transaction/batch-test', async (req, res) => {
    try {
      const { updates } = req.body;

      if (!Array.isArray(updates)) {
        return res.status(400).json({
          code: 400,
          message: 'updates must be an array',
          data: null,
          timestamp: Date.now(),
        });
      }

      const callbacks = updates.map((update: any) => {
        return async (client) => {
          const account = await client.query(
            'SELECT * FROM accounts WHERE user_id = $1 FOR UPDATE',
            [update.userId]
          );

          if (!account.rows[0]) {
            throw new Error('账户不存在');
          }

          await client.query(
            'UPDATE accounts SET balance = balance + $1 WHERE user_id = $2',
            [update.amount, update.userId]
          );

          return {
            userId: update.userId,
            beforeBalance: account.rows[0].balance,
            afterBalance: account.rows[0].balance + update.amount,
            amount: update.amount,
          };
        };
      });

      const results = await transactionManager.executeBatchTransactions(callbacks);

      const successCount = results.filter((r) => r.success).length;

      res.json({
        code: 0,
        message: '批量事务测试完成',
        data: {
          total: results.length,
          success: successCount,
          failed: results.length - successCount,
          results,
        },
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error('[AccountAPI] 批量事务测试失败:', error);

      res.status(400).json({
        code: 400,
        message: error.message || '批量事务测试失败',
        data: null,
        timestamp: Date.now(),
      });
    }
  });

  return router;
}
