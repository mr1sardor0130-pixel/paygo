import React, { useState } from 'react';
import {
  Search,
  Sparkles,
  Code,
  Image as ImageIcon,
  FileText,
  Boxes,
  Globe,
  ArrowRight,
  Zap,
} from 'lucide-react';
import { PresetTemplate, PromptMode, AppLanguage } from '../types';
import { PRESET_TEMPLATES } from '../lib/constants';
import { translations } from '../lib/translations';

interface PromptGalleryViewProps {
  onSelectTemplate: (template: PresetTemplate) => void;
  language: AppLanguage;
}

export const PromptGalleryView: React.FC<PromptGalleryViewProps> = ({
  onSelectTemplate,
  language,
}) => {
  const t = translations[language];
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const categories = [
    { id: 'all', name: t.allCategories, icon: Sparkles },
    { id: 'uzbek', name: t.categoryUzbek, icon: Globe },
    { id: 'code', name: t.categoryCode, icon: Code },
    { id: 'nlp', name: t.categoryNlp, icon: FileText },
    { id: 'vision', name: t.categoryVision, icon: ImageIcon },
    { id: 'business', name: t.categoryBusiness, icon: Boxes },
    { id: 'creative', name: t.categoryCreative, icon: Zap },
  ];

  const filteredTemplates = PRESET_TEMPLATES.filter((tpl) => {
    const matchesCategory = selectedCategory === 'all' || tpl.category === selectedCategory;
    const matchesSearch =
      tpl.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tpl.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'Sparkles':
        return <Sparkles size={20} className="text-[#8ab4f8]" />;
      case 'Code':
        return <Code size={20} className="text-[#8ab4f8]" />;
      case 'FileText':
        return <FileText size={20} className="text-[#8ab4f8]" />;
      case 'Boxes':
        return <Boxes size={20} className="text-[#8ab4f8]" />;
      case 'Globe':
        return <Globe size={20} className="text-[#8ab4f8]" />;
      case 'Image':
        return <ImageIcon size={20} className="text-[#8ab4f8]" />;
      default:
        return <Sparkles size={20} className="text-[#8ab4f8]" />;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-3.5rem)] bg-[#131314] overflow-y-auto custom-scrollbar p-4 md:p-8">
      <div className="max-w-6xl mx-auto w-full space-y-6">
        {/* Banner */}
        <div className="bg-gradient-to-r from-[#1e1f20] via-[#282a2c] to-[#1e1f20] p-6 md:p-8 rounded-3xl border border-[#3c4043]/60 relative overflow-hidden shadow-xl">
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#8ab4f8]/10 text-[#8ab4f8] text-xs font-semibold mb-3 border border-[#8ab4f8]/20">
              <Sparkles size={13} />
              <span>Google Gemini 3.7 Templates</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              {t.promptLibraryTitle}
            </h1>
            <p className="text-xs md:text-sm text-[#9aa0a6] mt-2 leading-relaxed">
              {t.promptLibraryDesc}
            </p>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Category Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 custom-scrollbar">
            {categories.map((cat) => {
              const Icon = cat.icon;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                    selectedCategory === cat.id
                      ? 'bg-[#8ab4f8] text-[#131314] font-semibold shadow-sm'
                      : 'bg-[#1e1f20] text-[#9aa0a6] hover:text-white hover:bg-[#282a2c] border border-[#282a2c]'
                  }`}
                >
                  <Icon size={13} />
                  <span>{cat.name}</span>
                </button>
              );
            })}
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-2.5 text-[#9aa0a6]" />
            <input
              type="text"
              placeholder="Search prompts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#1e1f20] text-xs text-[#e3e3e3] pl-8 pr-3 py-2 rounded-xl border border-[#282a2c] focus:border-[#8ab4f8] outline-none"
            />
          </div>
        </div>

        {/* Prompt Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((template) => (
            <div
              key={template.id}
              className="bg-[#1e1f20] hover:bg-[#282a2c] border border-[#282a2c] hover:border-[#8ab4f8]/50 rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 group shadow-sm hover:shadow-md"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-[#131314] border border-[#3c4043] flex items-center justify-center">
                    {getIcon(template.iconName)}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {template.badge && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#8ab4f8]/10 text-[#8ab4f8] border border-[#8ab4f8]/20">
                        {template.badge}
                      </span>
                    )}
                    <span className="text-[10px] font-mono uppercase text-[#9aa0a6] bg-[#131314] px-2 py-0.5 rounded border border-[#282a2c]">
                      {template.mode}
                    </span>
                  </div>
                </div>

                <h3 className="text-sm font-semibold text-white group-hover:text-[#8ab4f8] transition-colors">
                  {template.title}
                </h3>
                <p className="text-xs text-[#9aa0a6] mt-1.5 line-clamp-3 leading-relaxed">
                  {template.description}
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-[#282a2c]/80 flex items-center justify-between">
                <span className="text-[11px] font-mono text-[#9aa0a6]">
                  {template.config?.model || 'gemini-3.7-flash'}
                </span>

                <button
                  onClick={() => onSelectTemplate(template)}
                  className="flex items-center gap-1 text-xs font-semibold text-[#8ab4f8] group-hover:text-white group-hover:bg-[#8ab4f8] group-hover:text-[#131314] px-3 py-1.5 rounded-xl transition-all"
                >
                  <span>{t.usePrompt}</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
