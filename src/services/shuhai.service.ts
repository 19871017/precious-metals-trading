// ============================================
// 数海行情数据服务
// ============================================

const SHUHAI_API_BASE = 'http://ds.cnshuhai.com/stock.php';
const SHUHAI_USERNAME = import.meta.env.VITE_SHUHAI_USERNAME || '';
const SHUHAI_PASSWORD = import.meta.env.VITE_SHUHAI_PASSWORD || '';

// 品种代码映射（根据数海实际产品代码调整）
export const SYMBOL_MAPPING: Record<string, string> = {
  // 国际品种
  'XAUUSD': 'CL',      // 美原油（需要确认实际代码）
  'XAGUSD': 'GC',       // 美黄金（需要确认实际代码）
  'USOIL': 'CL',        // 美原油
  'GOLD': 'GC',         // 美黄金
  'SILVER': 'SI',       // 美白银
  'DAX': 'DAX',        // 德指
  'HSI': 'HSI',        // 恒指
  'MHSI': 'MHSI',      // 小恒指
  'NQ': 'NQ',          // 纳指
  'MNQ': 'MNQ',        // 小纳指
  'YM': 'YM',          // 小道琼
  'ES': 'ES',          // 小标普
  'NK': 'NK',          // 日经
  'HG': 'HG',          // 美精铜
  // 国内期货品种
  'AG2406': 'AG',      // 白银2406
  'AU2406': 'AU',      // 黄金2406
  'CU2406': 'CU',      // 铜2406
  'ZN2406': 'ZN',      // 锌2406
  'AG': 'AG',          // 白银
  'AU': 'AU',          // 黄金
  'CU': 'CU',          // 铜
  'ZN': 'ZN',          // 锌
  'NI': 'NI',          // 镍
  'AL': 'AL',          // 铝
};

// 市场品种列表
export const MARKET_SYMBOLS = [
  // 国际品种
  { symbol: 'USOIL', name: '美原油', shuhaiCode: 'CL' },
  { symbol: 'GOLD', name: '美黄金', shuhaiCode: 'GC' },
  { symbol: 'SILVER', name: '美白银', shuhaiCode: 'SI' },
  { symbol: 'DAX', name: '德指', shuhaiCode: 'DAX' },
  { symbol: 'HSI', name: '恒指', shuhaiCode: 'HSI' },
  { symbol: 'MHSI', name: '小恒指', shuhaiCode: 'MHSI' },
  { symbol: 'NQ', name: '纳指', shuhaiCode: 'NQ' },
  { symbol: 'MNQ', name: '小纳指', shuhaiCode: 'MNQ' },
  { symbol: 'YM', name: '小道琼', shuhaiCode: 'YM' },
  { symbol: 'ES', name: '小标普', shuhaiCode: 'ES' },
  { symbol: 'NK', name: '日经', shuhaiCode: 'NK' },
  { symbol: 'HG', name: '美精铜', shuhaiCode: 'HG' },
  // 国内期货
  { symbol: 'AG2406', name: '白银2406', shuhaiCode: 'AG', isDomestic: true },
  { symbol: 'AU2406', name: '黄金2406', shuhaiCode: 'AU', isDomestic: true },
  { symbol: 'CU2406', name: '铜2406', shuhaiCode: 'CU', isDomestic: true },
  { symbol: 'ZN2406', name: '锌2406', shuhaiCode: 'ZN', isDomestic: true },
];

if (!SHUHAI_USERNAME || !SHUHAI_PASSWORD || SHUHAI_USERNAME === 'your_shuhai_username') {
  console.warn('警告：数海 API 账号密码未配置，行情数据功能将无法使用');
  console.warn('请在 .env 文件中设置 VITE_SHUHAI_USERNAME 和 VITE_SHUHAI_PASSWORD');
}

/**
 * 生成签名
 * @param username 用户名
 * @param password 密码
 * @param timestamp 时间戳
 * @returns MD5 签名
 */
