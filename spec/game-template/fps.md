# FPS テンプレート

## 概要

一人称視点シューター。 代表作は **Counter-Strike**, **Apex Legends**, **Call of Duty**, **Valorant**, **Halo**, **DOOM Eternal**。

コアループ:

> マッチ開始 → ラウンド開始 → 配置 / 索敵 → 交戦 (撃ち合い) → キル / デス → 次ラウンドへ → ベストオブ N → マッチ結果

特徴:

- **エイム** が中心スキル。 一発の遅延 (latency) と命中精度がプレイ感を決める
- **対戦ネットコード** は MOBA 同等 (むしろよりシビア — 1ms ラグで撃ち負ける)
- **マップデザイン** が試合の半分。 ライン / ローテーション / 視認性 / オーディオキュー
- **武器バランス** + **マスターチェック** (ヘッドショット倍率 / ダメージ減衰 / リコイルパターン)
- **アンチチート** が事業継続の前提
- 1 ラウンド 30 秒-2 分、 1 マッチ 15-40 分

## 必要不可欠な機能実装

- `[fps-controller]` (新規) 一人称カメラ + WASD + ジャンプ + クラウチ + スプリント
- `[mouse-aim]` (新規) raw input + sensitivity + invert + DPI 補正
- `[weapon-system]` 発射 + リロード + 切替 + クールダウン
- `[recoil]` 発射ごとの照準跳ね + 自動戻り + パターン
- `[hitscan]` (新規) 即着弾射撃 (光線で当たり判定)
- `[projectile-system]` ロケット / グレネード / 弾道計算 (gravity / drag)
- `[hitbox-system]` 部位別 (ヘッド / 胴 / 手足) ダメージ倍率
- `[health-system]` HP + アーマー + 回復遅延
- `[round-system]` ラウンド勝敗 + 時間 + 経済 (CS 系)
- `[map-loading]` (新規) 大規模マップロード + ナビメッシュ
- `[sound-occlusion]` (新規) 足音 / 銃声の壁 / 距離減衰 (FPS では情報源として超重要)
- `[footstep-system]` (新規) 移動速度別の足音
- `[killcam-replay]` (新規) 死亡視点リプレイ (1-3 秒前から)
- `[scoreboard]` (新規) リアルタイム K/D/A
- `[chat-voice]` (新規) チーム / 全体 / VC
- `[matchmaking]` (新規) MMR + ロビー
- `[anti-cheat]` (新規) クライアント完全性 + 統計検出
- `[server-authoritative]` (新規) サーバ権威モデル (チート抑止)
- `[lag-compensation]` (新規) shoot 時の被弾者位置を時間補正
- `[loadout]` (新規 / 任意) 武器カスタム + 携行武器選択
- `[ranking]` (新規) シーズン制 + ランクポイント

## コアドメイン設計

```mermaid
flowchart LR
  Match --> Map
  Match --> Teams
  Teams --> Players
  Players --> Loadout
  Players --> Position
  Players -->|input| Aim & Move & Shoot
  Shoot -->|hitscan or projectile| HitResolve
  HitResolve -->|server side + lag comp| Damage
  Damage --> HP
  HP -->|0| Death --> Killfeed & Killcam
  Round --> RoundTimer
  RoundTimer --> RoundEnd
  RoundEnd --> EconomyUpdate (CS)
  RoundEnd --> NextRound
  Match --> ServerTick[Server Tick (64-128Hz)]
  ServerTick --> ClientPrediction
  ServerTick --> Snapshot --> ClientInterp
```

**境界づけられたコンテキスト**:

| Context | 主な型 |
|---------|--------|
| Match | `Match`, `Team`, `Round`, `Score`, `Phase` |
| Player | `Player`, `Loadout`, `Health`, `Armor`, `EconomicState` |
| Weapon | `WeaponDef`, `WeaponInstance`, `Magazine`, `RecoilPattern` |
| World | `Map`, `Spawn`, `BombSite`, `NavMesh`, `Physics` |
| Net | `ServerTick`, `Snapshot`, `Prediction`, `LagComp`, `Reconcile` |
| Audio | `Footstep`, `WeaponSFX`, `Occlusion`, `SpatialMixer` |
| Service | `Matchmaker`, `Anticheat`, `Scoreboard`, `KillCam` |

