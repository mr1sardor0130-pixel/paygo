import React, { useState } from 'react';
import {
  Sparkles,
  Code2,
  Share2,
  Save,
  Check,
  Globe,
  Sliders,
  PanelLeftClose,
  PanelLeft,
  PanelRightClose,
  PanelRight,
  MessageSquare,
  FileText,
  Boxes,
  LayoutGrid,
} from 'lucide-react';
import { PromptMode, AppLanguage } from '../types';
import { translations } from '../lib/translations';

interface HeaderProps {
  mode: PromptMode;
  setMode: (mode: PromptMode) => void;
  title: string;
  setTitle: (title: string) => void;
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  isParamsOpen: boolean;
  setIsParamsOpen: (open: boolean) => void;
  onOpenGetCode: () => void;
  onOpenShare: () => void;
  onSavePrompt: () => void;
  isSaved: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  mode,
  setMode,
  title,
  setTitle,
  language,
  setLanguage,
  isSidebarOpen,
  setIsSidebarOpen,
  isParamsOpen,
  setIsParamsOpen,
  onOpenGetCode,
  onOpenShare,
  onSavePrompt,
  isSaved,
}) => {
  const t = translations[language];
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  return (
    <header className="h-14 border-b border-[#282a2c] bg-[#1e1f20] px-3 flex items-center justify-between select-none z-30 shrink-0">
      {/* Left section: Logo, Sidebar Toggle, and Title */}
      <div className="flex items-center gap-2 md:gap-3 min-w-0">
        <button
          id="toggle-sidebar-btn"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-1.5 rounded-lg text-[#9aa0a6] hover:text-[#e3e3e3] hover:bg-[#282a2c] transition-colors"
          title="Toggle Navigation"
        >
          {isSidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
        </button>

        {/* Google AI Studio Logo */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1a73e8] via-[#8ab4f8] to-[#ea4335] p-0.5 flex items-center justify-center shadow-sm">
            <div className="w-full h-full bg-[#1e1f20] rounded-[6px] flex items-center justify-center">
              <Sparkles size={16} className="text-[#8ab4f8]" />
            </div>
          </div>
          <span className="font-medium text-[15px] tracking-tight hidden sm:inline text-white">
            Google <span className="text-[#8ab4f8] font-semibold">AI Studio</span>
          </span>
        </div>

        <div className="h-4 w-px bg-[#3c4043] hidden sm:block mx-1" />

        {/* Editable Title */}
        <div className="flex items-center min-w-0">
          {isEditingTitle ? (
            <input
              id="prompt-title-input"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => setIsEditingTitle(false)}
              onKeyDown={(e) => e.key === 'Enter' && setIsEditingTitle(false)}
              autoFocus
              className="bg-[#131314] text-white text-sm px-2 py-1 rounded border border-[#8ab4f8] outline-none max-w-[180px] sm:max-w-[240px]"
            />
          ) : (
            <button
              id="prompt-title-btn"
              onClick={() => setIsEditingTitle(true)}
              className="text-sm font-medium text-[#e3e3e3] hover:text-white px-2 py-1 rounded hover:bg-[#282a2c] transition-colors truncate max-w-[140px] sm:max-w-[220px] text-left"
              title="Click to rename"
            >
              {title || t.untitledPrompt}
            </button>
          )}
        </div>
      </div>

      {/* Middle section: Mode Selector Tabs */}
      <div className="hidden lg:flex items-center bg-[#131314] p-1 rounded-xl border border-[#282a2c]">
        <button
          id="mode-chat-btn"
          onClick={() => setMode('chat')}
          className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg transition-all ${
            mode === 'chat'
              ? 'bg-[#282a2c] text-[#8ab4f8] shadow-sm'
              : 'text-[#9aa0a6] hover:text-[#e3e3e3]'
          }`}
        >
          <MessageSquare size={14} />
          <span>{t.chatPrompt}</span>
        </button>

        <button
          id="mode-freeform-btn"
          onClick={() => setMode('freeform')}
          className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg transition-all ${
            mode === 'freeform'
              ? 'bg-[#282a2c] text-[#8ab4f8] shadow-sm'
              : 'text-[#9aa0a6] hover:text-[#e3e3e3]'
          }`}
        >
          <FileText size={14} />
          <span>{t.freeformPrompt}</span>
        </button>

        <button
          id="mode-structured-btn"
          onClick={() => setMode('structured')}
          className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg transition-all ${
            mode === 'structured'
              ? 'bg-[#282a2c] text-[#8ab4f8] shadow-sm'
              : 'text-[#9aa0a6] hover:text-[#e3e3e3]'
          }`}
        >
          <Boxes size={14} />
          <span>{t.structuredPrompt}</span>
        </button>

        <button
          id="mode-gallery-btn"
          onClick={() => setMode('gallery')}
          className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg transition-all ${
            mode === 'gallery'
              ? 'bg-[#282a2c] text-[#8ab4f8] shadow-sm'
              : 'text-[#9aa0a6] hover:text-[#e3e3e3]'
          }`}
        >
          <LayoutGrid size={14} />
          <span>{t.promptGallery}</span>
        </button>
      </div>

      {/* Right section: Actions (Get Code, Save, Share, Language, Toggle Params) */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Language selector */}
        <div className="relative group">
          <button
            id="language-select-btn"
            className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg text-[#9aa0a6] hover:text-white hover:bg-[#282a2c] transition-colors border border-[#3c4043]/50"
            title="Switch Language"
          >
            <Globe size={14} />
            <span className="uppercase font-semibold text-[11px]">{language}</span>
          </button>
          <div className="absolute right-0 mt-1 w-28 py-1 bg-[#1e1f20] border border-[#3c4043] rounded-lg shadow-xl hidden group-hover:block z-50">
            <button
              onClick={() => setLanguage('uz')}
              className={`w-full px-3 py-1.5 text-left text-xs hover:bg-[#282a2c] flex items-center justify-between ${language === 'uz' ? 'text-[#8ab4f8] font-medium' : 'text-[#e3e3e3]'}`}
            >
              <span>🇺🇿 O'zbekcha</span>
              {language === 'uz' && <Check size={12} />}
            </button>
            <button
              onClick={() => setLanguage('en')}
              className={`w-full px-3 py-1.5 text-left text-xs hover:bg-[#282a2c] flex items-center justify-between ${language === 'en' ? 'text-[#8ab4f8] font-medium' : 'text-[#e3e3e3]'}`}
            >
              <span>🇬🇧 English</span>
              {language === 'en' && <Check size={12} />}
            </button>
            <button
              onClick={() => setLanguage('ru')}
              className={`w-full px-3 py-1.5 text-left text-xs hover:bg-[#282a2c] flex items-center justify-between ${language === 'ru' ? 'text-[#8ab4f8] font-medium' : 'text-[#e3e3e3]'}`}
            >
              <span>🇷🇺 Русский</span>
              {language === 'ru' && <Check size={12} />}
            </button>
          </div>
        </div>

        {/* Save button */}
        <button
          id="save-prompt-btn"
          onClick={onSavePrompt}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#e3e3e3] hover:text-white bg-[#282a2c] hover:bg-[#3c4043] border border-[#3c4043] transition-colors"
          title="Save prompt to workspace"
        >
          {isSaved ? (
            <>
              <Check size={14} className="text-[#34a853]" />
              <span className="hidden sm:inline text-[#34a853]">{t.saved}</span>
            </>
          ) : (
            <>
              <Save size={14} />
              <span className="hidden sm:inline">{t.save}</span>
            </>
          )}
        </button>

        {/* Get Code button */}
        <button
          id="get-code-btn"
          onClick={onOpenGetCode}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#131314] bg-[#8ab4f8] hover:bg-[#a8c7fa] transition-colors shadow-sm"
          title="Get API Code in Python, JS, cURL"
        >
          <Code2 size={15} />
          <span className="font-semibold">{t.getCode}</span>
        </button>

        {/* Share button */}
        <button
          id="share-btn"
          onClick={onOpenShare}
          className="p-1.5 rounded-lg text-[#9aa0a6] hover:text-white hover:bg-[#282a2c] transition-colors"
          title="Share or Export"
        >
          <Share2 size={16} />
        </button>

        {/* Toggle Parameters Sidebar */}
        <button
          id="toggle-params-btn"
          onClick={() => setIsParamsOpen(!isParamsOpen)}
          className={`p-1.5 rounded-lg transition-colors ${
            isParamsOpen
              ? 'text-[#8ab4f8] bg-[#282a2c]'
              : 'text-[#9aa0a6] hover:text-white hover:bg-[#282a2c]'
          }`}
          title="Toggle Model Settings"
        >
          {isParamsOpen ? <PanelRightClose size={18} /> : <PanelRight size={18} />}
        </button>
      </div>
    </header>
  );
};
