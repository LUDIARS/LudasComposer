//! End-to-end パイプラインテスト。
//!
//! - 最小 GLB (1 三角形) を生成 → process → meta 内容を検証
//! - 同じ src / id で再 process → cache_hit = true を検証
//! - src を書き換えて再 process → cache_hit = false を検証

use std::fs;
use std::path::Path;

use ars_asset_importer::schema::AssetMeta;
use ars_asset_importer::{process, AssetId};
use tempfile::TempDir;

#[test]
fn imports_minimal_glb_and_writes_meta() {
    let tmp = TempDir::new().unwrap();
    let src = tmp.path().join("tri.glb");
    write_minimal_glb(&src, &[[0.0, 0.0, 0.0], [2.0, 0.0, 0.0], [0.0, 3.0, 0.0]]);

    let out_root = tmp.path().join("data");
    let id = AssetId::from_string("test-asset-001");

    let outcome = process(&src, &out_root, Some(id.clone())).unwrap();
    assert!(!outcome.cache_hit);
    assert_eq!(outcome.id, id);
    assert_eq!(outcome.meta.version, AssetMeta::CURRENT_VERSION);
    assert_eq!(outcome.meta.source_ext, "glb");
    assert_eq!(outcome.meta.triangle_count, 1);
    assert_eq!(outcome.meta.vertex_count, 3);

    // AABB check
    assert!((outcome.meta.aabb.min[0]).abs() < 1e-5);
    assert!((outcome.meta.aabb.max[0] - 2.0).abs() < 1e-5);
    assert!((outcome.meta.aabb.max[1] - 3.0).abs() < 1e-5);

    // meta.toml が書かれている
    let meta_path = outcome.dir.join("meta.toml");
    assert!(meta_path.exists(), "meta.toml should exist");

    // source が複製されている
    let copied_src = outcome.dir.join("source.glb");
    assert!(copied_src.exists(), "source.glb should exist");
}

#[test]
fn reprocessing_same_source_hits_cache() {
    let tmp = TempDir::new().unwrap();
    let src = tmp.path().join("cube.glb");
    write_minimal_glb(
        &src,
        &[[-1.0, -1.0, -1.0], [1.0, -1.0, -1.0], [0.0, 1.0, 0.0]],
    );

    let out_root = tmp.path().join("data");
    let id = AssetId::from_string("cache-test");

    let first = process(&src, &out_root, Some(id.clone())).unwrap();
    assert!(!first.cache_hit);

    let second = process(&src, &out_root, Some(id.clone())).unwrap();
    assert!(second.cache_hit, "second run must hit cache");
    assert_eq!(second.meta.source_hash, first.meta.source_hash);
}

#[test]
fn proxy_glb_is_written_and_recorded_in_meta() {
    let tmp = TempDir::new().unwrap();
    let src = tmp.path().join("p2.glb");
    write_minimal_glb(&src, &[[0.0, 0.0, 0.0], [1.0, 0.0, 0.0], [0.0, 1.0, 0.0]]);

    let out_root = tmp.path().join("data");
    let id = AssetId::from_string("p2-asset");

    let outcome = process(&src, &out_root, Some(id.clone())).unwrap();

    let proxy_path = outcome.dir.join("proxy.glb");
    assert!(proxy_path.exists(), "proxy.glb should be written");

    let proxy_bytes = fs::read(&proxy_path).unwrap();
    assert_eq!(&proxy_bytes[0..4], b"glTF", "proxy.glb must have GLB magic");

    // gltf クレートで再ロードできること
    let g = gltf::Gltf::from_slice(&proxy_bytes).expect("proxy.glb must be valid GLB");
    let mesh = g.document.meshes().next().expect("proxy has mesh");
    let prim = mesh.primitives().next().expect("proxy has primitive");
    assert_eq!(prim.mode(), gltf::mesh::Mode::Triangles);

    // meta に proxy_triangle_count が記録されている
    assert_eq!(outcome.meta.proxy_triangle_count, Some(1));
}

