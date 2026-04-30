# platformer / feature

| Feature ID | 必須/任意 | UX 寄与 |
|------------|---------|---------|
| `player-controller-2d` | 必須 | 加速度 + 摩擦による「重み」 で気持ち良さ |
| `jump-physics` | 必須 | 可変高さジャンプ + coyote time + jump buffer で **ジャンプの自由度と寛容さ** |
| `tile-collision` | 必須 | 1 px 精度の sweep & slide で 「ハマらない」 安心感 |
| `stomp-detect` | 必須 | 「踏みつぶせる」 という少年期定番アクション |
| `respawn-system` | 必須 | 即時リスポーンの **「もう一度すぐ挑む」** ループ |
| `camera-2d-follow` | 必須 | デッドゾーン + look-ahead で先が見える |
| `parallax-bg` | 推奨 | 多層スクロールで世界の **奥行き** |
| `pickup-system` | 必須 | コイン / アイテム = **小さな報酬の積上げ** |
| `level-loader` | 必須 | ステージ単位の **明確な区切り** |
| `health-system` | 必須 | 残機 / ハートの **緊張感** |
| `hitbox-system` | 必須 | 接触判定 |
| `score-system` | 任意 | コイン枚数表示 = 進捗の見える化 |
