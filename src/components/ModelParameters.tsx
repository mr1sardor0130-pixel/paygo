import React, { useState } from 'react';
import {
  Sliders,
  Sparkles,
  Search,
  Code,
  ShieldAlert,
  HelpCircle,
  Maximize2,
  ChevronDown,
  ChevronUp,
  BrainCircuit,
  FileCode2,
  Zap,
} from 'lucide-react';
import { ModelConfig, AppLanguage } from '../types';
import { translations } from '../lib/translations';
import { AVAILABLE_MODELS, SYSTEM_PROMPT_PRESETS } from '../lib/constants';

interface ModelParametersProps {
  isOpen: boolean;
  config: ModelConfig;
  onChangeConfig: (newConfig: Partial<ModelConfig>) => void;
  language: AppLanguage;
  inputTokenCount: number;
  outputTokenCount: number;
}

export const ModelParameters: React.FC<ModelParametersProps> = ({
  isOpen,
  config,
  onChangeConfig,
  language,
  inputTokenCount,
  outputTokenCount,
}) => {
  const t = translations[language];
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [isSafetyOpen, setIsSafetyOpen] = useState(false);
  const [isPresetsOpen, setIsPresetsOpen] = useState(false);

  if (!isOpen) return null;

  const currentModel = AVAILABLE_MODELS.find((m) => m.id === config.model) || AVAILABLE_MODELS[0];
  const totalTokens = inputTokenCount + outputTokenCount;
  const maxContext = 1048576; // 1M
  const contextPercent = Math.min(100, Math.max(0.2, (totalTokens / maxContext) * 100));

  return (
    <aside className="w-80 border-l border-[#282a2c] bg-[#1e1f20] flex flex-col h-[calc(100vh-3.5rem)] shrink-0 overflow-y-auto z-20 custom-scrollbar select-none">
      {/* Parameters Header */}
      <div className="p-4 border-b border-[#282a2c] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sliders size={16} className="text-[#8ab4f8]" />
          <h2 className="text-sm font-semibold text-white">{t.modelParameters}</h2>
        </div>
      </div>

      <div className="p-4 space-y-5 flex-1">
        {/* Model Selection */}
        <div>
          <label className="block text-xs font-semibold text-[#9aa0a6] uppercase tracking-wider mb-2">
            {t.model}
          </label>
          <div className="space-y-1.5">
            {AVAILABLE_MODELS.map((model) => (
              <div
                key={model.id}
                onClick={() => onChangeConfig({ model: model.id })}
                className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                  config.model === model.id
                    ? 'border-[#8ab4f8] bg-[#282a2c]/90 text-white shadow-sm'
                    : 'border-[#282a2c] bg-[#131314]/60 text-[#9aa0a6] hover:text-[#e3e3e3] hover:border-[#3c4043]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#e3e3e3]">{model.name}</span>
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#3c4043]/80 text-[#8ab4f8]">
                    {model.badge}
                  </span>
                </div>
                <p className="text-[11px] text-[#9aa0a6] mt-1 line-clamp-2 leading-relaxed">
                  {model.description}
                </p>
                <div className="text-[10px] font-mono text-[#8ab4f8] mt-1.5">
                  Context: {model.contextWindow}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* System Instructions */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-[#9aa0a6] uppercase tracking-wider">
              {t.systemInstruction}
            </label>
            <button
              onClick={() => setIsPresetsOpen(!isPresetsOpen)}
              className="text-[11px] text-[#8ab4f8] hover:underline flex items-center gap-1"
            >
              <Sparkles size={11} />
              <span>Presets</span>
            </button>
          </div>

          {/* Quick presets helper */}
          {isPresetsOpen && (
            <div className="mb-2 p-2 bg-[#131314] rounded-lg border border-[#3c4043] space-y-1 text-xs">
              <div className="text-[11px] font-semibold text-[#9aa0a6] mb-1">Quick Templates:</div>
              {SYSTEM_PROMPT_PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    onChangeConfig({ systemInstruction: preset.text });
                    setIsPresetsOpen(false);
                  }}
                  className="w-full text-left p-1.5 rounded hover:bg-[#282a2c] text-[#e3e3e3] text-[11px] transition-colors"
                >
                  {preset.title}
                </button>
              ))}
            </div>
          )}

          <textarea
            rows={3}
            value={config.systemInstruction}
            onChange={(e) => onChangeConfig({ systemInstruction: e.target.value })}
            placeholder={t.systemInstructionPlaceholder}
            className="w-full bg-[#131314] text-xs text-[#e3e3e3] p-2.5 rounded-xl border border-[#282a2c] focus:border-[#8ab4f8] focus:ring-1 focus:ring-[#8ab4f8] outline-none resize-y min-h-[70px]"
          />
        </div>

        {/* Temperature Slider */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1">
              <span className="text-xs font-semibold text-[#e3e3e3]">{t.temperature}</span>
            </div>
            <span className="text-xs font-mono font-bold text-[#8ab4f8] bg-[#282a2c] px-2 py-0.5 rounded">
              {config.temperature.toFixed(2)}
            </span>
          </div>

          <input
            type="range"
            min="0"
            max="2"
            step="0.05"
            value={config.temperature}
            onChange={(e) => onChangeConfig({ temperature: parseFloat(e.target.value) })}
            className="w-full h-1.5 bg-[#282a2c] rounded-lg appearance-none cursor-pointer accent-[#8ab4f8]"
          />

          <div className="flex justify-between text-[10px] text-[#9aa0a6] mt-1 font-medium">
            <span>{t.precise} (0.0)</span>
            <span>{t.balanced} (1.0)</span>
            <span>{t.creative} (2.0)</span>
          </div>
        </div>

        {/* Google Search Grounding Toggle */}
        <div className="p-3 rounded-xl bg-[#131314] border border-[#282a2c]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Search size={15} className="text-[#8ab4f8]" />
              <div>
                <div className="text-xs font-semibold text-[#e3e3e3]">
                  {t.googleSearchGrounding}
                </div>
                <div className="text-[10px] text-[#9aa0a6] leading-tight mt-0.5">
                  {t.groundingDesc}
                </div>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.enableGoogleSearch}
                onChange={(e) => onChangeConfig({ enableGoogleSearch: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-[#3c4043] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#8ab4f8]"></div>
            </label>
          </div>
        </div>

        {/* Structured JSON Output Toggle */}
        <div className="p-3 rounded-xl bg-[#131314] border border-[#282a2c]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileCode2 size={15} className="text-[#a8c7fa]" />
              <div>
                <div className="text-xs font-semibold text-[#e3e3e3]">{t.jsonMode}</div>
                <div className="text-[10px] text-[#9aa0a6]">application/json</div>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.responseMimeType === 'application/json'}
                onChange={(e) =>
                  onChangeConfig({
                    responseMimeType: e.target.checked ? 'application/json' : 'text/plain',
                  })
                }
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-[#3c4043] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#8ab4f8]"></div>
            </label>
          </div>

          {config.responseMimeType === 'application/json' && (
            <div className="mt-3 pt-2 border-t border-[#282a2c]">
              <label className="text-[11px] text-[#9aa0a6] block mb-1">
                JSON Response Schema (Optional)
              </label>
              <textarea
                rows={4}
                value={config.responseSchema || ''}
                onChange={(e) => onChangeConfig({ responseSchema: e.target.value })}
                placeholder={t.jsonSchemaPlaceholder}
                className="w-full bg-[#1e1f20] font-mono text-[11px] text-[#8ab4f8] p-2 rounded border border-[#3c4043] outline-none"
              />
            </div>
          )}
        </div>

        {/* Advanced Settings Collapsible */}
        <div className="border-t border-[#282a2c] pt-3">
          <button
            onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
            className="w-full flex items-center justify-between text-xs font-semibold text-[#9aa0a6] hover:text-white py-1 transition-colors"
          >
            <span>Advanced settings</span>
            {isAdvancedOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {isAdvancedOpen && (
            <div className="mt-3 space-y-4 animate-in fade-in duration-150">
              {/* Max Output Tokens */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[#e3e3e3]">{t.maxOutputTokens}</span>
                  <span className="font-mono text-[#8ab4f8]">{config.maxOutputTokens}</span>
                </div>
                <input
                  type="range"
                  min="64"
                  max="8192"
                  step="64"
                  value={config.maxOutputTokens}
                  onChange={(e) =>
                    onChangeConfig({ maxOutputTokens: parseInt(e.target.value, 10) })
                  }
                  className="w-full h-1.5 bg-[#282a2c] rounded-lg appearance-none cursor-pointer accent-[#8ab4f8]"
                />
              </div>

              {/* Top P */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[#e3e3e3]">{t.topP}</span>
                  <span className="font-mono text-[#8ab4f8]">{config.topP.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={config.topP}
                  onChange={(e) => onChangeConfig({ topP: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-[#282a2c] rounded-lg appearance-none cursor-pointer accent-[#8ab4f8]"
                />
              </div>

              {/* Top K */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[#e3e3e3]">{t.topK}</span>
                  <span className="font-mono text-[#8ab4f8]">{config.topK}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="100"
                  step="1"
                  value={config.topK}
                  onChange={(e) => onChangeConfig({ topK: parseInt(e.target.value, 10) })}
                  className="w-full h-1.5 bg-[#282a2c] rounded-lg appearance-none cursor-pointer accent-[#8ab4f8]"
                />
              </div>

              {/* Thinking / Reasoning Level */}
              {config.model.includes('3.') && (
                <div>
                  <div className="flex items-center gap-1.5 text-xs text-[#e3e3e3] mb-1.5">
                    <BrainCircuit size={13} className="text-[#8ab4f8]" />
                    <span>{t.thinkingMode}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {(['HIGH', 'LOW'] as const).map((lvl) => (
                      <button
                        key={lvl}
                        onClick={() => onChangeConfig({ thinkingLevel: lvl })}
                        className={`py-1.5 rounded-lg border text-center font-medium transition-all ${
                          config.thinkingLevel === lvl
                            ? 'bg-[#282a2c] border-[#8ab4f8] text-[#8ab4f8]'
                            : 'bg-[#131314] border-[#282a2c] text-[#9aa0a6] hover:text-white'
                        }`}
                      >
                        {lvl === 'HIGH' ? 'High (Complex)' : 'Low (Speed)'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Safety Settings Drawer */}
        <div className="border-t border-[#282a2c] pt-3">
          <button
            onClick={() => setIsSafetyOpen(!isSafetyOpen)}
            className="w-full flex items-center justify-between text-xs font-semibold text-[#9aa0a6] hover:text-white py-1 transition-colors"
          >
            <div className="flex items-center gap-1.5">
              <ShieldAlert size={14} className="text-[#fbbc04]" />
              <span>{t.safetySettings}</span>
            </div>
            {isSafetyOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {isSafetyOpen && (
            <div className="mt-2 p-2.5 bg-[#131314] rounded-xl border border-[#282a2c] space-y-2 text-xs">
              <div className="text-[11px] text-[#9aa0a6] leading-relaxed">
                Standard Google AI safety filters are active (Harassment, Hate speech, Dangerous content).
              </div>
              <div className="text-[11px] text-[#34a853] font-medium flex items-center gap-1">
                <span>✓ Threshold: BLOCK_MEDIUM_AND_ABOVE</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Live Token Usage Indicator */}
      <div className="p-3 border-t border-[#282a2c] bg-[#171819] shrink-0">
        <div className="flex items-center justify-between text-xs font-medium mb-1.5">
          <span className="text-[#9aa0a6]">{t.tokens}</span>
          <span className="font-mono text-[#e3e3e3]">
            {totalTokens.toLocaleString()} / 1M
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1.5 bg-[#282a2c] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#8ab4f8] to-[#1a73e8] rounded-full transition-all duration-300"
            style={{ width: `${contextPercent}%` }}
          />
        </div>

        <div className="flex justify-between text-[10px] text-[#9aa0a6] mt-1.5">
          <span>{t.inputTokens}: {inputTokenCount}</span>
          <span>{t.outputTokens}: {outputTokenCount}</span>
        </div>
      </div>
    </aside>
  );
};
