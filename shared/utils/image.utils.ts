// Image utilities: what a file really is, read from its first bytes

import type { TeamLogoMimeType } from '@shared/constants/team.constants';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const RIFF_SIGNATURE = [0x52, 0x49, 0x46, 0x46]; // "RIFF", followed by the size then "WEBP"
const WEBP_MARKER = [0x57, 0x45, 0x42, 0x50];

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

/**
 * The image type a file actually is, from its signature, or null when it is
 * none of the ones a logo can be. A declared content type is never trusted.
 */
export function detectImageType(bytes: Uint8Array): TeamLogoMimeType | null {
  if (startsWith(bytes, PNG_SIGNATURE)) return 'image/png';
  if (startsWith(bytes, JPEG_SIGNATURE)) return 'image/jpeg';
  if (startsWith(bytes, RIFF_SIGNATURE) && startsWith(bytes, WEBP_MARKER, 8)) return 'image/webp';
  return null;
}
