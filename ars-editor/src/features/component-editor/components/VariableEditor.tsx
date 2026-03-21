import type { Variable } from '@/types/domain';
import { useI18n } from '@/hooks/useI18n';

interface VariableEditorProps {
  variables: Variable[];
  onChange: (variables: Variable[]) => void;
}

export function VariableEditor({ variables, onChange }: VariableEditorProps) {
  const { t } = useI18n();
  const addVariable = () => {
    onChange([...variables, { name: '', type: 'string', defaultValue: undefined }]);
  };

  const updateVariable = (index: number, field: keyof Variable, value: string) => {
    const updated = variables.map((v, i) =>
      i === index ? { ...v, [field]: value } : v,
    );
    onChange(updated);
  };

  const removeVariable = (index: number) => {
    onChange(variables.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-zinc-300">{t('variableEditor.variables')}</label>
        <button
          type="button"
          onClick={addVariable}
          className="text-xs text-blue-400 hover:text-blue-300"
        >
          {t('variableEditor.addVariable')}
        </button>
      </div>
      {variables.length === 0 && (
        <p className="text-xs text-zinc-500 italic">{t('variableEditor.noVariables')}</p>
      )}
      {variables.map((variable, index) => (
        <div key={`var-${variable.name || index}`} className="flex gap-2 items-center">
          <input
            className="flex-1 bg-zinc-800 text-white text-sm px-2 py-1 rounded border border-zinc-600 outline-none focus:border-blue-500"
            placeholder={t('variableEditor.namePlaceholder')}
            value={variable.name}
            onChange={(e) => updateVariable(index, 'name', e.target.value)}
          />
          <input
            className="w-24 bg-zinc-800 text-white text-sm px-2 py-1 rounded border border-zinc-600 outline-none focus:border-blue-500"
            placeholder={t('variableEditor.typePlaceholder')}
            value={variable.type}
            onChange={(e) => updateVariable(index, 'type', e.target.value)}
          />
          <input
            className="w-24 bg-zinc-800 text-white text-sm px-2 py-1 rounded border border-zinc-600 outline-none focus:border-blue-500"
            placeholder={t('variableEditor.defaultPlaceholder')}
            value={variable.defaultValue != null ? String(variable.defaultValue) : ''}
            onChange={(e) => updateVariable(index, 'defaultValue', e.target.value)}
          />
          <button
            type="button"
            onClick={() => removeVariable(index)}
            className="text-red-400 hover:text-red-300 text-sm px-1"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
