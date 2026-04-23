'use client'

import { useEffect, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import styles from './module_css/ModalQR.module.css'

type Props = {
    studentId: string
    numeStudent: string
    salaId: string
    salaSelectata: {
        nume: string
        orar: {
            materie: string
            ora: string
            grupa: string
        }
    }
    onInchide: () => void
}

const DURATA_VALABILITATE_MS = 5 * 60 * 1000 // 5 minute

function genereazaPayload(studentId: string, salaId: string, orarId: string) {
    return {
        studentId,
        salaId,
        orarId,
        validPana: new Date(Date.now() + DURATA_VALABILITATE_MS).toISOString(),
    }
}

function genereazaOrarId(salaId: string, grupa: string, materie: string) {
    const slug = materie.toLowerCase().replace(/\s+/g, '-')
    return `${salaId}-${grupa}-${slug}`
}

export default function ModalQR({
    studentId,
    numeStudent,
    salaId,
    salaSelectata,
    onInchide,
}: Props) {
    const orarId = genereazaOrarId(
        salaId,
        salaSelectata.orar.grupa,
        salaSelectata.orar.materie
    )

    const [payload, setPayload] = useState(() =>
        genereazaPayload(studentId, salaId, orarId)
    )
    const [secundeRamase, setSecundeRamase] = useState(
        DURATA_VALABILITATE_MS / 1000
    )
    const [expirat, setExpirat] = useState(false)

    useEffect(() => {
        const interval = setInterval(() => {
            setSecundeRamase((prev) => {
                if (prev <= 1) {
                    clearInterval(interval)
                    setExpirat(true)
                    return 0
                }
                return prev - 1
            })
        }, 1000)

        return () => clearInterval(interval)
    }, [payload])

    function reinnoieste() {
        setPayload(genereazaPayload(studentId, salaId, orarId))
        setSecundeRamase(DURATA_VALABILITATE_MS / 1000)
        setExpirat(false)
    }

    const minute = Math.floor(secundeRamase / 60)
    const secunde = secundeRamase % 60
    const procentRamas = (secundeRamase / (DURATA_VALABILITATE_MS / 1000)) * 100
    const eUrgent = secundeRamase <= 60

    return (
        <div className={styles.overlay} onClick={onInchide}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>

                <div className={styles.header}>
                    <h2 className={styles.titlu}>Cod QR prezență</h2>
                    <button className={styles.butonX} onClick={onInchide}>✕</button>
                </div>

                <div className={`${styles.qrBox} ${expirat ? styles.qrExpirat : ''}`}>
                    {expirat ? (
                        <div className={styles.expiratOverlay}>
                            <span className={styles.expiratIcon}>⏱</span>
                            <p className={styles.expiratText}>QR expirat</p>
                        </div>
                    ) : (
                        <QRCodeCanvas
                            value={JSON.stringify(payload)}
                            size={210}
                            bgColor="#ffffff"
                            fgColor="#111827"
                            level="M"
                            includeMargin
                        />
                    )}
                </div>

                {/* Bara de timp */}
                {!expirat && (
                    <div className={styles.timerContainer}>
                        <div className={styles.timerBar}>
                            <div
                                className={`${styles.timerFill} ${eUrgent ? styles.timerUrgent : ''}`}
                                style={{ width: `${procentRamas}%` }}
                            />
                        </div>
                        <span className={`${styles.timerText} ${eUrgent ? styles.timerTextUrgent : ''}`}>
                            Valabil {minute}:{String(secunde).padStart(2, '0')}
                        </span>
                    </div>
                )}

                {/* Info student */}
                <div className={styles.info}>
                    <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>Student</span>
                        <span className={styles.infoValue}>{numeStudent}</span>
                    </div>
                    <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>ID</span>
                        <span className={styles.infoValue}>{studentId}</span>
                    </div>
                    <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>Sală</span>
                        <span className={styles.infoValue}>{salaSelectata.nume}</span>
                    </div>
                    <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>Materie</span>
                        <span className={styles.infoValue}>{salaSelectata.orar.materie}</span>
                    </div>
                    <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>Interval</span>
                        <span className={styles.infoValue}>{salaSelectata.orar.ora}</span>
                    </div>
                </div>

                {expirat ? (
                    <button className={styles.butonReinnoieste} onClick={reinnoieste}>
                        Generează cod nou
                    </button>
                ) : (
                    <button className={styles.butonInchide} onClick={onInchide}>
                        Închide
                    </button>
                )}

            </div>
        </div>
    )
}