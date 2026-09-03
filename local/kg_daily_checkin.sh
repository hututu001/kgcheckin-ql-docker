#!/bin/sh
# KuGou daily check-in wrapper: run task, then send current log through QingLong notify.py.
# Configure push channel in QingLong config.sh or env vars. Secrets are not stored here.

set +e
cd /ql/data/scripts/kgcheckin-ql-docker || exit 1

TMP_LOG="/tmp/kg_daily_checkin_$$.log"

npm run main > "$TMP_LOG" 2>&1
STATUS=$?
cat "$TMP_LOG"

if [ -f /ql/data/config/config.sh ]; then
  . /ql/data/config/config.sh
fi

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

# Strip ANSI color codes for cleaner push content.
text = re.sub(r"\x1b\[[0-9;]*m", "", text)
lines = [line.rstrip() for line in text.splitlines() if line.strip()]

# Keep important lines plus recent tail to avoid overlong push messages.
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
