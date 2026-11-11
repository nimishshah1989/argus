import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { CircleCheck, CircleStop, Clock3, type LucideIcon } from 'lucide-react';
import type { PreviewCondition, PreviewWork } from './data.js';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: LucideIcon;
  variant?: 'primary' | 'secondary' | 'quiet';
}

export function Button({
  children,
  className = '',
  icon: Icon,
  type = 'button',
  variant = 'secondary',
  ...props
}: ButtonProps) {
  return (
    <button
      className={`preview-button preview-button--${variant} ${className}`}
      type={type}
      {...props}
    >
      {Icon ? <Icon aria-hidden="true" size={19} strokeWidth={1.8} /> : null}
      <span>{children}</span>
    </button>
  );
}

interface IconLabelProps {
  icon: LucideIcon;
  children: ReactNode;
  className?: string;
}

export function IconLabel({ icon: Icon, children, className = '' }: IconLabelProps) {
  return (
    <span className={`preview-icon-label ${className}`}>
      <Icon aria-hidden="true" size={19} strokeWidth={1.8} />
      <span>{children}</span>
    </span>
  );
}

interface StatusPairProps {
  condition: PreviewCondition;
  work: PreviewWork;
}

export function StatusPair({ condition, work }: StatusPairProps) {
  const tone = work === 'Waiting' ? 'waiting' : condition === 'Stopped' ? 'stopped' : 'running';
  const Icon = work === 'Waiting' ? Clock3 : condition === 'Stopped' ? CircleStop : CircleCheck;
  return (
    <span className={`preview-status-pair preview-status-pair--${tone}`}>
      <Icon aria-hidden="true" size={17} strokeWidth={2} />
      {`${condition} · ${work}`}
    </span>
  );
}

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = '' }: CardProps) {
  return <div className={`preview-card ${className}`}>{children}</div>;
}

interface FieldProps {
  id: string;
  label: string;
  hint?: string;
  children: ReactNode;
}

export function Field({ id, label, hint, children }: FieldProps) {
  return (
    <div className="preview-field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint ? <p id={`${id}-hint`}>{hint}</p> : null}
    </div>
  );
}
