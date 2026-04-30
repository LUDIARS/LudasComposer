# オープンワールド テンプレート

## 概要

シームレスな大規模 3D 世界を自由に探索する RPG / ARPG。 代表作は **The Legend of Zelda: Breath of the Wild / Tears of the Kingdom**, **The Elder Scrolls V: Skyrim**, **Witcher 3**, **Red Dead Redemption 2**, **Genshin Impact**, **Elden Ring**。

コアループ:

> 「気になるもの」 を見つける → 移動 → アクティビティ (敵 / 採集 / クエスト / シリーズ) → 報酬 → 別の 「気になるもの」 へ

特徴:

- **シームレスストリーミング**: 地形 / 敵 / 草木を **動的にロード / アンロード**
- **動的システム** (天候 / 時間帯 / NPC スケジュール / 物理) による創発
- **クエストとサンドボックス** の二層: メインクエスト + 道草が同等に楽しい設計
- **巨大なデータ管理** (アイテム数千、 NPC 数千、 セリフ数十万行)
- **クエスト変数 / フラグ管理** が複雑化しがち → 中央 KV ストア + イベント
- **セーブデータ** が巨大 (場合により MB 級)

## 必要不可欠な機能実装

- `[world-streaming]` プレイヤー位置に応じたタイル / アセット動的 load / unload
- `[day-night-cycle]` 時間 / 太陽位置 / ライティング
- `[fast-travel]` 発見済み地点へのテレポート
- `[mount-system]` 騎乗 / 乗り物 (馬 / グライダー / 船)
- `[quest-system]` メイン + サイド + ワールドイベント (条件発火型)
- `[dialogue-system]` 分岐 + ボイス + 顔 + 唇同期
- `[inventory]` + `[equipment-slots]` + `[stash]`
- `[stat-system]` HP / スタミナ / 攻防 + 状態
- `[combat-melee]` 近接 + 弓 / 魔法
- `[ai-schedule]` (新規) NPC の時間ごとの位置 / 行動 (Skyrim Radiant AI 系)
- `[weather-system]` (新規) 天候変化 + ゲームへの影響 (雷 / 雨 / 寒さ)
- `[stamina-system]` (新規) 走り / 滑空 / 登攀の制限
- `[climb-glide]` (新規 / 任意) BotW 由来の登攀 + パラセール
- `[poi-system]` (新規) Point of Interest のマーカ + 自動発見
- `[loot-table]` 戦闘 / 宝箱 / 採集
- `[crafting]` 料理 / 武器修理 / 鍛冶
- `[reputation]` (新規 / 任意) 派閥評判
- `[save-load]` 巨大 state の効率的シリアライズ + 圧縮
- `[autosave]` 区切り (ファストトラベル / 起床 / 主要イベント) の自動セーブ
- `[chunked-asset-pipeline]` (新規) 街 / 地域単位の asset bundle

## コアドメイン設計

```mermaid
flowchart LR
  WorldMap[World Map (大)] --> Tiles
  Tiles -->|near player| Streaming[Streaming Loader]
  Streaming --> ActiveScene
  ActiveScene --> NPCs
  ActiveScene --> Wildlife
  ActiveScene --> Vegetation
  Player --> Inventory & Equipment
  Player --> Stamina
  Player --> Quest[Active Quests]
  Quest --> Trigger[Conditional Triggers]
  Trigger -->|var change| Quest
  WorldClock --> DayNight & WeatherSystem
  WeatherSystem --> NPCs
  WeatherSystem --> ActiveScene
  PlayerAction --> EventBus
  EventBus --> Quest
  EventBus --> AI_Schedule
  Save --> SaveSlot
  Save -->|delta encode| OnDisk
```

**境界づけられたコンテキスト**:

| Context | 主な型 |
|---------|--------|
| World | `WorldMap`, `Region`, `Tile`, `StreamingLoader`, `Cell` |
| Player | `PlayerActor`, `Stats`, `Inventory`, `Equipment`, `Stamina`, `Reputation` |
| NPC | `NpcDef`, `NpcInstance`, `Schedule`, `Faction`, `MoodState` |
| World System | `WorldClock`, `DayNight`, `Weather`, `Season`, `Temperature` |
| Quest | `QuestDef`, `QuestState`, `Trigger`, `Flag`, `Tracker` |
| Combat | `MeleeResolver`, `RangedResolver`, `Status` |
| Service | `SaveSerializer`, `SaveCompressor`, `AssetBundle` |
| UI | `Map`, `Menu`, `Dialogue`, `HUD` |

