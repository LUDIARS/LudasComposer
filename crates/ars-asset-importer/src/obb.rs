//! OBB (向き付きバウンディングボックス) 算出。
//!
//! 頂点集合の共分散行列から主成分分析 (PCA) で 3 軸を抽出し、
//! 各軸への頂点射影で half-extents を決める。
//!
//! Jacobi 回転法で対称 3x3 行列の固有値分解を行う。反復回数は固定 (32 回)
//! で毎回同じ結果を返すため、決定性 CI の前提を満たす。

use glam::Vec3;

use crate::schema::OrientedBox;

/// 頂点集合から OBB を算出。空の場合は `None`。
pub fn compute(points: &[Vec3]) -> Option<OrientedBox> {
    if points.is_empty() {
        return None;
    }

    let n = points.len() as f32;
    let mean = points.iter().copied().sum::<Vec3>() / n;

    // 共分散行列 (対称)
    let mut cov = [[0.0f32; 3]; 3];
    for p in points {
        let d = *p - mean;
        cov[0][0] += d.x * d.x;
        cov[0][1] += d.x * d.y;
        cov[0][2] += d.x * d.z;
        cov[1][1] += d.y * d.y;
        cov[1][2] += d.y * d.z;
        cov[2][2] += d.z * d.z;
    }
    cov[1][0] = cov[0][1];
    cov[2][0] = cov[0][2];
    cov[2][1] = cov[1][2];
    for row in &mut cov {
        for v in row.iter_mut() {
            *v /= n;
        }
    }

    let (axes_rows, _eigen) = jacobi_eigen(cov);

    // axes_rows[i] が第 i 固有ベクトル (単位、直交)
    let mut axes = [Vec3::X, Vec3::Y, Vec3::Z];
    for i in 0..3 {
        axes[i] = Vec3::from_array(axes_rows[i]);
    }

    // 射影して min/max
    let mut min = Vec3::splat(f32::INFINITY);
    let mut max = Vec3::splat(f32::NEG_INFINITY);
    for p in points {
        let d = *p - mean;
        let proj = Vec3::new(d.dot(axes[0]), d.dot(axes[1]), d.dot(axes[2]));
        min = min.min(proj);
        max = max.max(proj);
    }

    let half = (max - min) * 0.5;
    let center_local = (max + min) * 0.5;
    let center_world = mean
        + axes[0] * center_local.x
        + axes[1] * center_local.y
        + axes[2] * center_local.z;

    Some(OrientedBox {
        center: center_world.to_array(),
        axes: [axes[0].to_array(), axes[1].to_array(), axes[2].to_array()],
        half_extents: half.abs().to_array(),
    })
}

