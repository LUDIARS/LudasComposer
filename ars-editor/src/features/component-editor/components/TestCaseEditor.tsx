interface TestCaseEditorProps {
  testCases: string[];
  onChange: (testCases: string[]) => void;
}

export function TestCaseEditor({ testCases, onChange }: TestCaseEditorProps) {
  const addTestCase = () => {
    onChange([...testCases, '']);
  };

  const updateTestCase = (index: number, value: string) => {
    onChange(testCases.map((tc, i) => (i === index ? value : tc)));
  };

  const removeTestCase = (index: number) => {
    onChange(testCases.filter((_, i) => i !== index));
  };

  return (
    <div className="ml-4 space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-500">Test Cases</span>
        <button
          type="button"
          onClick={addTestCase}
          className="text-xs text-blue-400 hover:text-blue-300"
        >
          +
        </button>
      </div>
      {testCases.length === 0 && (
        <p className="text-xs text-zinc-600 italic">No test cases</p>
      )}
      {testCases.map((tc, i) => (
        <div key={i} className="flex gap-1 items-start">
          <textarea
            className="flex-1 bg-zinc-700 text-white text-xs px-1.5 py-1 rounded border border-zinc-600 outline-none focus:border-blue-500 resize-y min-h-[28px]"
            placeholder="Test case description..."
            value={tc}
            onChange={(e) => updateTestCase(i, e.target.value)}
          />
          <button
            type="button"
            onClick={() => removeTestCase(i)}
            className="text-red-400 text-xs px-0.5 mt-1"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
