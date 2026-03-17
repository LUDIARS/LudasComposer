import type { Project, Scene, Actor, Component, Connection, CodegenTask } from './types.js';

/** Ergoモジュール定義カテゴリのマッピング */
const CATEGORY_MAP: Record<string, string> = {
  UI: 'UI',
  Logic: 'ロジック',
  System: 'システム',
  GameObject: 'ゲームオブジェクト',
};

/** Pictor連携が必要なドメイン判定 */
function isPictorDomain(domain: string): boolean {
  const pictorDomains = ['rendering', 'render', 'graphics', 'visual', 'material', 'shader', 'lighting', 'gi', 'shadow', 'mesh', 'texture'];
  return pictorDomains.some(d => domain.toLowerCase().includes(d));
}

/**
 * Arsプロジェクトのシーン/コンポーネント設計データから
 * Ergoモジュール定義フォーマット + Pictor連携を含むコード生成プロンプトを組み立てる
 */
export class PromptGenerator {
  private project: Project;

  constructor(project: Project) {
    this.project = project;
  }

  /** プロジェクト全体からコード生成タスク一覧を生成 */
  generateTasks(outputDir: string, options?: {
    sceneIds?: string[];
    componentIds?: string[];
  }): CodegenTask[] {
    const tasks: CodegenTask[] = [];

    // 1. コンポーネント単位のコード生成タスク
    const components = this.getTargetComponents(options?.componentIds);
    for (const component of components) {
      tasks.push({
        id: `comp-${component.id}`,
        type: 'component',
        name: component.name,
        prompt: this.buildComponentPrompt(component),
        dependencies: this.resolveComponentDeps(component, components),
        status: 'pending',
        outputDir: `${outputDir}/components/${this.toKebabCase(component.domain)}/${this.toKebabCase(component.name)}`,
      });
    }

    // 2. シーン単位のコード生成タスク（アクター構造 + 接続の配線コード）
    const scenes = this.getTargetScenes(options?.sceneIds);
    for (const scene of scenes) {
      const compDeps = this.getSceneComponentDeps(scene, components);
      tasks.push({
        id: `scene-${scene.id}`,
        type: 'scene',
        name: scene.name,
        prompt: this.buildScenePrompt(scene),
        dependencies: compDeps.map(c => `comp-${c.id}`),
        status: 'pending',
        outputDir: `${outputDir}/scenes/${this.toKebabCase(scene.name)}`,
      });
    }

    return tasks;
  }

  /** Ergoモジュール定義書テキストを構築 */
  private buildErgoModuleSpec(component: Component): string {
    const lines: string[] = [
      `# ${component.name} モジュール定義`,
      '',
      '## 概要',
      this.buildComponentSummary(component),
      '',
      '## カテゴリ',
      CATEGORY_MAP[component.category] ?? component.category,
      '',
      '## 所属ドメイン',
      component.domain,
    ];

    // 必要なデータ
    if (component.variables.length > 0) {
      lines.push('', '## 必要なデータ');
      for (const v of component.variables) {
        lines.push(`- ${v.name}の${v.type === 'number' ? '値' : 'データ'}`);
      }
    }

    // 変数
    if (component.variables.length > 0) {
      lines.push('', '## 変数');
      for (const v of component.variables) {
        const defaultStr = v.defaultValue !== undefined ? ` (初期値: ${JSON.stringify(v.defaultValue)})` : '';
        lines.push(`- ${v.name}${defaultStr}`);
      }
    }

    // 依存
    if (component.dependencies.length > 0) {
      lines.push('', '## 依存');
      for (const depId of component.dependencies) {
        const dep = this.project.components[depId];
        lines.push(`- ${dep ? dep.name : depId}`);
      }
    }

    // 作業 (入力・出力・タスク)
    lines.push('', '## 作業');
    const allInputs = component.tasks.flatMap(t => t.inputs);
    const allOutputs = component.tasks.flatMap(t => t.outputs);

    lines.push('### 入力');
    if (allInputs.length > 0) {
      for (const input of allInputs) {
        lines.push(`- ${input.name}: ${input.type}`);
      }
    } else {
      lines.push('なし');
    }

    lines.push('', '### 出力');
    if (allOutputs.length > 0) {
      for (const output of allOutputs) {
        lines.push(`- ${output.name}: ${output.type}`);
      }
    } else {
      lines.push('なし');
    }

    lines.push('', '### タスク');
    if (component.tasks.length > 0) {
      for (const task of component.tasks) {
        lines.push(`- ${task.name}: ${task.description}`);
      }
    } else {
      lines.push('なし');
    }

    // テストケース
    lines.push('', '## テスト');
    if (component.tasks.length > 0) {
      for (const task of component.tasks) {
        lines.push(`- ${task.name}が正常に実行されること`);
        if (task.inputs.length > 0) {
          lines.push(`- ${task.name}に不正な入力を渡した際にエラーハンドリングされること`);
        }
        if (task.outputs.length > 0) {
          lines.push(`- ${task.name}の出力が期待される型と値であること`);
        }
      }
    } else {
      lines.push('- モジュールが正常に初期化されること');
    }

    return lines.join('\n');
  }

