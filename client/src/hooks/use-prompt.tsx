import { useState, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PromptOptions {
  title?: string;
  description?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmText?: string;
  cancelText?: string;
  type?: "text" | "number" | "email" | "password";
}

export function usePrompt() {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<PromptOptions>({
    title: "Input",
    description: "",
    placeholder: "",
    defaultValue: "",
    confirmText: "OK",
    cancelText: "Cancel",
    type: "text",
  });
  const [resolvePromise, setResolvePromise] = useState<((value: string | null) => void) | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const prompt = useCallback((opts: PromptOptions): Promise<string | null> => {
    return new Promise((resolve) => {
      setOptions({
        title: opts.title || "Input",
        description: opts.description,
        placeholder: opts.placeholder || "",
        defaultValue: opts.defaultValue || "",
        confirmText: opts.confirmText || "OK",
        cancelText: opts.cancelText || "Cancel",
        type: opts.type || "text",
      });
      setResolvePromise(() => resolve);
      setIsOpen(true);
    });
  }, []);

  const handleConfirm = useCallback(() => {
    const value = inputRef.current?.value?.trim() ?? "";
    setIsOpen(false);
    if (resolvePromise) {
      resolvePromise(value || null);
      setResolvePromise(null);
    }
  }, [resolvePromise]);

  const handleCancel = useCallback(() => {
    setIsOpen(false);
    if (resolvePromise) {
      resolvePromise(null);
      setResolvePromise(null);
    }
  }, [resolvePromise]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleConfirm();
      } else if (e.key === "Escape") {
        handleCancel();
      }
    },
    [handleConfirm, handleCancel]
  );

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open && resolvePromise) {
        resolvePromise(null);
        setResolvePromise(null);
      }
      setIsOpen(open);
    },
    [resolvePromise]
  );

  return {
    prompt,
    PromptDialog: () => (
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent
          onInteractOutside={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>{options.title}</DialogTitle>
            {options.description && <DialogDescription>{options.description}</DialogDescription>}
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="prompt-input" className="sr-only">
              {options.placeholder || "Enter value"}
            </Label>
            <Input
              ref={inputRef}
              id="prompt-input"
              key={isOpen ? `prompt-${options.title}-${options.defaultValue ?? ""}` : "prompt-closed"}
              type={options.type}
              placeholder={options.placeholder}
              defaultValue={options.defaultValue ?? ""}
              onKeyDown={handleKeyDown}
              autoFocus
              className="w-full"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancel}>
              {options.cancelText}
            </Button>
            <Button onClick={handleConfirm}>{options.confirmText}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    ),
  };
}
