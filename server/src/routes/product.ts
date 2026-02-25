import { Router, Request, Response } from 'express';
import { verifyToken } from '../services/auth.service';

const router = Router();

// 模拟产品数据库（生产环境应使用PostgreSQL）
const products = new Map<number, any>();

// 初始化默认产品
const initProducts = () => {
  if (products.size === 0) {
    const defaultProducts = [
      {
        id: 1,
        code: 'XAUUSD',
        name: '国际黄金',
        type: 'FOREX',
        category: '贵金属',
        description: '黄金现货交易',
        baseCurrency: 'XAU',
        quoteCurrency: 'USD',
        pricePrecision: 2,
        volumePrecision: 2,
        minVolume: 0.01,
        maxVolume: 100,
        minMargin: 100,
        maxLeverage: 100,
        defaultLeverage: 10,
        commissionRate: 0.00005,
        swapLong: -0.5,
        swapShort: -0.25,
        tradingHours: '24小时',
        status: 'active',
        createdAt: new Date().toISOString()
      },
      {
        id: 2,
        code: 'XAGUSD',
        name: '国际白银',
        type: 'FOREX',
        category: '贵金属',
        description: '白银现货交易',
        baseCurrency: 'XAG',
        quoteCurrency: 'USD',
        pricePrecision: 3,
        volumePrecision: 2,
        minVolume: 0.01,
        maxVolume: 100,
        minMargin: 50,
        maxLeverage: 100,
        defaultLeverage: 10,
        commissionRate: 0.00008,
        swapLong: -0.3,
        swapShort: -0.15,
        tradingHours: '24小时',
        status: 'active',
        createdAt: new Date().toISOString()
      },
      {
        id: 3,
        code: 'AU2406',
        name: '沪金主力',
        type: 'FUTURES',
        category: '贵金属期货',
        description: '上海期货交易所黄金主力合约',
        baseCurrency: 'AU',
        quoteCurrency: 'CNY',
        pricePrecision: 2,
        volumePrecision: 1,
        minVolume: 1,
        maxVolume: 1000,
        minMargin: 5000,
        maxLeverage: 20,
        defaultLeverage: 10,
        commissionRate: 0.0001,
        swapLong: 0,
        swapShort: 0,
        tradingHours: '9:00-15:00, 21:00-2:30',
        status: 'active',
        createdAt: new Date().toISOString()
      },
      {
        id: 4,
        code: 'AG2406',
        name: '沪银主力',
        type: 'FUTURES',
        category: '贵金属期货',
        description: '上海期货交易所白银主力合约',
        baseCurrency: 'AG',
        quoteCurrency: 'CNY',
        pricePrecision: 2,
        volumePrecision: 1,
        minVolume: 1,
        maxVolume: 1000,
        minMargin: 1000,
        maxLeverage: 20,
        defaultLeverage: 10,
        commissionRate: 0.00015,
        swapLong: 0,
        swapShort: 0,
        tradingHours: '9:00-15:00, 21:00-2:30',
        status: 'active',
        createdAt: new Date().toISOString()
      }
    ];

    defaultProducts.forEach(p => products.set(p.id, p));
    console.log('[Product] 初始化产品完成，共 ' + products.size + ' 个产品');
  }
};

initProducts();

/**
 * 获取产品列表
 */
router.get('/', verifyToken, (req: Request, res: Response) => {
  try {
    const { status, category } = req.query;
    let productList = Array.from(products.values());

    // 状态筛选
    if (status) {
      productList = productList.filter((p: any) => p.status === status);
    }

    // 分类筛选
    if (category) {
      productList = productList.filter((p: any) => p.category === category);
    }

    res.json({
      code: 0,
      message: '获取成功',
      data: productList,
      timestamp: Date.now()
    });
  } catch (error: any) {
    console.error('[Product] 获取产品列表错误:', error);
    res.status(500).json({
      code: 500,
      message: '服务器内部错误',
      data: null,
      timestamp: Date.now()
    });
  }
});

/**
 * 获取产品详情
 */
router.get('/:id', verifyToken, (req: Request, res: Response) => {
  try {
    const productId = parseInt(req.params.id);
    const product = products.get(productId);

    if (!product) {
      return res.status(404).json({
        code: 404,
        message: '产品不存在',
        data: null,
        timestamp: Date.now()
      });
    }

    res.json({
      code: 0,
      message: '获取成功',
      data: product,
      timestamp: Date.now()
    });
  } catch (error: any) {
    console.error('[Product] 获取产品详情错误:', error);
    res.status(500).json({
      code: 500,
      message: '服务器内部错误',
      data: null,
      timestamp: Date.now()
    });
  }
});

/**
 * 创建产品
 */
router.post('/', verifyToken, (req: Request, res: Response) => {
  try {
    const productData = req.body;

    // 安全的产品ID生成，避免空Map报错
    let newId: number;
    if (products.size === 0) {
      newId = 1; // 如果Map为空，从1开始
    } else {
      const existingIds = Array.from(products.keys());
      newId = Math.max(...existingIds) + 1;
    }

    const newProduct = {
      id: newId,
      ...productData,
      status: productData.status || 'active',
      createdAt: new Date().toISOString()
    };

    products.set(newId, newProduct);

    console.log('[Product] 创建产品:', newProduct.code);

    res.json({
      code: 0,
      message: '创建成功',
      data: newProduct,
      timestamp: Date.now()
    });
  } catch (error: any) {
    console.error('[Product] 创建产品错误:', error);
    res.status(500).json({
      code: 500,
      message: '服务器内部错误',
      data: null,
      timestamp: Date.now()
    });
  }
});

/**
 * 更新产品
 */
router.put('/:id', verifyToken, (req: Request, res: Response) => {
  try {
    const productId = parseInt(req.params.id);
    const product = products.get(productId);

    if (!product) {
      return res.status(404).json({
        code: 404,
        message: '产品不存在',
        data: null,
        timestamp: Date.now()
      });
    }

    const updatedProduct = {
      ...product,
      ...req.body,
      id: productId,
      updatedAt: new Date().toISOString()
    };

    products.set(productId, updatedProduct);

    console.log('[Product] 更新产品:', updatedProduct.code);

    res.json({
      code: 0,
      message: '更新成功',
      data: updatedProduct,
      timestamp: Date.now()
    });
  } catch (error: any) {
    console.error('[Product] 更新产品错误:', error);
    res.status(500).json({
      code: 500,
      message: '服务器内部错误',
      data: null,
      timestamp: Date.now()
    });
  }
});

/**
 * 删除产品
 */
router.delete('/:id', verifyToken, (req: Request, res: Response) => {
  try {
    const productId = parseInt(req.params.id);
    const product = products.get(productId);

    if (!product) {
      return res.status(404).json({
        code: 404,
        message: '产品不存在',
        data: null,
        timestamp: Date.now()
      });
    }

    products.delete(productId);

    console.log('[Product] 删除产品:', product.code);

    res.json({
      code: 0,
      message: '删除成功',
      data: null,
      timestamp: Date.now()
    });
  } catch (error: any) {
    console.error('[Product] 删除产品错误:', error);
    res.status(500).json({
      code: 500,
      message: '服务器内部错误',
      data: null,
      timestamp: Date.now()
    });
  }
});

export default router;
