export default function OverviewTab({ shipment }: { shipment: any }) {
  return (
    <div className='space-y-4'>
      <h2 className='text-lg font-semibold tracking-tight'>Overview</h2>
      <pre className='bg-card/50 max-h-[400px] overflow-auto rounded border p-4 text-xs'>
        {JSON.stringify(shipment, null, 2)}
      </pre>
    </div>
  );
}
