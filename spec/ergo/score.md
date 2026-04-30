# ergo_score — スコアカウンタ + コンボ倍率

> **Repo**: [`include/ergo/score/score.h`](https://github.com/LUDIARS/Ergo/blob/main/include/ergo/score/score.h)
> **lexicon Feature**: [`score-system`](../game-lexicon/features/core/score-system.toml)

## 1. 一文要約

スコア加算 / リセット + 任意のコンボ倍率 + ハイスコア通知を扱う **数値器**。 永続化はホストの責務。

## 2. 公開 API

```cpp
namespace ergo::score {

struct Config {
    bool  combo_multiplier = true;    // コンボ倍率を掛けるか
    float combo_factor     = 0.1f;    // m = 1 + combo * factor
    float multiplier_cap   = 0.0f;    // 0 = 無制限
};

class Score {
public:
    using HighScoreHandler = std::function<void(std::int64_t new_high)>;
    using ChangeHandler    = std::function<void(std::int64_t score)>;

    Score() = default;
    explicit Score(Config cfg);

    /// 加算。 戻り値は実際に加算された値 (combo 倍率反映後)。
    std::int64_t add(std::int64_t base, std::int32_t combo_count = 0);

    void reset();
    void set_high_score(std::int64_t v) noexcept;     // セーブから復元用 (callback なし)

    [[nodiscard]] std::int64_t score() const noexcept;
    [[nodiscard]] std::int64_t high_score() const noexcept;

    void set_on_change(ChangeHandler);
    void set_on_high_score(HighScoreHandler);
};

}
```

## 3. 振る舞い契約

| 操作 | 副作用 | コールバック |
|------|--------|-------------|
| `add(base, combo_count)` | `score += applied`、 `high_score = max(high_score, score)` | `on_change(score)` 必、 ハイスコア更新時のみ追加 `on_high_score(high_score)` |
| `reset()` | `score = 0` (high_score 維持) | `on_change(0)` |
| `set_high_score(v)` | `high_score = v` | (コールバックなし。 セーブ復元用) |

### 倍率の計算

```cpp
// combo_count > 0 で combo_multiplier = true のとき
m = 1.0f + combo_count * combo_factor;
if (multiplier_cap > 0 && m > multiplier_cap) m = multiplier_cap;
if (m < 1.0f) m = 1.0f;
applied = (std::int64_t) (base * m);
```

| `combo_factor=0.1` の倍率推移 | combo=0 | combo=5 | combo=10 | combo=50 |
|-------------------------------|---------|---------|----------|----------|
| 倍率 | 1.0x | 1.5x | 2.0x | 6.0x |
| `multiplier_cap=3.0` 適用後 | 1.0x | 1.5x | 2.0x | 3.0x |

## 4. 使い方

### 音ゲー / アクション共通の加算パターン

```cpp
ergo::score::Config cfg;
cfg.combo_multiplier = true;
cfg.combo_factor = 0.05f;     // 1 hit ごとに +5%
cfg.multiplier_cap = 4.0f;    // 4x 上限

ergo::score::Score score(cfg);

// ハイスコア初期化 (セーブから)
score.set_high_score(load_high_from_disk());

// プレイ中
score.set_on_change([&hud](std::int64_t s) { hud.set_score(s); });
score.set_on_high_score([&hud](std::int64_t h) {
    hud.flash_high_score();
    save_high_to_disk(h);
});

// ヒットイベントで加算
score.add(100, current_combo);
```

### Ars アクター統合

```rust
pub struct GameSession {
    score: ergo_score::Score,
    combo: ergo_combo_counter::ComboCounter,    // ペアで使う
    ...
}

impl GameSession {
    pub fn on_hit(&mut self, base_points: i64) {
        let applied = self.score.add(base_points, self.combo.count() as i32);
        self.combo.hit();
        self.spawn_score_text(applied);
    }
}
```

## 5. ハイスコア永続化の責務分担

| 責務 | 担当 |
|------|------|
| `score_` / `high_score_` の保持 | `ergo_score` |
| 倍率ロジック | `ergo_score` |
| ファイル / DB へのシリアライズ | **ホスト (Ars 側)** |
| 設定保存とロードのトリガ | **ホスト** |

ergo_score は I/O を持たない。 永続化したいなら `ergo_io` (filesystem ラッパ) と組み合わせる:

```cpp
// 起動時
auto bytes = ergo::io::read_all(score_path);
score.set_high_score(deserialize_int64(bytes));

// ハイスコア更新時
score.set_on_high_score([&](std::int64_t h) {
    ergo::io::write_all(score_path, serialize_int64(h));
});
```

## 6. パラメータ (lexicon と同期)

[`score-system.toml`](../game-lexicon/features/core/score-system.toml) と:

| TOML key | C++ field | デフォルト |
|----------|-----------|-----------|
| `high_score_persist` | (ホスト責務) | true (推奨) |
| `combo_multiplier` | `Config::combo_multiplier` | true |

`combo_factor` / `multiplier_cap` は lexicon に未定義 (C++ 実装側のみ)。 Phase 2 で TOML schema を拡張予定。

## 7. テスト

`tests/score/test_score.cpp` で 8 件:

- `StartsAtZero`
- `AddBaseWithoutCombo`
- `ComboMultiplierIncreasesApplied`
- `MultiplierCap`
- `HighScoreUpdatesOnce`
- `ResetPreservesHighScore`
- `OnChangeFiresOnEveryAddAndReset`
- `SetHighScoreInitial`

## 8. 拡張点 (将来)

- 多軸スコア (撃破 / アクセサリ / 残時間 / アイテム取得 を別カウンタで合成)
- スコア倍率の **時限イベント** (1.5x ボーナス区間など)
- ランク (S+/S/A/...) 評価ロジックの組込 (現状は外側で計算)

## 9. 統合パターン

`ergo_combo_counter` とペアで使うのが標準。 [combo_counter.md](combo_counter.md) §"score との統合" 参照。

## 10. 既知の制限

- スコアは `std::int64_t` 固定 (8 ZB まで OK、 実用上問題なし)
- 倍率式が `1 + combo * factor` の線形固定。 階段関数や上振れ係数は外側で計算
