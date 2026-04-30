# PlayState 設計

## 概要

1 曲ぶんのプレイ状態。 audio clock + 譜面 + 入力を結びつけて判定 / コンボ / スコアを駆動する。

## 配置

- `crates/game-rhythm-core/src/play.rs`

## 公開 API

```rust
pub struct PlayState {
    pub clock:       AudioClock,
    pub scheduler:   NoteScheduler,
    pub windows:     ergo_timing_judge::Windows,
    pub combo:       ergo_combo_counter::ComboCounter,
    pub score:       ergo_score::Score,
    pub combo_break_threshold: ergo_timing_judge::Judgment,  // どこからコンボ切るか
    pub stats:       PlayStats,        // 各判定の出現数
}

pub struct PlayStats {
    pub perfect: u32,
    pub great: u32,
    pub good: u32,
    pub miss: u32,
    pub max_combo: u32,
}

impl PlayState {
    pub fn on_input(&mut self, lane: u8);
    pub fn tick(&mut self, dt_ms: u32);     // ノート見逃し検出
    pub fn finalize(&self) -> Result;
}

pub struct Result {
    pub stats: PlayStats,
    pub score: i64,
    pub max_combo: u32,
    pub rank:  Rank,
    pub fc: bool,
    pub ap: bool,
}
```

## tick で何が起きるか

```text
tick(dt_ms):
  1. clock.advance(dt_ms)
  2. scheduler.head_judge を進める
       期限を過ぎた未判定ノート = MISS 確定
  3. ヘッダの未判定ノートで now > target + good_ms を超えたら
       judgment = MISS、 combo.break_(), stats.miss++
```

## on_input

```text
on_input(lane):
  now = clock.now_for_judge()
  candidates = scheduler.judge_window(now, good_ms, lane)
  target = candidates.iter().min_by_key(|n| (n.target - now).abs())
  if target.is_none(): return  // 空打ち = 何もしない (ペナなし設計)
  judgment = ergo_timing_judge::judge(target.target, now, &windows)
  stats.bump(judgment)
  if breaks_combo(judgment, combo_break_threshold):
      combo.break_()
  else:
      combo.hit()
  score.add(point_for(judgment), combo.count())
  target.judged = Some(judgment)
```

## 依存

- `ergo_timing_judge` (judge / breaks_combo / Windows)
- `ergo_combo_counter`
- `ergo_score`
- `ergo_audio` (audio clock 経由)

## テスト

- judge_window 内 ヒット → 期待 judgment
- 1 曲分の入力ログを再生 → 期待 score / rank / fc
- 入力なしで tick → ノートが MISS として処理される
- 同 lane で 2 連続 hit → コンボ +2、 適切なスコア
- audio offset 変更で時刻が補正される
