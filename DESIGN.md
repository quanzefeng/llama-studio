# llama.cpp GUI Studio — 设计文档

> 一个本地桌面应用,把 llama.cpp 的 `llama-server.exe` 包成可视化控制面板 + 对话界面。
> 调参、加载模型、对话一站式,替代手敲命令行。

---

## 1. 项目目标

### 目标(In-Scope)
- 可视化控制面板:把 llama.cpp 的启动参数与采样参数做成滑块/下拉/开关/文件选择器
- 一键启动:点「启动」→ 自动 spawn `llama-server.exe` → 轮询 `/health` → 加载完切到对话页
- 自定义对话界面:流式打字机、markdown 渲染、代码高亮、多轮上下文、停止生成
- 参数预设:保存/加载常用配置组合
- 实时日志:llama-server 的 stdout/stderr 实时显示
- 进程生命周期管理:关窗即杀进程、崩溃可重启

### 非目标(Out-of-Scope,本期不做)
- 模型下载/管理(用户自己下好填路径)
- 量化/转换(用现成的 `llama-quantize.exe` 单独跑)
- 多用户/远程访问(纯本地 127.0.0.1)
- RAG / 知识库(后续可加,不在本期)

---

## 2. 架构总览

```
┌─────────────────────────────────────────────────────────┐
│                    Electron 应用                          │
│                                                           │
│  ┌──────────────┐   IPC   ┌───────────────────────────┐  │
│  │ Main Process │◄────────┤ Renderer (React + Vite)    │  │
│  │ (Node.js)    │  contextBridge │                       │  │
│  │              │────────►│ ┌───────────┐ ┌─────────┐ │  │
│  │ • spawn      │         │ │控制面板    │ │对话页    │ │  │
│  │   llama-server│        │ │(启动参数+ │ │(SSE流式 │ │  │
│  │ • 进程管理    │         │ │ 采样参数)│ │ markdown)│ │  │
│  │ • 日志转发    │         │ └───────────┘ └─────────┘ │  │
│  │ • 配置读写    │         │                           │  │
│  │ • 预设存档    │         │ zustand 状态管理          │  │
│  └──────┬───────┘         └───────────────────────────┘  │
│         │                                                  │
│         │ spawn (child_process)                            │
│         ▼                                                  │
│  ┌──────────────────────────────────┐                     │
│  │ llama-server.exe (子进程)         │                     │
│  │  HTTP API @ http://127.0.0.1:8080│◄── fetch /health    │
│  │  /v1/chat/completions (SSE)      │◄── fetch (对话)     │
│  │  /props /tokenize /slots         │                     │
│  └──────────────────────────────────┘                     │
└─────────────────────────────────────────────────────────┘
            ▲ 依赖 DLL(两个 bin 目录都进 PATH)
   D:\llama_studio\llama-b10707-bin-win-cuda-12.4-x64\
   D:\llama_studio\cudart-llama-bin-win-cuda-12.4-x64\
```

**核心原则**:渲染进程(Restricted,无 Node)只发 HTTP/fetch 请求 + 通过 IPC 让 main 干系统级的事(起进程、读写文件)。main 不直接渲染 UI。

---

## 3. 技术栈与依赖

| 层 | 选型 | 版本 | 用途 |
|---|---|---|---|
| 框架 | Electron | ^31 | 桌面壳 |
| 构建 | Vite + electron-vite | latest | 主/渲染/preload 三端打包 |
| 语言 | TypeScript | ^5.5 | 全栈类型 |
| UI | React | ^18 | 渲染层 |
| UI 组件 | shadcn/ui + Tailwind | latest | slider/dropdown/switch/dialog |
| 状态 | zustand | ^4 | 轻量全局状态 |
| SSE 解析 | @microsoft/fetch-event-source | latest | 稳定 SSE 客户端 |
| Markdown | react-markdown + rehype-highlight | latest | 对话渲染 |
| 持久化 | electron-store | ^8 | 配置/预设 JSON |
| 打包 | electron-builder | ^25 | NSIS 安装包 |

**为什么不用 `llama-cli.exe`**:它是交互式终端,要靠抓 stdout 拿回复,流式/多轮/槽位都做不稳。`llama-server.exe` 有完整 HTTP API + SSE + slot 管理,是做 GUI 后端的正解。

