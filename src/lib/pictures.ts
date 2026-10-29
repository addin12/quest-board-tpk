// Pictures come from Google Drive (the forms' file uploads). The script makes a file viewable by link when an
// admin approves it, and the build downloads a resized copy, so visitors never load anything from Drive.
// The admin page shows submissions' pictures straight from Drive's thumbnail address.
// Pure module (explicit .ts imports: the build script uses it).

/** A Drive file id's resized copy: `https://drive.google.com/thumbnail?id=…&sz=w1080`. */
export function driveThumbUrl(fileId: string, width = 600): string {
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w${width}`;
}

/** The address the admin page loads a submitted picture from: our own bucket (`covers/…`, `photos/…`), or a Drive file for older rows. */
export function adminPictureUrl(id: string, width = 600): string {
  return /^(?:covers|photos)\//.test(id) ? `/api/img/${id}` : driveThumbUrl(id, width);
}

/** `local:/images/x.svg` marks a picture that ships with the project (the sample data); returns its path, or null. */
export function localPicture(id: string): string | null {
  return id.startsWith("local:/") ? id.slice("local:".length) : null;
}
