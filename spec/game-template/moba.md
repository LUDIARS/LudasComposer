# MOBA テンプレート

## 概要

5v5 アリーナ制対戦ゲーム。 代表作は **League of Legends**, **Dota 2**, **Smite**, **Mobile Legends**, **Wild Rift**。

コアループ:

> ピックバン → 5v5 で各々レーンに配置 → 経験値 / 金で成長 → タワー破壊 → ジャングル / オブジェクト争奪 → ベース陥落 → 勝敗

特徴:

- **対戦ネットコード** (低遅延, ロールバック / クライアント予測) が品質の半分
- **ヒーロー (チャンピオン)** ごとの **能動スキルセット** (Q/W/E/R) + **パッシブ**
- **ミニオンウェーブ** + **タワー** + **オブジェクト** (ドラゴン / バロン) の経済設計
- **アイテム** (300 種前後) の組合せ
- **試合 25-40 分**、 試合外メタは **ランクポイント** + **シーズン**

## 必要不可欠な機能実装

- `[hero-skill]` ヒーローごとの Q/W/E/R + パッシブ + ulti unlock level
- `[stat-system]` HP / MP / AD / AP / armor / MR / move speed / attack speed / ...
- `[leveling]` 経験値 → レベル up でスキル強化
- `[minion-wave]` 一定間隔のレーンウェーブ
- `[tower-objective]` タワー (range 攻撃) + ベース (Inhibitor)
- `[neutral-camp]` (新規) ジャングルキャンプ (リスポーンタイマー)
- `[item-shop]` (新規) ベース内 shop で購入 / 売却
- `[item-database]` (新規) アイテム + パッシブ + コンポーネント階層
- `[hitbox-system]` スキルショット / AOE / DOT
- `[rollback-netcode]` ロールバックネットコード (frame-perfect 同期)
- `[client-prediction]` (新規) 入力予測 + reconcile
- `[matchmaking]` (新規) MMR / Elo + キュー時間
- `[ban-pick]` (新規) 試合前のバンピックフェーズ
- `[chat-ping]` (新規) ボイス / テキスト / マップピン
- `[replay]` (新規) 入力ログから完全再現
- `[anti-cheat]` (新規) クライアント整合性検証

## コアドメイン設計

```mermaid
flowchart LR
  Match[Match] --> Map
  Match --> Teams[2 Teams x 5 Players]
  Teams --> Heroes
  Heroes --> StatBag[Stats (level + items)]
  Heroes --> Cooldowns
  Heroes -->|cast| Skill
  Skill --> SkillProjectile[Hitbox / AOE]
  SkillProjectile --> Damage --> Health
  Map --> MinionWaves
  MinionWaves --> Towers
  Map --> JungleCamps
  Map --> Objectives[Drake / Baron]
  Items[Item Shop] --> Heroes
  Damage --> Gold
  Gold --> Items
  XP --> LevelUp --> SkillUnlock
  MatchEnd --> MMR
```

**境界づけられたコンテキスト**:

| Context | 主な型 |
|---------|--------|
| Match | `Match`, `Team`, `Score`, `MatchClock`, `MatchPhase` |
| Hero | `HeroDef`, `HeroInstance`, `Stats`, `Cooldowns`, `Buffs` |
| Skill | `SkillDef`, `SkillCast`, `Hitbox`, `Effect` |
| Items | `Item`, `ItemTree`, `ShopInventory` |
| Map | `Lane`, `JungleCamp`, `Tower`, `Objective` |
| Minion | `MinionWave`, `MinionInstance`, `WaveSpawner` |
| Net | `RollbackEngine`, `Snapshot`, `Input`, `Reconcile` |
| Match Service | `Matchmaker`, `BanPick`, `Replay`, `Anticheat` |

## 対応するコード設計

決定論的シミュレーションが必須 (= ロールバック前提):

```rust
// crates/game-moba/src/sim.rs
//
// シミュレーションは整数 / 固定小数点で書く (浮動小数の機種依存をなくす)
pub struct Sim {
    pub tick: u32,                      // 30 tick/s が標準
    pub players: [Player; 10],
    pub minions: Vec<Minion>,
    pub projectiles: Vec<Projectile>,
    pub jungle: Vec<JungleCamp>,
    pub towers: Vec<Tower>,
    pub rng: DeterministicRng,
}

impl Sim {
    pub fn step(&mut self, inputs: &[InputFrame; 10]) {
        // 1. 入力 → ヒーロー命令
        for (i, p) in self.players.iter_mut().enumerate() {
            p.consume(inputs[i]);
        }
        // 2. スキル発動 / 移動 / 自動攻撃
        for p in &mut self.players { p.tick(); }
        // 3. プロジェクタイル / ヒットボックス
        Projectile::tick_all(self);
        // 4. ミニオン / ジャングル / タワー
        Minion::tick_all(self);
        Tower::tick_all(self);
        // 5. ステータス更新 / 戦闘解決
        // 6. tick++
        self.tick += 1;
    }
}

// crates/game-moba/src/net.rs
pub struct RollbackEngine {
    sim: Sim,
    history: VecDeque<Snapshot>,        // 最近 N=120 frames を保存
    confirmed: u32,                      // 全プレイヤー確定済 frame
}

impl RollbackEngine {
    pub fn on_remote_input(&mut self, peer: PeerId, frame: u32, input: Input) {
        let prediction_was_wrong = ...;
        if prediction_was_wrong {
            // confirmed まで巻き戻し → 既知入力で再 step → 現在 tick まで進める
            let snap = self.history.iter().find(|s| s.tick == frame).unwrap();
            self.sim = snap.restore();
            for f in frame..self.sim.tick {
                let inputs = self.collect_inputs(f);
                self.sim.step(&inputs);
            }
        }
    }
}
```

```text
crates/
  game-moba-sim/        # 決定論シミュレーション (整数演算)
  game-moba-net/        # ロールバック + 予測
  game-moba-data/       # ヒーロー / アイテム / ミニオン定義 (TOML)
  game-moba-server/     # マッチメイキング / アンチチート / リプレイ
  game-moba-client/     # 描画 + UI + チャット
```

依存:
- `ergo_health` `ergo_input` `ergo_log`
- ネットワーク基盤は **Synergos** や **WebRTC + データチャネル** を利用
- 描画とシミュレーションは厳密に分離 (シムは固定 tick 30Hz、 描画は 60+ Hz で補間)
