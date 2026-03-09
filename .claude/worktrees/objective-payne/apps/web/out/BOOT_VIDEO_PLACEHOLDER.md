# Titan Boot Video Placeholder

Place your boot intro video at:

`public/boot.mp4`

Expected behavior after adding the file:
- Marketing route (`/`) plays `boot.mp4` in the background.
- Skip button routes immediately to `/os`.
- If video ends (or 4.5s fallback while playing), app routes to `/os`.

If `boot.mp4` is missing or cannot play:
- Marketing route shows fallback intro UI.
- No auto-redirect occurs.
- User can click **Enter Titan Protocol** to continue.
