import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { 
  AlertTriangle, 
  GripVertical, 
  Eye, 
  RotateCcw,
  CheckCircle,
  ArrowUpDown,
  MousePointer2
} from "lucide-react";

interface PageReorderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reorderedPages: string[]) => void;
  initialPages: string[];
  chapterNumber: string;
  naturalSortConfidence: number;
  requiresManualReorder: boolean;
  chapterTitle?: string;
}

interface DraggedItem {
  index: number;
  page: string;
}

export function PageReorderDialog({
  isOpen,
  onClose,
  onConfirm,
  initialPages,
  chapterNumber,
  naturalSortConfidence,
  requiresManualReorder,
  chapterTitle
}: PageReorderDialogProps) {
  const [pages, setPages] = useState<string[]>(initialPages);
  const [draggedItem, setDraggedItem] = useState<DraggedItem | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number>(-1);
  const [hasChanges, setHasChanges] = useState(false);
  const [previewPage, setPreviewPage] = useState<string | null>(null);

  // Reset state when dialog opens with new data
  useEffect(() => {
    if (isOpen) {
      setPages(initialPages);
      setHasChanges(false);
      setDraggedItem(null);
      setDragOverIndex(-1);
      setPreviewPage(null);
    }
  }, [isOpen, initialPages]);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    const item = { index, page: pages[index] };
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify(item));
    
    // Add visual feedback to the dragged item
    e.currentTarget.style.opacity = '0.5';
  };

  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    e.currentTarget.style.opacity = '1';
    setDraggedItem(null);
    setDragOverIndex(-1);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    // Only clear if we're leaving the container entirely
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverIndex(-1);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, dropIndex: number) => {
    e.preventDefault();
    
    if (!draggedItem) return;
    
    const sourceIndex = draggedItem.index;
    if (sourceIndex === dropIndex) {
      setDragOverIndex(-1);
      return;
    }

    // Create new array with item moved to new position
    const newPages = [...pages];
    const [movedItem] = newPages.splice(sourceIndex, 1);
    newPages.splice(dropIndex, 0, movedItem);
    
    setPages(newPages);
    setHasChanges(true);
    setDragOverIndex(-1);
    
    toast({
      title: "Page Reordered",
      description: `Moved page ${sourceIndex + 1} to position ${dropIndex + 1}`,
    });
  };

  const resetOrder = () => {
    setPages(initialPages);
    setHasChanges(false);
    toast({
      title: "Order Reset",
      description: "Pages have been reset to original order",
    });
  };

  const handleConfirm = () => {
    onConfirm(pages);
    onClose();
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
    if (confidence >= 0.6) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
    return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return "High Confidence";
    if (confidence >= 0.6) return "Medium Confidence";
    return "Low Confidence";
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {requiresManualReorder ? (
                <AlertTriangle className="w-5 h-5 text-amber-500" />
              ) : (
                <CheckCircle className="w-5 h-5 text-green-500" />
              )}
              Page Order Review - Chapter {chapterNumber}
              {chapterTitle && <span className="text-sm text-muted-foreground">({chapterTitle})</span>}
            </DialogTitle>
            <DialogDescription className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span>Natural sorting confidence:</span>
                <Badge className={getConfidenceColor(naturalSortConfidence)}>
                  {getConfidenceLabel(naturalSortConfidence)} ({Math.round(naturalSortConfidence * 100)}%)
                </Badge>
              </div>
              {requiresManualReorder ? (
                <div className="flex items-center gap-2 text-amber-600">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm">
                    The automatic page ordering may not be correct. Please review and reorder if needed.
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm">
                    Page order looks good! You can still reorder pages if needed.
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2 text-muted-foreground">
                <MousePointer2 className="w-4 h-4" />
                <span className="text-sm">
                  Drag and drop pages to reorder them. Click on a page to preview it.
                </span>
              </div>
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden">
            <div className="h-full overflow-y-auto">
              <div className="grid grid-cols-6 gap-4 p-2">
                {pages.map((page, index) => (
                  <div
                    key={`${page}-${index}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, index)}
                    className={`
                      relative group cursor-move border-2 rounded-lg overflow-hidden
                      transition-all duration-200 hover:shadow-lg
                      ${dragOverIndex === index 
                        ? 'border-primary bg-primary/10 scale-105' 
                        : 'border-border hover:border-primary/50'
                      }
                      ${draggedItem?.index === index ? 'opacity-50' : ''}
                    `}
                  >
                    {/* Page Number Badge */}
                    <div className="absolute top-2 left-2 z-10">
                      <Badge variant="secondary" className="text-xs font-bold bg-black/70 text-white">
                        {index + 1}
                      </Badge>
                    </div>

                    {/* Drag Handle */}
                    <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="bg-black/70 rounded p-1">
                        <GripVertical className="w-4 h-4 text-white" />
                      </div>
                    </div>

                    {/* Page Image */}
                    <div 
                      className="aspect-[3/4] bg-gray-100 dark:bg-gray-800 relative cursor-pointer"
                      onClick={() => setPreviewPage(page)}
                    >
                      <img
                        src={page}
                        alt={`Page ${index + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                          const parent = (e.target as HTMLImageElement).parentElement;
                          if (parent) {
                            parent.innerHTML = `<div class="flex items-center justify-center h-full text-muted-foreground"><span>Failed to load</span></div>`;
                          }
                        }}
                      />
                      
                      {/* Preview Button Overlay */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <Button size="sm" variant="secondary" className="pointer-events-none">
                          <Eye className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Drop Indicator */}
                    {dragOverIndex === index && draggedItem && draggedItem.index !== index && (
                      <div className="absolute inset-0 border-2 border-primary border-dashed bg-primary/20 rounded-lg flex items-center justify-center">
                        <ArrowUpDown className="w-6 h-6 text-primary" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="flex-row justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={resetOrder}
                disabled={!hasChanges}
                className="flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Reset Order
              </Button>
              <span className="text-xs text-muted-foreground">
                {pages.length} pages total
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleConfirm} className="min-w-20">
                {hasChanges ? "Save Changes" : "Confirm Order"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Page Preview Dialog */}
      {previewPage && (
        <Dialog open={!!previewPage} onOpenChange={() => setPreviewPage(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Page Preview</DialogTitle>
            </DialogHeader>
            <div className="flex justify-center">
              <img
                src={previewPage}
                alt="Page preview"
                className="max-h-[70vh] max-w-full object-contain"
                onError={(e) => {
                  toast({
                    title: "Error",
                    description: "Failed to load page preview",
                    variant: "error",
                  });
                  setPreviewPage(null);
                }}
              />
            </div>
            <DialogFooter>
              <Button onClick={() => setPreviewPage(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}