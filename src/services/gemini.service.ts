// ============================================
// GEMINI AI 服务 (2026版 API 规范)
// ============================================

import logger from '../utils/logger';

// 从环境变量读取 API Key（严禁硬编码）
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!API_KEY || API_KEY === 'your_gemini_api_key_here') {
  logger.error('GEMINI API Key 未配置，AI功能将无法使用');
  logger.error('请在 .env 文件中设置 VITE_GEMINI_API_KEY');
}

// API 端点（2026 版）
const API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

// 推荐模型（按优先级排序）- 根据实际可用模型调整
const MODEL_NAMES = [
  'gemini-2.5-pro',      // Pro 模型，更稳定
  'gemini-2.5-flash',    // Flash 模型，更快
  'gemini-2.0-flash',
  'gemini-2.5-flash-lite'
];

let MODEL_NAME = 'gemini-1.5-flash'; // 默认使用稳定的模型

/**
 * 获取可用的模型列表
 */
export async function listAvailableModels(): Promise<string[]> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/models?key=${API_KEY}`
    );

    if (!response.ok) {
      logger.error('获取模型列表失败:', response.status);
      return [];
    }

    const data = await response.json();
    const models = data.models || [];

    // 过滤出支持 generateContent 的模型
    const availableModels = models
      .filter((m: any) =>
        m.supportedGenerationMethods?.includes('generateContent')
      )
      .map((m: any) => m.name.replace('models/', ''));

    logger.debug('可用的 GEMINI 模型:', availableModels);
    return availableModels;
  } catch (error) {
    logger.error('获取模型列表异常:', error);
    return [];
  }
}

/**
 * 自动检测并使用第一个可用的模型
 */
let availableModelsCache: string[] | null = null;

async function getAvailableModel(): Promise<string> {
  if (availableModelsCache === null) {
    availableModelsCache = await listAvailableModels();
  }

  // 优先使用 MODEL_NAMES 中的模型
  for (const preferredModel of MODEL_NAMES) {
    if (availableModelsCache?.includes(preferredModel)) {
      return preferredModel;
    }
  }

  // 如果没有匹配的，使用第一个可用模型
  if (availableModelsCache && availableModelsCache.length > 0) {
    return availableModelsCache[0];
  }

  // 如果还是不行，使用默认模型
  logger.warn('无法获取可用模型，使用默认模型');
  return MODEL_NAME;
}

// 交易系统提示词
const SYSTEM_PROMPT = `你是一个专业的贵金属期货交易分析师助手，具有以下特点：

1. 专业能力：
   - 精通黄金(XAU)、白银(XAG)、铂金(XPT)、钯金(XPD)等贵金属交易
   - 熟悉技术分析工具：MACD、RSI、KDJ、布林带、移动平均线等
   - 了解杠杆交易、风险管理、止盈止损策略
   - 能提供市场趋势、支撑阻力位、交易策略建议

2. 回答风格：
   - 简洁明了，突出重点
   - 数据驱动，基于技术指标分析
   - 提供具体的价格区间和操作建议
   - 风险提示清晰明确

3. 回答格式：
   - 市场概况（趋势方向）
   - 技术分析（关键指标）
   - 支撑阻力位
   - 交易建议（入场点、止损、止盈）
   - 风险提示

4. 注意事项：
   - 不承诺保本保收益
   - 强调风险管理的重要性
   - 建议合理设置止损
   - 不提供投资建议，仅作分析参考

请用中文回答，保持专业、客观的语调。`;

// 配置参数（GenerationConfig）
const GENERATION_CONFIG = {
  temperature: 0.7,        // 通用任务使用 0.7，严谨任务使用 0.1
  topK: 40,
  topP: 0.95,
  maxOutputTokens: 2048   // 设定合理的上限
};

// 上下文窗口管理（最大对话轮数）
const MAX_CONVERSATION_ROUNDS = 10;

/**
 * 指数退避重试逻辑
 * @param fn 要执行的异步函数
 * @param maxRetries 最大重试次数（默认 3 次）
 * @param initialDelay 初始延迟（毫秒，默认 1000ms）
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // 检查是否为可重试的错误
      const isRetryableError = 
        lastError.message.includes('429') || // Too Many Requests
        lastError.message.includes('timeout') || // 超时
        lastError.message.includes('ECONNRESET') || // 连接重置
        lastError.message.includes('ETIMEDOUT'); // 超时

      if (!isRetryableError || attempt === maxRetries) {
        throw lastError;
      }

      // 指数退避：每次重试延迟翻倍
      const delay = initialDelay * Math.pow(2, attempt);
      logger.debug(`API 请求失败，${delay}ms 后进行第 ${attempt + 1} 次重试...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * 维护上下文窗口（自动裁剪过长的对话历史）
 */
