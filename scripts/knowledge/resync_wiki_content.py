#!/usr/bin/env python3
"""把本地知识详解 Markdown 重新覆盖写入对应飞书文档（只更新内容，绝不创建/删除节点）。

适用：链接格式、正文清理等"内容层"批量修订后的重同步（如相对链接改为 <cite> 内部引用）。
- 标题→obj_token 取自 data/_workspace/cpa-tax-2026/logs/wiki_node_map.tsv（已去重，108 个标题全局唯一）；
- 本地相对链接经 scripts/wiki_link_resolve.py 转为 <cite> 内部文档引用（渲染为目标文档标题、
  obj_token 强绑定可校验坏链；注意飞书正文跨文档点击统一新开标签，单窗口导航走左侧知识库目录树）；
- 章 README 以"章目录名"为标题，知识点篇以文件名（去 .md）为标题，全局篇在知识详解根目录；
- 找不到 obj、或 docs +update 失败均计入失败清单，失败自动重试 3 次；
- 不写 done_flag、不追加 map，避免映射表重复膨胀。

用法：
  python3 scripts/knowledge/resync_wiki_content.py                  # 全量重同步（默认用 profile.paths.localRoot）
  python3 scripts/knowledge/resync_wiki_content.py --only 01        # 只重跑路径含 01 的文件（dry 过滤）
  python3 scripts/knowledge/resync_wiki_content.py --dry-run         # 只列出将同步的文件，不写飞书
  python3 scripts/knowledge/resync_wiki_content.py --course-dir <dir> --map <tsv>  # 显式指定目录和映射（一卡一课，不靠手改 json）
"""
import argparse
import glob
import os
import subprocess
import sys
import time

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(REPO, "scripts", "knowledge"))
from course_profile import load_profile  # noqa: E402
_profile = load_profile()
# 标题→obj_token 映射随 profile 走（建树脚本 sync_wiki_new.sh 产出），可用 WIKI_MAP 覆盖
MAP_FILE = os.environ.get(
    "WIKI_MAP",
    os.path.join(REPO, "data", "_workspace", _profile["key"], "logs", "wiki_node_map.tsv"),
)
RESOLVER = os.path.join(REPO, "scripts", "wiki_link_resolve.py")
COURSE_DIR = os.path.join(REPO, _profile["paths"]["localRoot"], "知识详解")
# 断点续跑：每篇成功落 done，重跑时零 API 跳过（与建树 wiki_done 同范式），
# 多轮保守批次只补未成功篇、不重复消耗账号写配额；--force 可全量重刷
DONE_DIR = os.path.join(os.path.dirname(MAP_FILE), "resync_done")


def safe_name(title):
    return title.replace("/", "_").replace(" ", "_")


def strip_frontmatter(text):
    """剥离文件顶部的 YAML frontmatter（连续 ---...---），无则原样返回。

    仅当文件以 --- 开头时才剥离；正文中间的 --- 分隔线（前面有标题/blockquote）不会被误判。
    剥离后去掉前导空行，保证正文从 # 标题开始。
    """
    if not text.startswith("---"):
        return text
    lines = text.splitlines(keepends=True)
    for i in range(1, len(lines)):
        if lines[i].strip() == "---":
            return "".join(lines[i + 1:]).lstrip("\n")
    return text  # 无闭合 ---，原样返回（不破坏文件）


def load_title2obj():
    m = {}
    with open(MAP_FILE, encoding="utf-8") as f:
        for line in f:
            c = line.rstrip("\n").split("\t")
            if len(c) >= 3 and c[0]:
                m[c[0]] = c[2]
    return m


def collect_files():
    """返回 [(标题, 本地路径)]，覆盖 2 全局篇 + 14 章 README + 92 知识点篇。"""
    items = []
    for path in sorted(glob.glob(os.path.join(COURSE_DIR, "*.md"))):  # 全局篇
        items.append((os.path.basename(path)[:-3], path))
    for group in sorted(glob.glob(os.path.join(COURSE_DIR, "[0-9]*/"))):
        gname = os.path.basename(group.rstrip(os.sep))
        readme = os.path.join(group, "README.md")
        if os.path.isfile(readme):
            items.append((gname, readme))
        for p in sorted(glob.glob(os.path.join(group, "*.md"))):
            if os.path.basename(p) == "README.md":
                continue
            items.append((os.path.basename(p)[:-3], p))
    return items


