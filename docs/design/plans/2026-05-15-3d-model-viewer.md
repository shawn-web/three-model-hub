# 3D Model Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an iframe-embeddable 3D model viewer with plugin architecture, supporting GLB building models with professional BIM viewer features (navigation, picking, section cutting, measurement, floor control).

**Architecture:** R3F + Plugin Module. Core viewer manages scene/camera/renderer. Each tool is an independent plugin registering via a unified interface. PostMessage handles iframe communication. Zustand for state.

**Tech Stack:** React 18, TypeScript, Three.js, @react-three/fiber, @react-three/drei, Zustand, Vite, Vitest

---

## File Structure

```
three-model-hub/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── core/
│   │   ├── viewer.ts
│   │   ├── plugin-manager.ts
│   │   └── scene-setup.ts
│   ├── communication/
│   │   ├── message-bus.ts
│   │   ├── protocol.ts
│   │   └── url-params.ts
│   ├── plugins/
│   │   ├── types.ts
│   │   ├── navigation/index.tsx
│   │   ├── picking/index.tsx
│   │   ├── section/index.tsx
│   │   ├── measurement/index.tsx
│   │   └── floor/index.tsx
│   ├── components/
│   │   ├── ViewerCanvas.tsx
│   │   ├── Toolbar.tsx
│   │   ├── ToolButton.tsx
│   │   └── EnvironmentSelector.tsx
│   ├── hooks/
│   │   ├── useViewer.ts
│   │   ├── usePlugin.ts
│   │   └── useMessageBus.ts
│   ├── loaders/
│   │   ├── loader-registry.ts
│   │   ├── glb-loader.ts
│   │   └── types.ts
│   ├── store/
│   │   └── viewer-store.ts
│   └── utils/
│       └── fit-to-view.ts
├── public/
│   ├── environments/
│   └── index.html
├── tests/
│   ├── message-bus.test.ts
│   ├── url-params.test.ts
│   ├── viewer-store.test.ts
│   ├── plugin-manager.test.ts
│   └── loader-registry.test.ts
├── package.json
├── tsconfig.json
├── vite.config.ts
└── vitest.config.ts
```

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `public/index.html`
- Create: `src/main.tsx` (placeholder)

- [ ] **Step 1: Initialize Vite project with dependencies**

```bash
cd D:/other/three-model-hub
npm create vite@latest . -- --template react-ts
```

If prompted about non-empty directory, confirm overwrite.

- [ ] **Step 2: Install dependencies**

```bash
npm install three @react-three/fiber @react-three/drei zustand
npm install -D @types/three vitest @testing-library/react jsdom
```

- [ ] **Step 3: Configure vitest**

Replace `vite.config.ts`:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
})
```

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
```

Add to `package.json` scripts:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest",
    "test:run": "vitest run"
  }
}
```

- [ ] **Step 4: Replace public/index.html with iframe-optimized version**

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>3D Model Viewer</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body, #root { width: 100%; height: 100%; overflow: hidden; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Write minimal src/main.tsx placeholder**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'

function App() {
  return <div style={{ width: '100vw', height: '100vh', background: '#1a1a2e', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>3D Viewer Loading...</div>
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 6: Verify scaffold**

```bash
npm run dev
```

Expected: Browser opens, shows "3D Viewer Loading..." on dark background. Stop dev server.

```bash
npm run test:run
```

Expected: No test files yet, exits cleanly.

- [ ] **Step 7: Commit**

```bash
git init
git add -A
git commit -m "feat: scaffold Vite + React + TS project with R3F dependencies"
```

---

### Task 2: Core Types

**Files:**
- Create: `src/communication/protocol.ts`
- Create: `src/plugins/types.ts`
- Create: `src/loaders/types.ts`

- [ ] **Step 1: Create message protocol types**

Create `src/communication/protocol.ts`:

```typescript
export interface ViewerMessage {
  type: string
  payload: unknown
  requestId?: string
}

// Messages from parent -> iframe
export interface LoadModelPayload {
  url: string
  format?: string
}

export interface SetEnvironmentPayload {
  preset?: string
  skybox?: string
  lighting?: {
    ambientColor?: string
    ambientIntensity?: number
    directionalColor?: string
    directionalIntensity?: number
  }
}

export interface ToolConfigPayload {
  visible?: string[]
  hidden?: string[]
}

export interface ToolActivatePayload {
  toolId: string
}

export interface SetCameraPayload {
  position: [number, number, number]
  target: [number, number, number]
}

export interface SetSectionPayload {
  mode: 'box' | 'axis' | 'face'
  axis?: 'x' | 'y' | 'z'
  position?: number
  normal?: [number, number, number]
  enabled: boolean
}

// Messages from iframe -> parent
export interface ModelLoadedPayload {
  metadata: {
    name: string
    size: number
    vertices: number
    boundingBox: {
      min: [number, number, number]
      max: [number, number, number]
    }
  }
}

export interface ModelErrorPayload {
  url: string
  error: string
}

export interface PickResultPayload {
  objectId: string | null
  info: Record<string, unknown>
}

export interface ProgressPayload {
  loaded: number
  total: number
  percent: number
}

// Message type constants
export const MESSAGE_TYPES = {
  // Parent -> iframe
  LOAD_MODEL: 'load-model',
  UNLOAD_MODEL: 'unload-model',
  SET_ENVIRONMENT: 'set-environment',
  TOOL_CONFIG: 'tool-config',
  TOOL_ACTIVATE: 'tool-activate',
  SET_CAMERA: 'set-camera',
  SET_SECTION: 'set-section',

  // iframe -> Parent
  VIEWER_READY: 'viewer-ready',
  MODEL_LOADED: 'model-loaded',
  MODEL_ERROR: 'model-error',
  PICK_RESULT: 'pick-result',
  TOOL_ACTIVATED: 'tool-activated',
  PROGRESS: 'progress',
} as const

export type MessageType = typeof MESSAGE_TYPES[keyof typeof MESSAGE_TYPES]
```

- [ ] **Step 2: Create plugin interface types**

Create `src/plugins/types.ts`:

```typescript
import type { ReactFC } from 'react'
import type * as THREE from 'three'

export interface ViewerContext {
  scene: THREE.Scene
  camera: THREE.Camera
  renderer: THREE.WebGLRenderer
  gl: THREE.WebGLRenderer
  store: import('../store/viewer-store').ViewerStoreApi
  messageBus: import('../communication/message-bus').MessageBus
  pluginManager: import('../core/plugin-manager').PluginManager
}

export interface ViewerPlugin {
  id: string
  name: string
  icon?: string
  group?: 'navigation' | 'picking' | 'section' | 'measurement' | 'floor'
  install(context: ViewerContext): void
  uninstall(): void
  activate(): void
  deactivate(): void
  isActive(): boolean
  toolbarComponent?: React.FC<{ plugin: ViewerPlugin }>
}
```

- [ ] **Step 3: Create loader interface types**

Create `src/loaders/types.ts`:

```typescript
import type * as THREE from 'three'

export interface ModelLoader {
  format: string
  load(url: string, onProgress?: (percent: number) => void): Promise<THREE.Group>
  dispose(model: THREE.Group): void
}

export interface LoaderRegistry {
  register(loader: ModelLoader): void
  get(format: string): ModelLoader | undefined
  supports(format: string): boolean
}
```

- [ ] **Step 4: Verify types compile**

```bash
npx tsc --noEmit
```

Expected: No type errors. May have warnings about unused imports — that's fine at this stage.

- [ ] **Step 5: Commit**

```bash
git add src/communication/protocol.ts src/plugins/types.ts src/loaders/types.ts
git commit -m "feat: add core type definitions for protocol, plugins, and loaders"
```

---

### Task 3: Zustand Store

**Files:**
- Create: `src/store/viewer-store.ts`
- Create: `tests/viewer-store.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/viewer-store.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { useViewerStore } from '../src/store/viewer-store'

