import { useState, useCallback } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useEditorStore } from '@/stores/editorStore';
import { useAuthStore } from '@/stores/authStore';
import { clearHistory } from '@/stores/historyMiddleware';
import * as authApi from '@/lib/auth-api';
import { generateId } from '@/lib/utils';
import type { Project, Actor, Scene, Component } from '@/types/domain';

interface ProjectWizardProps {
  onClose: () => void;
}

type Step = 'template' | 'name' | 'github';

interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  color: string;
  create: (projectName: string) => Project;
}

function createBlankProject(name: string): Project {
  return {
    name,
    scenes: {},
    components: {},
    prefabs: {},
    activeSceneId: null,
  };
}

function createSceneWithRoot(sceneName: string): Scene {
  const rootId = generateId();
  return {
    id: generateId(),
    name: sceneName,
    rootActorId: rootId,
    actors: {
      [rootId]: {
        id: rootId,
        name: 'Root',
        role: 'actor',
        components: [],
        children: [],
        position: { x: 250, y: 50 },
        parentId: null,
        sequences: [],
      },
    },
    connections: [],
    states: [],
    activeStateId: null,
  };
}

function createActor(name: string, role: Actor['role'], x: number, y: number, parentId?: string): Actor {
  return {
    id: generateId(),
    name,
    role,
    components: [],
    children: [],
    position: { x, y },
    parentId: parentId ?? null,
    sequences: [],
  };
}

function createComponent(name: string, category: Component['category'], domain: string): Component {
  return {
    id: generateId(),
    name,
    category,
    domain,
    variables: [],
    tasks: [],
    dependencies: [],
  };
}

const templates: ProjectTemplate[] = [
  {
    id: 'blank',
    name: 'Blank Project',
    description: 'Empty project. Start from scratch.',
    color: 'bg-zinc-600',
    create: createBlankProject,
  },
  {
    id: 'simple-scene',
    name: 'Single Scene',
    description: 'A project with one scene and a root actor ready to go.',
    color: 'bg-blue-600',
    create: (name) => {
      const scene = createSceneWithRoot('Main Scene');
      return {
        name,
        scenes: { [scene.id]: scene },
        components: {},
        prefabs: {},
        activeSceneId: scene.id,
      };
    },
  },
  {
    id: 'game-starter',
    name: 'Game Starter',
    description: 'Two scenes (Title / Game) with basic components for a simple game.',
    color: 'bg-green-600',
    create: (name) => {
      const titleScene = createSceneWithRoot('Title');
      const gameScene = createSceneWithRoot('Game');

      // Add a Player actor to the game scene
      const player = createActor('Player', 'actor', 400, 200, gameScene.rootActorId);
      gameScene.actors[player.id] = player;
      gameScene.actors[gameScene.rootActorId].children.push(player.id);

      // Basic components
      const transform = createComponent('Transform', 'System', 'Core');
      transform.variables = [
        { name: 'x', type: 'number', defaultValue: 0 },
        { name: 'y', type: 'number', defaultValue: 0 },
        { name: 'rotation', type: 'number', defaultValue: 0 },
      ];

      const sprite = createComponent('Sprite', 'UI', 'Rendering');
      sprite.variables = [
        { name: 'src', type: 'string', defaultValue: '' },
        { name: 'width', type: 'number', defaultValue: 64 },
        { name: 'height', type: 'number', defaultValue: 64 },
      ];

      const input = createComponent('InputHandler', 'Logic', 'Input');
      input.variables = [
        { name: 'enabled', type: 'boolean', defaultValue: true },
      ];

      player.components = [transform.id, sprite.id, input.id];

      const components: Record<string, Component> = {
        [transform.id]: transform,
        [sprite.id]: sprite,
        [input.id]: input,
      };

      return {
        name,
        scenes: {
          [titleScene.id]: titleScene,
          [gameScene.id]: gameScene,
        },
        components,
        prefabs: {},
        activeSceneId: titleScene.id,
      };
    },
  },
  {
    id: 'ui-app',
    name: 'UI App',
    description: 'A project with screen-based scenes and UI-oriented components.',
    color: 'bg-purple-600',
    create: (name) => {
      const homeScene = createSceneWithRoot('Home');
      const settingsScene = createSceneWithRoot('Settings');

      // UI components
      const button = createComponent('Button', 'UI', 'UI');
      button.variables = [
        { name: 'label', type: 'string', defaultValue: 'Click' },
        { name: 'disabled', type: 'boolean', defaultValue: false },
      ];
      button.tasks = [{ name: 'onClick', description: 'Fired when the button is pressed', inputs: [], outputs: [] }];

      const text = createComponent('Text', 'UI', 'UI');
      text.variables = [
        { name: 'content', type: 'string', defaultValue: '' },
        { name: 'fontSize', type: 'number', defaultValue: 16 },
      ];

      const layout = createComponent('Layout', 'UI', 'UI');
      layout.variables = [
        { name: 'direction', type: 'string', defaultValue: 'vertical' },
        { name: 'gap', type: 'number', defaultValue: 8 },
      ];

      // Add some actors to Home
      const header = createActor('Header', 'actor', 250, 150, homeScene.rootActorId);
      header.components = [text.id, layout.id];
      homeScene.actors[header.id] = header;
      homeScene.actors[homeScene.rootActorId].children.push(header.id);

      const components: Record<string, Component> = {
        [button.id]: button,
        [text.id]: text,
        [layout.id]: layout,
      };

      return {
        name,
        scenes: {
          [homeScene.id]: homeScene,
          [settingsScene.id]: settingsScene,
        },
        components,
        prefabs: {},
        activeSceneId: homeScene.id,
      };
    },
  },
];

