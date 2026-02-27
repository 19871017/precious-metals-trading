import logger from '../utils/logger';
import { getEnabledConfig, getPriorityConfig } from './api-config.service';

/**
 * AI服务
 * 统一调用第三方AI模型 (Gemini/OpenAI/Anthropic)
 */
export type AIProvider = 'gemini' | 'openai' | 'anthropic' | 'custom';

interface AIService {
  /**
   * 生成市场分析摘要
   */
  generateMarketSummary(marketData: any[]): Promise<{
    trend: string;
    support: number;
    resistance: number;
    risk: 'low' | 'medium' | 'high';
    summary: string;
    newsHighlight?: string;
  }>;

  /**
   * 生成交易信号
   */
  generateTradeSignal(
    symbol: string,
    marketData: any[],
    parameters?: any
  ): Promise<{
    type: 'buy' | 'sell' | 'hold';
    price: number;
    confidence: number;
    reason: string;
    stopLoss?: number;
    takeProfit?: number;
  }>;

  /**
   * 流式对话
   */
  chat(
    message: string,
    conversationHistory: Array<{ role: 'user' | 'assistant' | 'system' }>,
    onChunk: (chunk: string) => void
  ): Promise<string>;

  /**
   * 语音输入
   */
  transcribe(audioBlob: Blob): Promise<string>;

  /**
   * 检查服务状态
   */
  checkStatus(): Promise<{ provider: string; enabled: boolean; model?: string }>;
}

class GeminiAIService implements AIService {
  private apiKey: string = '';

  async getApiKey(): Promise<string> {
    const config = getEnabledConfig();
    if (!config) {
      throw new Error('Gemini API未启用');
    }
    return config.apiKey;
  }