def update_one(title, path, obj):
    raw = open(path, encoding="utf-8").read()
    raw = strip_frontmatter(raw)
    # 必须显式把本 profile 的 map 传给 resolver：resolver 默认回退到仓库根 logs/（不存在），
    # 不传 WIKI_MAP 会导致其映射表为空、所有相对链接都转不成 cite（2026-09-12 会计课踩过，
    # 第二遍 169 篇内链全部退化成纯文本，不得不第三遍重刷）
    resolved = subprocess.run(
        ["python3", RESOLVER], input=raw, capture_output=True, text=True, cwd=REPO,
        env={**os.environ, "WIKI_MAP": MAP_FILE},
    ).stdout
    # 守卫：resolver 输出空时不发空写请求（否则 lark-cli 报 requires --content，
    # 属 validation 错误、重试 5 次纯浪费），直接返回真因
    if not resolved.strip():
        return False, "wiki_link_resolve 输出为空（resolver 异常），未发写请求"
    # fail-loud：同目录 ./xxx.md 链接本应全部转成 cite，残留说明 WIKI_MAP 没生效
    if "](" + "./" in resolved:
        print(f"    [警告] {title} resolver 后仍残留 ./ 相对链接（cite 未生效，检查 WIKI_MAP 是否传对）", flush=True)
    last = ""
    # 重试策略（2026-09-16 修复）：
    # - invalid_response（代理层限流/parse temporary token fail）：立即失败，不重试！
    #   原因：单篇内重试会在同一进程内继续累积代理层计数，反而加剧限流；
    #   应由外层调度器停止当前批、等待一段时间后重启新进程（代理层计数清零）。
    # - 其他错误（参数/编码/瞬时网关抖动）：最多重试1次（间隔3秒），扛瞬时抖动。
    for attempt in range(2):
        proc = subprocess.run(
            ["lark-cli", "docs", "+update", "--doc", obj, "--command", "overwrite",
             "--doc-format", "markdown", "--content", "-", "--as", "user", "--format", "json"],
            input=resolved, capture_output=True, text=True, cwd=REPO,
        )
        last = proc.stdout + proc.stderr
        if '"ok":true' in last.replace(" ", "") or '"ok": true' in last:
            return True, ""
        # 诊断：每次失败立即把原始返回打到日志，便于区分限流/参数/编码
        print(f"    [attempt {attempt+1}/2 未成功 rc={proc.returncode}] {last[:240]!r}", flush=True)
        # 检测到 invalid_response（代理层限流）：立即失败，不重试
        if "invalid_response" in last or "parse temporary token" in last:
            print(f"    ⚠️  检测到代理层限流(invalid_response)，立即失败不重试，交外层调度器处理", flush=True)
            return False, last[:300]
        # 其他错误：第1次失败后等待3秒重试第2次
        if attempt == 0:
            time.sleep(3)
    return False, last[:300]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", help="只同步路径中包含该片段的文件")
    ap.add_argument("--dry-run", action="store_true", help="只列文件，不写飞书")
    ap.add_argument("--force", action="store_true", help="忽略 done 标记全量重刷")
    ap.add_argument("--course-dir", help="显式指定知识详解目录（默认回退 profile.paths.localRoot/知识详解）")
    ap.add_argument("--map", dest="map_file", help="显式指定 wiki_node_map.tsv 路径（默认回退 data/_workspace/<profile>/logs/wiki_node_map.tsv）")
    args = ap.parse_args()

    # 一卡一课：显式参数覆盖 profile 默认值，从此不靠手改 json 切换正课/名师课
    global MAP_FILE, COURSE_DIR, DONE_DIR
    if args.map_file:
        MAP_FILE = args.map_file if os.path.isabs(args.map_file) else os.path.join(REPO, args.map_file)
    if args.course_dir:
        COURSE_DIR = args.course_dir if os.path.isabs(args.course_dir) else os.path.join(REPO, args.course_dir)
    DONE_DIR = os.path.join(os.path.dirname(MAP_FILE), "resync_done")

    print(f"[配置] course_dir={COURSE_DIR}")
    print(f"[配置] map_file={MAP_FILE}")
    title2obj = load_title2obj()
    items = collect_files()
    if args.only:
        items = [it for it in items if args.only in it[1]]

    missing, failed, ok = [], [], 0
    new_written = 0  # 本轮真实新写成功数（不含 done 跳过）
    # 每轮新写上限：lark-cli 经豆包转发代理访问飞书，单进程累计请求到阈值后代理层
    # 返回 invalid_response（非飞书账号限流、非内容问题）；全新进程计数从零即可恢复。
    # 故外层按批换新进程：本轮新写满 MAX_NEW 即主动干净退出，由外层 shell 重启续跑。
    max_new = int(os.environ.get("RESYNC_MAX_NEW", "0"))  # 0=不限制
    consec_fail = 0  # 连续失败计数：达阈值判定代理层累计限流，全局长冷却
    window_level = 0  # 连续撞窗的层级：冷却时长递增，成功一篇即归零（深窗不反复续命）
    print(f"待处理文件 {len(items)} 个（map 共 {len(title2obj)} 个标题）")
    for i, (title, path) in enumerate(items, 1):
        obj = title2obj.get(title)
        rel = os.path.relpath(path, REPO)
        if not obj:
            missing.append((title, rel))
            print(f"[{i}/{len(items)}] ✗ 无obj映射: {title}")
            continue
        done_flag = os.path.join(DONE_DIR, safe_name(title) + ".done")
        if not args.force and os.path.exists(done_flag):
            ok += 1
            print(f"[{i}/{len(items)}] · 已同步跳过: {title}")
            continue
        if args.dry_run:
            print(f"[{i}/{len(items)}] (dry) {title} -> {obj[:10]}")
            continue
        success, err = update_one(title, path, obj)
        if success:
            ok += 1
            consec_fail = 0
            window_level = 0
            os.makedirs(DONE_DIR, exist_ok=True)
            with open(done_flag, "w", encoding="utf-8") as fh:
                fh.write(title + "\n")
            print(f"[{i}/{len(items)}] ✓ {title}")
            new_written += 1
            if max_new and new_written >= max_new:
                print(f"  === 本轮新写 {new_written} 篇达 RESYNC_MAX_NEW 上限，主动退出供外层换新进程批次 ===")
                break
        else:
            failed.append((title, rel, err))
            consec_fail += 1
            print(f"[{i}/{len(items)}] ✗ 写入失败: {title}")
            # 连续 2 篇失败即判定转发代理层累计限流（invalid_response，非飞书账号/内容问题），
            # 全局长冷却、不在窗口内空转；冷却后继续，失败篇无 done、下轮断点补
            if consec_fail >= 2:
                if max_new:
                    # 批次模式：进程内不长冷却，连续 2 败即快速退出，交外层换新进程
                    # （新进程=新代理会话）+ 外层休眠承担等待，避免单进程卡死空转
                    print("  === 连续 2 篇失败，批次模式快速退出，交外层换新进程重试 ===", flush=True)
                    break
                # 单进程模式：冷却递增 300→600→900s，避免固定短冷却反复给限流"续命"
                window_level += 1
                base = float(os.environ.get("RESYNC_WINDOW_COOLDOWN", "300"))
                cap = float(os.environ.get("RESYNC_WINDOW_CAP", "900"))
                cool = min(base * window_level, cap)
                print(f"  ~~~ 连续 {consec_fail} 篇失败，判定代理限流(第{window_level}层)，全局冷却 {cool:.0f}s（{time.strftime('%H:%M:%S')}）~~~", flush=True)
                time.sleep(cool)
                consec_fail = 0
        time.sleep(float(os.environ.get("RESYNC_INTERVAL", "1.5")))
        # 每 N 篇额外暂停，避免连续调用导致 lark-cli 临时 token 失效
        batch_size = int(os.environ.get("RESYNC_BATCH_SIZE", "15"))
        batch_pause = float(os.environ.get("RESYNC_BATCH_PAUSE", "5"))
        if i % batch_size == 0 and i < len(items):
            print(f"  --- 分批暂停 {batch_pause} 秒（已处理 {i}/{len(items)}）---")
            time.sleep(batch_pause)

    print("\n========== 汇总 ==========")
    print(f"成功 {ok}，无映射 {len(missing)}，失败 {len(failed)}")
    for t, p in missing:
        print(f"  [无映射] {t} ({p})")
    for t, p, e in failed:
        print(f"  [失败] {t} ({p}): {e}")
    sys.exit(1 if (missing or failed) else 0)


if __name__ == "__main__":
    main()
