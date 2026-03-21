import type { Task, PortDefinition } from '@/types/domain';
import { useI18n } from '@/hooks/useI18n';
import { TestCaseEditor } from './TestCaseEditor';

interface TaskEditorProps {
  tasks: Task[];
  onChange: (tasks: Task[]) => void;
}

function PortList({
  ports,
  label,
  onChange,
}: {
  ports: PortDefinition[];
  label: string;
  onChange: (ports: PortDefinition[]) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="ml-4 space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-500">{label}</span>
        <button
          type="button"
          onClick={() => onChange([...ports, { name: '', type: 'any' }])}
          className="text-xs text-blue-400 hover:text-blue-300"
        >
          +
        </button>
      </div>
      {ports.map((port, i) => (
        <div key={`${label}-port-${port.name || i}`} className="flex gap-1 items-center">
          <input
            className="flex-1 bg-zinc-700 text-white text-xs px-1.5 py-0.5 rounded border border-zinc-600 outline-none focus:border-blue-500"
            placeholder={t('taskEditor.portNamePlaceholder')}
            value={port.name}
            onChange={(e) => {
              const updated = ports.map((p, j) => (j === i ? { ...p, name: e.target.value } : p));
              onChange(updated);
            }}
          />
          <input
            className="w-16 bg-zinc-700 text-white text-xs px-1.5 py-0.5 rounded border border-zinc-600 outline-none focus:border-blue-500"
            placeholder={t('taskEditor.typePlaceholder')}
            value={port.type}
            onChange={(e) => {
              const updated = ports.map((p, j) => (j === i ? { ...p, type: e.target.value } : p));
              onChange(updated);
            }}
          />
          <button
            type="button"
            onClick={() => onChange(ports.filter((_, j) => j !== i))}
            className="text-red-400 text-xs px-0.5"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

export function TaskEditor({ tasks, onChange }: TaskEditorProps) {
  const { t } = useI18n();
  const addTask = () => {
    onChange([
      ...tasks,
      { name: '', description: '', inputs: [], outputs: [], testCases: [] },
    ]);
  };

  const updateTask = (index: number, field: keyof Task, value: unknown) => {
    onChange(tasks.map((tk, i) => (i === index ? { ...tk, [field]: value } : tk)));
  };

  const removeTask = (index: number) => {
    onChange(tasks.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-zinc-300">{t('taskEditor.tasks')}</label>
        <button
          type="button"
          onClick={addTask}
          className="text-xs text-blue-400 hover:text-blue-300"
        >
          {t('taskEditor.addTask')}
        </button>
      </div>
      {tasks.length === 0 && (
        <p className="text-xs text-zinc-500 italic">{t('taskEditor.noTasks')}</p>
      )}
      {tasks.map((task, index) => (
        <div key={`task-${task.name || index}`} className="bg-zinc-800 rounded-md p-3 space-y-2 border border-zinc-700">
          <div className="flex items-center gap-2">
            <input
              className="flex-1 bg-zinc-700 text-white text-sm px-2 py-1 rounded border border-zinc-600 outline-none focus:border-blue-500"
              placeholder={t('taskEditor.taskNamePlaceholder')}
              value={task.name}
              onChange={(e) => updateTask(index, 'name', e.target.value)}
            />
            <button
              type="button"
              onClick={() => removeTask(index)}
              className="text-red-400 hover:text-red-300 text-sm"
            >
              ✕
            </button>
          </div>
          <textarea
            className="w-full bg-zinc-700 text-white text-sm px-2 py-1 rounded border border-zinc-600 outline-none focus:border-blue-500 resize-y min-h-[40px]"
            placeholder={t('taskEditor.descriptionPlaceholder')}
            value={task.description}
            onChange={(e) => updateTask(index, 'description', e.target.value)}
          />
          <PortList
            ports={task.inputs}
            label={t('taskEditor.inputs')}
            onChange={(ports) => updateTask(index, 'inputs', ports)}
          />
          <PortList
            ports={task.outputs}
            label={t('taskEditor.outputs')}
            onChange={(ports) => updateTask(index, 'outputs', ports)}
          />
          <TestCaseEditor
            testCases={task.testCases ?? []}
            onChange={(testCases) => updateTask(index, 'testCases', testCases)}
          />
        </div>
      ))}
    </div>
  );
}