---

## 4. 目录结构(规划)

```
D:\llama_studio\                      ← 项目根(引擎就在隔壁)
├─ llama-b10707-bin-win-cuda-12.4-x64\  ← 引擎(只读,不动)
├─ cudart-llama-bin-win-cuda-12.4-x64\   ← CUDA 运行时(只读)
├─ DESIGN.md                           ← 本文档
└─ llama-studio-app\                   ← 应用源码(待创建)
   ├─ package.json
   ├─ electron.vite.config.ts
   ├─ electron-builder.yml
   ├─ src/
   │  ├─ main/                          ← 主进程
   │  │  ├─ index.ts                    入口
   │  │  ├─ llama-process.ts            spawn/kill/重启
   │  │  ├─ health-check.ts             轮询 /health
   │  │  ├─ ipc-handlers.ts             IPC 通道注册
   │  │  ├─ config-store.ts             electron-store 封装
   │  │  └─ arg-builder.ts              参数对象 → CLI 数组
   │  ├─ preload/
   │  │  └─ index.ts                    contextBridge 暴露安全 API
   │  └─ renderer/                      ← React
   │     ├─ index.html
   │     ├─ src/
   │     │  ├─ main.tsx
   │     │  ├─ App.tsx                   路由(控制台/对话/日志)
   │     │  ├─ store/                    zustand
   │     │  ├─ pages/
   │     │  │  ├─ ControlPanel.tsx
   │     │  │  ├─ Chat.tsx
   │     │  │  └─ LogConsole.tsx
   │     │  ├─ components/
   │     │  │  ├─ params/                各参数控件
   │     │  │  ├─ chat/                  消息流/输入框
   │     │  │  └─ ui/                    shadcn 组件
   │     │  └─ lib/
   │     │     ├─ sse-client.ts
   │     │     └─ api.ts                 封装 llama-server HTTP
   │     └─ tailwind.config.ts
   └─ data/                              运行时数据(gitignore)
      ├─ config.json                    当前配置
      └─ presets/                        预设 *.json
```

---

## 5. Electron 进程模型

### 5.1 Main Process(主进程,Node 环境)
职责:
- 创建 BrowserWindow,加载渲染页
- `child_process.spawn` 起 `llama-server.exe`,管理生命周期
- 转发子进程 stdout/stderr 到渲染层(经 IPC)
- 读写配置/预设(electron-store)
- 暴露 IPC handler 给渲染层调用(起进程/停进程/读配置/存配置)

### 5.2 Preload(contextBridge)
只暴露白名单 API,渲染层无 Node 访问权:
```ts
// preload/index.ts
window.api = {
  llama: {
    start: (config: ServerConfig) => Promise<void>,
    stop: () => Promise<void>,
    restart: (config: ServerConfig) => Promise<void>,
    onLog: (cb: (line: string) => void) => () => void,   // 返回取消订阅
    onStatus: (cb: (s: ServerStatus) => void) => () => void,
  },
  config: {
    load: () => ServerConfig,
    save: (c: ServerConfig) => void,
    listPresets: () => string[],
    loadPreset: (name: string) => ServerConfig,
    savePreset: (name: string, c: ServerConfig) => void,
  },
  dialog: {
    pickFile: (filters?: string[]) => Promise<string | null>,
    pickFolder: () => Promise<string | null>,
  },
}
```

### 5.3 Renderer(React,Restricted)
- 只用 `window.api.*` 做系统操作
- 对 llama-server 的 HTTP 请求直接用 `fetch`(同源 127.0.0.1)
- 不引入 Node 模块

---

## 6. llama-server 进程管理

### 6.1 路径与 DLL 解析(必踩坑)

`llama-server.exe` 启动时需找到 `cudart64_12.dll`、`ggml-cuda.dll` 等。两个 bin 目录必须进 `PATH`:

```ts
// main/llama-process.ts
const ENGINE_DIR = 'D:\\llama_studio\\llama-b10707-bin-win-cuda-12.4-x64';
const CUDART_DIR = 'D:\\llama_studio\\cudart-llama-bin-win-cuda-12.4-x64';

const env = {
  ...process.env,
  PATH: `${ENGINE_DIR};${CUDART_DIR};${process.env.PATH}`,
};

const child = spawn(`${ENGINE_DIR}\\llama-server.exe`, args, {
  cwd: ENGINE_DIR,        // ← 工作目录设引擎目录,部分 DLL 相对加载
  env,
  windowsHide: true,
});
```

