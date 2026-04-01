const MAIL_DEFAULTS_VERSION = '1';

const MAIL_DEFAULT_GROUPS = [
  {
    smtp_host: '',
    smtp_port: '587',
    smtp_secure: 'false',
    smtp_user: '',
    smtp_pass_enc: '',
    smtp_from: '',
  },
  {
    recaptcha_enabled: '0',
    recaptcha_site_key: '',
    recaptcha_secret_key: '',
  },
  {
    imap_host: '',
    imap_port: '993',
    imap_secure: 'true',
    imap_user: '',
    imap_pass_enc: '',
    imap_poll_enabled: '0',
  },
  {
    message_email_signature: '',
    message_theme: 'default',
    message_auto_attach_pdf: '0',
  },
];

module.exports = {
  MAIL_DEFAULTS_VERSION,
  MAIL_DEFAULT_GROUPS,
};
