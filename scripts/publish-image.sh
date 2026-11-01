#!/usr/bin/env bash
#
# 构建并发布 three-model-hub 镜像（不依赖任何 CI）
#
# 用法（用 bash 调用，避免 Windows 检出后缺少执行位）：
#   bash scripts/publish-image.sh --registry registry.cn-hangzhou.aliyuncs.com --namespace lishuaistart
#   bash scripts/publish-image.sh -r docker.io -n yourname -t 0.1.0 -p linux/amd64,linux/arm64
#   bash scripts/publish-image.sh -r registry.cn-hangzhou.aliyuncs.com -n lishuaistart --no-push --platform linux/amd64
#
# 环境变量（命令行参数优先）：
#   REGISTRY            镜像仓库域名，必填
#   IMAGE_NAMESPACE     仓库命名空间 / 用户名，必填
#   IMAGE_PREFIX        镜像名前缀，默认 three-model-hub
#   IMAGE_TAG           默认 latest
#   PLATFORMS           默认 linux/amd64；服务器是 ARM 就写 linux/arm64
#   PUSH                默认 1；设 0 只构建不推送（此时只能单架构 --load）
#
# 登录：脚本不会把口令写进文件。推送前先手动执行
#   docker login <registry>
# 或提前导出 REGISTRY_USERNAME / REGISTRY_PASSWORD，脚本会用它登录。
#
set -euo pipefail

REGISTRY="${REGISTRY:-}"
IMAGE_NAMESPACE="${IMAGE_NAMESPACE:-}"
IMAGE_PREFIX="${IMAGE_PREFIX:-three-model-hub}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
PLATFORMS="${PLATFORMS:-linux/amd64}"
PUSH="${PUSH:-1}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPONENTS=(backend frontend)

die() { printf '\033[31m错误\033[0m %s\n' "$1" >&2; exit 1; }
info() { printf '\033[36m→\033[0m %s\n' "$1"; }
ok() { printf '\033[32m✓\033[0m %s\n' "$1"; }

usage() {
  # 打印文件顶部的注释块（跳过 shebang，遇到第一条非注释行停止）
  awk 'NR>1 && /^#/ { sub(/^# ?/, ""); print; next } NR>1 { exit }' "${BASH_SOURCE[0]}"
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -r|--registry)   REGISTRY="${2:-}"; shift 2 ;;
    -n|--namespace)  IMAGE_NAMESPACE="${2:-}"; shift 2 ;;
    -p|--platform)   PLATFORMS="${2:-}"; shift 2 ;;
    -t|--tag)        IMAGE_TAG="${2:-}"; shift 2 ;;
    --prefix)        IMAGE_PREFIX="${2:-}"; shift 2 ;;
    --no-push)       PUSH=0; shift ;;
    -h|--help)       usage ;;
    *) die "未知参数：$1（--help 查看用法）" ;;
  esac
done

[[ -n "$REGISTRY" ]] || die "缺少镜像仓库地址，用 -r 指定，例如 registry.cn-hangzhou.aliyuncs.com"
[[ -n "$IMAGE_NAMESPACE" ]] || die "缺少命名空间 / 用户名，用 -n 指定"

command -v docker >/dev/null 2>&1 || die "未找到 docker 命令"

# 单架构判定：多架构必须走 buildx 远端 manifest，不能 --load 到本地
if [[ "$PLATFORMS" == *,* ]]; then
  MULTIARCH=1
else
  MULTIARCH=0
fi

if [[ "$PUSH" == "0" && "$MULTIARCH" == "1" ]]; then
  die "多架构构建无法输出到本地，--no-push 时请只指定单一 --platform"
fi

# docker.io 在镜像引用里可以省略前缀，但登录时仍要写全
if [[ "$REGISTRY" == "docker.io" ]]; then
  IMAGE_BASE="docker.io/${IMAGE_NAMESPACE}"
