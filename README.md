# 巧答 · AI 客服回复助手

给客服用的 AI 副驾：**人主导，AI 出建议**。在任意客服系统（千牛、旺旺、企业微信、自建工单……）旁边一键呼出（桌面版），或在手机上粘贴对话生成回复（安卓版），解决「不知道该怎么回」「描述不清楚」「术语客户听不懂」三大痛点。

## 两个平台

| 平台 | 目录 | 产物 | 形态 |
|---|---|---|---|
| Windows 桌面 | 仓库根目录 | `dist/巧答-Setup-1.0.0.exe` | 主窗口 + 快捷悬浮窗（全局快捷键呼出） |
| Android | `mobile/` | `dist/巧答-安卓-1.0.0.apk`（正式签名） | 底部五页：生成 / 情景 / 话术 / 历史 / 设置 |

安卓版与桌面版共用同一套设计系统、多供应商适配层与提示词；数据各自保存在本机（安卓为应用存储 localStorage，可导入导出备份 JSON）。

## 功能一览

- **四种生成模式**
  - 回复：基于客户消息生成 2~3 条不同风格的候选回复，一键复制
  - 润色：把不清楚的草稿改写成清晰 / 委婉 / 简洁 / 热情 / 正式 / 口语的表达
  - 白话：把专业术语改写成客户听得懂的大白话，附带术语对照表
  - 分析：判断客户情绪、意图、诉求，给出回复策略与风险提示
- **多情景体系**：每个平台建一个情景（电商售后 / 软件支持 / 官方客服……），角色设定、语气、知识库、快捷指令、模型绑定相互独立，快捷窗一键切换
- **多供应商大模型**：DeepSeek、OpenAI、Claude（Anthropic 原生协议）、Gemini（原生协议）、通义千问、Kimi、智谱 GLM、MiniMax、硅基流动、OpenRouter、Ollama 本地模型，以及任意 OpenAI 兼容端点（OneAPI / NewAPI / vLLM 等），支持自定义请求头与 URL 参数
- **知识库**：产品信息、售后政策、FAQ 随提示词注入，模型不编造；不知道时会引导核实
- **自动脱敏**：手机号、邮箱、身份证号、银行卡号先打码再发给模型，结果自动还原
- **合规提示**：候选回复中出现绝对化承诺、赔付金额、敏感词时给出风险徽标，发送前人工把关
- **话术库**：好回复一键收藏、搜索、复用，可绑定情景
- **本地历史**：每次生成的输入输出都保存在本机，可回看、复制、收藏
- **流式输出**、全局快捷键呼出、失焦自动隐藏、图钉固定、系统托盘、浅/深色主题、数据导入导出

## 权限与隐私（重要）

- **不读取屏幕、不注入键盘鼠标，不使用任何无障碍 / 录屏权限**；快捷窗靠系统级全局快捷键呼出，剪贴板仅在你点击「复制」时写入
- 所有数据（情景、话术、历史、设置）保存在本机 `%APPDATA%\qiaoda`
- API Key 使用 Windows 系统级加密（DPAPI）存储，导出备份不包含密钥
- 默认开启脱敏后再调用模型；也支持接入 Ollama 等本地模型，数据完全不离开本机

## 开发

```bash
npm install        # 安装依赖（npmmirror 源 + Electron 镜像已配置）
npm run dev        # 开发模式（热更新）
npm run typecheck  # 类型检查
npm run build      # 构建到 out/
npm run dist       # 打包 Windows 安装包（输出到 dist/）
npm run pack:dir   # 仅打目录版（免安装，输出到 dist/win-unpacked）
```

## 安卓版构建

```bash
cd mobile
npm install        # 安装依赖
npm run sync       # 构建 web 资源并同步到 android/
cd android
gradlew assembleDebug      # 调试签名 APK
gradlew assembleRelease    # 正式签名 APK（密钥库 mobile/keystore/qiaoda.keystore）
```

首次构建需要 JDK 17 与 Android SDK（build-tools 34 + platform android-34）：
`scripts/setup-android.ps1` 会自动下载安装（国内镜像，工具链在 `.toolchain/` 与 `%LOCALAPPDATA%\Android\Sdk`）。
Gradle 与 Maven 依赖已配置国内镜像，可直接构建。

安卓版使用 Capacitor 原生 HTTP（无 CORS 限制，兼容全部供应商），剪贴板读写仅在用户点击时发生；
权限仅 `INTERNET` 一项，**无无障碍、无悬浮窗、无后台读取**。

技术栈：Electron + React + TypeScript + electron-vite，UI 为自研设计系统（MiSans 字体、暖纸浅色 / 墨色深色主题），无 UI 组件库依赖。

## 使用建议

1. 在「模型」页为常用供应商填入 API Key，点击「测试连接」确认可用
2. 在「情景」页按平台创建情景：写清角色设定（越具体越像你）、语气、知识库，可绑定不同模型
3. 工作过程中按 `Ctrl+Alt+K`（可在设置中修改）呼出快捷窗，粘贴客户消息 → 生成 → 复制 → 粘贴回客服系统
4. 好的回复点星标收藏，话术库会越用越顺手

## 目录结构

```
src/
  main/      Electron 主进程：窗口、托盘、快捷键、存储、脱敏、LLM 适配层、IPC
  preload/   contextBridge 安全桥接
  shared/    主/渲染进程共享的类型、常量与输出解析
  renderer/  界面：主窗口（工作台/情景/模型/话术/历史/设置）+ 快捷悬浮窗
scripts/     图标生成（纯 Node 实现 PNG/ICO 编码，零依赖）
```
