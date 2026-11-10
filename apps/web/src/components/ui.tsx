import * as Dialog from '@radix-ui/react-dialog';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { clsx } from 'clsx';
import { X } from 'lucide-react';
import { useId, useRef, type ButtonHTMLAttributes, type KeyboardEvent, type ReactNode } from 'react';
import { useL } from '../i18n';

const variants = cva('button', {
  variants: {
    variant: { primary: 'primary', secondary: 'secondary', ghost: 'ghost', danger: 'danger' },
    size: { md: '', sm: 'small', icon: 'icon' },
  },
  defaultVariants: { variant: 'secondary', size: 'md' },
});
export function Button({
  variant = 'secondary',
  size = 'md',
  asChild = false,
  className,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'md' | 'sm' | 'icon';
  asChild?: boolean;
}) {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={clsx(variants({ variant, size }), className)} {...(asChild ? {} : { type })} {...props} />;
}

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  wide,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  const l = useL();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content className={clsx('modal', wide && 'wide')}>
          <div className="modal-heading">
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label={l('Close', 'Fermer')}>
                <X size={18} />
              </Button>
            </Dialog.Close>
          </div>
          <Dialog.Description className={description ? 'muted' : 'sr-only'}>{description ?? title}</Dialog.Description>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function Badge({ children, tone = 'neutral', title }: { children: ReactNode; tone?: string; title?: string }) {
  return (
    <span className={`badge ${tone}`} title={title}>
      {children}
    </span>
  );
}

/** Roving-focus helper for horizontal option groups (tabs, segmented controls). */
function arrowNavigate(e: KeyboardEvent<HTMLElement>, count: number, index: number, select: (i: number) => void) {
  const next =
    e.key === 'ArrowRight' ? (index + 1) % count : e.key === 'ArrowLeft' ? (index - 1 + count) % count : e.key === 'Home' ? 0 : e.key === 'End' ? count - 1 : -1;
  if (next < 0) return;
  e.preventDefault();
  select(next);
  (e.currentTarget.parentElement?.children[next] as HTMLElement | undefined)?.focus();
}

export function Tabs<T extends string>({
  value,
  onChange,
  items,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  items: { id: T; label: ReactNode; count?: number }[];
  label: string;
}) {
  const id = useId();
  const index = items.findIndex((i) => i.id === value);
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          id={`${id}-${item.id}`}
          aria-selected={item.id === value}
          tabIndex={item.id === value ? 0 : -1}
          className={item.id === value ? 'active' : ''}
          onClick={() => onChange(item.id)}
          onKeyDown={(e) => arrowNavigate(e, items.length, index, (n) => onChange(items[n].id))}
        >
          {item.label}
          {item.count ? <span className="count">{item.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  items,
  label,
  disabled,
}: {
  value: T;
  onChange: (v: T) => void;
  items: { id: T; label: ReactNode }[];
  label: string;
  disabled?: boolean;
}) {
  const index = items.findIndex((i) => i.id === value);
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {items.map((item, i) => (
        <button
          key={item.id}
          type="button"
          role="radio"
          aria-checked={item.id === value}
          tabIndex={item.id === value || (index < 0 && i === 0) ? 0 : -1}
          disabled={disabled}
          className={item.id === value ? 'active' : ''}
          onClick={() => onChange(item.id)}
          onKeyDown={(e) => arrowNavigate(e, items.length, index, (n) => onChange(items[n].id))}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="empty-state">
      {icon}
      <strong>{title}</strong>
      {children}
    </div>
  );
}

/** Focuses the first invalid field after a failed submit, for keyboard and screen-reader users. */
export function useFocusFirstInvalid() {
  const ref = useRef<HTMLFormElement>(null);
  return [ref, () => (ref.current?.querySelector(':invalid') as HTMLElement | null)?.focus()] as const;
}

/** Accessible on/off switch (`role="switch"`), used for yes/no settings and questions. */
export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
  id,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: ReactNode;
  description?: string;
  disabled?: boolean;
  id?: string;
}) {
  const generated = useId();
  const switchId = id ?? generated;
  return (
    <div className="switch-field">
      <button
        type="button"
        role="switch"
        id={switchId}
        aria-checked={checked}
        aria-describedby={description ? `${switchId}-description` : undefined}
        disabled={disabled}
        className={`switch ${checked ? 'on' : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span className="switch-thumb" aria-hidden />
      </button>
      <label htmlFor={switchId}>{label}</label>
      {description && (
        <small id={`${switchId}-description`} className="muted">
          {description}
        </small>
      )}
    </div>
  );
}
