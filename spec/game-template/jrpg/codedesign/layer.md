# jrpg — レイヤ設計

```
┌─────────────────────────────────────────┐
│ Layer 4: Host (game-jrpg-app)           │
│   章ごとのスクリプト + 演出             │
├─────────────────────────────────────────┤
│ Layer 3: Battle / Field / Script        │
│   game-jrpg-battle / -field / -script   │
├─────────────────────────────────────────┤
│ Layer 2: Character / Item / Quest       │
│   game-jrpg-core (横断データ)            │
├─────────────────────────────────────────┤
│ Layer 1: Ergo modules                   │
│   ergo_health / ergo_io / ...           │
└─────────────────────────────────────────┘
```

## クレート分割

| クレート | 内容 |
|---------|------|
| `game-jrpg-core` | Character / Stats / Item / Equipment / Quest / Save Snapshot |
| `game-jrpg-battle` | BattleState / ATB / Command / Resolver / Skill |
| `game-jrpg-field` | Town / Dungeon / Encounter / WorldMap |
| `game-jrpg-script` | EventStep DSL + Director |
| `game-jrpg-dialogue` | Window + Choice + AutoText |
| `game-jrpg-ui` | BattleUI / FieldUI / MenuUI |
| `game-jrpg-app` | バイナリ + 章スクリプト + 演出 |

## キャラクター 1 体は誰のもの

`Character` は `game-jrpg-core` で定義される **共通エンティティ**。 戦闘中は `BattleState.combat[]` に「写し」 を持ち (戦闘終了で同期)、 フィールドでは `Party.members[]` に並ぶ。

> 「戦闘中の状態を field 側にも持つ」 のは難しいので、 戦闘開始時に snapshot → 終了時に diff を field の Character に書き戻す、 が安全。

## 同期 / 非同期境界

- 戦闘 → 確定的 (deterministic)。 RNG は seeded。 セーブ / リプレイ可能。
- フィールド → 緩い。 NPC スケジュールやランダム花など、 厳密な再現性は不要。
- スクリプト → 進行は同期、 演出 (パーティクル / VFX) は非同期 OK。

## EventScript DSL

Lua / Rhai or 独自 YAML が現実解。 例:

```yaml
# script/chapter01/intro.yaml
- show:    { speaker: "Hero",  line: "ここが村か..." }
- show:    { speaker: "Sage",  line: "よく来た。 待っていたよ。" }
- choose:
    options: ["話を聞く", "今は時間がない"]
- if: choice == 0
  then:
    - show: { speaker: "Sage", line: "古の魔法を伝えよう。" }
    - learn_skill: { actor: hero, skill: "fire_lv1" }
  else:
    - show: { speaker: "Sage", line: "そうか... また来るがよい。" }
- set_flag: { name: "met_sage", value: true }
```
