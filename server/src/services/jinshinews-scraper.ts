/**
 * 金十数据爬虫服务
 * 使用 Puppeteer 或 Cheerio 爬取金十网站数据
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

// 金十新闻数据接口
export interface JinshinewsItem {
  id: string;
  title: string;
  content: string;
  time: string;
  source: string;
  keywords: string[];
  url?: string;
}

/**
 * 创建 axios 实例
 */
const apiAxios = axios.create({
  timeout: 15000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
  }
});

/**
 * 方法1: 使用 Cheerio 爬取金十快讯
 */
export async function scrapeJinshiFlash(): Promise<JinshinewsItem[]> {
  try {
    // 金十快讯页面 URL
    const url = 'https://www.jin10.com/flash/';

    console.log('[Jinshi Scraper] 开始爬取金十快讯...');

    const response = await apiAxios.get(url);
    const html = response.data;
    const $ = cheerio.load(html);

    const newsList: JinshinewsItem[] = [];

    // 金十快讯的数据通常在动态加载的内容中
    // 这里尝试解析可能的DOM结构
    $('.jin-flash-item, .flash-item, .news-item').each((index, element) => {
      try {
        const $item = $(element);
        const title = $item.find('.content, .title, h3, p').first().text().trim();
        const time = $item.find('.time, .date, .timestamp').first().text().trim();
        const id = `jinshi-${Date.now()}-${index}`;

        if (title && title.length > 10) {
          // 提取关键词
          const keywords = extractKeywords(title);

          newsList.push({
            id,
            title,
            content: title, // 快讯通常只有标题
            time: time || new Date().toISOString(),
            source: '金十数据',
            keywords
          });
        }
      } catch (err) {
        // 跳过解析失败的项
      }
    });

    // 如果没有解析到数据,返回空数组
    if (newsList.length === 0) {
      console.log('[Jinshi Scraper] 未解析到快讯数据');
    } else {
      console.log(`[Jinshi Scraper] 成功爬取 ${newsList.length} 条快讯`);
    }

    return newsList;
  } catch (error) {
    console.error('[Jinshi Scraper] 爬取金十快讯失败:', error);
    return [];
  }
}

/**
 * 方法2: 使用金十API(如果可用)
 * 注意: 金十API可能需要认证或有反爬机制
 */
export async function fetchJinshiAPI(): Promise<JinshinewsItem[]> {
  try {
    // 金十可能的API端点
    const apiUrl = 'https://www.jin10.com/flash';

    const response = await axios.get(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.jin10.com/',
        'X-Requested-With': 'XMLHttpRequest',
      },
      timeout: 10000
    });

    // 尝试解析返回的JSON数据
    const data = response.data;

    if (data && Array.isArray(data)) {
      return data.map((item: any) => ({
        id: `jinshi-${item.id || Date.now()}`,
        title: item.title || item.content || '',
        content: item.content || item.title || '',
        time: item.time || item.datetime || new Date().toISOString(),
        source: '金十数据',
        keywords: extractKeywords(item.title || item.content || '')
      }));
    }

    return [];
  } catch (error) {
    console.error('[Jinshi Scraper] 调用金十API失败:', error);
    return [];
  }
}

/**
 * 方法3: 混合方法 - 尝试多种来源获取金十数据
 */
export async function fetchJinshinews(count: number = 10): Promise<JinshinewsItem[]> {
  const methods = [
    { name: 'API', fn: fetchJinshiAPI },
    { name: '爬虫', fn: scrapeJinshiFlash }
  ];

  let allNews: JinshinewsItem[] = [];

  // 尝试所有方法,收集成功的结果
  for (const method of methods) {
    try {
      console.log(`[Jinshi Scraper] 尝试方法: ${method.name}`);
      const news = await method.fn();
      if (news.length > 0) {
        allNews = allNews.concat(news);
        console.log(`[Jinshi Scraper] ${method.name} 方法成功: ${news.length} 条`);
        break; // 如果成功就停止尝试其他方法
      }
    } catch (err) {
      console.log(`[Jinshi Scraper] ${method.name} 方法失败`);
    }
  }

  // 如果所有方法都失败,返回增强的模拟数据
  if (allNews.length === 0) {
    console.log('[Jinshi Scraper] 所有方法失败,使用增强模拟数据');
    return generateEnhancedMockNews();
  }

  // 去重并限制数量
  const uniqueNews = removeDuplicates(allNews);
  return uniqueNews.slice(0, count);
}

/**
 * 生成增强的模拟数据(当真实爬虫失败时使用)
 */
