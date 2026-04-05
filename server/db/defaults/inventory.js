const INVENTORY_DEFAULTS_VERSION = '1';

const INVENTORY_DEFAULT_GROUPS = [
  {
    inventory_default_view: 'grid',
    inventory_items_per_page: '48',
    inventory_multi_select_enabled: '0',
  },
  {
    count_oos_oversold: '0',
  },
];

module.exports = {
  INVENTORY_DEFAULTS_VERSION,
  INVENTORY_DEFAULT_GROUPS,
};
