import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Plus,
  Trash2,
  Play,
  Copy,
  Check,
  Sparkles,
  Boxes,
  RotateCw,
  AlertCircle,
} from 'lucide-react';
import { StructuredRow, ModelConfig, AppLanguage } from '../types';
import { translations } from '../lib/translations';

interface StructuredPromptViewProps {
  rows: StructuredRow[];
  setRows: React.Dispatch<React.SetStateAction<StructuredRow[]>>;
  inputPrefix: string;
  setInputPrefix: (prefix: string) => void;
  outputPrefix: string;
  setOutputPrefix: (prefix: string) => void;
  config: ModelConfig;
  language: AppLanguage;
}

export const StructuredPromptView: React.FC<StructuredPromptViewProps> = ({
  rows,
  setRows,
  inputPrefix,
  setInputPrefix,
  outputPrefix,
  setOutputPrefix,
  config,
  language,
}) => {
  const t = translations[language];
  const [testInput, setTestInput] = useState('');
  const [testOutput, setTestOutput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const addRow = () => {
    const newRow: StructuredRow = {
      id: Math.random().toString(36).substring(2, 9),
      input: '',
      output: '',
    };
    setRows((prev) => [...prev, newRow]);
  };

  const deleteRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const updateRow = (id: string, field: 'input' | 'output', value: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  // Compile few-shot prompt
  const runStructuredTest = async () => {
    if (!testInput.trim() || isLoading) return;
    setIsLoading(true);
    setError(null);
    setTestOutput('');

    // Format few-shot context
    let promptContext = '';
    rows.forEach((r) => {
      if (r.input.trim() && r.output.trim()) {
        promptContext += `${inputPrefix || 'input'}: ${r.input}\n${outputPrefix || 'output'}: ${r.output}\n\n`;
      }
    });

    promptContext += `${inputPrefix || 'input'}: ${testInput}\n${outputPrefix || 'output'}:`;

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.model,
          contents: promptContext,
          systemInstruction: config.systemInstruction,
          temperature: config.temperature,
          topP: config.topP,
          topK: config.topK,
          maxOutputTokens: config.maxOutputTokens,
          responseMimeType: config.responseMimeType,
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setTestOutput(data.text || '');
    } catch (err: any) {
      setError(err.message || 'Failed to run structured prompt.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-3.5rem)] bg-[#131314] overflow-y-auto custom-scrollbar p-4 md:p-6">
      <div className="max-w-5xl mx-auto w-full space-y-6">
        {/* Header Intro */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#1e1f20] p-4 rounded-2xl border border-[#282a2c]">
          <div>
            <div className="flex items-center gap-2">
              <Boxes size={18} className="text-[#8ab4f8]" />
              <h2 className="text-sm font-semibold text-white">{t.fewShotTitle}</h2>
            </div>
            <p className="text-xs text-[#9aa0a6] mt-1 max-w-2xl leading-relaxed">
              {t.fewShotDesc}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-[#131314] px-2.5 py-1 rounded-xl border border-[#3c4043]">
              <span className="text-[11px] text-[#9aa0a6]">Prefix:</span>
              <input
                type="text"
                value={inputPrefix}
                onChange={(e) => setInputPrefix(e.target.value)}
                placeholder="input"
                className="w-16 bg-transparent text-xs text-[#8ab4f8] font-mono outline-none"
              />
              <span className="text-[11px] text-[#9aa0a6]">/</span>
              <input
                type="text"
                value={outputPrefix}
                onChange={(e) => setOutputPrefix(e.target.value)}
                placeholder="output"
                className="w-16 bg-transparent text-xs text-[#8ab4f8] font-mono outline-none"
              />
            </div>

            <button
              onClick={addRow}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-xl bg-[#8ab4f8] text-[#131314] font-semibold hover:bg-[#a8c7fa] transition-colors"
            >
              <Plus size={14} />
              <span>{t.addRow}</span>
            </button>
          </div>
        </div>

        {/* Few-Shot Examples Rows */}
        <div className="space-y-3">
          <div className="text-xs font-semibold text-[#9aa0a6] uppercase tracking-wider">
            Examples ({rows.length})
          </div>

          {rows.map((row, index) => (
            <div
              key={row.id}
              className="p-4 rounded-xl bg-[#1e1f20] border border-[#282a2c] space-y-3 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#8ab4f8]">Example #{index + 1}</span>
                <button
                  onClick={() => deleteRow(row.id)}
                  className="text-[#9aa0a6] hover:text-[#ea4335] p-1 transition-colors"
                  title="Remove example"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-[#9aa0a6] block mb-1">
                    {inputPrefix || 'Input'}
                  </label>
                  <textarea
                    rows={2}
                    value={row.input}
                    onChange={(e) => updateRow(row.id, 'input', e.target.value)}
                    placeholder="Enter sample input..."
                    className="w-full bg-[#131314] text-xs text-[#e3e3e3] p-2.5 rounded-lg border border-[#3c4043] focus:border-[#8ab4f8] outline-none resize-y"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-[#9aa0a6] block mb-1">
                    {outputPrefix || 'Output'}
                  </label>
                  <textarea
                    rows={2}
                    value={row.output}
                    onChange={(e) => updateRow(row.id, 'output', e.target.value)}
                    placeholder="Enter expected model output..."
                    className="w-full bg-[#131314] text-xs text-[#e3e3e3] p-2.5 rounded-lg border border-[#3c4043] focus:border-[#8ab4f8] outline-none resize-y"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Live Test Evaluation Section */}
        <div className="p-4 rounded-2xl bg-[#1e1f20] border border-[#282a2c] space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-[#8ab4f8]" />
              <h3 className="text-xs font-semibold text-white">Test Structured Output</h3>
            </div>

            <button
              onClick={runStructuredTest}
              disabled={isLoading || !testInput.trim()}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#8ab4f8] text-[#131314] text-xs font-semibold hover:bg-[#a8c7fa] transition-colors disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <RotateCw size={13} className="animate-spin" />
                  <span>{t.running}</span>
                </>
              ) : (
                <>
                  <Play size={13} />
                  <span>{t.run}</span>
                </>
              )}
            </button>
          </div>

          <div>
            <label className="text-[11px] font-medium text-[#9aa0a6] block mb-1">
              New Test Input:
            </label>
            <textarea
              rows={2}
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              placeholder="Enter new input to test few-shot model generalization..."
              className="w-full bg-[#131314] text-xs text-[#e3e3e3] p-3 rounded-lg border border-[#3c4043] focus:border-[#8ab4f8] outline-none"
            />
          </div>

          {error && (
            <div className="p-2.5 bg-[#ea4335]/10 border border-[#ea4335]/30 rounded text-xs text-[#ea4335] flex items-center gap-1.5">
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}

          {testOutput && (
            <div className="mt-3 p-4 bg-[#131314] rounded-xl border border-[#282a2c]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-[#8ab4f8]">
                  Generated Structured Output:
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(testOutput);
                    setIsCopied(true);
                    setTimeout(() => setIsCopied(false), 2000);
                  }}
                  className="text-xs text-[#8ab4f8] hover:underline flex items-center gap-1"
                >
                  {isCopied ? <Check size={12} /> : <Copy size={12} />}
                  <span>{isCopied ? t.copied : t.copy}</span>
                </button>
              </div>
              <div className="prose-studio">
                <ReactMarkdown>{testOutput}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
