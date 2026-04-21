//! 凸包生成 (P3)
//!
//! `chull` クレート (pure Rust QuickHull 系) で原メッシュ頂点群の凸包を求め、
//! 三角形化されたメッシュとして返す。Tier 1 のコリジョン/配置プレビュー目的。
//!
//! 退化入力 (頂点数 < 4 / 共面 / 共線 / 重複頂点) の場合は `None` を返す。

use glam::Vec3;

/// 凸包の三角形メッシュ表現。indices は三角形ごとに 3 要素ずつ。
#[derive(Debug, Clone, PartialEq)]
pub struct HullMesh {
    pub vertices: Vec<Vec3>,
    pub indices: Vec<u32>,
}

impl HullMesh {
    pub fn triangle_count(&self) -> u32 {
        (self.indices.len() / 3) as u32
    }

    pub fn vertex_count(&self) -> u32 {
        self.vertices.len() as u32
    }
}

/// `points` の 3D 凸包を計算する。
///
/// 退化入力 (頂点数不足 / 共面) の場合は `None`。
pub fn compute(points: &[Vec3]) -> Option<HullMesh> {
    if points.len() < 4 {
        return None;
    }

    let raw: Vec<Vec<f64>> = points
        .iter()
        .map(|p| vec![p.x as f64, p.y as f64, p.z as f64])
        .collect();

    // chull::ConvexHullWrapper::try_new(points, max_iter)
    let hull = chull::ConvexHullWrapper::try_new(&raw, None).ok()?;
    let (verts_f64, faces) = hull.vertices_indices();

    if verts_f64.is_empty() || faces.is_empty() {
        return None;
    }

    let vertices: Vec<Vec3> = verts_f64
        .iter()
        .map(|v| Vec3::new(v[0] as f32, v[1] as f32, v[2] as f32))
        .collect();

    let indices: Vec<u32> = faces.iter().map(|&i| i as u32).collect();

    // chull の内部反復順は非決定的 (HashMap 由来) なため三角形配列を
    // カノニカル化する: 各三角形を「最小 index が先頭」へ回転 (winding 保持)
    // → 三角形配列を辞書順ソート。
    let indices = canonicalize_triangles(&indices);

    Some(HullMesh { vertices, indices })
}

fn canonicalize_triangles(indices: &[u32]) -> Vec<u32> {
    let mut tris: Vec<[u32; 3]> = indices
        .chunks_exact(3)
        .map(|c| rotate_min_first([c[0], c[1], c[2]]))
        .collect();
    tris.sort_unstable();
    tris.into_iter().flat_map(|t| t.into_iter()).collect()
}

/// `[a, b, c]` を最小要素が先頭になるよう回転する。winding は保持。
fn rotate_min_first(t: [u32; 3]) -> [u32; 3] {
    let m = t.iter().enumerate().min_by_key(|(_, v)| **v).unwrap().0;
    match m {
        0 => t,
        1 => [t[1], t[2], t[0]],
        _ => [t[2], t[0], t[1]],
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn cube_corners() -> Vec<Vec3> {
        vec![
            Vec3::new(-1.0, -1.0, -1.0),
            Vec3::new(1.0, -1.0, -1.0),
            Vec3::new(-1.0, 1.0, -1.0),
            Vec3::new(1.0, 1.0, -1.0),
            Vec3::new(-1.0, -1.0, 1.0),
            Vec3::new(1.0, -1.0, 1.0),
            Vec3::new(-1.0, 1.0, 1.0),
            Vec3::new(1.0, 1.0, 1.0),
        ]
    }

    #[test]
    fn cube_hull_has_8_vertices_and_12_triangles() {
        let hull = compute(&cube_corners()).expect("cube has hull");
        assert_eq!(hull.vertex_count(), 8);
        // 立方体の凸包は 6 面 = 12 三角形 (各面 2 三角形)
        assert_eq!(hull.triangle_count(), 12);
    }

    #[test]
    fn interior_points_are_culled() {
        // 立方体 + 中心の点 → 凸包の頂点数は 8 のまま
        let mut pts = cube_corners();
        pts.push(Vec3::ZERO);
        let hull = compute(&pts).expect("cube hull");
        assert_eq!(hull.vertex_count(), 8);
    }

    #[test]
    fn too_few_points_returns_none() {
        let pts = vec![
            Vec3::new(0.0, 0.0, 0.0),
            Vec3::new(1.0, 0.0, 0.0),
            Vec3::new(0.0, 1.0, 0.0),
        ];
        assert!(compute(&pts).is_none());
    }

    #[test]
    fn coplanar_points_returns_none() {
        // すべて z=0 平面上 → 退化、None を期待
        let pts = vec![
            Vec3::new(0.0, 0.0, 0.0),
            Vec3::new(1.0, 0.0, 0.0),
            Vec3::new(0.0, 1.0, 0.0),
            Vec3::new(1.0, 1.0, 0.0),
        ];
        assert!(compute(&pts).is_none());
    }

    #[test]
    fn deterministic() {
        let a = compute(&cube_corners()).unwrap();
        let b = compute(&cube_corners()).unwrap();
        assert_eq!(a.vertices, b.vertices);
        assert_eq!(a.indices, b.indices);
    }
}