## 対応するコード設計

巨大プロジェクトなので **データ駆動 + ECS 寄り** + **多モジュール分離** が現実解:

```rust
// crates/game-ow-streaming/src/lib.rs
pub struct StreamingLoader {
    pub tile_size_m: f32,           // 例: 256
    pub load_radius: i32,           // 例: 3 (= 9x9 タイル)
    pub loaded: HashMap<TileCoord, LoadedTile>,
    pub queued_load: VecDeque<TileCoord>,
    pub queued_unload: VecDeque<TileCoord>,
    pub asset_db: Arc<AssetDb>,
}

impl StreamingLoader {
    pub fn update(&mut self, player_pos: Vec3) {
        let center = self.tile_for(player_pos);
        let mut keep = HashSet::new();
        for dx in -self.load_radius..=self.load_radius {
            for dy in -self.load_radius..=self.load_radius {
                keep.insert(TileCoord(center.0 + dx, center.1 + dy));
            }
        }
        // 新規ロード
        for c in &keep {
            if !self.loaded.contains_key(c) { self.queued_load.push_back(*c); }
        }
        // アンロード
        let to_unload: Vec<_> = self.loaded.keys()
            .filter(|c| !keep.contains(c)).cloned().collect();
        for c in to_unload { self.queued_unload.push_back(c); }
    }
}

// crates/game-ow-quest/src/lib.rs
//
// クエストは「フラグ駆動」 + 「イベントバスをサブスクライブ」 で動かす。
// 直接ハードコード (== if statements all over) は破綻するため、 Trigger DSL に集約。
pub struct QuestDef {
    pub id: QuestId,
    pub steps: Vec<QuestStep>,
}

pub struct QuestStep {
    pub id: StepId,
    pub triggers: Vec<Trigger>,         // 条件 (Flag == X / KillCount >= N / EnterRegion)
    pub on_complete: Vec<Action>,        // 次ステップ進行 / フラグセット
}

impl QuestSystem {
    pub fn on_event(&mut self, ev: &WorldEvent, world: &mut World) {
        for q in self.active_quests() {
            for trigger in q.current_step().triggers {
                if trigger.matches(ev, world) {
                    self.advance(q.id);
                }
            }
        }
    }
}

// crates/game-ow-save/src/lib.rs
//
// 巨大セーブは「ベースライン + 差分」 (delta encoding) で書く。
// テクスチャ等は除外、 dynamic state (NPC 位置 / Quest フラグ / Inventory) のみ。
pub fn save_to(slot: SaveSlot, world: &World) -> Result<()> {
    let snap = world.snapshot();
    let bytes = postcard::to_allocvec(&snap)?;
    let zstd = zstd::stream::encode_all(&bytes[..], 3)?;
    fs::write(slot.path(), zstd)?;
    Ok(())
}
```

```text
crates/
  game-ow-streaming/   タイル / アセット動的ロード
  game-ow-world/       時刻 / 天候 / 季節
  game-ow-player/      Actor + Stats + Stamina + Movement
  game-ow-combat/      Melee + Ranged + Magic
  game-ow-npc/         NPC + Schedule + Faction
  game-ow-quest/       Quest + Trigger + Flag
  game-ow-dialogue/    Branch + Voice + Lipsync
  game-ow-inventory/   Item + Equipment + Stash
  game-ow-craft/       Recipe + Cooking + Smith
  game-ow-save/        Snapshot + Delta + Compress
  game-ow-asset/       AssetDb + Bundle + Cache
  game-ow-ui/          Map + HUD + Menu
```

依存:
- `ergo_health` (プレイヤー / ボス)
- 大量モブ HP は ECS で SoA
- アセットパイプライン + メモリプロファイリング無しでは破綻するので、 早期から計測ツール連携を作る (Pictor / 自作 profiler)
