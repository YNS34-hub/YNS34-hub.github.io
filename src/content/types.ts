export type Category = "project" | "research" | "experiment" | "archive";
export type RoomType =
  | "white-cube"
  | "black-box"
  | "archive"
  | "installation"
  | "listening"
  | "image-gallery"
  | "anomaly";
export type RoomRule =
  | "mirror"
  | "gravity"
  | "floating"
  | "compressing"
  | "impossible"
  | "loop"
  | "memory";
export interface ContentItem {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  category: Category;
  github?: string;
  demo?: string;
  cover?: string;
  coverCaption?: string;
  video?: string;
  year: string;
  featured: boolean;
  roomType: RoomType;
  roomRule?: RoomRule;
  tags: string[];
  status: string;
  authors?: string[];
  journal?: string;
  abstract?: string;
  equation?: string;
  links?: { label: string; url: string }[];
  date?: string;
}
export interface MusicTrack {
  roomIds?: string[];
  id: string;
  title: string;
  artist: string;
  album: string;
  cover?: string;
  displayCover?: string;
  color?: string;
  src?: string;
  url?: string;
  year?: string;
  favorite: boolean;
  source: "static" | "local" | "netease";
  duration?: number;
}
export interface WallpaperItem {
  mediaKind?: "wallpaper" | "visual" | "project" | "research";
  roomIds?: string[];
  order?: number;
  primary?: boolean;
  removed?: boolean;
  projectUrl?: string;
  github?: string;
  favorite?: boolean;
  width?: number;
  height?: number;
  id: string;
  title: string;
  src: string;
  description: string;
  displaySrc?: string;
  color?: string;
  fileName?: string;
  tags: string[];
  category: string;
  source: string;
  date: string;
  imported?: boolean;
}
export interface RoomDefinition {
  id: string;
  number: string;
  title: string;
  subtitle: string;
  type: RoomType;
  rule?: RoomRule;
  color?: string;
  hidden?: boolean;
}
