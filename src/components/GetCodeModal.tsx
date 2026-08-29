import React, { useState } from 'react';
import {
  X,
  Copy,
  Check,
  Download,
  Code2,
  Terminal,
  FileCode,
} from 'lucide-react';
import { ModelConfig, ChatMessage, PromptMode, AppLanguage } from '../types';
import { translations } from '../lib/translations';
import {
  generateCurlCode,
  generatePythonCode,
  generateTypeScriptCode,
} from '../lib/codeGenerator';

interface GetCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: PromptMode;
  config: ModelConfig;
  chatMessages?: ChatMessage[];
  freeformText?: string;
  language: AppLanguage;
}

export const GetCodeModal: React.FC<GetCodeModalProps> = ({
  isOpen,
  onClose,
  mode,
  config,
  chatMessages,
  freeformText,
  language,
}) => {
  const t = translations[language];
  const [selectedLang, setSelectedLang] = useState<'python' | 'javascript' | 'curl'>('python');
  const [isCopied, setIsCopied] = useState(false);

  if (!isOpen) return null;

  let codeOutput = '';
  let filename = 'gemini_prompt.py';

  if (selectedLang === 'python') {
    codeOutput = generatePythonCode(mode, config, chatMessages, freeformText);
    filename = 'gemini_prompt.py';
  } else if (selectedLang === 'javascript') {
    codeOutput = generateTypeScriptCode(mode, config, chatMessages, freeformText);
    filename = 'gemini_prompt.ts';
  } else if (selectedLang === 'curl') {
    codeOutput = generateCurlCode(mode, config, chatMessages, freeformText);
    filename = 'gemini_curl.sh';
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(codeOutput);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([codeOutput], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#1e1f20] border border-[#3c4043] rounded-2xl w-full max-w-3xl flex flex-col max-h-[85vh] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-4 border-b border-[#282a2c] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code2 size={18} className="text-[#8ab4f8]" />
            <div>
              <h3 className="text-sm font-semibold text-white">{t.codeModalTitle}</h3>
              <p className="text-xs text-[#9aa0a6]">{t.codeModalDesc}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#9aa0a6] hover:text-white hover:bg-[#282a2c] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Language Tabs & Actions */}
        <div className="px-4 py-2 bg-[#171819] border-b border-[#282a2c] flex items-center justify-between">
          <div className="flex bg-[#131314] p-1 rounded-xl border border-[#282a2c]">
            <button
              onClick={() => setSelectedLang('python')}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                selectedLang === 'python'
                  ? 'bg-[#282a2c] text-[#8ab4f8] font-semibold'
                  : 'text-[#9aa0a6] hover:text-white'
              }`}
            >
              <FileCode size={13} />
              <span>Python (google-genai)</span>
            </button>

            <button
              onClick={() => setSelectedLang('javascript')}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                selectedLang === 'javascript'
                  ? 'bg-[#282a2c] text-[#8ab4f8] font-semibold'
                  : 'text-[#9aa0a6] hover:text-white'
              }`}
            >
              <FileCode size={13} />
              <span>JavaScript / Node.js</span>
            </button>

            <button
              onClick={() => setSelectedLang('curl')}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                selectedLang === 'curl'
                  ? 'bg-[#282a2c] text-[#8ab4f8] font-semibold'
                  : 'text-[#9aa0a6] hover:text-white'
              }`}
            >
              <Terminal size={13} />
              <span>cURL</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-[#282a2c] hover:bg-[#3c4043] text-[#e3e3e3] transition-colors border border-[#3c4043]"
              title={t.downloadCode}
            >
              <Download size={13} />
              <span className="hidden sm:inline">Download</span>
            </button>

            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-[#8ab4f8] text-[#131314] font-semibold hover:bg-[#a8c7fa] transition-colors"
            >
              {isCopied ? <Check size={13} /> : <Copy size={13} />}
              <span>{isCopied ? t.copied : t.copy}</span>
            </button>
          </div>
        </div>

        {/* Code Snippet Box */}
        <div className="flex-1 p-4 bg-[#131314] overflow-y-auto custom-scrollbar">
          <pre className="text-xs font-mono text-[#a8c7fa] leading-relaxed whitespace-pre selection:bg-[#8ab4f8]/20">
            <code>{codeOutput}</code>
          </pre>
        </div>

        {/* Footer info */}
        <div className="p-3 border-t border-[#282a2c] bg-[#1e1f20] text-[11px] text-[#9aa0a6] flex items-center justify-between">
          <span>Target model: <strong className="text-white">{config.model}</strong></span>
          <span>Google GenAI SDK v2.4+ compliant</span>
        </div>
      </div>
    </div>
  );
};
