//! `hull.bin` バイナリフォーマットの writer/reader (P3)
//!
//! Tier 1 凸包を最小限のバイナリで永続化する。glTF より軽量で
//! ランタイム (Pictor) は mmap して頂点/インデックスを直接読める。
//!
//! ## レイアウト (little-endian, 4-byte alignment)
//!
//! ```text
//! offset  size    field
//! 0       4       magic "HULL"
//! 4       4       u32  version (= 1)
//! 8       4       u32  vertex_count
//! 12      4       u32  triangle_count
//! 16      12*V    [f32; 3] * V    vertices
//! 16+12V  12*T    [u32; 3] * T    triangles
//! ```
//!
//! 全フィールド固定幅 + 12 バイト要素なので 4-byte aligned で padding 不要。

use std::io::Write;
use std::path::Path;

use byteorder::{LittleEndian, WriteBytesExt};

use crate::hull::HullMesh;
use crate::{AssetImporterError, Result};

const HULL_MAGIC: u32 = 0x4C4C_5548; // "HULL" (little-endian: 0x48 0x55 0x4C 0x4C)
const HULL_VERSION: u32 = 1;

pub fn encode(hull: &HullMesh) -> Vec<u8> {
    let v_count = hull.vertices.len();
    let t_count = (hull.indices.len() / 3) as u32;
    let total = 16 + 12 * v_count + 4 * hull.indices.len();
    let mut out = Vec::with_capacity(total);

    out.write_u32::<LittleEndian>(HULL_MAGIC).unwrap();
    out.write_u32::<LittleEndian>(HULL_VERSION).unwrap();
    out.write_u32::<LittleEndian>(v_count as u32).unwrap();
    out.write_u32::<LittleEndian>(t_count).unwrap();

    for v in &hull.vertices {
        out.write_f32::<LittleEndian>(v.x).unwrap();
        out.write_f32::<LittleEndian>(v.y).unwrap();
        out.write_f32::<LittleEndian>(v.z).unwrap();
    }
    for &i in &hull.indices {
        out.write_u32::<LittleEndian>(i).unwrap();
    }

    debug_assert_eq!(out.len(), total);
    out
}

pub fn write(hull: &HullMesh, path: &Path) -> Result<()> {
    let bytes = encode(hull);
    let mut f = std::fs::File::create(path).map_err(|e| AssetImporterError::io(path, e))?;
    f.write_all(&bytes)
        .map_err(|e| AssetImporterError::io(path, e))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::hull;
    use glam::Vec3;

    fn cube_hull() -> HullMesh {
        let corners = vec![
            Vec3::new(-1.0, -1.0, -1.0),
            Vec3::new(1.0, -1.0, -1.0),
            Vec3::new(-1.0, 1.0, -1.0),
            Vec3::new(1.0, 1.0, -1.0),
            Vec3::new(-1.0, -1.0, 1.0),
            Vec3::new(1.0, -1.0, 1.0),
            Vec3::new(-1.0, 1.0, 1.0),
            Vec3::new(1.0, 1.0, 1.0),
        ];
        hull::compute(&corners).unwrap()
    }

    #[test]
    fn header_layout_is_correct() {
        let bytes = encode(&cube_hull());
        // magic
        assert_eq!(&bytes[0..4], b"HULL");
        // version
        assert_eq!(u32::from_le_bytes(bytes[4..8].try_into().unwrap()), 1);
        // vertex_count = 8
        assert_eq!(u32::from_le_bytes(bytes[8..12].try_into().unwrap()), 8);
        // triangle_count = 12
        assert_eq!(u32::from_le_bytes(bytes[12..16].try_into().unwrap()), 12);
        // total length: 16 + 12*8 + 4*36 = 16 + 96 + 144 = 256
        assert_eq!(bytes.len(), 256);
    }

    #[test]
    fn deterministic_byte_for_byte() {
        let h = cube_hull();
        assert_eq!(encode(&h), encode(&h));
    }
}
