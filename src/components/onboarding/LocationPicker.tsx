'use client';
import React, { useMemo, useRef, useState, useEffect } from 'react';

interface CountryCities {
  country: string;
  code: string;
  cities: string[];
}

// Expanded country list (sample larger set for better UX)
const DATA: CountryCities[] = [
  {
    country: 'Türkiye',
    code: 'TR',
    cities: ['İstanbul', 'Ankara', 'İzmir', 'Bursa', 'Antalya', 'Mersin']
  },
  {
    country: 'United States',
    code: 'US',
    cities: [
      'New York',
      'Los Angeles',
      'Chicago',
      'Houston',
      'Miami',
      'Seattle'
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
      'Bristol'
    ]
  },
  {
    country: 'Germany',
    code: 'DE',
    cities: ['Berlin', 'Munich', 'Hamburg', 'Frankfurt', 'Cologne', 'Stuttgart']
  },
  {
    country: 'Netherlands',
    code: 'NL',
    cities: ['Amsterdam', 'Rotterdam', 'The Hague', 'Utrecht', 'Eindhoven']
  },
  {
    country: 'United Arab Emirates',
    code: 'AE',
    cities: ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman']
  },
  {
    country: 'China',
    code: 'CN',
    cities: ['Shanghai', 'Shenzhen', 'Guangzhou', 'Beijing', 'Ningbo']
  },
  {
    country: 'India',
    code: 'IN',
    cities: ['Mumbai', 'Delhi', 'Bengaluru', 'Chennai', 'Hyderabad']
  },
  {
    country: 'Spain',
    code: 'ES',
    cities: ['Madrid', 'Barcelona', 'Valencia', 'Seville']
  },
  {
    country: 'Italy',
    code: 'IT',
    cities: ['Milan', 'Rome', 'Naples', 'Turin']
  },
  {
    country: 'France',
    code: 'FR',
    cities: ['Paris', 'Lyon', 'Marseille', 'Lille', 'Toulouse']
  },
  {
    country: 'Canada',
    code: 'CA',
    cities: ['Toronto', 'Vancouver', 'Montreal', 'Calgary', 'Ottawa']
  },
  {
    country: 'Brazil',
    code: 'BR',
    cities: ['São Paulo', 'Rio de Janeiro', 'Brasília', 'Curitiba']
  },
  {
    country: 'Japan',
    code: 'JP',
    cities: ['Tokyo', 'Osaka', 'Nagoya', 'Fukuoka']
  },
  {
    country: 'South Korea',
    code: 'KR',
    cities: ['Seoul', 'Busan', 'Incheon', 'Daegu']
  },
  {
    country: 'Australia',
    code: 'AU',
    cities: ['Sydney', 'Melbourne', 'Brisbane', 'Perth']
  },
  {
    country: 'Mexico',
    code: 'MX',
    cities: ['Mexico City', 'Guadalajara', 'Monterrey']
  },
  {
    country: 'South Africa',
    code: 'ZA',
    cities: ['Johannesburg', 'Cape Town', 'Durban']
  },
  {
    country: 'Russia',
    code: 'RU',
    cities: ['Moscow', 'Saint Petersburg', 'Novosibirsk']
  },
  { country: 'Poland', code: 'PL', cities: ['Warsaw', 'Kraków', 'Gdańsk'] },
  {
    country: 'Sweden',
    code: 'SE',
    cities: ['Stockholm', 'Gothenburg', 'Malmö']
  },
  { country: 'Norway', code: 'NO', cities: ['Oslo', 'Bergen', 'Trondheim'] },
  {
    country: 'Denmark',
    code: 'DK',
    cities: ['Copenhagen', 'Aarhus', 'Odense']
  },
  { country: 'Switzerland', code: 'CH', cities: ['Zurich', 'Geneva', 'Basel'] }
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
