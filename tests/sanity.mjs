import { runMission } from '../src/sim/runMission.js'
const show = (label, cfg) => {
  const r = runMission(cfg)
  console.log('\n=== ' + label + ' -> flies:' + r.flies + '  score:' + r.score.final)
  console.log('   margins: ' + Object.entries(r.margins).map(([k,v]) => k+'='+Math.round(v*100)+'%').join('  '))
  for (const c of r.checks) if (!c.passed) console.log('   FAIL ' + c.id + ' :: ' + c.message)
  if (r.flies) for (const e of r.events) console.log('   EVENT ' + (e.survived?'OK  ':'LOST') + ' ' + e.name)
}
const base = { objectiveId:'forest_biomass', orbitId:'leo_sso', launcherId:'falcon9', lifetimeYears:5 }


show('GOOD', { ...base, instrumentIds:['multispectral_imager','lidar_altimeter'],
  components:{array:'array_l',battery:'batt_m',comms:'comms_ka',adcs:'adcs_fine',
    propulsion:'prop_mono',thermal:'therm_passive',obc:'obc_basic',structure:'struct_small'} })


show('GREEDY', { ...base,
  instrumentIds:['multispectral_imager','lidar_altimeter','sar','hyperspectral','thermal_imager','wide_field_camera'],
  components:{array:'array_m',battery:'batt_s',comms:'comms_x',adcs:'adcs_wheels',
    propulsion:'prop_mono',thermal:'therm_passive',obc:'obc_basic',structure:'struct_small'} })


show('CHEAP', { ...base, launcherId:'rideshare', instrumentIds:['terrain_camera'],
  components:{array:'array_s',battery:'batt_s',comms:'comms_s',adcs:'adcs_wheels',
    propulsion:'prop_cold',thermal:'therm_passive',obc:'obc_basic',structure:'struct_cubesat'} })


show('MARS', { objectiveId:'mars_recon', orbitId:'mars', launcherId:'falcon9', lifetimeYears:4,
  instrumentIds:['terrain_camera','hyperspectral'],
  components:{array:'array_xl',battery:'batt_l',comms:'comms_ka',adcs:'adcs_fine',
    propulsion:'prop_bi',thermal:'therm_active',obc:'obc_rad',structure:'struct_small'} })
