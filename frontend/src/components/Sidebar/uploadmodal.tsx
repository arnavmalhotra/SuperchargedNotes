import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Upload, FileText, Image, File as FileIcon, X, GripVertical } from "lucide-react"
import { useCallback, useState, useMemo } from "react"
import { useDropzone } from "react-dropzone"
import axios from "axios"
import { useAuth } from "@clerk/nextjs"
import { useNotes } from "@/contexts/NotesContext"
import { toast } from "sonner"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  UniqueIdentifier,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDraggable } from '@dnd-kit/core';
import ReactDOM from 'react-dom';

interface UploadableFile {
  id: UniqueIdentifier;
  file: File;
}

interface FileGroup {
  id: UniqueIdentifier;
  files: UploadableFile[];
}

type UploadItem =
  | { type: 'file'; item: UploadableFile }
  | { type: 'group'; item: FileGroup };

const generateId = () => `item-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

const acceptedFileTypes = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'text/plain': ['.txt'],
  'application/msword': ['.doc'],
  'application/vnd.ms-excel': ['.xls', '.xlsx'],
  'application/vnd.ms-powerpoint': ['.ppt', '.pptx'],
  'text/markdown': ['.md'],
  'text/csv': ['.csv']
}

export function UploadModal() {
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([])
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null)
  const [uploading, setUploading] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const { userId } = useAuth()
  const { refreshNotes } = useNotes()

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setUploadItems(prevItems => [
      ...prevItems,
      ...acceptedFiles.map(file => ({
        type: 'file' as const,
        item: { id: generateId(), file }
      }))
    ])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptedFileTypes,
    multiple: true
  })

  const removeItem = (idToRemove: UniqueIdentifier) => {
    setUploadItems(items => items.filter(item => item.item.id !== idToRemove))
  }

  const removeFileFromGroup = (groupId: UniqueIdentifier, fileIdToRemove: UniqueIdentifier) => {
    setUploadItems(items => items.map(item => {
      if (item.type === 'group' && item.item.id === groupId) {
        const updatedFiles = item.item.files.filter(f => f.id !== fileIdToRemove)
        if (updatedFiles.length === 0) {
          return null
        } else if (updatedFiles.length === 1) {
          return { type: 'file' as const, item: updatedFiles[0] }
        } else {
          return { ...item, item: { ...item.item, files: updatedFiles } }
        }
      }
      return item
    }).filter(item => item !== null) as UploadItem[])
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id)
  }

  // Function to find the group a file belongs to, if any
  const findFileGroup = (items: UploadItem[], fileId: UniqueIdentifier): FileGroup | null => {
    for (const item of items) {
      if (item.type === 'group') {
        if (item.item.files.some(f => f.id === fileId)) {
          return item.item;
        }
      }
    }
    return null;
  };

  // Helper to get the raw UploadableFile or FileGroup from activeId
  const getActiveItem = (items: UploadItem[], id: UniqueIdentifier | null): UploadItem | null => {
    if (!id) return null;
    // Check top-level items first
    const topLevelItem = items.find(item => item.item.id === id);
    if (topLevelItem) return topLevelItem;
    // Check files within groups
    for (const item of items) {
      if (item.type === 'group') {
        const foundFile = item.item.files.find(f => f.id === id);
        if (foundFile) return { type: 'file', item: foundFile }; // Return as if it were a top-level file for drag purposes
      }
    }
    return null;
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;

    if (!over) return; // Dropped outside any droppable area

    setUploadItems((items) => {
      const activeItem = getActiveItem(items, active.id); // Get potentially nested active item
      if (!activeItem) return items; // Should not happen

      const activeId = active.id;
      const overId = over.id;

      // Find the group the active file might currently be in
      const sourceGroupId = activeItem.type === 'file' ? findFileGroup(items, activeId)?.id : null;

      // Find the target item (could be a file, a group, or the container itself)
      const overItemIndex = items.findIndex(item => item.item.id === overId);
      const overItem = overItemIndex !== -1 ? items[overItemIndex] : null;

      // --- Dragging OUT of a group --- 
      // If active is a file from a group and 'over' is NOT that same group
      if (activeItem.type === 'file' && sourceGroupId && overId !== sourceGroupId) {
        let newItems = [...items];
        let extractedFile: UploadableFile | null = null;

        // Remove from source group
        newItems = newItems.map(item => {
          if (item.type === 'group' && item.item.id === sourceGroupId) {
            extractedFile = item.item.files.find(f => f.id === activeId) || null;
            const remainingFilesInGroup = item.item.files.filter(f => f.id !== activeId);
            if (remainingFilesInGroup.length === 0) {
              return null; // Remove empty group
            } else if (remainingFilesInGroup.length === 1) {
              // Ungroup automatically if only one file left
              return { type: 'file' as const, item: remainingFilesInGroup[0] };
            } else {
              return { ...item, item: { ...item.item, files: remainingFilesInGroup } };
            }
          }
          return item;
        }).filter(item => item !== null) as UploadItem[];

        if (!extractedFile) return items; // Should have found the file

        // Now decide where to put the extracted file
        const targetIndex = overItem ? newItems.findIndex(item => item.item.id === overId) : -1;
        const newFileItem = { type: 'file' as const, item: extractedFile };

        if (targetIndex !== -1) {
          // Insert near the target item (adjust index based on drop position - simplified for now)
          // This basic logic inserts it *after* the target item. More complex logic could refine position.
          newItems.splice(targetIndex + 1, 0, newFileItem);
        } else {
          // Dropped in the main container (not over a specific item), add to end
          newItems.push(newFileItem);
        }
        return newItems;
      }

      // --- Existing Logic (needs slight adjustment for nested check) ---
      const activeTopLevelIndex = items.findIndex(item => item.item.id === activeId);
      const overTopLevelIndex = items.findIndex(item => item.item.id === overId);

      // Ensure we only process top-level drags here (if not handled by drag-out logic above)
      if (activeTopLevelIndex === -1 || overTopLevelIndex === -1) {
        // This might happen if dragging started from within a group but wasn't handled by drag-out
        // Or if dropping onto a file within a group (we'll disallow this for simplicity for now)
        console.log("Drag involves non-top-level items, ignoring for now or needs specific handling");
        return items;
      }

      const activeTopLevelItem = items[activeTopLevelIndex];
      const overTopLevelItem = items[overTopLevelIndex];

      // Scenario 1: Dropping a file onto another file to create a group
      if (activeTopLevelItem.type === 'file' && overTopLevelItem.type === 'file' && activeId !== overId) {
        const newGroup: FileGroup = { id: generateId(), files: [activeTopLevelItem.item, overTopLevelItem.item] };
        const minIndex = Math.min(activeTopLevelIndex, overTopLevelIndex);
        const maxIndex = Math.max(activeTopLevelIndex, overTopLevelIndex);
        // Create new array: items before minIndex + new group + items after maxIndex
        return [
          ...items.slice(0, minIndex),
          { type: 'group' as const, item: newGroup },
          ...items.slice(minIndex + 1, maxIndex),
          ...items.slice(maxIndex + 1)
        ];
      }

      // Scenario 2: Dropping a file into an existing group
      if (activeTopLevelItem.type === 'file' && overTopLevelItem.type === 'group') {
        const updatedGroup: FileGroup = {
          ...overTopLevelItem.item,
          files: [...overTopLevelItem.item.files, activeTopLevelItem.item]
        };
        // Remove the original file and update the group
        return items.map(item =>
          item.item.id === overId ? { type: 'group' as const, item: updatedGroup } : item
        ).filter(item => item.item.id !== activeId);
      }

      // Scenario 3: Reordering top-level items
      if (activeTopLevelIndex !== overTopLevelIndex) {
        return arrayMove(items, activeTopLevelIndex, overTopLevelIndex);
      }

      // Fallback
      return items;
    });
  }

  const handleUpload = async () => {
    if (uploadItems.length === 0) return

    setUploading(true)
    const formData = new FormData()
    const groupingStructure: any[] = []
    let fileIndexCounter = 0

    if (userId) {
      formData.append('user_id', userId)
    } else {
      console.error("User ID is missing. Cannot upload.")
      toast.error("Authentication error. Please log in again.")
      setUploading(false)
      return
    }

    uploadItems.forEach(uploadItem => {
      if (uploadItem.type === 'file') {
        const file = uploadItem.item.file
        const fileId = uploadItem.item.id
        formData.append('files', file, file.name)
        groupingStructure.push({ type: 'individual', id: fileId, filename: file.name })
        fileIndexCounter++
      } else if (uploadItem.type === 'group') {
        const fileIdsInGroup: UniqueIdentifier[] = []
        const filenamesInGroup: string[] = []
        uploadItem.item.files.forEach(groupedFile => {
          const file = groupedFile.file
          const fileId = groupedFile.id
          formData.append('files', file, file.name)
          fileIdsInGroup.push(fileId)
          filenamesInGroup.push(file.name)
          fileIndexCounter++
        })
        groupingStructure.push({ type: 'group', id: uploadItem.item.id, fileIds: fileIdsInGroup, filenames: filenamesInGroup })
      }
    })

    formData.append('grouping_structure', JSON.stringify(groupingStructure))

    try {
      const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      setUploadItems([])
      setIsDialogOpen(false)
      refreshNotes()

      const createdNotes = response.data
      if (Array.isArray(createdNotes) && createdNotes.length > 0) {
        if (createdNotes.length === 1) {
          toast.success("Note created successfully!", { description: `Note titled '${createdNotes[0].title}' was saved.` })
        } else {
          toast.success(`${createdNotes.length} notes created successfully!`)
        }
      } else {
        toast.success("Files processed successfully!")
      }

    } catch (error) {
      console.error('Upload failed:', error)
      let errorMessage = "Failed to upload and process your files. Please try again."
      if (axios.isAxiosError(error) && error.response?.data) {
        if (error.response.data.detail?.errors) {
          errorMessage = `Upload failed: ${error.response.data.detail.errors.join(", ")}`
        } else if (typeof error.response.data.detail === 'string') {
          errorMessage = `Upload failed: ${error.response.data.detail}`
        }
      }
      toast.error("Upload Failed", { description: errorMessage })
    } finally {
      setUploading(false)
    }
  }

  const itemIds = useMemo(() => uploadItems.map(item => item.item.id), [uploadItems])

  return (
    <>
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" className="bg-blue-500 text-white hover:bg-blue-600 rounded-lg transition-colors w-full justify-start">
            <Upload className="w-4 h-4 mr-2" />
            Upload Notes
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[525px] bg-white">
          <DialogHeader>
            <DialogTitle className="text-blue-500">Upload Notes</DialogTitle>
            <DialogDescription>
              Drag and drop files below, or click to select.
              <br />
              To group files, drag one file onto another. Drag files out of a group to separate them.
              <br />
              Each group and individual file will become a separate note.
              <br/>
              PSA: We currently cannot process diagrams, work in progress.
            </DialogDescription>
          </DialogHeader>
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors mb-4
              ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-500'}`}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center gap-4">
              <Upload className="w-12 h-12 text-blue-400" />
              <div>
                <p className="text-sm text-gray-600">
                  {isDragActive
                    ? "Drop the files here..."
                    : "Drag and drop files here, or click to select files"}
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Supported formats: PDF, DOCX, JPG, PNG, TXT, DOC, XLS, PPT, MD, CSV
                </p>
              </div>
            </div>
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
              <div className="mt-4 space-y-2 max-h-60 overflow-y-auto pr-2">
                {uploadItems.map(uploadItem => {
                  if (uploadItem.type === 'file') {
                    return <SortableFileItem key={uploadItem.item.id} id={uploadItem.item.id} file={uploadItem.item.file} onRemove={() => removeItem(uploadItem.item.id)} />
                  } else {
                    // Render the SortableGroupItem
                    return (
                      <SortableGroupItem
                        key={uploadItem.item.id}
                        id={uploadItem.item.id}
                        group={uploadItem.item}
                        onRemoveGroup={() => removeItem(uploadItem.item.id)}
                        onRemoveFileFromGroup={removeFileFromGroup}
                      />
                    );
                  }
                })}
                {uploadItems.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">No files selected.</p>
                )}
              </div>
            </SortableContext>

            {typeof document !== 'undefined' && ReactDOM.createPortal(
                <DragOverlay dropAnimation={null}>
                    {activeId ? (() => {
                        const activeUploadItem = getActiveItem(uploadItems, activeId);
                        if (!activeUploadItem) return null;

                        if (activeUploadItem.type === 'file') {
                            return <FileItemDisplay file={activeUploadItem.item.file} />;
                        } else if (activeUploadItem.type === 'group') {
                            return <GroupItemDisplay group={activeUploadItem.item} />;
                        }
                        return null;
                    })() : null}
                </DragOverlay>,
                document.body // Target document.body
            )}
          </DndContext>

          <DialogFooter>
            <Button
              onClick={handleUpload}
              disabled={uploadItems.length === 0 || uploading}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white mt-4"
            >
              {uploading ? 'Uploading...' : `Upload ${uploadItems.length > 0 ? '(' + uploadItems.length + ' item/group)' : ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

interface SortableFileItemProps {
  id: UniqueIdentifier;
  file: File;
  onRemove: () => void;
}

function SortableFileItem({ id, file, onRemove }: SortableFileItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 'auto',
  };

  const fileType = file.type;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 text-sm p-2 bg-blue-50 rounded justify-between touch-manipulation"
    >
      <div className="flex items-center gap-2 truncate flex-grow">
        <button {...attributes} {...listeners} className="cursor-grab p-1">
          <GripVertical className="w-4 h-4 text-gray-400" />
        </button>

        {fileType.includes('pdf') ? (
          <FileText className="w-4 h-4 text-red-500 flex-shrink-0" />
        ) : fileType.includes('image') ? (
          <Image className="w-4 h-4 text-blue-500 flex-shrink-0" />
        ) : (
          <FileIcon className="w-4 h-4 text-gray-500 flex-shrink-0" />
        )}
        <span className="truncate">{file.name}</span>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="p-1 hover:bg-blue-100 rounded-full flex-shrink-0"
        aria-label="Remove file"
      >
        <X className="w-3 h-3 text-gray-500" />
      </button>
    </div>
  );
}

// --- Sortable Group Item Component ---
interface SortableGroupItemProps {
  id: UniqueIdentifier;
  group: FileGroup;
  onRemoveGroup: () => void;
  onRemoveFileFromGroup: (groupId: UniqueIdentifier, fileId: UniqueIdentifier) => void;
}

function SortableGroupItem({ id, group, onRemoveGroup, onRemoveFileFromGroup }: SortableGroupItemProps) {
  const {
    attributes,
    listeners, // These listeners are for dragging the *entire* group
    setNodeRef,
    transform,
    transition,
    isDragging: isGroupDragging, // Renamed to avoid conflict
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isGroupDragging ? 0.5 : 1,
    zIndex: isGroupDragging ? 10 : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border border-blue-300 bg-blue-50/50 rounded-lg p-2 space-y-1 mb-2 shadow touch-manipulation"
    >
      {/* Group Header (with drag handle for the group) */}
      <div className="flex items-center justify-between pb-1 border-b border-blue-200">
        <div className="flex items-center gap-1">
          <button {...attributes} {...listeners} className="cursor-grab p-1">
            <GripVertical className="w-4 h-4 text-gray-500" />
          </button>
          <span className="text-xs font-medium text-blue-700">Group ({group.files.length} files)</span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemoveGroup();
          }}
          className="p-1 hover:bg-red-100 rounded-full flex-shrink-0"
          aria-label="Remove group"
        >
          <X className="w-3 h-3 text-red-500" />
        </button>
      </div>

      {/* Files within the group (each needs to be draggable individually) */}
      <div className="pl-4 pr-1 space-y-1">
        {group.files.map((fileItem) => (
          <DraggableGroupFileItem
            key={fileItem.id}
            id={fileItem.id} // Use file's ID for its own drag logic
            file={fileItem.file}
            onRemove={() => onRemoveFileFromGroup(group.id, fileItem.id)}
          />
        ))}
      </div>
    </div>
  );
}

// --- Draggable File Item *within* a Group ---
interface DraggableGroupFileItemProps {
  id: UniqueIdentifier;
  file: File;
  onRemove: () => void;
}

// This component uses useDraggable, not useSortable, as it's not being sorted *within* the group
function DraggableGroupFileItem({ id, file, onRemove }: DraggableGroupFileItemProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 20 : 'auto', // Ensure dragged file is above group items
  } : {};

  const fileType = file.type;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 text-xs p-1 bg-white rounded justify-between relative"
      {...attributes} // Spread attributes and listeners here for the draggable element
      {...listeners}
    >
      <div className="flex items-center gap-1 truncate flex-grow cursor-grab">
        {/* No separate drag handle needed, whole item is draggable */}
        {/* File Icon */}
        {fileType.includes('pdf') ? (
          <FileText className="w-3 h-3 text-red-500 flex-shrink-0" />
        ) : fileType.includes('image') ? (
          <Image className="w-3 h-3 text-blue-500 flex-shrink-0" />
        ) : (
          <FileIcon className="w-3 h-3 text-gray-500 flex-shrink-0" />
        )}
        {/* File Name */}
        <span className="truncate">{file.name}</span>
      </div>
      {/* Remove Button */}
      <button
        onClick={(e) => {
          e.stopPropagation(); // Prevent drag listeners
          onRemove();
        }}
        className="p-0.5 hover:bg-red-100 rounded-full flex-shrink-0"
        aria-label="Remove file from group"
      >
        <X className="w-2.5 h-2.5 text-gray-500" />
      </button>
    </div>
  );
}

// --- Simple Display Components for Drag Overlay ---

interface FileItemDisplayProps {
  file: File;
}

function FileItemDisplay({ file }: FileItemDisplayProps) {
  const fileType = file.type;
  // Mimics the styling of SortableFileItem but without DnD hooks/styles
  return (
    <div className="flex items-center gap-2 text-sm p-2 bg-blue-100 rounded justify-between shadow-lg border border-blue-300">
      <div className="flex items-center gap-2 truncate flex-grow">
        <GripVertical className="w-4 h-4 text-gray-400" /> {/* Keep visual handle */}
        {fileType.includes('pdf') ? (
          <FileText className="w-4 h-4 text-red-500 flex-shrink-0" />
        ) : fileType.includes('image') ? (
          <Image className="w-4 h-4 text-blue-500 flex-shrink-0" />
        ) : (
          <FileIcon className="w-4 h-4 text-gray-500 flex-shrink-0" />
        )}
        <span className="truncate">{file.name}</span>
      </div>
      {/* No remove button needed in overlay */}
    </div>
  );
}

interface GroupItemDisplayProps {
  group: FileGroup;
}

function GroupItemDisplay({ group }: GroupItemDisplayProps) {
   // Mimics the styling of SortableGroupItem but without DnD hooks/styles
    return (
        <div className="border border-blue-400 bg-blue-100 rounded-lg p-2 space-y-1 shadow-lg">
            {/* Group Header */}
            <div className="flex items-center justify-between pb-1 border-b border-blue-200">
                <div className="flex items-center gap-1">
                     <GripVertical className="w-4 h-4 text-gray-500" />
                    <span className="text-xs font-medium text-blue-700">Group ({group.files.length} files)</span>
                </div>
            </div>
            {/* Files within the group (simplified view) */}
            <div className="pl-4 pr-1 space-y-1">
                {group.files.map((fileItem) => (
                    <div key={fileItem.id} className="flex items-center gap-1 truncate text-xs p-1 bg-white/80 rounded">
                         {fileItem.file.type.includes('pdf') ? (
                            <FileText className="w-3 h-3 text-red-500 flex-shrink-0" />
                         ) : fileItem.file.type.includes('image') ? (
                            <Image className="w-3 h-3 text-blue-500 flex-shrink-0" />
                         ) : (
                            <FileIcon className="w-3 h-3 text-gray-500 flex-shrink-0" />
                         )}
                        <span className="truncate">{fileItem.file.name}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
