# ergo_timing_judge — ms タイミング判定

> **Repo**: [`include/ergo/timing_judge/timing_judge.h`](https://github.com/LUDIARS/Ergo/blob/main/include/ergo/timing_judge/timing_judge.h)
> **lexicon Feature**: [`timing-judge`](../game-lexicon/features/rhythm/timing-judge.toml)

## 1. 一文要約

ノートの正解時刻と入力時刻の差分から **PERFECT / GREAT / GOOD / MISS** を返す純粋関数。 ステートレス。

## 2. 公開 API

```cpp
namespace ergo::timing_judge {

enum class Judgment : std::uint8_t {
    Perfect = 0,
    Great   = 1,
    Good    = 2,
    Miss    = 3,
};

struct Windows {
    std::int32_t perfect_ms = 25;
    std::int32_t great_ms   = 60;
    std::int32_t good_ms    = 120;
};

// 純関数: 1 ペア判定
[[nodiscard]] Judgment judge(
    std::int64_t target_ms,
    std::int64_t actual_ms,
    const Windows& w
) noexcept;

// 英語ラベル (UI / log 用)
[[nodiscard]] const char* name(Judgment) noexcept;

// j が min_kept 以下より厳しいか? (= コンボ切断条件)
[[nodiscard]] bool breaks_combo(Judgment j, Judgment min_kept) noexcept;

}
```

## 3. 判定ロジック

```cpp
delta = actual_ms - target_ms;
abs_delta = |delta|;
if (abs_delta <= perfect_ms) return Perfect;
if (abs_delta <= great_ms)   return Great;
if (abs_delta <= good_ms)    return Good;
return Miss;
```

境界は **`<=` (両端含む)** — 例えば `windows = {25, 60, 120}` なら:

| `delta` (ms) | 結果 |
|--------------|------|
| 0 (= target ぴったり) | `Perfect` |
| ±25 | `Perfect` (境界含む) |
| ±26 | `Great` |
| ±60 | `Great` |
| ±61 | `Good` |
| ±120 | `Good` |
| ±121 | `Miss` |

### 早 / 遅の対称性

`delta` の符号 (早押し / 遅押し) は判定に影響しない (絶対値で比較)。 「早 / 遅」 を区別したいなら呼び出し側で `delta` の符号を別途記録する。

```cpp
auto delta = actual_ms - target_ms;     // <0 早 / >0 遅
auto j = ergo::timing_judge::judge(target_ms, actual_ms, windows);
if (j != Judgment::Miss) {
    if (delta < 0) record_early();
    else if (delta > 0) record_late();
}
```

## 4. `breaks_combo` の使い方

`min_kept` (これより厳しい判定はコンボ切断) を与えると、 ゲームデザインの 「どこからミス扱いにするか」 を表現できる:

| `min_kept` 設定 | 切断 (= true) する Judgment |
|----------------|---------------------------|
| `Miss` | (なし — Miss も含めて切らない、 通常使わない) |
| `Good` | `Miss` のみ |
| `Great` | `Good`, `Miss` |
| `Perfect` | `Great`, `Good`, `Miss` |

```cpp
// 「Good 以下でコンボ切る」 厳しめモード
combo.set_break_threshold(Judgment::Great);

if (breaks_combo(j, Judgment::Great)) combo.break_();
else                                  combo.hit();
```

## 5. 使い方

### audio clock + judge_window との連携

通常は `NoteScheduler` (アプリ側) が `now_for_judge()` 周辺の未判定ノートを切り出し、 そこから target を選んで `judge` する。

```cpp
void on_input(uint8_t lane) {
    auto now = clock.now_for_judge();
    auto candidates = scheduler.judge_window_for_lane(now, windows.good_ms, lane);
    Note* target = pick_closest(candidates, now);
    if (!target) return;            // 空打ち = no-op (or ミス扱いに加算)

    auto j = ergo::timing_judge::judge(target->target_ms, now, windows);
    target->judged = j;

    // スコア + コンボ更新
    score.add(point_for(j), combo.count());
    if (ergo::timing_judge::breaks_combo(j, settings.combo_break_threshold)) {
        combo.break_();
    } else {
        combo.hit();
    }

    // UI フィードバック
    hud.flash_judgment(j);
    if (j != Judgment::Miss) {
        record_offset((target->target_ms - now));    // 早 / 遅統計
    }
}
```

### 見逃し検出 (= MISS 自動付与)

`tick` で 「target を `now - good_ms` まで超過した未判定ノート」 を MISS にする:

```cpp
void on_tick() {
    auto now = clock.now_for_judge();
    while (auto* n = scheduler.peek_pending()) {
        if (now - n->target_ms <= windows.good_ms) break;     // まだ判定窓内
        n->judged = Judgment::Miss;
        stats.bump(Judgment::Miss);
        combo.break_();
        scheduler.pop_pending();
    }
}
```

## 6. パラメータ (lexicon と同期)

[`timing-judge.toml`](../game-lexicon/features/rhythm/timing-judge.toml) と:

| TOML key | C++ field | デフォルト | チューニング目安 |
|----------|-----------|-----------|-----------------|
| `perfect_ms` | `Windows::perfect_ms` | 25 | カジュアル: 30-40、 ハード: 15-25 |
| `great_ms` | `Windows::great_ms` | 60 | カジュアル: 80-100、 ハード: 50-70 |
| `good_ms` | `Windows::good_ms` | 120 | カジュアル: 150、 ハード: 100 |

> **不変**: `perfect_ms <= great_ms <= good_ms` を loader / プリプロセスで検証する (実行時には再検査しない設計)。

## 7. テスト

`tests/timing_judge/test_timing_judge.cpp` で 5 件:

- `ExactPerfect`
- `BoundaryInclusive`
- `NegativeDeltaSymmetric`
- `NameLookup`
- `BreaksCombo`

## 8. 拡張点 (将来)

- **オフセット補正** をモジュール内に持たせる (`Windows + offset_ms`) — 現状はホスト側で `now + offset` を計算して渡す
- **早 / 遅区別の判定** (`Judgment::PerfectLate` 等の細分化)
- **判定窓のカーブ** (PERFECT が極端に小さく、 GREAT が広い 「変則型」) — 現状は階段関数のみ

## 9. 既知の制限

- 早 / 遅の符号は judge では失われる (絶対値比較)。 必要なら呼び出し側で `delta` を別途保持
- 判定窓は単一固定。 BPM / 譜面難度で動的変更したい場合は呼び出し側で `Windows` を切替
- ms 整数のみ。 サブミリ精度が要る場合は別モジュール (現状は不要)
