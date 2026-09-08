const fs = require('fs');
const path = require('path');

const files = [
  'src/pages/patient/ManageBooking.tsx',
  'src/pages/patient/DaySelector.tsx',
  'src/pages/patient/SlotSelector.tsx',
  'src/pages/patient/Confirmation.tsx',
  'src/pages/patient/PatientForm.tsx',
  'src/pages/patient/Summary.tsx',
  'src/pages/patient/BookingStart.tsx',
  'src/pages/admin/AdminDashboard.tsx',
  'src/components/layout/AppLayout.tsx',
  'src/components/ui/Button.tsx'
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  // Replace backgrounds
  content = content.replace(/bg-\[#0A0A0A\]/g, 'bg-white');
  content = content.replace(/bg-\[#1C1C1E\]/g, 'bg-neutral-50');
  content = content.replace(/bg-\[#2C2C2E\]/g, 'bg-neutral-100');
  content = content.replace(/bg-neutral-800/g, 'bg-neutral-100');
  content = content.replace(/bg-neutral-900/g, 'bg-white');
  
  // AppLayout specific
  content = content.replace(/bg-black/g, 'bg-white');
  content = content.replace(/text-white/g, 'text-neutral-900');
  
  // Replace text colors
  content = content.replace(/text-neutral-400/g, 'text-neutral-500');
  content = content.replace(/text-neutral-300/g, 'text-neutral-600');
  content = content.replace(/text-neutral-100/g, 'text-neutral-900');
  content = content.replace(/text-\[#F5F5F7\]/g, 'text-neutral-900');
  
  // Replace borders
  content = content.replace(/border-neutral-800/g, 'border-neutral-200');
  content = content.replace(/border-\[#2C2C2E\]/g, 'border-neutral-200');
  content = content.replace(/border-\[#3A3A3C\]/g, 'border-neutral-300');
  
  // Replace rounding - slightly less rounded (from 3xl to xl)
  content = content.replace(/rounded-3xl/g, 'rounded-xl');
  content = content.replace(/rounded-2xl/g, 'rounded-xl');
  content = content.replace(/rounded-full/g, 'rounded-xl'); // buttons were full sometimes, let's make them xl for consistency, except maybe icon buttons. I'll be careful.
  
  // Specific button styles
  // We want the primary button to be dark (e.g. bg-neutral-900 text-white) to contrast with the white background.
  
  fs.writeFileSync(file, content);
});

console.log("Theme replaced.");
