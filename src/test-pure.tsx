export default function TestPure() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      margin: 0,
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '32px',
        width: '100%',
        maxWidth: '400px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0, marginBottom: '8px' }}>
            后台管理系统
          </h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
            纯React测试 - 不依赖UI库
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
              管理员用户名
            </label>
            <input
              type="text"
              placeholder="admin"
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '16px'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
              登录密码
            </label>
            <input
              type="password"
              placeholder="admin123"
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '16px'
              }}
            />
          </div>

          <button
            style={{
              width: '100%',
              padding: '12px',
              background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
            onClick={() => {
              alert('登录测试成功！说明React可以正常渲染');
            }}
          >
            登录后台管理
          </button>
        </div>

        <div style={{ marginTop: '16px', textAlign: 'center' }}>
          <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>
            测试账号: admin / admin123
          </p>
        </div>
      </div>
    </div>
  );
}
