import { Router, Request, Response } from 'express';
import { verifyToken } from '../services/auth.service';

const router = Router();

// ============================================
// 品种管理路由（后台管理）
// 用于动态添加、编辑、删除行情品种
// ============================================

// 品种数据库（生产环境应使用PostgreSQL）
interface MarketSymbol {
  id: number;
  code: string;          // 内部代码（如：DAX, HSI）
  name: string;          // 显示名称（如：德指, 恒指）
  shuhaiCode: string;    // 数海代码（如：CEDAXA0, HIHHI02）
  market: string;        // 市场代码（如：CE, HI, NE）
  category: string;       // 分类（如：指数, 贵金属, 能源）
  status: 'active' | 'inactive';  // 状态
  pricePrecision: number; // 价格精度
  sort: number;          // 排序
  createdAt: string;
  updatedAt: string;
}

// 内存存储（生产环境替换为数据库）
let symbols: MarketSymbol[] = [];
let nextId = 1;

// 初始化默认品种
const initSymbols = () => {
  if (symbols.length === 0) {
    symbols = [
      {
        id: nextId++,
        code: 'DAX',
        name: '德指',
        shuhaiCode: 'CEDAXA0',
        market: 'CE',
        category: '指数',
        status: 'active',
        pricePrecision: 2,
        sort: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: nextId++,
        code: 'HSI',
        name: '恒指',
        shuhaiCode: 'HIHHI02',
        market: 'HI',
        category: '指数',
        status: 'active',
        pricePrecision: 2,
        sort: 2,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: nextId++,
        code: 'NQ',
        name: '纳指',
        shuhaiCode: 'CENQA0',
        market: 'CE',
        category: '指数',
        status: 'active',
        pricePrecision: 2,
        sort: 3,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: nextId++,
        code: 'USOIL',
        name: '原油',
        shuhaiCode: 'NECLA0',
        market: 'NE',
        category: '能源',
        status: 'active',
        pricePrecision: 2,
        sort: 4,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: nextId++,
        code: 'MHSI',
        name: '小恒指',
        shuhaiCode: 'HIHHI01',
        market: 'HI',
        category: '指数',
        status: 'active',
        pricePrecision: 2,
        sort: 5,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
    ];
  }
};

initSymbols();

// 统一响应格式
const success = <T>(data: T, message: string = 'success') => ({
  code: 0,
  message,
  data,
  timestamp: Date.now()
});

const error = (code: number, message: string) => ({
  code,
  message,
  data: null,
  timestamp: Date.now()
});

/**
 * 获取所有品种列表
 */
router.get('/list', (req: Request, res: Response) => {
  try {
    const { status, category } = req.query;

    let filteredSymbols = [...symbols];

    if (status) {
      filteredSymbols = filteredSymbols.filter(s => s.status === status);
    }

    if (category) {
      filteredSymbols = filteredSymbols.filter(s => s.category === category);
    }

    // 按排序字段排序
    filteredSymbols.sort((a, b) => a.sort - b.sort);

    res.json(success({
      total: filteredSymbols.length,
      items: filteredSymbols
    }));
  } catch (err: any) {
    res.status(500).json(error(500, err.message));
  }
});

/**
 * 获取活跃品种列表（用于前端显示）
 */
router.get('/active', (req: Request, res: Response) => {
  try {
    const activeSymbols = symbols
      .filter(s => s.status === 'active')
      .sort((a, b) => a.sort - b.sort)
      .map(s => ({
        code: s.code,
        name: s.name,
        shuhaiCode: s.shuhaiCode,
        market: s.market,
        category: s.category,
        pricePrecision: s.pricePrecision
      }));

    res.json(success(activeSymbols));
  } catch (err: any) {
    res.status(500).json(error(500, err.message));
  }
});

/**
 * 获取单个品种详情
 */
router.get('/detail/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const symbol = symbols.find(s => s.id === parseInt(id));

    if (!symbol) {
      return res.status(404).json(error(404, '品种不存在'));
    }

    res.json(success(symbol));
  } catch (err: any) {
    res.status(500).json(error(500, err.message));
  }
});

/**
 * 添加新品种（需要管理员权限）
 */
