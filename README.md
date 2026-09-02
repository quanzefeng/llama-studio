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

## 安装(直接使用)

从 [GitHub Releases](https://github.com/quanzefeng/llama-studio/releases) 下载最新版 `.exe` 安装包,双击安装即可。引擎已内置,安装时可选安装目录,装完就能用,无需任何额外配置。

## 从源码本地启动

### 第一步:克隆仓库

```powershell
git clone https://github.com/quanzefeng/llama-studio.git
```

克隆完成后会在当前目录生成 `llama-studio` 项目文件夹,整体结构如下:

```
llama-studio/              ← 项目根目录(克隆出来的)
├── llama-engine/          ← 【需要你自己准备】llama.cpp 引擎,见第二步
├── cudart-engine/         ← 【CUDA 版才需要】CUDA 运行时,见第二步
├── llama-studio-app/      ← 应用源码(Electron + React)
└── README.md
```

### 第二步:准备引擎(llama.cpp)

1. 下载引擎:[llama.cpp releases](https://github.com/ggml-org/llama.cpp/releases) 选择任意发布版,下载 **Windows x64** 构建(如 `llama-bXXXX-bin-win-...zip`)

   - 有 NVIDIA 显卡且想用 GPU 加速 → 选**带 cuda** 的构建(如 `...-bin-win-cuda-12.4-x64.zip`)
   - 纯 CPU 跑也行 → 选不带 cuda 的构建即可

2. 在项目根目录下新建文件夹:

```powershell
New-Item -ItemType Directory -Path "D:\llama_studio\llama-engine"
```

> 如果克隆到了别的路径,引擎文件夹就是 `项目根\llama-engine`,同级目录名必须是 `llama-engine`。

3. 解压 zip 到 `llama-engine` 里。**注意收录结构**:最终 `llama-engine` 文件夹里要能**直接看到** `llama-server.exe` 和一堆 DLL,不要把 zip 里那层外层目录(如 `llama-bXXXX-...` 文件夹)也带进来。即:

```
llama-engine/
├── llama-server.exe      ← 必须直接在这一层
├── ggml.dll
├── ggml-base.dll
└── (其他 DLL...)
```

4. 【仅 CUDA 版】再建 `cudart-engine` 文件夹,把 CUDA 运行时的 DLL 放进去(`cublas64_12.dll`、`cublasLt64_12.dll`、`cudart64_12.dll` 等):

```powershell
New-Item -ItemType Directory -Path "D:\llama_studio\cudart-engine"
```

### 第三步:下载模型

下载 [gguf 格式模型](https://huggingface.co/models?library=gguf)(如 qwen、llama 系列 GGUF 文件),记下文件路径。模型可以放在任意位置,比如 `D:\models\qwen2.5-7b-instruct-q4_k_m.gguf`。

### 第四步:安装依赖并启动

```powershell
# 进入应用源码目录
cd llama-studio\llama-studio-app

# 安装依赖
npm install

# 启动
npm run dev
```

### 第五步:在应用里配置并运行

启动后打开的是对话页,先切到「控制台」页面:

1. 「模型路径」→ 选择你下载的 `.gguf` 模型文件
2. 引擎相关字段默认已指向 `D:\llama_studio\llama-engine`(CUDA 版还需确认「CUDA 运行时目录」指向 `D:\llama_studio\cudart-engine`)
3. 按需调整 GPU、上下文长度等参数
4. 点「▶ 启动」,状态灯变绿后回「对话」页即可开始聊天

> 提示:开发模式下默认引擎路径指向 `D:\llama_studio\llama-engine`,如果实际位置不同,在「控制台」里手动填对路径即可,应用会记住你的选择。

### 目录结构

```
llama-studio/              ← 项目根
├── llama-engine/          ← llama.cpp 引擎(llama-server.exe + DLL)
├── cudart-engine/         ← (CUDA 版)CUDA 运行时 DLL
├── llama-studio-app/      ← 应用源码(Electron + React)
└── DESIGN.md              ← 设计文档
```

## License

[MIT](LICENSE)

> 附带的 llama.cpp 引擎遵循其自身 MIT 许可;CUDA 运行时为 NVIDIA 专有组件,使用时请遵守其 EULA。