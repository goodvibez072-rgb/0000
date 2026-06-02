import { useState, useRef, useEffect, DragEvent, ChangeEvent } from "react";
import { Upload, X, Image as ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fetchWithCsrfFormData } from "@/lib/csrf";

interface ImageUploadProps {
  value?: string;
  onChange: (url: string) => void;
  onFileChange?: (file: File | null) => void;
  disabled?: boolean;
  className?: string;
  accept?: string;
  maxSize?: number; // in MB
  uploadEndpoint?: string;
}

export function ImageUpload({
  value,
  onChange,
  onFileChange,
  disabled = false,
  className,
  accept = "image/jpeg,image/jpg,image/png,image/webp,image/gif",
  maxSize = 10, // 10MB default
  uploadEndpoint = "/api/admin/upload-ad-image"
}: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<string | undefined>(value);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync preview with value prop (for editing existing ads)
  useEffect(() => {
    setPreview(value);
  }, [value]);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const validateFile = (file: File): string | null => {
    const validTypes = accept.split(',').map(t => t.trim());
    if (!validTypes.includes(file.type)) {
      return `Invalid file type. Accepted: ${validTypes.join(', ')}`;
    }

    const maxSizeBytes = maxSize * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return `File size must be less than ${maxSize}MB`;
    }

    return null;
  };

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetchWithCsrfFormData(uploadEndpoint, formData);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Upload failed');
      }

      const data = await response.json();
      onChange(data.url);
      setPreview(data.url);
      if (onFileChange) {
        onFileChange(file);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to upload image';
      setError(errorMessage);
      console.error('Upload error:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    if (disabled) return;

    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    const file = files[0];
    const validationError = validateFile(file);
    
    if (validationError) {
      setError(validationError);
      return;
    }

    await uploadFile(file);
  };

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const validationError = validateFile(file);
    
    if (validationError) {
      setError(validationError);
      return;
    }

    await uploadFile(file);
  };

  const handleRemove = () => {
    setPreview(undefined);
    onChange('');
    if (onFileChange) {
      onFileChange(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setError(null);
  };

  return (
    <div className={cn("space-y-2", className)}>
      {preview ? (
        <div className="relative group">
          <img
            src={preview}
            alt="Upload preview"
            className="w-full h-48 object-cover rounded-lg border-2 border-border"
          />
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleRemove}
              disabled={disabled || isUploading}
            >
              <X className="w-4 h-4 mr-2" />
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
            isDragging && !disabled
              ? "border-primary bg-primary/10"
              : "border-border hover:border-primary/50",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            onChange={handleFileSelect}
            className="hidden"
            disabled={disabled || isUploading}
          />
          
          {isUploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-12 h-12 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Uploading...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              {isDragging ? (
                <Upload className="w-12 h-12 text-primary" />
              ) : (
                <ImageIcon className="w-12 h-12 text-muted-foreground" />
              )}
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {isDragging ? 'Drop image here' : 'Click to upload or drag and drop'}
                </p>
                <p className="text-xs text-muted-foreground">
                  PNG, JPG, WebP, GIF (max {maxSize}MB)
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