describe('ViewerStore', () => {
  beforeEach(() => {
    useViewerStore.setState({
      modelUrl: null,
      modelObject: null,
      modelLoading: false,
      activePluginId: null,
      visibleTools: [],
      hiddenTools: [],
      environmentPreset: 'day',
      toolbarVisible: true,
    })
  })

  it('should set model URL', () => {
    useViewerStore.getState().setModelUrl('http://example.com/model.glb')
    expect(useViewerStore.getState().modelUrl).toBe('http://example.com/model.glb')
  })

  it('should set model loading state', () => {
    useViewerStore.getState().setModelLoading(true)
    expect(useViewerStore.getState().modelLoading).toBe(true)
  })

  it('should activate a plugin', () => {
    useViewerStore.getState().setActivePluginId('measurement')
    expect(useViewerStore.getState().activePluginId).toBe('measurement')
  })

  it('should deactivate plugin when set to null', () => {
    useViewerStore.getState().setActivePluginId('measurement')
    useViewerStore.getState().setActivePluginId(null)
    expect(useViewerStore.getState().activePluginId).toBe(null)
  })

  it('should configure visible tools', () => {
    useViewerStore.getState().setVisibleTools(['navigation', 'picking'])
    expect(useViewerStore.getState().visibleTools).toEqual(['navigation', 'picking'])
  })

  it('should configure hidden tools', () => {
    useViewerStore.getState().setHiddenTools(['measurement'])
    expect(useViewerStore.getState().hiddenTools).toEqual(['measurement'])
  })

  it('should toggle toolbar visibility', () => {
    useViewerStore.getState().setToolbarVisible(false)
    expect(useViewerStore.getState().toolbarVisible).toBe(false)
  })

  it('should set environment preset', () => {
    useViewerStore.getState().setEnvironmentPreset('sunset')
    expect(useViewerStore.getState().environmentPreset).toBe('sunset')
  })

  it('should reset viewer state', () => {
    useViewerStore.getState().setModelUrl('http://example.com/model.glb')
    useViewerStore.getState().setActivePluginId('picking')
    useViewerStore.getState().resetViewer()
    expect(useViewerStore.getState().modelUrl).toBe(null)
    expect(useViewerStore.getState().activePluginId).toBe(null)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/viewer-store.test.ts
```

Expected: FAIL — `../src/store/viewer-store` not found.

- [ ] **Step 3: Implement the store**

Create `src/store/viewer-store.ts`:

```typescript
import { create } from 'zustand'
import type * as THREE from 'three'

export interface ViewerState {
  modelUrl: string | null
  modelObject: THREE.Group | null
  modelLoading: boolean
  modelError: string | null
  activePluginId: string | null
  installedPlugins: string[]
  visibleTools: string[]
  hiddenTools: string[]
  environmentPreset: string
  toolbarVisible: boolean
}

export interface ViewerActions {
  setModelUrl: (url: string | null) => void
  setModelObject: (obj: THREE.Group | null) => void
  setModelLoading: (loading: boolean) => void
  setModelError: (error: string | null) => void
  setActivePluginId: (id: string | null) => void
  setInstalledPlugins: (ids: string[]) => void
  setVisibleTools: (tools: string[]) => void
  setHiddenTools: (tools: string[]) => void
  setEnvironmentPreset: (preset: string) => void
  setToolbarVisible: (visible: boolean) => void
  resetViewer: () => void
}

const initialState: ViewerState = {
  modelUrl: null,
  modelObject: null,
  modelLoading: false,
  modelError: null,
  activePluginId: null,
  installedPlugins: [],
  visibleTools: [],
  hiddenTools: [],
  environmentPreset: 'day',
  toolbarVisible: true,
}

export const useViewerStore = create<ViewerState & ViewerActions>()((set) => ({
  ...initialState,

  setModelUrl: (url) => set({ modelUrl: url }),
  setModelObject: (obj) => set({ modelObject: obj }),
  setModelLoading: (loading) => set({ modelLoading: loading }),
  setModelError: (error) => set({ modelError: error }),
  setActivePluginId: (id) => set({ activePluginId: id }),
  setInstalledPlugins: (ids) => set({ installedPlugins: ids }),
  setVisibleTools: (tools) => set({ visibleTools: tools }),
  setHiddenTools: (tools) => set({ hiddenTools: tools }),
  setEnvironmentPreset: (preset) => set({ environmentPreset: preset }),
  setToolbarVisible: (visible) => set({ toolbarVisible: visible }),
  resetViewer: () => set(initialState),
}))

export type ViewerStoreApi = typeof useViewerStore
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run tests/viewer-store.test.ts
```

Expected: All 9 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/store/viewer-store.ts tests/viewer-store.test.ts
git commit -m "feat: add Zustand viewer store with state management"
```

---

### Task 4: MessageBus

**Files:**
- Create: `src/communication/message-bus.ts`
- Create: `tests/message-bus.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/message-bus.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MessageBus } from '../src/communication/message-bus'

describe('MessageBus', () => {
  let bus: MessageBus

  beforeEach(() => {
    bus = new MessageBus()
  })

  afterEach(() => {
    bus.destroy()
  })

  it('should send messages to parent', () => {
    const postMessageSpy = vi.spyOn(window.parent, 'postMessage')
    bus.send('viewer-ready', { status: 'ok' })
    expect(postMessageSpy).toHaveBeenCalledWith(
      { type: 'viewer-ready', payload: { status: 'ok' } },
      '*'
    )
  })

  it('should receive messages from parent', () => {
    const handler = vi.fn()
    bus.on('load-model', handler)

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'load-model', payload: { url: 'http://example.com/model.glb' } },
      })
    )

    expect(handler).toHaveBeenCalledWith({ url: 'http://example.com/model.glb' })
  })

  it('should unsubscribe handlers', () => {
    const handler = vi.fn()
    bus.on('load-model', handler)
    bus.off('load-model', handler)

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'load-model', payload: { url: 'http://example.com/model.glb' } },
      })
    )

    expect(handler).not.toHaveBeenCalled()
  })

  it('should ignore messages without type', () => {
    const handler = vi.fn()
    bus.on('load-model', handler)

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { payload: { url: 'test' } },
      })
    )

    expect(handler).not.toHaveBeenCalled()
  })

  it('should clean up listener on destroy', () => {
    const handler = vi.fn()
    bus.on('load-model', handler)
    bus.destroy()

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'load-model', payload: { url: 'test' } },
      })
    )

    expect(handler).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/message-bus.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement MessageBus**

Create `src/communication/message-bus.ts`:

```typescript
import type { ViewerMessage } from './protocol'

export class MessageBus {
  private handlers = new Map<string, Set<(payload: unknown) => void>>()

  constructor() {
    window.addEventListener('message', this.handleMessage)
  }

  private handleMessage = (event: MessageEvent): void => {
    const msg = event.data as ViewerMessage
    if (!msg?.type) return

    const handlers = this.handlers.get(msg.type)
    if (handlers) {
      handlers.forEach((handler) => handler(msg.payload))
    }
  }

  send(type: string, payload: unknown): void {
    const message: ViewerMessage = { type, payload }
    window.parent.postMessage(message, '*')
  }

  on(type: string, handler: (payload: unknown) => void): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set())
    }
    this.handlers.get(type)!.add(handler)
  }

  off(type: string, handler: (payload: unknown) => void): void {
    this.handlers.get(type)?.delete(handler)
  }

  destroy(): void {
    window.removeEventListener('message', this.handleMessage)
    this.handlers.clear()
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run tests/message-bus.test.ts
```

Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/communication/message-bus.ts tests/message-bus.test.ts
git commit -m "feat: add MessageBus for postMessage communication"
```

---

### Task 5: URL Params Parser

**Files:**
- Create: `src/communication/url-params.ts`
- Create: `tests/url-params.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/url-params.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { parseUrlParams } from '../src/communication/url-params'

describe('parseUrlParams', () => {
  it('should parse modelUrl from query string', () => {
    const result = parseUrlParams('?modelUrl=http://example.com/model.glb')
    expect(result.modelUrl).toBe('http://example.com/model.glb')
  })

  it('should parse tools list', () => {
    const result = parseUrlParams('?tools=navigation,picking,measurement')
    expect(result.tools).toEqual(['navigation', 'picking', 'measurement'])
  })

  it('should parse environment preset', () => {
    const result = parseUrlParams('?environment=sunset')
    expect(result.environment).toBe('sunset')
  })

  it('should return defaults when no params', () => {
    const result = parseUrlParams('')
    expect(result.modelUrl).toBeNull()
    expect(result.tools).toEqual([])
    expect(result.environment).toBeNull()
  })

  it('should handle URL-encoded values', () => {
    const result = parseUrlParams('?modelUrl=http%3A%2F%2Fexample.com%2Fmodel.glb')
    expect(result.modelUrl).toBe('http://example.com/model.glb')
  })

  it('should parse toolbar visibility', () => {
    const result = parseUrlParams('?toolbar=false')
    expect(result.toolbarVisible).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/url-params.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement URL params parser**

Create `src/communication/url-params.ts`:

```typescript
export interface UrlParams {
  modelUrl: string | null
  tools: string[]
  environment: string | null
  toolbarVisible: boolean
}

export function parseUrlParams(search: string): UrlParams {
  const params = new URLSearchParams(search)

  return {
    modelUrl: params.get('modelUrl'),
    tools: params.get('tools')?.split(',').filter(Boolean) ?? [],
    environment: params.get('environment'),
    toolbarVisible: params.get('toolbar') !== 'false',
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run tests/url-params.test.ts
```

Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/communication/url-params.ts tests/url-params.test.ts
git commit -m "feat: add URL params parser for iframe initialization"
```

---

### Task 6: PluginManager + ViewerContext

**Files:**
- Create: `src/core/plugin-manager.ts`
- Create: `src/core/viewer.ts`
- Create: `tests/plugin-manager.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/plugin-manager.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { PluginManager } from '../src/core/plugin-manager'
import type { ViewerPlugin, ViewerContext } from '../src/plugins/types'

function createMockPlugin(id: string): ViewerPlugin & { activated: boolean; installed: boolean } {
  return {
    id,
    name: `Mock ${id}`,
    activated: false,
    installed: false,
    install() { this.installed = true },
    uninstall() { this.installed = false },
    activate() { this.activated = true },
    deactivate() { this.activated = false },
    isActive() { return this.activated },
  }
}

describe('PluginManager', () => {
  let manager: PluginManager
  const mockContext = {} as ViewerContext

  beforeEach(() => {
    manager = new PluginManager()
  })

  it('should register and install a plugin', () => {
    const plugin = createMockPlugin('test')
    manager.register(plugin, mockContext)
    expect(plugin.installed).toBe(true)
    expect(manager.getPluginIds()).toContain('test')
  })

  it('should activate a plugin', () => {
    const plugin = createMockPlugin('test')
    manager.register(plugin, mockContext)
    manager.activate('test')
    expect(plugin.activated).toBe(true)
  })

  it('should deactivate current plugin when activating another', () => {
    const pluginA = createMockPlugin('a')
    const pluginB = createMockPlugin('b')
    manager.register(pluginA, mockContext)
    manager.register(pluginB, mockContext)
    manager.activate('a')
    manager.activate('b')
    expect(pluginA.activated).toBe(false)
    expect(pluginB.activated).toBe(true)
  })

  it('should deactivate a plugin', () => {
    const plugin = createMockPlugin('test')
    manager.register(plugin, mockContext)
    manager.activate('test')
    manager.deactivate('test')
    expect(plugin.activated).toBe(false)
  })

  it('should unregister a plugin', () => {
    const plugin = createMockPlugin('test')
    manager.register(plugin, mockContext)
    manager.unregister('test')
    expect(manager.getPluginIds()).not.toContain('test')
    expect(plugin.installed).toBe(false)
  })

  it('should return plugin by id', () => {
    const plugin = createMockPlugin('test')
    manager.register(plugin, mockContext)
    expect(manager.getPlugin('test')).toBe(plugin)
  })

  it('should return undefined for unknown plugin', () => {
    expect(manager.getPlugin('unknown')).toBeUndefined()
  })

  it('should return all registered plugins', () => {
    manager.register(createMockPlugin('a'), mockContext)
    manager.register(createMockPlugin('b'), mockContext)
    expect(manager.getPluginIds()).toEqual(['a', 'b'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/plugin-manager.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement PluginManager**

Create `src/core/plugin-manager.ts`:

```typescript
import type { ViewerPlugin, ViewerContext } from '../plugins/types'

export class PluginManager {
  private plugins = new Map<string, ViewerPlugin>()
  private activePluginId: string | null = null
  private context: ViewerContext | null = null

  setContext(context: ViewerContext): void {
    this.context = context
  }

  register(plugin: ViewerPlugin, context?: ViewerContext): void {
    const ctx = context ?? this.context
    if (!ctx) throw new Error('ViewerContext not set')

    this.plugins.set(plugin.id, plugin)
    plugin.install(ctx)
  }

  unregister(pluginId: string): void {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) return

    if (this.activePluginId === pluginId) {
      plugin.deactivate()
      this.activePluginId = null
    }
    plugin.uninstall()
    this.plugins.delete(pluginId)
  }

  activate(pluginId: string): void {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) return

    if (this.activePluginId && this.activePluginId !== pluginId) {
      this.plugins.get(this.activePluginId)?.deactivate()
    }

    this.activePluginId = pluginId
    plugin.activate()
  }

  deactivate(pluginId: string): void {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) return

    if (this.activePluginId === pluginId) {
      this.activePluginId = null
    }
    plugin.deactivate()
  }

  getPlugin(pluginId: string): ViewerPlugin | undefined {
    return this.plugins.get(pluginId)
  }

  getPluginIds(): string[] {
    return Array.from(this.plugins.keys())
  }

  getActivePluginId(): string | null {
    return this.activePluginId
  }

  getAllPlugins(): ViewerPlugin[] {
    return Array.from(this.plugins.values())
  }
}
```

- [ ] **Step 4: Implement Viewer context helper**

Create `src/core/viewer.ts`:

```typescript
import type * as THREE from 'three'
import type { ViewerContext } from '../plugins/types'
import type { MessageBus } from '../communication/message-bus'
import type { PluginManager } from './plugin-manager'
import type { ViewerStoreApi } from '../store/viewer-store'

export function createViewerContext(
  scene: THREE.Scene,
  camera: THREE.Camera,
  renderer: THREE.WebGLRenderer,
  store: ViewerStoreApi,
  messageBus: MessageBus,
  pluginManager: PluginManager,
): ViewerContext {
  return {
    scene,
    camera,
    renderer,
    gl: renderer,
    store,
    messageBus,
    pluginManager,
  }
}
```

- [ ] **Step 5: Run tests**

```bash
npx vitest run tests/plugin-manager.test.ts
```

Expected: All 8 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/core/plugin-manager.ts src/core/viewer.ts tests/plugin-manager.test.ts
git commit -m "feat: add PluginManager and ViewerContext factory"
```

---

### Task 7: LoaderRegistry + GLB Loader

**Files:**
- Create: `src/loaders/loader-registry.ts`
- Create: `src/loaders/glb-loader.ts`
- Create: `tests/loader-registry.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/loader-registry.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { LoaderRegistryImpl } from '../src/loaders/loader-registry'
import type { ModelLoader } from '../src/loaders/types'
import * as THREE from 'three'

function createMockLoader(format: string): ModelLoader {
  return {
    format,
    load: vi.fn(async () => new THREE.Group()),
    dispose: vi.fn(),
  }
}

describe('LoaderRegistry', () => {
  let registry: LoaderRegistryImpl

  beforeEach(() => {
    registry = new LoaderRegistryImpl()
  })

  it('should register a loader', () => {
    const loader = createMockLoader('glb')
    registry.register(loader)
    expect(registry.supports('glb')).toBe(true)
  })

  it('should get a loader by format', () => {
    const loader = createMockLoader('glb')
    registry.register(loader)
    expect(registry.get('glb')).toBe(loader)
  })

  it('should return undefined for unsupported format', () => {
    expect(registry.get('fbx')).toBeUndefined()
  })

  it('should report unsupported format', () => {
    expect(registry.supports('fbx')).toBe(false)
  })

  it('should detect format from URL extension', () => {
    expect(registry.detectFormat('http://example.com/model.glb')).toBe('glb')
    expect(registry.detectFormat('model.FBX')).toBe('fbx')
    expect(registry.detectFormat('no-extension')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/loader-registry.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement LoaderRegistry**

Create `src/loaders/loader-registry.ts`:

```typescript
import type { ModelLoader, LoaderRegistry as ILoaderRegistry } from './types'

export class LoaderRegistryImpl implements ILoaderRegistry {
  private loaders = new Map<string, ModelLoader>()

  register(loader: ModelLoader): void {
    this.loaders.set(loader.format.toLowerCase(), loader)
  }

  get(format: string): ModelLoader | undefined {
    return this.loaders.get(format.toLowerCase())
  }

  supports(format: string): boolean {
    return this.loaders.has(format.toLowerCase())
  }

  detectFormat(url: string): string | null {
    const match = url.match(/\.([a-zA-Z0-9]+)(?:\?|#|$)/)
    return match ? match[1].toLowerCase() : null
  }
}
```

- [ ] **Step 4: Implement GLB Loader**

Create `src/loaders/glb-loader.ts`:

```typescript
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import type { ModelLoader } from './types'
import type * as THREE from 'three'

export class GlbLoader implements ModelLoader {
  format = 'glb'
  private gltfLoader = new GLTFLoader()

  async load(url: string, onProgress?: (percent: number) => void): Promise<THREE.Group> {
    const gltf = await this.gltfLoader.loadAsync(url, (event) => {
      if (event.lengthComputable && onProgress) {
        const percent = Math.round((event.loaded / event.total) * 100)
        onProgress(percent)
      }
    })

    const model = gltf.scene
    model.name = model.name || url.split('/').pop()?.replace('.glb', '') || 'model'
    return model
  }

  dispose(model: THREE.Group): void {
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose()
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose())
        } else {
          child.material?.dispose()
        }
      }
    })
  }
}
```

- [ ] **Step 5: Run tests**

```bash
npx vitest run tests/loader-registry.test.ts
```

Expected: All 5 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/loaders/loader-registry.ts src/loaders/glb-loader.ts tests/loader-registry.test.ts
git commit -m "feat: add LoaderRegistry and GLB model loader"
```

