// arg-builder — LaunchConfig → llama-server.exe CLI 参数
// 纯函数,放 shared 让 main 和 renderer 都能用

import type { LaunchConfig } from './types'

export function buildArgs(c: LaunchConfig): string[] {
  const a: string[] = []
  a.push('-m', c.modelPath)
  if (c.mmprojPath) a.push('--mmproj', c.mmprojPath)
  a.push('-ngl', String(c.ngl))
  // b10707: -fa 裸开关已废弃,需显式值 on|off|auto
  a.push('--flash-attn', c.flashAttn ? 'on' : 'off')
  if (c.mlock) a.push('--mlock')
  a.push('--threads', String(c.threads))
  if (c.nCpuMoe > 0) a.push('--n-cpu-moe', String(c.nCpuMoe))
  a.push('-c', String(c.contextSize))
  a.push('--cache-type-k', c.cacheTypeK)
  a.push('--cache-type-v', c.cacheTypeV)
  if (c.nkvo) a.push('-nkvo')
  a.push('-np', String(c.parallelSlots))
  if (c.specType === 'draft-mtp') {
    a.push('--spec-type', 'draft-mtp')
    a.push('--spec-draft-n-max', String(c.specDraftNMax))
    // b10707: --draft-max/--draft-min 已移除;--draft-p-min 改用规范名
    a.push('--spec-draft-p-min', String(c.draftPMin))
  }
  // b10707: jinja 默认已开启;关闭需用 --no-jinja
  a.push(c.jinja ? '--jinja' : '--no-jinja')

  // 长上下文/RoPE 缩放
  if (c.ropeScaling !== 'none') {
    a.push('--rope-scaling', c.ropeScaling)
    if (c.ropeScale > 1) a.push('--rope-scale', String(c.ropeScale))
    if (c.ropeScaling === 'yarn') {
      if (c.yarnOrigCtx > 0) a.push('--yarn-orig-ctx', String(c.yarnOrigCtx))
      if (c.yarnExtFactor >= 0) a.push('--yarn-ext-factor', String(c.yarnExtFactor))
      if (c.yarnAttnFactor >= 0) a.push('--yarn-attn-factor', String(c.yarnAttnFactor))
      if (c.yarnBetaSlow >= 0) a.push('--yarn-beta-slow', String(c.yarnBetaSlow))
      if (c.yarnBetaFast >= 0) a.push('--yarn-beta-fast', String(c.yarnBetaFast))
    }
  }

  // 吞吐 batch
  a.push('-b', String(c.batchSize))
  a.push('-ub', String(c.ubatchSize))

  // 多 GPU
  a.push('-mg', String(c.mainGpu)) // 独立生效:多卡时选择主 GPU
  if (c.tensorSplit.trim()) {
    a.push('-ts', c.tensorSplit.trim()) // 逗号分隔各卡比例,如 0.6,0.4
  }

  a.push('--host', c.host, '--port', String(c.port))
  return a
}

/** 拼出完整命令行字符串(UI「命令预览」用) */
export function buildCommandLine(engineDir: string, c: LaunchConfig): string {
  const exe = `${engineDir}\\llama-server.exe`
  const args = buildArgs(c)
    .map((x) => (x.includes(' ') || x.includes('\\') ? `"${x}"` : x))
    .join(' ')
  return `${exe} ${args}`
}
