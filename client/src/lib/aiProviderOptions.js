export const AI_PROVIDER_OPTIONS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'claude', label: 'Claude (Anthropic)' },
  { value: 'gemini', label: 'Gemini (Google)' },
  { value: 'local', label: 'Local (Managed Ollama)' },
];

export const AI_PROVIDER_MODELS = {
  openai: [
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
    { value: 'gpt-4.1', label: 'GPT-4.1' },
  ],
  claude: [
    { value: 'claude-3-5-sonnet-latest', label: 'Claude 3.5 Sonnet' },
    { value: 'claude-3-7-sonnet-latest', label: 'Claude 3.7 Sonnet' },
    { value: 'claude-sonnet-4-0', label: 'Claude Sonnet 4' },
  ],
  gemini: [
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
  ],
  local: [
    { value: 'llama3.2:3b', label: 'Llama 3.2 3B' },
    { value: 'qwen2.5:7b-instruct', label: 'Qwen 2.5 7B Instruct' },
    { value: 'mistral:7b-instruct', label: 'Mistral 7B Instruct' },
    { value: 'llama3.1:8b-instruct-q4_K_M', label: 'Llama 3.1 8B Instruct' },
  ],
};

export function getDefaultModelForProvider(provider) {
  return AI_PROVIDER_MODELS[provider]?.[0]?.value || '';
}
