import type { GameArchetype, ModuleTemplate } from './types';

// --- Shared module fragments ---

const transformModule: ModuleTemplate = {
  name: 'Transform',
  category: 'System',
  domain: 'Core',
  variables: [
    { name: 'x', type: 'number', defaultValue: 0 },
    { name: 'y', type: 'number', defaultValue: 0 },
    { name: 'rotation', type: 'number', defaultValue: 0 },
    { name: 'scaleX', type: 'number', defaultValue: 1 },
    { name: 'scaleY', type: 'number', defaultValue: 1 },
  ],
  tasks: [{ name: 'onTransformChanged', description: 'Fired when position/rotation/scale changes', inputs: [], outputs: [] }],
};

const spriteModule: ModuleTemplate = {
  name: 'Sprite',
  category: 'UI',
  domain: 'Rendering',
  variables: [
    { name: 'src', type: 'string', defaultValue: '' },
    { name: 'width', type: 'number', defaultValue: 64 },
    { name: 'height', type: 'number', defaultValue: 64 },
    { name: 'visible', type: 'boolean', defaultValue: true },
  ],
  tasks: [{ name: 'onDraw', description: 'Render the sprite', inputs: [], outputs: [] }],
};

const inputHandlerModule: ModuleTemplate = {
  name: 'InputHandler',
  category: 'Logic',
  domain: 'Input',
  variables: [
    { name: 'enabled', type: 'boolean', defaultValue: true },
  ],
  tasks: [
    { name: 'onKeyDown', description: 'Key pressed', inputs: [{ name: 'key', type: 'string' }], outputs: [] },
    { name: 'onKeyUp', description: 'Key released', inputs: [{ name: 'key', type: 'string' }], outputs: [] },
  ],
};

const healthModule: ModuleTemplate = {
  name: 'Health',
  category: 'Logic',
  domain: 'Combat',
  variables: [
    { name: 'maxHp', type: 'number', defaultValue: 100 },
    { name: 'currentHp', type: 'number', defaultValue: 100 },
  ],
  tasks: [
    { name: 'takeDamage', description: 'Apply damage', inputs: [{ name: 'amount', type: 'number' }], outputs: [] },
    { name: 'heal', description: 'Restore health', inputs: [{ name: 'amount', type: 'number' }], outputs: [] },
    { name: 'onDeath', description: 'Fired when HP reaches 0', inputs: [], outputs: [] },
  ],
};

const timerModule: ModuleTemplate = {
  name: 'Timer',
  category: 'System',
  domain: 'Core',
  variables: [
    { name: 'duration', type: 'number', defaultValue: 0 },
    { name: 'elapsed', type: 'number', defaultValue: 0 },
    { name: 'running', type: 'boolean', defaultValue: false },
  ],
  tasks: [
    { name: 'start', description: 'Start the timer', inputs: [], outputs: [] },
    { name: 'stop', description: 'Stop the timer', inputs: [], outputs: [] },
    { name: 'onTimeout', description: 'Fired when timer completes', inputs: [], outputs: [] },
  ],
};

const scoreModule: ModuleTemplate = {
  name: 'ScoreManager',
  category: 'Logic',
  domain: 'Game',
  variables: [
    { name: 'score', type: 'number', defaultValue: 0 },
    { name: 'highScore', type: 'number', defaultValue: 0 },
  ],
  tasks: [
    { name: 'addScore', description: 'Add points', inputs: [{ name: 'points', type: 'number' }], outputs: [] },
    { name: 'resetScore', description: 'Reset to zero', inputs: [], outputs: [] },
  ],
};

// --- Archetype definitions ---