/// 対称 3x3 行列の Jacobi 固有値分解。
///
/// 戻り値: (固有ベクトル行列の行 = 各固有ベクトル, 固有値)
/// 固有値の降順にソート。
// Jacobi eigenvalue solver: 3x3 行列の固定 0..3 インデックスがアルゴリズム上自然なので
// needless_range_loop を抑止する。
#[allow(clippy::needless_range_loop)]
fn jacobi_eigen(mut a: [[f32; 3]; 3]) -> ([[f32; 3]; 3], [f32; 3]) {
    // V = 単位行列から始め、回転を右から掛けて固有ベクトルを蓄積
    let mut v = [
        [1.0f32, 0.0, 0.0],
        [0.0, 1.0, 0.0],
        [0.0, 0.0, 1.0],
    ];

    const ITERATIONS: usize = 32;
    for _ in 0..ITERATIONS {
        // 最大非対角成分の位置を探す
        let mut p = 0usize;
        let mut q = 1usize;
        let mut max_off = a[0][1].abs();
        for i in 0..3 {
            for j in (i + 1)..3 {
                let v2 = a[i][j].abs();
                if v2 > max_off {
                    max_off = v2;
                    p = i;
                    q = j;
                }
            }
        }

        if max_off < 1e-10 {
            break;
        }

        let app = a[p][p];
        let aqq = a[q][q];
        let apq = a[p][q];
        let theta = (aqq - app) / (2.0 * apq);
        let t = if theta >= 0.0 {
            1.0 / (theta + (1.0 + theta * theta).sqrt())
        } else {
            1.0 / (theta - (1.0 + theta * theta).sqrt())
        };
        let c = 1.0 / (1.0 + t * t).sqrt();
        let s = t * c;

        // A' = J^T A J
        let new_app = app - t * apq;
        let new_aqq = aqq + t * apq;
        a[p][p] = new_app;
        a[q][q] = new_aqq;
        a[p][q] = 0.0;
        a[q][p] = 0.0;

        for i in 0..3 {
            if i != p && i != q {
                let aip = a[i][p];
                let aiq = a[i][q];
                a[i][p] = c * aip - s * aiq;
                a[p][i] = a[i][p];
                a[i][q] = s * aip + c * aiq;
                a[q][i] = a[i][q];
            }
        }

        // V' = V J
        for i in 0..3 {
            let vip = v[i][p];
            let viq = v[i][q];
            v[i][p] = c * vip - s * viq;
            v[i][q] = s * vip + c * viq;
        }
    }

    let eigen = [a[0][0], a[1][1], a[2][2]];
    // 列ベクトルを行配列に詰め直して降順ソート
    let mut pairs: [(f32, [f32; 3]); 3] = [
        (eigen[0], [v[0][0], v[1][0], v[2][0]]),
        (eigen[1], [v[0][1], v[1][1], v[2][1]]),
        (eigen[2], [v[0][2], v[1][2], v[2][2]]),
    ];
    pairs.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));

    // 正規化 + 右手系保証
    let mut rows = [pairs[0].1, pairs[1].1, pairs[2].1];
    let values = [pairs[0].0, pairs[1].0, pairs[2].0];
    for row in &mut rows {
        let v = Vec3::from_array(*row).normalize_or_zero();
        *row = v.to_array();
    }
    // 右手系: row2 = row0 × row1
    let r0 = Vec3::from_array(rows[0]);
    let r1 = Vec3::from_array(rows[1]);
    let r2 = r0.cross(r1).normalize_or_zero();
    rows[2] = r2.to_array();

    (rows, values)
}

#[cfg(test)]
mod tests {
    use super::*;
    use glam::Quat;

    #[test]
    fn axis_aligned_cube_has_axis_aligned_obb() {
        let pts = cube_points();
        let obb = compute(&pts).unwrap();

        // 軸は単位ベクトルの順列
        for axis in obb.axes {
            let v = Vec3::from_array(axis);
            assert!((v.length() - 1.0).abs() < 1e-4);
        }
        // half_extents は 1.0 (cube が [-1,1]^3)
        for h in obb.half_extents {
            assert!((h - 1.0).abs() < 1e-4, "half = {}", h);
        }
        // center は原点
        for c in obb.center {
            assert!(c.abs() < 1e-4);
        }
    }

    #[test]
    fn rotated_long_box_has_correct_principal_axis() {
        let q = Quat::from_rotation_y(std::f32::consts::FRAC_PI_4);
        // x 方向に長い箱 (4x1x1) を y で 45 度回転
        let mut pts = Vec::new();
        for &sx in &[-2.0f32, 2.0] {
            for &sy in &[-0.5f32, 0.5] {
                for &sz in &[-0.5f32, 0.5] {
                    pts.push(q * Vec3::new(sx, sy, sz));
                }
            }
        }

        let obb = compute(&pts).unwrap();

        // 最大軸の half_extent が 2.0 付近
        assert!(
            (obb.half_extents[0] - 2.0).abs() < 1e-3,
            "half_extents = {:?}",
            obb.half_extents
        );
        // 残り二軸は 0.5 付近
        assert!((obb.half_extents[1] - 0.5).abs() < 1e-3);
        assert!((obb.half_extents[2] - 0.5).abs() < 1e-3);
    }

    fn cube_points() -> Vec<Vec3> {
        let mut v = Vec::new();
        for &x in &[-1.0f32, 1.0] {
            for &y in &[-1.0f32, 1.0] {
                for &z in &[-1.0f32, 1.0] {
                    v.push(Vec3::new(x, y, z));
                }
            }
        }
        v
    }
}
