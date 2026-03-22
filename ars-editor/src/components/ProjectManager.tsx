import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useProjectStore } from '@/stores/projectStore';
import { useEditorStore } from '@/stores/editorStore';
import { useI18n } from '@/hooks/useI18n';
import { clearHistory } from '@/stores/historyMiddleware';
import * as authApi from '@/lib/auth-api';
import type { GitRepo } from '@/types/auth';

interface ProjectManagerProps {
  onClose: () => void;
}

type Tab = 'repos' | 'local' | 'new';

export function ProjectManager({ onClose }: ProjectManagerProps) {
  const { t } = useI18n();
  const user = useAuthStore((s) => s.user);
  const gitRepos = useAuthStore((s) => s.gitRepos);
  const gitReposLoading = useAuthStore((s) => s.gitReposLoading);
  const localGitProjects = useAuthStore((s) => s.localGitProjects);
  const fetchGitRepos = useAuthStore((s) => s.fetchGitRepos);
  const fetchLocalGitProjects = useAuthStore((s) => s.fetchLocalGitProjects);
  const setActiveGitRepo = useAuthStore((s) => s.setActiveGitRepo);
  const loadProject = useProjectStore((s) => s.loadProject);
  const project = useProjectStore((s) => s.project);
  const markSaved = useEditorStore((s) => s.markSaved);

  const [tab, setTab] = useState<Tab>('repos');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  // New repo form
  const [newRepoName, setNewRepoName] = useState('');
  const [newRepoDesc, setNewRepoDesc] = useState('');
  const [newRepoPrivate, setNewRepoPrivate] = useState(true);

  useEffect(() => {
    if (user) {
      fetchGitRepos();
      fetchLocalGitProjects();
    }
  }, [user, fetchGitRepos, fetchLocalGitProjects]);

  const showStatus = (msg: string) => {
    setStatus(msg);
    setTimeout(() => setStatus(''), 3000);
  };

  const handleClone = useCallback(async (repo: GitRepo) => {
    setLoading(true);
    showStatus(t('projectManager.toast.cloning', { name: repo.full_name }));
    try {
      const info = await authApi.cloneGitRepo(repo.clone_url, repo.full_name);
      showStatus(t('projectManager.toast.cloneComplete'));

      // Try to load project from the cloned repo
      const loadedProject = await authApi.loadGitProject(info.repo_full_name);
      if (loadedProject) {
        loadProject(loadedProject);
        clearHistory();
        setActiveGitRepo(info.repo_full_name);
        markSaved();
        showStatus(t('projectManager.toast.projectLoaded'));
      } else {
        setActiveGitRepo(info.repo_full_name);
        showStatus(t('projectManager.toast.clonedNoProject'));
      }
      fetchLocalGitProjects();
    } catch (e) {
      showStatus(t('projectManager.toast.cloneFailed', { error: e instanceof Error ? e.message : String(e) }));
    } finally {
      setLoading(false);
    }
  }, [loadProject, setActiveGitRepo, markSaved, fetchLocalGitProjects, t]);

  const handleLoadLocal = useCallback(async (repoFullName: string) => {
    setLoading(true);
    showStatus(t('projectManager.toast.loading'));
    try {
      const loadedProject = await authApi.loadGitProject(repoFullName);
      if (loadedProject) {
        loadProject(loadedProject);
        clearHistory();
        setActiveGitRepo(repoFullName);
        markSaved();
        showStatus(t('projectManager.toast.projectLoaded'));
      } else {
        showStatus(t('projectManager.toast.noProjectJson'));
      }
    } catch (e) {
      showStatus(t('projectManager.toast.loadFailed', { error: e instanceof Error ? e.message : String(e) }));
    } finally {
      setLoading(false);
    }
  }, [loadProject, setActiveGitRepo, markSaved, t]);

  const handlePush = useCallback(async (repoFullName: string) => {
    setLoading(true);
    showStatus(t('projectManager.toast.pushing'));
    try {
      await authApi.pushGitProject(repoFullName, project);
      markSaved();
      showStatus(t('projectManager.toast.pushSuccess'));
    } catch (e) {
      showStatus(t('projectManager.toast.pushFailed', { error: e instanceof Error ? e.message : String(e) }));
    } finally {
      setLoading(false);
    }
  }, [project, markSaved, t]);

  const handleCreateRepo = useCallback(async () => {
    if (!newRepoName.trim()) return;
    setLoading(true);
    showStatus(t('projectManager.toast.creating'));
    try {
      const repo = await authApi.createGitRepo(
        newRepoName.trim(),
        newRepoDesc.trim() || undefined,
        newRepoPrivate,
      );
      showStatus(t('projectManager.toast.repoCreated'));
      setNewRepoName('');
      setNewRepoDesc('');

      // Clone the new repo and save current project
      const info = await authApi.cloneGitRepo(repo.clone_url, repo.full_name);
      await authApi.pushGitProject(info.repo_full_name, project);
      setActiveGitRepo(info.repo_full_name);
      markSaved();
      showStatus(t('projectManager.toast.savedToRepo'));

      fetchGitRepos();
      fetchLocalGitProjects();
      setTab('local');
    } catch (e) {
      showStatus(t('projectManager.toast.failed', { error: e instanceof Error ? e.message : String(e) }));
    } finally {
      setLoading(false);
    }
  }, [newRepoName, newRepoDesc, newRepoPrivate, project, setActiveGitRepo, markSaved, fetchGitRepos, fetchLocalGitProjects, t]);

  if (!user) {
    return (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={onClose}>
        <div className="bg-zinc-800 rounded-lg shadow-xl p-6 max-w-sm" onClick={(e) => e.stopPropagation()}>
          <p className="text-zinc-300 mb-4">{t('app.auth.signInPrompt')}</p>
          <a
            href={authApi.getLoginUrl()}
            className="block w-full text-center px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded transition-colors"
          >
            {t('app.auth.signInGithub')}
          </a>
        </div>
      </div>
    );
  }

  const activeGitRepo = useAuthStore.getState().activeGitRepo;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-zinc-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700">
          <h2 className="text-sm font-semibold text-white">{t('projectManager.title')}</h2>
          <div className="flex items-center gap-2">
            {activeGitRepo && (
              <span className="text-xs text-zinc-400 truncate max-w-[200px]">
                {activeGitRepo}
              </span>
            )}
            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-white text-lg leading-none"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-700">
          {(['repos', 'local', 'new'] as Tab[]).map((tb) => (
            <button
              key={tb}
              onClick={() => setTab(tb)}
              className={`px-4 py-2 text-xs font-medium transition-colors ${
                tab === tb
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {tb === 'repos' ? t('projectManager.tabs.repos') : tb === 'local' ? t('projectManager.tabs.local') : t('projectManager.tabs.new')}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Status */}
          {status && (
            <div className="mb-3 px-3 py-2 bg-zinc-700/50 rounded text-xs text-zinc-300">
              {status}
            </div>
          )}

          {/* GitHub Repos tab */}
          {tab === 'repos' && (
            <div className="space-y-1">
              {gitReposLoading ? (
                <p className="text-zinc-500 text-sm">{t('projectManager.repos.loading')}</p>
              ) : gitRepos.length === 0 ? (
                <p className="text-zinc-500 text-sm">{t('projectManager.repos.noRepos')}</p>
              ) : (
                gitRepos.map((repo) => (
                  <div
                    key={repo.full_name}
                    className="flex items-center justify-between px-3 py-2 rounded hover:bg-zinc-700/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-zinc-200 truncate">{repo.full_name}</span>
                        {repo.private && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-zinc-600 rounded text-zinc-400">
                            {t('projectManager.repos.private')}
                          </span>
                        )}
                      </div>
                      {repo.description && (
                        <p className="text-xs text-zinc-500 truncate mt-0.5">{repo.description}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleClone(repo)}
                      disabled={loading}
                      className="ml-2 px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded transition-colors"
                    >
                      {t('projectManager.repos.clone')}
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Local Projects tab */}
          {tab === 'local' && (
            <div className="space-y-1">
              {localGitProjects.length === 0 ? (
                <p className="text-zinc-500 text-sm">{t('projectManager.local.noProjects')}</p>
              ) : (
                localGitProjects.map((proj) => (
                  <div
                    key={proj.repo_full_name}
                    className={`flex items-center justify-between px-3 py-2 rounded transition-colors ${
                      activeGitRepo === proj.repo_full_name
                        ? 'bg-blue-600/20 border border-blue-500/30'
                        : 'hover:bg-zinc-700/50'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-zinc-200 truncate">{proj.repo_full_name}</div>
                      <div className="text-xs text-zinc-500">
                        {proj.branch} {proj.has_project ? '' : t('projectManager.local.noProjectJson')}
                      </div>
                    </div>
                    <div className="flex gap-1.5 ml-2">
                      <button
                        onClick={() => handleLoadLocal(proj.repo_full_name)}
                        disabled={loading}
                        className="px-3 py-1 text-xs bg-zinc-600 hover:bg-zinc-500 disabled:opacity-50 text-white rounded transition-colors"
                      >
                        {t('projectManager.local.load')}
                      </button>
                      <button
                        onClick={() => handlePush(proj.repo_full_name)}
                        disabled={loading}
                        className="px-3 py-1 text-xs bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white rounded transition-colors"
                      >
                        {t('projectManager.local.push')}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* New Repository tab */}
          {tab === 'new' && (
            <div className="space-y-4 max-w-md">
              <p className="text-xs text-zinc-400">
                {t('projectManager.newRepo.description')}
              </p>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">{t('projectManager.newRepo.repoName')}</label>
                <input
                  type="text"
                  value={newRepoName}
                  onChange={(e) => setNewRepoName(e.target.value)}
                  placeholder={t('projectManager.newRepo.repoNamePlaceholder')}
                  className="w-full px-3 py-1.5 bg-zinc-700 border border-zinc-600 rounded text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">{t('projectManager.newRepo.repoDesc')}</label>
                <input
                  type="text"
                  value={newRepoDesc}
                  onChange={(e) => setNewRepoDesc(e.target.value)}
                  placeholder={t('projectManager.newRepo.repoDescPlaceholder')}
                  className="w-full px-3 py-1.5 bg-zinc-700 border border-zinc-600 rounded text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newRepoPrivate}
                  onChange={(e) => setNewRepoPrivate(e.target.checked)}
                  className="accent-blue-500"
                />
                {t('projectManager.newRepo.privateRepo')}
              </label>
              <button
                onClick={handleCreateRepo}
                disabled={loading || !newRepoName.trim()}
                className="px-4 py-2 text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded transition-colors"
              >
                {t('projectManager.newRepo.createSave')}
              </button>
            </div>
          )}
        </div>

        {/* Footer with push shortcut */}
        {activeGitRepo && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-zinc-700">
            <span className="text-xs text-zinc-500">
              {t('projectManager.footer.active')}<span className="text-zinc-300">{activeGitRepo}</span>
            </span>
            <button
              onClick={() => handlePush(activeGitRepo)}
              disabled={loading}
              className="px-3 py-1 text-xs bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white rounded transition-colors"
            >
              {t('projectManager.footer.pushCurrent')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
