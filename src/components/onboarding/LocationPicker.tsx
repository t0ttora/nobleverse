'use client';
import React, { useMemo, useRef, useState, useEffect } from 'react';

interface CountryCities {
  country: string;
  code: string;
  cities: string[];
}

// Expanded country list: 20+ European countries, US states, Canada provinces
const DATA: CountryCities[] = [
  {
    country: 'Türkiye',
    code: 'TR',
    cities: [
      'İstanbul',
      'Ankara',
      'İzmir',
      'Bursa',
      'Antalya',
      'Mersin',
      'Adana',
      'Konya',
      'Gaziantep',
      'Kayseri',
      'Eskişehir',
      'Samsun',
      'Trabzon',
      'Erzurum',
      'Van',
      'Malatya',
      'Denizli',
      'Şanlıurfa',
      'Sakarya',
      'Tekirdağ'
    ]
  },
  {
    country: 'United States',
    code: 'US',
    cities: [
      'New York',
      'Los Angeles',
      'Chicago',
      'Houston',
      'Phoenix',
      'Philadelphia',
      'San Antonio',
      'San Diego',
      'Dallas',
      'San Jose',
      'Austin',
      'Jacksonville',
      'Fort Worth',
      'Columbus',
      'Charlotte',
      'San Francisco',
      'Indianapolis',
      'Seattle',
      'Denver',
      'Washington'
      // ... (add more major US cities as needed)
    ]
  },
  {
    country: 'Canada',
    code: 'CA',
    cities: [
      'Toronto',
      'Montreal',
      'Vancouver',
      'Calgary',
      'Edmonton',
      'Ottawa',
      'Winnipeg',
      'Quebec City',
      'Hamilton',
      'Kitchener',
      'London',
      'Victoria',
      'Halifax',
      'Oshawa',
      'Windsor',
      'Saskatoon',
      'St. Catharines',
      'Regina',
      'St. John’s',
      'Kelowna'
      // ... (add more Canadian cities as needed)
    ]
  },
  {
    country: 'United Kingdom',
    code: 'GB',
    cities: [
      'London',
      'Manchester',
      'Birmingham',
      'Leeds',
      'Liverpool',
      'Bristol',
      'Sheffield',
      'Glasgow',
      'Edinburgh',
      'Cardiff',
      'Belfast',
      'Nottingham',
      'Leicester',
      'Coventry',
      'Kingston upon Hull',
      'Newcastle',
      'Sunderland',
      'Brighton',
      'Plymouth',
      'Wolverhampton'
    ]
  },
  {
    country: 'Germany',
    code: 'DE',
    cities: [
      'Berlin',
      'Munich',
      'Hamburg',
      'Frankfurt',
      'Cologne',
      'Stuttgart',
      'Düsseldorf',
      'Dortmund',
      'Essen',
      'Leipzig',
      'Bremen',
      'Dresden',
      'Hanover',
      'Nuremberg',
      'Duisburg',
      'Bochum',
      'Wuppertal',
      'Bielefeld',
      'Bonn',
      'Münster'
    ]
  },
  {
    country: 'France',
    code: 'FR',
    cities: [
      'Paris',
      'Marseille',
      'Lyon',
      'Toulouse',
      'Nice',
      'Nantes',
      'Strasbourg',
      'Montpellier',
      'Bordeaux',
      'Lille',
      'Rennes',
      'Reims',
      'Le Havre',
      'Saint-Étienne',
      'Toulon',
      'Grenoble',
      'Dijon',
      'Angers',
      'Nîmes',
      'Villeurbanne'
    ]
  },
  {
    country: 'Italy',
    code: 'IT',
    cities: [
      'Rome',
      'Milan',
      'Naples',
      'Turin',
      'Palermo',
      'Genoa',
      'Bologna',
      'Florence',
      'Bari',
      'Catania',
      'Venice',
      'Verona',
      'Messina',
      'Padua',
      'Trieste',
      'Taranto',
      'Brescia',
      'Prato',
      'Parma',
      'Modena'
    ]
  },
  {
    country: 'Spain',
    code: 'ES',
    cities: [
      'Madrid',
      'Barcelona',
      'Valencia',
      'Seville',
      'Zaragoza',
      'Málaga',
      'Murcia',
      'Palma',
      'Las Palmas',
      'Bilbao',
      'Alicante',
      'Córdoba',
      'Valladolid',
      'Vigo',
      'Gijón',
      'Hospitalet',
      'A Coruña',
      'Vitoria',
      'Granada',
      'Elche'
    ]
  },
  {
    country: 'Netherlands',
    code: 'NL',
    cities: [
      'Amsterdam',
      'Rotterdam',
      'The Hague',
      'Utrecht',
      'Eindhoven',
      'Tilburg',
      'Groningen',
      'Almere',
      'Breda',
      'Nijmegen',
      'Enschede',
      'Apeldoorn',
      'Haarlem',
      'Arnhem',
      'Zaanstad',
      'Amersfoort',
      'Haarlemmermeer',
      'Zwolle',
      'Leiden',
      'Maastricht'
    ]
  },
  {
    country: 'Belgium',
    code: 'BE',
    cities: [
      'Brussels',
      'Antwerp',
      'Ghent',
      'Charleroi',
      'Liège',
      'Bruges',
      'Namur',
      'Leuven',
      'Mons',
      'Aalst',
      'Mechelen',
      'La Louvière',
      'Kortrijk',
      'Hasselt',
      'Sint-Niklaas',
      'Ostend',
      'Tournai',
      'Genk',
      'Seraing',
      'Roeselare'
    ]
  },
  {
    country: 'Sweden',
    code: 'SE',
    cities: [
      'Stockholm',
      'Gothenburg',
      'Malmö',
      'Uppsala',
      'Västerås',
      'Örebro',
      'Linköping',
      'Helsingborg',
      'Jönköping',
      'Norrköping',
      'Lund',
      'Umeå',
      'Gävle',
      'Borås',
      'Eskilstuna',
      'Södertälje',
      'Karlstad',
      'Täby',
      'Växjö',
      'Halmstad'
    ]
  },
  {
    country: 'Norway',
    code: 'NO',
    cities: [
      'Oslo',
      'Bergen',
      'Trondheim',
      'Stavanger',
      'Drammen',
      'Fredrikstad',
      'Porsgrunn',
      'Skien',
      'Kristiansand',
      'Ålesund',
      'Tønsberg',
      'Moss',
      'Haugesund',
      'Sandefjord',
      'Arendal',
      'Bodø',
      'Tromsø',
      'Hamar',
      'Halden',
      'Larvik'
    ]
  },
  {
    country: 'Denmark',
    code: 'DK',
    cities: [
      'Copenhagen',
      'Aarhus',
      'Odense',
      'Aalborg',
      'Esbjerg',
      'Randers',
      'Kolding',
      'Horsens',
      'Vejle',
      'Roskilde',
      'Herning',
      'Silkeborg',
      'Næstved',
      'Fredericia',
      'Viborg',
      'Køge',
      'Holstebro',
      'Taastrup',
      'Slagelse',
      'Hillerød',
      'Sønderborg'
    ]
  },
  {
    country: 'Finland',
    code: 'FI',
    cities: [
      'Helsinki',
      'Espoo',
      'Tampere',
      'Vantaa',
      'Oulu',
      'Turku',
      'Jyväskylä',
      'Lahti',
      'Kuopio',
      'Pori',
      'Kouvola',
      'Joensuu',
      'Lappeenranta',
      'Hämeenlinna',
      'Vaasa',
      'Rovaniemi',
      'Seinäjoki',
      'Mikkeli',
      'Kotka',
      'Salo'
    ]
  },
  {
    country: 'Poland',
    code: 'PL',
    cities: [
      'Warsaw',
      'Kraków',
      'Łódź',
      'Wrocław',
      'Poznań',
      'Gdańsk',
      'Szczecin',
      'Bydgoszcz',
      'Lublin',
      'Białystok',
      'Katowice',
      'Gdynia',
      'Częstochowa',
      'Radom',
      'Sosnowiec',
      'Toruń',
      'Kielce',
      'Gliwice',
      'Zabrze',
      'Olsztyn'
    ]
  },
  {
    country: 'Switzerland',
    code: 'CH',
    cities: [
      'Zurich',
      'Geneva',
      'Basel',
      'Bern',
      'Lausanne',
      'Winterthur',
      'Lucerne',
      'St. Gallen',
      'Lugano',
      'Biel/Bienne',
      'Thun',
      'Köniz',
      'La Chaux-de-Fonds',
      'Schaffhausen',
      'Fribourg',
      'Chur',
      'Neuchâtel',
      'Vernier',
      'Uster',
      'Sion'
    ]
  },
  {
    country: 'Austria',
    code: 'AT',
    cities: [
      'Vienna',
      'Graz',
      'Linz',
      'Salzburg',
      'Innsbruck',
      'Klagenfurt',
      'Villach',
      'Wels',
      'Sankt Pölten',
      'Dornbirn',
      'Wiener Neustadt',
      'Steyr',
      'Feldkirch',
      'Bregenz',
      'Leonding',
      'Klosterneuburg',
      'Baden',
      'Wolfsberg',
      'Krems',
      'Traun'
    ]
  },
  {
    country: 'Ireland',
    code: 'IE',
    cities: [
      'Dublin',
      'Cork',
      'Limerick',
      'Galway',
      'Waterford',
      'Drogheda',
      'Dundalk',
      'Bray',
      'Swords',
      'Navan',
      'Ennis',
      'Tralee',
      'Carlow',
      'Newbridge',
      'Portlaoise',
      'Balbriggan',
      'Naas',
      'Athlone',
      'Mullingar',
      'Letterkenny'
    ]
  },
  {
    country: 'Portugal',
    code: 'PT',
    cities: [
      'Lisbon',
      'Porto',
      'Vila Nova de Gaia',
      'Amadora',
      'Braga',
      'Coimbra',
      'Funchal',
      'Setúbal',
      'Agualva-Cacém',
      'Queluz',
      'Almada',
      'Viseu',
      'Ponta Delgada',
      'Aveiro',
      'Odivelas',
      'Leiria',
      'Barreiro',
      'Rio Tinto',
      'Matosinhos',
      'Sintra'
    ]
  },
  {
    country: 'Czech Republic',
    code: 'CZ',
    cities: [
      'Prague',
      'Brno',
      'Ostrava',
      'Plzeň',
      'Liberec',
      'Olomouc',
      'Ústí nad Labem',
      'Hradec Králové',
      'Pardubice',
      'Zlín',
      'Havířov',
      'Kladno',
      'Most',
      'Karviná',
      'Jihlava',
      'Teplice',
      'Děčín',
      'Chomutov',
      'Přerov',
      'Frýdek-Místek'
    ]
  }
  // ... add more as needed
];