export function ProjectWizard({ onClose }: ProjectWizardProps) {
  const loadProject = useProjectStore((s) => s.loadProject);
  const markSaved = useEditorStore((s) => s.markSaved);
  const setProjectPath = useEditorStore((s) => s.setProjectPath);
  const setActiveGitRepo = useAuthStore((s) => s.setActiveGitRepo);
  const fetchGitRepos = useAuthStore((s) => s.fetchGitRepos);
  const fetchLocalGitProjects = useAuthStore((s) => s.fetchLocalGitProjects);
  const user = useAuthStore((s) => s.user);

  const [step, setStep] = useState<Step>('template');
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate | null>(null);
  const [projectName, setProjectName] = useState('');
  const [createRepo, setCreateRepo] = useState(true);
  const [repoPrivate, setRepoPrivate] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSelectTemplate = useCallback((template: ProjectTemplate) => {
    setSelectedTemplate(template);
    setStep('name');
  }, []);

  const handleNameNext = useCallback(() => {
    if (!projectName.trim()) return;
    if (user) {
      setStep('github');
    } else {
      // No GitHub user — just create the project locally
      finishCreate(false);
    }
  }, [projectName, user]);

  const finishCreate = useCallback(async (withGitHub: boolean) => {
    if (!selectedTemplate || !projectName.trim()) return;

    setLoading(true);
    setError('');

    try {
      const project = selectedTemplate.create(projectName.trim());
      loadProject(project);
      clearHistory();
      setProjectPath(null);

      if (withGitHub && user) {
        const repoName = projectName.trim().replace(/\s+/g, '-').toLowerCase();
        const repo = await authApi.createGitRepo(repoName, `Ars project: ${projectName.trim()}`, repoPrivate);
        const info = await authApi.cloneGitRepo(repo.clone_url, repo.full_name);
        await authApi.pushGitProject(info.repo_full_name, project);
        setActiveGitRepo(info.repo_full_name);
        fetchGitRepos();
        fetchLocalGitProjects();
      }

      markSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [selectedTemplate, projectName, repoPrivate, user, loadProject, markSaved, setProjectPath, setActiveGitRepo, fetchGitRepos, fetchLocalGitProjects, onClose]);

  const handleBack = useCallback(() => {
    setError('');
    if (step === 'name') setStep('template');
    else if (step === 'github') setStep('name');
  }, [step]);

  const stepIndex = step === 'template' ? 0 : step === 'name' ? 1 : 2;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-zinc-800 rounded-lg shadow-xl w-full max-w-lg flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-700">
          <h2 className="text-sm font-semibold text-white">New Project</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 px-5 pt-4 pb-2">
          {['Template', 'Name', 'GitHub'].map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              {i > 0 && <div className={`w-6 h-px ${i <= stepIndex ? 'bg-blue-500' : 'bg-zinc-600'}`} />}
              <div className={`flex items-center gap-1.5 text-xs ${
                i === stepIndex ? 'text-blue-400 font-medium' :
                i < stepIndex ? 'text-zinc-400' : 'text-zinc-600'
              }`}>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  i < stepIndex ? 'bg-blue-600 text-white' :
                  i === stepIndex ? 'bg-blue-600/30 text-blue-400 ring-1 ring-blue-500' :
                  'bg-zinc-700 text-zinc-500'
                }`}>
                  {i < stepIndex ? '✓' : i + 1}
                </span>
                {label}
              </div>
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 px-5 py-4 min-h-[240px]">
          {/* Step 1: Template */}
          {step === 'template' && (
            <div className="space-y-2">
              <p className="text-xs text-zinc-400 mb-3">Choose a starting template for your project.</p>
              {templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleSelectTemplate(t)}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-colors hover:border-blue-500/50 hover:bg-zinc-700/50 ${
                    selectedTemplate?.id === t.id
                      ? 'border-blue-500 bg-zinc-700/50'
                      : 'border-zinc-700 bg-zinc-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${t.color}`} />
                    <div>
                      <div className="text-sm text-zinc-200 font-medium">{t.name}</div>
                      <div className="text-xs text-zinc-500 mt-0.5">{t.description}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Step 2: Project Name */}
          {step === 'name' && (
            <div className="space-y-4">
              <p className="text-xs text-zinc-400">
                Enter a name for your project.
                {selectedTemplate && (
                  <span className="text-zinc-500"> (Template: {selectedTemplate.name})</span>
                )}
              </p>
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Project Name</label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleNameNext(); }}
                  placeholder="My Awesome Project"
                  autoFocus
                  className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              {projectName.trim() && (
                <p className="text-xs text-zinc-500">
                  Repository name: <span className="text-zinc-400">{projectName.trim().replace(/\s+/g, '-').toLowerCase()}</span>
                </p>
              )}
            </div>
          )}

          {/* Step 3: GitHub */}
          {step === 'github' && (
            <div className="space-y-4">
              <p className="text-xs text-zinc-400">
                Create a GitHub repository to save your project?
              </p>

              <div className="space-y-2">
                <button
                  onClick={() => setCreateRepo(true)}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                    createRepo
                      ? 'border-blue-500 bg-blue-600/10'
                      : 'border-zinc-700 hover:border-zinc-600'
                  }`}
                >
                  <div className="text-sm text-zinc-200 font-medium">Create GitHub Repository</div>
                  <div className="text-xs text-zinc-500 mt-0.5">
                    Create a new repo and push the project automatically.
                  </div>
                </button>
                <button
                  onClick={() => setCreateRepo(false)}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                    !createRepo
                      ? 'border-blue-500 bg-blue-600/10'
                      : 'border-zinc-700 hover:border-zinc-600'
                  }`}
                >
                  <div className="text-sm text-zinc-200 font-medium">Skip</div>
                  <div className="text-xs text-zinc-500 mt-0.5">
                    Create the project locally without a GitHub repository.
                  </div>
                </button>
              </div>

              {createRepo && (
                <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={repoPrivate}
                    onChange={(e) => setRepoPrivate(e.target.checked)}
                    className="accent-blue-500"
                  />
                  Private repository
                </label>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-3 px-3 py-2 bg-red-900/30 border border-red-700/50 rounded text-xs text-red-400">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-700">
          <button
            onClick={step === 'template' ? onClose : handleBack}
            className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
            disabled={loading}
          >
            {step === 'template' ? 'Cancel' : 'Back'}
          </button>

          {step === 'name' && (
            <button
              onClick={handleNameNext}
              disabled={!projectName.trim() || loading}
              className="px-4 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded transition-colors"
            >
              Next
            </button>
          )}

          {step === 'github' && (
            <button
              onClick={() => finishCreate(createRepo)}
              disabled={loading}
              className="px-4 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded transition-colors"
            >
              {loading ? 'Creating...' : createRepo ? 'Create & Save' : 'Create Project'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
