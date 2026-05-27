import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import { RouterApp } from './RouterApp'
import { App as AntdApp } from 'antd'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AntdApp className='w-full h-full'>
      <RouterApp />
    </AntdApp>
  </React.StrictMode>
)
