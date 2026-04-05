const CURATED_LOCAL_MODELS = [
  {
    id: 'llama3.2:3b',
    label: 'Llama 3.2 3B',
    runtime: 'ollama',
    size_label: '2.0 GB',
    memory_gb: 8,
    quality: 'fast',
    supports: ['assistant', 'suggest', 'description', 'email', 'team_chat_fallback'],
    notes: 'Fastest general local option for laptops. Best for short writing and assistant tasks.',
  },
  {
    id: 'qwen2.5:7b-instruct',
    label: 'Qwen 2.5 7B Instruct',
    runtime: 'ollama',
    size_label: '4.7 GB',
    memory_gb: 12,
    quality: 'balanced',
    supports: ['assistant', 'suggest', 'description', 'email', 'team_chat_fallback', 'pdf_import'],
    notes: 'Balanced local model for stronger reasoning and structured responses.',
  },
  {
    id: 'mistral:7b-instruct',
    label: 'Mistral 7B Instruct',
    runtime: 'ollama',
    size_label: '4.1 GB',
    memory_gb: 12,
    quality: 'balanced',
    supports: ['assistant', 'suggest', 'description', 'email', 'team_chat_fallback'],
    notes: 'Good all-around local writing model with solid speed and lower memory pressure.',
  },
  {
    id: 'llama3.1:8b-instruct-q4_K_M',
    label: 'Llama 3.1 8B Instruct',
    runtime: 'ollama',
    size_label: '4.9 GB',
    memory_gb: 12,
    quality: 'quality',
    supports: ['assistant', 'suggest', 'description', 'email', 'team_chat_fallback', 'pdf_import'],
    notes: 'Higher-quality local option for richer responses on stronger desktops.',
  },
];

function listCuratedModels() {
  return CURATED_LOCAL_MODELS.map((entry) => ({ ...entry }));
}

function getCuratedModel(id) {
  const normalized = String(id || '').trim();
  if (!normalized) return null;
  return CURATED_LOCAL_MODELS.find((entry) => entry.id === normalized) || null;
}

module.exports = {
  CURATED_LOCAL_MODELS,
  listCuratedModels,
  getCuratedModel,
};
