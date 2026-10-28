import { useCallback, useEffect, useState } from 'react'

export type DashboardLayout = 'large' | 'medium' | 'small' | 'compact'

export function useDashboardLayout() {
  const [node, setNode] = useState<HTMLElement | null>(null)
  const [layout, setLayout] = useState<DashboardLayout>('large')
  const ref = useCallback((element: HTMLElement | null) => setNode(element), [])

  useEffect(() => {
    if (!node || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width ?? node.clientWidth
      const next: DashboardLayout = width >= 1250
        ? 'large'
        : width >= 900
          ? 'medium'
          : width >= 650
            ? 'small'
            : 'compact'
      setLayout(current => current === next ? current : next)
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [node])

  return { ref, layout }
}