#[test]
fn proxy_glb_is_deterministic_across_runs() {
    // 同一 src を別 ID でインポート → proxy.glb がバイト一致 (id は GLB に入らない)
    let tmp = TempDir::new().unwrap();
    let src = tmp.path().join("det.glb");
    write_minimal_glb(&src, &[[0.0, 0.0, 0.0], [1.0, 2.0, 3.0], [4.0, 0.0, 0.0]]);
    let out_root = tmp.path().join("data");

    let a = process(&src, &out_root, Some(AssetId::from_string("a"))).unwrap();
    let b = process(&src, &out_root, Some(AssetId::from_string("b"))).unwrap();

    let bytes_a = fs::read(a.dir.join("proxy.glb")).unwrap();
    let bytes_b = fs::read(b.dir.join("proxy.glb")).unwrap();
    assert_eq!(bytes_a, bytes_b, "proxy.glb must be deterministic");
}

#[test]
fn tetrahedron_hull_is_written_and_recorded() {
    let tmp = TempDir::new().unwrap();
    let src = tmp.path().join("tet.glb");
    write_tetra_glb(&src);
    let out_root = tmp.path().join("data");

    let outcome = process(&src, &out_root, Some(AssetId::from_string("tet"))).unwrap();

    let hull_path = outcome.dir.join("hull.bin");
    assert!(hull_path.exists(), "hull.bin should be written");

    let bytes = fs::read(&hull_path).unwrap();
    assert_eq!(&bytes[0..4], b"HULL", "hull.bin must have HULL magic");

    // 四面体の凸包: 4 頂点 / 4 三角形
    assert_eq!(outcome.meta.hull_vertex_count, Some(4));
    assert_eq!(outcome.meta.hull_triangle_count, Some(4));
}

#[test]
fn hull_bin_is_deterministic_across_runs() {
    let tmp = TempDir::new().unwrap();
    let src = tmp.path().join("det_tet.glb");
    write_tetra_glb(&src);
    let out_root = tmp.path().join("data");

    let a = process(&src, &out_root, Some(AssetId::from_string("a"))).unwrap();
    let b = process(&src, &out_root, Some(AssetId::from_string("b"))).unwrap();

    let bytes_a = fs::read(a.dir.join("hull.bin")).unwrap();
    let bytes_b = fs::read(b.dir.join("hull.bin")).unwrap();
    assert_eq!(bytes_a, bytes_b, "hull.bin must be byte-deterministic");
}

#[test]
fn flat_triangle_has_no_hull() {
    // 3 頂点の単一三角形 → hull は退化、None。エラーにはならない
    let tmp = TempDir::new().unwrap();
    let src = tmp.path().join("flat.glb");
    write_minimal_glb(&src, &[[0.0, 0.0, 0.0], [1.0, 0.0, 0.0], [0.0, 1.0, 0.0]]);
    let out_root = tmp.path().join("data");

    let outcome = process(&src, &out_root, Some(AssetId::from_string("flat"))).unwrap();

    assert!(outcome.meta.hull_vertex_count.is_none());
    assert!(outcome.meta.hull_triangle_count.is_none());
    assert!(!outcome.dir.join("hull.bin").exists());
}

#[test]
fn changed_source_invalidates_cache() {
    let tmp = TempDir::new().unwrap();
    let src = tmp.path().join("mutable.glb");
    write_minimal_glb(&src, &[[0.0, 0.0, 0.0], [1.0, 0.0, 0.0], [0.0, 1.0, 0.0]]);

    let out_root = tmp.path().join("data");
    let id = AssetId::from_string("mutate-test");

    let first = process(&src, &out_root, Some(id.clone())).unwrap();
    assert!(!first.cache_hit);

    // src を変更
    write_minimal_glb(&src, &[[0.0, 0.0, 0.0], [5.0, 0.0, 0.0], [0.0, 5.0, 0.0]]);

    let second = process(&src, &out_root, Some(id.clone())).unwrap();
    assert!(!second.cache_hit, "mutated source must invalidate cache");
    assert_ne!(second.meta.source_hash, first.meta.source_hash);
    assert!((second.meta.aabb.max[0] - 5.0).abs() < 1e-5);
}

