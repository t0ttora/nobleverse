import { redirect } from 'next/navigation';
export default function LegacyCellsRedirect() {
  // Cells removed — send users to NobleSuite root
  redirect('/noblesuite');
}