  /** コンポーネントの概要文を自動生成 */
  private buildComponentSummary(component: Component): string {
    const taskNames = component.tasks.map(t => t.name).join('・');
    if (taskNames) {
      return `${component.domain}ドメインにおいて${taskNames}を行う${CATEGORY_MAP[component.category] ?? component.category}モジュール`;
    }
    return `${component.domain}ドメインの${CATEGORY_MAP[component.category] ?? component.category}モジュール`;
  }

  /** Pictor連携のためのRenderObject指示を構築 */
  private buildPictorIntegration(component: Component): string {
    const lines: string[] = [
      '',
      '## Pictor連携 (レンダリングパイプライン)',
      '',
      'このモジュールはPictorレンダリングパイプラインと連携する。以下の規約に従うこと。',
      '',
      '### ObjectDescriptor登録',
      '描画対象はObjectDescriptorを介してPictorのSceneRegistryに登録する:',
      '- transform: Transform行列 (64B, キャッシュライン整列)',
      '- bounds: AABB (min/max)',
      '- flags: 16bitフラグ (Static/Dynamic/GPU_Driven/Cast_Shadow/Receive_Shadow/Transparent/Two_Sided/Instanced)',
      '- shaderKey: シェーダー識別子',
      '- materialKey: マテリアル識別子',
      '- lodLevel: LODレベル',
      '',
      '### データレイアウト (SoA)',
      'Pictorはデータ指向設計(DOD)のStructure-of-Arraysを採用する:',
      '- Group A (Hot - Culling): bounds, visibility flags',
      '- Group B (Hot - Sorting): shader keys, sort keys, material keys',
      '- Group C (Hot - Transform): world transforms, previous frames',
      '- Group D (Cold - Metadata): mesh handles, LOD levels, flags',
      '',
      '### マテリアル',
      'BaseMaterialBuilderのfluent APIでPBRマテリアルを構築し、パス別バリアントを自動生成:',
      '- Shadow/Depth: alpha test + two-sided のみ',
      '- GI: albedo, emissive, alpha test, two-sided, vertex color',
      '- Opaque/Transparent: 全機能',
      '',
      '### プール分類',
      'ObjectClassifierがオブジェクトをプールに振り分ける:',
      '- Static: 静的ジオメトリ (BVH最適化)',
      '- Dynamic: 毎フレーム更新 (CPU並列 or Compute Shader)',
      '- GPU-Driven: GPU駆動パイプライン (Compute更新・カリング・LOD選択・描画コンパクション)',
    ];

    // ドメイン固有の追加指示
    const domainLower = component.domain.toLowerCase();
    if (domainLower.includes('lighting') || domainLower.includes('gi') || domainLower.includes('light')) {
      lines.push(
        '',
        '### GI連携',
        'GILightingSystemの事前パス結果 (Shadow → SSAO → GI Probes) をread-onlyテクスチャ/SSBOとして参照すること。',
        '静的ジオメトリにはGIBakeSystemによるオフラインベイク (static shadow maps, AO, Light Probe SH L2, lightmaps) を利用可能。',
      );
    }

    if (domainLower.includes('material') || domainLower.includes('shader')) {
      lines.push(
        '',
        '### マテリアルレジストリ',
        'MaterialRegistryのO(1)ルックアップでBuiltMaterialを取得する。',
        'パス固有バリアントは自動生成されるため、ベースマテリアル定義のみ行うこと。',
      );
    }

    return lines.join('\n');
  }

