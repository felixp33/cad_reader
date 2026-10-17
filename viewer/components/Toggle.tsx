'use client';

// Labelled on/off switch.
export default function Toggle({ label, checked, onChange, title }: {
  label: string; checked: boolean; onChange: (v: boolean) => void; title?: string;
}) {
  return (
    <label className="toggle" title={title}>
      <span>{label}</span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}
