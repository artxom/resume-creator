# TenderWizard Project Documentation
**Version**: 2.0.0 (The "Universal" Release)
**Date**: 2025-12-07

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

## 5. 版本历史 (Changelog)

### v2.0.0 - Universal Deployment (2025-12-07)
*   **[Architecture]** 废弃 `deploy.sh` 和 Nginx 反向代理方案。
*   **[Frontend]** 全面重构 API 调用逻辑，移除硬编码 `localhost`，采用 Vite Proxy + 相对路径 (`/api/v1`)。
*   **[Backend]** 增加环境变量 (`.env`) 支持，增加 AI Key 缺失时的容错处理。
*   **[DevOps]** 统一使用 `docker-compose.yml` 管理所有环境。

### v1.x - The Foundation
*   实现基础的 CRUD、Excel 导入导出。
*   初步集成 DeepSeek AI。
*   实现基于 Jinja2 语法的 Word 模板渲染。

## 6. 未来规划 (Roadmap v2.x)

### v2.1 - Template Management & Security (In Progress)
*   **[Smart Mapper]**: 升级智能映射页面
    *   新增：模板库列表视图 (查看已配置的 Word 模板)。
    *   新增：详细信息查看 (查看上传的 Word 文件及字段配置详情)。
    *   新增：在线编辑与保存映射配置。
*   **[Resume Wizard]**: 优化简历向导
    *   变更：移除上传步骤，改为从模板库中选择已有模板。
*   **[Data Manager]**: 数据安全
    *   变更：屏蔽 `field_mapping` 表的直接访问/删除权限，防止误操作。

### v2.2 - UI/UX 细节打磨
*   更友好的 Loading 状态。
*   移动端适配。

### v2.3 - 多模板管理中心
*   (已部分并在 v2.1 实现)
