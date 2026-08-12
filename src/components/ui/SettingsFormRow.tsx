import type { ReactNode } from 'react';

type Props = {
  label: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
};

/** Label (αριστερά) + περιεχόμενο (δεξιά) για φόρμες Ρυθμίσεων. */
export function SettingsFormRow({ label, htmlFor, children, className = '' }: Props) {
  return (
    <div className={`settings-form-row ${className}`.trim()}>
      <label className="settings-form-row-label" htmlFor={htmlFor}>
        {label}
      </label>
      <div className="settings-form-row-content">{children}</div>
    </div>
  );
}
