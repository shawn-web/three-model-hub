import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import { RouterApp } from './RouterApp'
import { App as AntdApp } from 'antd'
import { runStorageMigrations } from './utils/storage-migrations'
import { MessageBusProvider } from './hooks/useMessageBus'

// 应用启动时集中执行存储层迁移（localStorage / IndexedDB 旧 key 清理），幂等
runStorageMigrations()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AntdApp className='w-full h-full'>
      {/* MessageBus Provider：在根部包裹，为 iframe 嵌入页面提供按生命周期管理的消息总线实例 */}
      <MessageBusProvider>
        <RouterApp />
      </MessageBusProvider>
    </AntdApp>
  </React.StrictMode>
)
