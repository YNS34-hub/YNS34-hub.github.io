export interface AvatarProfile { version: 1; skin: string; hair: string; shoulders: number; chest: number; waist: number; arms: number; jaw: number; nose: number; eyeHeight: number; hairCrop: number }
export function validateAvatarProfile(value: unknown): AvatarProfile | null;
