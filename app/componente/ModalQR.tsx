'use client'

import { useEffect, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import styles from './module_css/ModalQR.module.css'
import { createClientBrowser } from '../lib/supabase/client'

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

interface RoomSeatUpdate {
    numar: number;
    ocupat: boolean;
    rezervat: boolean;
    room_id: string;
    student_id: string | null;
}

const DURATA_VALABILITATE_SECUNDE = 300 // 5 minute

export default function ModalQR({ studentId, numeStudent, salaId, salaSelectata, onInchide }: Props) {
    const supabase = createClientBrowser()
    const [token, setToken] = useState<string | null>(null)
    const [secundeRamase, setSecundeRamase] = useState(DURATA_VALABILITATE_SECUNDE)
    const [expirat, setExpirat] = useState(false)
    const [succes, setSucces] = useState(false)

    async function cereTokenNou() {
        setToken(null)
        try {
            const res = await fetch('/api/generare-qr', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ studentId, salaId })
            })

            if (!res.ok) {
                const textEroare = await res.text();
                let detaliiEroare = textEroare;

                try {
                    const jsonEroare = JSON.parse(textEroare);
                    detaliiEroare = jsonEroare.error || textEroare;
                } catch {
                }

                console.error(`Eroare de la server (Status ${res.status}):`, detaliiEroare);
                setExpirat(true);
                return;
            }

            const data = await res.json()
            if (data.token) {
                setToken(data.token)
                setSecundeRamase(DURATA_VALABILITATE_SECUNDE)
                setExpirat(false)
            }
        } catch (err) {
            console.error("Eroare critică la fetch:", err);
            setExpirat(true);
        }
    }

    // Cerem token la deschiderea modalului
    useEffect(() => {
        cereTokenNou()
    }, [])

    // Timer-ul
    useEffect(() => {
        if (!token || succes) return;
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
    }, [token, succes])

    // Ascultător pentru confirmarea prezenței în timp real
    useEffect(() => {
        if (!token) return;

        const channel = supabase
            .channel(`confirmare-qr-${studentId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'room_seats',
                    filter: `student_id=eq.${studentId}`
                },
                (payload: { new: RoomSeatUpdate }) => {
                    if (payload.new.ocupat === true) {
                        setSucces(true);

                        // Închidem modalul automat după 2.5 secunde
                        setTimeout(() => {
                            onInchide();
                        }, 2500);
                    }
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel) };
    }, [token, studentId, onInchide, supabase]);

    // Calcule pentru UI-ul timer-ului
    const minute = Math.floor(secundeRamase / 60)
    const secunde = secundeRamase % 60
    const procentRamas = (secundeRamase / DURATA_VALABILITATE_SECUNDE) * 100
    const eUrgent = secundeRamase <= 60

    return (
        <div className={styles.overlay} onClick={onInchide}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>

                <div className={styles.header}>
                    <h2 className={styles.titlu}>Cod QR prezență</h2>
                    <button className={styles.butonX} onClick={onInchide}>✕</button>
                </div>

                <div className={`${styles.qrBox} ${expirat ? styles.qrExpirat : ''}`}>
                    {succes ? (
                        <div className={styles.succesContainer}>
                            <div className={styles.succesIcon}>✅</div>
                            <h3 className={styles.succesTitlu}>Prezență marcată!</h3>
                            <p className={styles.succesText}>Te poți așeza la locul tău.</p>
                        </div>
                    ) : expirat ? (
                        <div className={styles.expiratOverlay}>
                            <span className={styles.expiratIcon}>⏱</span>
                            <p className={styles.expiratText}>QR expirat</p>
                        </div>
                    ) : token ? (
                        <QRCodeCanvas
                            value={token}
                            size={210}
                            bgColor="#ffffff"
                            fgColor="#111827"
                            level="L"
                            includeMargin
                        />
                    ) : (
                        <p className={styles.loadingText}>Generez codul securizat...</p>
                    )}
                </div>
                {/* Bara de timp */}
                {!expirat && !succes && token && (
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
                {!succes && (
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
                )}

                {/* Butoane */}
                {!succes && (
                    expirat ? (
                        <button className={styles.butonReinnoieste} onClick={cereTokenNou}>
                            Generează cod nou
                        </button>
                    ) : (
                        <button className={styles.butonInchide} onClick={onInchide}>
                            Închide
                        </button>
                    )
                )}
            </div>
        </div>
    )
}