> 引擎目录路径不写死,放配置里,首次启动让用户选/或默认探测 `D:\llama_studio\` 下两个 bin 目录。

### 6.2 启动 → 就绪 检测流程

```
[启动按钮] → main.spawn() → 渲染层开始轮询 /health
   │
   ├─ 子进程 stderr/stdout → IPC → 日志面板
   │
   └─ 渲染层 setInterval(500ms):
        fetch('http://127.0.0.1:PORT/health')
          → 200 且 body.status === 'ok' (或 'loading model' 时继续等)
          → status === 'ready'/'ok' → 清 interval,切到对话页
          → 超时(60s) → 报错 + 显示日志,允许重试
```

`/health` 返回(简化):
```json
{ "status": "loading model" | "ok" | "no slot available" | ... }
```

### 6.3 停止 / 重启 / 崩溃

- **正常停**:GUI 关窗 → main `child.kill()`(Windows 下用 `taskkill /pid N /T` 才能连带杀子进程)
- **重启**:改了启动参数 → 先 kill 再 spawn
- **崩溃监听**:监听 `child.on('exit', code)` → 若非主动 kill,推 status='crashed' 给渲染层,弹重启按钮
- **端口冲突**:`/health` 一直连不上但子进程在跑 → 读 stderr 提示端口占用

### 6.4 Windows 进程树杀法
```ts
import { execSync } from 'child_process';
// kill 整个进程树(否则留显存)
execSync(`taskkill /pid ${child.pid} /T /F`);
```

---

## 7. 参数模型(完整)

### 7.1 启动参数(改了要重启 server)

```ts
interface LaunchConfig {
  // 模型
  modelPath: string;           // -m  必填
  mmprojPath: string | null;    // --mmproj  视觉模型才填

  // 硬件
  ngl: number;                 // -ngl  GPU offload 层数 0-999
  flashAttn: boolean;          // -fa
  threads: number;             // --threads
  nCpuMoe: number;             // --n-cpu-moe  MoE 专家放 CPU 数

  // 上下文/KV
  contextSize: number;         // -c
  cacheTypeK: 'f16'|'q8_0'|'q4_0'|'q5_0';  // --cache-type-k
  cacheTypeV: 'f16'|'q8_0'|'q4_0'|'q5_0';  // --cache-type-v
  nkvo: boolean;               // -nkvo
  parallelSlots: number;       // -np

  // 推测解码
  specType: 'none'|'draft-mtp'; // --spec-type
  specDraftNMax: number;         // --spec-draft-n-max
  draftMax: number;             // --draft-max
  draftMin: number;             // --draft-min
  draftPMin: number;            // --draft-p-min

  // 模板
  jinja: boolean;              // --jinja  用模型自带 chat template

