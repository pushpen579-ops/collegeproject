export interface RtoLookupFields {
  vehicleType?: string;
  manufacturer?: string;
  model?: string;
  year?: number;
  fuelType?: string;
  capacity?: string;
  insuranceProvider?: string;
  insurancePolicyNumber?: string;
  insuranceExpiryDate?: string;
  registrationDate?: string;
  registrationExpiryDate?: string;
  fitnessExpiryDate?: string;
  pucExpiryDate?: string;
  permitExpiryDate?: string;
  chassisNumber?: string;
  engineNumber?: string;
}

export interface RtoLookupResult {
  validFormat: boolean;
  registrationNumber: string;
  rtoCode: string;
  rtoState: string;
  rtoOffice: string;
  isBharatSeries: boolean;
  liveApiConfigured: boolean;
  source: 'live_api' | 'rto_code';
  fieldsPopulated: number;
  message: string;
  fields: RtoLookupFields;
}

const INDIAN_STATES: Record<string, string> = {
  AN: 'Andaman and Nicobar Islands',
  AP: 'Andhra Pradesh',
  AR: 'Arunachal Pradesh',
  AS: 'Assam',
  BR: 'Bihar',
  CG: 'Chhattisgarh',
  CH: 'Chandigarh',
  DD: 'Dadra and Nagar Haveli and Daman and Diu',
  DL: 'Delhi',
  DN: 'Dadra and Nagar Haveli',
  GA: 'Goa',
  GJ: 'Gujarat',
  HP: 'Himachal Pradesh',
  HR: 'Haryana',
  JH: 'Jharkhand',
  JK: 'Jammu and Kashmir',
  KA: 'Karnataka',
  KL: 'Kerala',
  LA: 'Ladakh',
  LD: 'Lakshadweep',
  MH: 'Maharashtra',
  ML: 'Meghalaya',
  MN: 'Manipur',
  MP: 'Madhya Pradesh',
  MZ: 'Mizoram',
  NL: 'Nagaland',
  OD: 'Odisha',
  OR: 'Odisha',
  PB: 'Punjab',
  PY: 'Puducherry',
  RJ: 'Rajasthan',
  SK: 'Sikkim',
  TG: 'Telangana',
  TN: 'Tamil Nadu',
  TR: 'Tripura',
  TS: 'Telangana',
  UA: 'Uttarakhand',
  UK: 'Uttarakhand',
  UP: 'Uttar Pradesh',
  WB: 'West Bengal',
};

