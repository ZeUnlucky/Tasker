// Optional photo on a task. It is stored as a JPEG data URL inside the task document, which keeps everything on
// Firestore's free plan (Firebase Storage needs a paid plan). A Firestore document is capped at 1 MiB, so photos are
// shrunk in the browser until they fit.

export const MAX_CHARS = 380000; // length of the data URL (about 280 KB of image). Keep in sync with firestore.rules.

// [longest side in px, JPEG quality], tried in order until the result fits
const STEPS = [[1280, 0.8], [1280, 0.65], [1024, 0.65], [800, 0.6], [640, 0.5]];

export async function compressImage(file) {
    if (!file.type.startsWith('image/')) throw new Error('Pick an image file.');
    let bitmap;
    try {
        bitmap = await createImageBitmap(file);
    } catch {
        throw new Error('That image could not be read. Try a JPEG or PNG.');
    }
    try {
        for (const [side, quality] of STEPS) {
            const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(bitmap.width * scale));
            canvas.height = Math.max(1, Math.round(bitmap.height * scale));
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#fff'; // JPEG has no transparency
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
            const url = canvas.toDataURL('image/jpeg', quality);
            if (url.length <= MAX_CHARS) return url;
        }
    } finally {
        bitmap.close();
    }
    throw new Error('That image is too detailed to store. Try a smaller one.');
}
