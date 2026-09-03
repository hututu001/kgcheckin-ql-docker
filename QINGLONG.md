# 青龙面板部署

本文档记录本仓库在青龙面板中的实际可用部署方式。

> 当前实测环境：青龙 Docker 容器，项目目录为 `/ql/data/scripts/kgcheckin-ql-docker`。
>
> 注意：旧文档中出现过 `/ql/data/scripts/kgcheckin-main`，本容器里实际不是这个目录。路径写错会导致 `npm error Missing script: "qrcodeLogin"` 或找不到脚本。

## 当前部署状态

已验证流程：

1. 二维码登录成功。
2. 登录信息已保存到：

```bash
/ql/data/scripts/kgcheckin-ql-docker/data/userinfo.json
```

3. 每日签到任务已跑通，日志显示可以正常领取 VIP。
4. 每日签到 wrapper 已接入青龙通用通知模块：任务结束后会把本次日志摘要交给 `/ql/data/scripts/notify.py` 推送。
5. 已启用青龙默认兜底通知方式：`CONSOLE=true`。这会把通知内容输出到任务日志；若要发到微信/飞书/手机，需要再配置 `PUSH_KEY`、`PUSH_PLUS_TOKEN`、`FSKEY`、`BARK_PUSH` 等外部渠道 token。

日志位置：

```bash
/ql/data/log/kg_qrcode_login/
/ql/data/log/kg_daily_checkin/
```

> 2026-07-10 检查结果：`酷狗每日签到` 当前在青龙任务里存在并启用，命令为 `/ql/data/scripts/local/kg_daily_checkin.sh`，定时为 `15 07 * * *`。当天 `07:15` 执行成功。

## 一、安装依赖

进入项目目录：

```bash
cd /ql/data/scripts/kgcheckin-ql-docker
```

安装 API 依赖：

```bash
npm run install
```

说明：

- 该命令会进入 `api/` 并执行 `npm ci`。
- 如果 `api/node_modules/` 已存在，通常不需要重复安装。

## 二、青龙环境变量

扫码登录推荐使用本地文件保存登录信息，不建议手动填写 `USERINFO`。

在青龙面板「环境变量」中配置：

```bash
USERINFO_FILE=/ql/data/scripts/kgcheckin-ql-docker/data/userinfo.json
APPEND_USER=是
NUMBER=1
```

说明：

- `USERINFO_FILE`：登录信息保存路径。
- `APPEND_USER=是`：新增账号时追加/更新，不覆盖已有账号列表。
- `NUMBER=1`：本次扫码登录的账号数量。多个账号可改为对应数量。
- 不需要配置 `USERINFO`。
- 不需要配置 `PHONE` / `CODE`，这两个是手机号验证码登录用的。

## 三、青龙任务配置（推荐 wrapper 脚本方式）

青龙面板有时会对 `cd ... && npm run ...` 这类命令做额外解析，导致明明目录正确却报：

```text
npm error Missing script: "qrcodeLogin"
```

因此推荐创建两个 wrapper 脚本，让青龙任务只调用脚本文件。

> **提示：这两个 wrapper 脚本已随仓库提供在 `local/` 目录下**（`local/kg_qrcode_login.sh` 和 `local/kg_daily_checkin.sh`，即服务器实测可用版本）。新环境部署时直接拷贝到青龙脚本目录并赋予执行权限即可，无需手工创建：
>
> ```bash
> mkdir -p /ql/data/scripts/local
> cp /ql/data/scripts/kgcheckin-ql-docker/local/*.sh /ql/data/scripts/local/
> chmod +x /ql/data/scripts/local/kg_*.sh
> ```
>
> 以下原始创建命令保留作为参考。

### 1. 创建扫码登录脚本

```bash
mkdir -p /ql/data/scripts/local
cat > /ql/data/scripts/local/kg_qrcode_login.sh <<'EOF'
#!/bin/sh
set -e
cd /ql/data/scripts/kgcheckin-ql-docker
npm run qrcodeLogin
EOF
chmod +x /ql/data/scripts/local/kg_qrcode_login.sh
```

### 2. 创建每日签到脚本

