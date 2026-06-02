'use client'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import styles from './page.module.css'
import { createClientBrowser } from '../lib/supabase/client'

type Loc = { id: number; ocupat: boolean }

export default function DisplayPage() {
    const supabase = createClientBrowser()
    const searchParams = useSearchParams()
    const roomId = searchParams.get('room')

    const [locuri, setLocuri] = useState<Loc[]>([])
    const [roomUUID, setRoomUUID] = useState<string | null>(null)
    const [salaNume, setSalaNume] = useState('—')
    const [orarInfo, setOrarInfo] = useState({ materie: '—', ora: '—' })
    const [ora, setOra] = useState('')
    const [dataText, setDataText] = useState('')

    // Ceas
    useEffect(() => {
        const update = () => {
            const now = new Date()
            setOra(now.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }))
            setDataText(now.toLocaleDateString('ro-RO', { weekday: 'long', day: '2-digit', month: 'long' }))
        }
        update()
        const interval = setInterval(update, 1000)
        return () => clearInterval(interval)
    }, [])

    // Date inițiale
    useEffect(() => {
        if (!roomId) return

        async function init() {
            // 1. Găsește sala după nume → obține UUID
            const { data: room } = await supabase
                .from('rooms')
                .select('id, name')
                .eq('name', roomId)
                .single()

            if (!room) {
                console.error('Sala nu a fost găsită:', roomId)
                return
            }

            setSalaNume(room.name)
            setRoomUUID(room.id)

            // 2. Locurile sălii
            const { data: seats, error: seatsError } = await supabase
                .from('room_seats')
                .select('numar, ocupat')
                .eq('room_id', room.id)
                .order('numar')

            console.log('seats:', seats, 'error:', seatsError)

            if (seats) {
                setLocuri(seats.map((s: any) => ({ id: s.numar, ocupat: s.ocupat })))
            }

            // 3. Orar curent
            const acum = new Date()
            const zi = acum.getDay() === 0 ? 7 : acum.getDay()
            const oraAcum = acum.toTimeString().slice(0, 8)
            const { data: orar } = await supabase
                .from('schedule')
                .select('materie, ora_start, ora_end')
                .eq('room_id', room.id)
                .eq('zi', zi)
                .lte('ora_start', oraAcum)
                .gte('ora_end', oraAcum)
                .maybeSingle()

            if (orar) {
                setOrarInfo({
                    materie: orar.materie,
                    ora: `${orar.ora_start.slice(0, 5)} – ${orar.ora_end.slice(0, 5)}`
                })
            }
        }
        init()
    }, [roomId])

    useEffect(() => {
        if (!roomUUID) return

        const channel = supabase
            .channel(`display-${roomUUID}`)
            .on('postgres_changes',
                {
                    event: '*', schema: 'public', table: 'room_seats',
                    filter: `room_id=eq.${roomUUID}`
                },
                (payload: any) => {
                    const updated = payload.new
                    setLocuri(prev => prev.map(l =>
                        l.id === updated.numar ? { ...l, ocupat: updated.ocupat } : l
                    ))
                }
            )
            .subscribe()
        return () => { supabase.removeChannel(channel) }
    }, [roomUUID])

    const libere = locuri.filter(l => !l.ocupat).length
    const ocupate = locuri.filter(l => l.ocupat).length

    if (!roomId) return <div style={{ padding: '2rem' }}>Lipsește parametrul ?room= din URL</div>

    return (
        <div className={styles.display}>
            <div className={styles.header}>
                <div className={styles.headerStanga}>
                    <span className={styles.salaNume}>{salaNume}</span>
                    <span className={styles.materie}>{orarInfo.materie}</span>
                </div>
                <div className={styles.headerCentru}>
                    <span className={styles.oraText}>{ora}</span>
                    <span className={styles.dataText}>{dataText}</span>
                </div>
                <div className={styles.headerDreapta}>
                    <span className={styles.intervalLabel}>Interval</span>
                    <span className={styles.interval}>{orarInfo.ora}</span>
                </div>
            </div>

            <div className={styles.gridZona}>
                <div className={styles.tabla}>▲ TABLĂ ▲</div>
                <div className={styles.grid}>
                    {locuri.map(loc => (
                        <div
                            key={loc.id}
                            className={`${styles.loc} ${loc.ocupat ? styles.locOcupat : styles.locLiber}`}
                        >
                            {loc.id}
                        </div>
                    ))}
                </div>
            </div>

            <div className={styles.footer}>
                <div className={styles.statLiber}>
                    <span className={styles.statNr}>{libere}</span>
                    <span className={styles.statLabel}>Locuri libere</span>
                </div>
                <div className={styles.separator} />
                <div className={styles.statOcupat}>
                    <span className={styles.statNr}>{ocupate}</span>
                    <span className={styles.statLabel}>Ocupate</span>
                </div>
                <div className={styles.separator} />
                <div className={styles.statTotal}>
                    <span className={styles.statNr}>{locuri.length}</span>
                    <span className={styles.statLabel}>Total</span>
                </div>
            </div>
        </div>
    )
}