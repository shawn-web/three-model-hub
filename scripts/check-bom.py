#!/usr/bin/env python3
"""检查被 Git 跟踪的文件是否包含 UTF-8 BOM。

BOM 会导致 Vite / Vitest 无法解析 package.json 等配置文件，
本脚本用于在 CI 与本地提交前拦截此类问题。

用法:
    python3 scripts/check-bom.py

退出码:
    0  未发现 BOM
    1  发现 BOM（并打印文件清单）
"""
from __future__ import annotations

import subprocess
import sys

BOM = b"\xef\xbb\xbf"


def tracked_files() -> list[bytes]:
    out = subprocess.check_output(["git", "ls-files", "-z"])
    return [f for f in out.split(b"\0") if f]


def main() -> int:
    bad: list[str] = []
    for raw_path in tracked_files():
        try:
            with open(raw_path, "rb") as fh:
                if fh.read(3) == BOM:
                    bad.append(raw_path.decode("utf-8", "replace"))
        except OSError:
            # 已从工作区删除但仍在索引中的文件，跳过
            continue

    if bad:
        print("::error::以下被跟踪文件包含 UTF-8 BOM，请移除后再提交：")
        for name in bad:
            print(f"  - {name}")
        print(f"共 {len(bad)} 个文件。可用 python3 scripts/strip-bom.py 批量修复。")
        return 1

    print("OK: 未检测到 UTF-8 BOM")
    return 0


if __name__ == "__main__":
    sys.exit(main())
