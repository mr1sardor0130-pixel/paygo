import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Play,
  Plus,
  Trash2,
  Copy,
  Check,
  Sparkles,
  Code2,
  Table,
  RotateCw,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { VariableTestCase, ModelConfig, AppLanguage } from '../types';
import { translations } from '../lib/translations';

interface FreeformPromptViewProps {
  freeformText: string;
  setFreeformText: (text: string) => void;
  testCases: VariableTestCase[];
  setTestCases: React.Dispatch<React.SetStateAction<VariableTestCase[]>>;
  config: ModelConfig;
  language: AppLanguage;
}

export const FreeformPromptView: React.FC<FreeformPromptViewProps> = ({
  freeformText,
  setFreeformText,
  testCases,
  setTestCases,
  config,
  language,
}) => {
  const t = translations[language];
  const [activeTab, setActiveTab] = useState<'prompt' | 'tests'>('prompt');
  const [directOutput, setDirectOutput] = useState('');
  const [isGeneratingDirect, setIsGeneratingDirect] = useState(false);
  const [copiedResultId, setCopiedResultId] = useState<string | null>(null);

  // Extract variables enclosed in {{variable_name}}
  const detectedVariables = Array.from(
    new Set(
      Array.from(freeformText.matchAll(/\{\{([a-zA-Z0-9_-]+)\}\}/g)).map((match) => match[1])
    )
  );

  // Synchronize detected variables across test cases
  useEffect(() => {
    if (detectedVariables.length > 0 && testCases.length === 0) {
      const initialRow: VariableTestCase = {
        id: '1',
        variables: {},
      };
      detectedVariables.forEach((v) => {
        initialRow.variables[v] = '';
      });
      setTestCases([initialRow]);
    }
  }, [detectedVariables.join(',')]);

  const insertVariableTag = (varName: string) => {
    setFreeformText(`${freeformText} {{${varName}}}`);
  };

  const addTestCaseRow = () => {
    const newRow: VariableTestCase = {
      id: Math.random().toString(36).substring(2, 9),
      variables: {},
    };
    detectedVariables.forEach((v) => {
      newRow.variables[v] = '';
    });
    setTestCases((prev) => [...prev, newRow]);
  };

  const deleteTestCaseRow = (id: string) => {
    setTestCases((prev) => prev.filter((r) => r.id !== id));
  };

  const updateVariableValue = (rowId: string, varName: string, value: string) => {
    setTestCases((prev) =>
      prev.map((row) => {
        if (row.id === rowId) {
          return {
            ...row,
            variables: { ...row.variables, [varName]: value },
          };
        }
        return row;
      })
    );
  };

  // Run single test case row
  const runTestCase = async (rowId: string) => {
    const targetRow = testCases.find((r) => r.id === rowId);
    if (!targetRow) return;

    let compiledPrompt = freeformText;
    detectedVariables.forEach((v) => {
      const val = targetRow.variables[v] || `[${v}]`;
      compiledPrompt = compiledPrompt.replaceAll(`{{${v}}}`, val);
    });

    setTestCases((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, isLoading: true, error: undefined } : r))
    );

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.model,
          contents: compiledPrompt,
          systemInstruction: config.systemInstruction,
          temperature: config.temperature,
          topP: config.topP,
          topK: config.topK,
          maxOutputTokens: config.maxOutputTokens,
          responseMimeType: config.responseMimeType,
          enableGoogleSearch: config.enableGoogleSearch,
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setTestCases((prev) =>
        prev.map((r) => (r.id === rowId ? { ...r, result: data.text, isLoading: false } : r))
      );
    } catch (err: any) {
      setTestCases((prev) =>
        prev.map((r) =>
          r.id === rowId ? { ...r, isLoading: false, error: err.message || 'Error running test' } : r
        )
      );
    }
  };

  // Run all test cases in batch
  const runAllTestCases = async () => {
    for (const row of testCases) {
      await runTestCase(row.id);
    }
  };

  // Direct single prompt run
  const runDirectPrompt = async () => {
    if (!freeformText.trim() || isGeneratingDirect) return;
    setIsGeneratingDirect(true);
    setDirectOutput('');

    try {
      const res = await fetch('/api/generate-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.model,
          contents: freeformText,
          systemInstruction: config.systemInstruction,
          temperature: config.temperature,
          topP: config.topP,
          topK: config.topK,
          maxOutputTokens: config.maxOutputTokens,
          responseMimeType: config.responseMimeType,
          enableGoogleSearch: config.enableGoogleSearch,
        }),
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) return;

      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.replace('data: ', '').trim();
            if (!dataStr) continue;
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.type === 'chunk') {
                setDirectOutput((prev) => prev + parsed.text);
              }
            } catch (e) {
              console.error(e);
            }
          }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsGeneratingDirect(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-3.5rem)] bg-[#131314] overflow-hidden">
      {/* Top action toolbar */}
      <div className="p-3 border-b border-[#282a2c] bg-[#1e1f20] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex bg-[#131314] p-1 rounded-xl border border-[#282a2c]">
            <button
              onClick={() => setActiveTab('prompt')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === 'prompt' ? 'bg-[#282a2c] text-[#8ab4f8]' : 'text-[#9aa0a6] hover:text-white'
              }`}
            >
              <FileText size={14} />
              <span>Prompt Editor</span>
            </button>

            <button
              onClick={() => setActiveTab('tests')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === 'tests' ? 'bg-[#282a2c] text-[#8ab4f8]' : 'text-[#9aa0a6] hover:text-white'
              }`}
            >
              <Table size={14} />
              <span>{t.testCases}</span>
              {detectedVariables.length > 0 && (
                <span className="bg-[#8ab4f8]/20 text-[#8ab4f8] text-[10px] px-1.5 py-0.2 rounded-full font-mono">
                  {detectedVariables.length} vars
                </span>
              )}
            </button>
          </div>

          {/* Quick variable helper pill */}
          <button
            onClick={() => {
              const name = prompt('Enter variable name (e.g. topic, tone, audience):', 'input');
              if (name) insertVariableTag(name.trim());
            }}
            className="text-xs px-2.5 py-1.5 rounded-lg bg-[#282a2c] hover:bg-[#3c4043] text-[#8ab4f8] border border-[#3c4043] transition-colors flex items-center gap-1"
          >
            <Plus size={13} />
            <span>{t.insertVariable}</span>
          </button>
        </div>

        {/* Primary Run Button */}
        {activeTab === 'prompt' ? (
          <button
            onClick={runDirectPrompt}
            disabled={isGeneratingDirect || !freeformText.trim()}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#8ab4f8] text-[#131314] hover:bg-[#a8c7fa] text-xs font-semibold transition-colors disabled:opacity-50"
          >
            {isGeneratingDirect ? (
              <>
                <RotateCw size={14} className="animate-spin" />
                <span>{t.running}</span>
              </>
            ) : (
              <>
                <Play size={14} />
                <span>{t.run}</span>
              </>
            )}
          </button>
        ) : (
          <button
            onClick={runAllTestCases}
            disabled={testCases.length === 0}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#8ab4f8] text-[#131314] hover:bg-[#a8c7fa] text-xs font-semibold transition-colors disabled:opacity-50"
          >
            <Play size={14} />
            <span>{t.runAllTests}</span>
          </button>
        )}
      </div>

      {/* Main Workspace Area */}
      <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
        {activeTab === 'prompt' ? (
          <>
            {/* Prompt Text Editor */}
            <div className="flex-1 p-4 flex flex-col border-r border-[#282a2c] overflow-y-auto">
              <div className="text-xs font-semibold text-[#9aa0a6] uppercase tracking-wider mb-2">
                Prompt Template
              </div>
              <textarea
                value={freeformText}
                onChange={(e) => setFreeformText(e.target.value)}
                placeholder="Write your freeform prompt template here. Use {{variable_name}} to parameterize variables for batch testing..."
                className="flex-1 w-full bg-[#1e1f20] text-sm text-[#e3e3e3] p-4 rounded-xl border border-[#282a2c] focus:border-[#8ab4f8] outline-none resize-none font-sans leading-relaxed custom-scrollbar"
              />
            </div>

            {/* Live Run Output Panel */}
            <div className="flex-1 p-4 flex flex-col bg-[#131314] overflow-y-auto custom-scrollbar">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold text-[#9aa0a6] uppercase tracking-wider">
                  Model Output
                </div>
                {directOutput && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(directOutput);
                      setCopiedResultId('direct');
                      setTimeout(() => setCopiedResultId(null), 2000);
                    }}
                    className="text-xs text-[#8ab4f8] hover:underline flex items-center gap-1"
                  >
                    {copiedResultId === 'direct' ? <Check size={12} /> : <Copy size={12} />}
                    <span>{copiedResultId === 'direct' ? t.copied : t.copy}</span>
                  </button>
                )}
              </div>

              <div className="flex-1 bg-[#1e1f20] rounded-xl border border-[#282a2c] p-4 overflow-y-auto custom-scrollbar">
                {directOutput ? (
                  <div className="prose-studio">
                    <ReactMarkdown>{directOutput}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-[#9aa0a6]">
                    Click "Run" to test your freeform prompt with Gemini.
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          /* Test Cases Table View */
          <div className="flex-1 p-4 overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-white">{t.testCases}</h3>
                <p className="text-xs text-[#9aa0a6]">
                  Test your prompt with different variable inputs side-by-side.
                </p>
              </div>
              <button
                onClick={addTestCaseRow}
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-[#282a2c] hover:bg-[#3c4043] text-white border border-[#3c4043] transition-colors"
              >
                <Plus size={13} />
                <span>{t.addTestCase}</span>
              </button>
            </div>

            {detectedVariables.length === 0 ? (
              <div className="p-8 text-center bg-[#1e1f20] rounded-2xl border border-[#282a2c] space-y-2">
                <Sparkles size={28} className="mx-auto text-[#8ab4f8]" />
                <p className="text-sm text-white font-medium">No variables detected yet</p>
                <p className="text-xs text-[#9aa0a6] max-w-sm mx-auto">
                  Add variables like <code className="text-[#8ab4f8]">{"{{topic}}"}</code> or{' '}
                  <code className="text-[#8ab4f8]">{"{{language}}"}</code> in the prompt editor to unlock batch test cases.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {testCases.map((row, index) => (
                  <div
                    key={row.id}
                    className="p-4 rounded-xl bg-[#1e1f20] border border-[#282a2c] space-y-3 shadow-sm"
                  >
                    <div className="flex items-center justify-between border-b border-[#282a2c] pb-2">
                      <span className="text-xs font-semibold text-[#8ab4f8]">
                        Test Case #{index + 1}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => runTestCase(row.id)}
                          disabled={row.isLoading}
                          className="px-2.5 py-1 rounded bg-[#8ab4f8] text-[#131314] hover:bg-[#a8c7fa] text-xs font-semibold transition-colors flex items-center gap-1"
                        >
                          {row.isLoading ? (
                            <RotateCw size={12} className="animate-spin" />
                          ) : (
                            <Play size={12} />
                          )}
                          <span>Run</span>
                        </button>
                        <button
                          onClick={() => deleteTestCaseRow(row.id)}
                          className="p-1 text-[#9aa0a6] hover:text-[#ea4335] rounded transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Variable Inputs */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {detectedVariables.map((v) => (
                        <div key={v}>
                          <label className="text-[11px] font-mono text-[#8ab4f8] block mb-1">
                            {`{{${v}}}`}
                          </label>
                          <input
                            type="text"
                            value={row.variables[v] || ''}
                            onChange={(e) => updateVariableValue(row.id, v, e.target.value)}
                            placeholder={`Enter ${v}...`}
                            className="w-full bg-[#131314] text-xs text-[#e3e3e3] px-2.5 py-1.5 rounded-lg border border-[#3c4043] focus:border-[#8ab4f8] outline-none"
                          />
                        </div>
                      ))}
                    </div>

                    {/* Test Output */}
                    {row.result && (
                      <div className="mt-2 p-3 bg-[#131314] rounded-lg border border-[#282a2c]">
                        <div className="text-[11px] font-semibold text-[#9aa0a6] mb-1">
                          Output:
                        </div>
                        <div className="prose-studio text-xs">
                          <ReactMarkdown>{row.result}</ReactMarkdown>
                        </div>
                      </div>
                    )}

                    {row.error && (
                      <div className="p-2 bg-[#ea4335]/10 border border-[#ea4335]/30 rounded text-xs text-[#ea4335] flex items-center gap-1.5">
                        <AlertCircle size={14} />
                        <span>{row.error}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
