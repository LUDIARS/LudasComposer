# レイテンシ + 判定回帰

## ユニット

- `ergo_timing_judge::judge`: 全境界値 (-good, -great, -perfect, 0, +perfect, +great, +good, +good+1) で期待 enum
- `NoteScheduler::judge_window`: 範囲外を除外、 範囲内を時刻順
- `PlayState::on_input`: lane 別、 PERFECT/GREAT/GOOD/MISS bump
- `audio offset` 反映で時刻が補正される

## 統合: 入力ログリプレイ

```text
1. テスト譜面 (NPS 4, 60s, 240 ノート) を準備
2. 「全 PERFECT」 入力ログを再生
3. 期待: stats = { perfect: 240, great/good/miss: 0 }, FC + AP, ランク S+
```

```text
4. 「半数 GREAT」 入力ログを再生
5. 期待: PERFECT 120 / GREAT 120, FC, ランク A or B (倍率次第)
```

## レイテンシ計測

ホスト計測:
- audio device の outputLatency 取得 → ログに残す
- 入力 → 判定の wall-clock を測定 (デバッグ build のみ)
- リリースビルドで input_latency_ms < 16 を assert

ジッタ計測:
- 1 秒ごとの dropped frames 数を記録、 1% 超で警告

## 手動

- [ ] キャリブレーション動作 (起動時オートキャリブ + 手動微調整)
- [ ] BPM 変化を含む譜面で判定が破綻しない
- [ ] フルコンボ達成演出
- [ ] 終曲後のリザルト画面で全数値正しい
- [ ] 4-7 レーン切替で UI が崩れない
