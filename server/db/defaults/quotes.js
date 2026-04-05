const QUOTE_DEFAULTS_VERSION = '5';

const QUOTE_DEFAULT_GROUPS = [
  {
    quote_auto_append_city_title: '0',
    presence_offline_after_minutes: '30',
    app_timezone: 'America/New_York',
    notification_tray_position: 'bottom_right',
    notification_icon_bg_opacity: '90',
    image_compression_enabled: '1',
    image_auto_webp_enabled: '1',
    image_webp_quality: '68',
    image_avif_enabled: '0',
  },
];

module.exports = {
  QUOTE_DEFAULTS_VERSION,
  QUOTE_DEFAULT_GROUPS,
};
