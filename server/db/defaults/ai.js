const AI_DEFAULTS_VERSION = '1';

const AI_DEFAULT_GROUPS = [
  {
    ai_claude_key_enc: '',
    ai_openai_key_enc: '',
    ai_gemini_key_enc: '',
    ai_suggest_enabled: '1',
    ai_suggest_model: 'claude',
    ai_pdf_import_enabled: '1',
    ai_pdf_import_model: 'claude',
    ai_email_draft_enabled: '0',
    ai_email_draft_model: 'claude',
    ai_description_enabled: '0',
    ai_description_model: 'claude',
  },
];

module.exports = {
  AI_DEFAULTS_VERSION,
  AI_DEFAULT_GROUPS,
};
