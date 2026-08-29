import { ModelConfig, PresetTemplate } from '../types';

export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  model: 'gemini-3.7-flash',
  temperature: 1.0,
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 8192,
  systemInstruction: '',
  responseMimeType: 'text/plain',
  enableGoogleSearch: false,
  thinkingLevel: 'HIGH',
  safetySettings: [
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  ],
};

export const AVAILABLE_MODELS = [
  {
    id: 'gemini-3.7-flash',
    name: 'Gemini 3.7 Flash',
    badge: 'Standard Workhorse',
    contextWindow: '1M tokens',
    description: 'Fast, highly capable multimodal model for general reasoning, chat, coding, and search grounding.',
    isDefault: true,
  },
  {
    id: 'gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro',
    badge: 'Deep Reasoning',
    contextWindow: '2M tokens',
    description: "Google's flagship intelligence model for high-complexity STEM reasoning, math, and architecture.",
    isDefault: false,
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash Lite',
    badge: 'Ultra Fast & Cost Effective',
    contextWindow: '1M tokens',
    description: 'High throughput, ultra-low latency model for high-frequency workflows.',
    isDefault: false,
  },
];

export const SYSTEM_PROMPT_PRESETS = [
  {
    title: "Senior Full-Stack Engineer",
    text: "You are a World-Class Senior Full-Stack Software Engineer. You write clean, performant, modern, and type-safe code with comprehensive explanations.",
  },
  {
    title: "O'zbekcha Aqlli Yordamchi",
    text: "Siz o'zbek tilida mukammal va ravon muloqot qiluvchi aqlli sun'iy intellektsiz. Har qanday savollarga aniq, tushunarli, dalillarga asoslangan va chiroyli uslubda javob bering.",
  },
  {
    title: "JSON API Server Responder",
    text: "You are a headless API backend. You only respond with strictly valid JSON matching the requested schema without any markdown formatting or surrounding backticks.",
  },
  {
    title: "Critical Fact Checker & Research Analyst",
    text: "You are an objective research analyst. Verify facts with precision, cite reliable reasoning steps, and state certainty levels explicitly.",
  },
];

