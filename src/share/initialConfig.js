// The mission the app opens on. It deliberately carries no `level` key: adding
// any key changes the event seed, and this exact object is what the engine was
// calibrated against.
export const INITIAL_CONFIG = {
  objectiveId: 'forest_biomass',
  orbitId: 'leo_sso',
  launcherId: 'rideshare',
  instrumentIds: ['multispectral_imager', 'lidar_altimeter'],
  components: {
    array: 'array_m', battery: 'batt_m', comms: 'comms_x', adcs: 'adcs_fine',
    propulsion: 'prop_mono', thermal: 'therm_passive', obc: 'obc_basic', structure: 'struct_small',
  },
  lifetimeYears: 5,
}
