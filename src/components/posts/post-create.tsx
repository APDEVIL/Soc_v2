"use client";

import { useState, useCallback } from "react";
import { X, ImagePlus, MapPin, Hash, ChevronLeft, Loader2, Film } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useUploadThing } from "@/lib/uploadthing";
import { api } from "@/trpc/react";
import { toast } from "sonner";

type Step = "upload" | "edit";

interface UploadedFile {
  url: string;
  type: "image" | "video";
  preview: string;
  name: string;
  order: number;
}

interface PostCreateProps {
  onClose: () => void;
  groupId?: string;
}

export function PostCreate({ onClose, groupId }: PostCreateProps) {
  const [step, setStep] = useState<Step>("upload");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [caption, setCaption] = useState("");
  const [location, setLocation] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const utils = api.useUtils();

  const { startUpload } = useUploadThing("postImage", {
    onUploadError: (err) => { toast.error(err.message ?? "Upload failed"); },
  });

  const createPost = api.post.create.useMutation({
    onSuccess: () => {
      toast.success("Post shared!");
      void utils.post.getFeed.invalidate();
      void utils.post.getUserPosts.invalidate();
      void utils.user.getProfile.invalidate();
      void utils.post.getExploreFeed.invalidate();
      onClose();
    },
    onError: () => toast.error("Failed to share post"),
  });

  // ─── File selection ────────────────────────────────────────────────────────
  async function handleFileSelect(selectedFiles: FileList | null) {
    if (!selectedFiles?.length) return;
    
    // We get a standard array of files
    const fileArray = Array.from(selectedFiles).slice(0, 10);

    // Validate type
    const invalid = fileArray.find(
      (f) => !f.type.startsWith("image/") && !f.type.startsWith("video/"),
    );
    if (invalid) {
      toast.error("Only images and videos are supported");
      return;
    }

    setIsUploading(true);
    try {
      // 🚨 CRITICAL FIX: Pass the raw fileArray to startUpload!
      // DO NOT filter it down to just images, otherwise videos get stripped
      // and UploadThing crashes with an empty array.
      const result = await startUpload(fileArray);
      
      if (!result) throw new Error("Upload failed");

      const uploaded: UploadedFile[] = result.map((r, i) => ({
        url: r.url,
        // Check what the actual file was so we render the correct preview icon
        type: fileArray[i]?.type.startsWith("video/") ? "video" : "image",
        preview: r.url,
        name: fileArray[i]?.name ?? `file-${i}`,
        order: files.length + i,
      }));

      setFiles((prev) => [...prev, ...uploaded]);
      setStep("edit");
    } catch {
      toast.error("Upload failed");
    } finally {
      setIsUploading(false);
    }
  }

  // ─── Drag & drop ──────────────────────────────────────────────────────────
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      void handleFileSelect(e.dataTransfer.files);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [files.length],
  );

  // ─── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!files.length) return;
    createPost.mutate({
      caption: caption.trim() || undefined,
      location: location.trim() || undefined,
      groupId,
      media: files.map((f) => ({
        url: f.url,
        type: f.type,
        order: f.order,
      })),
    });
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index).map((f, i) => ({ ...f, order: i })));
    if (files.length <= 1) setStep("upload");
  }

  const charCount = caption.length;
  const charLimit = 2200;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden rounded-2xl">
        <DialogHeader className="flex flex-row items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            {step === "edit" && (
              <button onClick={() => setStep("upload")} className="text-muted-foreground hover:text-foreground">
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            <DialogTitle className="text-sm font-semibold">
              {step === "upload" ? "Create post" : "New post"}
            </DialogTitle>
          </div>
          {step === "edit" && (
            <Button
              size="sm"
              className="h-8 bg-brand text-brand-foreground hover:bg-brand/90 font-semibold text-xs"
              onClick={handleSubmit}
              disabled={createPost.isPending}
            >
              {createPost.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Share"}
            </Button>
          )}
        </DialogHeader>

        {/* Step: Upload */}
        {step === "upload" && (
          <div
            className={cn(
              "flex flex-col items-center justify-center min-h-[400px] gap-5 p-8 transition-colors",
              isDragging && "bg-brand/5",
            )}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
            onDrop={handleDrop}
          >
            {isUploading ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-10 w-10 animate-spin text-brand" />
                <p className="text-sm text-muted-foreground">Uploading…</p>
              </div>
            ) : (
              <>
                <div className="flex gap-3">
                  <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
                    <ImagePlus className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
                    <Film className="h-8 w-8 text-muted-foreground" />
                  </div>
                </div>
                <div className="text-center">
                  <p className="font-semibold">Drag photos and videos here</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Up to 10 files, 8MB per image
                  </p>
                </div>
                <Label htmlFor="file-upload">
                  <div className="cursor-pointer rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground hover:bg-brand/90 transition-colors">
                    Select from device
                  </div>
                </Label>
                <input
                  id="file-upload"
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  className="sr-only"
                  onChange={(e) => void handleFileSelect(e.target.files)}
                />
              </>
            )}
          </div>
        )}

        {/* Step: Edit */}
        {step === "edit" && (
          <div className="flex flex-col">
            {/* Media preview strip */}
            <div className="flex gap-2 overflow-x-auto p-3 border-b border-border bg-muted/30">
              {files.map((f, i) => (
                <div key={i} className="relative shrink-0">
                  {f.type === "video" ? (
                     <video
                       src={f.preview}
                       className="h-20 w-20 rounded-xl object-cover border border-border"
                     />
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={f.preview}
                      alt=""
                      className="h-20 w-20 rounded-xl object-cover border border-border"
                    />
                  )}
                  <button
                    onClick={() => removeFile(i)}
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background"
                  >
                    <X className="h-3 w-3" />
                  </button>
                  {f.type === "video" && (
                    <span className="absolute bottom-1 left-1 bg-black/50 p-1 rounded-full">
                      <Film className="h-3.5 w-3.5 text-white" />
                    </span>
                  )}
                </div>
              ))}
              {/* Add more */}
              {files.length < 10 && (
                <label className="shrink-0 flex h-20 w-20 items-center justify-center rounded-xl border-2 border-dashed border-border cursor-pointer hover:border-brand transition-colors">
                  <ImagePlus className="h-6 w-6 text-muted-foreground" />
                  <input
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    className="sr-only"
                    onChange={(e) => void handleFileSelect(e.target.files)}
                  />
                </label>
              )}
            </div>

            {/* Caption */}
            <div className="p-4 space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Hash className="h-3.5 w-3.5 text-brand" />
                    Caption
                  </Label>
                  <span className={cn("text-xs tabular-nums", charCount > charLimit * 0.9 ? "text-destructive" : "text-muted-foreground")}>
                    {charCount}/{charLimit}
                  </span>
                </div>
                <Textarea
                  placeholder="Write a caption… add hashtags with #"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  maxLength={charLimit}
                  rows={4}
                  className="resize-none text-sm rounded-xl focus-visible:ring-brand"
                />
              </div>

              {/* Location */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-brand" />
                  Location
                  <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  placeholder="Add location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  maxLength={100}
                  className="h-10 rounded-xl text-sm focus-visible:ring-brand"
                />
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}