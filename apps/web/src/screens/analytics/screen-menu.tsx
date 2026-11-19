import { Link } from 'react-router-dom';
import './register-parts.css';

export interface MenuItem {
  id: string;
  to: string;
  label: string;
}

/**
 * A group's own screens as one row of links, the same row as the shell's tabs (the shell draws none for a group with
 * one tab). `pills` is the quieter switch inside a screen (the register kinds); both are one navigation each.
 */
export function ScreenMenu({
  label,
  items,
  current,
  pills = false,
}: {
  label: string;
  items: readonly MenuItem[];
  current: string;
  pills?: boolean;
}) {
  return (
    <nav aria-label={label} className={pills ? 'rg-pills' : 'rg-menu'}>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <Link
              to={item.to}
              // eslint-disable-next-line i18next/no-literal-string -- ARIA value, not copy
              aria-current={item.id === current ? 'page' : undefined}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
