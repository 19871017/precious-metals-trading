import { ConfigProvider } from 'tdesign-react';

export default function TestAdmin() {
  return (
    <ConfigProvider>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: '#1e293b'
      }}>
        <div style={{
          color: 'white',
          fontSize: '24px',
          fontWeight: 'bold'
        }}>
          后台管理系统测试页面 - 如果能看到这句话，说明加载成功
        </div>
      </div>
    </ConfigProvider>
  );
}
