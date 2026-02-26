import React from 'react';
import { createRoot } from 'react-dom/client';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <div style={{ padding: '20px', color: 'blue' }}>
      <h1>测试成功！React 正常工作</h1>
      <p>如果你看到这个蓝色文字，说明 React 正常渲染</p>
    </div>
  );
}
