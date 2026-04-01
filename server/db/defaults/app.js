const APP_DEFAULTS_VERSION = '1';

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
    update_check_last: '',
    update_check_latest: '',
    update_available: '0',
  },
];

module.exports = {
  APP_DEFAULTS_VERSION,
  APP_DEFAULT_GROUPS,
};
