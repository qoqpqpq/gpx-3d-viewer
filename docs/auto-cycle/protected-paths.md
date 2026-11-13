# 保护白名单 (Protected Paths)

清理/归档逻辑**只能在白名单之外的路径执行**。下列路径一律不得自动删除、覆盖或清理。

## 绝对保护（禁止任何自动写/删）
- `.env`、`.env.*`（除 `.env.server.example` 模板）
- 任何密钥/凭据文件：`*.pem`, `*.key`, `*credentials*`, `*secret*`
- `.git/`
- `android-native/` 下签名配置（`*.keystore`, `signing*`）

## 业务源码与核心配置（只许原地改，不许清理/副本）
- `src/`
- `server/`
- `android-app/`, `android-native/` 源码
- `scripts/`
- `tests/`, `benchmark/`
- 根配置：`package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `index.html`
- `.github/`（CI）

## 核心文档（只许增量改，不许清理）
- `docs/项目综合管理文档.md`
- `docs/产品与技术规划-v1.1.md`
- `docs/task-backlog.md`
- `docs/离线验收场景-v1.0.md`
- `docs/决策-Android技术选型.md`
- `docs/auto-cycle/`（治理文件）
- `README.md`, `CHANGELOG.md`

## 测试样本与数据
- `tests/**/fixtures/`, `**/*.gpx`（测试样本）
- `public/`

## 可清理区（白名单外）
- `node_modules/`（可重建）
- `dist/`, `build/`, `.vite/`, 各类缓存
- `state/archives/` 以外的临时产物
- `*.log`, `*.tmp`, `.cache/`

> 不确定是否可删的项：**先列入清理清单提交人工确认，不直接删除**。