const RTO_OFFICES: Record<string, string> = {
  // Maharashtra
  MH01: 'Mumbai (South) — Tardeo RTO',
  MH02: 'Mumbai (West) — Andheri RTO',
  MH03: 'Mumbai (East) — Wadala RTO',
  MH04: 'Thane RTO',
  MH05: 'Kalyan RTO',
  MH06: 'Raigad (Pen) RTO',
  MH07: 'Sindhudurg (Kudal) RTO',
  MH08: 'Ratnagiri RTO',
  MH09: 'Kolhapur RTO',
  MH10: 'Sangli RTO',
  MH11: 'Satara RTO',
  MH12: 'Pune RTO',
  MH13: 'Solapur RTO',
  MH14: 'Pimpri-Chinchwad RTO',
  MH15: 'Nashik RTO',
  MH16: 'Ahilyanagar RTO',
  MH17: 'Srirampur RTO',
  MH18: 'Dhule RTO',
  MH19: 'Jalgaon RTO',
  MH20: 'Chhatrapati Sambhajinagar RTO',
  MH21: 'Jalna RTO',
  MH22: 'Parbhani RTO',
  MH23: 'Beed RTO',
  MH24: 'Latur RTO',
  MH25: 'Dharashiv RTO',
  MH26: 'Nanded RTO',
  MH27: 'Amravati RTO',
  MH28: 'Buldhana RTO',
  MH29: 'Yavatmal RTO',
  MH30: 'Akola RTO',
  MH31: 'Nagpur (Urban) RTO',
  MH32: 'Wardha RTO',
  MH34: 'Chandrapur RTO',
  MH37: 'Washim RTO',
  MH40: 'Nagpur (Rural) RTO',
  MH41: 'Malegaon RTO',
  MH42: 'Baramati RTO',
  MH43: 'Navi Mumbai (Vashi) RTO',
  MH46: 'Panvel (Raigad) RTO',
  MH47: 'Mumbai (North) — Borivali RTO',
  MH48: 'Vasai-Virar RTO',
  MH49: 'Nagpur (East) RTO',
  MH50: 'Karad RTO',
  // Gujarat
  GJ01: 'Ahmedabad RTO',
  GJ02: 'Mehsana RTO',
  GJ03: 'Rajkot RTO',
  GJ04: 'Bhavnagar RTO',
  GJ05: 'Surat RTO',
  GJ06: 'Vadodara RTO',
  GJ07: 'Kheda (Nadiad) RTO',
  GJ08: 'Banaskantha (Palanpur) RTO',
  GJ09: 'Sabarkantha (Himatnagar) RTO',
  GJ10: 'Jamnagar RTO',
  GJ11: 'Junagadh RTO',
  GJ12: 'Kutch (Bhuj) RTO',
  GJ13: 'Surendranagar RTO',
  GJ14: 'Amreli RTO',
  GJ15: 'Valsad RTO',
  GJ16: 'Bharuch RTO',
  GJ17: 'Panchmahal (Godhra) RTO',
  GJ18: 'Gandhinagar RTO',
  GJ19: 'Bardoli RTO',
  GJ21: 'Navsari RTO',
  GJ23: 'Anand RTO',
  GJ24: 'Patan RTO',
  GJ27: 'Ahmedabad East (Vastral) RTO',
  GJ36: 'Morbi RTO',
  GJ38: 'Bavla (Ahmedabad Rural) RTO',
  // Delhi
  DL01: 'Delhi North (Mall Road) RTO',
  DL02: 'Delhi New Delhi (Tilak Marg) RTO',
  DL03: 'Delhi South (Sheikh Sarai) RTO',
  DL04: 'Delhi West (Janakpuri) RTO',
  DL05: 'Delhi North East (Loni Road) RTO',
  DL06: 'Delhi Central (Sarai Kale Khan) RTO',
  DL07: 'Delhi East (Mayur Vihar) RTO',
  DL08: 'Delhi North West (Wazirpur) RTO',
  DL09: 'Delhi South West (Dwarka) RTO',
  DL10: 'Delhi West (Raja Garden) RTO',
  DL11: 'Delhi North West (Rohini) RTO',
  DL12: 'Delhi Vasant Vihar RTO',
  DL13: 'Delhi Surajmal Vihar RTO',
  // Karnataka
  KA01: 'Bengaluru Central (Koramangala) RTO',
  KA02: 'Bengaluru West (Rajajinagar) RTO',
  KA03: 'Bengaluru East (Indiranagar) RTO',
  KA04: 'Bengaluru North (Yeshwanthpur) RTO',
  KA05: 'Bengaluru South (Jayanagar) RTO',
  KA06: 'Tumakuru RTO',
  KA09: 'Mysuru West RTO',
  KA11: 'Mandya RTO',
  KA13: 'Hassan RTO',
  KA14: 'Shivamogga RTO',
  KA16: 'Chitradurga RTO',
  KA17: 'Davanagere RTO',
  KA19: 'Mangaluru RTO',
  KA20: 'Udupi RTO',
  KA22: 'Belagavi RTO',
  KA25: 'Dharwad (Hubballi) RTO',
  KA28: 'Vijayapura RTO',
  KA32: 'Kalaburagi RTO',
  KA34: 'Ballari RTO',
  KA36: 'Raichur RTO',
  KA41: 'Bengaluru Kengeri RTO',
  KA51: 'Bengaluru Electronic City RTO',
  KA53: 'Bengaluru K.R. Puram RTO',
  KA59: 'Bengaluru Chandapura RTO',
  // Tamil Nadu
  TN01: 'Chennai Central (Ayanavaram) RTO',
  TN02: 'Chennai North West (Anna Nagar) RTO',
  TN03: 'Chennai North East (Tondiarpet) RTO',
  TN04: 'Chennai East (Royapuram) RTO',
  TN05: 'Chennai North (Kolathur) RTO',
  TN06: 'Chennai South East (Mandavelli) RTO',
  TN07: 'Chennai South (Thiruvanmiyur) RTO',
  TN09: 'Chennai West (K.K. Nagar) RTO',
  TN10: 'Chennai South West (Virugambakkam) RTO',
  TN11: 'Tambaram RTO',
  TN12: 'Poonamallee RTO',
  TN14: 'Sholinganallur RTO',
  TN18: 'Redhills RTO',
  TN19: 'Chengalpattu RTO',
  TN20: 'Tiruvallur RTO',
  TN21: 'Kanchipuram RTO',
  TN22: 'Meenambakkam (Chennai) RTO',
  TN23: 'Vellore RTO',
  TN24: 'Krishnagiri RTO',
  TN28: 'Namakkal North RTO',
  TN29: 'Dharmapuri RTO',
  TN30: 'Salem West RTO',
  TN33: 'Erode East RTO',
  TN37: 'Coimbatore South RTO',
  TN38: 'Coimbatore North RTO',
  TN39: 'Tiruppur North RTO',
  TN45: 'Tiruchirappalli West RTO',
  TN47: 'Karur RTO',
  TN48: 'Srirangam RTO',
  TN49: 'Thanjavur RTO',
  TN52: 'Sankari RTO',
  TN54: 'Salem East RTO',
  TN58: 'Madurai South RTO',
  TN59: 'Madurai North RTO',
  TN66: 'Coimbatore Central RTO',
  TN69: 'Thoothukudi RTO',
  TN70: 'Hosur RTO',
  TN72: 'Tirunelveli RTO',
  TN88: 'Namakkal South RTO',
  // Haryana & Punjab
  HR01: 'Ambala RTO',
  HR02: 'Jagadhri RTO',
  HR03: 'Panchkula RTO',
  HR05: 'Karnal RTO',
  HR06: 'Panipat RTO',
  HR07: 'Kurukshetra RTO',
  HR10: 'Sonipat RTO',
  HR12: 'Rohtak RTO',
  HR19: 'Charkhi Dadri RTO',
  HR20: 'Hisar RTO',
  HR26: 'Gurugram RTO',
  HR29: 'Ballabgarh (Faridabad) RTO',
  HR36: 'Rewari RTO',
  HR38: 'Faridabad Commercial RTO',
  HR46: 'Rohtak Commercial RTO',
  HR47: 'Rewari Commercial RTO',
  HR51: 'Faridabad RTO',
  HR55: 'Gurugram Commercial Freight RTO',
  HR56: 'Jind RTO',
  HR58: 'Yamunanagar Commercial RTO',
  HR61: 'Bhiwani Commercial RTO',
  HR63: 'Jhajjar RTO',
  HR65: 'Kurukshetra Commercial RTO',
  HR68: 'Panchkula Commercial RTO',
  HR69: 'Sonipat Commercial RTO',
  HR74: 'Nuh (Mewat) RTO',
  PB02: 'Amritsar RTO',
  PB03: 'Bathinda RTO',
  PB04: 'Faridkot RTO',
  PB05: 'Ferozepur RTO',
  PB06: 'Gurdaspur RTO',
  PB07: 'Hoshiarpur RTO',
  PB08: 'Jalandhar RTO',
  PB09: 'Kapurthala RTO',
  PB10: 'Ludhiana RTO',
  PB11: 'Patiala RTO',
  PB12: 'Rupnagar RTO',
  PB13: 'Sangrur RTO',
  PB23: 'Fatehgarh Sahib RTO',
  PB29: 'Moga RTO',
  PB35: 'Pathankot RTO',
  PB46: 'Tarn Taran RTO',
  PB65: 'Mohali (SAS Nagar) RTO',
  // Uttar Pradesh
  UP11: 'Saharanpur RTO',
  UP12: 'Muzaffarnagar RTO',
  UP13: 'Bulandshahr RTO',
  UP14: 'Ghaziabad RTO',
  UP15: 'Meerut RTO',
  UP16: 'Noida (Gautam Buddha Nagar) RTO',
  UP21: 'Moradabad RTO',
  UP25: 'Bareilly RTO',
  UP32: 'Lucknow RTO',
  UP35: 'Unnao RTO',
  UP41: 'Barabanki RTO',
  UP42: 'Ayodhya RTO',
  UP50: 'Azamgarh RTO',
  UP53: 'Gorakhpur RTO',
  UP62: 'Jaunpur RTO',
  UP64: 'Sonbhadra RTO',
  UP65: 'Varanasi RTO',
  UP70: 'Prayagraj RTO',
  UP75: 'Etawah RTO',
  UP78: 'Kanpur Nagar RTO',
  UP80: 'Agra RTO',
  UP81: 'Aligarh RTO',
  UP83: 'Firozabad RTO',
  UP85: 'Mathura RTO',
  UP93: 'Jhansi RTO',
  // Rajasthan & Madhya Pradesh
  RJ01: 'Ajmer RTO',
  RJ02: 'Alwar RTO',
  RJ04: 'Barmer RTO',
  RJ05: 'Bharatpur RTO',
  RJ06: 'Bhilwara RTO',
  RJ07: 'Bikaner RTO',
  RJ09: 'Chittorgarh RTO',
  RJ10: 'Churu RTO',
  RJ11: 'Dholpur RTO',
  RJ13: 'Sri Ganganagar RTO',
  RJ14: 'Jaipur South RTO',
  RJ18: 'Jhunjhunu RTO',
  RJ19: 'Jodhpur RTO',
  RJ20: 'Kota RTO',
  RJ21: 'Nagaur RTO',
  RJ22: 'Pali RTO',
  RJ23: 'Sikar RTO',
  RJ27: 'Udaipur RTO',
  RJ32: 'Kotputli RTO',
  RJ45: 'Jaipur North RTO',
  RJ52: 'Shahpura (Jaipur) RTO',
  MP04: 'Bhopal RTO',
  MP07: 'Gwalior RTO',
  MP09: 'Indore RTO',
  MP10: 'Khargone RTO',
  MP11: 'Dhar RTO',
  MP13: 'Ujjain RTO',
  MP14: 'Mandsaur RTO',
  MP15: 'Sagar RTO',
  MP17: 'Rewa RTO',
  MP19: 'Satna RTO',
  MP20: 'Jabalpur RTO',
  MP21: 'Katni RTO',
  MP28: 'Chhindwara RTO',
  MP30: 'Bhind RTO',
  MP41: 'Dewas RTO',
  MP43: 'Ratlam RTO',
  MP44: 'Neemuch RTO',
  MP46: 'Barwani RTO',
  MP66: 'Singrauli RTO',
  // Telangana & Andhra Pradesh
  TS07: 'Rangareddy (Kondapur) RTO',
  TS08: 'Medchal RTO',
  TS09: 'Hyderabad Central (Khairatabad) RTO',
  TS10: 'Hyderabad North (Secunderabad) RTO',
  TS11: 'Hyderabad East (Malakpet) RTO',
  TS12: 'Hyderabad South (Kishanbagh) RTO',
  TS15: 'Sangareddy RTO',
  TS16: 'Nizamabad RTO',
  TS29: 'Suryapet RTO',
  TG07: 'Rangareddy (Kondapur) RTO',
  TG08: 'Medchal RTO',
  TG09: 'Hyderabad Central (Khairatabad) RTO',
  TG10: 'Hyderabad North (Secunderabad) RTO',
  AP02: 'Anantapur RTO',
  AP04: 'Kadapa RTO',
  AP05: 'Kakinada RTO',
  AP07: 'Guntur RTO',
  AP09: 'Vijayawada (NTR) RTO',
  AP16: 'Vijayawada RTO',
  AP21: 'Kurnool RTO',
  AP26: 'Nellore RTO',
  AP27: 'Ongole RTO',
  AP28: 'Tirupati RTO',
  AP31: 'Visakhapatnam RTO',
  AP39: 'Andhra Pradesh Unified Series RTO',
  // Kerala, West Bengal, Odisha, Bihar, Jharkhand, Chhattisgarh, North-East, Goa, HP, UK, JK
  KL01: 'Thiruvananthapuram RTO',
  KL02: 'Kollam RTO',
  KL04: 'Alappuzha RTO',
  KL05: 'Kottayam RTO',
  KL07: 'Ernakulam (Kochi) RTO',
  KL08: 'Thrissur RTO',
  KL09: 'Palakkad RTO',
  KL10: 'Malappuram RTO',
  KL11: 'Kozhikode RTO',
  KL13: 'Kannur RTO',
  KL14: 'Kasaragod RTO',
  KL17: 'Muvattupuzha RTO',
  KL40: 'Perumbavoor RTO',
  WB01: 'Kolkata Beltala RTO',
  WB02: 'Kolkata Beltala Commercial RTO',
  WB03: 'Kolkata Commercial Goods RTO',
  WB06: 'Kolkata Kasba RTO',
  WB11: 'Howrah RTO',
  WB15: 'Hooghly (Chinsurah) RTO',
  WB19: 'South 24 Parganas (Alipore) RTO',
  WB23: 'Barrackpore RTO',
  WB25: 'Barasat RTO',
  WB37: 'Asansol RTO',
  WB39: 'Durgapur RTO',
  WB41: 'Purba Bardhaman RTO',
  WB51: 'Nadia (Krishnanagar) RTO',
  WB57: 'Murshidabad RTO',
  WB73: 'Siliguri RTO',
  OD01: 'Balasore RTO',
  OD02: 'Bhubaneswar RTO',
  OD04: 'Chandikhol (Jajpur) RTO',
  OD05: 'Cuttack RTO',
  OD07: 'Ganjam (Chhatrapur) RTO',
  OD09: 'Keonjhar RTO',
  OD14: 'Rourkela RTO',
  OD15: 'Sambalpur RTO',
  OD19: 'Angul RTO',
  OD23: 'Jharsuguda RTO',
  OD33: 'Bhubaneswar-II RTO',
  BR01: 'Patna RTO',
  BR02: 'Gaya RTO',
  BR06: 'Muzaffarpur RTO',
  BR07: 'Darbhanga RTO',
  BR10: 'Bhagalpur RTO',
  BR11: 'Purnia RTO',
  JH01: 'Ranchi RTO',
  JH02: 'Hazaribagh RTO',
  JH05: 'Jamshedpur RTO',
  JH09: 'Bokaro RTO',
  JH10: 'Dhanbad RTO',
  CG04: 'Raipur RTO',
  CG07: 'Durg (Bhilai) RTO',
  CG10: 'Bilaspur RTO',
  CG12: 'Korba RTO',
  CG13: 'Raigarh RTO',
  GA01: 'North Goa (Panaji) RTO',
  GA02: 'South Goa (Margao) RTO',
  GA03: 'Mapusa RTO',
  GA07: 'Panaji RTO',
  GA08: 'Margao RTO',
  CH01: 'Chandigarh RTO',
  PY01: 'Puducherry RTO',
  AS01: 'Guwahati (Kamrup Metro) RTO',
  AS02: 'Nagaon RTO',
  AS03: 'Jorhat RTO',
  AS06: 'Dibrugarh RTO',
  AS11: 'Cachar (Silchar) RTO',
  UK04: 'Nainital (Haldwani) RTO',
  UK06: 'Udham Singh Nagar (Rudrapur) RTO',
  UK07: 'Dehradun RTO',
  UK08: 'Haridwar RTO',
  HP01: 'Shimla RTO',
  HP12: 'Nalagarh (Baddi) RTO',
  HP38: 'Nurpur RTO',
  HP64: 'Solan RTO',
  JK01: 'Srinagar RTO',
  JK02: 'Jammu RTO',
};

