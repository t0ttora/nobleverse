'use client';
import React, {
  useMemo,
  useRef,
  useState,
  useEffect,
  useLayoutEffect
} from 'react';
import { createPortal } from 'react-dom';

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
  const countryListRef = useRef<HTMLDivElement | null>(null);
  const cityListRef = useRef<HTMLDivElement | null>(null);
  const countryAnchorRef = useRef<HTMLDivElement | null>(null);
  const cityAnchorRef = useRef<HTMLDivElement | null>(null);
  const countryPortalRef = useRef<HTMLDivElement | null>(null);
  const cityPortalRef = useRef<HTMLDivElement | null>(null);
  const [countryRect, setCountryRect] = useState<DOMRect | null>(null);
  const [cityRect, setCityRect] = useState<DOMRect | null>(null);

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
  };

  const commitCity = (city: string) => {
    setCityQuery(city);
    onChange({ country: value.country ?? countryQuery, city });
    setOpenCity(false);
  };

  // Close popovers on outside click
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      const inCountry =
        (countryListRef.current?.contains(target) ?? false) ||
        (countryPortalRef.current?.contains(target) ?? false) ||
        (countryAnchorRef.current?.contains(target) ?? false);
      const inCity =
        (cityListRef.current?.contains(target) ?? false) ||
        (cityPortalRef.current?.contains(target) ?? false) ||
        (cityAnchorRef.current?.contains(target) ?? false);
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

  // Recompute anchor rects when open or on resize/scroll
  useLayoutEffect(() => {
    const compute = () => {
      if (openCountry && countryAnchorRef.current) {
        setCountryRect(countryAnchorRef.current.getBoundingClientRect());
      }
      if (openCity && cityAnchorRef.current) {
        setCityRect(cityAnchorRef.current.getBoundingClientRect());
      }
    };
    compute();
    window.addEventListener('resize', compute);
    window.addEventListener('scroll', compute, true);
    return () => {
      window.removeEventListener('resize', compute);
      window.removeEventListener('scroll', compute, true);
    };
  }, [openCountry, openCity]);

  return (
    <div className='grid grid-cols-1 gap-3 md:grid-cols-2'>
      {/* Country dropdown */}
      <div className='relative' ref={countryListRef}>
        <div
          ref={countryAnchorRef}
          className='flex items-center rounded-lg border bg-white focus-within:ring-2 focus-within:ring-orange-500 dark:border-zinc-700 dark:bg-zinc-900'
        >
          <input
            value={countryQuery}
            onChange={(e) => {
              setCountryQuery(e.target.value);
              setOpenCountry(true);
              onChange({ country: e.target.value, city: '' });
            }}
            onFocus={() => setOpenCountry(true)}
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
        {openCountry &&
          countryMatches.length > 0 &&
          countryRect &&
          typeof window !== 'undefined' &&
          createPortal(
            <div
              ref={countryPortalRef}
              style={(function () {
                const pad = 12;
                const desired = Math.max(countryRect.width, 320);
                const maxLeft = window.innerWidth - pad - desired;
                const left = Math.min(
                  Math.max(countryRect.left, pad),
                  Math.max(pad, maxLeft)
                );
                return {
                  position: 'fixed' as const,
                  top: countryRect.bottom + 4,
                  left,
                  width: desired,
                  zIndex: 10000
                };
              })()}
              className='bg-popover text-popover-foreground max-h-64 overflow-auto rounded-md border shadow'
            >
              {countryMatches.map((c) => (
                <button
                  type='button'
                  key={c.code}
                  className='hover:bg-accent hover:text-accent-foreground w-full px-3 py-2 text-left'
                  onClick={() => commitCountry(c.country)}
                >
                  {c.country}
                </button>
              ))}
            </div>,
            document.body
          )}
      </div>
      {/* City dropdown */}
      <div className='relative' ref={cityListRef}>
        <div
          ref={cityAnchorRef}
          className='flex items-center rounded-lg border bg-white focus-within:ring-2 focus-within:ring-orange-500 dark:border-zinc-700 dark:bg-zinc-900'
        >
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
        {openCity &&
          cityMatches.length > 0 &&
          cityRect &&
          typeof window !== 'undefined' &&
          createPortal(
            <div
              ref={cityPortalRef}
              style={(function () {
                const pad = 12;
                const desired = Math.max(cityRect.width, 320);
                const maxLeft = window.innerWidth - pad - desired;
                const left = Math.min(
                  Math.max(cityRect.left, pad),
                  Math.max(pad, maxLeft)
                );
                return {
                  position: 'fixed' as const,
                  top: cityRect.bottom + 4,
                  left,
                  width: desired,
                  zIndex: 10000
                };
              })()}
              className='bg-popover text-popover-foreground max-h-64 overflow-auto rounded-md border shadow'
            >
              {cityMatches.map((city) => (
                <button
                  type='button'
                  key={city}
                  className='hover:bg-accent hover:text-accent-foreground w-full px-3 py-2 text-left'
                  onClick={() => commitCity(city)}
                >
                  {city}
                </button>
              ))}
            </div>,
            document.body
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
