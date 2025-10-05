import { PhoneCall } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';

export const FAQ2 = () => (
  <div className='w-full py-20 lg:py-40'>
    <div className='container mx-auto'>
      <div className='flex flex-col gap-10'>
        <div className='flex flex-col items-center justify-center gap-4 text-center'>
          <Badge variant='outline'>FAQ</Badge>
          <div className='flex flex-col gap-2'>
            <h4 className='font-regular max-w-xl text-center text-3xl tracking-tighter md:text-5xl'>
              This is the start of something new
            </h4>
            <p className='text-muted-foreground max-w-xl text-center text-lg leading-relaxed tracking-tight'>
              Managing a small business today is already tough. Avoid further
              complications by ditching outdated, tedious trade methods. Our
              goal is to streamline SMB trade, making it easier and faster than
              ever.
            </p>
          </div>
          <div>
            <Button className='gap-4' variant='outline'>
              Any questions? Reach out <PhoneCall className='h-4 w-4' />
            </Button>
          </div>
        </div>

        <div className='mx-auto w-full max-w-3xl'>
          <Accordion type='single' collapsible className='w-full'>
            {Array.from({ length: 8 }).map((_, index) => (
              <AccordionItem key={index} value={'index-' + index}>
                <AccordionTrigger>
                  This is the start of something new
                </AccordionTrigger>
                <AccordionContent>
                  Managing a small business today is already tough. Avoid
                  further complications by ditching outdated, tedious trade
                  methods. Our goal is to streamline SMB trade, making it easier
                  and faster than ever.
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </div>
  </div>
);