function generateSignature(username: string, password: string, timestamp: number): string {
  const stringA = `u=${username}&p=${password}&stamp=${timestamp}`;
  
  // 简单的 MD5 实现（生产环境建议使用 crypto-js）
  function md5(string: string): string {
    function md5cycle(x: number[], k: number[]) {
      let a = x[0], b = x[1], c = x[2], d = x[3];
      a = ff(a, b, c, d, k[0], 7, -680876936);
      d = ff(d, a, b, c, k[1], 12, -389564586);
      c = ff(c, d, a, b, k[2], 17, 606105819);
      b = ff(b, c, d, a, k[3], 22, -1044525330);
      a = ff(a, b, c, d, k[4], 7, -176418897);
      d = ff(d, a, b, c, k[5], 12, 1200080426);
      c = ff(c, d, a, b, k[6], 17, -1473231341);
      b = ff(b, c, d, a, k[7], 22, -45705983);
      a = ff(a, b, c, d, k[8], 7, 1770035416);
      d = ff(d, a, b, c, k[9], 12, -1958414417);
      c = ff(c, d, a, b, k[10], 17, -42063);
      b = ff(b, c, d, a, k[11], 22, -1990404162);
      a = ff(a, b, c, d, k[12], 7, 1804603682);
      d = ff(d, a, b, c, k[13], 12, -40341101);
      c = ff(c, d, a, b, k[14], 17, -1502002290);
      b = ff(b, c, d, a, k[15], 22, 1236535329);
      a = gg(a, b, c, d, k[1], 5, -165796510);
      d = gg(d, a, b, c, k[6], 9, -1069501632);
      c = gg(c, d, a, b, k[11], 14, 643717713);
      b = gg(b, c, d, a, k[0], 20, -373897302);
      a = gg(a, b, c, d, k[5], 5, -701558691);
      d = gg(d, a, b, c, k[10], 9, 38016083);
      c = gg(c, d, a, b, k[15], 14, -660478335);
      b = gg(b, c, d, a, k[4], 20, -405537848);
      a = gg(a, b, c, d, k[9], 5, 568446438);
      d = gg(d, a, b, c, k[14], 9, -1019803690);
      c = gg(c, d, a, b, k[3], 14, -187363961);
      b = gg(b, c, d, a, k[8], 20, 1163531501);
      a = gg(a, b, c, d, k[13], 5, -1444681467);
      d = gg(d, a, b, c, k[2], 9, -51403784);
      c = gg(c, d, a, b, k[7], 14, 1735328473);
      b = gg(b, c, d, a, k[12], 20, -1926607734);
      a = hh(a, b, c, d, k[5], 4, -378558);
      d = hh(d, a, b, c, k[8], 11, -2022574463);
      c = hh(c, d, a, b, k[11], 16, 1839030562);
      b = hh(b, c, d, a, k[14], 23, -35309556);
      a = hh(a, b, c, d, k[1], 4, -1530992060);
      d = hh(d, a, b, c, k[4], 11, 1272893353);
      c = hh(c, d, a, b, k[7], 16, -155497632);
      b = hh(b, c, d, a, k[10], 23, -1094730640);
      a = hh(a, b, c, d, k[13], 4, 681279174);
      d = hh(d, a, b, c, k[0], 11, -358537222);
      c = hh(c, d, a, b, k[3], 16, -722521979);
      b = hh(b, c, d, a, k[6], 23, 76029189);
      a = hh(a, b, c, d, k[9], 4, -640364487);
      d = hh(d, a, b, c, k[12], 11, -421815835);
      c = hh(c, d, a, b, k[15], 16, 530742520);
      b = hh(b, c, d, a, k[2], 23, -995338651);
      a = ii(a, b, c, d, k[0], 6, -198630844);
      d = ii(d, a, b, c, k[7], 10, 1126891415);
      c = ii(c, d, a, b, k[14], 15, -1416354905);
      b = ii(b, c, d, a, k[5], 21, -57434055);
      a = ii(a, b, c, d, k[12], 6, 1700485571);
      d = ii(d, a, b, c, k[3], 10, -1894986606);
      c = ii(c, d, a, b, k[10], 15, -1051523);
      b = ii(b, c, d, a, k[1], 21, -2054922799);
      a = ii(a, b, c, d, k[8], 6, 1873313359);
      d = ii(d, a, b, c, k[15], 10, -30611744);
      c = ii(c, d, a, b, k[6], 15, -1560198380);
      b = ii(b, c, d, a, k[13], 21, 1309151649);
      a = ii(a, b, c, d, k[4], 6, -145523070);
      d = ii(d, a, b, c, k[11], 10, -1120210379);
      c = ii(c, d, a, b, k[2], 15, 718787259);
      b = ii(b, c, d, a, k[9], 21, -343485551);
      x[0] = add32(a, x[0]);
      x[1] = add32(b, x[1]);
      x[2] = add32(c, x[2]);
      x[3] = add32(d, x[3]);
    }

    function cmn(q: number, a: number, b: number, x: number, s: number, t: number): number {
      a = add32(add32(a, q), add32(x, t));
      return add32((a << s) | (a >>> (32 - s)), b);
    }

    function ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
      return cmn((b & c) | ((~b) & d), a, b, x, s, t);
    }

    function gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
      return cmn((b & d) | (c & (~d)), a, b, x, s, t);
    }

    function hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
      return cmn(b ^ c ^ d, a, b, x, s, t);
    }

    function ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
      return cmn(c ^ (b | (~d)), a, b, x, s, t);
    }

    function md51(s: string): number[] {
      const n = s.length;
      const state = [1732584193, -271733879, -1732584194, 271733878];
      let i: number;
      for (i = 64; i <= s.length; i += 64) {
        md5cycle(state, md5blk(s.substring(i - 64, i)));
      }
      s = s.substring(i - 64);
      const tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      for (i = 0; i < s.length; i++) {
        tail[i >> 2] |= s.charCodeAt(i) << ((i % 4) << 3);
      }
      tail[i >> 2] |= 0x80 << ((i % 4) << 3);
      if (i > 55) {
        md5cycle(state, tail);
        for (i = 0; i < 16; i++) tail[i] = 0;
      }
      tail[14] = n * 8;
      md5cycle(state, tail);
      return state;
    }

    function md5blk(s: string): number[] {
      const md5blks = [];
      for (let i = 0; i < 64 * 4; i++) {
        md5blks[i >> 2] = s.charCodeAt(i) + (md5blks[i >> 2] << 8);
      }
      return md5blks;
    }

    const hex_chr = '0123456789abcdef'.split('');
    function rhex(n: number): string {
      let s = '';
      for (let j = 0; j < 4; j++) {
        s += hex_chr[(n >> (j * 8 + 4)) & 0x0F] + hex_chr[(n >> (j * 8)) & 0x0F];
      }
      return s;
    }

    function hex(x: number[]): string {
      for (let i = 0; i < x.length; i++) {
        x[i] = rhex(x[i]);
      }
      return x.join('');
    }

    return hex(md51(string));
  }

  return md5(stringA);
}

