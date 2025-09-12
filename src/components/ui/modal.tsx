'use client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

interface ModalProps {
  title: string;
  description: string;
  isOpen: boolean;
  onClose: () => void;
  children?: React.ReactNode;
  hideHeader?: boolean;
  contentClassName?: string;
  preventClose?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  title,
  description,
  isOpen,
  onClose,
  children,
  hideHeader,
  contentClassName,
  preventClose
}) => {
  const onChange = (open: boolean) => {
    if (!open) {
      if (preventClose) return; // lock the dialog open
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onChange}>
      <DialogContent
        className={[contentClassName, preventClose ? '[&>button]:hidden' : '']
          .filter(Boolean)
          .join(' ')}
      >
        {!hideHeader && (
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
        )}
        {hideHeader && (
          <>
            <VisuallyHidden asChild>
              <DialogTitle>{title || 'Dialog'}</DialogTitle>
            </VisuallyHidden>
            {description ? (
              <VisuallyHidden asChild>
                <DialogDescription>{description}</DialogDescription>
              </VisuallyHidden>
            ) : null}
          </>
        )}
        <div>{children}</div>
      </DialogContent>
    </Dialog>
  );
};
