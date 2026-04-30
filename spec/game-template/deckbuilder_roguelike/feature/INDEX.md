# deckbuilder_roguelike / feature

| Feature ID | 必須/任意 | UX 寄与 |
|------------|---------|---------|
| `card-pile` | 必須 | Deck/Hand/Discard/Exhaust の **シャッフル + 引き** が体験の根本 |
| `draw-shuffle` | 必須 | 引きの**運要素** + 引き直しの戦略 |
| `energy` | 必須 | ターン頭にリセット = **ターン内の選択数制限** |
| `card-effect` | 必須 | カード効果の **多様な組合せ** |
| `targeting` | 必須 | self / enemy / random / pick |
| `turn-cycle` | 必須 | Player/Enemy 交互 |
| `enemy-intent` | 必須 | 「次に何をするか予告」 = **完全情報的駆け引き** |
| `block-armor` | 必須 | ターン消費する防御値 |
| `status-power` | 必須 | Vulnerable/Weak/Strength で**ビルド軸** |
| `relic` | 必須 | 永続パッシブで **ラン特性** が定まる |
| `node-map` | 必須 | DAG 形式で **道選びの戦略** |
| `reward` | 必須 | 戦闘後のカード選択で **デッキが育つ** 実感 |
| `shop` / `campfire` | 必須 | 選択肢の幅 |
| `card-database` | 必須 | カード定義 (TOML 駆動) |
| `seeded-rng` | 必須 | リプレイ / コミュニティ研究 |
| `meta-progression` | 必須 | 死亡からのアンロック (新カード / クラス) |