function manageContextWindow(
  conversationHistory: Array<{ role: string; content: string }>
): Array<{ role: string; content: string }> {
  // 如果对话轮数超过限制，保留最近的对话
  if (conversationHistory.length > MAX_CONVERSATION_ROUNDS * 2) {
    const keepCount = MAX_CONVERSATION_ROUNDS * 2;
    return conversationHistory.slice(-keepCount);
  }
  return conversationHistory;
}

/**
 * 调用 GEMINI AI 进行对话（核心函数）
 * @param message 用户消息
 * @param conversationHistory 对话历史
 * @returns AI 回复文本
 */
export async function chatWithGemini(
  message: string,
  conversationHistory: Array<{ role: string; content: string }> = []
): Promise<string> {
  // 自动获取可用模型
  const modelToUse = await getAvailableModel();
  logger.debug(`使用模型: ${modelToUse} 发送消息`);

  try {
    // 自动维护上下文窗口
    const managedHistory = manageContextWindow(conversationHistory);

    // 构建对话历史
    const historyContents = [
      { role: 'user', parts: [{ text: SYSTEM_PROMPT }] },
      ...managedHistory.map(msg => ({
        role: msg.role as 'user' | 'model',
        parts: [{ text: msg.content }]
      }))
    ];

    // 使用指数退避重试逻辑
    const response = await retryWithBackoff(async () => {
      const requestBody = {
        contents: [
          ...historyContents,
          { role: 'user', parts: [{ text: message }] }
        ],
        generationConfig: GENERATION_CONFIG
      };

      const res = await fetch(
        `${API_BASE_URL}/models/${modelToUse}:generateContent?key=${API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody)
        }
      );

      if (!res.ok) {
        const errorData = await res.json();
        logger.error('GEMINI API 完整错误响应:', errorData);

        // 内容安全过滤处理
        if (errorData.error?.code === 400 && errorData.error?.status === 'INVALID_ARGUMENT') {
          if (errorData.error?.message?.includes('blocked') || errorData.error?.message?.includes('Safety')) {
            throw new Error('内容被安全过滤器拦截，请调整您的提问内容');
          }
        }

        // API 限制
        if (res.status === 429) {
          throw new Error('API 请求频率过高，请稍后再试');
        }

        throw new Error(errorData.error?.message || `请求失败: ${res.status} - ${JSON.stringify(errorData)}`);
      }

      return res;
    });

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return text;
  } catch (error) {
    logger.error('GEMINI AI 调用失败:', error);

    // 返回友好的错误提示
    if (error instanceof Error) {
      if (error.message.includes('API_KEY') || error.message.includes('API key')) {
        return '抱歉，AI服务配置错误。请检查API Key是否正确配置。';
      }
      if (error.message.includes('429') || error.message.includes('频率过高')) {
        return '抱歉，AI调用次数已达限制，请稍后再试。';
      }
      if (error.message.includes('安全过滤器')) {
        return '抱歉，您的问题包含敏感内容，请调整后重试。';
      }
      if (error.message.includes('timeout') || error.message.includes('超时')) {
        return '抱歉，AI响应超时，请检查网络连接后重试。';
      }
    }
    
    return '抱歉，AI服务暂时不可用，请稍后再试。';
  }
}

/**
 * 流式对话（用于实时打字效果）
 * 2026 新特性：使用 generateContent stream=True 提升长文本输出体验
 */
export async function streamChatWithGemini(
  message: string,
  conversationHistory: Array<{ role: string; content: string }> = [],
  onChunk: (chunk: string) => void
): Promise<string> {
  try {
    // 自动维护上下文窗口
    const managedHistory = manageContextWindow(conversationHistory);

    // 构建对话历史
    const historyContents = [
      { role: 'user', parts: [{ text: SYSTEM_PROMPT }] },
      ...managedHistory.map(msg => ({
        role: msg.role as 'user' | 'model',
        parts: [{ text: msg.content }]
      }))
    ];

    // 使用流式端点
    const response = await retryWithBackoff(async () => {
      const res = await fetch(
        `${API_BASE_URL}/models/${MODEL_NAME}:streamGenerateContent?key=${API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              ...historyContents,
              { role: 'user', parts: [{ text: message }] }
            ],
            generationConfig: GENERATION_CONFIG
          })
        }
      );

      if (!res.ok) {
        const errorData = await res.json();
        
        if (errorData.error?.code === 400 && errorData.error?.status === 'INVALID_ARGUMENT') {
          throw new Error('内容被安全过滤器拦截，请调整您的提问内容');
        }
        
        if (res.status === 429) {
          throw new Error('API 请求频率过高，请稍后再试');
        }

        throw new Error(errorData.error?.message || `请求失败: ${res.status}`);
      }

      return res;
    });

    // 处理流式响应
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('无法读取流式响应');
    }

    const decoder = new TextDecoder();
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      
      // 解析每一行（GEMINI 流式响应每行是一个 JSON 对象）
      const lines = chunk.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            const newText = text.slice(fullText.length);
            if (newText) {
              fullText = text;
              onChunk(newText);
            }
          }
        } catch (e) {
          // 忽略解析错误（可能是不完整的 JSON）
        }
      }
    }

    return fullText;
  } catch (error) {
    logger.error('GEMINI AI 流式调用失败:', error);
    throw error;
  }
}