const MONTHS_MAP: Record<string, string> = {
  JAN: '01',
  FEB: '02',
  MAR: '03',
  APR: '04',
  MAY: '05',
  JUN: '06',
  JUL: '07',
  AUG: '08',
  SEP: '09',
  OCT: '10',
  NOV: '11',
  DEC: '12',
};

export function normalizeRegistrationNumber(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function parseIndianRtoCode(rawReg: string): {
  validFormat: boolean;
  registrationNumber: string;
  rtoCode: string;
  rtoState: string;
  rtoOffice: string;
  isBharatSeries: boolean;
} {
  const cleaned = normalizeRegistrationNumber(rawReg);
  if (!cleaned) {
    return {
      validFormat: false,
      registrationNumber: '',
      rtoCode: '',
      rtoState: '',
      rtoOffice: '',
      isBharatSeries: false,
    };
  }

  // Bharat (BH) Series: e.g. 22BH1234AB
  const bhMatch = cleaned.match(/^(\d{2})BH\d{4}[A-Z]{1,2}$/);
  if (bhMatch) {
    return {
      validFormat: true,
      registrationNumber: cleaned,
      rtoCode: `${bhMatch[1]}-BH`,
      rtoState: 'All India (Bharat Series)',
      rtoOffice: 'MoRTH Bharat (BH) Series Registry',
      isBharatSeries: true,
    };
  }

  // Standard Indian State Series: e.g. MH12AB1234, DL1GC1234, GJ05XY9876
  const stdMatch = cleaned.match(/^([A-Z]{2})(\d{1,2})[A-Z]{0,3}\d{1,4}$/);
  if (stdMatch) {
    const stateCode = stdMatch[1];
    const distNum = stdMatch[2].padStart(2, '0');
    const stateName = INDIAN_STATES[stateCode];
    const compactCode = `${stateCode}${distNum}`;
    const displayCode = `${stateCode}-${distNum}`;

    if (!stateName) {
      return {
        validFormat: false,
        registrationNumber: cleaned,
        rtoCode: displayCode,
        rtoState: '',
        rtoOffice: '',
        isBharatSeries: false,
      };
    }

    const office = RTO_OFFICES[compactCode] ?? `${stateName} RTO (${displayCode})`;
    return {
      validFormat: true,
      registrationNumber: cleaned,
      rtoCode: displayCode,
      rtoState: stateName,
      rtoOffice: office,
      isBharatSeries: false,
    };
  }

  // Partial prefix match while user is typing (4+ chars)
  const prefixMatch = cleaned.match(/^([A-Z]{2})(\d{2})/);
  if (prefixMatch && INDIAN_STATES[prefixMatch[1]]) {
    const stateCode = prefixMatch[1];
    const distNum = prefixMatch[2];
    const compactCode = `${stateCode}${distNum}`;
    return {
      validFormat: false,
      registrationNumber: cleaned,
      rtoCode: `${stateCode}-${distNum}`,
      rtoState: INDIAN_STATES[stateCode],
      rtoOffice:
        RTO_OFFICES[compactCode] ?? `${INDIAN_STATES[stateCode]} RTO (${stateCode}-${distNum})`,
      isBharatSeries: false,
    };
  }

  return {
    validFormat: false,
    registrationNumber: cleaned,
    rtoCode: '',
    rtoState: '',
    rtoOffice: '',
    isBharatSeries: false,
  };
}

function toIsoDate(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const trimmed = value.trim();

  // YYYY-MM-DD or ISO timestamp
  const ymd = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (ymd) {
    return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;
  }

  // DD-MMM-YYYY or DD MMM YYYY (e.g. 14-Mar-2026) — deterministic, zero timezone drift
  const dMonY = trimmed.match(/^(\d{1,2})[-\s/]([A-Za-z]{3})[-\s/](\d{4})$/);
  if (dMonY) {
    const month = MONTHS_MAP[dMonY[2].toUpperCase()];
    if (month) {
      return `${dMonY[3]}-${month}-${dMonY[1].padStart(2, '0')}`;
    }
  }

  // DD-MM-YYYY or DD/MM/YYYY
  const dmy = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }

  return undefined;
}

