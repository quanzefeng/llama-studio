// 共享类型 — main / preload / renderer 三端共用,锁死契约

export type CacheType = 'f16' | 'q8_0' | 'q4_0' | 'q5_0'
export type SpecType = 'none' | 'draft-mtp'
export type RopeScaling = 'none' | 'linear' | 'yarn'
export type Mirostat = 0 | 1 | 2
export type Theme = 'dark' | 'light'

/** 启动参数(改了要重启 llama-server) */
export interface LaunchConfig {
  modelPath: string        // -m
  mmprojPath: string       // --mmproj
  ngl: number              // -ngl
  flashAttn: boolean      // --flash-attn on|off
  mlock: boolean           // --mlock  锁定模型在内存,防止被 swap
  threads: number          // --threads
  nCpuMoe: number          // --n-cpu-moe
  contextSize: number      // -c
  cacheTypeK: CacheType    // --cache-type-k
  cacheTypeV: CacheType    // --cache-type-v
  nkvo: boolean            // -nkvo
  parallelSlots: number    // -np
  specType: SpecType       // --spec-type
  specDraftNMax: number    // --spec-draft-n-max
  draftPMin: number        // --spec-draft-p-min
  jinja: boolean           // --jinja / --no-jinja
  host: string             // --host
  port: number             // --port

  // 长上下文/缩放
  ropeScaling: RopeScaling // --rope-scaling none|linear|yarn
  ropeScale: number        // --rope-scale  上下文放大倍数
  yarnOrigCtx: number      // --yarn-orig-ctx  YaRN 原始训练上下文
  yarnExtFactor: number    // --yarn-ext-factor  -1=默认
  yarnAttnFactor: number   // --yarn-attn-factor  -1=默认
  yarnBetaSlow: number     // --yarn-beta-slow  -1=默认
  yarnBetaFast: number     // --yarn-beta-fast  -1=默认

  // 吞吐
  batchSize: number        // -b   逻辑最大 batch
  ubatchSize: number       // -ub  物理最大 batch

  // 多 GPU
  mainGpu: number          // -mg  主 GPU 索引
  tensorSplit: string      // -ts  逗号分隔 GPU 比例,如 "0.6,0.4";空=关闭
}

/** 推理强度档位(Low/Medium/High/Max → thinking token 预算) */
export type ReasoningIntensity = 'low' | 'medium' | 'high' | 'max'

/** 采样参数(每次请求体带,热调) */
export interface SamplingConfig {
  temperature: number
  topK: number
  topP: number
  minP: number
  repeatPenalty: number
  repeatLastN: number
  seed: number
  mirostat: Mirostat
  nPredict: number
  reasoningIntensity: ReasoningIntensity

  // 高级采样器(per-request,默认禁用值)
  typicalP: number        // typical_p  1.0=关闭
  xtcProbability: number  // xtc_probability  0=关闭
  xtcThreshold: number    // xtc_threshold  >0.5 关闭 XTC
  dryMultiplier: number   // dry_multiplier  0=关闭
  dryAllowedLength: number // dry_allowed_length
  dryPenaltyLastN: number // dry_penalty_last_n  0=关闭
  dynatempRange: number   // dynatemp_range  0=关闭
  dynatempExponent: number // dynatemp_exponent
  topNSigma: number       // top_n_sigma  <0=关闭
  /** 采样器顺序,逗号分隔(空=服务器默认),如 "dry,top_k,top_p,min_p,xtc,temperature" */
  samplerOrder: string
}

export type ServerStatus =
  | 'idle'
  | 'starting'
  | 'loading'
  | 'ready'
  | 'error'
  | 'crashed'

export interface ServerConfig {
  launch: LaunchConfig
  engineDir: string
  cudartDir: string
}

export interface AppPreset {
  name: string
  /** 一句话说明,展示在预设列表/加载时 */
  description?: string
  config: ServerConfig
  sampling: SamplingConfig
}

/** 一次上传的附件(元数据 + 内容载荷) */
export interface Attachment {
  id: string            // 唯一 id(crypto.randomUUID)
  name: string          // 文件名
  mime: string          // MIME(从 File.type 或扩展名推断)
  size: number          // 字节
  kind: 'text' | 'image' | 'binary'   // 内容分类,决定发送方式
  /** text: 文件文本内容;image: base64(data:image/...);binary: 无载荷 */
  content: string
}

/** 单条对话消息(reasoning 为思考过程,可选) */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
  reasoning?: string
  /** 附件仅 user 消息携带 */
  attachments?: Attachment[]
  /** 生成统计(assistant 消息才有) */
  tokens?: number
  durationMs?: number
  tokensPerSec?: number
}

/** 一个会话 */
export interface Conversation {
  id: string
  title: string
  createdAt: number
  messages: ChatMessage[]
}

/** preload 暴露给 renderer 的 API 契约 */
export interface LlamaApi {
  llama: {
    start: (config: ServerConfig) => Promise<void>
    stop: () => Promise<void>
    restart: (config: ServerConfig) => Promise<void>
    onLog: (cb: (line: string) => void) => () => void
    onStatus: (cb: (s: ServerStatus) => void) => () => void
  }
  config: {
    load: () => Promise<ServerConfig>
    save: (c: ServerConfig) => Promise<void>
    listPresets: () => Promise<string[]>
    loadPreset: (name: string) => Promise<AppPreset>
    savePreset: (name: string, preset: AppPreset) => Promise<void>
    deletePreset: (name: string) => Promise<void>
  }
  sampling: {
    load: () => Promise<SamplingConfig>
    save: (s: SamplingConfig) => Promise<void>
  }
  dialog: {
    pickFile: (filters?: string[]) => Promise<string | null>
    pickFolder: () => Promise<string | null>
    listGgufInDir: (dir: string) => Promise<string[]>
  }
}

declare global {
  interface Window {
    api: LlamaApi
  }
}
