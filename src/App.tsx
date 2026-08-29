import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { ModelParameters } from './components/ModelParameters';
import { ChatPromptView } from './components/ChatPromptView';
import { FreeformPromptView } from './components/FreeformPromptView';
import { StructuredPromptView } from './components/StructuredPromptView';
import { PromptGalleryView } from './components/PromptGalleryView';
import { GetCodeModal } from './components/GetCodeModal';
import { ShareModal } from './components/ShareModal';
import {
  PromptMode,
  ModelConfig,
  ChatMessage,
  VariableTestCase,
  StructuredRow,
  SavedPrompt,
  PresetTemplate,
  AppLanguage,
  AttachedFile,
} from './types';
import { DEFAULT_MODEL_CONFIG, PRESET_TEMPLATES } from './lib/constants';

export default function App() {
  // Global App States
  const [mode, setMode] = useState<PromptMode>('chat');
  const [title, setTitle] = useState<string>("Google AI Studio Demo");
  const [language, setLanguage] = useState<AppLanguage>('uz');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isParamsOpen, setIsParamsOpen] = useState(true);
  const [isSaved, setIsSaved] = useState(false);

  // Modals
  const [isGetCodeOpen, setIsGetCodeOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);

  // Model Parameters Config
  const [config, setConfig] = useState<ModelConfig>(DEFAULT_MODEL_CONFIG);

  // Chat Prompt View State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Freeform Prompt View State
  const [freeformText, setFreeformText] = useState<string>(
    "Siz aqlli AI yordamchisiz. {{topic}} mavzusida {{audience}} uchun {{tone}} uslubida tushunarli maqola yozib bering."
  );
  const [testCases, setTestCases] = useState<VariableTestCase[]>([
    {
      id: '1',
      variables: {
        topic: 'Sun\'iy intellekt va robototexnika kelajagi',
        audience: 'Maktab va universitet talabalari',
        tone: 'Qiziqarli, ilhomlantiruvchi va sodda',
      },
    },
    {
      id: '2',
      variables: {
        topic: 'Google Gemini 3.7 va multimodal AI imkoniyatlari',
        audience: 'Senior dasturchilar va startap asoschilari',
        tone: 'Texnik jihatdan chuqur va professional',
      },
    },
  ]);

  // Structured Prompt View State
  const [structuredRows, setStructuredRows] = useState<StructuredRow[]>([
    {
      id: '1',
      input: 'Google AI Studio nima?',
      output: 'Google AI Studio — bu Gemini modellari bilan prototip yaratish, promptlarni sinash va ishlab chiqarish uchun API kodini olish imkonini beruvchi rasmiy dasturchilar muhitidir.',
    },
    {
      id: '2',
      input: 'Gemini 3.7 Flash ning asosiy afzalligi nima?',
      output: 'Gemini 3.7 Flash yuqori tezlik, past kechikish, chuqur fikrlash (reasoning) va multimodal (matn, rasm, audio) ma\'lumotlar bilan ishlash bo\'yicha ajoyib samaradorlik beradi.',
    },
  ]);
  const [inputPrefix, setInputPrefix] = useState<string>('Savol');
  const [outputPrefix, setOutputPrefix] = useState<string>('Javob');

  // Saved Prompts list (stored in localStorage)
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>(() => {
    try {
      const stored = localStorage.getItem('google_ai_studio_saved_prompts');
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error('Error loading saved prompts from localStorage:', e);
    }
    return [
      {
        id: 'default-1',
        title: 'Gemini 3.7 Uzbek Expert',
        mode: 'chat',
        date: new Date().toISOString(),
        config: { ...DEFAULT_MODEL_CONFIG, systemInstruction: "Siz o'zbek tilida yuqori aniqlikda javob beruvchi mutaxassissiz." },
      },
    ];
  });

  // Save prompts to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('google_ai_studio_saved_prompts', JSON.stringify(savedPrompts));
    } catch (e) {
      console.error('Error saving prompts to localStorage:', e);
    }
  }, [savedPrompts]);

  // Token count calculation (rough estimate)
  const inputTokenCount = React.useMemo(() => {
    let raw = config.systemInstruction;
    if (mode === 'chat') {
      raw += chatMessages.map((m) => m.text).join(' ');
    } else if (mode === 'freeform') {
      raw += freeformText;
    } else if (mode === 'structured') {
      raw += structuredRows.map((r) => r.input + ' ' + r.output).join(' ');
    }
    return Math.max(0, Math.ceil(raw.length / 4));
  }, [config.systemInstruction, mode, chatMessages, freeformText, structuredRows]);

  const outputTokenCount = React.useMemo(() => {
    if (mode === 'chat') {
      const modelMsgs = chatMessages.filter((m) => m.role === 'model').map((m) => m.text).join(' ');
      return Math.max(0, Math.ceil(modelMsgs.length / 4));
    }
    return 0;
  }, [mode, chatMessages]);

  const handleConfigChange = (newConfig: Partial<ModelConfig>) => {
    setConfig((prev) => ({ ...prev, ...newConfig }));
    setIsSaved(false);
  };

  // Send message in Chat mode with SSE Streaming
  const handleSendMessage = async (text: string, files?: AttachedFile[]) => {
    if (isGenerating) return;

    const userMessage: ChatMessage = {
      id: Math.random().toString(36).substring(2, 9),
      role: 'user',
      text,
      files,
      timestamp: Date.now(),
    };

    const newMessages = [...chatMessages, userMessage];
    setChatMessages(newMessages);
    setIsGenerating(true);
    setIsSaved(false);

    const modelMsgId = Math.random().toString(36).substring(2, 9);
    const initialModelMessage: ChatMessage = {
      id: modelMsgId,
      role: 'model',
      text: '',
      timestamp: Date.now(),
      isStreaming: true,
    };

    setChatMessages([...newMessages, initialModelMessage]);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      // Format turns for API
      const contentsPayload = newMessages.map((msg) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        text: msg.text,
        files: msg.files?.map((f) => ({ data: f.data, mimeType: f.mimeType })),
      }));

      const res = await fetch('/api/generate-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: config.model,
          contents: contentsPayload,
          systemInstruction: config.systemInstruction,
          temperature: config.temperature,
          topP: config.topP,
          topK: config.topK,
          maxOutputTokens: config.maxOutputTokens,
          responseMimeType: config.responseMimeType,
          responseSchema: config.responseSchema ? JSON.parse(config.responseSchema || '{}') : undefined,
          enableGoogleSearch: config.enableGoogleSearch,
          thinkingLevel: config.thinkingLevel,
          safetySettings: config.safetySettings,
        }),
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('Could not establish stream reader.');

      let accumulatedText = '';
      let groundingMetadata: any = null;
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
                accumulatedText += parsed.text || '';
                if (parsed.searchGrounding) {
                  groundingMetadata = parsed.searchGrounding;
                }
                setChatMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === modelMsgId
                      ? {
                          ...msg,
                          text: accumulatedText,
                          groundingMetadata: groundingMetadata || msg.groundingMetadata,
                        }
                      : msg
                  )
                );
              } else if (parsed.type === 'error') {
                throw new Error(parsed.error);
              }
            } catch (err) {
              console.error('Error parsing SSE chunk:', err);
            }
          }
        }
      }

      setChatMessages((prev) =>
        prev.map((msg) => (msg.id === modelMsgId ? { ...msg, isStreaming: false } : msg))
      );
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setChatMessages((prev) =>
          prev.map((msg) =>
            msg.id === modelMsgId
              ? {
                  ...msg,
                  isStreaming: false,
                  error: err.message || 'Failed to generate response.',
                }
              : msg
          )
        );
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsGenerating(false);
    }
  };

  const handleClearChat = () => {
    handleStopGeneration();
    setChatMessages([]);
  };

  const handleRetryLastMessage = () => {
    if (chatMessages.length === 0) return;
    const lastUserIndex = [...chatMessages].reverse().findIndex((m) => m.role === 'user');
    if (lastUserIndex === -1) return;

    const actualIndex = chatMessages.length - 1 - lastUserIndex;
    const userMsg = chatMessages[actualIndex];
    setChatMessages(chatMessages.slice(0, actualIndex));
    handleSendMessage(userMsg.text, userMsg.files);
  };

  // Save current prompt configuration
  const handleSavePrompt = () => {
    const newSaved: SavedPrompt = {
      id: Math.random().toString(36).substring(2, 9),
      title: title || 'Untitled Prompt',
      mode,
      date: new Date().toISOString(),
      config,
      chatMessages: mode === 'chat' ? chatMessages : undefined,
      freeformText: mode === 'freeform' ? freeformText : undefined,
      testCases: mode === 'freeform' ? testCases : undefined,
      structuredRows: mode === 'structured' ? structuredRows : undefined,
      structuredInputPrefix: inputPrefix,
      structuredOutputPrefix: outputPrefix,
    };

    setSavedPrompts((prev) => [newSaved, ...prev.filter((p) => p.title !== newSaved.title)]);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  // Load a saved prompt
  const handleLoadPrompt = (p: SavedPrompt) => {
    setMode(p.mode);
    setTitle(p.title);
    if (p.config) setConfig(p.config);
    if (p.chatMessages) setChatMessages(p.chatMessages);
    if (p.freeformText) setFreeformText(p.freeformText);
    if (p.testCases) setTestCases(p.testCases);
    if (p.structuredRows) setStructuredRows(p.structuredRows);
    if (p.structuredInputPrefix) setInputPrefix(p.structuredInputPrefix);
    if (p.structuredOutputPrefix) setOutputPrefix(p.structuredOutputPrefix);
  };

  // Delete saved prompt
  const handleDeletePrompt = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSavedPrompts((prev) => prev.filter((p) => p.id !== id));
  };

  // Start new prompt
  const handleNewPrompt = (newMode: PromptMode) => {
    handleStopGeneration();
    setMode(newMode);
    setTitle(
      newMode === 'chat'
        ? 'New Chat Prompt'
        : newMode === 'freeform'
        ? 'New Freeform Prompt'
        : 'New Structured Prompt'
    );
    setChatMessages([]);
    setConfig(DEFAULT_MODEL_CONFIG);
  };

  // Select a preset template from the gallery
  const handleSelectTemplate = (template: PresetTemplate) => {
    setMode(template.mode);
    setTitle(template.title);
    if (template.config) {
      setConfig((prev) => ({ ...prev, ...template.config }));
    }
    if (template.initialChat) {
      setChatMessages(
        template.initialChat.map((m) => ({
          id: Math.random().toString(36).substring(2, 9),
          role: m.role,
          text: m.text,
          timestamp: Date.now(),
        }))
      );
    }
    if (template.freeformText) setFreeformText(template.freeformText);
    if (template.testCases) setTestCases(template.testCases);
    if (template.structuredRows) setStructuredRows(template.structuredRows);
  };

  // Current prompt data bundle for sharing / export
  const currentPromptBundle: SavedPrompt = {
    id: 'current',
    title: title || 'Google AI Studio Prompt',
    mode,
    date: new Date().toISOString(),
    config,
    chatMessages,
    freeformText,
    testCases,
    structuredRows,
    structuredInputPrefix: inputPrefix,
    structuredOutputPrefix: outputPrefix,
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#131314] text-[#e3e3e3]">
      {/* Top Main Navigation Header */}
      <Header
        mode={mode}
        setMode={setMode}
        title={title}
        setTitle={setTitle}
        language={language}
        setLanguage={setLanguage}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        isParamsOpen={isParamsOpen}
        setIsParamsOpen={setIsParamsOpen}
        onOpenGetCode={() => setIsGetCodeOpen(true)}
        onOpenShare={() => setIsShareOpen(true)}
        onSavePrompt={handleSavePrompt}
        isSaved={isSaved}
      />

      {/* Center Layout: Left Sidebar + Active View + Right Model Parameters */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar
          isOpen={isSidebarOpen}
          mode={mode}
          setMode={setMode}
          language={language}
          savedPrompts={savedPrompts}
          onLoadPrompt={handleLoadPrompt}
          onDeletePrompt={handleDeletePrompt}
          onNewPrompt={handleNewPrompt}
        />

        {/* Main Content Area based on active mode */}
        <main className="flex-1 flex overflow-hidden">
          {mode === 'chat' && (
            <ChatPromptView
              messages={chatMessages}
              onSendMessage={handleSendMessage}
              onStopGeneration={handleStopGeneration}
              onClearChat={handleClearChat}
              onRetryLastMessage={handleRetryLastMessage}
              isGenerating={isGenerating}
              config={config}
              language={language}
            />
          )}

          {mode === 'freeform' && (
            <FreeformPromptView
              freeformText={freeformText}
              setFreeformText={setFreeformText}
              testCases={testCases}
              setTestCases={setTestCases}
              config={config}
              language={language}
            />
          )}

          {mode === 'structured' && (
            <StructuredPromptView
              rows={structuredRows}
              setRows={setStructuredRows}
              inputPrefix={inputPrefix}
              setInputPrefix={setInputPrefix}
              outputPrefix={outputPrefix}
              setOutputPrefix={setOutputPrefix}
              config={config}
              language={language}
            />
          )}

          {mode === 'gallery' && (
            <PromptGalleryView
              onSelectTemplate={handleSelectTemplate}
              language={language}
            />
          )}
        </main>

        {/* Right Model Settings Sidebar */}
        {mode !== 'gallery' && (
          <ModelParameters
            isOpen={isParamsOpen}
            config={config}
            onChangeConfig={handleConfigChange}
            language={language}
            inputTokenCount={inputTokenCount}
            outputTokenCount={outputTokenCount}
          />
        )}
      </div>

      {/* Get Code Modal */}
      <GetCodeModal
        isOpen={isGetCodeOpen}
        onClose={() => setIsGetCodeOpen(false)}
        mode={mode}
        config={config}
        chatMessages={chatMessages}
        freeformText={freeformText}
        language={language}
      />

      {/* Share & Export Modal */}
      <ShareModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        currentPromptData={currentPromptBundle}
        onImportPrompt={handleLoadPrompt}
        language={language}
      />
    </div>
  );
}
