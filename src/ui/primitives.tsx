import { X, ArrowUpRight } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
export function PalaceMark() {
  return (
    <span className="brand-symbol" aria-hidden="true">
      <svg viewBox="0 0 24 32" width="23" height="30" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 29V5L17 2V26L3 29Z" />
        <path d="M17 2L22 7V30L17 26M3 5L8 9V27.5" opacity=".55" />
        <path d="M13 11C18 11 18.5 20.5 13.5 22C9 23.2 8.5 15.8 11.8 14.7C14 14 14.8 12.6 13 11Z" opacity=".78" />
      </svg>
    </span>
  );
}
export function CloseButton({
  onClick,
  label = "Close",
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      className="icon-button close-button"
      onClick={onClick}
      aria-label={label}
    >
      <X size={20} />
    </button>
  );
}
export function ExternalLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a
      className="external-link"
      href={href}
      target={href.startsWith("mailto:") ? undefined : "_blank"}
      rel="noopener noreferrer"
    >
      {children}
      <ArrowUpRight size={16} />
    </a>
  );
}
export function Dialog({
  children,
  label,
  className = "",
  onClose,
}: {
  children: ReactNode;
  label: string;
  className?: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const node = ref.current;
    const tabbables = () => [
      ...(node?.querySelectorAll<HTMLElement>(
        'button:not([disabled]),a[href],input,select,textarea,[tabindex="0"]',
      ) || []),
    ];
    tabbables()[0]?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        closeRef.current();
      }
      if (event.key !== "Tab") return;
      const list = tabbables();
      const first = list[0];
      const last = list[list.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    node?.addEventListener("keydown", trap);
    return () => {
      node?.removeEventListener("keydown", trap);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="dialog-backdrop"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={`panel ${className}`}
      >
        <CloseButton onClick={onClose} />
        {children}
      </div>
    </div>
  );
}
