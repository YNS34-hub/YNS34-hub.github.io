import { X, ArrowUpRight } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
export function PalaceMark() {
  return (
    <span className="brand-symbol" aria-hidden="true">
      <svg viewBox="0 0 32 32" width="30" height="30" fill="none">
        <circle
          cx="16"
          cy="16"
          r="3.4"
          stroke="currentColor"
          strokeWidth="1.2"
        />
        {Array.from({ length: 8 }, (_, i) => (
          <path
            key={i}
            d="M16 2.5V9.5"
            stroke="currentColor"
            strokeWidth="1.2"
            transform={`rotate(${i * 45} 16 16)`}
          />
        ))}
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
