#!/usr/bin/env python3
"""批量移除被 Git 跟踪文件中的 UTF-8 BOM，保留其余字节不变。

用法:
    python3 scripts/strip-bom.py
"""
from __future__ import annotations

import subprocess

BOM = b"\xef\xbb\xbf"


def main() -> int:
    out = subprocess.check_output(["git", "ls-files", "-z"])
    files = [f for f in out.split(b"\0") if f]

    changed: list[str] = []
    for raw_path in files:
        try:
            with open(raw_path, "rb") as fh:
                data = fh.read()
        except OSError:
            continue
        if data.startswith(BOM):
            with open(raw_path, "wb") as fh:
                fh.write(data[len(BOM):])
            changed.append(raw_path.decode("utf-8", "replace"))

    if not changed:
        print("OK: 没有被跟踪文件包含 UTF-8 BOM")
        return 0

    print(f"已移除 {len(changed)} 个文件的 BOM：")
    for name in changed:
        print(f"  - {name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
