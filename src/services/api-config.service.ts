import logger from '../utils/logger';

/**
 * 支持的AI模型提供商
 */
export type AIProvider = 'gemini' | 'openai' | 'anthropic' | 'custom';

/**
 * API配置接口
 */
export interface ApiConfig {
  id: string;
  name: string;
  provider: AIProvider;
  apiKey: string;
  endpoint?: string;
  model?: string;
  enabled: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * API配置服务
 */
export class ApiConfigService {
  private configs: Map<string, ApiConfig> = new Map();
  private activeConfig: ApiConfig | null = null;

  constructor() {
    this.loadConfigs();
  }

  /**
   * 加载API配置
   */
  private loadConfigs(): void {
    try {
      const saved = localStorage.getItem('api_configs');
      if (saved) {
        const configArray = JSON.parse(saved) as ApiConfig[];
        configArray.forEach(config => {
          this.configs.set(config.id, config);
        });
      }

      const activeId = localStorage.getItem('active_api_config');
      if (activeId && this.configs.has(activeId)) {
        this.activeConfig = this.configs.get(activeId)!;
      }

      logger.info('[ApiConfig] Loaded configs', {
        total: this.configs.size,
        active: this.activeConfig?.name || 'none',
      });
    } catch (error) {
      logger.error('[ApiConfig] Failed to load configs:', error);
    }
  }

  /**
   * 保存API配置
   */
  private saveConfigs(): void {
    const configArray = Array.from(this.configs.values());
    localStorage.setItem('api_configs', JSON.stringify(configArray));

    if (this.activeConfig) {
      localStorage.setItem('active_api_config', this.activeConfig.id);
    }

    logger.info('[ApiConfig] Saved configs', { total: configArray.length });
  }

  /**
   * 获取所有配置
   */
  public getAllConfigs(): ApiConfig[] {
    return Array.from(this.configs.values()).sort((a, b) => b.priority - a.priority);
  }

