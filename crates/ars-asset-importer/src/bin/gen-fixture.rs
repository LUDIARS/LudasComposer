//! テスト用の最小 GLB を生成する dev-only ツール。
//!
//! 通常はビルドされない (一度 fixture を生成 → コミットしたら不要)。
//! 再生成が必要な時のみ:
//!
//! ```bash
//! cargo run -p ars-asset-importer --bin gen-fixture -- <output.glb>
//! ```
//!
//! 内容: 4 頂点 / 4 三角形の四面体 (P7 決定性 CI のフィクスチャに使用)。

use std::path::PathBuf;

fn main() -> std::process::ExitCode {
    let args: Vec<String> = std::env::args().collect();
    if args.len() != 2 {
        eprintln!("usage: gen-fixture <output.glb>");
        return std::process::ExitCode::from(2);
    }
    let out = PathBuf::from(&args[1]);

    // 4 vertex tetrahedron with 4 faces
    let verts: [[f32; 3]; 4] = [
        [0.0, 0.0, 0.0],
        [1.0, 0.0, 0.0],
        [0.0, 1.0, 0.0],
        [0.0, 0.0, 1.0],
    ];
    let tris: [u16; 12] = [0, 1, 2, 0, 1, 3, 0, 2, 3, 1, 2, 3];

    let bytes = build_glb(&verts, &tris);
    if let Err(e) = std::fs::write(&out, bytes) {
        eprintln!("write {}: {e}", out.display());
        return std::process::ExitCode::from(1);
    }
    println!("wrote {}", out.display());
    std::process::ExitCode::SUCCESS
}

fn build_glb(verts: &[[f32; 3]], tris: &[u16]) -> Vec<u8> {
    let pos_bytes_len = verts.len() * 12;
    let idx_bytes_len = tris.len() * 2;

    let mut bin = Vec::with_capacity(pos_bytes_len + idx_bytes_len + 4);
    for v in verts {
        for &c in v {
            bin.extend_from_slice(&c.to_le_bytes());
        }
    }
    let idx_offset = bin.len();
    for &i in tris {
        bin.extend_from_slice(&i.to_le_bytes());
    }
    while bin.len() % 4 != 0 {
        bin.push(0);
    }

    let (mut min, mut max) = ([f32::INFINITY; 3], [f32::NEG_INFINITY; 3]);
    for v in verts {
        for i in 0..3 {
            if v[i] < min[i] {
                min[i] = v[i];
            }
            if v[i] > max[i] {
                max[i] = v[i];
            }
        }
    }

    let json = format!(
        r#"{{"asset":{{"version":"2.0"}},"buffers":[{{"byteLength":{bin_len}}}],"bufferViews":[{{"buffer":0,"byteOffset":0,"byteLength":{pl},"target":34962}},{{"buffer":0,"byteOffset":{io},"byteLength":{il},"target":34963}}],"accessors":[{{"bufferView":0,"componentType":5126,"count":{vc},"type":"VEC3","min":[{n0},{n1},{n2}],"max":[{x0},{x1},{x2}]}},{{"bufferView":1,"componentType":5123,"count":{ic},"type":"SCALAR"}}],"meshes":[{{"primitives":[{{"attributes":{{"POSITION":0}},"indices":1,"mode":4}}]}}],"nodes":[{{"mesh":0}}],"scenes":[{{"nodes":[0]}}],"scene":0}}"#,
        bin_len = bin.len(),
        pl = pos_bytes_len,
        io = idx_offset,
        il = idx_bytes_len,
        vc = verts.len(),
        ic = tris.len(),
        n0 = min[0], n1 = min[1], n2 = min[2],
        x0 = max[0], x1 = max[1], x2 = max[2],
    );
    let mut json_bytes = json.into_bytes();
    while json_bytes.len() % 4 != 0 {
        json_bytes.push(0x20);
    }

    let total_len = 12 + 8 + json_bytes.len() + 8 + bin.len();
    let mut out = Vec::with_capacity(total_len);
    out.extend_from_slice(&0x46546C67u32.to_le_bytes());
    out.extend_from_slice(&2u32.to_le_bytes());
    out.extend_from_slice(&(total_len as u32).to_le_bytes());
    out.extend_from_slice(&(json_bytes.len() as u32).to_le_bytes());
    out.extend_from_slice(&0x4E4F534Au32.to_le_bytes());
    out.extend_from_slice(&json_bytes);
    out.extend_from_slice(&(bin.len() as u32).to_le_bytes());
    out.extend_from_slice(&0x004E4942u32.to_le_bytes());
    out.extend_from_slice(&bin);
    out
}