  /** コンポーネント用プロンプトを構築 */
  private buildComponentPrompt(component: Component): string {
    const needsPictor = isPictorDomain(component.domain);

    const lines: string[] = [
      `# コード生成指示: ${component.name} コンポーネント`,
      '',
      `以下のErgoモジュール定義に基づいて、Ergoモジュールとして実装コードを生成してください。`,
      '',
      '---',
      '',
      this.buildErgoModuleSpec(component),
      '',
      '---',
    ];

    // Pictor連携が必要な場合
    if (needsPictor) {
      lines.push(this.buildPictorIntegration(component));
    }

    // 生成ルール
    lines.push(
      '',
      '## 生成ルール',
      '',
      '### Ergoモジュール規約',
      '1. 上記のErgoモジュール定義書に厳密に従ったコードを生成すること',
      '2. モジュールは必ずダミープラグ（実装の無いスタブファイル）を同梱すること（コンパイル短縮用）',
      '3. 各タスクを独立した関数またはメソッドとして実装すること',
      '4. 入出力のポート定義に従った型安全なインターフェースを定義すること',
      '5. 変数は状態として管理し、適切なゲッター/セッターを用意すること',
      '6. 依存モジュールはErgoのライブラリ参照として解決すること',
      '7. アクターモデルのメッセージパッシングパターンに従うこと',
      '',
      '### テスト',
      '8. モジュール定義書のテストケースに対応するテストファイルを生成すること',
      '9. テストはモノリシック結合時の複合テスト条件として参照される前提で記述すること',
      '',
      '### ファイル構成',
      `10. モジュール実装: \`${this.toKebabCase(component.name)}.ts\``,
      `11. ダミープラグ: \`${this.toKebabCase(component.name)}.stub.ts\` (インターフェースのみ、実装なし)`,
      `12. テスト: \`${this.toKebabCase(component.name)}.test.ts\``,
      `13. モジュール定義書: \`spec.md\` (上記のErgoモジュール定義をそのまま格納)`,
    );

    if (needsPictor) {
      lines.push(
        '',
        '### Pictor統合',
        '14. RenderObjectの登録・更新・削除はObjectDescriptorを介してPictorのSceneRegistryに対して行うこと',
        '15. データレイアウトはSoA (Structure-of-Arrays) に従い、Hot/Coldのグループ分けを意識すること',
        '16. ISurfaceProviderを直接参照せず、Ergoのモジュール依存経由でレンダリング機能にアクセスすること',
      );
    }

    return lines.join('\n');
  }

