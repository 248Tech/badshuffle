const APP_DEFAULTS_VERSION = '3';

const APP_DEFAULT_GROUPS = [
  {
    tax_rate: '0',
    currency: 'USD',
    company_name: '',
    company_email: '',
    company_logo: '',
    company_address: '',
    mapbox_access_token: '',
    verbose_errors: '0',
  },
  {
    autokill_enabled: '1',
    update_check_enabled: '1',
    rust_autostart_enabled: '1',
    update_check_last: '',
    update_check_latest: '',
    update_available: '0',
  },
  {
    onyx_enabled: '0',
    onyx_mode: 'managed_local',
    onyx_local_enabled: '1',
    onyx_local_autostart_enabled: '1',
    onyx_local_install_path: '',
    onyx_local_port: '3000',
    onyx_external_enabled: '1',
    onyx_base_url: '',
    onyx_default_persona_id: '',
    onyx_team_persona_id: '',
    onyx_quote_persona_id: '',
  },
];

module.exports = {
  APP_DEFAULTS_VERSION,
  APP_DEFAULT_GROUPS,
};
