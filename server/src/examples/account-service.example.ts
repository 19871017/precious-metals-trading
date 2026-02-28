import { accountService } from '../services/AccountService';
import { transactionManager } from '../config/TransactionManager';
import logger from '../utils/logger';

/**
 * 账户服务使用示例
 */
export async function accountServiceExample() {
  logger.info('[AccountServiceExample] 开始运行账户服务示例');

  try {
    logger.info('[AccountServiceExample] 1. 检查账户余额...');
    const balanceCheck = await accountService.checkBalance(1, 1000);
    logger.info('[AccountServiceExample] 余额检查结果:', balanceCheck);

    logger.info('[AccountServiceExample] 2. 原子化更新余额...');
    const updateResult = await accountService.updateBalanceAtomic({
      userId: 1,
      amount: 100,
      operation: 'TEST_DEPOSIT',
      description: '测试充值',
      strictMode: false,
    });
    logger.info('[AccountServiceExample] 余额更新结果:', updateResult);

    logger.info('[AccountServiceExample] 3. 冻结资金...');
    const freezeResult = await accountService.freezeBalanceAtomic(
      1,
      50,
      '测试冻结',
      undefined,
      undefined
    );
    logger.info('[AccountServiceExample] 冻结结果:', freezeResult);

    logger.info('[AccountServiceExample] 4. 解冻资金...');
    const unfreezeResult = await accountService.unfreezeBalanceAtomic(
      1,
      25,
      '测试解冻',
      undefined,
      undefined
    );
    logger.info('[AccountServiceExample] 解冻结果:', unfreezeResult);

    logger.info('[AccountServiceExample] 5. 获取账户信息...');
    const accountInfo = await accountService.getAccountInfo(1);
    logger.info('[AccountServiceExample] 账户信息:', accountInfo);

    logger.info('[AccountServiceExample] 6. 验证余额一致性...');
    const verification = await accountService.verifyBalanceConsistency(1);
    logger.info('[AccountServiceExample] 一致性验证结果:', verification);

    logger.info('[AccountServiceExample] 7. 转账测试...');
    try {
      const transferResult = await accountService.transferBalanceAtomic(
        1,
        2,
        10,
        '测试转账'
      );
      logger.info('[AccountServiceExample] 转账结果:', transferResult);
    } catch (error) {
      logger.info('[AccountServiceExample] 转账失败:', error.message);
    }

    logger.info('[AccountServiceExample] 8. 批量更新余额...');
    const batchResult = await accountService.batchUpdateBalanceAtomic([
      {
        userId: 1,
        amount: 10,
        operation: 'BATCH_TEST_1',
        description: '批量测试1',
        strictMode: false,
      },
      {
        userId: 2,
        amount: 20,
        operation: 'BATCH_TEST_2',
        description: '批量测试2',
        strictMode: false,
      },
    ]);
    logger.info('[AccountServiceExample] 批量更新结果:', batchResult);

    logger.info('[AccountServiceExample] 账户服务示例运行完成');
  } catch (error) {
    logger.error('[AccountServiceExample] 示例运行失败:', error);
  }
}

/**
 * 事务管理器示例
 */
export async function transactionManagerExample() {
  logger.info('[TransactionManagerExample] 开始运行事务管理器示例');

  try {
    logger.info('[TransactionManagerExample] 1. 基本事务...');
    const result1 = await transactionManager.executeTransaction(async (client) => {
      const accountResult = await client.query(
        'SELECT * FROM accounts WHERE user_id = $1',
        [1]
      );

      return accountResult.rows[0];
    });

    logger.info('[TransactionManagerExample] 基本事务结果:', result1);

    logger.info('[TransactionManagerExample] 2. 只读事务...');
    const result2 = await transactionManager.executeReadOnlyTransaction(
      async (client) => {
        const accountResult = await client.query(
          'SELECT * FROM accounts WHERE user_id = $1',
          [1]
        );

        return accountResult.rows[0];
      }
    );

    logger.info('[TransactionManagerExample] 只读事务结果:', result2);

    logger.info('[TransactionManagerExample] 3. 带重滚的事务...');
    const result3 = await transactionManager.executeWithRollback(
      async (client, rollback) => {
        try {
          const accountResult = await client.query(
            'SELECT * FROM accounts WHERE user_id = $1',
            [1]
          );

          rollback();

          throw new Error('测试回滚');
        } catch (error) {
          logger.info('[TransactionManagerExample] 错误已被捕获,事务将回滚');
          throw error;
        }
      }
    );

    logger.info('[TransactionManagerExample] 带重滚事务结果:', result3);

    logger.info('[TransactionManagerExample] 事务管理器示例运行完成');
  } catch (error) {
    logger.error('[TransactionManagerExample] 示例运行失败:', error);
  }
}

/**
 * 运行所有示例
 */
export async function runAccountServiceExamples() {
  try {
    await accountServiceExample();
    await transactionManagerExample();
  } catch (error) {
    logger.error('[AccountServiceExamples] 示例运行失败:', error);
  }
}

if (require.main === module) {
  runAccountServiceExamples();
}