---

### Task 8: R3F Canvas + Scene Setup

**Files:**
- Create: `src/core/scene-setup.tsx`
- Create: `src/components/ViewerCanvas.tsx`
- Create: `src/utils/fit-to-view.ts`

This task produces visual output. Test by running `npm run dev` and loading in browser.

- [ ] **Step 1: Create fit-to-view utility**

Create `src/utils/fit-to-view.ts`:

```typescript
import * as THREE from 'three'

export interface FitToViewOptions {
  padding?: number
  animated?: boolean
}

export function fitToView(
  camera: THREE.PerspectiveCamera,
  controls: { target: THREE.Vector3; update: () => void },
  object: THREE.Object3D,
  options: FitToViewOptions = {},
): void {
  const { padding = 1.2 } = options
  const box = new THREE.Box3().setFromObject(object)
  const center = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())

  const maxDim = Math.max(size.x, size.y, size.z)
  const fov = camera.fov * (Math.PI / 180)
  let cameraZ = Math.abs(maxDim / (2 * Math.tan(fov / 2)))
  cameraZ *= padding

  const direction = new THREE.Vector3()
    .subVectors(camera.position, controls.target)
    .normalize()

  camera.position.copy(center).add(direction.multiplyScalar(cameraZ))
  controls.target.copy(center)
  camera.lookAt(center)
  controls.update()

  camera.near = maxDim / 100
  camera.far = maxDim * 100
  camera.updateProjectionMatrix()
}
```

