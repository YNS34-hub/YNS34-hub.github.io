import { profile } from "../content/catalog";
import { Dialog, ExternalLink } from "./primitives";
import { usePalaceStore } from "../systems/store";
export default function About() {
  const setOverlay = usePalaceStore((s) => s.setOverlay);
  return (
    <Dialog
      label="About Jie Tian"
      className="about-panel"
      onClose={() => setOverlay(null)}
    >
      <p className="eyebrow">THE PERSON BEHIND THE PALACE</p>
      <h2>{profile.name}</h2>
      <p className="about-role">{profile.role}</p>
      <p className="about-bio">{profile.bio}</p>
      <p className="institution">{profile.institution}</p>
      <div className="tag-list">
        {profile.interests.map((x) => (
          <span key={x}>{x}</span>
        ))}
      </div>
      <blockquote>
        “{profile.principle}”<small>A working principle</small>
      </blockquote>
      <p className="about-world">
        This place holds what I make, what I study, what I listen to, and the
        ideas still taking shape. It continues to grow with me.
      </p>
      <div className="about-links">
        <ExternalLink href={profile.github}>GitHub</ExternalLink>
        <ExternalLink href={profile.linkedin}>LinkedIn</ExternalLink>
        <ExternalLink href={`mailto:${profile.email}`}>Email</ExternalLink>
      </div>
      <a className="legacy-link" href="/legacy/">
        The original academic portfolio ↗
      </a>
    </Dialog>
  );
}