  // 网络
  host: string;                 // --host  默认 127.0.0.1
  port: number;                 // --port  默认 8080
}
```

### 7.2 采样参数(每次请求体带,热调)

```ts
interface SamplingConfig {
  temperature: number;   // 0-2,默认 0.8
  topK: number;           // 0-200,默认 40
  topP: number;           // 0-1,默认 0.95
  minP: number;           // 0-1,默认 0.05
  repeatPenalty: number;  // 1-2,默认 1.1
  repeatLastN: number;    // 默认 64
  seed: number;            // -1=随机
  mirostat: 0|1|2;        // 默认 0(off)
  nPredict: number;       // -1=无限
}
```

### 7.3 参数 → CLI 数组(arg-builder.ts)

```ts
function buildArgs(c: LaunchConfig): string[] {
  const a: string[] = [];
  a.push('-m', c.modelPath);
  if (c.mmprojPath) a.push('--mmproj', c.mmprojPath);
  a.push('-ngl', String(c.ngl));
  if (c.flashAttn) a.push('-fa');
  a.push('--threads', String(c.threads));
  if (c.nCpuMoe > 0) a.push('--n-cpu-moe', String(c.nCpuMoe));
  a.push('-c', String(c.contextSize));
  a.push('--cache-type-k', c.cacheTypeK);
  a.push('--cache-type-v', c.cacheTypeV);
  if (c.nkvo) a.push('-nkvo');
  a.push('-np', String(c.parallelSlots));
  if (c.specType === 'draft-mtp') {
    a.push('--spec-type', 'draft-mtp', '--spec-draft-n-max', String(c.specDraftNMax));
    a.push('--draft-max', String(c.draftMax));
    a.push('--draft-min', String(c.draftMin));
    a.push('--draft-p-min', String(c.draftPMin));
  }
  if (c.jinja) a.push('--jinja');
  a.push('--host', c.host, '--port', String(c.port));
  return a;
}
```

> **注意**:b10707 里 `-fa` 等价于 `--flash-attn`(`-fa` 是简写);`--spec-type draft-mtp` 在 2024 末已支持,jinja 自 b3xxx 起支持。若某 flag 报 unknown,用 `llama-server.exe --help` 核对当前 build。

---

## 8. 控制面板 UI 设计

### 布局
```
┌─────────────────────────────────────────────────┐
│ [Llama Studio]   [控制台][对话][日志]    [● idle] │  ← 顶栏 + 状态灯
├─────────────────────────────────────────────────┤
│ ┌─ 启动配置 ────────────────┐ ┌─ 采样 ────────┐ │
│ │ 模型路径 [选择 .gguf]──── │ │ temperature ──│ │
│ │ mmproj   [选择…](可选)── │ │ top_k ──────── │ │
│ │ -ngl     [滑块 999]      │ │ top_p ──────── │ │
│ │ -fa      [● on]          │ │ min_p ──────── │ │
│ │ -c       [8192]          │ │ repeat_pen ─── │ │
│ │ cache-k  [q8_0 ▼]        │ │ seed [-1]      │ │
│ │ cache-v  [q8_0 ▼]        │ │                │ │
│ │ -nkvo    [○ off]         │ │ [实时生效]     │ │
│ │ -np      [1]             │ └────────────────┘ │
│ │ --threads [8]            │ ┌─ 预设 ────────┐  │
│ │ --jinja  [● on]          │ │ [保存当前]    │  │
│ │ spec-type [draft-mtp ▼]  │ │ ▼ 我的预设    │  │
│ │ spec-n-max [2]           │ │   qwen-27b    │  │
│ │ n-cpu-moe [0]            │ │   llama3-8b   │  │
│ │ host [127.0.0.1] port[8080]│ │   ...        │  │
│ └──────────────────────────┘ └────────────────┘ │
│                                                   │
│   预检: [显示拼好的完整命令行]                     │
│   [ ▶ 启动 ]  [ ⏹ 停止 ]  [ ↻ 重启 ]              │
└─────────────────────────────────────────────────┘
```

要点:
- **预检命令行**:实时显示拼好的 `llama-server.exe -m ... -ngl ...`,方便用户复制手跑验证
- **状态灯**:idle / starting / loading / ready / error / crashed
- **采样区独立**:标注「实时生效」,改了直接注入下次请求,不重启
- **启动参数改了**:控件变脏 → 状态灯提示「需重启生效」,按钮变「↻ 应用并重启」

---

## 9. 对话界面设计

### 数据流
```
用户输入 → messages.push({role:'user'}) 
  → POST /v1/chat/completions {messages, stream:true, temperature, top_k, ...}
  → SSE 增量 → 拼到 assistant 消息 → 实时渲染 markdown
  → [done] → 完成
  → [停止] → AbortController.abort() → server 释放 slot
