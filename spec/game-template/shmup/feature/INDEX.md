# shmup / feature

| Feature ID | 必須/任意 | UX 寄与 |
|------------|---------|---------|
| `player-ship` | 必須 | 自機制御 (固定速 + 集中モード) |
| `bullet-pattern` | 必須 | 弾幕パターン = **ジャンルの正体** |
| `bullet-pool` | 必須 | 数千弾を 60 fps で動かす土台 |
| `hitbox-system` | 必須 | 自機極小 hitbox + 弾 hitbox |
| `graze-system` | 推奨 | グレイズ = ニアミス報酬 |
| `enemy-pattern` | 必須 | 敵の出現パターン (時刻 + 経路) |
| `scrolling-stage` | 必須 | 強制スクロール |
| `powerup-system` | 必須 | 武器階位 + サブ武器 |
| `bomb-system` | 必須 | 残機 + ボム消費の画面クリア |
| `score-system` | 必須 | 撃破 + チェイン + グレイズ |
| `life-extend` | 推奨 | スコアごとの残機追加 |
| `boss-fight` | 必須 | 多段フェーズ + 専用パターン |
| `continue-system` | 必須 | クレジット制 |
| `seed-replay` | 推奨 | RNG 固定 → リプレイ |
| `health-system` | 必須 | 残機 / 自機 HP |
