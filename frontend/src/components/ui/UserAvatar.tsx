import { useEffect, useState } from 'react';
import { cn } from '../../lib/utils';

/** "Amaka Obi" -> "AO", "amaka" -> "A". Letters only, so "(Ada) O." still reads "AO". */
export function initialsOf(name: string | null | undefined): string {
  const words = String(name ?? '')
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : '';
  return (first + last).toUpperCase();
}

/**
 * A person's photo, or their initials when they have none (or it fails to
 * load). The one avatar for people across the app; no stock pictures.
 */
export function UserAvatar({
  name,
  avatarUrl,
  size,
  className,
}: {
  name: string | null | undefined;
  avatarUrl?: string | null;
  /** Pixels. Leave unset to size it with className (e.g. responsive w-/h-/text- classes). */
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [avatarUrl]);
  const style = size ? { width: size, height: size } : undefined;

  if (avatarUrl && !failed) {
    return (
      <img
        src={avatarUrl}
        alt=""
        style={style}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={cn('shrink-0 rounded-full bg-slate-100 object-cover dark:bg-zinc-800', className)}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      style={size ? { ...style, fontSize: Math.max(10, Math.round(size * 0.38)) } : undefined}
      className={cn(
        'flex shrink-0 select-none items-center justify-center rounded-full bg-linear-to-br from-indigo-600 to-sky-600 font-semibold leading-none text-white',
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  );
}
