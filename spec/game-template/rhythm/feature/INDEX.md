# rhythm / feature — 機能リスト

| Feature ID | 必須/任意 | UX 寄与 |
|------------|---------|---------|
| `note-chart` | 必須 | 譜面そのもの = ゲームコンテンツの正体。 質が直結 |
| `chart-loader` | 必須 | 既存フォーマット (osu/bms) からの取込で **コンテンツ量** 確保 |
| `audio-engine` | 必須 | 低遅延再生がないと **タイミング判定が破綻** |
| `audio-sync` | 必須 | ユーザー環境ごとのオフセット補正 — 「いつ叩いても合わない」 を防ぐ |
| `input-buffer` | 必須 | 「押した瞬間」 を確実に拾う |
| `input-lowlatency` | 必須 | 16ms 未満の入力遅延 — これが UX の天井 |
| `timing-judge` | 必須 | PERFECT/GREAT/GOOD/MISS の判定が **ジャンルそのもの** |
| `combo-counter` | 必須 | 連続成功の **興奮の積み上げ** |
| `score-system` | 必須 | スコア + ランク (S/A/B/...) がプレイ動機 |
| `lane-system` | 必須 | 入力チャネル (4 / 5 / 7 etc) がゲームの形を決める |
| `note-types` | 必須 | Tap / Hold / Slide / Flick で **譜面の表現幅** |
| `note-renderer` | 必須 | 高精度描画 — ジッタが体感品質を破壊する |
| `bpm-changes` | 必須 | 譜面途中の BPM 変化で **音楽との一体感** |
| `result-screen` | 必須 | 終曲時のスコア / 判定数 / グラフ — 達成と振り返り |
| `song-database` | 必須 | 曲の管理 + メタ + 検索 — UX の入口 |
| `song-select-ui` | 必須 | プレビュー再生 + 難易度選択 — 「曲を選ぶ楽しさ」 |
| `chart-editor` | 任意 | 内製 + コミュニティ譜面で **コンテンツ無限** |

## 詳細ページ

- [feature_list.md](feature_list.md)