```bash
cat > /ql/data/scripts/local/kg_daily_checkin.sh <<'EOF'
#!/bin/sh
# KuGou daily check-in wrapper: run task, then send current log through QingLong notify.py.
# Configure push channel in QingLong config.sh or env vars. Secrets are not stored here.

set +e
cd /ql/data/scripts/kgcheckin-ql-docker

TMP_LOG="/tmp/kg_daily_checkin_$$.log"

npm run main > "$TMP_LOG" 2>&1
STATUS=$?
cat "$TMP_LOG"

if [ -f /ql/data/scripts/notify.py ]; then
  python3 - "$TMP_LOG" "$STATUS" <<'PY'
import pathlib
import re
import sys

sys.path.insert(0, "/ql/data/scripts")
from notify import send

log_path = pathlib.Path(sys.argv[1])
status = sys.argv[2] if len(sys.argv) > 2 else "0"
text = log_path.read_text(encoding="utf-8", errors="replace") if log_path.exists() else ""

text = re.sub(r"\x1b\[[0-9;]*m", "", text)
lines = [line.rstrip() for line in text.splitlines() if line.strip()]

keywords = ("账号", "开始", "成功", "失败", "异常", "过期", "今日", "今天", "VIP到期", "次数已用光", "Error")
important = [line for line in lines if any(k in line for k in keywords)]
tail = lines[-40:]
merged = []
for line in important + tail:
    if line not in merged:
        merged.append(line)
content = "\n".join(merged[-80:]) or "酷狗每日签到已执行，但未捕获到日志内容。"

title = "酷狗每日签到：成功" if status == "0" and "Error" not in text and "领取异常" not in text else "酷狗每日签到：异常/需查看"
send(title, content)
PY
else
  echo "[WARN] /ql/data/scripts/notify.py not found; skip QingLong push notification"
fi

rm -f "$TMP_LOG"
exit "$STATUS"
EOF
chmod +x /ql/data/scripts/local/kg_daily_checkin.sh
```

实际使用版本会在调用 `notify.py` 前加载青龙配置文件：

```bash
if [ -f /ql/data/config/config.sh ]; then
  . /ql/data/config/config.sh
fi
```

这样 `config.sh` 中配置的 `CONSOLE=true`、`PUSH_PLUS_TOKEN`、`PUSH_KEY` 等通知变量都会对酷狗任务生效。

说明：

- 原始命令只是 `npm run main`，只能在青龙日志里看到结果，不会主动发消息。
- 现在 wrapper 会先把 `npm run main` 输出保存到临时日志，再调用青龙自带的 `/ql/data/scripts/notify.py`。
- 推送标题：成功时为 `酷狗每日签到：成功`；出现 `Error` 或 `领取异常` 时为 `酷狗每日签到：异常/需查看`。
- 推送正文只保留关键信息和日志尾部，避免整段日志过长。
- 密钥不写进脚本；通知渠道统一在青龙配置里维护。

### 3. 青龙任务：酷狗扫码登录

名称：

```text
酷狗扫码登录
```

命令：

```bash
/ql/data/scripts/local/kg_qrcode_login.sh
```

定时规则可随便填一个，例如：

```cron
0 0 0 * * *
```

建议：

- 该任务只在需要重新登录时手动运行。
- 平时可以禁用，避免自动弹二维码。

### 4. 青龙任务：酷狗每日签到

名称：

```text
酷狗每日签到
```

命令：

```bash
/ql/data/scripts/local/kg_daily_checkin.sh
```

定时规则：

```cron
15 1 * * *
```

建议保持启用。

## 四、首次二维码登录流程

1. 在青龙面板手动运行「酷狗扫码登录」。
2. 打开任务日志。
3. 日志中会输出一段：

```text
data:image/png;base64,...
```

4. 复制完整的 `data:image/png;base64,...` 到浏览器地址栏打开。
5. 用酷狗 App 扫码并确认登录。
6. 日志出现以下内容即为成功：

```text
登录成功！
USERINFO saved to /ql/data/scripts/kgcheckin-ql-docker/data/userinfo.json
```

7. 然后手动运行一次「酷狗每日签到」验证。

## 五、消息推送配置

酷狗任务本身不负责管理推送密钥，只调用青龙通用通知模块：

```bash
/ql/data/scripts/notify.py
```

因此只需要在青龙里配置任意一个支持的通知渠道即可。配置位置二选一：

1. 青龙面板 → 配置文件 → `config.sh`
2. 青龙面板 → 环境变量（变量名与 `config.sh` 里一致）

常用渠道示例：

