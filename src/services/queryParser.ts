export interface ParsedFilters {
  gender?: string;
  age_group?: string;
  country_id?: string;
  min_age?: number;
  max_age?: number;
}

const COUNTRY_MAP: Record<string, string> = {
  nigeria: "NG", nigerian: "NG",
  ghana: "GH", ghanaian: "GH",
  kenya: "KE", kenyan: "KE",
  ethiopia: "ET", ethiopian: "ET",
  tanzania: "TZ", tanzanian: "TZ",
  uganda: "UG", ugandan: "UG",
  angola: "AO", angolan: "AO",
  cameroon: "CM", cameroonian: "CM",
  "south africa": "ZA", "south african": "ZA",
  egypt: "EG", egyptian: "EG",
  morocco: "MA", moroccan: "MA",
  algeria: "DZ", algerian: "DZ",
  senegal: "SN", senegalese: "SN",
  mali: "ML", malian: "ML",
  niger: "NE",
  "burkina faso": "BF", burkinabe: "BF",
  guinea: "GN", guinean: "GN",
  benin: "BJ", beninese: "BJ",
  togo: "TG", togolese: "TG",
  "ivory coast": "CI", "cote d'ivoire": "CI", ivorian: "CI",
  liberia: "LR", liberian: "LR",
  "sierra leone": "SL",
  zambia: "ZM", zambian: "ZM",
  zimbabwe: "ZW", zimbabwean: "ZW",
  mozambique: "MZ", mozambican: "MZ",
  malawi: "MW", malawian: "MW",
  botswana: "BW", botswanan: "BW",
  namibia: "NA", namibian: "NA",
  rwanda: "RW", rwandan: "RW",
  burundi: "BI", burundian: "BI",
  somalia: "SO", somali: "SO",
  sudan: "SD", sudanese: "SD",
  chad: "TD", chadian: "TD",
  congo: "CG",
  "democratic republic of congo": "CD", "dr congo": "CD", drc: "CD",
  gabon: "GA", gabonese: "GA",
  eritrea: "ER", eritrean: "ER",
  djibouti: "DJ", djiboutian: "DJ",
  madagascar: "MG", malagasy: "MG",
  mauritius: "MU", mauritian: "MU",
  gambia: "GM", gambian: "GM",
  libya: "LY", libyan: "LY",
  tunisia: "TN", tunisian: "TN",
  usa: "US", "united states": "US", american: "US",
  uk: "GB", "united kingdom": "GB", british: "GB",
  france: "FR", french: "FR",
  germany: "DE", german: "DE",
  india: "IN", indian: "IN",
  china: "CN", chinese: "CN",
  brazil: "BR", brazilian: "BR",
  canada: "CA", canadian: "CA",
  australia: "AU", australian: "AU",
  japan: "JP", japanese: "JP",
};

const AGE_GROUP_KEYWORDS: Record<string, string> = {
  child: "child", children: "child", kid: "child", kids: "child",
  teenager: "teenager", teenagers: "teenager", teen: "teenager", teens: "teenager",
  adolescent: "teenager", adolescents: "teenager",
  adult: "adult", adults: "adult",
  senior: "senior", seniors: "senior", elderly: "senior",
};

const GENDER_KEYWORDS: Record<string, string> = {
  male: "male", males: "male", man: "male", men: "male", boy: "male", boys: "male",
  female: "female", females: "female", woman: "female", women: "female",
  girl: "female", girls: "female",
};

export function parseNaturalLanguageQuery(query: string): ParsedFilters | null {
  if (!query || query.trim().length === 0) return null;

  const q = query.toLowerCase().trim();
  const filters: ParsedFilters = {};
  let hasRecognizedToken = false;

  // Gender
  for (const [keyword, value] of Object.entries(GENDER_KEYWORDS)) {
    if (new RegExp(`\\b${keyword}\\b`).test(q)) {
      filters.gender = value;
      hasRecognizedToken = true;
      break;
    }
  }

  // Age group
  for (const [keyword, value] of Object.entries(AGE_GROUP_KEYWORDS)) {
    if (new RegExp(`\\b${keyword}\\b`).test(q)) {
      filters.age_group = value;
      hasRecognizedToken = true;
      break;
    }
  }

  // "young" → 16–24
  if (/\byoung\b/.test(q)) {
    filters.min_age = 16;
    filters.max_age = 24;
    hasRecognizedToken = true;
  }

  // "above X" / "over X" / "older than X"
  const aboveMatch = q.match(/\b(?:above|over|older than)\s+(\d+)/);
  if (aboveMatch) {
    filters.min_age = parseInt(aboveMatch[1], 10);
    hasRecognizedToken = true;
  }

  // "below X" / "under X" / "younger than X"
  const belowMatch = q.match(/\b(?:below|under|younger than)\s+(\d+)/);
  if (belowMatch) {
    filters.max_age = parseInt(belowMatch[1], 10);
    hasRecognizedToken = true;
  }

  // "between X and Y"
  const betweenMatch = q.match(/\b(?:between|aged?)\s+(\d+)\s+(?:and|to|-)\s+(\d+)/);
  if (betweenMatch) {
    filters.min_age = parseInt(betweenMatch[1], 10);
    filters.max_age = parseInt(betweenMatch[2], 10);
    hasRecognizedToken = true;
  }

  // Country — longest match first
  const sortedCountries = Object.keys(COUNTRY_MAP).sort((a, b) => b.length - a.length);
  for (const countryName of sortedCountries) {
    if (q.includes(countryName)) {
      filters.country_id = COUNTRY_MAP[countryName];
      hasRecognizedToken = true;
      break;
    }
  }

  if (!hasRecognizedToken) return null;

  return filters;
}