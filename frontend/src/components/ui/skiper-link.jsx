import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

/** Skiper-style animated underline link (Vite-compatible) */
export function SkiperLink({ to, href, children, className, external = false }) {
  const classes = cn(
    'group relative inline-flex items-center gap-1 text-[13px] font-medium text-green transition-colors hover:text-green-bright',
    'before:pointer-events-none before:absolute before:bottom-0 before:left-0 before:h-[1px] before:w-full before:bg-current before:content-[""]',
    'before:origin-right before:scale-x-0 before:transition-transform before:duration-300 before:ease-[cubic-bezier(0.4,0,0.2,1)]',
    'hover:before:origin-left hover:before:scale-x-100',
    className,
  );

  const arrow = (
    <svg
      className="ml-1 size-3 translate-y-px opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100"
      fill="none"
      viewBox="0 0 10 10"
      aria-hidden="true"
    >
      <path d="M1.004 9.166 9.337.833m0 0v8.333m0-8.333H1.004" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  if (href || external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={classes}>
        {children}
        {arrow}
      </a>
    );
  }

  return (
    <Link to={to} className={classes}>
      {children}
      {arrow}
    </Link>
  );
}