  async generateMarketSummary(marketData: any[]): Promise<any> {
    const apiKey = await this.getApiKey();

    const marketSummary = marketData.slice(0, 3).map(m => ({
      symbol: m.symbol || 'UNKNOWN',
      price: m.price || 0,
      change: m.changePercent || 0,
      volume: m.volume24h || 0,
    }));

    const prompt = `根据以下市场数据生成市场分析摘要:

市场数据:
${marketSummary.map(m => `- ${m.symbol}: ¥${m.price}, ${m.change >= 0 ? '+' : ''}${m.change.toFixed(2)}%, ${m.change >= 0 ? '上涨' : '下跌'}`).join('\n')}

请分析市场整体趋势、支撑位、阻力位和风险等级,返回JSON格式:
{
  "trend": "上涨|下跌|震荡",
  "support": 支撑位数字,
  "resistance": 阻力位数字,
  "risk": "low|medium|high",
  "summary": "市场分析摘要，200字以内",
  "newsHighlight": "重要新闻摘要(可选)"
}`;

    try {
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }],
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 200,
          },
        }),
      });

      const data = await response.json();

      if (data.candidates && data.candidates.length > 0) {
        const content = data.candidates[0].content.parts[0].text;
        const jsonMatch = content.match(/\{[\s\S]*"trend"[\s\S]*"\s*:\s*"([^"]+)"[\s\S]*"support"[\s\S]*"\s*:\s*"([^"]+)"[\s\S]*"resistance"[\s\S]*"\s*:\s*"([^"]+)"[\s\S]*"risk"[\s\S]*"\s*:\s*"([^"]+)"[\s\S]*"summary"[\s\S]*"\s*:\s*"([^"]+)"/);

        if (jsonMatch) {
          try {
            const jsonData = JSON.parse(jsonMatch[0]);
            return jsonData;
          } catch (e) {
            logger.warn('[GeminiAI] Failed to parse JSON, using fallback');
          }
        }
      }

      // 备选: 默认分析
      return this.getDefaultSummary(marketData);
    } catch (error) {
      logger.error('[GeminiAI] Failed to generate summary:', error);
      return this.getDefaultSummary(marketData);
    }
  }

  getDefaultSummary(marketData: any[]): any {
    const totalChange = marketData.reduce((sum, m) => sum + (m.changePercent || 0), 0);
    const avgChange = totalChange / marketData.length;

    let trend = '震荡';
    let risk: 'low';
    let support = 0;
    let resistance = 0;

    if (avgChange > 0.5) {
      trend = '上涨';
      risk = 'medium';
    } else if (avgChange < -0.5) {
      trend = '下跌';
      risk = 'medium';
    }

    const sortedPrices = marketData.map(m => m.price || 0).sort((a, b) => a - b);
    if (sortedPrices.length >= 5) {
      resistance = sortedPrices[0];
      support = sortedPrices[sortedPrices.length - 1];
    }

    return {
      trend,
      support,
      resistance,
      risk,
      summary: `${trend === '上涨' ? '市场呈现上涨趋势' : trend === '下跌' ? '市场呈现下跌趋势' : '市场震荡调整' },平均涨跌幅为${avgChange.toFixed(2)}%。`,
    };
  }

  async generateTradeSignal(
    symbol: string,
    marketData: any[],
    parameters?: any
  ): Promise<any> {
    const apiKey = await this.getApiKey();

    const currentData = marketData[0] || {};
    const previousData = marketData[1] || {};

    const { high, low, close, open } = previousData;

    const prompt = `分析${symbol}的市场数据并生成交易信号,返回JSON格式:
{
  "type": "buy" or "sell" or "hold",
  "price": 基于当前价格,
  "confidence": 0.0 - 1.0之间的置信度,
  "reason": "交易原因简述",
  "stopLoss": 止损价,
  "takeProfit": 止盈价
}

当前价格: ${close}
开盘价: ${open}
最高价: ${high}
最低价: ${低}
涨跌幅: ${((close - open) / open * 100).toFixed(2)}%

请根据以下原则生成信号:
- 市场强势 (RSI > 70 或 趋势< 30): 考虑"买入"信号
- 市场超买 (RSI > 80 或 涨势> 70): 考虑"卖出"或"观望"信号
- 市场超卖 (RSI < 20 或 趋势< 30): 考虑"买入"或"观望"信号
- 市场震荡 (RSI 30-70 或 涉势 40-60): 考虑"观望"信号

止损止盈规则:
- 止损价建议使用2%价格偏离
- 止盈价建议使用5%价格偏离
- 置信度低于0.6的信号视为弱势信号,建议"观望"

请严格按JSON格式返回,只返回JSON,不要添加其他文字说明。`;

    try {
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{ text: prompt }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 150,
            responseFormat: 'json_object',
          },
        }),
      });

      const data = await response.json();

      if (data.candidates && data.candidates.length > 0) {
        const content = data.candidates[0].content.parts[0].text;
        const jsonMatch = content.match(/\{[\s\S]*"type"[\s\S]*"\s*:\s*"(buy|sell|hold)"[\s\S]*"price"[\s\S]*"\s*:"([\d.]+)"[\s\S]*"confidence"[\s\S]*"\s*:"[d.]+)"[\s\S]*"reason"[\s\S]*"\s*":"([^"]+)"[\s\S]*}/);

        if (jsonMatch) {
          try {
            const jsonData = JSON.parse(jsonMatch[0]);
            return jsonData;
          } catch (e) {
            logger.warn('[GeminiAI] Failed to parse signal JSON, using fallback');
          }
        }
      }

      // AI失败时使用回退信号生成
      logger.warn('[GeminiAI] AI signal generation failed, using fallback signal');
      return this.getFallbackSignal(symbol, currentData);
    } catch (error) {
      logger.error('[GeminiAI] Failed to generate signal:', error);
      return this.getFallbackSignal(symbol, currentData);
    }
  }

  getFallbackSignal(symbol: string, currentData: any): any {
    const { close, open, high, low } = currentData;

    // 简化的技术指标判断
    const rsi = this.calculateRSI([close]);
    const trend = (close > open) ? '上涨' : '下跌';

    let type: 'hold';
    let confidence = 0.5;
    let reason = 'AI服务暂不可用,使用技术指标回退信号';

    // RSI信号
    if (rsi < 20) {
      type = 'buy';
      confidence = 0.6;
      reason = 'RSI超卖,可能存在反弹机会';
    } else if (rsi > 80) {
      type = 'sell';
      confidence = 0.6;
      reason = 'RSI超买,可能存在回调风险';
    } else if (trend === '上涨') {
      type = 'buy';
      confidence = 0.5;
      reason = '趋势向上';
    } else if (trend === '下跌') {
      type = 'sell';
      confidence = 0.5;
      reason = '趋势向下';
    } else {
      type = 'hold';
      confidence = 0.3;
      reason = '震荡行情,建议观望';
    }

    return {
      type: type as 'buy' | 'sell' | 'hold',
      price: close,
      confidence,
      reason,
      stopLoss: type === 'buy' ? close * 0.98 : close * 1.02,
      takeProfit: type === 'buy' ? close * 1.05 : close * 0.95,
    };
  }

  calculateRSI(prices: number[]): number {
    if (prices.length < 14) return 50;

    let gains = 0;
    let losses = 0;
    let count = 0;

    for (let i = 1; i < prices.length; i++) {
      const prev = prices[i - 1];
      const curr = prices[i];
      const change = (curr - prev) / prev * 100;

      if (change > 0) {
        gains++;
      } else {
        losses++;
      }
      count++;
    }

    if (count === 0) return 50;

    const avgLoss = losses / count;
    return 100 - avgLoss;
  }

  async chat(
    message: string,
    conversationHistory: Array<{ role: 'user' | 'assistant' | 'system' }>,
    onChunk: (chunk: string) => void
  ): Promise<string> {
    const apiKey = await this.getApiKey();

  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent', {
      method: 'POST',
      headers: {
        '0": 'Authorization: `Bearer ${apiKey}`,
        '1': 'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: message,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
          topP: 0,
          topK: 1,
        },
      }),
    });

    const data = await response.json();

    if (data.candidates && data.candidates.length > 0) {
      const content = data.candidates[0].content.parts[0].text;
      onChunk(content);
      return content;
    }

    return '抱歉，AI服务暂时不可用，请稍后再试。';
  }

  async transcribe(audioBlob: Blob): Promise<string> {
    const apiKey = await this.getApiKey();

    const formData = new FormData();
    formData.append('file', audioBlob);

    try {
      const response = await fetch(`https://speech.googleapis.com/v2p/speech`, {
        method: 'POST',
        headers: {
          '0': 'Authorization': `Bearer ${apiKey}`,
          '1': 'Content-Type': 'multipart/form-data',
        },
        body: formData,
      });

      const data = await response.json();
      return data.results?.[0]?.transcript || '';
    } catch (error) {
      logger.error('[GeminiAI] Transcription failed:', error);
      throw error;
    }
  }

  async checkStatus(): Promise<{ provider: string; enabled: boolean; model?: string }> {
    try {
      const config = await getEnabledConfig();
      if (config) {
        const response = await this.testConnection(config);
        if (response.success) {
          return {
            provider: config.provider,
            enabled: config.enabled,
            model: config.model || 'gemini-1.5-flash',
          };
        }
      }
      throw new Error('API未启用或配置不完整');
    } catch (error) {
      return {
        provider: 'gemini',
        enabled: false,
      };
    }
  }
}

