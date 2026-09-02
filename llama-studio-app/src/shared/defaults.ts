import type { ServerConfig, SamplingConfig, LaunchConfig } from './types'

export function defaultLaunchConfig(): LaunchConfig {
  return {
    modelPath: '',
    mmprojPath: '',
    ngl: 999,
    flashAttn: true,
    mlock: false,
    threads: 8,
    nCpuMoe: 0,
    contextSize: 8192,
    cacheTypeK: 'q8_0',
    cacheTypeV: 'q8_0',
    nkvo: false,
    parallelSlots: 1,
    specType: 'none',
    specDraftNMax: 2,
    draftPMin: 0.05,
    jinja: true,
    host: '127.0.0.1',
    port: 8080,
    // 长上下文/缩放(默认关闭,跟随模型)
    ropeScaling: 'none',
    ropeScale: 1,
    yarnOrigCtx: 0,
    yarnExtFactor: -1,
    yarnAttnFactor: -1,
    yarnBetaSlow: -1,
    yarnBetaFast: -1,
    // 吞吐(与 llama-server 默认一致)
    batchSize: 2048,
    ubatchSize: 512,
    // 多 GPU(默认单卡 0)
    mainGpu: 0,
    tensorSplit: '',
  }
}

export function defaultServerConfig(): ServerConfig {
  return {
    launch: defaultLaunchConfig(),
    engineDir: 'D:\\llama_studio\\llama-b10707-bin-win-cuda-12.4-x64',
    cudartDir: 'D:\\llama_studio\\cudart-llama-bin-win-cuda-12.4-x64',
  }
}

export function defaultSampling(): SamplingConfig {
  return {
    temperature: 0.8,
    topK: 40,
    topP: 0.95,
    minP: 0.05,
    repeatPenalty: 1.1,
    repeatLastN: 64,
    seed: -1,
    mirostat: 0,
    nPredict: -1,
    reasoningIntensity: 'high',
    // 高级采样器全部默认关闭,与 llama-server 同
    typicalP: 1.0,
    xtcProbability: 0.0,
    xtcThreshold: 0.1,
    dryMultiplier: 0.0,
    dryAllowedLength: 2,
    dryPenaltyLastN: 64,
    dynatempRange: 0.0,
    dynatempExponent: 1.0,
    topNSigma: -1.0,
    samplerOrder: '',
  }
}
