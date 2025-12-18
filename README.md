<div align="center">
  <img src="./public/plotcouncil-logo.jpeg" alt="PlotCouncil Logo" width="150" style="border-radius: 24px; border: 1px solid #e2e8f0" />
  
  <h1>PlotCouncil</h1>

  <p>
    <strong>Scientific Plot Reproduction with Multi-Agent Review</strong>
    <br />
    <i>科研绘图复刻助手 · 多智能体复核 · Matplotlib 渲染</i>
  </p>

  <p style="margin: 8px 0;">
    <strong>Live toggle version:</strong> <a href="docs/index.html">docs/index.html</a> (bilingual, default Chinese)
  </p>
  <p style="margin: 8px 0;">
    <strong>English docs:</strong> <a href="README.en.md">README.en.md</a>
  </p>
</div>

<br />

## 📊 示例结果

<div align="center">

### 原始图
<img src="./test/figure_example.svg" alt="Original Scientific Figure" style="max-width: 100%; height: auto; border: none;" />

### 复现图 (2×3)

<table>
<tr>
<td><img src="./test/a.png" alt="Plot A" width="280" /><br/><a href="./test/a.py">📝 Code A</a></td>
<td><img src="./test/b.png" alt="Plot B" width="280" /><br/><a href="./test/b.py">📝 Code B</a></td>
<td><img src="./test/c.png" alt="Plot C" width="280" /><br/><a href="./test/c.py">📝 Code C</a></td>
</tr>
<tr>
<td><img src="./test/d.png" alt="Plot D" width="280" /><br/><a href="./test/d.py">📝 Code D</a></td>
<td><img src="./test/e.png" alt="Plot E" width="280" /><br/><a href="./test/e.py">📝 Code E</a></td>
<td><img src="./test/f.png" alt="Plot F" width="280" /><br/><a href="./test/f.py">📝 Code F</a></td>
</tr>
</table>

<p><i>Example figures from <a href="https://github.com/macromeer/scifig_plot_examples_R">macromeer/scifig_plot_examples_R</a></i></p>

</div>

---

## 简体中文

> **PlotCouncil** 通过多角色复核链路（学生-老师-主席）自动解析科学图表，生成高保真 Matplotlib 重绘代码。

* [功能特性](#功能特性)
* [使用指南](#使用指南)
* [安装指南](#安装指南)
* [常见问题](#常见问题)
* [注意事项](#注意事项)

---

### 功能特性

* 多智能体复核：Coder → 样式/布局/数据评审 → 主席。
* 安全渲染：FastAPI 后端执行 Matplotlib，避免前端计算负载过重。
* 本地存储：项目及绘图历史通过 IndexedDB 本地存储。
* 交互式工作流：拖拽上传、叠加对比、自动/手动修正循环。

---

### 使用指南

1. 上传：拖拽或粘贴目标图片（PNG/JPG/WEBP）。
2. 选择模式：Simple / Complex / Manual。
3. 运行：点击 Run，查看渲染与代码/评审。
4. 修正：如不匹配，使用 Refine / Manual Fix 或增加循环次数。
5. 历史：在 History 查看快照与日志。

---

### 安装指南

#### 方式一：Docker 部署（推荐）

前置要求：Docker 和 Docker Compose

```bash
git clone https://github.com/pc9527zxx/PlotCouncil.git
cd PlotCouncil
docker compose up -d
# 访问 http://localhost:8032
```

> ⚠️ **更新版本时请重新构建镜像**
> 
> 如果你之前已经构建过镜像，`docker compose up -d` 会使用缓存的旧版本。更新代码后请使用：
> ```bash
> git pull
> docker compose up -d --build
> ```
> 或者彻底重建（清除旧镜像）：
> ```bash
> docker compose down
> docker compose build --no-cache
> docker compose up -d
> ```

Docker 部署包含：多阶段构建、自动前端构建、隔离 Python 环境、持久化 artifacts、健康检查、单端口服务。

#### 方式二：手动安装

前置要求：Node.js ≥ 20, Python ≥ 3.10

**前端**

```bash
npm install
npm run build
npm run dev
```

**渲染服务**

```bash
cd server
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8032
```

**配置**

```bash
# 根目录创建 .env.local
VITE_RENDER_API_URL=http://localhost:8032/render
# 在应用 Settings 粘贴 Gemini API Key（仅存浏览器，不会提交）
```

---

### 常见问题

* 没有出现评审意见？确认 API Key 有效并选择 Complex 或 Full 模式；评审在首次渲染后触发。
* 空白图表或报错？查看 Logs 标签页；若空白，切换 Complex 让数据老师捕捉问题。
* Git 忽略哪些文件？`.env.local`, `.venv/`, `node_modules/`, `dist/`, `server/artifacts/`。

---

### 注意事项

* 后端执行任意 Matplotlib 代码，公网部署请谨慎（Docker/沙箱）。
* 定期清理 `server/artifacts/` 以回收磁盘空间。

