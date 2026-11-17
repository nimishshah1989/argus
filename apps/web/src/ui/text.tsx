import type { ReactNode } from 'react';

/** The six type sizes of the lock; a face writes words through this, never a bare styled tag. */
const SIZE = {
  caption: 'text-caption',
  footnote: 'text-footnote',
  body: 'text-body',
  title3: 'text-title3',
  title2: 'text-title2',
  title1: 'text-title1',
};
const TONE = {
  primary: 'text-neutral-900',
  secondary: 'text-neutral-600',
  accent: 'text-accent-text',
  danger: 'text-danger-ink',
};
const WEIGHT = { regular: 'font-normal', semibold: 'font-semibold', bold: 'font-bold' };

export function Text({
  as: Tag = 'p',
  size = 'body',
  tone = 'primary',
  weight = 'regular',
  children,
}: {
  /** A heading when the words title a screen or a result. */
  as?: 'p' | 'h2' | 'h3';
  size?: keyof typeof SIZE;
  tone?: keyof typeof TONE;
  weight?: keyof typeof WEIGHT;
  children: ReactNode;
}) {
  return (
    <Tag className={`${SIZE[size]} leading-body ${TONE[tone]} ${WEIGHT[weight]}`}>{children}</Tag>
  );
}