/// 四面体 (4 頂点 / 4 三角形) の最小 GLB を書き出す。hull テスト用。
fn write_tetra_glb(path: &Path) {
    let verts: [[f32; 3]; 4] = [
        [0.0, 0.0, 0.0],
        [1.0, 0.0, 0.0],
        [0.0, 1.0, 0.0],
        [0.0, 0.0, 1.0],
    ];
    let tris: [u16; 12] = [0, 1, 2, 0, 1, 3, 0, 2, 3, 1, 2, 3];
    write_glb_arbitrary(path, &verts, &tris);
}

fn write_glb_arbitrary(path: &Path, verts: &[[f32; 3]], tris: &[u16]) {
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

    fs::write(path, out).unwrap();
}

// ---------------------------------------------------------------------------
// minimal GLB builder
// ---------------------------------------------------------------------------

/// 3 頂点 + 1 三角形の最小 GLB を `path` に書き出す。
fn write_minimal_glb(path: &Path, verts: &[[f32; 3]; 3]) {
    let bin = build_bin(verts);
    let json = build_json(verts, bin.len() as u32);

    let json_padded = pad_chunk(json.into_bytes(), 0x20);
    let bin_padded = pad_chunk(bin, 0x00);

    let total_len = 12 + 8 + json_padded.len() + 8 + bin_padded.len();
    let mut out = Vec::with_capacity(total_len);

    // Header
    out.extend_from_slice(&0x46546C67u32.to_le_bytes()); // "glTF"
    out.extend_from_slice(&2u32.to_le_bytes());
    out.extend_from_slice(&(total_len as u32).to_le_bytes());

    // JSON chunk
    out.extend_from_slice(&(json_padded.len() as u32).to_le_bytes());
    out.extend_from_slice(&0x4E4F534Au32.to_le_bytes()); // "JSON"
    out.extend_from_slice(&json_padded);

    // BIN chunk
    out.extend_from_slice(&(bin_padded.len() as u32).to_le_bytes());
    out.extend_from_slice(&0x004E4942u32.to_le_bytes()); // "BIN\0"
    out.extend_from_slice(&bin_padded);

    fs::write(path, out).unwrap();
}

fn build_bin(verts: &[[f32; 3]; 3]) -> Vec<u8> {
    // positions (3 * vec3 = 36 B) + indices (3 * u16 = 6 B, padded to 8)
    let mut bin = Vec::with_capacity(44);
    for v in verts {
        for &c in v {
            bin.extend_from_slice(&c.to_le_bytes());
        }
    }
    // indices at offset 36
    for i in [0u16, 1, 2] {
        bin.extend_from_slice(&i.to_le_bytes());
    }
    // pad to 4
    while bin.len() % 4 != 0 {
        bin.push(0);
    }
    bin
}

fn build_json(verts: &[[f32; 3]; 3], bin_len: u32) -> String {
    // min/max for POSITION accessor
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

    format!(
        r#"{{
  "asset": {{ "version": "2.0" }},
  "buffers": [{{ "byteLength": {bin_len} }}],
  "bufferViews": [
    {{ "buffer": 0, "byteOffset": 0, "byteLength": 36, "target": 34962 }},
    {{ "buffer": 0, "byteOffset": 36, "byteLength": 8, "target": 34963 }}
  ],
  "accessors": [
    {{
      "bufferView": 0, "componentType": 5126, "count": 3, "type": "VEC3",
      "min": [{min0}, {min1}, {min2}], "max": [{max0}, {max1}, {max2}]
    }},
    {{ "bufferView": 1, "componentType": 5123, "count": 3, "type": "SCALAR" }}
  ],
  "meshes": [{{
    "primitives": [{{
      "attributes": {{ "POSITION": 0 }},
      "indices": 1,
      "mode": 4
    }}]
  }}],
  "nodes": [{{ "mesh": 0 }}],
  "scenes": [{{ "nodes": [0] }}],
  "scene": 0
}}"#,
        bin_len = bin_len,
        min0 = min[0],
        min1 = min[1],
        min2 = min[2],
        max0 = max[0],
        max1 = max[1],
        max2 = max[2],
    )
}

fn pad_chunk(mut bytes: Vec<u8>, pad_byte: u8) -> Vec<u8> {
    while bytes.len() % 4 != 0 {
        bytes.push(pad_byte);
    }
    bytes
}
