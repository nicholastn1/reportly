import { check, type Update } from "@tauri-apps/plugin-updater";

export interface UpdateInfo {
  version: string;
  date: string;
  body: string;
}

export type UpdateState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "available"; info: UpdateInfo; update: Update }
  | { status: "downloading"; progress: number }
  | { status: "ready" }
  | { status: "error"; message: string };

export async function checkForUpdate(): Promise<{
  info: UpdateInfo;
  update: Update;
} | null> {
  const update = await check();
  if (!update) return null;

  return {
    info: {
      version: update.version,
      date: update.date ?? "",
      body: update.body ?? "",
    },
    update,
  };
}

export async function downloadAndInstall(
  update: Update,
  onProgress?: (progress: number) => void,
): Promise<void> {
  let totalLength = 0;
  let downloaded = 0;

  await update.downloadAndInstall((event) => {
    if (event.event === "Started" && event.data.contentLength) {
      totalLength = event.data.contentLength;
    } else if (event.event === "Progress") {
      downloaded += event.data.chunkLength;
      if (totalLength > 0 && onProgress) {
        onProgress(Math.round((downloaded / totalLength) * 100));
      }
    }
  });
}
