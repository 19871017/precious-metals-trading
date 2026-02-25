import React, { useState } from 'react';
import { Card, Button } from 'tdesign-react';
import { PlayCircleIcon } from 'tdesign-icons-react';

const StrategyTest: React.FC = () => {
  const [count, setCount] = useState(0);

  return (
    <div style={{ padding: '20px', backgroundColor: '#121212', minHeight: '100vh' }}>
      <h1 style={{ color: '#fff', marginBottom: '24px' }}>智能交易策略</h1>
      <Card title="测试" theme="dark">
        <p style={{ color: '#fff' }}>Count: {count}</p>
        <Button icon={<PlayCircleIcon />} onClick={() => setCount(count + 1)}>
          测试按钮
        </Button>
      </Card>
    </div>
  );
};

export default StrategyTest;