class OpenAIService implements AIService {
  async getApiKey(): Promise<string> {
    const config = getEnabledConfig();
    if (!config) {
      throw new Error('OpenAI API未启用');
    }
    return config.apiKey;
  }

  async generateMarketSummary(marketData: any[]): Promise<any> {
    const apiKey = await this.getApiKey();

    const prompt = `分析以下市场数据并生成市场分析摘要:

${marketData.slice(0, 5).map(m => {
  const change = (m.changePercent || 0);
  const direction = change >= 0 ? '上涨' : '下跌';
  const strength = Math.abs(change);
  const color = change >= 0 ? '#22c55e' : '#ef4444';
  const icon = change >= 0 ? '▲' : '▼';

  return `${m.symbol} ¥${m.price || '--'} ${icon} ${color} ${change.toFixed(2)}% (${direction} ${strength.toFixed(1)}%)`;
}).join('\n')}

请分析:
1. 市场整体趋势 (上涨/下跌/震荡)
2. 关键支撑位和阻力位
3. 风险评估 (低/中/高)
4. 操作建议
5. 重要市场事件

返回JSON格式:
{
  "trend": "上涨/下跌/震荡",
  "support": 支撑位数字,
  "resistance": 阻力位数字,
  "risk": "low/medium/high",
  "summary": "200字以内的分析摘要",
  "events": ["重要市场事件1", "重要市场事件2"]
}`;

请严格按JSON格式返回,只返回JSON,不要添加其他文字说明。`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          '0': `Authorization: Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: prompt,
            }
          ],
          temperature: 0.7,
          max_tokens: 200,
          response_format: { type: "json_object" },
        }),
      });

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      logger.error('[OpenAI] Failed to generate summary:', error);
      throw error;
    }
  }

  async generateTradeSignal(
    symbol: string,
    marketData: any[],
    parameters?: any
  ): Promise<any> {
    const apiKey = await this.getApiKey();

    const currentData = marketData[0] || {};
    const prompt = `为${symbol}生成交易信号,返回JSON格式:
{
  "type": "buy" or "sell" or "hold",
  "price": "基于当前价格",
  "confidence": 0.0 - 1.0之间的置信度,
  "reason": "交易原因简述",
  "stopLoss": 止损价,
  "takeProfit": 止盈价
}

市场数据:
${JSON.stringify(currentData, null, 2)}

技术指标:
- RSI相对强弱指标
- MA移动平均线
- MACD
- 成交量

要求:
1. 除非有强烈的反向信号,否则应该跟随趋势
2. 每笔交易止损2%,止盈5%,除非技术指标显示极端的支撑/阻力
3. 置信度低于0.6的信号视为弱势信号
4. 考虑资金管理,单笔交易不超过总资金的5%

请严格按JSON格式返回,只返回JSON,不要添加其他文字说明。`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          '0': `Authorization: Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: prompt,
            }
          ],
          temperature: 0.7,
          max_tokens: 150,
          response_format: { type: "json_object" },
        }),
      });

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      logger.error('[OpenAI] Failed to generate signal:', error);
      throw error;
    }
  }

  async chat(
    message: string,
    conversationHistory: Array<{ role: 'user' | 'assistant' | 'system' }>,
    onChunk: (chunk: string) => void
  ): Promise<string> {
  const apiKey = await this.getApiKey();

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        '0': `Authorization: Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: conversationHistory.length > 0
          ? conversationHistory
          : [
              {
                role: 'system',
                content: '你是一个专业的交易员AI助手,擅长贵金属期货交易分析。'
              },
              {
                role: 'user',
                content: message,
              },
            ],
        temperature: 0.7,
        stream: false,
      }),
      });

    const data = await response.json();

    if (data.choices && data.choices.length > 0) {
      return data.choices[0].message.content;
    }

    return '抱歉,服务暂时不可用,请稍后再试。';
  } catch (error) {
    logger.error('[OpenAI] Chat failed:', error);
    throw error;
  }
  }

  async transcribe(audioBlob: Blob): Promise<string> {
    const apiKey = await this.getApiKey();

  const formData = new FormData();
  formData.append('file', audioBlob);
  formData.append('model', 'whisper-1');

  try {
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        '0': `Authorization: Bearer ${apiKey}`,
      },
      body: formData,
    });

    const data = await response.json();

    return data.text || '';
  } catch (error) {
    logger.error('[OpenAI] Transcription failed:', error);
  return '';
  }
  }

  async checkStatus(): Promise<{ provider: string; enabled: boolean; model?: string }> {
    try {
      const config = await getEnabledConfig();
      if (config) {
        const response = await this.testConnection(config);
        if (response.success) {
          return {
            provider: config.provider,
            enabled: config.enabled,
            model: config.model || 'gpt-4',
          };
        }
      }
      throw new Error('API未启用或配置不完整');
    } catch (error) {
      return {
        provider: 'openai',
    enabled: false,
  };
  }
  }

  private async testConnection(config: any): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          '0': `Authorization: Bearer ${config.apiKey}`,
        },
      });

      if (response.ok) {
        return { success: true };
      } else {
        return {
          success: false,
          error: response.statusText || 'Connection failed',
        };
      }
    } catch (error) {
      return {
        success: false,
    error: (error as Error).message,
  };
  }
}