  /** シーン用プロンプトを構築 */
  private buildScenePrompt(scene: Scene): string {
    const actors = Object.values(scene.actors);
    const rootActor = scene.actors[scene.rootActorId];

    // シーン内のPictor連携コンポーネントを検出
    const hasPictorComponents = actors.some(actor =>
      actor.components.some(compId => {
        const comp = this.project.components[compId];
        return comp && isPictorDomain(comp.domain);
      }),
    );

    const lines: string[] = [
      `# コード生成指示: ${scene.name} シーン`,
      '',
      `以下のArsシーン設計に基づいて、Ergoモジュールの結合・配線コードを生成してください。`,
      '',
      `## シーン情報`,
      `- 名前: ${scene.name}`,
      `- ルートアクター: ${rootActor?.name ?? scene.rootActorId}`,
      `- アクター数: ${actors.length}`,
      `- 接続数: ${scene.connections.length}`,
    ];

    // アクター構造
    lines.push('', '## アクター構造');
    const tree = this.buildActorTree(scene);
    lines.push(tree);

    // 各アクターの詳細 (Ergoモジュール参照付き)
    lines.push('', '## アクター詳細');
    for (const actor of actors) {
      lines.push(``, `### ${actor.name} [${actor.role}]`);
      if (actor.components.length > 0) {
        lines.push('Ergoモジュール:');
        for (const compId of actor.components) {
          const comp = this.project.components[compId];
          if (comp) {
            const pictorTag = isPictorDomain(comp.domain) ? ' [Pictor連携]' : '';
            lines.push(`  - ${comp.name} (${CATEGORY_MAP[comp.category] ?? comp.category}/${comp.domain})${pictorTag}`);
          }
        }
      }
      if (actor.children.length > 0) {
        lines.push('子アクター:');
        for (const childId of actor.children) {
          const child = scene.actors[childId];
          lines.push(`  - ${child ? child.name : childId}`);
        }
      }
    }

    // 接続
    if (scene.connections.length > 0) {
      lines.push('', '## 接続（メッセージフロー）');
      for (const conn of scene.connections) {
        const source = scene.actors[conn.sourceActorId];
        const target = scene.actors[conn.targetActorId];
        lines.push(
          `- ${source?.name ?? conn.sourceActorId}:${conn.sourcePort} → ${target?.name ?? conn.targetActorId}:${conn.targetPort}`,
        );
      }
    }

    // Pictor連携シーンの場合、レンダリングパイプライン指示を追加
    if (hasPictorComponents) {
      lines.push(
        '',
        '## Pictorレンダリングパイプライン結合',
        '',
        'このシーンにはPictor連携モジュールが含まれる。以下の順序でフレーム実行を配線すること:',
        '1. BeginFrame: GPU同期',
        '2. UpdateScheduler: プール別戦略で更新 (Static=スキップ, Dynamic=CPU並列, GPU-Driven=Compute)',
        '3. CullingSystem: Frustumカリング → オクルージョンカリング → Hi-Zカリング',
        '4. BatchBuilder: シェーダーキーでRadix Sort、RenderBatchを生成',
        '5. RenderPassScheduler: PipelineProfile (Forward/Forward+/Deferred/Hybrid) に基づくパス実行',
        '6. EndFrame: サブミット・プレゼント',
        '',
        'RenderObject登録はObjectDescriptorを介してSceneRegistryへ。各アクターのErgoモジュールが保持するデータを',
        'SoAストリームに展開し、Pictorの3層パイプライン (Front-End→Middle→Back-End) で処理する。',
      );
    }

    // 生成ルール
    lines.push(
      '',
      '## 生成ルール',
      '1. シーン初期化関数を作成すること',
      '2. 各アクターをインスタンス化し、Ergoモジュールを依存解決しつつアタッチするコードを生成すること',
      '3. Ergoモジュールのライブラリは依存関係を参照し、必要なものを取得・結合すること',
      '4. 接続定義に基づいて、アクター間のメッセージパッシング配線コードを生成すること',
      '5. アクターの親子関係（children）を反映すること',
      '6. sequence ロールのアクターはシーケンシャル実行をサポートすること',
    );

    return lines.join('\n');
  }

  /** アクターツリーをテキスト表現で構築 */
  private buildActorTree(scene: Scene): string {
    const rootActor = scene.actors[scene.rootActorId];
    if (!rootActor) return '(ルートアクターなし)';

    const lines: string[] = [];
    this.renderActorNode(scene, rootActor, lines, 0);
    return lines.join('\n');
  }

  private renderActorNode(scene: Scene, actor: Actor, lines: string[], depth: number): void {
    const indent = '  '.repeat(depth);
    const compCount = actor.components.length;
    lines.push(`${indent}├─ ${actor.name} [${actor.role}] (コンポーネント: ${compCount}個)`);
    for (const childId of actor.children) {
      const child = scene.actors[childId];
      if (child) {
        this.renderActorNode(scene, child, lines, depth + 1);
      }
    }
  }

  /** 対象コンポーネントを取得 */
  private getTargetComponents(componentIds?: string[]): Component[] {
    if (componentIds && componentIds.length > 0) {
      return componentIds
        .map(id => this.project.components[id])
        .filter((c): c is Component => c !== undefined);
    }
    return Object.values(this.project.components);
  }

  /** 対象シーンを取得 */
  private getTargetScenes(sceneIds?: string[]): Scene[] {
    if (sceneIds && sceneIds.length > 0) {
      return sceneIds
        .map(id => this.project.scenes[id])
        .filter((s): s is Scene => s !== undefined);
    }
    return Object.values(this.project.scenes);
  }

  /** コンポーネントの依存タスクIDを解決 */
  private resolveComponentDeps(component: Component, allComponents: Component[]): string[] {
    const depIds: string[] = [];
    for (const depId of component.dependencies) {
      if (allComponents.some(c => c.id === depId)) {
        depIds.push(`comp-${depId}`);
      }
    }
    return depIds;
  }

  /** シーンで使われるコンポーネントの依存を取得 */
  private getSceneComponentDeps(scene: Scene, allComponents: Component[]): Component[] {
    const usedCompIds = new Set<string>();
    for (const actor of Object.values(scene.actors)) {
      for (const compId of actor.components) {
        usedCompIds.add(compId);
      }
    }
    return allComponents.filter(c => usedCompIds.has(c.id));
  }

  private toKebabCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase();
  }
}
