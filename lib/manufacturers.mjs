const MANUFACTURERS = {
  samsung: { label: 'Samsung', site: 'https://www.samsung.com/pt/smartphones/' },
  apple: { label: 'Apple', site: 'https://www.apple.com/pt/iphone/' },
  xiaomi: { label: 'Xiaomi', site: 'https://www.mi.com/pt/' },
  redmi: { label: 'Xiaomi/Redmi', site: 'https://www.mi.com/pt/' },
  poco: { label: 'Xiaomi/Poco', site: 'https://www.mi.com/pt/' },
  motorola: { label: 'Motorola', site: 'https://www.motorola.com/pt/' },
  honor: { label: 'Honor', site: 'https://www.honor.com/pt/' },
  oppo: { label: 'OPPO', site: 'https://www.oppo.com/pt/' },
  realme: { label: 'realme', site: 'https://www.realme.com/pt/' },
  oneplus: { label: 'OnePlus', site: 'https://www.oneplus.com/eu/' },
  google: { label: 'Google', site: 'https://store.google.com/pt/' },
  pixel: { label: 'Google Pixel', site: 'https://store.google.com/pt/' },
  nothing: { label: 'Nothing', site: 'https://nothing.tech/' },
  nokia: { label: 'Nokia', site: 'https://www.nokia.com/phones/' },
  hmd: { label: 'HMD', site: 'https://www.hmd.com/pt/' },
  vivo: { label: 'vivo', site: 'https://www.vivo.com/e_global/' },
  zte: { label: 'ZTE', site: 'https://www.zte.com.cn/' },
  zteblad: { label: 'ZTE Blade', site: 'https://www.zte.com.cn/' },
  tcl: { label: 'TCL', site: 'https://www.tcl.com/global/en/' },
  tecno: { label: 'TECNO', site: 'https://www.tecno-mobile.com/' },
  infinix: { label: 'Infinix', site: 'https://www.infinixmobility.com/' },
  itel: { label: 'itel', site: 'https://www.itel.com/' },
  asus: { label: 'ASUS', site: 'https://www.asus.com/pt/' },
  sony: { label: 'Sony', site: 'https://www.sony.com/electronics/smartphones' },
  lenovo: { label: 'Lenovo', site: 'https://www.lenovo.com/pt_pt/' },
  huawei: { label: 'Huawei', site: 'https://www.huawei.com/pt/' },
  blackview: { label: 'Blackview', site: 'https://www.blackview.net/' },
  ulefone: { label: 'Ulefone', site: 'https://www.ulefone.com/' },
  doogee: { label: 'DOOGEE', site: 'https://www.doogee.cc/' },
  oukitel: { label: 'OUKITEL', site: 'https://www.oukitel.com/' },
  umidigi: { label: 'UMIDIGI', site: 'https://www.umidigi.com/' },
  alcatel: { label: 'Alcatel/TCL', site: 'https://www.tcl.com/global/en/' },
  meizu: { label: 'Meizu', site: 'https://www.meizu.com/' },
  nubia: { label: 'Nubia', site: 'https://www.nubia.com/' },
  fitbit: { label: 'Fitbit', site: 'https://www.fitbit.com/' },
  garmin: { label: 'Garmin', site: 'https://www.garmin.com/' },
  amazfit: { label: 'Amazfit', site: 'https://www.amazfit.com/' },
  polar: { label: 'Polar', site: 'https://www.polar.com/' },
  suunto: { label: 'Suunto', site: 'https://www.suunto.com/' },
  caterpillar: { label: 'Cat phones', site: 'https://www.catphones.com/' }
};

export function manufacturerInfo(brand) {
  const key = String(brand || '').toLowerCase();
  const info = MANUFACTURERS[key];
  return info || { label: brand, site: null };
}