  /**
   * 获取启用的配置
   */
  public getEnabledConfigs(): ApiConfig[] {
    return Array.from(this.configs.values())
      .filter(config => config.enabled)
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * 获取活跃配置
   */
  public getActiveConfig(): ApiConfig | null {
    return this.activeConfig;
  }

  /**
   * 根据ID获取配置
   */
  public getConfigById(id: string): ApiConfig | undefined {
    return this.configs.get(id);
  }

  /**
   * 创建API配置
   */
  public async createConfig(config: Partial<ApiConfig>): Promise<ApiConfig> {
    const newConfig: ApiConfig = {
      id: `api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: config.name || 'New API',
      provider: config.provider || 'gemini',
      apiKey: config.apiKey,
      endpoint: config.endpoint,
      model: config.model,
      enabled: config.enabled !== false,
      priority: config.priority || 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.validateApiConfig(newConfig);

    this.configs.set(newConfig.id, newConfig);

    if (!this.activeConfig && newConfig.enabled) {
      this.activeConfig = newConfig;
    }

    this.saveConfigs();

    logger.info('[ApiConfig] Config created', { id: newConfig.id, name: newConfig.name });

    return newConfig;
  }

  /**
   * 更新API配置
   */
  public async updateConfig(id: string, updates: Partial<ApiConfig>): Promise<ApiConfig> | null> {
    const existing = this.configs.get(id);

    if (!existing) {
      throw new Error('API配置不存在');
    }

    if (updates.apiKey) {
      await validateApiKey(existing.provider, updates.apiKey);
    }

    const updated: ApiConfig = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    if (updates.name) {
      this.configs.delete(id);
    }

    this.configs.set(id, updated);

    if (updates.enabled !== undefined && updates.enabled) {
      if (updates.enabled) {
        this.activeConfig = updated;
      } else if (this.activeConfig?.id === id) {
        this.activeConfig = null;
      }
    }

    this.saveConfigs();

    logger.info('[ApiConfig] Config updated', { id, name: updated.name });

    return updated;
  }

  /**
   * 删除API配置
   */
  public async deleteConfig(id: string): Promise<void> {
    const existing = this.configs.get(id);

    if (!existing) {
      throw new Error('API配置不存在');
    }

    if (this.activeConfig?.id === id) {
      this.activeConfig = null;
    }

    this.configs.delete(id);
    this.saveConfigs();

    logger.info('[ApiConfig] Config deleted', { id, name: existing.name });
  }

  /**
   * 设置活跃配置
   */
  public setActiveConfig(id: string): void {
    const config = this.configs.get(id);

    if (!config) {
      throw new Error('API配置不存在');
    }

    if (!config.enabled) {
      throw new Error('API配置未启用');
    }

    this.activeConfig = config;
    localStorage.setItem('active_api_config', id);

    logger.info('[ApiConfig] Active config set', { id, name: config.name });
  }

  /**
   * 禁用API配置
   */
  public async disableConfig(id: string): Promise<void> {
    const config = this.configs.get(id);

    if (!config) {
      throw new Error('API配置不存在');
    }

    await this.updateConfig(id, { enabled: false });

    if (this.activeConfig?.id === id) {
      this.activeConfig = null;
    }

    logger.info('[ApiConfig] Config disabled', { id, name: config.name });
  }

  /**
   * 测试API连接
   */
  public async testConnection(id: string): Promise<{ success: boolean; response: any; error?: string }> {
    const config = this.configs.get(id);

    if (!config) {
      throw new Error('API配置不存在');
    }

    try {
      let response: any;

      switch (config.provider) {
        case 'gemini':
          response = await this.testGemini(config);
          break;
        case 'openai':
          response = await this.testOpenAI(config);
          break;
        case 'anthropic':
          response = await this.testAnthropic(config);
          break;
        default:
          if (config.endpoint) {
            response = await this.testCustomEndpoint(config);
          } else {
            response = await this.testGemini(config);
          }
      }

      return response;
    } catch (error) {
      logger.error('[ApiConfig] Connection test failed:', error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * 测试Gemini连接
   */
  private async testGemini(config: ApiConfig): Promise<any> {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=' + config.apiKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: 'test' }],
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 10,
        },
      }),
    });

    const data = await response.json();

    if (!response.candidates || response.candidates.length === 0) {
      throw new Error('API Key无效');
    }

    return {
      success: true,
      response: data,
      message: '连接成功',
    };
  }

  /**
   * 测试OpenAI连接
   */
  private async testOpenAI(config: ApiConfig): Promise<any> {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (response.error) {
      throw new Error(response.error.message || 'API Key无效');
    }

    return {
      success: true,
      response: data,
      message: '连接成功',
    };
  }

  /**
   * 测试Anthropic连接
   */
  private async testAnthropic(config: ApiConfig): Promise<any> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': config.apiKey,
        'Content-Type': 'application/json',
        'anthropic-version: '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model || 'claude-3-sonnet-20240229',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'test' }],
      }),
    });

    const data = await response.json();

    if (data.type === 'error') {
      throw new Error(data.error?.message || 'API Key无效');
    }

    return {
      success: true,
      response: data,
      message: '连接成功',
    };
  }

  /**
   * 测试自定义端点
   */
  private async testCustomEndpoint(config: ApiConfig): Promise<any> {
    const url = config.endpoint || 'https://api.example.com/test';
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    return {
      success: response.ok,
      response: data,
      message: response.ok ? '连接成功' : '连接失败',
    };
  }

  /**
   * 验证API配置
   */
  private async validateApiConfig(config: Partial<ApiConfig>): Promise<void> {
    if (!config.apiKey || config.apiKey.trim() === '') {
      throw new Error('API Key不能为空');
    }

    if (config.apiKey.length < 32) {
      throw new Error('API Key长度不足32位');
    }

    await this.validateApiKey(config.provider, config.apiKey);
  }

  /**
   * 验证API Key
   */
  private async validateApiKey(provider: AIProvider, apiKey: string): Promise<void> {
    switch (provider) {
      case 'gemini':
        if (!apiKey.startsWith('AIza') || apiKey.length < 39) {
          throw new Error('Gemini API Key格式错误');
        }
        break;

      case 'openai':
        if (!apiKey.startsWith('sk-') || apiKey.length < 51) {
          throw new Error('OpenAI API Key格式错误');
        }
        break;

      case 'anthropic':
        if (!apiKey.startsWith('sk-ant-') || apiKey.length < 42) {
          throw new Error('Anthropic API Key格式错误');
        }
        break;

      default:
        if (apiKey.length < 32) {
          throw new Error('API Key长度至少32位');
        }
    }
  }

  /**
   * 获取默认配置模板
   */
  public getDefaultConfig(provider: AIProvider = 'gemini'): Partial<ApiConfig> {
    switch (provider) {
      case 'gemini':
        return {
          name: 'Gemini Pro 1.5 (Flash)',
          provider: 'gemini' as AIProvider,
          endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
          model: 'gemini-1.5-flash',
          enabled: true,
          priority: 10,
        };

      case 'openai':
        return {
          name: 'GPT-4',
          provider: 'openai' as AIProvider,
          endpoint: 'https://api.openai.com/v1',
          model: 'gpt-4-turbo',
          enabled: false,
          priority: 5,
        };

      case 'anthropic':
        return {
          name: 'Claude 3 Sonnet',
          provider: 'anthropic' as AIProvider,
          endpoint: 'https://api.anthropic.com/v1/messages',
          model: 'claude-3-sonnet-20240229',
          enabled: false,
          priority: 7,
        };

      default:
        return {
          name: 'Custom API',
          provider: 'custom' as AIProvider,
          enabled: false,
          priority: 1,
        };
    }
  }
}

export const apiConfigService = new ApiConfigService();
