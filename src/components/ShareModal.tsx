import React, { useState, useRef } from 'react';
import {
  X,
  Share2,
  Copy,
  Check,
  Download,
  Upload,
  Link2,
  FileJson,
} from 'lucide-react';
import { SavedPrompt, AppLanguage } from '../types';
import { translations } from '../lib/translations';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPromptData: SavedPrompt;
  onImportPrompt: (data: SavedPrompt) => void;
  language: AppLanguage;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  currentPromptData,
  onImportPrompt,
  language,
}) => {
  const t = translations[language];
  const [isCopiedLink, setIsCopiedLink] = useState(false);
  const [isCopiedJson, setIsCopiedJson] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const promptJson = JSON.stringify(currentPromptData, null, 2);
  const shareableUrl = window.location.href;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareableUrl);
    setIsCopiedLink(true);
    setTimeout(() => setIsCopiedLink(false), 2000);
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(promptJson);
    setIsCopiedJson(true);
    setTimeout(() => setIsCopiedJson(false), 2000);
  };

  const handleExportJson = () => {
    const blob = new Blob([promptJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${currentPromptData.title.toLowerCase().replace(/\s+/g, '_') || 'prompt'}_ai_studio.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.mode && parsed.config) {
          onImportPrompt(parsed);
          onClose();
        } else {
          alert('Invalid Google AI Studio prompt JSON format.');
        }
      } catch (err) {
        alert('Error parsing JSON file.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#1e1f20] border border-[#3c4043] rounded-2xl w-full max-w-lg flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-4 border-b border-[#282a2c] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Share2 size={18} className="text-[#8ab4f8]" />
            <h3 className="text-sm font-semibold text-white">Share & Export Prompt</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#9aa0a6] hover:text-white hover:bg-[#282a2c] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Share Link */}
          <div>
            <label className="text-xs font-semibold text-[#9aa0a6] block mb-1.5">
              Direct Application Link
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={shareableUrl}
                className="flex-1 bg-[#131314] text-xs text-[#e3e3e3] px-3 py-2 rounded-xl border border-[#282a2c] outline-none"
              />
              <button
                onClick={handleCopyLink}
                className="px-3 py-2 bg-[#8ab4f8] text-[#131314] text-xs font-semibold rounded-xl hover:bg-[#a8c7fa] transition-colors flex items-center gap-1 shrink-0"
              >
                {isCopiedLink ? <Check size={13} /> : <Link2 size={13} />}
                <span>{isCopiedLink ? t.copied : 'Copy Link'}</span>
              </button>
            </div>
          </div>

          {/* Export / Import JSON */}
          <div className="pt-2 border-t border-[#282a2c]">
            <label className="text-xs font-semibold text-[#9aa0a6] block mb-2">
              JSON Prompt Bundle
            </label>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleExportJson}
                className="p-3 bg-[#131314] hover:bg-[#282a2c] border border-[#282a2c] hover:border-[#8ab4f8]/50 rounded-xl text-left transition-colors flex flex-col justify-between"
              >
                <Download size={16} className="text-[#8ab4f8] mb-1.5" />
                <div className="text-xs font-semibold text-white">{t.exportJson}</div>
                <div className="text-[10px] text-[#9aa0a6]">Download .json file</div>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-3 bg-[#131314] hover:bg-[#282a2c] border border-[#282a2c] hover:border-[#8ab4f8]/50 rounded-xl text-left transition-colors flex flex-col justify-between"
              >
                <Upload size={16} className="text-[#8ab4f8] mb-1.5" />
                <div className="text-xs font-semibold text-white">{t.importJson}</div>
                <div className="text-[10px] text-[#9aa0a6]">Load prompt from file</div>
              </button>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImportFile}
                accept=".json"
                className="hidden"
              />
            </div>
          </div>

          {/* Raw JSON preview */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] text-[#9aa0a6]">Configuration JSON:</span>
              <button
                onClick={handleCopyJson}
                className="text-xs text-[#8ab4f8] hover:underline flex items-center gap-1"
              >
                {isCopiedJson ? <Check size={11} /> : <Copy size={11} />}
                <span>{isCopiedJson ? t.copied : 'Copy JSON'}</span>
              </button>
            </div>
            <pre className="bg-[#131314] text-[10px] font-mono text-[#9aa0a6] p-3 rounded-xl border border-[#282a2c] max-h-32 overflow-y-auto custom-scrollbar">
              <code>{promptJson}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
