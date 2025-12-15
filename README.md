# PlotCouncil / 图表复刻助手

> EN: PlotCouncil reproduces scientific plots with a multi-agent review loop and Matplotlib rendering.
> 
> 中文：PlotCouncil 通过多角色复核链路重绘科研图，后端使用 Matplotlib 渲染。

---

## Features / 功能
- Multi-pass critique pipeline (Coder → Reviewers → Chair) to catch layout/style/data issues
- FastAPI renderer executes Matplotlib safely off the frontend
- Project + plot history persisted locally (IndexedDB)，支持截图留档
- Drag/drop or paste images; compare renders side-by-side

---

## Quick Start / 快速开始
Prereqs: Node.js ≥ 20, Python ≥ 3.10

1) Install & run frontend
```bash
npm install
npm run dev
```

2) (Optional) Start renderer
```bash
cd server
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

3) Configure environment
- Create `.env.local` with `VITE_RENDER_API_URL=http://localhost:8000/render`
- In the app Settings, paste your model API key (kept in-browser; not committed)

---

## Usage / 使用
1. 上传或粘贴目标图像（支持 PNG/JPG/WEBP）。
2. 选择运行模式：Simple（单次）或 Complex（多轮复核）。
3. 点击 **Run**，查看中间画布的渲染结果与右侧代码/评审。
4. 若不匹配：使用 Refine/Manual Fix 调整，或切换到 Complex 模式让系统自动迭代。
5. Plot History 抽屉可回看历次截图与日志。

---

## Notes / 注意
- 不要提交 `.env.local`；其中包含本地密钥与渲染地址。
- 服务器执行任意 Matplotlib 代码，部署时请放入容器/沙箱并限制资源。
- 清理 `server/artifacts/` 可回收空间。
