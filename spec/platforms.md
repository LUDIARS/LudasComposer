# バックエンドプラットフォーム定義

プロジェクト全体設定でバックエンドプラットフォームを選択する。
ErgoモジュールとPictorモジュールは、選択されたプラットフォームに応じた言語・規約でコード生成される。

## 対応プラットフォーム

### ars-native (デフォルト)

Ars独自ランタイム。TypeScript JIT / WASMベースで動作する。

- **言語**: TypeScript
- **ファイル拡張子**: `.ts`
- **Ergoモジュール形式**: TypeScriptモジュール (ポートベースメッセージパッシング)
- **Pictor連携**: Pictor SoA Rendering Pipeline (WebGL / WASM)
- **ビルドターゲット**: WebGL, PC (Tauri)
- **ビルド方式**: TypeScript JIT, WASM Bundle

### unity

Unity Engine (URP / HDRP) をバックエンドとして使用する。

- **言語**: C#
- **ファイル拡張子**: `.cs`
- **Ergoモジュール形式**: MonoBehaviour / ScriptableObject
- **Pictor連携**: Unity URP/HDRP Rendering Pipeline
- **メッセージパッシング**: UnityEvent / C# event / Delegate
- **依存解決**: [RequireComponent] / DI (Zenject / VContainer)
- **namespace**: `Ars.Ergo.{Domain}`

### unreal

Unreal Engine (Nanite / Lumen) をバックエンドとして使用する。

- **言語**: C++
- **ファイル拡張子**: `.cpp` / `.h`
- **Ergoモジュール形式**: UActorComponent / UObject
- **Pictor連携**: Unreal Nanite/Lumen Rendering Pipeline
- **メッセージパッシング**: Delegate / Event Dispatcher
- **変数公開**: UPROPERTY(EditAnywhere) / UFUNCTION(BlueprintCallable)
- **モジュール配置**: `ArsErgo{Domain}` モジュール

### godot

Godot Engine (Vulkan) をバックエンドとして使用する。

- **言語**: GDScript
- **ファイル拡張子**: `.gd`
- **Ergoモジュール形式**: Node / Resource
- **Pictor連携**: Godot Vulkan Rendering Pipeline
- **メッセージパッシング**: signal / call_group()
- **変数公開**: @export アノテーション
- **クラス名**: `Ergo{ComponentName}`

## プラットフォーム選択の影響範囲

| 機能 | 影響 |
|------|------|
| コード生成 (ars-codegen) | 生成言語・規約・ファイル構成が切り替わる |
| Ergoモジュール | メッセージパッシング実装方式が変わる |
| Pictor連携 | レンダリングAPI・パイプライン指示が変わる |
| コアアセンブリ | プラットフォーム対応ライブラリが変わる |
| ビルドターゲット | プラットフォーム固有のビルドフローになる |

## 設定方法

プロジェクトの `assembly.config.json` の `backend_platform` フィールドで設定する:

```json
{
  "backend_platform": {
    "platform": "unity",
    "platform_options": {
      "unity_project_path": "/path/to/unity/project",
      "render_pipeline": "urp"
    }
  }
}
```
