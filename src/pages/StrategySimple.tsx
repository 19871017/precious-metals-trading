import React from 'react';
import { Card, Button } from 'tdesign-react';

const StrategySimple: React.FC = () => {
  return (
    <div style={{ padding: '20px', backgroundColor: '#121212', minHeight: '100vh' }}>
      <h1 style={{ color: '#fff', marginBottom: '24px' }}>智能交易策略(简化版)</h1>
      <Card title="测试页面" theme="dark">
        <p style={{ color: '#fff' }}>策略功能正在开发中...</p>
        <Button>测试按钮</Button>
      </Card>
    </div>
  );
};

export default StrategySimple;
