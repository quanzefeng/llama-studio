// 流式安全 Markdown + KaTeX 渲染器
// 原理:unified 解析全文 → 按顶层 AST 节点切片 → 已定型块 memo 跳过重渲

import { memo, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeHighlight from 'rehype-highlight'
import 'katex/dist/katex.min.css'
import 'katex/dist/contrib/mhchem.mjs' // 注册 \ce 化学宏,否则 \ce{...} 会被当成未知命令渲染成数学模式

// physics 宏包映射 — LLM 输出量子力学/物理推导常用 physics 包命令,KaTeX 不内置,这里映射为标准 LaTeX
const PHYSICS_MACROS: Record<string, string> = {
  '\\dv': '\\frac{\\mathrm{d}#1}{\\mathrm{d}#2}', // \dv{y}{x} = dy/dx
  '\\pdv': '\\frac{\\partial #1}{\\partial #2}', // \pdv{\psi}{t}
  '\\comm': '\\left[ #1, #2 \\right]', // \comm{\hat{x}}{\hat{p}}
  '\\expval': '\\langle #1 \\rangle', // \expval{\hat{A}} 期望值
  '\\abs': '\\left| #1 \\right|', // \abs{x}
  '\\norm': '\\left\\lVert #1 \\right\\rVert', // \norm{\vec{v}}
}

/** 定界符兼容:部分模型用 \(...\)/\[...\] 而非 $...$/$$...$$,remark-math 只认后者 */
function normalizeDelimiters(md: string): string {
  // 注意:replace 替换串里 $$ 是字面 $ 的转义,故用箭头函数拼字符串避免歧义
  // \[...\] 是 display math:强制前后空行使其成为独立块(否则嵌在段落中会被当作行内数学)
  return md
    .replace(/\\\[([\s\S]*?)\\\]/g, (_m, inner: string) => '\n\n$$\n' + inner + '\n$$\n\n')
    .replace(/\\\(([\s\S]*?)\\\)/g, (_m, inner: string) => '$' + inner + '$')
}

/** pipe 保护:remark-gfm 表格解析会把公式 $...$ 内的裸 | 当作单元格分隔符导致公式被拆散。
 *  这里把 math 区间内未转义的 | 换成 \vert(KaTeX 渲染效果等同 |,但不会触发表格拆分)。
 *  必须跳过行内代码/代码块(其中的 $ 和 | 不该进入 math 状态机),且 \vert 后接字母数字时要补空格(\vertx 是未定义命令)。 */
function protectTablePipes(md: string): string {
  let out = ''
  let i = 0
  let inMath = false
  while (i < md.length) {
    const ch = md[i]

    // ---- 代码块围栏 ``` 或 ~~~(整段跳过)----
    if (!inMath && (ch === '`' || ch === '~')) {
      let n = 0
      while (md[i + n] === ch) n++
      if (n >= 3) {
        const close = md.indexOf(ch.repeat(3), i + n)
        const end = close === -1 ? md.length : close + 3
        out += md.slice(i, end)
        i = end
        continue
      }
      // 1~2 个反引号 → 行内代码,整段跳过直到配对
      let j = i + n
      let closeAt = -1
      while (j < md.length) {
        if (md[j] === ch) {
          let m = 0
          while (md[j + m] === ch) m++
          if (m === n) {
            closeAt = j
            break
          }
          j += m
        } else {
          j++
        }
      }
      const end = closeAt === -1 ? md.length : closeAt + n
      out += md.slice(i, end)
      i = end
      continue
    }

    if (ch === '$') {
      const next = md[i + 1]
      if (!inMath && next === '$') {
        inMath = true
        out += '$$'
        i += 2
        continue
      }
      if (inMath) {
        if (next === '$') {
          inMath = false
          out += '$$'
          i += 2
          continue
        }
        inMath = false
        out += '$'
        i += 1
        continue
      }
      inMath = true
      out += '$'
      i += 1
      continue
    }
    if (inMath && ch === '|') {
      if (md[i - 1] !== '\\') {
        out += '\\vert'
        // \vert 后紧跟字母/数字/反斜杠时需补空格,否则解析成 \vertx 未知命令
        const next = md[i + 1]
        if (next && /[a-zA-Z0-9\\]/.test(next)) out += ' '
      } else {
        out += '|'
      }
      i += 1
      continue
    }
    out += ch
    i += 1
  }
  return out
}

// 模块级解析引擎——只创建一次
const MDAST_ENGINE = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkBreaks)
  .use(remarkMath)

type Block = {
  key: number
  src: string
  type: string
}

/** 块级记忆化子组件 — src 是字符串原始值,默认浅比较即按值比较,已定型块不会重渲 */
export const MarkdownBlock = memo(function MarkdownBlock({ src }: { src: string }) {
  return (
    <div className="md-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]}
        rehypePlugins={[
          [rehypeKatex, { throwOnError: false, strict: false, macros: PHYSICS_MACROS }],
          rehypeHighlight,
        ]}
      >
        {src}
      </ReactMarkdown>
    </div>
  )
})

export function Markdown({ content }: { content: string }) {
  const normalized = useMemo(
    () => protectTablePipes(normalizeDelimiters(content)),
    [content],
  )
  const tree = useMemo(() => MDAST_ENGINE.parse(normalized), [normalized])

  const blocks = useMemo<Block[]>(() => {
    return tree.children.map((n) => {
      const start = n.position?.start.offset ?? 0
      const end = n.position?.end.offset ?? normalized.length
      return {
        key: start,
        src: normalized.slice(start, end),
        type: n.type,
      }
    })
  }, [tree, normalized])

  return (
    <>
      {blocks.map((b) => (
        <MarkdownBlock key={b.key} src={b.src} />
      ))}
    </>
  )
}
