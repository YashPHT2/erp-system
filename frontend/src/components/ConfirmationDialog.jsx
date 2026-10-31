import { Modal } from './Modal';

export function ConfirmationDialog({
  open,
  title,
  confirmLabel = 'Confirm',
  tone = 'primary',
  isBusy = false,
  onConfirm,
  onClose,
  children,
}) {
  return (
    <Modal open={open} title={title} onClose={isBusy ? () => {} : onClose}>
      <div className="text-sm text-slate-600">{children}</div>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onClose} disabled={isBusy}>Back</button>
        <button type="button" className={tone === 'danger' ? 'btn-danger' : 'btn-primary'} onClick={onConfirm} disabled={isBusy}>
          {isBusy ? 'Saving…' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