function normalizeFuelType(raw?: string): string | undefined {
  if (!raw) return undefined;
  const upper = raw.toUpperCase().trim();
  if (!upper) return undefined;
  if (upper.includes('DIESEL')) return 'Diesel';
  if (upper.includes('CNG')) return 'CNG';
  if (upper.includes('LNG')) return 'LNG';
  if (upper.includes('ELECTRIC') || upper.includes('BOV') || upper === 'EV') return 'Electric';
  if (upper.includes('PETROL')) return 'Petrol';
  return raw.trim();
}

function pickStr(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === 'string' && v.trim() && v.trim().toUpperCase() !== 'NA' && v.trim() !== '-') {
      return v.trim();
    }
    if (typeof v === 'number' && !Number.isNaN(v)) {
      return String(v);
    }
  }
  return undefined;
}

function resolvePayloadObject(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== 'object') return {};
  const root = payload as Record<string, unknown>;
  const candidates = [
    root.data,
    root.result,
    root.rc_details,
    root.response,
    root.vehicle_details,
  ];
  for (const cand of candidates) {
    if (cand && typeof cand === 'object' && !Array.isArray(cand)) {
      const inner = cand as Record<string, unknown>;
      if (inner.rc_details && typeof inner.rc_details === 'object') {
        return inner.rc_details as Record<string, unknown>;
      }
      if (inner.extraction_output && typeof inner.extraction_output === 'object') {
        return inner.extraction_output as Record<string, unknown>;
      }
      return inner;
    }
  }
  return root;
}

