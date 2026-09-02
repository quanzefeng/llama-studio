// re-export 自 shared — 保持 main 侧 './arg-builder' 引用路径可用(P2 的 llama-process 会用到)
// 实现见 src/shared/arg-builder.ts(纯函数,main/renderer 共用)
export * from '../shared/arg-builder'
