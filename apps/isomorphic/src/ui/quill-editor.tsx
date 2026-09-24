'use client';

import { FieldError, Textarea } from 'rizzui';
import cn from '@utils/class-names';

interface QuillEditorProps {
  id?: string;
  value?: string;
  onChange?: (value: string) => void;
  error?: string;
  label?: React.ReactNode;
  className?: string;
  labelClassName?: string;
  errorClassName?: string;
  toolbarPosition?: 'top' | 'bottom';
}

export default function QuillEditor({
  id,
  label,
  error,
  className,
  labelClassName,
  errorClassName,
  value,
  onChange,
}: QuillEditorProps) {
  return (
    <div className={cn(className)}>
      {label && (
        <label className={cn('mb-1.5 block', labelClassName)}>{label}</label>
      )}
      <Textarea
        id={id}
        value={value ?? ''}
        onChange={(event) => onChange?.(event.target.value)}
        className="min-h-[100px]"
      />
      {error && (
        <FieldError size="md" error={error} className={errorClassName} />
      )}
    </div>
  );
}
