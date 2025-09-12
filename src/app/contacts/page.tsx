export const metadata = { title: 'Contacts' };
import { ContactsClient } from '@/components/contacts/contacts-client';

export default async function ContactsPage() {
  return (
    <div className='space-y-6 p-6'>
      <header className='mb-6'>
        <h1 className='flex items-center gap-2 text-2xl font-bold'>
          Contacts.
        </h1>
        <p className='text-muted-foreground mt-1 text-sm'>
          All your logistics connections in one place. Forwarders, shippers,
          partners, and your internal team.
        </p>
      </header>
      <ContactsClient />
    </div>
  );
}
