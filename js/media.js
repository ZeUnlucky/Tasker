// Optional photo/video on a task: validation and photo downscaling, shared by the app and both backends.

export const LIMITS = { image: 10 * 1024 * 1024, video: 50 * 1024 * 1024 }; // keep in sync with storage.rules
const MAX_SIDE = 1920;

export const kindOf = (file) => (file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : null);

// Returns the file to upload (a downscaled copy for big photos) or throws a user-readable error.
export async function prepareMedia(file) {
    const kind = kindOf(file);
    if (!kind) throw new Error('Pick an image or a video file.');
    let out = file;
    if (kind === 'image' && /^image\/(jpeg|png|webp)$/.test(file.type)) out = await downscale(file).catch(() => file);
    if (out.size > LIMITS[kind]) throw new Error(`That ${kind} is too large (max ${LIMITS[kind] / 1048576} MB).`);
    return out;
}

async function downscale(file) {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1) {
        bitmap.close();
        return file;
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, file.type, 0.85));
    return blob && blob.size < file.size ? new File([blob], file.name, { type: blob.type }) : file;
}
