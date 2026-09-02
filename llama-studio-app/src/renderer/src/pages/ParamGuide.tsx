// 参数详解页 — 分组手风琴 + 搜索过滤,静态文档,纯只读

import { useMemo, useState } from 'react'
import { PARAM_DOCS, type ParamDoc } from '../data/paramDocs'

const GROUPS: { key: ParamDoc['group']; label: string }[] = [
  { key: 'launch', label: '启动配置' },
  { key: 'sampling', label: '采样参数' },
  { key: 'advanced', label: '高级采样' },
  { key: 'reasoning', label: '推理强度' },
]

export default function ParamGuide() {
  const [query, setQuery] = useState('')
  const [collapsed, setCollapsed] = useState<Set<ParamDoc['group']>>(new Set())

  const q = query.trim().toLowerCase()

  // 搜索命中(匹配 flag/中文/作用)
  const hitIds = useMemo(() => {
    if (!q) return null
    return new Set(
      PARAM_DOCS.filter((d) =>
        [d.flag, d.zh, d.what, d.how, d.recommend, d.id]
          .join(' ')
          .toLowerCase()
          .includes(q),
      ).map((d) => d.id),
    )
  }, [q])

  // 搜索时强制所有组展开
  const isCollapsed = (g: ParamDoc['group']) => (hitIds ? false : collapsed.has(g))

  function toggle(g: ParamDoc['group']) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(g)) next.delete(g)
      else next.add(g)
      return next
    })
  }

  const docsInGroup = (g: ParamDoc['group']) =>
    PARAM_DOCS.filter((d) => d.group === g && (!hitIds || hitIds.has(d.id)))

  // launch 组内二级 section
  const sectionsOf = (list: ParamDoc[]): { name: string; docs: ParamDoc[] }[] => {
    const map = new Map<string, ParamDoc[]>()
    for (const d of list) {
      const key = d.section ?? ''
      const arr = map.get(key) ?? []
      arr.push(d)
      map.set(key, arr)
    }
    return [...map.entries()].map(([name, docs]) => ({ name, docs }))
  }

  return (
    <div className="h-full overflow-auto bg-[var(--c-bg)]">
      <div className="max-w-[860px] mx-auto px-6 py-6">
        <div className="mb-4">
          <h1 className="text-lg font-semibold text-[var(--c-text)]">参数详解</h1>
          <p className="text-xs text-[var(--c-faint)] mt-1">
            控制台全部参数的作用、调节方法与环境推荐。改完参数记得点「启动」或「应用并重启」生效。
          </p>
        </div>

        {/* 搜索框 */}
        <div className="sticky top-0 -mx-2 px-2 py-2 bg-[var(--c-bg)] z-10">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="🔍 搜索参数名 / 中文名 / 作用…"
            className="w-full bg-[var(--c-input)] border border-[var(--c-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--c-muted)] placeholder:text-[var(--c-faint)]"
          />
        </div>

        {/* 分组 */}
        <div className="mt-2 space-y-3">
          {GROUPS.map((g) => {
            const list = docsInGroup(g.key)
            if (hitIds && list.length === 0) return null
            return (
              <section
                key={g.key}
                className="rounded-lg border border-[var(--c-border)] bg-[var(--c-panel)] overflow-hidden"
              >
                <button
                  onClick={() => toggle(g.key)}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-[var(--c-text)] hover:bg-[var(--c-btn)]"
                >
                  <span>
                    {g.label}
                    <span className="text-xs text-[var(--c-faint)] font-normal ml-2">
                      {list.length} 项
                    </span>
                  </span>
                  <span className="text-[var(--c-muted)]">
                    {isCollapsed(g.key) ? '▸' : '▾'}
                  </span>
                </button>

                {!isCollapsed(g.key) && (
                  <div className="px-4 pb-4 space-y-2">
                    {g.key === 'launch' ? (
                      sectionsOf(list).map((sec) => (
                        <div key={sec.name}>
                          {sec.name && (
                            <div className="text-xs text-[var(--c-faint)] mt-2 mb-1">
                              — {sec.name} —
                            </div>
                          )}
                          <div className="space-y-2">
                            {sec.docs.map((d) => (
                              <ParamCard key={d.id} doc={d} />
                            ))}
                          </div>
                        </div>
                      ))
                    ) : (
                      list.map((d) => <ParamCard key={d.id} doc={d} />)
                    )}
                  </div>
                )}
              </section>
            )
          })}

          {/* 空搜索结果 */}
          {hitIds && hitIds.size === 0 && (
            <div className="text-center text-sm text-[var(--c-faint)] py-10">
              没有匹配「{query}」的参数
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ParamCard({ doc }: { doc: ParamDoc }) {
  return (
    <div className="rounded-md border border-[var(--c-border)] bg-[var(--c-bg)]/50 px-3 py-2">
      <div className="flex items-center gap-2 flex-wrap">
        <code className="text-xs text-emerald-600 dark:text-emerald-400 font-mono">
          {doc.flag}
        </code>
        <span className="text-sm font-medium text-[var(--c-text)]">{doc.zh}</span>
      </div>
      <dl className="mt-1.5 space-y-1 text-xs leading-relaxed">
        <div>
          <dt className="inline font-semibold text-[var(--c-muted)]">作用: </dt>
          <dd className="inline text-[var(--c-text)]">{doc.what}</dd>
        </div>
        <div>
          <dt className="inline font-semibold text-[var(--c-muted)]">怎么调: </dt>
          <dd className="inline text-[var(--c-text)]">{doc.how}</dd>
        </div>
        <div>
          <dt className="inline font-semibold text-emerald-600 dark:text-emerald-400">
            推荐:{' '}
          </dt>
          <dd className="inline text-[var(--c-text)]">{doc.recommend}</dd>
        </div>
      </dl>
    </div>
  )
}