<div align="center">
  <img src="./public/plotcouncil-logo.jpeg" alt="PlotCouncil Logo" width="150" style="border-radius: 24px; border: 1px solid #e2e8f0" />
  
  <h1>PlotCouncil</h1>

  <p>
    <strong>Scientific Plot Reproduction with Multi-Agent Review</strong>
    <br />
    <i>科研绘图复刻助手 · 多智能体复核 · Matplotlib 渲染</i>
  </p>

  <!-- Badges -->
  <a href="https://www.typescriptlang.org/">
    <img src="https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript&logoColor=white" alt="TypeScript" />
  </a>
  <a href="https://react.dev/">
    <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" alt="React" />
  </a>
  <a href="https://matplotlib.org/">
    <img src="https://img.shields.io/badge/Matplotlib-3.9-11557c?logo=python&logoColor=white" alt="Matplotlib" />
  </a>
  <a href="https://ai.google.dev/">
    <img src="https://img.shields.io/badge/Gemini-Pro-8E75B2?logo=google&logoColor=white" alt="Gemini" />
  </a>
</div>

<br />

<details>
<summary><strong>English</strong></summary>

> **PlotCouncil** ingests scientific figures, runs a staged agent loop (Student → Teachers → Chair), and emits high-fidelity Matplotlib code.

* [Features](#features)
* [Usage](#usage)
* [How to install](#how-to-install)
* [FAQ](#faq)
* [Notes](#notes)

---

### Features

* **Multi-agent critique**: Coder → Style/Layout/Data Reviewers → Chair. Catches layout, color, and data semantic issues.
* **Safe Rendering**: FastAPI renderer executes Matplotlib off the frontend, protecting the UI from heavy compute.
* **Local Persistence**: Project + plot history stored locally via IndexedDB.
* **Interactive Workflow**: Drag/drop images, overlay comparison, auto/manual refinement loops.

---

### Usage

1. **Upload**: Drag & drop or paste target image (PNG/JPG/WEBP).
2. **Select Mode**:
   * **Simple**: Single-pass generation (Fast).
   * **Complex**: Multi-agent review loop (High Quality).
   * **Manual**: Custom loop budget for fine-tuning.
3. **Run**: Click **Run**. View the live render in the center, code & critiques on the right.
4. **Refine**: If mismatch occurs, use **Refine** / **Manual Fix** or increase loop count.
5. **History**: Check the drawer for previous snapshots and logs.

---

### How to install

Prerequisites: Node.js ≥ 20, Python ≥ 3.10

#### Frontend

```bash
npm install
npm run dev
```

#### Renderer

(Optional, for server-side Matplotlib execution)

```bash
cd server
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

#### Configuration

1. Create `.env.local` in the root:
   ```bash
   VITE_RENDER_API_URL=http://localhost:8000/render
   ```
2. In the app **Settings** (UI), paste your **Gemini API Key**.
   * *Keys are stored in-browser and never committed.*

---

### FAQ

* **No reviews appearing?**
  Ensure you have entered a valid API Key and selected **Complex** or **Full** mode. Reviews trigger after the first render.
* **Blank plot or error?**
  Check the **Logs** tab. If the plot is blank, switch to **Complex** mode so the Data Teacher can catch it.
* **What to ignore in Git?**
  `.env.local`, `.venv/`, `node_modules/`, `dist/`, `server/artifacts/`.

---

### Notes

* The backend executes arbitrary Matplotlib code. **Deploy with caution** (Docker/Sandbox) if exposing to public.
* Periodically clean `server/artifacts/` to reclaim disk space.

</details>

<details open>
<summary><strong>简体中文</strong></summary>

> **PlotCouncil** 通过多角色复核链路（学生-老师-主席）自动解析科学图表，生成高保真 Matplotlib 重绘代码。

* [功能特性](#功能特性)
* [使用指南](#使用指南)
* [安装指南](#安装指南)
* [常见问题](#常见问题)
* [注意事项](#注意事项)

---

### 功能特性

* **多智能体复核**：Coder → 样式/布局/数据评审 → 主席。自动捕捉布局、色彩及数据语义问题。
* **安全渲染**：FastAPI 渲染器在后端执行 Matplotlib，避免前端计算负载过重。
* **本地存储**：项目及绘图历史通过 IndexedDB 本地存储，保护隐私。
* **交互式工作流**：拖拽上传、叠加对比、自动/手动修正循环。

---

### 使用指南

1. **上传**：拖拽或粘贴目标图片（PNG/JPG/WEBP）。
2. **选择模式**：
   * **简单模式 (Simple)**：单次生成（快速）。
   * **复杂模式 (Complex)**：多智能体复核循环（高质量）。
   * **手动模式 (Manual)**：自定义循环次数，用于微调。
3. **运行**：点击 **Run**。中间查看实时渲染，右侧查看代码及评审意见。
4. **修正**：如有偏差，使用 **Refine** / **Manual Fix** 或增加循环次数。
5. **历史**：在抽屉中查看过往快照及日志。

---

### 安装指南

前置要求：Node.js ≥ 20, Python ≥ 3.10

#### 前端

```bash
npm install
npm run dev
```

#### 渲染服务

（可选，用于服务端 Matplotlib 执行）

```bash
cd server
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

#### 配置

1. 在根目录创建 `.env.local`：
   ```bash
   VITE_RENDER_API_URL=http://localhost:8000/render
   ```
2. 在应用 **Settings**（界面）中粘贴您的 **Gemini API Key**。
   * *Key 仅存储在浏览器中，永远不会被提交。*

---

### 常见问题

* **没有出现评审意见？**
  确保已输入有效的 API Key 并选择了 **Complex** 或 **Full** 模式。评审会在首次渲染后触发。
* **空白图表或报错？**
  检查 **Logs** 标签页。如果是空白图，切换到 **Complex** 模式，让数据老师（Data Teacher）捕捉问题。
* **Git 忽略哪些文件？**
  `.env.local`, `.venv/`, `node_modules/`, `dist/`, `server/artifacts/`.

---

### 注意事项

* 后端会执行任意 Matplotlib 代码。如果向公网开放，请**谨慎部署**（使用 Docker/沙箱）。
* 定期清理 `server/artifacts/` 以回收磁盘空间。

</details>