## 対応するコード設計

サーバ権威 + クライアント予測 + ラグ補正が三本柱:

```rust
// crates/game-fps-server/src/tick.rs
//
// サーバが 64-128Hz で動く。 全プレイヤーの input は時刻スタンプ付きで届く。
// shoot を判定する時は、 撃った側の input frame の "敵の位置" まで遡る (lag comp)。
pub struct ServerTick {
    pub tick: u64,
    pub state: WorldState,
    pub history: VecDeque<WorldState>,    // 最近 N=64 tick (= 0.5-1 秒) 保持
}

pub fn process_input(server: &mut ServerTick, peer: PeerId, frame: InputFrame) {
    let player = server.state.player_mut(peer);
    player.apply_movement(frame.move_input);
    if frame.shoot {
        let shoot_tick = frame.tick;                            // クライアントが撃った時刻
        let snap = server.history.iter().find(|s| s.tick == shoot_tick).unwrap_or(&server.state);
        let result = lag_compensated_hitscan(snap, peer, frame.aim);
        match result {
            HitResult::Hit { target, part, distance } => {
                let dmg = damage_for(player.weapon, part, distance);
                server.state.player_mut(target).health -= dmg;
                server.broadcast(Event::Hit { by: peer, target, part, dmg });
            }
            HitResult::Miss => {}
        }
    }
}

// crates/game-fps-client/src/predict.rs
//
// クライアント側はサーバ確定までの間、 自分の入力を「予測」 して動かしておく。
// サーバ確定値が違っていたら、 reconcile (差分修正) する。
pub struct Predictor {
    pub last_confirmed_tick: u64,
    pub local_state_history: VecDeque<LocalSnapshot>,
}

impl Predictor {
    pub fn on_server_snapshot(&mut self, snap: ServerSnapshot, local_inputs: &[InputFrame]) {
        if let Some(local) = self.local_state_history.iter().find(|s| s.tick == snap.tick) {
            if local.matches(snap) { return; }       // 一致 → 予測当たり
        }
        // 不一致 → 確定スナップを起点に未確認入力を再シミュレートして現在へ
        let mut state = snap.into_local();
        for f in local_inputs.iter().filter(|f| f.tick > snap.tick) {
            state.tick(f);
        }
        self.local_state_history.replace_to(state);
    }
}

// crates/game-fps-core/src/recoil.rs
pub struct RecoilPattern {
    pub vertical:    Vec<f32>,    // 0..N: 各発の垂直キック (deg)
    pub horizontal:  Vec<f32>,    // 横ぶれ
    pub recovery_per_sec: f32,    // 自動戻り
}

impl RecoilPattern {
    pub fn apply(&self, shot_index: usize, dt_since_last: f32, current: &mut Vec2) {
        let v = self.vertical.get(shot_index).copied().unwrap_or(*self.vertical.last().unwrap());
        let h = self.horizontal.get(shot_index).copied().unwrap_or(0.0);
        current.y += v;
        current.x += h;
        // (recovery は別途毎フレーム適用)
    }
}
```

```text
crates/
  game-fps-core/      WorldState + Player + Weapon + Recoil
  game-fps-server/    ServerTick + LagComp + Anticheat
  game-fps-client/    Prediction + Reconcile + Render hook
  game-fps-net/       Snapshot + Delta + Compress
  game-fps-audio/     Spatial + Occlusion + Footstep
  game-fps-data/      Weapon / Map / Loadout (TOML)
  game-fps-match/     Matchmaking + Lobby + Loadout select
  game-fps-replay/    KillCam + Match replay
  game-fps-ui/        HUD + ScoreBoard + ChatVoice
```

依存:
- `ergo_health`
- ネットワーク基盤は WebRTC / UDP + 独自プロトコル (Synergos 流用も可)
- audio は WASAPI / OpenAL / Steam Audio などプラットフォーム依存
- アンチチート + サーバ権威 + ラグ補正 がそろわないと商用にならない