router.post('/add', verifyToken, (req: Request, res: Response) => {
  try {
    const {
      code,
      name,
      shuhaiCode,
      market,
      category,
      pricePrecision = 2,
      sort = symbols.length + 1
    } = req.body;

    // 验证必填字段
    if (!code || !name || !shuhaiCode || !market || !category) {
      return res.status(400).json(error(400, '缺少必要参数'));
    }

    // 检查是否已存在
    const existing = symbols.find(s => s.code === code);
    if (existing) {
      return res.status(400).json(error(400, '品种代码已存在'));
    }

    const newSymbol: MarketSymbol = {
      id: nextId++,
      code,
      name,
      shuhaiCode,
      market,
      category,
      status: 'active',
      pricePrecision,
      sort,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    symbols.push(newSymbol);

    res.json(success(newSymbol, '品种添加成功'));
  } catch (err: any) {
    res.status(500).json(error(500, err.message));
  }
});

/**
 * 更新品种信息（需要管理员权限）
 */
router.put('/update/:id', verifyToken, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const index = symbols.findIndex(s => s.id === parseInt(id));

    if (index === -1) {
      return res.status(404).json(error(404, '品种不存在'));
    }

    const {
      name,
      shuhaiCode,
      market,
      category,
      status,
      pricePrecision,
      sort
    } = req.body;

    // 更新字段
    if (name !== undefined) symbols[index].name = name;
    if (shuhaiCode !== undefined) symbols[index].shuhaiCode = shuhaiCode;
    if (market !== undefined) symbols[index].market = market;
    if (category !== undefined) symbols[index].category = category;
    if (status !== undefined) symbols[index].status = status;
    if (pricePrecision !== undefined) symbols[index].pricePrecision = pricePrecision;
    if (sort !== undefined) symbols[index].sort = sort;

    symbols[index].updatedAt = new Date().toISOString();

    res.json(success(symbols[index], '品种更新成功'));
  } catch (err: any) {
    res.status(500).json(error(500, err.message));
  }
});

/**
 * 删除品种（需要管理员权限）
 */
router.delete('/delete/:id', verifyToken, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const index = symbols.findIndex(s => s.id === parseInt(id));

    if (index === -1) {
      return res.status(404).json(error(404, '品种不存在'));
    }

    const deletedSymbol = symbols.splice(index, 1)[0];

    res.json(success(deletedSymbol, '品种删除成功'));
  } catch (err: any) {
    res.status(500).json(error(500, err.message));
  }
});

/**
 * 启用/禁用品种（需要管理员权限）
 */
router.put('/toggle/:id', verifyToken, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const index = symbols.findIndex(s => s.id === parseInt(id));

    if (index === -1) {
      return res.status(404).json(error(404, '品种不存在'));
    }

    symbols[index].status = symbols[index].status === 'active' ? 'inactive' : 'active';
    symbols[index].updatedAt = new Date().toISOString();

    res.json(success(symbols[index], `品种已${symbols[index].status === 'active' ? '启用' : '禁用'}`));
  } catch (err: any) {
    res.status(500).json(error(500, err.message));
  }
});

/**
 * 批量排序（需要管理员权限）
 */
router.put('/sort', verifyToken, (req: Request, res: Response) => {
  try {
    const { orders } = req.body; // [{id: 1, sort: 1}, {id: 2, sort: 2}, ...]

    if (!Array.isArray(orders)) {
      return res.status(400).json(error(400, '参数格式错误'));
    }

    orders.forEach(({ id, sort }: { id: number; sort: number }) => {
      const index = symbols.findIndex(s => s.id === id);
      if (index !== -1) {
        symbols[index].sort = sort;
        symbols[index].updatedAt = new Date().toISOString();
      }
    });

    res.json(success(null, '排序更新成功'));
  } catch (err: any) {
    res.status(500).json(error(500, err.message));
  }
});

/**
 * 获取分类列表
 */
router.get('/categories', (req: Request, res: Response) => {
  try {
    const categories = [...new Set(symbols.map(s => s.category))];

    res.json(success(categories));
  } catch (err: any) {
    res.status(500).json(error(500, err.message));
  }
});

export function createSymbolManagementRouter(): Router {
  return router;
}
