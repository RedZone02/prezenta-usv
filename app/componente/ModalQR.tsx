'use client'

import styles from './module_css/ModalQR.module.css'

type Props = {
    studentId: string
    numeStudent: string
    onInchide: () => void
}

export default function ModalQR({ studentId, numeStudent, onInchide }: Props) {
    return (
        <div className={styles.overlay} onClick={onInchide}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <button className={styles.butonInchideX} onClick={onInchide}>✕</button>

                <h2 className={styles.titlu}>Codul tău QR</h2>

                <div className={styles.qrBox}>
                    <div className={styles.qrPlaceholder}>
                        QR: {studentId}
                    </div>
                </div>

                <p className={styles.qrLabel}>
                    {numeStudent}<br />
                    ID: <span className={styles.qrId}>{studentId}</span>
                </p>

                <button className={styles.butonInchide} onClick={onInchide}>
                    Închide
                </button>
            </div>
        </div>
    )
}