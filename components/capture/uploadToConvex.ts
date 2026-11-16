/**
 * Convex file storage takes a plain POST of the file body to a short-lived upload URL and
 * answers with the storage id. Proof media and Voice Draft audio both go through here.
 */
export async function uploadToConvex(uploadUrl: string, file: string | Blob, contentType: string): Promise<string> {
  const body = typeof file === "string" ? await (await fetch(file)).blob() : file;
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": contentType },
    body,
  });
  if (!response.ok) throw new Error(`Upload failed (${response.status})`);
  const { storageId } = (await response.json()) as { storageId: string };
  return storageId;
}
