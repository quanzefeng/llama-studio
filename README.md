# Llama Studio

把 llama.cpp 的 `llama-server.exe` 包成可视化控制面板 + 对话界面的本地桌面应用。

调参、加载模型、对话一站式,替代手敲命令行。

## 功能

- **控制台**:可视化配置 llama-server 启动参数(模型/GPU/上下文/长上下文缩放/吞吐/多 GPU)+ 采样参数(温度/核采样/高级采样器),实时命令行预览
- **一键启动**:自动 spawn `llama-server.exe`、轮询 `/health`、状态灯
- **对话**:流式打字机、Markdown + KaTeX 渲染(数学/物理/化学公式)、思考过程(reasoning)展示、多会话、附件上传(图片走多模态、文本注入、任意格式报文件名)
- **推理强度**:Low/Medium/High/Max 四档思考预算(per-request 热调,无需重启)
- **预设**:内置推荐模板(8GB 卡/16GB 卡/长上下文/深度推理/创意写作)+ 自定义预设保存
- **参数详解**:全参数中文讲解(作用/怎么调/推荐值)
- **日志**:实时 stdout/stderr

## 安装包(直接使用)

正式版从 [GitHub Releases](https://github.com/quanzefeng/llama-studio/releases) 下载 `.exe` 安装包,引擎已内置,安装即用。

## 开源版(自行构建)

### 依赖

- Node.js 18+
- llama.cpp 引擎(需自行下载):[llama.cpp releases](https://github.com/ggml-org/llama.cpp/releases) 选择任意发布版
  - 解压 llama.cpp bin 目录(含 `llama-server.exe` 与 DLL)
  - 如使用 CUDA 构建,还需对应的 CUDA 运行时(如 `cudart64_12.dll`、`cublas64_12.dll`)
- 下载 [gguf 模型](https://huggingface.co/models?library=gguf)(如 qwen、llama 系列 GGUF)

### 步骤

```powershell
# 1. 安装依赖
cd llama-studio-app
npm install

# 2. 启动开发版
npm run dev
```

打开后在「控制台」填写模型路径与引擎路径,点启动。

### 目录结构

```
llama-studio-app/       应用源码(Electron + React)
DESIGN.md               设计文档
```

## 构建安装包

```powershell
cd llama-studio-app
npm run build:win
```

安装包会把引擎打进 `resources/engines/`(见 `electron-builder.yml` 的 `extraResources`),产物约 1~2GB。

### 通过 GitHub Actions 自动发布(推荐)

推送 `v*` tag 即自动构建并上传到 Releases,无需本地环境:

```powershell
git tag v0.1.0
git push origin v0.1.0
```

- 工作流:`.github/workflows/release.yml`
- 引擎版本:工作流顶部 `LLAMA_BUILD` 变量(默认 `b10707`),升级引擎只改这一个值
- 手动试打包:GitHub 仓库 Actions 页 → 该工作流 → Run workflow(不打 tag 也会出 artifact)

### 打包前:准备引擎目录

`extraResources` 从仓库根的固定目录读取引擎:

```
llama-engine/       ← llama.cpp bin(llama-server.exe + DLL)
cudart-engine/      ← CUDA 运行时(cublas64_12.dll / cublasLt64_12.dll / cudart64_12.dll)
```

本机开发建议用 junction 链接到你已有的引擎目录(无需复制,省 1GB 磁盘):

```powershell
# 以管理员或开发者模式执行(Windows 10+ 无需管理员建 junction)
New-Item -ItemType Junction -Path "D:\llama_studio\llama-engine" -Target "D:\llama_studio\llama-b10707-bin-win-cuda-12.4-x64"
New-Item -ItemType Junction -Path "D:\llama_studio\cudart-engine" -Target "D:\llama_studio\cudart-llama-bin-win-cuda-12.4-x64"
```

> 这两个目录已被 `.gitignore` 排除,不会进仓库;GitHub Actions 发布时由 workflow 自动下载引擎到同名目录。

### 引擎路径解析(内置 vs 手动)

应用启动时按以下优先级找引擎:
1. **用户显式配置**的引擎路径(存在 `llama-server.exe` 时优先)
2. **安装包内置** `resources/engines/`(装完即用,无需配置)
3. 开发默认路径(仅开发模式)

安装版用户无需任何配置;想用自己的引擎,在配置里显式设置路径即可覆盖内置。

## License

[MIT](LICENSE)

> 附带的 llama.cpp 引擎遵循其自身 MIT 许可;CUDA 运行时为 NVIDIA 专有组件,使用时请遵守其 EULA。