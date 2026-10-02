import { useState } from "react";
import { Check, Copy, ArrowRight } from "lucide-react";
import { usePalaceStore } from "../systems/store";
import { Dialog, ExternalLink } from "./primitives";
import { reviewWorkflow as steps } from "../content/catalog";
export default function Focus() {
  const { focus: item, focusItem, enterRoom } = usePalaceStore();
  const [copied, setCopied] = useState(false);
  const [step, setStep] = useState(0);
  if (!item) return null;
  const close = () => focusItem(null);
  return (
    <Dialog label={item.title} className="focus-panel" onClose={close}>
      <div className="focus-head">
        <p className="eyebrow">
          {item.category.toUpperCase()} / {item.year}
        </p>
        <span className="item-status">{item.status}</span>
      </div>
      {item.cover && (
        <img
          className="focus-cover"
          src={item.cover}
          alt={item.title}
          loading="lazy"
        />
      )}
      <h2>{item.title}</h2>
      <p className="focus-subtitle">{item.subtitle}</p>
      {item.equation && <div className="equation">{item.equation}</div>}
      <p className="focus-description">{item.abstract || item.description}</p>
      {item.authors && (
        <p className="authors">
          {item.authors.join(" · ")}
          {item.journal && ` / ${item.journal}`}
        </p>
      )}
      <div className="tag-list">
        {item.tags.map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>
      {item.id.includes("review") && (
        <div className="workflow">
          <p className="eyebrow">A SECOND READER, NOT AN ORACLE</p>
          <div className="workflow-steps">
            {steps.map((s, i) => (
              <button
                key={s.label}
                aria-pressed={i === step}
                className={i === step ? "active" : ""}
                onClick={() => setStep(i)}
              >
                <small>{s.number}</small>
                {s.label}
              </button>
            ))}
          </div>
          <h3>{steps[step].title}</h3>
          <p>{steps[step].copy}</p>
          <small>{steps[step].tags.join(" · ")}</small>
        </div>
      )}
      {item.video && (
        <video
          className="focus-video"
          src={item.video}
          controls
          preload="metadata"
        />
      )}
      <div className="focus-actions">
        {item.github && <ExternalLink href={item.github}>GitHub</ExternalLink>}
        {item.demo && (
          <ExternalLink href={item.demo}>Live experience</ExternalLink>
        )}
        {item.links?.map((link) => (
          <ExternalLink key={link.url} href={link.url}>
            {link.label}
          </ExternalLink>
        ))}
        <button
          className="text-button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(window.location.href);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}{" "}
          {copied ? "LINK COPIED" : "SHARE"}
        </button>
      </div>
      <button
        className="text-button focus-return"
        onClick={() => enterRoom("atrium")}
      >
        RETURN TO ATRIUM <ArrowRight size={15} />
      </button>
    </Dialog>
  );
}
