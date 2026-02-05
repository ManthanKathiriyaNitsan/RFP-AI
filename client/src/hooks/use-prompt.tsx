import { useState, useCallback } from "react";
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
  const [inputValue, setInputValue] = useState("");
  const [resolvePromise, setResolvePromise] = useState<((value: string | null) => void) | null>(null);

  const prompt = useCallback((options: PromptOptions): Promise<string | null> => {
    return new Promise((resolve) => {
      setOptions({
        title: options.title || "Input",
        description: options.description,
        placeholder: options.placeholder || "",
        defaultValue: options.defaultValue || "",
        confirmText: options.confirmText || "OK",
        cancelText: options.cancelText || "Cancel",
        type: options.type || "text",
      });
      setInputValue(options.defaultValue || "");
      setResolvePromise(() => resolve);
      setIsOpen(true);
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setIsOpen(false);
    if (resolvePromise) {
      resolvePromise(inputValue || null);
      setResolvePromise(null);
      setInputValue("");
    }
  }, [resolvePromise, inputValue]);

  const handleCancel = useCallback(() => {
    setIsOpen(false);
    if (resolvePromise) {
      resolvePromise(null);
      setResolvePromise(null);
      setInputValue("");
    }
  }, [resolvePromise]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleConfirm();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  }, [handleConfirm, handleCancel]);

  // Return a stable element (not a new component each render) so typing in the input
  // doesn't remount the dialog and cause flicker.
  const PromptDialog = (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{options.title}</DialogTitle>
          {options.description && <DialogDescription>{options.description}</DialogDescription>}
        </DialogHeader>
        <div className="py-4">
          <Label htmlFor="prompt-input" className="sr-only">
            {options.placeholder || "Enter value"}
          </Label>
          <Input
            id="prompt-input"
            type={options.type}
            placeholder={options.placeholder}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
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
  );

  return { prompt, PromptDialog };
}
