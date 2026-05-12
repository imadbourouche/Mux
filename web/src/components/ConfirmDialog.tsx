import { useEscKey } from "../hooks/useEscKey";

type Props = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger,
  onConfirm,
  onCancel,
}: Props) {
  useEscKey(onCancel);
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 420 }}>
        <h2>{title}</h2>
        <p style={{ margin: 0, color: "var(--muted)" }}>{message}</p>
        <div className="modal-actions">
          <button onClick={onCancel}>{cancelLabel}</button>
          <button className={danger ? "danger" : "primary"} onClick={onConfirm} autoFocus>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
