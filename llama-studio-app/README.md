# Llama Studio

llama.cpp GUI — 控制面板 + 对话界面,本地包 `llama-server.exe`。

设计文档见 `../DESIGN.md`。

## 开发

```powershell
cd D:\llama_studio\llama-studio-app
npm install
npm run dev
```

## 技术栈

- Electron 31 + React 18 + TypeScript + electron-vite
- Tailwind CSS(shadcn/ui 风格)
- zustand 状态管理
- 通过 `llama-server.exe` 的 HTTP API(`/health` `/v1/chat/completions`)对话

## 架构

- `src/main/` — 主进程:spawn llama-server、IPC handlers、配置存储
- `src/preload/` — contextBridge 安全 API
- `src/renderer/` — React UI(控制台/对话/日志)
- `src/shared/` — 三端共享类型与默认值
