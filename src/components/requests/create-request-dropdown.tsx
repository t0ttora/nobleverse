import React from 'react';
import type { FreightFormType } from '@/lib/freight-form-schema';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Icons } from '../icons';
import { SidePanel } from '@/components/ui/side-panel';
import { MultiStepFreightForm } from '../ui/multi-step-freight-form';
import { supabase } from '../../../utils/supabase/client';

const FREIGHT_TYPES: {
  type: FreightFormType;
  label: string;
  icon: keyof typeof Icons;
}[] = [
  { type: 'road', label: 'Road Freight', icon: 'road' },
  { type: 'sea', label: 'Sea Freight', icon: 'sea' },
  { type: 'air', label: 'Air Freight', icon: 'air' },
  { type: 'rail', label: 'Rail Freight', icon: 'rail' },
  { type: 'multimodal', label: 'Multimodal Freight', icon: 'multimodal' },
  { type: 'courier', label: 'Courier / Express Shipping', icon: 'courier' }
];

interface CreateRequestDropdownProps {
  onRequestCreated?: (request: any) => void;
}

export function CreateRequestDropdown({
  onRequestCreated
}: CreateRequestDropdownProps) {
  const [drawerType, setDrawerType] = React.useState<FreightFormType | null>(
    null
  );
  const [userId, setUserId] = React.useState<string>('');
  const [footerContent, setFooterContent] =
    React.useState<React.ReactNode>(null);

  React.useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      setUserId(data?.user?.id ?? '');
    });
  }, []);

  const handleOpenDrawer = (type: FreightFormType) => {
    setDrawerType(type);
  };

  const handleCloseDrawer = () => {
    setDrawerType(null);
  };

  // Find the selected freight type for icon and label
  const selectedFreight = FREIGHT_TYPES.find((f) => f.type === drawerType);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className='border-border focus:ring-ring flex items-center justify-center rounded-md border bg-black px-3 py-2 font-semibold text-white transition-colors hover:bg-gray-900 hover:text-white hover:opacity-90 focus:ring-2 focus:ring-offset-2 focus:outline-none dark:bg-white dark:text-black dark:hover:bg-gray-100 dark:hover:text-black'>
            <span className='flex items-center gap-2'>
              <span className='flex items-center justify-center'>
                <Icons.addCircleFilled size={15} />
              </span>
              <span className='bg-black text-[13px] font-medium text-white dark:bg-white dark:text-black'>
                Create Request
              </span>
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end'>
          {FREIGHT_TYPES.map((freight) => (
            <DropdownMenuItem
              key={freight.type}
              onClick={() => handleOpenDrawer(freight.type)}
            >
              <span className='flex items-center gap-2'>
                <span className='bg-muted text-muted-foreground flex h-5 w-5 items-center justify-center rounded-full'>
                  {Icons[freight.icon] &&
                    React.createElement(Icons[freight.icon], {
                      size: 16,
                      stroke: 1.7
                    })}
                </span>
                {freight.label}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <SidePanel
        open={!!drawerType}
        title={
          drawerType && selectedFreight ? (
            <span className='flex items-center gap-2'>
              <span className='bg-muted text-muted-foreground flex h-6 w-6 items-center justify-center rounded-full'>
                {Icons[selectedFreight.icon] &&
                  React.createElement(Icons[selectedFreight.icon], {
                    size: 18,
                    stroke: 1.7
                  })}
              </span>
              <span>{selectedFreight.label} Request</span>
            </span>
          ) : (
            ''
          )
        }
        onClose={handleCloseDrawer}
        footer={footerContent}
      >
        {drawerType && (
          <MultiStepFreightForm
            type={drawerType}
            userId={userId}
            onSuccess={(request) => {
              if (onRequestCreated) onRequestCreated(request);
              handleCloseDrawer();
            }}
            onFooterChange={(f) => {
              setFooterContent((prev) => (prev === f ? prev : f));
            }}
          />
        )}
      </SidePanel>
    </>
  );
}
