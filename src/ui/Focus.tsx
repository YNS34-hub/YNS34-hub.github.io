import { useState } from "react";
import { Check, Copy, ArrowRight } from "lucide-react";
import { usePalaceStore } from "../systems/store";
import { Dialog, ExternalLink } from "./primitives";
import { reviewWorkflow as steps } from "../content/catalog";
import { useMotionCue } from "../motion/useMotionCue";

export default function Focus() {
  const {
    focus: item,
    focusItem,
    enterRoom,
    bookmarks,
    toggleBookmark,
  } = usePalaceStore();
  const [copied, setCopied] = useState(false);
  const [step, setStep] = useState(0);
  const [live, setLive] = useState(false);
  const headCue = useMotionCue<HTMLDivElement>(item?.id || "empty", "copy");
  const titleCue = useMotionCue<HTMLHeadingElement>(item?.id || "empty", "copy", !!item, 60);
  const captionCue = useMotionCue<HTMLElement>(item?.id || "empty", "copy", !!item, 120);
  if (!item) return null;
  const close = () => focusItem(null);
  return (
    <Dialog label={item.title} className="focus-panel" onClose={close}>
      <div className="focus-head" ref={headCue}>
        <p className="eyebrow">
          COLLECTION / {item.category.toUpperCase()} / {item.year}
        </p>
        <span className="item-status">{item.status}</span>
      </div>
      <div className={`focus-body ${item.cover ? "" : "focus-text-only"}`}>
        {item.cover && (
          <figure className="focus-visual">
            <img
              className="focus-cover"
              src={item.cover}
              alt={item.coverCaption || item.title}
              loading="lazy"
            />
            <figcaption ref={captionCue}>
              <span>{item.coverCaption || "FROM THE COLLECTION"}</span>
              <span>{item.year}</span>
            </figcaption>
            {item.video && (
              <video
                className="focus-video"
                src={item.video}
                controls
                preload="metadata"
              />
            )}
            {item.demo && item.tags.includes("Website study") && (
              <>
                <button
                  className="text-button"
                  onClick={() => setLive((v) => !v)}
                >
                  {live ? "PAUSE PREVIEW" : "ACTIVATE THIS WEBSITE"}
                </button>
                {live && (
                  <iframe
                    className="live-work"
                    title={`${item.title} interactive preview`}
                    src={item.demo}
                    sandbox="allow-scripts"
                    referrerPolicy="no-referrer"
                  />
                )}
                <small>
                  One active work. If embedding is unavailable, use ENTER
                  PROJECT.
                </small>
              </>
            )}
          </figure>
        )}
        <div className="focus-copy">
          <p className="focus-catalogue-number">A WORK IN THE MEMORY PALACE</p>
          <h2 ref={titleCue}>{item.title}</h2>
          <p className="focus-subtitle">{item.subtitle}</p>
          {item.equation && <div className="equation">{item.equation}</div>}
          <details className="work-details">
            <summary>About this work</summary>
            <p className="focus-description">
              {item.abstract || item.description}
            </p>
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
          </details>
          {item.date && (
            <p className="focus-date">
              CREATED / <time dateTime={item.date}>{item.date}</time>
            </p>
          )}
          {!item.cover && item.video && (
            <video
              className="focus-video"
              src={item.video}
              controls
              preload="metadata"
            />
          )}
          <div className="focus-actions">
            <button
              className="text-button"
              aria-pressed={bookmarks.includes(item.id)}
              onClick={() => toggleBookmark(item.id)}
            >
              {bookmarks.includes(item.id)
                ? "KEPT IN MY COLLECTION"
                : "KEEP THIS WORK"}
            </button>
            {item.github && (
              <ExternalLink href={item.github}>SOURCE</ExternalLink>
            )}
            {item.demo && (
              <ExternalLink href={item.demo}>ENTER PROJECT</ExternalLink>
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
              {copied ? <Check size={15} /> : <Copy size={15} />}
              {copied ? "LINK COPIED" : "SHARE"}
            </button>
          </div>
          <button
            className="text-button focus-return"
            onClick={() => enterRoom("atrium")}
          >
            RETURN TO ATRIUM <ArrowRight size={15} />
          </button>
        </div>
      </div>
      {item.id.includes("review") && (
        <div className="workflow">
          <p className="eyebrow">
            THE REVIEW LENS / A SECOND READER, NOT AN ORACLE
          </p>
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
    </Dialog>
  );
}
