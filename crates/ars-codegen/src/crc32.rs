//! CRC32 (IEEE 802.3) 計算
//!
//! 生成済みコード／コード詳細設計ファイルの差分検出に使う軽量チェックサム。
//! 暗号学的強度は不要のため、外部依存を増やさず最小実装で提供する。

const POLY: u32 = 0xEDB8_8320;

/// CRC32 IEEE 802.3 — テーブル無しの逐次計算
pub fn crc32(data: &[u8]) -> u32 {
    let mut crc: u32 = 0xFFFF_FFFF;
    for &byte in data {
        crc ^= byte as u32;
        for _ in 0..8 {
            let mask = (crc & 1).wrapping_neg();
            crc = (crc >> 1) ^ (POLY & mask);
        }
    }
    !crc
}

/// 16進文字列で返す（manifest 永続化用）
pub fn crc32_hex(data: &[u8]) -> String {
    format!("{:08x}", crc32(data))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_input() {
        // CRC32 of empty buffer is 0
        assert_eq!(crc32(b""), 0);
    }

    #[test]
    fn known_value() {
        // CRC32("123456789") = 0xCBF43926 (ITU-T standard test vector for IEEE 802.3)
        assert_eq!(crc32(b"123456789"), 0xCBF4_3926);
    }

    #[test]
    fn hex_format() {
        assert_eq!(crc32_hex(b"123456789"), "cbf43926");
    }

    #[test]
    fn changes_on_modification() {
        let a = crc32(b"hello world");
        let b = crc32(b"hello worle");
        assert_ne!(a, b);
    }
}