export const archetypes: GameArchetype[] = [
  {
    id: 'platformer',
    nameKey: 'archetypeWizard.archetypes.platformer.name',
    descKey: 'archetypeWizard.archetypes.platformer.desc',
    icon: '🏃',
    color: 'bg-green-600',
    searchKeyword: '2D platformer game design',
    coreModules: [transformModule, spriteModule, inputHandlerModule],
    designPatterns: [
      {
        id: 'physics-movement',
        nameKey: 'archetypeWizard.designs.physicsMovement.name',
        descKey: 'archetypeWizard.designs.physicsMovement.desc',
        recommended: true,
        modules: [
          {
            name: 'Physics2D',
            category: 'System',
            domain: 'Physics',
            variables: [
              { name: 'gravity', type: 'number', defaultValue: 9.8 },
              { name: 'mass', type: 'number', defaultValue: 1 },
              { name: 'friction', type: 'number', defaultValue: 0.2 },
            ],
            tasks: [
              { name: 'applyForce', description: 'Apply a force vector', inputs: [{ name: 'x', type: 'number' }, { name: 'y', type: 'number' }], outputs: [] },
              { name: 'onCollision', description: 'Collision detected', inputs: [{ name: 'other', type: 'string' }], outputs: [] },
            ],
          },
          {
            name: 'PlatformController',
            category: 'Logic',
            domain: 'Movement',
            variables: [
              { name: 'moveSpeed', type: 'number', defaultValue: 200 },
              { name: 'jumpForce', type: 'number', defaultValue: 400 },
              { name: 'isGrounded', type: 'boolean', defaultValue: false },
            ],
            tasks: [
              { name: 'move', description: 'Move horizontally', inputs: [{ name: 'direction', type: 'number' }], outputs: [] },
              { name: 'jump', description: 'Perform a jump', inputs: [], outputs: [] },
            ],
          },
        ],
      },
      {
        id: 'collectibles',
        nameKey: 'archetypeWizard.designs.collectibles.name',
        descKey: 'archetypeWizard.designs.collectibles.desc',
        recommended: false,
        modules: [
          {
            name: 'Collectible',
            category: 'Logic',
            domain: 'Item',
            variables: [
              { name: 'value', type: 'number', defaultValue: 1 },
              { name: 'collected', type: 'boolean', defaultValue: false },
            ],
            tasks: [{ name: 'onCollect', description: 'Collected by player', inputs: [], outputs: [] }],
          },
          scoreModule,
        ],
      },
      {
        id: 'level-progression',
        nameKey: 'archetypeWizard.designs.levelProgression.name',
        descKey: 'archetypeWizard.designs.levelProgression.desc',
        recommended: false,
        modules: [
          {
            name: 'LevelManager',
            category: 'System',
            domain: 'Game',
            variables: [
              { name: 'currentLevel', type: 'number', defaultValue: 1 },
              { name: 'totalLevels', type: 'number', defaultValue: 10 },
            ],
            tasks: [
              { name: 'loadLevel', description: 'Load a level', inputs: [{ name: 'levelId', type: 'number' }], outputs: [] },
              { name: 'nextLevel', description: 'Advance to next level', inputs: [], outputs: [] },
              { name: 'onLevelComplete', description: 'Level completed', inputs: [], outputs: [] },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'rpg',
    nameKey: 'archetypeWizard.archetypes.rpg.name',
    descKey: 'archetypeWizard.archetypes.rpg.desc',
    icon: '⚔️',
    color: 'bg-red-600',
    searchKeyword: 'RPG game design patterns',
    coreModules: [transformModule, spriteModule, inputHandlerModule, healthModule],
    designPatterns: [
      {
        id: 'turn-based-combat',
        nameKey: 'archetypeWizard.designs.turnBasedCombat.name',
        descKey: 'archetypeWizard.designs.turnBasedCombat.desc',
        recommended: true,
        modules: [
          {
            name: 'BattleSystem',
            category: 'Logic',
            domain: 'Combat',
            variables: [
              { name: 'currentTurn', type: 'number', defaultValue: 0 },
              { name: 'isPlayerTurn', type: 'boolean', defaultValue: true },
            ],
            tasks: [
              { name: 'startBattle', description: 'Initialize battle', inputs: [], outputs: [] },
              { name: 'executeTurn', description: 'Execute current turn', inputs: [], outputs: [] },
              { name: 'onBattleEnd', description: 'Battle concluded', inputs: [{ name: 'won', type: 'boolean' }], outputs: [] },
            ],
          },
          {
            name: 'CharacterStats',
            category: 'Logic',
            domain: 'RPG',
            variables: [
              { name: 'level', type: 'number', defaultValue: 1 },
              { name: 'exp', type: 'number', defaultValue: 0 },
              { name: 'attack', type: 'number', defaultValue: 10 },
              { name: 'defense', type: 'number', defaultValue: 5 },
              { name: 'speed', type: 'number', defaultValue: 5 },
            ],
            tasks: [
              { name: 'gainExp', description: 'Add experience points', inputs: [{ name: 'amount', type: 'number' }], outputs: [] },
              { name: 'onLevelUp', description: 'Fired on level up', inputs: [], outputs: [] },
            ],
          },
        ],
      },
      {
        id: 'inventory-system',
        nameKey: 'archetypeWizard.designs.inventorySystem.name',
        descKey: 'archetypeWizard.designs.inventorySystem.desc',
        recommended: true,
        modules: [
          {
            name: 'Inventory',
            category: 'Logic',
            domain: 'Item',
            variables: [
              { name: 'maxSlots', type: 'number', defaultValue: 20 },
              { name: 'itemCount', type: 'number', defaultValue: 0 },
            ],
            tasks: [
              { name: 'addItem', description: 'Add item to inventory', inputs: [{ name: 'itemId', type: 'string' }], outputs: [{ name: 'success', type: 'boolean' }] },
              { name: 'removeItem', description: 'Remove item', inputs: [{ name: 'itemId', type: 'string' }], outputs: [] },
              { name: 'useItem', description: 'Use an item', inputs: [{ name: 'itemId', type: 'string' }], outputs: [] },
            ],
          },
        ],
      },
      {
        id: 'quest-system',
        nameKey: 'archetypeWizard.designs.questSystem.name',
        descKey: 'archetypeWizard.designs.questSystem.desc',
        recommended: false,
        modules: [
          {
            name: 'QuestTracker',
            category: 'Logic',
            domain: 'Quest',
            variables: [
              { name: 'activeQuests', type: 'number', defaultValue: 0 },
            ],
            tasks: [
              { name: 'acceptQuest', description: 'Accept a quest', inputs: [{ name: 'questId', type: 'string' }], outputs: [] },
              { name: 'completeQuest', description: 'Complete a quest', inputs: [{ name: 'questId', type: 'string' }], outputs: [] },
              { name: 'onQuestComplete', description: 'Quest completed event', inputs: [], outputs: [] },
            ],
          },
        ],
      },
      {
        id: 'dialog-system',
        nameKey: 'archetypeWizard.designs.dialogSystem.name',
        descKey: 'archetypeWizard.designs.dialogSystem.desc',
        recommended: false,
        modules: [
          {
            name: 'DialogManager',
            category: 'UI',
            domain: 'Dialog',
            variables: [
              { name: 'isActive', type: 'boolean', defaultValue: false },
              { name: 'currentLine', type: 'number', defaultValue: 0 },
            ],
            tasks: [
              { name: 'startDialog', description: 'Start a dialog sequence', inputs: [{ name: 'dialogId', type: 'string' }], outputs: [] },
              { name: 'advanceLine', description: 'Show next line', inputs: [], outputs: [] },
              { name: 'onDialogEnd', description: 'Dialog sequence ended', inputs: [], outputs: [] },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'visual-novel',
    nameKey: 'archetypeWizard.archetypes.visualNovel.name',
    descKey: 'archetypeWizard.archetypes.visualNovel.desc',
    icon: '📖',
    color: 'bg-pink-600',
    searchKeyword: 'visual novel game engine design',
    coreModules: [transformModule, spriteModule],
    designPatterns: [
      {
        id: 'branching-narrative',
        nameKey: 'archetypeWizard.designs.branchingNarrative.name',
        descKey: 'archetypeWizard.designs.branchingNarrative.desc',
        recommended: true,
        modules: [
          {
            name: 'ScriptEngine',
            category: 'Logic',
            domain: 'Script',
            variables: [
              { name: 'currentScene', type: 'string', defaultValue: '' },
              { name: 'currentLine', type: 'number', defaultValue: 0 },
            ],
            tasks: [
              { name: 'loadScript', description: 'Load a script file', inputs: [{ name: 'scriptId', type: 'string' }], outputs: [] },
              { name: 'advance', description: 'Advance to next line', inputs: [], outputs: [] },
              { name: 'jumpTo', description: 'Jump to a label', inputs: [{ name: 'label', type: 'string' }], outputs: [] },
            ],
          },
          {
            name: 'ChoiceSystem',
            category: 'UI',
            domain: 'Dialog',
            variables: [
              { name: 'choiceCount', type: 'number', defaultValue: 0 },
            ],
            tasks: [
              { name: 'showChoices', description: 'Display choice buttons', inputs: [], outputs: [] },
              { name: 'onChoiceSelected', description: 'Player made a choice', inputs: [{ name: 'index', type: 'number' }], outputs: [] },
            ],
          },
        ],
      },
      {
        id: 'character-portraits',
        nameKey: 'archetypeWizard.designs.characterPortraits.name',
        descKey: 'archetypeWizard.designs.characterPortraits.desc',
        recommended: true,
        modules: [
          {
            name: 'CharacterDisplay',
            category: 'UI',
            domain: 'Display',
            variables: [
              { name: 'position', type: 'string', defaultValue: 'center' },
              { name: 'expression', type: 'string', defaultValue: 'normal' },
              { name: 'visible', type: 'boolean', defaultValue: true },
            ],
            tasks: [
              { name: 'show', description: 'Show character', inputs: [{ name: 'characterId', type: 'string' }], outputs: [] },
              { name: 'hide', description: 'Hide character', inputs: [], outputs: [] },
              { name: 'setExpression', description: 'Change expression', inputs: [{ name: 'expr', type: 'string' }], outputs: [] },
            ],
          },
          {
            name: 'TextBox',
            category: 'UI',
            domain: 'Dialog',
            variables: [
              { name: 'speakerName', type: 'string', defaultValue: '' },
              { name: 'text', type: 'string', defaultValue: '' },
              { name: 'typeSpeed', type: 'number', defaultValue: 30 },
            ],
            tasks: [
              { name: 'displayText', description: 'Show text with typewriter effect', inputs: [{ name: 'text', type: 'string' }], outputs: [] },
              { name: 'onTextComplete', description: 'Text fully displayed', inputs: [], outputs: [] },
            ],
          },
        ],
      },
      {
        id: 'save-load',
        nameKey: 'archetypeWizard.designs.saveLoad.name',
        descKey: 'archetypeWizard.designs.saveLoad.desc',
        recommended: false,
        modules: [
          {
            name: 'SaveManager',
            category: 'System',
            domain: 'Persistence',
            variables: [
              { name: 'slotCount', type: 'number', defaultValue: 10 },
              { name: 'autoSave', type: 'boolean', defaultValue: true },
            ],
            tasks: [
              { name: 'save', description: 'Save game state', inputs: [{ name: 'slot', type: 'number' }], outputs: [] },
              { name: 'load', description: 'Load game state', inputs: [{ name: 'slot', type: 'number' }], outputs: [] },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'puzzle',
    nameKey: 'archetypeWizard.archetypes.puzzle.name',
    descKey: 'archetypeWizard.archetypes.puzzle.desc',
    icon: '🧩',
    color: 'bg-yellow-600',
    searchKeyword: 'puzzle game design mechanics',
    coreModules: [transformModule, spriteModule, inputHandlerModule, scoreModule, timerModule],
    designPatterns: [
      {
        id: 'grid-based',
        nameKey: 'archetypeWizard.designs.gridBased.name',
        descKey: 'archetypeWizard.designs.gridBased.desc',
        recommended: true,
        modules: [
          {
            name: 'Grid',
            category: 'System',
            domain: 'Board',
            variables: [
              { name: 'rows', type: 'number', defaultValue: 8 },
              { name: 'cols', type: 'number', defaultValue: 8 },
              { name: 'cellSize', type: 'number', defaultValue: 64 },
            ],
            tasks: [
              { name: 'getCell', description: 'Get value at position', inputs: [{ name: 'row', type: 'number' }, { name: 'col', type: 'number' }], outputs: [{ name: 'value', type: 'string' }] },
              { name: 'setCell', description: 'Set value at position', inputs: [{ name: 'row', type: 'number' }, { name: 'col', type: 'number' }, { name: 'value', type: 'string' }], outputs: [] },
              { name: 'onGridChanged', description: 'Grid state changed', inputs: [], outputs: [] },
            ],
          },
          {
            name: 'MatchDetector',
            category: 'Logic',
            domain: 'Puzzle',
            variables: [
              { name: 'minMatch', type: 'number', defaultValue: 3 },
            ],
            tasks: [
              { name: 'checkMatches', description: 'Scan for matches', inputs: [], outputs: [] },
              { name: 'onMatchFound', description: 'Match detected', inputs: [{ name: 'count', type: 'number' }], outputs: [] },
            ],
          },
        ],
      },
      {
        id: 'physics-puzzle',
        nameKey: 'archetypeWizard.designs.physicsPuzzle.name',
        descKey: 'archetypeWizard.designs.physicsPuzzle.desc',
        recommended: false,
        modules: [
          {
            name: 'Physics2D',
            category: 'System',
            domain: 'Physics',
            variables: [
              { name: 'gravity', type: 'number', defaultValue: 9.8 },
              { name: 'mass', type: 'number', defaultValue: 1 },
            ],
            tasks: [
              { name: 'applyForce', description: 'Apply force', inputs: [{ name: 'x', type: 'number' }, { name: 'y', type: 'number' }], outputs: [] },
              { name: 'onCollision', description: 'Collision detected', inputs: [{ name: 'other', type: 'string' }], outputs: [] },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'card-game',
    nameKey: 'archetypeWizard.archetypes.cardGame.name',
    descKey: 'archetypeWizard.archetypes.cardGame.desc',
    icon: '🃏',
    color: 'bg-indigo-600',
    searchKeyword: 'card game design mechanics',
    coreModules: [transformModule, spriteModule, inputHandlerModule],
    designPatterns: [
      {
        id: 'deck-building',
        nameKey: 'archetypeWizard.designs.deckBuilding.name',
        descKey: 'archetypeWizard.designs.deckBuilding.desc',
        recommended: true,
        modules: [
          {
            name: 'DeckManager',
            category: 'Logic',
            domain: 'Card',
            variables: [
              { name: 'deckSize', type: 'number', defaultValue: 0 },
              { name: 'discardSize', type: 'number', defaultValue: 0 },
            ],
            tasks: [
              { name: 'shuffle', description: 'Shuffle the deck', inputs: [], outputs: [] },
              { name: 'draw', description: 'Draw cards', inputs: [{ name: 'count', type: 'number' }], outputs: [] },
              { name: 'discard', description: 'Discard a card', inputs: [{ name: 'cardId', type: 'string' }], outputs: [] },
            ],
          },
          {
            name: 'HandDisplay',
            category: 'UI',
            domain: 'Card',
            variables: [
              { name: 'maxHandSize', type: 'number', defaultValue: 7 },
              { name: 'currentSize', type: 'number', defaultValue: 0 },
            ],
            tasks: [
              { name: 'addCard', description: 'Add card to hand', inputs: [{ name: 'cardId', type: 'string' }], outputs: [] },
              { name: 'removeCard', description: 'Remove card from hand', inputs: [{ name: 'cardId', type: 'string' }], outputs: [] },
              { name: 'onCardPlayed', description: 'Card played from hand', inputs: [{ name: 'cardId', type: 'string' }], outputs: [] },
            ],
          },
        ],
      },
      {
        id: 'turn-management',
        nameKey: 'archetypeWizard.designs.turnManagement.name',
        descKey: 'archetypeWizard.designs.turnManagement.desc',
        recommended: true,
        modules: [
          {
            name: 'TurnManager',
            category: 'Logic',
            domain: 'Game',
            variables: [
              { name: 'currentPlayer', type: 'number', defaultValue: 0 },
              { name: 'playerCount', type: 'number', defaultValue: 2 },
              { name: 'turnNumber', type: 'number', defaultValue: 1 },
            ],
            tasks: [
              { name: 'endTurn', description: 'End current turn', inputs: [], outputs: [] },
              { name: 'onTurnStart', description: 'New turn started', inputs: [{ name: 'player', type: 'number' }], outputs: [] },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'action',
    nameKey: 'archetypeWizard.archetypes.action.name',
    descKey: 'archetypeWizard.archetypes.action.desc',
    icon: '💥',
    color: 'bg-orange-600',
    searchKeyword: 'action game design top-down',
    coreModules: [transformModule, spriteModule, inputHandlerModule, healthModule],
    designPatterns: [
      {
        id: 'weapon-system',
        nameKey: 'archetypeWizard.designs.weaponSystem.name',
        descKey: 'archetypeWizard.designs.weaponSystem.desc',
        recommended: true,
        modules: [
          {
            name: 'WeaponSystem',
            category: 'Logic',
            domain: 'Combat',
            variables: [
              { name: 'damage', type: 'number', defaultValue: 10 },
              { name: 'fireRate', type: 'number', defaultValue: 0.5 },
              { name: 'range', type: 'number', defaultValue: 300 },
            ],
            tasks: [
              { name: 'fire', description: 'Fire weapon', inputs: [], outputs: [] },
              { name: 'reload', description: 'Reload weapon', inputs: [], outputs: [] },
              { name: 'onHit', description: 'Weapon hit target', inputs: [{ name: 'targetId', type: 'string' }], outputs: [] },
            ],
          },
        ],
      },
      {
        id: 'enemy-ai',
        nameKey: 'archetypeWizard.designs.enemyAi.name',
        descKey: 'archetypeWizard.designs.enemyAi.desc',
        recommended: true,
        modules: [
          {
            name: 'EnemyAI',
            category: 'Logic',
            domain: 'AI',
            variables: [
              { name: 'state', type: 'string', defaultValue: 'idle' },
              { name: 'aggroRange', type: 'number', defaultValue: 200 },
              { name: 'attackRange', type: 'number', defaultValue: 50 },
            ],
            tasks: [
              { name: 'onUpdate', description: 'AI tick', inputs: [{ name: 'dt', type: 'number' }], outputs: [] },
              { name: 'onPlayerDetected', description: 'Player entered aggro range', inputs: [], outputs: [] },
            ],
          },
        ],
      },
      {
        id: 'wave-spawner',
        nameKey: 'archetypeWizard.designs.waveSpawner.name',
        descKey: 'archetypeWizard.designs.waveSpawner.desc',
        recommended: false,
        modules: [
          {
            name: 'WaveSpawner',
            category: 'System',
            domain: 'Game',
            variables: [
              { name: 'currentWave', type: 'number', defaultValue: 0 },
              { name: 'enemiesPerWave', type: 'number', defaultValue: 5 },
              { name: 'waveInterval', type: 'number', defaultValue: 10 },
            ],
            tasks: [
              { name: 'startWave', description: 'Start next wave', inputs: [], outputs: [] },
              { name: 'onWaveComplete', description: 'All enemies defeated', inputs: [], outputs: [] },
            ],
          },
          scoreModule,
        ],
      },
    ],
  },
  {
    id: 'simulation',
    nameKey: 'archetypeWizard.archetypes.simulation.name',
    descKey: 'archetypeWizard.archetypes.simulation.desc',
    icon: '🏗️',
    color: 'bg-teal-600',
    searchKeyword: 'simulation management game design',
    coreModules: [transformModule, spriteModule, inputHandlerModule, timerModule],
    designPatterns: [
      {
        id: 'resource-management',
        nameKey: 'archetypeWizard.designs.resourceManagement.name',
        descKey: 'archetypeWizard.designs.resourceManagement.desc',
        recommended: true,
        modules: [
          {
            name: 'ResourceManager',
            category: 'Logic',
            domain: 'Economy',
            variables: [
              { name: 'gold', type: 'number', defaultValue: 100 },
              { name: 'wood', type: 'number', defaultValue: 0 },
              { name: 'stone', type: 'number', defaultValue: 0 },
            ],
            tasks: [
              { name: 'addResource', description: 'Add resources', inputs: [{ name: 'type', type: 'string' }, { name: 'amount', type: 'number' }], outputs: [] },
              { name: 'spendResource', description: 'Spend resources', inputs: [{ name: 'type', type: 'string' }, { name: 'amount', type: 'number' }], outputs: [{ name: 'success', type: 'boolean' }] },
              { name: 'onResourceChanged', description: 'Resource amount changed', inputs: [], outputs: [] },
            ],
          },
        ],
      },
      {
        id: 'building-system',
        nameKey: 'archetypeWizard.designs.buildingSystem.name',
        descKey: 'archetypeWizard.designs.buildingSystem.desc',
        recommended: true,
        modules: [
          {
            name: 'BuildingSystem',
            category: 'Logic',
            domain: 'Construction',
            variables: [
              { name: 'buildMode', type: 'boolean', defaultValue: false },
            ],
            tasks: [
              { name: 'placeBuilding', description: 'Place a building', inputs: [{ name: 'typeId', type: 'string' }, { name: 'x', type: 'number' }, { name: 'y', type: 'number' }], outputs: [{ name: 'success', type: 'boolean' }] },
              { name: 'removeBuilding', description: 'Remove a building', inputs: [{ name: 'buildingId', type: 'string' }], outputs: [] },
              { name: 'onBuildingPlaced', description: 'Building placed', inputs: [], outputs: [] },
            ],
          },
        ],
      },
    ],
  },
];