```

### 请求体示例
```jsonc
POST /v1/chat/completions
{
  "model": "local",
  "messages": [
    {"role":"system","content":"你是 helpful 助手"},
    {"role":"user","content":"写个快排"}
  ],
  "stream": true,
  "temperature": 0.8,
  "top_k": 40,
  "top_p": 0.95,
  "min_p": 0.05,
  "repeat_penalty": 1.1,
  "max_tokens": -1,
  "seed": -1
}
```

### SSE 解析
用 `@microsoft/fetch-event-source`(比原生 EventSource 多支持 POST + headers):
```ts
import { fetchEventSource } from '@microsoft/fetch-event-source';
const ctrl = new AbortController();
await fetchEventSource('http://127.0.0.1:8080/v1/chat/completions', {
  method: 'POST',
  headers: {'Content-Type':'application/json'},
  body: JSON.stringify(payload),
  signal: ctrl.signal,
  onmessage(ev) {
    if (ev.data === '[DONE]') return;
    const chunk = JSON.parse(ev.data);
    const delta = chunk.choices[0]?.delta?.content ?? '';
    appendDelta(delta);   // 拼到当前 assistant 消息
  },
  onerror(e) { /* 抛出让它不自动重连 */ throw e; }
});
// 停止:ctrl.abort()
```

### UI 元素
- 消息流:user/assistant 气泡,assistant 用 `react-markdown` + `rehype-highlight`
- 输入框:多行,Shift+Enter 换行,Enter 发送
- 顶部:当前模型名(来自 `/props`)、上下文用量(token 计数,可调 `/tokenize` 估算)
- 侧栏:多会话(可选,本期单会话即可)

---

## 10. 配置持久化(electron-store)

```ts
// data/config.json — 上次用的配置(自动恢复)
// data/presets/<name>.json — 命名预设
```
启动时 `config.load()` 恢复上次;「保存预设」写到 `presets/`;下拉切换预设即填表。

---

## 11. 错误处理与边界

| 场景 | 处理 |
|---|---|
| 模型路径不存在 | spawn 前校验,弹窗提示 |
| 端口被占 | /health 不通 + stderr 含 "bind" → 提示换端口 |
| DLL 找不到(cudart64_12) | stderr "找不到 cudart64_12.dll" → 提示检查 cudart 目录/PATH |
| GPU OOM | stderr "out of memory" → 提示降 -ngl 或 -c |
| 加载超 60s | 超时,显示日志,允许重试 |
| 对话中途 server 崩溃 | onStatus='crashed',禁用输入,显示「重启」按钮 |
| 采样参数越界 | 控件 min/max clamp |

---

## 12. 开发环境与构建

### 首次搭建
```powershell
# 1. 装 Node 18+
# 2. 建项目
cd D:\llama_studio
npm create @quick-start/electron@latest llama-studio-app -- --template react-ts
# 或手动:electron-vite + react + ts
```

### 开发
```powershell
cd llama-studio-app
npm run dev      # electron-vite dev,热重载
```

### 打包
```powershell
npm run build:win   # electron-builder → NSIS 安装包
```
`electron-builder.yml` 里把两个引擎目录用 `extraResources` 打进去,或保持外部引用(用户路径配置)。本期保持**外部引用**(引擎不打包,只配置路径),包小且引擎可独立升级。

---

## 13. 实施路线图

| 阶段 | 产出 | 验收标准 | 预估 |
|---|---|---|---|
| **P0 脚手架** | Electron+React+TS 跑起来,三进程打通 | `npm run dev` 能开窗口 | 0.5 天 |
| **P1 控制面板** | 启动参数全控件 + 预检命令行 + 预设存档 | 拼出的命令行能手跑成功 | 1 天 |
| **P2 启动集成** | spawn + DLL PATH + /health 轮询 + 状态灯 + 日志面板 | 点启动 → 状态变 ready → 日志可见加载过程 | 1 天 |
| **P3 对话页** | SSE 流式 + markdown + 停止 + 多轮 | 能完整对话,可停止 | 2 天 |
| **P4 采样热调** | 采样面板注入请求体 | 改温度立刻生效不重启 | 0.5 天 |
| **P5 收尾打包** | electron-builder + 错误边界 + README | 出安装包,本机能装 | 1 天 |

**MVP 里程碑 = P0+P1+P2**:能调参、能启动、看日志。验证完所有参数生效后再做对话页(P3+P4)。

---

## 14. 待确认事项

1. 引擎路径是否固定为 `D:\llama_studio\` 下两个目录,还是要在 GUI 里可配置?(建议可配置,默认探测此路径)
2. 是否需要多会话(多标签对话)?本期默认单会话。
3. 模型路径填的是**目录**(`D:\ai\modals\...\my_qwen3.8-27b-GGUF`)还是具体 `.gguf` 文件?-m 需要文件路径,若填目录要自动列目录下 `.gguf` 让用户选。
4. 是否要「停止 server」按钮,还是关窗即停?(建议都给)
```
