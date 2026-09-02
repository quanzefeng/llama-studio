// 内置推荐预设 — 覆盖典型使用场景,加载即填表(可再手动微调)
// 这些是"只读的起点",不落盘;加载时把值并入当前表单。引擎目录/模型路径不在此定义,保持用户本机配置。

import type { AppPreset } from '@shared/types'
import { defaultLaunchConfig, defaultSampling } from '@shared/defaults'

function makePreset(
  name: string,
  description: string,
  launchPatch: Partial<ReturnType<typeof defaultLaunchConfig>>,
  samplingPatch: Partial<ReturnType<typeof defaultSampling>>,
): AppPreset {
  return {
    name,
    description,
    // 引擎路径留空,加载时由 ControlPanel 保留用户本机路径
    config: {
      launch: { ...defaultLaunchConfig(), ...launchPatch },
      engineDir: '',
      cudartDir: '',
    },
    sampling: { ...defaultSampling(), ...samplingPatch },
  }
}

/** 内置预设列表(只读) */
export const BUILTIN_PRESETS: AppPreset[] = [
  makePreset(
    '8GB 显存卡',
    '面向 8GB 左右显存:适量 GPU 卸载、减上下文与批次,控住显存保证稳定',
    {
      ngl: 24,
      contextSize: 4096,
      cacheTypeK: 'q8_0',
      cacheTypeV: 'q8_0',
      batchSize: 1024,
      ubatchSize: 256,
    },
    {
      nPredict: 2048,
    },
  ),
  makePreset(
    '16GB 显存卡',
    '面向 16GB 左右显存:尽量全量 GPU 卸载,中长上下文,速度与质量均衡',
    {
      ngl: 999,
      contextSize: 8192,
      cacheTypeK: 'q8_0',
      cacheTypeV: 'q8_0',
      batchSize: 2048,
      ubatchSize: 512,
    },
    {
      nPredict: -1,
    },
  ),
  makePreset(
    '长上下文',
    '跑 32K 上下文:启用 yarn 缩放,配合 KV 量化控制显存占用',
    {
      contextSize: 32768,
      ropeScaling: 'yarn',
      ropeScale: 4,
      yarnOrigCtx: 8192,
      cacheTypeK: 'q4_0',
      cacheTypeV: 'q4_0',
      nkvo: true,
      batchSize: 1024,
      ubatchSize: 256,
    },
    {
      nPredict: -1,
      reasoningIntensity: 'high',
    },
  ),
  makePreset(
    '深度推理',
    '代码/数学等需要严谨的场景:低温度、强逻辑、放开推理预算',
    {
      contextSize: 8192,
    },
    {
      temperature: 0.2,
      topP: 0.9,
      minP: 0.1,
      repeatPenalty: 1.15,
      reasoningIntensity: 'max',
    },
  ),
  makePreset(
    '创意写作',
    '写作/脑暴:高温度更发散,开启 DRY 防复读,typical 让表达更自然',
    {
      contextSize: 8192,
    },
    {
      temperature: 1.0,
      topP: 0.95,
      minP: 0.05,
      typicalP: 0.9,
      dryMultiplier: 1.2,
      reasoningIntensity: 'low',
    },
  ),
]

/** 查询:按名字找内置预设 */
export function getBuiltinPreset(name: string): AppPreset | undefined {
  return BUILTIN_PRESETS.find((p) => p.name === name)
}