'use client'

import styles from './module_css/Drawer.module.css'

type Props = {
    open: boolean
    onInchide: () => void
    children: React.ReactNode
}

export default function Drawer({ open, onInchide, children }: Props) {
    if (!open) return null

    return (
        <>
            <div className={styles.overlay} onClick={onInchide} />
            <div className={styles.drawer}>
                <div className={styles.drawerHeader}>
                    <span className={styles.drawerTitlu}>Selectare sală</span>
                    <button className={styles.butonInchide} onClick={onInchide}>✕</button>
                </div>
                {children}
            </div>
        </>
    )
}