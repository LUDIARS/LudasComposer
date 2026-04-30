# BattleState 設計

## 概要

戦闘 1 回ぶんのステートを保持し、 ATB / Turn の駆動と命令受付を担う。

## 配置

- `crates/game-jrpg/src/battle/state.rs`

## 公開 API

```rust
pub struct BattleState {
    pub party:   Vec<CombatantId>,
    pub enemies: Vec<CombatantId>,
    pub combat:  HashMap<CombatantId, Combatant>,
    pub atb:     HashMap<CombatantId, u16>,    // 0..1000
    pub turn_queue: VecDeque<CombatantId>,
    pub log: Vec<BattleEvent>,
    pub rng: SeededRng,
    pub phase: BattlePhase,
}

pub enum BattlePhase {
    Intro,
    Selecting { actor: CombatantId },
    Resolving { command: Command, actor: CombatantId },
    Outro    { result: BattleResult },
}

impl BattleState {
    pub fn tick(&mut self, dt_ms: u32);
    pub fn submit_command(&mut self, by: CombatantId, cmd: Command) -> Result<()>;
    pub fn snapshot(&self) -> BattleSnapshot;     // セーブ / 中断用
}
```

## tick で何が起きるか

```text
tick(dt_ms):
  1. 死亡 / 全滅チェック → BattlePhase::Outro 遷移
  2. ATB 増加 (各 combatant の speed に比例)
  3. 1000 到達 combatant を turn_queue に push
  4. phase == Intro / Outro 中は ATB 停止
  5. phase == Selecting で submit_command を待つ (UI 入力)
```

## 依存

- `ergo_health` — Combatant の HP
- (新規想定) `ergo_stats` — `effective_stats` 計算

## テスト

- ATB 加算が speed 通り
- 1000 で turn_queue 追加、 同 combatant の重複追加なし
- 状態異常 (Stop) で ATB 停止
- 全滅チェック (party / enemies どちらかが全員 HP 0) で Outro
