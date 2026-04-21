//! `ars-import` CLI (P6)
//!
//! ディレクトリを再帰探索し、`.glb` / `.gltf` を `<project_dir>/data/` 配下に
//! インポートする。CI で「再生成しても diff ゼロ」を verify するために使う。
//!
//! ## 使い方
//!
//! ```bash
//! cargo run -p ars-asset-importer --bin ars-import -- <project_dir> <src_dir>
//! ```
//!
//! - `project_dir`: 出力先プロジェクト (`data/<id>/...` が生成される)
//! - `src_dir`: 入力アセットディレクトリ (再帰探索)
//!
//! 既存の同一 source_hash アセットはキャッシュヒットでスキップ。

use std::path::{Path, PathBuf};
use std::process::ExitCode;

use ars_asset_importer::process_with_content_id;

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().collect();
    if args.len() != 3 {
        eprintln!("usage: ars-import <project_dir> <src_dir>");
        return ExitCode::from(2);
    }
    let project_dir = PathBuf::from(&args[1]);
    let src_dir = PathBuf::from(&args[2]);

    if !project_dir.is_dir() {
        eprintln!("project_dir does not exist: {}", project_dir.display());
        return ExitCode::from(2);
    }
    if !src_dir.is_dir() {
        eprintln!("src_dir does not exist: {}", src_dir.display());
        return ExitCode::from(2);
    }

    let out_root = project_dir.join("data");
    if let Err(e) = std::fs::create_dir_all(&out_root) {
        eprintln!("failed to create {}: {e}", out_root.display());
        return ExitCode::from(1);
    }

    let mut sources = Vec::new();
    if let Err(e) = collect_sources(&src_dir, &mut sources) {
        eprintln!("scan error: {e}");
        return ExitCode::from(1);
    }
    sources.sort(); // 決定性: ファイル走査順を OS から独立化

    let mut ok = 0u32;
    let mut hit = 0u32;
    let mut fail = 0u32;
    for src in &sources {
        match process_with_content_id(src, &out_root) {
            Ok(o) => {
                if o.cache_hit {
                    hit += 1;
                    println!("[hit ] {} ({})", src.display(), o.id);
                } else {
                    ok += 1;
                    println!("[new ] {} ({})", src.display(), o.id);
                }
            }
            Err(e) => {
                fail += 1;
                eprintln!("[fail] {}: {e}", src.display());
            }
        }
    }

    println!(
        "summary: imported={ok}, cache_hit={hit}, failed={fail}, total_seen={}",
        sources.len()
    );
    if fail > 0 {
        ExitCode::from(1)
    } else {
        ExitCode::SUCCESS
    }
}

fn collect_sources(dir: &Path, out: &mut Vec<PathBuf>) -> std::io::Result<()> {
    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        let p = entry.path();
        if p.is_dir() {
            collect_sources(&p, out)?;
        } else if matches!(
            p.extension().and_then(|e| e.to_str()).map(|s| s.to_ascii_lowercase()).as_deref(),
            Some("glb") | Some("gltf")
        ) {
            out.push(p);
        }
    }
    Ok(())
}
