# TenderWizard Project Documentation
**Version**: 3.0.0 (Production Ready)
**Date**: 2025-12-11

## 1. 项目愿景 (Vision)

**TenderWizard** 是一个智能化的简历自动生成与数据管理系统。
v3.0 版本标志着项目进入**生产就绪 (Production Ready)** 阶段，实现了基于 Nginx 的全容器化编排，具备了企业级的稳定性和部署便捷性。

## 2. 核心架构 (Architecture v3.0)

### 2.1 技术栈
*   **Frontend**: React 19 (Vite) + Material-UI (MUI)
    *   *Production Build*: Nginx Serving Static Assets (Multi-stage Docker Build)
*   **Backend**: FastAPI (Python 3.9)
    *   *AI Engine*: 增强型 AI 网关，支持 OpenRouter/DeepSeek 等多厂商协议自动适配。
    *   *Doc Engine*: 基于 `docxtpl` 原生解析的健壮模板引擎。
*   **Database**: PostgreSQL 13 (Dockerized)
*   **Infrastructure**: Docker Compose (Dev & Prod)

### 2.2 统一网络拓扑 (Production)
```text
[User Browser] --(http:80)--> [Nginx Container]
                                |
                                +--(/)--> [Static Files (React Dist)]
                                |
                                +--(/api)--> [Backend Container] --(Internal)--> [PostgreSQL]
```

## 3. 快速开始 (Quick Start)

### 3.1 环境准备
1.  安装 Docker & Docker Compose。
2.  确保 `resume_creator/` 目录下存在 `.env` 文件：
    ```ini
    DEEPSEEK_API_KEY=sk-your-key-here
    ```

### 3.2 生产环境部署
```bash
cd resume_creator
# 使用生产配置文件启动 (包含 Nginx)
docker-compose -f docker-compose.prod.yml up -d --build
```
*访问*: 直接浏览器打开 `http://localhost` (无需端口号)

### 3.3 开发环境启动
```bash
# 使用开发配置文件启动 (Vite HMR)
docker-compose up -d
```
*访问*: `http://localhost:5173`

## 4. 功能清单 (Features)

*   **数据导入 (Data Importer)**: 支持 Excel 批量导入，自动清洗 NaN/Infinity 数据，自动生成 UUID 主键。
*   **智能映射 (Smart Mapping)**: 可视化配置字段映射，支持注入字段级的 AI 提示词 (Prompt)。
*   **AI 简历生成 (AI Studio)**: 集成 DeepSeek 模型，基于上下文自动撰写、润色简历内容。
*   **模板渲染 (Template Engine)**: 基于 `docxtpl`，支持 `.docx` 模板的动态渲染与下载。
*   **通用部署 (Universal Deploy)**: 前端动态代理，后端环境感知，零配置差异。
*   **模板管理 (Template Management)**: 支持模板的复制、重命名与全量配置克隆。

## 5. 版本历史 (Changelog)

### v3.0.0 - Production Ready (2025-12-11)
*   **[Milestone]** 完成 **Nginx 生产编排**，实现前后端完全分离部署。
*   **[Fix]** 重构 `docx_utils.py`，移除脆弱的正则解析，改用 `docxtpl.get_undeclared_template_variables()`，彻底解决 Word 标签截断导致解析失败的 Bug。
*   **[Refactor]** 重构 `AIEngine`，增加结构化日志，抽离 OpenRouter 适配逻辑。
*   **[Docs]** 移除 `deploy.sh`，统一使用 Docker Compose 管理生命周期。
*   **[Code]** 为核心组件 `FieldMapper` 添加架构级注释，明确状态管理逻辑。

### v2.2.0 - Mapping Power-Ups (2025-12-08)
*   **[Feature]** 新增模板复制与重命名功能。
*   **[Fix]** 修复数据库事务冲突。

### v2.0.0 - Universal Deployment (2025-12-07)
*   **[Architecture]** 确立 Docker Compose 统一架构。

## 6. 开发经验沉淀 (Lessons Learned)

本项目从 v1.0 到 v3.0 的演进过程中，沉淀了以下关键经验，作为后续同类项目的参考基石。

### 6.1 架构设计 (Architecture)
*   **Single Source of Truth**: 坚持使用 `docker-compose.yml` 管理所有依赖。不要维护分散的 Shell 脚本。
*   **Proxy Forwarding**: 前端代码中严禁硬编码后端 URL。始终使用相对路径 `/api/...`，通过开发环境的 Vite Proxy 和生产环境的 Nginx Reverse Proxy 进行流量分发。

### 6.2 核心逻辑 (Core Logic)
*   **Avoid Regex on XML**: 解析 Word (`.docx`) 或其他 XML 格式文档时，**严禁使用正则表达式**。Word 的内部 XML 结构极其易变（如 Run Splitting），正则匹配必然会导致生产事故。必须使用专门的 XML 解析库或模板引擎的原生方法。
*   **AI Gateway Pattern**: 不同的 AI 提供商（OpenAI, Anthropic, OpenRouter）在 API 细节上存在微小但致命的差异（如 Base URL 结尾是否带 `/v1`，Header 要求等）。必须在代码中构建统一的 "AI Gateway" 层来屏蔽这些差异，保证业务逻辑的纯粹性。

### 6.3 前端工程 (Frontend)
*   **Beware of God Components**: 像 `FieldMapper` 这样集成了数据获取、状态管理、UI 交互和业务逻辑的巨型组件，是维护性的噩梦。
    *   *建议*: 在项目早期引入 Custom Hooks (如 `useTemplateMapping`) 来抽离数据逻辑，让组件只负责渲染。
*   **Type Safety**: 对于复杂的数据结构（如本项目的映射关系表），TypeScript 的严格定义是避免运行时错误的最后一道防线。