export const PRESET_TEMPLATES: PresetTemplate[] = [
  {
    id: 'uzbek-assistant',
    title: "O'zbek Tili & Sun'iy Intellekt Mutaxassisi",
    description: "O'zbek tili lug'ati, grammatikasi, texnik terminlar va maqolalar tayyorlash uchun maxsus sozlangan Gemini yordamchisi.",
    category: 'uzbek',
    mode: 'chat',
    iconName: 'Sparkles',
    badge: "O'zbekcha",
    config: {
      model: 'gemini-3.7-flash',
      temperature: 0.7,
      systemInstruction: "Siz o'zbek tilida yozilgan ilmiy, texnik va ijodiy matnlarni tahlil qiluvchi va yaratuvchi eng tajribali AI mutaxassisisiz. Javoblaringiz chiroyli, zamonaviy o'zbek adabiy tilida bo'lsin.",
    },
    initialChat: [
      {
        role: 'user',
        text: "Google AI Studio nima va undan dasturchilar qanday samarali foydalanishi mumkin? Qisqa va tushunarli tushuntirib bering.",
      },
    ],
  },
  {
    id: 'fullstack-code-review',
    title: 'Code Review & Architecture Optimizer',
    description: 'Provide production-grade code reviews, detect edge-case security bugs, and refactor code for performance.',
    category: 'code',
    mode: 'chat',
    iconName: 'Code',
    badge: 'Engineering',
    config: {
      model: 'gemini-3.7-flash',
      temperature: 0.2,
      systemInstruction: 'You are a Principal Software Architect. Review code for correctness, time complexity, security vulnerabilities, and idiomatic best practices.',
    },
    initialChat: [
      {
        role: 'user',
        text: 'Review this TypeScript function for memory leaks and performance:\n\n```ts\nfunction processItems(items: string[]) {\n  return items.map(x => x.trim().toLowerCase()).filter(x => x.length > 0);\n}\n```',
      },
    ],
  },
  {
    id: 'freeform-prompt-generator',
    title: 'Dynamic Product Ad Copywriter',
    description: 'Use variables {{product}}, {{audience}}, and {{tone}} to generate high-converting marketing copy in batch.',
    category: 'creative',
    mode: 'freeform',
    iconName: 'FileText',
    badge: 'Freeform',
    config: {
      model: 'gemini-3.7-flash',
      temperature: 1.2,
    },
    freeformText: `Create an engaging and viral social media marketing post for:
Product: {{product}}
Target Audience: {{audience}}
Tone of Voice: {{tone}}

Include:
1. Catchy headline with emojis
2. Core value proposition (3 bullet points)
3. Call to Action with relevant hashtags`,
    testCases: [
      {
        id: '1',
        variables: {
          product: 'Ergonomic Standing Desk with AI Memory',
          audience: 'Remote Software Developers & Designers',
          tone: 'Tech-savvy, energetic, and professional',
        },
      },
      {
        id: '2',
        variables: {
          product: "O'zbekistonda tayyorlangan tabiiy asal",
          audience: "Sog'lom turmush tarzini sevuvchilar",
          tone: "Samimiy, milliy va ishonchli",
        },
      },
    ],
  },
  {
    id: 'structured-entity-extraction',
    title: 'Entity & Sentiment JSON Extractor',
    description: 'Few-shot structured prompt that extracts customer name, order number, sentiment, and urgent flags into JSON.',
    category: 'business',
    mode: 'structured',
    iconName: 'Boxes',
    badge: 'Structured',
    config: {
      model: 'gemini-3.7-flash',
      temperature: 0.1,
      responseMimeType: 'application/json',
    },
    structuredRows: [
      {
        id: '1',
        input: 'Hi, I am Sardor. My order #UZ-9482 hasn’t arrived and it is been 3 weeks! Please refund immediately.',
        output: '{"customer": "Sardor", "orderId": "UZ-9482", "sentiment": "negative", "urgent": true, "intent": "refund"}',
      },
      {
        id: '2',
        input: 'Thank you! Nilufar here, order #9921 arrived safely and the quality is amazing!',
        output: '{"customer": "Nilufar", "orderId": "9921", "sentiment": "positive", "urgent": false, "intent": "feedback"}',
      },
      {
        id: '3',
        input: 'Could you please check status of order #AB-4410 for John? No rush.',
        output: '{"customer": "John", "orderId": "AB-4410", "sentiment": "neutral", "urgent": false, "intent": "status_check"}',
      },
    ],
  },
  {
    id: 'search-grounded-researcher',
    title: 'Real-Time Google Search Grounding',
    description: 'Ask questions about recent events, live news, and tech updates with direct citations from Google Search.',
    category: 'nlp',
    mode: 'chat',
    iconName: 'Globe',
    badge: 'Grounding',
    config: {
      model: 'gemini-3.7-flash',
      temperature: 0.5,
      enableGoogleSearch: true,
    },
    initialChat: [
      {
        role: 'user',
        text: "What are the latest breakthrough features in Google's Gemini models and AI Studio announced this year?",
      },
    ],
  },
  {
    id: 'multimodal-vision-analyst',
    title: 'Multimodal Image & Chart Interpreter',
    description: 'Upload architectural diagrams, screenshots, or charts for detailed technical breakdown and analysis.',
    category: 'vision',
    mode: 'chat',
    iconName: 'Image',
    badge: 'Vision',
    config: {
      model: 'gemini-3.7-flash',
      temperature: 0.4,
      systemInstruction: 'You are an expert Computer Vision and Document Analysis AI. Describe diagrams, transcribe handwritten notes, and extract tabular data accurately.',
    },
    initialChat: [
      {
        role: 'user',
        text: 'I will attach an image or diagram. Please analyze its components, layout architecture, and provide improvement suggestions.',
      },
    ],
  },
];
