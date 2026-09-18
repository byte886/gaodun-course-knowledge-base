#!/usr/bin/env python3
"""全自动六科同步调度器：自动监控、自动重启、按顺序推进"""
import os
import subprocess
import time
from pathlib import Path

PROJECT_DIR = Path(__file__).resolve().parents[2]
os.chdir(PROJECT_DIR)

LOG_FILE = "/tmp/auto_sync_scheduler.log"
SPACE_ID = "7678261729456852192"

# 科目配置
COURSES = [
    {"profile": "cpa-tax-2026", "total": 108, "parent": "UM6bwW23tiYkCVk3nXtc3TpBnGe", "need_tree": False, "course_dir": "data/高顿/CPA/【VIPCPA专享】名师专业课-税法"},
    {"profile": "cpa-accounting-2026", "total": 176, "parent": "TazhwSJ4mi58StkDT2ccahMGnlb", "need_tree": False, "force_resync": True, "course_dir": "data/高顿/CPA/【VIPCPA专享】名师专业课-会计"},
    {"profile": "ep3-audit-2026", "total": 132, "parent": "CPgZwfKG9iXphJklioEcWmr1nNb", "need_tree": True, "course_dir": "data/高顿/CPA/【VIPCPA专享】名师专业课-审计"},
    {"profile": "ep3-finance-2026", "total": 144, "parent": "Z2jFwq1ZxigOb9k3XaMcB6H4nib", "need_tree": True, "course_dir": "data/高顿/CPA/【VIPCPA专享】名师专业课-财管"},
    {"profile": "ep3-econlaw-2026", "total": 80, "parent": "JbEjwyE22isCnok416YcfW3rnlG", "need_tree": True, "course_dir": "data/高顿/CPA/【VIPCPA专享】名师专业课-经济法"},
    {"profile": "ep3-strategy-2026", "total": 77, "parent": "T4vNwlQ8yipvyskJonoc7GRynbb", "need_tree": True, "course_dir": "data/高顿/CPA/【VIPCPA专享】名师专业课-战略"},
]


def log(msg):
    line = f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {msg}"
    print(line, flush=True)
    with open(LOG_FILE, "a") as f:
        f.write(line + "\n")


def get_done_count(profile):
    done_dir = PROJECT_DIR / f"data/_workspace/{profile}/logs/resync_done"
    if not done_dir.exists():
        return 0
    return len(list(done_dir.glob("*.done")))


def need_build_tree(profile):
    map_file = PROJECT_DIR / f"data/_workspace/{profile}/logs/wiki_node_map.tsv"
    return not map_file.exists() or map_file.stat().st_size == 0


def build_tree(profile, parent, course_dir):
    log(f"【建树】开始为 {profile} 建立节点结构...")
    try:
        result = subprocess.run(
            ["python3", "scripts/knowledge/build_tree.py", profile, parent, course_dir],
            capture_output=True, text=True, timeout=600
        )
        with open(LOG_FILE, "a") as f:
            f.write(result.stdout)
            if result.stderr:
                f.write(result.stderr)
    except Exception as e:
        log(f"【建树】{profile} 异常: {e}")
        return False
    map_file = PROJECT_DIR / f"data/_workspace/{profile}/logs/wiki_node_map.tsv"
    if map_file.exists() and map_file.stat().st_size > 0:
        count = sum(1 for _ in open(map_file))
        log(f"【建树】{profile} 完成，共 {count} 个节点")
        return True
    log(f"【建树】{profile} 失败")
    return False


def sync_course(profile, total):
    log(f"【同步】开始 {profile}，目标 {total} 篇")
    no_progress = 0

    while True:
        done = get_done_count(profile)
        if done >= total:
            log(f"【同步】{profile} 完成：{done}/{total}")
            return True

        log(f"【同步】{profile} 进度 {done}/{total}，启动一轮...")

        env = os.environ.copy()
        env["GAODUN_COURSE_PROFILE"] = profile
        result = subprocess.run(
            ["bash", "scripts/knowledge/run_resync_batches.sh", profile, "8", "90", str(total), "900", "3"],
            env=env, capture_output=True, text=True
        )
        with open(LOG_FILE, "a") as f:
            f.write(result.stdout)
            f.write(result.stderr)

        done = get_done_count(profile)
        if done >= total:
            log(f"【同步】{profile} 完成：{done}/{total}")
            return True

        # 检查进展
        prev = done
        time.sleep(10)
        done = get_done_count(profile)
        if done == prev:
            no_progress += 1
            if no_progress >= 5:
                log(f"【错误】{profile} 连续5轮无进展，跳过")
                return False
            log(f"【同步】{profile} 无进展({no_progress}/5)，等60秒重试")
            time.sleep(60)
        else:
            no_progress = 0


def main():
    log("=" * 50)
    log("全自动六科同步调度器启动")
    log("=" * 50)

    for i, course in enumerate(COURSES, 1):
        profile = course["profile"]
        total = course["total"]
        parent = course["parent"]
        course_dir = course.get("course_dir", "")

        log("")
        log(f"========== {i}/6 {profile} ==========")

        try:
            # 建树（如果需要）
            if course.get("need_tree") and need_build_tree(profile):
                if not build_tree(profile, parent, course_dir):
                    log(f"【跳过】{profile} 建树失败")
                    continue
                # 清除旧done标记
                done_dir = PROJECT_DIR / f"data/_workspace/{profile}/logs/resync_done"
                if done_dir.exists():
                    import shutil
                    shutil.rmtree(done_dir)

            # 会计强制重刷
            if course.get("force_resync"):
                done_dir = PROJECT_DIR / f"data/_workspace/{profile}/logs/resync_done"
                if done_dir.exists():
                    import shutil
                    shutil.rmtree(done_dir)
                log(f"【重刷】{profile} 已清除旧标记，强制全量重刷")

            # 同步内容
            sync_course(profile, total)
        except Exception as e:
            log(f"【错误】{profile} 异常: {e}")
            import traceback
            log(traceback.format_exc())
            continue

    log("")
    log("=" * 50)
    log("全部六科同步完成！")
    log("=" * 50)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"调度器崩溃: {e}")
        import traceback
        traceback.print_exc()
