import { MarketDataServiceV2 } from '../services/MarketDataServiceV2';
import { TradingService, TradeRequest, TradeResult } from '../services/TradingService';
import { tradingService } from '../services/TradingService';
import logger from '../utils/logger';

/**
 * 行情与交易解耦示例
 */
export async function marketDecouplingExample() {
  logger.info('[MarketDecouplingExample] 开始运行行情与交易解耦示例');

  try {
    logger.info('[MarketDecouplingExample] 1. 更新行情缓存...');
    await marketDataServiceV2.batchUpdateMarketData([
      {
        productCode: 'XAUUSD',
        price: 2345.67,
        bid: 2345.60,
        ask: 2345.74,
        high24h: 2350,
        low24h: 2340,
        volume24h: 10000,
        change: 5.67,
        changePercent: 0.24,
        timestamp: Date.now(),
      },
      {
        productCode: 'USOIL',
        price: 72.45,
        bid: 72.43,
        ask: 72.47,
        high24h: 73,
        low24h: 72,
        volume24h: 5000,
        change: 0.45,
        changePercent: 0.62,
        timestamp: Date.now(),
      },
    ]);

    logger.info('[MarketDecouplingExample] 2. 测试市价单...');
    const marketOrderRequest: TradeRequest = {
      userId: '1',
      productCode: 'XAUUSD',
      type: 'MARKET',
      direction: 'BUY',
      quantity: 10,
      leverage: 10,
    };

    const marketResult = await tradingService.executeMarketOrder(marketOrderRequest);
    logger.info('[MarketDecouplingExample] 市价单结果:', marketResult);

    logger.info('[MarketDecouplingExample] 3. 测试限价单...');
    const limitOrderRequest: TradeRequest = {
      userId: '1',
      productCode: 'XAUUSD',
      type: 'LIMIT',
      direction: 'BUY',
      quantity: 10,
      leverage: 10,
      price: 2340,
    };

    const limitResult = await tradingService.executeLimitOrder(limitOrderRequest);
    logger.info('[MarketDecouplingExample] 限价单结果:', limitResult);

    logger.info('[MarketDecouplingExample] 4. 获取行情缓存...');
    const cache = await marketDataServiceV2.getMarketCache('XAUUSD');
    logger.info('[MarketDecouplingExample] 行情缓存:', cache);

    logger.info('[MarketDecouplingExample] 5. 获取行情快照...');
    const snapshot = await marketDataServiceV2.getMarketSnapshot('XAUUSD');
    logger.info('[MarketDecouplingExample] 行情快照:', snapshot);

    logger.info('[MarketDecouplingExample] 6. 获取当前版本...');
    const version = await marketDataServiceV2.getCurrentMarketVersion('XAUUSD');
    logger.info('[MarketDecouplingExample] 当前版本:', version);

    logger.info('[MarketDecouplingExample] 7. 测试版本验证...');
    const isValid = await marketDataServiceV2.validateMarketVersion('XAUUSD', version);
    logger.info('[MarketDecouplingExample] 版本验证结果:', isValid);

    logger.info('[MarketDecouplingExample] 8. 测试旧行情检测...');
    const isStale = await marketDataServiceV2.isMarketStale('XAUUSD');
    logger.info('[MarketDecouplingExample] 旧行情检测结果:', isStale);

    logger.info('[MarketDecouplingExample] 9. 获取缓存统计...');
    const stats = await marketDataServiceV2.getCacheStats();
    logger.info('[MarketDecouplingExample] 缓存统计:', stats);

    logger.info('[MarketDecouplingExample] 行情与交易解耦示例运行完成');
  } catch (error) {
    logger.error('[MarketDecouplingExample] 示例运行失败:', error);
  }
}

/**
 * 运行所有示例
 */
export async function runMarketDecouplingExamples() {
  try {
    await marketDecouplingExample();
  } catch (error) {
    logger.error('[MarketDecouplingExamples] 示例运行失败:', error);
  }
}

if (require.main === module) {
  runMarketDecouplingExamples();
}