function generateEnhancedMockNews(): JinshinewsItem[] {
  const baseNews = [
    {
      title: '美联储官员发表讲话:预计今年将降息两次',
      content: '美联储主席鲍威尔在最新讲话中表示,通胀有所缓解,预计今年将进行两次降息。',
      keywords: ['美联储', '降息', '黄金', '通胀']
    },
    {
      title: '地缘政治紧张局势加剧,避险情绪升温',
      content: '中东地区局势持续紧张,投资者避险情绪升温,黄金等避险资产受到关注。',
      keywords: ['地缘政治', '避险', '黄金', '中东']
    },
    {
      title: '央行持续增持黄金储备,黄金需求保持强劲',
      content: '多国央行持续增持黄金储备,显示出对黄金作为储备资产的信心。',
      keywords: ['央行', '增持', '黄金', '储备']
    },
    {
      title: '美国通胀数据超预期,加息预期升温',
      content: '最新公布的美国CPI数据超预期,市场对美联储加息的预期升温。',
      keywords: ['通胀', '加息', '美元', 'CPI']
    },
    {
      title: '全球经济增长放缓,黄金吸引力增强',
      content: '主要经济体增长放缓,市场不确定性增加,黄金的避险吸引力增强。',
      keywords: ['经济增长', '黄金', '避险', '不确定性']
    },
    {
      title: '欧洲央行维持利率不变,鸽派信号增强',
      content: '欧洲央行决定维持现有利率水平,释放出鸽派信号。',
      keywords: ['欧洲央行', '利率', '鸽派', '欧元']
    },
    {
      title: '黄金ETF持仓量连续增加,资金流入贵金属市场',
      content: '全球最大黄金ETF持仓量连续多个交易日增加,显示资金持续流入贵金属市场。',
      keywords: ['ETF', '黄金', '持仓', '资金']
    },
    {
      title: '美元指数走弱,黄金获得支撑',
      content: '美元指数近期持续走弱,为黄金价格提供了支撑。',
      keywords: ['美元', '黄金', '美元指数', '支撑']
    }
  ];

  const now = Date.now();

  return baseNews.map((item, index) => ({
    id: `mock-${now}-${index}`,
    title: item.title,
    content: item.content,
    time: new Date(now - index * 1800000).toISOString(),
    source: '金十数据(模拟)',
    keywords: item.keywords
  }));
}

/**
 * 提取关键词
 */
function extractKeywords(text: string): string[] {
  const financialKeywords = [
    '美联储', '降息', '加息', '黄金', '白银', '原油',
    '通胀', '央行', '美元', '欧元', '日元', '人民币',
    'GDP', 'CPI', 'PPI', '非农', '失业率',
    '避险', '风险', '股市', '债市', '期货',
    '地缘政治', '中东', '中美', '贸易', '制裁',
    'ETF', '持仓', '增持', '减持', '流动性',
    '经济', '增长', '衰退', '复苏', '放缓',
    '支撑', '阻力', '突破', '回调', '震荡',
    '多头', '空头', '做多', '做空', '平仓',
    '成交', '开盘', '收盘', '涨跌', '幅度'
  ];

  const found = financialKeywords.filter(keyword =>
    text.includes(keyword)
  );

  // 如果没有找到关键词,返回文本中的一些重要词语
  if (found.length === 0) {
    const words = text.split(/[，。！？、；：,.\s]+/).filter(w => w.length >= 2);
    return words.slice(0, 5);
  }

  return found;
}

/**
 * 去除重复新闻
 */
function removeDuplicates(newsList: JinshinewsItem[]): JinshinewsItem[] {
  const seen = new Set<string>();
  return newsList.filter(item => {
    const key = item.title.trim().substring(0, 50);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/**
 * 方法4: 使用 Puppeteer (更强大的爬虫,需要安装 puppeteer)
 * 注意: 此方法需要安装 puppeteer: npm install puppeteer
 */
export async function scrapeWithPuppeteer(): Promise<JinshinewsItem[]> {
  try {
    // 检查是否安装了 puppeteer
    let puppeteer;
    try {
      puppeteer = require('puppeteer');
    } catch (err) {
      console.log('[Jinshi Scraper] Puppeteer 未安装,跳过此方法');
      return [];
    }

    console.log('[Jinshi Scraper] 启动 Puppeteer 爬取金十快讯...');

    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // 设置视口和用户代理
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

    // 访问金十快讯页面
    await page.goto('https://www.jin10.com/flash/', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // 等待内容加载
    await page.waitForSelector('.jin-flash-item, .flash-item', { timeout: 10000 })
      .catch(() => console.log('[Jinshi Scraper] 等待选择器超时,继续执行'));

    // 提取新闻数据
    const newsList = await page.evaluate(() => {
      const items: any[] = [];

      // 尝试多种可能的类名
      document.querySelectorAll('.jin-flash-item, .flash-item, .news-item').forEach((item, index) => {
        const element = item as HTMLElement;

        const title = element.querySelector('.content, .title, h3, p')?.textContent?.trim() || '';
        const time = element.querySelector('.time, .date, .timestamp')?.textContent?.trim() || '';

        if (title && title.length > 10) {
          items.push({
            title,
            time: time || new Date().toISOString(),
            index
          });
        }
      });

      return items;
    });

    await browser.close();

    console.log(`[Jinshi Scraper] Puppeteer 爬取完成: ${newsList.length} 条`);

    return newsList.map((item, index) => ({
      id: `puppeteer-${Date.now()}-${index}`,
      title: item.title,
      content: item.title,
      time: item.time,
      source: '金十数据(Puppeteer)',
      keywords: extractKeywords(item.title)
    }));

  } catch (error) {
    console.error('[Jinshi Scraper] Puppeteer 爬取失败:', error);
    return [];
  }
}