/**
 * 构建请求参数
 */
function buildRequestParams(additionalParams: Record<string, string | number> = {}): URLSearchParams {
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = generateSignature(SHUHAI_USERNAME, SHUHAI_PASSWORD, timestamp);

  const params = new URLSearchParams();
  params.append('u', SHUHAI_USERNAME);
  params.append('stamp', timestamp.toString());
  params.append('sign', sign);
  
  // 添加额外参数
  Object.entries(additionalParams).forEach(([key, value]) => {
    params.append(key, value.toString());
  });

  return params;
}

/**
 * 获取实时行情快照（使用内部代码）
 * @param shuhaiCode 数海产品代码
 */
export async function getRealtimeQuote(shuhaiCode: string): Promise<any> {
  try {
    const params = buildRequestParams({
      func: 'getQuote',
      code: shuhaiCode
    });

    const url = `${SHUHAI_API_BASE}?${params.toString()}`;
    console.log('请求 URL:', url);

    const response = await fetch(url, {
      mode: 'cors',
      headers: {
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`数海 API 请求失败: ${response.status}`);
    }

    const data = await response.json();
    console.log(`获取 ${shuhaiCode} 实时行情:`, data);

    // 根据实际返回格式解析数据
    if (data && data.code === 0) {
      return data.data;
    } else if (data && data.data) {
      return data.data;
    }

    return data;
  } catch (error) {
    console.error('获取实时行情失败:', error);
    throw error;
  }
}

/**
 * 根据品种代码获取实时行情
 * @param symbol 系统品种代码，如 'GOLD'、'USOIL'
 */
export async function getQuoteBySymbol(symbol: string): Promise<any> {
  const shuhaiCode = SYMBOL_MAPPING[symbol] || symbol;
  return getRealtimeQuote(shuhaiCode);
}

/**
 * 获取 K 线数据
 * @param shuhaiCode 数海产品代码
 * @param period 周期：1、5、15、30、60、1440、10080（分钟）
 * @param count 数量，默认 100
 */
export async function getKlineData(
  shuhaiCode: string,
  period: number = 60,
  count: number = 100
): Promise<any> {
  try {
    const params = buildRequestParams({
      func: 'getKLine',
      code: shuhaiCode,
      period: period,
      count: count
    });

    const url = `${SHUHAI_API_BASE}?${params.toString()}`;
    console.log('K线 URL:', url);

    const response = await fetch(url, {
      mode: 'cors',
      headers: {
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`数海 API 请求失败: ${response.status}`);
    }

    const data = await response.json();
    console.log(`获取 ${shuhaiCode} K线数据:`, data);

    // 根据实际返回格式解析数据
    if (data && data.code === 0) {
      return data.data;
    } else if (data && data.data) {
      return data.data;
    }

    return data;
  } catch (error) {
    console.error('获取 K线数据失败:', error);
    throw error;
  }
}

/**
 * 根据品种代码获取 K 线数据
 */
export async function getKlineBySymbol(
  symbol: string,
  period: number = 60,
  count: number = 100
): Promise<any> {
  const shuhaiCode = SYMBOL_MAPPING[symbol] || symbol;
  return getKlineData(shuhaiCode, period, count);
}

/**
 * 获取K线数据 - 用于策略回测
 * @param symbol 品种代码
 * @param startTime 开始时间戳(秒)
 * @param endTime 结束时间戳(秒)
 * @param period 周期(1=1分钟, 60=1小时, 1440=1天)
 */
export async function fetchKLineData(
  symbol: string,
  startTime: number,
  endTime: number,
  period: string = '1h'
): Promise<any[]> {
  try {
    // 将周期转换为分钟数
    const periodMap: Record<string, number> = {
      '1m': 1,
      '5m': 5,
      '15m': 15,
      '30m': 30,
      '1h': 60,
      '4h': 240,
      '1d': 1440,
    };

    const periodMinutes = periodMap[period] || 60;

    // 根据时间范围计算需要的数据量
    const timeDiff = endTime - startTime;
    const count = Math.min(Math.floor(timeDiff / periodMinutes / 60), 2000);

    // 映射品种代码
    const shuhaiCode = SYMBOL_MAPPING[symbol] || symbol;

    // 获取K线数据
    const data = await getKlineData(shuhaiCode, periodMinutes, count);

    // 转换数据格式为数组 [timestamp, open, high, low, close, volume]
    if (Array.isArray(data)) {
      return data.map((item: any) => [
        item.timestamp || item[0],
        item.open || item[1],
        item.high || item[2],
        item.low || item[3],
        item.close || item[4],
        item.volume || item[5],
      ]);
    } else if (data && data.data) {
      return data.data.map((item: any) => [
        item.timestamp || item[0],
        item.open || item[1],
        item.high || item[2],
        item.low || item[3],
        item.close || item[4],
        item.volume || item[5],
      ]);
    }

    return [];
  } catch (error) {
    console.error('获取K线数据失败:', error);
    throw error;
  }
}

/**
 * 获取分时数据
 * @param symbol 产品代码
 */
export async function getTickData(symbol: string): Promise<any> {
  try {
    const params = buildRequestParams({
      func: 'getTick',
      symbol: symbol
    });

    const url = `${SHUHAI_API_BASE}?${params.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`数海 API 请求失败: ${response.status}`);
    }

    const data = await response.json();
    console.log(`获取 ${symbol} 分时数据:`, data);
    return data;
  } catch (error) {
    console.error('获取分时数据失败:', error);
    throw error;
  }
}

/**
 * 获取历史数据
 * @param symbol 产品代码
 * @param startDate 开始日期 (YYYYMMDD)
 * @param endDate 结束日期 (YYYYMMDD)
 */
export async function getHistoryData(
  symbol: string,
  startDate: string,
  endDate: string
): Promise<any> {
  try {
    const params = buildRequestParams({
      func: 'getHistory',
      symbol: symbol,
      start_date: startDate,
      end_date: endDate
    });

    const url = `${SHUHAI_API_BASE}?${params.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`数海 API 请求失败: ${response.status}`);
    }

    const data = await response.json();
    console.log(`获取 ${symbol} 历史数据:`, data);
    return data;
  } catch (error) {
    console.error('获取历史数据失败:', error);
    throw error;
  }
}

/**
 * 批量获取多个品种的实时行情
 * @param symbols 产品代码数组
 */
export async function getBatchQuotes(symbols: string[]): Promise<any> {
  try {
    const promises = symbols.map(symbol => getRealtimeQuote(symbol));
    const results = await Promise.allSettled(promises);
    
    const data: Record<string, any> = {};
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        data[symbols[index]] = result.value;
      } else {
        data[symbols[index]] = null;
      }
    });

    return data;
  } catch (error) {
    console.error('批量获取行情失败:', error);
    throw error;
  }
}

export default {
  getRealtimeQuote,
  getKlineData,
  getTickData,
  getHistoryData,
  getBatchQuotes
};
