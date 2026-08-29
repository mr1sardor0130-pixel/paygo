import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Send,
  Square,
  Sparkles,
  Paperclip,
  Mic,
  MicOff,
  Image as ImageIcon,
  FileAudio,
  FileText,
  X,
  Copy,
  Check,
  RotateCcw,
  ExternalLink,
  Search,
  Trash2,
  Edit2,
  Terminal,
  Bot,
  User,
  AlertCircle,
} from 'lucide-react';
import { ChatMessage, AttachedFile, ModelConfig, AppLanguage } from '../types';
import { translations } from '../lib/translations';

interface ChatPromptViewProps {
  messages: ChatMessage[];
  onSendMessage: (text: string, files?: AttachedFile[]) => void;
  onStopGeneration: () => void;
  onClearChat: () => void;
  onRetryLastMessage: () => void;
  isGenerating: boolean;
  config: ModelConfig;
  language: AppLanguage;
}

export const ChatPromptView: React.FC<ChatPromptViewProps> = ({
  messages,
  onSendMessage,
  onStopGeneration,
  onClearChat,
  onRetryLastMessage,
  isGenerating,
  config,
  language,
}) => {
  const t = translations[language];
  const [inputText, setInputText] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Auto-scroll when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  // Handle textarea resize
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [inputText]);

  const handleSend = () => {
    if ((!inputText.trim() && attachedFiles.length === 0) || isGenerating) return;
    onSendMessage(inputText.trim(), attachedFiles.length > 0 ? attachedFiles : undefined);
    setInputText('');
    setAttachedFiles([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Handle file uploads (Images, Audio, Documents)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        let fileType: 'image' | 'audio' | 'document' = 'document';
        if (file.type.startsWith('image/')) fileType = 'image';
        else if (file.type.startsWith('audio/')) fileType = 'audio';

        const newFile: AttachedFile = {
          id: Math.random().toString(36).substring(2, 9),
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          data: base64,
          previewUrl: fileType === 'image' ? base64 : undefined,
          type: fileType,
        };

        setAttachedFiles((prev) => [...prev, newFile]);
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachedFile = (id: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Voice recording & transcription
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Audio = reader.result as string;
          setIsTranscribing(true);
          try {
            const res = await fetch('/api/transcribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                audioData: base64Audio,
                mimeType: 'audio/webm',
              }),
            });
            const data = await res.json();
            if (data.text) {
              setInputText((prev) => (prev ? `${prev} ${data.text}` : data.text));
            }
          } catch (err) {
            console.error('Audio transcription error:', err);
          } finally {
            setIsTranscribing(false);
          }
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Microphone access denied:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-3.5rem)] bg-[#131314] overflow-hidden relative">
      {/* Top Banner / System Instructions summary */}
      {config.systemInstruction && (
        <div className="bg-[#1e1f20]/90 border-b border-[#282a2c] px-4 py-2 flex items-center justify-between text-xs text-[#9aa0a6] backdrop-blur-sm z-10">
          <div className="flex items-center gap-2 truncate">
            <span className="font-semibold text-[#8ab4f8]">System:</span>
            <span className="truncate max-w-xl italic">"{config.systemInstruction}"</span>
          </div>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 custom-scrollbar">
        {messages.length === 0 ? (
          <div className="max-w-xl mx-auto text-center pt-16 pb-8 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#1e1f20] border border-[#3c4043] flex items-center justify-center mx-auto shadow-lg">
              <Sparkles size={24} className="text-[#8ab4f8]" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Google AI Studio Chat</h3>
              <p className="text-xs text-[#9aa0a6] mt-1 max-w-md mx-auto leading-relaxed">
                {language === 'uz'
                  ? "Gemini modeliga savol bering, kod yozdiring, rasm yoki audio fayllarni tahlil qildiring."
                  : "Start a multi-turn chat with Gemini. Test reasoning, multimodal inputs, search grounding, or system instructions."}
              </p>
            </div>

            {/* Quick Starters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-4 text-left max-w-md mx-auto">
              <button
                onClick={() =>
                  setInputText(
                    language === 'uz'
                      ? "O'zbekistonda IT sohasining rivojlanishi haqida qisqa tahlil yozib ber."
                      : "Write a high-performance TypeScript debounce function with generics and unit tests."
                  )
                }
                className="p-3 rounded-xl bg-[#1e1f20] hover:bg-[#282a2c] border border-[#282a2c] hover:border-[#8ab4f8]/50 text-xs text-[#e3e3e3] transition-all text-left"
              >
                <div className="font-medium text-[#8ab4f8]">
                  {language === 'uz' ? "🚀 Tahlil & Maqola" : "⚡ TypeScript Function"}
                </div>
                <div className="text-[11px] text-[#9aa0a6] mt-0.5 truncate">
                  {language === 'uz' ? "IT rivojlanishi tahlili" : "Debounce with generics"}
                </div>
              </button>

              <button
                onClick={() =>
                  setInputText(
                    language === 'uz'
                      ? "React 19 va Tailwind CSS da zamonaviy Dashboard komponenti yaratib ber."
                      : "Explain quantum computing principles using a simple everyday analogy."
                  )
                }
                className="p-3 rounded-xl bg-[#1e1f20] hover:bg-[#282a2c] border border-[#282a2c] hover:border-[#8ab4f8]/50 text-xs text-[#e3e3e3] transition-all text-left"
              >
                <div className="font-medium text-[#8ab4f8]">
                  {language === 'uz' ? "💻 UI Komponent" : "🧠 Quantum Analogy"}
                </div>
                <div className="text-[11px] text-[#9aa0a6] mt-0.5 truncate">
                  {language === 'uz' ? "React 19 Dashboard" : "Simple explanation"}
                </div>
              </button>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 max-w-3xl mx-auto ${
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {/* Model Avatar */}
              {msg.role === 'model' && (
                <div className="w-8 h-8 rounded-xl bg-[#1e1f20] border border-[#3c4043] flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles size={16} className="text-[#8ab4f8]" />
                </div>
              )}

              {/* Message Bubble */}
              <div
                className={`group relative rounded-2xl p-4 text-xs md:text-sm max-w-[88%] md:max-w-[80%] ${
                  msg.role === 'user'
                    ? 'bg-[#282a2c] text-white border border-[#3c4043]'
                    : 'bg-[#1e1f20] text-[#e3e3e3] border border-[#282a2c]'
                }`}
              >
                {/* Attached Files rendering */}
                {msg.files && msg.files.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {msg.files.map((file) => (
                      <div
                        key={file.id}
                        className="rounded-lg overflow-hidden border border-[#3c4043] bg-[#131314] max-w-[200px]"
                      >
                        {file.type === 'image' && file.previewUrl ? (
                          <img
                            src={file.previewUrl}
                            alt={file.name}
                            className="max-h-32 w-auto object-cover rounded-t"
                          />
                        ) : (
                          <div className="p-2 flex items-center gap-1.5 text-xs text-[#8ab4f8]">
                            {file.type === 'audio' ? <FileAudio size={14} /> : <FileText size={14} />}
                            <span className="truncate">{file.name}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Message Content */}
                {msg.role === 'model' ? (
                  <div className="prose-studio">
                    <ReactMarkdown>{msg.text || (msg.isStreaming ? '...' : '')}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap leading-relaxed">{msg.text}</div>
                )}

                {/* Error Banner */}
                {msg.error && (
                  <div className="mt-2 p-2 rounded bg-[#ea4335]/10 border border-[#ea4335]/30 text-[#ea4335] text-xs flex items-center gap-1.5">
                    <AlertCircle size={14} />
                    <span>{msg.error}</span>
                  </div>
                )}

                {/* Search Grounding Sources Cards */}
                {msg.groundingMetadata?.groundingChunks &&
                  msg.groundingMetadata.groundingChunks.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-[#282a2c]">
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-[#8ab4f8] mb-1.5">
                        <Search size={12} />
                        <span>{t.sources}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.groundingMetadata.groundingChunks.map((chunk, i) => (
                          <a
                            key={i}
                            href={chunk.web?.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-[#131314] hover:bg-[#282a2c] text-[#9aa0a6] hover:text-[#8ab4f8] border border-[#282a2c] transition-colors truncate max-w-[200px]"
                          >
                            <ExternalLink size={10} />
                            <span className="truncate">{chunk.web?.title || chunk.web?.uri}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Message action buttons on hover */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-[#131314]/80 p-1 rounded-lg backdrop-blur-sm">
                  <button
                    onClick={() => copyToClipboard(msg.text, msg.id)}
                    className="p-1 text-[#9aa0a6] hover:text-white rounded"
                    title="Copy message"
                  >
                    {copiedId === msg.id ? (
                      <Check size={13} className="text-[#34a853]" />
                    ) : (
                      <Copy size={13} />
                    )}
                  </button>
                </div>
              </div>

              {/* User Avatar */}
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-xl bg-[#282a2c] border border-[#3c4043] flex items-center justify-center shrink-0 mt-0.5">
                  <User size={16} className="text-[#8ab4f8]" />
                </div>
              )}
            </div>
          ))
        )}

        {/* Streaming / Typing Indicator */}
        {isGenerating && (
          <div className="flex items-center gap-2 text-xs text-[#8ab4f8] max-w-3xl mx-auto pl-11 animate-pulse">
            <Sparkles size={14} />
            <span>Gemini thinking & generating...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Box Area */}
      <div className="p-3 md:p-4 border-t border-[#282a2c] bg-[#1e1f20] shrink-0">
        <div className="max-w-3xl mx-auto space-y-2">
          {/* Attached files preview chips */}
          {attachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 pb-1">
              {attachedFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#131314] border border-[#3c4043] text-xs text-[#e3e3e3]"
                >
                  {file.type === 'image' ? (
                    <ImageIcon size={13} className="text-[#8ab4f8]" />
                  ) : file.type === 'audio' ? (
                    <FileAudio size={13} className="text-[#8ab4f8]" />
                  ) : (
                    <FileText size={13} className="text-[#8ab4f8]" />
                  )}
                  <span className="truncate max-w-[120px]">{file.name}</span>
                  <button
                    onClick={() => removeAttachedFile(file.id)}
                    className="text-[#9aa0a6] hover:text-[#ea4335] ml-1"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input Bar */}
          <div className="flex items-end gap-2 bg-[#131314] rounded-2xl border border-[#3c4043] focus-within:border-[#8ab4f8] p-2 transition-colors">
            {/* Hidden file input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              multiple
              accept="image/*,audio/*,text/*,.pdf,.json"
              className="hidden"
            />

            {/* File attach button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-[#9aa0a6] hover:text-white rounded-xl hover:bg-[#282a2c] transition-colors shrink-0"
              title={t.attachFile}
            >
              <Paperclip size={18} />
            </button>

            {/* Mic voice record button */}
            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={`p-2 rounded-xl transition-colors shrink-0 ${
                isRecording
                  ? 'bg-[#ea4335] text-white animate-pulse'
                  : 'text-[#9aa0a6] hover:text-white hover:bg-[#282a2c]'
              }`}
              title={isRecording ? t.recording : t.recordAudio}
            >
              {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
            </button>

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isTranscribing ? t.transcribing : t.typeYourMessage}
              disabled={isTranscribing}
              className="flex-1 bg-transparent text-sm text-[#e3e3e3] placeholder-[#9aa0a6] outline-none resize-none py-1.5 px-1 max-h-48"
            />

            {/* Clear or Stop or Send Button */}
            {isGenerating ? (
              <button
                onClick={onStopGeneration}
                className="p-2 rounded-xl bg-[#ea4335] text-white hover:bg-[#d93025] transition-colors shrink-0"
                title={t.stop}
              >
                <Square size={16} />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!inputText.trim() && attachedFiles.length === 0}
                className={`p-2 rounded-xl transition-all shrink-0 ${
                  inputText.trim() || attachedFiles.length > 0
                    ? 'bg-[#8ab4f8] text-[#131314] hover:bg-[#a8c7fa]'
                    : 'bg-[#282a2c] text-[#9aa0a6] cursor-not-allowed opacity-50'
                }`}
                title={t.run}
              >
                <Send size={16} />
              </button>
            )}
          </div>

          {/* Bottom helper actions */}
          <div className="flex items-center justify-between px-1 text-[11px] text-[#9aa0a6]">
            <div className="flex items-center gap-3">
              <span>{config.model}</span>
              <span>•</span>
              <span>Temp: {config.temperature}</span>
              {config.enableGoogleSearch && (
                <>
                  <span>•</span>
                  <span className="text-[#8ab4f8]">Search Grounding ON</span>
                </>
              )}
            </div>

            {messages.length > 0 && (
              <button
                onClick={onClearChat}
                className="hover:text-[#ea4335] flex items-center gap-1 transition-colors"
                title="Clear conversation"
              >
                <Trash2 size={12} />
                <span>{t.clear}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
