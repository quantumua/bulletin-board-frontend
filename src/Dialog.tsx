import { useEffect, useRef, type ReactNode } from 'react'

interface DialogProps {
  open: boolean
  onClose: () => void
  label: string
  children: ReactNode
}

// Modal built on the native <dialog>: the browser provides the focus trap, Esc and returning focus to the opener.
// Children stay mounted while closed, which is how a form keeps its draft.
export default function Dialog({ open, onClose, label, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  // Read inside the native close event, which can arrive after we closed the dialog ourselves
  const openRef = useRef(open)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    openRef.current = open
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-label={label}
      onClose={() => {
        if (openRef.current) onCloseRef.current()
      }}
      // The dialog has no padding, so a click on the dialog element itself is a click on the backdrop
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="dialog-body">{children}</div>
    </dialog>
  )
}