- [ ] **Step 2: Create scene setup component**

Create `src/core/scene-setup.tsx`:

```tsx
import { useRef, useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { Environment, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { useViewerStore } from '../store/viewer-store'
import { fitToView } from '../utils/fit-to-view'

export function SceneSetup() {
  const controlsRef = useRef<any>(null)
  const { camera, scene, gl } = useThree()
  const modelObject = useViewerStore((s) => s.modelObject)
  const environmentPreset = useViewerStore((s) => s.environmentPreset)

  useEffect(() => {
    scene.background = new THREE.Color(0x1a1a2e)
    gl.shadowMap.enabled = true
    gl.shadowMap.type = THREE.PCFSoftShadowMap
    gl.toneMapping = THREE.ACESFilmicToneMapping
    gl.toneMappingExposure = 1.0
  }, [scene, gl])

  useEffect(() => {
    if (modelObject && controlsRef.current) {
      scene.add(modelObject)
      const cam = camera as THREE.PerspectiveCamera
      fitToView(cam, controlsRef.current, modelObject)
    }
    return () => {
      if (modelObject) {
        scene.remove(modelObject)
      }
    }
  }, [modelObject, scene, camera])

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[50, 50, 25]}
        intensity={1.0}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={200}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
      />
      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.1}
        makeDefault
      />
      {environmentPreset !== 'none' && (
        <Environment preset={environmentPreset as any} background={false} />
      )}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.01, 0]}
        receiveShadow
      >
        <planeGeometry args={[1000, 1000]} />
        <shadowMaterial opacity={0.15} />
      </mesh>
      <gridHelper args={[100, 100, 0x444444, 0x222222]} />
    </>
  )
}
```

- [ ] **Step 3: Create ViewerCanvas component**

Create `src/components/ViewerCanvas.tsx`:

```tsx
import { Canvas } from '@react-three/fiber'
import { Suspense } from 'react'
import { SceneSetup } from '../core/scene-setup'

export function ViewerCanvas() {
  return (
    <Canvas
      camera={{ position: [10, 10, 10], fov: 50, near: 0.01, far: 10000 }}
      shadows
      dpr={window.devicePixelRatio}
      gl={{ antialias: true, alpha: false }}
      style={{ width: '100%', height: '100%' }}
    >
      <Suspense fallback={null}>
        <SceneSetup />
      </Suspense>
    </Canvas>
  )
}
```

- [ ] **Step 4: Verify visually**

```bash
npm run dev
```