export function mapLiveApiPayload(
  payload: unknown,
): RtoLookupFields & { rtoOfficeOverride?: string; rtoStateOverride?: string } {
  const nested = resolvePayloadObject(payload);
  if (Object.keys(nested).length === 0) return {};

  const regDate = toIsoDate(
    pickStr(nested, [
      'registration_date',
      'reg_date',
      'regDate',
      'rc_regn_dt',
      'date_of_registration',
      'regn_date',
      'registered_on',
    ]),
  );

  const yearStr = pickStr(nested, [
    'manufacturing_date_formatted',
    'manufacturing_date',
    'mfg_date',
    'manufacturing_year',
    'manu_yr',
    'rc_manu_month_yr',
    'model_year',
    'year',
  ]);
  const parsedYear =
    typeof nested.year === 'number' && nested.year > 1970
      ? nested.year
      : yearStr && /\b(19|20)\d{2}\b/.test(yearStr)
        ? Number(yearStr.match(/\b(19|20)\d{2}\b/)![0])
        : regDate
          ? Number(regDate.slice(0, 4))
          : undefined;

  const gvw =
    nested.gross_vehicle_weight ??
    nested.rc_gvw ??
    nested.gvw ??
    nested.laden_weight ??
    nested.unladen_weight;
  const seatCap = nested.seat_capacity ?? nested.rc_seat_cap ?? nested.seating_capacity;
  const capacity =
    typeof gvw === 'string' && gvw.trim() && gvw.trim() !== '0'
      ? `${gvw.trim()}${/kg|ton/i.test(gvw) ? '' : ' kg GVW'}`
      : typeof gvw === 'number' && gvw > 0
        ? `${gvw.toLocaleString('en-IN')} kg GVW`
        : typeof seatCap === 'number' && seatCap > 0
          ? `${seatCap} Seats`
          : undefined;

  const fitnessDate = toIsoDate(
    pickStr(nested, [
      'fit_up_to',
      'fit_upto',
      'fitness_upto',
      'fitness_validity',
      'rc_fit_upto',
      'fitnessExpiryDate',
    ]),
  );

  const regExpiry =
    toIsoDate(
      pickStr(nested, [
        'rc_expiry_date',
        'registration_upto',
        'reg_upto',
        'rc_regn_upto',
        'registrationExpiryDate',
      ]),
    ) || fitnessDate;

  return {
    manufacturer: pickStr(nested, [
      'maker_description',
      'maker_name',
      'manufacturer',
      'make',
      'brand',
      'rc_maker_desc',
      'vehicle_manufacturer',
      'maker',
    ]),
    model: pickStr(nested, [
      'maker_model',
      'model_name',
      'model',
      'vehicle_model',
      'rc_maker_model',
      'variant',
    ]),
    vehicleType: pickStr(nested, [
      'vehicle_category_description',
      'vehicle_class_desc',
      'vehicle_class',
      'vehicleType',
      'rc_vh_class_desc',
      'vehicle_category',
      'body_type',
    ]),
    fuelType: normalizeFuelType(
      pickStr(nested, ['fuel_type', 'fuel_descr', 'fuelType', 'rc_fuel_desc', 'fuel_description', 'fuel']),
    ),
    year: parsedYear,
    capacity,
    insuranceProvider: pickStr(nested, [
      'insurance_company',
      'insurance_comp',
      'insuranceProvider',
      'rc_insurance_comp',
      'insurer_name',
      'insurance_name',
    ]),
    insurancePolicyNumber: pickStr(nested, [
      'insurance_policy_number',
      'policy_number',
      'policy_no',
      'rc_insurance_policy_no',
      'insurance_policy_no',
      'insurancePolicyNumber',
    ]),
    insuranceExpiryDate: toIsoDate(
      pickStr(nested, [
        'insurance_upto',
        'insurance_validity',
        'insuranceExpiryDate',
        'rc_insurance_upto',
        'ins_upto',
      ]),
    ),
    registrationDate: regDate,
    registrationExpiryDate: regExpiry,
    fitnessExpiryDate: fitnessDate,
    pucExpiryDate: toIsoDate(
      pickStr(nested, ['pucc_upto', 'puc_upto', 'pucc_validity', 'rc_pucc_upto', 'pucExpiryDate']),
    ),
    permitExpiryDate: toIsoDate(
      pickStr(nested, [
        'permit_valid_upto',
        'permit_upto',
        'rc_permit_valid_upto',
        'national_permit_upto',
        'permitExpiryDate',
      ]),
    ),
    chassisNumber: pickStr(nested, [
      'vehicle_chasi_number',
      'chassis_number',
      'chassis_no',
      'rc_chasi_no',
      'chassisNumber',
    ]),
    engineNumber: pickStr(nested, [
      'vehicle_engine_number',
      'engine_number',
      'engine_no',
      'rc_eng_no',
      'engineNumber',
    ]),
    rtoOfficeOverride: pickStr(nested, [
      'registered_at',
      'rto_name',
      'rto_office',
      'rc_registered_at',
      'registering_authority',
    ]),
    rtoStateOverride: pickStr(nested, ['state', 'rto_state', 'state_name']),
  };
}

