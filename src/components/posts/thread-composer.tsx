"use client";

import { useCallback } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThreadPart {
  id: string;
  content: string;
}

interface ThreadComposerProps {
  parts: ThreadPart[];
  onChange: (parts: ThreadPart[]) => void;
  charLimit?: number;
}

interface SortablePartProps {
  part: ThreadPart;
  index: number;
  total: number;
  charLimit: number;
  onChange: (id: string, content: string) => void;
  onDelete: (id: string) => void;
}

function SortablePart({ part, index, total, charLimit, onChange, onDelete }: SortablePartProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: part.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const count = part.content.length;
  const remaining = charLimit - count;
  const isOver = remaining < 0;
  const isWarning = remaining >= 0 && remaining < charLimit * 0.1;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative flex gap-2 rounded-lg border bg-background p-2 transition-shadow",
        isDragging ? "shadow-lg opacity-80 z-10" : "shadow-none"
      )}
    >
      {/* Drag handle */}
      <button
        type="button"
        className="flex-shrink-0 mt-1 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
        {...attributes}
        {...listeners}
        tabIndex={-1}
      >
        <GripVertical className="w-4 h-4" />
      </button>

      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium">
            {index + 1} / {total}
          </span>
        </div>
        <textarea
          value={part.content}
          onChange={(e) => onChange(part.id, e.target.value)}
          placeholder={`Part ${index + 1}…`}
          rows={3}
          className="w-full resize-none bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
        />
        <div className="flex items-center justify-between">
          <span
            className={cn(
              "text-xs font-mono",
              isOver
                ? "text-destructive"
                : isWarning
                ? "text-yellow-600 dark:text-yellow-400"
                : "text-muted-foreground"
            )}
          >
            {isOver ? `-${Math.abs(remaining)}` : remaining}
          </span>
        </div>
      </div>

      {/* Delete button */}
      {total > 1 && (
        <button
          type="button"
          onClick={() => onDelete(part.id)}
          className="flex-shrink-0 mt-1 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
          title="Remove part"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

export function ThreadComposer({ parts, onChange, charLimit = 280 }: ThreadComposerProps) {
  const sensors = useSensors(useSensor(PointerSensor));

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        const oldIndex = parts.findIndex((p) => p.id === active.id);
        const newIndex = parts.findIndex((p) => p.id === over.id);
        onChange(arrayMove(parts, oldIndex, newIndex));
      }
    },
    [parts, onChange]
  );

  function handleChange(id: string, content: string) {
    onChange(parts.map((p) => (p.id === id ? { ...p, content } : p)));
  }

  function handleDelete(id: string) {
    onChange(parts.filter((p) => p.id !== id));
  }

  function addPart() {
    onChange([
      ...parts,
      { id: `part-${Date.now()}-${Math.random().toString(36).slice(2)}`, content: "" },
    ]);
  }

  return (
    <div className="space-y-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={parts.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          {parts.map((part, index) => (
            <SortablePart
              key={part.id}
              part={part}
              index={index}
              total={parts.length}
              charLimit={charLimit}
              onChange={handleChange}
              onDelete={handleDelete}
            />
          ))}
        </SortableContext>
      </DndContext>

      <button
        type="button"
        onClick={addPart}
        className="flex items-center gap-2 w-full px-3 py-2 rounded-lg border border-dashed text-sm text-muted-foreground hover:text-foreground hover:border-border transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add Part
      </button>
    </div>
  );
}
