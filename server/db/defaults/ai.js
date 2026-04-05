const AI_DEFAULTS_VERSION = '4';

const AI_DEFAULT_GROUPS = [
  {
    ai_claude_key_enc: '',
    ai_openai_key_enc: '',
    ai_gemini_key_enc: '',
    ai_local_enabled: '0',
    ai_local_mode: 'managed_ollama',
    ai_local_autostart_enabled: '1',
    ai_local_install_path: '',
    ai_local_base_url: 'http://127.0.0.1:11434',
    ai_local_default_model: 'llama3.2:3b',
    ai_suggest_enabled: '1',
    ai_suggest_model: 'claude',
    ai_pdf_import_enabled: '1',
    ai_pdf_import_model: 'claude',
    ai_email_draft_enabled: '0',
    ai_email_draft_model: 'claude',
    ai_description_enabled: '0',
    ai_description_model: 'claude',
    ai_agent_enabled: '1',
    ai_agent_provider: 'openai',
    ai_agent_model: 'gpt-4o-mini',
    team_chat_ai_fallback_enabled: '1',
  },
];

module.exports = {
  AI_DEFAULTS_VERSION,
  AI_DEFAULT_GROUPS,
};