/**
 * Deterministically extracts genuine Vahan / mParivahan / DigiLocker RC fields
 * from copied JSON or pasted key-value RC text supplied by the user.
 */
export function parseRcDocumentText(rawText: string): {
  registrationNumber?: string;
  rtoCode?: string;
  rtoState?: string;
  rtoOffice?: string;
  fields: RtoLookupFields;
  fieldsPopulated: number;
} {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return { fields: {}, fieldsPopulated: 0 };
  }

  // 1. Try JSON payload parse first (e.g. copied API / DigiLocker JSON)
  if (trimmed.startsWith('{')) {
    try {
      const json = JSON.parse(trimmed) as Record<string, unknown>;
      const nested = resolvePayloadObject(json);
      const rawReg = pickStr(nested, [
        'rc_number',
        'registration_number',
        'reg_no',
        'regn_no',
        'registrationNumber',
        'vehicle_number',
      ]);
      const parsed = rawReg ? parseIndianRtoCode(rawReg) : null;
      const mapped = mapLiveApiPayload(json);
      const { rtoOfficeOverride, rtoStateOverride, ...fields } = mapped;
      const fieldsPopulated = Object.values(fields).filter((v) => v !== undefined && v !== '').length;
      return {
        registrationNumber: parsed?.registrationNumber || undefined,
        rtoCode: parsed?.rtoCode || undefined,
        rtoState: rtoStateOverride || parsed?.rtoState || undefined,
        rtoOffice: rtoOfficeOverride || parsed?.rtoOffice || undefined,
        fields,
        fieldsPopulated,
      };
    } catch {
      // Fall through to text parser
    }
  }

  // 2. Deterministic key-value / line parser for mParivahan / Parivahan text
  const text = trimmed.replace(/\r/g, '');
  const extractLine = (patterns: RegExp[]): string | undefined => {
    for (const pat of patterns) {
      const m = text.match(pat);
      if (m?.[1]?.trim()) return m[1].trim();
    }
    return undefined;
  };

  let regNumber = extractLine([
    /(?:Registration\s*(?:No\.?|Number)|Reg\.?\s*(?:No\.?|Number)|Vehicle\s*No\.?)\s*[:\-]\s*([A-Z0-9\-\s]{6,15})/i,
  ]);
  if (!regNumber) {
    const plateMatch = text.match(/\b([A-Z]{2}\s*-?\s*\d{1,2}\s*-?\s*[A-Z]{0,3}\s*-?\s*\d{1,4}|\d{2}\s*-?\s*BH\s*-?\s*\d{4}\s*-?\s*[A-Z]{1,2})\b/);
    if (plateMatch) regNumber = plateMatch[1];
  }

  const parsedRto = regNumber ? parseIndianRtoCode(regNumber) : null;

  const maker = extractLine([
    /(?:Maker(?:'s)?\s*(?:Name|Desc(?:ription)?)?|Manufacturer)\s*[:\-]\s*(.+)/i,
  ]);
  const model = extractLine([
    /(?:Maker'?s?\s*Model|Model\s*Name|Vehicle\s*Model|Model)\s*[:\-]\s*(.+)/i,
  ]);
  const vehicleClass = extractLine([
    /(?:Vehicle\s*Class|Class\s*of\s*Vehicle|Body\s*Type)\s*[:\-]\s*(.+)/i,
  ]);
  const fuelRaw = extractLine([/(?:Fuel(?:\s*Used|\s*Type)?)\s*[:\-]\s*(.+)/i]);
  const mfgRaw = extractLine([
    /(?:Mfg\.?\s*(?:Date|Year)|Month\s*[&/]\s*Year\s*of\s*Mfg\.?|Year\s*of\s*Manufacture)\s*[:\-]\s*(.+)/i,
  ]);
  const regDateRaw = extractLine([
    /(?:Registration\s*Date|Date\s*of\s*Registration|Regn\.?\s*Date)\s*[:\-]\s*(.+)/i,
  ]);
  const regExpRaw = extractLine([
    /(?:Reg(?:istration)?\.?\s*(?:Valid\s*Upto|Expiry\s*Date)|RC\s*(?:Valid\s*Upto|Expiry))\s*[:\-]\s*(.+)/i,
  ]);
  const fitExpRaw = extractLine([
    /(?:Fitness\s*(?:Valid\s*Upto|Upto|Expiry(?:\s*Date)?))\s*[:\-]\s*(.+)/i,
  ]);
  const insProvider = extractLine([
    /(?:Insurance\s*(?:Company|Provider|Insurer)|Insurer\s*Name)\s*[:\-]\s*(.+)/i,
  ]);
  const policyNo = extractLine([
    /(?:Insurance\s*Policy\s*(?:No\.?|Number)|Policy\s*(?:No\.?|Number))\s*[:\-]\s*([^\n]+)/i,
  ]);
  const insExpRaw = extractLine([
    /(?:Insurance\s*(?:Valid\s*Upto|Upto|Expiry(?:\s*Date)?))\s*[:\-]\s*(.+)/i,
  ]);
  const pucExpRaw = extractLine([
    /(?:PUCC?\s*(?:Valid\s*Upto|Upto|Expiry(?:\s*Date)?))\s*[:\-]\s*(.+)/i,
  ]);
  const permitExpRaw = extractLine([
    /(?:Permit\s*(?:Valid\s*Upto|Upto|Expiry(?:\s*Date)?))\s*[:\-]\s*(.+)/i,
  ]);
  const chassisNo = extractLine([/(?:Chassis\s*(?:No\.?|Number))\s*[:\-]\s*([A-Z0-9*]+)/i]);
  const engineNo = extractLine([/(?:Engine\s*(?:No\.?|Number))\s*[:\-]\s*([A-Z0-9*]+)/i]);
  const rtoOfficeRaw = extractLine([
    /(?:Registering\s*Authority|RTO\s*(?:Office|Name)|Registered\s*At)\s*[:\-]\s*(.+)/i,
  ]);
  const gvwRaw = extractLine([
    /(?:Gross\s*Vehicle\s*Weight|GVW|Unladen\s*Weight|Capacity|Payload)\s*[:\-]\s*(.+)/i,
  ]);

  const regDate = toIsoDate(regDateRaw);
  const yearMatch = mfgRaw?.match(/\b(19|20)\d{2}\b/);
  const year = yearMatch ? Number(yearMatch[0]) : regDate ? Number(regDate.slice(0, 4)) : undefined;
  const fitnessExpiryDate = toIsoDate(fitExpRaw);

  const fields: RtoLookupFields = {
    manufacturer: maker,
    model,
    vehicleType: vehicleClass,
    fuelType: normalizeFuelType(fuelRaw),
    year,
    capacity: gvwRaw,
    insuranceProvider: insProvider,
    insurancePolicyNumber: policyNo,
    insuranceExpiryDate: toIsoDate(insExpRaw),
    registrationDate: regDate,
    registrationExpiryDate: toIsoDate(regExpRaw) || fitnessExpiryDate,
    fitnessExpiryDate,
    pucExpiryDate: toIsoDate(pucExpRaw),
    permitExpiryDate: toIsoDate(permitExpRaw),
    chassisNumber: chassisNo,
    engineNumber: engineNo,
  };

  const fieldsPopulated = Object.values(fields).filter((v) => v !== undefined && v !== '').length;

  return {
    registrationNumber: parsedRto?.registrationNumber || undefined,
    rtoCode: parsedRto?.rtoCode || undefined,
    rtoState: parsedRto?.rtoState || undefined,
    rtoOffice: rtoOfficeRaw || parsedRto?.rtoOffice || undefined,
    fields,
    fieldsPopulated,
  };
}

export async function lookupRtoVehicle(rawRegistrationNumber: string): Promise<RtoLookupResult> {
  const parsed = parseIndianRtoCode(rawRegistrationNumber);
  const apiUrl = process.env.RTO_API_URL?.trim() || '';
  const apiKey = process.env.RTO_API_KEY?.trim() || '';
  const apiSecret = process.env.RTO_API_SECRET?.trim() || '';
  const apiHost = process.env.RTO_API_HOST?.trim() || '';
  const apiMethod = (process.env.RTO_API_METHOD?.trim() || '').toUpperCase();
  const liveApiConfigured = Boolean(apiUrl && apiKey);

  if (!parsed.registrationNumber) {
    return {
      ...parsed,
      liveApiConfigured,
      source: 'rto_code',
      fieldsPopulated: 0,
      message: 'Enter a valid vehicle registration number (e.g. MH12AB1234).',
      fields: {},
    };
  }

  if (liveApiConfigured && parsed.validFormat) {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'x-api-key': apiKey,
        'x-client-id': apiKey,
      };
      if (apiSecret) {
        headers['x-api-secret'] = apiSecret;
        headers['x-client-secret'] = apiSecret;
      }
      if (apiHost) {
        headers['x-rapidapi-key'] = apiKey;
        headers['x-rapidapi-host'] = apiHost;
      }

      const targetUrl = apiUrl.includes('{regNumber}')
        ? apiUrl.replace('{regNumber}', encodeURIComponent(parsed.registrationNumber))
        : apiUrl;

      const useGet =
        apiMethod === 'GET' || (apiMethod !== 'POST' && apiUrl.includes('{regNumber}'));
      const resp = await fetch(targetUrl, {
        method: useGet ? 'GET' : 'POST',
        headers,
        body: useGet
          ? undefined
          : JSON.stringify({
              id_number: parsed.registrationNumber,
              rc_number: parsed.registrationNumber,
              registration_number: parsed.registrationNumber,
              reg_no: parsed.registrationNumber,
              vehicle_number: parsed.registrationNumber,
            }),
      });

      if (resp.ok) {
        const json = (await resp.json()) as unknown;
        const mapped = mapLiveApiPayload(json);
        const { rtoOfficeOverride, rtoStateOverride, ...fields } = mapped;
        const fieldsPopulated = Object.values(fields).filter(
          (v) => v !== undefined && v !== '',
        ).length;
        return {
          ...parsed,
          rtoOffice: rtoOfficeOverride || parsed.rtoOffice,
          rtoState: rtoStateOverride || parsed.rtoState,
          liveApiConfigured: true,
          source: 'live_api',
          fieldsPopulated,
          message: `Live Vahan RC data synced (${fieldsPopulated} fields updated for ${parsed.registrationNumber}).`,
          fields,
        };
      }
    } catch {
      // Fall through cleanly to RTO code metadata without fabricating fake RC fields
    }
  }

  return {
    ...parsed,
    liveApiConfigured,
    source: 'rto_code',
    fieldsPopulated: parsed.rtoOffice ? 3 : 0,
    message: parsed.validFormat
      ? `RTO resolved: ${parsed.rtoCode} · ${parsed.rtoOffice} (${parsed.rtoState}).${
          liveApiConfigured
            ? ' Live Vahan lookup returned no RC details for this registration number.'
            : ' Connect RTO_API_URL & RTO_API_KEY in server secrets for automated Vahan RC sync (manufacturer, model, insurance, registration dates), or paste your Parivahan/mParivahan RC text below.'
        }`
      : parsed.rtoCode
        ? `Detected RTO ${parsed.rtoCode} (${parsed.rtoState}). Finish entering the full registration plate.`
        : 'Enter standard Indian RTO registration format (e.g. MH12AB1234 or 22BH1234AB).',
    fields: {},
  };
}