else
  IMAGE_BASE="${REGISTRY}/${IMAGE_NAMESPACE}"
fi

# 阿里云 ACR 等仓库要求仓库名全小写
IMAGE_PREFIX="$(printf '%s' "$IMAGE_PREFIX" | tr '[:upper:]' '[:lower:]')"

info "仓库：${IMAGE_BASE}"
info "标签：${IMAGE_TAG}"
info "架构：${PLATFORMS}"
info "推送：$([[ "$PUSH" == "1" ]] && echo 是 || echo 否)"

cd "$REPO_ROOT"

# ── 登录 ────────────────────────────────────────────────────────
if [[ "$PUSH" == "1" ]]; then
  if [[ -n "${REGISTRY_USERNAME:-}" && -n "${REGISTRY_PASSWORD:-}" ]]; then
    info "使用环境变量中的凭据登录 ${REGISTRY}"
    printf '%s' "$REGISTRY_PASSWORD" | docker login "$REGISTRY" -u "$REGISTRY_USERNAME" --password-stdin
  else
    info "未检测到 REGISTRY_USERNAME/REGISTRY_PASSWORD，沿用本机已有的登录状态"
    info "若下面推送报 401/403，请先执行：docker login $REGISTRY"
  fi
fi

# ── buildx builder ──────────────────────────────────────────────
BUILDER=tmh-publisher
if ! docker buildx inspect "$BUILDER" >/dev/null 2>&1; then
  info "创建 buildx builder：$BUILDER"
  docker buildx create --name "$BUILDER" --driver docker-container >/dev/null
fi
docker buildx use "$BUILDER" >/dev/null

if [[ "$MULTIARCH" == "1" && "$PUSH" == "1" ]]; then
  info "多架构构建需要 QEMU，检查 binfmt …"
  docker run --privileged --rm tonistiigi/binfmt --install all >/dev/null 2>&1 || \
    printf '\033[33m注意\033[0m binfmt 安装失败，若非本机原生架构可能构建失败\n'
fi

# ── 逐组件构建 ──────────────────────────────────────────────────
declare -a BUILT=()
for component in "${COMPONENTS[@]}"; do
  ref="${IMAGE_BASE}/${IMAGE_PREFIX}-${component}:${IMAGE_TAG}"
  info "构建 $component → $ref"

  args=(
    build
    --file "${component}/Dockerfile"
    --platform "$PLATFORMS"
    --tag "$ref"
    --build-arg "NPM_REGISTRY=${NPM_REGISTRY:-https://registry.npmjs.org}"
    # 关掉 provenance/SBOM 证明：部分国内仓库对附加 manifest 兼容性差，
    # 会让 docker pull 报 "no matching manifest for linux/amd64"
    --provenance=false
    --sbom=false
  )
  if [[ "$PUSH" == "1" ]]; then
    args+=(--push)
  else
    args+=(--load)
  fi
  args+=(.)

  docker buildx "${args[@]}"
  BUILT+=("$ref")
  ok "$component 完成"
done

# ── 结果 ────────────────────────────────────────────────────────
echo
ok "全部完成"
if [[ "$PUSH" == "1" ]]; then
  echo
  echo "以下内容可直接写进部署机的 .env："
  echo "──────────────────────────────────────────────"
  echo "IMAGE_NAMESPACE=${IMAGE_BASE}"
  echo "IMAGE_TAG=${IMAGE_TAG}"
  echo "──────────────────────────────────────────────"
  echo
  echo "部署机拉取前如果仓库是私有的，需先 docker login ${REGISTRY}"
  for ref in "${BUILT[@]}"; do
    echo "  docker pull ${ref}"
  done
else
  echo "本地镜像（未推送）："
  for ref in "${BUILT[@]}"; do
    echo "  ${ref}"
  done
  echo
  echo "可直接用源码构建编排起服务：docker compose -f docker-compose.deploy.yml up -d"
fi
