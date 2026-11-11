import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { CircleCheck, CircleStop, Clock3, type LucideIcon } from 'lucide-react';
import type { PreviewCondition, PreviewWork } from './data.js';

export const disclosure = 'overflow-hidden rounded-[14px] border border-[var(--line)] bg-white';
export const disclosureSummary =
  'flex min-h-[52px] cursor-pointer list-none items-center gap-2.5 px-3.5 py-3 font-semibold';
export const mutedText = 'text-[13px] text-[var(--muted)]';
export const countStyle =
  'preview-count inline-grid min-h-7 min-w-7 place-items-center rounded-full bg-[var(--neutral)] px-2 py-0.5 text-[13px] font-semibold text-[var(--muted)]';
export const fieldInput =
  'min-h-[52px] w-full min-w-0 rounded-xl border border-[#c9c9cf] bg-white px-3.5 py-3 text-base text-[var(--ink)]';

const buttonBase =
  'inline-flex min-h-[52px] min-w-[52px] items-center justify-center gap-2 rounded-[14px] border border-[var(--line)] px-[18px] py-3 font-semibold leading-tight text-[var(--ink)] transition-colors duration-200 motion-reduce:transition-none';
const buttonVariants = {
  primary: 'border-[var(--teal)] bg-[var(--teal)] text-white hover:bg-[#004b48]',
  secondary: 'bg-white hover:bg-[var(--neutral)]',
  quiet: 'border-transparent bg-transparent hover:bg-[var(--neutral)]',
};
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
      className={`${buttonBase} ${buttonVariants[variant]} ${className}`}
      type={type}
      {...props}
    >
      {Icon ? <Icon className="shrink-0" aria-hidden="true" size={19} strokeWidth={1.8} /> : null}
      <span>{children}</span>
    </button>
  );
}

type IconLabelProps = { icon: LucideIcon; children: ReactNode; className?: string };
export function IconLabel({ icon: Icon, children, className = '' }: IconLabelProps) {
  return (
    <span className={`flex items-center gap-2 ${className}`}>
      <Icon className="shrink-0" aria-hidden="true" size={19} strokeWidth={1.8} />
      <span>{children}</span>
    </span>
  );
}

const statusTones = {
  stopped: 'bg-[var(--red-soft)] text-[var(--red)]',
  waiting: 'bg-[var(--amber-soft)] text-[var(--amber)]',
  running: 'bg-[var(--green-soft)] text-[var(--green)]',
};
const statusBase =
  'inline-flex w-fit max-w-full items-center gap-2 rounded-full px-2.5 py-1.5 text-[13px] font-bold';
type StatusPairProps = { condition: PreviewCondition; work: PreviewWork };
export function StatusPair({ condition, work }: StatusPairProps) {
  const tone = work === 'Waiting' ? 'waiting' : condition === 'Stopped' ? 'stopped' : 'running';
  const Icon = work === 'Waiting' ? Clock3 : condition === 'Stopped' ? CircleStop : CircleCheck;
  return (
    <span className={`${statusBase} ${statusTones[tone]}`}>
      <Icon className="shrink-0" aria-hidden="true" size={17} strokeWidth={2} />
      {`${condition} · ${work}`}
    </span>
  );
}

const cardBase = 'min-w-0 rounded-[20px] border border-[var(--line)] bg-white p-5 shadow-sm sm:p-7';
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`${cardBase} ${className}`}>{children}</div>;
}

type FieldProps = { id: string; label: string; children: ReactNode };
export function Field({ id, label, children }: FieldProps) {
  return (
    <div className="grid gap-2">
      <label className="font-semibold" htmlFor={id}>
        {label}
      </label>
      {children}
    </div>
  );
}
