import React, { useState } from 'react';
import {
  Plus,
  MessageSquare,
  FileText,
  Boxes,
  LayoutGrid,
  History,
  Trash2,
  BookOpen,
  Sparkles,
  Search,
  CheckCircle2,
  ChevronDown,
} from 'lucide-react';
import { PromptMode, AppLanguage, SavedPrompt } from '../types';
import { translations } from '../lib/translations';

interface SidebarProps {
  isOpen: boolean;
  mode: PromptMode;
  setMode: (mode: PromptMode) => void;
  language: AppLanguage;
  savedPrompts: SavedPrompt[];
  onLoadPrompt: (prompt: SavedPrompt) => void;
  onDeletePrompt: (id: string, e: React.MouseEvent) => void;
  onNewPrompt: (newMode: PromptMode) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  mode,
  setMode,
  language,
  savedPrompts,
  onLoadPrompt,
  onDeletePrompt,
  onNewPrompt,
}) => {
  const t = translations[language];
  const [searchTerm, setSearchTerm] = useState('');
  const [isNewMenuOpen, setIsNewMenuOpen] = useState(false);

  if (!isOpen) return null;

  const filteredPrompts = savedPrompts.filter((p) =>
    p.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <aside className="w-64 border-r border-[#282a2c] bg-[#1e1f20] flex flex-col h-[calc(100vh-3.5rem)] shrink-0 select-none z-20 transition-all duration-200">
      {/* New Prompt Action Button */}
      <div className="p-3 border-b border-[#282a2c]/80 relative">
        <button
          id="new-prompt-dropdown-btn"
          onClick={() => setIsNewMenuOpen(!isNewMenuOpen)}
          className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#8ab4f8] text-[#131314] font-semibold text-xs hover:bg-[#a8c7fa] transition-all shadow-sm group"
        >
          <div className="flex items-center gap-2">
            <Plus size={16} className="transition-transform group-hover:rotate-90" />
            <span>{language === 'uz' ? 'Yangi Prompt' : language === 'ru' ? 'Новый промпт' : 'New Prompt'}</span>
          </div>
          <ChevronDown size={14} className={`transition-transform ${isNewMenuOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown for Prompt Types */}
        {isNewMenuOpen && (
          <div className="absolute left-3 right-3 top-16 bg-[#131314] border border-[#3c4043] rounded-xl shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
            <button
              onClick={() => {
                onNewPrompt('chat');
                setIsNewMenuOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-[#e3e3e3] hover:text-white hover:bg-[#282a2c] rounded-lg transition-colors text-left"
            >
              <MessageSquare size={14} className="text-[#8ab4f8]" />
              <div>
                <div className="font-medium">{t.chatPrompt}</div>
                <div className="text-[10px] text-[#9aa0a6]">Multi-turn conversation</div>
              </div>
            </button>

            <button
              onClick={() => {
                onNewPrompt('freeform');
                setIsNewMenuOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-[#e3e3e3] hover:text-white hover:bg-[#282a2c] rounded-lg transition-colors text-left"
            >
              <FileText size={14} className="text-[#8ab4f8]" />
              <div>
                <div className="font-medium">{t.freeformPrompt}</div>
                <div className="text-[10px] text-[#9aa0a6]">Variables & test rows</div>
              </div>
            </button>

            <button
              onClick={() => {
                onNewPrompt('structured');
                setIsNewMenuOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-[#e3e3e3] hover:text-white hover:bg-[#282a2c] rounded-lg transition-colors text-left"
            >
              <Boxes size={14} className="text-[#8ab4f8]" />
              <div>
                <div className="font-medium">{t.structuredPrompt}</div>
                <div className="text-[10px] text-[#9aa0a6]">Few-shot table schema</div>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* Main Navigation Links */}
      <div className="p-2 space-y-1">
        <button
          onClick={() => setMode('chat')}
          className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs rounded-lg font-medium transition-colors ${
            mode === 'chat'
              ? 'bg-[#282a2c] text-[#8ab4f8]'
              : 'text-[#9aa0a6] hover:text-[#e3e3e3] hover:bg-[#282a2c]/60'
          }`}
        >
          <MessageSquare size={16} />
          <span>{t.chatPrompt}</span>
        </button>

        <button
          onClick={() => setMode('freeform')}
          className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs rounded-lg font-medium transition-colors ${
            mode === 'freeform'
              ? 'bg-[#282a2c] text-[#8ab4f8]'
              : 'text-[#9aa0a6] hover:text-[#e3e3e3] hover:bg-[#282a2c]/60'
          }`}
        >
          <FileText size={16} />
          <span>{t.freeformPrompt}</span>
        </button>

        <button
          onClick={() => setMode('structured')}
          className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs rounded-lg font-medium transition-colors ${
            mode === 'structured'
              ? 'bg-[#282a2c] text-[#8ab4f8]'
              : 'text-[#9aa0a6] hover:text-[#e3e3e3] hover:bg-[#282a2c]/60'
          }`}
        >
          <Boxes size={16} />
          <span>{t.structuredPrompt}</span>
        </button>

        <button
          onClick={() => setMode('gallery')}
          className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs rounded-lg font-medium transition-colors ${
            mode === 'gallery'
              ? 'bg-[#282a2c] text-[#8ab4f8]'
              : 'text-[#9aa0a6] hover:text-[#e3e3e3] hover:bg-[#282a2c]/60'
          }`}
        >
          <LayoutGrid size={16} />
          <span className="flex-1 text-left">{t.promptGallery}</span>
          <span className="text-[10px] bg-[#3c4043] text-[#8ab4f8] px-1.5 py-0.5 rounded-full font-mono">
            New
          </span>
        </button>
      </div>

      <div className="h-px bg-[#282a2c] mx-3 my-2" />

      {/* Saved Prompts Section */}
      <div className="flex-1 flex flex-col min-h-0 px-3 py-2">
        <div className="flex items-center justify-between text-[#9aa0a6] mb-2 px-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider">
            <History size={13} />
            <span>{t.recentPrompts}</span>
          </div>
          <span className="text-[11px] font-mono text-[#9aa0a6] bg-[#282a2c] px-1.5 py-0.5 rounded">
            {savedPrompts.length}
          </span>
        </div>

        {/* Search saved prompts */}
        {savedPrompts.length > 2 && (
          <div className="relative mb-2">
            <Search size={12} className="absolute left-2.5 top-2.5 text-[#9aa0a6]" />
            <input
              type="text"
              placeholder="Search history..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#131314] text-xs text-[#e3e3e3] pl-7 pr-2 py-1.5 rounded-lg border border-[#282a2c] focus:border-[#8ab4f8] outline-none"
            />
          </div>
        )}

        {/* List of saved prompts */}
        <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
          {savedPrompts.length === 0 ? (
            <div className="text-center py-8 text-[#9aa0a6] text-xs">
              <Sparkles size={24} className="mx-auto mb-2 opacity-40 text-[#8ab4f8]" />
              <p>{t.noSavedPrompts}</p>
            </div>
          ) : filteredPrompts.length === 0 ? (
            <div className="text-center py-4 text-[#9aa0a6] text-xs">
              No matching prompts found.
            </div>
          ) : (
            filteredPrompts.map((p) => (
              <div
                key={p.id}
                onClick={() => onLoadPrompt(p)}
                className="group flex items-center justify-between p-2 rounded-lg text-xs hover:bg-[#282a2c] cursor-pointer transition-colors border border-transparent hover:border-[#3c4043]"
              >
                <div className="min-w-0 flex-1 mr-1.5">
                  <div className="font-medium text-[#e3e3e3] group-hover:text-white truncate">
                    {p.title || t.untitledPrompt}
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-[#9aa0a6] mt-0.5">
                    <span className="uppercase font-mono text-[#8ab4f8]">{p.mode}</span>
                    <span>•</span>
                    <span>{new Date(p.date).toLocaleDateString()}</span>
                  </div>
                </div>
                <button
                  onClick={(e) => onDeletePrompt(p.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-[#9aa0a6] hover:text-[#ea4335] rounded transition-all"
                  title="Delete saved prompt"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Footer Info: Server Connection Status */}
      <div className="p-3 border-t border-[#282a2c] bg-[#1a1b1c] flex items-center justify-between text-xs text-[#9aa0a6]">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 size={13} className="text-[#34a853]" />
          <span className="text-[11px] font-medium text-[#e3e3e3]">Gemini 3.7 Ready</span>
        </div>
        <a
          href="https://ai.google.dev/gemini-api/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[11px] hover:text-[#8ab4f8] transition-colors"
        >
          <BookOpen size={12} />
          <span>Docs</span>
        </a>
      </div>
    </aside>
  );
};
