import { Bookmark, ArrowUpRight, ArrowRight } from "lucide-react";
import { rooms, profile } from "../content/catalog";
import { roomInfo } from "../content/roomInfo";
import { usePalaceStore } from "../systems/store";
import { Dialog } from "./primitives";

export default function Guide() {
  const { roomId, enterRoom, setOverlay, recent, bookmarks, visits, update } =
    usePalaceStore();
  const visibleRooms = rooms.filter((r) => !r.hidden && r.id !== "cinema");
  return (
    <Dialog
      label="Museum guide"
      className="guide-panel"
      onClose={() => setOverlay(null)}
    >
      <div className="guide-intro">
        <p className="eyebrow">VISITOR GUIDE / 01</p>
        <h2>
          A world,
          <br />
          within reach.
        </h2>
        <p>Choose a room. Take your time.</p>
        <svg
          className="floor-plan"
          viewBox="0 0 260 225"
          fill="none"
          aria-label="Architectural guide to the palace"
        >
          <path
            d="M90 60h80v95H90z M115 155v62h30v-62 M90 80H22v55h68 M170 80h68v55h-68 M98 60V15h64v45"
            stroke="currentColor"
            strokeWidth="1"
          />
          <path
            d="M38 80v55M55 80v55M205 80v55M220 80v55M115 170h30M115 190h30M115 208h30"
            stroke="currentColor"
            opacity=".25"
          />
          <circle cx="130" cy="109" r="15" stroke="currentColor" />
          <circle cx="130" cy="109" r="4" fill="#86baca" />
          <text
            x="130"
            y="144"
            textAnchor="middle"
            fill="currentColor"
            fontSize="8"
            letterSpacing="2"
          >
            ATRIUM
          </text>
          <path
            d="M122 18l8-8 8 8M18 102l-8 7 8 7M242 102l8 7-8 7M122 217l8 8 8-8"
            stroke="currentColor"
            strokeWidth="1"
          />
        </svg>
        <span className="map-caption">A guide, rather than a boundary.</span>
      </div>
      <div className="guide-list">
        <div className="panel-topline">
          <span>THE COLLECTION</span>
          <span>{visibleRooms.length} SPACES</span>
        </div>
        {visibleRooms.map((room) => (
          <button
            key={room.id}
            className={`room-link ${roomId === room.id ? "current" : ""}`}
            onClick={() => {
              update({ started: true });
              enterRoom(room.id);
            }}
          >
            <span className="room-number">{room.number}</span>
            <span className="room-link-title">
              {room.title}
              <small>{room.subtitle}</small>
            </span>
            <span className="room-mark">
              {roomId === room.id ? <i /> : <ArrowUpRight size={18} />}
            </span>
          </button>
        ))}
        <div className="guide-links">
          <button onClick={() => setOverlay("about")}>
            About Jie Tian <ArrowRight size={15} />
          </button>
          <a href={profile.github} target="_blank" rel="noreferrer">
            GitHub <ArrowUpRight size={15} />
          </a>
          <a href={`mailto:${profile.email}`}>
            Contact <ArrowUpRight size={15} />
          </a>
        </div>
        <div className="guide-footer">
          <button
            className="text-button"
            onClick={() => {
              setOverlay(null);
              update({ mode: "index" });
            }}
          >
            2D COLLECTION INDEX <ArrowRight size={15} />
          </button>
          <small>{Object.keys(visits).length} rooms remembered</small>
        </div>
        {(recent.length > 0 || bookmarks.length > 0) && (
          <div className="recent-rooms">
            <span className="eyebrow">YOUR TRAIL</span>
            {[...new Set([...bookmarks, ...recent])].slice(0, 4).map((id) => (
              <button key={id} onClick={() => enterRoom(id)}>
                {bookmarks.includes(id) && <Bookmark size={12} />}{" "}
                {roomInfo(id).title}
              </button>
            ))}
          </div>
        )}
      </div>
    </Dialog>
  );
}