/**
 * 获取市场分析（JSON 格式输出）
 * 2026 新特性：使用 response_mime_type: "application/json"
 */
export async function getMarketAnalysisJSON(
  symbol: string,
  timeframe: string = '1h'
): Promise<any> {
  try {
    const managedHistory = manageContextWindow([]);
    const historyContents = [
      { role: 'user', parts: [{ text: SYSTEM_PROMPT }] },
      ...managedHistory.map(msg => ({
        role: msg.role as 'user' | 'model',
        parts: [{ text: msg.content }]
      }))
    ];

    const prompt = `请分析${symbol}在${timeframe}时间框架下的当前市场状况，返回JSON格式的结构化数据，包含以下字段：
{
  "trend": "上涨/下跌/震荡",
  "supportLevel": 1234.5,
  "resistanceLevel": 1256.7,
  "technicalIndicators": {
    "macd": "金叉/死叉/中性",
    "rsi": 65.5,
    "kdj": "金叉/死叉/中性"
  },
  "recommendation": "买入/卖出/观望",
  "riskLevel": "低/中/高",
  "summary": "简要分析描述"
}`;

    const response = await retryWithBackoff(async () => {
      const res = await fetch(
        `${API_BASE_URL}/models/${MODEL_NAME}:generateContent?key=${API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              ...historyContents,
              { role: 'user', parts: [{ text: prompt }] }
            ],
            generationConfig: {
              ...GENERATION_CONFIG,
              temperature: 0.1, // 严谨任务使用更低的温度
              responseMIMEType: 'application/json' // 2026 新特性
            }
          })
        }
      );

      if (!res.ok) {
        throw new Error(`请求失败: ${res.status}`);
      }

      return res;
    });

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    
    try {
      return JSON.parse(text);
    } catch {
      return { summary: text };
    }
  } catch (error) {
    logger.error('GEMINI AI 市场分析失败:', error);
    throw error;
  }
}

/**
 * 获取市场分析
 */
export async function getMarketAnalysis(
  symbol: string,
  timeframe: string = '1h'
): Promise<string> {
  const prompt = `请分析${symbol}在${timeframe}时间框架下的当前市场状况，包括：
1. 趋势方向
2. 关键支撑位和阻力位
3. 技术指标分析（MACD、RSI等）
4. 交易建议和风险提示`;

  return chatWithGemini(prompt);
}

/**
 * 获取交易策略建议
 */
export async function getTradingStrategy(
  symbol: string,
  direction: 'LONG' | 'SHORT' | 'NEUTRAL',
  riskTolerance: 'LOW' | 'MEDIUM' | 'HIGH'
): Promise<string> {
  const prompt = `请为${symbol}提供一个${direction}方向的交易策略，风险偏好为${riskTolerance}：
1. 入场价格区间
2. 止损价格
3. 止盈目标
4. 仓位管理建议
5. 风险提示`;

  return chatWithGemini(prompt);
}

export default {
  chatWithGemini,
  streamChatWithGemini,
  getMarketAnalysis,
  getTradingStrategy
};