class AnthropicAIService implements AIService {
  async getApiKey(): Promise<string> {
    const config = getEnabledConfig();
    if (!config) {
      throw new Error('Anthropic API未启用');
    }
    return config.apiKey;
  }

  async generateMarketSummary(marketData: any[]): Promise<any> {
    const apiKey = await this.getApiKey();

    const marketSummary = marketData.slice(0, 5).map(m => ({
      symbol: m.symbol || 'UNKNOWN',
      price: m.price || 0,
      change: m.changePercent || 0,
      volume: m.volume24h || 0,
    }));

    const prompt = `分析以下市场数据并生成市场分析摘要:

市场数据:
${marketSummary.map(m => `${m.symbol}: ¥${m.price || '--'}, ${(m.changePercent || 0).toFixed(2)}%, ${(m.changePercent >= 0 ? '上涨' : '下跌'}`).join('\n')}

请分析市场整体趋势、关键支撑位和阻力位、风险等级和操作建议,返回JSON格式:
{
  "trend": "上涨|下跌|震荡",
  "support": 支撑位数字,
  "ant  resistance: 阻力位数字,
  "risk": "low|medium|high",
  "summary": "市场分析摘要,200字以内",
  "events": ["重要市场事件1", "重要市场事件2"]
}`;

请严格按JSON格式返回,只返回JSON,不要添加其他文字说明。`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages/batches', {
        method: 'POST',
        headers: {
          '0': `x-api-key: ${apiKey}`,
          'x-api-version': '2023-06-01',
          'anthropic-version: '3-sonnet',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-3-sonnet-20240229',
          max_tokens: 500,
          stream: false,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        }),
      });

      const data = await response.json();

      if (data.content) {
        const contentText = Array.isArray(data.content)
          ? data.content.map(c => c.text).join('\n')
          : data.content;

        const jsonMatch = contentText.match(/\{[\s\S]*"trend"[\s\S]*"\s*:\s*"([^"]+)"[\s\S]*"support"[\s\S]*"\s*:\s*"([^"]+)"[\s\S]*"resistance"[\s\S]*"\s*:\s*"([^"]+)"[\s\S]*"risk"[\s\S]*"\s*:\s*"([^"]+)"[\s\S]*"summary"[\s\S]*"\s*:\s*"([^"]+)"/);

        if (jsonMatch) {
          try {
            const jsonData = JSON.parse(jsonMatch[0]);
            return jsonData;
          } catch (e) {
            logger.warn('[Anthropic] Failed to parse JSON, using fallback');
          }
        }
      }

      return {
        trend: '震荡',
        support: 0,
        resistance: 0,
        risk: 'medium',
        summary: '市场波动较大,建议谨慎操作',
        events: [],
      };
    } catch (error) {
      logger.error('[Anthropic] Failed to generate summary:', error);
      return {
        trend: '震荡',
        support: 0,
        resistance: 0,
        risk: 'medium',
        summary: '市场分析生成失败',
        events: [],
      };
    }
  }

  async generateTradeSignal(
    symbol: string,
    marketData: any[],
    parameters?: any
  ): Promise<any> {
    const apiKey = await this.getApiKey();

    const currentData = marketData[0] || {};
    const prompt = `为${symbol}生成交易信号,返回JSON格式:
{
  "type": "buy" or "sell" or "hold",
  "price": "基于当前价格",
  "confidence": 0.0 - 1.0之间的置信度,
  "reason": "交易原因简述",
  "stopLoss": 止损价,
  "takeProfit": 止盈价
}

市场数据:
${JSON.stringify(currentData, null, 2)}

要求:
1. 分析技术指标 (MA, MACD, RSI, BOLL, ATR, Volume)
2. 考虑市场情绪和基本面因素
3. 设置合理的止盈止损
4. 置信度低于0.7的信号不推荐
5. 考虑资金管理和风险控制
6. 只返回JSON格式,不要添加任何markdown格式或其他文字说明

请严格按JSON格式返回。`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages/batches', {
        method: 'POST',
        headers: {
          '0': `x-api-key: ${apiKey}`,
          'x-api-version: '2023-06-01',
          'anthropic-version: '3-sonnet-20240229',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-3-sonnet-20240229',
          max_tokens: 300,
          stream: false,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        }),
      });

      const data = await response.json();

      if (data.content) {
        const contentText = Array.isArray(data.content)
          ? data.content.map(c => c.text).join('\n')
          : data.content;

        const jsonMatch = contentText.match(/\{[\s\S]*"type"[\s\S]*"\s*:\s*"buy|sell|hold"[\s\S]*"\s*:\s*"([^"]+)"[\s\S]*"price"[\s\S]*"\s*:\s*"([\d\.,]+)"[\s\S]*"confidence"[\s\S]*"\s*:\s*["d.]+)"[\s\S]*"reason"[\s\S]*"\s*:\s*"([^"]+)"[\s\S]*"stopLoss"[\s\S]*"\s*:\s*"([^"]+)"[\s\S]*"takeProfit"[\s\S]*"\s*:\s*"([^"]+)"/);

        if (jsonMatch) {
          try {
            const jsonData = JSON.parse(jsonMatch[0]);
            return jsonData;
          } catch (e) {
            logger.warn('[Anthropic] Failed to parse signal JSON, using fallback');
          }
        }
      }

      return this.getFallbackSignal(symbol, currentData);
    } catch (error) {
      logger.error('[Anthropic] Failed to generate signal:', error);
      return this.getFallbackSignal(symbol, currentData);
    }
  }

  async chat(
    message: string,
    conversationHistory: Array<{ role: 'user' | 'assistant' | 'system' }>,
    onChunk: (chunk: string) => void
  ): Promise<string> {
  const apiKey = await this.getApiKey();

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages/batches', {
      method: 'POST',
      headers: {
        '0': `x-api-key: ${apiKey}`,
        'x-api-version: '2023-06-01',
        'anthropic-version: '3-sonnet-20240229',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1000,
        stream: true,
        messages: conversationHistory.length > 0
          ? conversationHistory
          : [
              {
                role: 'user',
                content: message,
              },
            ],
      }),
    });

    const data = await response.json();

    if (data.content && data.content.length > 0) {
      const content = data.content[0].message.content;
      onChunk(content);
      return '';
    }

    return '抱歉,服务暂时不可用,请稍后再试。';
  } catch (error) {
    logger.error('[Anthropic] Chat failed:', error);
    return '抱歉,服务暂时不可用,请稍后再试。';
  }
  }

  async transcribe(audioBlob: Blob): Promise<string> {
  const apiKey = await this.getApiKey();

  const formData = new FormData();
  formData.append('file', audioBlob);
  formData.append('model', 'whisper-1');
  formData.append('prompt', '识别并转录音频内容');

  try {
    const response = await fetch('https://api.anthropic.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        '0': `x-api-key: ${apiKey}`,
        'x-api-version: '2023-06-01',
        'anthropic-version: '3-sonnet-20240229',
        'Content-Type': 'multipart/form-data',
      },
      body: formData,
    });

    const data = await response.json();
    return data.text || '';
  } catch (error) {
    logger.error('[Anthropic] Transcription failed:', error);
    return '';
  }
  }

  async checkStatus(): Promise<{ provider: string; enabled: boolean; model?: string }> {
  try {
    const config = await getEnabledConfig();
    if (config) {
      const response = await this.testConnection(config);
      if (response.success) {
        return {
          provider: config.provider,
          enabled: config.enabled,
          model: config.model || 'claude-3-sonnet-20240229',
        };
      }
      throw new Error('API未启用或配置不完整');
    } catch (error) {
    return {
      provider: 'anthropic',
      enabled: false,
    };
  }
  }

  private async testConnection(config: any): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch('https://api.anthropic.com/v1/models', {
        headers: {
          '0': `x-api-key: ${config.apiKey}`,
          'x-api-version': '2023-06-01',
          'anthropic-version: '3-sonnet-20240229',
        },
      });

      if (response.ok) {
        return { success: true };
      } else {
        return {
          success: false,
          error: response.statusText || 'Connection failed',
        };
      }
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  private getFallbackSignal(symbol: string, currentData: any): any {
    const { close, open, high, low } = currentData;

    // 基于RSI和趋势生成回退信号
    const rsi = this.calculateRSI([close, open]);
    const trend = close > open ? '上涨' : '下跌';

    let type: 'hold';
    let confidence = 0.5;
    let reason = '市场震荡,建议观望';

    if (rsi < 20) {
      type = 'buy';
      confidence = 0.6;
      reason = 'RSI超卖,可能存在反弹机会';
    } else if (rsi > 80) {
      type = 'sell';
      confidence = 0.6;
      reason = 'RSI超买,可能存在回调风险';
    } else if (trend === '上涨') {
      type = 'buy';
      confidence = 0.5;
      reason = '趋势向上,建议跟进';
    } else if (trend === '下跌') {
      type = 'sell';
      confidence = 0.5;
      reason = '趋势向下,建议观望';
    }

    return {
      type,
      price: close,
      confidence,
      reason,
      stopLoss: type === 'buy' ? close * 0.98 : close * 1.02,
      takeProfit: type === 'buy' ? close * 1.05 : close * 0.95,
    };
  }

  calculateRSI(prices: number[]): number {
    if (prices.length < 14) return 50;

    let gains = 0;
    let losses = 0;
    let count = 0;

    for (let i = 1; i < prices.length; i++) {
      const prev = prices[i - 1];
      const curr = prices[i];
      const change = (curr - prev) / prev * 100;

      if (change > 0) {
        gains++;
      } else {
        losses++;
      }
      count++;
    }

    if (count === 0) return 50;

    const avgLoss = losses / count;
    return 100 - avgLoss;
  }
}

export default new GeminiAIService();
