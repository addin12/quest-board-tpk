// Pictures live in our own bucket (`covers/…`, `photos/…`), served by the backend. The build downloads each one with the build key,
// crops it and saves it as WebP, so visitors never touch the backend for a picture. The admin page shows submissions' pictures
// straight from `/api/img` (an admin session may see unapproved ones).
// Pure module (explicit .ts imports: the build script uses it).

/** `local:/images/x.svg` marks a picture that ships with the project (the sample data); returns its path, or null. */
export function localPicture(id: string): string | null {
  return id.startsWith("local:/") ? id.slice("local:".length) : null;
}

/** The address the admin page loads a submitted picture from. */
export function adminPictureUrl(id: string): string {
  return localPicture(id) ?? `/api/img/${id}`;
}