```bash
# 默认兜底：输出到青龙任务日志，不依赖外部 token
export CONSOLE="true"

# PushPlus（微信通知，常用）
export PUSH_PLUS_TOKEN="你的 PushPlus token"
export PUSH_PLUS_TEMPLATE="html"
export PUSH_PLUS_CHANNEL="wechat"

# Bark（iOS）
export BARK_PUSH="你的 Bark 地址或设备码"
export BARK_GROUP="QingLong"

# Telegram
export TG_BOT_TOKEN="你的 bot token"
export TG_USER_ID="你的 user id"

# 飞书机器人
export FSKEY="你的飞书机器人 FSKEY"

# 自定义 Webhook
export WEBHOOK_URL="你的回调地址，内容里可用 $title 和 $content"
export WEBHOOK_METHOD="POST"
export WEBHOOK_CONTENT_TYPE="application/json"
export WEBHOOK_BODY='title: "$title"
content: "$content"'
```

注意：

- 不要把真实 token 写进本文档或提交到公开仓库。
- 当前已在 `/ql/data/config/config.sh` 中启用 `export CONSOLE="true"`，所以即使还没填外部 token，也能在任务日志里看到通知标题和通知正文。
- `CONSOLE=true` 只是日志兜底，不会主动推送到微信/飞书/手机；真正外部推送仍需配置对应 token。
- 配完通知变量后，可以在容器内做一次最小测试：

```bash
cd /ql/data/scripts
HITOKOTO=false python3 - <<'PY'
from notify import send
send("青龙通知测试", "如果你收到这条消息，说明青龙通知渠道已配置成功。")
PY
```

- 如果测试输出 `无推送渠道，请检查通知变量是否正确`，说明还没有配置有效通知变量；至少应启用 `CONSOLE=true` 作为兜底。
- 配好渠道后，手动运行一次「酷狗每日签到」，应该会收到 `酷狗每日签到：成功` 或 `酷狗每日签到：异常/需查看`。

## 六、常见问题

### 1. `Missing script: "qrcodeLogin"`

常见原因：

- 没有进入正确目录。
- 目录写成了旧路径 `/ql/data/scripts/kgcheckin-main`。
- 青龙面板对 `cd ... && npm run ...` 解析异常。

解决方案：

优先使用 wrapper 脚本：

```bash
/ql/data/scripts/local/kg_qrcode_login.sh
```

正确项目目录是：

```bash
/ql/data/scripts/kgcheckin-ql-docker
```

可以验证：

```bash
cd /ql/data/scripts/kgcheckin-ql-docker
npm run
```

应能看到：

```text
qrcodeLogin
main
sent
phoneLogin
```

### 2. `USERINFO not configured and .../data/userinfo.json does not exist`

原因：还没有完成首次登录，缺少本地 token 文件。

解决：运行「酷狗扫码登录」，扫码成功后会自动生成：

```bash
/ql/data/scripts/kgcheckin-ql-docker/data/userinfo.json
```

### 3. `connect ECONNREFUSED 127.0.0.1:3000`

原因：项目内部会先启动本地酷狗 API 服务，监听 `127.0.0.1:3000`。原脚本等待时间较短，在青龙里可能 API 服务还没启动完成就发请求。

已采用的修复：修改 `utils/utils.js`，给请求增加重试等待，并且不再把 npm warning 当作服务启动失败。

备份文件：

```bash
/ql/data/scripts/kgcheckin-ql-docker/utils/utils.js.bak_20260709_0012
```

修复后的核心逻辑：请求 `127.0.0.1:3000` 时最多重试 30 次，每次间隔 1 秒。

### 4. 二维码登录等待超时

原因：二维码未及时扫码确认，或二维码已过期。

解决：重新手动运行「酷狗扫码登录」，复制新的 `data:image/png;base64,...` 打开扫码。

## 七、当前实测通过的任务

青龙任务建议保持如下：

| 名称 | 命令 | 状态 | 定时 |
| --- | --- | --- | --- |
| 酷狗扫码登录 | `/ql/data/scripts/local/kg_qrcode_login.sh` | 平时禁用，需要登录时手动运行 | `0 0 0 * * *` |
| 酷狗每日签到 | `/ql/data/scripts/local/kg_daily_checkin.sh` | 启用；已接入青龙通知模块 | `15 07 * * *` |

> 说明：当前青龙里实际保存的每日签到定时为 `15 07 * * *`。如果想改回凌晨 01:15，可在青龙任务里改成 `15 1 * * *`。

## 八、手机号登录（可选，不推荐）

如果不用扫码，也可以手机号验证码登录。

需要环境变量：

```bash
PHONE=手机号
CODE=短信验证码
```

流程：

```bash
cd /ql/data/scripts/kgcheckin-ql-docker
npm run sent
npm run phoneLogin
```

注意：

- `CODE` 是一次性的，登录后可以删除。
- 多账号绑定同一手机号可能不支持。
- 当前推荐二维码登录。
