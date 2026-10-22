import { useMemo, useRef, useState } from "react";
import {
  getDriveItem,
  listClientImages,
  uploadDriveFile,
} from "../services/drive";

type Props = {
  clientId: string;
  featuredImageId?: string;
  onChange: (imageId: string | undefined) => void;
};

export function BlogCoverImagePicker({
  clientId,
  featuredImageId,
  onChange,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const images = useMemo(() => {
    void tick;
    return listClientImages(clientId);
  }, [clientId, tick]);

  const selected = featuredImageId ? getDriveItem(featuredImageId) : undefined;
  const previewSrc =
    selected?.kind === "image" && selected.body?.startsWith("data:image")
      ? selected.body
      : undefined;

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file (PNG, JPG, WebP, or GIF).");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const saved = await uploadDriveFile({
        file,
        clientId,
        parentId: null,
      });
      setTick((n) => n + 1);
      onChange(saved.id);
      setPickerOpen(false);
    } catch {
      setError("Upload failed. Try a smaller image.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <section className="blog-cover-picker" aria-label="Blog cover image">
      <div className="blog-cover-picker-head">
        <div>
          <h3>Cover image</h3>
          <p className="muted">
            Optional — add a photo from Drive so the article looks more
            professional in review.
          </p>
        </div>
        <div className="blog-cover-picker-actions">
          <input
            ref={inputRef}
            type="file"
            className="sr-only"
            accept="image/*"
            onChange={(event) => void handleUpload(event.target.files)}
          />
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? "Uploading…" : "Upload to Drive"}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setPickerOpen((open) => !open)}
          >
            {pickerOpen ? "Hide Drive" : "Choose from Drive"}
          </button>
          {featuredImageId ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => onChange(undefined)}
            >
              Remove
            </button>
          ) : null}
        </div>
      </div>

      {error ? <p className="field-error">{error}</p> : null}

      {previewSrc ? (
        <figure className="blog-cover-preview">
          <img src={previewSrc} alt={selected?.name || "Cover image"} />
          {selected?.name ? (
            <figcaption className="muted">{selected.name}</figcaption>
          ) : null}
        </figure>
      ) : (
        <button
          type="button"
          className="blog-cover-empty"
          onClick={() => inputRef.current?.click()}
        >
          <span aria-hidden>🖼</span>
          Add a cover image (optional)
        </button>
      )}

      {pickerOpen ? (
        <div className="blog-cover-drive-grid" role="listbox" aria-label="Drive images">
          {images.length === 0 ? (
            <p className="muted">
              No images in Drive yet. Upload one above — it stays with this
              client folder.
            </p>
          ) : (
            images.map((item) => {
              const src = item.body?.startsWith("data:image") ? item.body : "";
              const active = item.id === featuredImageId;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={
                    active
                      ? "blog-cover-thumb is-active"
                      : "blog-cover-thumb"
                  }
                  onClick={() => {
                    onChange(item.id);
                    setPickerOpen(false);
                  }}
                >
                  {src ? (
                    <img src={src} alt="" />
                  ) : (
                    <span className="muted">No preview</span>
                  )}
                  <span className="blog-cover-thumb-name">{item.name}</span>
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </section>
  );
}
