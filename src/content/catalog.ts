import projectData from "../../content/projects.json";
import researchData from "../../content/research.json";
import experimentData from "../../content/experiments.json";
import archiveData from "../../content/archive.json";
import musicData from "../../content/music.json";
import wallpaperData from "../../content/wallpapers.json";
import roomData from "../../content/rooms.json";
import profileData from "../../content/profile.json";
import workflowData from "../../content/review-workflow.json";
import type {
  ContentItem,
  MusicTrack,
  WallpaperItem,
  RoomDefinition,
} from "./types";

export const projects = projectData as ContentItem[];
export const research = researchData as ContentItem[];
export const experiments = experimentData as ContentItem[];
export const archive = archiveData as ContentItem[];
export const allContent: ContentItem[] = [
  ...projects,
  ...research,
  ...experiments,
  ...archive,
];
export const music = musicData as MusicTrack[];
export const wallpapers = wallpaperData as WallpaperItem[];
export const rooms = roomData as RoomDefinition[];
export const profile = profileData;
export const reviewWorkflow = workflowData;