Expected: Browser shows a dark scene with grid, ambient + directional lighting, orbit controls working. No model loaded yet (that's fine).

- [ ] **Step 5: Commit**

```bash
git add src/core/scene-setup.tsx src/components/ViewerCanvas.tsx src/utils/fit-to-view.ts
git commit -m "feat: add R3F Canvas with scene setup, lighting, and orbit controls"
```

---

### Task 9: Environment Presets

**Files:**
- Create: `src/components/EnvironmentSelector.tsx`

- [ ] **Step 1: Create environment selector**

Create `src/components/EnvironmentSelector.tsx`:

```tsx
import { useViewerStore } from '../store/viewer-store'

const ENVIRONMENT_PRESETS = [
  { id: 'day', label: '晴天', preset: 'city' },
  { id: 'sunset', label: '黄昏', preset: 'sunset' },
  { id: 'dawn', label: '黎明', preset: 'dawn' },
  { id: 'night', label: '夜晚', preset: 'night' },
  { id: 'warehouse', label: '室内', preset: 'warehouse' },
  { id: 'none', label: '纯色', preset: 'none' },
] as const

export function EnvironmentSelector() {
  const environmentPreset = useViewerStore((s) => s.environmentPreset)
  const setEnvironmentPreset = useViewerStore((s) => s.setEnvironmentPreset)

  return (
    <div style={{
      position: 'absolute',
      top: 8,
      right: 8,
      display: 'flex',
      gap: 4,
      background: 'rgba(0,0,0,0.6)',
      borderRadius: 6,
      padding: 4,
    }}>
      {ENVIRONMENT_PRESETS.map((env) => (
        <button
          key={env.id}
          onClick={() => setEnvironmentPreset(env.id)}
          style={{
            padding: '4px 8px',
            border: 'none',
            borderRadius: 4,
            fontSize: 12,
            cursor: 'pointer',
            background: environmentPreset === env.id ? '#4a9eff' : 'rgba(255,255,255,0.1)',
            color: '#fff',
          }}
        >
          {env.label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/EnvironmentSelector.tsx
git commit -m "feat: add environment preset selector component"
```

---

### Task 10: Toolbar Components

**Files:**
- Create: `src/components/ToolButton.tsx`
- Create: `src/components/Toolbar.tsx`

- [ ] **Step 1: Create ToolButton component**

Create `src/components/ToolButton.tsx`:

```tsx
interface ToolButtonProps {
  icon: string
  label: string
  active?: boolean
  onClick: () => void
}

export function ToolButton({ icon, label, active, onClick }: ToolButtonProps) {
  return (
    <button
      onClick={onClick}
      title={label}
      style={{
        width: 36,
        height: 36,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        borderRadius: 4,
        cursor: 'pointer',
        background: active ? '#4a9eff' : 'rgba(255,255,255,0.08)',
        color: active ? '#fff' : '#ccc',
        fontSize: 18,
        transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.15)'
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
      }}
    >
      {icon}
    </button>
  )
}
```

- [ ] **Step 2: Create Toolbar component**

Create `src/components/Toolbar.tsx`:

```tsx
import { useState } from 'react'
import { ToolButton } from './ToolButton'
import { useViewerStore } from '../store/viewer-store'
import type { ViewerPlugin } from '../plugins/types'
import type { PluginManager } from '../core/plugin-manager'

interface ToolbarProps {
  pluginManager: PluginManager
}

export function Toolbar({ pluginManager }: ToolbarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const activePluginId = useViewerStore((s) => s.activePluginId)
  const visibleTools = useViewerStore((s) => s.visibleTools)
  const hiddenTools = useViewerStore((s) => s.hiddenTools)
  const toolbarVisible = useViewerStore((s) => s.toolbarVisible)

  if (!toolbarVisible) return null

  const allPlugins = pluginManager.getAllPlugins()
  const filteredPlugins = allPlugins.filter((p) => {
    if (hiddenTools.length > 0 && hiddenTools.includes(p.id)) return false
    if (visibleTools.length > 0 && !visibleTools.includes(p.id)) return false
    return true
  })

  const groups = ['navigation', 'picking', 'section', 'measurement', 'floor'] as const
  const groupedPlugins = groups.map((group) => ({
    group,
    plugins: filteredPlugins.filter((p) => p.group === group),
  })).filter((g) => g.plugins.length > 0)
  const ungrouped = filteredPlugins.filter((p) => !p.group)

  const handleToolClick = (plugin: ViewerPlugin) => {
    if (activePluginId === plugin.id) {
      pluginManager.deactivate(plugin.id)
      useViewerStore.getState().setActivePluginId(null)
    } else {
      pluginManager.activate(plugin.id)
      useViewerStore.getState().setActivePluginId(plugin.id)
    }
  }

  return (
    <div style={{
      position: 'absolute',
      bottom: 12,
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      background: 'rgba(30, 30, 40, 0.85)',
      borderRadius: 8,
      padding: collapsed ? 4 : '4px 8px',
      backdropFilter: 'blur(8px)',
    }}>
      <ToolButton
        icon={collapsed ? '☰' : '▽'}
        label={collapsed ? '展开工具栏' : '收起工具栏'}
        onClick={() => setCollapsed(!collapsed)}
      />
      {!collapsed && (
        <>
          {groupedPlugins.map(({ group, plugins }, gi) => (
            <div key={group} style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              {gi > 0 && <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.15)', margin: '0 4px' }} />}
              {plugins.map((plugin) => (
                <ToolButton
                  key={plugin.id}
                  icon={plugin.icon || '?'}
                  label={plugin.name}
                  active={activePluginId === plugin.id}
                  onClick={() => handleToolClick(plugin)}
                />
              ))}
            </div>
          ))}
          {ungrouped.length > 0 && groupedPlugins.length > 0 && (
            <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.15)', margin: '0 4px' }} />
          )}
          {ungrouped.map((plugin) => (
            <ToolButton
              key={plugin.id}
              icon={plugin.icon || '?'}
              label={plugin.name}
              active={activePluginId === plugin.id}
              onClick={() => handleToolClick(plugin)}
            />
          ))}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ToolButton.tsx src/components/Toolbar.tsx
git commit -m "feat: add Toolbar and ToolButton components with grouping"
```

---

### Task 11: Navigation Plugin

**Files:**
- Create: `src/plugins/navigation/index.tsx`

- [ ] **Step 1: Implement navigation plugin**

Create `src/plugins/navigation/index.tsx`:

```tsx
import * as THREE from 'three'
import type { ViewerPlugin, ViewerContext } from '../types'
import { fitToView } from '../../utils/fit-to-view'

export class NavigationPlugin implements ViewerPlugin {
  id = 'navigation'
  name = '导航'
  icon = '🏠'
  group = 'navigation' as const

  private context: ViewerContext | null = null
  private active = true
  private controlsRef: any = null

  install(context: ViewerContext): void {
    this.context = context
    this.active = true
  }

  uninstall(): void {
    this.context = null
  }

  activate(): void {
    this.active = true
  }

  deactivate(): void {
    this.active = false
  }

  isActive(): boolean {
    return this.active
  }

  fitToView(): void {
    if (!this.context) return
    const { camera, modelObject } = {
      camera: this.context.camera as THREE.PerspectiveCamera,
      modelObject: this.context.store.getState().modelObject,
    }
    if (!modelObject) return

    const controls = (this.context.scene as any).__r3f_controls
    if (controls) {
      fitToView(camera, controls, modelObject)
    }
  }

  setCamera(position: THREE.Vector3, target: THREE.Vector3): void {
    if (!this.context) return
    const camera = this.context.camera as THREE.PerspectiveCamera
    camera.position.copy(position)
    camera.lookAt(target)
  }
}

export function createNavigationPlugin(): ViewerPlugin {
  return new NavigationPlugin()
}
```

- [ ] **Step 2: Commit**

```bash
git add src/plugins/navigation/index.tsx
git commit -m "feat: add navigation plugin with fit-to-view and camera control"
```

---

### Task 12: Picking Plugin

**Files:**
- Create: `src/plugins/picking/index.tsx`

- [ ] **Step 1: Implement picking plugin**

Create `src/plugins/picking/index.tsx`:

```tsx
import * as THREE from 'three'
import type { ViewerPlugin, ViewerContext } from '../types'

export class PickingPlugin implements ViewerPlugin {
  id = 'picking'
  name = '构件拾取'
  icon = '👆'
  group = 'picking' as const

  private context: ViewerContext | null = null
  private active = false
  private raycaster = new THREE.Raycaster()
  private mouse = new THREE.Vector2()
  private selectedObjects: THREE.Object3D[] = []
  private originalMaterials = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>()

  install(context: ViewerContext): void {
    this.context = context
    context.messageBus.on('pick-result', () => {})
  }

  uninstall(): void {
    this.clearSelection()
    this.context = null
  }

  activate(): void {
    this.active = true
    if (this.context) {
      this.context.renderer.domElement.addEventListener('click', this.handleClick)
      this.context.renderer.domElement.style.cursor = 'crosshair'
    }
  }

  deactivate(): void {
    this.active = false
    this.clearSelection()
    if (this.context) {
      this.context.renderer.domElement.removeEventListener('click', this.handleClick)
      this.context.renderer.domElement.style.cursor = 'default'
    }
  }

  isActive(): boolean {
    return this.active
  }

  private handleClick = (event: MouseEvent): void => {
    if (!this.context) return
    const rect = this.context.renderer.domElement.getBoundingClientRect()
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

    this.raycaster.setFromCamera(this.mouse, this.context.camera)

    const model = this.context.store.getState().modelObject
    if (!model) return

    const intersects = this.raycaster.intersectObjects(model.children, true)
    if (intersects.length > 0) {
      const hit = intersects[0].object
      this.selectObject(hit)
      this.context.messageBus.send('pick-result', {
        objectId: hit.uuid,
        info: {
          name: hit.name,
          type: hit.type,
          position: hit.position.toArray(),
        },
      })
    } else {
      this.clearSelection()
      this.context.messageBus.send('pick-result', {
        objectId: null,
        info: {},
      })
    }
  }

  private selectObject(obj: THREE.Object3D): void {
    this.clearSelection()

    if (obj instanceof THREE.Mesh) {
      this.originalMaterials.set(obj, obj.material)
      if (Array.isArray(obj.material)) {
        obj.material = obj.material.map((m) => {
          const clone = m.clone()
          clone.emissive = new THREE.Color(0x4a9eff)
          clone.emissiveIntensity = 0.3
          return clone
        })
      } else {
        const clone = obj.material.clone()
        clone.emissive = new THREE.Color(0x4a9eff)
        clone.emissiveIntensity = 0.3
        obj.material = clone
      }
      this.selectedObjects.push(obj)
    }
  }

  private clearSelection(): void {
    for (const obj of this.selectedObjects) {
      if (obj instanceof THREE.Mesh) {
        const original = this.originalMaterials.get(obj)
        if (original) {
          obj.material = original
        }
      }
    }
    this.selectedObjects = []
    this.originalMaterials.clear()
  }
}

export function createPickingPlugin(): ViewerPlugin {
  return new PickingPlugin()
}
```

- [ ] **Step 2: Commit**

```bash
git add src/plugins/picking/index.tsx
git commit -m "feat: add picking plugin with raycaster and highlight"
```

---

### Task 13: Section Plugin

**Files:**
- Create: `src/plugins/section/index.tsx`

- [ ] **Step 1: Implement section plugin**

Create `src/plugins/section/index.tsx`:

```tsx
import * as THREE from 'three'
import type { ViewerPlugin, ViewerContext } from '../types'

type SectionMode = 'box' | 'axis' | 'face'

export class SectionPlugin implements ViewerPlugin {
  id = 'section'
  name = '剖面'
  icon = '✂️'
  group = 'section' as const

  private context: ViewerContext | null = null
  private active = false
  private clippingPlanes: THREE.Plane[] = []
  private sectionMode: SectionMode = 'axis'
  private sectionAxis: 'x' | 'y' | 'z' = 'y'
  private sectionPosition = 0
  private enabled = false
  private helpers: THREE.Mesh[] = []

  install(context: ViewerContext): void {
    this.context = context
    context.messageBus.on('set-section', (payload: unknown) => {
      const p = payload as { mode: SectionMode; axis?: string; position?: number; enabled: boolean; normal?: number[] }
      this.sectionMode = p.mode
      if (p.axis) this.sectionAxis = p.axis as 'x' | 'y' | 'z'
      if (p.position !== undefined) this.sectionPosition = p.position
      this.enabled = p.enabled
      if (this.enabled) {
        this.applyClipping()
      } else {
        this.removeClipping()
      }
    })
  }

  uninstall(): void {
    this.removeClipping()
    this.context = null
  }

  activate(): void {
    this.active = true
  }

  deactivate(): void {
    this.active = false
    this.removeClipping()
  }

  isActive(): boolean {
    return this.active
  }

  private applyClipping(): void {
    if (!this.context) return
    this.removeClipping()

    const normal = new THREE.Vector3()
    switch (this.sectionAxis) {
      case 'x': normal.set(-1, 0, 0); break
      case 'y': normal.set(0, -1, 0); break
      case 'z': normal.set(0, 0, -1); break
    }

    const plane = new THREE.Plane(normal, -this.sectionPosition)
    this.clippingPlanes = [plane]

    const model = this.context.store.getState().modelObject
    if (model) {
      model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => {
              m.clippingPlanes = this.clippingPlanes
              m.clipShadows = true
              m.needsUpdate = true
            })
          } else {
            child.material.clippingPlanes = this.clippingPlanes
            child.material.clipShadows = true
            child.material.needsUpdate = true
          }
        }
      })
    }

    this.context.renderer.localClippingEnabled = true
  }

  private removeClipping(): void {
    if (this.context) {
      const model = this.context.store.getState().modelObject
      if (model) {
        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            if (Array.isArray(child.material)) {
              child.material.forEach((m) => {
                m.clippingPlanes = []
                m.needsUpdate = true
              })
            } else {
              child.material.clippingPlanes = []
              child.material.needsUpdate = true
            }
          }
        })
      }
    }
    this.clippingPlanes = []
    this.helpers.forEach((h) => h.parent?.remove(h))
    this.helpers = []
  }
}

export function createSectionPlugin(): ViewerPlugin {
  return new SectionPlugin()
}
```

- [ ] **Step 2: Commit**

```bash
git add src/plugins/section/index.tsx
git commit -m "feat: add section plugin with axis clipping"
```

---

### Task 14: Measurement Plugin

**Files:**
- Create: `src/plugins/measurement/index.tsx`

- [ ] **Step 1: Implement measurement plugin**

Create `src/plugins/measurement/index.tsx`:

```tsx
import * as THREE from 'three'
import type { ViewerPlugin, ViewerContext } from '../types'

interface Measurement {
  start: THREE.Vector3
  end: THREE.Vector3
  distance: number
  line: THREE.Line
  label: THREE.Sprite
}

export class MeasurementPlugin implements ViewerPlugin {
  id = 'measurement'
  name = '测量'
  icon = '📏'
  group = 'measurement' as const

  private context: ViewerContext | null = null
  private active = false
  private raycaster = new THREE.Raycaster()
  private mouse = new THREE.Vector2()
  private measurements: Measurement[] = []
  private pendingStart: THREE.Vector3 | null = null
  private group = new THREE.Group()

  install(context: ViewerContext): void {
    this.context = context
    context.scene.add(this.group)
  }

  uninstall(): void {
    this.clearAll()
    this.context?.scene.remove(this.group)
    this.context = null
  }

  activate(): void {
    this.active = true
    if (this.context) {
      this.context.renderer.domElement.addEventListener('click', this.handleClick)
      this.context.renderer.domElement.style.cursor = 'crosshair'
    }
  }

  deactivate(): void {
    this.active = false
    this.pendingStart = null
    if (this.context) {
      this.context.renderer.domElement.removeEventListener('click', this.handleClick)
      this.context.renderer.domElement.style.cursor = 'default'
    }
  }

  isActive(): boolean {
    return this.active
  }

  private handleClick = (event: MouseEvent): void => {
    if (!this.context) return
    const rect = this.context.renderer.domElement.getBoundingClientRect()
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

    this.raycaster.setFromCamera(this.mouse, this.context.camera)
    const model = this.context.store.getState().modelObject
    if (!model) return

    const intersects = this.raycaster.intersectObjects(model.children, true)
    if (intersects.length === 0) return

    const point = intersects[0].point

    if (!this.pendingStart) {
      this.pendingStart = point.clone()
      this.addMarker(point)
    } else {
      this.addMeasurement(this.pendingStart, point)
      this.pendingStart = null
    }
  }

  private addMarker(position: THREE.Vector3): void {
    const geometry = new THREE.SphereGeometry(0.1, 8, 8)
    const material = new THREE.MeshBasicMaterial({ color: 0x4a9eff })
    const sphere = new THREE.Mesh(geometry, material)
    sphere.position.copy(position)
    this.group.add(sphere)
  }

  private addMeasurement(start: THREE.Vector3, end: THREE.Vector3): void {
    const distance = start.distanceTo(end)
    const geometry = new THREE.BufferGeometry().setFromPoints([start, end])
    const material = new THREE.LineBasicMaterial({ color: 0x4a9eff, linewidth: 2 })
    const line = new THREE.Line(geometry, material)
    this.group.add(line)

    const midPoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5)

    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 64
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = 'rgba(0,0,0,0.7)'
    ctx.fillRect(0, 0, 256, 64)
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 32px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(`${distance.toFixed(2)}m`, 128, 42)

    const texture = new THREE.CanvasTexture(canvas)
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture })
    const sprite = new THREE.Sprite(spriteMaterial)
    sprite.position.copy(midPoint)
    sprite.scale.set(2, 0.5, 1)
    this.group.add(sprite)

    this.measurements.push({ start, end, distance, line, label: sprite })
  }

  clearAll(): void {
    while (this.group.children.length > 0) {
      const child = this.group.children[0]
      this.group.remove(child)
      if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
        child.geometry?.dispose()
        ;(child as any).material?.dispose()
      }
    }
    this.measurements = []
    this.pendingStart = null
  }
}

export function createMeasurementPlugin(): ViewerPlugin {
  return new MeasurementPlugin()
}
```

- [ ] **Step 2: Commit**

```bash
git add src/plugins/measurement/index.tsx
git commit -m "feat: add measurement plugin with point-to-point distance"
```

---

### Task 15: Floor Plugin

**Files:**
- Create: `src/plugins/floor/index.tsx`

- [ ] **Step 1: Implement floor plugin**

Create `src/plugins/floor/index.tsx`:

```tsx
import * as THREE from 'three'
import type { ViewerPlugin, ViewerContext } from '../types'

export interface FloorInfo {
  name: string
  elevation: number
  height: number
}

export class FloorPlugin implements ViewerPlugin {
  id = 'floor'
  name = '楼层'
  icon = '🏢'
  group = 'floor' as const

  private context: ViewerContext | null = null
  private active = false
  private floors: FloorInfo[] = []
  private activeFloor: number | null = null
  private clippingPlane: THREE.Plane | null = null

  install(context: ViewerContext): void {
    this.context = context
  }

  uninstall(): void {
    this.showAllFloors()
    this.context = null
  }

  activate(): void {
    this.active = true
  }

  deactivate(): void {
    this.active = false
    this.showAllFloors()
  }

  isActive(): boolean {
    return this.active
  }

  setFloors(floors: FloorInfo[]): void {
    this.floors = floors
  }

  showFloor(index: number): void {
    if (!this.context || index < 0 || index >= this.floors.length) return

    this.activeFloor = index
    const floor = this.floors[index]
    const model = this.context.store.getState().modelObject
    if (!model) return

    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const worldY = new THREE.Vector3()
        child.getWorldPosition(worldY)

        if (worldY.y >= floor.elevation && worldY.y < floor.elevation + floor.height) {
          child.visible = true
        } else {
          child.visible = false
        }
      }
    })
  }

  showAllFloors(): void {
    if (!this.context) return
    const model = this.context.store.getState().modelObject
    if (!model) return

    model.traverse((child) => {
      child.visible = true
    })
    this.activeFloor = null
  }

  getActiveFloor(): number | null {
    return this.activeFloor
  }

  getFloors(): FloorInfo[] {
    return this.floors
  }
}

export function createFloorPlugin(): ViewerPlugin {
  return new FloorPlugin()
}
```

- [ ] **Step 2: Commit**

```bash
git add src/plugins/floor/index.tsx
git commit -m "feat: add floor plugin with floor isolation and visibility"
```

---

### Task 16: React Hooks

**Files:**
- Create: `src/hooks/useMessageBus.ts`
- Create: `src/hooks/useViewer.ts`
- Create: `src/hooks/usePlugin.ts`

- [ ] **Step 1: Create useMessageBus hook**

Create `src/hooks/useMessageBus.ts`:

```tsx
import { useEffect, useRef } from 'react'
import { MessageBus } from '../communication/message-bus'

let messageBusInstance: MessageBus | null = null

export function getMessageBus(): MessageBus {
  if (!messageBusInstance) {
    messageBusInstance = new MessageBus()
  }
  return messageBusInstance
}

export function useMessageBus(): MessageBus {
  const busRef = useRef<MessageBus>(getMessageBus())

  useEffect(() => {
    return () => {
      busRef.current.destroy()
      messageBusInstance = null
    }
  }, [])

  return busRef.current
}
```

- [ ] **Step 2: Create useViewer hook**

Create `src/hooks/useViewer.ts`:

```tsx
import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { PluginManager } from '../core/plugin-manager'
import { createViewerContext } from '../core/viewer'
import { LoaderRegistryImpl } from '../loaders/loader-registry'
import { GlbLoader } from '../loaders/glb-loader'
import { getMessageBus } from './useMessageBus'
import { useViewerStore } from '../store/viewer-store'
import { MESSAGE_TYPES } from '../communication/protocol'

export function useViewer() {
  const pluginManagerRef = useRef(new PluginManager())
  const loaderRegistryRef = useRef(new LoaderRegistryImpl())
  const { scene, camera, gl } = useThree()

  useEffect(() => {
    const loaderRegistry = loaderRegistryRef.current
    loaderRegistry.register(new GlbLoader())

    const messageBus = getMessageBus()
    const pluginManager = pluginManagerRef.current
    const context = createViewerContext(
      scene, camera, gl,
      useViewerStore, messageBus, pluginManager
    )
    pluginManager.setContext(context)

    const store = useViewerStore.getState()

    messageBus.on(MESSAGE_TYPES.LOAD_MODEL, async (payload: unknown) => {
      const p = payload as { url: string; format?: string }
      const format = p.format || loaderRegistry.detectFormat(p.url) || 'glb'
      const loader = loaderRegistry.get(format)

      if (!loader) {
        messageBus.send(MESSAGE_TYPES.MODEL_ERROR, { url: p.url, error: `Unsupported format: ${format}` })
        return
      }

      store.setModelLoading(true)
      store.setModelError(null)

      try {
        const model = await loader.load(p.url, (percent) => {
          messageBus.send(MESSAGE_TYPES.PROGRESS, { loaded: percent, total: 100, percent })
        })
        store.setModelObject(model)
        store.setModelUrl(p.url)
        store.setModelLoading(false)

        const box = new THREE.Box3().setFromObject(model)
        const size = box.getSize(new THREE.Vector3())
        messageBus.send(MESSAGE_TYPES.MODEL_LOADED, {
          metadata: {
            name: model.name,
            size: size.length(),
            vertices: 0,
            boundingBox: {
              min: box.min.toArray() as [number, number, number],
              max: box.max.toArray() as [number, number, number],
            },
          },
        })
      } catch (err: any) {
        store.setModelError(err.message)
        store.setModelLoading(false)
        messageBus.send(MESSAGE_TYPES.MODEL_ERROR, { url: p.url, error: err.message })
      }
    })

    messageBus.on(MESSAGE_TYPES.UNLOAD_MODEL, () => {
      const currentModel = store.modelObject
      if (currentModel) {
        const loader = loaderRegistry.get('glb')
        loader?.dispose(currentModel)
      }
      store.setModelObject(null)
      store.setModelUrl(null)
    })

    messageBus.on(MESSAGE_TYPES.SET_ENVIRONMENT, (payload: unknown) => {
      const p = payload as { preset?: string }
      if (p.preset) {
        store.setEnvironmentPreset(p.preset)
      }
    })

    messageBus.on(MESSAGE_TYPES.TOOL_CONFIG, (payload: unknown) => {
      const p = payload as { visible?: string[]; hidden?: string[] }
      if (p.visible) store.setVisibleTools(p.visible)
      if (p.hidden) store.setHiddenTools(p.hidden)
    })

    messageBus.on(MESSAGE_TYPES.TOOL_ACTIVATE, (payload: unknown) => {
      const p = payload as { toolId: string }
      pluginManager.activate(p.toolId)
      store.setActivePluginId(p.toolId)
      messageBus.send(MESSAGE_TYPES.TOOL_ACTIVATED, { toolId: p.toolId })
    })

    return () => {
      pluginManager.getAllPlugins().forEach((p) => pluginManager.unregister(p.id))
    }
  }, [scene, camera, gl])

  return {
    pluginManager: pluginManagerRef.current,
    loaderRegistry: loaderRegistryRef.current,
  }
}
```

- [ ] **Step 3: Create usePlugin hook**

Create `src/hooks/usePlugin.ts`:

```tsx
import { useCallback } from 'react'
import { useViewerStore } from '../store/viewer-store'
import type { ViewerPlugin } from '../plugins/types'
import type { PluginManager } from '../core/plugin-manager'

export function usePlugin(pluginManager: PluginManager) {
  const activePluginId = useViewerStore((s) => s.activePluginId)

  const togglePlugin = useCallback((plugin: ViewerPlugin) => {
    const store = useViewerStore.getState()
    if (activePluginId === plugin.id) {
      pluginManager.deactivate(plugin.id)
      store.setActivePluginId(null)
    } else {
      pluginManager.activate(plugin.id)
      store.setActivePluginId(plugin.id)
    }
  }, [pluginManager, activePluginId])

  return { activePluginId, togglePlugin }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useMessageBus.ts src/hooks/useViewer.ts src/hooks/usePlugin.ts
git commit -m "feat: add React hooks for viewer, message bus, and plugin management"
```

---

### Task 17: App Integration + Entry Point

**Files:**
- Modify: `src/main.tsx`
- Create: `src/App.tsx`

- [ ] **Step 1: Create App.tsx**

Create `src/App.tsx`:

```tsx
import { useEffect } from 'react'
import { ViewerCanvas } from './components/ViewerCanvas'
import { Toolbar } from './components/Toolbar'
import { EnvironmentSelector } from './components/EnvironmentSelector'
import { useMessageBus } from './hooks/useMessageBus'
import { parseUrlParams } from './communication/url-params'
import { MESSAGE_TYPES } from './communication/protocol'
import { useViewerStore } from './store/viewer-store'

export function App() {
  const messageBus = useMessageBus()
  const modelLoading = useViewerStore((s) => s.modelLoading)

  useEffect(() => {
    const params = parseUrlParams(window.location.search)
    const store = useViewerStore.getState()

    if (params.environment) {
      store.setEnvironmentPreset(params.environment)
    }
    if (params.tools.length > 0) {
      store.setVisibleTools(params.tools)
    }
    if (!params.toolbarVisible) {
      store.setToolbarVisible(false)
    }

    messageBus.send(MESSAGE_TYPES.VIEWER_READY, { status: 'ok' })

    if (params.modelUrl) {
      setTimeout(() => {
        messageBus.handleIncoming({
          data: { type: MESSAGE_TYPES.LOAD_MODEL, payload: { url: params.modelUrl } },
        } as MessageEvent)
      }, 100)
    }
  }, [])

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      <ViewerCanvas />
      <EnvironmentSelector />
      <Toolbar pluginManager={pluginManagerRef.current} />
      {modelLoading && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: '#fff',
          fontSize: 16,
          background: 'rgba(0,0,0,0.6)',
          padding: '12px 24px',
          borderRadius: 8,
        }}>
          加载中...
        </div>
      )}
    </div>
  )
}
```

Wait — the App needs the pluginManager from inside R3F context. The Toolbar sits outside the Canvas. We need a shared ref. Let me restructure:

Rewrite `src/App.tsx`:

```tsx
import { useEffect, useRef } from 'react'
import { ViewerCanvas } from './components/ViewerCanvas'
import { Toolbar } from './components/Toolbar'
import { EnvironmentSelector } from './components/EnvironmentSelector'
import { useMessageBus } from './hooks/useMessageBus'
import { parseUrlParams } from './communication/url-params'
import { MESSAGE_TYPES } from './communication/protocol'
import { useViewerStore } from './store/viewer-store'
import { PluginManager } from './core/plugin-manager'
import { createNavigationPlugin } from './plugins/navigation'
import { createPickingPlugin } from './plugins/picking'
import { createSectionPlugin } from './plugins/section'
import { createMeasurementPlugin } from './plugins/measurement'
import { createFloorPlugin } from './plugins/floor'

export function App() {
  const messageBus = useMessageBus()
  const modelLoading = useViewerStore((s) => s.modelLoading)
  const pluginManagerRef = useRef<PluginManager | null>(null)

  useEffect(() => {
    const params = parseUrlParams(window.location.search)
    const store = useViewerStore.getState()

    if (params.environment) {
      store.setEnvironmentPreset(params.environment)
    }
    if (params.tools.length > 0) {
      store.setVisibleTools(params.tools)
    }
    if (!params.toolbarVisible) {
      store.setToolbarVisible(false)
    }

    messageBus.send(MESSAGE_TYPES.VIEWER_READY, { status: 'ok' })
  }, [])

  const setPluginManager = (pm: PluginManager) => {
    pluginManagerRef.current = pm
  }

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      <ViewerCanvas
        messageBus={messageBus}
        onPluginManagerReady={setPluginManager}
      />
      <EnvironmentSelector />
      {pluginManagerRef.current && (
        <Toolbar pluginManager={pluginManagerRef.current} />
      )}
      {modelLoading && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: '#fff',
          fontSize: 16,
          background: 'rgba(0,0,0,0.6)',
          padding: '12px 24px',
          borderRadius: 8,
        }}>
          加载中...
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Update ViewerCanvas to accept props and register plugins**

Rewrite `src/components/ViewerCanvas.tsx`:

```tsx
import { Canvas } from '@react-three/fiber'
import { Suspense, useEffect } from 'react'
import { SceneSetup } from '../core/scene-setup'
import { useViewer } from '../hooks/useViewer'
import { createNavigationPlugin } from '../plugins/navigation'
import { createPickingPlugin } from '../plugins/picking'
import { createSectionPlugin } from '../plugins/section'
import { createMeasurementPlugin } from '../plugins/measurement'
import { createFloorPlugin } from '../plugins/floor'
import type { MessageBus } from '../communication/message-bus'
import type { PluginManager } from '../core/plugin-manager'

interface ViewerCanvasProps {
  messageBus: MessageBus
  onPluginManagerReady: (pm: PluginManager) => void
}

function SceneContent({ messageBus, onPluginManagerReady }: ViewerCanvasProps) {
  const { pluginManager } = useViewer()

  useEffect(() => {
    const plugins = [
      createNavigationPlugin(),
      createPickingPlugin(),
      createSectionPlugin(),
      createMeasurementPlugin(),
      createFloorPlugin(),
    ]

    plugins.forEach((p) => pluginManager.register(p))
    pluginManager.activate('navigation')

    onPluginManagerReady(pluginManager)

    return () => {
      plugins.forEach((p) => pluginManager.unregister(p.id))
    }
  }, [pluginManager, onPluginManagerReady])

  return (
    <Suspense fallback={null}>
      <SceneSetup />
    </Suspense>
  )
}

export function ViewerCanvas({ messageBus, onPluginManagerReady }: ViewerCanvasProps) {
  return (
    <Canvas
      camera={{ position: [10, 10, 10], fov: 50, near: 0.01, far: 10000 }}
      shadows
      dpr={window.devicePixelRatio}
      gl={{ antialias: true, alpha: false }}
      style={{ width: '100%', height: '100%' }}
    >
      <SceneContent messageBus={messageBus} onPluginManagerReady={onPluginManagerReady} />
    </Canvas>
  )
}
```

- [ ] **Step 3: Update main.tsx**

Rewrite `src/main.tsx`:

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 4: Verify build compiles**

```bash
npx tsc --noEmit
```

Expected: No errors. Fix any type issues.

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/main.tsx src/components/ViewerCanvas.tsx
git commit -m "feat: wire up App with Canvas, plugins, toolbar, and communication"
```

---

### Task 18: End-to-End Verification

**Files:**
- Create: `public/test-host.html` (test page for iframe embedding)

- [ ] **Step 1: Create test host page**

Create `public/test-host.html`:

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>3D Viewer Test Host</title>
  <style>
    body { margin: 0; font-family: sans-serif; background: #f0f0f0; }
    .controls { padding: 16px; background: #fff; border-bottom: 1px solid #ddd; }
    button { margin: 4px; padding: 8px 16px; cursor: pointer; }
    #viewer-frame { width: 100%; height: calc(100vh - 60px); border: none; }
  </style>
</head>
<body>
  <div class="controls">
    <button onclick="loadModel()">Load GLB Model</button>
    <button onclick="setEnv('city')">晴天</button>
    <button onclick="setEnv('sunset')">黄昏</button>
    <button onclick="activateTool('picking')">拾取</button>
    <button onclick="activateTool('measurement')">测量</button>
    <button onclick="activateTool('section')">剖面</button>
    <button onclick="activateTool('navigation')">导航</button>
    <span id="status" style="margin-left: 16px;"></span>
  </div>
  <iframe id="viewer-frame" src="/?toolbar=true"></iframe>

  <script>
    const frame = document.getElementById('viewer-frame')
    const status = document.getElementById('status')

    window.addEventListener('message', (event) => {
      const msg = event.data
      if (msg.type === 'viewer-ready') {
        status.textContent = 'Viewer Ready'
      } else if (msg.type === 'model-loaded') {
        status.textContent = 'Model Loaded: ' + msg.payload.metadata.name
      } else if (msg.type === 'model-error') {
        status.textContent = 'Error: ' + msg.payload.error
      } else if (msg.type === 'pick-result') {
        status.textContent = 'Picked: ' + (msg.payload.objectId || 'nothing')
      } else if (msg.type === 'progress') {
        status.textContent = 'Loading: ' + msg.payload.percent + '%'
      }
    })

    function loadModel() {
      const url = prompt('Enter model URL:')
      if (url) {
        frame.contentWindow.postMessage({ type: 'load-model', payload: { url } }, '*')
      }
    }

    function setEnv(preset) {
      frame.contentWindow.postMessage({ type: 'set-environment', payload: { preset } }, '*')
    }

    function activateTool(toolId) {
      frame.contentWindow.postMessage({ type: 'tool-activate', payload: { toolId } }, '*')
    }
  </script>
</body>
</html>
```

- [ ] **Step 2: Run all tests**

```bash
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 3: Visual verification**

```bash
npm run dev
```

Open `http://localhost:5173/test-host.html` in browser.

Verify:
1. iframe loads, shows dark scene with grid
2. Status shows "Viewer Ready"
3. Click "Load GLB Model", enter a test GLB URL → model appears, camera fits
4. Environment buttons switch lighting
5. Tool buttons activate/deactivate tools
6. Toolbar at bottom shows tool icons, collapsible
7. PostMessage communication works both directions

- [ ] **Step 4: Final commit**

```bash
git add public/test-host.html
git commit -m "feat: add test host page for iframe integration verification"
```

---

## Self-Review

**Spec coverage:**
- [x] PostMessage event-driven communication → Task 4 (MessageBus) + Task 17 (App)
- [x] URL params init → Task 5 + Task 17
- [x] Plugin architecture → Task 6 (PluginManager) + Tasks 11-15
- [x] GLB loading → Task 7 (LoaderRegistry + GlbLoader)
- [x] Navigation (orbit, fit-to-view) → Task 11
- [x] Picking (raycaster, highlight, info) → Task 12
- [x] Section (axis clipping) → Task 13
- [x] Measurement (point-to-point) → Task 14
- [x] Floor (isolation) → Task 15
- [x] Toolbar (bottom, grouped, collapsible, configurable) → Task 10
- [x] Environment presets → Task 9
- [x] Zustand store → Task 3
- [x] All message types from spec → Task 4 + Task 16 (useViewer hooks)

**Placeholder scan:** No TBD/TODO/vague steps found.

**Type consistency:** ViewerMessage, ViewerPlugin, ViewerContext, ModelLoader types defined in Task 2 and used consistently through Tasks 4-17.
