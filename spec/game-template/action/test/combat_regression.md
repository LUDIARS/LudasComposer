# 戦闘ロジック回帰テスト

## 概要

戦闘数値・タイミング・状態遷移を **自動回帰** するテストセット。 数値調整 / リファクタリング後、 体感が壊れていないことを保証する。

## ユニットテスト (game-action-combat / -actor)

### `HitResolver`

- [x] 通常ヒット → `Damaged` outcome、 HP / posture が正しく減る
- [x] パリィ受付窓内 → `Parried`、 attacker.posture がパリィ punish ぶん蓄積
- [x] パリィ窓外で投げ → ガード不可、 ダメージ通常通り
- [x] 無敵中 → `Invincible`、 HP 不変
- [x] ブロック → `Blocked`、 削りダメージ最低 1
- [x] 同 frame で 2 attacker → 順次解決 (attacker_id 昇順)
- [x] スタガー中の追撃 → ダメージ 1.5x

### `PlayerActor` FSM

- [x] Idle → Light Attack → Attack(Light) frame 1
- [x] Attack(Light) cancel window で Heavy → Attack(Heavy)
- [x] Attack(Light) recovery 中 dodge → 入力無視 (recovery 終了後 Idle)
- [x] HP 0 → Dead、 以降の入力無効
- [x] Dodge i-frame 中 hit → 無敵処理 → Idle 復帰

### `Posture`

- [x] 1.0s 静止で +5
- [x] 攻撃中は regen 停止
- [x] 100% で stagger flag

## 統合テスト (game-action-app)

### シナリオ: ボス処刑可能まで

```text
1. プレイヤー Lv 25、 装備標準
2. ボス 「焔の剣士」 Phase 1
3. プレイヤーが (パリィ × 3 + 通常攻撃 × 5) を確実に当てる入力ログを再生
4. 期待: ボス HP 50% 切り Phase 2 移行
5. プレイヤー入力ログ続き (パリィ × 4 + 体幹崩し → 忍殺)
6. 期待: ボス HP 0、 撃破演出
7. テスト合格
```

実装は **入力ログのリプレイ** 形式。 sim を deterministic にするため `f32` は避けるか fixed-step。

### シナリオ: 篝火再開

- 篝火 A で休む → セーブ → ゲーム終了 → 起動 → ロード → プレイヤー位置と HP / 装備が保たれている

## バランステスト

時間ごとに **TTK (time to kill)** を計測:

```bash
$ cargo test -p game-action-app --release -- ttk
test ttk_phase1_avg_player ... ok (122s within 100-180s range)
test ttk_phase2_avg_player ... ok (158s within 120-200s range)
```

数値が範囲外になったらバランス調整必要。

## 手動チェックリスト

ビルド後に必ず実機で確認:

- [ ] ヒットストップが体感できる (< 80ms に縮めたとき確認)
- [ ] 死亡画面のテキストが読める
- [ ] BGM がフェーズ移行で切替わる
- [ ] カメラシェイクが酔わない強度
- [ ] パリィ成功時のスパーク VFX が見える
- [ ] 篝火に座ったとき HP / アイテム / 敵リポップ
- [ ] PlayStation / Xbox / 一般 PC キーボード のすべての入力がマッピング済

## 配信時用チェック

- [ ] ボス撃破演出が SNS 切り抜きで映える長さ (3-5s)
- [ ] 死亡画面に死因表示
- [ ] HUD 隠す機能 (clean recording)
