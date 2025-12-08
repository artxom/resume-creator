# TenderWizard Project Documentation
**Version**: 2.2.0 (Mapping Power-Ups)
**Date**: 2025-12-08

## 1. 项目愿景 (Vision)

**TenderWizard** 是一个智能化的简历自动生成与数据管理系统。
v2.0 版本的核心里程碑是实现了 **"Universal Deployment" (统一架构)**：无论是本地 Mac 开发环境，还是 Linux 生产服务器，均使用**同一套代码、同一个 Docker Compose 配置**，彻底消除了环境差异带来的部署痛点。

## 2. 核心架构 (Architecture v2.0)

### 2.1 技术栈
*   **Frontend**: React 19 (Vite) + Material-UI (MUI)
    *   *Key Pattern*: **Proxy Forwarding**. 前端通过相对路径 `/api` 发起请求，由 Vite Server 代理转发至后端。
*   **Backend**: FastAPI (Python 3.9)
    *   *Key Pattern*: **Fault Tolerance**. AI 模块具备容错机制，数据库连接具备重试机制。
*   **Database**: PostgreSQL 13 (Dockerized)
*   **AI Engine**: DeepSeek API (OpenAI Compatible Interface)
*   **Infrastructure**: Docker Compose (Single Source of Truth)

### 2.2 统一网络拓扑
```text
[User Browser] --(http:5173)--> [Frontend Container (Vite)]
                                      | (Proxy /api)
                                      v
                             [Backend Container (FastAPI)] --(Internal Network)--> [PostgreSQL]
```

## 3. 快速开始 (Quick Start)

适用于 **所有环境** (Local Dev & Remote Prod)。

### 3.1 环境准备
1.  安装 Docker & Docker Compose。
2.  确保 `resume_creator/` 目录下存在 `.env` 文件：
    ```ini
    # resume_creator/.env
    DEEPSEEK_API_KEY=sk-your-key-here
    # Optional:
    # POSTGRES_USER=user
    # POSTGRES_PASSWORD=password
    ```

### 3.2 启动/更新
```bash
cd resume_creator
# 一键构建并启动
docker-compose up -d --build
```

### 3.3 访问
*   **应用主页**: `http://<YOUR_IP>:5173` (本地为 localhost, 服务器为公网IP)
*   **API 文档**: `http://<YOUR_IP>:8000/docs`

## 4. 功能清单 (Features)

*   **数据导入 (Data Importer)**: 支持 Excel 批量导入，自动清洗 NaN/Infinity 数据，自动生成 UUID 主键。
*   **智能映射 (Smart Mapping)**: 可视化配置字段映射，支持注入字段级的 AI 提示词 (Prompt)。
*   **AI 简历生成 (AI Studio)**: 集成 DeepSeek 模型，基于上下文自动撰写、润色简历内容。
*   **模板渲染 (Template Engine)**: 基于 `docxtpl`，支持 `.docx` 模板的动态渲染与下载。
*   **通用部署 (Universal Deploy)**: 前端动态代理，后端环境感知，零配置差异。
*   **模板管理 (Template Management)**: 支持模板的**复制**与**重命名**，保留所有字段映射配置，提升复用性。

## 5. 版本历史 (Changelog)

### v2.2.0 - Mapping Power-Ups (2025-12-08)
*   **[Feature]** 「字段映射」页新增**模板复制**与**重命名**功能，大幅提升配置效率。
    *   **复制**: 一键克隆现有模板及其所有字段映射关系，方便快速创建衍生版本。
    *   **重命名**: 支持在 UI 上直接修改模板名称，便于版本管理和识别。
*   **[Fix]** 修复了后端 `copy_template` 接口的事务冲突错误 (500 Internal Server Error)。
*   **[Refactor]** 修复了前端 MUI Grid 组件在 v7 版本下的过时语法警告。

### v2.0.0 - Universal Deployment (2025-12-07)
*   **[Architecture]** 废弃 `deploy.sh` 和 Nginx 反向代理方案。
*   **[Frontend]** 全面重构 API 调用逻辑，移除硬编码 `localhost`，采用 Vite Proxy + 相对路径 (`/api/v1`)。
*   **[Backend]** 增加环境变量 (`.env`) 支持，增加 AI Key 缺失时的容错处理。
*   **[DevOps]** 统一使用 `docker-compose.yml` 管理所有环境。

### v1.x - The Foundation
*   实现基础的 CRUD、Excel 导入导出。
*   初步集成 DeepSeek AI。
*   实现基于 Jinja2 语法的 Word 模板渲染。

## 6. 未来规划 (Roadmap)

### v3.0 - Nginx Orchestration (Next Milestone)
**目标**: 实现生产级部署架构，移除对开发服务器端口 (5173) 的依赖。
*   **[Infrastructure]**: 引入 Nginx 容器作为系统的唯一入口（Reverse Proxy）。
    *   配置 Nginx 监听 80 端口。
    *   路由规则：`http://localhost/` 指向前端静态资源，`http://localhost/api` 转发至后端容器。
*   **[Frontend]**: 从开发模式 (`npm run dev`) 切换为生产构建模式 (`npm run build`)。
    *   利用 Docker 多阶段构建，仅将编译后的静态文件（HTML/CSS/JS）打包进 Nginx 容器，大幅减小镜像体积并提升加载速度。
*   **[User Experience]**: 用户无需记忆复杂端口，直接访问 `http://localhost` 即可使用。

### v4.0 - Unified AI Gateway (The "One API" Integration)
**目标**: 解决多厂商 AI 接入的协议兼容性与网络稳定性问题（如 OpenRouter 的 401 错误）。
*   **[Middleware]**: 集成开源项目 **One API** 到 `docker-compose`编排中。
*   **[Integration]**: 
    *   后端废除复杂的厂商适配代码，统一对接本地 One API 接口。
    *   利用 One API 的强大的协议转换和重试机制，彻底解决跨国网络连接的不稳定性。
*   **[Management]**: 提供可视化的 Key 管理后台，支持渠道负载均衡。

### v2.x - 持续优化 (Ongoing)
*   **[UI/UX]**: 更友好的全局 Loading 状态；移动端响应式布局适配。
*   **[Security]**: 敏感数据表（映射配置）的访问权限加固。