export function LocationPicker({
  value,
  onChange
}: {
  value: { country: string; city: string };
  onChange: (v: { country: string; city: string }) => void;
}) {
  const [countryQuery, setCountryQuery] = useState(value.country ?? '');
  const [cityQuery, setCityQuery] = useState(value.city ?? '');
  const [openCountry, setOpenCountry] = useState(false);
  const [openCity, setOpenCity] = useState(false);
  const countryWrapRef = useRef<HTMLDivElement | null>(null);
  const cityWrapRef = useRef<HTMLDivElement | null>(null);
  const [countryIdx, setCountryIdx] = useState(-1);
  const [cityIdx, setCityIdx] = useState(-1);

  const countryMatches = useMemo(() => {
    const q = countryQuery.toLowerCase();
    const base = q
      ? DATA.filter((c) => c.country.toLowerCase().includes(q))
      : DATA;
    return base.slice(0, 20);
  }, [countryQuery]);

  const selectedCountry = useMemo(() => {
    const needle = (value.country ?? countryQuery ?? '').toLowerCase();
    if (!needle) return undefined;
    return DATA.find((c) => c.country.toLowerCase() === needle);
  }, [value.country, countryQuery]);

  const cityMatches = useMemo(() => {
    const q = cityQuery.toLowerCase();
    const list = selectedCountry?.cities ?? [];
    const base = q ? list.filter((c) => c.toLowerCase().includes(q)) : list;
    return base.slice(0, 20);
  }, [selectedCountry, cityQuery]);

  const commitCountry = (country: string) => {
    setCountryQuery(country);
    onChange({ country, city: '' });
    setCityQuery('');
    setOpenCountry(false);
    setOpenCity(true);
    setCountryIdx(-1);
  };

  const commitCity = (city: string) => {
    setCityQuery(city);
    onChange({ country: value.country ?? countryQuery, city });
    setOpenCity(false);
    setCityIdx(-1);
  };

  // Close popovers on outside click
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      const inCountry = countryWrapRef.current?.contains(target) ?? false;
      const inCity = cityWrapRef.current?.contains(target) ?? false;
      if (!inCountry) {
        setOpenCountry(false);
      }
      if (!inCity) {
        setOpenCity(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div className='grid grid-cols-1 gap-3 md:grid-cols-2'>
      {/* Country dropdown */}
      <div className='relative' ref={countryWrapRef}>
        <div className='flex items-center rounded-lg border bg-white focus-within:ring-2 focus-within:ring-orange-500 dark:border-zinc-700 dark:bg-zinc-900'>
          <input
            value={countryQuery}
            onChange={(e) => {
              setCountryQuery(e.target.value);
              setOpenCountry(true);
              onChange({ country: e.target.value, city: '' });
            }}
            onFocus={() => setOpenCountry(true)}
            onKeyDown={(e) => {
              if (!openCountry) return;
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setCountryIdx((i) =>
                  Math.min(i + 1, countryMatches.length - 1)
                );
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setCountryIdx((i) => Math.max(i - 1, 0));
              } else if (e.key === 'Enter' && countryIdx >= 0) {
                e.preventDefault();
                const c = countryMatches[countryIdx];
                if (c) commitCountry(c.country);
              } else if (e.key === 'Escape') {
                setOpenCountry(false);
              }
            }}
            placeholder='Country'
            className='w-full bg-transparent px-3 py-2 outline-none'
          />
          <button
            type='button'
            onClick={() => setOpenCountry((v) => !v)}
            className='text-muted-foreground px-2 py-2 text-sm'
            aria-label='Toggle country list'
          >
            ▾
          </button>
        </div>
        {openCountry && countryMatches.length > 0 && (
          <div className='bg-popover text-popover-foreground absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border shadow'>
            {countryMatches.map((c, idx) => (
              <button
                type='button'
                key={c.code}
                className={`hover:bg-accent hover:text-accent-foreground w-full px-3 py-2 text-left ${idx === countryIdx ? 'bg-accent/60' : ''}`}
                onMouseEnter={() => setCountryIdx(idx)}
                onClick={() => commitCountry(c.country)}
              >
                {c.country}
              </button>
            ))}
          </div>
        )}
      </div>
      {/* City dropdown */}
      <div className='relative' ref={cityWrapRef}>
        <div className='flex items-center rounded-lg border bg-white focus-within:ring-2 focus-within:ring-orange-500 dark:border-zinc-700 dark:bg-zinc-900'>
          <input
            value={cityQuery}
            onChange={(e) => {
              setCityQuery(e.target.value);
              setOpenCity(true);
              onChange({
                country: value.country ?? countryQuery,
                city: e.target.value
              });
            }}
            onFocus={() => setOpenCity(true)}
            onKeyDown={(e) => {
              if (!openCity) return;
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setCityIdx((i) => Math.min(i + 1, cityMatches.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setCityIdx((i) => Math.max(i - 1, 0));
              } else if (e.key === 'Enter' && cityIdx >= 0) {
                e.preventDefault();
                const c = cityMatches[cityIdx];
                if (c) commitCity(c);
              } else if (e.key === 'Escape') {
                setOpenCity(false);
              }
            }}
            placeholder='City'
            disabled={!value.country && !countryQuery}
            className='w-full bg-transparent px-3 py-2 outline-none disabled:opacity-50'
          />
          <button
            type='button'
            onClick={() => setOpenCity((v) => !v)}
            disabled={!value.country && !countryQuery}
            className='text-muted-foreground px-2 py-2 text-sm disabled:opacity-50'
            aria-label='Toggle city list'
          >
            ▾
          </button>
        </div>
        {openCity && cityMatches.length > 0 && (
          <div className='bg-popover text-popover-foreground absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border shadow'>
            {cityMatches.map((city, idx) => (
              <button
                type='button'
                key={city}
                className={`hover:bg-accent hover:text-accent-foreground w-full px-3 py-2 text-left ${idx === cityIdx ? 'bg-accent/60' : ''}`}
                onMouseEnter={() => setCityIdx(idx)}
                onClick={() => commitCity(city)}
              >
                {city}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function formatLocation(value: { country: string; city: string }) {
  const c = value.country?.trim();
  const ci = value.city?.trim();
  if (c && ci) return `${c}, ${ci}`;
  return c ?? ci ?? '';
}
