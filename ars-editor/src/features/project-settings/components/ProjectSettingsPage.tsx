import { useCallback, useEffect, useState } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import { useAuthStore } from '@/stores/authStore';
import { useEditorStore } from '@/stores/editorStore';
import type { SaveMethod, GoogleDriveConfig, ResourceDepotConnection, ProjectMember } from '@/types/settings';

type SettingsTab = 'general' | 'members' | 'google-drive' | 'resource-depot';

const TABS: { key: SettingsTab; label: string }[] = [
  { key: 'general', label: 'General' },
  { key: 'members', label: 'Members' },
  { key: 'google-drive', label: 'Google Drive' },
  { key: 'resource-depot', label: 'Resource Depot' },
];

const SAVE_METHODS: { value: SaveMethod; label: string; description: string }[] = [
  { value: 'local', label: 'Local', description: 'Save to local filesystem' },
  { value: 'cloud', label: 'Cloud', description: 'Save to DynamoDB cloud storage' },
  { value: 'git', label: 'Git', description: 'Save to Git repository' },
];

const MEMBER_ROLES: ProjectMember['role'][] = ['owner', 'editor', 'viewer'];

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-zinc-800 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-zinc-200 mb-3">{title}</h3>
      {children}
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs text-zinc-400">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="mt-1 w-full bg-zinc-900 text-sm text-zinc-200 px-3 py-1.5 rounded border border-zinc-700 focus:outline-none focus:border-blue-500 disabled:opacity-50"
      />
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-8 h-4 rounded-full transition-colors ${
          checked ? 'bg-blue-500' : 'bg-zinc-600'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-4' : ''
          }`}
        />
      </button>
      <span className="text-xs text-zinc-300">{label}</span>
    </label>
  );
}

// ========== Tab Content Components ==========

function GeneralTab() {
  const saveMethod = useSettingsStore((s) => s.settings.saveMethod);
  const setSaveMethod = useSettingsStore((s) => s.setSaveMethod);
  const autoSaveEnabled = useEditorStore((s) => s.autoSaveEnabled);
  const setAutoSave = useEditorStore((s) => s.setAutoSave);

  return (
    <div className="space-y-4">
      <SectionCard title="Auto Save">
        <Toggle
          label="Enable auto save (2 seconds after changes)"
          checked={autoSaveEnabled}
          onChange={setAutoSave}
        />
        <p className="text-[10px] text-zinc-500 mt-1">
          When disabled, use Ctrl+S to save manually.
        </p>
      </SectionCard>

      <SectionCard title="Save Method">
        <div className="space-y-2">
          {SAVE_METHODS.map((m) => (
            <label
              key={m.value}
              className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer border transition-colors ${
                saveMethod === m.value
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-zinc-700 hover:border-zinc-600'
              }`}
            >
              <input
                type="radio"
                name="saveMethod"
                value={m.value}
                checked={saveMethod === m.value}
                onChange={() => setSaveMethod(m.value)}
                className="mt-0.5 accent-blue-500"
              />
              <div>
                <div className="text-sm font-medium text-zinc-200">{m.label}</div>
                <div className="text-xs text-zinc-400 mt-0.5">{m.description}</div>
              </div>
            </label>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function MembersTab() {
  const members = useSettingsStore((s) => s.settings.members);
  const addMember = useSettingsStore((s) => s.addMember);
  const removeMember = useSettingsStore((s) => s.removeMember);
  const setMembers = useSettingsStore((s) => s.setMembers);
  const [newLogin, setNewLogin] = useState('');

  const handleAddMember = useCallback(() => {
    if (!newLogin.trim()) return;
    const member: ProjectMember = {
      userId: crypto.randomUUID(),
      login: newLogin.trim(),
      displayName: newLogin.trim(),
      avatarUrl: '',
      role: 'editor',
    };
    addMember(member);
    setNewLogin('');
  }, [newLogin, addMember]);

  const handleRoleChange = useCallback(
    (userId: string, role: ProjectMember['role']) => {
      setMembers(members.map((m) => (m.userId === userId ? { ...m, role } : m)));
    },
    [members, setMembers],
  );

  return (
    <div className="space-y-4">
      <SectionCard title="Project Members">
        {/* Add member */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newLogin}
            onChange={(e) => setNewLogin(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddMember()}
            placeholder="GitHub username..."
            className="flex-1 bg-zinc-900 text-sm text-zinc-200 px-3 py-1.5 rounded border border-zinc-700 focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={handleAddMember}
            disabled={!newLogin.trim()}
            className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-500 transition-colors disabled:opacity-50"
          >
            Add
          </button>
        </div>

        {/* Member list */}
        {members.length === 0 ? (
          <div className="text-xs text-zinc-500 text-center py-4">No members added</div>
        ) : (
          <div className="space-y-2">
            {members.map((m) => (
              <div
                key={m.userId}
                className="flex items-center gap-3 p-2 rounded bg-zinc-900"
              >
                {m.avatarUrl ? (
                  <img src={m.avatarUrl} alt="" className="w-6 h-6 rounded-full" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center text-[10px] text-zinc-400">
                    {m.displayName[0]?.toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-zinc-200 truncate">{m.displayName}</div>
                  <div className="text-[10px] text-zinc-500">@{m.login}</div>
                </div>
                <select
                  value={m.role}
                  onChange={(e) => handleRoleChange(m.userId, e.target.value as ProjectMember['role'])}
                  className="bg-zinc-800 text-xs text-zinc-300 px-2 py-1 rounded border border-zinc-700"
                >
                  {MEMBER_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => removeMember(m.userId)}
                  className="text-zinc-500 hover:text-red-400 transition-colors text-xs px-1"
                  title="Remove member"
                >
                  x
                </button>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function GoogleDriveTab() {
  const config = useSettingsStore((s) => s.settings.googleDrive);
  const setGoogleDrive = useSettingsStore((s) => s.setGoogleDrive);

  const update = useCallback(
    (partial: Partial<GoogleDriveConfig>) => {
      setGoogleDrive({ ...config, ...partial });
    },
    [config, setGoogleDrive],
  );

  return (
    <div className="space-y-4">
      <SectionCard title="Google Drive Integration">
        <div className="space-y-3">
          <Toggle
            label="Enable Google Drive"
            checked={config.enabled}
            onChange={(v) => update({ enabled: v })}
          />
          <LabeledInput
            label="Folder ID"
            value={config.folderId}
            onChange={(v) => update({ folderId: v })}
            placeholder="e.g. 1abc2def3ghi..."
            disabled={!config.enabled}
          />
          <LabeledInput
            label="Folder Name"
            value={config.folderName}
            onChange={(v) => update({ folderName: v })}
            placeholder="e.g. My Project Resources"
            disabled={!config.enabled}
          />
          <Toggle
            label="Auto-sync resources"
            checked={config.syncEnabled}
            onChange={(v) => update({ syncEnabled: v })}
          />
        </div>
      </SectionCard>
    </div>
  );
}

function ResourceDepotTab() {
  const config = useSettingsStore((s) => s.settings.resourceDepot);
  const setResourceDepot = useSettingsStore((s) => s.setResourceDepot);

  const update = useCallback(
    (partial: Partial<ResourceDepotConnection>) => {
      setResourceDepot({ ...config, ...partial });
    },
    [config, setResourceDepot],
  );

  return (
    <div className="space-y-4">
      <SectionCard title="Resource Depot Connection">
        <div className="space-y-3">
          <Toggle
            label="Enable Resource Depot"
            checked={config.enabled}
            onChange={(v) => update({ enabled: v })}
          />
          <LabeledInput
            label="Depot URL"
            value={config.url}
            onChange={(v) => update({ url: v })}
            placeholder="e.g. http://localhost:3001"
            disabled={!config.enabled}
          />
          <LabeledInput
            label="Label"
            value={config.label}
            onChange={(v) => update({ label: v })}
            placeholder="e.g. Main Resource Server"
            disabled={!config.enabled}
          />
        </div>
      </SectionCard>
    </div>
  );
}

// ========== Main Settings Page ==========

export function ProjectSettingsPage() {
  const [tab, setTab] = useState<SettingsTab>('general');
  const user = useAuthStore((s) => s.user);
  const cloudProjects = useAuthStore((s) => s.cloudProjects);
  const fetchCloudProjects = useAuthStore((s) => s.fetchCloudProjects);

  const projectId = useSettingsStore((s) => s.projectId);
  const loading = useSettingsStore((s) => s.loading);
  const saving = useSettingsStore((s) => s.saving);
  const error = useSettingsStore((s) => s.error);
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const saveAllSettings = useSettingsStore((s) => s.saveAllSettings);

  // プロジェクト一覧を取得
  useEffect(() => {
    if (user) {
      fetchCloudProjects();
    }
  }, [user, fetchCloudProjects]);

  const handleSelectProject = useCallback(
    (id: string) => {
      if (id) loadSettings(id);
    },
    [loadSettings],
  );

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-zinc-500 text-sm">Sign in to manage project settings</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-4 px-4 py-3 border-b border-zinc-700">
        <h2 className="text-sm font-semibold text-white whitespace-nowrap">Project Settings</h2>

        {/* Project selector */}
        <select
          value={projectId ?? ''}
          onChange={(e) => handleSelectProject(e.target.value)}
          className="bg-zinc-800 text-xs text-zinc-300 px-3 py-1.5 rounded border border-zinc-700 focus:outline-none focus:border-blue-500"
        >
          <option value="">Select a project...</option>
          {cloudProjects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <div className="ml-auto flex items-center gap-2">
          {error && <span className="text-xs text-red-400">{error}</span>}
          {saving && <span className="text-xs text-zinc-500">Saving...</span>}
          <button
            onClick={saveAllSettings}
            disabled={!projectId || saving}
            className="px-4 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-500 transition-colors disabled:opacity-50"
          >
            Save Settings
          </button>
        </div>
      </div>

      {!projectId ? (
        <div className="flex items-center justify-center flex-1">
          <div className="text-zinc-500 text-sm">Select a project to configure settings</div>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center flex-1">
          <div className="text-zinc-500 text-sm">Loading settings...</div>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar tabs */}
          <div className="w-48 border-r border-zinc-700 py-2">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`w-full text-left px-4 py-2 text-xs font-medium transition-colors ${
                  tab === t.key
                    ? 'bg-zinc-800 text-blue-400 border-l-2 border-blue-400'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-6 max-w-2xl">
            {tab === 'general' && <GeneralTab />}
            {tab === 'members' && <MembersTab />}
            {tab === 'google-drive' && <GoogleDriveTab />}
            {tab === 'resource-depot' && <ResourceDepotTab />}
          </div>
        </div>
      )}
    </div>
  );
}
