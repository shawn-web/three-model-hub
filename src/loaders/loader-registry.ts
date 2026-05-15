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
